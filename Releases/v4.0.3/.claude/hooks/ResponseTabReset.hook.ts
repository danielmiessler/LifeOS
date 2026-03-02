#!/usr/bin/env bun
/**
 * ResponseTabReset.hook.ts — Reset Kitty tab title/color after response
 *
 * PURPOSE:
 * Updates the Kitty terminal tab to show completion state after Claude
 * finishes responding. Converts the working title to past tense.
 *
 * TRIGGER: Stop
 *
 * NEEDS TRANSCRIPT: Yes (for response state and voice line extraction)
 *
 * HANDLER: handlers/TabState.ts
 */

import { readHookInput, parseTranscriptFromInput } from './lib/hook-io';
import { handleTabState } from './handlers/TabState';

async function main() {
  const input = await readHookInput();
  if (!input) { process.exit(0); }

  const parsed = await parseTranscriptFromInput(input);

  try {
    await handleTabState(parsed, input.session_id);
  } catch (err) {
    console.error('[ResponseTabReset] Handler failed:', err);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('[ResponseTabReset] Fatal:', err);
  process.exit(0);
});
