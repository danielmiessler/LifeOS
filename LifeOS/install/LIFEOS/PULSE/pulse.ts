#!/usr/bin/env bun
/**
 * LifeOS Pulse — The Unified Daemon
 *
 * Single process managing all LifeOS daemon functionality:
 *   - Cron job scheduling (heartbeat loop)
 *   - Voice notifications (ElevenLabs TTS)
 *   - Hook validation (skill-guard, agent-guard)
 *   - Observability (data APIs + dashboard)
 *   - iMessage bot (SQLite polling + claude-agent-sdk)
 *   - GitHub work polling (LifeOS Worker)
 *
 * One process. One port. One launchd plist. One log file.
 */

import { join } from "path"
import { readFileSync, existsSync } from "fs"
import { loadLifeosConfig } from "../TOOLS/LifeosConfig"
import { isLoopbackHostHeader } from "./lib/host-guard.ts"
import { PULSE_PORT } from "./endpoint"

// ── Load .env before anything else ──

const HOME = process.env.HOME ?? process.env.USERPROFILE ?? homedir()
const LIFEOS_DIR = join(HOME, ".claude", "LIFEOS")
const PULSE_DIR = join(LIFEOS_DIR, "PULSE")

const envPath = join(HOME, ".claude", ".env")
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
// Strip ANTHROPIC_API_KEY and ANTHROPIC_AUTH_TOKEN from the daemon environment
// AFTER .env load. Every downstream module (imessage, siri, spawnClaude)
// inherits this. Prevents the Claude Agent SDK and `claude` CLI from billing
// either key instead of CLAUDE_CODE_OAUTH_TOKEN — both outrank OAuth in
// Anthropic's auth precedence chain. root cause of an early-2026 invoice
// ($XXX / $XXX Sonnet + $YY WebSearch). Each module also strips independently
// for belt-and-suspenders. Mirrors LIFEOS/TOOLS/Inference.ts:116-117.
delete process.env.ANTHROPIC_API_KEY
delete process.env.ANTHROPIC_AUTH_TOKEN

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
  parseConfigToml,
  resolveModules,
} from "./lib"

import { startHooks, handleHooksRequestAsync, hooksHealth } from "./modules/hooks"
import { homedir } from "node:os";

// Conditional imports — modules may not exist yet during incremental migration
let voiceModule: any = null
let observabilityModule: any = null
let wikiModule: any = null
let siriModule: any = null
let imessageModule: any = null
let assistantModule: any = null
let performanceModule: any = null
let syslogModule: any = null
let workModule: any = null
let localIntelligenceModule: any = null
let telosModule: any = null
let tabFreshnessModule: any = null
let hypothesesModule: any = null
let upgradesModule: any = null
let memoryModule: any = null
let conduitModule: any = null
let menubarModule: any = null
let booksModule: any = null
let synapseModule: any = null
let ledgerModule: any = null
let projectsModule: any = null
let assetsModule: any = null
let atlasModule: any = null
let threatModelModule: any = null
let usageModule: any = null
let bunkerModule: any = null
let contentModule: any = null
let doctorModule: any = null
let algorithmTabModule: any = null
let evalsModule: any = null
let hermesModule: any = null

