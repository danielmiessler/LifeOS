#!/usr/bin/env bun
/**
 * SessionAutoName.hook.ts - Auto-generate concise session names
 *
 * PURPOSE:
 * Generates a 4-word session title on the FIRST user prompt in a session,
 * so the status line always shows a meaningful descriptive name.
 *
 * TRIGGER: UserPromptSubmit
 *
 * ARCHITECTURE (v2 — fast-exit):
 * - FIRST PROMPT (no name exists):
 *   1. Read stdin via process.stdin (Node.js events — proven reliable)
 *   2. Generate deterministic 4-word name from prompt keywords
 *   3. Store to session-names.json + cache
 *   4. Spawn detached background process to upgrade name via inference (standard/Sonnet)
 *   5. EXIT IMMEDIATELY — background process writes upgrade async, <100ms sync path
 *
 * - SUBSEQUENT PROMPTS (name exists):
 *   1. Check for customTitle from /rename (authoritative override)
 *   2. Check for rework (completed work → new task in same session)
 *   3. If rework → re-generate with inference upgrade
 *   4. Otherwise → skip (no-op)
 *
 * WHY NO INFERENCE ON FIRST PROMPT:
 * - Inference spawns a claude subprocess (5-15s) — blocks prompt processing
 * - Deterministic name from keywords is good enough for initial display
 * - The long pause users experienced was from inference blocking
 *
 * WHY process.stdin INSTEAD OF Bun.stdin.stream():
 * - All other working hooks (RatingCapture, UpdateTabTitle)
 *   use process.stdin.on('data') — proven reliable with Claude Code piping
 * - Bun.stdin.stream().getReader() has different buffering behavior that
 *   caused silent failures with large piped inputs
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, rmdirSync, renameSync, statSync } from 'fs';
import { dirname } from 'path';
import { spawn as nodeSpawn } from 'child_process';
import { paiPath } from './lib/paths';
import { inference } from '../PAI/Tools/Inference';
import { updateSessionNameInWorkJson, upsertSession } from './lib/prd-utils';

interface HookInput {
  session_id: string;
  prompt?: string;
  user_prompt?: string;
}

const SESSION_NAMES_PATH = paiPath('MEMORY', 'STATE', 'session-names.json');
const LOCK_PATH = SESSION_NAMES_PATH + '.lock';
const LOCK_TIMEOUT = 3000;  // 3s max wait
const LOCK_STALE = 10000;   // 10s = stale lock

interface SessionNames {
  [sessionId: string]: string;
}

/** Acquire mkdir-based lock (atomic on POSIX). Returns true if acquired. */
function acquireLock(): boolean {
  const deadline = Date.now() + LOCK_TIMEOUT;
  while (Date.now() < deadline) {
    try {
      mkdirSync(LOCK_PATH);
      return true;
    } catch {
      // Lock exists — check if stale
      try {
        const stat = statSync(LOCK_PATH);
        if (Date.now() - stat.mtimeMs > LOCK_STALE) {
          try { rmdirSync(LOCK_PATH); } catch {}
          continue;
        }
      } catch {}
      Bun.sleepSync(50);
    }
  }
  return false;
}

function releaseLock(): void {
  try { rmdirSync(LOCK_PATH); } catch {}
}

function readSessionNames(): SessionNames {
  try {
    if (existsSync(SESSION_NAMES_PATH)) {
      return JSON.parse(readFileSync(SESSION_NAMES_PATH, 'utf-8'));
    }
  } catch {
    // Corrupted file — try backup
    try {
      const bakPath = SESSION_NAMES_PATH + '.bak';
      if (existsSync(bakPath)) {
        console.error('[SessionAutoName] Primary corrupted, reading backup');
        return JSON.parse(readFileSync(bakPath, 'utf-8'));
      }
    } catch {}
  }
  return {};
}

