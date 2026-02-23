/**
 * PAI Installer v3.0 — State Persistence
 * Manages install state to support resume from interruption.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "fs";
import { homedir } from "os";
import { join, dirname } from "path";
import type { InstallState, StepId } from "./types";

const STATE_FILE = join(
  process.env.PAI_CONFIG_DIR || join(homedir(), ".config", "PAI"),
  "install-state.json"
);

/**
 * Create a fresh install state.
 */
export function createFreshState(mode: "cli" | "web"): InstallState {
  return {
    version: "3.0",
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    currentStep: "system-detect",
    completedSteps: [],
    skippedSteps: [],
    mode,
    detection: null,
    collected: {},
    installType: null,
    errors: [],
  };
}

/**
 * Check if a saved state exists.
 */
export function hasSavedState(): boolean {
  return existsSync(STATE_FILE);
}

/**
 * Load saved install state from disk.
 * Returns null if no state exists or it's corrupted.
 */
export function loadState(): InstallState | null {
  if (!existsSync(STATE_FILE)) return null;

  try {
    const raw = readFileSync(STATE_FILE, "utf-8");
    const state = JSON.parse(raw) as InstallState;

    // Validate basic structure
    if (!state.version || !state.startedAt || !state.currentStep) {
      return null;
    }

    return state;
  } catch {
    return null;
  }
}

/**
 * Save install state to disk.
 */
export function saveState(state: InstallState): void {
  state.updatedAt = new Date().toISOString();

  const dir = dirname(STATE_FILE);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), { mode: 0o600 });
}

/**
 * Remove saved state (after successful install).
 */
export function clearState(): void {
  if (existsSync(STATE_FILE)) {
    unlinkSync(STATE_FILE);
  }
}

/**
 * Mark a step as completed and advance to the next.
 */
export function completeStep(state: InstallState, step: StepId): void {
  if (!state.completedSteps.includes(step)) {
    state.completedSteps.push(step);
  }
  saveState(state);
}

/**
 * Mark a step as skipped.
 */
export function skipStep(state: InstallState, step: StepId, reason?: string): void {
  if (!state.skippedSteps.includes(step)) {
    state.skippedSteps.push(step);
  }
  saveState(state);
}

/**
 * Record an error for a step.
 */
export function recordError(
  state: InstallState,
  step: StepId,
  message: string,
  recoverable: boolean = true
): void {
  state.errors.push({
    step,
    message,
    timestamp: new Date().toISOString(),
    recoverable,
  });
  saveState(state);
}

/**
 * Mask API keys for safe logging/display.
 * Shows first 8 chars and masks the rest.
 */
export function maskKey(key: string): string {
  if (!key || key.length <= 12) return "***";
  return key.substring(0, 8) + "..." + key.substring(key.length - 4);
}
