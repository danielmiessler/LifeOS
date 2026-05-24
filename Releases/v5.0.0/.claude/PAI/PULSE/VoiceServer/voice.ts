/**
 * PAI Pulse — Voice Module
 *
 * Dual-provider TTS: Supertonic (local CPU) or ElevenLabs (cloud fallback).
 * Pronunciation preprocessing, Linux desktop notifications.
 *
 * Provider selection:
 *   settings.json → daidentity.voices.provider: "supertonic" | "elevenlabs"
 *   Default: "supertonic" (local, zero cost, no quota)
 *
 * Config resolution (3-tier, ElevenLabs only):
 *   1. Caller sends voice_settings in request body → use directly
 *   2. Caller sends voice_id → look up in settings.json daidentity.voices
 *   3. Neither → use settings.json daidentity.voices.main as default
 *
 * Supertonic voice mapping:
 *   settings.json daidentity.voices.{name}.supertonicVoice: "M1"-"M5", "F1"-"F5"
 *   Default: "M1"
 */

import { spawn, execFile } from "child_process"
import { join, dirname } from "path"
import { existsSync, readFileSync, unlinkSync } from "fs"
import { log } from "../lib"

// ── Public Config Interface ──

export type VoiceProvider = "supertonic" | "elevenlabs"

export interface VoiceConfig {
  enabled: boolean
  provider?: VoiceProvider
  elevenlabs_api_key?: string
  default_voice_id?: string
  default_supertonic_voice?: string
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
  supertonicVoice?: string
  stability: number
  similarity_boost: number
  style: number
  speed: number
  use_speaker_boost: boolean
  volume: number
}

