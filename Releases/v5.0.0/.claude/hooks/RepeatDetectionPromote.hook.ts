#!/usr/bin/env bun
/**
 * RepeatDetectionPromote.hook.ts - Stop hook
 *
 * Promotes pending-prompt.json -> last-prompt.json after Claude responds.
 * Pairs with RepeatDetection.hook.ts (UserPromptSubmit), which stages the
 * submitted prompt as "pending." Only prompts Claude actually responded to
 * become the comparison baseline for future repeat detection - cancelled
 * and blocked prompts never poison the state.
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { join } from "path";

const RESPONDED_PROMPT_FILE = join(
  process.env.HOME || "",
  ".claude/PAI/MEMORY/STATE/last-prompt.json",
);
const PENDING_PROMPT_FILE = join(
  process.env.HOME || "",
  ".claude/PAI/MEMORY/STATE/pending-prompt.json",
);

function main(): void {
  if (!existsSync(PENDING_PROMPT_FILE)) {
    process.exit(0);
  }

  try {
    const pending = readFileSync(PENDING_PROMPT_FILE, "utf-8");
    writeFileSync(RESPONDED_PROMPT_FILE, pending);
    unlinkSync(PENDING_PROMPT_FILE);
  } catch {
    // Non-critical - silently fail.
  }

  process.exit(0);
}

main();
