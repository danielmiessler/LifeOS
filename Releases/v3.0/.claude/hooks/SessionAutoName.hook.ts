#!/usr/bin/env bun
import './lib/gate';
/**
 * SessionAutoName.hook.ts - Auto-generate concise session names
 *
 * PURPOSE:
 * Generates a 2-3 word session title on the FIRST user prompt in a session,
 * so the status line always shows a meaningful descriptive name.
 *
 * TRIGGER: UserPromptSubmit
 *
 * WHY UserPromptSubmit (not Stop):
 * - The user's first prompt IS the best naming signal
 * - On first prompt: no name exists → generate one from the prompt text
 * - On every subsequent prompt: name exists → skip immediately (no-op)
 * - Avoids repeated no-op invocations on every Stop event
 * - No transcript parsing needed — we have the raw prompt directly
 *
 * LOGIC:
 * - If session has a customTitle in sessions-index.json (set by /rename) → use that
 * - If session already has a name in session-names.json → skip (no overwrite)
 * - If no name exists → generate one via fast inference → store it
 * - Names persist across session lifecycle, surviving compaction/restore
 *
 * The authoritative session name is customTitle from Claude Code's sessions-index.
 * This hook generates a fallback name only when no customTitle exists.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { paiPath } from './lib/paths';
import { inference } from '../skills/PAI/Tools/Inference';

interface HookInput {
  session_id: string;
  prompt?: string;
  user_prompt?: string;
}

const SESSION_NAMES_PATH = paiPath('MEMORY', 'STATE', 'session-names.json');

interface SessionNames {
  [sessionId: string]: string;
}

function readSessionNames(): SessionNames {
  try {
    if (existsSync(SESSION_NAMES_PATH)) {
      return JSON.parse(readFileSync(SESSION_NAMES_PATH, 'utf-8'));
    }
  } catch {
    // Corrupted file — start fresh
  }
  return {};
}

function writeSessionNames(names: SessionNames): void {
  const dir = dirname(SESSION_NAMES_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(SESSION_NAMES_PATH, JSON.stringify(names, null, 2), 'utf-8');
}

const NAME_PROMPT = `You are labeling a folder. Give this conversation a 2-3 word Topic Case title.

Think: "If someone saw this label on a folder, would they immediately know what's inside?"

RULES:
1. EXACTLY 2-3 real English words. Every word must be a common dictionary word (3+ letters each).
2. Must be a coherent noun phrase that a human would actually write — like a meeting topic or project name.
3. SYNTHESIZE the topic. Do NOT just grab words from the message.
4. No verbs, no articles, no sentences, no questions. Just a noun phrase.
5. Ignore all technical noise (IDs, paths, XML, hex codes). Name the SUBJECT, not the artifacts.

GOOD examples (coherent topics a human would write):
"Voice Server Fix", "Dashboard Redesign", "Algorithm Upgrade", "Session Naming", "Security Architecture", "Hook Permissions", "Feed Schema Design", "Tab Title Sync"

BAD examples (incoherent, word salad, or fragments):
"Built Bunch", "Commands R", "Didn Anything Sudden", "Notification Ede Output", "Reply Number Session", "Research Guys Shady", "Ahead Repo Started", "State Pai Installer"

WHY the bad ones are bad: they are random words strung together that don't describe a topic. A human would never label a folder that way.

Output ONLY the 2-3 word title. Nothing else.`;

// Common noise words to skip during relevance checking and keyword extraction
const NOISE_WORDS = new Set([
  'the', 'a', 'an', 'i', 'my', 'we', 'you', 'your', 'this', 'that', 'it',
  'is', 'are', 'was', 'were', 'do', 'does', 'did', 'can', 'could', 'should',
  'would', 'will', 'have', 'has', 'had', 'just', 'also', 'need', 'want',
  'please', 'session', 'help', 'work', 'task', 'update', 'new', 'check',
  'make', 'get', 'set', 'put', 'use', 'run', 'try', 'let', 'see', 'look',
  'fix', 'add', 'create', 'build', 'deploy', 'code', 'read', 'write',
  'thing', 'things', 'something', 'going', 'like', 'know', 'think', 'right',
  'whatever', 'current', 'really', 'actually', 'working', 'doing', 'change',
  'what', 'how', 'why', 'when', 'where', 'which', 'who', 'there', 'here',
  'not', 'but', 'and', 'for', 'with', 'from', 'about', 'into', 'been',
  'some', 'all', 'any', 'each', 'every', 'both', 'our', 'they', 'them', 'those', 'these',
  // Verb forms and fragments that produce garbage names
  'built', 'asked', 'told', 'said', 'went', 'came', 'made', 'gave', 'took',
  'bunch', 'lots', 'couple', 'few', 'many', 'much', 'more', 'most', 'less',
  'pretty', 'very', 'quite', 'super', 'totally', 'completely', 'basically',
  'okay', 'yeah', 'yes', 'sure', 'fine', 'good', 'bad', 'great', 'nice',
  'hey', 'well', 'now', 'then', 'still', 'even', 'already', 'yet', 'ago',
  'way', 'kind', 'sort', 'type', 'stuff', 'part', 'whole', 'point',
  'one', 'two', 'three', 'first', 'last', 'next', 'other', 'same',
  'being', 'having', 'getting', 'making', 'taking', 'coming', 'saying',
  'question', 'answer', 'figure', 'out', 'off', 'tell', 'show', 'give',
  'start', 'stop', 'keep', 'move', 'turn', 'pull', 'push', 'open', 'close',
  'used', 'using', 'called', 'mean', 'means', 'guess', 'maybe', 'probably',
]);

/**
 * Strip technical artifacts from prompt before session naming.
 * Removes: UUIDs, hex IDs (7+ hex chars), task-notification XML tags and their content,
 * file paths, and other noise that produces garbage session names.
 */
