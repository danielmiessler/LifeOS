#!/usr/bin/env bun
/**
 * TelosFreshness — canonical reader/writer for TELOS staleness signal.
 *
 * Single source for two operations:
 *   readTelosFreshness()  → file + per-section ages, list of stale sections
 *   bumpTelosTimestamp()  → updates the per-section marker (and file frontmatter)
 *
 * Same data, two consumers:
 *   - skills/Interview workflow → opens `/interview` with the most-stale sections
 *   - LIFEOS/PULSE/modules/telos.ts → /api/telos/freshness, DA-panel surface
 *
 * Convention:
 *   1. TELOS.md begins with YAML frontmatter holding `last_updated` + `last_updated_by`.
 *   2. Each H2 section is followed (within the next 3 lines) by an HTML comment:
 *      `<!-- updated: YYYY-MM-DD by:agent -->`
 *   3. Markers are markdown-invisible (HTML comments) but trivially greppable.
 *
 * CLI:
 *   bun ~/.claude/LIFEOS/TOOLS/TelosFreshness.ts                 → human report
 *   bun ~/.claude/LIFEOS/TOOLS/TelosFreshness.ts --json          → machine-readable
 *   bun ~/.claude/LIFEOS/TOOLS/TelosFreshness.ts --bump <slug>   → mark a section fresh
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { basename, join } from "path";

// Normalize env path vars that Claude Code injects without shell expansion (LifeOS#1404)
for (const k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const v = process.env[k];
  if (v && /^\$\{?HOME\}?(\/|$)/.test(v)) process.env[k] = v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}


const HOME = process.env.HOME || "";
const LIFEOS_DIR = process.env.LIFEOS_DIR || join(HOME, ".claude", "LIFEOS");
const TELOS_PATH = join(LIFEOS_DIR, "USER", "TELOS", "TELOS.md");
const DA_IDENTITY_PATH = join(LIFEOS_DIR, "USER", "DIGITAL_ASSISTANT", "DA_IDENTITY.md");
const PRINCIPAL_IDENTITY_PATH = join(LIFEOS_DIR, "USER", "PRINCIPAL", "PRINCIPAL_IDENTITY.md");
const PROJECTS_PATH = join(LIFEOS_DIR, "USER", "PROJECTS.md");
const LIFEOS_SYSTEM_PROMPT_PATH = join(LIFEOS_DIR, "LIFEOS_SYSTEM_PROMPT.md");
const PRINCIPAL_TELOS_PATH = join(LIFEOS_DIR, "USER", "TELOS", "PRINCIPAL_TELOS.md");
const ARCHITECTURE_SUMMARY_PATH = join(LIFEOS_DIR, "DOCUMENTATION", "ARCHITECTURE_SUMMARY.md");
const LIFEOS_ARCHITECTURE_PATH = join(LIFEOS_DIR, "DOCUMENTATION", "LifeosSystemArchitecture.md");
const LIFEOS_SYSTEM_ARCHITECTURE_PATH = LIFEOS_ARCHITECTURE_PATH; // alias for clarity

// ─── Threshold defaults ───────────────────────────────────────────────────
//
// Days after which a section is considered "stale" and surfaces as one of
// the most important things to review. Override per-installation by editing
// this map. The slug is the section name normalized: lowercased, words joined
// with `_`, parenthetical/em-dash suffixes dropped.

export const STALENESS_THRESHOLDS: Record<string, number> = {
  // Operational, fast-moving — short threshold
  current_state: 7,
  status: 14,

  // Active TELOS — monthly review cadence
  goals: 30,
  strategies: 30,
  ideas: 45,
  problems: 60,
  challenges: 60,
  narratives: 60,
  predictions: 60,

  // Slow-moving foundational — quarterly review cadence
  mission: 90,
  beliefs: 90,
  models: 90,
  frames: 90,
  wisdom: 90,
  ideal_state: 90,

  // Personal preference / static — half-year review
  sparks: 180,
  team: 180,
  books: 180,
  authors: 180,
  bands: 180,
  movies: 180,
  restaurants: 180,
  food: 180,
  meetups: 180,
  civic: 180,
  learning_interests: 180,
  context_filter: 180,
  "2036": 365,

  // Effectively permanent — yearly review
  traumas: 365,
  wrong: 365,

  // Constitutional context files
  da_identity: 180,
  principal_identity: 90,
  projects: 30,
  pai_system_prompt: 90,
  principal_telos: 30,
  architecture_summary: 30,

  // Source / authored docs that derivatives inherit from
  pai_system_architecture: 90,
};

const DEFAULT_THRESHOLD_DAYS = 180;

// ─── Types ────────────────────────────────────────────────────────────────

export interface SectionFreshness {
  /** Display name as it appears in the H2 heading. */
  name: string;
  /** Normalized slug used as the threshold-map key. */
  slug: string;
  /** Date the section was last updated. null when no marker present. */
  updated: Date | null;
  /** Days since last update; null when no marker present. */
  ageDays: number | null;
  /** Threshold in days for this section. */
  thresholdDays: number;
  /** True when ageDays > thresholdDays, OR when no marker present. */
  stale: boolean;
  /** First ~80 chars of the section body, for surface display. */
  preview: string;
  /** Approximate line of the H2 heading (1-indexed). */
  line: number;
}

