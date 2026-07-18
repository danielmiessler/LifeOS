#!/usr/bin/env bun
/**
 * GenerateTelosSummary.ts — Reads TELOS source files and generates a compressed
 * ~60-line summary for boot context loading.
 *
 * Usage: bun run ~/.claude/LIFEOS/TOOLS/GenerateTelosSummary.ts
 *
 * Reads from: ~/.claude/LIFEOS/USER/TELOS/*.md (source files)
 * Writes to:  ~/.claude/LIFEOS/USER/TELOS/PRINCIPAL_TELOS.md
 *
 * Design decisions (from Council debate 2026-03-26):
 * - Generated, never hand-authored (Reed's precondition)
 * - Structural compression preserving causal links (M→G→P→S chains)
 * - ~60 lines targeting signal density over completeness (Nyx's constraint)
 * - Staleness detection via timestamp (Vex's TTL requirement)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { paiUserDir } from './LifeosConfig';
import { claudeDir } from "./lifeos-root";

const TELOS_DIR = join(paiUserDir(), 'TELOS');
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

// Map legacy filename → H2 section name in unified TELOS.md.
// LIFEOS/USER/TELOS/TELOS.md is the single source of truth as of 2026-05-01;
// the per-file reads here fall back to that section when the legacy file
// has been archived (Archive/2026-05-01/<filename>).
const LEGACY_FILE_TO_SECTION: Record<string, string> = {
  'MISSION.md':    'mission',
  'GOALS.md':      'goals',
  'PROBLEMS.md':   'problems',
  'STRATEGIES.md': 'strategies',
  'CHALLENGES.md': 'challenges',
  'NARRATIVES.md': 'narratives',
  'TRAUMAS.md':    'traumas',
  'WRONG.md':      'wrong',
  'MODELS.md':     'models',
  'BELIEFS.md':    'beliefs',
  'FRAMES.md':     'frames',
  'WISDOM.md':     'wisdom',
  'PREDICTIONS.md':'predictions',
};

let _telosSectionsCache: Record<string, string> | null = null;
function loadTelosSections(): Record<string, string> {
  if (_telosSectionsCache) return _telosSectionsCache;
  const telosPath = join(TELOS_DIR, 'TELOS.md');
  if (!existsSync(telosPath)) {
    _telosSectionsCache = {};
    return _telosSectionsCache;
  }
  const content = readFileSync(telosPath, 'utf-8');
  const sections: Record<string, string> = {};
  const lines = content.split('\n');
  let title: string | null = null;
  let body: string[] = [];
  const flush = () => {
    if (title === null) return;
    sections[title.toLowerCase()] = body.join('\n').trim();
  };
  for (const line of lines) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) {
      flush();
      title = m[1].replace(/\s*[—–-].*$/, '').replace(/\s*\(.*\)\s*$/, '').trim();
      body = [];
    } else if (title !== null) {
      body.push(line);
    }
  }
  flush();
  _telosSectionsCache = sections;
  return sections;
}

function readTelosFile(filename: string): string {
  // Legacy per-file path first (back-compat), then unified-TELOS section.
  const path = join(TELOS_DIR, filename);
  if (existsSync(path)) return readFileSync(path, 'utf-8');
  const sectionKey = LEGACY_FILE_TO_SECTION[filename];
  if (sectionKey) {
    const sections = loadTelosSections();
    return sections[sectionKey] ?? '';
  }
  return '';
}

/**
 * Parse items in format "- **ID**: text", "- ID: text", or H3 heading "### ID: text".
 * The unified TELOS.md uses H3 headings (### M0:, ### G0:, etc.) for typed-ID
 * sections (Mission, Goals, Problems, Challenges) — bullets in others (Narratives,
 * Models, Wisdom). Accept both shapes so the parser doesn't silently render empty
 * sections when the source format shifts.
 */
