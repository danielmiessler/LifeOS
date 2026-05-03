/**
 * PAI Pulse — Telegram Module
 *
 * grammY polling bot absorbed into Pulse as a long-running module.
 * Does NOT create its own HTTP server — health is reported via the
 * parent's /health endpoint using telegramHealth().
 *
 * Architecture: grammY polling → auth → SDK query → stream → Telegram
 */

import { Bot } from "grammy"
import { query } from "@anthropic-ai/claude-agent-sdk"
import { ConversationStore } from "../lib/conversation"
import { sanitize, analyzeForInjection } from "../lib/sanitize"
import { join } from "path"
import { appendFile, mkdir, readFile } from "fs/promises"

// BILLING: Strip ANTHROPIC_API_KEY before any SDK query() call. Bun auto-loads
// ~/.claude/.env into this process; if the key is present, @anthropic-ai/claude-agent-sdk
// bills the API key directly instead of the CLAUDE_CODE_OAUTH_TOKEN subscription.
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
const SETTINGS_PATH = join(HOME, ".claude", "settings.json")
const MAX_TELEGRAM_LENGTH = 4096
const CURSOR = " ▌"

// ── Module State ──

let bot: Bot | null = null
let conversationStore: ConversationStore | null = null
let processing = false
let startedAt = 0
let messagesReceived = 0
let messagesResponded = 0
let lastSessionId: string | undefined
let activeConfig: TelegramConfig | null = null
let identityCache: { daName: string; principalName: string } | null = null

// ── Logging ──

function log(level: "info" | "warn" | "error", msg: string, data?: unknown) {
  const entry = JSON.stringify({ ts: new Date().toISOString(), level, component: "telegram", msg, ...(data ? { data } : {}) })
  console.log(entry)
}

async function getIdentity(): Promise<{ daName: string; principalName: string }> {
  if (identityCache) return identityCache
  let daName = process.env.DA_NAME || "the DA"
  let principalName = process.env.PRINCIPAL_NAME || "the principal"
  try {
    const settings = JSON.parse(await readFile(SETTINGS_PATH, "utf-8"))
    daName = settings?.daidentity?.name || settings?.daidentity?.fullName || settings?.da?.name || daName
    principalName = settings?.principal?.name || settings?.principal?.fullName || settings?.principalName || principalName
  } catch {}
  identityCache = { daName, principalName }
  return identityCache
}

// ── Chat Log ──

async function appendChatLog(userMsg: string, botMsg: string) {
  const { daName, principalName } = await getIdentity()
  const chatLogPath = join(LOGS_DIR, "chat-log.md")
  const ts = new Date().toLocaleString("en-US", {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  })
  const entry = `\n### ${ts}\n**${principalName}:** ${userMsg}\n\n**${daName}:** ${botMsg}\n\n---\n`
  await appendFile(chatLogPath, entry).catch(() => {})
}

