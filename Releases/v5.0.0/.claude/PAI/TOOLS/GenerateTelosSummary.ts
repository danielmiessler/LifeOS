#!/usr/bin/env bun
/**
 * GenerateTelosSummary.ts — Reads TELOS source files and generates a compressed
 * ~60-line summary for boot context loading.
 *
 * Usage: bun run ~/.claude/PAI/TOOLS/GenerateTelosSummary.ts
 *
 * Reads from: ~/.claude/PAI/USER/TELOS/*.md (source files)
 * Writes to:  ~/.claude/PAI/USER/TELOS/PRINCIPAL_TELOS.md
 *
 * Design decisions (from Council debate 2026-03-26):
 * - Generated, never hand-authored (Reed's precondition)
 * - Structural compression preserving causal links (M→G→P→S chains)
 * - ~60 lines targeting signal density over completeness (Nyx's constraint)
 * - Staleness detection via timestamp (Vex's TTL requirement)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const TELOS_DIR = join(process.env.HOME || '', '.claude/PAI/USER/TELOS');
const OUTPUT_PATH = join(TELOS_DIR, 'PRINCIPAL_TELOS.md');

interface ParsedItem {
  id: string;
  text: string;
}

/**
 * Truncate text at word boundary, adding ellipsis if needed
 */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.substring(0, max).replace(/\s+\S*$/, '');
  return cut + '...';
}

function readTelosFile(filename: string): string {
  const path = join(TELOS_DIR, filename);
  if (!existsSync(path)) return '';
  return readFileSync(path, 'utf-8');
}

/**
 * Parse items in format "- **ID**: text" or "- ID: text"
 */
function parseItems(content: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    // Match all four bullet styles: "- **M0**: text", "- **M0:** text",
    // "- M0: text", and "- M0:** text". Optional ** before AND after the
    // colon handles the template/parser drift identified in upstream #1113.
    const match = line.match(/^-\s+\*?\*?(\w+)\*?\*?:\*?\*?\s*(.+)/);
    if (match) {
      items.push({ id: match[1], text: match[2].trim() });
    }
  }
  return items;
}

/**
 * Parse mission items from MISSION.md
 */
function parseMissions(): string[] {
  const content = readTelosFile('MISSION.md');
  const items = parseItems(content);
  return items.map(i => `- **${i.id}**: ${truncate(i.text, 75)}`);
}

/**
 * Parse goals from GOALS.md by walking section headers, not by ID heuristic.
 * Section headers (## Active / ## Deferred / ## Ongoing / ## Completed) drive
 * classification — fixes upstream #1115 where G2 was misclassified as deferred
 * because the old code used `num >= 9 || [0,1].includes(num)`.
 */
