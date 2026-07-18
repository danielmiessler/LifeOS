#!/usr/bin/env bun
// Normalize env path vars Claude Code may inject unexpanded — literal $HOME/${HOME}
// in LIFEOS_DIR/LIFEOS_CONFIG_DIR/PROJECTS_DIR resolves to a shadow dir (#1404 / PR #1451, author jbmml).
for (const __k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const __v = process.env[__k];
  if (__v && /^\$\{?HOME\}?(\/|$)/.test(__v)) process.env[__k] = __v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}

/**
 * @version 1.3.15
 * SatisfactionCapture.hook.ts - Implicit & Explicit Satisfaction Rating
 *
 * PURPOSE:
 * Standalone hook that captures user satisfaction with AI responses.
 * Handles both explicit ratings (bare numbers) and implicit sentiment
 * analysis from follow-up behavior.
 *
 * TRIGGER: UserPromptSubmit
 *
 * KEY BEHAVIOR:
 * - Explicit rating (bare "8") → capture directly
 * - Positive praise ("great job") → fast-path rating 8
 * - Neutral follow-up ("now do X") → rating 5 (not skipped)
 * - Happy follow-up ("awesome, now do X") → rating 6-10
 * - Unhappy follow-up ("that's wrong, fix X") → rating 1-4
 * - System text / very short → skip
 *
 * CRITICAL FIX: Previous system returned null for neutral prompts,
 * meaning no rating was recorded. Now EVERY non-system prompt gets a rating.
 * Neutral = 5, not null.
 */

import { appendFileSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import { getIdentity, getPrincipal, getPrincipalName } from './lib/identity';
import { getLearningCategory } from './lib/learning-utils';
import { getISOTimestamp, getPSTComponents } from './lib/time';
import { captureFailure } from '../LIFEOS/TOOLS/FailureCapture';
import { addRatingPulse } from './lib/isa-utils';
import { getClaudeDir } from "./lib/paths";

// Normalize env path vars that Claude Code injects without shell expansion (LifeOS#1404)
for (const k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const v = process.env[k];
  if (v && /^\$\{?HOME\}?(\/|$)/.test(v)) process.env[k] = v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}


// ── Types ──

interface HookInput {
  session_id: string;
  prompt?: string;
  user_prompt?: string;
  transcript_path: string;
  hook_event_name: string;
}

interface RatingEntry {
  timestamp: string;
  rating: number;
  session_id: string;
  comment?: string;
  source?: 'implicit' | 'explicit';
  sentiment_summary?: string;
  confidence?: number;
  response_preview?: string;
}

// ── Constants ──

const BASE_DIR = process.env.LIFEOS_DIR || join(getClaudeDir(), 'LIFEOS');
const SIGNALS_DIR = join(BASE_DIR, 'MEMORY', 'LEARNING', 'SIGNALS');
const RATINGS_FILE = join(SIGNALS_DIR, 'ratings.jsonl');
const LAST_RESPONSE_CACHE = join(BASE_DIR, 'MEMORY', 'STATE', 'last-response.txt');
const MIN_PROMPT_LENGTH = 3;

// Sentence-starters that mean a leading number is describing work, not rating it
// (e.g. "2/10 items done", "3 of the files"). Shared by the fraction and generic parsers.
const SENTENCE_STARTERS = /^(items?|things?|steps?|files?|lines?|bugs?|issues?|errors?|times?|minutes?|hours?|days?|seconds?|percent|%|th\b|st\b|nd\b|rd\b|of\b|in\b|at\b|to\b|the\b|a\b|an\b)/i;

// ── Stdin Reader ──

async function readStdinWithTimeout(timeout: number = 5000): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    const timer = setTimeout(() => resolve(data), timeout);
    process.stdin.on('data', (chunk) => { data += chunk.toString(); });
    process.stdin.on('end', () => { clearTimeout(timer); resolve(data); });
    process.stdin.on('error', (err) => { clearTimeout(timer); reject(err); });
  });
}

// ── Cached Response ──

function getLastResponse(): string {
  try {
    if (existsSync(LAST_RESPONSE_CACHE)) return readFileSync(LAST_RESPONSE_CACHE, 'utf-8');
  } catch {}
  return '';
}

// ── Word-to-Number Map (for "ten", "eight", etc.) ──

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

// ── Explicit Rating Detection ──

