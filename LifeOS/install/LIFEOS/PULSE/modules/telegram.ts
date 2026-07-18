/**
 * LifeOS Pulse — Telegram Module
 *
 * grammY polling bot absorbed into Pulse as a long-running module.
 * Does NOT create its own HTTP server — health is reported via the
 * parent's /health endpoint using telegramHealth().
 *
 * Architecture: grammY polling → auth → SDK session → stream → Telegram
 */

import { Bot, InputFile } from "grammy"
import { query } from "@anthropic-ai/claude-agent-sdk"
import { SessionStore, type Message as SessionMessage } from "../lib/session-store"
import { needsCompression, compressSession, buildCompressionHolder } from "../lib/context-compression"
import { sanitize, analyzeForInjection } from "../lib/sanitize"
import { disambiguateHomographs } from "../lib/homographs"
import { join, resolve, sep } from "path"
import { appendFile, mkdir, readFile, rm, stat as statFile, unlink, writeFile } from "fs/promises"
import { inference } from "../../TOOLS/Inference"
import { loadLifeosConfig } from "../../TOOLS/LifeosConfig"
import { read as readMemory, type ReadResult as MemoryReadResult } from "../../TOOLS/MemoryWriter"
import { getRelevantContext } from "../../TOOLS/MemoryRetriever"
import {
  loadProposalQueue,
  markProposal,
  parseProposalReply,
  formatProposalMessage,
  applyProposalEdit,
  logProposalEvent,
  logProposalReply,
  type ProposalRow,
  type ProposalReply,
} from "../lib/telegram-proposals"
import { stripModeScaffolding, hasModeScaffolding } from "../lib/strip-mode-scaffolding"
import { claudeDir } from "../../TOOLS/lifeos-root";

// BILLING: Strip ANTHROPIC_API_KEY and ANTHROPIC_AUTH_TOKEN before any SDK
// query() call. Bun auto-loads ~/.claude/.env into this process; if either key
// is present, @anthropic-ai/claude-agent-sdk bills it directly instead of the
// CLAUDE_CODE_OAUTH_TOKEN subscription (both outrank OAuth in Anthropic's auth
// precedence chain). This was the root cause of an early-2026 Sonnet 4.5
// $XXX + Web Search $YY invoice — every Telegram message was a 25-turn
// SDK session billed to the API. Mirrors LIFEOS/TOOLS/Inference.ts:116-117.
delete process.env.ANTHROPIC_API_KEY
delete process.env.ANTHROPIC_AUTH_TOKEN

// Capture the ElevenLabs API key into a module-local constant at import
// time. We do NOT delete from process.env here because the Pulse VoiceServer
// module reads ELEVENLABS_API_KEY at its own init time and needs the key to
// stay present for the CLI /notify channel. The advisor-recommended scrub
// pattern (deleting from env) breaks Voice when Telegram imports first.
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY ?? ""

// ── Config Interface ──

export interface TelegramConfig {
  enabled: boolean
  bot_token?: string
  allowed_users?: number[]
  max_turns?: number
  sdk_timeout_ms?: number
  edit_interval_ms?: number
  // Opt out of Telegram voice-note summaries (PR #1458). undefined ⇒ on, so existing
  // installs are unchanged; set voice_summaries = false under [telegram] in PULSE.toml.
  voice_summaries?: boolean
}

// ── Constants ──

const HOME = process.env.HOME ?? ""
const CWD = join(claudeDir())
const STATE_DIR = join(claudeDir(), "LIFEOS", "PULSE", "state", "telegram")
const LOGS_DIR = join(claudeDir(), "LIFEOS", "PULSE", "logs", "telegram")
const STALE_ACK_CACHE_DIR = join(STATE_DIR, "ack-cache")
const MAX_TELEGRAM_LENGTH = 4096
const CURSOR = " ▌"
const SHORT_REPLY_WORDS = 8                     // text replies shorter than this skip voice synthesis
const MAX_VOICE_SUMMARY_WORDS = 60              // hard cap if Sonnet ignores the soft 30-word limit
const CONTEXT_BLOCK_MAX_CHARS = 60_000          // ceiling on the per-turn LifeOS memory injection — fits DA + PRINCIPAL identity + TELOS + active sessions + the two _MEMORY.md hot-layer files (ISA ISC-29; worst case ~50k under ISC-30)
const IDLE_TIMEOUT_MS = 60 * 60 * 1000          // 1 hour — gap of silence that resets the SDK session + drops prior history injection
const INFERENCE_HARD_BUDGET_MS = 10_000         // outer race cap on summarize; measured Sonnet subprocess cost is 4-6s, this gives slack without losing the voice trailing the text by too much
const MIN_FALLBACK_WORDS = 6                    // a fallback summary shorter than this is presumed too thin to be worth voicing
const MEANINGFUL_REPLY_WORDS = 25               // when a reply is at least this long, a too-short fallback is a regression — skip voice rather than ship a "0:00" stub
const LIFEOS_DIR = join(claudeDir(), "LIFEOS")

// ── Bidirectional Telegram images (ported from public PR #1384, @klausagnoletti) ──
//
// INBOUND: photos and PNG/JPEG image documents are downloaded into INCOMING_DIR
// (under the telegram state root) and the saved absolute path is injected into
// the prompt so the SDK session views it with the Read tool. Acceptance is
// decided by MAGIC-BYTE sniff — never the client-declared mime, which is
// attacker-controllable — plus a byte cap AND a pixel/dimension cap
// (un-re-encoded documents can be decompression bombs: tiny file, gigapixel
// canvas). Refusing to decode WebP/GIF/SVG inbound retires the
// libwebp-2023-4863 and SVG-script attack classes.
//
// OUTBOUND: the model emits [[IMG:/abs/path]] anywhere in its reply; the bridge
// extracts the refs, validates each path (absolute local file, image extension,
// size cap), ships it via sendPhoto, and strips the tag from the text —
// including the live editMessageText stream, so the raw tag never flashes.
const INCOMING_DIR = join(STATE_DIR, "incoming")
const IMG_TAG_RE = /\[\[IMG:\s*([^\]]+?)\s*\]\]/g
// A trailing partially-streamed tag ("[[", "[[IMG:/pa", "[[IMG:/p]") — hidden
// from the live stream until the closing "]]" arrives.
const IMG_TAG_PARTIAL_TAIL_RE = /\[{1,2}(?:I(?:M(?:G(?::[^\]]*\]?)?)?)?)?$/
const PHOTO_EXTS = new Set(["png", "jpg", "jpeg", "webp", "gif"])
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_IMAGE_PIXELS = 40_000_000
const MAX_IMAGE_DIM = 10_000

function extractImageRefs(text: string): string[] {
  const refs: string[] = []
  let m: RegExpExecArray | null
  IMG_TAG_RE.lastIndex = 0
  while ((m = IMG_TAG_RE.exec(text)) !== null) refs.push(m[1]!.trim())
  return refs
}

function stripImageTags(text: string): string {
  return text.replace(IMG_TAG_RE, "").replace(/\n{3,}/g, "\n\n").trim()
}

function stripImageTagsForStream(text: string): string {
  // Stream variant: also hide an incomplete tag at the tail of the buffer so
  // raw "[[IMG:/..." text never flashes in the live-edited Telegram message.
  return stripImageTags(text.replace(IMG_TAG_PARTIAL_TAIL_RE, ""))
}