export interface TelosFreshness {
  /** Path scanned. */
  path: string;
  /** Last-update timestamp from the file frontmatter, or null when absent. */
  fileUpdated: Date | null;
  /** Days since file-level update; null when absent. */
  fileAgeDays: number | null;
  /** Per-section freshness in file order. */
  sections: SectionFreshness[];
  /** Sections sorted most-stale-first; only entries where stale=true. */
  staleSections: SectionFreshness[];
  /** True when ANY section is stale OR file frontmatter missing. */
  hasStale: boolean;
  /** Count of sections present in the file. */
  totalSections: number;
}

export interface ContextFile {
  slug: string;
  path: string;
  threshold_days: number;
  derived_from?: string;
  is_auto_generated: boolean;
}

export const CONTEXT_FRESHNESS_REGISTRY: ContextFile[] = [
  { slug: "telos", path: TELOS_PATH, threshold_days: 30, is_auto_generated: false },
  { slug: "da_identity", path: DA_IDENTITY_PATH, threshold_days: 180, is_auto_generated: false },
  { slug: "principal_identity", path: PRINCIPAL_IDENTITY_PATH, threshold_days: 90, is_auto_generated: false },
  { slug: "projects", path: PROJECTS_PATH, threshold_days: 30, is_auto_generated: false },
  { slug: "pai_system_prompt", path: LIFEOS_SYSTEM_PROMPT_PATH, threshold_days: 90, is_auto_generated: false },
  { slug: "principal_telos", path: PRINCIPAL_TELOS_PATH, threshold_days: 30, derived_from: TELOS_PATH, is_auto_generated: true },
  { slug: "architecture_summary", path: ARCHITECTURE_SUMMARY_PATH, threshold_days: 30, derived_from: LIFEOS_ARCHITECTURE_PATH, is_auto_generated: true },
  { slug: "pai_system_architecture", path: LIFEOS_SYSTEM_ARCHITECTURE_PATH, threshold_days: 90, is_auto_generated: false },
];

/** A-F letter grade. F covers both "overdue" and "never reviewed". */
export type FreshnessGrade = "A" | "B" | "C" | "D" | "F";