interface LoadedVoiceConfig {
  provider: VoiceProvider
  defaultVoiceId: string
  defaultSupertonicVoice: string
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
let voiceConfig: LoadedVoiceConfig = {
  provider: "supertonic",
  defaultVoiceId: "",
  defaultSupertonicVoice: "M1",
  voices: {},
  voicesByVoiceId: {},
  desktopNotifications: true,
}
let defaultVoiceId = ""
let activeProvider: VoiceProvider = "supertonic"
let initialized = false

// ── Constants ──

const VOICE_DIR = dirname(new URL(import.meta.url).pathname)
const SUPERTONIC_PYTHON = join(VOICE_DIR, ".venv", "bin", "python")
const SUPERTONIC_SCRIPT = join(VOICE_DIR, "supertonic-tts.py")
const VALID_SUPERTONIC_VOICES = ["M1", "M2", "M3", "M4", "M5", "F1", "F2", "F3", "F4", "F5"]

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

const EMOTIONAL_PRESETS: Record<string, EmotionalOverlay> = {
  excited:       { stability: 0.7, similarity_boost: 0.9 },
  celebration:   { stability: 0.65, similarity_boost: 0.85 },
  insight:       { stability: 0.55, similarity_boost: 0.8 },
  creative:      { stability: 0.5, similarity_boost: 0.75 },
  success:       { stability: 0.6, similarity_boost: 0.8 },
  progress:      { stability: 0.55, similarity_boost: 0.75 },
  investigating: { stability: 0.6, similarity_boost: 0.85 },
  debugging:     { stability: 0.55, similarity_boost: 0.8 },
  learning:      { stability: 0.5, similarity_boost: 0.75 },
  pondering:     { stability: 0.65, similarity_boost: 0.8 },
  focused:       { stability: 0.7, similarity_boost: 0.85 },
  caution:       { stability: 0.4, similarity_boost: 0.6 },
  urgent:        { stability: 0.3, similarity_boost: 0.9 },
}

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
  const paiDir = join(process.env.HOME ?? "~", ".claude", "PAI")
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

function loadVoiceConfigFromSettings(): LoadedVoiceConfig {
  const settingsPath = join(process.env.HOME ?? "~", ".claude", "settings.json")

  try {
    if (!existsSync(settingsPath)) {
      log("warn", "Voice: settings.json not found — using fallback voice defaults")
      return {
        provider: "supertonic",
        defaultVoiceId: "",
        defaultSupertonicVoice: "M1",
        voices: {},
        voicesByVoiceId: {},
        desktopNotifications: true,
      }
    }

    const content = readFileSync(settingsPath, "utf-8")
    const settings = JSON.parse(content)
    const daidentity = settings.daidentity || {}
    const voicesSection = daidentity.voices || {}
    const desktopNotifications = settings.notifications?.desktop?.enabled !== false

    const provider = (voicesSection.provider || "supertonic") as VoiceProvider

    const voices: Record<string, VoiceEntry> = {}
    const voicesByVoiceId: Record<string, VoiceEntry> = {}

    for (const [name, config] of Object.entries(voicesSection)) {
      if (name === "provider") continue
      const entry = config as Record<string, unknown>
      const vid = (entry.voiceId || entry.VOICE_ID || entry.voice_id || "") as string
      const supertonicVoice = (entry.supertonicVoice || entry.supertonic_voice || "M1") as string

      const voiceEntry: VoiceEntry = {
        voiceId: vid,
        voiceName: (entry.voiceName || entry.VOICE_NAME || entry.voice_name) as string | undefined,
        supertonicVoice,
        stability: (entry.stability ?? entry.STABILITY ?? 0.5) as number,
        similarity_boost: (entry.similarity_boost ?? entry.SIMILARITY_BOOST ?? entry.similarityBoost ?? 0.75) as number,
        style: (entry.style ?? entry.STYLE ?? 0.0) as number,
        speed: (entry.speed ?? entry.SPEED ?? 1.0) as number,
        use_speaker_boost: (entry.use_speaker_boost ?? entry.USE_SPEAKER_BOOST ?? entry.useSpeakerBoost ?? true) as boolean,
        volume: (entry.volume ?? entry.VOLUME ?? 1.0) as number,
      }
      voices[name.toLowerCase()] = voiceEntry
      if (vid) voicesByVoiceId[vid] = voiceEntry
    }

    const resolvedDefaultVoiceId = voices.main?.voiceId || (daidentity.mainDAVoiceID as string) || ""
    const resolvedDefaultSupertonicVoice = voices.main?.supertonicVoice || "M1"

    log("info", `Voice: loaded ${Object.keys(voices).length} voice config(s) from settings.json`, {
      provider,
      voices: Object.keys(voices),
    })

    return {
      provider,
      defaultVoiceId: resolvedDefaultVoiceId,
      defaultSupertonicVoice: resolvedDefaultSupertonicVoice,
      voices,
      voicesByVoiceId,
      desktopNotifications,
    }
  } catch (error) {
    log("error", "Voice: failed to load settings.json voice config", { error: String(error) })
    return {
      provider: "supertonic",
      defaultVoiceId: "",
      defaultSupertonicVoice: "M1",
      voices: {},
      voicesByVoiceId: {},
      desktopNotifications: true,
    }
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

// ── Supertonic Local TTS ──

function resolveSupertonicVoice(voiceId: string | null): string {
  if (voiceId) {
    const entry = voiceConfig.voicesByVoiceId[voiceId] || voiceConfig.voices[voiceId.toLowerCase()]
    if (entry?.supertonicVoice && VALID_SUPERTONIC_VOICES.includes(entry.supertonicVoice)) {
      return entry.supertonicVoice
    }
    if (VALID_SUPERTONIC_VOICES.includes(voiceId.toUpperCase())) {
      return voiceId.toUpperCase()
    }
  }

  return voiceConfig.defaultSupertonicVoice || "M1"
}

async function generateSpeechLocal(text: string, voice: string): Promise<string> {
  const pronouncedText = applyPronunciations(text)
  if (pronouncedText !== text) {
    log("info", `Voice pronunciation: "${text}" -> "${pronouncedText}"`)
  }

  const outputPath = `/tmp/voice-${Date.now()}.wav`

  return new Promise<string>((resolve, reject) => {
    execFile(
      SUPERTONIC_PYTHON,
      [SUPERTONIC_SCRIPT, "--text", pronouncedText, "--voice", voice, "--lang", "en", "--output", outputPath],
      { timeout: 30_000 },
      (error, _stdout, stderr) => {
        if (error) {
          log("error", "Voice: Supertonic synthesis failed", { error: String(error), stderr })
          reject(new Error(`Supertonic TTS failed: ${error.message}`))
          return
        }
        if (!existsSync(outputPath)) {
          reject(new Error("Supertonic TTS produced no output file"))
          return
        }
        resolve(outputPath)
      },
    )
  })
}

// ── ElevenLabs Cloud TTS ──

async function generateSpeechCloud(
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

function findAudioPlayer(): { cmd: string; argsForFile: (file: string, volume: number) => string[] } {
  if (existsSync("/usr/bin/paplay")) {
    return {
      cmd: "/usr/bin/paplay",
      argsForFile: (file, volume) => [`--volume=${Math.round(volume * 65536)}`, file],
    }
  }
  if (existsSync("/usr/bin/ffplay")) {
    return {
      cmd: "/usr/bin/ffplay",
      argsForFile: (file, volume) => ["-nodisp", "-autoexit", "-volume", String(Math.round(volume * 100)), file],
    }
  }
  if (existsSync("/usr/bin/afplay")) {
    return {
      cmd: "/usr/bin/afplay",
      argsForFile: (file, volume) => ["-v", volume.toString(), file],
    }
  }
  throw new Error("No audio player found (tried paplay, ffplay, afplay)")
}

async function playAudioFile(filePath: string, volume: number = FALLBACK_VOLUME): Promise<void> {
  const player = findAudioPlayer()

  return new Promise((resolve, reject) => {
    const args = player.argsForFile(filePath, volume)
    const proc = spawn(player.cmd, args)

    proc.on("error", (error) => {
      log("error", "Voice: error playing audio", { error: String(error), player: player.cmd })
      reject(error)
    })

    proc.on("exit", (code) => {
      try { unlinkSync(filePath) } catch { /* already cleaned up */ }
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${player.cmd} exited with code ${code}`))
      }
    })
  })
}

async function playAudioBuffer(audioBuffer: ArrayBuffer, volume: number = FALLBACK_VOLUME): Promise<void> {
  const tempFile = `/tmp/voice-${Date.now()}.mp3`
  await Bun.write(tempFile, audioBuffer)
  return playAudioFile(tempFile, volume)
}

// ── Desktop Notification ──

async function showDesktopNotification(title: string, message: string): Promise<void> {
  if (!voiceConfig.desktopNotifications) return

  try {
    if (existsSync("/usr/bin/notify-send")) {
      await new Promise<void>((resolve, reject) => {
        execFile("/usr/bin/notify-send", [title, message, "-t", "5000"], (error) => {
          if (error) reject(error)
          else resolve()
        })
      })
    } else if (existsSync("/usr/bin/osascript")) {
      const escaped = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
      const script = `display notification "${escaped(message)}" with title "${escaped(title)}" sound name ""`
      await new Promise<void>((resolve, reject) => {
        const proc = spawn("/usr/bin/osascript", ["-e", script])
        proc.on("error", reject)
        proc.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`osascript exited ${code}`))))
      })
    }
  } catch (error) {
    log("error", "Voice: notification display error", { error: String(error) })
  }
}

// ── Core: Send Notification ──

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

  if (voiceEnabled) {
    try {
      if (activeProvider === "supertonic") {
        const supertonicVoice = resolveSupertonicVoice(voiceId)
        const resolvedVolume = callerVolume ?? voiceConfig.voices.main?.volume ?? FALLBACK_VOLUME

        log("info", `Voice: Supertonic synthesis`, { voice: supertonicVoice, volume: resolvedVolume })

        const wavPath = await generateSpeechLocal(safeMessage, supertonicVoice)
        await playAudioFile(wavPath, resolvedVolume)
        voicePlayed = true
      } else if (activeProvider === "elevenlabs" && moduleConfig.elevenlabs_api_key) {
        const voice = voiceId || defaultVoiceId

        let resolvedSettings: ElevenLabsVoiceSettings
        let resolvedVolume: number

        if (callerVoiceSettings && Object.keys(callerVoiceSettings).length > 0) {
          resolvedSettings = {
            stability: callerVoiceSettings.stability ?? FALLBACK_VOICE_SETTINGS.stability,
            similarity_boost: callerVoiceSettings.similarity_boost ?? FALLBACK_VOICE_SETTINGS.similarity_boost,
            style: callerVoiceSettings.style ?? FALLBACK_VOICE_SETTINGS.style,
            speed: callerVoiceSettings.speed ?? FALLBACK_VOICE_SETTINGS.speed,
            use_speaker_boost: callerVoiceSettings.use_speaker_boost ?? FALLBACK_VOICE_SETTINGS.use_speaker_boost,
          }
          resolvedVolume = callerVolume ?? FALLBACK_VOLUME
        } else {
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
          } else {
            resolvedSettings = { ...FALLBACK_VOICE_SETTINGS }
            resolvedVolume = callerVolume ?? FALLBACK_VOLUME
          }
        }

        if (emotion && EMOTIONAL_PRESETS[emotion]) {
          resolvedSettings = {
            ...resolvedSettings,
            stability: EMOTIONAL_PRESETS[emotion].stability,
            similarity_boost: EMOTIONAL_PRESETS[emotion].similarity_boost,
          }
        }

        const audioBuffer = await generateSpeechCloud(safeMessage, voice, resolvedSettings)
        await playAudioBuffer(audioBuffer, resolvedVolume)
        voicePlayed = true
      } else {
        voiceError = `Provider "${activeProvider}" not available`
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      log("error", "Voice: failed to generate/play speech", { error: msg, provider: activeProvider })
      voiceError = msg
    }
  }

  await showDesktopNotification(safeTitle, safeMessage)

  return { voicePlayed, voiceError }
}

// ── JSON Helpers ──

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

export function startVoice(config: VoiceConfig): void {
  if (!config.elevenlabs_api_key && process.env.ELEVENLABS_API_KEY) {
    config.elevenlabs_api_key = process.env.ELEVENLABS_API_KEY
  }
  moduleConfig = config

  if (!config.enabled) {
    log("info", "Voice module: disabled")
    return
  }

  loadPronunciations(config.pronunciations_path)
  voiceConfig = loadVoiceConfigFromSettings()

  activeProvider = config.provider || voiceConfig.provider || "supertonic"

  if (activeProvider === "supertonic") {
    if (!existsSync(SUPERTONIC_PYTHON) || !existsSync(SUPERTONIC_SCRIPT)) {
      log("warn", "Voice: Supertonic not installed — falling back to elevenlabs")
      activeProvider = "elevenlabs"
    }
  }

  if (activeProvider === "elevenlabs" && !config.elevenlabs_api_key) {
    log("warn", "Voice module: ELEVENLABS_API_KEY not set — voice will be silent")
  }

  defaultVoiceId = config.default_voice_id || voiceConfig.defaultVoiceId || "21m00Tcm4TlvDq8ikWAM"

  initialized = true
  log("info", "Voice module: initialized", {
    provider: activeProvider,
    defaultVoiceId: activeProvider === "elevenlabs" ? defaultVoiceId : undefined,
    defaultSupertonicVoice: activeProvider === "supertonic" ? voiceConfig.defaultSupertonicVoice : undefined,
    pronunciationRules: pronunciationRules.length,
    configuredVoices: Object.keys(voiceConfig.voices),
  })
}

export function voiceHealth(): Record<string, unknown> {
  return {
    initialized,
    enabled: moduleConfig.enabled,
    provider: activeProvider,
    voice_system: activeProvider === "supertonic" ? "Supertonic (local CPU)" : "ElevenLabs (cloud)",
    supertonic_available: existsSync(SUPERTONIC_PYTHON) && existsSync(SUPERTONIC_SCRIPT),
    default_supertonic_voice: voiceConfig.defaultSupertonicVoice,
    default_voice_id: defaultVoiceId,
    api_key_configured: !!moduleConfig.elevenlabs_api_key,
    pronunciation_rules: pronunciationRules.length,
    configured_voices: Object.keys(voiceConfig.voices),
    desktop_notifications: voiceConfig.desktopNotifications,
  }
}

// ── Phase Capture: REMOVED ──
// ISA frontmatter is the SINGLE source of truth: AI edits ISA `phase:` →
// ISASync syncs to work.json AND calls setPhaseTab. Voice is audio-only.

export async function handleVoiceRequest(req: Request): Promise<Response | null> {
  const url = new URL(req.url)
  const pathname = url.pathname

  if (req.method === "OPTIONS" && ["/notify", "/notify/personality", "/pai", "/voice/health"].includes(pathname)) {
    return new Response(null, { headers: CORS_HEADERS, status: 204 })
  }

  const clientIp = req.headers.get("x-forwarded-for") || "localhost"

  if (pathname === "/voice/health" && req.method === "GET") {
    return jsonResponse(voiceHealth(), 200)
  }

  if (req.method !== "POST") return null

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
        provider: activeProvider,
      })

      const result = await sendNotification(title, message, voiceEnabled, voiceId, voiceSettings, volume)

      if (voiceEnabled && !result.voicePlayed && result.voiceError) {
        return jsonResponse({ status: "error", message: `TTS failed: ${result.voiceError}`, notification_sent: true }, 502)
      }

      return jsonResponse({ status: "success", message: "Notification sent", provider: activeProvider }, 200)
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      log("error", "Voice: notification error", { error: msg })
      return jsonResponse({ status: "error", message: msg }, errorStatus(msg))
    }
  }

  // POST /notify/personality
  if (pathname === "/notify/personality") {
    try {
      const data = await req.json()
      const message = data.message || "Notification"

      let voiceId: string | null = null
      try {
        const settingsFile = join(process.env.HOME ?? "~", ".claude", "settings.json")
        const settings = JSON.parse(readFileSync(settingsFile, "utf-8"))
        const main = settings?.daidentity?.voices?.main
        const vid = (main?.voiceId || main?.VOICE_ID || main?.voice_id) as string | undefined
        if (vid) voiceId = vid
      } catch {
        // Fall through
      }

      log("info", `Voice: personality notification "${message}"`, { voiceId, provider: activeProvider })
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

  return null
}
