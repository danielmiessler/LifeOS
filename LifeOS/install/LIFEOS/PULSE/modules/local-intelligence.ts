/**
 * Pulse module: local-intelligence
 *
 * Read-only over the LocalIntelligence skill output at
 * MEMORY/DATA/LocalIntelligence/latest.json. Serves the LOCAL dashboard tab.
 *
 * Endpoints:
 *   GET  /api/local-intelligence            — latest digest
 *   POST /api/local-intelligence/refresh    — kick off a refresh, returns run_id
 *   (health() integrates into /api/pulse/health)
 *
 * The module does NO scraping or fetching itself. All network I/O lives in the
 * skill's Tools/Refresh.ts. This module spawns that script for refreshes and
 * reads the resulting JSON for serves.
 */

import { spawn } from "node:child_process"
import { readFile, mkdir, writeFile, stat } from "node:fs/promises"
import { join } from "node:path"
import { homedir } from "node:os"
import { randomUUID } from "node:crypto"
import { claudeDir } from "../../TOOLS/lifeos-root";

const HOME = process.env.HOME ?? homedir()
const MODULE_NAME = "local-intelligence"

// Primary path: user-scoped customizations directory (per {{PRINCIPAL_NAME}} directive 2026-05-03).
// Fallback path: legacy MEMORY/DATA path (used when customizations file absent).
const CUSTOMIZATIONS_DIR = join(claudeDir(), "LIFEOS", "USER", "CUSTOMIZATIONS", "SKILLS", "LocalIntelligence")
const LEGACY_DATA_DIR = join(claudeDir(), "LIFEOS", "MEMORY", "DATA", "LocalIntelligence")
const LATEST_PATH = join(CUSTOMIZATIONS_DIR, "latest.json")
const LEGACY_LATEST_PATH = join(LEGACY_DATA_DIR, "latest.json")
const DATA_DIR = CUSTOMIZATIONS_DIR  // alias for existing references in this file
const RUNS_DIR = join(CUSTOMIZATIONS_DIR, "runs")
const REFRESH_SCRIPT = join(claudeDir(), "skills", "LocalIntelligence", "Tools", "Refresh.ts")

async function readLatest(): Promise<string | null> {
  try { return await readFile(LATEST_PATH, "utf8") } catch {}
  try { return await readFile(LEGACY_LATEST_PATH, "utf8") } catch {}
  return null
}

interface ModuleState {
  running: boolean
  startedAt: Date | null
  lastRefresh: string | null
  lastRefreshOk: boolean | null
  sourcesOk: number
  sourcesFailed: number
}

const state: ModuleState = {
  running: false,
  startedAt: null,
  lastRefresh: null,
  lastRefreshOk: null,
  sourcesOk: 0,
  sourcesFailed: 0,
}

export async function start(): Promise<void> {
  state.running = true
  state.startedAt = new Date()
  await mkdir(DATA_DIR, { recursive: true }).catch(() => {})
  await mkdir(RUNS_DIR, { recursive: true }).catch(() => {})
  await readLatestMeta()
  console.log(`[${MODULE_NAME}] started`)
}

export async function stop(): Promise<void> {
  state.running = false
  console.log(`[${MODULE_NAME}] stopped`)
}

export function health(): { status: string; details?: Record<string, unknown> } {
  return {
    status: state.running ? "healthy" : "stopped",
    details: {
      uptime: state.startedAt
        ? Math.floor((Date.now() - state.startedAt.getTime()) / 1000)
        : 0,
      last_refresh: state.lastRefresh,
      last_refresh_ok: state.lastRefreshOk,
      sources_ok: state.sourcesOk,
      sources_failed: state.sourcesFailed,
    },
  }
}

async function readLatestMeta(): Promise<void> {
  const raw = await readLatest()
  if (!raw) return
  try {
    const j = JSON.parse(raw) as {
      meta?: { generated_at?: string; sources_used?: string[]; sources_failed?: string[] }
    }
    state.lastRefresh = j.meta?.generated_at ?? null
    state.sourcesOk = j.meta?.sources_used?.length ?? 0
    state.sourcesFailed = j.meta?.sources_failed?.length ?? 0
    state.lastRefreshOk = state.sourcesOk > 0
  } catch {
    /* unparseable — empty-state path */
  }
}

async function spawnRefresh(): Promise<string> {
  const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}_${randomUUID().slice(0, 8)}`
  const logPath = join(RUNS_DIR, `${runId}.log`)
  const out = await Bun.file(logPath).writer()
  const child = spawn("bun", ["run", REFRESH_SCRIPT], {
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  })
  child.stdout.on("data", (b) => out.write(b))
  child.stderr.on("data", (b) => out.write(b))
  child.on("exit", async (code) => {
    out.write(`\n[exit] code=${code}\n`)
    await out.end()
    await readLatestMeta()
  })
  // Sidecar marker file proves the run was started.
  await writeFile(logPath + ".started", new Date().toISOString())
  return runId
}

export async function handleRequest(req: Request, pathname: string): Promise<Response | null> {
  if (req.method === "GET" && pathname === "/api/local-intelligence") {
    const raw = await readLatest()
    if (raw) {
      return new Response(raw, {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
      })
    }
    return Response.json(
      { error: "not_yet_generated", hint: "POST /api/local-intelligence/refresh to kick off a run" },
      { status: 404 }
    )
  }
  if (req.method === "POST" && pathname === "/api/local-intelligence/refresh") {
    const runId = await spawnRefresh()
    return Response.json({ status: "started", run_id: runId }, { status: 202 })
  }
  if (req.method === "GET" && pathname === "/api/local-intelligence/status") {
    let exists = false
    let mtime: string | null = null
    try {
      const s = await stat(LATEST_PATH)
      exists = true
      mtime = s.mtime.toISOString()
    } catch {}
    return Response.json({
      ...state,
      latest_exists: exists,
      latest_mtime: mtime,
    })
  }
  return null
}
