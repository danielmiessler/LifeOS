#!/usr/bin/env bun
/**
 * PromptProcessing.hook.ts - Tab Title + Session Naming (Haiku)
 *
 * PURPOSE:
 * Handles terminal tab title updates and session auto-naming via Haiku
 * inference. One process, one inference call, two outputs.
 *
 * TRIGGER: UserPromptSubmit
 *
 * NOTE: Mode/tier classification is NOT handled here — that lives in
 * TheRouter.hook.ts (which runs on the same UserPromptSubmit event,
 * before this hook, and emits MODE/TIER to additionalContext via
 * hookSpecificOutput). Satisfaction/rating capture is handled by the
 * dedicated SatisfactionCapture.hook.ts. This hook does only:
 * tab title + session naming.
 *
 * FLOW:
 * 1. Parse stdin
 * 2. Skip system text and very short prompts
 * 3. Deterministic tab title → set purple/thinking immediately
 * 4. Deterministic session name (first prompt only)
 * 5. Haiku inference → tab title + session name
 * 6. Set tab, store name, voice announce
 *
 * PERFORMANCE:
 * - Deterministic path: <50ms (no inference)
 * - Inference path: ~1-1.5s (one Haiku call for tab title + session name)
 */

import { appendFileSync, mkdirSync, existsSync, readFileSync, writeFileSync, rmdirSync, renameSync, statSync } from 'fs';
import { join, dirname } from 'path';

import { inference } from '../LIFEOS/TOOLS/Inference';
import { getIdentity, getPrincipal } from './lib/identity';
import { isValidWorkingTitle, getWorkingFallback, trimToValidTitle } from './lib/output-validators';
import { setTabState, getSessionOneWord, readTabState, extractModeToken, setPhaseTab } from './lib/tab-setter';
import type { AlgorithmTabPhase } from './lib/tab-constants';
import { paiPath } from './lib/paths';
import { updateSessionNameInWorkJson, upsertSession } from './lib/isa-utils';
import { isDesktopChannel, logSkippedVoice, getNotificationChannel } from './lib/notification-channel';

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

interface InferenceResult {
  tab_title: string | null;
  session_name: string | null;
}

function appendPromptProcessingTelemetry(entry: Record<string, unknown>): void {
  try {
    const logPath = paiPath('MEMORY', 'OBSERVABILITY', 'prompt-processing.jsonl');
    const serialized = JSON.stringify(entry);
    if (serialized.includes('\n')) return;
    appendFileSync(logPath, `${serialized}\n`, 'utf-8');
  } catch {}
}

// ── Constants ──

const BASE_DIR = process.env.LIFEOS_DIR || join(process.env.HOME!, '.claude', 'LIFEOS');
const SESSION_NAMES_PATH = paiPath('MEMORY', 'STATE', 'session-names.json');
const LOCK_PATH = SESSION_NAMES_PATH + '.lock';
const MIN_PROMPT_LENGTH = 3;
const LOCK_TIMEOUT = 3000;
const LOCK_STALE = 10000;

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

// ══════════════════════════════════════════════════
// FAST PATH DETECTION (for skip logic)
// ══════════════════════════════════════════════════

function isExplicitRating(prompt: string): boolean {
  const trimmed = prompt.trim();
  const match = trimmed.match(/^(10|[1-9])(?:\s*[-:]\s*|\s+)?(.*)$/);
  if (!match) return false;
  const afterNumber = trimmed.slice(match[1].length);
  if (afterNumber.length > 0 && /^[/.\dA-Za-z]/.test(afterNumber)) return false;
  const rest = match[2]?.trim();
  if (rest) {
    const sentenceStarters = /^(items?|things?|steps?|files?|lines?|bugs?|issues?|errors?|times?|minutes?|hours?|days?|seconds?|percent|%|th\b|st\b|nd\b|rd\b|of\b|in\b|at\b|to\b|the\b|a\b|an\b)/i;
    if (sentenceStarters.test(rest)) return false;
  }
  return true;
}

const POSITIVE_PRAISE_WORDS = new Set([
  'excellent', 'amazing', 'brilliant', 'fantastic', 'wonderful', 'beautiful',
  'incredible', 'awesome', 'perfect', 'great', 'nice', 'superb', 'outstanding',
  'magnificent', 'stellar', 'phenomenal', 'remarkable', 'terrific', 'splendid',
]);
const POSITIVE_PHRASES = new Set([
  'great job', 'good job', 'nice work', 'well done', 'nice job', 'good work',
  'love it', 'nailed it', 'looks great', 'looks good', 'thats great', 'that works',
]);

const SYSTEM_TEXT_PATTERNS = [
  /^<task-notification>/i,
  /^<system-reminder>/i,
  /^This session is being continued from a previous conversation/i,
  /^Please continue the conversation/i,
  /^Note:.*was read before/i,
];

// ══════════════════════════════════════════════════
// TAB TITLE — Deterministic Extraction
// ══════════════════════════════════════════════════

/** Convert a base verb to gerund form. */
function toGerund(verb: string): string {
  const v = verb.toLowerCase();
  if (v.endsWith('ing')) return v; // already gerund
  if (v.endsWith('ie')) return v.slice(0, -2) + 'ying';
  if (v.endsWith('e') && !v.endsWith('ee') && !v.endsWith('ye')) return v.slice(0, -1) + 'ing';
  if (/^[a-z]+[bcdfghlmnprstvwz]$/.test(v) && v.length <= 5
      && 'aeiou'.includes(v[v.length - 2])) return v + v.slice(-1) + 'ing';
  return v + 'ing';
}

/**
 * Derive a gerund tab title from a session name.
 * "Fix Session Naming Logic" → "Fixing session naming."
 * "Build LifeOS TUI Dataviz" → "Building LifeOS TUI."
 * Returns null if the session name doesn't start with a convertible verb.
 */
function sessionNameToTabTitle(name: string): string | null {
  const words = name.split(/\s+/).filter(w => w.length > 0);
  if (words.length < 2) return null;

  const first = words[0].toLowerCase();
  if (!ACTION_VERBS.has(first) && !META_VERBS.has(first)) return null;

  const gerund = toGerund(first);
  const cap = gerund.charAt(0).toUpperCase() + gerund.slice(1);
  const titleWords = [cap, ...words.slice(1, 4)];
  return trimToValidTitle(titleWords, isValidWorkingTitle);
}

/**
 * Deterministic tab title extraction — unified with session naming.
 * First tries to derive from session name understanding (same subject-first
 * extraction), then falls back to direct gerund extraction from prompt.
 */
