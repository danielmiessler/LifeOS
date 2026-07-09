#!/usr/bin/env bun
/**
 * FreshnessCache — render-path cache for the statusline FRESH section.
 *
 * The statusline reads `~/.claude/LIFEOS/USER/CACHE/freshness.json` directly
 * (no network call) on every refresh. This file is rewritten by:
 *   1. Every bump-function in TelosFreshness.ts (mutation-driven)
 *   2. Pulse `invalidate()` in modules/telos.ts (in-memory cache flip)
 *   3. SessionStart hook (catches age-progression grade changes)
 *   4. CLI: `bun LIFEOS/TOOLS/FreshnessCache.ts --rebuild`
 *
 * Schema mirrors `/api/freshness/summary` exactly so consumers are
 * interchangeable. Atomic write via temp-file + rename.
 */
import { writeFileSync, renameSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { readContextFreshness } from "./TelosFreshness";

// Normalize env path vars that Claude Code injects without shell expansion (LifeOS#1404)
for (const k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const v = process.env[k];
  if (v && /^\$\{?HOME\}?(\/|$)/.test(v)) process.env[k] = v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}


const HOME = process.env.HOME || "";
const LIFEOS_DIR = process.env.LIFEOS_DIR || join(HOME, ".claude", "LIFEOS");
const CACHE_DIR = join(LIFEOS_DIR, "USER", "CACHE");
const CACHE_PATH = join(CACHE_DIR, "freshness.json");

export interface FreshnessCachePayload {
  total: number;
  fresh_count: number;
  stale_count: number;
  overall_pct: number;
  overall_grade: string;
  most_stale: {
    slug: string;
    name: string;
    age_days: number | null;
    threshold_days: number;
    reviewed_age_days: number | null;
    pct: number;
    grade: string;
    why?: string;
  } | null;
  files: Array<{
    slug: string;
    name: string;
    age_days: number | null;
    threshold_days: number;
    reviewed_age_days: number | null;
    pct: number;
    grade: string;
    stale: boolean;
    why?: string;
  }>;
  generated_at: string;
}

export function buildFreshnessPayload(): FreshnessCachePayload {
  const c = readContextFreshness();
  return {
    total: c.total,
    fresh_count: c.fresh_count,
    stale_count: c.stale_count,
    overall_pct: c.overall_pct,
    overall_grade: c.overall_grade,
    most_stale: c.most_stale
      ? {
          slug: c.most_stale.slug,
          name: c.most_stale.name,
          age_days: c.most_stale.effective_age_days,
          threshold_days: c.most_stale.effective_threshold_days,
          reviewed_age_days: c.most_stale.effective_reviewed_age_days,
          pct: c.most_stale.pct,
          grade: c.most_stale.grade,
          why: c.most_stale.why,
        }
      : null,
    files: c.files.map((f) => ({
      slug: f.slug,
      name: f.name,
      age_days: f.effective_age_days,
      threshold_days: f.effective_threshold_days,
      reviewed_age_days: f.effective_reviewed_age_days,
      pct: f.pct,
      grade: f.grade,
      stale: f.stale,
      why: f.why,
    })),
    generated_at: new Date().toISOString(),
  };
}

export interface WriteResult {
  path: string;
  bytes: number;
  generated_at: string;
}

export function writeFreshnessCache(): WriteResult {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  const payload = buildFreshnessPayload();
  const json = JSON.stringify(payload);
  const tmp = `${CACHE_PATH}.tmp.${process.pid}`;
  writeFileSync(tmp, json);
  renameSync(tmp, CACHE_PATH);
  return { path: CACHE_PATH, bytes: json.length, generated_at: payload.generated_at };
}

export const FRESHNESS_CACHE_PATH = CACHE_PATH;

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args.includes("--print") || args.includes("-p")) {
    console.log(JSON.stringify(buildFreshnessPayload(), null, 2));
    process.exit(0);
  }
  // default action: rebuild
  try {
    const r = writeFreshnessCache();
    if (args.includes("--quiet") || args.includes("-q")) process.exit(0);
    console.log(`wrote ${r.path} (${r.bytes}B) ${r.generated_at}`);
  } catch (err) {
    console.error(`FreshnessCache write failed: ${(err as Error).message}`);
    process.exit(1);
  }
}
