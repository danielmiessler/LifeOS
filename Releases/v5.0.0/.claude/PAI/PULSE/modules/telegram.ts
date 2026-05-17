/**
 * PAI Pulse — Telegram Module
 *
 * grammY polling bot absorbed into Pulse as a long-running module.
 * Does NOT create its own HTTP server — health is reported via the
 * parent's /health endpoint using telegramHealth().
 *
 * Architecture: grammY polling → auth → thread resolve → SDK session (per thread) → stream → Telegram
 *
 * Threading model (v2 — 2026-05-18):
 *   - Each top-level user message starts a fresh thread.
 *   - A reply to a bot message resumes THAT thread's SDK session.
 *   - /new clears all thread state. /threads lists active threads.
 *   - Empty SDK responses retry once with a fresh session; second failure
 *     returns a specific diagnosis (timeout / max_turns / empty) and is
 *     NOT written into thread history.
 */

import { Bot } from "grammy"
import { query } from "@anthropic-ai/claude-agent-sdk"
import { ThreadStore, defaultThreadStorePath } from "../lib/threadStore"
import { sanitize, analyzeForInjection } from "../lib/sanitize"
import { join } from "path"
import { appendFile, mkdir, readdir, readFile } from "fs/promises"

// BILLING: Strip ANTHROPIC_API_KEY before any SDK query() call. Bun auto-loads
// ~/.claude/.env into this process; if the key is present, @anthropic-ai/claude-agent-sdk
// bills the API key directly instead of the CLAUDE_CODE_OAUTH_TOKEN subscription.
// This was the root cause of the April 2026 Sonnet 4.5 $353.89 + Web Search $72.48
// invoice — every Telegram message was a 25-turn SDK session billed to the API.
delete process.env.ANTHROPIC_API_KEY

// ── Config Interface ──

export interface TelegramConfig {
  enabled: boolean
  bot_token?: string
  allowed_users?: number[]
  max_turns?: number
  sdk_timeout_ms?: number
  edit_interval_ms?: number
}

// ── Constants ──

const HOME = process.env.HOME ?? ""
const CWD = join(HOME, ".claude")
const STATE_DIR = join(HOME, ".claude", "PAI", "PULSE", "state", "telegram")
const LOGS_DIR = join(HOME, ".claude", "PAI", "PULSE", "logs", "telegram")
const WORK_DIR = join(HOME, ".claude", "PAI", "MEMORY", "WORK")
const MAX_TELEGRAM_LENGTH = 4096
const CURSOR = " ▌"

// ── Module State ──

let bot: Bot | null = null
let threadStore: ThreadStore | null = null
let botUserId: number | undefined
let processing = false
let startedAt = 0
let messagesReceived = 0
let messagesResponded = 0
let activeConfig: TelegramConfig | null = null

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

async function appendChatLog(threadId: number, userMsg: string, botMsg: string) {
  const chatLogPath = join(LOGS_DIR, "chat-log.md")
  const ts = new Date().toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  })
  const entry = `\n### ${ts} · thread ${threadId}\n**{{PRINCIPAL_NAME}}:** ${userMsg}\n\n**{{DA_NAME}}:** ${botMsg}\n\n---\n`
  await appendFile(chatLogPath, entry).catch(() => {})
}

// ── Tool → friendly status mapping ──

