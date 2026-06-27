/**
 * PAI Pulse — Voice Module
 *
 * ElevenLabs TTS, macOS notifications, pronunciation preprocessing.
 * Absorbed from VoiceServer/server.ts into a Pulse-embeddable module.
 *
 * Config resolution (3-tier):
 *   1. Caller sends voice_settings in request body → use directly (pass-through)
 *   2. Caller sends voice_id → look up in settings.json daidentity.voices → use those settings
 *   3. Neither → use settings.json daidentity.voices.main as default
 *
 * Does NOT create its own HTTP server. Exports handleVoiceRequest() for the
 * parent pulse.ts to call on matching routes.
 */

import { spawn } from "child_process"
import { join } from "path"
import { existsSync, readFileSync } from "fs"
import { log } from "../lib"
import { getHarnessHome, getPaiDir } from "../../TOOLS/lib/runtime-paths"

// ── Public Config Interface ──

export interface VoiceConfig {
  enabled: boolean
  elevenlabs_api_key?: string
  default_voice_id?: string
  pronunciations_path?: string
}

// ── Internal Types ──

interface ElevenLabsVoiceSettings {
  stability: number
  similarity_boost: number
  style?: number
  speed?: number
  use_speaker_boost?: boolean
}

interface VoiceEntry {
  voiceId: string
  voiceName?: string
  stability: number
  similarity_boost: number
  style: number
  speed: number
  use_speaker_boost: boolean
  volume: number
}

interface LoadedVoiceConfig {
  defaultVoiceId: string
  voices: Record<string, VoiceEntry>
  voicesByVoiceId: Record<string, VoiceEntry>
  desktopNotifications: boolean
}

interface CompiledRule {
  regex: RegExp
  phonetic: string
}

interface EmotionalOverlay {
  stability: number
  similarity_boost: number
}

// ── Module State ──

let moduleConfig: VoiceConfig = { enabled: false }
let pronunciationRules: CompiledRule[] = []
let voiceConfig: LoadedVoiceConfig = { defaultVoiceId: "", voices: {}, voicesByVoiceId: {}, desktopNotifications: true }
let defaultVoiceId = ""
let initialized = false

// ── Constants ──

const FALLBACK_VOICE_SETTINGS: ElevenLabsVoiceSettings = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.0,
  speed: 1.0,
  use_speaker_boost: true,
}

const FALLBACK_VOLUME = 1.0

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "http://localhost",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

// 13 Emotional Presets — overlay onto resolved voice settings
const EMOTIONAL_PRESETS: Record<string, EmotionalOverlay> = {
  // High Energy / Positive
  excited:     { stability: 0.7, similarity_boost: 0.9 },
  celebration: { stability: 0.65, similarity_boost: 0.85 },
  insight:     { stability: 0.55, similarity_boost: 0.8 },
  creative:    { stability: 0.5, similarity_boost: 0.75 },

  // Success / Achievement
  success:  { stability: 0.6, similarity_boost: 0.8 },
  progress: { stability: 0.55, similarity_boost: 0.75 },

  // Analysis / Investigation
  investigating: { stability: 0.6, similarity_boost: 0.85 },
  debugging:     { stability: 0.55, similarity_boost: 0.8 },
  learning:      { stability: 0.5, similarity_boost: 0.75 },

  // Thoughtful / Careful
  pondering: { stability: 0.65, similarity_boost: 0.8 },
  focused:   { stability: 0.7, similarity_boost: 0.85 },
  caution:   { stability: 0.4, similarity_boost: 0.6 },

  // Urgent / Critical
  urgent: { stability: 0.3, similarity_boost: 0.9 },
}

