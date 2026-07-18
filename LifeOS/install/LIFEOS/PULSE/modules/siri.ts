// modules/siri.ts — Siri→{{DA_NAME}} voice turn endpoint.
//
// The iPhone leg is a stock Shortcuts shortcut named "Talk to {{DA_NAME}}": Siri
// dictates {{PRINCIPAL_NAME}}'s words, the shortcut POSTs them here, and Siri speaks the
// reply back. This module is the "to and from" bridge: it runs the same brain
// as the Telegram channel (buildLifeosContextBlock + Claude Agent SDK query)
// with a SIRI MODE system prompt tuned for text-to-speech output.
//
// Exposure: POST /api/siri/turn, wired in pulse.ts. Publicly reachable ONLY
// through the path-restricted Cloudflare Tunnel (see LIFEOS/TOOLS/SiriTunnel/
// ingress config) — the tunnel forwards a loopback Host header to satisfy the
// anti-DNS-rebinding guard, and everything outside /api/siri/* 404s at the
// tunnel edge. Auth: Authorization: Bearer $SIRI_API_KEY (header only, never
// URL — constitutional security rule). Fail-closed when the key is unset.
//
// Continuity mirrors telegram.ts: SDK-resume session ID + 60-minute idle
// boundary. Single user ({{PRINCIPAL_NAME}}), sequential turns — a second request while
// one is processing gets 429 so the Shortcut can say "still thinking".

import { query } from "@anthropic-ai/claude-agent-sdk"
import { buildLifeosContextBlock } from "./telegram"
import { claudeDir } from "../../TOOLS/lifeos-root";

const CWD = `${claudeDir()}`
const IDLE_TIMEOUT_MS = 60 * 60 * 1000 // 60 min — same thread boundary as Telegram
const SDK_TIMEOUT_MS = 50_000 // Shortcuts' Get Contents of URL times out ~60s; stay under it
const MAX_TURNS = 10 // speed over depth — this is a spoken exchange, not a work session
const MAX_INPUT_CHARS = 2_000
const MAX_REPLY_CHARS = 900 // soft cap, cut at sentence boundary

let lastSessionId: string | undefined
let lastMessageAt: number | null = null
let processing = false
let turnsServed = 0
let lastError: string | null = null

function log(level: "info" | "warn" | "error", msg: string, extra?: Record<string, unknown>) {
  const line = JSON.stringify({ ts: new Date().toISOString(), module: "siri", level, msg, ...extra })
  console.log(line)
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return require("crypto").timingSafeEqual(ab, bb)
}

function authorized(req: Request): boolean {
  const key = (process.env.SIRI_API_KEY ?? "").trim()
  if (!key) return false // fail closed — no key configured means no access
  const header = req.headers.get("authorization") ?? ""
  const m = header.match(/^Bearer\s+(.+)$/i)
  if (!m) return false
  return timingSafeEqualStr(m[1].trim(), key)
}

// Strip anything TTS would read badly. The system prompt asks for plain prose;
// this is the deterministic backstop.
export function sanitizeForSpeech(text: string): string {
  let t = text
  t = t.replace(/```[\s\S]*?```/g, " code omitted. ")
  t = t.replace(/`([^`]+)`/g, "$1")
  t = t.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // [label](url) → label
  t = t.replace(/^#{1,6}\s+/gm, "")
  t = t.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1")
  t = t.replace(/^[-*•]\s+/gm, "")
  t = t.replace(/https?:\/\/\S+/g, "a link")
  t = t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
  t = t.replace(/\s{2,}/g, " ").replace(/\n{2,}/g, "\n").trim()
  if (t.length > MAX_REPLY_CHARS) {
    const cut = t.slice(0, MAX_REPLY_CHARS)
    const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "))
    t = lastStop > 200 ? cut.slice(0, lastStop + 1) : cut
  }
  return t
}

async function runTurn(text: string): Promise<string> {
  const now = Date.now()
  const isIdleReset = lastMessageAt !== null && now - lastMessageAt > IDLE_TIMEOUT_MS
  if (isIdleReset) {
    log("info", "thread boundary — fresh Siri session", { idleMs: now - lastMessageAt! })
    lastSessionId = undefined
  }
  const resumeFromSdk = !isIdleReset && lastSessionId ? lastSessionId : undefined

  const contextBlock = await buildLifeosContextBlock(text)

  const sdkOptions: Record<string, unknown> = {
    cwd: CWD,
    tools: { type: "preset", preset: "claude_code" },
    settingSources: ["user", "project"], // no "local" — skip CLAUDE.md mode/format machinery
    // Channel marker — hooks skip the desktop /notify voice when not "desktop".
    // {{PRINCIPAL_NAME}} hears the reply through Siri's TTS on the phone, not the Mac speaker.
    env: { ...process.env, LIFEOS_NOTIFICATION_CHANNEL: "siri" },
    maxTurns: MAX_TURNS,
    canUseTool: (toolName: string, input: unknown) => {
      if (toolName === "Bash") {
        const cmd = typeof input === "object" && input !== null && "command" in input
          ? String((input as Record<string, unknown>).command)
          : String(input)
        if (cmd.includes("31337") || cmd.includes("/notify")) {
          log("warn", "canUseTool blocked /notify curl from SDK subprocess", { cmd: cmd.slice(0, 200) })
          return { behavior: "deny", message: "Siri mode: /notify and port 31337 are blocked. The reply is spoken by Siri on the phone." }
        }
      }
      return { behavior: "allow", updatedInput: (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown> }
    },
    systemPrompt: {
      type: "preset",
      preset: "claude_code",
      append: `\n\n${contextBlock}\n\n## SIRI MODE — HOW YOU RESPOND

