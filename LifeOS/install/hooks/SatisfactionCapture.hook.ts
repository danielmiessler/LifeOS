#!/usr/bin/env bun
/**
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

import { inference } from '../LIFEOS/TOOLS/Inference';
import { getIdentity, getPrincipal, getPrincipalName } from './lib/identity';
import { getLearningCategory } from './lib/learning-utils';
import { getISOTimestamp, getPSTComponents } from './lib/time';
import { captureFailure } from '../LIFEOS/TOOLS/FailureCapture';
import { addRatingPulse } from './lib/isa-utils';

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

interface SentimentResult {
  rating: number;
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
  summary: string;
  detailed_context: string;
}

// ── Constants ──

const BASE_DIR = process.env.LIFEOS_DIR || join(process.env.HOME!, '.claude', 'LIFEOS');
const SIGNALS_DIR = join(BASE_DIR, 'MEMORY', 'LEARNING', 'SIGNALS');
const RATINGS_FILE = join(SIGNALS_DIR, 'ratings.jsonl');
const LAST_RESPONSE_CACHE = join(BASE_DIR, 'MEMORY', 'STATE', 'last-response.txt');
const MIN_PROMPT_LENGTH = 3;

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

  const ratingPattern = /^(10|[1-9])(?:\s*[-:]\s*|\s+)?(.*)$/;
  const match = trimmed.match(ratingPattern);
  if (!match) return null;

  const rating = parseInt(match[1], 10);
  const rest = match[2]?.trim() || undefined;

  if (rating < 1 || rating > 10) return null;

  const afterNumber = trimmed.slice(match[1].length);
  if (afterNumber.length > 0 && /^[/.\dA-Za-z]/.test(afterNumber)) return null;

  if (rest) {
    const sentenceStarters = /^(items?|things?|steps?|files?|lines?|bugs?|issues?|errors?|times?|minutes?|hours?|days?|seconds?|percent|%|th\b|st\b|nd\b|rd\b|of\b|in\b|at\b|to\b|the\b|a\b|an\b)/i;
    if (sentenceStarters.test(rest)) return null;
  }

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

function buildSatisfactionPrompt(): string {
  return `You analyze ${PRINCIPAL_NAME}'s satisfaction with ${ASSISTANT_NAME}'s previous response.

Given the user's current message and the AI's last response, determine how satisfied ${PRINCIPAL_NAME} is.

RATING SCALE:
- 1: Extremely frustrated, angry, "you completely failed"
- 2: Strong frustration, major miss, "this is completely wrong"
- 3: Clear dissatisfaction, corrections needed, "that's not what I said"
- 4: Mild frustration, minor miss, "no, I meant..."
- 5: Neutral — just asking for more work, no emotional indicator either way
- 6: Slight satisfaction, building on work, "now also add..."
- 7: Clear approval, trust signals, "go ahead", "fix all of it"
- 8: Strong approval, short praise, "great", "nice work"
- 9: Very impressed, enthusiastic praise, "this is amazing"
- 10: Extraordinary enthusiasm, exceeded expectations

CRITICAL RULES:
- ALWAYS return a numeric rating (1-10). NEVER return null.
- Default to 5 for neutral task-focused messages with no emotional indicator.
- Profanity can mean frustration OR excitement — read the full context.
- Short follow-up requests with no complaint = 5-6 (satisfied enough to continue).
- Terse redirects (short response ignoring long output) = 3-4.
- Repeated requests (having to ask twice) = 2-3.
- "That's not right" / corrections = 3-4.
- Building on work enthusiastically = 7-8.
- Simple "ok" or "thanks" = 6.

OUTPUT FORMAT (JSON only):
{
  "rating": <1-10, REQUIRED, never null>,
  "sentiment": "positive" | "negative" | "neutral",
  "confidence": <0.0-1.0>,
  "summary": "<10 words max describing the satisfaction signal>",
  "detailed_context": "<50-150 words: what happened, why this rating, what to learn>"
}`;
}

// ── Recent Transcript Context ──

function getRecentContext(transcriptPath: string, maxTurns: number = 4): string {
  try {
    if (!transcriptPath || !existsSync(transcriptPath)) return '';
    const content = readFileSync(transcriptPath, 'utf-8');
    const lines = content.trim().split('\n');
    const turns: { role: string; text: string }[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        if (entry.type === 'user' && entry.message?.content) {
          let text = '';
          if (typeof entry.message.content === 'string') text = entry.message.content;
          else if (Array.isArray(entry.message.content))
            text = entry.message.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join(' ');
          if (text.trim()) turns.push({ role: 'User', text: text.slice(0, 200) });
        }
        if (entry.type === 'assistant' && entry.message?.content) {
          const text = typeof entry.message.content === 'string'
            ? entry.message.content
            : Array.isArray(entry.message.content)
              ? entry.message.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join(' ')
              : '';
          if (text) {
            const summaryMatch = text.match(/SUMMARY:\s*([^\n]+)/i);
            turns.push({ role: 'Assistant', text: summaryMatch ? summaryMatch[1] : text.slice(0, 150) });
          }
        }
      } catch {}
    }

    const recent = turns.slice(-maxTurns);
    return recent.length > 0 ? recent.map(t => `${t.role}: ${t.text}`).join('\n') : '';
  } catch { return ''; }
}

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

    if (prompt.length < MIN_PROMPT_LENGTH) {
      console.error('[SatisfactionCapture] Prompt too short, skipping');
      process.exit(0);
    }

    // ── FAST PATH: Explicit rating ──
    const explicitResult = parseExplicitRating(prompt);
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

    // ── INFERENCE PATH: Implicit satisfaction analysis ──
    // Stagger 2s to avoid racing PromptProcessing for the same claude --print slot
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.error('[SatisfactionCapture] Running satisfaction inference...');

    const cleanPrompt = prompt.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1000);
    const lastResponse = getLastResponse();
    const context = getRecentContext(data.transcript_path, 4);

    let userPrompt = '';
    if (lastResponse) {
      userPrompt += `PREVIOUS AI RESPONSE (what the user is reacting to):\n${lastResponse.slice(0, 500)}\n\n`;
    }
    if (context) {
      userPrompt += `RECENT CONVERSATION:\n${context}\n\n`;
    }
    userPrompt += `CURRENT USER MESSAGE:\n${cleanPrompt}`;

    try {
      const result = await inference({
        systemPrompt: buildSatisfactionPrompt(),
        userPrompt,
        expectJson: true,
        timeout: 15000,
        level: 'low',
      });

      if (result.success && result.parsed) {
        const r = result.parsed as SentimentResult;
        // Clamp rating to 1-10, default 5 if missing
        const rating = (r.rating != null && r.rating >= 1 && r.rating <= 10) ? r.rating : 5;
        const confidence = r.confidence || 0.5;

        console.error(`[SatisfactionCapture] Implicit: ${rating}/10 (${confidence}) - ${r.summary || 'no summary'}`);

        const cachedResponse = getLastResponse();
        writeRating({
          timestamp: getISOTimestamp(),
          rating,
          session_id: sessionId,
          source: 'implicit',
          sentiment_summary: r.summary || 'Inferred from follow-up behavior',
          confidence,
          ...(cachedResponse ? { response_preview: cachedResponse.slice(0, 500) } : {}),
        });

        addRatingPulse(sessionId, {
          value: rating,
          timestamp: Date.now(),
          message: (r.summary || cleanPrompt).slice(0, 32),
        });

        if (rating < 5) {
          captureLowRatingLearning(rating, r.summary || '', r.detailed_context || '', 'implicit');
          if (rating <= 3) {
            await captureFailure({
              transcriptPath: data.transcript_path,
              rating,
              sentimentSummary: r.summary || '',
              detailedContext: r.detailed_context || '',
              sessionId,
            }).catch((err) => console.error(`[SatisfactionCapture] Failure capture error: ${err}`));
          }
        }
      } else {
        // Inference failed — default to 5 (neutral)
        const errorReason = result.error || 'unknown';
        console.error(`[SatisfactionCapture] Inference failed: ${errorReason} — defaulting to 5`);
        writeRating({
          timestamp: getISOTimestamp(),
          rating: 5,
          session_id: sessionId,
          source: 'implicit',
          sentiment_summary: `Inference failed: ${errorReason.slice(0, 80)}`,
          confidence: 0.3,
        });
      }
    } catch (err) {
      // Inference errored — default to 5 (neutral)
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[SatisfactionCapture] Inference error: ${errMsg} — defaulting to 5`);
      writeRating({
        timestamp: getISOTimestamp(),
        rating: 5,
        session_id: sessionId,
        source: 'implicit',
        sentiment_summary: `Inference error: ${errMsg.slice(0, 80)}`,
        confidence: 0.3,
      });
    }

    process.exit(0);
  } catch (err) {
    console.error(`[SatisfactionCapture] Fatal error: ${err}`);
    process.exit(0);
  }
}

main();
