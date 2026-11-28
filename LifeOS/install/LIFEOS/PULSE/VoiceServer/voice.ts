/**
 * LifeOS Pulse — Voice Module
 *
 * Fish Audio TTS, macOS notifications, pronunciation preprocessing.
 * Absorbed from VoiceServer/server.ts into a Pulse-embeddable module.
 *
 * Config resolution (2-tier):
 *   1. Caller sends voice_id → look up in the loaded voice table
 *   2. Neither → the `main` voice as default
 *
 * The voice table is LIFEOS_CONFIG.toml [da.voices.main] (canonical, the file
 * hooks/lib/identity.ts reads) overlaid on the legacy settings.json
 * daidentity.voices block — see loadVoiceConfig() (public issue #2052).
 *
 * Backend: Fish Audio Drama 3, the only engine (principal directive, 2026-10-24). A voice
 * speaks through its fish_reference_id with the tags {{DA_NAME}} wrote in the closer. If Fish fails, or the voice has
 * no Fish clone, the line stays silent and the error is reported; no other voice ever plays.
 *
 * Does NOT create its own HTTP server. Exports handleVoiceRequest() for the
 * parent pulse.ts to call on matching routes.
 */

import { spawn } from "child_process"
import { join } from "path"
import { existsSync, readFileSync, rmSync, writeFileSync } from "fs"
import { log } from "../lib"
import { principalPronunciations } from "../../TOOLS/Pronounce"
import { homedir } from "node:os";
import { invariant } from "../../TOOLS/Invariant"
import { loadLifeosConfig } from "../../TOOLS/LifeosConfig"
import { record as recordInterruption } from "../../TOOLS/Interruptions"
import { PAIRED_TAGS, hasVoiceTags, stripVoiceTags } from "../../TOOLS/VoiceTags"
import { fishSpeak } from "../../TOOLS/FishTTS"
import { masterVoice } from "../../TOOLS/VoiceMaster"

// $HOME first, like hooks/lib/identity.ts and Doctor.ts: Bun's os.homedir()
// reads the passwd entry and ignores $HOME, which made the module untestable
// against a scratch home (voice.test.ts, 2026-09-03). Same value on every real
// install, where launchd and the shell both set HOME.
const HOME = process.env.HOME ?? process.env.USERPROFILE ?? homedir()

// ── Public Config Interface ──

export interface VoiceConfig {
  enabled: boolean
  fish_api_key?: string
  default_voice_id?: string
  pronunciations_path?: string
}

// ── Internal Types ──

interface VoiceEntry {
  voiceId: string
  voiceName?: string
  volume: number
  /** Fish Audio voice model; a voice without one has no clone and stays silent. */
  fishReferenceId?: string
  fishSpeed?: number
}

interface LoadedVoiceConfig {
  defaultVoiceId: string
  voices: Record<string, VoiceEntry>
  voicesByVoiceId: Record<string, VoiceEntry>
  desktopNotifications: boolean
}


// ── Module State ──

let moduleConfig: VoiceConfig = { enabled: false }
let voiceConfig: LoadedVoiceConfig = { defaultVoiceId: "", voices: {}, voicesByVoiceId: {}, desktopNotifications: true }
let defaultVoiceId = ""
let initialized = false

// ── Constants ──

const FALLBACK_VOLUME = 1.0

// Hard ceiling on a single playback; a player past this is hung, not slow.
const PLAYBACK_TIMEOUT_MS = 90_000

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "http://localhost",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

