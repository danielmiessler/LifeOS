/**
 * PAI Pulse — Discord Module
 *
 * discord.js v14 gateway client absorbed into Pulse as a long-running module.
 * Does NOT create its own HTTP server — health is reported via the parent's
 * /healthz endpoint using discordHealth().
 *
 * Architecture: discord.js gateway → DM filter → auth → SDK session → stream → Discord edit
 *
 * Mirrors modules/telegram.ts. Same SDK pattern, allowlist auth, conversation
 * store, sanitize/inject pipeline, sequential lock, streaming edit cadence.
 * Differences: 2000-char message cap (vs Telegram 4096), DM-only filter,
 * Discord snowflake IDs as string allowlist, MESSAGE_CONTENT privileged intent.
 *
 * Setup requirements:
 *   - Bot created at https://discord.com/developers/applications
 *   - "MESSAGE CONTENT INTENT" enabled in Bot settings (privileged)
 *   - Bot invited to your DMs (no guild needed for DM-only use)
 *   - DISCORD_BOT_TOKEN exported in env or set via config.bot_token
 */

import {
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  ChannelType,
  type Message,
} from "discord.js"
import { query } from "@anthropic-ai/claude-agent-sdk"
import { ConversationStore } from "../lib/conversation"
import { sanitize, analyzeForInjection } from "../lib/sanitize"
import { join } from "path"
import { appendFile, mkdir } from "fs/promises"

// BILLING: Strip ANTHROPIC_API_KEY before any SDK query() call. Bun auto-loads
// ~/.claude/.env into this process; if the key is present, @anthropic-ai/claude-agent-sdk
// bills the API key directly instead of the CLAUDE_CODE_OAUTH_TOKEN subscription.
// Same rationale as modules/telegram.ts — prevents API billing on bot traffic.
delete process.env.ANTHROPIC_API_KEY

// ── Config Interface ──

export interface DiscordConfig {
  enabled: boolean
  bot_token?: string
  allowed_users?: string[] // Discord snowflake IDs (preferred — immutable) or usernames (convenience — breaks on rename)
  max_turns?: number
  sdk_timeout_ms?: number
  edit_interval_ms?: number
}

// ── Constants ──

const HOME = process.env.HOME ?? ""
const CWD = join(HOME, ".claude")
const STATE_DIR = join(HOME, ".claude", "PAI", "PULSE", "state", "discord")
const LOGS_DIR = join(HOME, ".claude", "PAI", "PULSE", "logs", "discord")
const MAX_DISCORD_LENGTH = 2000
const CURSOR = " ▌"

// ── Module State ──

let client: Client | null = null
let conversationStore: ConversationStore | null = null
let processing = false
let startedAt = 0
let messagesReceived = 0
let messagesResponded = 0
let lastSessionId: string | undefined
let activeConfig: DiscordConfig | null = null
let stopResolver: (() => void) | null = null

// ── Logging ──

function log(level: "info" | "warn" | "error", msg: string, data?: unknown) {
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    component: "discord",
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
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
  const entry = `\n### ${ts}\n**{{PRINCIPAL_NAME}}:** ${userMsg}\n\n**{{DA_NAME}}:** ${botMsg}\n\n---\n`
  await appendFile(chatLogPath, entry).catch(() => {})
}

// ── Public API ──

/**
 * Start the Discord bot gateway connection.
 * Returns a Promise that resolves only when stopDiscord() is called — keeps
 * the supervisor parent from interpreting client.login() resolve as exit.
 */
