#!/usr/bin/env bun
/**
 * PreContextReset.hook.ts - Harvest session before /clear or /compact
 *
 * PURPOSE:
 * /clear and /compact destroy conversation context without triggering SessionEnd.
 * This means WorkCompletionLearning, RelationshipMemory, and progress snapshots
 * are never captured. This hook intercepts those commands via UserPromptSubmit
 * and runs a lightweight harvest before context is lost.
 *
 * TRIGGER: UserPromptSubmit
 *
 * INPUT:
 * - stdin: Hook input JSON (session_id, prompt, transcript_path)
 *
 * FLOW:
 * 1. Read prompt from stdin
 * 2. If prompt is NOT /clear or /compact → exit immediately (<5ms)
 * 3. If match → run harvest pipeline and exit
 *
 * SIDE EFFECTS:
 * - Creates: MEMORY/LEARNING/<category>/<YYYY-MM>/<datetime>_context_reset.md
 * - Appends: MEMORY/RELATIONSHIP/<YYYY-MM>/<YYYY-MM-DD>.md
 * - Updates: MEMORY/STATE/progress/<project>-progress.json
 * - Appends: MEMORY/LEARNING/SIGNALS/ratings.jsonl (reset marker)
 *
 * PERFORMANCE:
 * - Non-matching prompts: <5ms (fast exit)
 * - Matching prompts: <100ms (all disk I/O, no inference)
 *
 * INTER-HOOK RELATIONSHIPS:
 * - RUNS BEFORE: Claude Code processes /clear or /compact
 * - COORDINATES WITH: WorkCompletionLearning (SessionEnd) — same learning format
 * - COORDINATES WITH: RelationshipMemory (SessionEnd) — same relationship format
 * - DOES NOT run cleanup (session continues after /clear and /compact)
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';
import { getPaiDir, paiPath } from './lib/paths';
import { getISOTimestamp, getPSTDate, getPSTComponents, getFilenameTimestamp } from './lib/time';
import { getLearningCategory } from './lib/learning-utils';
import { getDAName, getPrincipalName } from './lib/identity';
import { parseTranscript, type ParsedTranscript } from '../PAI/Tools/TranscriptParser';

// ── Types ──

interface HookInput {
  session_id: string;
  prompt?: string;
  user_prompt?: string;
  transcript_path?: string;
  hook_event_name: string;
}

// ── Fast-exit gate ──

const RESET_COMMANDS = ['/clear', '/compact'];

async function readStdin(timeout = 500): Promise<HookInput | null> {
  try {
    const decoder = new TextDecoder();
    const reader = Bun.stdin.stream().getReader();
    let input = '';

    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => resolve(), timeout);
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
  } catch {}
  return null;
}

// ── Harvest: Work Completion Learning ──

function harvestWorkLearning(sessionId: string, resetType: string): void {
  const memoryDir = paiPath('MEMORY');
  const stateDir = join(memoryDir, 'STATE');
  const workDir = join(memoryDir, 'WORK');
  const learningDir = join(memoryDir, 'LEARNING');

  // Find active work state (session-scoped with legacy fallback)
  let stateFile = join(stateDir, `current-work-${sessionId}.json`);
  if (!existsSync(stateFile)) {
    stateFile = join(stateDir, 'current-work.json');
    if (!existsSync(stateFile)) {
      console.error('[PreContextReset] No active work session for learning harvest');
      return;
    }
  }

  let currentWork: any;
  try {
    currentWork = JSON.parse(readFileSync(stateFile, 'utf-8'));
  } catch {
    return;
  }

  // Guard: don't process another session's state
  if (currentWork.session_id && currentWork.session_id !== sessionId) {
    return;
  }

  if (!currentWork.session_dir) return;

  // Read work metadata from PRD.md or META.yaml
  const workPath = join(workDir, currentWork.session_dir);
  const prdPath = join(workPath, 'PRD.md');

  let title = currentWork.task_title || 'Untitled work';
  let iscSummary = '';

  if (existsSync(prdPath)) {
    try {
      const prdContent = readFileSync(prdPath, 'utf-8');
      const titleMatch = prdContent.match(/^title:\s*(.+)$/m);
      if (titleMatch) title = titleMatch[1].replace(/^["']|["']$/g, '');

      const iscMatch = prdContent.match(/## IDEAL STATE CRITERIA[\s\S]*?(?=\n## |$)/);
      if (iscMatch) {
        const checked = (iscMatch[0].match(/- \[x\]/g) || []).length;
        const unchecked = (iscMatch[0].match(/- \[ \]/g) || []).length;
        const total = checked + unchecked;
        if (total > 0) iscSummary = `${checked}/${total} ISC criteria passing`;
      }
    } catch {}
  }

  // Write learning file
  const category = getLearningCategory(title);
  const { year, month } = getPSTComponents();
  const monthDir = join(learningDir, category, `${year}-${month}`);
  if (!existsSync(monthDir)) mkdirSync(monthDir, { recursive: true });

  const timestamp = getFilenameTimestamp();
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
  const filename = `${timestamp}_${resetType}_${slug}.md`;
  const filepath = join(monthDir, filename);

  if (existsSync(filepath)) return;

  const content = `# Context Reset Learning (${resetType})

**Title:** ${title}
**Trigger:** /${resetType} (context reset, not session end)
**Category:** ${category}
**Session:** ${sessionId}
**Timestamp:** ${getISOTimestamp()}

---

## Work State at Reset

${iscSummary ? `- **ISC:** ${iscSummary}` : '- **ISC:** Not available'}
- **Work Dir:** ${currentWork.session_dir}

## Why This Matters

Context was reset mid-session via /${resetType}. This learning captures the work state
at that point so insights aren't lost. The session continues but previous context
(corrections, discoveries, approach decisions) is gone.

---

*Auto-captured by PreContextReset hook before /${resetType}*
`;

  writeFileSync(filepath, content);
  console.error(`[PreContextReset] Learning captured: ${filename}`);
}

// ── Harvest: Relationship Notes ──

function harvestRelationshipNotes(transcriptPath: string): void {
  if (!transcriptPath || !existsSync(transcriptPath)) return;

  let parsed: ParsedTranscript;
  try {
    parsed = parseTranscript(transcriptPath);
  } catch {
    return;
  }

  const text = parsed.plainCompletion || parsed.lastMessage || '';
  if (text.length < 50) return;

  const patterns = {
    preference: /(?:prefer|like|want|appreciate|enjoy|love|hate|dislike)\s+(?:when|that|to)/i,
    frustration: /(?:frustrat|annoy|bother|irritat)/i,
    positive: /(?:great|awesome|perfect|excellent|good job|well done|nice)/i,
    milestone: /(?:first time|finally|breakthrough|success|accomplish)/i,
  };

  const hasSignal = Object.values(patterns).some(p => p.test(text));
  if (!hasSignal) return;

  const paiDir = getPaiDir();
  const { year, month, day, hours, minutes } = getPSTComponents();
  const monthDir = join(paiDir, 'MEMORY', 'RELATIONSHIP', `${year}-${month}`);
  if (!existsSync(monthDir)) mkdirSync(monthDir, { recursive: true });

  const filepath = join(monthDir, `${year}-${month}-${day}.md`);

  if (!existsSync(filepath)) {
    writeFileSync(filepath, `# Relationship Notes: ${year}-${month}-${day}\n\n*Auto-captured from sessions. Manual additions welcome.*\n\n---\n`, 'utf-8');
  }

  const note = `\n## ${hours}:${minutes} (pre-context-reset)\n\n- B @${getDAName()}: Session context reset. Work captured before loss.\n`;
  appendFileSync(filepath, note, 'utf-8');
  console.error('[PreContextReset] Relationship note appended');
}

// ── Harvest: Session Progress Snapshot ──

function harvestProgressSnapshot(sessionId: string, resetType: string): void {
  const progressDir = paiPath('MEMORY', 'STATE', 'progress');
  if (!existsSync(progressDir)) return;

  try {
    const files = Bun.glob('*-progress.json').scanSync(progressDir);
    for (const file of files) {
      const filepath = join(progressDir, file);
      const data = JSON.parse(readFileSync(filepath, 'utf-8'));
      if (data.session_id === sessionId || data.status === 'active') {
        if (!data.handoff_notes) data.handoff_notes = '';
        const resetNote = `\n[${getISOTimestamp()}] Context ${resetType} — previous conversation context lost. Work state preserved in WORK/ directory.`;
        data.handoff_notes += resetNote;
        data.updated = new Date().toISOString();
        writeFileSync(filepath, JSON.stringify(data, null, 2));
        console.error(`[PreContextReset] Progress snapshot updated: ${file}`);
        break;
      }
    }
  } catch {}
}

// ── Harvest: Flush Rating Signals ──

function flushRatingSignals(): void {
  const ratingsPath = paiPath('MEMORY', 'LEARNING', 'SIGNALS', 'ratings.jsonl');
  if (!existsSync(ratingsPath)) return;

  try {
    const marker = JSON.stringify({
      timestamp: getISOTimestamp(),
      type: 'context_reset',
      note: 'Context was cleared — ratings after this point are from fresh context',
    }) + '\n';
    appendFileSync(ratingsPath, marker);
  } catch {}
}

// ── Main ──

async function main() {
  const input = await readStdin();
  if (!input) process.exit(0);

  const prompt = (input.prompt || input.user_prompt || '').trim().toLowerCase();

  // Fast exit for non-reset commands (99% of prompts)
  if (!RESET_COMMANDS.includes(prompt)) {
    process.exit(0);
  }

  const resetType = prompt.replace('/', '');
  const sessionId = input.session_id || 'unknown';
  const transcriptPath = input.transcript_path || '';

  console.error(`[PreContextReset] Detected /${resetType} — harvesting before context loss`);

  try {
    harvestWorkLearning(sessionId, resetType);
  } catch (err) {
    console.error(`[PreContextReset] Work learning harvest failed: ${err}`);
  }

  try {
    harvestRelationshipNotes(transcriptPath);
  } catch (err) {
    console.error(`[PreContextReset] Relationship harvest failed: ${err}`);
  }

  try {
    harvestProgressSnapshot(sessionId, resetType);
  } catch (err) {
    console.error(`[PreContextReset] Progress snapshot failed: ${err}`);
  }

  try {
    flushRatingSignals();
  } catch (err) {
    console.error(`[PreContextReset] Rating flush failed: ${err}`);
  }

  console.error(`[PreContextReset] Harvest complete for /${resetType}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(`[PreContextReset] Fatal: ${err}`);
  process.exit(0);
});
