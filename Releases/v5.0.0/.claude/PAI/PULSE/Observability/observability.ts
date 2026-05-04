/**
 * PAI Pulse — Observability Module
 *
 * Observability module for the unified Pulse daemon.
 * Does NOT create its own HTTP server — the parent pulse.ts calls
 * handleObservabilityRequest() for matching routes.
 *
 * Route prefixes handled:
 *   GET  /api/algorithm              — Work sessions from work.json
 *   GET  /api/agents                 — Subagent events from JSONL
 *   GET  /api/events/recent          — Merged recent events
 *   GET  /api/observability/*        — Voice events, tool failures, state, events
 *   GET  /api/novelty                — Novelty state
 *   GET  /api/ladder                 — Ladder pipeline data
 *   GET  /api/knowledge               — Knowledge archive state (domains, notes, tags)
 *   GET  /api/security               — Security PATTERNS + SECURITY_RULES + audit events + hook health
 *   GET  /api/security/hooks-detail  — Hook descriptions
 *   GET  /api/onboarding/state       — Template mode flag + DA name (drives onboarding banner)
 *   POST /api/security/patterns      — PATTERNS.yaml mutations
 *   POST /api/security/rules         — SECURITY_RULES.md mutations
 *   POST /api/observability/state    — Hook data ingestion
 *   POST /api/observability/events   — Hook data ingestion
 *   GET  /api/loops                  — Stub
 *   GET  /, /work, /telos, /health, etc. — Static Next.js pages (fallback handler)
 */

import { join, extname } from "path"
import { readFileSync, readdirSync, existsSync, realpathSync } from "fs"
import YAML from "yaml"

// Bun is always the runtime here (Pulse launches this via `bun`). The Next
// tsconfig's DOM+esnext lib doesn't include bun-types, so declare the minimal
// surface we actually use. Narrow to what's called, not a global `any`.
declare const Bun: {
  file(path: string): {
    size: number
    exists(): Promise<boolean>
    stat(): Promise<{ mtime: Date }>
    text(): Promise<string>
  } & Blob
  write(path: string, content: string): Promise<number>
}

// ── Config ──

export interface ObservabilityConfig {
  enabled: boolean
  dashboard_dir?: string // path to Next.js out/ directory
}

// ── Path Construction ──

const HOME = process.env.HOME ?? ""
const PAI_DIR = join(HOME, ".claude", "PAI")
const MEMORY_DIR = join(PAI_DIR, "MEMORY")

const WORK_JSON_PATH = join(MEMORY_DIR, "STATE", "work.json")
const NOVELTY_STATE_PATH = join(MEMORY_DIR, "STATE", "novelty-state.json")
const SUBAGENT_EVENTS_PATH = join(MEMORY_DIR, "OBSERVABILITY", "subagent-events.jsonl")
const VOICE_EVENTS_PATH = join(MEMORY_DIR, "VOICE", "voice-events.jsonl")
const TOOL_FAILURES_PATH = join(MEMORY_DIR, "OBSERVABILITY", "tool-failures.jsonl")
const TOOL_ACTIVITY_PATH = join(MEMORY_DIR, "OBSERVABILITY", "tool-activity.jsonl")
const PATTERNS_PATH = join(PAI_DIR, "USER", "SECURITY", "PATTERNS.yaml")
const SECURITY_RULES_PATH = join(PAI_DIR, "USER", "SECURITY", "SECURITY_RULES.md")
const SECURITY_LOG_DIR = join(MEMORY_DIR, "SECURITY")
const SETTINGS_PATH = join(HOME, ".claude", "settings.json")
const LADDER_DIR = join(HOME, "Projects", "Ladder")

const DEFAULT_DASHBOARD_DIR = join(PAI_DIR, "PULSE", "Observability", "out")

// ── In-Memory Store (hook-pushed state/events) ──

let stateData = "{}"
let stateUpdatedAt: string | null = null
let eventsData = "[]"
let eventsUpdatedAt: string | null = null
let moduleStartedAt: string | null = null

// ── MIME Types ──

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
}

// ── Lifecycle ──

let config: ObservabilityConfig = { enabled: false }

export function startObservability(cfg: ObservabilityConfig): void {
  config = cfg
  moduleStartedAt = new Date().toISOString()
}

export function observabilityHealth(): Record<string, unknown> {
  return {
    module: "observability",
    enabled: config.enabled,
    startedAt: moduleStartedAt,
    lastStateAt: stateUpdatedAt,
    lastEventsAt: eventsUpdatedAt,
  }
}

// ── JSONL Helper ──

function readJsonlTail(filePath: string, maxLines = 100): any[] {
  try {
    if (!existsSync(filePath)) return []
    const raw = readFileSync(filePath, "utf-8")
    const lines = raw.trim().split("\n").filter(Boolean)
    return lines
      .slice(-maxLines)
      .map((line) => {
        try {
          return JSON.parse(line)
        } catch {
          return null
        }
      })
      .filter(Boolean)
  } catch {
    return []
  }
}

// ── Static File Serving ──

function existsSafe(path: string): boolean {
  try {
    realpathSync(path)
    return true
  } catch {
    return false
  }
}

function getDashboardDir(): string {
  const dir = config.dashboard_dir ?? DEFAULT_DASHBOARD_DIR
  // Resolve relative paths against Pulse directory
  if (!dir.startsWith("/")) {
    return join(HOME, ".claude", "PAI", "PULSE", dir)
  }
  return dir
}

async function serveStaticFile(pathname: string): Promise<Response | null> {
  const dashDir = getDashboardDir()
  let filePath = join(dashDir, pathname)

  if (!extname(filePath)) {
    const htmlPath = filePath + ".html"
    if (existsSafe(htmlPath)) {
      filePath = htmlPath
    } else {
      const indexPath = join(filePath, "index.html")
      if (existsSafe(indexPath)) filePath = indexPath
    }
  }

  if (!existsSafe(filePath)) return null

  try {
    const file = Bun.file(filePath)
    if (!extname(filePath) && filePath.endsWith("/")) return null
    const ext = extname(filePath)
    const headers: Record<string, string> = { "Content-Type": MIME[ext] || "application/octet-stream" }
    // No caching for any Observatory assets — ensures rebuilds are picked up immediately
    headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    return new Response(file, { headers })
  } catch {
    return null
  }
}

// ════════════════════════════════════════
// API Handlers
// ════════════════════════════════════════

// ── /api/algorithm ──

function handleAlgorithmApi(): Response {
  try {
    if (!existsSync(WORK_JSON_PATH)) {
      return Response.json({ algorithms: [], active: false })
    }
    const data = JSON.parse(readFileSync(WORK_JSON_PATH, "utf-8"))
    const sessions: Record<string, any> = data.sessions || {}
    // "Running" = a tool call fired in the last 5 minutes. Matches the native
    // stale threshold so a long-running tool call can't briefly flip a session
    // to stale and back. `updatedAt` is a weaker fallback for sessions that
    // predate the lastToolActivity field.
    const RUNNING_WINDOW_MS = 5 * 60 * 1000
    const NATIVE_STALE_MS = 5 * 60 * 1000
    const ALGORITHM_STALE_MS = 10 * 60 * 1000

    const algorithms = Object.entries(sessions).map(([slug, s]: [string, any]) => {
      const phase = (s.phase || "idle").toUpperCase()
      const [doneStr, totalStr] = (s.progress || "0/0").split("/")
      const done = parseInt(doneStr) || 0
      const total = parseInt(totalStr) || 0
      const startedAt = s.started ? new Date(s.started).getTime() : Date.now()
      const updatedAtMs = s.updatedAt ? new Date(s.updatedAt).getTime() : startedAt
      const toolActivityMs = s.lastToolActivity ? new Date(s.lastToolActivity).getTime() : 0
      // Prefer lastToolActivity for live-ness — it only moves when real work happens.
      const lastActivity = Math.max(updatedAtMs, toolActivityMs)
      const isExplicitlyComplete = s.phase === "complete"
      const isNativeOrStarting = phase === "NATIVE" || phase === "STARTING"
      const staleThreshold = isNativeOrStarting ? NATIVE_STALE_MS : ALGORITHM_STALE_MS
      const hasRecentToolActivity = toolActivityMs > 0 && Date.now() - toolActivityMs < RUNNING_WINDOW_MS
      // A session is stale if no tool call in the running window AND overall inactivity exceeds the soft threshold.
      // Backward compat: if lastToolActivity missing, fall back to the old updatedAt check.
      const isStale = !isExplicitlyComplete && (
        toolActivityMs > 0
          ? !hasRecentToolActivity && Date.now() - lastActivity > staleThreshold
          : Date.now() - lastActivity > staleThreshold
      )

      const criteria = Array.isArray(s.criteria)
        ? s.criteria.map((c: any) => ({
            id: c.id || "",
            description: c.description || c.text || "",
            type: c.type || "criterion",
            status: c.status || (c.done ? "completed" : "pending"),
            createdInPhase: (c.createdInPhase || "OBSERVE").toUpperCase(),
          }))
        : []

      const phaseHistory = Array.isArray(s.phaseHistory)
        ? s.phaseHistory.map((p: any) => ({
            phase: (p.phase || "IDLE").toUpperCase(),
            startedAt: p.startedAt || (p.at ? new Date(p.at).getTime() : Date.now()),
            completedAt: p.completedAt || undefined,
            criteriaCount: p.criteriaCount || 0,
            agentCount: p.agentCount || 0,
            phaseNarrative: p.phaseNarrative || undefined,
            source: p.source || undefined, // 'voice' | 'prd' | 'merged' | undefined (legacy)
          }))
        : []

      const isActive = !isExplicitlyComplete && !isStale
      const currentMode =
        s.currentMode || (s.mode === "interactive" ? "algorithm" : s.mode === "starting" ? "algorithm" : "native")
      const modeHistory =
        Array.isArray(s.modeHistory) && s.modeHistory.length > 0 ? s.modeHistory : [{ mode: currentMode, startedAt }]
      const ratings = Array.isArray(s.ratings) ? s.ratings : []

      return {
        active: isActive,
        sessionId: slug,
        taskDescription: s.sessionName || s.task || "Working...",
        currentPhase: phase,
        phaseStartedAt: lastActivity,
        algorithmStartedAt: startedAt,
        effortLevel: (s.effort || "Standard").charAt(0).toUpperCase() + (s.effort || "standard").slice(1),
        criteria,
        agents: Array.isArray(s.agents)
          ? s.agents.map((a: any) => ({
              name: a.name || "Unknown",
              agentType: a.agentType || "general",
              status: a.status || "completed",
              task: a.task || undefined,
              phase: a.phase || "OBSERVE",
            }))
          : [],
        capabilities: Array.isArray(s.capabilities) ? s.capabilities : [],
        prdPath: s.prd || undefined,
        phaseHistory,
        progress: { done, total },
        mode: s.mode || "interactive",
        rawTask: s.task || "",
        intent: typeof s.intent === "string" && s.intent.length > 0 ? s.intent : undefined,
        criteriaParseWarning: typeof s.criteriaParseWarning === "string" ? s.criteriaParseWarning : undefined,
        reworkCount: s.iteration ? s.iteration - 1 : 0,
        currentAction: undefined,
        currentMode,
        modeHistory,
        ratings,
        minimalCount: s.minimalCount || 0,
        sessionUUID: s.sessionUUID || undefined,
        ...(isExplicitlyComplete || isStale ? { completedAt: lastActivity } : {}),
      }
    })

    // Merge sessions with same sessionUUID
    const uuidMap = new Map<string, any[]>()
    for (const algo of algorithms) {
      if (!algo.sessionUUID || algo.sessionUUID === "__pulse_strip") continue
      const existing = uuidMap.get(algo.sessionUUID) || []
      existing.push(algo)
      uuidMap.set(algo.sessionUUID, existing)
    }

    const merged: any[] = []
    const mergedUUIDs = new Set<string>()
    for (const algo of algorithms) {
      if (algo.sessionUUID === "__pulse_strip") continue
      if (algo.sessionUUID && mergedUUIDs.has(algo.sessionUUID)) continue
      if (algo.sessionUUID) mergedUUIDs.add(algo.sessionUUID)

      const group = algo.sessionUUID ? uuidMap.get(algo.sessionUUID) || [algo] : [algo]
      if (group.length <= 1) {
        merged.push(algo)
        continue
      }

      const withCriteria = group.filter((g) => g.criteria?.length > 0)
      const placeholders = group.filter((g) => !g.criteria?.length)

      for (const item of withCriteria) merged.push(item)
      for (const item of placeholders) merged.push(item)
    }

    const pulseStripEntry = algorithms.find((a) => a.sessionId === "__pulse_strip")
    const pulseStrip = pulseStripEntry ? pulseStripEntry.ratings : []

    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000
    const filtered = merged.filter((a) => {
      if (a.active) return true
      if (a.currentPhase === "COMPLETE")
        return a.completedAt && Date.now() - a.completedAt < TWENTY_FOUR_HOURS_MS
      const lastUpdate = a.phaseStartedAt || a.algorithmStartedAt || 0
      if (Date.now() - lastUpdate > TWENTY_FOUR_HOURS_MS) return false
      if (a.criteria && a.criteria.length > 0) return true
      return false
    })

    return Response.json({ algorithms: filtered, active: filtered.some((a: any) => a.active), pulseStrip })
  } catch {
    return Response.json({ algorithms: [], active: false })
  }
}

