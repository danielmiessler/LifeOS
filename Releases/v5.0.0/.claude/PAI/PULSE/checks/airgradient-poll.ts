#!/usr/bin/env bun
/**
 * AirGradient Poller — Script-type job
 *
 * Polls the AirGradient cloud API for current readings across all monitors
 * registered on {{PRINCIPAL_NAME}}'s place (Baylander, ID 3082). Writes the full payload
 * to latest.json (cache) and appends per-monitor rows to history.jsonl
 * (rolling history). Zero AI cost.
 *
 * Output: NO_ACTION on success, or a one-line error message.
 */

import { join } from "node:path"
import { mkdirSync, writeFileSync, appendFileSync, readFileSync, existsSync } from "node:fs"
import { paiPath, getEnvPath } from "../../lib/paths"

const CACHE_DIR = paiPath("MEMORY", "_AIRGRADIENT")
const LATEST = join(CACHE_DIR, "latest.json")
const HISTORY = join(CACHE_DIR, "history.jsonl")

const API_BASE = "https://api.airgradient.com/public/api/v1"

// Bun auto-loads .env from CWD only; Pulse cron runs from PAI/PULSE/, so the
// symlink at ~/.claude/.env isn't picked up. Read it directly if env is empty.
function loadTokenFromDotenv(): string | null {
  const envPath = getEnvPath()
  if (!existsSync(envPath)) return null
  try {
    const raw = readFileSync(envPath, "utf8")
    const match = raw.match(/^\s*AIRGRADIENT_TOKEN\s*=\s*(.+?)\s*$/m)
    if (!match) return null
    return match[1].replace(/^["']|["']$/g, "")
  } catch {
    return null
  }
}

interface Monitor {
  locationId: number
  locationName: string
  serialno: string
  model: string | null
  firmwareVersion: string | null
  pm01: number | null
  pm02: number | null
  pm10: number | null
  pm01_corrected: number | null
  pm02_corrected: number | null
  pm10_corrected: number | null
  pm003Count: number | null
  rco2: number | null
  rco2_corrected: number | null
  atmp: number | null
  atmp_corrected: number | null
  rhum: number | null
  rhum_corrected: number | null
  tvoc: number | null
  tvocIndex: number | null
  noxIndex: number | null
  wifi: number | null
  timestamp: string
  latitude: number | null
  longitude: number | null
  locationType: string | null
}

async function fetchMonitors(token: string): Promise<Monitor[]> {
  const url = `${API_BASE}/locations/measures/current?token=${encodeURIComponent(token)}`
  const resp = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!resp.ok) {
    throw new Error(`AirGradient API ${resp.status}: ${await resp.text().catch(() => "")}`)
  }
  const data = await resp.json() as Monitor[]
  if (!Array.isArray(data)) throw new Error("AirGradient API returned non-array")
  return data
}

async function main() {
  const token = process.env.AIRGRADIENT_TOKEN || loadTokenFromDotenv()
  if (!token) {
    console.log("AirGradient poll skipped: AIRGRADIENT_TOKEN not set")
    return
  }

  mkdirSync(CACHE_DIR, { recursive: true })

  const monitors = await fetchMonitors(token)
  const now = new Date().toISOString()

  const payload = {
    fetched_at: now,
    count: monitors.length,
    monitors,
  }
  writeFileSync(LATEST, JSON.stringify(payload, null, 2))

  // Append one line per monitor to history (for sparkline / trend UI later)
  const rows = monitors.map((m) => ({
    t: now,
    id: m.locationId,
    name: m.locationName.trim(),
    pm02: m.pm02_corrected ?? m.pm02,
    rco2: m.rco2_corrected ?? m.rco2,
    atmp: m.atmp_corrected ?? m.atmp,
    rhum: m.rhum_corrected ?? m.rhum,
    tvoc: m.tvocIndex,
    nox: m.noxIndex,
    ts_reading: m.timestamp,
  }))
  appendFileSync(HISTORY, rows.map((r) => JSON.stringify(r)).join("\n") + "\n")

  console.log("NO_ACTION")
}

main().catch((err) => {
  console.error(`airgradient-poll error: ${err instanceof Error ? err.message : err}`)
  console.log("NO_ACTION")
})
