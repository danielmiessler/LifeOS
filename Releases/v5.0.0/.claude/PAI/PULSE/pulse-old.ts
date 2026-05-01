#!/usr/bin/env bun
/**
 * PAI Pulse — The Proactive Layer
 *
 * A simple, reliable cron-aware watchdog.
 * Checks things on schedule, dispatches to existing services.
 * No channels, no queue, no AI triage — just run jobs and route output.
 */

import { join } from "path"
import { readFileSync } from "fs"

// ── Load .env before anything else ──

const envPath = join(process.env.HOME ?? "~", ".claude", ".env")
try {
  const envContent = readFileSync(envPath, "utf-8")
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eqIdx = trimmed.indexOf("=")
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let value = trimmed.slice(eqIdx + 1).trim()
    // Strip quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
} catch { /* .env not found — rely on process environment */ }

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

// ── Constants ──

const PULSE_DIR = join(process.env.HOME ?? "~", ".claude", "PAI", "PULSE")
const STATE_PATH = join(PULSE_DIR, "state", "state.json")
const PID_PATH = join(PULSE_DIR, "state", "pulse.pid")
const HOOK_PORT = parseInt(process.env.HOOK_SERVER_PORT || "8686", 10)
const MAX_FAILURES = 3
const MAX_SLEEP_MS = 60_000
const MIN_SLEEP_MS = 1_000

// ── Hook Server (absorbed from hook-server.ts) ──

const hookStats = {
  requests: 0,
  skillGuard: { total: 0, blocked: 0, passed: 0 },
  agentGuard: { total: 0, warned: 0, passed: 0 },
}

const BLOCKED_SKILLS = ["keybindings-help"]
const FAST_AGENT_TYPES = ["Explore"]
const FAST_MODELS = ["haiku"]

function handleSkillGuard(body: { tool_input?: { skill?: string } }): Response {
  hookStats.requests++
  hookStats.skillGuard.total++
  const skillName = (body.tool_input?.skill || "").toLowerCase().trim()

  if (BLOCKED_SKILLS.includes(skillName)) {
    hookStats.skillGuard.blocked++
    return Response.json({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: `BLOCKED: "${skillName}" is a known false-positive skill triggered by position bias. The user did NOT ask about keybindings. Continue with the ACTUAL task the user requested.`,
      },
    })
  }

  hookStats.skillGuard.passed++
  return new Response("", { status: 200 })
}

function handleAgentGuard(body: {
  tool_input?: { run_in_background?: boolean; subagent_type?: string; model?: string; prompt?: string; description?: string }
}): Response {
  hookStats.requests++
  hookStats.agentGuard.total++
  const ti = body.tool_input || {}

  if (ti.run_in_background === true || FAST_AGENT_TYPES.includes(ti.subagent_type || "") || FAST_MODELS.includes(ti.model || "")) {
    hookStats.agentGuard.passed++
    return new Response("", { status: 200 })
  }

  if (/##\s*Scope[\s\S]*?Timing:\s*FAST/i.test(ti.prompt || "")) {
    hookStats.agentGuard.passed++
    return new Response("", { status: 200 })
  }

  hookStats.agentGuard.warned++
  return Response.json({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      permissionDecisionReason: "Foreground agent warning",
      additionalContext: `WARNING: Foreground agent "${ti.description || ti.subagent_type || "unknown"}" — consider run_in_background: true`,
    },
  })
}

// ── Compute next due time ──

function msUntilNextDue(jobs: Array<{ schedule: string; enabled: boolean }>, state: DaemonState): number {
  const now = new Date()
  // Check every minute for the next 60 minutes to find when a job is next due
  for (let offset = 1; offset <= 60; offset++) {
    const future = new Date(now.getTime() + offset * 60_000)
    for (const job of jobs) {
      if (!job.enabled) continue
      if (matchesCron(job.schedule, future)) {
        return offset * 60_000
      }
    }
  }
  return MAX_SLEEP_MS
}

// ── Main ──

