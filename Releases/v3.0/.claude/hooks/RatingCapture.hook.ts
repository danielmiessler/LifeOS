#!/usr/bin/env bun
// Paperclip agent isolation: skip PAI hooks in Paperclip child processes
if (process.env.PAPERCLIP_AGENT_ID) process.exit(0);
/**
 * RatingCapture.hook.ts - Unified Rating & Sentiment Capture (UserPromptSubmit)
 *
 * PURPOSE:
 * Single hook for all rating capture. Handles both explicit ratings (1-10 pattern)
 * and implicit sentiment detection (AI inference). Also outputs the Algorithm
 * format reminder (absorbed from AlgorithmEnforcement.hook.ts).
 *
 * TRIGGER: UserPromptSubmit
 *
 * FLOW:
 * 1. Output algorithm format reminder (instant, stdout — non-blocking)
 * 2. Parse input from stdin
 * 3. Check for explicit rating pattern → if found, write and exit
 * 4. If no explicit rating, run AI sentiment inference (Haiku, ~1s)
 * 5. Write result to ratings.jsonl
 * 6. Capture learnings for low ratings (<6), full failure capture for <=3
 *
 * OUTPUT:
 * - stdout: <user-prompt-submit-hook> algorithm reminder (instant)
 * - exit(0): Normal completion
 *
 * SIDE EFFECTS:
 * - Writes to: MEMORY/LEARNING/SIGNALS/ratings.jsonl
 * - Writes to: MEMORY/LEARNING/<category>/<YYYY-MM>/*.md (for low ratings)
 * - Triggers: TrendingAnalysis.ts update (fire-and-forget)
 * - API call: Haiku inference for implicit sentiment (fast/cheap)
 *
 * INTER-HOOK RELATIONSHIPS:
 * - DEPENDS ON: None
 * - COORDINATES WITH: None (self-contained — replaces ExplicitRatingCapture + ImplicitSentimentCapture)
 *
 * PERFORMANCE:
 * - Algorithm reminder: <1ms (immediate stdout)
 * - Explicit rating path: <50ms (no inference)
 * - Implicit sentiment path: 0.5-1.5s (Haiku inference)
 *
 * HISTORY:
 * - Consolidated from ExplicitRatingCapture + ImplicitSentimentCapture + AlgorithmEnforcement
 * - Removes ~200 lines of duplicated code (shared writeRating, captureLearning, trending)
 */

import { appendFileSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { inference } from '../skills/PAI/Tools/Inference';
import { getIdentity, getPrincipal, getPrincipalName } from './lib/identity';
import { getLearningCategory } from './lib/learning-utils';
import { getISOTimestamp, getPSTComponents } from './lib/time';
import { captureFailure } from '../skills/PAI/Tools/FailureCapture';

// ── Algorithm Format Reminder (absorbed from AlgorithmEnforcement) ──
// Output IMMEDIATELY before any async work — this is blocking stdout injection.
// Read Algorithm version dynamically from LATEST file (never hardcode)
const ALGO_VERSION = (() => {
  try {
    const paiDir = process.env.PAI_DIR || join(process.env.HOME!, '.claude');
    return readFileSync(join(paiDir, 'skills', 'PAI', 'Components', 'Algorithm', 'LATEST'), 'utf-8').trim();
  } catch { return 'v?.?.?'; }
})();
const ALGORITHM_REMINDER = `<user-prompt-submit-hook>
\u{1F6A8} ALGORITHM FORMAT REQUIRED - EVERY RESPONSE \u{1F6A8}

START WITH:
\u{267B}\u{FE0F} Entering the PAI ALGORITHM\u{2026} (${ALGO_VERSION} | github.com/danielmiessler/TheAlgorithm) \u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}

EXECUTE VOICE CURLS at each phase (OBSERVE, THINK, PLAN, BUILD, EXECUTE, VERIFY, LEARN)

USE TaskCreate for ISC criteria. USE TaskList to display them. NEVER manual tables.

END WITH:
\u{1F5E3}\u{FE0F} {DAIDENTITY.NAME}: [12-24 word spoken summary]

For MINIMAL tasks (pure greetings, ratings): Use abbreviated format but STILL include header and voice line.
</user-prompt-submit-hook>`;

console.log(ALGORITHM_REMINDER);

// ── Shared Types ──

interface HookInput {
  session_id: string;
  prompt?: string;
  user_prompt?: string;  // Legacy field name
  transcript_path: string;
  hook_event_name: string;
}

interface RatingEntry {
  timestamp: string;
  rating: number;
  session_id: string;
  comment?: string;
  source?: 'implicit';
  sentiment_summary?: string;
  confidence?: number;
}

// ── Shared Constants ──

const BASE_DIR = process.env.PAI_DIR || join(process.env.HOME!, '.claude');
const SIGNALS_DIR = join(BASE_DIR, 'MEMORY', 'LEARNING', 'SIGNALS');
const RATINGS_FILE = join(SIGNALS_DIR, 'ratings.jsonl');
const TRENDING_SCRIPT = join(BASE_DIR, 'tools', 'TrendingAnalysis.ts');
const MIN_PROMPT_LENGTH = 3;
const MIN_CONFIDENCE = 0.5;
const ANALYSIS_TIMEOUT = 15000;

// ── Stdin Reader ──

async function readStdinWithTimeout(timeout: number = 5000): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    const timer = setTimeout(() => reject(new Error('Timeout')), timeout);
    process.stdin.on('data', (chunk) => { data += chunk.toString(); });
    process.stdin.on('end', () => { clearTimeout(timer); resolve(data); });
    process.stdin.on('error', (err) => { clearTimeout(timer); reject(err); });
  });
}

