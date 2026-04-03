#!/usr/bin/env bun
/**
 * RatingCapture.hook.ts - Unified Rating & Sentiment Capture (UserPromptSubmit)
 *
 * PURPOSE:
 * Single hook for all rating capture. Handles both explicit ratings (1-10 pattern)
 * and implicit sentiment detection (AI inference).
 *
 * TRIGGER: UserPromptSubmit
 *
 * FLOW:
 * 1. Parse input from stdin
 * 2. Check for explicit rating pattern → if found, write and exit
 * 3. If no explicit rating, run AI sentiment inference (Haiku, ~1s)
 * 4. Write result to ratings.jsonl
 * 5. Capture learnings for low ratings (<6), full failure capture for <=3
 *
 * OUTPUT:
 * - exit(0): Normal completion
 *
 * SIDE EFFECTS:
 * - Writes to: MEMORY/LEARNING/SIGNALS/ratings.jsonl
 * - Writes to: MEMORY/LEARNING/<category>/<YYYY-MM>/*.md (for low ratings)
 * - API call: Haiku inference for implicit sentiment (fast/cheap)
 *
 * PERFORMANCE:
 * - Explicit rating path: <50ms (no inference)
 * - Implicit sentiment path: 0.5-1.5s (Haiku inference)
 */

import { appendFileSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { inference } from '../PAI/Tools/Inference';
import { getIdentity, getPrincipal, getPrincipalName } from './lib/identity';
import { getLearningCategory } from './lib/learning-utils';
import { getISOTimestamp, getPSTComponents } from './lib/time';
import { captureFailure } from '../PAI/Tools/FailureCapture';


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
  source?: 'implicit' | 'explicit';
  sentiment_summary?: string;
  confidence?: number;
  response_preview?: string;  // Truncated last response that was rated (from cache)
}

// ── Shared Constants ──

const BASE_DIR = process.env.PAI_DIR || join(process.env.HOME!, '.claude');
const SIGNALS_DIR = join(BASE_DIR, 'MEMORY', 'LEARNING', 'SIGNALS');
const RATINGS_FILE = join(SIGNALS_DIR, 'ratings.jsonl');
const LAST_RESPONSE_CACHE = join(BASE_DIR, 'MEMORY', 'STATE', 'last-response.txt');
const MIN_PROMPT_LENGTH = 3;
const MIN_CONFIDENCE = 0.5;

/**
 * Read cached last response written by LastResponseCache.hook.ts.
 * Stop fires before next UserPromptSubmit, so cache is always fresh.
 */
function getLastResponse(): string {
  try {
    if (existsSync(LAST_RESPONSE_CACHE)) return readFileSync(LAST_RESPONSE_CACHE, 'utf-8');
  } catch {}
  return '';
}

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
  // Rating must be: number alone, or number followed by whitespace/dash/colon then comment
  // Reject: "10/10", "3.5", "7th", "5x" — number followed by non-separator chars
  const ratingPattern = /^(10|[1-9])(?:\s*[-:]\s*|\s+)?(.*)$/;
  const match = trimmed.match(ratingPattern);
  if (!match) return null;

  const rating = parseInt(match[1], 10);
  const rest = match[2]?.trim() || undefined;

  if (rating < 1 || rating > 10) return null;

  // Reject if the character immediately after the number is not a separator
  // This catches "10/10", "3.5", "7th", "5x", etc.
  const afterNumber = trimmed.slice(match[1].length);
  if (afterNumber.length > 0 && /^[/.\dA-Za-z]/.test(afterNumber)) return null;

  // Reject if comment starts with words indicating a sentence, not a rating
  if (rest) {
    const sentenceStarters = /^(items?|things?|steps?|files?|lines?|bugs?|issues?|errors?|times?|minutes?|hours?|days?|seconds?|percent|%|th\b|st\b|nd\b|rd\b|of\b|in\b|at\b|to\b|the\b|a\b|an\b)/i;
    if (sentenceStarters.test(rest)) return null;
  }

  return { rating, comment: rest };
}

// ── Implicit Sentiment Analysis ──

const PRINCIPAL_NAME = getPrincipal().name;
const ASSISTANT_NAME = getIdentity().name;

