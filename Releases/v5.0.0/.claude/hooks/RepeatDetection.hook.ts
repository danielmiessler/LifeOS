#!/usr/bin/env bun
/**
 * RepeatDetection.hook.ts — UserPromptSubmit hook
 *
 * Detects when the user is repeating a previous request (indicating the AI
 * missed their intent). When triggered, injects a high-priority WARNING into
 * the model's context forcing re-reading of the user's message.
 *
 * Algorithm v3.19.0 Layer 2: Safety net for intent drift.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { paiPath } from "./lib/paths";

const STATE_FILE = paiPath("MEMORY", "STATE", "last-prompt.json");

interface HookInput {
  session_id: string;
  message?: { content?: string; role?: string };
  prompt?: string;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function trigrams(tokens: string[]): Set<string> {
  const grams = new Set<string>();
  for (let i = 0; i <= tokens.length - 3; i++) {
    grams.add(`${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`);
  }
  // Also add bigrams for shorter messages
  for (let i = 0; i <= tokens.length - 2; i++) {
    grams.add(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return grams;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function main(): void {
  let input: HookInput;
  try {
    input = JSON.parse(readFileSync("/dev/stdin", "utf-8"));
  } catch {
    // No stdin or invalid JSON — skip silently
    process.exit(0);
  }

  const currentPrompt =
    input.prompt ||
    input.message?.content ||
    "";

  // Skip very short messages (ratings, acknowledgments, greetings)
  if (currentPrompt.length < 20) {
    saveCurrentPrompt(currentPrompt, input.session_id);
    process.exit(0);
  }

  // Load previous prompt
  let previousPrompt = "";
  let previousSessionId = "";
  if (existsSync(STATE_FILE)) {
    try {
      const state = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
      previousPrompt = state.prompt || "";
      previousSessionId = state.session_id || "";
    } catch {
      // Corrupted state file — skip
    }
  }

  // Only compare within the same session
  if (previousSessionId !== input.session_id || !previousPrompt) {
    saveCurrentPrompt(currentPrompt, input.session_id);
    process.exit(0);
  }

  // Compare current to previous
  const currentTokens = tokenize(currentPrompt);
  const previousTokens = tokenize(previousPrompt);

  const currentGrams = trigrams(currentTokens);
  const previousGrams = trigrams(previousTokens);

  const similarity = jaccardSimilarity(currentGrams, previousGrams);

  // Save current prompt as the new "previous"
  saveCurrentPrompt(currentPrompt, input.session_id);

  // Threshold: 0.6 (60%) similarity triggers warning
  if (similarity >= 0.6) {
    // Output warning to stderr — this gets injected into model context
    process.stderr.write(
      `⚠️ REPEAT DETECTION: This message is ${Math.round(similarity * 100)}% similar to the previous message. ` +
      `The user is likely REPEATING a request you missed. ` +
      `STOP. Re-read their message carefully. Do NOT proceed with what you were doing before. ` +
      `Address their ACTUAL request this time.`,
    );
    // Exit 2 = blocking error, stderr fed to Claude
    process.exit(2);
  }

  process.exit(0);
}

function saveCurrentPrompt(prompt: string, sessionId: string): void {
  try {
    writeFileSync(
      STATE_FILE,
      JSON.stringify({
        prompt,
        session_id: sessionId,
        timestamp: new Date().toISOString(),
      }),
    );
  } catch {
    // Non-critical — silently fail
  }
}

main();
