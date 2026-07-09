#!/usr/bin/env bun
/**
 * UpdateLifeosState — Writes LIFEOS_STATE.json with per-dimension pct scores read by
 * the statusline (PAI/LIFEOS_StatusLine.sh) STATE strip and the Pulse TELOS
 * dashboard rings.
 *
 * Pct semantics:
 *   - If `CURRENT_STATE/<DIM>.md` exists with `status: have|partial|missing`
 *     rows, pct = (have + 0.5 × partial) / total × 100 — real coverage.
 *   - Else falls back to IDEAL_STATE articulation completeness:
 *     `100 - (TBD markers × 10)`, clamped 0..100.
 *
 * The fallback measures whether the principal has articulated what "good"
 * looks like; the primary path measures whether reality matches it.
 *
 * Reads:  LIFEOS/USER/TELOS/IDEAL_STATE/<DIM>.md (target articulation)
 *         LIFEOS/USER/TELOS/CURRENT_STATE/<DIM>.md (actual coverage, when present)
 * Writes: LIFEOS/USER/TELOS/LIFEOS_STATE.json
 *
 * Template-style: works on any user's LifeOS install — no hardcoded paths,
 * no {{PRINCIPAL_NAME}}-specific names. Fresh installs land all dimensions at 0 until the
 * principal runs the IDEAL_STATE interview.
 *
 * Usage:
 *   bun ~/.claude/LIFEOS/TOOLS/UpdateLifeosState.ts
 *   bun ~/.claude/LIFEOS/TOOLS/UpdateLifeosState.ts --json
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
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
const STATE_FILE = join(LIFEOS_DIR, "USER", "TELOS", "LIFEOS_STATE.json");

const DIMENSIONS = [
  { id: "health",         file: "HEALTH.md" },
  { id: "money",          file: "MONEY.md" },
  { id: "freedom",        file: "FREEDOM.md" },
  { id: "creative",       file: "CREATIVE.md" },
  { id: "relationships",  file: "RELATIONSHIPS.md" },
  { id: "rhythms",        file: "RHYTHMS.md" },
  { id: "infrastructure", file: "INFRASTRUCTURE.md" },
] as const;

type DimensionId = (typeof DIMENSIONS)[number]["id"];

interface DimensionState {
  pct: number | null;
  tbd_count: number;
  last_updated: string | null;
  source_file: string;
}

interface LifeosState {
  generated_at: string;
  dimensions: Record<DimensionId, DimensionState>;
}

function readFrontmatterDate(content: string): string | null {
  if (!content.startsWith("---")) return null;
  const end = content.indexOf("\n---", 3);
  if (end === -1) return null;
  const fm = content.slice(3, end);
  const m = fm.match(/^last_updated:\s*(.+?)\s*$/m);
  return m ? m[1].replace(/^["']|["']$/g, "") : null;
}

function computeFromCurrent(file: string): DimensionState | null {
  const path = join(CURRENT_DIR, file);
  if (!existsSync(path)) return null;
  const content = readFileSync(path, "utf-8");
  const have    = (content.match(/\bstatus:\s*have\b/g)    || []).length;
  const partial = (content.match(/\bstatus:\s*partial\b/g) || []).length;
  const missing = (content.match(/\bstatus:\s*missing\b/g) || []).length;
  const total = have + partial + missing;
  if (total === 0) return null;
  const pct = Math.round(((have + 0.5 * partial) / total) * 100);
  return {
    pct,
    tbd_count: missing,
    last_updated: readFrontmatterDate(content),
    source_file: `CURRENT_STATE/${file}`,
  };
}

function computeFromIdeal(file: string): DimensionState {
  const path = join(IDEAL_DIR, file);
  if (!existsSync(path)) {
    return { pct: null, tbd_count: 0, last_updated: null, source_file: file };
  }
  const content = readFileSync(path, "utf-8");
  const tbd_count = (content.match(/\bTBD\b/g) || []).length;
  const pct = Math.max(0, Math.min(100, 100 - tbd_count * 10));
  return {
    pct,
    tbd_count,
    last_updated: readFrontmatterDate(content),
    source_file: `IDEAL_STATE/${file}`,
  };
}

function computeState(file: string): DimensionState {
  return computeFromCurrent(file) ?? computeFromIdeal(file);
}

function build(): LifeosState {
  const dimensions = {} as Record<DimensionId, DimensionState>;
  for (const d of DIMENSIONS) {
    dimensions[d.id] = computeState(d.file);
  }
  return {
    generated_at: new Date().toISOString(),
    dimensions,
  };
}

function main(): void {
  const state = build();
  const dir = dirname(STATE_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n");
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    console.log(`LIFEOS_STATE.json updated: ${STATE_FILE}`);
    for (const d of DIMENSIONS) {
      const s = state.dimensions[d.id];
      const pctStr = s.pct === null ? "—" : `${s.pct}%`;
      console.log(`  ${d.id.padEnd(14)} ${pctStr.padStart(5)}  (${s.tbd_count} TBDs, updated ${s.last_updated ?? "unknown"})`);
    }
  }
}

main();
