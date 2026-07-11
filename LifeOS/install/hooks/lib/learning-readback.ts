/**
 * learning-readback.ts - Close the learning loop by reading learnings back into context
 *
 * PURPOSE:
 * The LifeOS learning system writes extensively, and this library provides the
 * fast, compact readback that LoadContext.hook.ts calls at session start.
 *
 * RATIONALE:
 * Session-start readback surfaces ONLY vetted constructive guidance (Wisdom
 * Frames + authored constructive corrections), never raw frustration or
 * aggregate metrics, because at session start there is no active plan to
 * apply them to. Raw signal stays in the corpus for the scheduled synthesis
 * batch; readback is an authored allowlist, not a denylist.
 *
 * FUNCTIONS:
 * - loadWisdomFrames()            -> Crystallized behavioral patterns (WISDOM/FRAMES)
 * - loadConstructiveCorrections() -> Authored corrections gated by recent corpus signals
 *
 * PERFORMANCE:
 * Each function reads a bounded set of pre-existing files.
 * Constructive correction scanning is limited to the 2 newest month
 * directories per source, 60 feedback lines total, and 30 failure slugs.
 * Total budget: <100ms combined. All reads are synchronous for simplicity.
 *
 * OUTPUT:
 * Each function returns a compact string (<500 chars) or null if no data.
 * Combined output stays under 2000 chars for context injection.
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

interface CorrectionClass {
  id: string;
  signal: RegExp;
  guidance: string;
}

// Authored allowlist: the only correction guidance readback may surface.
// Raw frustration text never appears here; recent corpus signals only decide
// WHICH vetted guidance strings are relevant right now.
export const CONSTRUCTIVE_CORRECTIONS: CorrectionClass[] = [
  {
    id: 'verify-before-claiming',
    signal: /\b(verify|verification|verified|confirm|confirmed|confirmation|proof|evidence|claimed?\s+(?:completion|complete|done|success)|claim(?:ed|ing)?\s+(?:completion|complete|done|success))\b/i,
    guidance: 'Verify before claiming: run the check that settles the question and show the evidence before you report success or completion.'
  },
  {
    id: 'dont-fabricate',
    signal: /\b(fabricat(?:e|ed|ing)|hallucinat(?:e|ed|ing)|invent(?:ed|ing)?|made\s+up|false\s+claim)\b/i,
    guidance: 'Do not fabricate: report only real tool output and observed facts; if something is unverified, say that plainly instead of presenting a guess as a result.'
  },
  {
    id: 'follow-the-plan',
    signal: /\b(follow(?:ing)?\s+plan|rest\s+of\s+plan|agreed\s+plan|should\s+have\s+stopped|stop\s+gate|running?\s+ahead|run\s+ahead)\b/i,
    guidance: 'Follow the plan and honor the stop gate: stay with the agreed plan, and when the stop gate fires, stop instead of running ahead.'
  }
];

interface CorpusScanOptions {
  maxMonths: number;
  maxItems: number;
  entryType: 'file' | 'directory';
  isCandidate: (entryName: string) => boolean;
  readEntryText: (monthPath: string, entryName: string) => string | null;
}

function scanRecentMonthEntries(rootDir: string, options: CorpusScanOptions): string[] {
  const entries: string[] = [];
  if (!existsSync(rootDir)) return entries;

  try {
    const months = readdirSync(rootDir, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && /^\d{4}-\d{2}$/.test(entry.name))
      .map(entry => entry.name)
      .sort()
      .reverse()
      .slice(0, options.maxMonths);

    for (const month of months) {
      if (entries.length >= options.maxItems) break;
      const monthPath = join(rootDir, month);

      try {
        const monthEntries = readdirSync(monthPath, { withFileTypes: true })
          .filter(entry => options.entryType === 'file' ? entry.isFile() : entry.isDirectory())
          .map(entry => entry.name)
          .filter(options.isCandidate)
          .sort()
          .reverse();

        for (const entryName of monthEntries) {
          if (entries.length >= options.maxItems) break;

          try {
            const text = options.readEntryText(monthPath, entryName);
            if (text) entries.push(text);
          } catch { /* skip unreadable files */ }
        }
      } catch { /* skip unreadable months */ }
    }
  } catch { /* skip if dir scan fails */ }

  return entries;
}