export async function startDiscord(config: DiscordConfig): Promise<void> {
  if (!config.enabled) {
    log("info", "Discord module disabled")
    return
  }

  const token = config.bot_token ?? process.env.DISCORD_BOT_TOKEN
  if (!token) {
    log("error", "No bot token — set bot_token in config or DISCORD_BOT_TOKEN in env")
    return
  }

  const allowedUsers = new Set(
    config.allowed_users?.length
      ? config.allowed_users
      : (process.env.DISCORD_ALLOWED_USERS ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
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

  // Initialize conversation store
  conversationStore = new ConversationStore(join(STATE_DIR, "conversations.json"))
  await conversationStore.load()

  // Reset state
  activeConfig = config
  startedAt = Date.now()
  messagesReceived = 0
  messagesResponded = 0
  processing = false
  lastSessionId = undefined

  // Create client. MESSAGE_CONTENT is a privileged intent — must be enabled
  // in the Discord Developer Portal under Bot → Privileged Gateway Intents.
  // Partials.Channel is required to receive DM events for users not yet
  // cached when the bot starts.
  client = new Client({
    intents: [
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.Guilds,
    ],
    partials: [Partials.Channel],
  })

  client.once(Events.ClientReady, (c) => {
    log("info", `Bot ready: ${c.user.tag}`, { botId: c.user.id })
  })

  client.on(Events.MessageCreate, async (message: Message) => {
    // Drop our own messages — prevents self-loop on edits
    if (message.author.bot) return
    if (message.author.id === client?.user?.id) return

    // DM-only — ignore guild channels even if the bot is in a server
    if (message.channel.type !== ChannelType.DM) return

    // Auth — match against snowflake ID or username. Snowflakes are immutable
    // and preferred; usernames are accepted for convenience but break if the
    // Discord handle is renamed.
    if (
      !allowedUsers.has(message.author.id) &&
      !allowedUsers.has(message.author.username)
    ) {
      log("warn", "Rejected message from unauthorized user", {
        userId: message.author.id,
        username: message.author.username,
      })
      return
    }

    const text = message.content
    messagesReceived++
    log("info", "Message received", {
      userId: message.author.id,
      textLength: text.length,
    })

    // Sanitize input
    const sanitized = sanitize(text)
    if (!sanitized) return

    const injection = analyzeForInjection(sanitized)
    if (injection.riskLevel === "CRITICAL") {
      log("warn", "Blocked CRITICAL injection attempt", {
        userId: message.author.id,
        patterns: injection.matchedPatterns,
      })
      await message.reply("Message blocked for security reasons.").catch(() => {})
      return
    }

    // Sequential processing — one message at a time
    if (processing) {
      await message.reply("Still processing your previous message. Please wait.").catch(() => {})
      return
    }

    processing = true
    const startTime = Date.now()

    try {
      // Typing indicator (shows for ~10s or until next message in channel)
      await message.channel.sendTyping().catch(() => {})

      // Build prompt with conversation history
      const history = conversationStore!.getHistory()
      let prompt = sanitized
      if (history.length > 0) {
        const historyText = history
          .slice(-10) // Last 5 exchanges for context
          .map((m) => `${m.role === "user" ? "Principal" : "DA"}: ${m.content}`)
          .join("\n")
        prompt = `Previous conversation:\n${historyText}\n\nPrincipal's new message: ${sanitized}`
      }

      const sdkOptions: Record<string, unknown> = {
        cwd: CWD,
        tools: { type: "preset", preset: "claude_code" },
        // NO "local" — skip CLAUDE.md to avoid Algorithm/format/voice curls
        settingSources: ["user", "project"],
        maxTurns,
        includePartialMessages: true,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        systemPrompt: {
          type: "preset",
          preset: "claude_code",
          append: `\n\n## DISCORD MODE OVERRIDE (highest priority — overrides CLAUDE.md format rules)

You are {{DA_NAME}}, responding via Discord DM. {{PRINCIPAL_NAME}} is messaging you from Discord.

CRITICAL RULES FOR DISCORD MODE:
- IGNORE all ALGORITHM/NATIVE/MINIMAL format templates from CLAUDE.md. Those are for terminal sessions only.
- NO format headers (no ════, no 🗒️, no ━━━, no ISC criteria, no phase markers)
- NO emoji prefixes, NO bullet formatting
- Speak as {{DA_NAME}} — first person, natural, conversational, like talking to a friend
- Keep responses under 200 words
- Code blocks with triple-backticks ARE supported and render — use them when sharing code
- NEVER use voice notification curls (no http://localhost:31337/notify calls)
- You have ALL PAI capabilities — skills, email, calendar, lights, everything
- When doing tasks, do them and confirm briefly what you did`,
        },
      }

      // NOTE: resume intentionally omitted. Stale session IDs (expired server-side)
      // cause the SDK to return numTurns:0 / cost:0 with an empty response.
      // Conversation context is provided via the manual history injection above.
      const conversation = query({ prompt, options: sdkOptions as any })

      let fullText = ""
      let sentMessage: Message | null = null
      let lastEditTime = 0

      const timeoutController = new AbortController()
      const timeout = setTimeout(() => timeoutController.abort(), sdkTimeoutMs)

      try {
        for await (const messageEvent of conversation) {
          if (timeoutController.signal.aborted) break

          const msg = messageEvent as any

          // Capture session ID for resume
          if (msg.type === "system" && msg.subtype === "init" && msg.session_id) {
            lastSessionId = msg.session_id
            log("info", "Session initialized", { sessionId: lastSessionId })
          }

          // Streaming text deltas (progressive updates)
          if (
            msg.type === "stream_event" &&
            msg.event?.type === "content_block_delta" &&
            msg.event?.delta?.type === "text_delta" &&
            msg.event.delta.text
          ) {
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

          // Live edit updates in Discord
          const now = Date.now()
          if (fullText && now - lastEditTime >= editIntervalMs) {
            const displayText = fullText.slice(0, MAX_DISCORD_LENGTH - 10) + CURSOR
            try {
              if (!sentMessage) {
                sentMessage = await message.reply(displayText)
              } else {
                await sentMessage.edit(displayText).catch(() => {})
              }
              lastEditTime = now
            } catch {
              /* edit failures are non-critical */
            }
          }
        }
      } finally {
        clearTimeout(timeout)
      }

      if (!fullText) {
        fullText = "Sorry, I wasn't able to generate a response. Try again?"
        log("error", "Empty response from SDK")
      }

      // Final clean message
      if (fullText.length <= MAX_DISCORD_LENGTH) {
        if (sentMessage) {
          await sentMessage.edit(fullText).catch(() => {})
        } else {
          await message.reply(fullText)
        }
      } else {
        // Split long messages into 2000-char chunks
        const chunks: string[] = []
        let remaining = fullText
        while (remaining.length > 0) {
          chunks.push(remaining.slice(0, MAX_DISCORD_LENGTH))
          remaining = remaining.slice(MAX_DISCORD_LENGTH)
        }
        if (sentMessage) {
          await sentMessage.edit(chunks[0]!).catch(() => {})
          for (const chunk of chunks.slice(1)) {
            await message.channel.send(chunk).catch(() => {})
          }
        } else {
          for (const chunk of chunks) {
            await message.channel.send(chunk).catch(() => {})
          }
        }
      }

      messagesResponded++
      log("info", "Response sent", {
        durationMs: Date.now() - startTime,
        responseLength: fullText.length,
      })

      // Persist conversation
      await conversationStore!.addExchange(sanitized, fullText)
      await appendChatLog(sanitized, fullText)
    } catch (err) {
      log("error", "Message processing failed", { error: String(err) })
      await message.reply("Something went wrong processing your message. Try again?").catch(() => {})
    } finally {
      processing = false
    }
  })

  log("info", "Starting Discord gateway", { allowedUsers: [...allowedUsers] })

  await client.login(token)

  // Stay alive until stopDiscord() is called.
  // Without this, the supervisor sees startDiscord() return immediately
  // after login() resolves and triggers an unwanted restart loop.
  await new Promise<void>((resolve) => {
    stopResolver = resolve
  })
}

/**
 * Stop the Discord gateway gracefully.
 */
export async function stopDiscord(): Promise<void> {
  if (!client) return
  log("info", "Stopping Discord client")
  await client.destroy()
  client = null
  activeConfig = null
  if (stopResolver) {
    stopResolver()
    stopResolver = null
  }
  log("info", "Discord client stopped")
}

/**
 * Return health status for the parent's /healthz endpoint.
 */
export function discordHealth(): {
  status: "running" | "stopped" | "disabled"
  uptime_ms: number
  messages_received: number
  messages_responded: number
  processing: boolean
  last_session_id?: string
} {
  if (!client) {
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