// Module gates read config.modules — one resolved map layering MODULE_DEFAULTS,
// the legacy [section].enabled flags, then the [modules] table. Infrastructure
// (observability, hooks, siri, tab-freshness, menubar, doctor) stays ungated:
// it is how Pulse serves anything at all, not a surface you switch off.
// ported from public PR #1748, @elhoim
async function loadModules(config: PulseConfig) {
  if (config.modules.voice) {
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
  // Wiki module — the /docs surface.
  if (config.modules.docs) {
    try {
      wikiModule = await import("./modules/wiki")
    } catch (err) {
      log("warn", "Wiki module not available", { error: String(err) })
    }
  }
  if (config.modules.imessage) {
    try {
      imessageModule = await import("./modules/imessage")
    } catch (err) {
      log("warn", "iMessage module not available", { error: String(err) })
    }
  }
  // Siri voice-turn endpoint — always load; fails closed without SIRI_API_KEY
  try {
    siriModule = await import("./modules/siri")
  } catch (err) {
    log("warn", "Siri module not available", { error: String(err) })
  }
  // Assistant (DA subsystem) is a private module stripped from the public
  // release payload. Existence-check before importing so a fresh public install
  // boots cleanly and simply omits the /assistant routes. #1419.
  if (config.modules.da && existsSync(join(PULSE_DIR, "Assistant", "module.ts"))) {
    try {
      assistantModule = await import("./Assistant/module")
    } catch (err) {
      log("warn", "Assistant module not available", { error: String(err) })
    }
  }
  if (config.modules.performance) {
    try {
      performanceModule = await import("./Performance/module")
    } catch (err) {
      log("warn", "Performance module not available", { error: String(err) })
    }
  }
  if (config.modules.syslog) {
    try {
      syslogModule = await import("./modules/syslog")
    } catch (err) {
      log("warn", "Syslog module not available", { error: String(err) })
    }
  }
  if (config.modules.work) {
    try {
      workModule = await import("./modules/work")
    } catch (err) {
      log("warn", "Work module not available", { error: String(err) })
    }
  }
  if (config.modules.content) {
    try {
      contentModule = await import("./modules/content")
    } catch (err) {
      log("warn", "Content module not available", { error: String(err) })
    }
  }
  if (config.modules.local) {
    try {
      localIntelligenceModule = await import("./modules/local-intelligence")
    } catch (err) {
      log("warn", "LocalIntelligence module not available", { error: String(err) })
    }
  }
  if (config.modules.telos) {
    try {
      telosModule = await import("./modules/telos")
      // Without this, state.running stays false and /api/telos/health reports
      // "stopped" forever while every other telos endpoint works.
      // public PR #1622, @elhoim
      if (telosModule.start) await telosModule.start()
    } catch (err) {
      log("warn", "Telos freshness module not available", { error: String(err) })
    }
  }
  if (config.modules.hypotheses) {
    try {
      hypothesesModule = await import("./modules/hypotheses")
      if (hypothesesModule.start) hypothesesModule.start()
    } catch (err) {
      log("warn", "Hypotheses module not available", { error: String(err) })
    }
  }
  if (config.modules.upgrades) {
    try {
      upgradesModule = await import("./modules/upgrades")
      if (upgradesModule.start) upgradesModule.start()
    } catch (err) {
      log("warn", "Upgrades module not available", { error: String(err) })
    }
  }
  // Tab freshness — universal per-tab data-source freshness (always loaded).
  try {
    tabFreshnessModule = await import("./modules/tab-freshness")
  } catch (err) {
    log("warn", "Tab freshness module not available", { error: String(err) })
  }
  // Memory — autonomic-memory subsystem state surface.
  if (config.modules.memory) {
    try {
      memoryModule = await import("./modules/memory")
      if (memoryModule.start) memoryModule.start()
    } catch (err) {
      log("warn", "Memory module not available", { error: String(err) })
    }
  }
  // Conduit — sensory layer daily-record surface (read-only; capture is launchd).
  if (config.modules.conduit) {
    try {
      conduitModule = await import("./modules/conduit")
      if (conduitModule.start) conduitModule.start()
    } catch (err) {
      log("warn", "Conduit module not available", { error: String(err) })
    }
  }
  // Menu bar — cross-subsystem aggregator behind the rich native menu bar dropdown.
  try {
    menubarModule = await import("./modules/menubar")
    if (menubarModule.start) menubarModule.start()
  } catch (err) {
    log("warn", "Menubar module not available", { error: String(err) })
  }
  // Books — favorite-books surface over USER/BOOKS.md.
  if (config.modules.books) {
    try {
      booksModule = await import("./modules/books")
      if (booksModule.start) booksModule.start()
    } catch (err) {
      log("warn", "Books module not available", { error: String(err) })
    }
  }
  // Synapse — input routing & capture surface (ledger, knowledge, bookmarks, flows).
  if (config.modules.synapse) {
    try {
      synapseModule = await import("./modules/synapse")
      if (synapseModule.start) synapseModule.start()
    } catch (err) {
      log("warn", "Synapse module not available", { error: String(err) })
    }
  }
  // Ledger — change-tracking surface (versions, update registry, deploys, integrity, drift).
  if (config.modules.ledger) {
    try {
      ledgerModule = await import("./modules/ledger")
      if (ledgerModule.start) ledgerModule.start()
    } catch (err) {
      log("warn", "Ledger module not available", { error: String(err) })
    }
  }
  // Projects — project routing-table surface over USER/PROJECTS.md.
  if (config.modules.projects) {
    try {
      projectsModule = await import("./modules/projects")
      if (projectsModule.start) await projectsModule.start()
    } catch (err) {
      log("warn", "Projects module not available", { error: String(err) })
    }
  }
  // Assets — unified read-only inventory over USER/GEAR.md + network topology.
  if (config.modules.gear) {
    try {
      assetsModule = await import("./modules/assets")
      if (assetsModule.start) await assetsModule.start()
    } catch (err) {
      log("warn", "Assets module not available", { error: String(err) })
    }
  }
  // Atlas — read-only surface over the asset-graph snapshot (LIFEOS/ATLAS).
  if (config.modules.atlas) {
    try {
      atlasModule = await import("./modules/atlas")
      if (atlasModule.start) atlasModule.start()
    } catch (err) {
      log("warn", "Atlas module not available", { error: String(err) })
    }
  }
  // ThreatModel — read-only surface over the private risk register
  // (skills/ThreatModel; data in LIFEOS/USER/SECURITY/THREATMODEL).
  if (config.modules.threatmodel) {
    try {
      threatModelModule = await import("./modules/threatmodel")
      if (threatModelModule.start) threatModelModule.start()
    } catch (err) {
      log("warn", "ThreatModel module not available", { error: String(err) })
    }
  }
  // Usage — Anthropic subscription + durable token/cost/model usage surface.
  if (config.modules.usage) {
    try {
      usageModule = await import("./modules/usage")
      if (usageModule.start) await usageModule.start()
    } catch (err) {
      log("warn", "Usage module not available", { error: String(err) })
    }
  }
  // Bunker — application-harness registry surface (reads ~/.claude/LIFEOS/PULSE/Bunker via its CLI).
  if (config.modules.bunker) {
    try {
      bunkerModule = await import("./modules/bunker")
    } catch (err) {
      log("warn", "Bunker module not available", { error: String(err) })
    }
  }
  // Doctor — read-only System Health surface over the advisory capability
  // manifest + heartbeat written by LIFEOS/TOOLS/Doctor.ts (always loaded).
  try {
    doctorModule = await import("./modules/doctor")
    if (doctorModule.start) await doctorModule.start()
  } catch (err) {
    log("warn", "Doctor module not available", { error: String(err) })
  }
  // Hermes — the sidecar's core files: SOUL, config, guard policy, and the code
  // that generates them. Read/edit surface behind the Assistant tab.
  if (config.modules.hermes) {
    try {
      hermesModule = await import("./modules/hermes")
      if (hermesModule.start) hermesModule.start()
    } catch (err) {
      log("warn", "Hermes module not available", { error: String(err) })
    }
  }
  // Algorithm — the thinking chain surface: doctrine (versioned edits), rules
  // files, AI-generated workflow summary for the /algorithm tab.
  if (config.modules.algorithm) {
    try {
      algorithmTabModule = await import("./modules/algorithm-tab")
      if (algorithmTabModule.start) algorithmTabModule.start()
    } catch (err) {
      log("warn", "AlgorithmTab module not available", { error: String(err) })
    }
  }
  // Evals — standing eval-suite status (pass^k, regressions) for the /algorithm tab.
  if (config.modules.evals) {
    try {
      evalsModule = await import("./modules/evals")
    } catch (err) {
      log("warn", "Evals module not available", { error: String(err) })
    }
  }
}

// ── Config Types ──

interface PulseConfig {
  port: number
  /**
   * Resolved on/off state for every switchable surface. See MODULE_DEFAULTS.
   * ported from public PR #1748, @elhoim
   */
  modules: Record<string, boolean>
  tls?: { enabled: boolean; cert: string; key: string } // unused — TLS removed
  voice?: { enabled: boolean; [key: string]: unknown }
  imessage?: { enabled: boolean; [key: string]: unknown }
  observability?: { enabled: boolean; dashboard_dir?: string; [key: string]: unknown }
  hooks?: { enabled: boolean; blocked_skills?: string[] }
  da?: { enabled: boolean; primary?: string; [key: string]: unknown }
  performance?: { enabled: boolean; [key: string]: unknown }
  syslog?: { enabled: boolean; port?: number; [key: string]: unknown }
  work?: { enabled: boolean; [key: string]: unknown }
  bunker?: { enabled: boolean; [key: string]: unknown }
  content?: { enabled: boolean; [key: string]: unknown }
  local_intelligence?: { enabled: boolean; [key: string]: unknown }
  telos?: { enabled: boolean; [key: string]: unknown }
  hypotheses?: { enabled: boolean; [key: string]: unknown }
  upgrades?: { enabled: boolean; [key: string]: unknown }
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
    timeout_ms?: number
  }>
}