function sanitizePromptForNaming(prompt: string): string {
  return prompt
    // Remove XML-style tags and their attributes (task-notification, task-id, etc.)
    .replace(/<[^>]+>/g, ' ')
    // Remove UUIDs: 8-4-4-4-12 hex pattern
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ' ')
    // Remove hex strings of 7+ characters (task IDs, commit hashes, etc.)
    .replace(/\b[0-9a-f]{7,}\b/gi, ' ')
    // Remove file paths
    .replace(/(?:\/[\w.-]+){2,}/g, ' ')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Deterministic fallback: find the single most meaningful noun from the prompt
 * and pair it with "Session". This is intentionally conservative — a boring but
 * coherent name like "Voice Session" is infinitely better than word salad like
 * "Commands R" or "Didn Anything Sudden".
 */
function extractFallbackName(prompt: string): string | null {
  const words = prompt
    .replace(/[^a-zA-Z\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4 && !NOISE_WORDS.has(w.toLowerCase()));

  if (words.length === 0) return null;

  // Pick the first substantial word and make a safe label
  const topic = words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase();
  return `${topic} Session`;
}

/**
 * Check if a generated session name is relevant to the user's prompt.
 */
function isNameRelevantToPrompt(name: string, prompt: string): boolean {
  const nameWords = name.split(/\s+/)
    .map(w => w.toLowerCase().replace(/[^a-z]/g, ''))
    .filter(w => w.length > 2 && !NOISE_WORDS.has(w));

  if (nameWords.length === 0) return true;

  const promptLower = prompt.toLowerCase();
  return nameWords.some(word =>
    promptLower.includes(word) || promptLower.includes(word.slice(0, Math.max(4, Math.floor(word.length * 0.6))))
  );
}

/**
 * Check if this session has a customTitle in Claude Code's sessions-index.json.
 * customTitle is set by /rename and is the authoritative session name.
 * NOTE: Claude Code uses lowercase "projects/" dir (not uppercase "Projects/").
 */
function getCustomTitle(sessionId: string): string | null {
  try {
    // Search both lowercase (Claude Code native) and uppercase (PAI) project dirs
    const searchDirs = [
      paiPath('projects'),  // Claude Code native (lowercase) — primary
      paiPath('Projects'),  // PAI uppercase — fallback
    ];

    for (const projectsDir of searchDirs) {
      if (!existsSync(projectsDir)) continue;

      const entries = Bun.spawnSync(['grep', '-rl', sessionId, projectsDir], {
        stdout: 'pipe', stderr: 'pipe', timeout: 2000,
      });
      const indexFiles = entries.stdout.toString().trim().split('\n')
        .filter(f => f.endsWith('sessions-index.json'));

      for (const indexFile of indexFiles) {
        const content = readFileSync(indexFile, 'utf-8');
        const idPos = content.indexOf(`"sessionId": "${sessionId}"`);
        if (idPos === -1) continue;

        const chunk = content.slice(idPos, idPos + 500);
        const match = chunk.match(/"customTitle":\s*"([^"]+)"/);
        if (match) return match[1];
      }
    }
  } catch (error) {
    console.error('[SessionAutoName] Failed to check customTitle:', error);
  }
  return null;
}

async function readStdin(): Promise<HookInput | null> {
  try {
    const decoder = new TextDecoder();
    const reader = Bun.stdin.stream().getReader();
    let input = '';

    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => resolve(), 2000);
    });

    const readPromise = (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        input += decoder.decode(value, { stream: true });
      }
    })();

    await Promise.race([readPromise, timeoutPromise]);

    if (input.trim()) {
      return JSON.parse(input) as HookInput;
    }
  } catch (error) {
    console.error('[SessionAutoName] Error reading stdin:', error);
  }
  return null;
}