function parseGoals(): {
  active: string[];
  deferredIds: string[];
  deferredPlain: string[];
} {
  const content = readTelosFile('GOALS.md');
  const active: string[] = [];
  const deferredIds: string[] = [];
  const deferredPlain: string[] = [];

  type Section = 'active' | 'deferred' | 'completed' | 'other';
  let currentSection: Section = 'other';

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trimEnd();

    // Only top-level (##) headings switch the section. Sub-headings like
    // `### Work`, `### Home`, `### Tech / PAI` are children of the parent
    // section and must inherit it (otherwise G0-G7 under `## Active` →
    // `### Work` get classified as 'other' and silently dropped).
    const headerMatch = line.match(/^##\s+(.+?)\s*$/);
    if (headerMatch) {
      const h = headerMatch[1].toLowerCase();
      if (h.startsWith('active')) currentSection = 'active';
      else if (h.startsWith('deferred') || h.startsWith('ongoing')) currentSection = 'deferred';
      else if (h.startsWith('completed')) currentSection = 'completed';
      else currentSection = 'other';
      continue;
    }

    if (currentSection === 'other') continue;

    const idMatch = line.match(/^-\s+\*?\*?(\w+)\*?\*?:\*?\*?\s*(.+)/);
    if (idMatch) {
      const id = idMatch[1];
      const text = idMatch[2].trim();
      const firstSentence = text.split(/\s—\s|(?<!\w\.\w)(?<=\w)\.\s/)[0].trim();

      if (currentSection === 'active') {
        active.push(`- **${id}**: ${truncate(firstSentence, 70)}`);
      } else {
        // deferred or completed → both go to deferredIds (the inline ID-list line)
        deferredIds.push(id);
      }
      continue;
    }

    // Plain bullet without ID — used by Deferred / Ongoing / Completed items
    // in the shipped template. These were silently dropped in upstream #1115.
    const plainMatch = line.match(/^-\s+(.+)/);
    if (plainMatch) {
      const text = plainMatch[1].trim();
      const firstSentence = text.split(/\s—\s|(?<!\w\.\w)(?<=\w)\.\s/)[0].trim();

      // Skip template placeholders like `*(none recorded yet — update as items ship)*`
      if (/^\*?\(.*(none|tbd|placeholder)/i.test(firstSentence)) continue;

      if (currentSection === 'deferred' || currentSection === 'completed') {
        // Strip surrounding **bold** so we keep just the name for the inline list.
        const bare = firstSentence.replace(/^\*\*(.+?)\*\*.*$/, '$1');
        deferredPlain.push(truncate(bare, 60));
      } else if (currentSection === 'active') {
        // Active without ID — uncommon but render directly so it isn't lost.
        active.push(`- ${truncate(firstSentence, 70)}`);
      }
    }
  }

  return { active, deferredIds, deferredPlain };
}

/**
 * Parse problems from PROBLEMS.md (uses ## headers, not list items)
 */
function parseProblems(): string[] {
  const content = readTelosFile('PROBLEMS.md');
  const lines: string[] = [];

  // Format: ## P0: Title (optional parenthetical)
  const headers = [...content.matchAll(/^##\s+(P\d+):\s*(.+?)(?:\s*\(.*\))?\s*$/gm)];
  for (const match of headers) {
    const title = match[2].trim();
    const short = title.length > 60 ? title.substring(0, 57) + '...' : title;
    lines.push(`- **${match[1]}**: ${short}`);
  }

  // Fallback: try list items
  if (lines.length === 0) {
    const items = parseItems(content);
    for (const item of items) {
      const title = item.text.split(/[—-]/)[0].trim().replace(/\*\*/g, '');
      lines.push(`- **${item.id}**: ${title}`);
    }
  }

  return lines;
}

/**
 * Parse strategies from STRATEGIES.md.
 *
 * The shipped template stores strategies as bullets (`- **S0:** Kaizen…`)
 * under `## Active` / `## Anti-Strategies`, not as `## S0:` headers — the
 * old header-only regex returned an empty list (upstream #1113). Use the
 * shared bullet parser; it now picks up Sn AND An entries.
 */
function parseStrategies(): string[] {
  const content = readTelosFile('STRATEGIES.md');
  const items = parseItems(content);
  return items
    .filter(i => /^[SA]\d+$/.test(i.id))
    .map(i => `- **${i.id}**: ${truncate(i.text, 80)}`);
}

/**
 * Parse narratives from NARRATIVES.md
 */
function parseNarratives(): { primary: string[]; secondary: string[] } {
  const content = readTelosFile('NARRATIVES.md');
  const items = parseItems(content);

  const primary: string[] = [];
  const secondary: string[] = [];

  for (const item of items) {
    const num = parseInt(item.id.replace(/\D/g, ''), 10);

    if ([0, 1, 7].includes(num)) {
      primary.push(`- **${item.id}**: ${truncate(item.text, 75)}`);
    } else {
      secondary.push(`${item.id}: ${truncate(item.text, 60)}`);
    }
  }

  return { primary, secondary };
}

/**
 * Parse challenges from CHALLENGES.md (all items — truncation was hiding real scope)
 */
function parseChallenges(): string[] {
  const content = readTelosFile('CHALLENGES.md');
  const items = parseItems(content);
  return items.map(i => `- **${i.id}**: ${truncate(i.text, 90)}`);
}

/**
 * Parse WRONG.md — plain bullets without IDs. Each bullet is a past mistake.
 */
function parseWrong(): string[] {
  const content = readTelosFile('WRONG.md');
  const lines = content.split('\n');
  const out: string[] = [];
  for (const line of lines) {
    const m = line.match(/^-\s+(.+)$/);
    if (m) out.push(`- ${truncate(m[1].trim(), 110)}`);
  }
  return out;
}

/**
 * Parse TRAUMAS.md — formative experiences with TR0/TR1/TR2 IDs.
 */
function parseTraumas(): string[] {
  const content = readTelosFile('TRAUMAS.md');
  const items = parseItems(content);
  return items.map(i => `- **${i.id}**: ${truncate(i.text, 90)}`);
}

/**
 * Parse models from MODELS.md (first sentence only)
 */
function parseModels(): string[] {
  const content = readTelosFile('MODELS.md');
  const items = parseItems(content);
  return items.slice(0, 3).map(i => {
    const first = i.text.split(/\.\s/)[0].trim();
    return `- ${truncate(first, 65)}`;
  });
}

function generate(): string {
  const now = new Date().toISOString();
  const missions = parseMissions();
  const goals = parseGoals();
  const problems = parseProblems();
  const strategies = parseStrategies();
  const narratives = parseNarratives();
  const challenges = parseChallenges();
  const wrong = parseWrong();
  const traumas = parseTraumas();
  const models = parseModels();

  const lines: string[] = [
    '# Principal TELOS — {{PRINCIPAL_FULL_NAME}}',
    '',
    '> Auto-generated from TELOS source files. Do not edit manually.',
    `> Generated: ${now} | Sources: MISSION, GOALS, PROBLEMS, STRATEGIES, NARRATIVES, CHALLENGES, WRONG, TRAUMAS, MODELS`,
    '',
    '## Missions',
    '',
    ...missions,
    '',
    '## Active Goals (2026)',
    '',
    ...goals.active,
  ];

  if (goals.deferredIds.length > 0) {
    lines.push('', `_Deferred (full text in TELOS/GOALS.md): ${goals.deferredIds.join(', ')}_`);
  }
  if (goals.deferredPlain.length > 0) {
    // Plain bullets without IDs from Deferred / Ongoing / Completed sections —
    // render as a single compact inline line so they aren't silently dropped (#1115).
    lines.push(`_Ongoing: ${goals.deferredPlain.join(', ')}_`);
  }

  lines.push(
    '',
    '## Problems Being Solved',
    '',
    ...problems,
    '',
    '## Strategies',
    '',
    ...strategies,
    '',
    '## Active Narratives',
    '',
    ...narratives.primary,
  );

  if (narratives.secondary.length > 0) {
    lines.push(...narratives.secondary.map(n => `- ${n}`));
  }

  lines.push(
    '',
    '## Personal Challenges',
    '',
    ...challenges,
  );

  if (traumas.length > 0) {
    lines.push('', '## Formative Experiences (Traumas)', '', ...traumas);
  }

  if (wrong.length > 0) {
    lines.push('', '## Things I\'ve Been Wrong About (Mistakes)', '', ...wrong);
  }

  lines.push(
    '',
    '## Core Models',
    '',
    ...models,
    '',
    '## Context Filter',
    '',
    'When steering work, bias toward: human flourishing, Human 3.0 transition, AI augmentation strategies, becoming one\'s full self, correct framing.',
  );

  return lines.join('\n') + '\n';
}

// Main
const summary = generate();
writeFileSync(OUTPUT_PATH, summary);
const lineCount = summary.split('\n').length;
console.log(`✅ Generated PRINCIPAL_TELOS.md (${lineCount} lines) at ${OUTPUT_PATH}`);
console.error(`📋 TELOS summary regenerated: ${lineCount} lines from source files`);
