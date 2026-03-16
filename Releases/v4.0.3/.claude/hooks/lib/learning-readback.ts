/**
 * learning-readback.ts - Close the learning loop by reading learnings back into context
 *
 * PURPOSE:
 * The PAI learning system writes extensively (8,400+ files across 5 hooks) but
 * previously had no readback mechanism. This library provides fast, compact
 * readers that LoadContext.hook.ts calls at session start to inject accumulated
 * knowledge back into the model's context.
 *
 * FUNCTIONS:
 * - loadLearningDigest()     — Learning signals weighted by rating (ALGORITHM + SYSTEM)
 * - loadWisdomFrames()       — Crystallized behavioral patterns (WISDOM/FRAMES)
 * - loadFailurePatterns()    — Failure root cause analysis (FAILURES)
 * - loadSynthesisPatterns()  — Aggregated pattern analysis (SYNTHESIS)
 * - loadSignalTrends()       — Performance metrics from learning-cache.sh
 *
 * PERFORMANCE:
 * Each function reads a bounded number of files. Total budget: <100ms combined.
 * All reads are synchronous for simplicity.
 *
 * OUTPUT:
 * Combined output targets ~2400 chars for context injection.
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface LearningEntry {
  rating: number;
  feedback: string;
  file: string;
}

/**
 * Check if two feedback strings are near-duplicates via word overlap.
 * Returns true if >60% of significant words (length > 3) are shared.
 */
function isDuplicate(a: string, b: string): boolean {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  if (wordsA.size === 0 || wordsB.size === 0) return false;
  const overlap = [...wordsA].filter(w => wordsB.has(w)).length;
  return overlap / Math.min(wordsA.size, wordsB.size) > 0.6;
}

/**
 * Scan learning files from a LEARNING subdirectory, weighted by rating.
 * Reads up to `scanCount` files across recent months, sorts by rating ascending
 * (lowest = most informative), deduplicates, and returns top `returnCount`.
 * Matches both **Feedback:** and **Sentiment Summary:** patterns.
 */
function getWeightedLearnings(
  baseDir: string,
  subdir: string,
  scanCount: number = 20,
  returnCount: number = 5,
): string[] {
  const entries: LearningEntry[] = [];
  const learningDir = join(baseDir, 'MEMORY', 'LEARNING', subdir);
  if (!existsSync(learningDir)) return [];

  try {
    const months = readdirSync(learningDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && /^\d{4}-\d{2}$/.test(d.name))
      .map(d => d.name)
      .sort()
      .reverse();

    let scanned = 0;
    for (const month of months) {
      if (scanned >= scanCount) break;
      const monthPath = join(learningDir, month);

      try {
        const files = readdirSync(monthPath)
          .filter(f => f.endsWith('.md'))
          .sort()
          .reverse();

        for (const file of files) {
          if (scanned >= scanCount) break;
          scanned++;
          try {
            const content = readFileSync(join(monthPath, file), 'utf-8');
            const feedbackMatch = content.match(/\*\*(?:Feedback|Sentiment Summary):\*\*\s*(.+)/);
            const ratingMatch = content.match(/rating:\s*(\d+)/);
            if (feedbackMatch && ratingMatch) {
              const rating = parseInt(ratingMatch[1], 10);
              const feedback = feedbackMatch[1].substring(0, 100).trim();
              // Skip generic neutral feedback that adds no signal
              if (rating >= 5 && /no emotional|neutral|technical request/i.test(feedback)) continue;
              entries.push({ rating, feedback, file });
            }
          } catch { /* skip unreadable files */ }
        }
      } catch { /* skip unreadable months */ }
    }
  } catch { /* skip if dir scan fails */ }

  // Sort by rating ascending (lowest = most informative)
  entries.sort((a, b) => a.rating - b.rating);

  // Deduplicate: skip entries whose feedback overlaps heavily with an already-selected entry
  const selected: LearningEntry[] = [];
  for (const entry of entries) {
    if (selected.length >= returnCount) break;
    const isDup = selected.some(s => isDuplicate(s.feedback, entry.feedback));
    if (!isDup) selected.push(entry);
  }

  return selected.map(e => `[${e.rating}/10] ${e.feedback}`);
}

/**
 * Load learning signals from ALGORITHM and SYSTEM directories.
 * Returns the lowest-rated (most informative) learnings, deduplicated.
 */
export function loadLearningDigest(paiDir: string, count: number = 5): string | null {
  const algorithmInsights = getWeightedLearnings(paiDir, 'ALGORITHM', 20, count);
  const systemInsights = getWeightedLearnings(paiDir, 'SYSTEM', 15, Math.min(count, 3));

  if (algorithmInsights.length === 0 && systemInsights.length === 0) return null;

  const parts: string[] = ['**Recent Learning Signals:**'];

  if (algorithmInsights.length > 0) {
    parts.push('*Algorithm:*');
    algorithmInsights.forEach(i => parts.push(`  ${i}`));
  }
  if (systemInsights.length > 0) {
    parts.push('*System:*');
    systemInsights.forEach(i => parts.push(`  ${i}`));
  }

  return parts.join('\n');
}

/**
 * Load Wisdom Frame core principles for context injection.
 * Reads all WISDOM/FRAMES/*.md files and extracts principle headers
 * (lines matching "### Name [CRYSTAL: N%]").
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
 * Load failure pattern insights with root cause analysis from CONTEXT.md.
 * Extracts the "What Happened" section for condensed behavioral lessons.
 */