async function main() {
  const hookInput = await readStdin();

  if (!hookInput?.session_id) {
    process.exit(0);
  }

  const sessionId = hookInput.session_id;
  const names = readSessionNames();

  // Always check for customTitle from /rename (authoritative source).
  // This runs on every prompt to catch renames that happen mid-session.
  const customTitle = getCustomTitle(sessionId);
  if (customTitle && names[sessionId] !== customTitle) {
    names[sessionId] = customTitle;
    writeSessionNames(names);
    const cacheContent = `cached_session_id='${sessionId}'\ncached_session_label='${customTitle}'\n`;
    const cachePath = paiPath('MEMORY', 'STATE', 'session-name-cache.sh');
    writeFileSync(cachePath, cacheContent, 'utf-8');
    console.error(`[SessionAutoName] Synced customTitle: "${customTitle}"`);
    process.exit(0);
  }

  // Check for rework: if session already has a name AND the algorithm state
  // shows completed work (COMPLETE/LEARN/IDLE), this prompt starts NEW work.
  // Re-generate the session name to reflect the new task.
  const rawPrompt = hookInput.prompt || hookInput.user_prompt || '';
  const prompt = sanitizePromptForNaming(rawPrompt);
  let isRework = false;

  if (names[sessionId]) {
    // Check algorithm state for rework signal
    try {
      const algoStatePath = paiPath('MEMORY', 'STATE', 'algorithms', `${sessionId}.json`);
      if (existsSync(algoStatePath)) {
        const algoState = JSON.parse(readFileSync(algoStatePath, 'utf-8'));
        const isComplete = !algoState.active ||
          algoState.currentPhase === 'COMPLETE' ||
          algoState.currentPhase === 'LEARN' ||
          algoState.currentPhase === 'IDLE';
        const hadWork = (algoState.criteria && algoState.criteria.length > 0) || !!algoState.summary;

        if (isComplete && hadWork && prompt) {
          // Rework detected — allow re-naming
          isRework = true;
          console.error(`[SessionAutoName] Rework detected — previous name: "${names[sessionId]}", re-generating from new prompt`);
        } else {
          // Normal subsequent prompt in active session — keep existing name
          process.exit(0);
        }
      } else {
        // No algorithm state yet — keep existing name
        process.exit(0);
      }
    } catch {
      // Error reading state — keep existing name (safe default)
      process.exit(0);
    }
  }

  if (!prompt) {
    process.exit(0);
  }

  /** Store the name and update cache, tracking rework history */
  function storeName(label: string, source: string): void {
    // On rework, record the previous name in algorithm state for dashboard display
    if (isRework && names[sessionId]) {
      try {
        const algoStatePath = paiPath('MEMORY', 'STATE', 'algorithms', `${sessionId}.json`);
        if (existsSync(algoStatePath)) {
          const algoState = JSON.parse(readFileSync(algoStatePath, 'utf-8'));
          if (!algoState.previousNames) algoState.previousNames = [];
          algoState.previousNames.push({
            name: names[sessionId],
            changedAt: new Date().toISOString(),
          });
          writeFileSync(algoStatePath, JSON.stringify(algoState, null, 2));
          console.error(`[SessionAutoName] Archived previous name: "${names[sessionId]}"`);
        }
      } catch (err) {
        console.error(`[SessionAutoName] Failed to archive previous name:`, err);
      }
    }

    names[sessionId] = label;
    writeSessionNames(names);
    const cacheContent = `cached_session_id='${sessionId}'\ncached_session_label='${label}'\n`;
    const cachePath = paiPath('MEMORY', 'STATE', 'session-name-cache.sh');
    writeFileSync(cachePath, cacheContent, 'utf-8');
    console.error(`[SessionAutoName] ${isRework ? 'Rejuvenated' : 'Named'} session: "${label}" (${source})`);
  }

  // Try AI-generated name first
  let named = false;
  try {
    const result = await inference({
      systemPrompt: NAME_PROMPT,
      userPrompt: prompt.slice(0, 800),
      level: 'fast',
      timeout: 10000,
    });

    if (result.success && result.output) {
      let label = result.output
        .replace(/^["']|["']$/g, '')
        .replace(/[.!?,;:]/g, '')
        .trim();

      const words = label.split(/\s+/).slice(0, 3);
      label = words
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');

      const allWordsSubstantial = words.every(w => w.length >= 3);
      if (label && words.length >= 2 && words.length <= 3 && allWordsSubstantial) {
        if (!isNameRelevantToPrompt(label, prompt)) {
          console.error(`[SessionAutoName] Rejected contaminated name: "${label}" — topic not in prompt`);
        } else {
          storeName(label, 'inference');
          named = true;
        }
      } else if (!allWordsSubstantial) {
        console.error(`[SessionAutoName] Rejected short word in: "${result.output}"`);
      } else {
        console.error(`[SessionAutoName] Bad label from inference: "${result.output}"`);
      }
    }
  } catch (error) {
    console.error('[SessionAutoName] Inference failed:', error);
  }

  // Conservative fallback: single topic word + "Session"
  if (!named) {
    const fallback = extractFallbackName(prompt);
    if (fallback) {
      storeName(fallback, 'fallback');
    } else {
      console.error('[SessionAutoName] No meaningful keywords in prompt — skipping');
    }
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('[SessionAutoName] Fatal error:', error);
  process.exit(0);
});