function quickTitle(prompt: string): string | null {
  // Strategy 0: Question detection — "Where are pet stores?" → "Researching pet stores."
  const sanitized = sanitizePromptForNaming(prompt);
  const questionSubject = extractQuestionSubject(sanitized);
  if (questionSubject) {
    const subjectText = questionSubject.slice(0, 3).join(' ').toLowerCase();
    const candidate = `Researching ${subjectText}.`;
    if (isValidWorkingTitle(candidate)) return candidate;
  }

  // Strategy 1: Derive from session name understanding (unified with naming system)
  const sessionName = extractFallbackName(sanitized);
  if (sessionName) {
    const derived = sessionNameToTabTitle(sessionName);
    if (derived) return derived;
  }

  // Strategy 2: Direct gerund extraction from prompt
  const text = prompt.trim().replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 200);
  const words = text.split(' ').filter(w => w.length > 1);
  if (words.length === 0) return null;

  const first = words[0].toLowerCase().replace(/[^a-z]/g, '');
  if (!first) return null;

  // Already a gerund — use directly
  if (first.endsWith('ing') && first.length > 4
      && !first.endsWith('thing') && !first.endsWith('ring') && !first.endsWith('king')) {
    return trimToValidTitle(words, isValidWorkingTitle);
  }

  // ONLY gerundify known action verbs — never arbitrary words like "where", "information"
  if (ACTION_VERBS.has(first) || META_VERBS.has(first)) {
    const gerund = toGerund(first);
    const capitalized = gerund.charAt(0).toUpperCase() + gerund.slice(1);
    const titleWords = [capitalized, ...words.slice(1, 4)];
    return trimToValidTitle(titleWords, isValidWorkingTitle);
  }

  return null;
}

// ══════════════════════════════════════════════════
// SESSION NAMING — Deterministic + Lock
// ══════════════════════════════════════════════════

interface SessionNames { [sessionId: string]: string; }

const NOISE_WORDS = new Set([
  // articles, pronouns, prepositions
  'the', 'a', 'an', 'i', 'my', 'me', 'we', 'you', 'your', 'it', 'its',
  'this', 'that', 'these', 'those', 'he', 'she', 'they', 'them', 'our',
  'in', 'on', 'at', 'to', 'for', 'of', 'with', 'from', 'by', 'about',
  // auxiliaries & fillers
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'do', 'does', 'did',
  'can', 'could', 'will', 'would', 'shall', 'should', 'may', 'might',
  'have', 'has', 'had', 'just', 'please', 'okay', 'hey', 'hello', 'hi',
  'now', 'also', 'very', 'really', 'actually', 'basically', 'literally',
  'some', 'any', 'all', 'every', 'each', 'not', 'but', 'and', 'or',
  'so', 'if', 'then', 'than', 'like', 'well', 'yeah', 'yes', 'no',
  'here', 'there', 'where', 'when', 'how', 'what', 'which', 'who', 'why',
  'need', 'want', 'going', 'got', 'get', 'getting', 'thing', 'things',
  'stuff', 'way', 'lot', 'bit', 'kind', 'sort', 'feel', 'think', 'know',
  'say', 'said', 'tell', 'told', 'look', 'looking', 'keep', 'keeps',
  'let', 'lets', 'put', 'take', 'took', 'try', 'tried', 'trying',
  // generic verb forms with no naming specificity
  'happened', 'happening', 'doing', 'done', 'went', 'gone', 'came',
  'coming', 'made', 'making', 'seems', 'seem', 'seemed', 'works',
  'worked', 'working', 'else', 'still', 'already', 'again', 'back',
  'same', 'different', 'other', 'another', 'much', 'many', 'more',
  'most', 'less', 'last', 'first', 'next', 'new', 'old', 'only',
  'even', 'around', 'before', 'after', 'between', 'through', 'into',
  // contraction remnants (after apostrophe stripping)
  'don', 'doesn', 'didn', 'won', 'wouldn', 'couldn', 'shouldn',
  'isn', 'aren', 'wasn', 'weren', 'hasn', 'haven', 'hadn', 've', 'll', 're',
  // profanity — also in PROFANITY_WORDS below
  'fuck', 'fucking', 'fucked', 'fucker', 'shit', 'shitty', 'damn', 'damned',
  'ass', 'bitch', 'crap', 'wtf', 'cunt', 'dumb', 'stupid', 'goddamn',
  'hell', 'bastard', 'bullshit',
  // conjunctions and subordinators
  'though', 'although', 'however', 'therefore', 'moreover', 'furthermore',
  'unless', 'despite', 'whereas', 'whether', 'nevertheless', 'hence',
  // prepositions not in original set
  'under', 'over', 'above', 'below', 'within', 'without', 'during',
  'against', 'upon', 'toward', 'towards', 'along', 'across', 'behind',
  'beside', 'beneath', 'among', 'throughout', 'beyond', 'except',
]);

const PROFANITY_WORDS = new Set([
  'fuck', 'fucking', 'fucked', 'fucker', 'shit', 'shitty', 'damn', 'damned',
  'ass', 'bitch', 'crap', 'wtf', 'cunt', 'dumb', 'stupid', 'goddamn',
  'hell', 'bastard', 'bullshit',
]);

function acquireLock(): boolean {
  const deadline = Date.now() + LOCK_TIMEOUT;
  while (Date.now() < deadline) {
    try { mkdirSync(LOCK_PATH); return true; }
    catch {
      try {
        const stat = statSync(LOCK_PATH);
        if (Date.now() - stat.mtimeMs > LOCK_STALE) {
          try { rmdirSync(LOCK_PATH); } catch {} continue;
        }
      } catch {}
      Bun.sleepSync(50);
    }
  }
  return false;
}

function releaseLock(): void { try { rmdirSync(LOCK_PATH); } catch {} }

function readSessionNames(): SessionNames {
  try {
    if (existsSync(SESSION_NAMES_PATH)) return JSON.parse(readFileSync(SESSION_NAMES_PATH, 'utf-8'));
  } catch {
    try {
      const bakPath = SESSION_NAMES_PATH + '.bak';
      if (existsSync(bakPath)) return JSON.parse(readFileSync(bakPath, 'utf-8'));
    } catch {}
  }
  return {};
}

