#!/usr/bin/env bun
/**
 * @version 1.3.1
 * AgentInvocation.hook.ts — Agent (Task) subagent lifecycle tracker.
 *
 * Claude Code's built-in SubagentStart/SubagentStop payloads do NOT include
 * subagent_type / description / prompt reliably — the prior tracker wrote
 * "unknown" for 5844 of 5846 historical events. This hook captures the data
 * at PreToolUse:Agent / PostToolUse:Agent where tool_input and tool_response
 * are present, and writes proper events to subagent-events.jsonl.
 *
 * MODEL INJECTOR REMOVED (v1.3.0, 2026-07-11, principal directive): the
 * v1.2.0 injector rewrote any no-model Agent dispatch to a routing-curve rung
 * (E4/E5 → fable, else opus). Its tier signal died with the 2026-07-11 tier
 * retirement, silently flattening every dispatch to opus. Baseline now: model
 * selection is {{DA_NAME}}'s per-dispatch judgment; an unspecified model inherits the
 * session model (harness behavior). This hook OBSERVES only — it resolves and
 * logs which model a dispatch carries (cross-vendor > explicit param >
 * frontmatter pin > inherited) and never mutates tool input. Historical
 * injections remain in MEMORY/OBSERVABILITY/model-injections.jsonl.
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
import { homedir } from 'os';
import { paiPath } from './lib/paths';
import { getISOTimestamp } from './lib/time';
import { EFFORT_MODEL, ALIAS, CROSS_VENDOR } from '../LIFEOS/TOOLS/models';
import { getClaudeDir } from "./lib/paths";

interface AgentToolInput {
  subagent_type?: string;
  description?: string;
  prompt?: string;
  model?: string;
}

/** Reverse-map a model alias/tier to its effort level via EFFORT_MODEL. */
function levelForModel(model: string): string {
  for (const [level, tier] of Object.entries(EFFORT_MODEL)) {
    if (tier === model || ALIAS[tier as keyof typeof ALIAS] === model) return level;
  }
  return 'custom';
}

/**
 * Resolve the dispatch's display level + model, mirroring the Agent tool's
 * precedence: cross-vendor engine > dispatch-time model param > agent
 * frontmatter pin > inherited from session.
 */
function resolveDispatch(subagentType: string, inputModel?: string): { model: string; level: string } {
  const cvKey = subagentType.charAt(0).toLowerCase() + subagentType.slice(1);
  if (CROSS_VENDOR[cvKey]) return { model: CROSS_VENDOR[cvKey], level: 'cross-vendor' };
  if (inputModel) return { model: inputModel, level: levelForModel(inputModel) };
  try {
    const fm = readFileSync(join(getClaudeDir(), 'agents', `${subagentType}.md`), 'utf-8').slice(0, 4000);
    const m = fm.match(/^model:\s*(\S+)/m);
    if (m) return { model: m[1], level: `${levelForModel(m[1])}-pin` };
  } catch { /* no agent file — built-in type */ }
  return { model: 'inherited', level: 'session' };
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

type StartRecord = { epoch: number; timestamp: string; subagent_type: string; description: string; model?: string; level?: string };

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
      const dispatch = resolveDispatch(subagentType, input.model);

      const starts = readStarts();
      starts[key] = {
        epoch: now,
        timestamp: getISOTimestamp(),
        subagent_type: subagentType,
        description,
        model: dispatch.model,
        level: dispatch.level,
      };
      writeStarts(starts);

      const event = {
        timestamp: getISOTimestamp(),
        event: 'subagent_start',
        session_id: sessionId,
        subagent_id: key,
        subagent_type: subagentType,
        subagent_model: dispatch.model,
        subagent_level: dispatch.level,
        description,
        prompt_preview: prompt.slice(0, 200),
      };
      appendFileSync(EVENTS_FILE, JSON.stringify(event) + '\n', 'utf-8');
      console.error(`[AgentInvocation] START: ${subagentType} (${dispatch.level} → ${dispatch.model}) — ${description.slice(0, 48)}`);
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