// ── Explicit Rating Detection ──

/**
 * Parse explicit rating pattern from prompt.
 * Matches: "7", "8 - good work", "6: needs work", "9 excellent", "10!"
 * Rejects: "3 items", "5 things to fix", "7th thing"
 */
function parseExplicitRating(prompt: string): { rating: number; comment?: string } | null {
  const trimmed = prompt.trim();
  const ratingPattern = /^(10|[1-9])(?:\s*[-:]\s*|\s+)?(.*)$/;
  const match = trimmed.match(ratingPattern);
  if (!match) return null;

  const rating = parseInt(match[1], 10);
  const comment = match[2]?.trim() || undefined;

  if (rating < 1 || rating > 10) return null;

  // Reject if comment starts with words indicating a sentence, not a rating
  if (comment) {
    const sentenceStarters = /^(items?|things?|steps?|files?|lines?|bugs?|issues?|errors?|times?|minutes?|hours?|days?|seconds?|percent|%|th\b|st\b|nd\b|rd\b|of\b|in\b|at\b|to\b|the\b|a\b|an\b)/i;
    if (sentenceStarters.test(comment)) return null;
  }

  return { rating, comment };
}

// ── Implicit Sentiment Analysis ──

const PRINCIPAL_NAME = getPrincipal().name;
const ASSISTANT_NAME = getIdentity().name;

