#!/usr/bin/env bun
/**
 * PurgeArchives.ts — delete expired archived versions inside an archive directory.
 *
 * POLICY. A manual archive is a grace window, not forever. A file older than N days
 * (default 14) is deleted, UNLESS its name starts with `KEEP-`, which is an explicit
 * "hold this" signal. Silence means it goes after N days; `KEEP-` means it stays.
 * The trigger is lazy: call it right after archiving a new version by hand, so the
 * directory prunes itself as a side effect of being used, with no scheduler.
 *
 * FAIL-CLOSED DIRECTORY GUARD — this is the part that makes it safe to point at
 * anything. It refuses any directory whose basename is not exactly the sentinel
 * (`_archive` by default, `--dir-name` to change it). A tool that deletes by age
 * is one bad argument away from deleting live work, so the guard is not "check the
 * path looks plausible": the directory has to be NAMED as an archive, which is a
 * property no working directory acquires by accident.
 *
 * It also only ever deletes FILES (never subdirectories), skips dotfiles, logs every
 * action, and touches nothing at all under `--dry-run`.
 *
 * USAGE  bun LIFEOS/TOOLS/PurgeArchives.ts <dir> [--days N] [--dir-name NAME] [--dry-run]
 * EXIT   0 = ok (including when nothing was deleted) · 1 = usage error or guard refusal
 */
import { readdirSync, statSync, unlinkSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const DAY = 86_400_000;
const DEFAULT_DAYS = 14;
const DEFAULT_DIR_NAME = "_archive";

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const dir = argv.find((a) => !a.startsWith("--"));

/** Reads `--flag value` and `--flag=value` alike. */
function flag(name: string): string | undefined {
  const i = argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i < 0) return undefined;
  return argv[i].includes("=") ? argv[i].split("=").slice(1).join("=") : argv[i + 1];
}

const rawDays = flag("days");
const days = rawDays === undefined ? DEFAULT_DAYS : Number(rawDays);
const dirName = flag("dir-name") ?? DEFAULT_DIR_NAME;

if (!dir) {
  console.error("usage: PurgeArchives.ts <dir> [--days N] [--dir-name NAME] [--dry-run]");
  process.exit(1);
}
if (!Number.isFinite(days) || days < 0) {
  console.error(`invalid --days: ${rawDays ?? ""}`);
  process.exit(1);
}
if (!dirName) {
  console.error("--dir-name cannot be empty: the sentinel name IS the safety guard");
  process.exit(1);
}

const abs = resolve(dir);

// Fail-closed: archive directories only, never a directory of live files.
if (basename(abs) !== dirName) {
  console.error(`REFUSED: "${abs}" is not a ${dirName} directory. I do not touch directories of live files.`);
  process.exit(1);
}

let entries: string[];
try {
  entries = readdirSync(abs);
} catch (e) {
  console.error(`directory not readable: ${abs} (${e})`);
  process.exit(1);
}

const now = Date.now();
const cutoff = now - days * DAY;
let removed = 0;
let kept = 0;
let fresh = 0;

for (const name of entries) {
  if (name.startsWith(".")) continue; // dotfiles (logs, .DS_Store): never touched
  const p = join(abs, name);
  let st;
  try {
    st = statSync(p);
  } catch {
    continue;
  }
  if (!st.isFile()) continue; // never subdirectories
  if (name.startsWith("KEEP-")) {
    kept++;
    continue;
  }
  if (st.mtimeMs > cutoff) {
    fresh++;
    continue;
  }

  const ageDays = Math.floor((now - st.mtimeMs) / DAY);
  if (dryRun) {
    console.log(`[dry-run] would delete  ${name}  (${ageDays}d)`);
    removed++;
    continue;
  }
  try {
    unlinkSync(p);
    console.log(`deleted  ${name}  (${ageDays}d)`);
    removed++;
  } catch (e) {
    console.error(`failed on ${name}: ${e}`);
  }
}

const tag = dryRun ? "[dry-run] " : "";
console.log(`${tag}${abs}`);
console.log(
  `${tag}threshold ${days}d -> ${removed} ${dryRun ? "to remove" : "removed"}, ${kept} held (KEEP-), ${fresh} still fresh`,
);
