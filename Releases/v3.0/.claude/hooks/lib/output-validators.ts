/**
 * output-validators.ts - Validation for voice and tab title outputs
 *
 * Single source of truth for what constitutes valid/invalid output
 * in the voice and tab title systems. NOT related to Algorithm format.
 *
 * Tab title validators enforce the state machine:
 *   - Working titles (⚙️): gerund start ("Fixing auth bug.")
 *   - Completion titles (✓): past tense, NO gerund ("Fixed auth bug.")
 *   - Question titles: noun phrase, no period ("Auth method")
 *
 * Renamed from response-format.ts (v0.2.32) — old name was misleading.
 */

// Conversational filler — always invalid for voice output
const GARBAGE_PATTERNS = [
  /appreciate/i,
  /thank/i,
  /welcome/i,
  /help(ing)? you/i,
  /assist(ing)? you/i,
  /reaching out/i,
  /happy to/i,
  /let me know/i,
  /feel free/i,
];

// Conversational starters — not factual summaries
const CONVERSATIONAL_STARTERS = [
  /^I'm /i, /^I am /i, /^Sure[,.]?/i, /^OK[,.]?/i,
  /^Got it[,.]?/i, /^Done\.?$/i, /^Yes[,.]?/i, /^No[,.]?/i,
  /^Okay[,.]?/i, /^Alright[,.]?/i,
];

// Single-word garbage
const SINGLE_WORD_BLOCKLIST = new Set([
  'ready', 'done', 'ok', 'okay', 'yes', 'no', 'sure',
  'hello', 'hi', 'hey', 'thanks', 'working', 'processing',
]);

/**
 * Check if a voice completion is valid for TTS.
 */
export function isValidVoiceCompletion(text: string): boolean {
  if (!text || text.length < 10) return false;
  const wordCount = text.trim().split(/\s+/).length;
  if (wordCount === 1) {
    const lower = text.toLowerCase().replace(/[^a-z]/g, '');
    if (SINGLE_WORD_BLOCKLIST.has(lower) || lower.length < 10) return false;
  }
  for (const p of GARBAGE_PATTERNS) if (p.test(text)) return false;
  if (text.length < 40) {
    if (/\bready\b/i.test(text) || /\bhello\b/i.test(text)) return false;
  }
  for (const p of CONVERSATIONAL_STARTERS) if (p.test(text)) return false;
  return true;
}

export function getVoiceFallback(): string {
  return '';
}

// ─── Tab Title Validation ───────────────────────────────────────

// Incomplete endings — dangling articles, prepositions, conjunctions
const INCOMPLETE_ENDINGS = new Set([
  'the', 'a', 'an', 'to', 'for', 'with', 'of',
  'in', 'on', 'at', 'by', 'from', 'into', 'about',
  'and', 'or', 'but', 'that', 'which',
]);

/**
 * Shared base validation: 2-4 words, period, no garbage, no incomplete endings.
 */
function isValidTitleBase(text: string): { valid: boolean; firstWord: string } {
  if (!text || text.length < 5) return { valid: false, firstWord: '' };
  if (!text.endsWith('.')) return { valid: false, firstWord: '' };

  const content = text.slice(0, -1).trim();
  const words = content.split(/\s+/);
  if (words.length < 2 || words.length > 4) return { valid: false, firstWord: '' };

  const firstWord = words[0].toLowerCase();

  // Reject generic garbage (both gerund and past-tense forms)
  if (/^(completed?|proces{1,2}e?d|processing|handled|handling|finished|finishing|worked|working|done) (the |on )?(task|request|work|it)$/i.test(content)) {
    return { valid: false, firstWord };
  }

  // Reject first-person pronouns
  const lower = content.toLowerCase();
  if (/\bi\b/.test(lower) || /\bme\b/.test(lower) || /\bmy\b/.test(lower)) {
    return { valid: false, firstWord };
  }

  // Reject dangling/incomplete endings
  const lastWord = words[words.length - 1].toLowerCase().replace(/[^a-z]/g, '');
  if (INCOMPLETE_ENDINGS.has(lastWord)) return { valid: false, firstWord };

  return { valid: true, firstWord };
}