// 13 emotions → Drama 3 direction tags. An emotion marker is performed by the model as a leading tag; tags are
// free-form words Drama 3 acts out and never reads aloud.
export const EMOTION_TAGS: Record<string, string> = {
  excited: "excited",
  celebration: "cheerful",
  insight: "intrigued",
  creative: "playful",
  success: "pleased",
  progress: "upbeat",
  investigating: "curious",
  debugging: "focused",
  learning: "curious",
  pondering: "thoughtful",
  focused: "focused",
  caution: "cautious",
  urgent: "urgent",
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

// ── Mute State ──
//
// Voice mute for recordings and calls on THIS machine: audio is skipped on its speakers, desktop
// notifications still show. It does not silence a remote VoiceReceiver sink: when the principal is
// attached from another machine that runs a receiver, the voice follows him there (Fish voice ISA F5,
// pinned by voicemode.test.ts). File-backed so a Pulse restart mid-recording
// can't un-mute; live-read per call so toggles apply instantly. Toggled by
// the menu row and the Hammerspoon Ctrl+Cmd+M hotkey via /voice/mute.

const MUTE_STATE_PATH = join(HOME, ".claude", "LIFEOS", "MEMORY", "STATE", "voice-mute.json")

function isMuted(): boolean {
  try {
    if (!existsSync(MUTE_STATE_PATH)) return false
    return JSON.parse(readFileSync(MUTE_STATE_PATH, "utf-8")).muted === true
  } catch {
    return false
  }
}

function setMuted(muted: boolean, source: string): void {
  // A non-boolean here would fail open — voice keeps playing during a recording.
  invariant(typeof muted === "boolean", `voice mute state must be boolean, got ${typeof muted}`)
  writeFileSync(MUTE_STATE_PATH, JSON.stringify({ muted, since: new Date().toISOString(), source }, null, 2))
  log("info", `Voice: ${muted ? "MUTED" : "unmuted"}`, { source })
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

// ── Pronunciation ──
// One pass for every LifeOS voice (LIFEOS/TOOLS/Pronounce.ts over PronounceCore.ts, Fish voice ISA F7): homographs,
// then PRONUNCIATIONS.json, re-read when the file changes. fishSpeak runs it on the request; this module only names the
// file (a PULSE.toml `pronunciations_path` override, else the principal's).
let pronPath = ""
const pronunciations = (): Record<string, string> => principalPronunciations(pronPath || undefined)

// ── Voice Config from settings.json ──

function loadVoiceConfigFromSettings(): LoadedVoiceConfig {
  const settingsPath = join(HOME, ".claude", "settings.json")

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
          volume: (entry.volume ?? entry.VOLUME ?? 1.0) as number,
          fishReferenceId: (entry.fishReferenceId ?? entry.fish_reference_id) as string | undefined,
          fishSpeed: (entry.fishSpeed ?? entry.fish_speed) as number | undefined,
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

// ── Voice Config: LIFEOS_CONFIG.toml is canonical, settings.json is legacy ──
//
// The public installer never writes daidentity.voices into settings.json; the
// voice a fresh install picked lives in LIFEOS_CONFIG.toml [da.voices.main],
// the same file hooks/lib/identity.ts reads. This module read only settings.json,
// so hook lines spoke the TOML voice while every /notify curl spoke the
// hard-coded premade fallback — two voices on one install. The typed loader
// exposes `main` only; other named entries still come from settings.json.
// public issue #2052, @lgertel

/**
 * The id a TOML voice is keyed by: its voice_id (a lookup key only, never sent to a vendor), or for a Fish-only
 * profile (fish_reference_id and no voice_id, ISA 20261014-lifeos-installer ISC-20) a synthetic `fish:<reference id>`.
 */
export const FISH_ONLY_PREFIX = "fish:"
export function voiceKey(v: { voiceId?: string; fishReferenceId?: string } | undefined): string | null {
  if (v?.voiceId) return v.voiceId
  return v?.fishReferenceId ? `${FISH_ONLY_PREFIX}${v.fishReferenceId}` : null
}

function tomlMainVoice(): VoiceEntry | null {
  try {
    const v = loadLifeosConfig().da.voices.main
    const key = voiceKey(v)
    if (!key) return null
    return {
      voiceId: key,
      voiceName: v.voiceName,
      volume: v.volume ?? FALLBACK_VOLUME,
      fishReferenceId: v.fishReferenceId,
      fishSpeed: v.fishSpeed,
    }
  } catch {
    return null // no TOML yet, or it fails validation — the legacy settings.json table stands
  }
}

function loadVoiceConfig(): LoadedVoiceConfig {
  const cfg = loadVoiceConfigFromSettings()
  const main = tomlMainVoice()
  if (!main) return cfg
  cfg.voices.main = main
  cfg.voicesByVoiceId[main.voiceId] = main
  cfg.defaultVoiceId = main.voiceId
  log("info", "Voice: main voice from LIFEOS_CONFIG.toml", { voiceName: main.voiceName ?? null })
  // Every other TOML voice with a Fish clone speaks on Fish too, keyed by its voice_id
  // so callers that pass that id keep working (Fish voice ISA phase 3).
  try {
    for (const [role, v] of Object.entries(loadLifeosConfig().da.voices)) {
      if (role === "main" || !v?.voiceId || !v.fishReferenceId || v.voiceId === main.voiceId) continue
      const existing = cfg.voicesByVoiceId[v.voiceId]
      cfg.voicesByVoiceId[v.voiceId] = {
        ...(existing ?? { voiceId: v.voiceId, voiceName: v.voiceName, volume: v.volume ?? FALLBACK_VOLUME }),
        fishReferenceId: v.fishReferenceId,
        fishSpeed: v.fishSpeed,
      }
    }
  } catch { /* TOML unreadable — main above already loaded or the legacy table stands */ }
  return cfg
}

// ── Input Sanitization ──

// Drama 3's seven paired tags are the only angle brackets that survive sanitizing: they are parked
// as control-character markers, every other < and > is stripped, and only known tag names come back.
const PAIRED_TAG_IN = new RegExp(`<(/?)(${PAIRED_TAGS.join("|")})>`, "g")
const PAIRED_TAG_OUT = new RegExp(`\u0001(/?)(${PAIRED_TAGS.join("|")})\u0002`, "g")

function sanitizeForSpeech(input: string): string {
  return input
    .replace(/[\u0001\u0002]/g, "")
    .replace(PAIRED_TAG_IN, "\u0001$1$2\u0002")
    .replace(/<script/gi, "")
    .replace(/\.\.\//g, "")
    .replace(/[;&|><`$\\]/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/#{1,6}\s+/g, "")
    .replace(PAIRED_TAG_OUT, "<$1$2>")
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

// ── Fish Audio (Drama 3) ──

// A Fish request that has not answered in this long is abandoned and reported.
// Measured 2026-10-14: 0.58–1.33 s per closer, so 8 s is a hang, not a slow render.
export const FISH_TIMEOUT_MS = 8_000

/** The Fish request body. An emotion marker becomes a leading direction only when {{DA_NAME}} wrote no tags. */
export function fishBody(text: string, emotion: string | undefined, referenceId: string, speed?: number): Record<string, unknown> {
  const tag = emotion ? EMOTION_TAGS[emotion] : undefined
  const performed = tag && !hasVoiceTags(text) ? `[${tag}] ${text}` : text
  return {
    text: performed,
    reference_id: referenceId,
    format: "mp3",
    latency: "normal",
    ...(speed && speed !== 1 ? { prosody: { speed } } : {}),
  }
}

/** The voice entry to speak on Fish for this voice id, or undefined when Fish is not configured for it. */
function fishVoiceFor(voiceId: string): VoiceEntry | undefined {
  if (!moduleConfig.fish_api_key) return undefined
  const entry = voiceConfig.voicesByVoiceId[voiceId] ?? (voiceId === defaultVoiceId ? voiceConfig.voices.main : undefined)
  return entry?.fishReferenceId ? entry : undefined
}

async function generateFishSpeech(text: string, entry: VoiceEntry, emotion?: string): Promise<Uint8Array> {
  invariant(!!moduleConfig.fish_api_key && !!entry.fishReferenceId, "generateFishSpeech needs a Fish key and a reference id")
  const performed = fishBody(text, emotion, entry.fishReferenceId!).text as string
  const raw = await fishSpeak(performed, {
    voice: { referenceId: entry.fishReferenceId! },
    speed: entry.fishSpeed,
    latency: "normal",
    mp3Bitrate: 192,
    timeoutMs: FISH_TIMEOUT_MS,
    pronunciationMap: pronunciations(),
    apiKey: moduleConfig.fish_api_key,
  })
  const { audio, mastered } = await masterVoice(raw)
  if (!mastered) log("warn", "Voice: mastering skipped (no ffmpeg or it failed), playing the raw Fish clip")
  return audio
}

// ── Audio Playback ──

// Platform-aware audio player resolution. macOS ships afplay; Linux has no
// single standard, so try the common CLI players in order. ffplay/mpg123 handle
// the MP3 that Fish returns; paplay/aplay are last-resort fallbacks.
// Resolved once and cached. #1412 — hardcoding afplay ENOENT'd on Linux.
interface AudioPlayer {
  path: string
  buildArgs: (file: string, volume: number) => string[]
}

// (public PR #1548, @m8ryx) `volume` is a multiplier where 1.0 is normal,
// matching afplay's -v. Each Linux player expresses volume on its own integer
// scale, so map onto that range and clamp. A non-finite or negative value falls
// back to the player's normal level rather than silencing playback.
function scaleVolume(volume: number, max: number): number {
  if (!Number.isFinite(volume) || volume < 0) return max
  return Math.min(max, Math.round(volume * max))
}

let resolvedPlayer: AudioPlayer | null | undefined = undefined

function resolveAudioPlayer(): AudioPlayer | null {
  if (resolvedPlayer !== undefined) return resolvedPlayer

  const candidates: Array<{ cmd: string; buildArgs: (file: string, volume: number) => string[] }> =
    process.platform === "darwin"
      ? [{ cmd: "afplay", buildArgs: (file, volume) => ["-v", volume.toString(), file] }]
      : [
          {
            cmd: "ffplay",
            // ffplay -h: "-volume volume  set startup volume 0=min 100=max"
            buildArgs: (file, volume) => [
              "-nodisp",
              "-autoexit",
              "-loglevel",
              "quiet",
              "-volume",
              String(scaleVolume(volume, 100)),
              file,
            ],
          },
          // mpg123 scales with -f, but its range was not verified here; left as-is
          // rather than guessing a factor.
          { cmd: "mpg123", buildArgs: (file) => ["-q", file] },
          {
            cmd: "paplay",
            // paplay --help: "--volume=VOLUME  Specify the initial (linear) volume
            // in range 0...65536"
            buildArgs: (file, volume) => [`--volume=${scaleVolume(volume, 65536)}`, file],
          },
          // aplay has no volume-set option (only --disable-softvol), so volume
          // cannot be honoured on this fallback.
          { cmd: "aplay", buildArgs: (file) => ["-q", file] },
        ]

  for (const c of candidates) {
    const path = Bun.which(c.cmd)
    if (path) {
      resolvedPlayer = { path, buildArgs: c.buildArgs }
      return resolvedPlayer
    }
  }

  resolvedPlayer = null
  return resolvedPlayer
}

// Serialize playback so concurrent /notify calls don't overlap on the speaker.
// TTS generation still runs in parallel; only the playback step is queued via a
// single promise chain. A failed task can't poison the queue. #1361.
let playbackQueue: Promise<void> = Promise.resolve()

// ── Voice mode: stop and barge-in (LIFEOS/DOCUMENTATION/VoiceMode/VoiceMode.md) ──
// playGen counts stops. A notification captures it before TTS generation starts,
// and its playback is skipped if a stop came in since, so a stop silences the
// playing clip, everything queued behind it, and any clip still generating.
let playGen = 0
let currentPlayer: ReturnType<typeof spawn> | null = null
let stoppedPlayer: ReturnType<typeof spawn> | null = null
// Talk-mic probe for interruptible clips: true while the principal has started
// dictating. Resolved per clip from LIFEOS/TOOLS/lib/MicActive.ts; tests inject one.
let talkMicProbeOverride: (() => boolean) | null = null
const TALK_MIC_POLL_MS = 40

async function resolveTalkMicProbe(): Promise<(() => boolean) | null> {
  if (talkMicProbeOverride) return talkMicProbeOverride
  try {
    const mic = await import("../../TOOLS/lib/MicActive.ts")
    const paths = await mic.talkMicPaths()
    return paths.length ? () => mic.anyRecording(paths) : null
  } catch (error: unknown) {
    log("warn", "Voice: talk-mic probe unavailable, barge-in off for this clip", { error: String(error) })
    return null
  }
}

/** Stop the playing clip and drop everything queued or generating before now. */
// ── Remote voice (Fish voice ISA F5) ──
//
// When {{PRINCIPAL_NAME}} is attached to this desktop from another machine on the tailnet or a listed LAN peer (herdr --remote
// comes in over SSH), clips play on that machine through its VoiceReceiver.ts instead of the
// desktop speakers. The receiver holds no keys or config; it only plays what is POSTed to it.
export const RECEIVER_PORT = 7790
const SINK_CACHE_MS = 10_000
let sinkCache: { at: number; url: string | null } = { at: 0, url: null }
let sinkProbe: (() => Promise<string | null>) | null = null

/** IPv4 peers with an established SSH connection into this machine, parsed from lsof (macOS) or `ss -tnH` (Linux). */
export function sshPeers(out: string): string[] {
  const peers = new Set<string>()
  for (const line of out.split("\n")) {
    const m = line.match(/->(\d{1,3}(?:\.\d{1,3}){3}):\d+/) ?? line.match(/\s\[?(?:::ffff:)?(\d{1,3}(?:\.\d{1,3}){3})\]?:\d+\s*$/)
    if (m) peers.add(m[1]!)
  }
  return [...peers]
}

function inCidr(ip: string, cidr: string): boolean {
  const [base, bitsText = "32"] = cidr.split("/")
  const bits = Number(bitsText)
  const isIpv4 = (a: string | undefined) => !!a && /^\d{1,3}(\.\d{1,3}){3}$/.test(a)
  if (!isIpv4(ip) || !isIpv4(base) || !Number.isInteger(bits) || bits < 0 || bits > 32) return false
  const toInt = (a: string) => a.split(".").reduce((n, octet) => n * 256 + Number(octet), 0)
  const mask = bits === 0 ? 0 : ~0 << (32 - bits)
  return (toInt(ip) & mask) === (toInt(base!) & mask)
}

/**
 * True when clips may be sent to a receiver at this SSH peer: the tailnet range (100.64.0.0/10, used by Tailscale and
 * NetBird) or a comma-separated IPv4/CIDR list in VOICE_RECEIVER_PEERS, for a plain LAN or another WireGuard overlay.
 * An ESTABLISHED socket on :22 is not proof of login, so list single hosts (/32) rather than a whole shared subnet.
 */
export function trustedPeer(ip: string, extra: string = process.env.VOICE_RECEIVER_PEERS ?? ""): boolean {
  return ["100.64.0.0/10", ...extra.split(",")].some((cidr) => inCidr(ip, cidr.trim()))
}

async function findSink(): Promise<string | null> {
  if (sinkProbe) return sinkProbe()
  const cmd = process.platform === "darwin"
    ? ["/usr/sbin/lsof", "-nP", "-iTCP:22", "-sTCP:ESTABLISHED"]
    : process.platform === "linux" ? ["ss", "-tnH", "state", "established", "( sport = :22 )"] : null
  if (!cmd) return null
  const p = Bun.spawnSync(cmd, { stdout: "pipe", stderr: "ignore" })
  for (const peer of sshPeers(p.stdout.toString()).filter((ip) => trustedPeer(ip))) {
    const url = `http://${peer}:${RECEIVER_PORT}`
    const ok = await fetch(`${url}/health`, { signal: AbortSignal.timeout(500) }).then((r) => r.ok).catch(() => false)
    if (ok) return url
  }
  return null
}

/** The receiver to play on right now, or null for the desktop speakers. Cached briefly. */
async function remoteSink(): Promise<string | null> {
  if (Date.now() - sinkCache.at < SINK_CACHE_MS) return sinkCache.url
  const url = await findSink().catch(() => null)
  if (url !== sinkCache.url) log("info", url ? `Voice: playing on the remote receiver at ${url}` : "Voice: playing on this machine")
  sinkCache = { at: Date.now(), url }
  return url
}

export function stopPlayback(reason: string): { stopped: boolean } {
  if (sinkCache.url) fetch(`${sinkCache.url}/stop`, { method: "POST", signal: AbortSignal.timeout(1000) }).catch(() => {})
  playGen++
  const proc = currentPlayer
  if (proc) {
    stoppedPlayer = proc
    proc.kill("SIGTERM")
  }
  log("info", `Voice: playback stopped (${reason})`, { hadPlayer: !!proc })
  return { stopped: !!proc }
}

function enqueuePlayback(task: () => Promise<void>, gen: number = playGen): Promise<void> {
  const run = () => (gen !== playGen ? Promise.resolve() : task())
  const next = playbackQueue.then(run, run)
  playbackQueue = next.catch(() => {})
  return next
}

/** Test seams only: a fake player and a fake talk-mic probe. */
export const __remoteVoiceTest = {
  // Test files share one module (and one rate window) when bun runs them together.
  resetRateLimit: () => requestCounts.clear(),
  setSinkProbe: (p: (() => Promise<string | null>) | null) => { sinkProbe = p; sinkCache = { at: 0, url: null } },
}

export const __voiceModeTest = {
  setPlayer(p: { path: string; buildArgs: (file: string, volume: number) => string[] } | null) { resolvedPlayer = p ?? undefined },
  setTalkMicProbe(p: (() => boolean) | null) { talkMicProbeOverride = p },
  enqueue: (task: () => Promise<void>, gen?: number) => enqueuePlayback(task, gen),
  playAudio: (buf: Uint8Array, opts?: { interruptible?: boolean; bypassMute?: boolean }) => playAudio(buf, 0, "wav", opts),
  gen: () => playGen,
}

// `ext` names the container the buffer holds: Fish returns MP3; the
// voice-mode test seam plays WAV. Same player, queue and watchdog either way.
async function playAudio(audioBuffer: ArrayBuffer | Uint8Array, volume: number = FALLBACK_VOLUME, ext: "mp3" | "wav" = "mp3", opts: { interruptible?: boolean; bypassMute?: boolean } = {}): Promise<void> {
  // {{PRINCIPAL_NAME}} attached from another tailnet machine with a receiver: play there. Any failure plays here instead.
  const sink = await remoteSink()
  if (sink) {
    try {
      const res = await fetch(`${sink}/play`, { method: "POST", headers: { "Content-Type": ext === "wav" ? "audio/wav" : "audio/mpeg", "X-Voice-Volume": String(volume), "X-Voice-Ext": ext }, body: audioBuffer, signal: AbortSignal.timeout(5000) })
      if (res.ok) return
      throw new Error(`receiver answered ${res.status}`)
    } catch (error) {
      sinkCache = { at: 0, url: null }
      log("warn", "Voice: remote receiver failed, playing on this machine", { sink, error: String(error) })
    }
  }
  // Mute silences this machine's speakers. A receiver can carry the voice past mute, but when it fails (or was never there)
  // the clip must not fall through to the desktop speakers of a muted machine; only the mute toggle's own confirmations pass.
  if (!opts.bypassMute && isMuted()) {
    log("info", "Voice: muted — dropping clip instead of playing on this machine")
    return
  }
  const player = resolveAudioPlayer()
  if (!player) {
    const tried = process.platform === "darwin" ? "afplay" : "ffplay/mpg123/paplay/aplay"
    log("warn", `Voice: no audio player found (tried ${tried}) on ${process.platform} — skipping playback`)
    return
  }

  // The generation this clip was dequeued under; a stop during the awaits below
  // (file write, probe resolution) must still keep it from starting.
  const gen = playGen
  const tempFile = `/tmp/voice-${Date.now()}.${ext}`
  await Bun.write(tempFile, audioBuffer)
  const probe = opts.interruptible ? await resolveTalkMicProbe() : null
  let micOpenAlready = false
  try { micOpenAlready = !!probe?.() } catch {}
  if (gen !== playGen || micOpenAlready) {
    try { rmSync(tempFile, { force: true }) } catch {}
    return
  }

  return new Promise((resolve, reject) => {
    const proc = spawn(player.path, player.buildArgs(tempFile, volume))
    currentPlayer = proc
    // Barge-in: an interruptible clip stops the moment a talk mic opens. One stop
    // per clip: the watch clears itself so a slow-dying player can't bump playGen
    // again and drop clips queued after the barge-in.
    const micWatch: ReturnType<typeof setInterval> | null = probe
      ? setInterval(() => {
          try {
            if (probe()) {
              clearInterval(micWatch!)
              stopPlayback("talk mic opened")
            }
          } catch {}
        }, TALK_MIC_POLL_MS)
      : null

    // Watchdog: a hung player must not wedge the serialized playback queue.
    // 2026-08-13 incident — one afplay froze for 9h and silently blocked every
    // voice message behind it while /voice/health stayed green. Longest real
    // messages finish well under a minute, so 90s only fires on a genuine hang.
    let timedOut = false
    const watchdog = setTimeout(() => {
      timedOut = true
      log("error", `Voice: playback exceeded ${PLAYBACK_TIMEOUT_MS}ms — killing hung player`, { player: player.path })
      proc.kill("SIGKILL")
    }, PLAYBACK_TIMEOUT_MS)

    proc.on("error", (error) => {
      clearTimeout(watchdog)
      if (micWatch) clearInterval(micWatch)
      if (currentPlayer === proc) currentPlayer = null
      log("error", "Voice: error playing audio", { error: String(error) })
      try { rmSync(tempFile, { force: true }) } catch {}
      reject(error)
    })

    proc.on("exit", (code) => {
      clearTimeout(watchdog)
      if (micWatch) clearInterval(micWatch)
      if (currentPlayer === proc) currentPlayer = null
      try { rmSync(tempFile, { force: true }) } catch {}
      if (stoppedPlayer === proc) {
        stoppedPlayer = null
        resolve()
      } else if (timedOut) {
        reject(new Error(`audio player killed after ${PLAYBACK_TIMEOUT_MS}ms hang`))
      } else if (code === 0) {
        resolve()
      } else {
        reject(new Error(`audio player exited with code ${code}`))
      }
    })
  })
}

// ── macOS Desktop Notification ──

// Warn about a missing notify-send ONCE per process: /notify fires hundreds of
// times a day and a per-call warning is journal spam (public issue #2024).
let warnedNoNotifySend = false

async function showDesktopNotification(title: string, message: string): Promise<void> {
  if (!voiceConfig.desktopNotifications) return
  if (process.platform === "linux") {
    // freedesktop notify-send, argv spawn (no shell string, so the message is
    // never interpreted). Absent binary → silent after one warning; the darwin
    // path below is untouched. public issue #2024, @MatiasBarboza
    const bin = Bun.which("notify-send")
    if (!bin) {
      if (!warnedNoNotifySend) {
        warnedNoNotifySend = true
        log("warn", "Voice: notify-send not on PATH — desktop notifications are off on this Linux host (install libnotify-bin / libnotify)")
      }
      return
    }
    try {
      await new Promise<void>((resolve, reject) => {
        const proc = spawn(bin, ["--app-name=LifeOS", "--", title, message])
        proc.on("error", reject)
        proc.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`notify-send exited ${code}`))))
      })
    } catch (error) {
      log("error", "Voice: notification display error", { error: String(error) })
    }
    return
  }
  // osascript is macOS-only; on WSL2 and anything else the spawn ENOENT's and floods journal
  if (process.platform !== "darwin") return

  try {
    const escapedTitle = escapeForAppleScript(title)
    const escapedMessage = escapeForAppleScript(message)
    // No sound clause: even an empty one makes Notification Center play the alert sound
    // (Pulse ISA ISC-6.1). The banner stays silent; the voice is the sound.
    const script = `display notification "${escapedMessage}" with title "${escapedTitle}"`

    await new Promise<void>((resolve, reject) => {
      const proc = spawn("/usr/bin/osascript", ["-e", script])
      proc.on("error", reject)
      proc.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`osascript exited ${code}`))))
    })
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
  callerVolume?: number | null,
  // Only the mute toggle's own confirmations set this — muting must audibly
  // say its last word, and unmuting must audibly confirm voice is back
  // (principal directive 2026-08-18). Never expose it to HTTP callers.
  bypassMute = false,
  // Voice mode: barge-in watch on, and the caller is answered once playback is queued.
  interruptible = false,
): Promise<{ voicePlayed: boolean; voiceError?: string }> {
  const gen = playGen
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

  // Mute silences this machine's speakers. When {{PRINCIPAL_NAME}} is attached from another machine with a receiver,
  // the voice follows him there regardless (Fish voice ISA F5).
  const muted = !bypassMute && isMuted() && !(await remoteSink())
  if (voiceEnabled && muted) {
    log("info", "Voice: muted — skipping TTS", { title: safeTitle })
  }

  // Fish is the only engine (principal directive, 2026-10-24). A failed generation stays silent
  // and reports; a voice with no Fish clone, or an install with no Fish key, is silent too: voice off, not a fault.
  const fishEntry = voiceEnabled && !muted ? fishVoiceFor(voiceId || defaultVoiceId) : undefined
  if (voiceEnabled && !muted && !fishEntry && moduleConfig.fish_api_key) {
    log("warn", "Voice: no Fish clone for this voice id, staying silent", { voiceId: voiceId || defaultVoiceId })
  }
  if (fishEntry) {
    let audio: Uint8Array | undefined
    try {
      audio = await generateFishSpeech(safeMessage, fishEntry, emotion)
    } catch (error: unknown) {
      voiceError = error instanceof Error ? error.message : String(error)
      log("error", "Voice: Fish failed; staying silent", { error: voiceError })
    }
    if (audio) {
      const fishAudio = audio
      try {
        const played = enqueuePlayback(() => playAudio(fishAudio, callerVolume ?? fishEntry.volume ?? FALLBACK_VOLUME, "mp3", { interruptible, bypassMute }), gen)
        if (interruptible) played.catch((e) => log("error", "Voice: interruptible playback failed", { error: String(e) }))
        else await played
        voicePlayed = true
      } catch (error: unknown) {
        voiceError = error instanceof Error ? error.message : String(error)
        log("error", "Voice: failed to play Fish speech", { error: voiceError })
      }
    }
  }

  // Desktop banner. Pausing the voice pauses the banner too (principal directive, 2026-10-24; Pulse ISA ISC-6.2).
  if (!muted) await showDesktopNotification(safeTitle, stripVoiceTags(safeMessage))

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
  if (!config.fish_api_key && process.env.FISH_API_KEY) {
    config.fish_api_key = process.env.FISH_API_KEY
  }
  moduleConfig = config

  if (!config.enabled) {
    log("info", "Voice module: disabled")
    return
  }

  // No voice key at all is a supported install (voice off), not a fault: said once at startup, never per line.
  if (!config.fish_api_key) {
    log("info", "Voice module: no FISH_API_KEY — voice is off, notifications stay silent")
  }

  // Pronunciation rules: the principal's file unless PULSE.toml names another
  pronPath = config.pronunciations_path ?? ""

  // Load the voice table: LIFEOS_CONFIG.toml main over legacy settings.json (public issue #2052, @lgertel)
  voiceConfig = loadVoiceConfig()

  // Resolve default voice ID: config override → LIFEOS_CONFIG.toml / settings.json. There is no stock fallback
  // voice: an unconfigured install is silent.
  defaultVoiceId = config.default_voice_id || voiceConfig.defaultVoiceId || ""

  initialized = true
  log("info", "Voice module: initialized", {
    defaultVoiceId,
    pronunciationRules: Object.keys(pronunciations()).length,
    configuredVoices: Object.keys(voiceConfig.voices),
    fishConfigured: !!config.fish_api_key && !!voiceConfig.voices.main?.fishReferenceId,
  })
}