const SENTIMENT_SYSTEM_PROMPT = `Analyze ${PRINCIPAL_NAME}'s message for emotional sentiment toward ${ASSISTANT_NAME} (the AI assistant).

CONTEXT: This is a personal AI system. ${PRINCIPAL_NAME} is the ONLY user. Never say "users" - always "${PRINCIPAL_NAME}."
IMPORTANT: Ratings come ONLY from ${PRINCIPAL_NAME}'s messages. ${ASSISTANT_NAME} must NEVER self-rate. If the message being analyzed is from ${ASSISTANT_NAME} (not ${PRINCIPAL_NAME}), return null.

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

SHORT POSITIVE EXPRESSIONS (CRITICAL — DO NOT UNDER-RATE):
When ${PRINCIPAL_NAME} gives short, direct praise like "great job", "nice work", "well done", "love it", "nailed it", "perfect", "awesome" — these are STRONG APPROVAL (8-9). ${PRINCIPAL_NAME} went out of his way to express satisfaction. Do NOT rate these as 6-7. Short praise = high signal. Rate 8 minimum.

IMPLIED SENTIMENT (CRITICAL — THESE ARE NOT NEUTRAL):
Most of ${PRINCIPAL_NAME}'s feedback is IMPLIED, not explicit. Use CONTEXT to detect these patterns:

Implied NEGATIVE (rate 2-4, never null):
- CORRECTIONS: "No, I meant..." / "That's not what I said" / "I said X not Y" → 3-4
- REPEATED REQUESTS: Having to ask the same thing twice → 2-3 (${ASSISTANT_NAME} failed to listen)
- TERSE REDIRECTS: ${ASSISTANT_NAME} gives long output, ${PRINCIPAL_NAME} responds with short redirect ignoring it → 4
- BEHAVIORAL CORRECTIONS: "Don't do that" / "Stop doing X" / "Never X" → 3 (past behavior was wrong)
- EXASPERATED QUESTIONS: "Why is this still broken?" / "How many times..." / "This is still happening" → 2-3
- SHORT DISMISSALS: "whatever" / "fine" / "just do it" / "never mind" → 3-4
- POINTING OUT OMISSIONS: "What about X?" (when X was obviously required) → 4
- ESCALATING FRUSTRATION: "after 20 attempts" / "I keep telling you" → 1-2

Implied POSITIVE (rate 6-8, never null):
- TRUST SIGNALS: "Alright, fix all of it" / "Go ahead" (after analysis) → 7
- BUILDING ON WORK: "Now also add..." / "Next, do..." (accepting prior result) → 6-7
- ENGAGED FOLLOW-UPS: "What about X?" (exploring, not correcting) → 6
- MOVING FORWARD: Accepting output and immediately giving next task → 6

RULE: If ${PRINCIPAL_NAME}'s message is a RESPONSE to ${ASSISTANT_NAME}'s work (check CONTEXT), it almost always carries sentiment. Pure neutral is RARE in responses. Default to detecting signal, not returning null.

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

${PRINCIPAL_NAME}: "great job"
-> {"rating": 8, "sentiment": "positive", "confidence": 0.9, "summary": "Direct praise for completed work", "detailed_context": "..."}

${PRINCIPAL_NAME}: "Fix the auth bug"
-> {"rating": null, "sentiment": "neutral", "confidence": 0.9, "summary": "Neutral command, no sentiment", "detailed_context": ""}

${PRINCIPAL_NAME}: "Hmm, that's not quite right"
-> {"rating": 4, "sentiment": "negative", "confidence": 0.6, "summary": "Mild dissatisfaction", "detailed_context": "..."}

${PRINCIPAL_NAME}: "No, I said rename them, not delete them"
-> {"rating": 3, "sentiment": "negative", "confidence": 0.8, "summary": "Correction — assistant misunderstood instruction", "detailed_context": "..."}

${PRINCIPAL_NAME}: "This is still happening after I asked you to fix it"
-> {"rating": 2, "sentiment": "negative", "confidence": 0.9, "summary": "Frustrated — repeated failure on same issue", "detailed_context": "..."}

${PRINCIPAL_NAME}: "Alright, fix all of it"
-> {"rating": 7, "sentiment": "positive", "confidence": 0.7, "summary": "Trusts analysis, approves proceeding", "detailed_context": "..."}

${PRINCIPAL_NAME}: "What about X?" (after ${ASSISTANT_NAME} presented complete work)
-> {"rating": 4, "sentiment": "negative", "confidence": 0.65, "summary": "Pointed out omission in delivered work", "detailed_context": "..."}`;

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

      const cachedResponse = getLastResponse();
      const entry: RatingEntry = {
        timestamp: getISOTimestamp(),
        rating: explicitResult.rating,
        session_id: data.session_id,
        source: 'explicit' as const,
      };
      if (explicitResult.comment) entry.comment = explicitResult.comment;
      if (cachedResponse) entry.response_preview = cachedResponse.slice(0, 500);

      writeRating(entry);


      if (explicitResult.rating < 5) {
        // Read cached last response (written by LastResponseCache.hook.ts on previous Stop event)
        const responseContext = getLastResponse();

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

    // ── Path 2: Implicit Sentiment ──

    if (prompt.length < MIN_PROMPT_LENGTH) {
      console.error('[RatingCapture] Prompt too short for sentiment, exiting');
      process.exit(0);
    }

    // BUG FIX: Filter system-injected text before wasting inference on it
    // These are not {PRINCIPAL.NAME}'s messages — they're system notifications, task completions, etc.
    const SYSTEM_TEXT_PATTERNS = [
      /^<task-notification>/i,
      /^<system-reminder>/i,
      /^This session is being continued from a previous conversation/i,
      /^Please continue the conversation/i,
      /^Note:.*was read before/i,
    ];
    if (SYSTEM_TEXT_PATTERNS.some(re => re.test(prompt.trim()))) {
      console.error('[RatingCapture] System-injected text detected, skipping sentiment analysis');
      process.exit(0);
    }

    // BUG FIX: Positive word fast-path — short praise gets rating 8 directly
    // Prevents inference timeout from dropping positive signals (the "Excellent!" bug)
    const POSITIVE_PRAISE_WORDS = new Set([
      'excellent', 'amazing', 'brilliant', 'fantastic', 'wonderful', 'beautiful',
      'incredible', 'awesome', 'perfect', 'great', 'nice', 'superb', 'outstanding',
      'magnificent', 'stellar', 'phenomenal', 'remarkable', 'terrific', 'splendid',
    ]);
    const POSITIVE_PHRASES = new Set([
      'great job', 'good job', 'nice work', 'well done', 'nice job', 'good work',
      'love it', 'nailed it', 'looks great', 'looks good', 'thats great', 'that works',
    ]);
    const normalizedPrompt = prompt.trim().toLowerCase().replace(/[.!?,'"]/g, '');
    const promptWords = normalizedPrompt.split(/\s+/);
    if (promptWords.length <= 2) {
      if (POSITIVE_PRAISE_WORDS.has(normalizedPrompt) || POSITIVE_PHRASES.has(normalizedPrompt)
          || (promptWords.length === 2 && promptWords.every(w => POSITIVE_PRAISE_WORDS.has(w)))) {
        console.error(`[RatingCapture] Positive praise fast-path: "${prompt.trim()}" → rating 8`);
        const cachedResponse = getLastResponse();
        writeRating({
          timestamp: getISOTimestamp(),
          rating: 8,
          session_id: data.session_id,
          source: 'implicit',
          sentiment_summary: `Direct praise: "${prompt.trim()}"`,
          confidence: 0.95,
          ...(cachedResponse ? { response_preview: cachedResponse.slice(0, 500) } : {}),
        });
  
        process.exit(0);
      }
    }

    // Await sentiment analysis — must complete before process exits
    const context = getRecentContext(data.transcript_path, 6);  // BUG FIX: 6 turns instead of 3
    console.error('[RatingCapture] Running implicit sentiment analysis...');

    try {
      const sentiment = await analyzeSentiment(prompt, context);
      if (!sentiment) {
        console.error('[RatingCapture] Sentiment returned null, exiting');
        process.exit(0);
      }

      // BUG FIX: null means "no sentiment detected" — skip, don't convert to 5
      // Previously null→5 inflated neutral count (60% of all entries were noise)
      if (sentiment.rating === null) {
        console.error('[RatingCapture] Sentiment returned null rating (no sentiment), skipping write');
        process.exit(0);
      }
      if (sentiment.confidence < MIN_CONFIDENCE) {
        console.error(`[RatingCapture] Confidence ${sentiment.confidence} below ${MIN_CONFIDENCE}, skipping`);
        process.exit(0);
      }

      console.error(`[RatingCapture] Implicit: ${sentiment.rating}/10 (conf: ${sentiment.confidence}) - ${sentiment.summary}`);

      const implicitCachedResponse = getLastResponse();
      const entry: RatingEntry = {
        timestamp: getISOTimestamp(),
        rating: sentiment.rating,
        session_id: data.session_id,
        source: 'implicit',
        sentiment_summary: sentiment.summary,
        confidence: sentiment.confidence,
      };
      if (implicitCachedResponse) entry.response_preview = implicitCachedResponse.slice(0, 500);

      writeRating(entry);


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
      // BUG FIX: Log failures visibly — write a marker entry so inference failures show up in the data
      console.error(`[RatingCapture] Sentiment error: ${err}`);
      const failedPromptPreview = prompt.trim().slice(0, 80);
      console.error(`[RatingCapture] FAILED for prompt: "${failedPromptPreview}"`);
      // Write a visible failure marker so we can track inference reliability
      writeRating({
        timestamp: getISOTimestamp(),
        rating: 5,
        session_id: data.session_id,
        source: 'implicit',
        sentiment_summary: `INFERENCE_FAILED: "${failedPromptPreview}"`,
        confidence: 0,
      });

    }

    process.exit(0);
  } catch (err) {
    console.error(`[RatingCapture] Error: ${err}`);
    process.exit(0);
  }
}

main();