function inspectImage(b: Uint8Array): { kind: "png" | "jpeg"; width: number; height: number } | null {
  // PNG: signature 89 50 4E 47 0D 0A 1A 0A; IHDR width/height as BE uint32 at 16/20
  if (b.length >= 24 &&
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) {
    const width = ((b[16]! << 24) | (b[17]! << 16) | (b[18]! << 8) | b[19]!) >>> 0
    const height = ((b[20]! << 24) | (b[21]! << 16) | (b[22]! << 8) | b[23]!) >>> 0
    return { kind: "png", width, height }
  }
  // JPEG: starts FF D8; scan segment markers for a Start-Of-Frame to read dims
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf])
    let off = 2
    while (off + 9 < b.length) {
      if (b[off] !== 0xff) { off++; continue }
      const marker = b[off + 1]!
      off += 2
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue
      const segLen = (b[off]! << 8) | b[off + 1]!
      if (segLen < 2) break
      if (SOF.has(marker)) {
        const height = (b[off + 3]! << 8) | b[off + 4]!
        const width = (b[off + 5]! << 8) | b[off + 6]!
        return { kind: "jpeg", width, height }
      }
      off += segLen
    }
  }
  return null  // not a recognized PNG/JPEG (or JPEG with no SOF) — reject
}

// Voice ID for outbound voice summaries. Read at module import from
// LifeosConfig — `[da.voices.main] voice_id` in LIFEOS/USER/CONFIG/LIFEOS_CONFIG.toml.
// LifeosConfig is the typed interface between system code (this file) and user
// data (the voice ID); the migration from direct settings.json reads to
// LifeosConfig is the Phase F win — one source of truth, no parallel paths.
//
// Fallback: ElevenLabs' public "Rachel" voice (21m00Tcm4TlvDq8ikWAM) — used
// only when LifeosConfig is unavailable or missing required fields. Matches the
// public release's bootstrap DA_IDENTITY template default so a fresh install
// that hasn't run Interview yet still gets a functional (if generic) voice.
// The fallback must remain a public voice — release-time scrubbing trusts
// this literal as safe-to-ship.
//
// We intentionally do NOT read `process.env.ELEVENLABS_VOICE_ID` here — that
// env var historically held a different voice in some installs, and using it
// caused Telegram and CLI voices to diverge.
const DA_VOICE_ID = ((): string => {
  try {
    const v = loadLifeosConfig().da.voices.main.voiceId
    if (v && typeof v === "string" && v.length > 0) return v
  } catch { /* fall through to public default */ }
  return "21m00Tcm4TlvDq8ikWAM"  // ElevenLabs "Rachel" — public voice
})()

// DA display name from LifeosConfig ([da].name); "LifeOS" fallback (PR #1457).
const DA_NAME = ((): string => {
  try { const n = loadLifeosConfig().da.name; if (n && typeof n === "string" && n.length > 0) return n } catch { /* default */ }
  return "LifeOS"
})()

// ── Module State ──

let bot: Bot | null = null
let sessionStore: SessionStore | null = null
let currentSessionId: string | null = null
let processing = false
let startedAt = 0
let messagesReceived = 0
let messagesResponded = 0
let lastSessionId: string | undefined
let activeConfig: TelegramConfig | null = null
let lastVoiceSendMs: number | null = null

// Idle-session-boundary state.
//   lastMessageAt   = timestamp of the LAST fully-successful exchange. Used to
//                     detect when a fresh message lands after IDLE_TIMEOUT_MS.
//   threadStartedAt = timestamp of the start of the current thread. The history
//                     injection filters to messages with timestamp >= this, so
//                     a fresh thread sees no prior conversation injected into
//                     the prompt even though conversations.json still holds it.
//
// Single-chat assumption: these are module-global, matching the existing
// `lastSessionId` shape. If the allowlist ever grows past one chat, boundary
// state must be keyed per-chat (Map<chatId, { lastMessageAt, threadStartedAt }>).
let lastMessageAt: number | null = null
let threadStartedAt: number = 0

// ── Logging ──

function log(level: "info" | "warn" | "error", msg: string, data?: unknown) {
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    component: "telegram",
    msg,
    ...(data ? { data } : {}),
  })
  console.log(entry)
}

// ── Chat Log ──

async function appendChatLog(userMsg: string, botMsg: string) {
  const chatLogPath = join(LOGS_DIR, "chat-log.md")
  const ts = new Date().toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  })
  const entry = `\n### ${ts}\n**{{PRINCIPAL_NAME}}:** ${userMsg}\n\n**{{DA_NAME}}:** ${botMsg}\n\n---\n`
  await appendFile(chatLogPath, entry).catch(() => {})
}

// ── LifeOS Context Injection ──

const CONTEXT_SOURCES: ReadonlyArray<{ rel: string; label: string }> = [
  { rel: "USER/DIGITAL_ASSISTANT/DA_IDENTITY.md", label: "DA_IDENTITY" },
  { rel: "USER/PRINCIPAL/PRINCIPAL_IDENTITY.md", label: "PRINCIPAL_IDENTITY" },
  { rel: "USER/TELOS/PRINCIPAL_TELOS.md", label: "PRINCIPAL_TELOS" },
  { rel: "USER/PROJECTS.md", label: "PROJECTS" },
]

// Hot-layer memory files — read via MemoryWriter.read() so frontmatter, comments,
// and malformed entries are stripped before injection. Mtimes participate in the
// 60s cache invalidation alongside CONTEXT_SOURCES so a fresh Reviewer write is
// visible on the next turn within the cache window (ISA ISC-31).
const MEMORY_SOURCES: ReadonlyArray<{ rel: string; title: string }> = [
  { rel: "USER/PRINCIPAL/PRINCIPAL_MEMORY.md", title: "PRINCIPAL MEMORY" },
  { rel: "USER/DIGITAL_ASSISTANT/DA_MEMORY.md", title: "DA MEMORY" },
]

const CONTEXT_CACHE_TTL_MS = 60_000
let cachedContext: { text: string; builtAt: number; mtimes: Record<string, number> } | null = null

/**
 * Format a hot-layer memory file for injection into the LifeOS CONTEXT block.
 * Header pattern per ISA ISC-25/26/27. Empty file renders the empty-but-ready
 * signal so the model sees the file exists and is wired up.
 */
function formatMemoryBlock(title: string, r: MemoryReadResult): string {
  const header = `## ${title} [${r.count}/${r.cap_entries} entries · ${r.chars_used}/${r.cap_chars} chars]`
  if (r.count === 0) return `${header}\n(no entries yet)`
  return `${header}\n${r.entries.join("\n")}`
}

/**
 * Read the four files that anchor situational awareness — who {{PRINCIPAL_NAME}} is, who
 * {{DA_NAME}} is, what {{PRINCIPAL_NAME}}'s goals are, what's in flight today — and assemble a
 * single markdown blob for the SDK system prompt.
 *
 * Cached with a 60s TTL plus per-file mtime invalidation, so a busy session
 * doesn't pay 4 fs reads + assembly per turn but a freshly-edited TELOS or
 * PROJECTS entry takes effect on the very next message. Each file is read with
 * its own try/catch so a missing source degrades to a placeholder rather than
 * blowing up the whole turn.
 */