// ── /api/agents ──

function handleAgentsApi(): Response {
  return Response.json(readJsonlTail(SUBAGENT_EVENTS_PATH, 100).reverse())
}

// ── /api/events/recent ──

function handleEventsRecentApi(): Response {
  const voiceEvents = readJsonlTail(VOICE_EVENTS_PATH, 50).map((e) => ({
    ...e,
    source: "voice",
    type: e.event || e.type || "voice",
  }))
  const toolFailures = readJsonlTail(TOOL_FAILURES_PATH, 50).map((e) => ({
    ...e,
    source: "tool-failure",
    type: e.event || e.type || "tool-failure",
  }))
  const subagentEvents = readJsonlTail(SUBAGENT_EVENTS_PATH, 50).map((e) => ({
    ...e,
    source: "subagent",
    type: e.event || e.type || "subagent",
  }))
  const toolActivity = readJsonlTail(TOOL_ACTIVITY_PATH, 100).map((e) => ({
    ...e,
    source: "tool-activity",
    type: e.event || e.type || "tool_use",
  }))

  const all = [...voiceEvents, ...toolFailures, ...subagentEvents, ...toolActivity]
  all.sort((a, b) => {
    const ta = new Date(a.timestamp || 0).getTime()
    const tb = new Date(b.timestamp || 0).getTime()
    return tb - ta
  })

  return Response.json({ events: all.slice(0, 200) })
}

// ── /api/observability/voice-events ──

function handleVoiceEventsApi(): Response {
  return Response.json(readJsonlTail(VOICE_EVENTS_PATH, 100).reverse())
}

// ── /api/observability/tool-failures ──

function handleToolFailuresApi(): Response {
  return Response.json(readJsonlTail(TOOL_FAILURES_PATH, 100).reverse())
}

// ── /api/novelty ──

function handleNoveltyApi(): Response {
  try {
    if (!existsSync(NOVELTY_STATE_PATH)) {
      return Response.json({ runs: [] })
    }
    const data = JSON.parse(readFileSync(NOVELTY_STATE_PATH, "utf-8"))
    return Response.json(data)
  } catch {
    return Response.json({ runs: [] })
  }
}

// ── /api/ladder ──

