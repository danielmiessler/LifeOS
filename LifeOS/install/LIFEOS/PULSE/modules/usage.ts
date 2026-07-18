/**
 * Usage Pulse module — read-only surface over Anthropic subscription + token/cost usage.
 *
 * Routes:
 *   GET /api/usage/summary            → { ts, subscription:{fiveHourPct,sevenDayPct}, monthUsedUsd,
 *                                          today, week, month, hasDaily }
 *   GET /api/usage/trend?range=daily|weekly|monthly → { range, points:[{label,totalTokens,costUsd,messages}] }
 *   GET /api/usage/models?window=30|all             → { window, models:[{model,messages,totalTokens,costUsd,pct}] }
 *
 * SOURCES (all read-only, produced elsewhere):
 *   - MEMORY/OBSERVABILITY/anthropic-cost.jsonl  — live subscription 5h/7d % + admin cost_report monthly $ (CostTracker cron)
 *   - MEMORY/OBSERVABILITY/usage-daily.jsonl     — DURABLE per-day token/cost/model rollup (UsageAggregator nightly launchd)
 *
 * No secret is read or emitted here — only the already-computed aggregates.
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { claudeDir } from "../../TOOLS/lifeos-root";

const MODULE_NAME = "usage";
const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || join(claudeDir());
const OBS_DIR = join(CLAUDE_DIR, "LIFEOS", "MEMORY", "OBSERVABILITY");
const ANTHROPIC_COST = join(OBS_DIR, "anthropic-cost.jsonl");
const USAGE_DAILY = join(OBS_DIR, "usage-daily.jsonl");
const state = { running: false };

interface ModelAgg { messages: number; totalTokens: number; costUsd: number }
interface DayAgg {
  date: string; messages: number; inputTokens: number; outputTokens: number;
  cacheReadTokens: number; cacheCreationTokens: number; totalTokens: number;
  costUsd: number; models: Record<string, ModelAgg>;
}

// ── Source readers ───────────────────────────────────────────────────────────

/** Last non-empty JSON line of a jsonl file, or null. */
function lastLine<T = any>(path: string): T | null {
  try {
    const lines = readFileSync(path, "utf8").trim().split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim()) return JSON.parse(lines[i]) as T;
    }
  } catch { /* ignore */ }
  return null;
}