function friendlyToolStatus(toolName: string | undefined): string | null {
  if (!toolName) return null
  const n = toolName.toLowerCase()
  if (n.includes("gmail") || n.includes("mail")) return "📬 Reading email…"
  if (n.includes("calendar")) return "📅 Checking calendar…"
  if (n.includes("read")) return "📖 Reading file…"
  if (n.includes("write") || n.includes("edit")) return "✏️ Editing…"
  if (n.includes("bash") || n.includes("shell")) return "⚡ Running command…"
  if (n.includes("grep") || n.includes("search")) return "🔍 Searching…"
  if (n.includes("skill")) return "🛠️ Invoking skill…"
  if (n.includes("agent") || n.includes("task")) return "🤖 Delegating…"
  if (n.includes("fetch") || n.includes("http")) return "🌐 Fetching…"
  return `🔧 ${toolName}…`
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

  // Initialize thread store
  threadStore = new ThreadStore(defaultThreadStorePath(HOME))
  await threadStore.load()

  // Create bot
  activeConfig = config
  startedAt = Date.now()
  messagesReceived = 0
  messagesResponded = 0
  processing = false
  botUserId = undefined

  bot = new Bot(token)

  // Auth middleware — applies to commands AND messages
  bot.use(async (ctx, next) => {
    const userId = ctx.from?.id
    if (!userId || !allowedUsers.has(userId)) {
      log("warn", "Rejected message from unauthorized user", { userId, username: ctx.from?.username })
      return
    }
    await next()
  })

  // ── Commands ── (registered BEFORE the catch-all message handler)

  bot.command("new", async (ctx) => {
    if (!threadStore) return
    const { threads } = threadStore.size()
    await threadStore.clearAll()
    await ctx.reply(`🧹 Cleared ${threads} thread(s). Next message starts fresh.`)
    log("info", "Thread state cleared via /new", { threadsCleared: threads })
  })

  bot.command("help", async (ctx) => {
    const lines = [
      "*I'm your DA over Telegram.*",
      "",
      "Threading:",
      "• Top-level message = new thread",
      "• Reply to one of my messages = continue that thread",
      "",
      "Commands:",
      "• `/new` — clear all threads, start fresh",
      "• `/status` — current config + counts",
      "• `/threads` — list active threads",
      "• `/help` — this message",
      "",
      "Otherwise just talk to me — I have full PAI access.",
    ]
    await ctx.reply(lines.join("\n"), { parse_mode: "Markdown" }).catch(() => ctx.reply(lines.join("\n")))
  })

  bot.command("status", async (ctx) => {
    if (!threadStore) return
    const sizes = threadStore.size()
    const uptimeMin = Math.round((Date.now() - startedAt) / 60_000)
    const lines = [
      "*Status*",
      `Uptime: ${uptimeMin}m`,
      `Threads: ${sizes.threads}`,
      `Bot-message map: ${sizes.botMessages}`,
      `Received: ${messagesReceived} · Responded: ${messagesResponded}`,
      `Processing: ${processing ? "yes" : "no"}`,
      `Max turns: ${maxTurns} · Timeout: ${Math.round(sdkTimeoutMs / 1000)}s`,
    ]
    await ctx.reply(lines.join("\n"), { parse_mode: "Markdown" }).catch(() => ctx.reply(lines.join("\n")))
  })

  bot.command("threads", async (ctx) => {
    if (!threadStore) return
    const list = threadStore.listThreads().slice(0, 20)
    if (list.length === 0) {
      await ctx.reply("No active threads.")
      return
    }
    const now = Date.now()
    const lines = ["*Active threads:*", ""]
    for (const t of list) {
      const ageMin = Math.round((now - t.updated) / 60_000)
      const ageLabel = ageMin < 60 ? `${ageMin}m` : ageMin < 1440 ? `${Math.round(ageMin / 60)}h` : `${Math.round(ageMin / 1440)}d`
      const topic = t.topic.replace(/[*_`\[\]]/g, "").slice(0, 60)
      lines.push(`• #${t.threadId} · ${t.messageCount}msg · ${ageLabel} · ${topic}`)
    }
    await ctx.reply(lines.join("\n"), { parse_mode: "Markdown" }).catch(() => ctx.reply(lines.join("\n")))
  })

  // Message handler — sequential processing, thread-aware
  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text
    const userId = ctx.from.id
    const chatId = ctx.chat.id

    // Skip unknown slash commands rather than feeding them to the SDK
    if (text.startsWith("/")) {
      log("info", "Unknown command ignored", { text: text.slice(0, 32) })
      return
    }

    messagesReceived++
    log("info", "Message received", { userId, chatId, messageId: ctx.message.message_id, textLength: text.length })

    // Sanitize input
    const sanitized = sanitize(text)
    if (!sanitized.trim()) {
      log("warn", "Empty message after sanitize", { userId, originalLength: text.length })
      await ctx.reply("⚠️ Leere Nachricht. Bitte etwas Text schicken — oder /help für Befehle.").catch(() => {})
      return
    }

    const injection = analyzeForInjection(sanitized)
    if (injection.riskLevel === "CRITICAL") {
      log("warn", "Blocked CRITICAL injection attempt", { userId, patterns: injection.matchedPatterns })
      await ctx.reply("Message blocked for security reasons.")
      return
    }

    // Sequential processing — one message at a time
    if (processing) {
      await ctx.reply("Still processing your previous message. Please wait.")
      return
    }

    processing = true
    const startTime = Date.now()

    // ── Resolve which thread this message belongs to ──
    const replyTo = ctx.message.reply_to_message
    const { threadId, created: threadCreated } = threadStore!.resolveThread({
      incomingMessageId: ctx.message.message_id,
      incomingText: sanitized,
      replyToBotMessageId: replyTo?.message_id,
      replyToFromIsBot: replyTo?.from?.is_bot,
      replyToFromId: replyTo?.from?.id,
      botId: botUserId,
    })
    const thread = threadStore!.getThread(threadId)
    log("info", "Thread resolved", { threadId, created: threadCreated, sessionId: thread?.sessionId })

    try {
      // Typing indicator
      await ctx.api.sendChatAction(chatId, "typing").catch(() => {})

      // Build prompt with per-thread history
      const history = threadStore!.getHistory(threadId, 10)
      let prompt = sanitized
      if (history.length > 0) {
        const historyText = history
          .map(m => `${m.role === "user" ? "Principal" : "DA"}: ${m.content}`)
          .join("\n")
        prompt = `Previous conversation:\n${historyText}\n\nPrincipal's new message: ${sanitized}`
      }

      const result = await runSdk({
        prompt,
        resumeSessionId: thread?.sessionId,
        ctx,
        chatId,
        threadId,
        maxTurns,
        sdkTimeoutMs,
        editIntervalMs,
      })

      // Empty → retry ONCE with fresh session (no resume) and prefix hint.
      // We do NOT write the empty/diagnostic into thread history.
      if (!result.text) {
        log("warn", "Empty response — retrying once with fresh session", { threadId, subtype: result.subtype })
        const retryPrompt = `[Previous attempt produced no output — try a more direct approach this time.]\n\n${sanitized}`
        const retry = await runSdk({
          prompt: retryPrompt,
          resumeSessionId: undefined,
          ctx,
          chatId,
          threadId,
          maxTurns,
          sdkTimeoutMs,
          editIntervalMs,
          existingMessageId: result.messageId ?? undefined,
        })
        result.text = retry.text
        result.subtype = retry.subtype ?? result.subtype
        result.sessionId = retry.sessionId ?? result.sessionId
        result.messageId = retry.messageId ?? result.messageId
        result.timedOut = retry.timedOut || result.timedOut
      }

      // Final outcome
      if (result.text) {
        // Persist the new sessionId on this thread
        if (result.sessionId) threadStore!.setSessionId(threadId, result.sessionId)

        // Send / edit final clean message and capture bot message id for reply-chain
        const finalMessageId = await sendFinal(ctx, chatId, result.text, result.messageId)
        if (finalMessageId !== null) {
          threadStore!.recordBotMessage(threadId, finalMessageId)
        }

        await threadStore!.addExchange(threadId, sanitized, result.text)
        await appendChatLog(threadId, sanitized, result.text)
        messagesResponded++

        log("info", "Response sent", {
          threadId,
          durationMs: Date.now() - startTime,
          responseLength: result.text.length,
          sessionId: result.sessionId,
        })
      } else {
        // Both attempts empty → specific diagnostic, NOT written into history
        const reason = diagnoseFailure(result.subtype, result.timedOut)
        log("error", "Empty response after retry", { threadId, subtype: result.subtype, timedOut: result.timedOut })
        const finalMessageId = await sendFinal(ctx, chatId, reason, result.messageId)
        if (finalMessageId !== null) {
          // Map this diagnostic msg back to the thread so the user can still reply-to-continue
          threadStore!.recordBotMessage(threadId, finalMessageId)
        }
      }
    } catch (err) {
      log("error", "Message processing failed", { error: String(err), threadId })
      await ctx.reply("Something went wrong processing your message. Try again?").catch(() => {})
    } finally {
      processing = false
    }
  })

  // Start polling
  log("info", "Starting Telegram polling", { allowedUsers: [...allowedUsers] })

  await bot.start({
    onStart: (info) => {
      botUserId = info.id
      log("info", `Bot started: @${info.username}`, { botId: info.id })
    },
  })
}

