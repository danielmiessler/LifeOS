#!/usr/bin/env bun
/**
 * PRDSync.hook.ts — Read-only PRD → work.json sync via PostToolUse
 *
 * TRIGGER: PostToolUse (Write, Edit)
 *
 * v3.2.0: Hooks are READ-ONLY from PRD's perspective.
 * The AI writes all PRD content directly (criteria, checkboxes, frontmatter).
 * This hook ONLY reads the PRD and syncs to work.json for the dashboard.
 *
 * - Write/Edit on PRD.md → read frontmatter + criteria → sync to work.json
 */

import { readFileSync, existsSync } from 'fs';
import {
  parseFrontmatter,
  syncToWorkJson,
  readRegistry,
} from './lib/prd-utils';
import { setPhaseTab } from './lib/tab-setter';
import type { AlgorithmTabPhase } from './lib/tab-constants';

let input: any;
try {
  input = JSON.parse(readFileSync(0, 'utf-8'));
} catch {
  process.exit(0);
}

const toolInput = input.tool_input || {};

async function main() {
  // Only trigger for PRD.md files in MEMORY/WORK/
  const filePath = toolInput.file_path || '';
  if (!filePath.includes('MEMORY/WORK/') || !filePath.endsWith('PRD.md')) return;

  // Use the actual file path that was just written/edited, not findLatestPRD()
  // findLatestPRD() scans all PRDs by mtime and can return the wrong file
  // when multiple sessions exist or when a file's mtime is bumped by git ops.
  const prdPath = filePath;
  if (!existsSync(prdPath)) return;

  const content = readFileSync(prdPath, 'utf-8');
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
  syncToWorkJson(fm, prdPath, content, input.session_id);

  // Update tab color when algorithm phase changes
  const VALID_PHASES = new Set(['OBSERVE', 'THINK', 'PLAN', 'BUILD', 'EXECUTE', 'VERIFY', 'LEARN', 'COMPLETE']);
  if (newPhase !== oldPhase && VALID_PHASES.has(newPhase) && input.session_id) {
    try {
      setPhaseTab(newPhase as AlgorithmTabPhase, input.session_id);
    } catch (err) {
      console.error('[PRDSync] setPhaseTab failed:', err);
    }
  }

}

main().catch(() => {}).finally(() => {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
});