function parseItems(content: string, fallbackPrefix?: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    // Bullet form: "- **M0**: text", "- M0: text", or colon-inside-bold "- **M0:** text".
    // The trailing asterisk strip handles the colon-inside-bold shape, which
    // otherwise leaks a literal "** " into the rendered summary (issue #1113).
    const bullet = line.match(/^-\s+\*?\*?([A-Z]+\d+\w?)\*?\*?:\s*(.+)/);
    if (bullet) {
      items.push({ id: bullet[1], text: bullet[2].replace(/^\*+\s*/, '').trim() });
      continue;
    }
    // H3 heading form: "### M0: text" (the unified TELOS.md style)
    const heading = line.match(/^#{3}\s+([A-Z]+\d+\w?):\s*(.+)/);
    if (heading) {
      items.push({ id: heading[1], text: heading[2].trim() });
    }
  }
  // Fallback: ID-less prose (2026-06-08 TELOS rewrite). Explicit IDs always win;
  // this path only runs when zero ID-form items matched.
  if (items.length === 0 && fallbackPrefix) {
    return paragraphItems(content, fallbackPrefix);
  }
  return items;
}

/**
 * ID-less prose: each blank-line-separated paragraph is one item, ID assigned
 * positionally (prefix + index). Positional IDs shift if paragraphs reorder —
 * acceptable; the source format carries no stable IDs to preserve.
 */
function paragraphItems(content: string, prefix: string): ParsedItem[] {
  return content
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0 && !/^-{3,}$/.test(p) && !p.startsWith('#'))
    .map((p, i) => ({ id: `${prefix}${i}`, text: p.replace(/\s*\n\s*/g, ' ').replace(/^-\s+/, '').trim() }));
}

/**
 * Parse mission items from MISSION.md
 */
function parseMissions(): string[] {
  const content = readTelosFile('MISSION.md');
  const items = parseItems(content, 'M');
  return items.map(i => `- **${i.id}**: ${truncate(i.text, 75)}`);
}

/**
 * Parse goals from GOALS.md, section-aware (issue #1115).
 *
 * Goals are classified by the "## Active" / "## Deferred / Ongoing" /
 * "## Completed This Year" heading each bullet sits under — the shape the
 * shipped GOALS.md template uses. Content before any recognized heading (or a
 * file/section with no headings at all, like the unified TELOS.md goals
 * section) is active. Bullets without explicit IDs get positional IDs so the
 * template's plain-bullet Deferred/Completed sections render instead of being
 * silently dropped. (Replaces the old num>=9/[0,1] numeric heuristic, which
 * encoded one personal file's history and misclassified everyone else's goals.)
 */
