/**
 * LifeOS Pulse — Performance Module
 *
 * Provides session cost tracking and tool failure rate analysis.
 * Does NOT create its own HTTP server — pulse.ts calls handlePerformanceRequest().
 *
 * Route prefixes handled:
 *   GET /api/performance/cost      — Session cost data with aggregates
 *   GET /api/performance/failures  — Per-tool failure rates and trends
 *   GET /api/performance/summary   — Combined overview (top-level stats)
 */

import { join } from "path"
import { existsSync, readFileSync } from "fs"
import { claudeDir } from "../../TOOLS/lifeos-root";

const HOME = process.env.HOME ?? ""
const LIFEOS_DIR = join(claudeDir(), "LIFEOS")
const MEMORY_DIR = join(LIFEOS_DIR, "MEMORY")
const SESSION_COSTS_PATH = join(MEMORY_DIR, "OBSERVABILITY", "session-costs.jsonl")
const TOOL_FAILURES_PATH = join(MEMORY_DIR, "OBSERVABILITY", "tool-failures.jsonl")
const TOOL_ACTIVITY_PATH = join(MEMORY_DIR, "OBSERVABILITY", "tool-activity.jsonl")

export interface PerformanceConfig {
  enabled: boolean
}

let config: PerformanceConfig = { enabled: false }
let moduleStartedAt: string | null = null

export function startPerformance(cfg: PerformanceConfig): void {
  config = cfg
  moduleStartedAt = new Date().toISOString()
}

export function performanceHealth(): Record<string, unknown> {
  return {
    module: "performance",
    enabled: config.enabled,
    startedAt: moduleStartedAt,
    hasCostData: existsSync(SESSION_COSTS_PATH),
    hasFailureData: existsSync(TOOL_FAILURES_PATH),
  }
}

// ── JSONL Reader ──

function readJsonl<T = any>(filePath: string): T[] {
  try {
    if (!existsSync(filePath)) return []
    const raw = readFileSync(filePath, "utf-8")
    return raw
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try { return JSON.parse(line) } catch { return null }
      })
      .filter(Boolean) as T[]
  } catch {
    return []
  }
}

// ── Cost API ──

function handleCostApi(url: URL): Response {
  const sessions = readJsonl(SESSION_COSTS_PATH)
  const daysParam = url.searchParams.get("days")
  const days = daysParam ? parseInt(daysParam, 10) : 30

  // Filter by date range
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const filtered = sessions.filter((s: any) => {
    const ts = s.lastTimestamp || s.firstTimestamp || ""
    return ts >= cutoff
  })

  // Aggregate by model
  const modelCosts: Record<string, { cost: number; sessions: number; tokens: number }> = {}
  let totalCost = 0
  let totalTokens = 0

  for (const s of filtered) {
    const model = s.primaryModel || "<unknown>"
    if (!modelCosts[model]) modelCosts[model] = { cost: 0, sessions: 0, tokens: 0 }
    modelCosts[model].cost += s.costTotal ?? 0
    modelCosts[model].sessions++
    modelCosts[model].tokens += s.totalTokens ?? 0
    totalCost += s.costTotal ?? 0
    totalTokens += s.totalTokens ?? 0
  }

  // Aggregate by day
  const dailyCosts: Record<string, number> = {}
  for (const s of filtered) {
    const day = (s.lastTimestamp || s.firstTimestamp || "").slice(0, 10)
    if (day) dailyCosts[day] = (dailyCosts[day] ?? 0) + (s.costTotal ?? 0)
  }

  // Cost breakdown
  let totalInput = 0, totalOutput = 0, totalCacheWrite = 0, totalCacheRead = 0
  for (const s of filtered) {
    totalInput += s.costInput ?? 0
    totalOutput += s.costOutput ?? 0
    totalCacheWrite += s.costCacheWrite ?? 0
    totalCacheRead += s.costCacheRead ?? 0
  }

  // Sort sessions by cost (descending), return top 50
  const topSessions = [...filtered]
    .sort((a: any, b: any) => (b.costTotal ?? 0) - (a.costTotal ?? 0))
    .slice(0, 50)
    .map((s: any) => ({
      sessionId: s.sessionId,
      project: s.project,
      primaryModel: s.primaryModel,
      messageCount: s.messageCount,
      costTotal: s.costTotal,
      totalTokens: s.totalTokens,
      firstTimestamp: s.firstTimestamp,
      lastTimestamp: s.lastTimestamp,
    }))

  return Response.json({
    days,
    totalSessions: filtered.length,
    totalCost: Math.round(totalCost * 100) / 100,
    totalTokens,
    avgCostPerSession: filtered.length > 0 ? Math.round((totalCost / filtered.length) * 100) / 100 : 0,
    costBreakdown: {
      input: Math.round(totalInput * 100) / 100,
      output: Math.round(totalOutput * 100) / 100,
      cacheWrite: Math.round(totalCacheWrite * 100) / 100,
      cacheRead: Math.round(totalCacheRead * 100) / 100,
    },
    byModel: Object.entries(modelCosts)
      .sort(([, a], [, b]) => b.cost - a.cost)
      .map(([model, data]) => ({
        model,
        cost: Math.round(data.cost * 100) / 100,
        sessions: data.sessions,
        tokens: data.tokens,
      })),
    dailyCosts: Object.entries(dailyCosts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, cost]) => ({ day, cost: Math.round(cost * 100) / 100 })),
    topSessions,
  })
}

