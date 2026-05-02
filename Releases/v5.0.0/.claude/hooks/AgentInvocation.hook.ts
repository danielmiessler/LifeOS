#!/usr/bin/env bun
/**
 * AgentInvocation.hook.ts — Agent (Task) subagent lifecycle tracker.
 *
 * Claude Code's built-in SubagentStart/SubagentStop payloads do NOT include
 * subagent_type / description / prompt reliably — the prior tracker wrote
 * "unknown" for 5844 of 5846 historical events. This hook captures the data
 * at PreToolUse:Agent / PostToolUse:Agent where tool_input and tool_response
 * are present, and writes proper events to subagent-events.jsonl.
 *
 * Wired in settings.json under:
 *   PreToolUse  matcher=Agent → subagent_start  (with real subagent_type)
 *   PostToolUse matcher=Agent → subagent_stop   (with duration)
 *
 * Correlation key: session_id + description (description is required by the
 * Agent tool). On PreToolUse we stash the start timestamp keyed by
 * session_id|description in subagent-starts.json; PostToolUse matches it back.
 */

import { existsSync, mkdirSync, appendFileSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { paiPath } from './lib/paths';
import { getISOTimestamp } from './lib/time';

interface AgentToolInput {
  subagent_type?: string;
  description?: string;
  prompt?: string;
}

interface ToolHookInput {
  session_id?: string;
  hook_event_name?: string;
  tool_name?: string;
  tool_input?: AgentToolInput;
  tool_response?: unknown;
}

const OBS_DIR = paiPath('MEMORY', 'OBSERVABILITY');
const EVENTS_FILE = join(OBS_DIR, 'subagent-events.jsonl');
const STARTS_FILE = join(OBS_DIR, 'agent-starts.json');

type StartRecord = { epoch: number; timestamp: string; subagent_type: string; description: string };

function readStarts(): Record<string, StartRecord> {
  try {
    if (existsSync(STARTS_FILE)) return JSON.parse(readFileSync(STARTS_FILE, 'utf-8'));
  } catch { /* corrupted — reset */ }
  return {};
}

function writeStarts(starts: Record<string, StartRecord>) {
  writeFileSync(STARTS_FILE, JSON.stringify(starts, null, 2), 'utf-8');
}

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    const timer = setTimeout(() => resolve(data), 2000);
    process.stdin.on('data', (c) => { data += c.toString(); });
    process.stdin.on('end', () => { clearTimeout(timer); resolve(data); });
    process.stdin.on('error', () => { clearTimeout(timer); resolve(data); });
  });
}

function correlationKey(sessionId: string, description: string): string {
  return `${sessionId}::${description}`;
}

async function main() {
  try {
    const raw = await readStdin();
    if (!raw.trim()) process.exit(0);

    const data: ToolHookInput = JSON.parse(raw);
    if (data.tool_name !== 'Agent') process.exit(0);

    const sessionId = data.session_id || 'unknown';
    const input = data.tool_input || {};
    const subagentType = input.subagent_type || 'general-purpose';
    const description = input.description || '(no description)';
    const prompt = input.prompt || '';
    const isPost = data.hook_event_name === 'PostToolUse';
    const key = correlationKey(sessionId, description);

    if (!existsSync(OBS_DIR)) mkdirSync(OBS_DIR, { recursive: true });

    if (!isPost) {
      const now = Date.now();
      const starts = readStarts();
      starts[key] = {
        epoch: now,
        timestamp: getISOTimestamp(),
        subagent_type: subagentType,
        description,
      };
      writeStarts(starts);

      const event = {
        timestamp: getISOTimestamp(),
        event: 'subagent_start',
        session_id: sessionId,
        subagent_id: key,
        subagent_type: subagentType,
        subagent_model: 'inherited',
        description,
        prompt_preview: prompt.slice(0, 200),
      };
      appendFileSync(EVENTS_FILE, JSON.stringify(event) + '\n', 'utf-8');
      console.error(`[AgentInvocation] START: ${subagentType} — ${description.slice(0, 48)}`);
    } else {
      const starts = readStarts();
      const startRec = starts[key];
      let duration: number | null = null;
      if (startRec) {
        duration = Math.round((Date.now() - startRec.epoch) / 1000);
        delete starts[key];
        writeStarts(starts);
      }

      const event = {
        timestamp: getISOTimestamp(),
        event: 'subagent_stop',
        session_id: sessionId,
        subagent_id: key,
        subagent_type: subagentType,
        description,
        duration_seconds: duration,
      };
      appendFileSync(EVENTS_FILE, JSON.stringify(event) + '\n', 'utf-8');
      console.error(`[AgentInvocation] STOP: ${subagentType} — ${description.slice(0, 48)} (${duration ?? '?'}s)`);
    }
  } catch (e) {
    console.error('[AgentInvocation]', e instanceof Error ? e.message : String(e));
  }
  process.exit(0);
}

main();
