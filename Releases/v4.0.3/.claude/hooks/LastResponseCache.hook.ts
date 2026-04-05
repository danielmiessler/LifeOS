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
import { getPaiDir } from './lib/paths';
import { writeFileSync } from 'fs';
import { join } from 'path';

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
      const cachePath = join(getPaiDir(), 'MEMORY', 'STATE', 'last-response.txt');
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