// Emoji → emotion mapping for marker extraction
const EMOJI_TO_EMOTION: Record<string, string> = {
  "\u{1F4A5}": "excited",
  "\u{1F389}": "celebration",
  "\u{1F4A1}": "insight",
  "\u{1F3A8}": "creative",
  "\u{2728}": "success",
  "\u{1F4C8}": "progress",
  "\u{1F50D}": "investigating",
  "\u{1F41B}": "debugging",
  "\u{1F4DA}": "learning",
  "\u{1F914}": "pondering",
  "\u{1F3AF}": "focused",
  "\u{26A0}\u{FE0F}": "caution",
  "\u{1F6A8}": "urgent",
}

// ── Rate Limiting ──

const requestCounts = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT = 10
const RATE_WINDOW = 60_000

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const record = requestCounts.get(ip)

  if (!record || now > record.resetTime) {
    requestCounts.set(ip, { count: 1, resetTime: now + RATE_WINDOW })
    return true
  }

  if (record.count >= RATE_LIMIT) return false

  record.count++
  return true
}

// ── Pronunciation System ──

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function loadPronunciations(customPath?: string): void {
  const paiDir = getPaiDir(import.meta.dir)
  const userPronPath = customPath ?? join(paiDir, "USER", "pronunciations.json")

  try {
    if (existsSync(userPronPath)) {
      const content = readFileSync(userPronPath, "utf-8")
      const flat: Record<string, string> = JSON.parse(content)

      pronunciationRules = Object.entries(flat).map(([term, phonetic]) => ({
        regex: new RegExp(`\\b${escapeRegex(term)}\\b`, "g"),
        phonetic,
      }))

      log("info", `Voice: loaded ${pronunciationRules.length} pronunciation rules from ${userPronPath}`)
    } else {
      log("warn", "Voice: no pronunciations.json found — TTS will use default pronunciations")
    }
  } catch (error) {
    log("error", "Voice: failed to load pronunciations", { error: String(error) })
  }
}

function applyPronunciations(text: string): string {
  let result = text
  for (const rule of pronunciationRules) {
    result = result.replace(rule.regex, rule.phonetic)
  }
  return result
}

// ── Voice Config from settings.json ──

function getSettingsPath(): string {
  const paiSettingsPath = join(getPaiDir(import.meta.dir), "settings.json")
  return existsSync(paiSettingsPath) ? paiSettingsPath : join(getHarnessHome(), "settings.json")
}

function loadVoiceConfigFromSettings(): LoadedVoiceConfig {
  const settingsPath = getSettingsPath()

  try {
    if (!existsSync(settingsPath)) {
      log("warn", "Voice: settings.json not found — using fallback voice defaults")
      return { defaultVoiceId: "", voices: {}, voicesByVoiceId: {}, desktopNotifications: true }
    }

    const content = readFileSync(settingsPath, "utf-8")
    const settings = JSON.parse(content)
    const daidentity = settings.daidentity || {}
    const voicesSection = daidentity.voices || {}
    const desktopNotifications = settings.notifications?.desktop?.enabled !== false

    const voices: Record<string, VoiceEntry> = {}
    const voicesByVoiceId: Record<string, VoiceEntry> = {}

    for (const [name, config] of Object.entries(voicesSection)) {
      const entry = config as Record<string, unknown>
      const vid = (entry.voiceId || entry.VOICE_ID || entry.voice_id) as string | undefined
      if (vid) {
        const voiceEntry: VoiceEntry = {
          voiceId: vid,
          voiceName: (entry.voiceName || entry.VOICE_NAME || entry.voice_name) as string | undefined,
          stability: (entry.stability ?? entry.STABILITY ?? 0.5) as number,
          similarity_boost: (entry.similarity_boost ?? entry.SIMILARITY_BOOST ?? entry.similarityBoost ?? 0.75) as number,
          style: (entry.style ?? entry.STYLE ?? 0.0) as number,
          speed: (entry.speed ?? entry.SPEED ?? 1.0) as number,
          use_speaker_boost: (entry.use_speaker_boost ?? entry.USE_SPEAKER_BOOST ?? entry.useSpeakerBoost ?? true) as boolean,
          volume: (entry.volume ?? entry.VOLUME ?? 1.0) as number,
        }
        voices[name.toLowerCase()] = voiceEntry
        voicesByVoiceId[vid] = voiceEntry
      }
    }

    const resolvedDefaultVoiceId = voices.main?.voiceId || (daidentity.mainDAVoiceID as string) || ""

    log("info", `Voice: loaded ${Object.keys(voices).length} voice config(s) from settings.json`, {
      voices: Object.keys(voices),
    })

    return { defaultVoiceId: resolvedDefaultVoiceId, voices, voicesByVoiceId, desktopNotifications }
  } catch (error) {
    log("error", "Voice: failed to load settings.json voice config", { error: String(error) })
    return { defaultVoiceId: "", voices: {}, voicesByVoiceId: {}, desktopNotifications: true }
  }
}

