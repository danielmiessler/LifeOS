#!/usr/bin/env bun
/**
 * CollectSignals — deterministic, read-only signal collector for skill-gap discovery.
 *
 * Emits a normalized corpus (JSON to stdout) so the LLM step only clusters and judges;
 * it never gathers. Run at a fixed point in time over unchanged stores, it is deterministic
 * (output ordering is fully tie-broken). Writes nothing.
 *
 * Paths are DISCOVERED, never hardcoded to a person's home. Resolution order per store:
 *   1. explicit CLI flag  2. env var  3. a conventional default under --root
 * An explicit flag pointing at a nonexistent path is reported (never silently replaced by a
 * default). Anything missing or malformed is reported in `warnings`/`missing`, never fatal.
 *
 * Usage:
 *   bun CollectSignals.ts [--root <dir>] [--days <n>] [--max-rating <n>]
 *                         [--ratings <file>] [--work <dir>] [--skills <dir>] [--loops <dir>]
 *   env: SKILLSCAN_MEMORY_ROOT, SKILLSCAN_RATINGS_FILE, SKILLSCAN_WORK_DIR,
 *        SKILLSCAN_SKILLS_DIR, SKILLSCAN_LOOPS_DIR
 *
 * Contract (stdout JSON):
 *   {
 *     window:       { days, since },
 *     sessions:     { slug, mtime }[],                              // recent work-session dirs (. and _ prefixed skipped as system dirs)
 *     frustrations: { date, rating, note }[],                       // low ratings + sentiment, sorted
 *     registries:   { kind: "skill"|"loop"|"workflow", name, description }[],  // for dedup; bodies read by the LLM step
 *     warnings:     string[],                                       // malformed rows, unreadable/oversized files (non-fatal)
 *     missing:      string[],                                       // stores that don't exist in this install
 *     sources:      Record<string,string>                          // resolved paths actually used
 *   }
 * Exit 0 even when stores are missing (a fresh install is a valid, empty corpus);
 * non-zero only on an unexpected internal error.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

const MAX_RATINGS_BYTES = 10_000_000; // guard against a huge/FIFO ratings store
const MAX_NOTE_CHARS = 500;

type Session = { slug: string; mtime: string };
type Frustration = { date: string; rating: number; note: string };
type RegistryEntry = { kind: "skill" | "loop" | "workflow"; name: string; description: string };
type Corpus = {
  window: { days: number; since: string };
  sessions: Session[];
  frustrations: Frustration[];
  registries: RegistryEntry[];
  warnings: string[];
  missing: string[];
  sources: Record<string, string>;
};

/** Value for `flag`, or undefined. A following token that is itself a flag (starts with "-") is NOT a value. */
function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i < 0 || i + 1 >= process.argv.length) return undefined;
  const v = process.argv[i + 1];
  return v.startsWith("-") ? undefined : v;
}

/** Strict integer flag, clamped to [min,max]; warns (never silently accepts garbage or out-of-range). */
function intArg(flag: string, dflt: number, min: number, max: number, warnings: string[]): number {
  const v = arg(flag);
  if (v === undefined) return dflt;
  if (!/^-?\d+$/.test(v)) { warnings.push(`${flag}: not an integer (${v}); using ${dflt}`); return dflt; }
  let n = Number.parseInt(v, 10);
  if (n < min) { warnings.push(`${flag}: ${n} below ${min}; clamped`); n = min; }
  else if (n > max) { warnings.push(`${flag}: ${n} above ${max}; clamped`); n = max; }
  return n;
}

/**
 * Resolve a store path: explicit flag > env var > default under root.
 * An explicit path that does not exist is a warning + null (never silently falls through to a default).
 * `defaultRel === null` means the store has no conventional default (opt-in only, e.g. loops).
 */
function resolveStore(
  explicit: string | undefined,
  envVar: string,
  defaultRel: string | null,
  root: string,
  label: string,
  warnings: string[],
): string | null {
  if (explicit !== undefined) {
    if (existsSync(explicit)) return explicit;
    warnings.push(`${label}: --${label} path ${explicit} does not exist`);
    return null;
  }
  const env = process.env[envVar];
  if (env && existsSync(env)) return env;
  if (defaultRel) { const d = join(root, defaultRel); if (existsSync(d)) return d; }
  return null;
}

function parseFrustrations(file: string | null, maxRating: number, since: Date, warnings: string[], missing: string[]): Frustration[] {
  if (!file) { missing.push("ratings"); return []; }
  try {
    const st = statSync(file);
    if (!st.isFile()) { warnings.push(`ratings: not a regular file`); return []; }
    if (st.size > MAX_RATINGS_BYTES) { warnings.push(`ratings: too large (${st.size} bytes), skipped`); return []; }
  } catch (e) { warnings.push(`ratings unreadable: ${(e as Error).message}`); return []; }

  let raw: string;
  try { raw = readFileSync(file, "utf8"); } catch (e) { warnings.push(`ratings unreadable: ${(e as Error).message}`); return []; }

  const out: Frustration[] = [];
  let bad = 0;
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    let j: unknown;
    try { j = JSON.parse(t); } catch { bad++; continue; }
    const r = j as Record<string, unknown>;
    const rating = typeof r.rating === "number" ? r.rating : NaN;
    const ts = typeof r.timestamp === "string" ? r.timestamp : "";
    if (!Number.isFinite(rating) || !ts) { bad++; continue; }
    if (rating > maxRating) continue;
    const ms = new Date(ts).getTime();
    if (Number.isNaN(ms)) { bad++; continue; } // unparseable timestamp = malformed, not "out of window"
    if (ms < since.getTime()) continue;
    const note = (typeof r.sentiment_summary === "string" ? r.sentiment_summary : "")
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .slice(0, MAX_NOTE_CHARS);
    out.push({ date: new Date(ms).toISOString().slice(0, 10), rating, note });
  }
  if (bad > 0) warnings.push(`ratings: skipped ${bad} malformed/incomplete line(s)`);
  return out.sort((a, b) => a.rating - b.rating || a.date.localeCompare(b.date) || a.note.localeCompare(b.note));
}

