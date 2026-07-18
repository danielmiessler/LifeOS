#!/usr/bin/env bun
/**
 * SessionRename — rename a session in work.json and session-names.json.
 *
 * Sessions are auto-named from the first prompt verbatim (truncated) at
 * creation time. That slug becomes the directory name and the JSON key; it
 * never updates retroactively when the conversation pivots topics. This CLI
 * lets the principal (or {{DA_NAME}}, on demand) clean up a session label without
 * touching the slug, the ISA path, the work directory, or the JSONL history.
 *
 * What gets updated:
 *   - work.json row's `sessionName` field (the human-readable label that
 *     Pulse Agents and `kai status` surface)
 *   - session-names.json entry for the session UUID (the per-UUID label that
 *     ContextSearch and the Pulse history view use)
 *
 * What does NOT change:
 *   - The slug (work.json key, directory name) — keeping it stable means
 *     resume links, ContextSearch hits, and ISA paths all keep working.
 *   - The first-prompt `task` field — that's the original utterance and a
 *     useful audit trail.
 *
 * Lookup precedence (any one of these wins; first match):
 *   1. positional <slug>             — exact key match in work.json
 *   2. --uuid <uuid>                  — sessionUUID field match
 *   3. --latest                       — most-recently-updated row
 *
 * CLI:
 *   bun SessionRename.ts <slug> "<new name>"
 *   bun SessionRename.ts --uuid <uuid> "<new name>"
 *   bun SessionRename.ts --latest "<new name>"
 *   bun SessionRename.ts --json <slug> "<new name>"   (machine-readable output)
 *   bun SessionRename.ts list                          (show 10 most-recent sessions)
 */

import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve as pathResolve, join as pathJoin } from "node:path";
import { homedir } from "node:os";
// Registry access goes through the isa-utils choke point (2026-06-10) — the
// event-sourced write path. This file previously carried a duplicate
// tmp+rename implementation; that was the one writer outside writeRegistry.
import { readRegistry, writeRegistry } from "../../hooks/lib/isa-utils";
import { claudeDir } from "./lifeos-root";

const CLAUDE_ROOT = pathResolve(claudeDir());
const SESSION_NAMES_JSON = pathJoin(CLAUDE_ROOT, "LIFEOS/MEMORY/STATE/session-names.json");

interface WorkSession {
  task?: string;
  sessionUUID?: string;
  sessionName?: string;
  phase?: string;
  updatedAt?: string;
  started?: string;
  [k: string]: unknown;
}

interface WorkRegistry {
  sessions: Record<string, WorkSession>;
}

function loadWork(): WorkRegistry {
  return readRegistry() as WorkRegistry;
}

function writeWork(reg: WorkRegistry): void {
  writeRegistry(reg as { sessions: Record<string, any> }, "SessionRename");
}

function loadNames(): Record<string, string> {
  if (!existsSync(SESSION_NAMES_JSON)) return {};
  try {
    return JSON.parse(readFileSync(SESSION_NAMES_JSON, "utf8")) as Record<string, string>;
  } catch {
    return {};
  }
}

function writeNames(names: Record<string, string>): void {
  const tmp = `${SESSION_NAMES_JSON}.tmp`;
  writeFileSync(tmp, JSON.stringify(names, null, 2), "utf8");
  renameSync(tmp, SESSION_NAMES_JSON);
}

function findBySlug(reg: WorkRegistry, slug: string): { slug: string; session: WorkSession } | null {
  if (reg.sessions[slug]) return { slug, session: reg.sessions[slug] };
  return null;
}

function findByUuid(reg: WorkRegistry, uuid: string): { slug: string; session: WorkSession } | null {
  for (const [slug, session] of Object.entries(reg.sessions)) {
    if (session.sessionUUID === uuid) return { slug, session };
  }
  return null;
}

function findLatest(reg: WorkRegistry): { slug: string; session: WorkSession } | null {
  let winner: { slug: string; session: WorkSession; ms: number } | null = null;
  for (const [slug, session] of Object.entries(reg.sessions)) {
    const ts = session.updatedAt ?? session.started;
    if (!ts) continue;
    const ms = Date.parse(typeof ts === "string" ? ts : String(ts));
    if (Number.isNaN(ms)) continue;
    if (!winner || ms > winner.ms) winner = { slug, session, ms };
  }
  return winner ? { slug: winner.slug, session: winner.session } : null;
}

interface RenameResult {
  ok: boolean;
  slug?: string;
  sessionUUID?: string;
  previousName?: string;
  newName?: string;
  workJsonUpdated?: boolean;
  sessionNamesUpdated?: boolean;
  error?: string;
}

