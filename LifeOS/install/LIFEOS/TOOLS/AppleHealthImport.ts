#!/usr/bin/env bun
/**
 * Apple Health import — turns the Health app's "Export All Health Data" backup
 * into a markdown summary the Pulse HEALTH tab reads.
 *
 * WHY A SUMMARY AND NOT A TIMESERIES. The health surface is markdown-backed:
 * `/api/life/health` reads `.md` files out of USER/TELOS/HEALTH and the page
 * renders each file's `##` headings. There is no store for per-day samples and
 * no chart to put them in, so this writes one generated file whose headings
 * carry the headline numbers and whose bodies carry the tables. Feeding the
 * healthsync DayFile shape (USER/HEALTH/DATA) is the richer follow-up; nothing
 * in Pulse reads that directory today.
 *
 * SCALE. export.xml is routinely multi-gigabyte, so the file is never read
 * whole: it is streamed in chunks and matched per `<Record .../>` element. Peak
 * memory is one chunk plus the daily aggregates, not the export.
 *
 * WRITES ONE FILE, OWNS IT COMPLETELY. Output is APPLE_HEALTH.md, regenerated
 * end to end on every run. Hand-authored files (METRICS.md, FITNESS.md, lab
 * results) are never read or touched — this cannot clobber your own notes.
 *
 * Usage:
 *   bun AppleHealthImport.ts <export.zip|export.xml> [--days N] [--out PATH] [--dry-run]
 *
 *   --days N     Window to summarise, in days back from the newest sample (default 90)
 *   --out PATH   Write somewhere other than USER/TELOS/HEALTH/APPLE_HEALTH.md
 *   --dry-run    Print the markdown instead of writing it
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createReadStream } from "node:fs";
import { dirname, join } from "node:path";

const HOME = process.env.HOME ?? "~";
const DEFAULT_OUT = join(HOME, ".claude", "LIFEOS", "USER", "TELOS", "HEALTH", "APPLE_HEALTH.md");
const DEFAULT_DAYS = 90;

// ── What we pull out of the export ──
//
// Apple ships hundreds of HKQuantityTypeIdentifier types. These are the ones
// with a daily reading that means something on a dashboard. `agg` decides how a
// day's many samples collapse into one number: steps sum, heart rate averages,
// weight takes the last reading of the day.
type Agg = "sum" | "avg" | "last" | "max";

interface MetricSpec {
  /** HKQuantityTypeIdentifier suffix, i.e. the type minus the prefix. */
  key: string;
  label: string;
  agg: Agg;
  unit: string;
  /** Round to this many decimals when reporting. */
  dp: number;
}

const METRICS: MetricSpec[] = [
  { key: "StepCount", label: "Steps", agg: "sum", unit: "steps", dp: 0 },
  { key: "DistanceWalkingRunning", label: "Walk + run distance", agg: "sum", unit: "km", dp: 2 },
  { key: "ActiveEnergyBurned", label: "Active energy", agg: "sum", unit: "kcal", dp: 0 },
  { key: "BasalEnergyBurned", label: "Resting energy", agg: "sum", unit: "kcal", dp: 0 },
  { key: "AppleExerciseTime", label: "Exercise time", agg: "sum", unit: "min", dp: 0 },
  { key: "FlightsClimbed", label: "Flights climbed", agg: "sum", unit: "flights", dp: 0 },
  { key: "RestingHeartRate", label: "Resting heart rate", agg: "avg", unit: "bpm", dp: 0 },
  { key: "HeartRateVariabilitySDNN", label: "HRV (SDNN)", agg: "avg", unit: "ms", dp: 0 },
  { key: "WalkingHeartRateAverage", label: "Walking heart rate", agg: "avg", unit: "bpm", dp: 0 },
  { key: "VO2Max", label: "VO2 max", agg: "last", unit: "mL/kg/min", dp: 1 },
  { key: "BodyMass", label: "Weight", agg: "last", unit: "kg", dp: 1 },
  { key: "BodyFatPercentage", label: "Body fat", agg: "last", unit: "%", dp: 1 },
  { key: "LeanBodyMass", label: "Lean body mass", agg: "last", unit: "kg", dp: 1 },
  { key: "RespiratoryRate", label: "Respiratory rate", agg: "avg", unit: "breaths/min", dp: 1 },
  { key: "OxygenSaturation", label: "Blood oxygen", agg: "avg", unit: "%", dp: 1 },
  { key: "BloodPressureSystolic", label: "Blood pressure (systolic)", agg: "avg", unit: "mmHg", dp: 0 },
  { key: "BloodPressureDiastolic", label: "Blood pressure (diastolic)", agg: "avg", unit: "mmHg", dp: 0 },
  { key: "AppleStandTime", label: "Stand time", agg: "sum", unit: "min", dp: 0 },
];

