/**
 * PAI Pulse — Telegram Module
 *
 * grammY polling bot absorbed into Pulse as a long-running module.
 * Does NOT create its own HTTP server — health is reported via the
 * parent's /health endpoint using telegramHealth().
 *
 * Architecture: grammY polling → auth → SDK session → stream → Telegram
 */

import { Bot, InputFile } from "grammy"
import { query } from "@anthropic-ai/claude-agent-sdk"
import { ConversationStore } from "../lib/conversation"
import { sanitize, analyzeForInjection } from "../lib/sanitize"
import { join } from "path"
import { appendFile, mkdir, unlink } from "fs/promises"

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
const INCOMING_DIR = join(STATE_DIR, "incoming")
const MAX_TELEGRAM_LENGTH = 4096
const CURSOR = " ▌"

// ── Outbound image tags ──
// Slammer emits [[IMG:/path]] or [[IMG:https://url]] to send {{PRINCIPAL_NAME}} a
// photo. The bridge extracts the refs, sends them, and strips the tags from the text.
const IMG_TAG = /\[\[IMG:\s*([^\]]+?)\s*\]\]/g
const PHOTO_EXTS = new Set(["png", "jpg", "jpeg", "webp", "gif"])

function extractImageRefs(text: string): string[] {
  const refs: string[] = []
  let m: RegExpExecArray | null
  IMG_TAG.lastIndex = 0
  while ((m = IMG_TAG.exec(text)) !== null) refs.push(m[1]!.trim())
  return refs
}

function stripImageRefs(text: string): string {
  return text.replace(IMG_TAG, "").replace(/\n{3,}/g, "\n\n").trim()
}

// ── Inbound image validation ──
// Accept only PNG/JPEG, identified by MAGIC BYTES (never the client-declared
// mime, which is attacker-controllable), under a byte cap AND a pixel/dimension
// cap. Un-re-encoded documents can be decompression bombs (tiny file, gigapixel
// canvas) that the byte cap alone does not catch. Refusing to decode WebP/GIF/SVG
// is what retires the libwebp-2023-4863 and SVG-script attack classes.
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_IMAGE_PIXELS = 40_000_000
const MAX_IMAGE_DIM = 10_000

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

// ── Module State ──

let bot: Bot | null = null
let conversationStore: ConversationStore | null = null
let processing = false
let startedAt = 0
let messagesReceived = 0
let messagesResponded = 0
let lastSessionId: string | undefined
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