function parseExplicitRating(prompt: string): { rating: number; comment?: string } | null {
  const trimmed = prompt.trim();

  // Check word-form ratings first (e.g., "ten", "Eight")
  const lowerTrimmed = trimmed.toLowerCase();
  for (const [word, num] of Object.entries(WORD_NUMBERS)) {
    if (lowerTrimmed === word || lowerTrimmed.startsWith(word + ' ') || lowerTrimmed.startsWith(word + '!')) {
      const rest = trimmed.slice(word.length).trim().replace(/^[!.,]+/, '').trim() || undefined;
      return { rating: num, comment: rest };
    }
  }

  // N/10 form (e.g. "10/10, thank you", "9 / 10", "8 out of 10 nice").
  // Must run BEFORE the generic parser, whose reject-on-slash guard would drop it.
  const fractionMatch = trimmed.match(/^(10|[1-9])\s*(?:\/|out\s+of)\s*10\b(.*)$/i);
  if (fractionMatch) {
    const fRating = parseInt(fractionMatch[1], 10);
    const fRest = fractionMatch[2].replace(/^[\s!.,:;-]+/, '').trim() || undefined;
    if (fRest && SENTENCE_STARTERS.test(fRest)) return null; // "2/10 items" is not a rating
    return { rating: fRating, comment: fRest };
  }

  const ratingPattern = /^(10|[1-9])(?:\s*[-:]\s*|\s+)?(.*)$/;
  const match = trimmed.match(ratingPattern);
  if (!match) return null;

  const rating = parseInt(match[1], 10);
  const rest = match[2]?.trim() || undefined;

  if (rating < 1 || rating > 10) return null;

  const afterNumber = trimmed.slice(match[1].length);
  if (afterNumber.length > 0 && /^[/.\dA-Za-z]/.test(afterNumber)) return null;

  if (rest && SENTENCE_STARTERS.test(rest)) return null;

  return { rating, comment: rest };
}

// ── Positive Praise Fast Path ──

const POSITIVE_PRAISE_WORDS = new Set([
  'excellent', 'amazing', 'brilliant', 'fantastic', 'wonderful', 'beautiful',
  'incredible', 'awesome', 'perfect', 'great', 'nice', 'superb', 'outstanding',
  'magnificent', 'stellar', 'phenomenal', 'remarkable', 'terrific', 'splendid',
]);
const POSITIVE_PHRASES = new Set([
  'great job', 'good job', 'nice work', 'well done', 'nice job', 'good work',
  'love it', 'nailed it', 'looks great', 'looks good', 'thats great', 'that works',
]);

// ── System Text Detection ──

const SYSTEM_TEXT_PATTERNS = [
  /^<task-notification>/i,
  /^<system-reminder>/i,
  /^This session is being continued from a previous conversation/i,
  /^Please continue the conversation/i,
  /^Note:.*was read before/i,
];

// ── Rating Validity ──

/**
 * A satisfaction rating is only meaningful when the model returns an actual
 * value in the 1-10 band. Anything else (missing, null, out of range, NaN,
 * non-number) is the ABSENCE of a signal — it must not be coerced to a neutral
 * 5, which would pollute every running average (the aggregator flat-means
 * `.rating` and ignores confidence).
 */
export function isValidRating(x: unknown): boolean {
  return typeof x === 'number' && Number.isFinite(x) && x >= 1 && x <= 10;
}

// ── Rating Writer ──

function writeRating(entry: RatingEntry): void {
  if (!existsSync(SIGNALS_DIR)) mkdirSync(SIGNALS_DIR, { recursive: true });
  // Strip lone UTF-16 surrogates that break jq parsing (e.g. truncated emoji at slice boundary)
  const json = JSON.stringify(entry).replace(/\\ud[89a-f][0-9a-f]{2}(?!\\ud[c-f][0-9a-f]{2})/gi, '');
  appendFileSync(RATINGS_FILE, json + '\n', 'utf-8');
  console.error(`[SatisfactionCapture] Wrote ${entry.source} rating ${entry.rating}`);
}

// ── Low Rating Learning Capture ──

function captureLowRatingLearning(
  rating: number,
  summaryOrComment: string,
  detailedContext: string,
  source: 'explicit' | 'implicit'
): void {
  if (rating >= 5) return;
  if (!detailedContext?.trim()) return;

  const { year, month, day, hours, minutes, seconds } = getPSTComponents();
  const yearMonth = `${year}-${month}`;
  const category = getLearningCategory(detailedContext, summaryOrComment);
  const learningsDir = join(BASE_DIR, 'MEMORY', 'LEARNING', category, yearMonth);

  if (!existsSync(learningsDir)) mkdirSync(learningsDir, { recursive: true });

  const label = source === 'explicit' ? `low-rating-${rating}` : `sentiment-rating-${rating}`;
  const filename = `${year}-${month}-${day}-${hours}${minutes}${seconds}_LEARNING_${label}.md`;
  const filepath = join(learningsDir, filename);

  const tags = source === 'explicit'
    ? '[low-rating, improvement-opportunity]'
    : '[sentiment-detected, implicit-rating, improvement-opportunity]';

  const content = `---
capture_type: LEARNING
timestamp: ${year}-${month}-${day} ${hours}:${minutes}:${seconds} PST
rating: ${rating}
source: ${source}
auto_captured: true
tags: ${tags}
---

# ${source === 'explicit' ? 'Low Rating' : 'Implicit Low Rating'} Captured: ${rating}/10

**Date:** ${year}-${month}-${day}
**Rating:** ${rating}/10
**Detection Method:** ${source === 'explicit' ? 'Explicit Rating' : 'Sentiment Analysis'}
${summaryOrComment ? `**Feedback:** ${summaryOrComment}` : ''}

---

## Context

${detailedContext || 'No context available'}

---

## Improvement Notes

This response was rated ${rating}/10 by ${getPrincipalName()}. Use this as an improvement opportunity.

---
`;

  writeFileSync(filepath, content, 'utf-8');
  console.error(`[SatisfactionCapture] Captured low ${source} rating learning`);
}