// ── Exports ──

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

  await mkdir(STATE_DIR, { recursive: true })
  await mkdir(LOGS_DIR, { recursive: true })

  conversationStore = new ConversationStore(join(STATE_DIR, "conversations.json"))
  await conversationStore.load()

  activeConfig = config
  startedAt = Date.now()
  messagesReceived = 0
  messagesResponded = 0
  processing = false
  lastSessionId = undefined

  bot = new Bot(token)

  bot.use(async (ctx, next) => {
    const userId = ctx.from?.id
    if (!userId || !allowedUsers.has(userId)) {
      log("warn", "Rejected message from unauthorized user", { userId, username: ctx.from?.username })
      return
    }
    await next()
  })

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text
    const userId = ctx.from.id
    const chatId = ctx.chat.id

    messagesReceived++
    log("info", "Message received", { userId, chatId, textLength: text.length })

    const sanitized = sanitize(text)
    if (!sanitized) return

    const injection = analyzeForInjection(sanitized)
    if (injection.riskLevel === "CRITICAL") {
      log("warn", "Blocked CRITICAL injection attempt", { userId, patterns: injection.matchedPatterns })
      await ctx.reply("Message blocked for security reasons.")
      return
    }

    if (processing) {
      await ctx.reply("Still processing your previous message. Please wait.")
      return
    }

    processing = true
    const startTime = Date.now()

    try {
      await ctx.api.sendChatAction(chatId, "typing").catch(() => {})

      const { daName, principalName } = await getIdentity()
      const history = conversationStore!.getHistory()
      let prompt = sanitized
      if (history.length > 0) {
        const historyText = history
          .slice(-10)
          .map(m => `${m.role === "user" ? principalName : daName}: ${m.content}`)
          .join("\n")
        prompt = `Previous conversation:\n${historyText}\n\n${principalName}'s new message: ${sanitized}`
      }

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

You are ${daName}, responding via Telegram. ${principalName} is messaging you from a phone.

CRITICAL RULES FOR TELEGRAM MODE:
- IGNORE all ALGORITHM/NATIVE/MINIMAL format templates from CLAUDE.md. Those are for terminal sessions only.
- NO format headers (no ════, no 🗒️, no ━━━, no ISC criteria, no phase markers)
- NO emoji prefixes, NO bullet formatting
- Speak as ${daName} — first person, natural, conversational, like talking to a friend
- Keep responses under 200 words
- No code blocks unless ${principalName} specifically asks for code
- NEVER use voice notification curls (no http://localhost:31337/notify calls)
- You have ALL PAI capabilities — skills, email, calendar, lights, everything
- When doing tasks, do them and confirm briefly what you did`,
        },
      }

      // Do not set sdkOptions.resume here. Conversation history is already
      // supplied manually above. Using both resume and manual history can make
      // short follow-ups look redundant to the SDK and return numTurns=0.
      const conversation = query({ prompt, options: sdkOptions as any })

      let fullText = ""
      let messageId: number | null = null
      let lastEditTime = 0

      const timeoutController = new AbortController()
      const timeout = setTimeout(() => timeoutController.abort(), sdkTimeoutMs)

      try {
        for await (const message of conversation) {
          if (timeoutController.signal.aborted) break
          const msg = message as any

          if (msg.type === "system" && msg.subtype === "init" && msg.session_id) {
            lastSessionId = msg.session_id
            log("info", "Session initialized", { sessionId: lastSessionId })
          }

          if (msg.type === "stream_event" && msg.event?.type === "content_block_delta" &&
              msg.event?.delta?.type === "text_delta" && msg.event.delta.text) {
            fullText += msg.event.delta.text
          }

          if (msg.type === "assistant" && Array.isArray(msg.message?.content)) {
            for (const block of msg.message.content) {
              if (block.type === "text" && block.text && !fullText) fullText = block.text
            }
          }

          if (msg.type === "result") {
            if (msg.subtype === "success" && msg.result) fullText = msg.result
            if (msg.session_id) lastSessionId = msg.session_id
            log("info", "SDK session complete", {
              durationMs: Date.now() - startTime,
              numTurns: msg.num_turns,
              cost: msg.total_cost_usd,
              sessionId: lastSessionId,
            })
          }

          const now = Date.now()
          if (fullText && now - lastEditTime >= editIntervalMs) {
            const displayText = fullText.slice(0, MAX_TELEGRAM_LENGTH - 10) + CURSOR
            try {
              if (!messageId) {
                const sent = await ctx.reply(displayText)
                messageId = sent.message_id
              } else {
                await ctx.api.editMessageText(chatId, messageId, displayText).catch(() => {})
              }
              lastEditTime = now
            } catch {}
          }
        }
      } finally {
        clearTimeout(timeout)
      }

      if (!fullText) {
        fullText = "Sorry, I wasn't able to generate a response. Try again?"
        log("error", "Empty response from SDK")
      }

      if (fullText.length <= MAX_TELEGRAM_LENGTH) {
        if (messageId) await ctx.api.editMessageText(chatId, messageId, fullText).catch(() => {})
        else await ctx.reply(fullText)
      } else {
        const chunks: string[] = []
        let remaining = fullText
        while (remaining.length > 0) {
          chunks.push(remaining.slice(0, MAX_TELEGRAM_LENGTH))
          remaining = remaining.slice(MAX_TELEGRAM_LENGTH)
        }
        if (messageId) {
          await ctx.api.editMessageText(chatId, messageId, chunks[0]!).catch(() => {})
          for (const chunk of chunks.slice(1)) await ctx.reply(chunk)
        } else {
          for (const chunk of chunks) await ctx.reply(chunk)
        }
      }

      messagesResponded++
      log("info", "Response sent", { durationMs: Date.now() - startTime, responseLength: fullText.length })

      await conversationStore!.addExchange(sanitized, fullText)
      await appendChatLog(sanitized, fullText)

    } catch (err) {
      log("error", "Message processing failed", { error: String(err) })
      await ctx.reply("Something went wrong processing your message. Try again?").catch(() => {})
    } finally {
      processing = false
    }
  })

  log("info", "Starting Telegram polling", { allowedUsers: [...allowedUsers] })

  await bot.start({
    onStart: (info) => log("info", `Bot started: @${info.username}`, { botId: info.id }),
  })
}

export async function stopTelegram(): Promise<void> {
  if (!bot) return
  log("info", "Stopping Telegram bot")
  bot.stop()
  bot = null
  activeConfig = null
  log("info", "Telegram bot stopped")
}

export function telegramHealth(): {
  status: "running" | "stopped" | "disabled"
  uptime_ms: number
  messages_received: number
  messages_responded: number
  processing: boolean
  last_session_id?: string
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
    last_session_id: lastSessionId,
  }
}