const SENTIMENT_SYSTEM_PROMPT = `Analyze ${PRINCIPAL_NAME}'s message for emotional sentiment toward ${ASSISTANT_NAME} (the AI assistant).

CONTEXT: This is a personal AI system. ${PRINCIPAL_NAME} is the ONLY user. Never say "users" - always "${PRINCIPAL_NAME}."

OUTPUT FORMAT (JSON only):
{
  "rating": <1-10 or null>,
  "sentiment": "positive" | "negative" | "neutral",
  "confidence": <0.0-1.0>,
  "summary": "<brief explanation, 10 words max>",
  "detailed_context": "<comprehensive analysis for learning, 100-256 words>"
}

DETAILED_CONTEXT REQUIREMENTS (critical for learning system):
Write 100-256 words covering:
1. What ${PRINCIPAL_NAME} was trying to accomplish
2. What ${ASSISTANT_NAME} did (or failed to do)
3. Why ${PRINCIPAL_NAME} is frustrated/satisfied (the root cause)
4. What specific behavior triggered this reaction
5. What ${ASSISTANT_NAME} should have done differently (for negative) or what worked well (for positive)
6. Any patterns this reveals about ${PRINCIPAL_NAME}'s expectations

This context will be used retroactively to improve ${ASSISTANT_NAME}, so include enough detail that someone reading it months later can understand exactly what went wrong or right.

RATING SCALE:
- 1-2: Strong frustration, anger, disappointment with ${ASSISTANT_NAME}
- 3-4: Mild frustration, dissatisfaction
- 5: Neutral (no strong sentiment)
- 6-7: Satisfaction, approval
- 8-9: Strong approval, impressed
- 10: Extraordinary enthusiasm, blown away

CRITICAL DISTINCTIONS:
- Profanity can indicate EITHER frustration OR excitement
  - "What the fuck?!" + complaint about work = LOW (1-3)
  - "Holy shit, this is amazing!" = HIGH (9-10)
- Context is KEY: Is the emotion directed AT ${ASSISTANT_NAME}'s work?
- Sarcasm: "Oh great, another error" = negative despite "great"

WHEN TO RETURN null FOR RATING:
- Neutral technical questions ("Can you check the logs?")
- Simple commands ("Do it", "Yes", "Continue")
- No emotional indicators present
- Emotion unrelated to ${ASSISTANT_NAME}'s work

EXAMPLES:
${PRINCIPAL_NAME}: "What the fuck, why did you delete my file?"
-> {"rating": 1, "sentiment": "negative", "confidence": 0.95, "summary": "Angry about deleted file", "detailed_context": "..."}

${PRINCIPAL_NAME}: "Oh my god, this is fucking incredible, you nailed it!"
-> {"rating": 10, "sentiment": "positive", "confidence": 0.95, "summary": "Extremely impressed with result", "detailed_context": "..."}

${PRINCIPAL_NAME}: "Fix the auth bug"
-> {"rating": null, "sentiment": "neutral", "confidence": 0.9, "summary": "Neutral command, no sentiment", "detailed_context": ""}

${PRINCIPAL_NAME}: "Hmm, that's not quite right"
-> {"rating": 4, "sentiment": "negative", "confidence": 0.6, "summary": "Mild dissatisfaction", "detailed_context": "..."}`;

interface SentimentResult {
  rating: number | null;
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
  summary: string;
  detailed_context: string;
}

