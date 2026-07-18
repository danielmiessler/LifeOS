#!/usr/bin/env bun
/**
 * KnowledgeLint — validates the Knowledge Archive against the kb-v3 contract
 * (KnowledgeSchema.ts). This is Karpathy's "Lint" step, made real: it reports
 * non-conformant notes (missing required fields, un-migrated dialects,
 * off-vocabulary relation types, type↔dir mismatch, name-instead-of-title) so
 * the three-dialect drift becomes visible and can't silently recur.
 *
 * Report-only (never edits). Wire it as a write-time hook and a periodic sweep;
 * `MigrateKnowledge.ts` is what fixes what this finds.
 *
 * CLI:
 *   bun KnowledgeLint.ts                # human summary: conformance % + top violations
 *   bun KnowledgeLint.ts --json         # machine-readable
 *   bun KnowledgeLint.ts --list 40      # list up to 40 non-conformant notes
 *   bun KnowledgeLint.ts --dir Research # limit to one dir
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve as pathResolve, join as pathJoin } from "node:path";
import { homedir } from "node:os";
import { parseNote, validate, DIR_TO_TYPE, ALL_DIRS, slugFromPath, SCHEMA_VERSION, type CanonicalType } from "./KnowledgeSchema";
import { claudeDir } from "./lifeos-root";

const KNOWLEDGE_DIR = pathResolve(claudeDir(), "LIFEOS/MEMORY/KNOWLEDGE");
const DIRS = ALL_DIRS;

function listNotes(dir: string): string[] {
  const abs = pathJoin(KNOWLEDGE_DIR, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs)
    .filter((f) => f.endsWith(".md") && !f.startsWith("_") && f !== "README.md")
    .map((f) => pathJoin(abs, f));
}

function main() {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const listIdx = args.indexOf("--list");
  const listN = listIdx >= 0 ? parseInt(args[listIdx + 1] || "20", 10) : 0;
  const dirIdx = args.indexOf("--dir");
  const onlyDir = dirIdx >= 0 ? args[dirIdx + 1] : null;
  const dirs = onlyDir ? [onlyDir] : [...DIRS];

  // Two axes (Forge #7 / Advisor): ENVELOPE conformance = the schema is applied
  // correctly (should reach ~100%); COMPLETENESS = per-type source fields the
  // note genuinely lacks (e.g. a research note with no source_url) — an honest
  // enrichment gap, not a schema failure. A permanently-red single number would
  // read as noise; splitting keeps the envelope signal clean.
  const isCompleteness = (problem: string) => problem.startsWith("required for type");

  let total = 0, fullyConformant = 0, envelopeConformant = 0, completenessGaps = 0;
  const problemHistogram = new Map<string, number>();
  const nonConformant: { path: string; violations: string[] }[] = [];
  const perDir = new Map<string, { total: number; ok: number }>();

  for (const dir of dirs) {
    const dd = { total: 0, ok: 0 };
    for (const path of listNotes(dir)) {
      total++; dd.total++;
      const parsed = parseNote(readFileSync(path, "utf8"));
      const dirType = DIR_TO_TYPE[dir] as CanonicalType;
      const viols = validate(parsed, slugFromPath(path), dirType);
      const envelopeViols = viols.filter((v) => !isCompleteness(v.problem));
      if (viols.length === 0) { fullyConformant++; dd.ok++; }
      if (envelopeViols.length === 0) envelopeConformant++;
      if (viols.some((v) => isCompleteness(v.problem))) completenessGaps++;
      if (viols.length > 0) {
        nonConformant.push({ path: path.replace(KNOWLEDGE_DIR + "/", ""), violations: viols.map((v) => `${v.key}: ${v.problem}`) });
        for (const v of viols) {
          const key = `${v.key} — ${v.problem.replace(/"[^"]*"/g, '"…"')}`;
          problemHistogram.set(key, (problemHistogram.get(key) ?? 0) + 1);
        }
      }
    }
    perDir.set(dir, dd);
  }

  const conformant = fullyConformant;
  const pct = total ? ((fullyConformant / total) * 100).toFixed(1) : "0";
  const envPct = total ? ((envelopeConformant / total) * 100).toFixed(1) : "0";

  if (json) {
    console.log(JSON.stringify({
      schema_version: SCHEMA_VERSION, total,
      fully_conformant: fullyConformant, conformance_pct: Number(pct),
      envelope_conformant: envelopeConformant, envelope_pct: Number(envPct),
      completeness_gaps: completenessGaps,
      per_dir: Object.fromEntries([...perDir.entries()].map(([d, v]) => [d, v])),
      top_problems: [...problemHistogram.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20),
    }, null, 2));
    process.exit(0);
  }

  console.log(`\n${"=".repeat(64)}`);
  console.log(`  KnowledgeLint — conformance to ${SCHEMA_VERSION}`);
  console.log(`${"=".repeat(64)}`);
  console.log(`  Notes:              ${total}`);
  console.log(`  Envelope-conformant: ${envelopeConformant}  (${envPct}%)   ← schema applied correctly`);
  console.log(`  Fully conformant:    ${conformant}  (${pct}%)   ← incl. per-type source fields`);
  console.log(`  Completeness gaps:   ${completenessGaps} notes miss an optional per-type source field (enrichment, not a schema failure)`);
  console.log(`\n  Per-dir conformance:`);
  for (const [d, v] of perDir) {
    const p = v.total ? ((v.ok / v.total) * 100).toFixed(0) : "0";
    console.log(`    ${d.padEnd(11)} ${String(v.ok).padStart(5)}/${String(v.total).padStart(5)}  (${p}%)`);
  }
  console.log(`\n  Top violation types:`);
  for (const [k, n] of [...problemHistogram.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`    ${String(n).padStart(5)}  ${k}`);
  }
  if (listN > 0) {
    console.log(`\n  Non-conformant notes (first ${listN}):`);
    for (const nc of nonConformant.slice(0, listN)) {
      console.log(`    ${nc.path}\n        ${nc.violations.join(" · ")}`);
    }
  }
  console.log("");
  process.exit(0);
}

main();