function handleLadderApi(): Response {
  try {
    if (!existsSync(LADDER_DIR)) {
      return Response.json(null)
    }

    const collections = [
      { key: "sources", dir: "Sources", prefix: "SR-" },
      { key: "ideas", dir: "Ideas", prefix: "ID-" },
      { key: "hypotheses", dir: "Hypotheses", prefix: "HY-" },
      { key: "experiments", dir: "Experiments", prefix: "EX-" },
      { key: "algorithms", dir: "Algorithms", prefix: "AL-" },
      { key: "results", dir: "Results", prefix: "RE-" },
    ]

    const data: Record<string, Array<{ id: string; title: string; status: string; created: string }>> = {}

    for (const col of collections) {
      const dirPath = join(LADDER_DIR, col.dir)
      data[col.key] = []

      if (!existsSync(dirPath)) continue

      const files = readdirSync(dirPath)
      for (const file of files) {
        if (!file.match(new RegExp(`^${col.prefix}\\d`)) || !file.endsWith(".md")) continue

        try {
          const content = readFileSync(join(dirPath, file), "utf-8")
          const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
          if (!fmMatch) continue

          const fm: Record<string, string> = {}
          for (const line of fmMatch[1].split("\n")) {
            const idx = line.indexOf(":")
            if (idx === -1) continue
            const k = line.substring(0, idx).trim()
            const v = line
              .substring(idx + 1)
              .trim()
              .replace(/^["']|["']$/g, "")
            if (k && v && !k.startsWith(" ")) fm[k] = v
          }

          data[col.key].push({
            id: fm.id || file.replace(".md", ""),
            title: fm.title || "(untitled)",
            status: fm.status || "unknown",
            created: fm.created || "",
          })
        } catch {
          // Skip unreadable files
        }
      }

      data[col.key].sort((a, b) => a.id.localeCompare(b.id))
    }

    return Response.json(data)
  } catch {
    return Response.json(null)
  }
}

// ── /api/security ──

function handleSecurityApi(): Response {
  // Load patterns.yaml
  let patterns: any = null
  try {
    if (existsSync(PATTERNS_PATH)) {
      const yaml = require("yaml")
      patterns = yaml.parse(readFileSync(PATTERNS_PATH, "utf-8"))
    }
  } catch (e) {
    console.error("[Observability] Failed to parse patterns.yaml:", e)
  }

  // Load recent security events (newest first, max 50)
  const events: any[] = []
  try {
    if (existsSync(SECURITY_LOG_DIR)) {
      const years = readdirSync(SECURITY_LOG_DIR)
        .filter((d) => /^\d{4}$/.test(d))
        .sort()
        .reverse()
      for (const year of years) {
        const yearDir = join(SECURITY_LOG_DIR, year)
        const months = readdirSync(yearDir).sort().reverse()
        for (const month of months) {
          const monthDir = join(yearDir, month)
          const files = readdirSync(monthDir)
            .filter((f) => f.endsWith(".jsonl"))
            .sort()
            .reverse()
          for (const file of files) {
            if (events.length >= 50) break
            try {
              const content = readFileSync(join(monthDir, file), "utf-8").trim()
              if (content) events.push(JSON.parse(content))
            } catch {
              /* skip malformed */
            }
          }
          if (events.length >= 50) break
        }
        if (events.length >= 50) break
      }
    }
  } catch (e) {
    console.error("[Observability] Failed to read security events:", e)
  }

  // Load hook health
  const hooks: any[] = []
  try {
    if (existsSync(SETTINGS_PATH)) {
      const settings = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8"))
      const hookConfig = settings.hooks || {}
      for (const [eventType, entries] of Object.entries(hookConfig)) {
        if (!Array.isArray(entries)) continue
        for (const entry of entries as any[]) {
          const hookList = entry.hooks || []
          const matcher = entry.matcher || "(all)"
          for (const hook of hookList) {
            const isSecurityHook =
              hook.command?.includes("SecurityPipeline") ||
              hook.command?.includes("ContentScanner") ||
              hook.command?.includes("SmartApprover") ||
              hook.command?.includes("PromptGuard") ||
              hook.command?.includes("ConfigAudit") ||
              hook.url?.includes("skill-guard") ||
              hook.url?.includes("agent-guard")
            if (!isSecurityHook) continue

            if (hook.type === "command" && hook.command) {
              const parts = hook.command.split("/")
              const filename = parts[parts.length - 1]
              const expandedPath = hook.command
                .replace("bun ", "")
                .replace("$HOME", HOME)
                .replace("${HOME}", HOME)
              hooks.push({
                type: eventType,
                matcher,
                command: filename,
                status: existsSync(expandedPath) ? "active" : "missing",
              })
            } else if (hook.type === "http" && hook.url) {
              hooks.push({ type: eventType, matcher, command: hook.url, status: "active" })
            }
          }
        }
      }
    }
  } catch (e) {
    console.error("[Observability] Failed to read hook health:", e)
  }

  const blocked = patterns?.bash?.blocked || []
  const alerts = patterns?.bash?.alert || []
  const trusted = patterns?.bash?.trusted || []

  const pathTiers: any[] = []
  if (patterns?.paths) {
    if (patterns.paths.zeroAccess?.length)
      pathTiers.push({
        tier: "zeroAccess",
        paths: patterns.paths.zeroAccess,
        effect: "All operations blocked (read, write, delete)",
      })
    if (patterns.paths.alertAccess?.length)
      pathTiers.push({
        tier: "alertAccess",
        paths: patterns.paths.alertAccess,
        effect: "Logged but allowed (alert only)",
      })
    if (patterns.paths.confirmAccess?.length)
      pathTiers.push({
        tier: "confirmAccess",
        paths: patterns.paths.confirmAccess,
        effect: "Prompts user for any access",
      })
    if (patterns.paths.readOnly?.length)
      pathTiers.push({
        tier: "readOnly",
        paths: patterns.paths.readOnly,
        effect: "Can read, cannot write or delete",
      })
    if (patterns.paths.confirmWrite?.length)
      pathTiers.push({
        tier: "confirmWrite",
        paths: patterns.paths.confirmWrite,
        effect: "Can read, writing requires confirmation",
      })
    if (patterns.paths.noDelete?.length)
      pathTiers.push({
        tier: "noDelete",
        paths: patterns.paths.noDelete,
        effect: "Can read and modify, cannot delete",
      })
  }

  // Load SECURITY_RULES.md
  let securityRules = ""
  try {
    if (existsSync(SECURITY_RULES_PATH)) {
      securityRules = readFileSync(SECURITY_RULES_PATH, "utf-8")
    }
  } catch { /* ignore */ }

  // Load InjectionInspector patterns from source
  const injectionPatterns: Array<{ category: string; description: string; pattern: string }> = []
  try {
    const inspectorPath = join(HOME, ".claude", "hooks", "security", "inspectors", "InjectionInspector.ts")
    if (existsSync(inspectorPath)) {
      const src = readFileSync(inspectorPath, "utf-8")
      const patternRegex = /regex:\s*\/(.+?)\/[a-z]*,\s*category:\s*['"](.+?)['"]\s*,\s*description:\s*['"](.+?)['"]/g
      let m
      while ((m = patternRegex.exec(src)) !== null) {
        injectionPatterns.push({ pattern: m[1], category: m[2], description: m[3] })
      }
    }
  } catch { /* ignore */ }

  // Load PromptInspector heuristic patterns (from security/inspectors/PromptInspector.ts)
  const promptGuardPatterns: Array<{ category: string; count: number }> = []
  try {
    const piPath = join(HOME, ".claude", "hooks", "security", "inspectors", "PromptInspector.ts")
    if (existsSync(piPath)) {
      const src = readFileSync(piPath, "utf-8")
      const injCount = (src.match(/INJECTION_PATTERNS[^=]*=\s*\[([\s\S]*?)\];/)?.[1]?.match(/regex:/g)?.length || 0)
      const secDisableCount = (src.match(/SECURITY_DISABLE_PATTERNS[^=]*=\s*\[([\s\S]*?)\];/)?.[1]?.match(/regex:/g)?.length || 0)
      const evasionCount = (src.match(/EVASION_PATTERNS[^=]*=\s*\[([\s\S]*?)\];/)?.[1]?.match(/regex:/g)?.length || 0)
      const sensitiveCount = (src.match(/SENSITIVE_DATA_PATTERNS\s*=\s*\[([\s\S]*?)\];/)?.[1]?.match(/\//g)?.length || 0) / 2
      const exfilCount = (src.match(/EXFILTRATION_INTENT\s*=\s*\[([\s\S]*?)\];/)?.[1]?.match(/\//g)?.length || 0) / 2
      if (injCount) promptGuardPatterns.push({ category: "injection", count: injCount })
      if (secDisableCount) promptGuardPatterns.push({ category: "security_disable", count: secDisableCount })
      if (evasionCount) promptGuardPatterns.push({ category: "evasion", count: evasionCount })
      if (sensitiveCount) promptGuardPatterns.push({ category: "sensitive_data", count: Math.round(sensitiveCount) })
      if (exfilCount) promptGuardPatterns.push({ category: "exfiltration_intent", count: Math.round(exfilCount) })
    }
  } catch { /* ignore */ }

  return Response.json({
    version: patterns?.version || "unknown",
    lastUpdated: patterns?.last_updated || "unknown",
    philosophy: patterns?.philosophy?.principle || "",
    blocked,
    alerts,
    trusted,
    pathTiers,
    events: events.slice(0, 30),
    eventCounts: {
      blocks: events.filter((e) => e.event_type === "block").length,
      alerts: events.filter((e) => e.event_type === "alert").length,
      injections: events.filter((e) => e.event_type === "injection_detected").length,
      total: events.length,
    },
    hooks,
    securityRules,
    injectionPatterns,
    promptGuardPatterns,
  })
}

// ── POST /api/security/patterns ──

async function handleSecurityPatternsMutation(req: Request): Promise<Response> {
  const yaml = require("yaml")

  try {
    const body = (await req.json()) as {
      action: "add_pattern" | "remove_pattern" | "add_path" | "remove_path" | "edit_pattern" | "edit_path"
      section?: string
      tier?: string
      pattern?: string
      reason?: string
      path?: string
      index?: number
    }

    const content = readFileSync(PATTERNS_PATH, "utf-8")
    const patterns = yaml.parse(content)

    switch (body.action) {
      case "add_pattern": {
        if (!body.pattern || !body.reason || !body.section) {
          return Response.json({ error: "Missing pattern, reason, or section" }, { status: 400 })
        }
        const section = body.section as "blocked" | "alert" | "trusted"
        if (!patterns.bash[section]) patterns.bash[section] = []
        patterns.bash[section].push({ pattern: body.pattern, reason: body.reason })
        break
      }
      case "remove_pattern": {
        if (body.index === undefined || !body.section) {
          return Response.json({ error: "Missing index or section" }, { status: 400 })
        }
        const section = body.section as "blocked" | "alert" | "trusted"
        if (!patterns.bash[section] || body.index >= patterns.bash[section].length) {
          return Response.json({ error: "Invalid index" }, { status: 400 })
        }
        patterns.bash[section].splice(body.index, 1)
        break
      }
      case "add_path": {
        if (!body.path || !body.tier) {
          return Response.json({ error: "Missing path or tier" }, { status: 400 })
        }
        const tier = body.tier as "zeroAccess" | "readOnly" | "noDelete"
        if (!patterns.paths[tier]) patterns.paths[tier] = []
        patterns.paths[tier].push(body.path)
        break
      }
      case "remove_path": {
        if (body.index === undefined || !body.tier) {
          return Response.json({ error: "Missing index or tier" }, { status: 400 })
        }
        const tier = body.tier as "zeroAccess" | "readOnly" | "noDelete"
        if (!patterns.paths[tier] || body.index >= patterns.paths[tier].length) {
          return Response.json({ error: "Invalid index" }, { status: 400 })
        }
        patterns.paths[tier].splice(body.index, 1)
        break
      }
      case "edit_pattern": {
        if (body.index === undefined || !body.section) {
          return Response.json({ error: "Missing index or section" }, { status: 400 })
        }
        const section = body.section as "blocked" | "alert" | "trusted"
        if (!patterns.bash[section] || body.index >= patterns.bash[section].length) {
          return Response.json({ error: "Invalid index" }, { status: 400 })
        }
        if (body.pattern) patterns.bash[section][body.index].pattern = body.pattern
        if (body.reason) patterns.bash[section][body.index].reason = body.reason
        break
      }
      case "edit_path": {
        if (body.index === undefined || !body.tier || !body.path) {
          return Response.json({ error: "Missing index, tier, or path" }, { status: 400 })
        }
        const tier = body.tier as "zeroAccess" | "readOnly" | "noDelete"
        if (!patterns.paths[tier] || body.index >= patterns.paths[tier].length) {
          return Response.json({ error: "Invalid index" }, { status: 400 })
        }
        patterns.paths[tier][body.index] = body.path
        break
      }
      default:
        return Response.json({ error: `Unknown action: ${body.action}` }, { status: 400 })
    }

    // Update timestamp
    patterns.last_updated = new Date().toISOString().split("T")[0]

    // Write back
    const { writeFileSync } = require("fs")
    const header =
      `# PAI Security Patterns v${patterns.version}\n` +
      `# Used by SecurityPipeline.hook.ts (PreToolUse: Bash, Edit, Write, MultiEdit)\n` +
      `#\n` +
      `# DESIGN: Block catastrophic ops, alert on suspicious, allow everything else.\n` +
      `# ZERO confirm patterns — prompts cause friction. Use blocked (silent deny)\n` +
      `# or alert (log + allow) only.\n` +
      `#\n` +
      `# Pattern syntax: JavaScript RegExp (case-insensitive via 'i' flag)\n` +
      `# matchesPattern() does regex.test(fullCommand) — matches anywhere in string\n` +
      `#\n` +
      `# FAIL-CLOSED: Missing or corrupt PATTERNS.yaml → block ALL commands.\n` +
      `#\n` +
      `# Logging: All blocked/alerted events → MEMORY/SECURITY/YYYY/MM/\n` +
      `---\n`
    const yamlContent = yaml.stringify(patterns, { lineWidth: 0 })
    writeFileSync(PATTERNS_PATH, header + yamlContent, "utf-8")

    return Response.json({ ok: true, action: body.action })
  } catch (e: any) {
    console.error("[Observability] Security mutation error:", e)
    return Response.json({ error: e.message }, { status: 500 })
  }
}

// ── POST /api/security/rules ──

async function handleSecurityRulesMutation(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as { content: string }
    if (typeof body.content !== "string") {
      return Response.json({ error: "Missing content field" }, { status: 400 })
    }
    const { writeFileSync } = require("fs")
    writeFileSync(SECURITY_RULES_PATH, body.content, "utf-8")
    return Response.json({ ok: true })
  } catch (e: any) {
    console.error("[Observability] Security rules mutation error:", e)
    return Response.json({ error: e.message }, { status: 500 })
  }
}

// ── GET /api/security/hooks-detail ──

function handleSecurityHooksDetail(): Response {
  const hookDescriptions: Record<string, { description: string; behavior: string; event: string; canBlock: boolean }> =
    {
      "SecurityPipeline.hook.ts": {
        description:
          "Core security enforcement engine. Runs composable inspector chain (Pattern → Egress) on every Bash command, write, edit, and multi-edit.",
        behavior:
          "Reads command/path from stdin. PatternInspector checks patterns.yaml (blocked/alert/path tiers). EgressInspector monitors outbound data. RulesInspector disabled (empty SECURITY_RULES.md). Fails closed if patterns.yaml is missing.",
        event: "PreToolUse",
        canBlock: true,
      },
      "ContentScanner.hook.ts": {
        description:
          "Scans tool output for prompt injection attempts via InjectionInspector — instructions hidden in web pages, emails, PDFs, or API responses.",
        behavior:
          "Receives tool_result on stdin after tool executes. InjectionInspector regex-matches against injection patterns. Injects additionalContext warning if found. Cannot block — content is already in AI context.",
        event: "PostToolUse",
        canBlock: false,
      },
      "SmartApprover.hook.ts": {
        description:
          "Auto-approves file operations in trusted workspaces to prevent permission prompts during normal development.",
        behavior:
          "Fires when Claude Code would show a permission dialog. Checks if target path is in ~/.claude/, ~/Projects/, or ~/LocalProjects/. Returns allow decision to skip the dialog. SecurityPipeline has already run first. Non-trusted paths: classifies read vs write, auto-approves reads.",
        event: "PermissionRequest",
        canBlock: false,
      },
      "ConfigAudit.hook.ts": {
        description:
          "Audit trail for settings.json modifications. Detects what changed using file-diff approach.",
        behavior:
          "Fires on ConfigChange events. Compares current settings.json against cached snapshot. Logs changed sections to config-changes.jsonl.",
        event: "ConfigChange",
        canBlock: false,
      },
      "http://localhost:31337/hooks/skill-guard": {
        description:
          "Validates skill invocations via Pulse HTTP route. Prevents false-positive skill triggers.",
        behavior:
          "Receives skill name and context. Checks against known false-positive patterns. Fail-open if Pulse is down.",
        event: "PreToolUse (Skill)",
        canBlock: true,
      },
      "http://localhost:31337/hooks/agent-guard": {
        description:
          "Validates agent spawning via Pulse HTTP route. Enforces background execution policies.",
        behavior:
          "Receives agent type and configuration. Checks execution policies. Fail-open if Pulse is down.",
        event: "PreToolUse (Agent)",
        canBlock: true,
      },
    }

  return Response.json(hookDescriptions)
}

// ── /api/knowledge ──

const KNOWLEDGE_DIR = join(MEMORY_DIR, "KNOWLEDGE")
const KNOWLEDGE_DOMAINS = ["People", "Companies", "Ideas", "Research"]

function parseFrontmatter(content: string): Record<string, string | string[]> {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}
  const result: Record<string, string | string[]> = {}
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":")
    if (idx === -1) continue
    const key = line.substring(0, idx).trim()
    let value = line.substring(idx + 1).trim()
    if (key.startsWith(" ") || !key) continue
    // Handle arrays like [tag1, tag2]
    if (value.startsWith("[") && value.endsWith("]")) {
      result[key] = value.slice(1, -1).split(",").map(s => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean)
    } else {
      result[key] = value.replace(/^["']|["']$/g, "")
    }
  }
  return result
}

function handleKnowledgeApi(): Response {
  try {
    if (!existsSync(KNOWLEDGE_DIR)) {
      return Response.json({ domains: [], notes: [], totalNotes: 0, lastHarvest: null })
    }

    const domains: { name: string; count: number; avgQuality: number; lowCount: number; midCount: number; highCount: number }[] = []
    const allNotes: { title: string; domain: string; type: string; quality: number; tags: string[]; created: string; updated: string; slug: string }[] = []
    const tagCounts: Record<string, number> = {}
    let lastHarvest: string | null = null

    // Parse master _index.md for last harvest date
    const masterIndexPath = join(KNOWLEDGE_DIR, "_index.md")
    if (existsSync(masterIndexPath)) {
      const content = readFileSync(masterIndexPath, "utf-8")
      const harvestMatch = content.match(/\*\*Last harvest:\*\*\s*(\S+)/)
      if (harvestMatch) lastHarvest = harvestMatch[1]
    }

    for (const domain of KNOWLEDGE_DOMAINS) {
      const domainDir = join(KNOWLEDGE_DIR, domain)
      if (!existsSync(domainDir)) {
        domains.push({ name: domain, count: 0, avgQuality: 0, lowCount: 0, midCount: 0, highCount: 0 })
        continue
      }

      let files: string[]
      try {
        files = readdirSync(domainDir).filter(f => f.endsWith(".md") && !f.startsWith("_"))
      } catch {
        files = []
      }

      let qualitySum = 0, lowCount = 0, midCount = 0, highCount = 0

      for (const file of files) {
        const filePath = join(domainDir, file)
        try {
          const raw = readFileSync(filePath, "utf-8")
          const fm = parseFrontmatter(raw)

          const title = (fm.title as string) || file.replace(/\.md$/, "")
          const type = (fm.type as string) || "reference"
          const quality = typeof fm.quality === "number" ? fm.quality : (fm.quality ? parseInt(String(fm.quality)) : 5)
          const tags = Array.isArray(fm.tags) ? fm.tags : []
          const created = (fm.created as string) || ""
          const updated = (fm.updated as string) || ""

          qualitySum += quality
          if (quality <= 3) lowCount++
          else if (quality <= 6) midCount++
          else highCount++

          for (const tag of tags) {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1
          }

          allNotes.push({
            title,
            domain: domain.toLowerCase(),
            type,
            quality,
            tags,
            created,
            updated,
            slug: file.replace(/\.md$/, ""),
          })
        } catch {
          // Skip malformed files
        }
      }

      const avgQuality = files.length > 0 ? qualitySum / files.length : 0
      domains.push({ name: domain, count: files.length, avgQuality, lowCount, midCount, highCount })
    }

    // Sort notes by updated date descending
    allNotes.sort((a, b) => (b.updated || "").localeCompare(a.updated || ""))

    // Top tags
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([tag, count]) => ({ tag, count }))

    const totalNotes = allNotes.length
    const avgQuality = totalNotes > 0 ? allNotes.reduce((s, n) => s + n.quality, 0) / totalNotes : 0

    return Response.json({
      domains,
      notes: allNotes,
      totalNotes,
      avgQuality,
      topTags,
      lastHarvest,
    })
  } catch (err) {
    return Response.json({ error: String(err), domains: [], notes: [], totalNotes: 0 }, { status: 500 })
  }
}

// ── /api/knowledge/:domain/:slug (GET + PUT) ──

const VALID_DOMAINS = new Set(KNOWLEDGE_DOMAINS.map(d => d.toLowerCase()))

function parseKnowledgeNotePath(pathname: string): { domain: string; slug: string } | null {
  // Match /api/knowledge/:domain/:slug
  const match = pathname.match(/^\/api\/knowledge\/([^/]+)\/([^/]+)$/)
  if (!match) return null
  const domain = match[1].toLowerCase()
  const slug = match[2]
  if (!VALID_DOMAINS.has(domain)) return null
  // Sanitize slug — only allow kebab-case alphanumeric
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) return null
  return { domain, slug }
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function handleGetKnowledgeNote(domain: string, slug: string): Response {
  const filePath = join(KNOWLEDGE_DIR, capitalizeFirst(domain), `${slug}.md`)
  if (!existsSync(filePath)) {
    return Response.json({ error: "Note not found" }, { status: 404 })
  }
  try {
    const content = readFileSync(filePath, "utf-8")
    const fm = parseFrontmatter(content)
    return Response.json({
      domain,
      slug,
      content,
      title: fm.title || slug,
      type: fm.type || "reference",
      quality: typeof fm.quality === "number" ? fm.quality : (fm.quality ? parseInt(String(fm.quality)) : 5),
      tags: Array.isArray(fm.tags) ? fm.tags : [],
      created: fm.created || "",
      updated: fm.updated || "",
    })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}

async function handlePutKnowledgeNote(req: Request, domain: string, slug: string): Promise<Response> {
  const filePath = join(KNOWLEDGE_DIR, capitalizeFirst(domain), `${slug}.md`)
  if (!existsSync(filePath)) {
    return Response.json({ error: "Note not found" }, { status: 404 })
  }
  try {
    const body = await req.json() as { content: string }
    if (!body.content || typeof body.content !== "string") {
      return Response.json({ error: "Missing content field" }, { status: 400 })
    }

    // Update the `updated` field in frontmatter to today
    const today = new Date().toISOString().split("T")[0]
    let content = body.content
    if (content.match(/^---\n[\s\S]*?\nupdated:.*\n/)) {
      content = content.replace(/(\nupdated:)\s*\S+/, `$1 ${today}`)
    }

    const { writeFileSync } = require("fs")
    writeFileSync(filePath, content, "utf-8")

    const fm = parseFrontmatter(content)
    return Response.json({
      ok: true,
      domain,
      slug,
      content,
      title: fm.title || slug,
      quality: typeof fm.quality === "number" ? fm.quality : (fm.quality ? parseInt(String(fm.quality)) : 5),
      updated: fm.updated || today,
    })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}

// ════════════════════════════════════════
// Life Dashboard APIs (/api/life/*)
// ════════════════════════════════════════

const USER_DIR = join(PAI_DIR, "USER")
const TELOS_DIR = join(USER_DIR, "TELOS")
const HEALTH_DIR = join(USER_DIR, "HEALTH")
const FINANCES_DIR = join(USER_DIR, "FINANCES")
const BUSINESS_DIR = join(USER_DIR, "BUSINESS")
const PROJECTS_FILE = join(USER_DIR, "PROJECTS", "PROJECTS.md")
const TELOS_FILE_ALLOWLIST = new Set<string>([
  "MISSION.md", "GOALS.md", "PROBLEMS.md", "STRATEGIES.md", "CHALLENGES.md",
  "NARRATIVES.md", "BELIEFS.md", "WISDOM.md", "STATUS.md", "PROJECTS.md",
  "METRICS.md", "TEAM.md", "BUDGET.md", "MODELS.md", "PREDICTIONS.md",
  "FRAMES.md", "WRONG.md", "LEARNED.md", "IDEAS.md", "AUTHORS.md",
  "BOOKS.md", "MOVIES.md", "TRAUMAS.md", "SPARKS.md", "NEW_TEST.md",
])

function readMd(path: string): string {
  try { return existsSync(path) ? readFileSync(path, "utf-8") : "" } catch { return "" }
}

function validateTelosFileName(raw: unknown): { ok: true; name: string } | { ok: false; error: string } {
  if (typeof raw !== "string") return { ok: false, error: "name must be a string" }
  if (raw.includes("/") || raw.includes("\\") || raw.includes("..")) return { ok: false, error: "invalid path" }
  if (!raw.endsWith(".md")) return { ok: false, error: "must end with .md" }
  if (!TELOS_FILE_ALLOWLIST.has(raw)) return { ok: false, error: "not an allowed TELOS file" }
  return { ok: true, name: raw }
}

// Load a YAML file; return null on missing or parse failure so callers can
// degrade gracefully (per feedback_degrade_dont_block_on_missing_creds.md).
function loadYaml<T = any>(path: string): T | null {
  try {
    if (!existsSync(path)) return null
    const raw = readFileSync(path, "utf-8")
    return YAML.parse(raw) as T
  } catch (err) {
    console.error(`[finances] YAML parse failed: ${path}`, err)
    return null
  }
}

interface VendorYaml {
  id: string
  name?: string
  scope: "business" | "personal" | "mixed"
  cadence: "monthly" | "annual" | "quarterly" | "one_time" | "variable"
  source: "collector" | "manual" | "stripe" | "webhook"
  collector?: string
  manual_monthly_usd?: number
  manual_annual_usd?: number
  tags?: string[]
  notes?: string
  business_share?: number // 0..1; for mixed vendors, share of cost attributed to business
}

interface ObligationYaml {
  id: string
  name?: string
  scope: "personal"
  cadence: "monthly" | "annual" | "quarterly" | "one_time" | "variable"
  amount_usd: number
  category: string
  notes?: string
}

interface CollectorEntry {
  vendor: string
  month: string // "YYYY-MM"
  cost_usd: number
  captured_at: string
  source: string
  scope?: string
}

// Read vendor-costs.jsonl and return the most recent monthly entry per vendor
// within the last 35 days. Missing file = empty map (collectors not wired yet).
interface SpendAggregate {
  merchant: string
  display: string
  tags: string[]
  scope: "business"|"personal"|"mixed"
  accounts: string[]
  transaction_count: number
  charge_count: number
  credit_count: number
  gross_charges_usd: number
  gross_credits_usd: number
  net_usd: number
  first_seen: string
  last_seen: string
  active_months: number
  cadence: "monthly_recurring"|"annual_subscription"|"observed_one_month"|"one_time"
  confidence?: "high"|"medium"|"low"
  monthly_avg_usd: number
  annualized_usd: number
  observed_total_usd?: number
  observation_window_days?: number
  samples?: Array<{ date: string; amount: number; raw: string }>
}

interface SpendAggregateBundle {
  generated_at: string | null
  records: SpendAggregate[]
}

// Reads MEMORY/OBSERVABILITY/statement-spend.jsonl produced by
// USER/FINANCES/Tools/StatementAnalyzer.ts. First line is the header
// (schema, generated_at, record_count, sources); subsequent lines are
// one JSON record per normalized merchant. Returns empty bundle if the
// file is missing — the analyzer hasn't been run yet.
function readStatementSpendJsonl(): SpendAggregateBundle {
  const path = join(PAI_DIR, "MEMORY", "OBSERVABILITY", "statement-spend.jsonl")
  if (!existsSync(path)) return { generated_at: null, records: [] }
  try {
    const lines = readFileSync(path, "utf-8").split("\n").filter(Boolean)
    if (lines.length === 0) return { generated_at: null, records: [] }
    let generated_at: string | null = null
    const records: SpendAggregate[] = []
    for (let i = 0; i < lines.length; i++) {
      try {
        const obj = JSON.parse(lines[i])
        if (i === 0 && obj?.schema === "pulse.statement_spend.v1") {
          generated_at = obj.generated_at ?? null
          continue
        }
        if (typeof obj?.merchant === "string") records.push(obj as SpendAggregate)
      } catch { /* skip malformed */ }
    }
    return { generated_at, records }
  } catch {
    return { generated_at: null, records: [] }
  }
}

interface SpendInsightLine {
  display: string
  monthly_usd: number
  annual_usd: number
  observed_usd: number
  cadence: string
  confidence: "high"|"medium"|"low"
  scope: string
  tags: string[]
  active_months: number
  charge_count: number
  last_seen: string
}

function toInsightLine(r: SpendAggregate): SpendInsightLine {
  return {
    display: r.display,
    monthly_usd: r.monthly_avg_usd,
    annual_usd: r.annualized_usd,
    observed_usd: r.observed_total_usd ?? r.net_usd,
    cadence: r.cadence,
    confidence: r.confidence ?? "medium",
    scope: r.scope,
    tags: r.tags,
    active_months: r.active_months,
    charge_count: r.charge_count,
    last_seen: r.last_seen,
  }
}

// Build the four insight buckets the Expenses tab renders. All filtering
// excludes transfers / self-business-charges so the user sees real outflows.
function buildSpendInsights(records: SpendAggregate[]) {
  const isReal = (r: SpendAggregate) =>
    !r.tags.includes("transfer") && !r.tags.includes("cc-payment") && !r.tags.includes("self-business-charge")

  const real = records.filter(isReal)

  const top_bills = real
    .slice()
    .sort((a, b) => b.annualized_usd - a.annualized_usd)
    .slice(0, 12)
    .map(toInsightLine)

  const top_ai_services = real
    .filter(r => r.tags.includes("ai"))
    .sort((a, b) => b.annualized_usd - a.annualized_usd)
    .slice(0, 10)
    .map(toInsightLine)

  const top_infrastructure_services = real
    .filter(r => r.tags.includes("infrastructure"))
    .sort((a, b) => b.annualized_usd - a.annualized_usd)
    .slice(0, 10)
    .map(toInsightLine)

  // Cut candidates — heuristic blend:
  //   1. Subscription items with only one charge so far (haven't recurred — verify still needed)
  //   2. Subscriptions <$200/yr that are easy wins to cancel
  //   3. Multiple subscriptions with overlapping function (newsletter platforms, dev IDEs, etc.)
  const subscriptionLike = real.filter(r =>
    r.tags.some(t => ["subscription", "saas"].includes(t))
  )
  const flagged = new Set<string>()
  const cuts: SpendAggregate[] = []
  for (const r of subscriptionLike) {
    if (r.charge_count === 1 && r.cadence === "annual_subscription" && r.annualized_usd < 1500) {
      cuts.push(r); flagged.add(r.merchant)
    }
  }
  for (const r of subscriptionLike) {
    if (flagged.has(r.merchant)) continue
    if (r.cadence === "monthly_recurring" && r.annualized_usd < 200) {
      cuts.push(r); flagged.add(r.merchant)
    }
  }
  // Detect overlapping-function clusters (≥2 in newsletter / video / podcast / ide / email)
  const clusterTags = ["newsletter", "podcast", "ide", "email", "video", "automation", "image"]
  for (const tag of clusterTags) {
    const inTag = subscriptionLike.filter(r => r.tags.includes(tag))
    if (inTag.length >= 2) {
      const sorted = inTag.slice().sort((a, b) => a.annualized_usd - b.annualized_usd)
      // Flag the cheaper duplicates (keep the most-used / most-expensive)
      for (const r of sorted.slice(0, sorted.length - 1)) {
        if (!flagged.has(r.merchant)) {
          cuts.push(r); flagged.add(r.merchant)
        }
      }
    }
  }
  const cut_candidates = cuts
    .sort((a, b) => b.annualized_usd - a.annualized_usd)
    .slice(0, 12)
    .map(r => ({ ...toInsightLine(r), reason: cutReason(r, subscriptionLike) }))

  // Category roll-up
  const categories = new Map<string, { annual_usd: number; merchants: number }>()
  const CATEGORY_TAGS = ["taxes", "payroll", "ai", "infrastructure", "saas", "food", "transportation", "utilities", "entertainment", "health", "news", "shopping", "travel", "business-services", "debt", "advertising"]
  for (const r of real) {
    let cat = "other"
    for (const t of CATEGORY_TAGS) if (r.tags.includes(t)) { cat = t; break }
    const cur = categories.get(cat) ?? { annual_usd: 0, merchants: 0 }
    cur.annual_usd += r.annualized_usd
    cur.merchants += 1
    categories.set(cat, cur)
  }
  const by_category = Array.from(categories.entries())
    .map(([category, v]) => ({ category, annual_usd: Math.round(v.annual_usd), merchants: v.merchants }))
    .sort((a, b) => b.annual_usd - a.annual_usd)

  const total_annualized = Math.round(real.reduce((s, r) => s + r.annualized_usd, 0))

  return { top_bills, top_ai_services, top_infrastructure_services, cut_candidates, by_category, total_annualized }
}

function cutReason(r: SpendAggregate, all: SpendAggregate[]): string {
  if (r.charge_count === 1 && r.cadence === "annual_subscription" && r.annualized_usd < 1500) {
    return "Annual subscription — confirm still needed before next renewal"
  }
  if (r.cadence === "monthly_recurring" && r.annualized_usd < 200) {
    return "Low-value recurring charge — easy cancellation win"
  }
  // Cluster-based reason
  for (const tag of ["newsletter", "podcast", "ide", "email", "video", "automation", "image"]) {
    if (r.tags.includes(tag)) {
      const peers = all.filter(p => p.tags.includes(tag) && p.merchant !== r.merchant).map(p => p.display)
      if (peers.length > 0) {
        return `Overlapping ${tag} tool — also paying for ${peers.slice(0, 2).join(", ")}`
      }
    }
  }
  return "Review for cancellation"
}

function readVendorCostsJsonl(): Map<string, CollectorEntry> {
  const latest = new Map<string, CollectorEntry>()
  const path = join(PAI_DIR, "MEMORY", "OBSERVABILITY", "vendor-costs.jsonl")
  if (!existsSync(path)) return latest
  try {
    const lines = readFileSync(path, "utf-8").split("\n").filter(Boolean)
    const cutoffMs = Date.now() - 35 * 86400_000
    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as CollectorEntry
        if (!entry.vendor || !entry.cost_usd) continue
        const capturedMs = Date.parse(entry.captured_at)
        if (Number.isNaN(capturedMs) || capturedMs < cutoffMs) continue
        const prev = latest.get(entry.vendor)
        if (!prev || Date.parse(prev.captured_at) < capturedMs) {
          latest.set(entry.vendor, entry)
        }
      } catch { /* skip malformed */ }
    }
  } catch { /* no file */ }
  return latest
}

function cadenceToMonthly(amount: number, cadence: string): number {
  switch (cadence) {
    case "monthly": return amount
    case "annual": return amount / 12
    case "quarterly": return amount / 3
    case "one_time": return amount / 12 // amortize
    default: return amount
  }
}

// Parse the effective tax rate from TAXES.md. Looks for "effective rate" or
// "effective tax rate" followed by a percentage. Falls back to 0.25 if not
// found. Returns { rate, source } so the UI can flag estimated values.
function parseEffectiveTaxRate(content: string): { rate: number; source: "parsed" | "estimated" } {
  if (!content) return { rate: 0.25, source: "estimated" }
  const m = content.match(/effective\s+(?:tax\s+)?rate[^\d]{0,10}([\d.]+)\s*%/i)
  if (m) {
    const pct = parseFloat(m[1])
    if (pct > 0 && pct < 100) return { rate: pct / 100, source: "parsed" }
  }
  const m2 = content.match(/~?\s*([\d.]+)\s*%\s*effective/i)
  if (m2) return { rate: parseFloat(m2[1]) / 100, source: "parsed" }
  return { rate: 0.25, source: "estimated" }
}

function parseBoldFields(content: string): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const line of content.split("\n")) {
    const m = line.match(/\*\*(.+?):\*\*\s*(.+)/)
    if (m) fields[m[1].toLowerCase().replace(/\s+/g, "_")] = m[2].trim()
  }
  return fields
}

function parseNumberedList(content: string, heading: string): string[] {
  const section = content.split(heading)[1] || ""
  return section.split("\n")
    .filter(l => /^\d+\./.test(l.trim()))
    .map(l => l.trim().replace(/^\d+\.\s*/, ""))
    .slice(0, 10)
}

function parseBullets(content: string): string[] {
  return content.split("\n")
    .filter(l => /^[-*]\s/.test(l.trim()))
    .map(l => l.trim().replace(/^[-*]\s*/, ""))
}

// ─── Freshness helpers (universal pattern for all life tabs) ───

const MONTHS: Record<string, number> = {
  january:0, february:1, march:2, april:3, may:4, june:5,
  july:6, august:7, september:8, october:9, november:10, december:11,
  jan:0, feb:1, mar:2, apr:3, jun:5, jul:6, aug:7, sep:8, sept:8, oct:9, nov:10, dec:11,
}

// Pulls a LAST-UPDATED date out of a block of text. Only matches explicit
// last-modified phrasing — never bare "Date:" or frontmatter `date:` which
// often means CREATED date, not updated. Supported:
//   "Last updated: April 2026"      "As of: Jan 2026"     "Updated: 2025-09-03"
//   "*Last updated: September 3, 2025*"
// Returns ISO yyyy-mm-dd (clamped to not exceed today) or null.
function parseContentDate(content: string): string | null {
  if (!content) return null
  const head = content.slice(0, 2000)
  const prefix = "(?:last[-_ ]updated|last[-_ ]modified|as[-_ ]of|updated)"
  const iso = head.match(new RegExp(`${prefix}[^\\n]*?(\\d{4}-\\d{2}-\\d{2})`, "i"))
  if (iso) return clampFuture(iso[1])
  const monthYear = head.match(new RegExp(`${prefix}[^\\n]*?([A-Za-z]{3,9})\\s+(?:\\d{1,2},?\\s+)?(\\d{4})`, "i"))
  if (monthYear) {
    const m = MONTHS[monthYear[1].toLowerCase()]
    if (m !== undefined) {
      const dayMatch = monthYear[0].match(/([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})/)
      const day = dayMatch ? parseInt(dayMatch[2]) : 1
      return clampFuture(`${monthYear[2]}-${String(m+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`)
    }
  }
  return null
}

function clampFuture(iso: string): string {
  const today = new Date().toISOString().slice(0,10)
  return iso > today ? today : iso
}

// Parses dates hidden in filenames: lab_results_Jan2026.md → 2026-01-01,
// lab_results_Sep42025.md → 2025-09-04, report-2025-09-03.md → 2025-09-03.
function parseFilenameDate(name: string): string | null {
  const iso = name.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const mdy = name.match(/([A-Za-z]{3,9})(\d{0,2})(\d{4})/)
  if (mdy) {
    const m = MONTHS[mdy[1].toLowerCase()]
    if (m !== undefined) {
      const day = mdy[2] ? parseInt(mdy[2]) : 1
      return `${mdy[3]}-${String(m+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`
    }
  }
  return null
}

export interface FreshnessFile { name: string; date: string | null; source: "state"|"content"|"filename"|"mtime"|"unknown" }
export interface Freshness {
  dataDate: string | null      // ISO yyyy-mm-dd
  label: string                // "Sep 3, 2025" or "No date info"
  daysOld: number | null
  tier: "fresh"|"aging"|"stale"|"unknown"
  perFile: FreshnessFile[]
}

// Core resolver. Callers pass a list of candidate sources per file.
// Preference: explicit source date → content-parsed date → filename date → mtime.
// Files with no date are included in perFile with source:"unknown" but don't pollute overall.
function computeFreshness(entries: Array<{
  name: string
  content?: string           // raw file content, if available
  sourceDate?: string | null // domain-authoritative override (e.g. state.json.last_run)
}>): Freshness {
  const perFile: FreshnessFile[] = entries.map(e => {
    if (e.sourceDate) return { name: e.name, date: clampFuture(e.sourceDate.slice(0,10)), source: "state" as const }
    const byContent = e.content ? parseContentDate(e.content) : null
    if (byContent) return { name: e.name, date: byContent, source: "content" as const }
    const byName = parseFilenameDate(e.name)
    if (byName) return { name: e.name, date: byName, source: "filename" as const }
    return { name: e.name, date: null, source: "unknown" as const }
  })

  const dated = perFile.filter(f => f.date).sort((a,b) => a.date!.localeCompare(b.date!))
  if (dated.length === 0) {
    return { dataDate: null, label: "No date info", daysOld: null, tier: "unknown", perFile }
  }
  const oldest = dated[0].date!
  const daysOld = Math.max(0, Math.floor((Date.now() - new Date(oldest + "T00:00:00Z").getTime()) / 86_400_000))
  const tier: Freshness["tier"] =
    daysOld < 30 ? "fresh" :
    daysOld < 120 ? "aging" : "stale"
  const d = new Date(oldest + "T00:00:00Z")
  const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
  return { dataDate: oldest, label, daysOld, tier, perFile }
}

// Parses the FIRST markdown pipe-table found in `content` and returns
// { label, annual } pairs from columns [0, 1]. Summary rows whose label
// starts with "Total" (with or without markdown bold) are excluded.
// Dollar strings like "$12,000", "~$9,500", "~$40K" all parse to a number.
function parseCurrencyTable(content: string): { label: string; annual: number }[] {
  if (!content) return []
  const lines = content.split("\n")
  const rows: { label: string; annual: number }[] = []
  let inTable = false
  let sawHeader = false
  for (const raw of lines) {
    const line = raw.trim()
    if (!line.startsWith("|")) {
      if (inTable) break // table ended
      continue
    }
    // Separator row like |---|---|
    if (/^\|\s*-+/.test(line)) { inTable = true; continue }
    if (!inTable) {
      // First |...| line is the header
      if (!sawHeader) { sawHeader = true; continue }
    }
    const cells = line.split("|").slice(1, -1).map(c => c.trim())
    if (cells.length < 2) continue
    const label = cells[0].replace(/\*\*/g, "").trim()
    if (!label || /^total/i.test(label)) continue
    const amount = parseCurrencyCell(cells[1])
    if (amount > 0) rows.push({ label, annual: amount })
  }
  return rows
}

function parseCurrencyCell(cell: string): number {
  if (!cell) return 0
  const cleaned = cell.replace(/\*\*/g, "").replace(/[~$,]/g, "").trim()
  const km = cleaned.match(/^([\d.]+)\s*([KkMm])\b/)
  if (km) {
    const base = parseFloat(km[1])
    return km[2].toLowerCase() === "m" ? base * 1_000_000 : base * 1_000
  }
  const plain = cleaned.match(/^[\d.]+/)
  return plain ? parseFloat(plain[0]) : 0
}

function parseGoals(content: string): { id: string, text: string }[] {
  return content.split("\n")
    .filter(l => /^[-*]\s*\*{0,2}G\d+\*{0,2}:/.test(l))
    .map(l => {
      const m = l.match(/\*{0,2}(G\d+)\*{0,2}:\s*(.+)/)
      return m ? { id: m[1], text: m[2].trim() } : null
    })
    .filter(Boolean) as { id: string, text: string }[]
}

function parseSections(content: string): { heading: string, body: string }[] {
  if (!content.trim()) return []
  const sections: { heading: string, body: string }[] = []

  const parts = content.split(/^## /m)
  for (const part of parts.slice(1)) {
    const newline = part.indexOf("\n")
    if (newline === -1) continue
    const heading = part.slice(0, newline).trim()
    const body = part.slice(newline + 1).trim()
    if (body) sections.push({ heading, body })
  }
  if (sections.length > 0) return sections

  const lines = content.split("\n")
  let currentBullet: { heading: string, body: string } | null = null
  let currentPara: string[] = []

  const commitPara = () => {
    if (currentPara.length === 0) return
    const joined = currentPara.join(" ").replace(/\s+/g, " ").trim()
    if (joined) {
      const heading = joined.length > 80 ? joined.slice(0, 77).trim() + "..." : joined
      sections.push({ heading, body: joined })
    }
    currentPara = []
  }
  const commitBullet = () => {
    if (currentBullet) sections.push(currentBullet)
    currentBullet = null
  }

  for (const line of lines) {
    const idBullet = line.match(/^-\s+\*{0,2}([A-Z]{1,3}\d+[a-z]?)\*{0,2}:\s*(.+)$/)
    const plainBullet = line.match(/^-\s+(.+)$/)
    const indented = line.match(/^\s+(\S.*)$/)
    const isBlank = line.trim() === ""
    const isHeading = /^#{1,6}\s/.test(line)

    if (idBullet) {
      commitPara()
      commitBullet()
      currentBullet = { heading: idBullet[1], body: idBullet[2].trim() }
    } else if (plainBullet) {
      commitPara()
      commitBullet()
      const text = plainBullet[1].trim()
      const heading = text.length > 70 ? text.slice(0, 67).trim() + "..." : text
      currentBullet = { heading, body: text }
    } else if (indented && currentBullet) {
      currentBullet.body += " " + indented[1].trim()
    } else if (isBlank) {
      commitPara()
      commitBullet()
    } else if (isHeading) {
      commitPara()
      commitBullet()
    } else {
      commitBullet()
      currentPara.push(line.trim())
    }
  }
  commitPara()
  commitBullet()

  return sections
}

function readDirMdFiles(dir: string): { name: string, content: string, sections: { heading: string, body: string }[] }[] {
  if (!existsSync(dir)) return []
  const files: { name: string, content: string, sections: { heading: string, body: string }[] }[] = []
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".md") || f === "README.md") continue
    const content = readMd(join(dir, f))
    files.push({ name: f.replace(".md", ""), content: content.slice(0, 2000), sections: parseSections(content) })
  }
  return files
}