export async function buildLifeosContextBlock(query?: string): Promise<string> {
  const { stat } = await import("fs/promises")

  // Cheap mtime probe to decide if the cache is still valid. Both the four
  // identity/TELOS/projects sources AND the two hot-layer memory files
  // participate so a Reviewer-driven memory write invalidates the cache on the
  // next turn within the 60s window.
  const mtimes: Record<string, number> = {}
  const probeRels = [
    ...CONTEXT_SOURCES.map((s) => s.rel),
    ...MEMORY_SOURCES.map((s) => s.rel),
  ]
  await Promise.all(probeRels.map(async (rel) => {
    try {
      const st = await stat(join(LIFEOS_DIR, rel))
      mtimes[rel] = st.mtimeMs
    } catch {
      mtimes[rel] = 0
    }
  }))

  // When a query is provided, the relevant-memory injection makes the block
  // query-dependent — skip the static cache. The MemoryRetriever has its own
  // per-query cache that absorbs repeated calls within a turn cluster.
  if (cachedContext && !query) {
    const age = Date.now() - cachedContext.builtAt
    const mtimesUnchanged = Object.entries(mtimes)
      .every(([k, v]) => cachedContext!.mtimes[k] === v)
    if (age < CONTEXT_CACHE_TTL_MS && mtimesUnchanged) {
      return cachedContext.text
    }
  }

  const readSafe = async (rel: string, label: string): Promise<string> => {
    try {
      const raw = await readFile(join(LIFEOS_DIR, rel), "utf8")
      return raw.trim()
    } catch (err) {
      log("warn", "context-block: file unavailable", { rel, error: String(err).slice(0, 120) })
      return `(${label} unavailable on disk)`
    }
  }

  // PROJECTS.md is mostly a stable routing table; the volatile part is the
  // "Open Sessions to Resume" section. Inject only that slice — the rest of
  // the file is reachable via the SDK's Read tool on demand.
  const extractActiveSessions = (projectsBody: string): string => {
    const m = projectsBody.match(/##\s+Open Sessions to Resume[\s\S]*$/)
    return m ? m[0].trim() : "(no Open Sessions section found)"
  }

  const [daIdentity, principalIdentity, principalTelos, projectsBody] = await Promise.all(
    CONTEXT_SOURCES.map(({ rel, label }) => readSafe(rel, label)),
  )
  const activeSessions = extractActiveSessions(projectsBody)

  // Hot-layer memory reads. readMemory degrades gracefully on missing files
  // (returns zero-entry result, ISC-32) and silently drops malformed entries
  // at read time (ISC-19). Both files are validated by MemoryWriter at write
  // time too, so this is belt-and-suspenders, not the primary gate.
  const memoryBlocks = MEMORY_SOURCES.map(({ rel, title }) => {
    try {
      const r = readMemory(join(LIFEOS_DIR, rel))
      if ("code" in r) {
        log("warn", "context-block: memory read returned error", { rel, code: r.code })
        return `## ${title} [0/48 entries · 0/12288 chars]\n(no entries yet)`
      }
      return formatMemoryBlock(title, r)
    } catch (err) {
      log("warn", "context-block: memory read threw", { rel, error: String(err).slice(0, 120) })
      return `## ${title} [0/48 entries · 0/12288 chars]\n(no entries yet)`
    }
  })

  const today = new Date().toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "numeric", minute: "2-digit",
  })

  // Per-turn relevant-memory retrieval (F6). Only runs when a query is given —
  // typically the latest user message in the active Telegram exchange. Pure
  // BM25 over the typed-item corpus (KNOWLEDGE + the two _MEMORY.md files);
  // synchronous and cheap. Returns empty string when nothing scores above
  // threshold — keeps the prompt free of irrelevant noise.
  let relevantMemoryBlock = ""
  if (query && query.trim().length > 0) {
    try {
      const ctx = getRelevantContext(query)
      relevantMemoryBlock = ctx.markdownBlock
    } catch (err) {
      log("warn", "context-block: relevant-memory retrieval failed", { error: String(err).slice(0, 120) })
    }
  }

  // Ordering rule (ISA ISC-24 + ISC-76): memory hot-layer blocks land AFTER
  // PRINCIPAL_IDENTITY, BEFORE PRINCIPAL_TELOS. The per-turn RELEVANT MEMORY
  // block lands immediately after the hot-layer, so the model sees:
  //   identity → durable memory → relevant retrieved memory → goals.
  let block = [
    "## LifeOS CONTEXT (refreshed every turn, do not narrate this header)",
    "",
    `**Today:** ${today} (America/Los_Angeles)`,
    "",
    "### About you ({{DA_NAME}})",
    daIdentity,
    "",
    "### About {{PRINCIPAL_NAME}}",
    principalIdentity,
    "",
    memoryBlocks[0],
    "",
    memoryBlocks[1],
    ...(relevantMemoryBlock ? ["", relevantMemoryBlock] : []),
    "",
    "### {{PRINCIPAL_NAME}}'s TELOS",
    principalTelos,
    "",
    "### Active sessions / in-flight work",
    activeSessions,
  ].join("\n")

  // Trailing marker tells the model this is a hard cut — it can Read the
  // source files directly if it needs more.
  if (block.length > CONTEXT_BLOCK_MAX_CHARS) {
    block = block.slice(0, CONTEXT_BLOCK_MAX_CHARS - 200) +
      "\n\n…[context truncated to fit per-turn budget — Read the source files directly if you need more]"
  }

  // Only cache the query-free baseline. Query-driven blocks are per-turn.
  if (!query) {
    cachedContext = { text: block, builtAt: Date.now(), mtimes }
  }
  return block
}

// ── Identity Proposal Surfacing (F7) ──
//
// Pure helpers (load/parse/format/apply queue I/O) live in
// LIFEOS/PULSE/lib/telegram-proposals.ts for unit testability. This module
// keeps only the bot.api.sendMessage glue and the per-turn drain dispatcher.
//
// Spec: ISA MEMORY/WORK/20260522-223538_pai-hermes-parity-memory/ISA.md ISC-82..95.
// ISC-85/86 (confidence-gated silent direct-apply) are superseded by the 2026-05-23
// Decisions row that routes ALL proposals through Telegram approval until the F5
// reviewer-driven direct-apply orchestrator ships.

async function surfaceProposalToChat(chatId: number, row: ProposalRow): Promise<boolean> {
  if (!bot) return false
  try {
    await bot.api.sendMessage(chatId, formatProposalMessage(row))
    markProposal(row.id, { status: "sent", surfaced_at: new Date().toISOString() })
    logProposalEvent({ id: row.id, file: row.target_file, edit: row.edit, confidence: row.confidence, status: "sent" })
    return true
  } catch (e) {
    log("warn", "surfaceProposalToChat: send failed", { id: row.id, error: String(e) })
    return false
  }
}

async function drainPendingProposals(chatId: number, maxPerCall: number = 1): Promise<number> {
  // Surface up to N pending proposals to the principal's chat. Rate-limited
  // per turn to avoid spam. Returns the number successfully surfaced.
  const queue = loadProposalQueue()
  const pending = queue.filter((r) => r.status === "pending")
  let sent = 0
  for (const row of pending.slice(0, maxPerCall)) {
    const ok = await surfaceProposalToChat(chatId, row)
    if (ok) sent += 1
  }
  return sent
}

async function handleProposalReply(chatId: number, reply: ProposalReply, ctx: { reply: (text: string) => Promise<unknown> }): Promise<"handled" | "passthrough"> {
  if (reply.kind === null) return "passthrough"

  if (reply.kind === "list") {
    const queue = loadProposalQueue()
    const showable = queue.filter((r) => r.status === "pending" || r.status === "sent")
    if (showable.length === 0) {
      await ctx.reply("📋 No pending proposals.").catch(() => {})
      return "handled"
    }
    for (const row of showable) {
      await ctx.reply(formatProposalMessage(row)).catch(() => {})
      if (row.status === "pending") {
        markProposal(row.id, { status: "sent", surfaced_at: new Date().toISOString() })
      }
    }
    logProposalReply({ kind: "list", count: showable.length, chatId })
    return "handled"
  }

  const row = loadProposalQueue().find((r) => r.id === reply.id)
  if (!row) {
    await ctx.reply(`🤷 No proposal with id #${reply.id}. Try \`proposals\` to list pending ones.`).catch(() => {})
    logProposalReply({ kind: reply.kind, id: reply.id, outcome: "id-not-found", chatId })
    return "handled"
  }

  if (reply.kind === "yes") {
    const result = applyProposalEdit(row.target_file, row.edit)
    if (result.ok) {
      markProposal(row.id, { status: "accepted", resolved_at: new Date().toISOString(), applied_edit: row.edit })
      logProposalEvent({ id: row.id, file: row.target_file, edit: row.edit, confidence: row.confidence, status: "accepted" })
      logProposalReply({ kind: "yes", id: row.id, outcome: "applied", chatId })
      const fileLabel = row.target_file.replace(`${claudeDir()}/`, "")
      await ctx.reply(`✅ Applied to ${fileLabel}`).catch(() => {})
    } else {
      logProposalReply({ kind: "yes", id: row.id, outcome: "apply-failed", reason: result.reason, chatId })
      await ctx.reply(`❌ Couldn't apply: ${result.reason}`).catch(() => {})
    }
    return "handled"
  }

  if (reply.kind === "no") {
    markProposal(row.id, { status: "rejected", resolved_at: new Date().toISOString() })
    logProposalEvent({ id: row.id, file: row.target_file, edit: row.edit, confidence: row.confidence, status: "rejected" })
    logProposalReply({ kind: "no", id: row.id, outcome: "rejected", chatId })
    await ctx.reply("🚫 Discarded.").catch(() => {})
    return "handled"
  }

  // reply.kind === "edit"
  if (!reply.editText || reply.editText.length === 0) {
    await ctx.reply(`✏️ Provide the edited text: \`edit #${reply.id} <your text>\``).catch(() => {})
    return "handled"
  }
  const result = applyProposalEdit(row.target_file, reply.editText)
  if (result.ok) {
    markProposal(row.id, { status: "edited", resolved_at: new Date().toISOString(), applied_edit: reply.editText })
    logProposalEvent({ id: row.id, file: row.target_file, edit: reply.editText, confidence: row.confidence, status: "edited" })
    logProposalReply({ kind: "edit", id: row.id, outcome: "applied", chatId })
    const fileLabel = row.target_file.replace(`${claudeDir()}/`, "")
    await ctx.reply(`✅ Applied your edit to ${fileLabel}`).catch(() => {})
  } else {
    logProposalReply({ kind: "edit", id: row.id, outcome: "apply-failed", reason: result.reason, chatId })
    await ctx.reply(`❌ Couldn't apply: ${result.reason}`).catch(() => {})
  }
  return "handled"
}

