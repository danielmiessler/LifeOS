#!/usr/bin/env bun
import './lib/gate';
/**
 * UpdateTabTitle.hook.ts - Tab Title on Prompt Receipt (UserPromptSubmit)
 *
 * TRIGGER: UserPromptSubmit
 *
 * PRIME DIRECTIVE:
 * Show what this session is working on, at a glance, across multiple tabs.
 *
 * TITLE RULES (enforced by isValidWorkingTitle):
 * 1. Starts with a gerund (-ing verb)
 * 2. 2-4 words total (ONE sentence)
 * 3. Ends with a period
 * 4. Grammatically complete — no dangling articles/prepositions/conjunctions
 * 5. Specific — names the actual object being acted on
 * 6. No generic garbage ("Completing task", "Processing request")
 * 7. No first-person pronouns
 *
 * FLOW:
 * 1. Extract quick title from prompt (deterministic, instant) → 🧠 purple
 * 2. Run inference for better summary → validate with isValidWorkingTitle
 * 3. Show validated title → ⚙️ orange
 * 4. If validation fails both paths → getWorkingFallback()
 *
 * VOICE: Announces inference-generated summary on prompt receipt.
 * Task completion voice is separate (StopOrchestrator → VoiceNotification handler).
 * DO NOT REMOVE voice from this hook — see MEMORY/LEARNING/SYSTEM/2026-01/
 * 2026-01-15-205500_LEARNING_voice-on-prompt-submit-architecture.md
 */

import { inference } from '../skills/PAI/Tools/Inference';
import { isValidWorkingTitle, getWorkingFallback } from './lib/output-validators';
import { setTabState, getSessionOneWord } from './lib/tab-setter';
import { getIdentity } from './lib/identity';

interface HookInput {
  session_id: string;
  prompt: string;
  transcript_path: string;
}

async function readStdinWithTimeout(timeout: number = 5000): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    const timer = setTimeout(() => reject(new Error('Timeout')), timeout);
    process.stdin.on('data', (chunk) => { data += chunk.toString(); });
    process.stdin.on('end', () => { clearTimeout(timer); resolve(data); });
    process.stdin.on('error', (err) => { clearTimeout(timer); reject(err); });
  });
}

// Common imperative → gerund mappings
const GERUND_MAP: Record<string, string> = {
  fix: 'Fixing', update: 'Updating', add: 'Adding', remove: 'Removing',
  delete: 'Deleting', check: 'Checking', create: 'Creating', build: 'Building',
  deploy: 'Deploying', debug: 'Debugging', test: 'Testing', review: 'Reviewing',
  refactor: 'Refactoring', implement: 'Implementing', write: 'Writing',
  read: 'Reading', find: 'Finding', search: 'Searching', install: 'Installing',
  configure: 'Configuring', run: 'Running', start: 'Starting', stop: 'Stopping',
  restart: 'Restarting', open: 'Opening', close: 'Closing', move: 'Moving',
  rename: 'Renaming', merge: 'Merging', revert: 'Reverting', clean: 'Cleaning',
  show: 'Showing', list: 'Listing', get: 'Getting', set: 'Setting',
  make: 'Making', change: 'Changing', modify: 'Modifying', adjust: 'Adjusting',
  improve: 'Improving', optimize: 'Optimizing', analyze: 'Analyzing',
  research: 'Researching', investigate: 'Investigating', explain: 'Explaining',
  push: 'Pushing', pull: 'Pulling', commit: 'Committing', design: 'Designing',
};

// Words ending in 'ing' that are NOT gerunds — don't treat as working titles
const FALSE_GERUNDS = new Set([
  'something', 'nothing', 'anything', 'everything',
  'morning', 'evening', 'string', 'king', 'ring', 'thing',
  'bring', 'spring', 'swing', 'wing', 'cling', 'fling', 'sting',
  'during', 'using', 'being', 'ceiling', 'feeling',
]);

// Words to filter from prompts (noise, profanity)
const FILTER_WORDS = new Set([
  'the', 'a', 'an', 'i', 'my', 'we', 'you', 'your', 'this', 'that', 'it',
  'is', 'are', 'was', 'were', 'do', 'does', 'did', 'can', 'could', 'should',
  'would', 'will', 'have', 'has', 'had', 'just', 'also', 'need', 'want',
  'please', 'why', 'how', 'what', 'when', 'where', 'which', 'who', 'think',
  'fucking', 'fuck', 'shit', 'damn', 'dumb', 'ass', 'bitch', 'cunt', 'whore',
]);

/**
 * Extract a quick title from the prompt text. Deterministic, instant.
 * Used as immediate feedback while inference runs.
 * Returns null if no valid gerund title can be extracted.
 */
function extractPromptTitle(prompt: string): string | null {
  const text = prompt.trim().replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 200);
  const words = text.split(' ').filter(w => w.length > 1);
  if (words.length === 0) return null;

  const firstLower = words[0].toLowerCase().replace(/[^a-z]/g, '');

  if (firstLower.endsWith('ing') && firstLower.length > 4 && !FALSE_GERUNDS.has(firstLower)) {
    const result = words.slice(0, 4).join(' ');
    return result.endsWith('.') ? result : result + '.';
  }

  const gerund = GERUND_MAP[firstLower];
  if (gerund) {
    const rest = words.slice(1, 3).join(' ');
    const result = rest ? `${gerund} ${rest}` : gerund;
    return result.endsWith('.') ? result : result + '.';
  }

  // No valid gerund extraction possible — return null so caller uses fallback
  return null;
}