// ── Input Sanitization ──

function sanitizeForSpeech(input: string): string {
  return input
    .replace(/<script/gi, "")
    .replace(/\.\.\//g, "")
    .replace(/[;&|><`$\\]/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/#{1,6}\s+/g, "")
    .trim()
    .substring(0, 500)
}

function validateInput(input: unknown): { valid: boolean; error?: string; sanitized?: string } {
  if (!input || typeof input !== "string") {
    return { valid: false, error: "Invalid input type" }
  }

  if (input.length > 500) {
    return { valid: false, error: "Message too long (max 500 characters)" }
  }

  const sanitized = sanitizeForSpeech(input)

  if (!sanitized || sanitized.length === 0) {
    return { valid: false, error: "Message contains no valid content after sanitization" }
  }

  return { valid: true, sanitized }
}

// ── Emotional Marker Extraction ──

function extractEmotionalMarker(message: string): { cleaned: string; emotion?: string } {
  const emotionMatch = message.match(
    /\[(\u{1F4A5}|\u{1F389}|\u{1F4A1}|\u{1F3A8}|\u{2728}|\u{1F4C8}|\u{1F50D}|\u{1F41B}|\u{1F4DA}|\u{1F914}|\u{1F3AF}|\u{26A0}\u{FE0F}|\u{1F6A8})\s+(\w+)\]/u,
  )

  if (emotionMatch) {
    const emoji = emotionMatch[1]
    const emotionName = emotionMatch[2].toLowerCase()

    if (EMOJI_TO_EMOTION[emoji] === emotionName) {
      return {
        cleaned: message.replace(emotionMatch[0], "").trim(),
        emotion: emotionName,
      }
    }
  }

  return { cleaned: message }
}

// ── AppleScript Escaping ──

function escapeForAppleScript(input: string): string {
  return input.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

// ── TTS Generation ──

async function generateSpeech(
  text: string,
  voiceId: string,
  voiceSettings: ElevenLabsVoiceSettings,
): Promise<ArrayBuffer> {
  const apiKey = moduleConfig.elevenlabs_api_key
  if (!apiKey) throw new Error("ElevenLabs API key not configured")

  const pronouncedText = applyPronunciations(text)
  if (pronouncedText !== text) {
    log("info", `Voice pronunciation: "${text}" -> "${pronouncedText}"`)
  }

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "audio/mpeg",
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      text: pronouncedText,
      model_id: "eleven_turbo_v2_5",
      voice_settings: voiceSettings,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`)
  }

  return await response.arrayBuffer()
}

// ── Audio Playback ──

async function playAudio(audioBuffer: ArrayBuffer, volume: number = FALLBACK_VOLUME): Promise<void> {
  const tempFile = `/tmp/voice-${Date.now()}.mp3`

  await Bun.write(tempFile, audioBuffer)

  return new Promise((resolve, reject) => {
    const proc = spawn("/usr/bin/afplay", ["-v", volume.toString(), tempFile])

    proc.on("error", (error) => {
      log("error", "Voice: error playing audio", { error: String(error) })
      reject(error)
    })

    proc.on("exit", (code) => {
      spawn("/bin/rm", [tempFile])
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`afplay exited with code ${code}`))
      }
    })
  })
}

// ── macOS Desktop Notification ──

