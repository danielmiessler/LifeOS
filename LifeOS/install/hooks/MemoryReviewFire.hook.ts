#!/usr/bin/env bun
/**
 * MemoryReviewFire — Stop hook that fires the Memory Reviewer when the
 * trigger hook has set pending_review = true.
 *
 * LifeOS autonomic memory subsystem, F4.
 *
 * Responsibilities:
 *   1. Read MEMORY/OBSERVABILITY/review-state.json
 *   2. If pending_review = true, spawn MemoryReviewer.ts subprocess in the
 *      background (don't block Stop)
 *   3. Reset state: turn_count=0, last_review_at=now, pending_review=false
 *
 * Until MemoryReviewer.ts ships (F5 in the build), this hook logs the fire
 * event to MEMORY/OBSERVABILITY/reviewer-fires.jsonl and resets state without
 * actually spawning a subprocess. Once F5 lands, this hook will attempt to
 * spawn the reviewer; if it's missing, it logs and continues (degraded mode).
 *
 * Failure mode: any error logs to stderr and exits 0 (never block Stop).
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, resolve as pathResolve } from "node:path";
import { getClaudeDir } from './lib/paths';

const CLAUDE_ROOT = getClaudeDir();
const STATE_PATH = pathResolve(CLAUDE_ROOT, "LIFEOS/MEMORY/OBSERVABILITY/review-state.json");
const FIRE_LOG_PATH = pathResolve(CLAUDE_ROOT, "LIFEOS/MEMORY/OBSERVABILITY/reviewer-fires.jsonl");
const REVIEWER_PATH = pathResolve(CLAUDE_ROOT, "LIFEOS/TOOLS/MemoryReviewer.ts");

interface ReviewState {
  turn_count_since_last_review: number;
  last_review_at: string | null;
  last_message_at: string | null;
  pending_review: boolean;
  schema_version: 1;
}

function loadState(): ReviewState | null {
  try {
    if (!existsSync(STATE_PATH)) return null;
    return JSON.parse(readFileSync(STATE_PATH, "utf8"));
  } catch {
    return null;
  }
}

function saveState(state: ReviewState): void {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  const tmp = `${STATE_PATH}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2) + "\n", "utf8");
  renameSync(tmp, STATE_PATH);
}

function logFire(payload: Record<string, unknown>): void {
  try {
    mkdirSync(dirname(FIRE_LOG_PATH), { recursive: true });
    appendFileSync(FIRE_LOG_PATH, JSON.stringify(payload) + "\n", "utf8");
  } catch {
    // Best-effort
  }
}

function spawnReviewer(turnsReviewed: number): { spawned: boolean; reason: string } {
  if (!existsSync(REVIEWER_PATH)) {
    return { spawned: false, reason: "reviewer-not-implemented-yet (F5 pending)" };
  }
  try {
    // Spawn detached so Stop hook returns immediately
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;
    delete env.ANTHROPIC_AUTH_TOKEN;
    delete env.CLAUDECODE;
    const proc = spawn("bun", [REVIEWER_PATH, "review", "--turns", String(turnsReviewed)], {
      env,
      stdio: "ignore",
      detached: true,
    });
    proc.unref();
    return { spawned: true, reason: `pid=${proc.pid}` };
  } catch (e) {
    return { spawned: false, reason: `spawn-failed: ${(e as Error)?.message || String(e)}` };
  }
}

function main(): void {
  try {
    const state = loadState();
    if (!state || !state.pending_review) {
      // Nothing to do
      process.exit(0);
    }

    const now = new Date().toISOString();
    const turnsReviewed = state.turn_count_since_last_review;

    const { spawned, reason } = spawnReviewer(turnsReviewed);

    logFire({
      ts: now,
      turns_since_last_review: turnsReviewed,
      spawned,
      reason,
    });

    const newState: ReviewState = {
      turn_count_since_last_review: 0,
      last_review_at: now,
      last_message_at: state.last_message_at,
      pending_review: false,
      schema_version: 1,
    };
    saveState(newState);
  } catch (e) {
    process.stderr.write(`MemoryReviewFire error: ${(e as Error)?.message || String(e)}\n`);
  }
  process.exit(0);
}

main();
