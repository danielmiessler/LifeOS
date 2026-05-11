/**
 * PAI Pulse — iMessage Module
 *
 * Absorbed from standalone iMessageBot into Pulse module system.
 * Polls ~/Library/Messages/chat.db for incoming iMessages, processes them
 * through claude-agent-sdk (full Claude Code session with tools, hooks, CLAUDE.md),
 * and sends replies back via AppleScript.
 *
 * Architecture: SQLite poll -> auth -> SDK session -> AppleScript reply
 *
 * Exports:
 *   startIMessage(config)  — starts SQLite polling loop (runs forever, supervised by parent)
 *   stopIMessage()         — stops polling
 *   imessageHealth()       — returns health status
 *
 * Does NOT create its own HTTP server — health is exposed via Pulse's hook server.
 */

import { query } from "@anthropic-ai/claude-agent-sdk"
import { ConversationStore } from "../lib/conversation"
import { sanitize, analyzeForInjection } from "../lib/sanitize"
import {
  getNewMessages,
  getLatestRowId,
  verifyAccess,
} from "../lib/messages-db"
import { sendMessage } from "../lib/imessage-send"
import { join } from "path"
import { appendFile, mkdir, rename } from "fs/promises"

// BILLING: Strip ANTHROPIC_API_KEY before any SDK query() call. Same rationale
// as modules/telegram.ts — prevents API billing when the module is re-enabled.
delete process.env.ANTHROPIC_API_KEY

// ── Config Interface ──

export interface IMessageConfig {
  enabled: boolean
  allowed_handles?: string[]
  poll_interval_ms?: number
  max_turns?: number
  sdk_timeout_ms?: number
}

// ── Health Status ──

export interface IMessageHealth {
  status: "running" | "stopped" | "error"
  uptime_ms: number
  messages_received: number
  messages_responded: number
  processing: boolean
  last_row_id: number
  allowed_handles: string[]
  poll_interval_ms: number
  last_error?: string
}

// ── Module State ──

const HOME = process.env.HOME ?? ""
const CWD = join(HOME, ".claude")
const STATE_DIR = join(HOME, ".claude", "PAI", "PULSE", "state", "imessage")
const LOGS_DIR = join(HOME, ".claude", "PAI", "PULSE", "logs", "imessage")

let pollTimer: ReturnType<typeof setInterval> | null = null
let running = false
let startedAt = 0
let messagesReceived = 0
let messagesResponded = 0
let lastSessionId: string | undefined
let lastRowId = 0
let processing = false
let lastError: string | undefined
let allowedHandles = new Set<string>()
let pollIntervalMs = 3000
let maxTurns = 25
let sdkTimeoutMs = 120_000
let conversationStore: ConversationStore | null = null
let cursorPath = ""
let chatLogPath = ""

// ── Logging ──

function log(level: "info" | "warn" | "error", msg: string, data?: unknown) {
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    mod: "imessage",
    msg,
    ...(data && typeof data === "object" ? data : data ? { data } : {}),
  })
  if (level === "error") {
    console.error(entry)
  } else {
    console.log(entry)
  }
}

// ── Cursor Persistence ──

async function saveCursor() {
  const tmp = cursorPath + ".tmp"
  await Bun.write(tmp, JSON.stringify({ lastRowId }, null, 2))
  await rename(tmp, cursorPath)
}

// ── Chat Log ──

async function appendChatLog(
  handle: string,
  userMsg: string,
  botMsg: string,
) {
  const ts = new Date().toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
  const entry = `\n### ${ts}\n**${handle}:** ${userMsg}\n\n**{{DA_NAME}}:** ${botMsg}\n\n---\n`
  await appendFile(chatLogPath, entry).catch(() => {})
}

// ── Process a Single Message ──

