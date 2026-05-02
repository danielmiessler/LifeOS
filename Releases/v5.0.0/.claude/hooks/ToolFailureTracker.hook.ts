#!/usr/bin/env bun
/**
 * ToolFailureTracker.hook.ts - PostToolUseFailure Event Logger
 *
 * PURPOSE:
 * Captures tool failures as structured events for debugging and observability.
 * Lightweight — appends to JSONL, no inference calls.
 *
 * TRIGGER: PostToolUseFailure
 *
 * OUTPUTS:
 * - MEMORY/OBSERVABILITY/tool-failures.jsonl (structured event log)
 * - stderr logging for hook diagnostics
 *
 * PERFORMANCE: <20ms (file append only)
 */

import { existsSync, mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';
import { paiPath } from './lib/paths';
import { getISOTimestamp } from './lib/time';

interface ToolFailureInput {
  session_id: string;
  transcript_path: string;
  hook_event_name: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  error?: string;
}

interface ToolFailureEvent {
  timestamp: string;
  event: 'tool_failure';
  session_id: string;
  tool_name: string;
  error: string;
  tool_input_preview: string;
}

const OBS_DIR = paiPath('MEMORY', 'OBSERVABILITY');
const FAILURES_FILE = join(OBS_DIR, 'tool-failures.jsonl');

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    const timer = setTimeout(() => resolve(data), 2000);
    process.stdin.on('data', (chunk) => { data += chunk.toString(); });
    process.stdin.on('end', () => { clearTimeout(timer); resolve(data); });
    process.stdin.on('error', () => { clearTimeout(timer); resolve(data); });
  });
}

async function main() {
  try {
    const input = await readStdin();
    if (!input.trim()) { process.exit(0); }

    const data: ToolFailureInput = JSON.parse(input);
    const toolName = data.tool_name || 'unknown';
    const error = data.error || 'unknown error';

    // Truncate tool input for storage
    let inputPreview = '';
    if (data.tool_input) {
      const raw = JSON.stringify(data.tool_input);
      inputPreview = raw.length > 500 ? raw.slice(0, 500) + '...' : raw;
    }

    const event: ToolFailureEvent = {
      timestamp: getISOTimestamp(),
      event: 'tool_failure',
      session_id: data.session_id,
      tool_name: toolName,
      error: error.slice(0, 1000),
      tool_input_preview: inputPreview,
    };

    if (!existsSync(OBS_DIR)) mkdirSync(OBS_DIR, { recursive: true });
    appendFileSync(FAILURES_FILE, JSON.stringify(event) + '\n', 'utf-8');
    console.error(`[ToolFailureTracker] Logged failure: ${toolName} — ${error.slice(0, 80)}`);
  } catch (err) {
    console.error(`[ToolFailureTracker] Error: ${err}`);
  }
  process.exit(0);
}

main();
