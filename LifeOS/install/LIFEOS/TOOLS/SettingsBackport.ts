#!/usr/bin/env bun

/**
 * SettingsBackport.ts — propagate direct edits on the GENERATED settings.json
 * back into the SOURCE overlay so SessionStart regeneration never steps on them.
 *
 * settings.json is a generated artifact: MergeSettings.ts merges
 * settings.system.json + settings.user.json at SessionStart. Any value edited
 * directly in settings.json is therefore wiped on the next merge. This tool
 * closes that loop: it diffs the live settings.json against the SNAPSHOT of
 * the last merge output (written by MergeSettings) and writes every divergent
 * value into settings.user.json (the overlay always wins conflicts, so a
 * backported value survives every future merge).
 *
 * Three-way base, not two-way: drift is computed against the last-merge
 * snapshot, NEVER against a freshly computed merge of the current sources.
 * Diffing against a fresh merge made un-merged SOURCE edits look like
 * settings.json drift and clobbered them back into the overlay (2026-07-11
 * hooks-BPE incident). With the snapshot base, source edits are invisible
 * here and flow through the MergeSettings run that follows. No snapshot on
 * disk → skip cleanly (never guess).
 *
 * Limits, stated loudly at runtime:
 *   - Key DELETIONS cannot be backported — the merge format has no delete
 *     annotation, so a key removed from settings.json but present in a source
 *     half will be resurrected at next SessionStart. The tool warns per key.
 *   - Arrays backport as whole-array replacements into the user overlay.
 *
 * Usage:
 *   bun SettingsBackport.ts            # default ~/.claude paths
 *   bun SettingsBackport.ts --dry-run  # report drift, write nothing
 */

import { writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { mergeSettings, deepEqual, parseJsonFileOrThrow, MERGE_SNAPSHOT_PATH } from "./MergeSettings";
import { claudeDir } from "./lifeos-root";

const CLAUDE_DIR = path.join(claudeDir());
const SYSTEM_PATH = path.join(CLAUDE_DIR, "settings.system.json");
const USER_PATH = path.join(CLAUDE_DIR, "LIFEOS", "USER", "CONFIG", "settings.user.json");
const GENERATED_PATH = path.join(CLAUDE_DIR, "settings.json");

type Drift =
  | { kind: "changed"; segments: string[]; value: any }
  | { kind: "deleted"; segments: string[] };

function isObjectRecord(value: any): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Walks expected (merge output) vs actual (live settings.json) and collects
 * the minimal set of paths whose ACTUAL value should be written to the user
 * overlay. Recurses only while both sides are plain objects; everything else
 * (scalars, arrays, type changes) backports as a whole-value replacement.
 */
export function collectDrift(expected: any, actual: any, segments: string[] = []): Drift[] {
  if (deepEqual(expected, actual)) {
    return [];
  }

  if (isObjectRecord(expected) && isObjectRecord(actual)) {
    const drift: Drift[] = [];
    for (const key of Object.keys(actual)) {
      const childSegments = [...segments, key];
      if (!Object.prototype.hasOwnProperty.call(expected, key)) {
        drift.push({ kind: "changed", segments: childSegments, value: actual[key] });
      } else {
        drift.push(...collectDrift(expected[key], actual[key], childSegments));
      }
    }
    for (const key of Object.keys(expected)) {
      if (!Object.prototype.hasOwnProperty.call(actual, key)) {
        drift.push({ kind: "deleted", segments: [...segments, key] });
      }
    }
    return drift;
  }

  return [{ kind: "changed", segments, value: actual }];
}

/** Deep-set a value into an object, creating intermediate objects as needed. */
export function deepSet(target: Record<string, any>, segments: string[], value: any): void {
  let cursor = target;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const key = segments[i];
    if (!isObjectRecord(cursor[key])) {
      cursor[key] = {};
    }
    cursor = cursor[key];
  }
  cursor[segments[segments.length - 1]] = value;
}

function formatPath(segments: string[]): string {
  return `$.${segments.join(".")}`;
}

/** Deep-read a value at a path; undefined when any segment is missing. */
function getAtPath(target: any, segments: string[]): any {
  let cursor = target;
  for (const key of segments) {
    if (!isObjectRecord(cursor)) return undefined;
    cursor = cursor[key];
  }
  return cursor;
}

async function run(dryRun: boolean): Promise<number> {
  const system = await parseJsonFileOrThrow(SYSTEM_PATH);
  const user = await parseJsonFileOrThrow(USER_PATH);
  const actual = await parseJsonFileOrThrow(GENERATED_PATH);

  // Three-way base: the last merge output. Without it we cannot distinguish
  // "user edited settings.json" from "sources changed since the last merge",
  // so we skip rather than risk backporting stale generated values.
  if (!existsSync(MERGE_SNAPSHOT_PATH)) {
    console.log(
      `no merge snapshot at ${MERGE_SNAPSHOT_PATH} — skipping backport (next MergeSettings run writes it)`,
    );
    return 0;
  }
  const snapshot = await parseJsonFileOrThrow(MERGE_SNAPSHOT_PATH);

  const drift = collectDrift(snapshot, actual);

  if (drift.length === 0) {
    console.log("settings.json matches the last merge snapshot — nothing to backport");
    return 0;
  }

  const changes = drift.filter((d): d is Extract<Drift, { kind: "changed" }> => d.kind === "changed");
  const deletions = drift.filter((d) => d.kind === "deleted");

  for (const d of deletions) {
    console.error(
      `⚠️  ${formatPath(d.segments)} was DELETED in settings.json but exists in a source half — ` +
        `deletions cannot be backported; remove it from settings.system.json or settings.user.json by hand.`,
    );
  }

  if (changes.length === 0) {
    return deletions.length > 0 ? 1 : 0;
  }

  for (const d of changes) {
    console.log(`backport ${formatPath(d.segments)} = ${JSON.stringify(d.value)}`);
  }

  if (dryRun) {
    console.log(`dry run: ${changes.length} change(s) NOT written`);
    return 0;
  }

  for (const d of changes) {
    deepSet(user, d.segments, d.value);
  }
  await writeFile(USER_PATH, `${JSON.stringify(user, null, 2)}\n`, "utf8");
  console.log(`wrote ${changes.length} change(s) to ${USER_PATH}`);

  // Verify per backported path: each value must survive the merge (overlay
  // wins conflicts). A global merge-vs-actual compare is wrong under the
  // three-way base — un-merged SOURCE edits legitimately differ from the live
  // file and are resolved by the MergeSettings run that follows.
  const verified = mergeSettings(system, user);
  const remaining = changes.filter((d) => !deepEqual(getAtPath(verified, d.segments), d.value));
  if (remaining.length > 0) {
    console.error(`❌ verification failed — ${remaining.length} backported value(s) did not survive the merge:`);
    for (const d of remaining) {
      console.error(`   ${formatPath(d.segments)}`);
    }
    return 1;
  }
  console.log("verified: every backported value survives merge(system, user)");
  return 0;
}

if (import.meta.main) {
  const dryRun = Bun.argv.includes("--dry-run");
  // Fresh-install guard (audit 20260702 F-001): the system+user settings layer only
  // exists once established. A fresh skill-only install has no root settings.system.json
  // (it is placed AS settings.json) and no settings.user.json yet — nothing to backport.
  // No-op cleanly instead of throwing on the missing input.
  if (!existsSync(SYSTEM_PATH) || !existsSync(USER_PATH)) {
    console.log("settings-layer not present (no settings.system.json / settings.user.json) — nothing to backport");
    process.exit(0);
  }
  try {
    process.exit(await run(dryRun));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
