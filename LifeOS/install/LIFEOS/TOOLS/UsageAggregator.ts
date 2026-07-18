#!/usr/bin/env bun
/**
 * UsageAggregator.ts — roll Claude Code usage into a DURABLE per-day store.
 *
 *   bun ~/.claude/LIFEOS/TOOLS/UsageAggregator.ts            # aggregate → usage-daily.jsonl
 *   bun ~/.claude/LIFEOS/TOOLS/UsageAggregator.ts --dry-run  # print totals, write nothing
 *
 * WHY THIS EXISTS: raw session transcripts under ~/.claude/projects/ (per-session
 * .jsonl files) are pruned after ~5 days, so per-model token/cost history evaporates.
 * This tool reads
 * every source of truth and folds it into a permanent per-day rollup that the Pulse
 * Usage tab reads. Run nightly by launchd (com.lifeos.usage-aggregator).
 *
 * Idempotent BY RECOMPUTATION: it rebuilds the whole store from source each run, so
 * re-running never double-counts. Cross-source de-dup: any sessionId already counted
 * from session-costs.jsonl is skipped when scanning raw transcripts.
 *
 * SOURCES:
 *   1. MEMORY/OBSERVABILITY/session-costs.jsonl  — historical per-session rollup (has real cost); froze ~2026-04-16
 *   2. ~/.claude/projects/<proj>/*.jsonl (+ subagents/) — live raw transcripts (~5-day window); cost via price table
 *
 * OUTPUT: MEMORY/OBSERVABILITY/usage-daily.jsonl — one line per day, sorted:
 *   { date, messages, inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens,
 *     totalTokens, costUsd, models: { <model>: { messages, totalTokens, costUsd } } }
 */
