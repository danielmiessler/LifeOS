#!/usr/bin/env bun
/**
 * SetQuestionTab.hook.ts - Tab Color for User Input (PreToolUse)
 *
 * PURPOSE:
 * Changes the terminal tab color to teal when Claude invokes the
 * AskUserQuestion tool. Parses the question's header field to show
 * a short summary of what needs answering. No emoji prefix — the
 * teal background alone signals "question pending."
 *
 * TRIGGER: PreToolUse (matcher: AskUserQuestion)
 *
 * INPUT:
 * - stdin: Hook input JSON with tool_input containing questions array
 *
 * OUTPUT:
 * - stdout: None
 * - stderr: Status message
 * - exit(0): Always (non-blocking)
 *
 * SIDE EFFECTS:
 * - Sets tab color to teal (#0D4F4F) via setTabState
 * - Sets tab title to question header summary
 * - Saves previousTitle for QuestionAnswered to restore
 *
 * INTER-HOOK RELATIONSHIPS:
 * - DEPENDS ON: None
 * - COORDINATES WITH: UpdateTabTitle (shares tab color management)
 * - MUST RUN BEFORE: None
 * - MUST RUN AFTER: UpdateTabTitle (overrides working color when asking)
 *
 * TAB COLOR SCHEME (inactive tab only - active tab stays dark blue):
 * - Dark teal (#0D4F4F): Waiting for user input (this hook)
 * - Dark orange (#804000): Actively working (UpdateTabTitle)
 * - Dark purple (#1E0A3C): AI inference/thinking (UpdateTabTitle)
 * - Dark blue (#002B80): Active tab always uses this
 *
 * ERROR HANDLING:
 * - Kitty unavailable: Silent failure (other terminals not supported)
 * - stdin parse failure: Falls back to generic "Awaiting input" title
 *
 * PERFORMANCE:
 * - Non-blocking: Yes
 * - Typical execution: <50ms
 */

import { setTabState, readTabState } from './lib/tab-setter';
import { isValidQuestionTitle, getQuestionFallback } from './lib/output-validators';

const FALLBACK_TITLE = getQuestionFallback();

/**
 * Read stdin with timeout to get tool_input JSON.
 */
function readStdin(timeoutMs = 2000): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    const timer = setTimeout(() => resolve(data), timeoutMs);
    process.stdin.on('data', (chunk) => { data += chunk.toString(); });
    process.stdin.on('end', () => { clearTimeout(timer); resolve(data); });
    process.stdin.on('error', (err) => { clearTimeout(timer); reject(err); });
  });
}

/**
 * Extract a short summary from the AskUserQuestion tool_input.
 * Uses the header field (max 12 chars, designed as a concise label).
 * Falls back to first 3 words of the question text.
 */
function extractSummary(input: any): string {
  try {
    const questions = input?.tool_input?.questions;
    if (!Array.isArray(questions) || questions.length === 0) return FALLBACK_TITLE;

    const q = questions[0];

    // Prefer the header field — it's already a short label
    if (q.header && typeof q.header === 'string' && q.header.trim().length > 0) {
      return q.header.trim();
    }

    // Fallback: first 3 words of the question text
    if (q.question && typeof q.question === 'string') {
      const words = q.question.trim().split(/\s+/).slice(0, 3);
      return words.join(' ').replace(/\?$/, '');
    }
  } catch {
    // Fall through to default
  }
  return FALLBACK_TITLE;
}

async function main() {
  let summary = FALLBACK_TITLE;
  let sessionId: string | undefined;

  try {
    const raw = await readStdin();
    if (raw.trim()) {
      const parsed = JSON.parse(raw);
      summary = extractSummary(parsed);
      sessionId = parsed.session_id;
    }
  } catch {
    // stdin parse failed — use fallback
  }

  // Validate the summary for question titles
  if (!isValidQuestionTitle(summary)) {
    summary = FALLBACK_TITLE;
  }

  try {
    // Read current working title so QuestionAnswered can restore it
    const currentState = readTabState(sessionId);
    const previousTitle = currentState?.title || undefined;

    // Set tab to question state (teal) with previousTitle for restoration
    setTabState({ title: summary, state: 'question', previousTitle, sessionId });

    console.error(`[SetQuestionTab] Tab set to teal with summary: "${summary}"`);
  } catch (error) {
    // Silently fail if kitty remote control is not available
    console.error('[SetQuestionTab] Kitty remote control unavailable');
  }

  process.exit(0);
}

main();
