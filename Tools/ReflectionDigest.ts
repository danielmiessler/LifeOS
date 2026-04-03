#!/usr/bin/env bun
/**
 * ReflectionDigest.ts — Extract failure patterns from Algorithm reflections
 *
 * Reads the algorithm-reflections.jsonl file, clusters failure patterns by
 * keyword, identifies low-sentiment sessions, and generates ranked heuristic
 * rules that close the reflection-to-action loop.
 *
 * Usage:
 *   bun ReflectionDigest.ts            # Write digest to MEMORY/LEARNING/
 *   bun ReflectionDigest.ts --dry-run  # Print without writing
 *
 * Why this exists:
 *   PAI's Algorithm writes reflections after every session (Q1: what went wrong,
 *   Q2: what would a smarter algorithm do, Q3: what capabilities were missed).
 *   But reflections are write-only — they sit in a JSONL file and are never
 *   systematically read back. This tool closes the loop by extracting patterns
 *   and generating distilled heuristics that can be injected at session start.
 *
 * Output: MEMORY/LEARNING/reflection-digest.md
 *   - Ranked failure patterns with frequency and sentiment correlation
 *   - Missed capabilities ranked by occurrence
 *   - Low-sentiment session analysis
 *   - Generated heuristic rules (candidate rules for user review)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// --- Configuration ---

const CLAUDE_DIR = process.env.PAI_DIR || join(homedir(), '.claude');
const REFLECTIONS_PATH = join(CLAUDE_DIR, 'MEMORY', 'LEARNING', 'REFLECTIONS', 'algorithm-reflections.jsonl');
const DIGEST_PATH = join(CLAUDE_DIR, 'MEMORY', 'LEARNING', 'reflection-digest.md');
const DRY_RUN = process.argv.includes('--dry-run');

// --- Types ---

interface Reflection {
  timestamp: string;
  effort_level: string;
  task_description: string;
  criteria_count: number;
  criteria_passed: number;
  criteria_failed: number;
  prd_id: string;
  implied_sentiment: number;
  reflection_q1: string;
  reflection_q2: string;
  reflection_q3: string;
  within_budget: boolean;
}

interface Pattern {
  keyword: string;
  count: number;
  frequency: string;
  examples: string[];
  sentiment_avg: number;
}

// --- Pattern dictionaries ---

/** Failure pattern keywords extracted from Q1 reflections */
const FAILURE_KEYWORDS: Record<string, string[]> = {
  'validate-before-build': ['validate', 'assumption', 'poc', 'proof', 'prove', 'verify first', 'tested first'],
  'parallel-failures': ['parallel', 'worktree', 'agent spawn', 'concurrent', 'multiple agents'],
  'testing-after-code': ['test first', 'tdd', 'tests before', 'should have tested', 'without testing'],
  'env-assumptions': ['environment', 'install', 'import', 'dependency', 'vram', 'ram', 'python 3'],
  'phantom-capabilities': ['capability', 'skill', 'invoke', 'should have used', 'never called'],
  'over-commitment': ['too many', 'over-commit', 'too ambitious', 'scope'],
  'delayed-diagnosis': ['after the damage', 'too late', 'should have caught', 'already'],
  'single-path-blindness': ['alternative', 'only one approach', 'single path', 'benchmark', 'compare'],
};

/** Missed capability keywords extracted from Q3 reflections */
const CAPABILITY_KEYWORDS: Record<string, string[]> = {
  'Research': ['research skill', 'research formal', 'web research'],
  'Browser': ['browser', 'dom inspection', 'live dom', 'selector'],
  '/batch': ['batch', 'multi-file', 'parallel file'],
  '/simplify': ['simplify', 'quality', 'review'],
  'Council': ['council', 'debate', 'perspectives'],
  'FirstPrinciples': ['first principles', 'root cause'],
  'Science': ['science', 'hypothesis', 'experiment'],
  'Agents': ['background agents', 'parallel research', 'spawn'],
};

// --- Core logic ---

function loadReflections(): Reflection[] {
  if (!existsSync(REFLECTIONS_PATH)) {
    console.error(`No reflections file found at ${REFLECTIONS_PATH}`);
    console.error('The Algorithm writes reflections to this file during the LEARN phase.');
    process.exit(1);
  }

  return readFileSync(REFLECTIONS_PATH, 'utf-8')
    .trim()
    .split('\n')
    .filter(l => l.trim())
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter((r): r is Reflection => r !== null);
}

function clusterPatterns(
  reflections: Reflection[],
  field: 'reflection_q1' | 'reflection_q3',
  keywords: Record<string, string[]>,
): Pattern[] {
  const patterns: Pattern[] = [];

  for (const [name, terms] of Object.entries(keywords)) {
    const matches = reflections.filter(r => {
      const text = (r[field] || '').toLowerCase();
      return terms.some(t => text.includes(t));
    });

    if (matches.length === 0) continue;

    patterns.push({
      keyword: name,
      count: matches.length,
      frequency: `${((matches.length / reflections.length) * 100).toFixed(0)}%`,
      examples: matches.slice(0, 3).map(r =>
        `${r.task_description.substring(0, 60)}: "${(r[field] || '').substring(0, 80)}"`
      ),
      sentiment_avg: Math.round(
        (matches.reduce((sum, r) => sum + (r.implied_sentiment || 7), 0) / matches.length) * 10
      ) / 10,
    });
  }

  return patterns.sort((a, b) => b.count - a.count);
}

