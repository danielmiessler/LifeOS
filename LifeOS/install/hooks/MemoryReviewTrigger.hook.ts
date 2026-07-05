#!/usr/bin/env bun
/**
 * MemoryReviewTrigger — UserPromptSubmit hook for the autonomic memory cadence.
 *
 * LifeOS autonomic memory subsystem, F4.
 *
 * Responsibilities (per turn):
 *   1. Read state from MEMORY/OBSERVABILITY/review-state.json
 *   2. Increment turn_count_since_last_review
 *   3. Update last_message_at = now (used by Fire hook for idle detection)
 *   4. Check trigger conditions:
 *        turn_count >= TURN_THRESHOLD
 *        AND minutes_since_last_review >= MIN_MINUTES_BETWEEN
 *        AND idle_minutes >= IDLE_THRESHOLD
 *      If all met, set pending_review = true
 *   5. Debounce-cancel: if pending_review was already true AND this new
 *      message fires before Stop consumes it, set pending_review = false
 *      (waits for a quieter moment to fire).
 *   6. Write state back atomically
 *
 * This hook tracks cadence state ONLY. The cadence heartbeat the principal
 * sees renders on the deterministic `🧠 MEM` statusline line (LIFEOS_StatusLine.sh),
 * which reads review-state.json directly every second. The old per-turn
 * `<autonomic-memory>` chat-line context block was retired 2026-05-28: it was
 * model-self-policed, cost output tokens every turn, and failed compliance
 * repeatedly. The statusline shows the same data more reliably and for free.
 *
 * This hook does NOT fire the reviewer subprocess — that's MemoryReviewFire
 * (Stop hook) which reads the state and decides whether to spawn.
 *
 * Cadence parameters: LIFEOS/USER/CONFIG/memory-review.json (hardcoded fallbacks).
 *
 * Performance: hot-path hook — must be cheap. No LLM calls, no large reads.
 * Targets < 20ms execution.
 *
 * Failure mode: any error logs to stderr and exits 0 (never block the prompt).
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve as pathResolve } from "node:path";
import { getClaudeDir } from './lib/paths';

const CLAUDE_ROOT = getClaudeDir();
const STATE_PATH = pathResolve(CLAUDE_ROOT, "LIFEOS/MEMORY/OBSERVABILITY/review-state.json");
const CONFIG_PATH = pathResolve(CLAUDE_ROOT, "LIFEOS/USER/CONFIG/memory-review.json");
const EFFORT_ROUTER_LOG = pathResolve(CLAUDE_ROOT, "LIFEOS/MEMORY/OBSERVABILITY/effort-router.jsonl");
const EFFORT_ROUTER_MAX_AGE_MS = 30_000; // tolerate ≤30s drift between TheRouter write and Trigger read

interface ReviewState {
  turn_count_since_last_review: number;
  last_review_at: string | null;   // ISO-8601
  last_message_at: string | null;  // ISO-8601
  pending_review: boolean;
  schema_version: 1;
}

interface ReviewConfig {
  turn_threshold: number;
  min_minutes_between: number;
  idle_threshold: number;
  confidence_threshold: number;
  schema_version: 1;
}

// Hardcoded fallbacks if config file is missing or malformed.
const FALLBACK_CONFIG: ReviewConfig = {
  turn_threshold: 8,
  min_minutes_between: 30,
  idle_threshold: 2,
  confidence_threshold: 0.70,
  schema_version: 1,
};

const INITIAL_STATE: ReviewState = {
  turn_count_since_last_review: 0,
  last_review_at: null,
  last_message_at: null,
  pending_review: false,
  schema_version: 1,
};

function loadConfig(): ReviewConfig {
  try {
    if (!existsSync(CONFIG_PATH)) return FALLBACK_CONFIG;
    const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
    return {
      turn_threshold: typeof raw.turn_threshold === "number" ? raw.turn_threshold : FALLBACK_CONFIG.turn_threshold,
      min_minutes_between: typeof raw.min_minutes_between === "number" ? raw.min_minutes_between : FALLBACK_CONFIG.min_minutes_between,
      idle_threshold: typeof raw.idle_threshold === "number" ? raw.idle_threshold : FALLBACK_CONFIG.idle_threshold,
      confidence_threshold: typeof raw.confidence_threshold === "number" ? raw.confidence_threshold : FALLBACK_CONFIG.confidence_threshold,
      schema_version: 1,
    };
  } catch {
    return FALLBACK_CONFIG;
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
      pending_review: typeof raw.pending_review === "boolean" ? raw.pending_review : false,
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

function minutesBetween(aIso: string | null, bIso: string): number {
  if (!aIso) return Number.POSITIVE_INFINITY;
  const aMs = Date.parse(aIso);
  const bMs = Date.parse(bIso);
  if (Number.isNaN(aMs) || Number.isNaN(bMs)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (bMs - aMs) / 60_000);
}

function isSubagentInvocation(): boolean {
  // ISC-46: the cadence reviewer is for the principal's primary session only.
  // Subagent invocations (Task tool / SDK forks) should never tick the
  // cadence — they don't carry the conversation the reviewer reads. Detect
  // via the harness env markers it sets on subagent processes.
  return Boolean(
    process.env.CLAUDE_CODE_SUBAGENT_NAME ||
    process.env.CLAUDE_CODE_SUBAGENT_TYPE ||
    process.env.CLAUDE_AGENT_SDK === "1"
  );
}

/**
 * Read the trailing line of effort-router.jsonl (written by TheRouter
 * hook earlier in the same UserPromptSubmit chain). Return the parsed row
 * if it landed within the last EFFORT_ROUTER_MAX_AGE_MS window — otherwise
 * null (no recent classification → don't gate).
 */