/** Which engine speaks: Fish when a key and the main clone exist, otherwise off. */
export function voiceSystem(cfg: { fish_api_key?: string }, main: { fishReferenceId?: string } | undefined): string {
  return cfg.fish_api_key && main?.fishReferenceId ? "Fish" : "off"
}

/**
 * Health check for the voice subsystem.
 */
export function voiceHealth(): Record<string, unknown> {
  return {
    initialized,
    enabled: moduleConfig.enabled,
    muted: isMuted(),
    voice_system: voiceSystem(moduleConfig, voiceConfig.voices.main),
    default_voice_id: defaultVoiceId,
    fish_configured: !!moduleConfig.fish_api_key && !!voiceConfig.voices.main?.fishReferenceId,
    pronunciation_rules: Object.keys(pronunciations()).length,
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
 *   POST /pai                 — LifeOS assistant notification
 *   GET  /voice/health        — voice subsystem health
 *   GET  /voice/mute          — mute state {muted: bool}; mutes this machine's speakers only, not a remote receiver
 *   POST /voice/mute          — {} toggles, {"muted": bool} sets; returns new state
 *
 * Returns a Response for matched routes, or null if the route is not ours.
 */
export async function handleVoiceRequest(req: Request): Promise<Response | null> {
  const url = new URL(req.url)
  const pathname = url.pathname

  // CORS preflight for any of our routes
  if (req.method === "OPTIONS" && ["/notify", "/notify/personality", "/pai", "/voice/health", "/voice/mute", "/voice/stop"].includes(pathname)) {
    return new Response(null, { headers: CORS_HEADERS, status: 204 })
  }

  // Rate limit check
  const clientIp = req.headers.get("x-forwarded-for") || "localhost"

  // GET /voice/health
  if (pathname === "/voice/health" && req.method === "GET") {
    return jsonResponse(voiceHealth(), 200)
  }

  // /voice/mute — the recording/call mute for this machine's speakers (menu app + Hammerspoon); a remote receiver still plays.
  // Deliberately ABOVE the rate limiter: a notification burst is exactly when
  // the mute switch gets reached for, and it must never 429.
  if (pathname === "/voice/mute") {
    if (req.method === "GET") {
      return jsonResponse({ muted: isMuted() }, 200)
    }
    if (req.method === "POST") {
      try {
        const body = await req.text()
        const data = body ? JSON.parse(body) : {}
        if ("muted" in data && typeof data.muted !== "boolean") {
          return jsonResponse({ status: "error", message: "Invalid muted value: must be boolean" }, 400)
        }
        const prev = isMuted()
        const next = typeof data.muted === "boolean" ? data.muted : !prev
        setMuted(next, typeof data.source === "string" ? data.source.slice(0, 64) : "http")
        // Audible confirmation on every state CHANGE (principal directive
        // 2026-08-18): muting says its last word, unmuting confirms voice is
        // back. bypassMute lets the muted-side confirmation through; fired
        // without await so the toggle responds instantly.
        if (next !== prev) {
          void sendNotification("LifeOS Voice", next ? "Voice muted." : "Voice back on.", true, null, null, true)
            .catch((e) => log("warn", "Voice: mute-change announcement failed", { error: String(e) }))
        }
        return jsonResponse({ status: "success", muted: next }, 200)
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        log("error", "Voice: mute toggle error", { error: msg })
        return jsonResponse({ status: "error", message: "Mute toggle failed" }, 400)
      }
    }
    return null
  }

  // POST /voice/stop — voice mode's barge-in: stop speaking now and drop the queue.
  // Above the rate limiter for the same reason as the mute switch.
  if (pathname === "/voice/stop" && req.method === "POST") {
    return jsonResponse({ status: "success", ...stopPlayback("POST /voice/stop") }, 200)
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
      const title = data.title || "LifeOS Notification"
      const message = data.message || "Task completed"
      const voiceEnabled = data.voice_enabled !== false
      const voiceId = data.voice_id || data.voice_name || null
      const volume = data.volume ?? null

      if (voiceId && typeof voiceId !== "string") throw new Error("Invalid voice_id")

      log("info", `Voice: notification "${title}" - "${message}"`, {
        voiceEnabled,
        voiceId: voiceId || defaultVoiceId,
      })

      const result = await sendNotification(title, message, voiceEnabled, voiceId, volume, false, data.interruptible === true)

      if (result.voicePlayed) {
        try { recordInterruption({ kind: "voice", source: "pulse/voice", summary: message }) } catch {}
      }

      if (voiceEnabled && !result.voicePlayed && result.voiceError) {
        return jsonResponse({ status: "error", message: `TTS failed: ${result.voiceError}`, notification_sent: true }, 502)
      }

      return jsonResponse({ status: "success", message: "Notification sent" }, 200)
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      log("error", "Voice: notification error", { error: msg })
      return jsonResponse({ status: "error", message: "Notification failed" }, errorStatus(msg))
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
      // LIFEOS_CONFIG.toml first — mtime-cached, so this is a live read of the
      // canonical voice (public issue #2052, @lgertel); settings.json is legacy.
      try {
        voiceId = loadLifeosConfig().da.voices.main.voiceId || null
      } catch {
        // no TOML on this install — legacy settings.json below
      }
      if (!voiceId) {
        try {
          const settingsFile = join(HOME, ".claude", "settings.json")
          const settings = JSON.parse(readFileSync(settingsFile, "utf-8"))
          const main = settings?.daidentity?.voices?.main
          const vid = (main?.voiceId || main?.VOICE_ID || main?.voice_id) as string | undefined
          if (vid) voiceId = vid
        } catch {
          // Fall through — sendNotification will use the cached defaultVoiceId
        }
      }

      log("info", `Voice: personality notification "${message}"`, { voiceId })
      await sendNotification("LifeOS Notification", message, true, voiceId)

      return jsonResponse({ status: "success", message: "Personality notification sent" }, 200)
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      log("error", "Voice: personality notification error", { error: msg })
      return jsonResponse({ status: "error", message: "Notification failed" }, errorStatus(msg))
    }
  }

  // POST /voice
  if (pathname === "/voice") {
    try {
      const data = await req.json()
      const title = data.title || "LifeOS Assistant"
      const message = data.message || "Task completed"

      log("info", `Voice: LifeOS notification "${title}" - "${message}"`)
      await sendNotification(title, message, true, null)

      return jsonResponse({ status: "success", message: "LifeOS notification sent" }, 200)
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      log("error", "Voice: LifeOS notification error", { error: msg })
      return jsonResponse({ status: "error", message: "Notification failed" }, errorStatus(msg))
    }
  }

  // Not our route
  return null
}