function writeSessionNames(names: SessionNames): void {
  const dir = dirname(SESSION_NAMES_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  try {
    if (existsSync(SESSION_NAMES_PATH)) {
      writeFileSync(SESSION_NAMES_PATH + '.bak', readFileSync(SESSION_NAMES_PATH), 'utf-8');
    }
  } catch {}
  const tmpPath = SESSION_NAMES_PATH + '.tmp.' + process.pid;
  writeFileSync(tmpPath, JSON.stringify(names, null, 2), 'utf-8');
  renameSync(tmpPath, SESSION_NAMES_PATH);
}

/**
 * If the prompt opens with a pasted email/letter (greeting line followed by a
 * recognizable closing word), strip the letter and return only the user's own
 * wrap-around instruction — which is what they actually want a session named for.
 *
 * Pattern: greeting at start ("Hey/Hi/Hello/Dear/Greetings ...,\n") AND a closing
 * word later in the body ("Thanks/Best/Cheers/Regards/Sincerely/Yours/Cordially").
 *
 * Conservative: only fires when BOTH the greeting AND the closing are present
 * AND the post-closing remainder is ≥30 chars (otherwise the "letter" probably IS
 * the user's whole prompt). This stops session names like "Add Agenda Thanks Accurate Guys"
 * — words pulled from a pasted email — and instead names the session from the user's
 * actual instruction that follows.
 */
function stripPastedLetter(prompt: string): string {
  const openingPattern = /^\s*(Hey|Hi|Hello|Dear|Greetings)\b[^\n]{0,80}\n/i;
  if (!openingPattern.test(prompt)) return prompt;

  const closingPattern = /\b(Thanks|Best|Cheers|Regards|Sincerely|Yours|Cordially|Respectfully)\b[,.]?/i;
  const match = prompt.match(closingPattern);
  if (!match || match.index === undefined) return prompt;

  const afterClosing = prompt.slice(match.index + match[0].length).trim();
  return afterClosing.length >= 30 ? afterClosing : prompt;
}

function sanitizePromptForNaming(prompt: string): string {
  return stripPastedLetter(prompt)
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, ' ')
    .replace(/<task-notification>[\s\S]*?<\/task-notification>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    // URL → content-token extraction (BEFORE path-stripping mangles them).
    // GitHub: keep the repo name. Generic URL: keep the host (sans TLD).
    .replace(/https?:\/\/(?:www\.)?github\.com\/[\w.-]+\/([\w.-]+?)(?=[/?#.]|$)/gi,
      (_, repo) => ' ' + titleCase(String(repo).replace(/[._-]+/g, '')) + ' ')
    .replace(/https?:\/\/(?:www\.)?([\w-]+)\.[\w.-]+(?:\/\S*)?/gi,
      (_, host) => ' ' + titleCase(String(host).replace(/[._-]+/g, '')) + ' ')
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')  // strip markdown bold/italic
    .replace(/`[^`]+`/g, ' ')                   // strip inline code
    .replace(/(?:called|result of calling)\s+the\s+\w+\s+tool[^.]*\./gi, ' ')
    .replace(/\bread\s+(?:the\s+)?output\s+file\b/gi, ' ')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ' ')
    .replace(/\b[0-9a-f]{7,}\b/gi, ' ')
    .replace(/(?:\/[\w.-]+){2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Common action verbs that make good title anchors
const ACTION_VERBS = new Set([
  'fix', 'build', 'create', 'deploy', 'debug', 'add', 'remove', 'update',
  'delete', 'refactor', 'migrate', 'implement', 'design', 'test', 'check',
  'review', 'analyze', 'research', 'investigate', 'configure', 'setup',
  'install', 'uninstall', 'restore', 'optimize', 'improve', 'clean',
  'sync', 'push', 'pull', 'merge', 'revert', 'launch', 'stop', 'start',
  'restart', 'monitor', 'diagnose', 'trace', 'profile', 'audit', 'scan',
  'export', 'import', 'generate', 'write', 'read', 'send', 'fetch',
  'search', 'find', 'replace', 'rename', 'move', 'copy', 'list',
  'show', 'hide', 'enable', 'disable', 'upgrade', 'downgrade', 'publish',
  'draft', 'edit', 'rewrite', 'shrink', 'expand', 'reduce', 'bump',
  'extract', 'compile', 'run', 'execute', 'schedule', 'automate',
  'connect', 'disconnect', 'authenticate', 'authorize', 'validate',
  'open', 'close', 'compare', 'evaluate', 'assess', 'explore', 'discover', 'resolve',
  'redesign', 'rebuild', 'rethink', 'modernize', 'simplify', 'consolidate',
]);

// Question words — signal a question prompt, not a task command
const QUESTION_WORDS = new Set([
  'where', 'what', 'how', 'when', 'why', 'who', 'which',
  'can', 'could', 'does', 'do', 'is', 'are', 'was', 'were',
  'will', 'would', 'should', 'has', 'have', 'had',
]);

/**
 * Check if a prompt starts with a question and has no task verb following.
 * "Where are pet stores?" → true (question, no task verb)
 * "Can you fix the auth bug?" → false (question word + task verb "fix")
 * "What the fuck is this tab title?" → false (profanity + "fix" likely follows)
 * Returns the extracted subject words if it IS a question, null otherwise.
 */
function extractQuestionSubject(prompt: string): string[] | null {
  const words = prompt
    .replace(/[^a-zA-Z\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2);

  if (words.length < 2) return null;

  const first = words[0].toLowerCase();
  if (!QUESTION_WORDS.has(first)) return null;

  // Scan for a task verb — if found, this is a task command not a question
  for (let i = 1; i < Math.min(words.length, 12); i++) {
    const w = words[i].toLowerCase();
    if (ACTION_VERBS.has(w) && !META_VERBS.has(w)) return null;
  }

  // It's a genuine question — extract subject (non-noise content words)
  const subjects: string[] = [];
  for (const w of words) {
    const lower = w.toLowerCase();
    if (NOISE_WORDS.has(lower)) continue; // QUESTION_WORDS is a subset of NOISE_WORDS
    if (w.length >= 3) subjects.push(w);
    if (subjects.length >= 3) break;
  }

  return subjects.length >= 1 ? subjects : null;
}

// Meta-instruction verbs — describe user→AI interaction, not the task itself
// These should not anchor session names (Strategy 1) but aren't filtered from all output
const META_VERBS = new Set([
  'pull', 'show', 'see', 'find', 'look', 'list', 'read', 'open',
  'check', 'view', 'display', 'bring', 'give', 'tell', 'help',
  'continue', 'resume', 'recall', 'remember', 'repeat', 'finish',
  'complete', 'redo', 'grab', 'load', 'fetch', 'retrieve', 'access',
]);

function titleCase(w: string): string {
  // Preserve acronyms (all uppercase, 2-8 chars, letters only)
  if (w.length >= 2 && w.length <= 8 && /^[A-Z]+$/.test(w)) return w;
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

function extractFallbackName(prompt: string): string | null {
  const allWords = prompt
    .replace(/[^a-zA-Z\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2);

  if (allWords.length === 0) return null;

  const contentWords: { word: string; idx: number }[] = [];
  for (let i = 0; i < allWords.length; i++) {
    if (!NOISE_WORDS.has(allWords[i].toLowerCase()) && allWords[i].length >= 3) {
      contentWords.push({ word: allWords[i], idx: i });
    }
  }

  if (contentWords.length === 0) return null;

  // Strategy -1: Question detection — "Where are pet stores in South Bay?" → "Research South Bay Pet Stores"
  const questionSubject = extractQuestionSubject(prompt);
  if (questionSubject) {
    const parts = ['Research', ...questionSubject.slice(0, 4).map(w => titleCase(w))];
    // Pad with more content words to reach exactly 5 words
    for (const cw of contentWords) {
      if (parts.length >= 5) break;
      const tc = titleCase(cw.word);
      if (!parts.includes(tc)) parts.push(tc);
    }
    if (parts.length >= 5) return parts.slice(0, 5).join(' ');
  }

  // Strategy 0: Anchor on acronyms/proper nouns (project & tech names like LifeOS, TUI, API)
  const acronyms = contentWords.filter(cw => /^[A-Z]{2,8}$/.test(cw.word));
  if (acronyms.length >= 1) {
    const taskVerb = contentWords.find(cw =>
      ACTION_VERBS.has(cw.word.toLowerCase()) && !META_VERBS.has(cw.word.toLowerCase())
    );
    const parts: string[] = [];
    if (taskVerb) parts.push(taskVerb.word);
    const used = new Set(parts.map(w => w.toLowerCase()));
    for (const a of acronyms) {
      if (parts.length >= 5) break;
      if (!used.has(a.word.toLowerCase())) { parts.push(a.word); used.add(a.word.toLowerCase()); }
    }
    for (const cw of contentWords) {
      if (parts.length >= 5) break;
      if (!used.has(cw.word.toLowerCase()) && !META_VERBS.has(cw.word.toLowerCase())) {
        parts.push(cw.word); used.add(cw.word.toLowerCase());
      }
    }
    if (parts.length >= 5) {
      return parts.slice(0, 5).map(w => titleCase(w)).join(' ');
    }
  }

  // Strategy 1: Find a TASK action verb and take it + next 4 content words.
  // Validate before returning — fall through if S1's lead doesn't pass.
  for (let i = 0; i < contentWords.length; i++) {
    const lower = contentWords[i].word.toLowerCase();
    if (ACTION_VERBS.has(lower) && !META_VERBS.has(lower)) {
      const phrase = contentWords.slice(i, i + 5);
      if (phrase.length >= 5) {
        const candidate = phrase.slice(0, 5).map(p => titleCase(p.word)).join(' ');
        if (isValidSessionName(candidate)) return candidate;
      }
    }
  }

  // Strategy 2: First non-meta content words (require 5). Validate before returning.
  const nonMeta = contentWords.filter(cw => !META_VERBS.has(cw.word.toLowerCase()));
  if (nonMeta.length >= 5) {
    const candidate = nonMeta.slice(0, 5).map(p => titleCase(p.word)).join(' ');
    if (isValidSessionName(candidate)) return candidate;
  }

  // Strategy 3: Original fallback — first content words (require 5). Validate before returning.
  if (contentWords.length >= 5) {
    const candidate = contentWords.slice(0, 5).map(p => titleCase(p.word)).join(' ');
    if (isValidSessionName(candidate)) return candidate;
  }

  // Strategy 4: Last-resort — ANY content words, ALWAYS prepend "Review".
  // Fires when prior strategies produce a name whose lead word isn't a recognized
  // ACTION_VERB. Requires at least 4 distinct content picks so "Review" + picks = 5.
  // If the prompt is too thin to produce 4 honest picks, return null and let inference
  // handle it — no padding with filler that produces ungrammatical names.
  if (contentWords.length >= 4) {
    const properNouns = contentWords.filter(cw => /^[A-Z][a-z]/.test(cw.word));
    const properSet = new Set(properNouns.map(p => p.word.toLowerCase()));
    const otherContent = contentWords.filter(cw => {
      const lc = cw.word.toLowerCase();
      return !properSet.has(lc) && !META_VERBS.has(lc) && !NOISE_WORDS.has(lc);
    });
    const ordered = [...properNouns, ...otherContent];
    const seen = new Set<string>();
    const picks: string[] = [];
    for (const cw of ordered) {
      const tc = titleCase(cw.word);
      const lc = tc.toLowerCase();
      if (seen.has(lc) || NOISE_WORDS.has(lc)) continue;
      seen.add(lc);
      picks.push(tc);
      if (picks.length >= 4) break;
    }
    if (picks.length >= 4) {
      // 'Review' is in ACTION_VERBS and not in BANNED_SESSION_LEAD.
      const candidate = ['Review', ...picks].slice(0, 5).join(' ');
      if (isValidSessionName(candidate)) return candidate;
    }
  }

  // Truly nothing usable — let inference handle it (or accept the unnamed session).
  return null;
}

// Lead verbs banned from session names — meta-instructions, not task descriptions
const BANNED_SESSION_LEAD = new Set([
  'pull', 'show', 'see', 'look', 'view', 'display', 'bring', 'give', 'tell', 'help',
  'continue', 'resume', 'recall', 'remember', 'repeat', 'finish', 'complete', 'redo',
  'grab', 'load', 'retrieve', 'access', 'list',
]);

/**
 * Validate that a session name is grammatically correct.
 * Pattern: [Base-form Action Verb] [Content Word] [Content Word] [Content Word] [Content Word]
 * Rejects names that read as word salad, start with non-verb words, or fall short of 5 words.
 */
function isValidSessionName(name: string): boolean {
  const words = name.split(/\s+/).filter(w => w.length > 0);
  if (words.length !== 5) return false;

  // Reject embedded punctuation that signals fragment-with-commas patterns
  if (/[,;:/\\]/.test(name)) return false;

  const first = words[0].toLowerCase();

  // First word must be a recognized base-form action verb, not a meta-instruction
  if (!ACTION_VERBS.has(first) || BANNED_SESSION_LEAD.has(first)) return false;

  // Middle words must not be noise/function words (acronyms exempt)
  for (let i = 1; i < words.length; i++) {
    if (/^[A-Z]{2,8}$/.test(words[i])) continue;
    if (NOISE_WORDS.has(words[i].toLowerCase())) return false;
  }

  return true;
}

/**
 * Ensure the label is unique across OTHER sessions. If another sessionId already
 * owns this exact label, append " 2", " 3" … up to " 9". Beyond 9 we append the
 * caller's short sessionId hash (e.g. " #a3f2c1") so collisions stay unique
 * instead of silently reintroducing the duplicate the function is meant to
 * prevent. Scan ignores `sessionId` itself so re-fires are idempotent.
 * Runs inside the acquired session-names.json file lock in storeName().
 */
function disambiguateLabel(sessionId: string, label: string, names: SessionNames): string {
  const isTaken = (candidate: string) =>
    Object.entries(names).some(([id, v]) => id !== sessionId && v === candidate);
  if (!isTaken(label)) return label;
  for (let n = 2; n <= 9; n++) {
    const candidate = `${label} ${n}`;
    if (!isTaken(candidate)) return candidate;
  }
  const shortHash = sessionId.replace(/-/g, '').slice(0, 6);
  return `${label} #${shortHash}`;
}

function storeName(sessionId: string, label: string, source: string): void {
  const locked = acquireLock();
  if (!locked) console.error('[PromptProcessing] Lock timeout — writing anyway');
  let finalLabel = label;
  try {
    const names = readSessionNames();
    finalLabel = disambiguateLabel(sessionId, label, names);
    if (finalLabel !== label) {
      console.error(`[PromptProcessing] Disambiguated "${label}" → "${finalLabel}" (collision with another session)`);
    }
    names[sessionId] = finalLabel;
    writeSessionNames(names);
  } finally {
    if (locked) releaseLock();
  }
  const cacheContent = `cached_session_id='${sessionId}'\ncached_session_label='${finalLabel}'\n`;
  writeFileSync(paiPath('MEMORY', 'STATE', 'session-name-cache.sh'), cacheContent, 'utf-8');
  updateSessionNameInWorkJson(sessionId, finalLabel);
  syncNameToJsonl(sessionId, finalLabel);
  console.error(`[PromptProcessing] Named session: "${finalLabel}" (${source})`);
}

/** Find Claude Code's session JSONL path for a given session ID. */
function findSessionJsonl(sessionId: string): string | null {
  try {
    for (const dir of [paiPath('projects'), paiPath('Projects')]) {
      if (!existsSync(dir)) continue;
      const r = Bun.spawnSync(['find', dir, '-maxdepth', '2', '-name', `${sessionId}.jsonl`],
        { stdout: 'pipe', stderr: 'pipe', timeout: 2000 });
      const p = r.stdout.toString().trim().split('\n')[0];
      if (p && existsSync(p)) return p;
    }
  } catch {}
  return null;
}

/** Read the last custom-title from Claude Code's session JSONL (for /rename sync). */
function getCustomTitle(sessionId: string): string | null {
  const jsonlPath = findSessionJsonl(sessionId);
  if (!jsonlPath) return null;
  try {
    let last: string | null = null;
    for (const line of readFileSync(jsonlPath, 'utf-8').split('\n')) {
      if (!line.trim()) continue;
      try {
        const e = JSON.parse(line);
        if (e.type === 'custom-title' && e.customTitle) last = e.customTitle;
      } catch {}
    }
    return last;
  } catch {}
  return null;
}

/** Sync session name to Claude Code's JSONL so /sessions list matches. */
function syncNameToJsonl(sessionId: string, title: string): void {
  const jsonlPath = findSessionJsonl(sessionId);
  if (!jsonlPath) return;
  try {
    appendFileSync(jsonlPath, JSON.stringify({ type: 'custom-title', customTitle: title, sessionId }) + '\n', 'utf-8');
  } catch {}
}

// Narrow algorithm-verb detector: these 8 verbs signal explicit multi-phase
// (ISC-gated) algorithm work. Everything else that passes the trivia gates
// upstream (length, praise, system-text) is treated as native mode.
const ALGO_ACTION_RE = /\b(implement|build|create|architect|design|migrate|deploy|refactor)\b/i;
function isNativeMode(prompt: string): boolean { return !ALGO_ACTION_RE.test(prompt.trim()); }

// ══════════════════════════════════════════════════
// COMBINED INFERENCE
// ══════════════════════════════════════════════════

const PRINCIPAL_NAME = getPrincipal().name;
const ASSISTANT_NAME = getIdentity().name;

function buildContextPrompt(includeSessionName: boolean): string {
  return `You analyze user messages to extract what WORK is being done. ${PRINCIPAL_NAME} is the only user. The AI assistant is ${ASSISTANT_NAME}.

## TASK 1: TAB TITLE
Create a 2-4 word gerund phrase describing what WORK is being done — the project/feature/system being worked on, NOT how the user asked.
Rules: Start with gerund (-ing verb), include the specific subject/project, end with period, max 4 words.
CRITICAL: Extract the SUBJECT of the work, not the user's instruction. "Pull up the LifeOS TUI" → "Building LifeOS TUI." (the work), NOT "Pulling up work." (the instruction).
GOOD: "Fixing auth bug.", "Building LifeOS dashboard.", "Debugging feed system.", "Researching pet stores."
BAD: "Pulling up work.", "Completing the task.", "Showing session data.", "Working on it.", "Whering are pet."
QUESTIONS: If the message is a question (Where/What/How/Why/When), use "Researching [subject]." — e.g., "Where are pet stores?" → "Researching pet stores."
${includeSessionName ? `
## TASK 2: SESSION NAME
The session name is a HANDLE. ${PRINCIPAL_NAME} should be able to scan it in a task list weeks from now and instantly recognize: "this is the session where I {goal}." It must answer three nested questions in one 5-word phrase:
  (1) What is the prompt about? (the topic surface)
  (2) What is the session for? (the work being done)
  (3) What is the goal? (the outcome ${PRINCIPAL_NAME} wants)

If the name doesn't answer all three, it's a keyword label and it's wrong. Re-read the prompt and find the goal.

THINK FIRST: What is ${PRINCIPAL_NAME} actually trying to ACCOMPLISH? Not what words appear, not how he asked, not what surface tokens are present — what is the GOAL?
- Words appearing in the prompt are EVIDENCE, not the answer. The goal lives in ${PRINCIPAL_NAME}'s actual question or instruction.
- Ignore HOW they asked (pull up, show me, continue with, look at, hey, thanks) — those are interaction tokens, not work.
- Focus on the GOAL (what outcome is being pursued: a decision, a fix, a build, a piece of research, an evaluation).
- The name should be a complete imperative phrase. Read it aloud — it should sound like "{{PRINCIPAL_NAME}} needs to ___" filled in coherently.
- **Pasted content rule:** If the user pastes an email, letter, message, quote, document, or any block of text that someone ELSE wrote (signs like "Hey [Name],", a closing like "Thanks,/Best,/Cheers,/Regards,", quoted reviews, copied tweets, forwarded messages), the GOAL is ${PRINCIPAL_NAME}'s question or instruction WRAPPED AROUND that content — NOT words from the pasted content itself. Words like "Thanks", "Hey", "Dear", "Regards", "Agenda", "Accurate", recipient names, sender names, subject lines, and other email/letter tokens are NEVER subjects of work. Find ${PRINCIPAL_NAME}'s actual question ("research...", "is X fair?", "what should I do about...", "help me decide...", "evaluate...") and name the session from THAT.
- **Decision rule:** If the prompt is "Should I X or Y?" or "Is 20% fair?" the goal is a DECISION. Name it: "Decide [Subject] [Aspect]" or "Evaluate [Subject] [Aspect]".
- **Question rule:** If the prompt is "What is X?" / "How does X work?" the goal is RESEARCH. Name it: "Research [Subject] [Aspect]".
- **Build rule:** If the prompt is "Build/Fix/Refactor X" the goal is BUILD. Name it: "[Verb] [Subject] [Aspect]".

Structure: [Base-form Verb] [Modifier or Project] [Subject] [Modifier] [Object/Aspect]
Rules:
- Exactly 5 words. Not 4, not 6. Five.
- Title Case. No articles (a/an/the). No commas, hyphens, slashes, or other punctuation inside the name.
- Start with a base-form action verb (Fix, Build, Debug, Refactor, Migrate, Research, Analyze — NOT Fixing, Building).
- Preserve acronyms in ALL CAPS (LifeOS, TUI, API, UL, CLI, ISC, ISA, BPE).
- Every word must carry meaning. No filler adverbs (seriously, really, properly), no lone conjunctions, no fragment scraps.
- Reads as a grammatical phrase: imagine "{{PRINCIPAL_NAME}} needs to ___" — the name fills the blank as a coherent action.

Examples of separating instruction from subject:
- "Pull up the LifeOS TUI work and continue" → subject is LifeOS TUI → "Build LifeOS TUI Dashboard Interface"
- "Show me what's wrong with the feed system" → subject is feed system → "Debug Feed System Latency Issue"
- "Hey check on the session naming, it's broken again" → subject is session naming → "Fix Session Naming Hook Logic"
- "I want to see the admin dashboard purchases" → subject is admin purchases → "Fix Admin Dashboard Purchase Display"
- "Where are pet stores in South Bay?" → question about pet stores → "Research South Bay Pet Stores"
- "What's the best drum pedal for metal?" → question about drum pedals → "Research Best Metal Drum Pedals"
- "How does the auth flow work?" → question about auth → "Analyze Auth Flow Design Pattern"
- "Analyze ISD, ISC, BPE differences" → subject is the three concepts → "Analyze ISD ISC BPE Differences"
- "Create the LifeOS TELOS framework" → subject is the TELOS framework → "Create LifeOS TELOS Framework System"
- "[pasted email from agent asking for commission bump]... I want you to research what a fair price is for an agent like this" → goal is research on agent commission rates → "Research Talent Agent Commission Rates" (NOT "Add Agenda Thanks Accurate Guys" — those are tokens from the pasted email, ignore them entirely)
- "[pasted Slack message about a deploy failure] What do I do?" → goal is fixing the deploy → "Fix Deploy Failure From Slack" (subject is the deploy problem, not Slack words)
- "Should I be paying them 10%, 20%, or 30%?" → goal is a percentage decision → "Decide Talent Agent Commission Percentage"
- "Is 20% fair?" → goal is fairness evaluation → "Evaluate Twenty Percent Commission Fairness"

QUESTIONS: If the message is a question (not a task command), use "Research [4 noun-phrase words]" or "Analyze [4 noun-phrase words]".
GOOD: "Fix Session Naming Word Count", "Build LifeOS TUI Dataviz Module", "Deploy Voice Server Update Hook", "Research South Bay Pet Stores", "Refactor Algorithm Phase Transition Logic"
BAD: "Fix" (one word), "Make Sure" (two words, not a task), "Analyze ISD ISC BPE" (four words, missing subject completion), "Create LifeOS TELOS Seriously Soon" (filler adverbs), "Pull Work See Continue Now" (instruction words), "Show Latest Build Status Page" (meta-instruction), "Pet Stores South Bay Area" (no verb), "Okay Recently Unified Session Name" (random fragments)` : ''}

OUTPUT FORMAT (JSON only, single object on one line, no prose, no markdown):
{
  "tab_title": "<2-4 word gerund sentence ending with period>"${includeSessionName ? `,
  "session_name": "<exactly 5 words in Title Case, grammatical task phrase>"` : ''}
}`;
}

// Assistant turns carry Algorithm scaffolding (phase headers like "Entering the Review phase",
// agent names like "Forge", SUMMARY lines). When fed into the Haiku naming prompt, those tokens
// leak into session names — producing garbage like "Review Entering Yet Forge" instead of the
// user's actual subject. Callers set `includeAssistant: false` when generating the permanent
// session name (first prompt), and can opt in for tab-title-only context on later prompts.
function getRecentContext(transcriptPath: string, maxTurns: number = 6, includeAssistant: boolean = false): string {
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
        if (includeAssistant && entry.type === 'assistant' && entry.message?.content) {
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

/**
 * Detect a slash-command / skill invocation and return the command name.
 * Two shapes reach the hook: the harness-expanded form carries an explicit
 * `<command-name>/Upgrade</command-name>` marker; a directly-typed command
 * arrives as a leading `/Upgrade` token. Returns the bare name ("Upgrade")
 * or null for ordinary prompts. The leading-slash branch requires a single
 * token so absolute paths like "/Users/x/y" never read as commands.
 */
function extractSlashCommandName(rawPrompt: string): string | null {
  const tagged = rawPrompt.match(/<command-name>\s*\/?([A-Za-z][A-Za-z0-9_-]*)/i);
  if (tagged) return tagged[1];
  const firstTok = rawPrompt.trim().split(/\s+/)[0] || '';
  if (/^\/[A-Za-z][A-Za-z0-9_-]*$/.test(firstTok)) return firstTok.slice(1);
  return null;
}

/** "create-storyexplanation" → "Create Storyexplanation". */
function commandNameToLabel(cmd: string): string {
  return cmd
    .split(/[-_]+/)
    .filter(Boolean)
    .map(titleCase)
    .join(' ');
}

async function main() {
  try {
    console.error('[PromptProcessing] Hook started');
    const input = await readStdinWithTimeout();
    const data: HookInput = JSON.parse(input);
    const prompt = data.prompt || data.user_prompt || '';
    const sessionId = data.session_id;

    if (!prompt || !sessionId) { process.exit(0); }

    // ── Determine session state ──
    const existingNames = readSessionNames();
    const isFirstPrompt = !existingNames[sessionId];
    const sanitizedPrompt = sanitizePromptForNaming(prompt);

    // ── Detect current mode for tracking ──
    const trimmedLower = prompt.trim().toLowerCase().replace(/[.!?,'"]/g, '');
    const trimmedWords = trimmedLower.split(/\s+/);
    const isMinimalInteraction = isExplicitRating(prompt) || (
      trimmedWords.length <= 2 && (
        POSITIVE_PRAISE_WORDS.has(trimmedLower) || POSITIVE_PHRASES.has(trimmedLower) ||
        (trimmedWords.length === 2 && trimmedWords.every(w => POSITIVE_PRAISE_WORDS.has(w)))
      )
    );
    const detectedCurrentMode: 'minimal' | 'native' | 'algorithm' =
      isMinimalInteraction ? 'minimal' :
      !isNativeMode(prompt) ? 'algorithm' : 'native';

    // The tab's mode/tier token is OWNED by TheRouter (the authoritative
    // classifier), not derived here. PromptProcessing used to stamp "N" from its
    // own 8-verb isNativeMode() shadow-classifier, which diverged from TheRouter
    // and showed "N" on ALGORITHM turns. Now PromptProcessing only sets the working
    // DESCRIPTION and recovers whatever token TheRouter stamped (see stampWorkingTab).

    // ── Slash-command / skill invocation: name deterministically from the command ──
    // A command name (e.g. "/Upgrade") can never satisfy the natural-language
    // naming path (extractFallbackName + inference both want a 5-word action-verb
    // phrase), so those sessions used to fall through every fallback and stay
    // unnamed. Derive the name straight from the command, store it directly
    // (bypassing the NL validator), and skip inference — deterministic > LLM.
    const slashCmd = isFirstPrompt ? extractSlashCommandName(prompt) : null;
    if (slashCmd) {
      const label = commandNameToLabel(slashCmd);
      const slashName = `${label} Skill Run`;
      storeName(sessionId, slashName, 'slash-command');
      const sessionMode = isNativeMode(prompt) ? 'native' : 'starting';
      upsertSession(sessionId, slashName, sanitizedPrompt.slice(0, 120), sessionMode, detectedCurrentMode);
      const slashLabel = getSessionOneWord(sessionId);
      const slashPrefix = slashLabel ? `${slashLabel} | ` : '';
      setTabState({ title: `⚙️ ${slashPrefix}${label}`, state: 'working', sessionId });
      process.exit(0);
    }

    // ── Session name: compute deterministic fallback but DEFER storage until after inference ──
    // Inference understands intent (project, goal). Deterministic is last resort only.
    let pendingFallbackName: string | null = null;
    if (isFirstPrompt && sanitizedPrompt) {
      pendingFallbackName = extractFallbackName(sanitizedPrompt);
      if (pendingFallbackName && !isValidSessionName(pendingFallbackName)) {
        console.error(`[PromptProcessing] Rejected invalid fallback name: "${pendingFallbackName}"`);
        pendingFallbackName = null;
      }
      const sessionMode = isNativeMode(prompt) ? 'native' : 'starting';
      // Upsert both native and starting. Native shows in the Native tab
      // (no phase strip); starting shows in Algorithm with phase progression.
      // Trivial prompts are already filtered by the fast-path gates above
      // (praise words, system text, length < MIN_PROMPT_LENGTH).
      upsertSession(sessionId, pendingFallbackName || '', sanitizedPrompt.slice(0, 120), sessionMode, detectedCurrentMode);
    } else {
      const customTitle = getCustomTitle(sessionId);
      if (customTitle && existingNames[sessionId] !== customTitle) {
        storeName(sessionId, customTitle, 'custom-title');
      }
      const sessionMode = isNativeMode(prompt) ? 'native' : 'starting';
      upsertSession(sessionId, existingNames[sessionId] || '', '', sessionMode, detectedCurrentMode);
    }

    // ── Skip Haiku inference on trivial prompts (naming/title not useful) ──
    if (isExplicitRating(prompt)) {
      process.exit(0);
    }

    const normalizedPrompt = prompt.trim().toLowerCase().replace(/[.!?,'"]/g, '');
    const promptWords = normalizedPrompt.split(/\s+/);
    if (promptWords.length <= 2) {
      if (POSITIVE_PRAISE_WORDS.has(normalizedPrompt) || POSITIVE_PHRASES.has(normalizedPrompt)
          || (promptWords.length === 2 && promptWords.every(w => POSITIVE_PRAISE_WORDS.has(w)))) {
        process.exit(0);
      }
    }

    if (SYSTEM_TEXT_PATTERNS.some(re => re.test(prompt.trim()))) {
      process.exit(0);
    }

    if (prompt.length < MIN_PROMPT_LENGTH) {
      process.exit(0);
    }

    // ── Preserve an active Algorithm session's tier+phase across iterations ──
    // On a follow-up prompt mid-Algorithm-run the prior tab already carries an
    // "E1".."E5" token and a phase. Re-stamp that phase (updating only the
    // summary) instead of reverting to the generic working gear — which is the
    // regression where the orange ⚙️ reappeared and wiped the phase tab.
    const ALGO_PHASES = new Set(['OBSERVE', 'THINK', 'PLAN', 'BUILD', 'EXECUTE', 'VERIFY', 'LEARN']);
    const priorTab = !isFirstPrompt ? readTabState(sessionId) : null;
    const priorToken = priorTab?.title ? extractModeToken(priorTab.title) : null;
    const priorPhase = (priorTab?.phase || '').toUpperCase();
    const algoIteration = !!priorToken && /^E[1-5]$/.test(priorToken) && ALGO_PHASES.has(priorPhase);

    /** Set the working/thinking tab, preserving Algorithm phase+tier on iterations. */
    const stampWorkingTab = (rawTitle: string, thinking: boolean): void => {
      if (algoIteration) {
        setPhaseTab(priorPhase as AlgorithmTabPhase, sessionId, rawTitle, priorToken!);
      } else {
        // Do NOT self-classify the mode token — TheRouter owns it. Recover the
        // token already on the tab, but ONLY when the tab shows live work; a stale
        // completion/idle token from the prior turn is dropped so it can't leak into
        // this turn (TheRouter stamps the authoritative token ~concurrently).
        const cur = readTabState(sessionId);
        const liveToken = cur && cur.state !== 'completed' && cur.state !== 'idle'
          ? (extractModeToken(cur.title) || undefined)
          : undefined;
        const icon = thinking ? '🧠' : '⚙️';
        const stampState = thinking ? 'thinking' : (liveToken === 'N' ? 'native' : 'working');
        setTabState({ title: `${icon} ${rawTitle}`, state: stampState, sessionId, modeToken: liveToken });
      }
    };

    // ── DETERMINISTIC TAB TITLE (immediate, purple/thinking) ──
    const deterministicTitle = quickTitle(prompt);
    const thinkingTitle = deterministicTitle || getWorkingFallback();
    stampWorkingTab(thinkingTitle, true);

    // ── INFERENCE: Tab title + session name ──
    console.error('[PromptProcessing] Running inference (tab title' + (isFirstPrompt ? ' + session name)...' : ')...'));

    const cleanPrompt = prompt.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1000);
    // Naming is permanent and first-prompt-only; exclude Assistant turns so Algorithm scaffolding
    // (phase headers, agent names, SUMMARY lines) cannot contaminate the session name. Tab-title
    // inference on later prompts keeps Assistant context for "continue with X" style follow-ups.
    const context = getRecentContext(data.transcript_path, 6, !isFirstPrompt);
    const userPrompt = context ? `CONTEXT:\n${context}\n\nCURRENT MESSAGE:\n${cleanPrompt}` : cleanPrompt;

    const inferenceStart = Date.now();
    try {
      const result = await inference({
        systemPrompt: buildContextPrompt(isFirstPrompt),
        userPrompt,
        expectJson: true,
        // v6.9.0 reversal: level=fast had a 44% failure rate (410/923 calls)
        // in production because the `claude` subprocess cold-start (~3-5s) plus
        // Haiku inference (~3-4s) consistently exceeded the 12s window. Cold-
        // start dominates total latency, so promoting to Sonnet costs only
        // ~1-2s extra while gaining ~3x timeout headroom and noticeably better
        // intent comprehension on session names. Subscription billing makes
        // per-call cost irrelevant — see Inference.ts L116-117 (scrubs
        // ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN before spawn).
        level: 'medium',
      });

      if (result.success && result.parsed) {
        const r = result.parsed as InferenceResult;

        // ── Process tab title ──
        let finalTitle = deterministicTitle && isValidWorkingTitle(deterministicTitle) ? deterministicTitle : getWorkingFallback();
        if (r.tab_title) {
          const inferredWords = r.tab_title.split(/\s+/);
          const validated = trimToValidTitle(inferredWords, isValidWorkingTitle);
          if (validated) {
            finalTitle = validated;
          }
        }
        // If inference session name is available, try deriving tab title from it
        // This ensures tab title and session name reflect the same understanding
        if (isFirstPrompt && r.session_name && !/[*`<>{}[\]]/.test(r.session_name)) {
          const derived = sessionNameToTabTitle(r.session_name);
          if (derived) finalTitle = derived;
        }
        stampWorkingTab(finalTitle, false);

        // ── Voice announcement (desktop channel only) ──
        // Remote channels (Telegram, iMessage) do not surface the tab-title
        // announcement audibly — it would leak desktop voice for a
        // Telegram-originated turn. Tab title is set regardless above.
        const voiceContent = finalTitle && isValidWorkingTitle(finalTitle) ? finalTitle : null;
        if (voiceContent) {
          if (isDesktopChannel()) {
            const identity = getIdentity();
            try {
              await fetch('http://localhost:31337/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  message: voiceContent.replace(/\.$/, ''),
                  voice_id: identity.mainDAVoiceID,
                  voice_enabled: true,
                }),
                signal: AbortSignal.timeout(5000),
              });
            } catch {}
          } else {
            const channel = getNotificationChannel();
            console.error(`[PromptProcessing] Voice OFF (remote channel: ${channel})`);
            logSkippedVoice({ hookLabel: 'PromptProcessing', message: voiceContent, sessionId });
          }
        }

        // ── Process session name from inference (first prompt only) ──
        // Inference understands intent — it's the PRIMARY source for session names
        let inferenceNameStored = false;
        if (isFirstPrompt && r.session_name) {
          if (/[*`<>{}[\]]/.test(r.session_name)) {
            console.error('[PromptProcessing] Rejected session name with artifacts');
          } else {
            const nameWords = r.session_name.trim().split(/\s+/).slice(0, 5);
            const label = nameWords.map(w => titleCase(w)).join(' ');
            const hasProfanity = nameWords.some(w => PROFANITY_WORDS.has(w.toLowerCase()));
            if (label && nameWords.length >= 5 && nameWords.every(w => w.length >= 2) && !hasProfanity && isValidSessionName(label)) {
              storeName(sessionId, label, 'inference-haiku');
              inferenceNameStored = true;
            } else if (label) {
              console.error(`[PromptProcessing] Rejected invalid session name: "${label}"`);
            }
          }
        }
        // If inference didn't produce a name, fall back to deterministic
        if (isFirstPrompt && !inferenceNameStored && pendingFallbackName) {
          storeName(sessionId, pendingFallbackName, 'deterministic-fallback');
        }

        appendPromptProcessingTelemetry({
          timestamp: new Date().toISOString(),
          session_id: sessionId,
          prompt_excerpt: cleanPrompt.slice(0, 120),
          tab_title: r.tab_title ?? null,
          session_name: isFirstPrompt ? (r.session_name ?? null) : null,
          source: 'inference',
          latency_ms: Date.now() - inferenceStart,
        });

      } else {
        console.error(`[PromptProcessing] Inference failed: ${result.error}`);
        if (isFirstPrompt && pendingFallbackName) {
          storeName(sessionId, pendingFallbackName, 'deterministic-fallback');
        }
        const fallbackTitle = deterministicTitle && isValidWorkingTitle(deterministicTitle) ? deterministicTitle : getWorkingFallback();
        stampWorkingTab(fallbackTitle, false);
        appendPromptProcessingTelemetry({
          timestamp: new Date().toISOString(),
          session_id: sessionId,
          prompt_excerpt: cleanPrompt.slice(0, 120),
          source: 'inference-failed',
          error: String(result.error ?? 'unknown').slice(0, 80),
          latency_ms: Date.now() - inferenceStart,
        });
      }
    } catch (err) {
      console.error(`[PromptProcessing] Inference error: ${err}`);
      if (isFirstPrompt && pendingFallbackName) {
        storeName(sessionId, pendingFallbackName, 'deterministic-fallback');
      }
      const fallbackTitle = deterministicTitle && isValidWorkingTitle(deterministicTitle) ? deterministicTitle : getWorkingFallback();
      stampWorkingTab(fallbackTitle, false);
      appendPromptProcessingTelemetry({
        timestamp: new Date().toISOString(),
        session_id: sessionId,
        prompt_excerpt: cleanPrompt.slice(0, 120),
        source: 'inference-error',
        error: String(err).slice(0, 80),
        latency_ms: Date.now() - inferenceStart,
      });
    }

    process.exit(0);
  } catch (err) {
    console.error(`[PromptProcessing] Fatal error: ${err}`);
    process.exit(0);
  }
}

main();