const SPEC_BY_KEY = new Map(METRICS.map((m) => [m.key, m]));

/**
 * Reconcile the export's own `unit` attribute with the unit we report in.
 *
 * The export is written in the phone's locale: a US export emits `mi` and `lb`
 * where this one emits `km` and `kg`. Trusting the label in METRICS and ignoring
 * the record would silently print miles under a "km" heading. Some units are
 * only spelled differently for the same quantity (`count/min` is bpm); those
 * alias, they do not convert.
 */
const UNIT_ALIASES: Record<string, string> = {
  "count/min": "bpm", "Cal": "kcal", "min": "min", "ms": "ms", "%": "%",
};

/**
 * Units that are a bare tally of things. Health writes `unit="count"` for all
 * of them, so what a count *is* depends on the metric: steps for StepCount,
 * flights for FlightsClimbed. Aliasing `count` globally to any one of them
 * makes the others look like a unit mismatch and drops them.
 */
const TALLY_UNITS = new Set(["steps", "flights"]);

const CONVERSIONS: Record<string, Record<string, number>> = {
  mi: { km: 1.609344 },
  ft: { m: 0.3048 },
  lb: { kg: 0.45359237 },
  kJ: { kcal: 0.239005736 },
};

/** Unit strings seen that we could neither alias nor convert, for reporting. */
export const unitWarnings = new Map<string, string>();

/**
 * Convert a raw sample into the spec's unit.
 * Returns null when the unit is unrecognised, so the sample is dropped rather
 * than counted under the wrong label.
 */
function scale(spec: MetricSpec, value: number, rawUnit: string): number | null {
  // Percent metrics arrive as 0..1 fractions.
  if (spec.unit === "%") return value * 100;
  if (!rawUnit) return value;
  if ((rawUnit === "count" || rawUnit === "count/day") && TALLY_UNITS.has(spec.unit)) return value;
  const unit = UNIT_ALIASES[rawUnit] ?? rawUnit;
  if (unit === spec.unit) return value;
  const factor = CONVERSIONS[rawUnit]?.[spec.unit];
  if (factor !== undefined) return value * factor;
  unitWarnings.set(spec.key, rawUnit);
  return null;
}

// ── Aggregation ──

interface DayBucket {
  sum: number;
  count: number;
  max: number;
  last: number;
  lastAt: string;
}

/**
 * metric key → date (YYYY-MM-DD) → sourceName → bucket
 *
 * Bucketing by SOURCE is not an optimisation, it is a correctness requirement.
 * Health stores every device's view of the same day side by side: this export
 * carries StepCount from six sources (two phones, a ring, and three app-level
 * writers) and BasalEnergyBurned from four. Summing the lot double- or
 * triple-counts. Apple's own Health app resolves this with a per-source
 * priority list; `collapse()` below picks a winner per day instead, which needs
 * no configuration.
 */
type Daily = Map<string, Map<string, Map<string, DayBucket>>>;

function addSample(
  daily: Daily, key: string, date: string, source: string, value: number, startedAt: string,
): void {
  let byDate = daily.get(key);
  if (!byDate) {
    byDate = new Map();
    daily.set(key, byDate);
  }
  let bySource = byDate.get(date);
  if (!bySource) {
    bySource = new Map();
    byDate.set(date, bySource);
  }
  const bucket = bySource.get(source);
  if (!bucket) {
    bySource.set(source, { sum: value, count: 1, max: value, last: value, lastAt: startedAt });
    return;
  }
  bucket.sum += value;
  bucket.count += 1;
  if (value > bucket.max) bucket.max = value;
  // "last" means latest by sample start time, not by file order — exports are
  // not reliably sorted and a re-imported device can interleave.
  if (startedAt >= bucket.lastAt) {
    bucket.last = value;
    bucket.lastAt = startedAt;
  }
}