async function showDesktopNotification(title: string, message: string): Promise<void> {
  if (!voiceConfig.desktopNotifications) return

  try {
    const escapedTitle = escapeForAppleScript(title)
    const escapedMessage = escapeForAppleScript(message)
    const script = `display notification "${escapedMessage}" with title "${escapedTitle}" sound name ""`

    await new Promise<void>((resolve, reject) => {
      const proc = spawn("/usr/bin/osascript", ["-e", script])
      proc.on("error", reject)
      proc.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`osascript exited ${code}`))))
    })
  } catch (error) {
    log("error", "Voice: notification display error", { error: String(error) })
  }
}

// ── Core: Send Notification with 3-Tier Voice Settings Resolution ──

async function sendNotification(
  title: string,
  message: string,
  voiceEnabled = true,
  voiceId: string | null = null,
  callerVoiceSettings?: Partial<ElevenLabsVoiceSettings> | null,
  callerVolume?: number | null,
): Promise<{ voicePlayed: boolean; voiceError?: string }> {
  const titleValidation = validateInput(title)
  const messageValidation = validateInput(message)

  if (!titleValidation.valid) throw new Error(`Invalid title: ${titleValidation.error}`)
  if (!messageValidation.valid) throw new Error(`Invalid message: ${messageValidation.error}`)

  const safeTitle = titleValidation.sanitized!
  let safeMessage = messageValidation.sanitized!

  const { cleaned, emotion } = extractEmotionalMarker(safeMessage)
  safeMessage = cleaned

  let voicePlayed = false
  let voiceError: string | undefined

  if (voiceEnabled && moduleConfig.elevenlabs_api_key) {
    try {
      const voice = voiceId || defaultVoiceId

      // 3-tier voice settings resolution
      let resolvedSettings: ElevenLabsVoiceSettings
      let resolvedVolume: number

      if (callerVoiceSettings && Object.keys(callerVoiceSettings).length > 0) {
        // Tier 1: Caller provided explicit voice_settings
        resolvedSettings = {
          stability: callerVoiceSettings.stability ?? FALLBACK_VOICE_SETTINGS.stability,
          similarity_boost: callerVoiceSettings.similarity_boost ?? FALLBACK_VOICE_SETTINGS.similarity_boost,
          style: callerVoiceSettings.style ?? FALLBACK_VOICE_SETTINGS.style,
          speed: callerVoiceSettings.speed ?? FALLBACK_VOICE_SETTINGS.speed,
          use_speaker_boost: callerVoiceSettings.use_speaker_boost ?? FALLBACK_VOICE_SETTINGS.use_speaker_boost,
        }
        resolvedVolume = callerVolume ?? FALLBACK_VOLUME
        log("info", "Voice settings: pass-through from caller")
      } else {
        // Tier 2/3: Look up by voiceId, fall back to main
        const voiceEntry = voiceConfig.voicesByVoiceId[voice] || voiceConfig.voices.main
        if (voiceEntry) {
          resolvedSettings = {
            stability: voiceEntry.stability,
            similarity_boost: voiceEntry.similarity_boost,
            style: voiceEntry.style,
            speed: voiceEntry.speed,
            use_speaker_boost: voiceEntry.use_speaker_boost,
          }
          resolvedVolume = callerVolume ?? voiceEntry.volume ?? FALLBACK_VOLUME
          log("info", `Voice settings: from settings.json (${voiceEntry.voiceName || voice})`)
        } else {
          resolvedSettings = { ...FALLBACK_VOICE_SETTINGS }
          resolvedVolume = callerVolume ?? FALLBACK_VOLUME
          log("warn", `Voice settings: fallback defaults (no config found for ${voice})`)
        }
      }

      // Emotional preset overlay — modifies stability + similarity_boost only
      if (emotion && EMOTIONAL_PRESETS[emotion]) {
        resolvedSettings = {
          ...resolvedSettings,
          stability: EMOTIONAL_PRESETS[emotion].stability,
          similarity_boost: EMOTIONAL_PRESETS[emotion].similarity_boost,
        }
        log("info", `Voice emotion overlay: ${emotion}`)
      }

      log("info", `Voice: generating speech`, {
        voiceId: voice,
        speed: resolvedSettings.speed,
        stability: resolvedSettings.stability,
        boost: resolvedSettings.similarity_boost,
        style: resolvedSettings.style,
        volume: resolvedVolume,
      })

      const audioBuffer = await generateSpeech(safeMessage, voice, resolvedSettings)
      await playAudio(audioBuffer, resolvedVolume)
      voicePlayed = true
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      log("error", "Voice: failed to generate/play speech", { error: msg })
      voiceError = msg
    }
  }

  // macOS desktop notification
  await showDesktopNotification(safeTitle, safeMessage)

  return { voicePlayed, voiceError }
}

