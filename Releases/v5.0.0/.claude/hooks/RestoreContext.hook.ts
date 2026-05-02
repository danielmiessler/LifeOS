#!/usr/bin/env bun
/**
 * RestoreContext.hook.ts - Re-inject Contextual Knowledge After Compaction (PostCompact)
 *
 * TRIGGER: PostCompact (fires after conversation compaction completes)
 *
 * Counterpart to LoadContext.hook.ts (SessionStart). After compaction, contextual
 * knowledge (projects, identity details) gets compressed away. Constitutional rules
 * live in the system prompt (PAI_SYSTEM_PROMPT.md) which survives compression natively,
 * so this hook only restores contextual files that compaction discards.
 *
 * Tier 1 (MUST restore — contextual knowledge):
 *   - Files listed in settings.json postCompactRestore.fullFiles
 *   - Default: PROJECTS.md — project routing table for context switching
 *
 * Tier 2 (SHOULD restore — identity anchors):
 *   - DA_IDENTITY.md critical sections — first-person voice, pronouns, cussing protocol
 *   - Active ISA (if touched in last 60min)
 *   - TELOS/STATUS.md
 *
 * NOT restored (survives natively):
 *   - Constitutional rules (system prompt) — survives compression automatically
 *   - Steering rules — now in system prompt, not separate files
 *
 * Token budget: ~2K tokens (~0.2% of 1M context — negligible vs contextual value)
 */

import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { getPaiDir, paiPath } from '../PAI/lib/paths';
import { getSettingsPath } from './lib/paths';

interface PostCompactConfig {
  _docs?: string;
  fullFiles?: string[];
}

interface Settings {
  postCompactRestore?: PostCompactConfig;
  [key: string]: unknown;
}

function safeRead(path: string, maxLines?: number): string {
  try {
    if (!existsSync(path)) return '';
    const content = readFileSync(path, 'utf-8');
    if (maxLines) {
      return content.split('\n').slice(0, maxLines).join('\n');
    }
    return content;
  } catch {
    return '';
  }
}

/**
 * Extract specific sections from a markdown file by heading.
 * Returns content from each matched ## heading through the next ## heading.
 */
function extractSections(filePath: string, sectionNames: string[]): string {
  const content = safeRead(filePath);
  if (!content) return '';

  const lines = content.split('\n');
  const extracted: string[] = [];
  let capturing = false;
  let currentSection = '';

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+)/);
    if (headingMatch) {
      const heading = headingMatch[1].trim();
      capturing = sectionNames.some(name =>
        heading.toLowerCase().includes(name.toLowerCase())
      );
      if (capturing) {
        currentSection = line;
        extracted.push('');
        extracted.push(line);
      }
    } else if (capturing) {
      extracted.push(line);
    }
  }

  return extracted.join('\n').trim();
}

function loadSettings(): Settings {
  const settingsPath = getSettingsPath();
  if (existsSync(settingsPath)) {
    try {
      return JSON.parse(readFileSync(settingsPath, 'utf-8'));
    } catch {
      return {};
    }
  }
  return {};
}

function main() {
  const paiDir = getPaiDir();
  const settings = loadSettings();
  const parts: string[] = [];

  // --- Tier 1: Contextual knowledge (full file restore) ---
  // Constitutional rules are in the system prompt and survive compression natively.
  // Only contextual files (projects, etc.) need post-compact restoration.

  const defaultFullFiles = [
    'USER/PROJECTS/PROJECTS.md',
  ];

  const fullFiles = settings.postCompactRestore?.fullFiles ?? defaultFullFiles;
  let restoredCount = 0;

  for (const relPath of fullFiles) {
    const fullPath = join(paiDir, relPath);
    const content = safeRead(fullPath);
    if (content) {
      parts.push(content.trim());
      restoredCount++;
      console.error(`🔄 Restored: ${relPath} (${content.length} chars)`);
    } else {
      console.error(`⚠️ Not found: ${relPath}`);
    }
  }

  // --- Tier 2: Identity anchors (critical sections only) ---

  const identityPath = paiPath('USER', 'DA_IDENTITY.md');
  const identitySections = extractSections(identityPath, [
    'My Identity',
    'First-Person Voice',
    'Core Values',
    'Personality & Behavior',
    'Cussing & Frustration Protocol',
    'Relationship Model',
    'Pronoun Convention',
  ]);

  if (identitySections) {
    parts.push('# DA Identity (Critical Sections)\n');
    parts.push(identitySections);
    restoredCount++;
    console.error(`🔄 Restored: DA_IDENTITY critical sections (${identitySections.length} chars)`);
  }

  // Current work status
  const status = safeRead(paiPath('USER', 'TELOS', 'STATUS.md'), 20);
  if (status) {
    parts.push('## Current Status');
    parts.push(status);
  }

  // Active ISA if one exists in current session.
  // We look for ISA.md first (v4.1+ canonical) and fall back to PRD.md (legacy).
  try {
    const workDir = paiPath('MEMORY', 'WORK');
    const probe = (filename: string): string =>
      execSync(
        `fd -t f -n "${filename}" --changed-within 60min "${workDir}" 2>/dev/null | head -1`,
        { encoding: 'utf-8', timeout: 3000 }
      ).trim();
    const latestIsa = probe('ISA.md') || probe('PRD.md');
    if (latestIsa) {
      const isaContent = safeRead(latestIsa, 30);
      if (isaContent) {
        parts.push('## Active ISA (last 60min)');
        parts.push(isaContent);
      }
    }
  } catch {
    // Silent — fd not available or no recent artifacts
  }

  // --- Output ---

  if (parts.length > 0) {
    const output = [
      '--- PostCompact Context Restoration ---',
      '',
      ...parts,
      '',
      '---',
    ].join('\n');

    console.log(output);
    console.error(`✅ PostCompact: restored ${restoredCount} context sources (${output.length} chars)`);
  }

  process.exit(0);
}

main();
