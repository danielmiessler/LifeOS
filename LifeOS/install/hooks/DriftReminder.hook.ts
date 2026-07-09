#!/usr/bin/env bun
/**
 * DriftReminder — UserPromptSubmit hook for deterministic voice drift nudges.
 *
 * Reads the Stop-hook last-response cache and emits at most one context line
 * when the previous response violates the LifeOS banner or voice rules.
 *
 * Performance: hot-path hook, no LLM calls, no large reads. Target <20ms.
 * Failure mode: any error logs to stderr and exits 0, never blocking prompts.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { firstBannedHit } from "./lib/banned-vocab";

// Normalize env path vars that Claude Code injects without shell expansion (LifeOS#1404)
for (const k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const v = process.env[k];
  if (v && /^\$\{?HOME\}?(\/|$)/.test(v)) process.env[k] = v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}


interface HookInput {
  prompt?: string;
  user_prompt?: string;
}

interface DriftState {
  last_fired_turn: number;
  turn_count: number;
  last_text: string | null;
  schema_version: 1;
}

const STDIN_TIMEOUT_MS = 300;
const MIN_TURNS_BETWEEN_FIRES = 5;
const LIFEOS_DIR = process.env.LIFEOS_DIR || join(process.env.HOME || "", ".claude", "LIFEOS");
const LAST_RESPONSE_PATH = join(LIFEOS_DIR, "MEMORY", "STATE", "last-response.txt");
const STATE_PATH = join(LIFEOS_DIR, "MEMORY", "STATE", "drift-reminder.json");
const INITIAL_STATE: DriftState = {
  last_fired_turn: -MIN_TURNS_BETWEEN_FIRES,
  turn_count: 0,
  last_text: null,
  schema_version: 1,
};
const MODE_BANNERS = ["LifeOS | NATIVE MODE", "LifeOS ALGORITHM", "═══ LifeOS ═══"] as const;

async function readStdinWithTimeout(timeoutMs: number = STDIN_TIMEOUT_MS): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    const timer = setTimeout(() => resolve(data), timeoutMs);
    process.stdin.on("data", (chunk: Buffer) => {
      data += chunk.toString();
    });
    process.stdin.on("end", () => {
      clearTimeout(timer);
      resolve(data);
    });
    process.stdin.on("error", (err: Error) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function parseHookInput(raw: string): HookInput {
  try {
    if (!raw.trim()) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const record = parsed as Record<string, unknown>;
    return {
      prompt: typeof record.prompt === "string" ? record.prompt : undefined,
      user_prompt: typeof record.user_prompt === "string" ? record.user_prompt : undefined,
    };
  } catch {
    return {};
  }
}

function loadState(): DriftState {
  try {
    if (!existsSync(STATE_PATH)) return { ...INITIAL_STATE };
    const raw = JSON.parse(readFileSync(STATE_PATH, "utf8")) as Partial<DriftState>;
    return {
      last_fired_turn: typeof raw.last_fired_turn === "number" ? raw.last_fired_turn : INITIAL_STATE.last_fired_turn,
      turn_count: typeof raw.turn_count === "number" ? raw.turn_count : INITIAL_STATE.turn_count,
      last_text: typeof raw.last_text === "string" ? raw.last_text : null,
      schema_version: 1,
    };
  } catch {
    return { ...INITIAL_STATE };
  }
}

function saveState(state: DriftState): void {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  const tmp = `${STATE_PATH}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2) + "\n", "utf8");
  renameSync(tmp, STATE_PATH);
}

function readLastResponse(): string | null {
  try {
    if (!existsSync(LAST_RESPONSE_PATH)) return null;
    // Staleness guard: on the first prompt of a new session the cache still
    // holds the PREVIOUS session's final response — never nag about day-old drift.
    const ageMs = Date.now() - statSync(LAST_RESPONSE_PATH).mtimeMs;
    if (ageMs > 30 * 60 * 1000) return null;
    return readFileSync(LAST_RESPONSE_PATH, "utf8");
  } catch {
    return null;
  }
}

function countEmDashes(text: string): number {
  return (text.match(/—/g) ?? []).length;
}

function findingFor(text: string): string | null {
  const bannedHit = firstBannedHit(text);
  if (bannedHit) return `last response used banned word '${bannedHit}'`;

  const hasModeBanner = MODE_BANNERS.some((banner) => text.includes(banner));
  if (!hasModeBanner) return "last response missing LifeOS mode banner";

  const emDashCount = countEmDashes(text);
  if (emDashCount > 4) return `last response used ${emDashCount} em-dashes (>4); voice rules cap at 2`;

  return null;
}

function emit(line: string): void {
  console.log(JSON.stringify({
    hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: line },
  }));
}

async function main(): Promise<void> {
  try {
    const raw = await readStdinWithTimeout();
    const input = parseHookInput(raw);
    const prompt = input.prompt || input.user_prompt || "";
    void prompt;

    const state = loadState();
    state.turn_count += 1;

    const lastResponse = readLastResponse();
    if (!lastResponse) {
      saveState(state);
      process.exit(0);
    }

    const finding = findingFor(lastResponse);
    if (!finding) {
      // Clean response clears the dedupe memory — the next drift, even an
      // identical one, fires again. Without this, identical drift is
      // suppressed forever once seen (Cato finding, 2026-06-10).
      state.last_text = null;
      saveState(state);
      process.exit(0);
    }

    const line = `DRIFT-REMINDER: ${finding}; voice rules: DA_IDENTITY Writing Style`;
    const withinBudget = (state.turn_count - state.last_fired_turn) < MIN_TURNS_BETWEEN_FIRES;
    // Dedupe only suppresses CONSECUTIVE identical findings inside the budget
    // logic above; a cleared last_text (clean turn in between) re-arms it.
    const duplicate = state.last_text === line;
    if (withinBudget || duplicate) {
      saveState(state);
      process.exit(0);
    }

    state.last_fired_turn = state.turn_count;
    state.last_text = line;
    saveState(state);
    emit(line);
  } catch (err) {
    process.stderr.write(`DriftReminder error: ${(err as Error)?.message || String(err)}\n`);
  }
  process.exit(0);
}

main();