/**
 * Collapse one day's per-source buckets into a single number, plus the source
 * that produced it.
 *
 *   sum  — the source with the largest total. A day's steps are whichever
 *          device was actually on you, never phone + ring + watch added up.
 *   avg  — the source with the most samples that day; averaging across devices
 *          would weight a ring that samples hourly against a phone that wrote
 *          twice.
 *   last — the globally latest sample, whichever device wrote it.
 *   max  — the largest single reading seen anywhere.
 */
function collapse(bySource: Map<string, DayBucket>, agg: Agg): { value: number; source: string } {
  let best: { value: number; source: string; rank: number } | null = null;
  for (const [source, b] of bySource) {
    const value = agg === "sum" ? b.sum
      : agg === "avg" ? b.sum / b.count
      : agg === "max" ? b.max
      : b.last;
    const rank = agg === "sum" ? b.sum
      : agg === "avg" ? b.count
      : agg === "max" ? b.max
      : Number(new Date(b.lastAt.slice(0, 19).replace(" ", "T")).getTime()) || 0;
    if (!best || rank > best.rank) best = { value, source, rank };
  }
  return best ? { value: best.value, source: best.source } : { value: 0, source: "" };
}

// ── Streaming parse ──
//
// Records look like:
//   <Record type="HKQuantityTypeIdentifierStepCount" ... startDate="2026-01-02 08:14:00 +0100"
//           endDate="..." value="431"/>
// Attribute order is stable in practice but not guaranteed, so each is matched
// by name rather than by position.
const RECORD_RE = /<Record\s([^>]*?)\/?>/g;
const ATTR_RE = /(\w+)="([^"]*)"/g;
const TYPE_PREFIX = "HKQuantityTypeIdentifier";

export interface ParseStats {
  recordsSeen: number;
  recordsKept: number;
  firstDate: string | null;
  lastDate: string | null;
}

/** Pull the attributes of one `<Record>` into a plain object. */
function attrsOf(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  ATTR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ATTR_RE.exec(raw)) !== null) out[m[1]] = m[2];
  return out;
}

/**
 * Fold one chunk of export.xml into the daily aggregates.
 * Returns the trailing fragment that may hold a half-written record, which the
 * caller prepends to the next chunk. Without this, every chunk boundary that
 * lands mid-record silently drops a sample.
 */
export function consumeChunk(chunk: string, daily: Daily, stats: ParseStats): string {
  RECORD_RE.lastIndex = 0;
  let lastEnd = 0;
  let m: RegExpExecArray | null;
  while ((m = RECORD_RE.exec(chunk)) !== null) {
    lastEnd = m.index + m[0].length;
    stats.recordsSeen += 1;
    const a = attrsOf(m[1]);
    const type = a.type;
    if (!type || !type.startsWith(TYPE_PREFIX)) continue;
    const spec = SPEC_BY_KEY.get(type.slice(TYPE_PREFIX.length));
    if (!spec) continue;
    const value = Number(a.value);
    if (!Number.isFinite(value)) continue;
    const startDate = a.startDate ?? "";
    const date = startDate.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const scaled = scale(spec, value, a.unit ?? "");
    if (scaled === null) continue;
    addSample(daily, spec.key, date, a.sourceName || "unknown", scaled, startDate);
    stats.recordsKept += 1;
    if (!stats.firstDate || date < stats.firstDate) stats.firstDate = date;
    if (!stats.lastDate || date > stats.lastDate) stats.lastDate = date;
  }
  // Keep back anything after the last complete record. Cap the carry so a file
  // with no records at all cannot grow it without bound.
  const tail = chunk.slice(lastEnd);
  return tail.length > 1_000_000 ? tail.slice(-1_000_000) : tail;
}