function readLatestTheRouterRow(): { mode?: string; session_id?: string; timestamp?: string } | null {
  try {
    if (!existsSync(EFFORT_ROUTER_LOG)) return null;
    const raw = readFileSync(EFFORT_ROUTER_LOG, "utf8");
    const lines = raw.split("\n").filter((l) => l.trim().length > 0);
    if (lines.length === 0) return null;
    const last = lines[lines.length - 1]!;
    const row = JSON.parse(last) as { mode?: string; session_id?: string; timestamp?: string };
    if (!row.timestamp) return null;
    const ageMs = Date.now() - Date.parse(row.timestamp);
    if (Number.isNaN(ageMs) || ageMs > EFFORT_ROUTER_MAX_AGE_MS) return null;
    return row;
  } catch {
    return null;
  }
}

function isMinimalMode(): boolean {
  // ISC-47: classifier-MINIMAL turns don't need a cadence reviewer hit.
  // TheRouter writes the classification to effort-router.jsonl BEFORE
  // this hook fires (they share the UserPromptSubmit chain; TheRouter
  // is registered first). Read the trailing row and skip on MINIMAL.
  const row = readLatestTheRouterRow();
  return row?.mode === "MINIMAL";
}

function main(): void {
  try {
    if (isSubagentInvocation()) {
      // Silent skip — log nothing, mutate nothing.
      process.exit(0);
    }
    if (isMinimalMode()) {
      // ISC-47 silent skip on MINIMAL turns.
      process.exit(0);
    }
    const now = new Date().toISOString();
    const config = loadConfig();
    const state = loadState();

    // Debounce-cancel: if a review was pending and a new message just arrived,
    // cancel the pending review and reset for re-evaluation. Honcho Dream
    // Scheduler pattern (dream_scheduler.py:97-105) vendored.
    const wasPending = state.pending_review;

    state.turn_count_since_last_review += 1;

    const idleMinutes = minutesBetween(state.last_message_at, now);
    const minutesSinceReview = minutesBetween(state.last_review_at, now);

    state.last_message_at = now;

    // Check fire conditions on the state AFTER this message lands. Idle is
    // computed using the PRIOR last_message_at — so the very next turn-cycle
    // sees how long the user was quiet before they sent this message.
    const shouldFire =
      state.turn_count_since_last_review >= config.turn_threshold &&
      minutesSinceReview >= config.min_minutes_between &&
      idleMinutes >= config.idle_threshold;

    if (wasPending) {
      // A review was pending but the user spoke again — cancel and re-evaluate.
      state.pending_review = false;
    }

    if (shouldFire && !wasPending) {
      state.pending_review = true;
    }

    saveState(state);
    // Chat-line heartbeat retired 2026-05-28: the memory cadence now renders on
    // the deterministic `🧠 MEM` statusline line (reads review-state.json directly).
    // This hook tracks cadence state only — no `<autonomic-memory>` context block.
  } catch (e) {
    // Never block the prompt. Log to stderr and exit 0.
    process.stderr.write(`MemoryReviewTrigger error: ${(e as Error)?.message || String(e)}\n`);
  }
  process.exit(0);
}

main();
