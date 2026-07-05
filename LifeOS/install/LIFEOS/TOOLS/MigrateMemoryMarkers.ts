#!/usr/bin/env bun
/**
 * MigrateMemoryMarkers — one-time repair for hot-layer memory files scaffolded
 * before the entry markers existed, or corrupted by the pre-fix writer (which
 * re-added END but never BEGIN, leaving stray END markers and no readable
 * entry block). Existing installs would otherwise stay silently empty to the
 * reader until the next reviewer write; this heals them immediately on update.
 *
 * Idempotent: files already in canonical <!-- BEGIN ENTRIES -->…<!-- END ENTRIES -->
 * shape are left untouched. Reuses the fixed read()/setEntries() path, so entry
 * recovery is exactly the behavior covered by MemoryWriter.markers.test.ts.
 *
 * Usage:
 *   bun ~/.claude/LIFEOS/TOOLS/MigrateMemoryMarkers.ts
 *   bun ~/.claude/LIFEOS/TOOLS/MigrateMemoryMarkers.ts --dry-run
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { PRINCIPAL_MEMORY_PATH, DA_MEMORY_PATH } from "./MemoryTypes";
import { read, setEntries } from "./MemoryWriter";

const BEGIN_MARKER = "<!-- BEGIN ENTRIES -->";
const END_MARKER = "<!-- END ENTRIES -->";
const TARGETS = [PRINCIPAL_MEMORY_PATH, DA_MEMORY_PATH];

/** Canonical = exactly one BEGIN and one END, in order. Anything else needs repair. */
function isCanonical(content: string): boolean {
  const begins = (content.match(/<!-- BEGIN ENTRIES -->/g) || []).length;
  const ends = (content.match(/<!-- END ENTRIES -->/g) || []).length;
  return begins === 1 && ends === 1 && content.indexOf(BEGIN_MARKER) < content.indexOf(END_MARKER);
}

interface Result { path: string; action: string; detail: string; }

function repair(path: string, dryRun: boolean): Result {
  if (!existsSync(path)) {
    return { path, action: "skip-missing", detail: "no file (a fresh install scaffolds it correctly)" };
  }
  const content = readFileSync(path, "utf8");
  if (isCanonical(content)) {
    return { path, action: "skip-ok", detail: "already has a canonical BEGIN…END block" };
  }
  // read() (post-fix) recovers orphaned entries from the broken body.
  const r = read(path);
  if (!("entries" in r)) {
    return { path, action: "error", detail: `read failed: ${(r as any).message ?? "unknown"}` };
  }
  const recovered = r.entries;
  if (dryRun) {
    return { path, action: "would-repair", detail: `${recovered.length} entr${recovered.length === 1 ? "y" : "ies"} recoverable` };
  }
  // Back up the pre-repair file next to it (repo convention: Backups/).
  const backupDir = join(dirname(path), "Backups");
  if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  writeFileSync(join(backupDir, `${basename(path, ".md")}-pre-marker-migration-${stamp}.md`), content);

  // setEntries rewrites a canonical block (serializeFile re-emits BEGIN…END).
  const res = setEntries(path, recovered, { updatedBy: "MigrateMemoryMarkers", allowDrastic: true });
  if (!res.ok) {
    return { path, action: "error", detail: `setEntries failed: ${res.code} ${res.message}` };
  }
  return { path, action: "repaired", detail: `recovered ${recovered.length} entr${recovered.length === 1 ? "y" : "ies"} into a canonical block` };
}

function main(): void {
  const dryRun = process.argv.includes("--dry-run");
  const results = TARGETS.map((p) => repair(p, dryRun));
  console.log(`MigrateMemoryMarkers${dryRun ? " (dry-run)" : ""}`);
  for (const res of results) {
    console.log(`  ${res.action.padEnd(14)} ${basename(dirname(res.path))}/${basename(res.path)} — ${res.detail}`);
  }
  const repaired = results.filter((r) => r.action === "repaired" || r.action === "would-repair").length;
  const errored = results.filter((r) => r.action === "error").length;
  console.log(`\n${repaired} repaired, ${results.length - repaired - errored} already-ok/skipped, ${errored} error(s).`);
  process.exit(errored > 0 ? 1 : 0);
}

main();