function renameSession(target: { slug: string; session: WorkSession }, newName: string): RenameResult {
  const reg = loadWork();
  const row = reg.sessions[target.slug];
  if (!row) return { ok: false, error: `slug ${target.slug} disappeared between lookup and write` };

  const previousName = row.sessionName ?? row.task ?? target.slug;
  row.sessionName = newName;
  writeWork(reg);

  // Also update session-names.json if the row carries a sessionUUID
  let sessionNamesUpdated = false;
  if (row.sessionUUID) {
    const names = loadNames();
    names[row.sessionUUID] = newName;
    writeNames(names);
    sessionNamesUpdated = true;
  }

  return {
    ok: true,
    slug: target.slug,
    sessionUUID: row.sessionUUID,
    previousName,
    newName,
    workJsonUpdated: true,
    sessionNamesUpdated,
  };
}

function usage(): void {
  process.stderr.write(`SessionRename — rename a session label

Usage:
  bun SessionRename.ts <slug> "<new name>"
  bun SessionRename.ts --uuid <uuid> "<new name>"
  bun SessionRename.ts --latest "<new name>"
  bun SessionRename.ts list

Options:
  --json    Emit machine-readable JSON to stdout
`);
}

function listRecent(jsonOut: boolean): number {
  const reg = loadWork();
  const rows = Object.entries(reg.sessions)
    .map(([slug, session]) => {
      const ts = session.updatedAt ?? session.started ?? "";
      const ms = Date.parse(String(ts));
      return {
        slug,
        sessionUUID: session.sessionUUID ?? null,
        sessionName: session.sessionName ?? null,
        task: session.task ?? null,
        phase: session.phase ?? null,
        updatedAt: typeof ts === "string" ? ts : String(ts),
        ms: Number.isNaN(ms) ? 0 : ms,
      };
    })
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 10);

  if (jsonOut) {
    process.stdout.write(JSON.stringify(rows.map((r) => { const { ms: _, ...rest } = r; return rest; }), null, 2) + "\n");
    return 0;
  }

  process.stdout.write("Most-recent sessions:\n\n");
  for (const r of rows) {
    const label = r.sessionName ?? "(unnamed)";
    const task = (r.task ?? "").slice(0, 60);
    process.stdout.write(`  ${r.slug}\n    name: ${label}\n    task: ${task}${(r.task ?? "").length > 60 ? "…" : ""}\n    phase: ${r.phase ?? "n/a"} · updated: ${r.updatedAt}\n\n`);
  }
  return 0;
}

function main(): number {
  const argv = process.argv.slice(2);
  const jsonOut = argv.includes("--json");
  const args = argv.filter((a) => a !== "--json");

  if (args.length === 0) { usage(); return 2; }

  if (args[0] === "list") return listRecent(jsonOut);

  const reg = loadWork();
  let target: { slug: string; session: WorkSession } | null = null;
  let newName: string | null = null;

  if (args[0] === "--uuid") {
    if (args.length < 3) { usage(); return 2; }
    target = findByUuid(reg, args[1]);
    if (!target) { process.stderr.write(`ERR: no session with sessionUUID=${args[1]}\n`); return 1; }
    newName = args.slice(2).join(" ");
  } else if (args[0] === "--latest") {
    if (args.length < 2) { usage(); return 2; }
    target = findLatest(reg);
    if (!target) { process.stderr.write("ERR: no sessions found in work.json\n"); return 1; }
    newName = args.slice(1).join(" ");
  } else {
    if (args.length < 2) { usage(); return 2; }
    target = findBySlug(reg, args[0]);
    if (!target) { process.stderr.write(`ERR: no session with slug=${args[0]}\n`); return 1; }
    newName = args.slice(1).join(" ");
  }

  newName = newName.trim();
  if (!newName) { process.stderr.write("ERR: new name is empty\n"); return 2; }
  if (newName.length > 120) { process.stderr.write(`ERR: new name too long (${newName.length} chars, max 120)\n`); return 2; }

  const result = renameSession(target, newName);

  if (jsonOut) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    return result.ok ? 0 : 1;
  }

  if (!result.ok) {
    process.stderr.write(`ERR: ${result.error}\n`);
    return 1;
  }

  process.stdout.write(`✓ Renamed ${result.slug}\n  ${result.previousName} → ${result.newName}\n  work.json: ✓ session-names.json: ${result.sessionNamesUpdated ? "✓" : "skipped (no sessionUUID)"}\n`);
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