/** Atomic write: tmp file → rename (prevents partial reads by concurrent sessions) */
function writeSessionNames(names: SessionNames): void {
  const dir = dirname(SESSION_NAMES_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  // Backup current before overwrite
  try {
    if (existsSync(SESSION_NAMES_PATH)) {
      writeFileSync(SESSION_NAMES_PATH + '.bak', readFileSync(SESSION_NAMES_PATH), 'utf-8');
    }
  } catch {}
  // Atomic: write tmp, rename
  const tmpPath = SESSION_NAMES_PATH + '.tmp.' + process.pid;
  writeFileSync(tmpPath, JSON.stringify(names, null, 2), 'utf-8');
  renameSync(tmpPath, SESSION_NAMES_PATH);
}

const NAME_PROMPT = `You are naming a work session. Generate an EXACTLY 4-word title that reads like a short news headline or task description.

Think: "What is the single most important thing being worked on? Describe it in 4 words like a newspaper headline."

RULES:
1. EXACTLY 4 words in Title Case. Every word must be a real English word (3+ letters).
2. Must describe the SPECIFIC action or task — verbs are encouraged. "Fix Session Name Generation" beats "Session Name Generation Thing".
3. Use the user's intent, not just their literal words — infer what they're actually trying to do.
4. No articles (a/an/the). Verbs, nouns, adjectives all welcome.
5. Prefer concrete specifics: system names, feature names, what's being fixed/built/changed.
6. Ignore technical noise (IDs, paths, XML, hex codes). Name the TASK, not the artifacts.

GOOD examples (headline-style, specific, verb-forward):
"Fix Session Name Generation", "Deploy Voice Server Update", "Debug Surface Filter Bar", "Upgrade Browser Automation System", "Session Naming System Broken", "Voice Phase Announcement Fix", "Label Scoring Algorithm Update", "Surface Deploy Button Missing", "Feed Pipeline Processing Error", "Algorithm ISC Quality Gate"

BAD examples (too vague or word-salad):
"Through Different Discussions Ones" (random words), "I'm Not Going" (fragment), "Else Session" (meaningless), "Things Need Fixing Now" (generic)

BAD examples (too short or wrong count):
"Dashboard Redesign" (2 words), "Voice Server Fix" (3 words)

Output ONLY the 4-word title. Nothing else.`;

// ── Lightweight mode classification (same logic as RatingCapture, zero-cost) ──
const ALGO_ACTION_RE = /\b(implement|build|create|architect|design|migrate|deploy|refactor)\b/i;
function isNativeMode(prompt: string): boolean {
  return !ALGO_ACTION_RE.test(prompt.trim());
}

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
  // Tool/system artifacts that leak from system-reminders into session names
  'output', 'file', 'result', 'tool', 'input', 'content', 'contents', 'invoke',
  // Profanity — {PRINCIPAL.NAME} cusses during work, these should never appear in session names
  'fuck', 'fucking', 'fucked', 'shit', 'shitty', 'damn', 'damned', 'damnit',
  'ass', 'asshole', 'hell', 'crap', 'crappy', 'bitch', 'bullshit', 'retard',
  'dumb', 'dumbass', 'stupid', 'idiot', 'wtf', 'lmao', 'omg',
  // Additional non-topic words that leak into names
  'separate', 'another', 'issue', 'problem', 'currently', 'continue',
  'continues', 'submitted', 'multiple', 'requests', 'case', 'because',
  'again', 'always', 'never', 'everything', 'nothing', 'anything',
]);

/**
 * Strip technical artifacts from prompt before session naming.
 * Removes: UUIDs, hex IDs (7+ hex chars), task-notification XML tags and their content,
 * file paths, and other noise that produces garbage session names.
 */
