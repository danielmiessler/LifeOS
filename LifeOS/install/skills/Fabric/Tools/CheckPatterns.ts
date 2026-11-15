#!/usr/bin/env bun
/**
 * CheckPatterns.ts — deterministic checks on the Fabric skill's Patterns/ library.
 *
 *   bun skills/Fabric/Tools/CheckPatterns.ts [--upstream <fabric>/data/patterns]
 *       [--scan-before <before.json> --scan-after <after.json>] [--json]
 *
 * Always: each key pattern has a system.md, and Patterns/catalog.yaml is current (PatternCatalog.ts check:
 *   every pattern directory has an entry whose system_md_hash matches its system.md).
 * --upstream: every upstream pattern exists locally (fails when one is missing);
 *   names present locally but absent upstream are reported, never failed or deleted.
 * --scan-before/--scan-after: two `scan.ts <dir> --json` outputs taken before and after
 *   a sync; fails when the after-run holds a finding (file, class, rule) the before-run
 *   lacked, which is how a sync that undid a release scrub shows up.
 *
 * Read-only. Exit 0 = pass, 1 = a check failed, 2 = usage.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { checkCatalog } from "./PatternCatalog";

export const KEY_PATTERNS = ["extract_wisdom", "summarize", "create_threat_model", "analyze_claims"];
const PATTERNS_DIR = resolve(import.meta.dir, "..", "Patterns");

const patternNames = (dir: string): string[] =>
  readdirSync(dir).filter((n) => !n.startsWith(".") && statSync(join(dir, n)).isDirectory()).sort();

interface ScanFinding { file: string; class: string; ruleSource: string; excerptRedacted?: string }
const findingKeys = (path: string): Map<string, ScanFinding> => {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as { findings?: ScanFinding[] };
  if (!Array.isArray(parsed.findings)) throw new Error(`${path} has no findings array`);
  return new Map(parsed.findings.map((f) => [`${f.file}|${f.class}|${f.ruleSource}`, f]));
};

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (name: string): string | undefined => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const upstream = opt("--upstream");
  const before = opt("--scan-before");
  const after = opt("--scan-after");
  if (args.includes("--help") || !!before !== !!after || (upstream !== undefined && !existsSync(upstream))) {
    console.error("usage: bun CheckPatterns.ts [--upstream <fabric>/data/patterns] [--scan-before <a.json> --scan-after <b.json>] [--json]");
    process.exit(2);
  }

  const local = patternNames(PATTERNS_DIR);
  const missingKey = KEY_PATTERNS.filter((p) => !existsSync(join(PATTERNS_DIR, p, "system.md")));
  let missingUpstream: string[] = [];
  let localOnly: string[] = [];
  if (upstream) {
    const up = new Set(patternNames(upstream));
    const have = new Set(local);
    missingUpstream = [...up].filter((n) => !have.has(n));
    localOnly = local.filter((n) => !up.has(n));
  }
  let newFindings: ScanFinding[] = [];
  if (before && after) {
    const b = findingKeys(before);
    newFindings = [...findingKeys(after)].filter(([k]) => !b.has(k)).map(([, f]) => f);
  }

  const catalog = checkCatalog(PATTERNS_DIR, join(PATTERNS_DIR, "catalog.yaml"));

  const ok = missingKey.length === 0 && missingUpstream.length === 0 && newFindings.length === 0 && catalog.ok;
  if (args.includes("--json")) {
    console.log(JSON.stringify({ ok, count: local.length, missingKey, missingUpstream, localOnly, newFindings, catalogProblems: catalog.problems }, null, 2));
  } else {
    console.log(`Patterns: ${local.length}`);
    for (const p of KEY_PATTERNS) console.log(missingKey.includes(p) ? `✗ ${p} MISSING` : `✓ ${p}`);
    if (catalog.ok) console.log(`✓ catalog.yaml current (${catalog.count} entries)`);
    else {
      console.log(`✗ catalog.yaml stale: ${catalog.problems.length} problem(s); rebuild with bun skills/Fabric/Tools/PatternCatalog.ts build`);
      for (const p of catalog.problems.slice(0, 20)) console.log(`  ${p}`);
    }
    if (upstream) {
      console.log(`Upstream patterns missing locally: ${missingUpstream.length ? missingUpstream.join(", ") : "none"}`);
      console.log(`Local-only patterns (kept; removal is the principal's call): ${localOnly.length ? localOnly.join(", ") : "none"}`);
    }
    if (before && after) {
      console.log(`New release-scan findings: ${newFindings.length}`);
      for (const f of newFindings) console.log(`  ✗ ${f.file} ${f.class} ${f.excerptRedacted ?? ""}`);
    }
  }
  process.exit(ok ? 0 : 1);
}
