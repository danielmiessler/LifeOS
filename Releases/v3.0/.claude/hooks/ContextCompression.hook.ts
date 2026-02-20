#!/usr/bin/env bun
/**
 * ContextCompression.hook.ts - PreCompact Visibility Hook
 *
 * PURPOSE:
 * Announces context compaction events via voice notification and logs
 * compaction stats to MEMORY/LEARNING/ for session analysis. Provides
 * visibility into when the context window is being compressed.
 *
 * TRIGGER: PreCompact
 *
 * INPUT:
 * - session_id: Current session identifier
 * - transcript_path?: Path to session transcript
 * - compact_type?: 'auto' | 'manual'
 *
 * OUTPUT:
 * - stdout: {"continue": true} (always — non-blocking)
 *
 * SIDE EFFECTS:
 * - Sends voice notification to localhost:8888
 * - Appends JSONL to MEMORY/LEARNING/compaction-events.jsonl
 *
 * ADAPTED FROM: github.com/zmre/nix-pai (context-compression-hook.ts)
 * See COMMUNITY-ATTRIBUTIONS.md for full attribution.
 */

import { appendFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { paiPath } from './lib/paths';

// ========================================
// Types
// ========================================

interface HookInput {
  session_id: string;
  transcript_path?: string;
  compact_type?: string;
}

interface CompactionEvent {
  timestamp: string;
  session_id: string;
  compact_type: string;
  message_count?: number;
  event: 'compaction_starting';
}

// ========================================
// Transcript Stats
// ========================================

function getMessageCount(transcriptPath: string): number {
  try {
    const content = readFileSync(transcriptPath, 'utf-8');
    const lines = content.trim().split('\n');
    let count = 0;
    for (const line of lines) {
      if (line.trim()) {
        try {
          const entry = JSON.parse(line);
          if (entry.type === 'user' || entry.type === 'assistant') {
            count++;
          }
        } catch {
          // Skip invalid lines
        }
      }
    }
    return count;
  } catch {
    return 0;
  }
}

// ========================================
// Voice Notification (fire-and-forget)
// ========================================

function sendVoiceNotification(message: string): void {
  try {
    // Fire and forget — do not await
    fetch('http://localhost:8888/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        voice_id: 'pNInz6obpgDQGcFmaJgB',
        title: 'Context Compaction',
      }),
    }).catch(() => {
      // Silent failure — voice server may not be running
    });
  } catch {
    // Silent failure
  }
}

// ========================================
// Logging
// ========================================

function logCompactionEvent(event: CompactionEvent): void {
  try {
    const logDir = paiPath('MEMORY', 'LEARNING');
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }

    const logPath = paiPath('MEMORY', 'LEARNING', 'compaction-events.jsonl');
    appendFileSync(logPath, JSON.stringify(event) + '\n', 'utf-8');
  } catch {
    // Silent failure — logging must never block
  }
}

// ========================================
// Main
// ========================================

async function main(): Promise<void> {
  // Output continue immediately
  console.log(JSON.stringify({ continue: true }));

  try {
    // Read stdin with timeout
    const reader = Bun.stdin.stream().getReader();
    let raw = '';
    const readLoop = (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        raw += new TextDecoder().decode(value, { stream: true });
      }
    })();

    await Promise.race([readLoop, new Promise<void>(r => setTimeout(r, 300))]);

    let hookInput: HookInput = { session_id: 'unknown' };
    if (raw.trim()) {
      hookInput = JSON.parse(raw);
    }

    const compactType = hookInput.compact_type || 'auto';
    let messageCount: number | undefined;

    // Get message count if transcript available
    if (hookInput.transcript_path) {
      messageCount = getMessageCount(hookInput.transcript_path);
    }

    // Build notification message
    let message = 'Context compaction starting';
    if (messageCount && messageCount > 0) {
      message = `Context compaction starting, ${messageCount} messages`;
    }

    // Send voice notification
    sendVoiceNotification(message);

    // Log event
    logCompactionEvent({
      timestamp: new Date().toISOString(),
      session_id: hookInput.session_id,
      compact_type: compactType,
      message_count: messageCount,
      event: 'compaction_starting',
    });

  } catch {
    // Silent failure
  }

  process.exit(0);
}

main();
