#!/usr/bin/env bun
/**
 * @version 1.1.2
 * ISARenderOnStop.hook.ts — Re-render edited ISAs at end-of-turn.
 *
 * TRIGGER: Stop event (assistant's turn ends).
 *
 * Reads the per-session state file written by ISASync.hook.ts at every ISA
 * Edit/Write. For each ISA edited this turn, spawns ISARender.ts ONLY IF the
 * sibling ISA.html already exists — i.e., the ISA has reached `phase: complete`
 * at least once before. Pre-completion edits never fire renders here — this is
 * the doctrinal gate that prevents "constant remaking" during active authoring.
 *
 * State file: ~/.claude/LIFEOS/MEMORY/STATE/isa-render-debounce/<session_id>.json
 * Cleared after each Stop fire.
 *
 * Hook MUST NOT block Stop longer than ~100ms. Renders are spawned detached
 * and never awaited.
 */

import { readFileSync, existsSync, unlinkSync } from 'fs';
import { spawn } from 'child_process';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { getClaudeDir } from "./lib/paths";

const STATE_DIR = join(getClaudeDir(), "LIFEOS/MEMORY/STATE/isa-render-debounce");
const ISA_RENDER = join(getClaudeDir(), "LIFEOS/TOOLS/ISARender.ts");

/**
 * Has this ISA reached completion at least once? This is the real gate the
 * `ISA.html`-exists check was only a proxy for. It is true for a resumed ISA
 * (iteration > 1 / resumed_from_phase) or a currently-complete one — which
 * fixes the hole where an ISA completed before the mirror convention (or
 * resumed into a new iteration) never got a mirror because no html existed yet.
 * A brand-new iteration-1 ISA still in first authoring returns false, so the
 * "don't remake during active authoring" guard is preserved exactly.
 * Reads only the frontmatter block; runs solely on the cold path (html missing).
 */
function hasReachedCompletion(isaPath: string): boolean {
  try {
    const fm = (readFileSync(isaPath, 'utf-8').match(/^---\n([\s\S]*?)\n---/) || [, ''])[1];
    if (/^phase:\s*complete\b/mi.test(fm)) return true;
    const iter = fm.match(/^iteration:\s*(\d+)/mi);
    if (iter && parseInt(iter[1], 10) > 1) return true;
    if (/^resumed_from_phase:\s*\S/mi.test(fm)) return true;
    return false;
  } catch {
    return false;
  }
}

let input: any;
try {
  input = JSON.parse(readFileSync(0, 'utf-8'));
} catch {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

const sessionId = input.session_id;
if (!sessionId) {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

const stateFile = join(STATE_DIR, `${sessionId}.json`);
if (!existsSync(stateFile)) {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

let edited: string[] = [];
try {
  edited = JSON.parse(readFileSync(stateFile, 'utf-8')).edited_isas || [];
} catch {
  edited = [];
}

const rendered: string[] = [];
const skipped: string[] = [];

for (const isaPath of edited) {
  if (!existsSync(isaPath)) { skipped.push(`${isaPath}:missing`); continue; }
  const htmlPath = join(dirname(isaPath), 'ISA.html');
  // Doctrinal gate: only render once the ISA has been completed at least once.
  // Fast path: an existing ISA.html proves prior completion. Cold path: no html
  // yet, so check the frontmatter directly — catches resumed / pre-convention
  // ISAs the html-exists proxy used to miss. First-authoring ISAs still skip.
  if (!existsSync(htmlPath) && !hasReachedCompletion(isaPath)) {
    skipped.push(`${isaPath}:pre-completion`);
    continue;
  }
  try {
    const proc = spawn('bun', [ISA_RENDER, isaPath], {
      detached: true,
      stdio: 'ignore',
    });
    proc.unref();
    rendered.push(isaPath);
  } catch (err) {
    skipped.push(`${isaPath}:spawn-failed`);
  }
}

// Clear state regardless of render outcome.
try { unlinkSync(stateFile); } catch {}

// Log to observability (best-effort, non-blocking).
if (rendered.length || skipped.length) {
  try {
    const { appendFileSync, mkdirSync } = require('fs');
    const logDir = join(getClaudeDir(), "LIFEOS/MEMORY/OBSERVABILITY");
    mkdirSync(logDir, { recursive: true });
    appendFileSync(join(logDir, 'isa-render.jsonl'),
      JSON.stringify({
        ts: new Date().toISOString(),
        session_id: sessionId,
        rendered,
        skipped,
      }) + '\n');
  } catch {}
}

console.log(JSON.stringify({ continue: true }));
process.exit(0);