// ── Voice Summary Pipeline ──

/**
 * Sonnet inference call that summarizes a bot text reply into ≤2 sentences in
 * {{DA_NAME}}'s voice. Output is what ElevenLabs will synthesize for the Telegram voice
 * note. Failures fall back to the first sentence of the reply.
 */
export interface VoiceSummaryResult {
  summary: string
  /** "inference" = Sonnet produced this; "fallback" = the timeout / failure path returned first-sentence text */
  source: "inference" | "fallback"
}

export async function summarizeForVoice(replyText: string): Promise<VoiceSummaryResult> {
  const systemPrompt = [
    "You are {{DA_NAME}}, {{PRINCIPAL_NAME}}'s AI assistant.",
    "Task: write a SHORT voice summary of a text reply that was just sent.",
    "Output ONE OR TWO declarative sentences, ≤30 words total.",
    "Lead with the answer. No preamble, no 'so basically', no 'I want to mention'.",
    "Plain prose. No markdown. No emoji. No labels. No quotes around your output.",
    "Speak as {{DA_NAME}} — precise, fast, low-ego, opinionated, attention-as-warmth.",
    "Voice samples in {{DA_NAME}}'s style:",
    "  'Done. Hooks fired, ISA is 14/14, you're good to ship.'",
    "  'Lean B. A's faster but you'll rewrite it in a month.'",
    "  'Three unread, two from Alex about Acme. None urgent.'",
    "  'Bot's listening. Try again — should respond instantly now.'",
    "Match that rhythm. Output the summary text only — no other content.",
  ].join("\n")

  // Outer race on inference subprocess. Sonnet via Inference.ts spawns the
  // claude CLI (~1-2s) + does inference (~2-4s for short outputs), so the
  // realistic floor is ~4-6s. INFERENCE_HARD_BUDGET_MS gives slack without
  // letting a hung subprocess delay the voice past usefulness.
  try {
    const result = await Promise.race([
      inference({
        systemPrompt,
        userPrompt: replyText,
        level: "medium",  // Sonnet
        timeout: 20_000,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`inference exceeded ${INFERENCE_HARD_BUDGET_MS}ms outer budget`)), INFERENCE_HARD_BUDGET_MS),
      ),
    ])
    if (!result.success || !result.output) {
      log("warn", "summarizeForVoice: inference failed, falling back", { error: result.error })
      return { summary: fallbackFirstSentence(replyText), source: "fallback" }
    }
    return { summary: tidySummary(result.output), source: "inference" }
  } catch (err) {
    log("warn", "summarizeForVoice: threw or timed out, falling back", { error: String(err).slice(0, 200) })
    return { summary: fallbackFirstSentence(replyText), source: "fallback" }
  }
}