export function loadFailurePatterns(paiDir: string, count: number = 5): string | null {
  const failuresDir = join(paiDir, 'MEMORY', 'LEARNING', 'FAILURES');
  if (!existsSync(failuresDir)) return null;

  const patterns: string[] = [];

  try {
    const months = readdirSync(failuresDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && /^\d{4}-\d{2}$/.test(d.name))
      .map(d => d.name)
      .sort()
      .reverse();

    for (const month of months) {
      if (patterns.length >= count) break;
      const monthPath = join(failuresDir, month);

      try {
        const dirs = readdirSync(monthPath, { withFileTypes: true })
          .filter(d => d.isDirectory())
          .map(d => d.name)
          .sort()
          .reverse();

        for (const dir of dirs) {
          if (patterns.length >= count) break;
          const contextPath = join(monthPath, dir, 'CONTEXT.md');
          if (!existsSync(contextPath)) continue;

          try {
            const content = readFileSync(contextPath, 'utf-8');
            const ratingMatch = content.match(/^rating:\s*(\d+)/m);
            const rating = ratingMatch ? ratingMatch[1] : '?';
            const dateMatch = dir.match(/^(\d{4}-\d{2}-\d{2})/);
            const date = dateMatch ? dateMatch[1] : '';

            // Extract first paragraph from "## What Happened" section
            const whatHappenedMatch = content.match(/## What Happened\n\n([\s\S]*?)(?=\n---|\n## )/);
            let lesson: string;
            if (whatHappenedMatch) {
              const firstParagraph = whatHappenedMatch[1].split('\n\n')[0].trim();
              // Take first 1-2 sentences, cap at 150 chars
              const sentenceEnd = firstParagraph.indexOf('. ', firstParagraph.indexOf('. ') + 1);
              const condensed = sentenceEnd > 0 && sentenceEnd < 150
                ? firstParagraph.substring(0, sentenceEnd + 1)
                : firstParagraph.split('. ')[0] + '.';
              lesson = condensed.substring(0, 150);
            } else {
              // Fallback to slug
              const slug = dir.replace(/^\d{4}-\d{2}-\d{2}-\d{6}_/, '').replace(/-/g, ' ');
              lesson = slug.substring(0, 70);
            }
            patterns.push(`[${rating}/10] ${date} ${lesson}`);
          } catch { /* skip unreadable */ }
        }
      } catch { /* skip unreadable months */ }
    }
  } catch { /* skip if dir scan fails */ }

  if (patterns.length === 0) return null;

  return `**Recent Failure Patterns (avoid these):**\n${patterns.map(p => `  ${p}`).join('\n')}`;
}

/**
 * Load aggregated pattern analysis from SYNTHESIS reports.
 * Reads the most recent synthesis file and extracts top issues + recommendations.
 */
export function loadSynthesisPatterns(paiDir: string): string | null {
  const synthesisDir = join(paiDir, 'MEMORY', 'LEARNING', 'SYNTHESIS');
  if (!existsSync(synthesisDir)) return null;

  try {
    const months = readdirSync(synthesisDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && /^\d{4}-\d{2}$/.test(d.name))
      .map(d => d.name)
      .sort()
      .reverse();

    for (const month of months) {
      const monthPath = join(synthesisDir, month);
      const files = readdirSync(monthPath)
        .filter(f => f.endsWith('-patterns.md'))
        .sort()
        .reverse();

      if (files.length === 0) continue;

      const content = readFileSync(join(monthPath, files[0]), 'utf-8');

      const topIssuesMatch = content.match(/## Top Issues\n\n([\s\S]*?)(?=\n## )/);
      const recommendationsMatch = content.match(/## Recommendations\n\n([\s\S]*?)(?=\n---|\n## |$)/);

      const parts: string[] = ['**Synthesis (auto-generated):**'];

      if (topIssuesMatch) {
        const issues = topIssuesMatch[1].trim().split('\n').filter(l => l.trim()).slice(0, 3);
        parts.push('*Top issues:*');
        issues.forEach(i => parts.push(`  ${i.trim()}`));
      }

      if (recommendationsMatch) {
        const recs = recommendationsMatch[1].trim().split('\n').filter(l => l.trim()).slice(0, 3);
        parts.push('*Actions:*');
        recs.forEach(r => parts.push(`  ${r.trim()}`));
      }

      if (parts.length === 1) return null;
      return parts.join('\n');
    }
  } catch { /* skip if dir scan fails */ }

  return null;
}

/**
 * Load performance signal trends from the pre-computed learning-cache.sh.
 * Extracts numeric averages and trend direction for a compact status line.
 */
export function loadSignalTrends(paiDir: string): string | null {
  const cachePath = join(paiDir, 'MEMORY', 'STATE', 'learning-cache.sh');
  if (!existsSync(cachePath)) return null;

  try {
    const content = readFileSync(cachePath, 'utf-8');

    // Parse shell variable assignments (key='value' or key=value)
    const vars: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const match = line.match(/^(\w+)='?([^']*)'?$/);
      if (match) vars[match[1]] = match[2];
    }

    const todayAvg = vars.today_avg || '?';
    const weekAvg = vars.week_avg || '?';
    const monthAvg = vars.month_avg || '?';
    const trend = vars.trend || 'stable';
    const totalCount = vars.total_count || '?';
    const dayTrend = vars.day_trend || 'stable';

    const trendEmoji = trend === 'up' ? 'trending up' : trend === 'down' ? 'trending down' : 'stable';

    return `**Performance Signals:** Today: ${todayAvg}/10 | Week: ${weekAvg}/10 | Month: ${monthAvg}/10 | Trend: ${trendEmoji} | Total signals: ${totalCount}`;
  } catch {
    return null;
  }
}