// ── Load Unified Config ──

async function loadPulseConfig(): Promise<PulseConfig> {
  const raw = await Bun.file(join(PULSE_DIR, "PULSE.toml")).text()
  // parseConfigToml expands ${VAR} in every string value (public PR #1544,
  // @m8ryx), so config sections can carry secrets by reference (e.g. [discord]
  // bot_token) instead of literal values checked into the file.
  const parsed = parseConfigToml(raw)

  const daemonConfig = await loadConfig(PULSE_DIR)

  // Converge DA identity on one source of truth (PR #1459, author anikin-xyz): PULSE.toml
  // ships a placeholder [da].primary, but the DA's real name lives in LIFEOS_CONFIG.toml
  // [da].name. Defer to it when present; fresh installs without the user config keep PULSE.toml.
  const da = (parsed.da as PulseConfig["da"]) ?? { enabled: false }
  try {
    const daName = loadLifeosConfig().da.name
    if (daName) da.primary = daName
  } catch { /* LIFEOS_CONFIG.toml absent/invalid — keep PULSE.toml value */ }

  // User-tier overrides (PULSE.user.toml, release-stripped): machine-specific
  // module choices layer over the shipped template, so the template stays
  // generic while a live instance keeps e.g. its syslog collector on. The
  // [syslog] section merges too — its `port` is what the collector binds
  // (exported to PULSE_SYSLOG_PORT before syslogModule.start() below).
  const userParsed = daemonConfig.userParsed
  const systemSyslog = (parsed.syslog as PulseConfig["syslog"]) ?? { enabled: false, port: 5514 }
  const userSyslog = userParsed?.syslog as PulseConfig["syslog"] | undefined

  return {
    // Same resolver as every client/guard (endpoint.ts) so the server bind and
    // the port-dependent security sites can never disagree. #2392
    port: (parsed.port as number) ?? PULSE_PORT,
    modules: resolveModules(parsed, userParsed),
    tls: (parsed.tls as PulseConfig["tls"]) ?? undefined,
    voice: (parsed.voice as PulseConfig["voice"]) ?? { enabled: true },
    imessage: (parsed.imessage as PulseConfig["imessage"]) ?? { enabled: false },
    observability: (parsed.observability as PulseConfig["observability"]) ?? { enabled: true },
    performance: (parsed.performance as PulseConfig["performance"]) ?? { enabled: true },
    syslog: userSyslog ? { ...systemSyslog, ...userSyslog } : systemSyslog,
    work: (parsed.work as PulseConfig["work"]) ?? { enabled: true },
    bunker: (parsed.bunker as PulseConfig["bunker"]) ?? { enabled: true },
    content: (parsed.content as PulseConfig["content"]) ?? { enabled: true },
    telos: (parsed.telos as PulseConfig["telos"]) ?? { enabled: true },
    hooks: (parsed.hooks as PulseConfig["hooks"]) ?? { enabled: true },
    da,
    worker: parsed.worker as PulseConfig["worker"],
    jobs: daemonConfig.jobs,
  }
}