/**
 * Working-phase title: MUST start with gerund (-ing verb).
 * Used by UpdateTabTitle for 🧠/⚙️ titles.
 */
export function isValidWorkingTitle(text: string): boolean {
  const { valid, firstWord } = isValidTitleBase(text);
  if (!valid) return false;
  return firstWord.endsWith('ing');
}

/** @deprecated Use isValidWorkingTitle */
export const isValidTabSummary = isValidWorkingTitle;

/**
 * Completion-phase title: must NOT start with gerund.
 * Past tense or other non-gerund verb forms.
 * Used by TabState for ✓ titles.
 */
export function isValidCompletionTitle(text: string): boolean {
  const { valid, firstWord } = isValidTitleBase(text);
  if (!valid) return false;
  // Completion titles must NOT be gerunds — that's a working title
  if (firstWord.endsWith('ing')) return false;
  return true;
}

/**
 * Question-phase title: noun phrase, no period, 1-4 words, max 30 chars.
 */
export function isValidQuestionTitle(text: string): boolean {
  if (!text || text.trim().length === 0) return false;
  if (text.endsWith('.')) return false;
  if (text.length > 30) return false;
  const words = text.trim().split(/\s+/);
  if (words.length < 1 || words.length > 4) return false;
  if (/<[^>]*>/.test(text)) return false;
  return true;
}

// ─── Fallbacks ──────────────────────────────────────────────────

export function getWorkingFallback(): string {
  return 'Processing request.';
}

export function getCompletionFallback(): string {
  return 'Task complete.';
}

export function getQuestionFallback(): string {
  return 'Awaiting input';
}

/** @deprecated Use getWorkingFallback or getCompletionFallback */
export function getTabFallback(stage: 'start' | 'end' = 'start'): string {
  return stage === 'end' ? getCompletionFallback() : getWorkingFallback();
}

// ─── Past Tense Conversion ─────────────────────────────────────

const IRREGULAR_PAST: Record<string, string> = {
  building: 'Built', running: 'Ran', writing: 'Wrote', reading: 'Read',
  making: 'Made', finding: 'Found', getting: 'Got', setting: 'Set',
  doing: 'Did', going: 'Went', taking: 'Took', giving: 'Gave',
  seeing: 'Saw', sending: 'Sent', thinking: 'Thought', bringing: 'Brought',
  beginning: 'Began', breaking: 'Broke', choosing: 'Chose', drawing: 'Drew',
  driving: 'Drove', eating: 'Ate', falling: 'Fell', flying: 'Flew',
  growing: 'Grew', hiding: 'Hid', holding: 'Held', keeping: 'Kept',
  knowing: 'Knew', leading: 'Led', leaving: 'Left', lending: 'Lent',
  letting: 'Let', losing: 'Lost', meeting: 'Met', paying: 'Paid',
  putting: 'Put', riding: 'Rode', rising: 'Rose', saying: 'Said',
  selling: 'Sold', showing: 'Showed', singing: 'Sang', sitting: 'Sat',
  sleeping: 'Slept', speaking: 'Spoke', spending: 'Spent', standing: 'Stood',
  stealing: 'Stole', striking: 'Struck', sweeping: 'Swept', swimming: 'Swam',
  teaching: 'Taught', telling: 'Told', throwing: 'Threw', wearing: 'Wore',
  winning: 'Won', understanding: 'Understood',
};

/**
 * Convert a gerund to past tense: "Fixing" → "Fixed", "Building" → "Built".
 */
export function gerundToPastTense(gerund: string): string {
  const lower = gerund.toLowerCase();

  // Check irregular map first
  if (IRREGULAR_PAST[lower]) return IRREGULAR_PAST[lower];

  if (!lower.endsWith('ing') || lower.length < 5) return gerund;
  const stem = lower.slice(0, -3);

  // Regular: stem + "ed" handles all cases correctly:
  // - "fixing" → stem "fix" → "fixed"
  // - "stopping" → stem "stopp" → "stopped" (doubled consonant preserved)
  // - "processing" → stem "process" → "processed" (natural 'ss' preserved)
  const result = stem + 'ed';
  return result.charAt(0).toUpperCase() + result.slice(1);
}