import { existsSync, readFileSync, readdirSync, writeFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { claudeDir } from "./lifeos-root";

const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || join(claudeDir());
const OBS_DIR = join(CLAUDE_DIR, "LIFEOS", "MEMORY", "OBSERVABILITY");
const SESSION_COSTS = join(OBS_DIR, "session-costs.jsonl");
const PROJECTS_DIR = join(CLAUDE_DIR, "projects");
const OUT_PATH = join(OBS_DIR, "usage-daily.jsonl");

// Price per MILLION tokens (USD). Approximate list prices; used only for the live
// transcript window (historical days carry real cost from session-costs.jsonl).
// Matched by substring so version suffixes (…-4-8, …-4-5-20251001) still resolve.
const PRICES: Array<[RegExp, { in: number; out: number; cw: number; cr: number }]> = [
  [/fable/i, { in: 30, out: 150, cw: 37.5, cr: 3 }],
  [/opus/i, { in: 15, out: 75, cw: 18.75, cr: 1.5 }],
  [/sonnet/i, { in: 3, out: 15, cw: 3.75, cr: 0.3 }],
  [/haiku/i, { in: 0.8, out: 4, cw: 1, cr: 0.08 }],
];
function priceFor(model: string) {
  for (const [re, p] of PRICES) if (re.test(model)) return p;
  return PRICES[1][1]; // default to opus (conservative)
}

interface ModelAgg { messages: number; totalTokens: number; costUsd: number }
interface DayAgg {
  date: string;
  messages: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  totalTokens: number;
  costUsd: number;
  models: Record<string, ModelAgg>;
}

const byDay = new Map<string, DayAgg>();
const countedSessions = new Set<string>();

function dayOf(ts: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(ts || "");
  return m ? m[1] : null;
}
function ensureDay(date: string): DayAgg {
  let d = byDay.get(date);
  if (!d) {
    d = { date, messages: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, totalTokens: 0, costUsd: 0, models: {} };
    byDay.set(date, d);
  }
  return d;
}
function ensureModel(d: DayAgg, model: string): ModelAgg {
  let m = d.models[model];
  if (!m) { m = { messages: 0, totalTokens: 0, costUsd: 0 }; d.models[model] = m; }
  return m;
}

/** Fold the historical per-session rollup (real cost) into byDay. */
function ingestSessionCosts(): number {
  if (!existsSync(SESSION_COSTS)) return 0;
  let sessions = 0;
  for (const line of readFileSync(SESSION_COSTS, "utf8").split("\n")) {
    if (!line.trim()) continue;
    let r: any;
    try { r = JSON.parse(line); } catch { continue; }
    const date = dayOf(r.firstTimestamp);
    if (!date) continue;
    if (r.sessionId) countedSessions.add(r.sessionId);
    sessions++;
    const d = ensureDay(date);
    d.messages += r.messageCount || 0;
    d.inputTokens += r.inputTokens || 0;
    d.outputTokens += r.outputTokens || 0;
    d.cacheReadTokens += r.cacheReadTokens || 0;
    d.cacheCreationTokens += r.cacheWriteTokens || 0;
    d.totalTokens += r.totalTokens || 0;
    d.costUsd += r.costTotal || 0;
    const models: Record<string, number> = r.models || {};
    for (const [model, cnt] of Object.entries(models)) {
      const m = ensureModel(d, model);
      m.messages += cnt as number;
    }
    // Distribute session cost/tokens onto its primary model when we can't split per-model.
    if (r.primaryModel) {
      const m = ensureModel(d, r.primaryModel);
      m.totalTokens += r.totalTokens || 0;
      m.costUsd += r.costTotal || 0;
    }
  }
  return sessions;
}

/** All transcript files under projects/, including subagent transcripts. */
function transcriptFiles(): string[] {
  const files: string[] = [];
  let projDirs: string[] = [];
  try { projDirs = readdirSync(PROJECTS_DIR); } catch { return files; }
  for (const proj of projDirs) {
    const base = join(PROJECTS_DIR, proj);
    let st: ReturnType<typeof statSync>;
    try { st = statSync(base); } catch { continue; }
    if (!st.isDirectory()) continue;
    let entries: string[] = [];
    try { entries = readdirSync(base); } catch { continue; }
    for (const e of entries) {
      if (e.endsWith(".jsonl")) files.push(join(base, e));
    }
    // subagent transcripts one level down: <session>/subagents/agent-*.jsonl
    for (const e of entries) {
      const sub = join(base, e, "subagents");
      try {
        if (statSync(sub).isDirectory()) {
          for (const a of readdirSync(sub)) if (a.endsWith(".jsonl")) files.push(join(sub, a));
        }
      } catch { /* not a dir */ }
    }
  }
  return files;
}

/** Fold live raw transcripts into byDay (skipping sessions already counted). */
function ingestTranscripts(): { files: number; messages: number } {
  let msgs = 0;
  const files = transcriptFiles();
  for (const f of files) {
    let content: string;
    try { content = readFileSync(f, "utf8"); } catch { continue; }
    for (const line of content.split("\n")) {
      if (!line.includes('"usage"')) continue;
      let r: any;
      try { r = JSON.parse(line); } catch { continue; }
      if (r.type !== "assistant" || !r.message?.usage) continue;
      if (r.sessionId && countedSessions.has(r.sessionId)) continue; // de-dup vs session-costs
      const date = dayOf(r.timestamp);
      if (!date) continue;
      const model: string = r.message.model || "unknown";
      const u = r.message.usage;
      const inp = u.input_tokens || 0;
      const out = u.output_tokens || 0;
      const cr = u.cache_read_input_tokens || 0;
      const cw = u.cache_creation_input_tokens || 0;
      const total = inp + out + cr + cw;
      const p = priceFor(model);
      const cost = (inp * p.in + out * p.out + cw * p.cw + cr * p.cr) / 1_000_000;
      const d = ensureDay(date);
      d.messages += 1;
      d.inputTokens += inp;
      d.outputTokens += out;
      d.cacheReadTokens += cr;
      d.cacheCreationTokens += cw;
      d.totalTokens += total;
      d.costUsd += cost;
      const m = ensureModel(d, model);
      m.messages += 1;
      m.totalTokens += total;
      m.costUsd += cost;
      msgs++;
    }
  }
  return { files: files.length, messages: msgs };
}

function round(d: DayAgg): DayAgg {
  d.costUsd = Math.round(d.costUsd * 1e6) / 1e6;
  for (const m of Object.values(d.models)) m.costUsd = Math.round(m.costUsd * 1e6) / 1e6;
  return d;
}

function main() {
  const dryRun = process.argv.includes("--dry-run");
  const sc = ingestSessionCosts();
  const tr = ingestTranscripts();
  const days = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)).map(round);
  const totalCost = days.reduce((s, d) => s + d.costUsd, 0);
  const totalTokens = days.reduce((s, d) => s + d.totalTokens, 0);
  console.log(`[UsageAggregator] session-costs sessions=${sc}, transcript files=${tr.files}, live messages=${tr.messages}`);
  console.log(`[UsageAggregator] ${days.length} days, ${(totalTokens / 1e9).toFixed(2)}B tokens, $${totalCost.toFixed(2)} total`);
  if (dryRun) {
    console.log(`[UsageAggregator] --dry-run: not writing ${OUT_PATH}`);
    return;
  }
  writeFileSync(OUT_PATH, days.map((d) => JSON.stringify(d)).join("\n") + "\n");
  console.log(`[UsageAggregator] wrote ${days.length} day-rows → ${OUT_PATH}`);
}

main();