async function main() {
  // Write PID file
  await Bun.write(PID_PATH, String(process.pid))

  // Load config and state
  const config = await loadConfig(PULSE_DIR)
  let state = await readState(STATE_PATH)
  state.startedAt = Date.now()

  const enabledJobs = config.jobs.filter((j) => j.enabled)
  log("info", "PAI Pulse started", {
    pid: process.pid,
    jobs: enabledJobs.length,
    jobNames: enabledJobs.map((j) => j.name),
  })

  // Graceful shutdown
  let shuttingDown = false
  const shutdown = () => {
    if (shuttingDown) return
    shuttingDown = true
    log("info", "Shutting down gracefully")
  }
  process.on("SIGTERM", shutdown)
  process.on("SIGINT", shutdown)

  // ── Hook Validation Server (port 8686) ──

  const hookServer = Bun.serve({
    hostname: "127.0.0.1",
    port: HOOK_PORT,
    fetch(req) {
      const url = new URL(req.url)

      if (req.method === "GET" && url.pathname === "/health") {
        return Response.json({
          status: "ok",
          service: "pulse",
          pid: process.pid,
          port: HOOK_PORT,
          startedAt: new Date(state.startedAt).toISOString(),
          uptime: Math.round((Date.now() - state.startedAt) / 1000),
          jobs: Object.entries(state.jobs).map(([name, s]) => ({
            name,
            lastRun: new Date(s.lastRun).toISOString(),
            agoMs: Date.now() - s.lastRun,
            result: s.lastResult,
            failures: s.consecutiveFailures,
          })),
          hooks: hookStats,
        })
      }

      if (req.method !== "POST") return new Response("Method not allowed", { status: 405 })

      return (async () => {
        try {
          const body = await req.json()
          switch (url.pathname) {
            case "/hooks/skill-guard":
              return handleSkillGuard(body)
            case "/hooks/agent-guard":
              return handleAgentGuard(body)
            default:
              return new Response("Not found", { status: 404 })
          }
        } catch {
          hookStats.requests++
          return new Response("", { status: 200 }) // Fail open
        }
      })()
    },
  })

  log("info", "Hook server listening", { port: hookServer.port })

  // ── Heartbeat Loop ──

  while (!shuttingDown) {
    const tickStart = Date.now()
    const now = new Date()

    for (const job of config.jobs) {
      if (!job.enabled) continue
      if (shuttingDown) break

      const jobState = state.jobs[job.name]

      // Is this job due?
      if (!isDue(job.schedule, now, jobState?.lastRun)) continue

      // Circuit breaker: skip if too many consecutive failures
      if ((jobState?.consecutiveFailures ?? 0) >= MAX_FAILURES) {
        log("warn", `Skipping ${job.name}: ${jobState!.consecutiveFailures} consecutive failures`, {
          lastResult: jobState!.lastResult,
        })
        continue
      }

      // Execute
      log("info", `Running: ${job.name}`, { type: job.type })
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
          await dispatch(output, job.output, job.name)
          const targets = Array.isArray(job.output) ? job.output.join(", ") : job.output
          log("info", `${job.name} completed — dispatched to ${targets}`, {
            durationMs,
            outputPreview: output.slice(0, 200),
          })
        } else {
          log("info", `${job.name} completed — nothing to report`, { durationMs })
        }

        state.jobs[job.name] = { lastRun: Date.now(), lastResult: "ok", consecutiveFailures: 0 }
      } catch (err) {
        const failures = (jobState?.consecutiveFailures ?? 0) + 1
        state.jobs[job.name] = { lastRun: Date.now(), lastResult: "error", consecutiveFailures: failures }
        log("error", `${job.name} failed`, {
          error: String(err),
          failures,
          durationMs: Date.now() - startMs,
        })
      }

      // Persist state after each job
      await writeState(STATE_PATH, state).catch((err) =>
        log("error", "Failed to persist state", { error: String(err) })
      )
    }

    // Smart sleep: compute next due time, cap at 60s for SIGTERM responsiveness
    const nextDueMs = msUntilNextDue(config.jobs, state)
    const elapsed = Date.now() - tickStart
    const sleepMs = Math.max(MIN_SLEEP_MS, Math.min(nextDueMs - elapsed, MAX_SLEEP_MS))

    if (!shuttingDown) {
      await Bun.sleep(sleepMs)
    }
  }

  // Final cleanup
  hookServer.stop()
  await writeState(STATE_PATH, state).catch(() => {})
  log("info", "PAI Pulse stopped", { uptimeMs: Date.now() - state.startedAt })
}

main().catch((err) => {
  log("error", "Pulse crashed", { error: String(err) })
  process.exit(1)
})