// ── Inference Prompt ──

const PRINCIPAL_NAME = getPrincipal().name;
const ASSISTANT_NAME = getIdentity().name;

// ══════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════

async function main() {
  try {
    console.error('[SatisfactionCapture] Hook started');
    const input = await readStdinWithTimeout();
    const data: HookInput = JSON.parse(input);
    const prompt = data.prompt || data.user_prompt || '';
    const sessionId = data.session_id;

    if (!prompt || !sessionId) { process.exit(0); }

    // ── SKIP: System text ──
    if (SYSTEM_TEXT_PATTERNS.some(re => re.test(prompt.trim()))) {
      console.error('[SatisfactionCapture] System text, skipping');
      process.exit(0);
    }

    // ── FAST PATH: Explicit rating (checked BEFORE the length skip so a bare
    // "9"/"10" — length 1-2 — is still captured; #1182). ──
    const explicitResult = parseExplicitRating(prompt);

    if (!explicitResult && prompt.length < MIN_PROMPT_LENGTH) {
      console.error('[SatisfactionCapture] Prompt too short, skipping');
      process.exit(0);
    }

    if (explicitResult) {
      console.error(`[SatisfactionCapture] Explicit rating: ${explicitResult.rating}`);
      const lastResponse = getLastResponse();
      const entry: RatingEntry = {
        timestamp: getISOTimestamp(),
        rating: explicitResult.rating,
        session_id: sessionId,
        source: 'explicit',
      };
      if (explicitResult.comment) entry.comment = explicitResult.comment;
      if (lastResponse) entry.response_preview = lastResponse.slice(0, 500);
      writeRating(entry);

      addRatingPulse(sessionId, {
        value: explicitResult.rating,
        timestamp: Date.now(),
        message: explicitResult.comment?.slice(0, 32),
      });

      if (explicitResult.rating < 5) {
        captureLowRatingLearning(explicitResult.rating, explicitResult.comment || '', lastResponse, 'explicit');
        if (explicitResult.rating <= 3) {
          await captureFailure({
            transcriptPath: data.transcript_path,
            rating: explicitResult.rating,
            sentimentSummary: explicitResult.comment || `Explicit low rating: ${explicitResult.rating}/10`,
            detailedContext: lastResponse,
            sessionId,
          }).catch((err) => console.error(`[SatisfactionCapture] Failure capture error: ${err}`));
        }
      }
      process.exit(0);
    }

    // ── FAST PATH: Positive praise ──
    const normalizedPrompt = prompt.trim().toLowerCase().replace(/[.!?,'"]/g, '');
    const promptWords = normalizedPrompt.split(/\s+/);
    if (promptWords.length <= 2) {
      if (POSITIVE_PRAISE_WORDS.has(normalizedPrompt) || POSITIVE_PHRASES.has(normalizedPrompt)
          || (promptWords.length === 2 && promptWords.every(w => POSITIVE_PRAISE_WORDS.has(w)))) {
        console.error(`[SatisfactionCapture] Positive praise fast-path: "${prompt.trim()}" → rating 8`);
        const cachedResponse = getLastResponse();
        writeRating({
          timestamp: getISOTimestamp(),
          rating: 8,
          session_id: sessionId,
          source: 'implicit',
          sentiment_summary: `Direct praise: "${prompt.trim()}"`,
          confidence: 0.95,
          ...(cachedResponse ? { response_preview: cachedResponse.slice(0, 500) } : {}),
        });

        addRatingPulse(sessionId, {
          value: 8,
          timestamp: Date.now(),
          message: prompt.trim().slice(0, 32),
        });

        process.exit(0);
      }
    }

    // ── 7.0.0 BPE: implicit-sentiment inference REMOVED ──
    // This path spawned a `claude --print` subprocess (2s stagger + ≤15s) on essentially
    // every neutral prompt to guess a 1–10 mood number — the highest-compute, lowest-signal
    // per-turn scaffolding in the system. Explicit ratings and direct praise (the fast-paths
    // above) are the real signal and stay. Implicit sentiment, if wanted, belongs in a
    // SessionEnd batch over the transcript, not a per-turn LLM call. Nothing to do here.
    process.exit(0);
  } catch (err) {
    console.error(`[SatisfactionCapture] Fatal error: ${err}`);
    process.exit(0);
  }
}

if (import.meta.main) main();
