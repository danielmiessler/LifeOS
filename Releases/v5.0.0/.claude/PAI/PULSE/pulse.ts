#!/usr/bin/env bun
/**
 * PAI Pulse — The Unified Daemon
 *
 * Single process managing all PAI daemon functionality:
 *   - Cron job scheduling (heartbeat loop)
 *   - Voice notifications (ElevenLabs TTS)
 *   - Hook validation (skill-guard, agent-guard)
 *   - Observability (data APIs + dashboard)
 *   - Telegram bot (grammY polling + claude-agent-sdk)
 *   - iMessage bot (SQLite polling + claude-agent-sdk)
 *   - GitHub work polling (PAI Worker)
 *
 * One process. One port. One launchd plist. One log file.
 */

import { join } from "path"
import { readFileSync, existsSync } from "fs"
import { parse } from "smol-toml"
import { getPaiDir, paiPath, getEnvPath } from "../lib/paths"

// ── Load .env before anything else ──

const PAI_DIR = getPaiDir()
const PULSE_DIR = paiPath("PULSE")

const envPath = getEnvPath()
try {
  const envContent = readFileSync(envPath, "utf-8")
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eqIdx = trimmed.indexOf("=")
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let value = trimmed.slice(eqIdx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
} catch { /* .env not found — rely on process environment */ }

// ── BILLING GUARD (defense-in-depth) ──
// Strip ANTHROPIC_API_KEY from the daemon environment AFTER .env load. Every
// downstream module (telegram, imessage, spawnClaude) inherits this. Prevents
// the Claude Agent SDK and `claude` CLI from billing the API key instead of
// CLAUDE_CODE_OAUTH_TOKEN. Root cause of April 2026 invoice ($498 / $354 Sonnet
// + $72 WebSearch). Each module also strips independently for belt-and-suspenders.
delete process.env.ANTHROPIC_API_KEY

// ── Imports ──

import {
  type DaemonState,
  loadConfig,
  isDue,
  matchesCron,
  readState,
  writeState,
  log,
  dispatch,
  isSentinel,
  spawnScript,
  spawnClaude,
} from "./lib"

import { startHooks, handleHooksRequestAsync, hooksHealth } from "./modules/hooks"

// Conditional imports — modules may not exist yet during incremental migration
let voiceModule: any = null
let observabilityModule: any = null
let wikiModule: any = null
let telegramModule: any = null
let imessageModule: any = null
let assistantModule: any = null
let performanceModule: any = null
let syslogModule: any = null

async function loadModules(config: PulseConfig) {
  if (config.voice?.enabled !== false) {
    try {
      voiceModule = await import("./VoiceServer/voice")
    } catch (err) {
      log("warn", "Voice module not available", { error: String(err) })
    }
  }
  if (config.observability?.enabled !== false) {
    try {
      observabilityModule = await import("./Observability/observability")
    } catch (err) {
      log("warn", "Observability module not available", { error: String(err) })
    }
  }
  // Wiki module — always load (no config gate)
  try {
    wikiModule = await import("./modules/wiki")
  } catch (err) {
    log("warn", "Wiki module not available", { error: String(err) })
  }
  if (config.telegram?.enabled) {
    try {
      telegramModule = await import("./modules/telegram")
    } catch (err) {
      log("warn", "Telegram module not available", { error: String(err) })
    }
  }
  if (config.imessage?.enabled) {
    try {
      imessageModule = await import("./modules/imessage")
    } catch (err) {
      log("warn", "iMessage module not available", { error: String(err) })
    }
  }
  if (config.da?.enabled) {
    try {
      assistantModule = await import("./Assistant/module")
    } catch (err) {
      log("warn", "Assistant module not available", { error: String(err) })
    }
  }
  if (config.performance?.enabled !== false) {
    try {
      performanceModule = await import("./Performance/module")
    } catch (err) {
      log("warn", "Performance module not available", { error: String(err) })
    }
  }
  if (config.syslog?.enabled) {
    try {
      syslogModule = await import("./modules/syslog")
    } catch (err) {
      log("warn", "Syslog module not available", { error: String(err) })
    }
  }
}

// ── Config Types ──

interface PulseConfig {
  port: number
  tls?: { enabled: boolean; cert: string; key: string } // unused — TLS removed
  voice?: { enabled: boolean; [key: string]: unknown }
  telegram?: { enabled: boolean; [key: string]: unknown }
  imessage?: { enabled: boolean; [key: string]: unknown }
  observability?: { enabled: boolean; dashboard_dir?: string; [key: string]: unknown }
  hooks?: { enabled: boolean; blocked_skills?: string[] }
  da?: { enabled: boolean; primary?: string; [key: string]: unknown }
  performance?: { enabled: boolean; [key: string]: unknown }
  syslog?: { enabled: boolean; port?: number; [key: string]: unknown }
  worker?: { name: string; [key: string]: unknown }
  jobs: Array<{
    name: string
    schedule: string
    type: "script" | "claude"
    command?: string
    prompt?: string
    model?: string
    output: string | string[]
    enabled: boolean
  }>
}

// ── Load Unified Config ──

async function loadPulseConfig(): Promise<PulseConfig> {
  const raw = await Bun.file(join(PULSE_DIR, "PULSE.toml")).text()
  const parsed = parse(raw) as Record<string, unknown>

  const daemonConfig = await loadConfig(PULSE_DIR)

  return {
    port: (parsed.port as number) ?? parseInt(process.env.PULSE_PORT || "31337", 10),
    tls: (parsed.tls as PulseConfig["tls"]) ?? undefined,
    voice: (parsed.voice as PulseConfig["voice"]) ?? { enabled: true },
    telegram: (parsed.telegram as PulseConfig["telegram"]) ?? { enabled: false },
    imessage: (parsed.imessage as PulseConfig["imessage"]) ?? { enabled: false },
    observability: (parsed.observability as PulseConfig["observability"]) ?? { enabled: true },
    performance: (parsed.performance as PulseConfig["performance"]) ?? { enabled: true },
    syslog: (parsed.syslog as PulseConfig["syslog"]) ?? { enabled: false, port: 5514 },
    hooks: (parsed.hooks as PulseConfig["hooks"]) ?? { enabled: true },
    da: (parsed.da as PulseConfig["da"]) ?? { enabled: false },
    worker: parsed.worker as PulseConfig["worker"],
    jobs: daemonConfig.jobs,
  }
}

// ── Constants ──

const STATE_PATH = join(PULSE_DIR, "state", "state.json")
const PID_PATH = join(PULSE_DIR, "state", "pulse.pid")
const MAX_FAILURES = 3
const MAX_SLEEP_MS = 60_000
const MIN_SLEEP_MS = 1_000

// ── Supervisor: restart crashed subsystems without killing the process ──

async function supervise(name: string, fn: () => Promise<void>, shuttingDown: () => boolean) {
  while (!shuttingDown()) {
    try {
      await fn()
      // If fn returns normally, the subsystem exited cleanly
      if (!shuttingDown()) {
        log("info", `${name} exited cleanly, restarting in 10s`)
        await Bun.sleep(10_000)
      }
    } catch (err) {
      if (shuttingDown()) return
      log("error", `${name} crashed, restarting in 30s`, { error: String(err) })
      await Bun.sleep(30_000)
    }
  }
}

// ── Compute next due time ──

function msUntilNextDue(jobs: PulseConfig["jobs"], state: DaemonState): number {
  const now = new Date()
  for (let offset = 1; offset <= 60; offset++) {
    const future = new Date(now.getTime() + offset * 60_000)
    for (const job of jobs) {
      if (!job.enabled) continue
      if (matchesCron(job.schedule, future)) return offset * 60_000
    }
  }
  return MAX_SLEEP_MS
}

// ── Unified Health Response ──

function buildHealthResponse(state: DaemonState, config: PulseConfig): Response {
  const subsystems: Record<string, unknown> = {}

  // Cron jobs
  subsystems.cron = {
    status: "ok",
    jobs: Object.entries(state.jobs).map(([name, s]) => ({
      name,
      lastRun: new Date(s.lastRun).toISOString(),
      agoMs: Date.now() - s.lastRun,
      result: s.lastResult,
      failures: s.consecutiveFailures,
    })),
  }

  // Hooks
  if (config.hooks?.enabled !== false) {
    subsystems.hooks = hooksHealth()
  }

  // Voice
  if (voiceModule && config.voice?.enabled !== false) {
    subsystems.voice = voiceModule.voiceHealth()
  }

  // Observability
  if (observabilityModule && config.observability?.enabled !== false) {
    subsystems.observability = observabilityModule.observabilityHealth()
  }

  // Performance
  if (performanceModule && config.performance?.enabled !== false) {
    subsystems.performance = performanceModule.performanceHealth()
  }

  // Telegram
  if (telegramModule && config.telegram?.enabled) {
    subsystems.telegram = telegramModule.telegramHealth()
  }

  // iMessage
  if (imessageModule && config.imessage?.enabled) {
    subsystems.imessage = imessageModule.imessageHealth()
  }

  // Assistant
  if (assistantModule && config.da?.enabled) {
    subsystems.assistant = assistantModule.assistantHealth()
  }

  // Syslog
  if (syslogModule && config.syslog?.enabled) {
    subsystems.syslog = syslogModule.health()
  }

  return Response.json({
    status: "ok",
    service: "pulse",
    pid: process.pid,
    port: config.port,
    startedAt: new Date(state.startedAt).toISOString(),
    uptime: Math.round((Date.now() - state.startedAt) / 1000),
    subsystems,
  })
}

// ── Main ──

async function main() {
  await Bun.write(PID_PATH, String(process.pid))

  const config = await loadPulseConfig()
  let state = await readState(STATE_PATH)
  state.startedAt = Date.now()

  const enabledJobs = config.jobs.filter((j) => j.enabled)
  log("info", "PAI Pulse starting (unified daemon)", {
    pid: process.pid,
    port: config.port,
    jobs: enabledJobs.length,
    modules: {
      voice: config.voice?.enabled !== false,
      hooks: config.hooks?.enabled !== false,
      observability: config.observability?.enabled !== false,
      telegram: config.telegram?.enabled ?? false,
      imessage: config.imessage?.enabled ?? false,
      syslog: config.syslog?.enabled ?? false,
      da: config.da?.enabled ?? false,
    },
  })

  // Graceful shutdown
  let shuttingDown = false
  const isShuttingDown = () => shuttingDown
  const shutdown = () => {
    if (shuttingDown) return
    shuttingDown = true
    log("info", "Shutting down gracefully")
  }
  process.on("SIGTERM", shutdown)
  process.on("SIGINT", shutdown)

  // ── Load Modules ──
  await loadModules(config)

  // ── Initialize Modules ──
  if (config.hooks?.enabled !== false) {
    startHooks(config.hooks ?? { enabled: true })
  }

  if (voiceModule && config.voice?.enabled !== false) {
    voiceModule.startVoice(config.voice)
    log("info", "Voice module loaded")
  }

  if (observabilityModule && config.observability?.enabled !== false) {
    observabilityModule.startObservability(config.observability)
    log("info", "Observability module loaded")
  }

  if (performanceModule && config.performance?.enabled !== false) {
    performanceModule.startPerformance(config.performance)
    log("info", "Performance module loaded")
  }

  if (wikiModule) {
    wikiModule.startWiki()
    log("info", "Wiki module loaded")
  }

  if (assistantModule && config.da?.enabled) {
    assistantModule.startAssistant(config.da, enabledJobs)
    log("info", "Assistant module loaded")
  }

  if (syslogModule && config.syslog?.enabled) {
    try {
      if (config.syslog.port) process.env.PULSE_SYSLOG_PORT = String(config.syslog.port)
      await syslogModule.start()
      log("info", "Syslog module loaded")
    } catch (err) {
      log("error", "Syslog module failed to start", { error: String(err) })
      syslogModule = null
    }
  }

  // ── HTTP/HTTPS Server (single port, all routes) ──

  // Bind loopback by default — safe for public release on shared networks.
  // Opt in to all-interface binding (for LAN access from phone, Mac mini
  // fleet, etc.) via PAI_PULSE_BIND_ALL=1 in the env or .env file.
  const bindAll = (process.env.PAI_PULSE_BIND_ALL ?? "").trim() === "1"
  const server = Bun.serve({
    hostname: bindAll ? "0.0.0.0" : "127.0.0.1",
    port: config.port,
    async fetch(req) {
      const url = new URL(req.url)
      const pathname = url.pathname

      // Health (unified) — moved to /api/pulse/health to avoid conflict with Life Dashboard /health page
      if (req.method === "GET" && (pathname === "/api/pulse/health" || pathname === "/healthz")) {
        return buildHealthResponse(state, config)
      }

      // Voice routes: /notify, /notify/personality, /voice
      if (voiceModule && (pathname === "/notify" || pathname === "/notify/personality" || pathname === "/voice")) {
        const resp = await voiceModule.handleVoiceRequest(req, pathname)
        if (resp) return resp
      }

      // Hook routes: /hooks/*
      if (pathname.startsWith("/hooks/")) {
        const resp = await handleHooksRequestAsync(req, pathname)
        if (resp) return resp
      }

      // Wiki routes: /api/wiki/*
      if (wikiModule && pathname.startsWith("/api/wiki")) {
        const resp = await wikiModule.handleWikiRequest(req, pathname)
        if (resp) return resp
      }

      // Assistant routes: /assistant/*
      if (assistantModule && pathname.startsWith("/assistant/")) {
        const resp = await assistantModule.handleAssistantRequest(req, pathname)
        if (resp) return resp
      }

      // Performance routes: /api/performance/*
      if (performanceModule && pathname.startsWith("/api/performance/")) {
        const resp = await performanceModule.handlePerformanceRequest(req)
        if (resp) return resp
      }

      // Syslog routes: /api/syslog/*
      if (syslogModule && pathname.startsWith("/api/syslog")) {
        const subPath = pathname.replace(/^\/api\/syslog/, "")
        const body: Record<string, unknown> = Object.fromEntries(url.searchParams)
        return syslogModule.handleRequest(subPath, body)
      }

      // Observability routes: /api/*, /dashboard/*
      if (observabilityModule && (pathname.startsWith("/api/") || pathname.startsWith("/dashboard") || pathname.startsWith("/_next/") || pathname === "/favicon.ico")) {
        const resp = await observabilityModule.handleObservabilityRequest(req, pathname)
        if (resp) return resp
      }

      // Fallback: serve dashboard pages at root level (Next.js expects /, /agents, /security, etc.)
      if (observabilityModule && req.method === "GET") {
        const resp = await observabilityModule.handleObservabilityRequest(req, pathname)
        if (resp) return resp
      }

      return new Response("Not found", { status: 404 })
    },
  })

  log("info", "HTTP server listening", { port: server.port })

  // Menu bar app is launched by its own launchd agent (com.pai.pulse-menubar)
  // Do NOT spawn it here — that causes duplicate menu bar icons

  // ── Start Long-Running Subsystems (supervised) ──

  if (telegramModule && config.telegram?.enabled) {
    supervise("telegram", () => telegramModule.startTelegram(config.telegram), isShuttingDown)
    log("info", "Telegram module started (supervised)")
  }

  if (imessageModule && config.imessage?.enabled) {
    supervise("imessage", () => imessageModule.startIMessage(config.imessage), isShuttingDown)
    log("info", "iMessage module started (supervised)")
  }

  // ── Cron Heartbeat Loop ──

  while (!shuttingDown) {
    const tickStart = Date.now()
    const now = new Date()

    for (const job of config.jobs) {
      if (!job.enabled) continue
      if (shuttingDown) break

      const jobState = state.jobs[job.name]

      if (!isDue(job.schedule, now, jobState?.lastRun)) continue

      if ((jobState?.consecutiveFailures ?? 0) >= MAX_FAILURES) {
        log("warn", `Skipping ${job.name}: ${jobState!.consecutiveFailures} consecutive failures`, {
          lastResult: jobState!.lastResult,
        })
        continue
      }

      log("info", `Running: ${job.name}`, { type: job.type, subsystem: "cron" })
      const startMs = Date.now()

      try {
        let output: string

        if (job.type === "claude") {
          output = await spawnClaude(job.prompt!, { model: job.model ?? "sonnet" })
        } else {
          output = await spawnScript(job.command!)
        }

        const durationMs = Date.now() - startMs

        if (!isSentinel(output)) {
          await dispatch(output, job.output as any, job.name)
          const targets = Array.isArray(job.output) ? job.output.join(", ") : job.output
          log("info", `${job.name} completed — dispatched to ${targets}`, {
            durationMs,
            subsystem: "cron",
            outputPreview: output.slice(0, 200),
          })
        } else {
          log("info", `${job.name} completed — nothing to report`, { durationMs, subsystem: "cron" })
        }

        state.jobs[job.name] = { lastRun: Date.now(), lastResult: "ok", consecutiveFailures: 0 }
      } catch (err) {
        const failures = (jobState?.consecutiveFailures ?? 0) + 1
        state.jobs[job.name] = { lastRun: Date.now(), lastResult: "error", consecutiveFailures: failures }
        log("error", `${job.name} failed`, {
          error: String(err),
          failures,
          subsystem: "cron",
          durationMs: Date.now() - startMs,
        })
      }

      await writeState(STATE_PATH, state).catch((err) =>
        log("error", "Failed to persist state", { error: String(err) })
      )
    }

    const nextDueMs = msUntilNextDue(config.jobs, state)
    const elapsed = Date.now() - tickStart
    const sleepMs = Math.max(MIN_SLEEP_MS, Math.min(nextDueMs - elapsed, MAX_SLEEP_MS))

    if (!shuttingDown) {
      await Bun.sleep(sleepMs)
    }
  }

  // ── Cleanup ──
  server.stop()
  if (telegramModule) telegramModule.stopTelegram?.()
  if (imessageModule) imessageModule.stopIMessage?.()
  if (assistantModule) assistantModule.stopAssistant?.()
  if (syslogModule) await syslogModule.stop?.()
  await writeState(STATE_PATH, state).catch(() => {})
  log("info", "PAI Pulse stopped", { uptimeMs: Date.now() - state.startedAt })
}

main().catch((err) => {
  log("error", "Pulse crashed", { error: String(err) })
  process.exit(1)
})
