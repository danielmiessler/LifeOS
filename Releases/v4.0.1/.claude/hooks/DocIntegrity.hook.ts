#!/usr/bin/env bun
/**
 * DocIntegrity.hook.ts — Check cross-refs if system docs/hooks were modified
 *
 * PURPOSE:
 * Runs deterministic + inference-powered doc integrity checks when system
 * files (hooks, PAI docs, skills, components) were modified during the session.
 * Self-gating: returns instantly when no system files changed.
 *
 * TRIGGER: Stop
 *
 * NEEDS TRANSCRIPT: Yes (to detect which files were modified via tool_use entries)
 *
 * HANDLER: handlers/DocCrossRefIntegrity.ts
 */

import { readHookInput, parseTranscriptFromInput } from './lib/hook-io';
import { handleDocCrossRefIntegrity } from './handlers/DocCrossRefIntegrity';

async function main() {
  const input = await readHookInput();
  if (!input) { process.exit(0); }

  const parsed = await parseTranscriptFromInput(input);

  try {
    await handleDocCrossRefIntegrity(parsed, input);
  } catch (err) {
    console.error('[DocIntegrity] Handler failed:', err);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('[DocIntegrity] Fatal:', err);
  process.exit(0);
});