// ── Failures API ──

function handleFailuresApi(): Response {
  const failures = readJsonl(TOOL_FAILURES_PATH)
  const activity = readJsonl(TOOL_ACTIVITY_PATH)

  // Per-tool failure counts
  const failureCounts: Record<string, number> = {}
  for (const f of failures) {
    const tool = f.tool_name || "unknown"
    failureCounts[tool] = (failureCounts[tool] ?? 0) + 1
  }

  // Per-tool total counts (from activity)
  const activityCounts: Record<string, number> = {}
  for (const a of activity) {
    const tool = a.tool_name || "unknown"
    activityCounts[tool] = (activityCounts[tool] ?? 0) + 1
  }

  // Combine: failure rate per tool
  const allTools = new Set([...Object.keys(failureCounts), ...Object.keys(activityCounts)])
  const toolStats = [...allTools].map((tool) => {
    const fails = failureCounts[tool] ?? 0
    const calls = activityCounts[tool] ?? 0
    const total = calls + fails // activity tracker may not count failures
    return {
      tool,
      failures: fails,
      calls: total,
      failureRate: total > 0 ? Math.round((fails / total) * 10000) / 100 : 0,
    }
  }).sort((a, b) => b.failures - a.failures)

  const totalFailures = failures.length
  const totalCalls = activity.length + failures.length
  const overallRate = totalCalls > 0 ? Math.round((totalFailures / totalCalls) * 10000) / 100 : 0

  // Daily failure trend (last 7 days)
  const dailyFailures: Record<string, number> = {}
  const dailyTotal: Record<string, number> = {}
  for (const f of failures) {
    const day = (f.timestamp || "").slice(0, 10)
    if (day) dailyFailures[day] = (dailyFailures[day] ?? 0) + 1
  }
  for (const a of activity) {
    const day = (a.timestamp || "").slice(0, 10)
    if (day) dailyTotal[day] = (dailyTotal[day] ?? 0) + 1
  }

  const trend = Object.keys({ ...dailyFailures, ...dailyTotal })
    .sort()
    .slice(-7)
    .map((day) => ({
      day,
      failures: dailyFailures[day] ?? 0,
      total: (dailyTotal[day] ?? 0) + (dailyFailures[day] ?? 0),
      rate: ((dailyTotal[day] ?? 0) + (dailyFailures[day] ?? 0)) > 0
        ? Math.round(((dailyFailures[day] ?? 0) / ((dailyTotal[day] ?? 0) + (dailyFailures[day] ?? 0))) * 10000) / 100
        : 0,
    }))

  return Response.json({
    totalFailures,
    totalCalls,
    overallRate,
    byTool: toolStats.slice(0, 20),
    trend,
  })
}

// ── Summary API ──