// ── JSON Error Response Helper ──

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    status,
  })
}

function errorStatus(message: string): number {
  return message.includes("Invalid") ? 400 : 500
}

// ── Public API ──

/**
 * Initialize the voice module. Call once at startup before handling requests.
 */
export function startVoice(config: VoiceConfig): void {
  // Resolve API key: config → env
  if (!config.elevenlabs_api_key && process.env.ELEVENLABS_API_KEY) {
    config.elevenlabs_api_key = process.env.ELEVENLABS_API_KEY
  }
  moduleConfig = config

  if (!config.enabled) {
    log("info", "Voice module: disabled")
    return
  }

  if (!config.elevenlabs_api_key) {
    log("warn", "Voice module: ELEVENLABS_API_KEY not set in config or env")
  }

  // Load pronunciation rules
  loadPronunciations(config.pronunciations_path)

  // Load voice config from settings.json
  voiceConfig = loadVoiceConfigFromSettings()

  // Resolve default voice ID: config override → settings.json → hardcoded fallback
  defaultVoiceId = config.default_voice_id || voiceConfig.defaultVoiceId || "s3TPKV1kjDlVtZbl4Ksh"

  initialized = true
  log("info", "Voice module: initialized", {
    defaultVoiceId,
    pronunciationRules: pronunciationRules.length,
    configuredVoices: Object.keys(voiceConfig.voices),
    apiKeyConfigured: !!config.elevenlabs_api_key,
  })
}

/**
 * Health check for the voice subsystem.
 */
export function voiceHealth(): Record<string, unknown> {
  return {
    initialized,
    enabled: moduleConfig.enabled,
    voice_system: "ElevenLabs",
    default_voice_id: defaultVoiceId,
    api_key_configured: !!moduleConfig.elevenlabs_api_key,
    pronunciation_rules: pronunciationRules.length,
    configured_voices: Object.keys(voiceConfig.voices),
    desktop_notifications: voiceConfig.desktopNotifications,
  }
}

// ── Phase Capture: REMOVED ──
//
// Until 2026-04-27, /notify also wrote work.json `phase` and `phaseHistory` and
// called setPhaseTab(). That was the second writer in a dual-source design with
// ISASync.hook.ts (PostToolUse Edit/Write on ISA.md). It silently skipped when
// the AI couldn't pass a resolvable session_id/slug — the dashboard then
// "stuck" on whichever phase was last successfully captured.
//
// ISA frontmatter is now the SINGLE source of truth: AI edits ISA `phase:` →
// ISASync syncs to work.json AND calls setPhaseTab. Voice is audio-only.
//
// If you're tempted to reintroduce a phase-capture path here, fix the AI's
// ISA-edit discipline instead — that's the actual signal.
/**
 * Handle an incoming HTTP request for voice routes.
 *
 * Routes:
 *   POST /notify              — main notification endpoint
 *   POST /notify/personality   — compatibility shim (Qwen3-TTS era)
 *   POST /pai                 — PAI assistant notification
 *   GET  /voice/health        — voice subsystem health
 *
 * Returns a Response for matched routes, or null if the route is not ours.
 */
