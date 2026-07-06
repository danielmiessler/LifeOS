#!/usr/bin/env bun
/**
 * MemoryRestore — recover a hot-layer memory file from the per-write snapshot
 * ring that MemoryWriter maintains. set-overwrite has a whole-file blast radius;
 * this is the individual-write undo that git (commit-granularity) can't give.
 *
 *   bun MemoryRestore.ts list [principal|da]      — list snapshots, newest last
 *   bun MemoryRestore.ts restore <snapshot-file>  — byte-exact restore to target
 *   bun MemoryRestore.ts latest principal         — restore the newest snapshot
 *
 * Restore is a raw byte copy (frontmatter + entries + markers), so it cannot
 * itself trip the curation guards — it's a recovery path, not a curation write.
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve as pathResolve } from "node:path";
import { getClaudeDir } from "./Paths";

const CLAUDE_ROOT = getClaudeDir();
const SNAPSHOT_DIR = pathResolve(CLAUDE_ROOT, "LIFEOS/MEMORY/OBSERVABILITY/memory-snapshots");
const TARGETS: Record<string, string> = {
  principal: pathResolve(CLAUDE_ROOT, "LIFEOS/USER/PRINCIPAL/PRINCIPAL_MEMORY.md"),
  da: pathResolve(CLAUDE_ROOT, "LIFEOS/USER/DIGITAL_ASSISTANT/DA_MEMORY.md"),
};
const BASE: Record<string, string> = { principal: "PRINCIPAL_MEMORY", da: "DA_MEMORY" };

function snapshotsFor(which: string): string[] {
  if (!existsSync(SNAPSHOT_DIR)) return [];
  return readdirSync(SNAPSHOT_DIR)
    .filter((f: string) => f.startsWith(`${BASE[which]}__`))
    .sort();
}

function countEntries(content: string): number {
  const m = content.match(/<!-- BEGIN ENTRIES -->([\s\S]*?)<!-- END ENTRIES -->/);
  if (!m) return 0;
  return m[1].split("\n").map((l) => l.trim()).filter((l) => l.length > 0).length;
}

function main(): void {
  const [cmd, arg] = process.argv.slice(2);

  if (cmd === "list") {
    for (const which of arg ? [arg] : ["principal", "da"]) {
      const snaps = snapshotsFor(which);
      console.log(`\n${which} (${snaps.length} snapshots):`);
      for (const s of snaps) {
        const n = countEntries(readFileSync(pathResolve(SNAPSHOT_DIR, s), "utf8"));
        console.log(`  ${s}  [${n} entries]`);
      }
    }
    return;
  }

  if (cmd === "restore" && arg) {
    const src = pathResolve(SNAPSHOT_DIR, arg);
    if (!existsSync(src)) { console.error(`Snapshot not found: ${arg}`); process.exit(1); }
    const which = arg.startsWith("PRINCIPAL_MEMORY") ? "principal" : "da";
    const content = readFileSync(src, "utf8");
    writeFileSync(TARGETS[which], content, "utf8");
    console.log(`Restored ${which} from ${arg} (${countEntries(content)} entries).`);
    return;
  }

  if (cmd === "latest" && arg) {
    const snaps = snapshotsFor(arg);
    if (snaps.length === 0) { console.error(`No snapshots for ${arg}`); process.exit(1); }
    const latest = snaps[snaps.length - 1];
    const content = readFileSync(pathResolve(SNAPSHOT_DIR, latest), "utf8");
    writeFileSync(TARGETS[arg], content, "utf8");
    console.log(`Restored ${arg} from latest snapshot ${latest} (${countEntries(content)} entries).`);
    return;
  }

  console.error("Usage: bun MemoryRestore.ts {list [principal|da] | restore <snapshot-file> | latest <principal|da>}");
  process.exit(2);
}

main();
