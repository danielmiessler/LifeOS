#!/usr/bin/env bun
/**
 * LastResponseCache.hook.ts — Cache last response for RatingCapture bridge
 *
 * PURPOSE:
 * Caches the last assistant response text to disk so RatingCapture
 * (which fires on UserPromptSubmit) can access the previous response.
 *
 * TRIGGER: Stop
 *
 * NEEDS TRANSCRIPT: No (uses last_assistant_message from stdin, transcript fallback)
 */

import { readHookInput, parseTranscriptFromInput } from './lib/hook-io';
import { writeFileSync } from 'fs';
import { join } from 'path';

// Normalize env path vars that Claude Code injects without shell expansion (LifeOS#1404)
for (const k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const v = process.env[k];
  if (v && /^\$\{?HOME\}?(\/|$)/.test(v)) process.env[k] = v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}


async function main() {
  const input = await readHookInput();
  if (!input) { process.exit(0); }

  // Prefer last_assistant_message from stdin (v2.1.47+), fall back to transcript parse
  let lastResponse = input.last_assistant_message;
  if (!lastResponse) {
    const parsed = await parseTranscriptFromInput(input);
    lastResponse = parsed.lastMessage;
  }

  if (lastResponse) {
    try {
      const paiDir = process.env.LIFEOS_DIR || join(process.env.HOME!, '.claude', 'LIFEOS');
      const cachePath = join(paiDir, 'MEMORY', 'STATE', 'last-response.txt');
      writeFileSync(cachePath, lastResponse.slice(0, 2000), 'utf-8');
    } catch (err) {
      console.error('[LastResponseCache] Failed to write:', err);
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('[LastResponseCache] Fatal:', err);
  process.exit(0);
});