/** Stream export.xml (or a zip containing it) through consumeChunk. */
async function parseExport(path: string): Promise<{ daily: Daily; stats: ParseStats }> {
  const daily: Daily = new Map();
  const stats: ParseStats = { recordsSeen: 0, recordsKept: 0, firstDate: null, lastDate: null };
  let carry = "";

  const onChunk = (buf: Buffer | string) => {
    carry = consumeChunk(carry + buf.toString(), daily, stats);
  };

  if (path.endsWith(".zip")) {
    // `unzip -p` streams the member to stdout, so a 4GB export never lands on
    // disk twice. The member path is what the Health app has always produced.
    await new Promise<void>((resolve, reject) => {
      const proc = spawn("unzip", ["-p", path, "apple_health_export/export.xml"], {
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stderr = "";
      proc.stdout.on("data", onChunk);
      proc.stderr.on("data", (d) => { stderr += d.toString(); });
      proc.on("error", () => reject(new Error(
        "`unzip` is not installed. Unzip the export yourself and pass the export.xml path instead.",
      )));
      proc.on("close", (code) => {
        if (code === 0) return resolve();
        reject(new Error(
          `unzip exited ${code}: ${stderr.trim() || "no apple_health_export/export.xml inside the zip"}`,
        ));
      });
    });
  } else {
    await new Promise<void>((resolve, reject) => {
      const rs = createReadStream(path, { encoding: "utf-8" });
      rs.on("data", onChunk);
      rs.on("error", reject);
      rs.on("end", () => resolve());
    });
  }

  if (carry) consumeChunk(carry, daily, stats);
  return { daily, stats };
}

// ── Summarising ──

interface Summary {
  spec: MetricSpec;
  /** Mean of the per-day values across the window (days with no sample excluded). */
  average: number;
  latest: number;
  latestDate: string;
  days: number;
  /** Device that won the most days for this metric, and how many it won. */
  source: string;
  sourceDays: number;
  /** How many distinct devices wrote this metric in the window. */
  sourceCount: number;
}

function round(value: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(value * f) / f;
}

function fmt(value: number, dp: number): string {
  return round(value, dp).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

function summarise(daily: Daily, since: string): Summary[] {
  const out: Summary[] = [];
  for (const spec of METRICS) {
    const byDate = daily.get(spec.key);
    if (!byDate) continue;
    const dates = [...byDate.keys()].filter((d) => d >= since).sort();
    if (dates.length === 0) continue;
    const wins = new Map<string, number>();
    const seenSources = new Set<string>();
    const values = dates.map((d) => {
      const bySource = byDate.get(d)!;
      for (const src of bySource.keys()) seenSources.add(src);
      const { value, source } = collapse(bySource, spec.agg);
      wins.set(source, (wins.get(source) ?? 0) + 1);
      return value;
    });
    const average = values.reduce((a, b) => a + b, 0) / values.length;
    const [source, sourceDays] = [...wins.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
    out.push({
      spec,
      average,
      latest: values[values.length - 1],
      latestDate: dates[dates.length - 1],
      days: dates.length,
      source,
      sourceDays,
      sourceCount: seenSources.size,
    });
  }
  return out;
}

/** `since` = windowDays back from the newest sample, not from today — an export
 *  is often days old, and anchoring on today silently empties the window. */
function windowStart(lastDate: string, windowDays: number): string {
  const d = new Date(`${lastDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - windowDays + 1);
  return d.toISOString().slice(0, 10);
}

// ── Rendering ──
//
// Headings carry the numbers on purpose. The Pulse health page renders each
// file's `##` headings and nothing else, so a heading of "Steps" would show up
// as the word "Steps" with the value invisible. The tables below each heading
// are for reading the file directly, and for the DA.

export function renderMarkdown(
  summaries: Summary[],
  stats: ParseStats,
  windowDays: number,
  generatedAt: string,
): string {
  const lines: string[] = [];
  lines.push("---");
  lines.push("provenance: generated");
  lines.push("generator: LIFEOS/TOOLS/AppleHealthImport.ts");
  lines.push(`generated: ${generatedAt}`);
  lines.push("---");
  lines.push("");
  lines.push("# APPLE HEALTH");
  lines.push("");
  lines.push(
    `Generated from an Apple Health export. Regenerated end to end on every run — ` +
    `edit \`METRICS.md\` or \`FITNESS.md\` instead, this file is overwritten.`,
  );
  lines.push("");

  if (summaries.length === 0) {
    lines.push("---");
    lines.push("");
    lines.push("## No recognised metrics in this export");
    lines.push("");
    lines.push(
      `Read ${stats.recordsSeen.toLocaleString("en-US")} records but matched none of the ` +
      `tracked types. If the export is not empty, the metric list in the generator may need ` +
      `extending.`,
    );
    lines.push("");
    return lines.join("\n");
  }

  for (const s of summaries) {
    const avg = `${fmt(s.average, s.spec.dp)} ${s.spec.unit}`;
    const latest = `${fmt(s.latest, s.spec.dp)} ${s.spec.unit}`;
    // A daily total averages "per day"; a daily average is just an average; a
    // metric read a handful of times is best described by its latest value.
    const headline =
      s.spec.agg === "sum" ? `${avg}/day avg (${s.days}d)`
      : s.spec.agg === "last" ? `${latest} latest (${s.days} readings)`
      : `${avg} avg (${s.days}d)`;
    lines.push("---");
    lines.push("");
    lines.push(`## ${s.spec.label} — ${headline}`);
    lines.push("");
    lines.push("| | |");
    lines.push("|---|---|");
    lines.push(`| Average | ${avg}${s.spec.agg === "sum" ? " per day" : ""} |`);
    lines.push(`| Latest | ${latest} (${s.latestDate}) |`);
    lines.push(`| Days with data | ${s.days} of ${windowDays} |`);
    lines.push(`| Aggregation | ${s.spec.agg} per day |`);
    lines.push(
      `| Source | ${s.source}${s.sourceCount > 1 ? ` (won ${s.sourceDays}/${s.days} days of ${s.sourceCount} devices)` : ""} |`,
    );
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push(`## Source — ${stats.recordsKept.toLocaleString("en-US")} samples, ${stats.firstDate} to ${stats.lastDate}`);
  lines.push("");
  lines.push("| | |");
  lines.push("|---|---|");
  lines.push(`| Records read | ${stats.recordsSeen.toLocaleString("en-US")} |`);
  lines.push(`| Records used | ${stats.recordsKept.toLocaleString("en-US")} |`);
  lines.push(`| Export covers | ${stats.firstDate} to ${stats.lastDate} |`);
  lines.push(`| Summary window | last ${windowDays} days |`);
  lines.push(`| Generated | ${generatedAt} |`);
  lines.push("");
  if (unitWarnings.size > 0) {
    lines.push("---");
    lines.push("");
    lines.push(`## Skipped — ${unitWarnings.size} metric(s) in an unrecognised unit`);
    lines.push("");
    lines.push("| Metric | Unit in export |");
    lines.push("|---|---|");
    for (const [key, unit] of unitWarnings) lines.push(`| ${key} | \`${unit}\` |`);
    lines.push("");
    lines.push("Samples in these units were dropped rather than reported under the wrong label.");
    lines.push("");
  }
  return lines.join("\n");
}

// ── CLI ──

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function main(): Promise<void> {
  const input = process.argv[2];
  if (!input || input.startsWith("--")) {
    console.error("Usage: bun AppleHealthImport.ts <export.zip|export.xml> [--days N] [--out PATH] [--dry-run]");
    process.exit(2);
  }
  if (!existsSync(input)) {
    console.error(`No such file: ${input}`);
    process.exit(2);
  }

  const windowDays = Number(arg("--days", String(DEFAULT_DAYS)));
  if (!Number.isFinite(windowDays) || windowDays < 1) {
    console.error("--days must be a positive number");
    process.exit(2);
  }
  const out = arg("--out", DEFAULT_OUT)!;
  const dryRun = process.argv.includes("--dry-run");

  const t0 = Date.now();
  const { daily, stats } = await parseExport(input);
  if (!stats.lastDate) {
    console.error(
      `Parsed ${stats.recordsSeen.toLocaleString("en-US")} records but found no dated samples. ` +
      `Is this an Apple Health export?`,
    );
    process.exit(1);
  }

  const since = windowStart(stats.lastDate, windowDays);
  const summaries = summarise(daily, since);
  const markdown = renderMarkdown(summaries, stats, windowDays, new Date().toISOString());

  if (dryRun) {
    console.log(markdown);
  } else {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, markdown, "utf-8");
  }

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.error(
    `[apple-health] ${stats.recordsKept.toLocaleString("en-US")}/${stats.recordsSeen.toLocaleString("en-US")} ` +
    `records, ${summaries.length} metrics, ${stats.firstDate}..${stats.lastDate}, ` +
    `window ${since}..${stats.lastDate} (${secs}s)${dryRun ? " [dry run]" : ` → ${out}`}`,
  );
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(`[apple-health] ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