function readDaily(): DayAgg[] {
  if (!existsSync(USAGE_DAILY)) return [];
  const out: DayAgg[] = [];
  for (const line of readFileSync(USAGE_DAILY, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { /* skip */ }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// ── Aggregation helpers ──────────────────────────────────────────────────────

interface Totals { totalTokens: number; costUsd: number; messages: number }
const ZERO: Totals = { totalTokens: 0, costUsd: 0, messages: 0 };
function sumDays(days: DayAgg[]): Totals {
  return days.reduce<Totals>((s, d) => ({
    totalTokens: s.totalTokens + (d.totalTokens || 0),
    costUsd: s.costUsd + (d.costUsd || 0),
    messages: s.messages + (d.messages || 0),
  }), { ...ZERO });
}
function round2(t: Totals): Totals { return { ...t, costUsd: Math.round(t.costUsd * 100) / 100 }; }

/** ISO date string N days before today (UTC). */
function daysAgo(n: number): string {
  const ms = Date.now() - n * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}
function isoWeek(date: string): string {
  const d = new Date(date + "T00:00:00Z");
  const day = (d.getUTCDay() + 6) % 7; // Mon=0
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - firstThu.getTime()) / 86_400_000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function buildSummary() {
  const cost = lastLine<any>(ANTHROPIC_COST);
  const days = readDaily();
  const today = daysAgo(0);
  const weekCut = daysAgo(7);
  const monthCut = daysAgo(30);
  return {
    ts: cost?.ts ?? null,
    subscription: {
      fiveHourPct: cost?.subscription?.five_hour_pct ?? null,
      sevenDayPct: cost?.subscription?.seven_day_pct ?? null,
    },
    monthUsedUsd: cost?.api_spend?.month_used_usd ?? null,
    monthUsedSource: cost?.api_spend?.source ?? null,
    today: round2(sumDays(days.filter((d) => d.date === today))),
    week: round2(sumDays(days.filter((d) => d.date >= weekCut))),
    month: round2(sumDays(days.filter((d) => d.date >= monthCut))),
    hasDaily: days.length > 0,
    daysTracked: days.length,
  };
}

function buildTrend(range: string) {
  const days = readDaily();
  if (range === "monthly") {
    const buckets = new Map<string, Totals>();
    for (const d of days) {
      const k = d.date.slice(0, 7); // YYYY-MM
      const b = buckets.get(k) ?? { ...ZERO };
      b.totalTokens += d.totalTokens || 0; b.costUsd += d.costUsd || 0; b.messages += d.messages || 0;
      buckets.set(k, b);
    }
    const points = [...buckets.entries()].sort().slice(-12).map(([label, t]) => ({ label, ...round2(t) }));
    return { range, points };
  }
  if (range === "weekly") {
    const buckets = new Map<string, Totals>();
    for (const d of days) {
      const k = isoWeek(d.date);
      const b = buckets.get(k) ?? { ...ZERO };
      b.totalTokens += d.totalTokens || 0; b.costUsd += d.costUsd || 0; b.messages += d.messages || 0;
      buckets.set(k, b);
    }
    const points = [...buckets.entries()].sort().slice(-12).map(([label, t]) => ({ label, ...round2(t) }));
    return { range, points };
  }
  // daily — last 30 days present in the store
  const points = days.slice(-30).map((d) => ({
    label: d.date,
    totalTokens: d.totalTokens || 0,
    costUsd: Math.round((d.costUsd || 0) * 100) / 100,
    messages: d.messages || 0,
  }));
  return { range: "daily", points };
}

function buildModels(windowArg: string) {
  const days = readDaily();
  const scoped = windowArg === "all" ? days : days.filter((d) => d.date >= daysAgo(30));
  const agg = new Map<string, ModelAgg>();
  for (const d of scoped) {
    for (const [model, m] of Object.entries(d.models || {})) {
      const cur = agg.get(model) ?? { messages: 0, totalTokens: 0, costUsd: 0 };
      cur.messages += m.messages || 0;
      cur.totalTokens += m.totalTokens || 0;
      cur.costUsd += m.costUsd || 0;
      agg.set(model, cur);
    }
  }
  const totalMsgs = [...agg.values()].reduce((s, m) => s + m.messages, 0) || 1;
  const models = [...agg.entries()]
    .map(([model, m]) => ({
      model,
      messages: m.messages,
      totalTokens: m.totalTokens,
      costUsd: Math.round(m.costUsd * 100) / 100,
      pct: Math.round((m.messages / totalMsgs) * 1000) / 10,
    }))
    .sort((a, b) => b.messages - a.messages);
  return { window: windowArg === "all" ? "all" : "30d", models };
}

// ── Module contract ──────────────────────────────────────────────────────────

export async function start(): Promise<void> {
  state.running = true;
  console.log(`[${MODULE_NAME}] started`);
}
export async function stop(): Promise<void> {
  state.running = false;
}
export function health(): { status: string; details?: Record<string, unknown> } {
  return { status: state.running ? "healthy" : "stopped", details: { hasDaily: existsSync(USAGE_DAILY) } };
}
export async function handleRequest(req: Request, pathname: string): Promise<Response | null> {
  const url = new URL(req.url);
  const sub = pathname.replace(/^\/api\/usage/, "") || "/";
  try {
    if (sub === "/" || sub === "/summary") return Response.json(buildSummary());
    if (sub === "/trend") return Response.json(buildTrend(url.searchParams.get("range") || "daily"));
    if (sub === "/models") return Response.json(buildModels(url.searchParams.get("window") || "30"));
    if (sub === "/status" || sub === "/health") return Response.json(health());
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
  return null;
}
