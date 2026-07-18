#!/usr/bin/env bun
/**
 * @version 1.4.11
 * ISASync.hook.ts — ISA → work.json sync via PostToolUse
 *
 * TRIGGER: PostToolUse (Write, Edit, MultiEdit, Read)
 *
 * v4.1.0 (PRD → ISA rename): the per-session artifact is now ISA.md.
 * Sessions created before v4.1.0 still ship a PRD.md; this hook reads either,
 * preferring ISA.md when both exist (legacy behavior — there should never be
 * both for a single session).
 *
 * v6.9.0 (Resume After Complete): Read events on ISA files now bump
 * lastToolActivity via the slug-keyed path so reading a complete ISA
 * registers as a heartbeat for that ISA's slug. Read NEVER writes back to
 * the file — only Write/Edit/MultiEdit do.
 *
 * - Write/Edit/MultiEdit on ISA.md (or legacy PRD.md) → full sync; auto-rewind fires inside syncToWorkJson
 * - Read on ISA.md → bump lastToolActivity on the slug, rebind sessionUUID, debounced
 */

import { readFileSync, existsSync } from 'fs';
import { spawn } from 'child_process';
import { homedir } from 'os';
import { join } from 'path';
import {
  parseFrontmatter,
  syncToWorkJson,
  readRegistry,
  bumpLastToolActivityBySlug,
  ARTIFACT_FILENAME,
  LEGACY_ARTIFACT_FILENAME,
} from './lib/isa-utils';
import { setPhaseTab } from './lib/tab-setter';
import { effortToCanonicalELevel } from './lib/effort';
import type { AlgorithmTabPhase } from './lib/tab-constants';
import { getClaudeDir } from "./lib/paths";

let input: any;
try {
  input = JSON.parse(readFileSync(0, 'utf-8'));
} catch {
  process.exit(0);
}

const toolInput = input.tool_input || {};
const toolName = (input.tool_name || '') as string;

async function main() {
  // Only trigger for ISA.md (or legacy PRD.md) files in MEMORY/WORK/
  const filePath = toolInput.file_path || '';
  if (!filePath.includes('MEMORY/WORK/')) return;
  const isISA = filePath.endsWith('/' + ARTIFACT_FILENAME) || filePath.endsWith(ARTIFACT_FILENAME);
  const isLegacyPRD = filePath.endsWith('/' + LEGACY_ARTIFACT_FILENAME) || filePath.endsWith(LEGACY_ARTIFACT_FILENAME);
  if (!isISA && !isLegacyPRD) return;

  // v6.9.0: Read trigger — bump heartbeat on the slug, rebind UUID, debounced.
  // No file write-back, no rewind. Read alone never mutates the ISA.
  if (toolName === 'Read') {
    const slugMatch = filePath.match(/MEMORY\/WORK\/([^/]+)\//);
    if (slugMatch) bumpLastToolActivityBySlug(slugMatch[1], input.session_id);
    return;
  }

  // Use the actual file path that was just written/edited, not findLatestISA()
  // findLatestISA() scans all artifacts by mtime and can return the wrong file
  // when multiple sessions exist or when a file's mtime is bumped by git ops.
  const isaPath = filePath;
  if (!existsSync(isaPath)) return;

  const content = readFileSync(isaPath, 'utf-8');
  const fm = parseFrontmatter(content);
  if (!fm) return;

  // Check existing phase before sync to detect phase changes
  const newPhase = (fm.phase || '').toUpperCase();
  let oldPhase = '';
  if (fm.slug) {
    try {
      const registry = readRegistry();
      const existing = registry.sessions[fm.slug];
      if (existing) oldPhase = (existing.phase || '').toUpperCase();
    } catch { /* silent */ }
  }

  // Sync frontmatter + criteria to work.json (pass session_id for session name lookup)
  syncToWorkJson(fm, isaPath, content, input.session_id);

  // Update tab color when algorithm phase changes
  const VALID_PHASES = new Set(['OBSERVE', 'THINK', 'PLAN', 'BUILD', 'EXECUTE', 'VERIFY', 'LEARN', 'COMPLETE']);
  if (newPhase !== oldPhase && VALID_PHASES.has(newPhase) && input.session_id) {
    try {
      // Tier token ("E1".."E5") from ISA frontmatter effort; '' for untiered.
      const eLevel = effortToCanonicalELevel(fm.effort) || undefined;
      setPhaseTab(newPhase as AlgorithmTabPhase, input.session_id, undefined, eLevel);
    } catch (err) {
      console.error('[ISASync] setPhaseTab failed:', err);
    }
  }

  // ─────────── HTML Mirror trigger 1 (v6.5.0 ISA HTML Mirror) ───────────
  // Fire ISARender ONLY on transition to `complete`. Per-phase changes during
  // active work do NOT fire renders — user-stated constraint:
  //   "lots of phase changes as it's being written; we don't want to be
  //    constantly remaking the HTML file."
  if (newPhase === 'COMPLETE' && oldPhase !== 'COMPLETE' && fm.slug) {
    try {
      const isaRender = join(getClaudeDir(), "LIFEOS/TOOLS/ISARender.ts");
      const proc = spawn('bun', [isaRender, isaPath], {
        detached: true,
        stdio: 'ignore',
      });
      proc.unref();
    } catch (err) {
      console.error('[ISASync] ISARender spawn failed:', err);
    }
  }

  // ─────────── HTML Mirror trigger 2 — session state tracking ───────────
  // Record this edit so ISARenderOnStop.hook.ts can decide whether to render
  // at end-of-turn. The Stop hook gates on ISA.html already existing, so
  // pre-completion edits never trigger renders even though they show up here.
  if (input.session_id) {
    try {
      const stateDir = join(getClaudeDir(), "LIFEOS/MEMORY/STATE/isa-render-debounce");
      const stateFile = join(stateDir, `${input.session_id}.json`);
      const { mkdirSync, writeFileSync } = require('fs');
      mkdirSync(stateDir, { recursive: true });
      let edited: string[] = [];
      if (existsSync(stateFile)) {
        try { edited = JSON.parse(readFileSync(stateFile, 'utf-8')).edited_isas || []; } catch {}
      }
      if (!edited.includes(isaPath)) edited.push(isaPath);
      writeFileSync(stateFile, JSON.stringify({ session_id: input.session_id, edited_isas: edited, updated: new Date().toISOString() }));
    } catch { /* silent — state-tracking failure must not break sync */ }
  }

}

main().catch(() => {}).finally(() => {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
});