async function processMessage(
  text: string,
  handle: string,
): Promise<string> {
  const sanitized = sanitize(text)
  if (!sanitized) return ""

  const injection = analyzeForInjection(sanitized)
  if (injection.riskLevel === "CRITICAL") {
    log("warn", "Blocked CRITICAL injection attempt", {
      handle,
      patterns: injection.matchedPatterns,
    })
    return "Message blocked for security reasons."
  }

  // Build prompt with conversation history
  const history = conversationStore!.getHistory()
  let prompt = sanitized
  if (history.length > 0) {
    const historyText = history
      .slice(-10)
      .map((m) => `${m.role === "user" ? "Principal" : "DA"}: ${m.content}`)
      .join("\n")
    prompt = `Previous conversation:\n${historyText}\n\nPrincipal's new message: ${sanitized}`
  }

  const sdkOptions: Record<string, unknown> = {
    cwd: CWD,
    tools: { type: "preset", preset: "claude_code" },
    settingSources: ["user", "project", "local"],
    maxTurns,
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    systemPrompt: {
      type: "preset",
      preset: "claude_code",
      append: `\n\nYou are responding via iMessage. Keep responses concise — under 200 words, plain text.
No markdown headers. No algorithm format. Just natural conversation.
You have ALL PAI capabilities — skills, email, calendar, everything.
When asked to check email, use the _INBOX skill. When asked about calendar, use the _CALENDAR skill.`,
    },
  }

  if (lastSessionId) {
    sdkOptions.resume = lastSessionId
  }

  const conversation = query({ prompt, options: sdkOptions as any })

  let fullText = ""
  const timeoutController = new AbortController()
  const timeout = setTimeout(() => timeoutController.abort(), sdkTimeoutMs)

  try {
    for await (const message of conversation) {
      if (timeoutController.signal.aborted) break

      const msg = message as any

      if (
        msg.type === "system" &&
        msg.subtype === "init" &&
        msg.session_id
      ) {
        lastSessionId = msg.session_id
      }

      if (
        msg.type === "stream_event" &&
        msg.event?.type === "content_block_delta" &&
        msg.event?.delta?.type === "text_delta" &&
        msg.event.delta.text
      ) {
        fullText += msg.event.delta.text
      }

      if (msg.type === "assistant" && Array.isArray(msg.message?.content)) {
        for (const block of msg.message.content) {
          if (block.type === "text" && block.text) {
            if (!fullText) fullText = block.text
          }
        }
      }

      if (msg.type === "result") {
        if (msg.subtype === "success" && msg.result) {
          fullText = msg.result
        }
        if (msg.session_id) lastSessionId = msg.session_id
        log("info", "SDK session complete", {
          numTurns: msg.num_turns,
          cost: msg.total_cost_usd,
          sessionId: lastSessionId,
        })
      }
    }
  } finally {
    clearTimeout(timeout)
  }

  return fullText || "Sorry, I wasn't able to generate a response. Try again?"
}

// ── Poll Loop ──

async function poll() {
  try {
    const messages = getNewMessages(lastRowId)

    for (const msg of messages) {
      // Update cursor regardless of auth
      lastRowId = msg.rowid

      // Auth check
      if (!allowedHandles.has(msg.handle)) {
        log("warn", "Rejected message from unauthorized handle", {
          handle: msg.handle,
        })
        continue
      }

      messagesReceived++
      log("info", "Message received", {
        handle: msg.handle,
        textLength: msg.text.length,
        rowid: msg.rowid,
      })

      // Sequential processing
      if (processing) {
        await sendMessage(
          msg.handle,
          "Still processing your previous message. Please wait.",
        )
        continue
      }

      processing = true
      const startTime = Date.now()

      try {
        const response = await processMessage(msg.text, msg.handle)
        const sent = await sendMessage(msg.handle, response)

        if (sent) {
          messagesResponded++
          log("info", "Response sent", {
            durationMs: Date.now() - startTime,
            responseLength: response.length,
          })

          await conversationStore!.addExchange(msg.text, response)
          await appendChatLog(msg.handle, msg.text, response)
        } else {
          log("error", "Failed to send iMessage reply", {
            handle: msg.handle,
          })
        }
      } catch (err) {
        lastError = String(err)
        log("error", "Message processing failed", { error: lastError })
        await sendMessage(
          msg.handle,
          "Something went wrong processing your message. Try again?",
        ).catch(() => {})
      } finally {
        processing = false
      }
    }

    // Persist cursor after processing batch
    await saveCursor()
  } catch (err) {
    lastError = String(err)
    log("error", "Poll cycle failed", { error: lastError })
  }
}

