#!/usr/bin/env bun
// Paperclip agent isolation: skip PAI hooks in Paperclip child processes
if (process.env.PAPERCLIP_AGENT_ID) process.exit(0);
/**
 * EventCapture.hook.ts - Comprehensive JSONL Event Logger
 *
 * PURPOSE:
 * Captures all PAI hook events to date-partitioned JSONL files for
 * observability, debugging, and future analytics/dashboard consumption.
 *
 * TRIGGER: PostToolUse, PreToolUse, Notification, Stop, SubagentStop
 *
 * INPUT:
 * - session_id: Current session identifier
 * - tool_name?: Tool being used (for tool events)
 * - tool_input?: Tool parameters
 * - Hook event type from CLI args
 *
 * OUTPUT:
 * - stdout: {"continue": true} (always — non-blocking)
 * - Appends JSONL to: ~/.claude/history/raw-outputs/YYYY-MM/events-YYYY-MM-DD.jsonl
 *
 * SIDE EFFECTS:
 * - Creates directory structure if needed
 * - Appends one JSON line per event
 *
 * PERFORMANCE:
 * - Non-blocking: Returns {"continue": true} immediately
 * - File write is synchronous but fast (<5ms for append)
 * - Never delays hook response
 *
 * ADAPTED FROM: github.com/mellanon/pai-contrib (capture-all-events.ts)
 * See COMMUNITY-ATTRIBUTIONS.md for full attribution.
 */

import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { paiPath } from './lib/paths';

// ========================================
// Types
// ========================================

interface EventRecord {
  timestamp: string;
  event_type: string;
  session_id: string;
  tool_name?: string;
  agent?: string;
  data?: Record<string, unknown>;
}

// ========================================
// File Path Resolution
// ========================================

function getEventsFilePath(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  const monthDir = paiPath('history', 'raw-outputs', `${year}-${month}`);

  if (!existsSync(monthDir)) {
    mkdirSync(monthDir, { recursive: true });
  }

  return join(monthDir, `events-${year}-${month}-${day}.jsonl`);
}

// ========================================
// Main
// ========================================

async function main(): Promise<void> {
  // Output continue immediately so we never block
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

    await Promise.race([readLoop, new Promise<void>(r => setTimeout(r, 200))]);

    if (!raw.trim()) {
      process.exit(0);
      return;
    }

    const hookData = JSON.parse(raw);

    // Build event record
    const event: EventRecord = {
      timestamp: new Date().toISOString(),
      event_type: hookData.hook_event_type || hookData.event_type || 'unknown',
      session_id: hookData.session_id || 'unknown',
    };

    // Add tool info if present
    if (hookData.tool_name) {
      event.tool_name = hookData.tool_name;
    }

    // Detect agent
    if (process.env.CLAUDE_CODE_AGENT) {
      event.agent = process.env.CLAUDE_CODE_AGENT;
    } else if (hookData.tool_input?.subagent_type) {
      event.agent = hookData.tool_input.subagent_type;
    }

    // Include minimal data payload (avoid huge payloads)
    const data: Record<string, unknown> = {};
    if (hookData.tool_input?.command) {
      // Truncate long commands
      data.command = String(hookData.tool_input.command).slice(0, 200);
    }
    if (hookData.tool_input?.file_path) {
      data.file_path = hookData.tool_input.file_path;
    }
    if (hookData.tool_input?.description) {
      data.description = String(hookData.tool_input.description).slice(0, 200);
    }
    if (Object.keys(data).length > 0) {
      event.data = data;
    }

    // Append to JSONL
    const eventsFile = getEventsFilePath();
    appendFileSync(eventsFile, JSON.stringify(event) + '\n', 'utf-8');

  } catch {
    // Silent failure — event capture must never block operations
  }

  process.exit(0);
}

main();