export async function handleVoiceRequest(req: Request): Promise<Response | null> {
  const url = new URL(req.url)
  const pathname = url.pathname

  // CORS preflight for any of our routes
  if (req.method === "OPTIONS" && ["/notify", "/notify/personality", "/pai", "/voice/health"].includes(pathname)) {
    return new Response(null, { headers: CORS_HEADERS, status: 204 })
  }

  // Rate limit check
  const clientIp = req.headers.get("x-forwarded-for") || "localhost"

  // GET /voice/health
  if (pathname === "/voice/health" && req.method === "GET") {
    return jsonResponse(voiceHealth(), 200)
  }

  // All remaining routes are POST
  if (req.method !== "POST") return null

  // Rate limit on POST routes
  if (!checkRateLimit(clientIp)) {
    return jsonResponse({ status: "error", message: "Rate limit exceeded" }, 429)
  }

  // POST /notify
  if (pathname === "/notify") {
    try {
      const data = await req.json()
      const title = data.title || "PAI Notification"
      const message = data.message || "Task completed"
      const voiceEnabled = data.voice_enabled !== false
      const voiceId = data.voice_id || data.voice_name || null
      const voiceSettings = data.voice_settings || null
      const volume = data.volume ?? null

      if (voiceId && typeof voiceId !== "string") throw new Error("Invalid voice_id")

      log("info", `Voice: notification "${title}" - "${message}"`, {
        voiceEnabled,
        voiceId: voiceId || defaultVoiceId,
      })

      const result = await sendNotification(title, message, voiceEnabled, voiceId, voiceSettings, volume)

      if (voiceEnabled && !result.voicePlayed && result.voiceError) {
        return jsonResponse({ status: "error", message: `TTS failed: ${result.voiceError}`, notification_sent: true }, 502)
      }

      return jsonResponse({ status: "success", message: "Notification sent" }, 200)
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      log("error", "Voice: notification error", { error: msg })
      return jsonResponse({ status: "error", message: msg }, errorStatus(msg))
    }
  }

  // POST /notify/personality — compatibility shim for Qwen3-TTS callers
  if (pathname === "/notify/personality") {
    try {
      const data = await req.json()
      const message = data.message || "Notification"

      // Live-read voice ID from settings.json each call. Without this, pulse
      // uses the defaultVoiceId cached at server startup — which is stale
      // after the install wizard writes a new daidentity.voices.main.voiceId
      // (the wizard runs AFTER pulse starts, so the cache holds the public
      // template default instead of the user-picked voice). Live-read keeps
      // /notify/personality honest with whatever the user last selected.
      let voiceId: string | null = null
      try {
        const settingsFile = getSettingsPath()
        const settings = JSON.parse(readFileSync(settingsFile, "utf-8"))
        const main = settings?.daidentity?.voices?.main
        const vid = (main?.voiceId || main?.VOICE_ID || main?.voice_id) as string | undefined
        if (vid) voiceId = vid
      } catch {
        // Fall through — sendNotification will use the cached defaultVoiceId
      }

      log("info", `Voice: personality notification "${message}"`, { voiceId })
      await sendNotification("PAI Notification", message, true, voiceId)

      return jsonResponse({ status: "success", message: "Personality notification sent" }, 200)
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      log("error", "Voice: personality notification error", { error: msg })
      return jsonResponse({ status: "error", message: msg }, errorStatus(msg))
    }
  }

  // POST /voice
  if (pathname === "/voice") {
    try {
      const data = await req.json()
      const title = data.title || "PAI Assistant"
      const message = data.message || "Task completed"

      log("info", `Voice: PAI notification "${title}" - "${message}"`)
      await sendNotification(title, message, true, null)

      return jsonResponse({ status: "success", message: "PAI notification sent" }, 200)
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      log("error", "Voice: PAI notification error", { error: msg })
      return jsonResponse({ status: "error", message: msg }, errorStatus(msg))
    }
  }

  // Not our route
  return null
}