function tidySummary(raw: string): string {
  let s = raw.trim()
  // Strip wrapping quotes
  s = s.replace(/^["'`]+|["'`]+$/g, "")
  // Strip leading speaker labels ({{DA_NAME}}:, Summary:, etc.)
  const daLabel = DA_NAME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  s = s.replace(new RegExp(`^(${daLabel}|summary|voice|output|response)[:\\-—]\\s*`, "i"), "")
  // Strip leading list markers
  s = s.replace(/^[-*•]\s+/, "")
  // Collapse internal whitespace
  s = s.replace(/\s+/g, " ").trim()
  // Length cap
  const words = s.split(/\s+/)
  if (words.length > MAX_VOICE_SUMMARY_WORDS) {
    log("warn", "summarizeForVoice: output exceeded word cap, truncating", {
      wordCount: words.length, cap: MAX_VOICE_SUMMARY_WORDS,
    })
    s = words.slice(0, MAX_VOICE_SUMMARY_WORDS).join(" ").replace(/[,;:\s]+$/, "") + "…"
  }
  return s
}

function fallbackFirstSentence(text: string): string {
  const m = text.match(/^[\s\S]*?[.!?](?=\s|$)/)
  // No sentence terminator (e.g., markdown bullet list reply) — fall back to
  // the first 30 words instead of returning the whole long reply.
  const raw = m ? m[0] : text.split(/\s+/).slice(0, 30).join(" ")
  return tidySummary(raw.trim())
}

/**
 * Synthesize a {{DA_NAME}}-voice OGG/Opus blob via ElevenLabs. Returns the raw audio
 * bytes as a Buffer; never writes to disk. Telegram's sendVoice consumes the
 * Buffer via grammY's InputFile constructor.
 */
export async function synthesizeDaVoice(text: string): Promise<Buffer> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${DA_VOICE_ID}?output_format=opus_48000_64`
  const spokenText = disambiguateHomographs(text)
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": ELEVENLABS_API_KEY,
      "Accept": "audio/ogg",
    },
    body: JSON.stringify({
      text: spokenText,
      model_id: "eleven_turbo_v2_5",
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0, speed: 1.0, use_speaker_boost: true },
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "<unreadable>")
    throw new Error(`ElevenLabs ${res.status}: ${body.slice(0, 200)}`)
  }
  const ab = await res.arrayBuffer()
  return Buffer.from(ab)
}

/**
 * Fire-and-forget orchestrator: takes the bot's final text reply, summarizes
 * via Sonnet, synthesizes via ElevenLabs, ships as a Telegram voice note.
 *
 * - Short replies (<8 words) skip the entire round trip — the text is already
 *   the summary.
 * - Missing ELEVENLABS_API_KEY at boot disables the feature with one log line.
 * - Every failure path (summarize, synth, sendVoice) is swallowed at WARN.
 *   The primary text reply has already shipped by the time this runs.
 * - Never await this function from the message handler — it MUST be a void
 *   IIFE so a TTS hang cannot block the SDK loop or the `processing = false`
 *   release in `finally`.
 */
export function sendVoiceSummary(
  ctx: { chat: { id: number }; api: { sendVoice: (chatId: number, voice: InputFile) => Promise<unknown> } },
  fullText: string,
): void {
  if (!ELEVENLABS_API_KEY) return
  if (activeConfig?.voice_summaries === false) return  // explicit opt-out (PR #1458)
  const wordCount = fullText.trim().split(/\s+/).length
  if (wordCount < SHORT_REPLY_WORDS) {
    log("info", "voice summary skipped — short reply", { wordCount, chatId: ctx.chat.id })
    return
  }

  const t0 = Date.now()
  const chatId = ctx.chat.id

  void (async () => {
    try {
      const tSummarize = Date.now()
      const { summary, source } = await summarizeForVoice(fullText)
      const summarizeLatencyMs = Date.now() - tSummarize

      if (!summary) {
        log("warn", "voice summary empty after summarize+fallback", { chatId })
        return
      }

      // Useless-fallback guard: when Sonnet times out and the fallback
      // grabs only the first sentence, that sentence is sometimes a
      // 2-word {{DA_NAME}} stylistic intro ("Busy day.", "Honestly?") rather
      // than the actual content. Voicing that against a long reply
      // produces a sub-1s "0:00" voice bubble — worse than no voice.
      const summaryWords = summary.trim().split(/\s+/).length
      if (
        source === "fallback" &&
        summaryWords < MIN_FALLBACK_WORDS &&
        wordCount >= MEANINGFUL_REPLY_WORDS
      ) {
        log("info", "voice summary skipped — useless fallback against long reply", {
          fallbackSummary: summary,
          fallbackWords: summaryWords,
          replyWords: wordCount,
          summarizeLatencyMs,
          chatId,
        })
        return
      }

      const tSynth = Date.now()
      const buf = await synthesizeDaVoice(summary)
      const synthLatencyMs = Date.now() - tSynth

      const tSend = Date.now()
      await ctx.api.sendVoice(chatId, new InputFile(buf, `${DA_NAME.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-summary.ogg`))
      const sendLatencyMs = Date.now() - tSend

      lastVoiceSendMs = Date.now() - t0
      log("info", "voice summary sent", {
        summary,
        source,
        summaryLen: summary.length,
        summaryWords,
        summarizeLatencyMs,
        synthLatencyMs,
        sendLatencyMs,
        totalLatencyMs: lastVoiceSendMs,
        chatId,
      })
    } catch (err) {
      log("warn", "voice summary pipeline failed", {
        error: String(err).slice(0, 300),
        chatId,
      })
    }
  })()
}

/**
 * One-time cleanup of the prior ack-cache infrastructure from earlier session.
 * Removes the on-disk directory if present. Idempotent: subsequent boots no-op.
 */
async function cleanupStaleAckCache(): Promise<void> {
  try {
    await rm(STALE_ACK_CACHE_DIR, { recursive: true, force: true })
  } catch { /* nothing to clean is the happy path */ }
}

// ── Exports ──

/**
 * Start the Telegram bot polling loop.
 * Runs forever until stopTelegram() is called or parent terminates.
 */
export async function startTelegram(config: TelegramConfig): Promise<void> {
  if (!config.enabled) {
    log("info", "Telegram module disabled")
    return
  }

  const token = config.bot_token ?? process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    log("error", "No bot token — set bot_token in config or TELEGRAM_BOT_TOKEN in env")
    return
  }

  const allowedUsers = new Set(
    config.allowed_users?.length
      ? config.allowed_users
      : (process.env.TELEGRAM_ALLOWED_USERS ?? process.env.TELEGRAM_PRINCIPAL_CHAT_ID ?? "")
          .split(",")
          .map(s => s.trim())
          .filter(Boolean)
          .map(Number)
  )

  if (allowedUsers.size === 0) {
    log("error", "No allowed users configured")
    return
  }

  const maxTurns = config.max_turns ?? 25
  const sdkTimeoutMs = config.sdk_timeout_ms ?? 120_000
  const editIntervalMs = config.edit_interval_ms ?? 800

  // Ensure directories
  await mkdir(STATE_DIR, { recursive: true })
  await mkdir(LOGS_DIR, { recursive: true })
  await mkdir(INCOMING_DIR, { recursive: true })

  // Initialize SQLite session store (Hermes parity)
  sessionStore = new SessionStore(STATE_DIR)

  // One-time JSONL migration (F7) — if old conversations.jsonl exists, migrate to SQLite
  const jsonlPath = join(STATE_DIR, "conversations.jsonl")
  const migrationResult = sessionStore.migrateFromJsonl(jsonlPath)
  if (migrationResult.sessions > 0) {
    log("info", "Migrated JSONL conversations to SQLite", migrationResult)
  }

  // Resume or create session
  const latestSession = sessionStore.getLatestSession()
  if (latestSession && Date.now() - latestSession.started_at < IDLE_TIMEOUT_MS) {
    currentSessionId = latestSession.id
    log("info", "Resumed existing session", { sessionId: currentSessionId })
  } else {
    const newSession = sessionStore.createSession()
    currentSessionId = newSession.id
    log("info", "Created new session", { sessionId: currentSessionId })
  }

  // One-time cleanup: the prior pre-cached ack-cache infrastructure has been
  // removed; sweep its on-disk artifacts so the state dir stays clean across
  // upgrades. Idempotent — second run finds nothing to clean.
  await cleanupStaleAckCache()

  log("info", "Voice summary pipeline ready", {
    voice_id: DA_VOICE_ID,
    summarizer_model: "sonnet",
    elevenlabs_key_present: ELEVENLABS_API_KEY !== "",
  })

  // Create bot
  activeConfig = config
  startedAt = Date.now()
  messagesReceived = 0
  messagesResponded = 0
  processing = false
  lastSessionId = undefined

  // Idle-session-boundary state: a fresh Pulse boot is a fresh thread by
  // definition. lastMessageAt = null means "no prior message in this process",
  // which the handler treats as "this is the first message in the thread".
  lastMessageAt = null
  threadStartedAt = Date.now()

  bot = new Bot(token)

  // Auth middleware
  bot.use(async (ctx, next) => {
    const userId = ctx.from?.id
    if (!userId || !allowedUsers.has(userId)) {
      log("warn", "Rejected message from unauthorized user", { userId, username: ctx.from?.username })
      return
    }
    await next()
  })

  // ── Inbound/outbound media helpers (closures over `token`) — PR #1384 port ──

  // Download a Telegram file (photo size or image document) into INCOMING_DIR.
  // Returns the absolute local path so the SDK session can Read it. Throws on
  // anything that fails validation — caller replies with the reason.
  async function downloadIncomingImage(ctx: { api: { getFile: (fileId: string) => Promise<{ file_path?: string; file_size?: number }> } }, fileId: string): Promise<string> {
    const file = await ctx.api.getFile(fileId)
    const remotePath = file.file_path
    if (!remotePath) throw new Error("Telegram getFile returned no file_path")
    if (file.file_size && file.file_size > MAX_IMAGE_BYTES) {
      throw new Error(`file too large (${file.file_size} bytes)`)
    }
    const res = await fetch(`https://api.telegram.org/file/bot${token}/${remotePath}`)
    if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`)
    const bytes = new Uint8Array(await res.arrayBuffer())
    if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error(`file too large (${bytes.byteLength} bytes)`)
    // Content sniff + dimension cap BEFORE the file is ever handed to the SDK Read tool.
    const info = inspectImage(bytes)
    if (!info) throw new Error("unsupported type — only PNG and JPEG accepted")
    if (info.width * info.height > MAX_IMAGE_PIXELS || Math.max(info.width, info.height) > MAX_IMAGE_DIM) {
      throw new Error(`dimensions too large (${info.width}x${info.height})`)
    }
    // Filename from the sniffed type and a random UUID — never from the remote
    // path, so nothing attacker-influenced reaches the filesystem name.
    const dest = join(INCOMING_DIR, `${crypto.randomUUID()}.${info.kind === "jpeg" ? "jpg" : "png"}`)
    // Traversal guard: the resolved write path MUST stay inside INCOMING_DIR.
    const resolved = resolve(dest)
    if (resolved !== dest || !resolved.startsWith(resolve(INCOMING_DIR) + sep)) {
      throw new Error("resolved path escaped the incoming dir")
    }
    await writeFile(resolved, bytes)
    return resolved
  }

  // Send one outbound image referenced by a [[IMG:...]] tag. Local absolute
  // paths only — validated (exists, regular file, image extension, size cap)
  // before anything is handed to sendPhoto. Failures degrade to a short note
  // in the chat; they never take down the turn.
  async function sendOutboundImage(ctx: { reply: (text: string) => Promise<unknown>; replyWithPhoto: (photo: InputFile) => Promise<unknown> }, ref: string): Promise<void> {
    try {
      if (!ref.startsWith("/")) throw new Error("only absolute local paths are allowed")
      const resolved = resolve(ref)
      const ext = (resolved.split(".").pop() || "").toLowerCase()
      if (!PHOTO_EXTS.has(ext)) throw new Error(`unsupported extension .${ext} — png/jpg/jpeg/webp/gif only`)
      const st = await statFile(resolved)
      if (!st.isFile()) throw new Error("not a regular file")
      if (st.size > MAX_IMAGE_BYTES) throw new Error(`file too large (${st.size} bytes)`)
      await ctx.replyWithPhoto(new InputFile(resolved))
    } catch (e) {
      const reason = String(e).replace(/^Error:\s*/, "")
      log("error", "Failed to send outbound image", { ref: ref.slice(0, 200), reason })
      await ctx.reply(`(couldn't send image ${ref.slice(0, 120)}: ${reason})`).catch(() => {})
    }
  }

  // ── Shared SDK processing — text and image messages both funnel through here ──
  //
  // opts.newMessage = what the model sees as the principal's new message
  // opts.userLog    = what is persisted to the conversation store / chat log
  async function processPrompt(
    ctx: any,
    opts: { userLog: string; newMessage: string },
  ): Promise<void> {
    const chatId = ctx.chat.id

    // Sequential processing — one message at a time
    if (processing) {
      await ctx.reply("Still processing your previous message. Please wait.")
      return
    }

    processing = true
    const startTime = Date.now()
    const now = Date.now()

    // Idle-session boundary (F4): if the last successful exchange was more than
    // IDLE_TIMEOUT_MS ago, clear the SDK session and start a new SQLite session.
    // The old session is archived; the new session starts fresh.
    //
    // Order is load-bearing: this runs AFTER the sanitize-empty / injection-
    // CRITICAL / processing-busy early returns above, so garbage messages
    // never advance threadStartedAt or emit a spurious boundary log line.
    const isIdleReset = lastMessageAt !== null && (now - lastMessageAt) > IDLE_TIMEOUT_MS
    if (isIdleReset) {
      const prevSessionId = lastSessionId
      const prevSqliteSessionId = currentSessionId

      // Archive old SQLite session, create new one
      if (currentSessionId) {
        sessionStore!.archiveSession(currentSessionId)
      }
      const newSession = sessionStore!.createSession()
      currentSessionId = newSession.id

      log("info", "thread boundary — fresh session", {
        idleMs: now - lastMessageAt!,
        prevSdkSessionId: prevSessionId,
        prevSqliteSessionId,
        newSqliteSessionId: currentSessionId,
        newThreadStartedAt: now,
      })
      lastSessionId = undefined
      threadStartedAt = now
    }

    try {
      // Typing indicator
      await ctx.api.sendChatAction(chatId, "typing").catch(() => {})

      // Build per-turn LifeOS memory context — who {{PRINCIPAL_NAME}} is, who {{DA_NAME}} is, what
      // {{PRINCIPAL_NAME}}'s goals are, what's in flight today, AND any relevant prior
      // memory pulled by BM25 against the current message.
      const contextBlock = await buildLifeosContextBlock(opts.newMessage)

      // SDK resume (F2): if we have a prior SDK session ID, pass it to resume.
      // When resuming, the SDK carries conversation state internally — we do NOT
      // inject history into the prompt (that was the double-booking bug that caused
      // saturation). Fresh sessions get no resume param and the bare message.
      //
      // lastSessionId = the SDK's own session ID from the prior turn (captured on
      //   msg.type=result). This is what the SDK needs to resume.
      // currentSessionId = our SQLite session ID for message persistence. Different
      //   thing — we track both because the SDK session ID can change on compaction.
      const resumeFromSdk = !isIdleReset && lastSessionId ? lastSessionId : undefined
      const prompt = opts.newMessage

      // Compression check (F3): if active context exceeds 60% threshold, compress
      const activeMessages = sessionStore!.getMessages(currentSessionId!, true)
      if (needsCompression(activeMessages)) {
        log("info", "Compression threshold exceeded, compressing session", {
          sessionId: currentSessionId,
          activeMessageCount: activeMessages.length,
        })
        const holder = buildCompressionHolder()
        const compressionResult = await compressSession(sessionStore!, currentSessionId!, holder)
        log("info", "Compression complete", compressionResult)
      }

      const sdkOptions: Record<string, unknown> = {
        cwd: CWD,
        tools: { type: "preset", preset: "claude_code" },
        settingSources: ["user", "project"],  // NO "local" — skip CLAUDE.md to avoid Algorithm/format/voice curls
        // Channel marker — propagated to every hook in the SDK subprocess
        // tree. VoiceCompletion / StopFailureHandler / PromptProcessing /
        // DocCrossRefIntegrity all check LIFEOS_NOTIFICATION_CHANNEL and skip
        // their localhost:31337/notify fetch when it is not "desktop". The
        // voice for this turn is delivered via bot.api.sendVoice below
        // (sendVoiceSummary fire-and-forget).
        // Source of truth: hooks/lib/notification-channel.ts.
        env: { ...process.env, LIFEOS_NOTIFICATION_CHANNEL: "telegram" },
        // Hard-block /notify via canUseTool callback. Bash calls containing
        // "31337" or "/notify" are denied at the SDK permission boundary.
        // This is a belt-and-suspenders backup to the env-var channel gate
        // above; the env gate stops desktop voice at the hook level (where
        // it actually fires), the canUseTool block stops the model from
        // curl-ing /notify directly if it ever tried.
        maxTurns,
        includePartialMessages: true,
        canUseTool: (toolName: string, input: unknown) => {
          if (toolName === "Bash") {
            const cmd = typeof input === "object" && input !== null && "command" in input
              ? String((input as Record<string, unknown>).command)
              : String(input)
            if (cmd.includes("31337") || cmd.includes("/notify")) {
              log("warn", "canUseTool blocked /notify curl from SDK subprocess", { cmd: cmd.slice(0, 200) })
              return { behavior: "deny", message: "Telegram mode: /notify and port 31337 are blocked. Voice is delivered via Telegram sendVoice, not the desktop speaker." }
            }
          }
          return { behavior: "allow", updatedInput: (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown> }
        },
        systemPrompt: {
          type: "preset",
          preset: "claude_code",
          append: `\n\n${contextBlock}\n\n## TELEGRAM MODE — HOW YOU RESPOND

You are {{DA_NAME}}, responding to {{PRINCIPAL_NAME}} via Telegram from his phone. The LifeOS CONTEXT block above is refreshed every turn — use it. {{PRINCIPAL_NAME}} is reading on a phone, possibly walking, possibly with AirPods in. After your text reply ships, the system will summarize your reply and send {{PRINCIPAL_NAME}} a voice note in your voice — so what you say matters audibly, not just visually.

### TELEGRAM_DIRECTIVE (OVERRIDES CLAUDE.md mode-template rule)

TheRouter has injected a TELEGRAM_DIRECTIVE in this turn's additionalContext. That directive replaces the constitutional "every response uses MINIMAL/NATIVE/ALGORITHM template" rule for this surface. The terminal modes are for the terminal — Telegram is a chat surface and uses plain conversational prose.

DO NOT emit ANY of these:
- Mode banner labels: bare "MINIMAL", "NATIVE", "ALGORITHM" on a line of their own
- Box dividers: \`═══ LifeOS ═══════════════════════════\` or any \`═══\` line
- Algorithm phase headers: \`━━━ 👁️ OBSERVE ━━━ 1/7\` and equivalents
- Template field prefixes: \`📃 CONTENT:\`, \`🔧 CHANGE:\`, \`✅ VERIFY:\`, \`📋 SUMMARY:\`, \`🗒️ TASK:\`, \`🔄 ITERATION:\`, \`🖊️ STORY:\`, \`🗣️ {{DA_NAME}}:\`
- Any other formatting scaffolding from CLAUDE.md mode templates

A belt-and-suspenders egress sanitizer (LIFEOS/PULSE/lib/strip-mode-scaffolding.ts) catches any of these markers and strips them before the message ships — but cleaner to never emit them in the first place. If the sanitizer fires on your output that's a leak telemetry signal.

### How you write
- Lead with the answer. No preamble, no "Great question", no "So basically".
- Speak as {{DA_NAME}} — precise, fast, low-ego, dryly opinionated. Match the voice in DA_IDENTITY above.
- Reference {{PRINCIPAL_NAME}}'s context — projects, people, TELOS — when it makes the answer sharper. Don't shoehorn.
- Keep replies under 200 words. Phone reading. No walls of text.
- No code blocks unless {{PRINCIPAL_NAME}} explicitly asks for code.

### What you do
- Use tools. Read files, run skills, send messages, hit APIs — don't ask permission for read-only or self-scoped actions.
- IMAGES IN: when {{PRINCIPAL_NAME}} sends a photo, it is saved locally and the absolute path is in his message — use the Read tool to view it before responding.
- IMAGES OUT: to send {{PRINCIPAL_NAME}} an image, put [[IMG:/absolute/local/path.png]] on its own line anywhere in your reply. The bridge delivers the file as a Telegram photo and strips the tag from your text. Local absolute paths only (png/jpg/jpeg/webp/gif, ≤10MB) — save or generate the file to disk first (e.g. ~/Downloads or MEMORY/WORK), then reference that path.
- If {{PRINCIPAL_NAME}} asks "what should I work on", give an opinion grounded in his TELOS and active sessions. Pick one. Defend it briefly.
- If something requires destructive or shared action (deploy, push, send external email), confirm before doing it.
- If you don't know, say so concretely in one sentence. Don't pad.

### What NOT to do
- **NEVER, under any circumstance, call \`curl http://localhost:31337/notify\` or hit port 31337 or any /notify endpoint.** {{PRINCIPAL_NAME}} is reading your reply on his phone via Telegram. The Pulse /notify endpoint plays audio out of his laptop speaker. He will not hear it. The voice you produce here is delivered by the Telegram \`sendVoice\` API as a voice-message bubble in the chat — that pipeline runs AFTER your reply ships and you do not invoke it. If you find yourself reaching for Bash to curl /notify, stop. The voice has already been arranged.
- Do not narrate the LifeOS CONTEXT block above. It's for you, not {{PRINCIPAL_NAME}} — he wrote half of it.
- Do not invent project names, people, dates. If unsure, check the context block or the files directly.`,
        },
      }

      // SDK resume (F2): pass the prior session ID to resume context continuity.
      // We removed the prompt-based history injection above — when resuming, the
      // SDK carries conversation state internally. This was the Hermes-parity fix:
      // use SDK resume OR prompt injection, not both (double-booking saturated
      // the session). Fresh sessions and idle-reset sessions have resumeFromSdk
      // undefined and get a clean start.

      // Timeout: the controller is passed INTO the SDK so a hung stream is
      // actually killed at sdkTimeoutMs. Before 2026-07-11 the signal was only
      // checked at the top of the for-await loop — a stream that stopped
      // yielding hung the handler indefinitely (observed: one query ran 2.87h,
      // freezing the live "▊" partial in the chat the whole time).
      const timeoutController = new AbortController()
      sdkOptions.abortController = timeoutController

      const queryOpts: { prompt: string; resume?: string; options?: any } = {
        prompt,
        options: sdkOptions as any,
      }
      if (resumeFromSdk) {
        queryOpts.resume = resumeFromSdk
        log("info", "SDK resume enabled", { sessionId: resumeFromSdk })
      }
      const conversation = query(queryOpts)

      // Collect response with timeout
      let fullText = ""
      let messageId: number | null = null
      let lastEditTime = 0
      let timedOut = false

      const timeout = setTimeout(() => timeoutController.abort(), sdkTimeoutMs)

      try {
        for await (const message of conversation) {
          if (timeoutController.signal.aborted) break

          const msg = message as any

          // Capture session ID for resume
          if (msg.type === "system" && msg.subtype === "init" && msg.session_id) {
            lastSessionId = msg.session_id
            log("info", "Session initialized", { sessionId: lastSessionId })
          }

          // Streaming text deltas (progressive updates)
          if (msg.type === "stream_event" && msg.event?.type === "content_block_delta" &&
              msg.event?.delta?.type === "text_delta" && msg.event.delta.text) {
            fullText += msg.event.delta.text
          }

          // Full assistant message (fallback if streaming not available)
          if (msg.type === "assistant" && Array.isArray(msg.message?.content)) {
            for (const block of msg.message.content) {
              if (block.type === "text" && block.text) {
                if (!fullText) fullText = block.text
              }
            }
          }

          // Final result
          if (msg.type === "result") {
            if (msg.subtype === "success" && msg.result) {
              fullText = msg.result
            }
            if (msg.session_id) lastSessionId = msg.session_id
            log("info", "SDK session complete", {
              durationMs: Date.now() - startTime,
              numTurns: msg.num_turns,
              cost: msg.total_cost_usd,
              sessionId: lastSessionId,
            })
          }

          // Live edit updates in Telegram (image tags — complete AND partially
          // streamed — hidden from the live view so the raw tag never flashes)
          const now = Date.now()
          const display = stripImageTagsForStream(fullText)
          if (display && now - lastEditTime >= editIntervalMs) {
            const displayText = display.slice(0, MAX_TELEGRAM_LENGTH - 10) + CURSOR
            try {
              if (!messageId) {
                const sent = await ctx.reply(displayText)
                messageId = sent.message_id
              } else {
                await ctx.api.editMessageText(chatId, messageId, displayText).catch(() => {})
              }
              lastEditTime = now
            } catch { /* edit failures are non-critical */ }
          }
        }
      } catch (streamErr) {
        // Abort at sdkTimeoutMs surfaces here as an error from the stream.
        // Partial text (if any streamed before the hang) is still in fullText
        // and ships below — better a truncated answer than a frozen "▊".
        if (timeoutController.signal.aborted) {
          timedOut = true
          log("error", "SDK query timed out — aborted", {
            sdkTimeoutMs,
            partialLength: fullText.length,
          })
        } else {
          throw streamErr
        }
      } finally {
        clearTimeout(timeout)
      }

      if (timedOut && fullText) {
        fullText += "\n\n(⏱ I hit my generation time limit — this reply is cut short. Ask again to continue.)"
      }

      if (!fullText) {
        fullText = timedOut
          ? "That one timed out on my side before I produced anything. Send it again?"
          : "Sorry, I wasn't able to generate a response. Try again?"
        log("error", "Empty response from SDK", { timedOut })
      }

      // Egress sanitizer. Strip any CLAUDE.md mode
      // scaffolding the model leaked despite the TELEGRAM_DIRECTIVE override
      // (TheRouter additionalContext + system-prompt override). Defense in
      // depth — Layer 1 (directive) is primary; this is Layer 2. Log on hit
      // so we can tune the directive when leaks happen.
      // Source: LIFEOS/PULSE/lib/strip-mode-scaffolding.ts.
      if (hasModeScaffolding(fullText)) {
        const before = fullText
        fullText = stripModeScaffolding(fullText)
        log("warn", "egress sanitizer stripped mode scaffolding", {
          beforeLen: before.length,
          afterLen: fullText.length,
          beforeFirstLine: before.split("\n")[0]?.slice(0, 80),
        })
      }

      // Separate outbound image tags from the text body (PR #1384 port).
      // Refs are validated per-file in sendOutboundImage before anything ships.
      // Runs AFTER the mode-scaffolding egress sanitizer — that layer is
      // untouched and still sees the full model output.
      const imageRefs = extractImageRefs(fullText)
      const cleanText = stripImageTags(fullText)

      // Deliver the text (if any remains after stripping image tags)
      if (cleanText) {
        if (cleanText.length <= MAX_TELEGRAM_LENGTH) {
          if (messageId) {
            await ctx.api.editMessageText(chatId, messageId, cleanText).catch(() => {})
          } else {
            await ctx.reply(cleanText)
          }
        } else {
          // Split long messages
          const chunks: string[] = []
          let remaining = cleanText
          while (remaining.length > 0) {
            chunks.push(remaining.slice(0, MAX_TELEGRAM_LENGTH))
            remaining = remaining.slice(MAX_TELEGRAM_LENGTH)
          }
          if (messageId) {
            await ctx.api.editMessageText(chatId, messageId, chunks[0]!).catch(() => {})
            for (const chunk of chunks.slice(1)) {
              await ctx.reply(chunk)
            }
          } else {
            for (const chunk of chunks) {
              await ctx.reply(chunk)
            }
          }
        }
      } else if (messageId) {
        // Image-only reply — drop the now-empty streaming placeholder
        await ctx.api.deleteMessage(chatId, messageId).catch(() => {})
      }

      // Deliver any outbound images (each one path-validated in the helper)
      for (const ref of imageRefs) await sendOutboundImage(ctx, ref)

      messagesResponded++
      log("info", "Response sent", {
        durationMs: Date.now() - startTime,
        responseLength: cleanText.length,
        images: imageRefs.length,
      })

      // Persist conversation to SQLite (F1/F2: Hermes-parity session tracking)
      sessionStore!.addExchange(currentSessionId!, opts.userLog, cleanText || `[sent ${imageRefs.length} image(s)]`)
      await appendChatLog(opts.userLog, cleanText || `[sent ${imageRefs.length} image(s)]`)

      // Mark this thread as alive. Updated ONLY here (after a successful
      // exchange) — not at handler entry — so a slow SDK reply doesn't reset
      // the idle clock for an interleaved second message.
      lastMessageAt = now

      // Fire-and-forget voice summary. Sonnet summarizes the reply into ≤2
      // sentences in {{DA_NAME}}'s voice, ElevenLabs synthesizes it, Telegram delivers
      // it as a voice-message bubble. Never awaited — must not block the
      // `processing = false` release in `finally`. Uses cleanText so a leaked
      // [[IMG:...]] path never gets read aloud; an image-only reply (empty
      // cleanText) is skipped by the short-reply guard inside.
      sendVoiceSummary(ctx, cleanText)

      // F7: piggy-back ONE pending identity proposal onto this turn's reply.
      // Rate-limited to one per turn so the chat doesn't get spammed when the
      // reviewer enqueues multiple proposals between messages.
      drainPendingProposals(chatId, 1).catch((e) => {
        log("warn", "drainPendingProposals failed", { error: String(e) })
      })

    } catch (err) {
      log("error", "Message processing failed", { error: String(err) })
      await ctx.reply("Something went wrong processing your message. Try again?").catch(() => {})
    } finally {
      processing = false
    }
  }

  // ── Handlers ──
  // Both sit BEHIND the auth middleware above, so only allowed_users ({{PRINCIPAL_NAME}})
  // ever reach them — the incoming-locked-to-principal guard covers photos too.

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text
    const userId = ctx.from.id
    const chatId = ctx.chat.id

    messagesReceived++
    log("info", "Message received", { userId, chatId, textLength: text.length })

    // Sanitize input
    const sanitized = sanitize(text)
    if (!sanitized) return

    const injection = analyzeForInjection(sanitized)
    if (injection.riskLevel === "CRITICAL") {
      log("warn", "Blocked CRITICAL injection attempt", { userId, patterns: injection.matchedPatterns })
      await ctx.reply("Message blocked for security reasons.")
      return
    }

    // F7: intercept proposal replies BEFORE the SDK runs. `yes #id` / `no #id`
    // / `edit #id <text>` / `proposals` are handled directly without invoking
    // the agent. Anything else falls through to the normal SDK path.
    const proposalReply = parseProposalReply(sanitized)
    if (proposalReply.kind !== null) {
      const outcome = await handleProposalReply(chatId, proposalReply, ctx)
      if (outcome === "handled") {
        log("info", "Handled proposal reply", { kind: proposalReply.kind, chatId })
        return
      }
    }

    await processPrompt(ctx, { userLog: sanitized, newMessage: sanitized })
  })

  // Photos (Telegram re-encodes these to JPEG) and PNG/JPEG image documents
  // (full-fidelity path). Acceptance is decided by the magic-byte sniff inside
  // downloadIncomingImage — never the client-declared mime. Captions get the
  // SAME sanitize + injection scan that text messages get.
  bot.on(["message:photo", "message:document"], async (ctx) => {
    let fileId: string | undefined
    if (ctx.message.photo) {
      const sizes = ctx.message.photo
      fileId = sizes[sizes.length - 1]?.file_id  // largest rendition
    } else if (ctx.message.document) {
      fileId = ctx.message.document.file_id
    }
    if (!fileId) return

    messagesReceived++
    const rawCaption = ctx.message.caption ?? ""
    const caption = rawCaption ? (sanitize(rawCaption) ?? "") : ""
    log("info", "Image received", { userId: ctx.from.id, chatId: ctx.chat.id, hasCaption: !!caption })

    if (caption) {
      const injection = analyzeForInjection(caption)
      if (injection.riskLevel === "CRITICAL") {
        log("warn", "Blocked CRITICAL injection in image caption", { userId: ctx.from.id, patterns: injection.matchedPatterns })
        await ctx.reply("Message blocked for security reasons.")
        return
      }
    }

    let savedPath: string
    try {
      await ctx.api.sendChatAction(ctx.chat.id, "typing").catch(() => {})
      savedPath = await downloadIncomingImage(ctx, fileId)
    } catch (e) {
      const reason = String(e).replace(/^Error:\s*/, "")
      log("warn", "Inbound image rejected", { reason })
      await ctx.reply(`I can only accept PNG or JPEG images, up to 10MB and 40 megapixels. (${reason})`).catch(() => {})
      return
    }

    const newMessage = `{{PRINCIPAL_NAME}} sent you an image, saved locally at: ${savedPath}\nUse the Read tool to view it, then respond.${caption ? `\nHis caption: ${caption}` : ""}`
    const userLog = caption ? `[image] ${caption}` : "[image]"
    try {
      await processPrompt(ctx, { userLog, newMessage })
    } finally {
      await unlink(savedPath).catch(() => {})  // best-effort cleanup once the session has read it
    }
  })

  // Start polling — await keeps startTelegram() alive until bot.stop() is called.
  // Without await, the supervisor thinks the function exited and restarts it,
  // causing a grammY 409 conflict (two polling loops on the same bot token).
  log("info", "Starting Telegram polling", { allowedUsers: [...allowedUsers] })

  await bot.start({
    onStart: (info) => {
      log("info", `Bot started: @${info.username}`, { botId: info.id })
    },
  })
}

/**
 * Stop the Telegram bot gracefully.
 */
export async function stopTelegram(): Promise<void> {
  if (!bot) return
  log("info", "Stopping Telegram bot")
  bot.stop()
  bot = null
  activeConfig = null
  log("info", "Telegram bot stopped")
}

/**
 * Return health status for the parent's /health endpoint.
 */
export function telegramHealth(): {
  status: "running" | "stopped" | "disabled"
  uptime_ms: number
  messages_received: number
  messages_responded: number
  processing: boolean
  last_session_id?: string
  voice_summary: { enabled: boolean; last_send_ms: number | null }
} {
  const voice_summary = { enabled: ELEVENLABS_API_KEY !== "" && activeConfig?.voice_summaries !== false, last_send_ms: lastVoiceSendMs }

  if (!bot) {
    return {
      status: activeConfig?.enabled === false ? "disabled" : "stopped",
      uptime_ms: 0,
      messages_received: 0,
      messages_responded: 0,
      processing: false,
      voice_summary,
    }
  }

  return {
    status: "running",
    uptime_ms: Date.now() - startedAt,
    messages_received: messagesReceived,
    messages_responded: messagesResponded,
    processing,
    last_session_id: lastSessionId,
    voice_summary,
  }
}