function parseGoals(): { active: string[]; deferred: string[]; completed: string[] } {
  const content = readTelosFile('GOALS.md');

  type Bucket = 'active' | 'deferred' | 'completed';
  const bucketOf = (heading: string): Bucket | null => {
    const h = heading.toLowerCase();
    if (h.includes('active')) return 'active';
    if (h.includes('deferred') || h.includes('ongoing')) return 'deferred';
    if (h.includes('completed') || h.includes('done')) return 'completed';
    return null; // unrecognized heading (e.g. "## Notes") — not goal content
  };

  const sectionLines: Record<Bucket, string[]> = { active: [], deferred: [], completed: [] };
  let current: Bucket | null = 'active';
  for (const line of content.split('\n')) {
    const m = line.match(/^##\s+(.+)/);
    if (m) {
      current = bucketOf(m[1]);
      continue;
    }
    if (current) sectionLines[current].push(line);
  }

  // Parse one bucket: explicit-ID items first, then plain "- text" bullets,
  // then ID-less prose paragraphs. IDs left empty here get positional IDs
  // assigned globally below (in document order, across buckets).
  const parseBucket = (lines: string[]): ParsedItem[] => {
    const text = lines.join('\n');
    const withIds = parseItems(text);
    if (withIds.length > 0) return withIds;
    const bullets = lines
      .map(l => l.match(/^-\s+(.+)$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map(m => ({ id: '', text: m[1].trim() }));
    if (bullets.length > 0) return bullets;
    return paragraphItems(text, '').map(i => ({ id: '', text: i.text }));
  };

  const parsed: Record<Bucket, ParsedItem[]> = {
    active: parseBucket(sectionLines.active),
    deferred: parseBucket(sectionLines.deferred),
    completed: parseBucket(sectionLines.completed),
  };

  let idx = 0;
  const format = (items: ParsedItem[], max: number): string[] =>
    items.map(item => {
      const id = item.id || `G${idx}`;
      idx++;
      // Split on " — " (em-dash with spaces) or sentence-ending period (not in URLs)
      const firstSentence = item.text.split(/\s—\s|(?<!\w\.\w)(?<=\w)\.\s/)[0].trim();
      return `- **${id}**: ${truncate(firstSentence, max)}`;
    });

  return {
    active: format(parsed.active, 70),
    deferred: format(parsed.deferred, 50),
    completed: format(parsed.completed, 50),
  };
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

  // Fallback: try list items, then ID-less prose
  if (lines.length === 0) {
    const items = parseItems(content, 'P');
    for (const item of items) {
      const title = item.text.split(/\s[—–]\s/)[0].trim().replace(/\*\*/g, '');
      lines.push(`- **${item.id}**: ${truncate(title, 60)}`);
    }
  }

  return lines;
}

/**
 * Parse strategies from STRATEGIES.md
 */
function parseStrategies(): string[] {
  const content = readTelosFile('STRATEGIES.md');
  const lines: string[] = [];

  // Extract strategy headers: ## S0: name or ### S1: name
  const headers = [...content.matchAll(/^#{2,3}\s+(S\d+):\s*(.+?)(?:\s*\(.*\))?\s*$/gm)];
  for (const match of headers) {
    const short = match[2].length > 60 ? match[2].substring(0, 57) + '...' : match[2];
    lines.push(`- **${match[1]}**: ${short}`);
  }

  // Fallback: ID-less prose
  if (lines.length === 0) {
    for (const item of parseItems(content, 'S')) {
      lines.push(`- **${item.id}**: ${truncate(item.text, 60)}`);
    }
  }

  return lines;
}

/**
 * Parse narratives from NARRATIVES.md
 */
function parseNarratives(): { primary: string[]; secondary: string[] } {
  const content = readTelosFile('NARRATIVES.md');
  const items = parseItems(content, 'N');

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
  const items = parseItems(content, 'C');
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
  // Fallback: ID-less prose
  if (out.length === 0) {
    for (const item of paragraphItems(content, 'W')) {
      out.push(`- ${truncate(item.text, 110)}`);
    }
  }
  return out;
}

/**
 * Parse TRAUMAS.md — formative experiences with TR0/TR1/TR2 IDs.
 */
function parseTraumas(): string[] {
  const content = readTelosFile('TRAUMAS.md');
  const items = parseItems(content, 'TR');
  return items.map(i => `- **${i.id}**: ${truncate(i.text, 90)}`);
}

/**
 * Resolve the principal's display name at runtime (issue #1140). No name — and
 * no installer placeholder — is baked into this source: the installer's
 * substitution walk doesn't cover LIFEOS/TOOLS, so a baked {{PRINCIPAL_FULL_NAME}}
 * token ships literal on fresh installs. Resolution order:
 *   1. PRINCIPAL_IDENTITY.md frontmatter core.full_name
 *   2. PRINCIPAL_IDENTITY.md H1 ("# Principal Identity — <name>")
 *   3. PRINCIPAL_IDENTITY.md frontmatter core.name
 *   4. settings.json principal.name
 * Returns '' when nothing resolves (title renders without the suffix).
 */
function principalDisplayName(): string {
  const looksLikeToken = (s: string) => s.includes('{{') || s.includes('<INTERVIEW');
  const idPath = join(paiUserDir(), 'PRINCIPAL', 'PRINCIPAL_IDENTITY.md');
  let coreName = '';
  if (existsSync(idPath)) {
    const content = readFileSync(idPath, 'utf-8');
    const fm = content.match(/^---\n([\s\S]*?)\n---/);
    if (fm) {
      const fullName = fm[1].match(/^\s*full_name:\s*["']?(.+?)["']?\s*$/m);
      if (fullName && !looksLikeToken(fullName[1])) return fullName[1].trim();
      const name = fm[1].match(/^\s*name:\s*["']?(.+?)["']?\s*$/m);
      if (name && !looksLikeToken(name[1])) coreName = name[1].trim();
    }
    const h1 = content.match(/^#\s+Principal Identity\s*[—–-]+\s*(.+?)\s*$/m);
    if (h1 && !looksLikeToken(h1[1])) return h1[1].trim();
  }
  if (coreName) return coreName;
  try {
    const settings = JSON.parse(readFileSync(join(claudeDir(), 'settings.json'), 'utf-8'));
    const name = settings?.principal?.name;
    if (typeof name === 'string' && name.trim() && !looksLikeToken(name)) return name.trim();
  } catch { /* no settings.json — fall through */ }
  return '';
}

/**
 * Parse models from MODELS.md (first sentence only)
 */
function parseModels(): string[] {
  const content = readTelosFile('MODELS.md');
  const items = parseItems(content, 'MD');
  return items.slice(0, 3).map(i => {
    const first = i.text.split(/\.\s/)[0].trim();
    return `- ${truncate(first, 65)}`;
  });
}

function generate(): string {
  const now = new Date().toISOString();
  const principalName = principalDisplayName();
  const missions = parseMissions();
  const goals = parseGoals();
  const problems = parseProblems();
  const strategies = parseStrategies();
  const narratives = parseNarratives();
  const challenges = parseChallenges();
  const wrong = parseWrong();
  const traumas = parseTraumas();
  const models = parseModels();

  // Per-section fail-loud guard: a core section whose SOURCE text is non-empty
  // but parses to zero items means the format drifted past the parser for that
  // section alone — the total-items guard in main() can't see a partial drop.
  const sections = loadTelosSections();
  const coreChecks: Array<[string, string, number]> = [
    ['mission', 'Missions', missions.length],
    ['goals', 'Goals', goals.active.length + goals.deferred.length + goals.completed.length],
    ['problems', 'Problems', problems.length],
    ['strategies', 'Strategies', strategies.length],
    ['challenges', 'Challenges', challenges.length],
  ];
  for (const [key, label, count] of coreChecks) {
    if ((sections[key] ?? '').trim().length > 0 && count === 0) {
      console.error(`❌ TELOS section "${label}" has source content but parsed to zero items — refusing to write a summary that silently drops it.`);
      process.exit(1);
    }
  }

  const lines: string[] = [
    '---',
    `last_updated: ${now}`,
    'last_updated_by: GenerateTelosSummary',
    'convention: pai-freshness-v1',
    'derived_from: LIFEOS/USER/TELOS/TELOS.md',
    'generator: LIFEOS/TOOLS/GenerateTelosSummary.ts',
    '---',
    '',
    principalName ? `# Principal TELOS — ${principalName}` : '# Principal TELOS',
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

  if (goals.deferred.length > 0) {
    // Compress deferred goals to a single inline line — they're not active and don't need full bullets
    const deferredIds = goals.deferred
      .map(line => line.match(/\*\*(\w+)\*\*/)?.[1])
      .filter(Boolean)
      .join(', ');
    lines.push('', `_Deferred (full text in TELOS/GOALS.md): ${deferredIds}_`);
  }

  if (goals.completed.length > 0) {
    const completedIds = goals.completed
      .map(line => line.match(/\*\*(\w+)\*\*/)?.[1])
      .filter(Boolean)
      .join(', ');
    lines.push('', `_Completed this year (full text in TELOS/GOALS.md): ${completedIds}_`);
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

// Main — fail-loud guard: never blank a populated summary. Zero parsed items
// means the source format drifted beyond the parser; keep the existing file.
const summary = generate();
const itemLines = summary.split('\n').filter(l => l.startsWith('- ')).length;
if (itemLines === 0) {
  console.error('❌ TELOS parse produced zero items — refusing to overwrite PRINCIPAL_TELOS.md. Fix the parser or the source format.');
  process.exit(1);
}
writeFileSync(OUTPUT_PATH, summary);
const lineCount = summary.split('\n').length;
console.log(`✅ Generated PRINCIPAL_TELOS.md (${lineCount} lines) at ${OUTPUT_PATH}`);
console.error(`📋 TELOS summary regenerated: ${lineCount} lines from source files`);