export interface FileFreshness {
  slug: string;
  path: string;
  name: string;
  /** Last write to file (any author, including auto-bumps from migrations/generators). */
  updated: Date | null;
  age_days: number | null;
  threshold_days: number;
  /** Last *principal review* of the content. Only Interview-skill review bumps this —
   *  migrations, auto-generators, and incidental writes do NOT. null when absent. */
  reviewed: Date | null;
  reviewed_age_days: number | null;
  /** Who recorded the last review. */
  reviewed_by: string | null;
  derived_from?: string;
  effective_updated: Date | null;
  effective_age_days: number | null;
  effective_threshold_days: number;
  /** Source `last_reviewed` for derived files (inherits source's review marker). */
  effective_reviewed: Date | null;
  effective_reviewed_age_days: number | null;
  stale: boolean;
  why?: string;
  is_auto_generated: boolean;
  /** Freshness score 0..100 derived from review age, NOT write age.
   *  null reviewed_age → 0 (never reviewed → grade F). */
  pct: number;
  /** Letter grade A/B/C/D/F derived from review-age:threshold ratio.
   *  A ≤25%, B ≤50%, C ≤75%, D ≤100%, F >100% OR no review marker. */
  grade: FreshnessGrade;
}

export interface ContextFreshness {
  files: FileFreshness[];
  total: number;
  fresh_count: number;
  stale_count: number;
  most_stale: FileFreshness | null;
  generated_at: Date;
  /** Mean of all per-file `pct`, rounded. */
  overall_pct: number;
  /** GPA-style mean of all per-file letter grades (A=4..F=0), mapped back to a letter.
   *  ≥3.5=A, ≥2.5=B, ≥1.5=C, ≥0.5=D, else F. */
  overall_grade: FreshnessGrade;
}

/** Compute a 0..100 freshness score from review age. null age → 0 (never reviewed). */
export function freshnessPct(reviewedAgeDays: number | null, thresholdDays: number): number {
  if (reviewedAgeDays === null || thresholdDays <= 0) return 0;
  const raw = Math.round((100 * (thresholdDays - reviewedAgeDays)) / thresholdDays);
  return Math.max(0, Math.min(100, raw));
}

/** Map review-age:threshold ratio to A/B/C/D/F. null age (never reviewed) → F. */
export function freshnessGrade(reviewedAgeDays: number | null, thresholdDays: number): FreshnessGrade {
  if (reviewedAgeDays === null || thresholdDays <= 0) return "F";
  const ratio = reviewedAgeDays / thresholdDays;
  if (ratio <= 0.25) return "A";
  if (ratio <= 0.50) return "B";
  if (ratio <= 0.75) return "C";
  if (ratio <= 1.00) return "D";
  return "F";
}

const GRADE_TO_GPA: Record<FreshnessGrade, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 };