// ── SDK runner with live status streaming ──

interface SdkRunArgs {
  prompt: string
  resumeSessionId: string | undefined
  ctx: any
  chatId: number
  threadId: number
  maxTurns: number
  sdkTimeoutMs: number
  editIntervalMs: number
  existingMessageId?: number
}

interface SdkRunResult {
  text: string
  sessionId?: string
  subtype?: string
  timedOut: boolean
  messageId: number | null
}

async function runSdk(args: SdkRunArgs): Promise<SdkRunResult> {
  const { prompt, resumeSessionId, ctx, chatId, maxTurns, sdkTimeoutMs, editIntervalMs, existingMessageId } = args

  const sdkOptions: Record<string, unknown> = {
    cwd: CWD,
    tools: { type: "preset", preset: "claude_code" },
    settingSources: ["user", "project"],
    maxTurns,
    includePartialMessages: true,
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    systemPrompt: {
      type: "preset",
      preset: "claude_code",
      append: `\n\n## TELEGRAM MODE OVERRIDE (highest priority — overrides CLAUDE.md format rules)

You are {{DA_NAME}}, responding via Telegram. {{PRINCIPAL_NAME}} is messaging you from his phone.

CRITICAL RULES FOR TELEGRAM MODE:
- IGNORE all ALGORITHM/NATIVE/MINIMAL format templates from CLAUDE.md. Those are for terminal sessions only.
- NO format headers (no ════, no 🗒️, no ━━━, no ISC criteria, no phase markers)
- NO emoji prefixes, NO bullet formatting
- Speak as {{DA_NAME}} — first person, natural, conversational, like talking to a friend
- Keep responses under 200 words
- No code blocks unless {{PRINCIPAL_NAME}} specifically asks for code
- NEVER use voice notification curls (no http://localhost:31337/notify calls)
- You have ALL PAI capabilities — skills, email, calendar, lights, everything
- When doing tasks, do them and confirm briefly what you did`,
    },
  }

  if (resumeSessionId) sdkOptions.resume = resumeSessionId

  const conversation = query({ prompt, options: sdkOptions as any })

  let fullText = ""
  let messageId: number | null = existingMessageId ?? null
  let lastEditTime = 0
  let lastStatus: string | null = null
  let sessionId: string | undefined
  let subtype: string | undefined
  let timedOut = false

  const timeoutController = new AbortController()
  const timeout = setTimeout(() => {
    timedOut = true
    timeoutController.abort()
  }, sdkTimeoutMs)

  const editStatus = async (statusText: string) => {
    if (statusText === lastStatus) return
    lastStatus = statusText
    try {
      if (!messageId) {
        const sent = await ctx.reply(statusText)
        messageId = sent.message_id
      } else {
        await ctx.api.editMessageText(chatId, messageId, statusText).catch(() => {})
      }
    } catch { /* non-critical */ }
  }

  try {
    for await (const message of conversation) {
      if (timeoutController.signal.aborted) break
      const msg = message as any

      if (msg.type === "system" && msg.subtype === "init" && msg.session_id) {
        sessionId = msg.session_id
      }

      // Streaming text deltas
      if (msg.type === "stream_event" && msg.event?.type === "content_block_delta" &&
          msg.event?.delta?.type === "text_delta" && msg.event.delta.text) {
        fullText += msg.event.delta.text
      }

      // Tool-use detection for status updates
      if (msg.type === "stream_event" && msg.event?.type === "content_block_start" &&
          msg.event?.content_block?.type === "tool_use" && !fullText) {
        const status = friendlyToolStatus(msg.event.content_block.name)
        if (status) await editStatus(status)
      }
      if (msg.type === "assistant" && Array.isArray(msg.message?.content) && !fullText) {
        for (const block of msg.message.content) {
          if (block.type === "tool_use") {
            const status = friendlyToolStatus(block.name)
            if (status) await editStatus(status)
          }
        }
      }

      // Full assistant message (fallback if streaming text isn't available)
      if (msg.type === "assistant" && Array.isArray(msg.message?.content)) {
        for (const block of msg.message.content) {
          if (block.type === "text" && block.text && !fullText) {
            fullText = block.text
          }
        }
      }

      // Final result
      if (msg.type === "result") {
        if (msg.subtype === "success" && msg.result) fullText = msg.result
        subtype = msg.subtype
        if (msg.session_id) sessionId = msg.session_id
      }

      // Live text edits
      const now = Date.now()
      if (fullText && now - lastEditTime >= editIntervalMs) {
        const display = fullText.slice(0, MAX_TELEGRAM_LENGTH - 10) + CURSOR
        try {
          if (!messageId) {
            const sent = await ctx.reply(display)
            messageId = sent.message_id
          } else {
            await ctx.api.editMessageText(chatId, messageId, display).catch(() => {})
          }
          lastEditTime = now
        } catch { /* non-critical */ }
      }
    }
  } finally {
    clearTimeout(timeout)
  }

  return { text: fullText, sessionId, subtype, timedOut, messageId }
}