function handleSummaryApi(): Response {
  const sessions = readJsonl(SESSION_COSTS_PATH)
  const failures = readJsonl(TOOL_FAILURES_PATH)
  const activity = readJsonl(TOOL_ACTIVITY_PATH)

  // Last 7 days
  const cutoff7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const recent = sessions.filter((s: any) => (s.lastTimestamp || "") >= cutoff7d)
  const recentCost = recent.reduce((acc: number, s: any) => acc + (s.costTotal ?? 0), 0)

  const totalCost = sessions.reduce((acc: number, s: any) => acc + (s.costTotal ?? 0), 0)
  const totalFailures = failures.length
  const totalCalls = activity.length + failures.length

  return Response.json({
    totalSessions: sessions.length,
    totalCost: Math.round(totalCost * 100) / 100,
    last7DaysCost: Math.round(recentCost * 100) / 100,
    last7DaysSessions: recent.length,
    overallFailureRate: totalCalls > 0 ? Math.round((totalFailures / totalCalls) * 10000) / 100 : 0,
    topFailingTool: (() => {
      const counts: Record<string, number> = {}
      for (const f of failures) counts[f.tool_name || "unknown"] = (counts[f.tool_name || "unknown"] ?? 0) + 1
      const top = Object.entries(counts).sort(([, a], [, b]) => b - a)[0]
      return top ? { tool: top[0], failures: top[1] } : null
    })(),
  })
}

// ── Request Router ──

export async function handlePerformanceRequest(req: Request): Promise<Response | null> {
  if (!config.enabled) return null

  const url = new URL(req.url)
  const pathname = url.pathname

  if (req.method !== "GET") return null

  if (pathname === "/api/performance/cost") return handleCostApi(url)
  if (pathname === "/api/performance/failures") return handleFailuresApi()
  if (pathname === "/api/performance/summary") return handleSummaryApi()
  if (pathname === "/api/performance/anthropic-cost") return handleAnthropicCostApi()

  return null
}

// ── Anthropic cost (subscription vs API billing) ──
//
// Reads the ledger + baseline written by LIFEOS/TOOLS/CostTracker.ts and returns
// the data the /performance "Anthropic" tab needs: latest snapshot, last-24h
// trend, and the call-site inventory with classifications.

async function handleAnthropicCostApi(): Promise<Response> {
  const { readFileSync, existsSync } = await import("fs")
  const { join } = await import("path")
  const home = process.env.HOME ?? ""
  const obsDir = join(claudeDir(), "LIFEOS", "MEMORY", "OBSERVABILITY")
  const ledgerPath = join(obsDir, "anthropic-cost.jsonl")
  const sitesPath = join(obsDir, "anthropic-call-sites.json")

  type Snapshot = {
    ts: string
    subscription: { five_hour_pct: number | null; seven_day_pct: number | null }
    api_spend: { month_used_usd: number | null; source: string }
    call_sites: { total: number; bypass: number; legit: number; new_since_baseline: string[] }
    alerts: string[]
  }

  let history: Snapshot[] = []
  if (existsSync(ledgerPath)) {
    try {
      const raw = readFileSync(ledgerPath, "utf-8")
      history = raw
        .split("\n")
        .filter((l) => l.trim())
        .map((l) => {
          try { return JSON.parse(l) as Snapshot } catch { return null }
        })
        .filter((x): x is Snapshot => x !== null)
    } catch {
      history = []
    }
  }

  const current = history.length > 0 ? history[history.length - 1] : null
  const last24h = history.slice(-24)

  let sites: Array<{ file: string; line: number; classification: string; reason: string }> = []
  let baselineUpdated: string | null = null
  if (existsSync(sitesPath)) {
    try {
      const raw = readFileSync(sitesPath, "utf-8")
      const parsed = JSON.parse(raw) as { updated?: string; sites?: typeof sites }
      sites = parsed.sites ?? []
      baselineUpdated = parsed.updated ?? null
    } catch {
      sites = []
    }
  }

  return Response.json({
    current,
    history: last24h,
    total_entries: history.length,
    sites,
    baseline_updated: baselineUpdated,
  })
}
