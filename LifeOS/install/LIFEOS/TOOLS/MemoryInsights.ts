#!/usr/bin/env bun
/**
 * MemoryInsights — `kai insights` CLI for autonomic memory delta view.
 *
 * Visual-freshness ISA, F4 (ISC-30 through ISC-38).
 *
 * Reads MEMORY/OBSERVABILITY/*.jsonl filtered by ts >= now - days*86400000
 * and renders a compact delta: memory entries added, knowledge / idea notes
 * added, proposals by status, reviewer runs (success rate + p95 latency),
 * health snapshot, freshness verdict.
 *
 * Pure deterministic — no LLM call. Read-only across MEMORY/OBSERVABILITY/
 * and the two _MEMORY.md files (ISC-38 anti).
 *
 * Usage:
 *   bun LIFEOS/TOOLS/MemoryInsights.ts            # default --days 1
 *   bun LIFEOS/TOOLS/MemoryInsights.ts --days 7   # last week
 *
 * Exit 0 always (CLI semantics — "no activity" is not an error).
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve as pathResolve } from "node:path";
import { getClaudeDir } from "./Paths";

const ROOT = getClaudeDir();
const OBS = pathResolve(ROOT, "LIFEOS/MEMORY/OBSERVABILITY");
const PRINCIPAL_MEM = pathResolve(ROOT, "LIFEOS/USER/PRINCIPAL/PRINCIPAL_MEMORY.md");
const DA_MEM = pathResolve(ROOT, "LIFEOS/USER/DIGITAL_ASSISTANT/DA_MEMORY.md");

interface Args {
  days: number;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let days = 1;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--days" && i + 1 < argv.length) {
      const n = parseInt(argv[i + 1]!, 10);
      if (!Number.isNaN(n) && n > 0) days = n;
      i++;
    } else if (argv[i] === "--help" || argv[i] === "-h") {
      console.log("kai insights — memory delta over the last N day(s)");
      console.log("usage: bun LIFEOS/TOOLS/MemoryInsights.ts [--days N]");
      console.log("       --days N    window size in days (default: 1)");
      process.exit(0);
    }
  }
  return { days };
}

function readJsonlSince<T = any>(path: string, sinceMs: number): T[] {
  if (!existsSync(path)) return [];
  try {
    const raw = readFileSync(path, "utf8");
    const out: T[] = [];
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t) continue;
      try {
        const row = JSON.parse(t);
        const ts = Date.parse(row.ts || row.created_at || row.timestamp || "");
        if (!Number.isNaN(ts) && ts >= sinceMs) out.push(row);
      } catch {
        // skip malformed line
      }
    }
    return out;
  } catch {
    return [];
  }
}

function fmtClock(ms: number): string {
  return new Date(ms).toISOString().slice(0, 16).replace("T", " ");
}

function readMtimeMs(path: string): number {
  try {
    return existsSync(path) ? statSync(path).mtimeMs : 0;
  } catch {
    return 0;
  }
}

function deriveVerdict(opts: {
  reviewerRuns: number;
  okRuns: number;
  failedRuns: number;
  memoryGrowth: number;
  healthOverall: string | null;
  windowDays: number;
}): string {
  if (opts.healthOverall === "critical") return "unhealthy";
  if (opts.healthOverall === "warn") return "degraded";
  if (opts.reviewerRuns === 0 && opts.memoryGrowth === 0) {
    return opts.windowDays >= 1 ? "stale" : "cold";
  }
  if (opts.okRuns > 0 && opts.failedRuns === 0) return "fresh";
  if (opts.okRuns > opts.failedRuns) return "fresh-with-misses";
  return "degraded";
}

function main(): void {
  const { days } = parseArgs();
  const now = Date.now();
  const sinceMs = now - days * 86400 * 1000;

  const memoryWrites = readJsonlSince<any>(pathResolve(OBS, "memory-writes.jsonl"), sinceMs);
  const reviewerRuns = readJsonlSince<any>(pathResolve(OBS, "reviewer-runs.jsonl"), sinceMs);
  const proposals = readJsonlSince<any>(pathResolve(OBS, "pending-proposals.jsonl"), sinceMs);
  const healthRows = readJsonlSince<any>(pathResolve(OBS, "memory-health.jsonl"), sinceMs);
  const formatGate = readJsonlSince<any>(pathResolve(OBS, "format-gate.jsonl"), sinceMs);

  const principalGrowth = memoryWrites
    .filter((w) => (w.file || "").includes("PRINCIPAL"))
    .reduce((sum, w) => sum + ((w.new_count || 0) - (w.prior_count || 0)), 0);
  const daGrowth = memoryWrites
    .filter((w) => (w.file || "").includes("DA_MEMORY"))
    .reduce((sum, w) => sum + ((w.new_count || 0) - (w.prior_count || 0)), 0);
  const totalMemoryGrowth = principalGrowth + daGrowth;

  let knowledgeAdds = 0;
  let ideaAdds = 0;
  let proposalAdds = 0;
  for (const r of reviewerRuns) {
    const byType = r.dispatch_summary?.by_type || {};
    knowledgeAdds += (byType.knowledge || 0);
    ideaAdds += (byType.idea || 0);
    proposalAdds += (byType.proposal || 0);
  }

  const okRuns = reviewerRuns.filter((r) => r.ok === true).length;
  const failedRuns = reviewerRuns.length - okRuns;
  const durations = reviewerRuns
    .map((r) => r.inference_duration_ms)
    .filter((d): d is number => typeof d === "number" && d > 0)
    .sort((a, b) => a - b);
  const p50 = durations.length > 0 ? durations[Math.floor(durations.length * 0.5)] : 0;
  const p95 = durations.length > 0 ? durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.95))] : 0;

  const proposalsByStatus = new Map<string, number>();
  for (const p of proposals) {
    const status = p.status || "pending";
    proposalsByStatus.set(status, (proposalsByStatus.get(status) || 0) + 1);
  }

  const latestHealth = healthRows[healthRows.length - 1];
  const healthOverall: string | null = latestHealth?.overall || null;

  const heartbeatMisses = formatGate.filter((f) => f.heartbeat_present === false).length;

  const verdict = deriveVerdict({
    reviewerRuns: reviewerRuns.length,
    okRuns,
    failedRuns,
    memoryGrowth: totalMemoryGrowth,
    healthOverall,
    windowDays: days,
  });

  // Zero-activity short-circuit (ISC-36)
  const zeroActivity = reviewerRuns.length === 0 && memoryWrites.length === 0 && proposals.length === 0;
  if (zeroActivity) {
    console.log(`kai insights — last ${days} day(s)`);
    console.log("═".repeat(60));
    console.log(`window: ${fmtClock(sinceMs)} → ${fmtClock(now)}`);
    console.log(`(no activity in last ${days} day(s))`);
    console.log("");
    console.log(`Verdict: ${verdict}`);
    process.exit(0);
  }

  const out: string[] = [];
  out.push(`kai insights — last ${days} day(s)`);
  out.push("═".repeat(60));
  out.push(`window: ${fmtClock(sinceMs)} → ${fmtClock(now)}`);
  out.push("");

  out.push("Memory growth:");
  out.push(`  PRINCIPAL_MEMORY.md   +${principalGrowth} entries (mtime: ${fmtClock(readMtimeMs(PRINCIPAL_MEM))})`);
  out.push(`  DA_MEMORY.md          +${daGrowth} entries (mtime: ${fmtClock(readMtimeMs(DA_MEM))})`);
  out.push("");

  out.push("Knowledge / Ideas:");
  out.push(`  knowledge notes added  ${knowledgeAdds}`);
  out.push(`  idea notes added       ${ideaAdds}`);
  out.push("");

  out.push(`Proposals (${proposals.length} total in window):`);
  if (proposals.length === 0) {
    out.push("  (none)");
  } else {
    for (const [status, count] of proposalsByStatus) {
      out.push(`  ${status.padEnd(14)} ${count}`);
    }
    const samples = proposals.slice(-3);
    out.push("");
    out.push("  Recent samples:");
    for (const p of samples) {
      const edit = (p.edit || "").slice(0, 80);
      const ellipsis = (p.edit || "").length > 80 ? "…" : "";
      out.push(`    • ${p.target_file || "?"} — ${edit}${ellipsis}`);
    }
  }
  out.push("");

  out.push(`Reviewer runs (${reviewerRuns.length} total):`);
  out.push(`  succeeded   ${okRuns}`);
  out.push(`  failed      ${failedRuns}`);
  if (p50 > 0) out.push(`  p50 latency ${p50}ms`);
  if (p95 > 0) out.push(`  p95 latency ${p95}ms`);
  out.push("");

  out.push("Health:");
  if (latestHealth) {
    out.push(`  overall   ${healthOverall}`);
    const c = latestHealth.counts || {};
    out.push(`  counts    critical=${c.critical || 0} warn=${c.warn || 0} ok=${c.ok || 0}`);
    if (heartbeatMisses > 0) {
      out.push(`  ⚠ heartbeat compliance misses in window: ${heartbeatMisses}`);
    }
  } else {
    out.push("  (no health snapshot in window)");
  }
  out.push("");

  out.push(`Verdict: ${verdict}`);

  console.log(out.join("\n"));
}

main();
