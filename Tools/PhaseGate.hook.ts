#!/usr/bin/env bun
/**
 * PhaseGate.hook.ts — Enforce Algorithm gates via PRD evidence check
 *
 * A Claude Code PostToolUse hook that watches for PRD.md edits and verifies
 * required evidence exists before allowing Algorithm phase transitions.
 *
 * Gates enforced:
 *   - phase -> think: requires ENVIRONMENT: entry in ## Decisions
 *   - phase -> build: requires VALIDATE: entry in ## Decisions
 *
 * WARNING mode only — logs to stderr (visible to the AI) and optionally
 * sends a voice notification. Never blocks execution.
 *
 * Registration (add to settings.json hooks.PostToolUse):
 *   { "matcher": "Write", "hooks": [{ "type": "command", "command": "~/.claude/Tools/PhaseGate.hook.ts" }] }
 *   { "matcher": "Edit",  "hooks": [{ "type": "command", "command": "~/.claude/Tools/PhaseGate.hook.ts" }] }
 *
 * Why this exists:
 *   Analysis of 49 algorithm reflections showed the top two failure patterns are:
 *   1. Build-before-validate (31%) — building complex systems without proving the core assumption
 *   2. Environment assumptions (17%) — assuming tools/libraries work without checking
 *   Both have "HARD GATE" text in the Algorithm, but text gates don't constrain a generative model.
 *   This hook moves enforcement from text instructions to code the AI cannot bypass.
 *
 * Usage: bun PhaseGate.hook.ts  (called automatically by Claude Code hook system)
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// --- Configuration ---

const CLAUDE_DIR = join(homedir(), '.claude');
const WORK_DIR = join(CLAUDE_DIR, 'MEMORY', 'WORK');
const WORK_JSON = join(CLAUDE_DIR, 'MEMORY', 'STATE', 'work.json');

/** Voice server URL — set to empty string to disable voice warnings */
const VOICE_URL = 'http://localhost:8888/notify';

interface GateCheck {
  targetPhase: string;
  requiredPrefix: string;
  gateName: string;
  warning: string;
}

const GATES: GateCheck[] = [
  {
    targetPhase: 'think',
    requiredPrefix: 'ENVIRONMENT:',
    gateName: 'ENVIRONMENT PRE-FLIGHT',
    warning: 'Entering THINK without environment check. Add "ENVIRONMENT: [status]" to ## Decisions.',
  },
  {
    targetPhase: 'build',
    requiredPrefix: 'VALIDATE:',
    gateName: 'VALIDATE GATE',
    warning: 'Entering BUILD without validation. Add "VALIDATE: [assumption] -> [result]" to ## Decisions.',
  },
];

/** PRD types that skip gate checks (no code execution = no validation needed) */
const SKIP_TYPES = new Set(['docs', 'research', 'config']);

// --- Minimal PRD parsing (self-contained, no lib/ dependencies) ---

function parseFrontmatter(content: string): Record<string, string> | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const fm: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
  }
  return fm;
}

function getOldPhase(slug: string): string {
  try {
    if (!existsSync(WORK_JSON)) return '';
    const registry = JSON.parse(readFileSync(WORK_JSON, 'utf-8'));
    const entry = registry?.sessions?.[slug];
    return entry?.phase?.toLowerCase() || '';
  } catch {
    return '';
  }
}

function extractDecisions(content: string): string {
  const match = content.match(/## Decisions\n([\s\S]*?)(?=\n## |$)/);
  return match ? match[1] : '';
}

// --- Voice notification (optional, non-fatal) ---

async function sendVoiceWarning(message: string): Promise<void> {
  if (!VOICE_URL) return;
  try {
    await fetch(VOICE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Warning. ${message}`,
        voice_name: 'algorithm',
        voice_enabled: true,
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch { /* voice server may be down — non-fatal */ }
}

// --- Main ---

let input: any;
try {
  input = JSON.parse(readFileSync(0, 'utf-8'));
} catch {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

const toolInput = input.tool_input || {};

async function main() {
  // Only trigger for PRD.md files in MEMORY/WORK/
  const filePath: string = toolInput.file_path || '';
  if (!filePath.includes('MEMORY/WORK/') || !filePath.endsWith('PRD.md')) return;
  if (!existsSync(filePath)) return;

  const content = readFileSync(filePath, 'utf-8');
  const fm = parseFrontmatter(content);
  if (!fm) return;

  const newPhase = (fm.phase || '').toLowerCase();
  const prdType = (fm.type || '').toLowerCase();

  // Skip for non-code PRD types
  if (SKIP_TYPES.has(prdType)) return;

  // Detect phase transition
  const oldPhase = fm.slug ? getOldPhase(fm.slug) : '';
  if (newPhase === oldPhase) return;

  // Check each gate
  const decisions = extractDecisions(content);
  for (const gate of GATES) {
    if (newPhase !== gate.targetPhase) continue;
    if (!decisions.includes(gate.requiredPrefix)) {
      console.error(`\n\u26a0\ufe0f  [PhaseGate] ${gate.gateName} WARNING: ${gate.warning}\n`);
      await sendVoiceWarning(gate.warning);
    }
  }
}

main().catch(() => {}).finally(() => {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
});
