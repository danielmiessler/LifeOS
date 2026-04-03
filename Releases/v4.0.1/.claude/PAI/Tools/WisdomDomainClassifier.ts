#!/usr/bin/env bun
/**
 * WisdomDomainClassifier - Route requests to relevant Wisdom Frames
 *
 * Simple keyword-based classifier that maps request content to domain frame files.
 * Returns the list of relevant frame paths, ordered by relevance.
 *
 * Usage:
 *   echo "deploy the worker" | bun WisdomDomainClassifier.ts
 *   bun WisdomDomainClassifier.ts --text "fix the login bug"
 *   bun WisdomDomainClassifier.ts --list
 *
 * Output: JSON array of { domain, path, relevance } objects
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, basename } from 'path';
import { parseArgs } from 'util';

const BASE_DIR = process.env.PAI_DIR || join(process.env.HOME!, '.claude');
const FRAMES_DIR = join(BASE_DIR, 'MEMORY', 'WISDOM', 'FRAMES');

// ── Domain Keyword Map ──

interface DomainKeywords {
  domain: string;
  /** Primary keywords — strong match */
  primary: RegExp[];
  /** Secondary keywords — weaker match, needs 2+ to trigger */
  secondary: RegExp[];
}

const DOMAIN_MAP: DomainKeywords[] = [
  {
    domain: 'communication',
    primary: [
      /\b(response|format|output|verbose|concise|summary|explain)\b/i,
      /\b(tone|voice|style|wording|phrasing)\b/i,
      /\b(greeting|rating|feedback)\b/i,
    ],
    secondary: [
      /\b(short|long|brief|detail)\b/i,
      /\b(say|tell|write|read)\b/i,
    ],
  },
  {
    domain: 'development',
    primary: [
      /\b(code|function|class|module|import|export)\b/i,
      /\b(bug|fix|refactor|implement|build|create|add)\b/i,
      /\b(typescript|javascript|python|bun|npm|git)\b/i,
      /\b(test|lint|type.?check|compile)\b/i,
      /\b(hook|skill|tool|agent|algorithm)\b/i,
    ],
    secondary: [
      /\b(file|path|directory|folder)\b/i,
      /\b(error|crash|broken|issue)\b/i,
    ],
  },
  {
    domain: 'deployment',
    primary: [
      /\b(deploy|push|ship|release|publish)\b/i,
      /\b(cloudflare|worker|pages|wrangler|vercel)\b/i,
      /\b(production|staging|live|remote)\b/i,
      /\b(git\s+push|git\s+remote)\b/i,
    ],
    secondary: [
      /\b(build|compile|bundle)\b/i,
      /\b(url|domain|dns|ssl)\b/i,
    ],
  },
  {
    domain: 'content-creation',
    primary: [
      /\b(blog|post|article|newsletter|write)\b/i,
      /\b(draft|edit|proofread|publish)\b/i,
      /\b(social|tweet|linkedin)\b/i,
      /\b(video|podcast|youtube)\b/i,
    ],
    secondary: [
      /\b(header|image|thumbnail)\b/i,
      /\b(audience|reader|subscriber)\b/i,
    ],
  },
  {
    domain: 'system-architecture',
    primary: [
      /\b(architecture|design|system|infrastructure)\b/i,
      /\b(memory|state|hook|skill|algorithm)\b/i,
      /\b(pai|framework|platform)\b/i,
    ],
    secondary: [
      /\b(pattern|structure|flow|pipeline)\b/i,
      /\b(integration|component|module)\b/i,
    ],
  },
];

// ── Classification ──

interface ClassificationResult {
  domain: string;
  path: string;
  relevance: number; // 0-1
}

export function classifyDomains(text: string): ClassificationResult[] {
  const results: ClassificationResult[] = [];

  for (const entry of DOMAIN_MAP) {
    let score = 0;
    let primaryHits = 0;
    let secondaryHits = 0;

    for (const pattern of entry.primary) {
      const matches = text.match(new RegExp(pattern, 'gi'));
      if (matches) {
        primaryHits += matches.length;
        score += matches.length * 2; // Primary keywords worth 2x
      }
    }

    for (const pattern of entry.secondary) {
      const matches = text.match(new RegExp(pattern, 'gi'));
      if (matches) {
        secondaryHits += matches.length;
        score += matches.length;
      }
    }

    // Need at least 1 primary hit OR 2+ secondary hits
    if (primaryHits >= 1 || secondaryHits >= 2) {
      const framePath = join(FRAMES_DIR, `${entry.domain}.md`);
      const frameExists = existsSync(framePath);

      results.push({
        domain: entry.domain,
        path: frameExists ? framePath : '',
        relevance: Math.min(score / 10, 1), // Normalize to 0-1
      });
    }
  }

  // Sort by relevance descending
  results.sort((a, b) => b.relevance - a.relevance);

  return results;
}

/**
 * Load and return the content of relevant frames for a given text
 */
export function loadRelevantFrames(text: string, maxFrames: number = 3): { domain: string; content: string }[] {
  const classified = classifyDomains(text);
  const loaded: { domain: string; content: string }[] = [];

  for (const result of classified.slice(0, maxFrames)) {
    if (result.path && existsSync(result.path)) {
      loaded.push({
        domain: result.domain,
        content: readFileSync(result.path, 'utf-8'),
      });
    }
  }

  return loaded;
}

/**
 * List all available frames
 */
export function listFrames(): { domain: string; path: string; confidence: string }[] {
  if (!existsSync(FRAMES_DIR)) return [];

  return readdirSync(FRAMES_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const path = join(FRAMES_DIR, f);
      const content = readFileSync(path, 'utf-8');
      const confMatch = content.match(/\*\*Confidence:\*\*\s*(\d+%)/);
      return {
        domain: basename(f, '.md'),
        path,
        confidence: confMatch?.[1] || 'unknown',
      };
    });
}

// ── CLI ──

if (import.meta.main) {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      text: { type: 'string', short: 't' },
      list: { type: 'boolean', short: 'l' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help) {
    console.log(`
WisdomDomainClassifier - Route requests to relevant Wisdom Frames

Usage:
  echo "deploy the worker" | bun WisdomDomainClassifier.ts
  bun WisdomDomainClassifier.ts --text "fix the login bug"
  bun WisdomDomainClassifier.ts --list

Output: JSON array of { domain, path, relevance }
`);
    process.exit(0);
  }

  if (values.list) {
    console.log(JSON.stringify(listFrames(), null, 2));
    process.exit(0);
  }

  let text = values.text || '';
  if (!text) {
    // Read from stdin
    text = await Bun.stdin.text();
  }

  if (!text.trim()) {
    console.error('No text provided');
    process.exit(1);
  }

  const results = classifyDomains(text.trim());
  console.log(JSON.stringify(results, null, 2));
}