function generateHeuristics(failurePatterns: Pattern[], capPatterns: Pattern[]): string[] {
  const heuristics: string[] = [];

  const HEURISTIC_MAP: Record<string, string> = {
    'validate-before-build': 'NEVER build until the core assumption is proven via a 30-second PoC.',
    'parallel-failures': 'RUN `git worktree list` before spawning parallel agents. If it fails, go sequential.',
    'testing-after-code': 'WRITE the test file BEFORE the implementation file. No exceptions for code tasks.',
    'env-assumptions': 'RUN `which`/`import`/version check for every tool BEFORE designing around it.',
    'phantom-capabilities': 'At EXECUTE START, list the EXACT tool call for each selected capability.',
    'over-commitment': 'Before accepting parallel work, verify current commitments can be completed first.',
    'delayed-diagnosis': 'Diagnose problems at the FIRST signal, not after investing further.',
    'single-path-blindness': 'For Extended+, generate 2-3 alternative approaches BEFORE committing to one.',
  };

  for (const p of failurePatterns.slice(0, 5)) {
    const rule = HEURISTIC_MAP[p.keyword] || `Address "${p.keyword}" pattern (${p.frequency} frequency).`;
    heuristics.push(`[${p.frequency}] ${rule}`);
  }

  for (const p of capPatterns.slice(0, 3)) {
    heuristics.push(`[missed ${p.count}x] Consider ${p.keyword} for tasks involving ${p.examples[0]?.split(':')[0]?.trim() || 'similar work'}.`);
  }

  return heuristics;
}

function formatDigest(
  reflections: Reflection[],
  failurePatterns: Pattern[],
  capPatterns: Pattern[],
  lowSentiment: Reflection[],
  heuristics: string[],
): string {
  const now = new Date().toISOString().split('T')[0];
  const avgSentiment = reflections.reduce((s, r) => s + (r.implied_sentiment || 7), 0) / reflections.length;

  let out = `# Reflection Digest\n\n`;
  out += `**Generated:** ${now} | **Reflections analyzed:** ${reflections.length} | **Avg sentiment:** ${avgSentiment.toFixed(1)}/10\n\n`;

  out += `## Top Failure Patterns\n\n`;
  out += `| Pattern | Frequency | Avg Sentiment | Count |\n`;
  out += `|---------|-----------|---------------|-------|\n`;
  for (const p of failurePatterns) {
    out += `| ${p.keyword} | ${p.frequency} | ${p.sentiment_avg} | ${p.count}/${reflections.length} |\n`;
  }

  out += `\n## Missed Capabilities\n\n`;
  out += `| Capability | Times Missed |\n`;
  out += `|-----------|-------------|\n`;
  for (const p of capPatterns) {
    out += `| ${p.keyword} | ${p.count} |\n`;
  }

  if (lowSentiment.length > 0) {
    out += `\n## Low-Sentiment Sessions (\u22646/10)\n\n`;
    for (const r of lowSentiment) {
      out += `- **[${r.implied_sentiment}]** ${r.task_description}: ${r.reflection_q1.substring(0, 120)}\n`;
    }
  }

  out += `\n## Generated Heuristics\n\n`;
  out += `Distilled rules from pattern analysis. Review and approve to create feedback memories.\n\n`;
  for (let i = 0; i < heuristics.length; i++) {
    out += `${i + 1}. ${heuristics[i]}\n`;
  }

  out += `\n---\n*Run \`bun Tools/ReflectionDigest.ts\` periodically (every ~10 sessions) to update.*\n`;
  return out;
}

// --- Main ---

const reflections = loadReflections();
console.log(`\ud83d\udcca Loaded ${reflections.length} reflections`);

const failurePatterns = clusterPatterns(reflections, 'reflection_q1', FAILURE_KEYWORDS);
const capPatterns = clusterPatterns(reflections, 'reflection_q3', CAPABILITY_KEYWORDS);
const lowSentiment = reflections.filter(r => (r.implied_sentiment || 10) <= 6);
const heuristics = generateHeuristics(failurePatterns, capPatterns);

console.log(`\u26a0\ufe0f  Failure patterns: ${failurePatterns.length}`);
for (const p of failurePatterns) {
  console.log(`  ${p.keyword}: ${p.count}/${reflections.length} (${p.frequency}), avg sentiment ${p.sentiment_avg}`);
}
console.log(`\ud83d\udd27 Missed capabilities: ${capPatterns.length}`);
console.log(`\ud83d\udcc9 Low-sentiment sessions: ${lowSentiment.length}`);
console.log(`\ud83d\udca1 Generated ${heuristics.length} heuristics`);

const digest = formatDigest(reflections, failurePatterns, capPatterns, lowSentiment, heuristics);

if (DRY_RUN) {
  console.log('\n--- DRY RUN ---\n');
  console.log(digest);
} else {
  writeFileSync(DIGEST_PATH, digest);
  console.log(`\n\u2705 Digest written to ${DIGEST_PATH}`);
}