const SYSTEM_PROMPT = `Create a 2-4 word COMPLETE SENTENCE summarizing the user's CURRENT MESSAGE.

RULES:
1. Start with a gerund (-ing verb): Fixing, Checking, Updating, etc.
2. Include the specific OBJECT being acted on
3. MUST be a COMPLETE sentence (no dangling prepositions or articles)
4. End with a period
5. NEVER use generic subjects: "task", "work", "request", "response"
6. MAXIMUM 4 words total including the gerund
7. ONLY reference topics EXPLICITLY present in the user's message. If the user didn't mention a topic, it MUST NOT appear in your output.

GOOD: "Fixing auth bug.", "Checking tab code.", "Reviewing config."
BAD: "Completing the task.", "Fixing the authentication bug in login.", "Working on it."

Output ONLY the sentence. Nothing else.`;

/**
 * Check if a generated title is relevant to the user's prompt.
 * Extracts the key nouns from the title (non-gerund words) and checks
 * if at least one appears in the prompt. If the title introduces a topic
 * the user never mentioned, it's contamination from the model's context.
 */
function isTitleRelevantToPrompt(title: string, prompt: string): boolean {
  const content = title.replace(/\.$/, '').trim();
  const words = content.split(/\s+/);
  if (words.length < 2) return true; // Single-word gerund, can't check

  // Get the non-gerund content words (the topic)
  const topicWords = words.slice(1)
    .map(w => w.toLowerCase().replace(/[^a-z]/g, ''))
    .filter(w => w.length > 2 && !FILTER_WORDS.has(w));

  if (topicWords.length === 0) return true; // No topic words to check

  const promptLower = prompt.toLowerCase();

  // At least one topic word (or 3-char prefix) must appear in the prompt
  return topicWords.some(word =>
    promptLower.includes(word) || promptLower.includes(word.slice(0, Math.max(4, Math.floor(word.length * 0.6))))
  );
}

/**
 * Generate summary via inference. Returns null on failure.
 */
async function summarizePrompt(prompt: string): Promise<string | null> {
  const cleanPrompt = prompt.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1000);
  const result = await inference({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: cleanPrompt,
    timeout: 10000,
    level: 'fast',
  });

  if (result.success && result.output) {
    let summary = result.output.replace(/<[^>]*>/g, '').replace(/^["']|["']$/g, '').trim();
    const words = summary.split(/\s+/).slice(0, 4);
    summary = words.join(' ');
    if (!summary.endsWith('.')) summary += '.';

    if (!isValidWorkingTitle(summary)) return null;

    // Reject titles that introduce topics not in the user's prompt
    // This catches model hallucination from skill list anchoring
    if (!isTitleRelevantToPrompt(summary, cleanPrompt)) {
      console.error(`[UpdateTabTitle] Rejected contaminated title: "${summary}" — topic not in prompt`);
      return null;
    }

    return summary;
  }

  return null;
}

async function main() {
  try {
    const input = await readStdinWithTimeout();
    const data: HookInput = JSON.parse(input);
    const prompt = data.prompt || '';

    if (!prompt || prompt.length < 3) process.exit(0);

    // Skip ratings (1-10) — preserve current tab title
    if (/^([1-9]|10)$/.test(prompt.trim())) process.exit(0);

    // Session label: two-word ALL CAPS prefix for tab identity
    const sessionLabel = data.session_id ? getSessionOneWord(data.session_id) : null;
    const prefix = sessionLabel ? `${sessionLabel} | ` : '';

    // Phase 1: Immediate deterministic title (purple = thinking)
    const quickTitle = extractPromptTitle(prompt);
    const thinkingTitle = quickTitle || getWorkingFallback();
    setTabState({ title: `🧠 ${prefix}${thinkingTitle}`, state: 'thinking', sessionId: data.session_id });

    // Phase 2: Inference for a validated title (orange = working)
    const inferredTitle = await summarizePrompt(prompt);
    const finalTitle = inferredTitle || (quickTitle && isValidWorkingTitle(quickTitle) ? quickTitle : getWorkingFallback());
    setTabState({ title: `⚙️ ${prefix}${finalTitle}`, state: 'working', sessionId: data.session_id });

    // Voice feedback — announce what's being worked on
    // Only speak inference result (a proper sentence). If inference failed,
    // stay silent — silence is better than speaking prompt word fragments.
    const voiceContent = inferredTitle;
    if (voiceContent) {
      const identity = getIdentity();
      try {
        await fetch('http://localhost:8888/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: voiceContent.replace(/\.$/, ''),
            voice_id: identity.mainDAVoiceID,
            voice_enabled: true,
          }),
          signal: AbortSignal.timeout(5000),
        });
        console.error(`[UpdateTabTitle] Voice sent: "${voiceContent}"`);
      } catch {
        console.error(`[UpdateTabTitle] Voice failed (server down or timeout)`);
      }
    } else {
      console.error(`[UpdateTabTitle] No meaningful voice content, skipping`);
    }

    console.error(`[UpdateTabTitle] "${finalTitle}"`);
    process.exit(0);
  } catch (err) {
    console.error(`[UpdateTabTitle] Error: ${err}`);
    process.exit(0);
  }
}

main();