function collectSessions(dir: string | null, since: Date, warnings: string[], missing: string[]): Session[] {
  if (!dir) { missing.push("work-sessions"); return []; }
  let names: string[];
  try { names = readdirSync(dir); } catch (e) { warnings.push(`work dir unreadable: ${(e as Error).message}`); return []; }
  const out: Session[] = [];
  for (const name of names) {
    if (name.startsWith(".") || name.startsWith("_")) continue; // skip hidden / system dirs
    try {
      const st = statSync(join(dir, name));
      if (st.isDirectory() && st.mtime.getTime() >= since.getTime()) out.push({ slug: name, mtime: st.mtime.toISOString().slice(0, 10) });
    } catch { /* transient race on a dir entry — skip, don't fail the run */ }
  }
  return out.sort((a, b) => b.mtime.localeCompare(a.mtime) || a.slug.localeCompare(b.slug));
}

/**
 * name + description from a SKILL.md's YAML frontmatter block. Handles folded/block scalars
 * (`description: >` / `|`) by gathering the indented continuation lines. Returns null if there
 * is no frontmatter `name:`.
 */
function readMeta(skillMd: string): { name: string; description: string } | null {
  let txt: string;
  try { txt = readFileSync(skillMd, "utf8"); } catch { return null; }
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(txt);
  const block = fm ? fm[1] : txt;
  const name = /^name:\s*(.+)$/m.exec(block)?.[1]?.trim();
  if (!name) return null;

  let desc = /^description:\s*(.+)$/m.exec(block)?.[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
  if (/^[>|][+-]?\d*$/.test(desc)) { // block scalar indicator — gather indented continuation
    const lines = block.split("\n");
    const di = lines.findIndex((l) => /^description:\s*[>|]/.test(l));
    const cont: string[] = [];
    for (let k = di + 1; k < lines.length; k++) {
      if (/^\s+\S/.test(lines[k])) cont.push(lines[k].trim());
      else break;
    }
    desc = cont.join(" ");
  }
  return { name, description: desc };
}

function collectRegistries(skillsDir: string | null, loopsDir: string | null, warnings: string[], missing: string[]): RegistryEntry[] {
  const out: RegistryEntry[] = [];
  if (!skillsDir) { missing.push("skills"); }
  else {
    let dirs: string[] = [];
    try { dirs = readdirSync(skillsDir); } catch (e) { warnings.push(`skills dir unreadable: ${(e as Error).message}`); }
    for (const d of dirs) {
      const md = join(skillsDir, d, "SKILL.md");
      if (!existsSync(md)) continue;
      const meta = readMeta(md);
      if (!meta) { warnings.push(`skills: ${d}/SKILL.md unreadable or missing name:`); continue; }
      out.push({ kind: "skill", name: meta.name, description: meta.description });
      const wf = join(skillsDir, d, "Workflows"); // workflows are reusable coverage too
      if (existsSync(wf)) {
        try { for (const f of readdirSync(wf)) if (f.endsWith(".md")) out.push({ kind: "workflow", name: `${meta.name}/${basename(f, ".md")}`, description: "" }); } catch { /* skip */ }
      }
    }
  }
  if (loopsDir) {
    try { for (const f of readdirSync(loopsDir)) if (f.endsWith(".md")) out.push({ kind: "loop", name: basename(f, ".md"), description: "" }); }
    catch (e) { warnings.push(`loops dir unreadable: ${(e as Error).message}`); }
  }
  return out.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
}

function main(): void {
  const warnings: string[] = [];
  const missing: string[] = [];

  const root = arg("--root") ?? process.env.SKILLSCAN_MEMORY_ROOT ?? join(process.env.HOME ?? ".", ".claude");
  const days = intArg("--days", 45, 1, 3650, warnings);
  const maxRating = intArg("--max-rating", 4, 1, 10, warnings);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const ratingsFile = resolveStore(arg("--ratings"), "SKILLSCAN_RATINGS_FILE", "MEMORY/LEARNING/SIGNALS/ratings.jsonl", root, "ratings", warnings);
  const workDir = resolveStore(arg("--work"), "SKILLSCAN_WORK_DIR", "MEMORY/WORK", root, "work", warnings);
  const skillsDir = resolveStore(arg("--skills"), "SKILLSCAN_SKILLS_DIR", "skills", root, "skills", warnings);
  const loopsDir = resolveStore(arg("--loops"), "SKILLSCAN_LOOPS_DIR", null, root, "loops", warnings); // opt-in; no personal default

  const corpus: Corpus = {
    window: { days, since: since.toISOString().slice(0, 10) },
    sessions: collectSessions(workDir, since, warnings, missing),
    frustrations: parseFrustrations(ratingsFile, maxRating, since, warnings, missing),
    registries: collectRegistries(skillsDir, loopsDir, warnings, missing),
    warnings,
    missing,
    sources: {
      root,
      ratings: ratingsFile ?? "(none)",
      work: workDir ?? "(none)",
      skills: skillsDir ?? "(none)",
      loops: loopsDir ?? "(none)",
    },
  };

  process.stdout.write(JSON.stringify(corpus, null, 2) + "\n");
}

main();