async function appendChatLog(userMsg: string, botMsg: string) {
  const chatLogPath = join(LOGS_DIR, "chat-log.md")
  const ts = new Date().toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  })
  const entry = `\n### ${ts}\n**{{PRINCIPAL_NAME}}:** ${userMsg}\n\n**{{DA_NAME}}:** ${botMsg}\n\n---\n`
  await appendFile(chatLogPath, entry).catch(() => {})
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

  // Initialize conversation store
  conversationStore = new ConversationStore(join(STATE_DIR, "conversations.json"))
  await conversationStore.load()

  // Create bot
  activeConfig = config
  startedAt = Date.now()
  messagesReceived = 0
  messagesResponded = 0
  processing = false
  lastSessionId = undefined

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

  // ── Inbound/outbound media helpers (closures over token / config) ──

  // Download a Telegram file (photo size or image document) to INCOMING_DIR,
  // returns the absolute local path so the SDK session can Read it.
  async function downloadIncoming(ctx: any, fileId: string): Promise<string> {
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
    // Filename from the sniffed type and a random UUID — never from the remote path.
    const dest = join(INCOMING_DIR, `${crypto.randomUUID()}.${info.kind === "jpeg" ? "jpg" : "png"}`)
    await Bun.write(dest, bytes)
    return dest
  }

  // Send one outbound image (local path or URL). Known image extensions go as a
  // photo (inline preview); anything else goes as a document to preserve fidelity.
  async function sendImage(ctx: any, ref: string): Promise<void> {
    const ext = (ref.split("?")[0]!.split(".").pop() || "").toLowerCase()
    const media: any = /^https?:\/\//i.test(ref) ? ref : new InputFile(ref)
    try {
      if (PHOTO_EXTS.has(ext)) await ctx.replyWithPhoto(media)
      else await ctx.replyWithDocument(media)
    } catch (e) {
      log("error", "Failed to send image", { ref, error: String(e) })
      await ctx.reply(`(couldn't send image: ${ref})`).catch(() => {})
    }
  }

  // Shared SDK processing — text and image messages both funnel through here.
  async function processPrompt(ctx: any, opts: { userLog: string; newMessage: string }): Promise<void> {
    const chatId = ctx.chat.id

    // Sequential processing — one message at a time
    if (processing) {
      await ctx.reply("Still processing your previous message. Please wait.")
      return
    }

    processing = true
    const startTime = Date.now()

    try {
      // Typing indicator
      await ctx.api.sendChatAction(chatId, "typing").catch(() => {})

      // Build prompt with conversation history context
      const history = conversationStore!.getHistory()
      let prompt = opts.newMessage
      if (history.length > 0) {
        const historyText = history
          .slice(-10) // Last 5 exchanges for context
          .map(m => `${m.role === "user" ? "Principal" : "DA"}: ${m.content}`)
          .join("\n")
        prompt = `Previous conversation:\n${historyText}\n\nPrincipal's new message: ${opts.newMessage}`
      }

      const sdkOptions: Record<string, unknown> = {
        cwd: CWD,
        tools: { type: "preset", preset: "claude_code" },
        settingSources: ["user", "project"],  // NO "local" — skip CLAUDE.md to avoid Algorithm/format/voice curls
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
- IMAGES IN: when {{PRINCIPAL_NAME}} sends a photo it is saved locally and the path is in his message — use the Read tool to view it before responding.
- IMAGES OUT: to send him an image, put a line [[IMG:/absolute/path]] (or [[IMG:https://url]]) anywhere in your reply. The bridge delivers it as a photo and strips the tag from your text. Create or save the file to an absolute path first (e.g. under /tmp or MEMORY/WORK), then reference that path.
- When doing tasks, do them and confirm briefly what you did`,
        },
      }

      // Resume previous session for context continuity
      if (lastSessionId) {
        sdkOptions.resume = lastSessionId
      }

      const conversation = query({ prompt, options: sdkOptions as any })

      // Collect response with timeout
      let fullText = ""
      let messageId: number | null = null
      let lastEditTime = 0

      const timeoutController = new AbortController()
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

          // Live edit updates in Telegram (image tags hidden from the live view)
          const now = Date.now()
          const display = stripImageRefs(fullText)
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
      } finally {
        clearTimeout(timeout)
      }

      if (!fullText) {
        fullText = "Sorry, I wasn't able to generate a response. Try again?"
        log("error", "Empty response from SDK")
      }

      // Separate outbound images from the text body
      const imageRefs = extractImageRefs(fullText)
      const cleanText = stripImageRefs(fullText)

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
            for (const chunk of chunks.slice(1)) await ctx.reply(chunk)
          } else {
            for (const chunk of chunks) await ctx.reply(chunk)
          }
        }
      } else if (messageId) {
        // Image-only reply — drop the empty streaming placeholder
        await ctx.api.deleteMessage(chatId, messageId).catch(() => {})
      }

      // Deliver any images
      for (const ref of imageRefs) await sendImage(ctx, ref)

      messagesResponded++
      log("info", "Response sent", {
        durationMs: Date.now() - startTime,
        responseLength: cleanText.length,
        images: imageRefs.length,
      })

      // Persist conversation
      await conversationStore!.addExchange(opts.userLog, fullText)
      await appendChatLog(opts.userLog, cleanText || `[sent ${imageRefs.length} image(s)]`)

    } catch (err) {
      log("error", "Message processing failed", { error: String(err) })
      await ctx.reply("Something went wrong processing your message. Try again?").catch(() => {})
    } finally {
      processing = false
    }
  }

  // ── Handlers ──

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text
    messagesReceived++
    log("info", "Message received", { userId: ctx.from.id, chatId: ctx.chat.id, textLength: text.length })

    const sanitized = sanitize(text)
    if (!sanitized) return

    const injection = analyzeForInjection(sanitized)
    if (injection.riskLevel === "CRITICAL") {
      log("warn", "Blocked CRITICAL injection attempt", { userId: ctx.from.id, patterns: injection.matchedPatterns })
      await ctx.reply("Message blocked for security reasons.")
      return
    }

    await processPrompt(ctx, { userLog: sanitized, newMessage: sanitized })
  })

  // Photos (Telegram-re-encoded JPEG) and PNG/JPEG image documents.
  // Type is decided by magic-byte sniff in downloadIncoming, not the declared mime.
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
        log("warn", "Blocked CRITICAL injection in caption", { userId: ctx.from.id })
        await ctx.reply("Message blocked for security reasons.")
        return
      }
    }

    let savedPath: string
    try {
      await ctx.api.sendChatAction(ctx.chat.id, "typing").catch(() => {})
      savedPath = await downloadIncoming(ctx, fileId)
    } catch (e) {
      const reason = String(e).replace(/^Error:\s*/, "")
      log("warn", "Inbound image rejected", { reason })
      await ctx.reply(`I can only accept PNG or JPEG images, up to 10MB and 40 megapixels. (${reason})`).catch(() => {})
      return
    }

    const newMessage = `Principal sent you an image, saved locally at: ${savedPath}\nUse the Read tool to view it, then respond.${caption ? `\nHis caption: ${caption}` : ""}`
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
