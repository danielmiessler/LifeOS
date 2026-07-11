#!/usr/bin/env bun
/**
 * VoiceMute.ts - toggle the DA's live voice mute.
 *
 * Writes ~/.claude/LIFEOS/PULSE/state/voice-mute.json, which
 * PULSE/VoiceServer/voice.ts reads on every /notify call - no Pulse restart
 * needed, the gate is live-read. LIFEOS_StatusLine.sh renders 🔇 / 🔊 from the
 * same file. Muting silences TTS audio only; desktop notifications still show.
 *
 * Usage:
 *   bun ~/.claude/LIFEOS/TOOLS/VoiceMute.ts on        # mute (silence TTS)
 *   bun ~/.claude/LIFEOS/TOOLS/VoiceMute.ts off       # unmute
 *   bun ~/.claude/LIFEOS/TOOLS/VoiceMute.ts toggle    # flip current state
 *   bun ~/.claude/LIFEOS/TOOLS/VoiceMute.ts status    # print current state
 *
 * Bind `toggle` to a keyboard shortcut for a live mute hotkey - see
 * DOCUMENTATION/Notifications/KokoroVoiceBackend.md.
 *
 * Exit code mirrors mute state for scripts: 0 = unmuted, 1 = muted (status only).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"

const STATE_FILE = join(process.env.HOME ?? "", ".claude", "LIFEOS", "PULSE", "state", "voice-mute.json")

function readState(): boolean {
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf-8"))?.muted === true
  } catch {
    return false
  }
}

function writeState(muted: boolean): void {
  mkdirSync(dirname(STATE_FILE), { recursive: true })
  writeFileSync(STATE_FILE, JSON.stringify({ muted, updated: new Date().toISOString() }, null, 2))
}

function indicator(muted: boolean): string {
  return muted ? "🔇 muted" : "🔊 audible"
}

const cmd = (process.argv[2] || "status").toLowerCase()
const current = readState()

let next: boolean
switch (cmd) {
  case "on":
  case "mute":
    next = true
    break
  case "off":
  case "unmute":
    next = false
    break
  case "toggle":
    next = !current
    break
  case "status":
    console.log(indicator(current))
    process.exit(current ? 1 : 0)
  default:
    console.error(`Unknown command: ${cmd}. Use on | off | toggle | status.`)
    process.exit(2)
}

if (next !== current) writeState(next)
console.log(indicator(next))
process.exit(next ? 1 : 0)