// ── GET /api/user-index ──
// Serves Pulse/state/user-index.json, produced by Pulse/modules/user-index.ts.
// Optional ?filter=stats|publish|stale|gaps to return sub-slices.

function handleUserIndexApi(filter: string | null): Response {
  try {
    const PAI_DIR = process.env.PAI_DIR || join(process.env.HOME || "", ".claude", "PAI")
    const indexPath = join(PAI_DIR, "PULSE", "state", "user-index.json")
    const raw = Bun.file(indexPath)
    if (!raw.size) {
      return Response.json(
        { error: "user-index.json not generated — run bun Pulse/modules/user-index.ts" },
        { status: 503 },
      )
    }
    const text = readFileSync(indexPath, "utf-8")
    const index = JSON.parse(text)
    if (filter === "stats") return Response.json(index.stats)
    if (filter === "publish") return Response.json(index.publish_feed)
    if (filter === "stale") return Response.json(index.stale_queue)
    if (filter === "gaps") return Response.json(index.interview_gaps)
    return Response.json(index)
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}

// ── GET /api/life/home ──

function handleLifeHome(): Response {
  try {
    const current = readMd(join(TELOS_DIR, "CURRENT.md"))
    const goalsRaw = readMd(join(TELOS_DIR, "GOALS.md"))
    const sparksRaw = readMd(join(TELOS_DIR, "SPARKS.md"))
    const timelineRaw = readMd(join(TELOS_DIR, "2036.md"))

    const fields = parseBoldFields(current)
    const actions = parseNumberedList(current, "## Next likely actions")
    const goals = parseGoals(goalsRaw).slice(0, 3)
    const sparkNames = sparksRaw.split("\n").filter(l => l.startsWith("### ")).map(l => l.replace(/^###\s*/, ""))
    const randomSpark = sparkNames.length > 0 ? sparkNames[Math.floor(Math.random() * sparkNames.length)] : null
    const timelineBlocks = timelineRaw.split("\n").filter(l => l.startsWith("### ")).length

    const mood = fields.mood || "Unknown"
    const energy = fields.energy || "Unknown"
    const focus = fields.focus || "Unknown"
    const oneSentence = `${mood}, ${energy} energy. Focused on: ${focus}.`

    return Response.json({
      oneSentence,
      current: fields,
      topGoals: goals,
      nextActions: actions,
      spark: randomSpark,
      sparkCount: sparkNames.length,
      timelineBlockCount: timelineBlocks,
      topIntent: fields.top_intent || null,
    })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

// ── GET /api/life/health ──

function handleLifeHealth(): Response {
  try {
    const files = readDirMdFiles(HEALTH_DIR)
    // Also check for lab results
    const labFiles = existsSync(HEALTH_DIR)
      ? readdirSync(HEALTH_DIR).filter(f => f.startsWith("lab_results"))
      : []

    // Freshness: lab file names encode dates; content date on structured files.
    // Most recent lab result wins when fresher than content dates.
    const freshnessEntries: Array<{ name: string; content?: string; sourceDate?: string | null }> = []
    for (const lab of labFiles) {
      freshnessEntries.push({ name: lab, sourceDate: parseFilenameDate(lab) })
    }
    for (const structured of ["CONDITIONS.md", "MEDICATIONS.md", "FITNESS.md", "NUTRITION.md", "METRICS.md", "HISTORY.md"]) {
      freshnessEntries.push({ name: structured, content: readMd(join(HEALTH_DIR, structured)) })
    }
    const freshness = computeFreshness(freshnessEntries)

    return Response.json({
      files: files.map(f => ({ name: f.name, sections: f.sections.map(s => s.heading) })),
      conditions: parseSections(readMd(join(HEALTH_DIR, "CONDITIONS.md"))),
      medications: parseSections(readMd(join(HEALTH_DIR, "MEDICATIONS.md"))),
      fitness: parseSections(readMd(join(HEALTH_DIR, "FITNESS.md"))),
      nutrition: parseSections(readMd(join(HEALTH_DIR, "NUTRITION.md"))),
      routine: parseSections(readMd(join(HEALTH_DIR, "routine.md"))),
      providers: parseSections(readMd(join(HEALTH_DIR, "PROVIDERS.md"))),
      metrics: parseSections(readMd(join(HEALTH_DIR, "METRICS.md"))),
      history: parseSections(readMd(join(HEALTH_DIR, "HISTORY.md"))),
      labReports: labFiles,
      freshness,
    })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

// ── GET /api/life/finances ──

function handleLifeFinances(): Response {
  try {
    const stateJson = readMd(join(FINANCES_DIR, "state.json"))
    let state = {}
    try { state = JSON.parse(stateJson) } catch {}

    const incomeRaw = readMd(join(FINANCES_DIR, "INCOME.md"))
    const expensesRaw = readMd(join(FINANCES_DIR, "EXPENSES.md"))
    const accountsRaw = readMd(join(FINANCES_DIR, "ACCOUNTS.md"))
    const investmentsRaw = readMd(join(FINANCES_DIR, "INVESTMENTS.md"))
    const taxesRaw = readMd(join(FINANCES_DIR, "TAXES.md"))

    // Freshness: state.json.last_run is the authoritative statement-processing
    // timestamp; per-file content dates are a fallback for files the user
    // writes by hand. See freshness helpers above for the source priority.
    const stateLastRun = (state as any)?.last_run ?? null
    const vendorsRaw = readMd(join(FINANCES_DIR, "vendors.yaml"))
    const obligationsRaw = readMd(join(FINANCES_DIR, "obligations.yaml"))

    // Per-card freshness — each card surfaces its own indicator pulling
    // only from the files it actually depends on. The composite `freshness`
    // is preserved for the page header / Income hero.
    const freshness = computeFreshness([
      { name: "Statement imports (state.json)", sourceDate: stateLastRun },
      { name: "INCOME.md", content: incomeRaw },
      { name: "EXPENSES.md", content: expensesRaw },
      { name: "ACCOUNTS.md", content: accountsRaw },
      { name: "INVESTMENTS.md", content: investmentsRaw },
      { name: "TAXES.md", content: taxesRaw },
    ])
    const freshnessIncome = computeFreshness([
      { name: "Statement imports (state.json)", sourceDate: stateLastRun },
      { name: "INCOME.md", content: incomeRaw },
    ])
    const freshnessOutbound = computeFreshness([
      { name: "EXPENSES.md", content: expensesRaw },
      { name: "vendors.yaml", content: vendorsRaw },
      { name: "obligations.yaml", content: obligationsRaw },
    ])
    const freshnessAccounts = computeFreshness([
      { name: "Statement imports (state.json)", sourceDate: stateLastRun },
      { name: "ACCOUNTS.md", content: accountsRaw },
    ])
    const freshnessInvestments = computeFreshness([
      { name: "INVESTMENTS.md", content: investmentsRaw },
    ])
    const freshnessTaxes = computeFreshness([
      { name: "TAXES.md", content: taxesRaw },
    ])
    const freshnessOverall = freshness

    // Pull numeric flow data from the first summary table in each file.
    // INCOME.md leads with "Annual Income Estimate"; EXPENSES.md leads
    // with "Annual Expense Summary". parseCurrencyTable finds the first
    // pipe-table and skips any Total rows.
    const incomeStreams = parseCurrencyTable(incomeRaw)
    const expenseCategories = parseCurrencyTable(expensesRaw)
    const annualIncome = incomeStreams.reduce((s, r) => s + r.annual, 0)
    const annualExpenses = expenseCategories.reduce((s, r) => s + r.annual, 0)
    const monthlyIncome = annualIncome / 12
    const monthlyExpenses = annualExpenses / 12
    const net = annualIncome - annualExpenses

    // ── v2 envelope: Income / Outbound / Overall ──

    const vendorsYaml = loadYaml<{ vendors?: VendorYaml[] }>(join(FINANCES_DIR, "vendors.yaml"))
    const obligationsYaml = loadYaml<{ obligations?: ObligationYaml[] }>(join(FINANCES_DIR, "obligations.yaml"))
    const vendors = vendorsYaml?.vendors ?? []
    const obligations = obligationsYaml?.obligations ?? []
    const collectorData = readVendorCostsJsonl()
    const spendBundle = readStatementSpendJsonl()
    const spendInsights = buildSpendInsights(spendBundle.records)

    // Resolve each vendor's monthly spend.
    // Priority: collector JSONL (≤35d) > manual_monthly_usd > manual_annual_usd/12.
    interface ResolvedLine {
      id: string
      name: string
      scope: string
      monthly_usd: number
      annual_usd: number
      source: "collector" | "manual" | "unconfigured"
      cadence: string
      tags?: string[]
      notes?: string
      collector?: string
    }

    const resolvedVendors: ResolvedLine[] = vendors.map(v => {
      const hit = collectorData.get(v.id)
      if (hit) {
        return {
          id: v.id,
          name: v.name ?? v.id,
          scope: v.scope,
          monthly_usd: Math.round(hit.cost_usd * 100) / 100,
          annual_usd: Math.round(hit.cost_usd * 12 * 100) / 100,
          source: "collector",
          cadence: v.cadence,
          tags: v.tags,
          notes: v.notes,
          collector: v.collector,
        }
      }
      const monthly = v.manual_monthly_usd ??
        (v.manual_annual_usd ? v.manual_annual_usd / 12 : 0)
      return {
        id: v.id,
        name: v.name ?? v.id,
        scope: v.scope,
        monthly_usd: Math.round(monthly * 100) / 100,
        annual_usd: Math.round(monthly * 12 * 100) / 100,
        source: monthly > 0 ? "manual" : "unconfigured",
        cadence: v.cadence,
        tags: v.tags,
        notes: v.notes,
        collector: v.collector,
      }
    })

    const resolvedObligations: ResolvedLine[] = obligations.map(o => {
      const monthly = cadenceToMonthly(o.amount_usd, o.cadence)
      return {
        id: o.id,
        name: o.name ?? o.id,
        scope: "personal",
        monthly_usd: Math.round(monthly * 100) / 100,
        annual_usd: Math.round(monthly * 12 * 100) / 100,
        source: "manual",
        cadence: o.cadence,
        tags: [o.category],
        notes: o.notes,
      }
    })

    // "Other" outbound = EXPENSES.md rows whose label doesn't match any vendor
    // or obligation. Keeps legacy subscriptions, personal lifestyle, etc.
    // Matching is case-insensitive substring in either direction.
    const knownLabels = new Set<string>([
      ...resolvedVendors.map(v => v.name.toLowerCase()),
      ...resolvedVendors.map(v => v.id.toLowerCase()),
      ...resolvedObligations.map(o => o.name.toLowerCase()),
    ])
    const otherOutbound: ResolvedLine[] = expenseCategories
      .filter(e => {
        const lower = e.label.toLowerCase()
        for (const known of knownLabels) {
          if (lower.includes(known) || known.includes(lower)) return false
        }
        return true
      })
      .map(e => ({
        id: e.label.toLowerCase().replace(/\s+/g, "_"),
        name: e.label,
        scope: "mixed",
        monthly_usd: Math.round((e.annual / 12) * 100) / 100,
        annual_usd: e.annual,
        source: "manual" as const,
        cadence: "annual",
        tags: ["legacy"],
      }))

    const outboundVendorsAnnual = resolvedVendors.reduce((s, v) => s + v.annual_usd, 0)
    const outboundObligationsAnnual = resolvedObligations.reduce((s, o) => s + o.annual_usd, 0)
    const outboundOtherAnnual = otherOutbound.reduce((s, o) => s + o.annual_usd, 0)
    const outboundAnnual = outboundVendorsAnnual + outboundObligationsAnnual + outboundOtherAnnual
    const outboundMonthly = outboundAnnual / 12

    // Income breakdown with MRR estimate (membership + any annual/12 stream).
    const mrrAnnualMarkers = /membership|subscription|substack|beehiiv|patreon/i
    const mrrAnnual = incomeStreams
      .filter(s => mrrAnnualMarkers.test(s.label))
      .reduce((sum, s) => sum + s.annual, 0)
    const mrrMonthly = mrrAnnual / 12

    // Effective tax rate from TAXES.md for post-tax overall.
    const { rate: effectiveTaxRate, source: effectiveTaxRateSource } = parseEffectiveTaxRate(taxesRaw)
    const overallAnnual = annualIncome - outboundAnnual
    const netPreTax = overallAnnual
    const netPostTax = overallAnnual * (1 - effectiveTaxRate)
    const overallMonthly = overallAnnual / 12

    // 12-month trend: currently flat (historical per-month data not tracked yet).
    // Populated by Phase 3 when we have per-month history. Until then, return
    // the current month N=12 times so the UI renders without erroring; source
    // is tagged so the UI can show a "flat baseline" notice.
    const trend = Array.from({ length: 12 }, (_, i) => {
      const d = new Date()
      d.setMonth(d.getMonth() - (11 - i))
      return {
        month: d.toISOString().slice(0, 7),
        income: Math.round(annualIncome / 12),
        outbound: Math.round(outboundMonthly),
        net: Math.round(overallMonthly),
      }
    })

    const v2 = {
      version: 2,
      income: {
        streams: incomeStreams,
        annual: annualIncome,
        monthly: monthlyIncome,
        mrr_monthly: Math.round(mrrMonthly),
        mrr_annual: mrrAnnual,
      },
      outbound: {
        vendors: resolvedVendors,
        obligations: resolvedObligations,
        other: otherOutbound,
        annual: Math.round(outboundAnnual),
        monthly: Math.round(outboundMonthly),
        vendors_annual: Math.round(outboundVendorsAnnual),
        obligations_annual: Math.round(outboundObligationsAnnual),
        other_annual: Math.round(outboundOtherAnnual),
      },
      overall: {
        net_pre_tax_annual: Math.round(netPreTax),
        net_pre_tax_monthly: Math.round(netPreTax / 12),
        net_post_tax_annual: Math.round(netPostTax),
        net_post_tax_monthly: Math.round(netPostTax / 12),
        effective_tax_rate: effectiveTaxRate,
        effective_tax_rate_source: effectiveTaxRateSource,
        trend,
      },
      collector_status: {
        configured_vendors: resolvedVendors.filter(v => v.collector).length,
        active_collectors: Array.from(collectorData.keys()),
        jsonl_path: "MEMORY/OBSERVABILITY/vendor-costs.jsonl",
      },
      insights: {
        ...spendInsights,
        statement_spend: {
          generated_at: spendBundle.generated_at,
          record_count: spendBundle.records.length,
          jsonl_path: "MEMORY/OBSERVABILITY/statement-spend.jsonl",
          tool: "USER/FINANCES/Tools/StatementAnalyzer.ts",
        },
      },
    }

    return Response.json({
      // v2 envelope
      ...v2,
      // v1 fields preserved (backward compat for existing page.tsx until migrated)
      accounts: parseSections(readMd(join(FINANCES_DIR, "ACCOUNTS.md"))),
      expenses: parseSections(expensesRaw),
      investments: parseSections(readMd(join(FINANCES_DIR, "INVESTMENTS.md"))),
      goals: parseSections(readMd(join(FINANCES_DIR, "GOALS.md"))),
      taxes: parseSections(readMd(join(FINANCES_DIR, "TAXES.md"))),
      overview: parseSections(readMd(join(FINANCES_DIR, "FINANCES.md"))),
      incomeStreams,
      expenseCategories,
      annualIncome,
      annualExpenses,
      monthlyIncome,
      monthlyExpenses,
      net,
      freshness,
      freshness_per_card: {
        income: freshnessIncome,
        outbound: freshnessOutbound,
        overall: freshnessOverall,
        accounts: freshnessAccounts,
        investments: freshnessInvestments,
        taxes: freshnessTaxes,
      },
      state,
    })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

// ── GET /api/life/business ──

function handleLifeBusiness(): Response {
  try {
    const ulDir = join(BUSINESS_DIR, "UNSUPERVISEDLEARNING")
    const revenueDir = join(ulDir, "Revenue")

    // Find most recent revenue report
    let latestRevenue = ""
    let latestRevenueFile = ""
    if (existsSync(revenueDir)) {
      const revFiles = readdirSync(revenueDir).filter(f => f.endsWith(".md")).sort().reverse()
      if (revFiles.length > 0) {
        latestRevenueFile = revFiles[0]
        latestRevenue = readMd(join(revenueDir, revFiles[0]))
      }
    }

    // Parse revenue summary table
    const revenueSections = parseSections(latestRevenue)
    const summarySection = revenueSections.find(s => s.heading === "Summary")
    const revenueByProduct = revenueSections.find(s => s.heading.includes("Product"))

    return Response.json({
      latestRevenueReport: latestRevenueFile,
      revenueSummary: summarySection?.body || "",
      revenueByProduct: revenueByProduct?.body || "",
      revenueAllSections: revenueSections,
      ulOverview: parseSections(readMd(join(ulDir, "README.md"))),
      businessOverview: parseSections(readMd(join(BUSINESS_DIR, "README.md"))),
    })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

// ── GET /api/life/work ──

function handleLifeWork(): Response {
  try {
    const projectsContent = readMd(PROJECTS_FILE)
    // Parse project table rows
    const projectLines = projectsContent.split("\n")
      .filter(l => l.startsWith("|") && !l.includes("---") && !l.includes("Project"))
      .map(l => {
        const cols = l.split("|").map(c => c.trim()).filter(Boolean)
        return cols.length >= 3 ? { name: cols[0]?.replace(/\*\*/g, ""), path: cols[1], url: cols[2] } : null
      })
      .filter(Boolean)
      .slice(0, 20)

    // Current workstreams from CURRENT.md
    const current = readMd(join(TELOS_DIR, "CURRENT.md"))
    const fields = parseBoldFields(current)

    // Active algorithm sessions from work.json
    let activeSessions: any[] = []
    try {
      if (existsSync(WORK_JSON_PATH)) {
        const workData = JSON.parse(readFileSync(WORK_JSON_PATH, "utf-8"))
        const sessions = workData.sessions || {}
        activeSessions = Object.entries(sessions)
          .map(([slug, s]: [string, any]) => ({
            slug,
            task: s.task || slug,
            phase: s.phase || "idle",
            progress: s.progress || "0/0",
            effort: s.effort || "standard",
          }))
          .filter((s: any) => s.phase !== "complete" && s.phase !== "idle")
          .slice(0, 10)
      }
    } catch {}

    return Response.json({
      projects: projectLines,
      currentFocus: fields.focus || "",
      currentProject: fields.current_project || "",
      activeWorkstreams: fields.active_workstreams || "",
      algorithmSessions: activeSessions,
    })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

// ── GET /api/life/goals ──

function handleLifeGoals(): Response {
  try {
    const mission = readMd(join(TELOS_DIR, "MISSION.md"))
    const goalsRaw = readMd(join(TELOS_DIR, "GOALS.md"))
    const strategies = readMd(join(TELOS_DIR, "STRATEGIES.md"))
    const challenges = readMd(join(TELOS_DIR, "CHALLENGES.md"))
    const beliefs = readMd(join(TELOS_DIR, "BELIEFS.md"))
    const models = readMd(join(TELOS_DIR, "MODELS.md"))
    const narratives = readMd(join(TELOS_DIR, "NARRATIVES.md"))
    const wisdom = readMd(join(TELOS_DIR, "WISDOM.md"))
    const problems = readMd(join(TELOS_DIR, "PROBLEMS.md"))
    const predictions = readMd(join(TELOS_DIR, "PREDICTIONS.md"))
    const frames = readMd(join(TELOS_DIR, "FRAMES.md"))
    const wrong = readMd(join(TELOS_DIR, "WRONG.md"))
    const learned = readMd(join(TELOS_DIR, "LEARNED.md"))
    const ideas = readMd(join(TELOS_DIR, "IDEAS.md"))
    const sparks = readMd(join(TELOS_DIR, "SPARKS.md"))
    const timeline2036 = readMd(join(TELOS_DIR, "2036.md"))
    const authors = readMd(join(TELOS_DIR, "AUTHORS.md"))
    const books = readMd(join(TELOS_DIR, "BOOKS.md"))
    const movies = readMd(join(TELOS_DIR, "MOVIES.md"))
    const traumas = readMd(join(TELOS_DIR, "TRAUMAS.md"))
    const status = readMd(join(TELOS_DIR, "STATUS.md"))
    const telosProjects = readMd(join(TELOS_DIR, "PROJECTS.md"))
    // TELOS.md is the master file — contains LESSONS and richer content than individual files
    const telosMaster = readMd(join(TELOS_DIR, "TELOS.md"))

    return Response.json({
      mission: parseSections(mission),
      goals: parseGoals(goalsRaw),
      problems: parseSections(problems),
      strategies: parseSections(strategies),
      narratives: parseSections(narratives),
      challenges: parseSections(challenges),
      beliefs: parseBullets(beliefs),
      models: parseSections(models),
      wisdom: parseSections(wisdom),
      predictions: parseSections(predictions),
      frames: parseBullets(frames),
      wrong: parseSections(wrong),
      learned: parseSections(learned),
      ideas: parseSections(ideas),
      authors: parseBullets(authors),
      books: parseBullets(books),
      movies: parseBullets(movies),
      traumas: parseSections(traumas),
      status: parseSections(status),
      telosProjects: parseSections(telosProjects),
      sparks: sparks.split("\n").filter(l => l.startsWith("### ")).map(l => l.replace(/^###\s*/, "")),
      timeline2036Blocks: timeline2036.split("\n").filter(l => l.startsWith("### ")).length,
      timeline2036Raw: timeline2036,
      telosMasterRaw: telosMaster,
    })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

// ── TELOS v7 file editor APIs ──

interface LifeSection {
  heading: string
  body: string
}

interface LifeGoalEntry {
  id: string
  text?: string
  title?: string
  kpi?: string
  target?: string
  pct?: number
}

interface LifeGoalsPayload {
  mission?: unknown
  goals?: unknown
  problems?: unknown
  strategies?: unknown
  challenges?: unknown
}

interface ParsedHeading {
  id: string
  title: string
  body: string
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function asLifeSections(value: unknown): LifeSection[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is LifeSection => (
    isRecord(item) && typeof item.heading === "string" && typeof item.body === "string"
  ))
}

function asLifeGoals(value: unknown): LifeGoalEntry[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is LifeGoalEntry => (
    isRecord(item) && typeof item.id === "string"
  ))
}

function cleanInlineMarkdown(value: string): string {
  return value.replace(/\*\*/g, "").replace(/\*/g, "").trim()
}

function firstParagraph(value: string): string {
  const para = value.split(/\n\s*\n/).find((part) => part.trim().length > 0)
  return cleanInlineMarkdown(para ?? value).replace(/\s+/g, " ").trim()
}

function parseHeadingText(heading: string, prefix: string, body: string): ParsedHeading | null {
  const match = heading.match(new RegExp(`^(${prefix}\\d+[a-z]?)\\s*:\\s*(.+)$`, "i"))
  if (!match) return null
  return { id: match[1], title: cleanInlineMarkdown(match[2]), body }
}

function parseNestedHeadings(body: string, prefix: string): ParsedHeading[] {
  const out: ParsedHeading[] = []
  let current: ParsedHeading | null = null
  let currentBody: string[] = []
  const commit = (): void => {
    if (!current) return
    out.push({ ...current, body: currentBody.join("\n").trim() })
    current = null
    currentBody = []
  }

  for (const line of body.split("\n")) {
    const match = line.match(new RegExp(`^#{2,4}\\s+(${prefix}\\d+[a-z]?)\\s*:\\s*(.+)$`, "i"))
    if (match) {
      commit()
      current = { id: match[1], title: cleanInlineMarkdown(match[2]), body: "" }
      currentBody = []
    } else if (current) {
      currentBody.push(line)
    } else {
      continue
    }
  }
  commit()
  return out
}

function parseSourceHeadings(sections: LifeSection[], prefix: string): ParsedHeading[] {
  const seen = new Set<string>()
  const out: ParsedHeading[] = []
  const add = (entry: ParsedHeading): void => {
    if (seen.has(entry.id)) return
    seen.add(entry.id)
    out.push(entry)
  }

  for (const section of sections) {
    const parsed = parseHeadingText(section.heading, prefix, section.body)
    if (parsed) add(parsed)
    for (const nested of parseNestedHeadings(section.body, prefix)) add(nested)
  }
  return out
}

async function handleTelosFileGet(searchParams: URLSearchParams): Promise<Response> {
  try {
    const valid = validateTelosFileName(searchParams.get("name"))
    if (!valid.ok) return Response.json({ error: valid.error }, { status: 400 })

    const p = join(TELOS_DIR, valid.name)
    const file = Bun.file(p)
    if (!(await file.exists())) {
      return Response.json({ name: valid.name, content: "", mtime: null, missing: true })
    }

    const content = await file.text()
    const mtime = (await file.stat()).mtime.toISOString()
    return Response.json({ name: valid.name, content, mtime, missing: false })
  } catch (err) {
    return Response.json({ error: errorMessage(err) }, { status: 500 })
  }
}

async function handleTelosFilePut(req: Request): Promise<Response> {
  try {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return Response.json({ error: "invalid json" }, { status: 400 })
    }

    if (!isRecord(body)) return Response.json({ error: "body must be an object" }, { status: 400 })
    const valid = validateTelosFileName(body.name)
    if (!valid.ok) return Response.json({ error: valid.error }, { status: 400 })
    if (typeof body.content !== "string") return Response.json({ error: "content must be a string" }, { status: 400 })
    if (body.content.length > 1_048_576) return Response.json({ error: "content exceeds 1 MiB" }, { status: 400 })

    const p = join(TELOS_DIR, valid.name)
    await Bun.write(p, body.content)
    const mtime = (await Bun.file(p).stat()).mtime.toISOString()
    return Response.json({ ok: true, mtime })
  } catch (err) {
    return Response.json({ error: errorMessage(err) }, { status: 500 })
  }
}

async function handleTelosOverview(): Promise<Response> {
  try {
    const lifeResponse = handleLifeGoals()
    if (!lifeResponse.ok) {
      return Response.json({ error: `life goals returned ${lifeResponse.status}` }, { status: 500 })
    }
    const life = await lifeResponse.json() as LifeGoalsPayload
    const missions = parseSourceHeadings(asLifeSections(life.mission), "M").map((m) => ({
      id: m.id,
      title: m.title,
    }))
    const goals = asLifeGoals(life.goals).map((g) => ({
      id: g.id,
      title: cleanInlineMarkdown(g.title ?? g.text ?? g.id),
      kpi: typeof g.kpi === "string" ? g.kpi : "",
      target: typeof g.target === "string" ? g.target : "",
      pct: typeof g.pct === "number" ? g.pct : 0,
      delta: null,
      dims: [],
      metrics: [],
    }))
    const problems = parseSourceHeadings(asLifeSections(life.problems), "P").map((p) => ({
      id: p.id,
      title: p.title,
      note: firstParagraph(p.body),
      severity: "med",
      affects: [],
    }))
    const strategies = parseSourceHeadings(asLifeSections(life.strategies), "S").map((s) => ({
      id: s.id,
      title: s.title,
      implements: [],
    }))
    const challenges = parseSourceHeadings(asLifeSections(life.challenges), "C").map((c) => ({
      id: c.id,
      title: c.title,
    }))

    return Response.json({
      owner: null,
      idealState: null,
      dimensions: null,
      snapshot: null,
      problems,
      missions,
      goals,
      metrics: null,
      challenges,
      strategies,
      projects: null,
      team: null,
      budget: null,
      recommendations: null,
      stranded: null,
      subtabs: null,
      preferences: null,
      narrativeSeed: null,
    })
  } catch (err) {
    return Response.json({ error: errorMessage(err) }, { status: 500 })
  }
}

// ── GET /api/life/air ──

function handleLifeAir(): Response {
  try {
    const cachePath = join(MEMORY_DIR, "_AIRGRADIENT", "latest.json")
    if (!existsSync(cachePath)) {
      return Response.json({ monitors: [], count: 0, error: "cache not primed" })
    }
    const raw = readFileSync(cachePath, "utf8")
    const data = JSON.parse(raw)
    const monitors = Array.isArray(data?.monitors) ? data.monitors : []

    const pm25Breakpoints: Array<[number, number, number, number]> = [
      [0, 12, 0, 50],
      [12.1, 35.4, 51, 100],
      [35.5, 55.4, 101, 150],
      [55.5, 150.4, 151, 200],
      [150.5, 250.4, 201, 300],
      [250.5, 500.4, 301, 500],
    ]
    const aqiFrom = (pm: number): number => {
      for (const [cLo, cHi, aLo, aHi] of pm25Breakpoints) {
        if (pm >= cLo && pm <= cHi) return Math.round(((aHi - aLo) / (cHi - cLo)) * (pm - cLo) + aLo)
      }
      return pm > 500 ? 500 : 0
    }
    const aqiLabel = (a: number): string => {
      if (a <= 50) return "Good"
      if (a <= 100) return "Moderate"
      if (a <= 150) return "USG"
      if (a <= 200) return "Unhealthy"
      if (a <= 300) return "Very Unhealthy"
      return "Hazardous"
    }

    const shaped = monitors.map((m: any) => {
      const pm25 = m.pm02_corrected ?? m.pm02
      const co2 = m.rco2_corrected ?? m.rco2
      const temp = m.atmp_corrected ?? m.atmp
      const rh = m.rhum_corrected ?? m.rhum
      const aqi = typeof pm25 === "number" ? aqiFrom(pm25) : null
      return {
        id: m.locationId,
        name: String(m.locationName || "").trim(),
        pm25, co2, temp, rh,
        tvoc: m.tvocIndex ?? null,
        nox: m.noxIndex ?? null,
        aqi,
        aqiLabel: aqi !== null ? aqiLabel(aqi) : null,
        timestamp: m.timestamp,
        type: m.locationType || null,
      }
    })
    const worstAqi = shaped.reduce((w: number | null, s: any) => {
      if (s.aqi === null) return w
      return w === null || s.aqi > w ? s.aqi : w
    }, null as number | null)
    const worstLabel = worstAqi !== null ? aqiLabel(worstAqi) : null

    return Response.json({
      fetched_at: data.fetched_at ?? null,
      count: shaped.length,
      worst_aqi: worstAqi,
      worst_label: worstLabel,
      monitors: shaped,
    })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

// ── Legacy /api/observability/life-card (redirects to /api/life/home) ──

function handleLifeCardApi(): Response {
  return handleLifeHome()
}

// ── /api/onboarding/state ──
//
// Drives the TemplateOnboarding banner shown above every dashboard page on a
// fresh install. Two signals trigger template mode:
//   1. Build-time env flag — `PAI_TEMPLATE_MODE=1` set during ShadowRelease
//      build. The flag is baked into the static export via Next.js, so
//      releases ship banner-on regardless of runtime state.
//   2. Runtime marker file — `~/.claude/PAI/USER/.template-mode`. Written by
//      `install.sh` on fresh install; deleted by `/interview` on completion.
// Either signal flips templateMode → banner renders. DA name pulled from
// USER/DA_IDENTITY.md so the copy reads in the user's voice.
function handleOnboardingState(): Response {
  const markerPath = join(PAI_DIR, "USER", ".template-mode")
  const daIdentityPath = join(PAI_DIR, "USER", "DA_IDENTITY.md")

  const buildTimeFlag = process.env.PAI_TEMPLATE_MODE === "1"
  const markerExists = existsSafe(markerPath)
  const templateMode = buildTimeFlag || markerExists

  let daName = "your DA"
  try {
    if (existsSafe(daIdentityPath)) {
      const content = readFileSync(daIdentityPath, "utf-8")
      const nameMatch = content.match(/\*\*Name:\*\*\s*([^\s|]+(?:\s+[^\s|*]+)*)/)
      if (nameMatch && nameMatch[1]) {
        const candidate = nameMatch[1].trim()
        if (candidate && !/^your[\s-]?da$/i.test(candidate)) daName = candidate
      }
    }
  } catch {
    // Fall through to default — banner still renders, just with generic copy
  }

  return Response.json({
    templateMode,
    daName,
    interviewCommand: "/interview",
  })
}

// ════════════════════════════════════════
// Request Router
// ════════════════════════════════════════

export async function handleObservabilityRequest(req: Request): Promise<Response | null> {
  if (!config.enabled) return null

  const url = new URL(req.url)
  const pathname = url.pathname
  const method = req.method

  // ── PUT routes ──

  if (method === "PUT") {
    if (pathname === "/api/telos/file") return handleTelosFilePut(req)
    const noteParams = parseKnowledgeNotePath(pathname)
    if (noteParams) return handlePutKnowledgeNote(req, noteParams.domain, noteParams.slug)
    return null
  }

  // ── POST routes ──

  if (method === "POST") {
    if (pathname === "/api/security/patterns") return handleSecurityPatternsMutation(req)
    if (pathname === "/api/security/rules") return handleSecurityRulesMutation(req)

    if (pathname === "/api/observability/state") {
      stateData = await req.text()
      stateUpdatedAt = new Date().toISOString()
      return Response.json({ ok: true })
    }
    if (pathname === "/api/observability/events") {
      eventsData = await req.text()
      eventsUpdatedAt = new Date().toISOString()
      return Response.json({ ok: true })
    }

    // Loop stubs
    if (pathname === "/api/loops/control" || pathname === "/api/loops/start") {
      return Response.json({ status: "not_available" })
    }

    return null
  }

  // ── GET routes ──

  if (method === "GET") {
    // Observability stored data
    if (pathname === "/api/observability/state") {
      return new Response(stateData, { headers: { "Content-Type": "application/json" } })
    }
    if (pathname === "/api/observability/events") {
      return new Response(eventsData, { headers: { "Content-Type": "application/json" } })
    }

    // Work sessions
    if (pathname === "/api/algorithm") return handleAlgorithmApi()

    // Novelty
    if (pathname === "/api/novelty") return handleNoveltyApi()

    // Subagent events
    if (pathname === "/api/agents") return handleAgentsApi()

    // Merged recent events
    if (pathname === "/api/events/recent") return handleEventsRecentApi()

    // Ladder pipeline
    if (pathname === "/api/ladder") return handleLadderApi()

    // Life Dashboard APIs
    if (pathname === "/api/life/home") return handleLifeHome()
    if (pathname === "/api/life/health") return handleLifeHealth()
    if (pathname === "/api/life/finances") return handleLifeFinances()
    if (pathname === "/api/life/business") return handleLifeBusiness()
    if (pathname === "/api/life/work") return handleLifeWork()
    if (pathname === "/api/life/goals") return handleLifeGoals()
    if (pathname === "/api/life/air") return handleLifeAir()
    if (pathname === "/api/telos/file") return handleTelosFileGet(url.searchParams)
    if (pathname === "/api/telos/overview") return handleTelosOverview()

    // Life OS user-index (from Pulse/modules/user-index.ts)
    if (pathname === "/api/user-index") return handleUserIndexApi(url.searchParams.get("filter"))
    if (pathname === "/api/observability/life-card") return handleLifeCardApi()

    // Individual observability sources
    if (pathname === "/api/observability/voice-events") return handleVoiceEventsApi()
    if (pathname === "/api/observability/tool-failures") return handleToolFailuresApi()

    // Onboarding state — drives TemplateOnboarding banner on fresh installs
    if (pathname === "/api/onboarding/state") return handleOnboardingState()

    // Knowledge
    if (pathname === "/api/knowledge") return handleKnowledgeApi()
    const knoteParams = parseKnowledgeNotePath(pathname)
    if (knoteParams) return handleGetKnowledgeNote(knoteParams.domain, knoteParams.slug)

    // Security
    if (pathname === "/api/security") return handleSecurityApi()
    if (pathname === "/api/security/hooks-detail") return handleSecurityHooksDetail()

    // Loop stubs
    if (pathname === "/api/loops") return Response.json([])
    if (pathname === "/api/loops/control") return Response.json({ status: "not_available" })
    if (pathname === "/api/loops/start") return Response.json({ status: "not_available" })

    // Static files — serve from Next.js out/ directory.
    // Root `/` is the Life dashboard; `/work`, `/telos`, `/health`, `/finances`,
    // `/business`, `/agents`, `/security`, etc. are Next.js pages. No `/dashboard`
    // URL prefix — it used to alias root, which created duplicate URLs.
    const fallback = await serveStaticFile(pathname)
    if (fallback) return fallback
  }

  return null
}