// ── Constants ──

// Life surfaces served directly by observability.ts rather than by a module of
// their own, mapped to the module key that switches them off. Hoisted to module
// scope so the request path doesn't rebuild it on every hit.
// ported from public PR #1748, @elhoim
const LIFE_ROUTE_MODULES: Record<string, string> = {
  "/api/life/health": "health",
  "/api/life/finances": "finances",
  "/api/life/business": "business",
  "/api/life/growth": "growth",
}

const STATE_PATH = join(PULSE_DIR, "state", "state.json")
const PID_PATH = join(PULSE_DIR, "state", "pulse.pid")
const MAX_FAILURES = 3
// A latched job (>= MAX_FAILURES) gets one retry attempt after this cooldown
// instead of being dead until manual state surgery — three transient failures
// (e.g. during an outage window) previously disabled a job permanently.
const FAILURE_RETRY_COOLDOWN_MS = 6 * 60 * 60 * 1000
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
      try {
        if (matchesCron(job.schedule, future)) return offset * 60_000
      } catch {
        // An unusable schedule is never due. Already reported by name at load
        // time; sleeping is not the place to report it again every tick.
        // public PR #1644, @elhoim
      }
    }
  }
  return MAX_SLEEP_MS
}

// ── Unified Health Response ──

// Content-liveness: the process being alive doesn't mean the product works.
// 2026-06-10 incident: a fresh re-clone of ~/.claude wiped the gitignored
// Next.js export (Observability/out/), every page 404'd for 13+ hours while
// /healthz reported "ok". The dashboard asset check makes /healthz truthful.
function dashboardDir(config: PulseConfig): string {
  const dir = config.observability?.dashboard_dir ?? "Observability/out"
  return dir.startsWith("/") ? dir : join(PULSE_DIR, dir)
}

function dashboardHealth(config: PulseConfig): { status: "ok" | "missing"; indexPath: string } {
  const indexPath = join(dashboardDir(config), "index.html")
  return { status: existsSync(indexPath) ? "ok" : "missing", indexPath }
}

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
  if (voiceModule && config.modules.voice) {
    subsystems.voice = voiceModule.voiceHealth()
  }

  // Observability
  if (observabilityModule && config.observability?.enabled !== false) {
    subsystems.observability = observabilityModule.observabilityHealth()
  }

  // Performance
  if (performanceModule && config.modules.performance) {
    subsystems.performance = performanceModule.performanceHealth()
  }

  // iMessage
  if (imessageModule && config.modules.imessage) {
    subsystems.imessage = imessageModule.imessageHealth()
  }

  // Assistant
  if (assistantModule && config.modules.da) {
    subsystems.assistant = assistantModule.assistantHealth()
  }

  // Syslog
  if (syslogModule && config.modules.syslog) {
    subsystems.syslog = syslogModule.health()
  }

  // Dashboard assets (content-liveness, not just process-liveness)
  const dash = dashboardHealth(config)
  subsystems.dashboard = dash

  // Truthful top-level status: degraded when the dashboard build is missing
  // or any cron job has hit the failure ceiling. Reasons name the cause.
  const reasons: string[] = []
  if (dash.status === "missing") {
    reasons.push(`dashboard build missing: ${dash.indexPath} — run: cd ${PULSE_DIR}/Observability && bun install && bun run build`)
  }
  // Only enabled jobs count toward degraded — a disabled job's stale failure
  // counter would otherwise pin healthz at "degraded" forever.
  const enabledJobNames = new Set(config.jobs.filter((j) => j.enabled).map((j) => j.name))
  for (const [name, s] of Object.entries(state.jobs)) {
    if (!enabledJobNames.has(name)) continue
    if (s.consecutiveFailures >= MAX_FAILURES) reasons.push(`job ${name}: ${s.consecutiveFailures} consecutive failures`)
  }
  const status = reasons.length === 0 ? "ok" : "degraded"

  // HTTP 503 ONLY for genuinely unservable conditions (missing dashboard
  // build). Job failures are routine/transient — they report as degraded in
  // the BODY but stay HTTP 200, so monitors keying on the status code don't
  // alarm-fatigue or restart-loop a healthy server over a flaky cron job.
  const httpStatus = dash.status === "missing" ? 503 : 200

  return Response.json({
    status,
    reasons,
    service: "pulse",
    pid: process.pid,
    port: config.port,
    startedAt: new Date(state.startedAt).toISOString(),
    uptime: Math.round((Date.now() - state.startedAt) / 1000),
    subsystems,
  }, { status: httpStatus })
}