function sanitizePromptForNaming(prompt: string): string {
  return prompt
    // Remove entire system-reminder blocks INCLUDING content (not just tags)
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, ' ')
    // Remove entire task-notification blocks INCLUDING content
    .replace(/<task-notification>[\s\S]*?<\/task-notification>/gi, ' ')
    // Remove any remaining XML-style tags and their attributes
    .replace(/<[^>]+>/g, ' ')
    // Remove "Read tool" / "Read Output File" artifacts from tool call summaries
    .replace(/(?:called|result of calling)\s+the\s+\w+\s+tool[^.]*\./gi, ' ')
    .replace(/\bread\s+(?:the\s+)?output\s+file\b/gi, ' ')
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
 * Deterministic fallback: extract the 4 most meaningful nouns from the prompt.
 * Produces a 4-word Topic Case name. If fewer than 4 meaningful words exist,
 * pads with generic context words to always hit exactly 4.
 */
function extractFallbackName(prompt: string): string | null {
  const words = prompt
    .replace(/[^a-zA-Z\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !NOISE_WORDS.has(w.toLowerCase()));

  if (words.length === 0) return null;

  // Deduplicate while preserving order
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const w of words) {
    const lower = w.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      unique.push(w);
    }
    if (unique.length >= 4) break;
  }

  // Pad to 4 words if we don't have enough
  const PAD_WORDS = ['Session', 'Work', 'Task', 'Context'];
  while (unique.length < 4) {
    const pad = PAD_WORDS[unique.length - 1] || 'Session';
    unique.push(pad);
  }

  return unique.slice(0, 4)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Check if this session has a customTitle set by /rename.
 * /rename writes a {"type":"custom-title","customTitle":"..."} entry into the session JSONL.
 * We read the last such entry directly — no sessions-index.json needed (it goes stale).
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

      // Find the session's JSONL file under any project subdir (maxdepth 2)
      const findResult = Bun.spawnSync(
        ['find', projectsDir, '-maxdepth', '2', '-name', `${sessionId}.jsonl`],
        { stdout: 'pipe', stderr: 'pipe', timeout: 2000 },
      );
      const jsonlPath = findResult.stdout.toString().trim().split('\n')[0];
      if (!jsonlPath || !existsSync(jsonlPath)) continue;

      // Scan JSONL for last custom-title entry (written by /rename)
      const lines = readFileSync(jsonlPath, 'utf-8').split('\n');
      let lastCustomTitle: string | null = null;
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const entry = JSON.parse(line);
          if (entry.type === 'custom-title' && entry.customTitle) {
            lastCustomTitle = entry.customTitle;
          }
        } catch {}
      }
      if (lastCustomTitle) return lastCustomTitle;
    }
  } catch (error) {
    console.error('[SessionAutoName] Failed to check customTitle:', error);
  }
  return null;
}

/**
 * Read stdin using Node.js process.stdin events.
 * This is the PROVEN approach used by all other working hooks
 * (RatingCapture, UpdateTabTitle).
 *
 * Bun.stdin.stream().getReader() has different buffering behavior
 * that silently fails with large piped inputs from Claude Code.
 */
