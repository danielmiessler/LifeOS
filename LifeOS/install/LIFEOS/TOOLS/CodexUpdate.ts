#!/usr/bin/env bun
/**
 * CodexUpdate.ts — Keep the OpenAI Codex CLI current.
 *
 *   bun ~/.claude/LIFEOS/TOOLS/CodexUpdate.ts            # update to @latest
 *   bun ~/.claude/LIFEOS/TOOLS/CodexUpdate.ts --check    # report versions only
 *
 * codex is the agentic runtime behind the cross-vendor GPT-5.5 agents (Forge,
 * the researchers). It's a Bun global (`@openai/codex`), so "stay updated" means
 * `bun install -g @openai/codex@latest` on a cadence. The com.lifeos.codexupdate
 * launchd agent runs this daily; see InstallCodexUpdate.ts.
 *
 * Logs every run (version transition + result) to
 * MEMORY/OBSERVABILITY/codex-update.jsonl so a silent breakage from a bad
 * upstream release is traceable to the exact version bump.
 */

import { spawnSync } from "child_process";
import { appendFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { getClaudeDir } from "./Paths";

const PKG = "@openai/codex";
const LOG = join(getClaudeDir(), "LIFEOS", "MEMORY", "OBSERVABILITY", "codex-update.jsonl");

function codexVersion(): string | null {
  const r = spawnSync("codex", ["--version"], { encoding: "utf-8" });
  if (r.status !== 0 || !r.stdout) return null;
  // "codex-cli 0.137.0" → "0.137.0"
  const m = r.stdout.trim().match(/(\d+\.\d+\.\d+\S*)/);
  return m ? m[1] : r.stdout.trim();
}

function logEvent(event: Record<string, unknown>): void {
  try {
    mkdirSync(dirname(LOG), { recursive: true });
    appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), ...event }) + "\n");
  } catch { /* logging is best-effort */ }
}

function main(): void {
  const checkOnly = process.argv.includes("--check");
  const before = codexVersion();

  if (checkOnly) {
    console.log(`codex current: ${before ?? "NOT INSTALLED"}`);
    logEvent({ action: "check", version: before });
    return;
  }

  console.log(`[CodexUpdate] current: ${before ?? "not installed"} — installing ${PKG}@latest`);
  const r = spawnSync("bun", ["install", "-g", `${PKG}@latest`], { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);

  if (r.status !== 0) {
    console.error(`[CodexUpdate] FAILED (exit ${r.status})`);
    logEvent({ action: "update", from: before, ok: false, exit: r.status, error: (r.stderr || "").slice(0, 500) });
    process.exit(1);
  }

  const after = codexVersion();
  const changed = before !== after;
  console.log(`[CodexUpdate] ${changed ? `updated ${before} → ${after}` : `already current (${after})`}`);
  logEvent({ action: "update", from: before, to: after, changed, ok: true });
}

if (import.meta.main) main();