function getRecentContext(transcriptPath: string, maxTurns: number = 3): string {
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
          if (typeof entry.message.content === 'string') {
            text = entry.message.content;
          } else if (Array.isArray(entry.message.content)) {
            text = entry.message.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join(' ');
          }
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

async function analyzeSentiment(prompt: string, context: string): Promise<SentimentResult | null> {
  const userPrompt = context ? `CONTEXT:\n${context}\n\nCURRENT MESSAGE:\n${prompt}` : prompt;

  const result = await inference({
    systemPrompt: SENTIMENT_SYSTEM_PROMPT,
    userPrompt,
    expectJson: true,
    timeout: 12000,
    level: 'fast',
  });

  if (!result.success || !result.parsed) {
    console.error(`[RatingCapture] Inference failed: ${result.error}`);
    return null;
  }

  return result.parsed as SentimentResult;
}

// ── Shared: Write Rating ──

function writeRating(entry: RatingEntry): void {
  if (!existsSync(SIGNALS_DIR)) mkdirSync(SIGNALS_DIR, { recursive: true });
  appendFileSync(RATINGS_FILE, JSON.stringify(entry) + '\n', 'utf-8');
  const source = entry.source === 'implicit' ? 'implicit' : 'explicit';
  console.error(`[RatingCapture] Wrote ${source} rating ${entry.rating} to ${RATINGS_FILE}`);
}

// ── Shared: Trigger Trending Analysis ──

function triggerTrending(): void {
  if (existsSync(TRENDING_SCRIPT)) {
    Bun.spawn(['bun', TRENDING_SCRIPT, '--force'], { stdout: 'ignore', stderr: 'ignore' });
    console.error('[RatingCapture] Triggered TrendingAnalysis update');
  }
}

// ── Shared: Capture Low Rating Learning ──

function captureLowRatingLearning(
  rating: number,
  summaryOrComment: string,
  detailedContext: string,
  source: 'explicit' | 'implicit'
): void {
  if (rating >= 5) return;  // 5 = neutral (no sentiment), only capture actual negatives (<=4)
  if (!detailedContext?.trim()) return;  // Skip if no meaningful context to learn from

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
  console.error(`[RatingCapture] Captured low ${source} rating learning to ${filepath}`);
}

// ── Main ──

async function main() {
  try {
    console.error('[RatingCapture] Hook started');
    const input = await readStdinWithTimeout();
    const data: HookInput = JSON.parse(input);
    const prompt = data.prompt || data.user_prompt || '';

    // ── Path 1: Explicit Rating ──
    const explicitResult = parseExplicitRating(prompt);
    if (explicitResult) {
      console.error(`[RatingCapture] Explicit rating: ${explicitResult.rating}${explicitResult.comment ? ` - ${explicitResult.comment}` : ''}`);

      const entry: RatingEntry = {
        timestamp: getISOTimestamp(),
        rating: explicitResult.rating,
        session_id: data.session_id,
      };
      if (explicitResult.comment) entry.comment = explicitResult.comment;

      writeRating(entry);
      triggerTrending();

      if (explicitResult.rating < 5) {
        // Get last response for context
        let responseContext = '';
        try {
          if (data.transcript_path && existsSync(data.transcript_path)) {
            const content = readFileSync(data.transcript_path, 'utf-8');
            const lines = content.trim().split('\n');
            let lastAssistant = '';
            for (const line of lines) {
              try {
                const e = JSON.parse(line);
                if (e.type === 'assistant' && e.message?.content) {
                  const text = typeof e.message.content === 'string'
                    ? e.message.content
                    : Array.isArray(e.message.content)
                      ? e.message.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join(' ')
                      : '';
                  if (text) lastAssistant = text;
                }
              } catch {}
            }
            const summaryMatch = lastAssistant.match(/SUMMARY:\s*([^\n]+)/i);
            responseContext = summaryMatch ? summaryMatch[1].trim() : lastAssistant.slice(0, 500);
          }
        } catch {}

        captureLowRatingLearning(explicitResult.rating, explicitResult.comment || '', responseContext, 'explicit');

        if (explicitResult.rating <= 3) {
          try {
            await captureFailure({
              transcriptPath: data.transcript_path,
              rating: explicitResult.rating,
              sentimentSummary: explicitResult.comment || `Explicit low rating: ${explicitResult.rating}/10`,
              detailedContext: responseContext,
              sessionId: data.session_id,
            });
            console.error(`[RatingCapture] Created failure capture for explicit rating ${explicitResult.rating}`);
          } catch (err) {
            console.error(`[RatingCapture] Error creating failure capture: ${err}`);
          }
        }
      }

      process.exit(0);
    }

    // ── Path 2: Implicit Sentiment (fire-and-forget) ──
    // Don't block the prompt — run inference in background
    if (prompt.length < MIN_PROMPT_LENGTH) {
      console.error('[RatingCapture] Prompt too short for sentiment, exiting');
      process.exit(0);
    }

    // Await sentiment analysis — must complete before process exits
    const context = getRecentContext(data.transcript_path);
    console.error('[RatingCapture] Running implicit sentiment analysis...');

    try {
      const sentiment = await analyzeSentiment(prompt, context);
      if (!sentiment) {
        console.error('[RatingCapture] Sentiment returned null, exiting');
        process.exit(0);
      }

      if (sentiment.rating === null) sentiment.rating = 5;
      if (sentiment.confidence < MIN_CONFIDENCE) {
        console.error(`[RatingCapture] Confidence ${sentiment.confidence} below ${MIN_CONFIDENCE}, skipping`);
        process.exit(0);
      }

      console.error(`[RatingCapture] Implicit: ${sentiment.rating}/10 (conf: ${sentiment.confidence}) - ${sentiment.summary}`);

      const entry: RatingEntry = {
        timestamp: getISOTimestamp(),
        rating: sentiment.rating,
        session_id: data.session_id,
        source: 'implicit',
        sentiment_summary: sentiment.summary,
        confidence: sentiment.confidence,
      };

      writeRating(entry);
      triggerTrending();

      if (sentiment.rating < 5) {
        captureLowRatingLearning(
          sentiment.rating,
          sentiment.summary,
          sentiment.detailed_context || '',
          'implicit'
        );

        if (sentiment.rating <= 3) {
          await captureFailure({
            transcriptPath: data.transcript_path,
            rating: sentiment.rating,
            sentimentSummary: sentiment.summary,
            detailedContext: sentiment.detailed_context || '',
            sessionId: data.session_id,
          }).catch((err) => console.error(`[RatingCapture] Failure capture error: ${err}`));
        }
      }
    } catch (err) {
      console.error(`[RatingCapture] Sentiment error: ${err}`);
    }

    process.exit(0);
  } catch (err) {
    console.error(`[RatingCapture] Error: ${err}`);
    process.exit(0);
  }
}

main();
