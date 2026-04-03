#!/usr/bin/env bun
// Paperclip agent isolation: skip PAI hooks in Paperclip child processes
if (process.env.PAPERCLIP_AGENT_ID) process.exit(0);
/**
 * StopOrchestrator.hook.ts - Single Entry Point for Stop Hooks
 *
 * PURPOSE:
 * Orchestrates all Stop event handlers by reading and parsing the transcript
 * ONCE, then distributing the parsed data to isolated handlers.
 *
 * TRIGGER: Stop (fires after Claude generates a response)
 *
 * HANDLERS (in hooks/handlers/):
 * - VoiceNotification.ts: Extracts 🗣️ line, sends to voice server
 * - TabState.ts: Resets Kitty tab to default UL blue
 * - RebuildSkill.ts: Auto-rebuilds SKILL.md from Components/ if modified
 * - DocCrossRefIntegrity.ts: Checks if system docs/hooks were modified, updates cross-refs if so
 *
 * ERROR HANDLING:
 * - Handler failures: Isolated via Promise.allSettled
 *
 * PERFORMANCE:
 * - Non-blocking, typical execution: <100ms
 */

import { parseTranscript } from '../skills/PAI/Tools/TranscriptParser';
import { handleVoice } from './handlers/VoiceNotification';
import { handleTabState } from './handlers/TabState';
import { handleRebuildSkill } from './handlers/RebuildSkill';
import { handleAlgorithmEnrichment } from './handlers/AlgorithmEnrichment';
import { handleDocCrossRefIntegrity } from './handlers/DocCrossRefIntegrity';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

interface HookInput {
  session_id: string;
  transcript_path: string;
  hook_event_name: string;
}

/**
 * Voice gate: only main terminal sessions get voice.
 * Subagents spawned via Task tool have no kitty-sessions file → voice blocked.
 * One existsSync check. No regex. No transcript parsing.
 */
function isMainSession(sessionId: string): boolean {
  const paiDir = process.env.PAI_DIR || join(homedir(), '.claude');
  const kittySessionsDir = join(paiDir, 'MEMORY', 'STATE', 'kitty-sessions');
  if (!existsSync(kittySessionsDir)) return true; // Non-Kitty terminal: allow all sessions
  return existsSync(join(kittySessionsDir, `${sessionId}.json`));
}

async function readStdin(): Promise<HookInput | null> {
  try {
    const decoder = new TextDecoder();
    const reader = Bun.stdin.stream().getReader();
    let input = '';

    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => resolve(), 500);
    });

    const readPromise = (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        input += decoder.decode(value, { stream: true });
      }
    })();

    await Promise.race([readPromise, timeoutPromise]);

    if (input.trim()) {
      return JSON.parse(input) as HookInput;
    }
  } catch (error) {
    console.error('[StopOrchestrator] Error reading stdin:', error);
  }
  return null;
}

async function main() {
  const hookInput = await readStdin();

  if (!hookInput || !hookInput.transcript_path) {
    console.error('[StopOrchestrator] No transcript path provided');
    process.exit(0);
  }

  // Wait for transcript to be fully written to disk
  await new Promise(resolve => setTimeout(resolve, 150));

  // SINGLE READ, SINGLE PARSE
  const parsed = parseTranscript(hookInput.transcript_path);

  // Voice gate: only main terminal sessions get voice
  const voiceEnabled = isMainSession(hookInput.session_id);

  if (voiceEnabled) {
    console.error(`[StopOrchestrator] Voice ON (main session): ${parsed.plainCompletion.slice(0, 50)}...`);
  } else {
    console.error(`[StopOrchestrator] Voice OFF (not main session)`);
  }

  // Run handlers — voice only fires for main terminal sessions
  const handlers: Promise<void>[] = [
    handleTabState(parsed, hookInput.session_id),
    handleRebuildSkill(),
    handleAlgorithmEnrichment(parsed, hookInput.session_id),
    handleDocCrossRefIntegrity(parsed, hookInput),
  ];
  const handlerNames = ['TabState', 'RebuildSkill', 'AlgorithmEnrichment', 'DocCrossRefIntegrity'];

  if (voiceEnabled) {
    handlers.unshift(handleVoice(parsed, hookInput.session_id));
    handlerNames.unshift('Voice');
  }

  const results = await Promise.allSettled(handlers);

  // Log any handler failures
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(`[StopOrchestrator] ${handlerNames[index]} handler failed:`, result.reason);
    }
  });

  process.exit(0);
}

main().catch((error) => {
  console.error('[StopOrchestrator] Fatal error:', error);
  process.exit(0);
});