You are {{DA_NAME}}. {{PRINCIPAL_NAME}} is talking to you HANDS-FREE through Siri on his iPhone — driving, walking, AirPods in. Your reply will be read aloud by text-to-speech, word for word. He cannot see a screen.

Rules, absolute:
- Answer in spoken prose only. NO markdown, NO bullets, NO headers, NO code, NO emoji, NO URLs, NO template scaffolding (no mode banners, no phase headers, no field prefixes).
- 80 words or fewer unless he explicitly asks for depth. One breath, one answer.
- Lead with the answer. No preamble.
- Numbers and names the way a person says them out loud.
- If a task needs real work (files, deploys, long research), do the quick version now and offer to queue the rest: "want me to pick that up on the Mac?"
- Speak as {{DA_NAME}} — precise, fast, warm through attention to his context.`,
    },
  }

  const queryOpts: { prompt: string; resume?: string; options?: unknown } = {
    prompt: text,
    options: sdkOptions,
  }
  if (resumeFromSdk) queryOpts.resume = resumeFromSdk

  const conversation = query(queryOpts as never)

  let fullText = ""
  const timeoutController = new AbortController()
  const timeout = setTimeout(() => timeoutController.abort(), SDK_TIMEOUT_MS)
  try {
    for await (const message of conversation) {
      if (timeoutController.signal.aborted) break
      const msg = message as { type?: string; subtype?: string; session_id?: string; message?: { content?: Array<{ type: string; text?: string }> } }
      if (msg.type === "system" && msg.subtype === "init" && msg.session_id) {
        lastSessionId = msg.session_id
      }
      if (msg.type === "assistant" && Array.isArray(msg.message?.content)) {
        let turnText = ""
        for (const block of msg.message.content) {
          if (block.type === "text" && block.text) turnText += block.text
        }
        if (turnText.trim()) fullText = turnText // keep the LAST assistant text (final answer)
      }
    }
  } finally {
    clearTimeout(timeout)
  }

  lastMessageAt = Date.now()
  if (!fullText.trim()) {
    return timeoutController.signal.aborted
      ? "That one is taking me longer than a phone call allows. Ask me again in a minute, or I can finish it on the Mac."
      : "I did not get an answer generated. Try me again."
  }
  return sanitizeForSpeech(fullText)
}

export async function handleSiriRequest(req: Request, pathname: string): Promise<Response | null> {
  if (pathname !== "/api/siri/turn") return null
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 })

  if (!authorized(req)) {
    log("warn", "unauthorized siri request")
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }

  let text = ""
  try {
    const body = (await req.json()) as { text?: string }
    text = String(body.text ?? "").trim().slice(0, MAX_INPUT_CHARS)
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 })
  }
  if (!text) return Response.json({ error: "empty text" }, { status: 400 })

  if (processing) {
    return Response.json(
      { reply: "Still working on your last one. Give me a few seconds and ask again." },
      { status: 429 },
    )
  }

  processing = true
  const started = Date.now()
  try {
    const reply = await runTurn(text)
    turnsServed++
    lastError = null
    const ms = Date.now() - started
    log("info", "siri turn served", { ms, inChars: text.length, outChars: reply.length })
    return Response.json({ reply, ms })
  } catch (err) {
    lastError = String(err)
    log("error", "siri turn failed", { error: lastError })
    return Response.json(
      { reply: "Something broke on my end handling that. I logged it. Try once more." },
      { status: 500 },
    )
  } finally {
    processing = false
  }
}

export function siriHealth(): { configured: boolean; turnsServed: number; lastError: string | null } {
  return { configured: Boolean((process.env.SIRI_API_KEY ?? "").trim()), turnsServed, lastError }
}