function diagnoseFailure(subtype: string | undefined, timedOut: boolean): string {
  if (timedOut) return "⏱️ Timeout nach 120s. Bitte den Task kleiner schneiden oder mit /new neu starten."
  if (subtype === "error_max_turns") return "🔁 Hat zu viele Schritte gebraucht (Max-Turns erreicht). Bitte konkretere Frage stellen."
  if (subtype === "error_during_execution") return "⚠️ Fehler in der Ausführung. Nochmal versuchen, ggf. /new."
  if (subtype && subtype !== "success") return `⚠️ Konnte keine Antwort erzeugen (subtype=${subtype}).`
  return "⚠️ Leere Antwort. Bitte nochmal — oder /new für frischen Kontext."
}

async function sendFinal(ctx: any, chatId: number, text: string, existingMessageId: number | null): Promise<number | null> {
  if (text.length <= MAX_TELEGRAM_LENGTH) {
    if (existingMessageId) {
      const ok = await ctx.api.editMessageText(chatId, existingMessageId, text).catch(() => null)
      return ok ? existingMessageId : null
    } else {
      const sent = await ctx.reply(text).catch(() => null)
      return sent ? sent.message_id : null
    }
  }
  // Split long messages
  const chunks: string[] = []
  let remaining = text
  while (remaining.length > 0) {
    chunks.push(remaining.slice(0, MAX_TELEGRAM_LENGTH))
    remaining = remaining.slice(MAX_TELEGRAM_LENGTH)
  }
  let lastId: number | null = null
  if (existingMessageId && chunks[0]) {
    await ctx.api.editMessageText(chatId, existingMessageId, chunks[0]).catch(() => {})
    lastId = existingMessageId
    for (const chunk of chunks.slice(1)) {
      const sent = await ctx.reply(chunk).catch(() => null)
      if (sent) lastId = sent.message_id
    }
  } else {
    for (const chunk of chunks) {
      const sent = await ctx.reply(chunk).catch(() => null)
      if (sent) lastId = sent.message_id
    }
  }
  return lastId
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
  active_threads?: number
} {
  if (!bot) {
    return {
      status: activeConfig?.enabled === false ? "disabled" : "stopped",
      uptime_ms: 0,
      messages_received: 0,
      messages_responded: 0,
      processing: false,
    }
  }

  return {
    status: "running",
    uptime_ms: Date.now() - startedAt,
    messages_received: messagesReceived,
    messages_responded: messagesResponded,
    processing,
    active_threads: threadStore?.size().threads,
  }
}