function readFeedbackLine(monthPath: string, fileName: string): string | null {
  const content = readFileSync(join(monthPath, fileName), 'utf-8');
  const feedbackMatch = content.match(/\*\*Feedback:\*\*\s*(.+)/);
  return feedbackMatch ? feedbackMatch[1].trim() : null;
}

function readFailureSlug(_monthPath: string, dirName: string): string | null {
  const slug = dirName
    .replace(/^\d{4}-\d{2}-\d{2}-\d{6}_/, '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return slug || null;
}

function collectRecentCorrectionCorpus(paiDir: string): string[] {
  const algorithmFeedback = scanRecentMonthEntries(
    join(paiDir, 'MEMORY', 'LEARNING', 'ALGORITHM'),
    {
      maxMonths: 2,
      maxItems: 30,
      entryType: 'file',
      isCandidate: entryName => entryName.endsWith('.md'),
      readEntryText: readFeedbackLine
    }
  );

  const systemFeedback = scanRecentMonthEntries(
    join(paiDir, 'MEMORY', 'LEARNING', 'SYSTEM'),
    {
      maxMonths: 2,
      maxItems: 30,
      entryType: 'file',
      isCandidate: entryName => entryName.endsWith('.md'),
      readEntryText: readFeedbackLine
    }
  );

  const failureSlugs = scanRecentMonthEntries(
    join(paiDir, 'MEMORY', 'LEARNING', 'FAILURES'),
    {
      maxMonths: 2,
      maxItems: 30,
      entryType: 'directory',
      isCandidate: () => true,
      readEntryText: readFailureSlug
    }
  );

  return [...algorithmFeedback, ...systemFeedback, ...failureSlugs];
}

/**
 * Load Wisdom Frame core principles for context injection.
 * Reads all WISDOM/FRAMES/*.md files and extracts principle headers
 * (lines matching "### Name [CRYSTAL: N%]"). Only crystallized principles
 * (>= 85% confidence) are surfaced.
 */
export function loadWisdomFrames(paiDir: string): string | null {
  const framesDir = join(paiDir, 'MEMORY', 'WISDOM', 'FRAMES');
  if (!existsSync(framesDir)) return null;

  const principles: string[] = [];

  try {
    const files = readdirSync(framesDir).filter(f => f.endsWith('.md'));

    for (const file of files) {
      try {
        const content = readFileSync(join(framesDir, file), 'utf-8');
        const domain = file.replace('.md', '');

        // Extract principle headers with CRYSTAL confidence
        const matches = content.matchAll(/^### (.+?) \[CRYSTAL: (\d+)%\]/gm);
        for (const match of matches) {
          const confidence = parseInt(match[2], 10);
          if (confidence >= 85) {
            principles.push(`[${domain}] ${match[1]} (${confidence}%)`);
          }
        }
      } catch { /* skip unreadable frames */ }
    }
  } catch { /* skip if dir scan fails */ }

  if (principles.length === 0) return null;

  return `**Wisdom Frames (high confidence):**\n${principles.map(p => `  ${p}`).join('\n')}`;
}

/**
 * Load authored constructive corrections when current corpus signals indicate
 * they are relevant. Recent ALGORITHM/SYSTEM feedback lines and FAILURES slugs
 * are scanned only to decide which vetted guidance strings to surface; the
 * raw corpus text itself is never injected.
 */
export function loadConstructiveCorrections(paiDir: string): string | null {
  const corpus = collectRecentCorrectionCorpus(paiDir);
  if (corpus.length === 0) return null;

  const surfaced = new Set<string>();
  const guidance: string[] = [];

  for (const correction of CONSTRUCTIVE_CORRECTIONS) {
    if (surfaced.has(correction.id)) continue;

    const hasHit = corpus.some(text => correction.signal.test(text));
    if (!hasHit) continue;

    surfaced.add(correction.id);
    guidance.push(`  ${correction.guidance}`);
  }

  if (guidance.length === 0) return null;

  return `**Constructive Corrections:**\n${guidance.join('\n')}`;
}
