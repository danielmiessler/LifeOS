/**
 * output-validators.ts - Validation for tab title outputs
 *
 * Single source of truth for what constitutes valid/invalid output
 * in the tab title system. NOT related to Algorithm format.
 *
 * Tab title validators enforce the state machine:
 *   - Working titles (⚙️): gerund start ("Fixing auth bug.")
 *   - Completion titles (✓): past tense, NO gerund ("Fixed auth bug.")
 *   - Question titles: noun phrase, no period ("Auth method")
 *
 * Renamed from response-format.ts (v0.2.32) — old name was misleading.
 */

// ─── Tab Title Validation ───────────────────────────────────────

// Incomplete endings — dangling articles, prepositions, conjunctions
const INCOMPLETE_ENDINGS = new Set([
  'the', 'a', 'an', 'to', 'for', 'with', 'of',
  'in', 'on', 'at', 'by', 'from', 'and', 'or', 'but',
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
  if (/^(completed?|proces{1,2}e?d|processing|handled|handling|finished|finishing|worked|working|done|analyzed?) (the |on )?(task|request|work|it|input)$/i.test(content)) {
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

  // Reject single-character last words — always a truncation artifact (e.g., "V" from "V 3.0.4")
  if (lastWord.length <= 1) return { valid: false, firstWord };

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

// ─── Progressive Title Trimming ─────────────────────────────────

/**
 * Try progressively shorter word counts (from maxWords down to 2) until valid.
 * Returns the first valid title, or null if none work.
 * This prevents truncation artifacts like "Upgrading Algorithm to V."
 * by falling back to "Upgrading Algorithm." instead of "Analyzing input."
 */
export function trimToValidTitle(
  words: string[],
  validator: (text: string) => boolean,
  maxWords: number = 4
): string | null {
  const limit = Math.min(words.length, maxWords);
  for (let n = limit; n >= 2; n--) {
    let candidate = words.slice(0, n).join(' ').replace(/[,;:!?\-\u2014]+$/, '').trim();
    if (!candidate.endsWith('.')) candidate += '.';
    if (validator(candidate)) return candidate;
  }
  return null;
}

// ─── Fallbacks ──────────────────────────────────────────────────

export function getWorkingFallback(): string {
  return 'Analyzing input.';
}

export function getCompletionFallback(): string {
  return 'Task complete.';
}

export function getQuestionFallback(): string {
  return 'Awaiting input';
}


// ─── Past Tense Conversion ─────────────────────────────────────

const IRREGULAR_PAST: Record<string, string> = {
  building: 'Built', running: 'Ran', writing: 'Wrote', reading: 'Read',
  making: 'Made', finding: 'Found', getting: 'Got', setting: 'Set',
  doing: 'Did', sending: 'Sent', keeping: 'Kept', putting: 'Put',
  losing: 'Lost', telling: 'Told', understanding: 'Understood',
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

  // "modifying" → stem "modify" → "modified" (y→ied)
  if (stem.endsWith('y') && stem.length > 1 && !'aeiou'.includes(stem[stem.length - 2])) {
    const result = stem.slice(0, -1) + 'ied';
    return result.charAt(0).toUpperCase() + result.slice(1);
  }

  // Regular: stem + "ed" handles all cases correctly:
  // - "fixing" → stem "fix" → "fixed"
  // - "stopping" → stem "stopp" → "stopped" (doubled consonant preserved)
  // - "processing" → stem "process" → "processed" (natural 'ss' preserved)
  const result = stem + 'ed';
  return result.charAt(0).toUpperCase() + result.slice(1);
}
