#!/usr/bin/env bun
/**
 * QuestionAnswered.hook.ts - Reset Tab After Question Answered (PostToolUse)
 *
 * PURPOSE:
 * Resets the terminal tab from question state (teal) back to working state (orange)
 * after the user answers an AskUserQuestion prompt. This bridges the gap where
 * question answers don't trigger UserPromptSubmit (they're tool results, not prompts).
 *
 * TRIGGER: PostToolUse (matcher: AskUserQuestion)
 *
 * INPUT:
 * - stdin: Hook input JSON with tool_input containing the user's answer
 *
 * OUTPUT:
 * - stdout: None
 * - stderr: Status message
 * - exit(0): Always (non-blocking)
 *
 * SIDE EFFECTS:
 * - Sets tab color to orange (#804000) via setTabState
 * - Sets tab title to restored working title or fallback
 *
 * INTER-HOOK RELATIONSHIPS:
 * - DEPENDS ON: SetQuestionTab (runs before this, sets teal + saves previousTitle)
 * - COORDINATES WITH: UpdateTabTitle (shares tab color scheme)
 * - MUST RUN AFTER: SetQuestionTab (resets its teal color)
 *
 * TAB COLOR SCHEME (inactive tab only - active tab stays dark blue):
 * - Dark teal (#0D4F4F): Waiting for user input (SetQuestionTab)
 * - Dark orange (#804000): Actively working (this hook + UpdateTabTitle)
 * - Dark purple (#1E0A3C): AI inference/thinking (UpdateTabTitle)
 * - Dark blue (#002B80): Active tab always uses this
 *
 * ERROR HANDLING:
 * - Kitty unavailable: Silent failure
 */

import { setTabState, readTabState, stripPrefix } from './lib/tab-setter';

async function main() {
  try {
    // Extract session_id from stdin for correct tab targeting
    let sessionId: string | undefined;
    try {
      const raw = await Promise.race([
        Bun.stdin.text(),
        new Promise<string>((_, reject) => setTimeout(() => reject(new Error('stdin timeout')), 2000)),
      ]);
      if (raw.trim()) {
        const parsed = JSON.parse(raw);
        sessionId = parsed.session_id;
      }
    } catch { /* stdin timeout or parse failed — continue without session_id */ }

    // Read previous working title saved by SetQuestionTab
    const currentState = readTabState(sessionId);
    let restoredTitle = 'Processing answer.';

    if (currentState?.previousTitle) {
      // Strip any emoji prefix from the saved title and re-add working prefix
      const rawTitle = stripPrefix(currentState.previousTitle);
      if (rawTitle) {
        restoredTitle = rawTitle;
      }
    }

    setTabState({ title: '⚙️' + restoredTitle, state: 'working', sessionId });

    console.error('[QuestionAnswered] Tab reset to working state (orange on inactive only)');
  } catch (error) {
    // Silently fail if kitty remote control is not available
    console.error('[QuestionAnswered] Kitty remote control unavailable');
  }

  process.exit(0);
}

main();