async function readStdin(timeout: number = 5000): Promise<HookInput | null> {
  try {
    const raw = await new Promise<string>((resolve, reject) => {
      let data = '';
      const timer = setTimeout(() => {
        // Timeout — resolve with whatever we have (don't reject, to allow partial extraction)
        resolve(data);
      }, timeout);
      process.stdin.on('data', (chunk) => { data += chunk.toString(); });
      process.stdin.on('end', () => { clearTimeout(timer); resolve(data); });
      process.stdin.on('error', (err) => { clearTimeout(timer); reject(err); });
    });

    if (!raw.trim()) return null;

    // Try full JSON parse first
    try {
      return JSON.parse(raw) as HookInput;
    } catch {
      // Partial read (large prompt) — extract fields via regex
      const sessionMatch = raw.match(/"session_id"\s*:\s*"([^"]+)"/);
      const promptMatch = raw.match(/"(?:prompt|user_prompt)"\s*:\s*"([\s\S]{0,2000})/);
      if (sessionMatch) {
        console.error(`[SessionAutoName] Partial stdin (${raw.length} bytes) — regex extraction`);
        return {
          session_id: sessionMatch[1],
          prompt: promptMatch
            ? promptMatch[1].replace(/\\"/g, '"').replace(/\\n/g, ' ').replace(/\\t/g, ' ')
            : undefined,
        };
      }
      console.error(`[SessionAutoName] stdin parse failed, regex extraction failed (${raw.length} bytes)`);
    }
  } catch (error) {
    console.error('[SessionAutoName] Error reading stdin:', error);
  }
  return null;
}

/** Store the name with locked read-modify-write (prevents concurrent session clobber) */
function storeName(sessionId: string, label: string, source: string): void {
  const locked = acquireLock();
  if (!locked) console.error('[SessionAutoName] Lock timeout — writing anyway');
  try {
    const names = readSessionNames(); // Fresh read under lock
    names[sessionId] = label;
    writeSessionNames(names);
  } finally {
    if (locked) releaseLock();
  }
  // Cache update is session-local, no lock needed
  const cacheContent = `cached_session_id='${sessionId}'\ncached_session_label='${label}'\n`;
  const cachePath = paiPath('MEMORY', 'STATE', 'session-name-cache.sh');
  writeFileSync(cachePath, cacheContent, 'utf-8');
  // Propagate to work.json so admin dashboard stays in sync
  updateSessionNameInWorkJson(sessionId, label);
  console.error(`[SessionAutoName] Named session: "${label}" (${source})`);
}

/**
 * Background upgrade mode: called via --upgrade flag from a detached subprocess.
 * Runs inference to generate a better 4-word name, then overwrites the deterministic one.
 */
async function upgradeWithInference(sessionId: string, promptB64: string, expectedName?: string): Promise<void> {
  try {
    // Version guard: if the name has changed since we were spawned, skip.
    const currentNames = readSessionNames();
    const currentName = currentNames[sessionId] || '';
    if (expectedName !== undefined && currentName !== expectedName) {
      console.error(`[SessionAutoName] Background upgrade skipped — name already changed from "${expectedName}" to "${currentName}"`);
      return;
    }

    const promptText = Buffer.from(promptB64, 'base64').toString('utf-8');
    const result = await inference({
      systemPrompt: NAME_PROMPT,
      userPrompt: promptText,
      level: 'standard',
      timeout: 10000,
    });

    if (result.success && result.output) {
      let label = result.output
        .replace(/^["']|["']$/g, '')
        .replace(/[.!?,;:]/g, '')
        .trim();

      const words = label.split(/\s+/).slice(0, 4);
      label = words
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');

      const allWordsSubstantial = words.every(w => w.length >= 3);
      if (label && words.length === 4 && allWordsSubstantial) {
        // Locked version-guarded write
        const locked = acquireLock();
        if (!locked) console.error('[SessionAutoName] Lock timeout on upgrade');
        try {
          const freshNames = readSessionNames();
          const freshName = freshNames[sessionId] || '';
          if (expectedName !== undefined && freshName !== expectedName) {
            console.error(`[SessionAutoName] Background upgrade skipped at write — name changed to "${freshName}"`);
            return;
          }
          freshNames[sessionId] = label;
          writeSessionNames(freshNames);
        } finally {
          if (locked) releaseLock();
        }
        // Update cache outside lock
        const cacheContent = `cached_session_id='${sessionId}'\ncached_session_label='${label}'\n`;
        const cachePath = paiPath('MEMORY', 'STATE', 'session-name-cache.sh');
        writeFileSync(cachePath, cacheContent, 'utf-8');
        console.error(`[SessionAutoName] Background upgrade: "${label}"`);
      } else {
        console.error(`[SessionAutoName] Background upgrade rejected: "${result.output}"`);
      }
    }
  } catch (error) {
    console.error('[SessionAutoName] Background upgrade failed:', error);
  }
}

async function main() {
  // ── Background upgrade mode (called by detached subprocess) ──
  if (process.argv[2] === '--upgrade') {
    const upgradeSessionId = process.argv[3];
    const upgradePromptB64 = process.argv[4];
    const upgradeExpectedName = process.argv[5];  // Version guard: name at spawn time
    if (upgradeSessionId && upgradePromptB64) {
      await upgradeWithInference(upgradeSessionId, upgradePromptB64, upgradeExpectedName);
    }
    process.exit(0);
  }

  // ── Normal hook mode (called by Claude Code on UserPromptSubmit) ──
  const hookInput = await readStdin();

  if (!hookInput?.session_id) {
    console.error('[SessionAutoName] No session_id in stdin — exiting');
    process.exit(0);
  }

  const sessionId = hookInput.session_id;
  const existingNames = readSessionNames();
  const rawPrompt = hookInput.prompt || hookInput.user_prompt || '';
  const prompt = sanitizePromptForNaming(rawPrompt);

  // ══════════════════════════════════════════════════════════════════
  // FAST PATH: First prompt in session — no name exists yet
  // 1. Generate deterministic name instantly (<10ms)
  // 2. Spawn detached background process to upgrade with inference
  // 3. EXIT IMMEDIATELY — background process writes upgrade async
  // ══════════════════════════════════════════════════════════════════
  if (!existingNames[sessionId]) {
    if (!prompt) {
      console.error('[SessionAutoName] No prompt text for new session — skipping');
      process.exit(0);
    }

    const fallback = extractFallbackName(prompt);
    if (fallback) {
      storeName(sessionId, fallback, 'deterministic');
    } else {
      console.error('[SessionAutoName] No meaningful keywords in prompt — skipping');
    }

    // Track ALL sessions in work.json so the activity dashboard shows them immediately.
    // Native sessions stay as-is. Algorithm sessions get a 'starting' placeholder
    // that PRDSync replaces when the PRD.md is written (30-120s later).
    const sessionMode = isNativeMode(rawPrompt) ? 'native' : 'starting';
    upsertSession(sessionId, fallback || '', prompt.slice(0, 120), sessionMode);
    console.error(`[SessionAutoName] Created ${sessionMode} session entry in work.json`);

    // Fire-and-forget: spawn detached process to upgrade name with inference
    // This runs AFTER we've already stored the deterministic name and exited
    if (prompt) {
      try {
        const promptB64 = Buffer.from(prompt.slice(0, 800)).toString('base64');
        const expectedName = fallback || '';  // What name exists now — upgrade only if unchanged
        const env = { ...process.env };
        delete env.CLAUDECODE; // Prevent nested session guard in inference
        const child = nodeSpawn('bun', [
          import.meta.filename,
          '--upgrade', sessionId, promptB64, expectedName,
        ], {
          detached: true,
          stdio: 'ignore',
          env,
        });
        child.unref();
        console.error('[SessionAutoName] Spawned background inference upgrade');
      } catch {
        // Non-critical — deterministic name is already stored
      }
    }

    process.exit(0);
  }

  // ══════════════════════════════════════════════════════════════════
  // SUBSEQUENT PROMPTS: Name already exists — only sync /rename
  // The name is set once on the first prompt. After that, the only
  // thing that can change it is an explicit /rename command.
  // ══════════════════════════════════════════════════════════════════

  const customTitle = getCustomTitle(sessionId);
  if (customTitle && existingNames[sessionId] !== customTitle) {
    storeName(sessionId, customTitle, 'custom-title');
  }

  // Keep sessions alive in work.json (bump updatedAt on each prompt)
  const sessionMode = isNativeMode(rawPrompt) ? 'native' : 'starting';
  upsertSession(sessionId, existingNames[sessionId] || '', '', sessionMode);

  process.exit(0);
}

main().catch((error) => {
  console.error('[SessionAutoName] Fatal error:', error);
  process.exit(0);
});