// ── Public API ──

/**
 * Start the iMessage polling loop.
 * Runs forever until stopIMessage() is called. Supervised by Pulse parent.
 */
export async function startIMessage(config: IMessageConfig): Promise<void> {
  if (running) {
    log("warn", "iMessage module already running, ignoring start request")
    return
  }

  if (!config.enabled) {
    log("info", "iMessage module disabled in config")
    return
  }

  // Apply config
  allowedHandles = new Set(config.allowed_handles ?? [])
  pollIntervalMs = config.poll_interval_ms ?? 3000
  maxTurns = config.max_turns ?? 25
  sdkTimeoutMs = config.sdk_timeout_ms ?? 120_000

  if (allowedHandles.size === 0) {
    log("error", "No allowed handles configured — iMessage module not starting")
    return
  }

  // Verify Messages.db access
  try {
    verifyAccess()
  } catch (err) {
    lastError = String(err)
    log("error", "Cannot access ~/Library/Messages/chat.db", {
      error: lastError,
      hint: "Grant Full Disk Access to your terminal in System Settings > Privacy & Security > Full Disk Access",
    })
    return
  }

  // Ensure directories
  await mkdir(STATE_DIR, { recursive: true })
  await mkdir(LOGS_DIR, { recursive: true })

  // Initialize paths
  cursorPath = join(STATE_DIR, "cursor.json")
  chatLogPath = join(LOGS_DIR, "chat-log.md")

  // Load conversation store
  conversationStore = new ConversationStore(
    join(STATE_DIR, "conversations.json"),
  )
  await conversationStore.load()

  // Load or initialize cursor
  try {
    const cursorFile = Bun.file(cursorPath)
    if (await cursorFile.exists()) {
      const cursor = (await cursorFile.json()) as { lastRowId: number }
      lastRowId = cursor.lastRowId
    } else {
      // First run — skip all existing messages
      lastRowId = getLatestRowId()
      await saveCursor()
    }
  } catch {
    // First run — skip all existing messages
    lastRowId = getLatestRowId()
    await saveCursor()
  }

  // Reset counters
  startedAt = Date.now()
  messagesReceived = 0
  messagesResponded = 0
  lastSessionId = undefined
  lastError = undefined
  processing = false
  running = true

  log("info", "iMessage module started", {
    allowedHandles: [...allowedHandles],
    pollIntervalMs,
    maxTurns,
    sdkTimeoutMs,
    startingRowId: lastRowId,
  })

  // Initial poll
  await poll()

  // Start polling loop
  pollTimer = setInterval(poll, pollIntervalMs)

  log("info", `iMessage module polling every ${pollIntervalMs}ms`)
}

/**
 * Stop the iMessage polling loop.
 * Persists cursor before stopping.
 */
export async function stopIMessage(): Promise<void> {
  if (!running) {
    log("info", "iMessage module not running, nothing to stop")
    return
  }

  log("info", "Stopping iMessage module")

  // Clear poll timer
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }

  // Persist cursor
  await saveCursor().catch((err) =>
    log("error", "Failed to persist cursor on shutdown", { error: String(err) }),
  )

  running = false
  log("info", "iMessage module stopped", {
    uptimeMs: Date.now() - startedAt,
    messagesReceived,
    messagesResponded,
  })
}

/**
 * Return current health status.
 * Called by Pulse's health endpoint — no HTTP server here.
 */
export function imessageHealth(): IMessageHealth {
  return {
    status: running ? (lastError ? "error" : "running") : "stopped",
    uptime_ms: running ? Date.now() - startedAt : 0,
    messages_received: messagesReceived,
    messages_responded: messagesResponded,
    processing,
    last_row_id: lastRowId,
    allowed_handles: [...allowedHandles],
    poll_interval_ms: pollIntervalMs,
    ...(lastError ? { last_error: lastError } : {}),
  }
}
