/**
 * Deterministic daily rollup. PURE: buildDailyRecord takes events + poll interval and
 * returns a DailyRecord with zero side effects and zero model calls — which is what
 * makes v1 stable and testable. Persistence is a separate function.
 *
 * Time model: each app-focus event represents one poll interval of that app (capped —
 * a sleep gap does not inflate time because launchd fires no polls while asleep).
 *
 * FALLBACK: app-focus needs macOS `osascript`, so on every other platform it yields
 * nothing and the whole time model reads zero while capture reports healthy. When a
 * day has no focus time, time is derived from claude-session cadence instead — the
 * signal that IS present everywhere. It is labelled as derived in the block itself,
 * because inferred keyboard time and measured focus time are not the same claim and
 * the record should not blur them.
 */
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { classifyApp } from "./classify.ts";
import { DAILY_DIR, dailyPathsFor } from "./paths.ts";
import type { ConduitEvent, DailyBlock, DailyRecord } from "./types.ts";

/** Label marks the number as inferred, so a reader never mistakes it for measured focus. */
const DERIVED_LABEL = "Claude Code (derived from session cadence)";

/**
 * Time between consecutive claude-session events, capped so an overnight gap is not
 * counted as work. The cap self-tunes to 2× the day's median gap rather than a fixed
 * constant: the capture cadence is set by the cron schedule (every 5 minutes at time
 * of writing), not by pollIntervalSec, so a hardcoded cap would silently undercount
 * the moment that schedule changed.
 *
 * Each event is credited with the gap BACK to the previous one — N events yield N-1
 * spans, which deliberately claims nothing about time after the final event.
 */
function deriveSessionSeconds(sessionTimestamps: number[]): number {
  if (sessionTimestamps.length < 2) return 0;
  const sorted = [...sessionTimestamps].sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) gaps.push((sorted[i] - sorted[i - 1]) / 1000);

  const ordered = [...gaps].sort((a, b) => a - b);
  const median = ordered[Math.floor(ordered.length / 2)] || 0;
  // Floor/ceiling keep a degenerate median (one burst, or a single long gap) from
  // producing an absurd cap in either direction.
  const cap = Math.min(Math.max(median * 2, 60), 1800);

  return gaps.reduce((n, g) => n + Math.min(g, cap), 0);
}

/** Aggregate a day's raw events into the deterministic record. Pure. */
export function buildDailyRecord(
  date: string,
  events: ConduitEvent[],
  pollIntervalSec: number,
  conduitVersion: string,
): DailyRecord {
  const perAppSec = new Map<string, number>();
  const seenSha = new Set<string>();
  const sessionTimestamps: number[] = [];
  let commits = 0;
  let sessions = 0;

  for (const e of events) {
    if (e.type === "app-focus" && e.app) {
      // Pin duration to the interval in effect WHEN captured (falls back to the passed
      // default for events written before intervalSec was recorded). Changing the config
      // interval never retroactively re-values history.
      const sec = Number(e.detail?.intervalSec) || pollIntervalSec;
      perAppSec.set(e.app, (perAppSec.get(e.app) ?? 0) + sec);
    } else if (e.type === "git-commit") {
      const sha = (e.detail?.sha as string) || `${e.repo}:${e.ts}`;
      if (seenSha.has(sha)) continue; // de-dupe commits seen across overlapping poll windows
      seenSha.add(sha);
      commits++;
    } else if (e.type === "claude-session") {
      sessions++;
      const t = Date.parse(e.ts);
      if (!Number.isNaN(t)) sessionTimestamps.push(t);
    }
  }

  // Fallback only. Measured focus always wins where it exists, so a macOS host is
  // completely unaffected and upstream behaviour is preserved.
  if (perAppSec.size === 0) {
    const derivedSec = deriveSessionSeconds(sessionTimestamps);
    if (derivedSec > 0) perAppSec.set(DERIVED_LABEL, derivedSec);
  }

  const blocks: DailyBlock[] = [...perAppSec.entries()]
    .map(([label, sec]) => ({
      label,
      kind: classifyApp(label),
      minutes: Math.round((sec / 60) * 10) / 10,
    }))
    .sort((a, b) => b.minutes - a.minutes);

  const sum = (kind: string) =>
    Math.round(blocks.filter((b) => b.kind === kind).reduce((n, b) => n + b.minutes, 0) * 10) / 10;

  return {
    date,
    conduitVersion,
    generatedAt: new Date().toISOString(),
    totalMinutes: Math.round(blocks.reduce((n, b) => n + b.minutes, 0) * 10) / 10,
    creationMinutes: sum("creation"),
    consumptionMinutes: sum("consumption"),
    neutralMinutes: sum("neutral"),
    blocks,
    commits,
    sessions,
    narrative: null, // v2 local-model seam
    telosTags: {}, // v2 TELOS-scoring seam
  };
}

/** Render a record as human-readable markdown. */
export function renderMarkdown(r: DailyRecord): string {
  const hm = (m: number) => `${Math.floor(m / 60)}h ${Math.round(m % 60)}m`;
  const ratio =
    r.creationMinutes + r.consumptionMinutes > 0
      ? Math.round((r.creationMinutes / (r.creationMinutes + r.consumptionMinutes)) * 100)
      : 0;
  const rows = r.blocks
    .slice(0, 20)
    .map((b) => `| ${b.label} | ${b.kind} | ${hm(b.minutes)} |`)
    .join("\n");
  return `# Conduit — ${r.date}

> Deterministic daily record · Conduit v${r.conduitVersion} · generated ${r.generatedAt}

- **Tracked time:** ${hm(r.totalMinutes)}
- **Creation:** ${hm(r.creationMinutes)} · **Consumption:** ${hm(r.consumptionMinutes)} · **Neutral:** ${hm(r.neutralMinutes)}
- **Creation ratio:** ${ratio}% (creation / (creation + consumption))
- **Commits:** ${r.commits} · **LifeOS sessions:** ${r.sessions}

## Where the time went

| App | Kind | Time |
|-----|------|------|
${rows || "| _(no app-focus events)_ | | |"}
`;
}

/** Write via tmp-file + atomic rename so a reader never sees a half-written file. */
function writeAtomic(path: string, content: string): void {
  const tmp = `${path}.${process.pid}.tmp`; // pid-unique so concurrent rollups don't share a tmp
  writeFileSync(tmp, content);
  renameSync(tmp, path); // atomic on the same filesystem
}

/** Persist a record as markdown + JSON under USER, atomically. */
export function writeDailyRecord(r: DailyRecord): { md: string; json: string } {
  mkdirSync(DAILY_DIR, { recursive: true });
  const paths = dailyPathsFor(r.date);
  writeAtomic(paths.md, renderMarkdown(r));
  writeAtomic(paths.json, JSON.stringify(r, null, 2));
  return paths;
}