// ── Main ──

async function main() {
  // Singleton guard — a second live pulse.ts means duplicate pollers, cron
  // jobs, and voice servers fighting over the same state (2026-07-09 incident:
  // an orphaned hand-launched pulse fought the launchd one for hours).
  // Refuse to boot instead.
  try {
    const oldPid = parseInt((await Bun.file(PID_PATH).text()).trim(), 10)
    if (oldPid && oldPid !== process.pid) {
      process.kill(oldPid, 0) // throws if oldPid is dead → guard passes
      const cmd = new TextDecoder()
        .decode(Bun.spawnSync(["ps", "-p", String(oldPid), "-o", "command="]).stdout)
        .trim()
      if (cmd.includes("pulse.ts")) {
        log("error", "Another pulse.ts is already running — refusing to start a duplicate", {
          existingPid: oldPid,
          existingCommand: cmd,
        })
        process.exit(1)
      }
    }
  } catch { /* stale or missing pid file — normal boot */ }

  await Bun.write(PID_PATH, String(process.pid))

  const config = await loadPulseConfig()
  let state = await readState(STATE_PATH)
  state.startedAt = Date.now()

  // Drop state for jobs the config no longer declares. A renamed or deleted
  // job otherwise leaves its JobState behind forever — it accumulates in
  // state.json and keeps surfacing in anything that walks state.jobs.
  // Keyed on config.jobs, NOT the enabled subset: a job switched off in TOML
  // is still declared, and must keep its run history for when it comes back.
  // public issue #1768, @xmasyx
  const declaredJobNames = new Set(config.jobs.map((j) => j.name))
  for (const name of Object.keys(state.jobs)) {
    if (!declaredJobNames.has(name)) {
      log("info", `Pruning state for job no longer in config: ${name}`, {
        job: name,
        subsystem: "cron",
      })
      delete state.jobs[name]
    }
  }

  const enabledJobs = config.jobs.filter((j) => j.enabled)
  log("info", "LifeOS Pulse starting (unified daemon)", {
    pid: process.pid,
    port: config.port,
    jobs: enabledJobs.length,
    // Report the RESOLVED state, so the boot line matches what actually
    // loaded. hooks/observability are infrastructure and have no module key.
    modules: {
      voice: config.modules.voice,
      hooks: config.hooks?.enabled !== false,
      observability: config.observability?.enabled !== false,
      imessage: config.modules.imessage,
      syslog: config.modules.syslog,
      da: config.modules.da,
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

  // ── Startup self-check: content-liveness (2026-06-10 incident) ──
  // A missing dashboard export means every page 404s while the process looks
  // healthy. Scream at boot so the failure is visible in logs immediately.
  const dashAtBoot = dashboardHealth(config)
  if (dashAtBoot.status === "missing") {
    log("error", "DASHBOARD BUILD MISSING — all dashboard pages will 503 until rebuilt", {
      expected: dashAtBoot.indexPath,
      fix: `cd ${PULSE_DIR}/Observability && bun install && bun run build`,
    })
  }

  // ── Initialize Modules ──
  if (config.hooks?.enabled !== false) {
    startHooks(config.hooks ?? { enabled: true })
  }

  // These start-time gates read the same resolved config.modules keys as the
  // load-time gates above. Reading the legacy [section].enabled flag here
  // instead would let the two disagree — a module enabled via the [modules]
  // table but disabled by a stale legacy flag would load and then never start.
  // public PR #1748, @elhoim
  if (voiceModule && config.modules.voice) {
    voiceModule.startVoice(config.voice)
    log("info", "Voice module loaded")
  }

  if (observabilityModule && config.observability?.enabled !== false) {
    observabilityModule.startObservability(config.observability)
    log("info", "Observability module loaded")
  }

  if (performanceModule && config.modules.performance) {
    performanceModule.startPerformance(config.performance)
    log("info", "Performance module loaded")
  }

  if (wikiModule) {
    wikiModule.startWiki()
    log("info", "Wiki module loaded")
  }

  if (assistantModule && config.modules.da) {
    // Pass ALL jobs (not just enabled) so the dashboard can render every
    // job from disk — visible, editable, removable. The cron loop still
    // filters by enabled at execution time; visibility is a separate axis.
    assistantModule.startAssistant(config.da, config.jobs)
    log("info", "Assistant module loaded")
  }

  if (syslogModule && config.modules.syslog) {
    try {
      if (config.syslog?.port) process.env.PULSE_SYSLOG_PORT = String(config.syslog.port)
      await syslogModule.start()
      log("info", "Syslog module loaded")
    } catch (err) {
      log("error", "Syslog module failed to start", { error: String(err) })
      syslogModule = null
    }
  }

  if (workModule && config.modules.work) {
    try {
      await workModule.start()
      log("info", "Work module loaded")
    } catch (err) {
      log("error", "Work module failed to start", { error: String(err) })
      workModule = null
    }
  }

  if (bunkerModule && config.modules.bunker) {
    try {
      await bunkerModule.start()
      log("info", "Bunker module loaded")
    } catch (err) {
      log("error", "Bunker module failed to start", { error: String(err) })
      bunkerModule = null
    }
  }

  if (contentModule && config.modules.content) {
    try {
      await contentModule.start()
      log("info", "Content module loaded")
    } catch (err) {
      log("error", "Content module failed to start", { error: String(err) })
      contentModule = null
    }
  }

  // config.local_intelligence was never populated by loadPulseConfig, so this
  // second gate read undefined and always passed. Same resolved key as the
  // load-time gate. public PR #1748, @elhoim
  if (localIntelligenceModule && config.modules.local) {
    try {
      await localIntelligenceModule.start()
      log("info", "LocalIntelligence module loaded")
    } catch (err) {
      log("error", "LocalIntelligence module failed to start", { error: String(err) })
      localIntelligenceModule = null
    }
  }

  // ── HTTP/HTTPS Server (single port, all routes) ──

  // Bind loopback by default — safe for public release on shared networks.
  // Opt in to all-interface binding (for LAN access from phone, Mac mini
  // fleet, etc.) via LIFEOS_PULSE_BIND_ALL=1 in the env or .env file.
  const bindAll = (process.env.LIFEOS_PULSE_BIND_ALL ?? "").trim() === "1"
  const server = Bun.serve({
    hostname: bindAll ? "0.0.0.0" : "127.0.0.1",
    port: config.port,
    async fetch(req) {
      const url = new URL(req.url)
      const pathname = url.pathname

      // Anti-DNS-rebinding (loopback-only mode): reject any request whose Host header isn't
      // loopback. A rebinding page the user visits sends its own hostname; real local clients
      // send 127.0.0.1/localhost or omit Host. Disabled under LIFEOS_PULSE_BIND_ALL (LAN opt-in
      // sends a non-loopback Host by design). Guard logic + tests in lib/host-guard.ts.
      if (!bindAll && !isLoopbackHostHeader(req.headers.get("host"), config.port)) {
        return new Response("forbidden: non-loopback Host header", { status: 403 })
      }

      // Health (unified) — moved to /api/pulse/health to avoid conflict with Life Dashboard /health page
      if (req.method === "GET" && (pathname === "/api/pulse/health" || pathname === "/healthz")) {
        return buildHealthResponse(state, config)
      }

      // Which surfaces are switched on. The dashboard reads this to avoid
      // rendering a tab whose backend was never loaded — without it, disabling a
      // module leaves a nav entry that opens an empty page.
      // ported from public PR #1748, @elhoim
      if (req.method === "GET" && pathname === "/api/config/modules") {
        return Response.json({ modules: config.modules })
      }

      // Voice routes: /notify, /notify/personality, /voice, /voice/health
      // (/voice/health is implemented and advertised by the module but was never
      // forwarded, so it 404'd — public PR #1621, @elhoim)
      if (voiceModule && (pathname === "/notify" || pathname === "/notify/personality" || pathname === "/voice" || pathname === "/voice/health")) {
        const resp = await voiceModule.handleVoiceRequest(req, pathname)
        if (resp) return resp
      }

      // Hook routes: /hooks/*
      if (pathname.startsWith("/hooks/")) {
        const resp = await handleHooksRequestAsync(req, pathname)
        if (resp) return resp
      }

      // Siri voice-turn route: POST /api/siri/turn (bearer-authed, tunnel-exposed)
      if (siriModule && pathname.startsWith("/api/siri")) {
        const resp = await siriModule.handleSiriRequest(req, pathname)
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

      // Hermes sidecar core-file routes: /api/hermes*
      if (hermesModule && pathname.startsWith("/api/hermes")) {
        const resp = await hermesModule.handleRequest(req, pathname)
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

      // Work routes: /api/work/*  (data API consumed by the dashboard /work tab)
      if (workModule && pathname.startsWith("/api/work")) {
        const resp = await workModule.handleRequest(req, pathname)
        if (resp) return resp
      }

      // Evals route: /api/evals  (standing eval-suite status for the /algorithm tab)
      if (evalsModule && pathname.startsWith("/api/evals")) {
        const resp = await evalsModule.handleRequest(req, pathname)
        if (resp) return resp
      }

      // Content routes: /api/content/*  (Conveyor board API consumed by the dashboard /content tab)
      if (contentModule && pathname.startsWith("/api/content")) {
        const resp = await contentModule.handleRequest(req, pathname)
        if (resp) return resp
      }

      // Bunker routes: /api/bunker/*  (data API consumed by the dashboard /bunker tab)
      if (bunkerModule && pathname.startsWith("/api/bunker")) {
        const resp = await bunkerModule.handleRequest(req, pathname)
        if (resp) return resp
      }

      // LocalIntelligence routes: /api/local-intelligence[/refresh|/status]
      if (localIntelligenceModule && pathname.startsWith("/api/local-intelligence")) {
        const resp = await localIntelligenceModule.handleRequest(req, pathname)
        if (resp) return resp
      }

      // Telos + multi-file freshness: /api/telos/freshness[*], /api/freshness[*]
      if (telosModule && (pathname.startsWith("/api/telos") || pathname.startsWith("/api/freshness"))) {
        const resp = await telosModule.handleRequest(req, pathname)
        if (resp) return resp
      }

      // Tab freshness: /api/tab-freshness?tab=<id>
      if (tabFreshnessModule && pathname === "/api/tab-freshness") {
        const resp = await tabFreshnessModule.handleRequest(req, pathname)
        if (resp) return resp
      }

      // Hypotheses API: /api/hypotheses[/...]. The /hypotheses page itself is
      // a Next.js tab inside Observability — only the JSON API is served here.
      if (hypothesesModule && pathname.startsWith("/api/hypotheses")) {
        const resp = await hypothesesModule.handleRequest(req, pathname)
        if (resp) return resp
      }

      // Upgrades API: /api/upgrades[/...] — the unified system-improvement
      // queue (Upgrades store + pending hypotheses mapped as source=autonomous).
      if (upgradesModule && pathname.startsWith("/api/upgrades")) {
        const resp = await upgradesModule.handleRequest(req, pathname)
        if (resp) return resp
      }

      // Memory API: /api/memory[/state|/health|/runs]
      if (memoryModule && pathname.startsWith("/api/memory")) {
        const resp = await memoryModule.handleRequest(req, pathname)
        if (resp) return resp
      }

      // Conduit API: /api/conduit[/today|/recent|/sources|/insight|/insight/build|/status]
      if (conduitModule && pathname.startsWith("/api/conduit")) {
        const resp = await conduitModule.handleRequest(req, pathname)
        if (resp) return resp
      }

      // Menu bar API: /api/menubar (cross-subsystem aggregate for the native menu bar app)
      if (menubarModule && pathname.startsWith("/api/menubar")) {
        const resp = await menubarModule.handleRequest(req, pathname)
        if (resp) return resp
      }

      // Books API: /api/books
      if (booksModule && pathname.startsWith("/api/books")) {
        const resp = await booksModule.handleRequest(req, pathname)
        if (resp) return resp
      }

      // Synapse API: /api/synapse
      if (synapseModule && pathname.startsWith("/api/synapse")) {
        const resp = await synapseModule.handleRequest(req, pathname)
        if (resp) return resp
      }

      // Ledger API: /api/ledger
      if (ledgerModule && pathname.startsWith("/api/ledger")) {
        const resp = await ledgerModule.handleRequest(req, pathname)
        if (resp) return resp
      }

      // Projects API: /api/projects (before the observability /api/* catch-all)
      if (projectsModule && pathname.startsWith("/api/projects")) {
        const resp = await projectsModule.handleRequest(req, pathname)
        if (resp) return resp
      }

      // Assets API: /api/assets
      if (assetsModule && pathname.startsWith("/api/assets")) {
        const resp = await assetsModule.handleRequest(req, pathname)
        if (resp) return resp
      }

      // Atlas API: /api/atlas (asset-graph snapshot)
      if (atlasModule && pathname.startsWith("/api/atlas")) {
        const resp = await atlasModule.handleRequest(req, pathname)
        if (resp) return resp
      }

      // ThreatModel API: /api/threatmodel (risk-register posture, redacted)
      if (threatModelModule && pathname.startsWith("/api/threatmodel")) {
        const resp = await threatModelModule.handleRequest(req, pathname)
        if (resp) return resp
      }

      // Usage API: /api/usage/*
      if (usageModule && pathname.startsWith("/api/usage")) {
        const resp = await usageModule.handleRequest(req, pathname)
        if (resp) return resp
      }

      // Doctor API: /api/doctor (System Health — capabilities, heartbeat, hook reconcile)
      if (doctorModule && pathname.startsWith("/api/doctor")) {
        const resp = await doctorModule.handleRequest(req, pathname)
        if (resp) return resp
      }

      // Algorithm tab API: /api/algorithm-tab/* (thinking chain: doctrine, rules, summary)
      if (algorithmTabModule && pathname.startsWith("/api/algorithm-tab")) {
        const resp = await algorithmTabModule.handleRequest(req, pathname)
        if (resp) return resp
      }

      // The HEALTH / FINANCES / BUSINESS / GROWTH surfaces have no module of
      // their own — observability.ts serves them directly — so switching them
      // off has to happen here, at the route, rather than at module load.
      // ported from public PR #1748, @elhoim
      const lifeModule = LIFE_ROUTE_MODULES[pathname]
      if (lifeModule && !config.modules[lifeModule]) {
        return Response.json({ error: "module disabled", module: lifeModule }, { status: 404 })
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

      // Missing-build guard: a page-like GET that fell through while the
      // dashboard export is absent gets an explanatory 503, never a bare 404
      // with green health lights (2026-06-10 incident).
      if (req.method === "GET" && !pathname.includes(".") && !pathname.startsWith("/api/") && dashboardHealth(config).status === "missing") {
        const cmd = `cd ${PULSE_DIR}/Observability && bun install && bun run build`
        return new Response(
          `<!doctype html><html><head><title>Pulse — dashboard build missing</title></head>` +
          `<body style="font-family:monospace;background:#0a0a0a;color:#e5e5e5;padding:3rem;max-width:48rem">` +
          `<h1 style="color:#f87171">Pulse is running, but the dashboard build is missing</h1>` +
          `<p>The server and APIs are up. The Next.js static export at <code>Observability/out/</code> ` +
          `does not exist (usually a fresh clone or cleaned build artifacts).</p>` +
          `<p>Rebuild it:</p><pre style="background:#171717;padding:1rem">${cmd}</pre>` +
          `<p>Then reload — no Pulse restart needed.</p>` +
          `<p><a style="color:#60a5fa" href="/healthz">/healthz</a> shows full subsystem status.</p>` +
          `</body></html>`,
          { status: 503, headers: { "Content-Type": "text/html" } },
        )
      }

      return new Response("Not found", { status: 404 })
    },
  })

  log("info", "HTTP server listening", { port: server.port })

  // Menu bar app is launched by its own launchd agent (com.lifeos.pulse-menubar)
  // Do NOT spawn it here — that causes duplicate menu bar icons

  // ── Start Long-Running Subsystems (supervised) ──

  if (imessageModule && config.modules.imessage) {
    supervise("imessage", () => imessageModule.startIMessage(config.imessage), isShuttingDown)
    log("info", "iMessage module started (supervised)")
  }

  // ── Cron Heartbeat Loop ──

  // Preflight: a script job whose referenced script file doesn't exist on this
  // install (e.g. a private module stripped from the public release payload)
  // is disabled up front with one warning — it must not run, fail repeatedly,
  // and leave /healthz permanently degraded on an otherwise healthy install
  // (public issue #1392).
  const missingScriptJobs = new Set<string>()
  for (const job of config.jobs) {
    if (!job.enabled || job.type === "claude" || !job.command) continue
    const scriptRefs = job.command.match(/[^\s'"]+\.(?:ts|js|sh)\b/g) ?? []
    // Resolve like the executor does: spawnScript runs via bash -c, so "~/"
    // expands to HOME at runtime — the existence check must match or every
    // "~/" job gets falsely disabled as "not present on this install".
    const resolveRef = (p: string): string => {
      if (p.startsWith("~/")) return join(homedir(), p.slice(2))
      return p.startsWith("/") ? p : join(PULSE_DIR, p)
    }
    const missing = scriptRefs.filter((p) => !existsSync(resolveRef(p)))
    if (missing.length > 0) {
      missingScriptJobs.add(job.name)
      log("warn", `Disabling cron job ${job.name}: script not present on this install`, {
        missing,
        subsystem: "cron",
      })
    }
  }

  // Backstop for the same class of failure in the schedule itself. loadConfig()
  // already disables jobs whose cron expression doesn't validate; if one still
  // reaches the loop, it is skipped with one message instead of throwing out of
  // the loop into main().catch → exit(1) → supervised restart every 30s.
  // public PR #1644, @elhoim
  const badScheduleJobs = new Set<string>()

  while (!shuttingDown) {
    const tickStart = Date.now()
    const now = new Date()

    for (const job of config.jobs) {
      if (!job.enabled) continue
      if (missingScriptJobs.has(job.name)) continue
      if (badScheduleJobs.has(job.name)) continue
      if (shuttingDown) break

      const jobState = state.jobs[job.name]

      let due: boolean
      try {
        due = isDue(job.schedule, now, jobState?.lastRun)
      } catch (err) {
        badScheduleJobs.add(job.name)
        log("error", `Disabling cron job ${job.name}: unusable schedule`, {
          schedule: job.schedule,
          error: String(err),
          subsystem: "cron",
        })
        continue
      }
      if (!due) continue

      if ((jobState?.consecutiveFailures ?? 0) >= MAX_FAILURES) {
        const sinceLastRun = Date.now() - (jobState?.lastRun ?? 0)
        if (sinceLastRun < FAILURE_RETRY_COOLDOWN_MS) {
          log("warn", `Skipping ${job.name}: ${jobState!.consecutiveFailures} consecutive failures`, {
            lastResult: jobState!.lastResult,
          })
          continue
        }
        log("info", `Retrying ${job.name} after failure cooldown`, {
          consecutiveFailures: jobState!.consecutiveFailures,
          subsystem: "cron",
        })
      }

      log("info", `Running: ${job.name}`, { type: job.type, subsystem: "cron" })
      const startMs = Date.now()

      try {
        let output: string

        if (job.type === "claude") {
          output = await spawnClaude(job.prompt!, { model: job.model ?? "sonnet" })
        } else {
          output = await spawnScript(job.command!, job.timeout_ms)
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
  if (imessageModule) imessageModule.stopIMessage?.()
  if (assistantModule) assistantModule.stopAssistant?.()
  if (syslogModule) await syslogModule.stop?.()
  await writeState(STATE_PATH, state).catch(() => {})
  log("info", "LifeOS Pulse stopped", { uptimeMs: Date.now() - state.startedAt })
}

main().catch((err) => {
  log("error", "Pulse crashed", { error: String(err) })
  process.exit(1)
})
