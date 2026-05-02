#!/usr/bin/env bun
/**
 * TelosSummarySync.hook.ts — Auto-regenerate PRINCIPAL_TELOS.md when TELOS source files change
 *
 * TRIGGER: PostToolUse (Write, Edit)
 *
 * When any file in ~/.claude/PAI/USER/TELOS/ is written or edited (except
 * PRINCIPAL_TELOS.md itself and Backups/), regenerates the summary by running
 * GenerateTelosSummary.ts.
 *
 * Design origin: Council debate 2026-03-26 — Reed's precondition that the
 * summary must be generated, never hand-authored, and staleness must be
 * structurally impossible.
 */

import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { paiPath } from './lib/paths';

const TELOS_DIR = paiPath('USER', 'TELOS');
const GENERATOR = paiPath("TOOLS", 'GenerateTelosSummary.ts');

let input: any;
try {
  input = JSON.parse(readFileSync(0, 'utf-8'));
} catch {
  process.exit(0);
}

const filePath: string = input.tool_input?.file_path || '';

// Only trigger for TELOS source files
if (!filePath.includes('/USER/TELOS/')) process.exit(0);

// Don't trigger for the summary itself or backups
if (filePath.endsWith('PRINCIPAL_TELOS.md')) process.exit(0);
if (filePath.includes('/Backups/')) process.exit(0);
if (filePath.endsWith('updates.md')) process.exit(0);

try {
  execSync(`bun run ${GENERATOR}`, { timeout: 5000, stdio: 'pipe' });
  console.error('📋 TELOS summary auto-regenerated after source file change');
} catch (err) {
  console.error(`⚠️ TELOS summary regeneration failed: ${err}`);
}

process.exit(0);