/** Aggregate per-file letters via GPA mean, mapped back to a letter. */
export function aggregateGrade(grades: FreshnessGrade[]): FreshnessGrade {
  if (!grades.length) return "F";
  const mean = grades.reduce((s, g) => s + GRADE_TO_GPA[g], 0) / grades.length;
  if (mean >= 3.5) return "A";
  if (mean >= 2.5) return "B";
  if (mean >= 1.5) return "C";
  if (mean >= 0.5) return "D";
  return "F";
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Normalize a heading to a stable slug for the threshold map.
 * "Current State" → "current_state"
 * "Wrong (Things I've been wrong about)" → "wrong"
 * "Status — Current Work & Recent Accomplishments" → "status"
 * "2036 — A Day in the Life..." → "2036"
 */
export function sectionSlug(heading: string): string {
  return heading
    .replace(/\s*[—–-].*$/, "")
    .replace(/\s*\(.*\)\s*$/, "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\d]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

interface FrontmatterParseResult {
  fm: Record<string, string>;
  rest: string;
  hasFrontmatter: boolean;
}

function parseFrontmatterCore(content: string): FrontmatterParseResult {
  if (!content.startsWith("---\n")) return { fm: {}, rest: content, hasFrontmatter: false };
  const end = content.indexOf("\n---\n", 4);
  if (end === -1) return { fm: {}, rest: content, hasFrontmatter: false };
  const block = content.slice(4, end);
  const rest = content.slice(end + 5);
  const fm: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (m) fm[m[1]] = m[2].trim();
  }
  return { fm, rest, hasFrontmatter: true };
}

export function parseFrontmatter(content: string): { fm: Record<string, string>; rest: string } {
  const parsed = parseFrontmatterCore(content);
  return { fm: parsed.fm, rest: parsed.rest };
}

export function readFileFrontmatter(path: string): Record<string, string> | null {
  if (!existsSync(path)) {
    throw new Error(`Cannot read frontmatter; file missing: ${path}`);
  }

  const raw = readFileSync(path, "utf-8");
  const parsed = parseFrontmatterCore(raw);
  return parsed.hasFrontmatter ? parsed.fm : null;
}

export function parseDate(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export const MARKER_RE = /<!--\s*updated:\s*(\d{4}-\d{2}-\d{2})(?:\s+by:\s*([^\s>-]+))?\s*-->/;

function freshnessAge(updated: Date | null, now: Date): number | null {
  return updated ? daysBetween(updated, now) : null;
}

function sourceThresholdDays(sourcePath: string, fallback: number): number {
  const source = CONTEXT_FRESHNESS_REGISTRY.find((entry) => entry.path === sourcePath);
  return source ? source.threshold_days : fallback;
}

function fileFrontmatter(path: string): { fm: Record<string, string> | null; missing: boolean } {
  if (!existsSync(path)) return { fm: null, missing: true };
  const raw = readFileSync(path, "utf-8");
  const parsed = parseFrontmatterCore(raw);
  return { fm: parsed.hasFrontmatter ? parsed.fm : null, missing: false };
}

function upsertFrontmatterLine(block: string, key: string, value: string): string {
  const line = `${key}: ${value}`;
  const re = new RegExp(`^${key}:.*$`, "m");
  if (re.test(block)) return block.replace(re, line);
  return block.length ? `${block}\n${line}` : line;
}

function bumpFileFrontmatter(content: string, isoNow: string, by: string): string {
  if (content.startsWith("---\n")) {
    const end = content.indexOf("\n---\n", 4);
    if (end === -1) {
      throw new Error("Malformed frontmatter: opening delimiter has no closing delimiter");
    }

    let fmBlock = content.slice(4, end);
    fmBlock = upsertFrontmatterLine(fmBlock, "last_updated", isoNow);
    fmBlock = upsertFrontmatterLine(fmBlock, "last_updated_by", by);
    return "---\n" + fmBlock + "\n---\n" + content.slice(end + 5);
  }

  const separator = content.startsWith("<!-- CONTEXT-BUDGET") ? "" : "\n";
  return (
    `---\n` +
    `last_updated: ${isoNow}\n` +
    `last_updated_by: ${by}\n` +
    `---\n` +
    separator +
    content
  );
}

// ─── Reader ───────────────────────────────────────────────────────────────

export function readTelosFreshness(path: string = TELOS_PATH): TelosFreshness {
  if (!existsSync(path)) {
    return {
      path,
      fileUpdated: null,
      fileAgeDays: null,
      sections: [],
      staleSections: [],
      hasStale: true,
      totalSections: 0,
    };
  }

  const raw = readFileSync(path, "utf-8");
  const { fm } = parseFrontmatter(raw);
  const fileUpdated = parseDate(fm.last_updated);
  const now = new Date();
  const fileAgeDays = fileUpdated ? daysBetween(fileUpdated, now) : null;

  const lines = raw.split("\n");
  const sections: SectionFreshness[] = [];

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^##\s+(.+?)\s*$/);
    if (!m) continue;

    const name = m[1].trim();
    const slug = sectionSlug(name);
    const thresholdDays = STALENESS_THRESHOLDS[slug] ?? DEFAULT_THRESHOLD_DAYS;

    // Look for the marker in the next 3 lines.
    let updated: Date | null = null;
    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
      const mk = lines[j].match(MARKER_RE);
      if (mk) {
        updated = parseDate(mk[1]);
        break;
      }
    }

    // First substantive line of the section body, for preview.
    let preview = "";
    for (let j = i + 1; j < Math.min(i + 12, lines.length); j++) {
      const t = lines[j].trim();
      if (!t || t.startsWith("<!--") || t.startsWith(">") || t.startsWith("---")) continue;
      preview = t.replace(/^[#>*\-\s]+/, "").slice(0, 80);
      break;
    }

    const ageDays = updated ? daysBetween(updated, now) : null;
    const stale = ageDays === null || ageDays > thresholdDays;

    sections.push({ name, slug, updated, ageDays, thresholdDays, stale, preview, line: i + 1 });
  }

  const staleSections = sections
    .filter((s) => s.stale)
    .sort((a, b) => {
      const aOver = (a.ageDays ?? 9999) - a.thresholdDays;
      const bOver = (b.ageDays ?? 9999) - b.thresholdDays;
      return bOver - aOver;
    });

  return {
    path,
    fileUpdated,
    fileAgeDays,
    sections,
    staleSections,
    hasStale: staleSections.length > 0 || fileUpdated === null,
    totalSections: sections.length,
  };
}

export function readContextFreshness(): ContextFreshness {
  const now = new Date();
  const files: FileFreshness[] = CONTEXT_FRESHNESS_REGISTRY.map((entry) => {
    const own = fileFrontmatter(entry.path);
    const updated = own.fm ? parseDate(own.fm.last_updated) : null;
    const age_days = freshnessAge(updated, now);
    const reviewed = own.fm ? parseDate(own.fm.last_reviewed) : null;
    const reviewed_age_days = freshnessAge(reviewed, now);
    const reviewed_by = own.fm?.last_reviewed_by ?? null;

    let effective_updated = updated;
    let effective_age_days = age_days;
    let effective_threshold_days = entry.threshold_days;
    let effective_reviewed = reviewed;
    let effective_reviewed_age_days = reviewed_age_days;
    let why: string | undefined;

    if (entry.derived_from) {
      effective_threshold_days = sourceThresholdDays(entry.derived_from, entry.threshold_days);
      const source = fileFrontmatter(entry.derived_from);
      if (source.missing || !source.fm) {
        effective_updated = null;
        effective_age_days = null;
        effective_reviewed = null;
        effective_reviewed_age_days = null;
        why = "source missing";
      } else {
        effective_updated = parseDate(source.fm.last_updated);
        effective_age_days = freshnessAge(effective_updated, now);
        effective_reviewed = parseDate(source.fm.last_reviewed);
        effective_reviewed_age_days = freshnessAge(effective_reviewed, now);
      }
    } else if (own.missing || !own.fm) {
      why = "no frontmatter";
    }

    // Stale and grade are driven by REVIEW age, not write age.
    // No review marker → stale (and grade F).
    const stale =
      effective_reviewed_age_days === null ||
      effective_reviewed_age_days > effective_threshold_days;
    if (stale && why === undefined) {
      why = effective_reviewed === null ? "never reviewed" : "review overdue";
    }

    return {
      slug: entry.slug,
      path: entry.path,
      name: basename(entry.path),
      updated,
      age_days,
      threshold_days: entry.threshold_days,
      reviewed,
      reviewed_age_days,
      reviewed_by,
      derived_from: entry.derived_from,
      effective_updated,
      effective_age_days,
      effective_threshold_days,
      effective_reviewed,
      effective_reviewed_age_days,
      stale,
      why,
      is_auto_generated: entry.is_auto_generated,
      pct: freshnessPct(effective_reviewed_age_days, effective_threshold_days),
      grade: freshnessGrade(effective_reviewed_age_days, effective_threshold_days),
    };
  });

  const staleFiles = files.filter((file) => file.stale);
  const most_stale = staleFiles
    .slice()
    .sort((a, b) => {
      const aOver = (a.effective_reviewed_age_days ?? 9999) - a.effective_threshold_days;
      const bOver = (b.effective_reviewed_age_days ?? 9999) - b.effective_threshold_days;
      return bOver - aOver;
    })[0] ?? null;

  const overall_pct = files.length
    ? Math.round(files.reduce((sum, f) => sum + f.pct, 0) / files.length)
    : 0;
  const overall_grade = aggregateGrade(files.map((f) => f.grade));

  return {
    files,
    total: files.length,
    fresh_count: files.length - staleFiles.length,
    stale_count: staleFiles.length,
    most_stale,
    generated_at: now,
    overall_pct,
    overall_grade,
  };
}

// ─── Writer ───────────────────────────────────────────────────────────────

/**
 * Refresh the statusline cache file after a successful frontmatter mutation.
 * Failures are swallowed — cache desync is recoverable; bump callers must not
 * fail because the render-path cache could not be written.
 */
function refreshFreshnessCache(): void {
  try {
    // Lazy-load to avoid a circular import at module init.
    const mod = require("./FreshnessCache") as typeof import("./FreshnessCache");
    mod.writeFreshnessCache();
  } catch {
    // ignore — see doc above.
  }
}

/**
 * Update the per-section marker (and bump the file frontmatter) to today.
 * When `slug` is omitted, only the file-level marker is bumped.
 *
 * Idempotent: safe to call repeatedly; each call writes today's date.
 */
export function bumpTelosTimestamp(
  slug?: string,
  by: string = "kai",
  path: string = TELOS_PATH,
): { changed: boolean; sectionFound: boolean } {
  if (!existsSync(path)) return { changed: false, sectionFound: false };

  const today = new Date().toISOString().slice(0, 10);
  const isoNow = new Date().toISOString();
  let raw = readFileSync(path, "utf-8");

  // ─── Bump frontmatter (always) ───
  if (raw.startsWith("---\n")) {
    const end = raw.indexOf("\n---\n", 4);
    if (end !== -1) {
      let fmBlock = raw.slice(4, end);
      if (/^last_updated:/m.test(fmBlock)) {
        fmBlock = fmBlock.replace(/^last_updated:.*$/m, `last_updated: ${isoNow}`);
      } else {
        fmBlock += `\nlast_updated: ${isoNow}`;
      }
      if (/^last_updated_by:/m.test(fmBlock)) {
        fmBlock = fmBlock.replace(/^last_updated_by:.*$/m, `last_updated_by: ${by}`);
      } else {
        fmBlock += `\nlast_updated_by: ${by}`;
      }
      raw = "---\n" + fmBlock + "\n---\n" + raw.slice(end + 5);
    }
  }

  let sectionFound = !slug;

  // ─── Bump per-section marker ───
  if (slug) {
    const lines = raw.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^##\s+(.+?)\s*$/);
      if (!m) continue;
      if (sectionSlug(m[1].trim()) !== slug) continue;
      sectionFound = true;

      // Look for an existing marker in the next 3 lines.
      let markerLine = -1;
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        if (MARKER_RE.test(lines[j])) {
          markerLine = j;
          break;
        }
      }

      const newMarker = `<!-- updated: ${today} by:${by} -->`;
      if (markerLine !== -1) {
        lines[markerLine] = lines[markerLine].replace(MARKER_RE, newMarker);
      } else {
        // Insert immediately after the heading.
        lines.splice(i + 1, 0, newMarker);
      }
      break;
    }
    raw = lines.join("\n");
  }

  writeFileSync(path, raw);
  refreshFreshnessCache();
  return { changed: true, sectionFound };
}

export function bumpContextTimestamp(filePath: string, by: string = "kai"): { changed: boolean } {
  if (!existsSync(filePath)) return { changed: false };

  const raw = readFileSync(filePath, "utf-8");
  const next = bumpFileFrontmatter(raw, new Date().toISOString(), by);
  if (next === raw) return { changed: false };

  writeFileSync(filePath, next);
  refreshFreshnessCache();
  return { changed: true };
}

/**
 * Bump the `last_reviewed:` marker (and `last_reviewed_by:`) on a context file.
 * Distinct from `bumpContextTimestamp`: this signals an explicit *principal review*
 * of the content, NOT a file write. Migrations and auto-generators must not call this.
 * Only the Interview skill (or equivalent principal-driven review flow) should bump
 * `last_reviewed`. Freshness grades A-F are computed against this field.
 */
export function bumpReviewedTimestamp(filePath: string, by: string = "user"): { changed: boolean } {
  if (!existsSync(filePath)) return { changed: false };

  const raw = readFileSync(filePath, "utf-8");
  const isoNow = new Date().toISOString();

  let next = raw;
  if (next.startsWith("---\n")) {
    const end = next.indexOf("\n---\n", 4);
    if (end !== -1) {
      let fmBlock = next.slice(4, end);
      fmBlock = upsertFrontmatterLine(fmBlock, "last_reviewed", isoNow);
      fmBlock = upsertFrontmatterLine(fmBlock, "last_reviewed_by", by);
      next = "---\n" + fmBlock + "\n---\n" + next.slice(end + 5);
    } else {
      throw new Error("Malformed frontmatter: opening delimiter has no closing delimiter");
    }
  } else {
    // No frontmatter at all — create one with just the review fields.
    const separator = next.startsWith("<!--") ? "" : "\n";
    next =
      `---\n` +
      `last_reviewed: ${isoNow}\n` +
      `last_reviewed_by: ${by}\n` +
      `---\n` +
      separator +
      next;
  }

  if (next === raw) return { changed: false };
  writeFileSync(filePath, next);
  refreshFreshnessCache();
  return { changed: true };
}

// ─── CLI ──────────────────────────────────────────────────────────────────

function formatHuman(f: TelosFreshness): string {
  const lines: string[] = [];
  lines.push(`═══ TELOS Freshness — ${f.path.replace(HOME, "~")} ═══`);
  lines.push("");
  if (f.fileUpdated) {
    lines.push(`File-level: last_updated ${f.fileUpdated.toISOString().slice(0, 10)} (${f.fileAgeDays}d ago)`);
  } else {
    lines.push(`File-level: NO frontmatter — run migration`);
  }
  lines.push(`Sections:   ${f.totalSections} total · ${f.staleSections.length} stale`);
  lines.push("");

  if (f.staleSections.length) {
    lines.push("── Most-stale (sorted by days-over-threshold) ──");
    for (const s of f.staleSections) {
      const age = s.ageDays === null ? "no marker" : `${s.ageDays}d`;
      lines.push(`  ⚠ ${s.name.padEnd(28)} ${age.padStart(10)} (threshold ${s.thresholdDays}d) — ${s.preview}`);
    }
    lines.push("");
  }

  lines.push("── All sections ──");
  for (const s of f.sections) {
    const age = s.ageDays === null ? "—" : `${s.ageDays}d`;
    const flag = s.stale ? "⚠" : "✓";
    lines.push(`  ${flag} ${s.name.padEnd(28)} ${age.padStart(6)} / ${s.thresholdDays}d`);
  }
  return lines.join("\n");
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const bumpIdx = args.indexOf("--bump");
  if (bumpIdx !== -1) {
    const slug = args[bumpIdx + 1];
    const result = bumpTelosTimestamp(slug);
    if (slug && !result.sectionFound) {
      console.error(`Section "${slug}" not found in TELOS.md`);
      process.exit(2);
    }
    console.log(`✅ Bumped ${slug ?? "file-level"} timestamp`);
    process.exit(0);
  }

  const f = readTelosFreshness();
  if (args.includes("--context")) {
    console.log(JSON.stringify(readContextFreshness(), null, 2));
  } else if (args.includes("--json")) {
    console.log(JSON.stringify(f, null, 2));
  } else {
    console.log(formatHuman(f));
  }
}
