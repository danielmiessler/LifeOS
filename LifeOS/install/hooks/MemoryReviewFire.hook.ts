#!/usr/bin/env bun
/**
 * @version 2.0.1
 * MemoryReviewFire — Stop hook that owns the WHOLE memory-review cadence.
 *
 * Consolidation (2026-07-11, thinking-system BPE strip): the old design split
 * the cadence across two hooks — MemoryReviewTrigger (per-prompt: tick counter,
 * idle detection, pending_review flag, debounce-cancel) and this one (consume
 * the flag at Stop). Firing at Stop is already the quiet moment the idle/
 * debounce machinery approximated, so the handshake was scaffolding. Now:
 *
 *   On every primary-session Stop:
 *     1. turn_count += 1, last_message_at = now
 *     2. If turn_count >= turn_threshold AND minutes since last_review >=
 *        min_minutes_between → spawn MemoryReviewer.ts detached, reset.
 *
 * State schema is unchanged (review-state.json) — the statusline 🧠 MEM line
 * reads it directly every second; pending_review stays false forever.
 * Cadence parameters: LIFEOS/USER/CONFIG/memory-review.json.
 *
 * Failure mode: any error logs to stderr and exits 0 (never block Stop).
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, resolve as pathResolve } from "node:path";
import { homedir } from "node:os";
import { getClaudeDir } from "./lib/paths";

const CLAUDE_ROOT = pathResolve(getClaudeDir());
const STATE_PATH = pathResolve(CLAUDE_ROOT, "LIFEOS/MEMORY/OBSERVABILITY/review-state.json");
const CONFIG_PATH = pathResolve(CLAUDE_ROOT, "LIFEOS/USER/CONFIG/memory-review.json");
const FIRE_LOG_PATH = pathResolve(CLAUDE_ROOT, "LIFEOS/MEMORY/OBSERVABILITY/reviewer-fires.jsonl");
const REVIEWER_PATH = pathResolve(CLAUDE_ROOT, "LIFEOS/TOOLS/MemoryReviewer.ts");

interface ReviewState {
  turn_count_since_last_review: number;
  last_review_at: string | null;
  last_message_at: string | null;
  pending_review: boolean; // kept for statusline schema compat; always false now
  schema_version: 1;
}

const INITIAL_STATE: ReviewState = {
  turn_count_since_last_review: 0,
  last_review_at: null,
  last_message_at: null,
  pending_review: false,
  schema_version: 1,
};

function loadConfig(): { turn_threshold: number; min_minutes_between: number } {
  const fallback = { turn_threshold: 8, min_minutes_between: 30 };
  try {
    if (!existsSync(CONFIG_PATH)) return fallback;
    const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
    return {
      turn_threshold: typeof raw.turn_threshold === "number" ? raw.turn_threshold : fallback.turn_threshold,
      min_minutes_between: typeof raw.min_minutes_between === "number" ? raw.min_minutes_between : fallback.min_minutes_between,
    };
  } catch {
    return fallback;
  }
}

function loadState(): ReviewState {
  try {
    if (!existsSync(STATE_PATH)) return { ...INITIAL_STATE };
    const raw = JSON.parse(readFileSync(STATE_PATH, "utf8"));
    return {
      turn_count_since_last_review: typeof raw.turn_count_since_last_review === "number" ? raw.turn_count_since_last_review : 0,
      last_review_at: typeof raw.last_review_at === "string" ? raw.last_review_at : null,
      last_message_at: typeof raw.last_message_at === "string" ? raw.last_message_at : null,
      pending_review: false,
      schema_version: 1,
    };
  } catch {
    return { ...INITIAL_STATE };
  }
}

function saveState(state: ReviewState): void {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  const tmp = `${STATE_PATH}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2) + "\n", "utf8");
  renameSync(tmp, STATE_PATH);
}

function minutesSince(iso: string | null, nowMs: number): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (nowMs - t) / 60_000);
}

function isSubagent(): boolean {
  return Boolean(
    process.env.CLAUDE_CODE_SUBAGENT_NAME ||
    process.env.CLAUDE_CODE_SUBAGENT_TYPE ||
    process.env.CLAUDE_AGENT_SDK === "1",
  );
}

function logFire(payload: Record<string, unknown>): void {
  try {
    mkdirSync(dirname(FIRE_LOG_PATH), { recursive: true });
    appendFileSync(FIRE_LOG_PATH, JSON.stringify(payload) + "\n", "utf8");
  } catch { /* best-effort */ }
}

function spawnReviewer(turnsReviewed: number): { spawned: boolean; reason: string } {
  if (!existsSync(REVIEWER_PATH)) {
    return { spawned: false, reason: "reviewer-not-found" };
  }
  try {
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
    if (isSubagent()) process.exit(0);

    const nowMs = Date.now();
    const now = new Date(nowMs).toISOString();
    const config = loadConfig();
    const state = loadState();

    state.turn_count_since_last_review += 1;
    state.last_message_at = now;

    const due =
      state.turn_count_since_last_review >= config.turn_threshold &&
      minutesSince(state.last_review_at, nowMs) >= config.min_minutes_between;

    if (due) {
      const turnsReviewed = state.turn_count_since_last_review;
      const { spawned, reason } = spawnReviewer(turnsReviewed);
      logFire({ ts: now, turns_since_last_review: turnsReviewed, spawned, reason });
      state.turn_count_since_last_review = 0;
      state.last_review_at = now;
    }

    saveState(state);
  } catch (e) {
    process.stderr.write(`MemoryReviewFire error: ${(e as Error)?.message || String(e)}\n`);
  }
  process.exit(0);
}

main();
