#!/usr/bin/env bun

/**
 * ComputeGap — computed view of Current→Ideal delta per dimension.
 *
 * Per plan §15.2: GAP is a computed view, not a stored directory. This tool reads
 * IDEAL_STATE/<dimension>.md and CURRENT_STATE/<matching>.md + USER/HEALTH/FINANCES/
 * and emits a structured gap report on stdout. Appends a JSONL log entry to
 * MEMORY/OBSERVABILITY/gap-history.jsonl for weekly trend tracking.
 *
 * Dimensions: health, money, freedom are metric (computable gaps).
 * Relationships, creative, rhythms are narrative (surfaced as reminders, not gaps).
 *
 * Uses Haiku via LIFEOS/TOOLS/Inference.ts for the metric-extraction step. ~$0.01/run.
 *
 * Usage:
 *   bun ComputeGap.ts                       All metric dimensions
 *   bun ComputeGap.ts --dimension health    Single dimension
 *   bun ComputeGap.ts --json                JSON output
 *   bun ComputeGap.ts --log                 Append to gap-history.jsonl
 */

import { readFileSync, existsSync, appendFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";

// Normalize env path vars that Claude Code injects without shell expansion (LifeOS#1404)
for (const k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const v = process.env[k];
  if (v && /^\$\{?HOME\}?(\/|$)/.test(v)) process.env[k] = v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}


const HOME = process.env.HOME || "";
const LIFEOS_DIR = process.env.LIFEOS_DIR || join(HOME, ".claude", "LIFEOS");
const IDEAL_DIR = join(LIFEOS_DIR, "USER", "TELOS", "IDEAL_STATE");
const CURRENT_DIR = join(LIFEOS_DIR, "USER", "TELOS", "CURRENT_STATE");
const HEALTH_DIR = join(LIFEOS_DIR, "USER", "HEALTH");
const FINANCES_DIR = join(LIFEOS_DIR, "USER", "FINANCES");
const HISTORY_FILE = join(LIFEOS_DIR, "MEMORY", "OBSERVABILITY", "gap-history.jsonl");

const METRIC_DIMENSIONS = ["health", "money", "freedom"] as const;
type MetricDimension = (typeof METRIC_DIMENSIONS)[number];

type GapEntry = {
  metric: string;
  current: string | number | null;
  target: string | number | null;
  direction: "above" | "below" | "at" | "unknown";
  severity: "critical" | "warning" | "info" | "none";
  note?: string;
};

type DimensionGap = {
  dimension: string;
  entries: GapEntry[];
  summary: string;
  timestamp: string;
};

function readIf(path: string): string | null {
  return existsSync(path) ? readFileSync(path, "utf-8") : null;
}

async function computeHealth(): Promise<DimensionGap> {
  const ideal = readIf(join(IDEAL_DIR, "HEALTH.md")) || "";
  const currentMetrics = readIf(join(HEALTH_DIR, "METRICS.md")) || "";
  const currentActivity = readIf(join(CURRENT_DIR, "ACTIVITY.md")) || "";

  // v1: simple markdown parsing. Future: pass through Haiku for semantic extraction.
  // For now, surface what's TBD vs. populated so the first real run produces signal.
  const tbdCount = (ideal.match(/\bTBD\b/g) || []).length;
  const entries: GapEntry[] = [];

  if (tbdCount > 0) {
    entries.push({
      metric: "IDEAL_STATE/HEALTH.md population",
      current: `${tbdCount} TBD markers`,
      target: "0 TBD",
      direction: "below",
      severity: "warning",
      note: "Complete health dimension interview to enable gap computation",
    });
  }

  if (!currentMetrics.trim()) {
    entries.push({
      metric: "USER/HEALTH/METRICS.md",
      current: "empty or missing",
      target: "populated with current values",
      direction: "below",
      severity: "info",
      note: "Apple Health daily export (P4) will populate this",
    });
  }

  return {
    dimension: "health",
    entries,
    summary: entries.length === 0 ? "No gaps detected." : `${entries.length} gap(s).`,
    timestamp: new Date().toISOString(),
  };
}

async function computeMoney(): Promise<DimensionGap> {
  const ideal = readIf(join(IDEAL_DIR, "MONEY.md")) || "";
  const financial = readIf(join(CURRENT_DIR, "FINANCIAL.md")) || "";
  const entries: GapEntry[] = [];
  const tbdCount = (ideal.match(/\bTBD\b/g) || []).length;

  if (tbdCount > 0) {
    entries.push({
      metric: "IDEAL_STATE/MONEY.md population",
      current: `${tbdCount} TBD markers`,
      target: "0 TBD",
      direction: "below",
      severity: "warning",
      note: "Complete money dimension interview",
    });
  }

  return {
    dimension: "money",
    entries,
    summary: entries.length === 0 ? "No gaps detected." : `${entries.length} gap(s).`,
    timestamp: new Date().toISOString(),
  };
}

async function computeFreedom(): Promise<DimensionGap> {
  const ideal = readIf(join(IDEAL_DIR, "FREEDOM.md")) || "";
  const entries: GapEntry[] = [];
  const tbdCount = (ideal.match(/\bTBD\b/g) || []).length;

  if (tbdCount > 0) {
    entries.push({
      metric: "IDEAL_STATE/FREEDOM.md population",
      current: `${tbdCount} TBD markers`,
      target: "0 TBD",
      direction: "below",
      severity: "warning",
      note: "Complete freedom dimension interview",
    });
  }

  return {
    dimension: "freedom",
    entries,
    summary: entries.length === 0 ? "No gaps detected." : `${entries.length} gap(s).`,
    timestamp: new Date().toISOString(),
  };
}

async function computeDimension(dim: MetricDimension): Promise<DimensionGap> {
  switch (dim) {
    case "health":
      return computeHealth();
    case "money":
      return computeMoney();
    case "freedom":
      return computeFreedom();
  }
}

function logEntry(gap: DimensionGap): void {
  const dir = dirname(HISTORY_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  appendFileSync(HISTORY_FILE, JSON.stringify(gap) + "\n");
}

function formatHuman(gaps: DimensionGap[]): string {
  const lines: string[] = ["═══ Current → Ideal Gap ═══", ""];
  for (const g of gaps) {
    lines.push(`## ${g.dimension.toUpperCase()}`);
    if (g.entries.length === 0) {
      lines.push("  ✅ No gaps.");
    } else {
      for (const e of g.entries) {
        const icon = e.severity === "critical" ? "🔴" : e.severity === "warning" ? "🟡" : "🔵";
        lines.push(`  ${icon} ${e.metric}: ${e.current}  →  ${e.target}`);
        if (e.note) lines.push(`      ${e.note}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

// ─── Main ───

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dimIdx = args.indexOf("--dimension");
  const dims: MetricDimension[] =
    dimIdx === -1
      ? [...METRIC_DIMENSIONS]
      : ([args[dimIdx + 1]].filter((d): d is MetricDimension =>
          METRIC_DIMENSIONS.includes(d as MetricDimension)
        ) as MetricDimension[]);

  if (dims.length === 0) {
    console.error(`Invalid dimension. Choose from: ${METRIC_DIMENSIONS.join(", ")}`);
    process.exit(1);
  }

  const gaps = await Promise.all(dims.map(computeDimension));

  if (args.includes("--log")) {
    gaps.forEach(logEntry);
  }

  if (args.includes("--json")) {
    console.log(JSON.stringify(gaps, null, 2));
  } else {
    console.log(formatHuman(gaps));
  }
}

main().catch((err) => {
  console.error("ComputeGap failed:", err);
  process.exit(1);
});
