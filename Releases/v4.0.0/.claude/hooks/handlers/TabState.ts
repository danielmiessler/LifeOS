/**
 * TabState.ts - Terminal Tab State Manager
 *
 * PURPOSE:
 * Updates Kitty terminal tab title and color on response completion.
 * Converts the working title to past tense as primary strategy,
 * falls back to voice line extraction, then generic fallback.
 *
 * Pure handler: receives pre-parsed transcript data, updates Kitty tab.
 * Called by ResponseTabReset.hook.ts.
 */

import { setTabState, readTabState, stripPrefix, setPhaseTab } from '../lib/tab-setter';
import { isValidCompletionTitle, gerundToPastTense, getWorkingFallback, trimToValidTitle } from '../lib/output-validators';
import { getDAName } from '../lib/identity';

import type { ParsedTranscript } from '../../PAI/Tools/TranscriptParser';

/**
 * Extract tab title from voice line. Takes first sentence, caps at 4 words.
 * If first sentence is too short (1 word like "Fixed."), combines with next words.
 * Validates with isValidCompletionTitle. Returns null if invalid.
 */
function extractTabTitle(voiceLine: string): string | null {
  if (!voiceLine || voiceLine.length < 3) return null;

  const cleaned = voiceLine
    .replace(/^🗣️\s*/, '')
    .replace(new RegExp(`^${getDAName()}:\\s*`, 'i'), '')
    .replace(/^(Done\.?\s*)/i, '')
    .replace(/^(I've\s+|I\s+)/i, '')
    .trim();

  if (!cleaned || cleaned.length < 3) return null;

  // Split on sentence boundaries
  const sentences = cleaned.split(/\.\s/);
  let firstSentence = sentences[0].replace(/\.$/, '').trim();

  // If first sentence is just 1 word (e.g., "Fixed"), grab more content
  const firstWords = firstSentence.split(/\s+/);
  if (firstWords.length === 1 && sentences.length > 1) {
    // Combine with words from next sentence to make a proper title
    const nextWords = sentences[1].split(/\s+/).slice(0, 3);
    firstSentence = firstWords[0] + ' ' + nextWords.join(' ');
  }

  const words = firstSentence.split(/\s+/);
  if (words.length === 0) return null;

  return trimToValidTitle(words, isValidCompletionTitle);
}

/**
 * Extract a completion title from the response content.
 * Tries TASK line, then SUMMARY section as fallback when voice line is absent.
 * Returns null if no valid title can be extracted.
 */
function extractFromResponseContent(responseText: string): string | null {
  if (!responseText || responseText.length < 10) return null;

  // Strategy 1: Extract from 🗒️ TASK: line (e.g., "Fix broken tab title update system")
  const taskMatch = responseText.match(/🗒️\s*TASK:\s*(.+?)(?:\n|$)/i);
  if (taskMatch && taskMatch[1]) {
    const taskDesc = taskMatch[1].trim();
    const words = taskDesc.split(/\s+/);
    // Convert imperative to past tense for first word
    if (words.length >= 2) {
      const firstLower = words[0].toLowerCase();
      const pastMap: Record<string, string> = {
        fix: 'Fixed', update: 'Updated', add: 'Added', remove: 'Removed',
        create: 'Created', build: 'Built', deploy: 'Deployed', debug: 'Debugged',
        test: 'Tested', review: 'Reviewed', refactor: 'Refactored', implement: 'Implemented',
        write: 'Wrote', find: 'Found', install: 'Installed', configure: 'Configured',
        run: 'Ran', check: 'Checked', clean: 'Cleaned', merge: 'Merged',
        change: 'Changed', improve: 'Improved', optimize: 'Optimized', analyze: 'Analyzed',
        research: 'Researched', investigate: 'Investigated', design: 'Designed',
        push: 'Pushed', pull: 'Pulled', commit: 'Committed', move: 'Moved',
        rename: 'Renamed', delete: 'Deleted', start: 'Started', stop: 'Stopped',
        restart: 'Restarted', set: 'Set', get: 'Got', make: 'Made', show: 'Showed',
        list: 'Listed', search: 'Searched', explain: 'Explained', modify: 'Modified',
      };
      const past = pastMap[firstLower];
      if (past) {
        const rest = words.slice(1, 3).join(' ');
        const candidate = `${past} ${rest}.`;
        if (isValidCompletionTitle(candidate)) return candidate;
      }
    }
  }

  // Strategy 2: Extract from 📋 SUMMARY: line
  const summaryMatch = responseText.match(/📋\s*SUMMARY:\s*(.+?)(?:\n|$)/i);
  if (summaryMatch && summaryMatch[1]) {
    const summary = summaryMatch[1].trim().replace(/^\[?\d+\s*bullets?\]?\s*/i, '');
    const words = summary.split(/\s+/);
    if (words.length >= 2) {
      const candidate = trimToValidTitle(words, isValidCompletionTitle);
      if (candidate) return candidate;
    }
  }

  return null;
}

/**
 * Handle tab state update with pre-parsed transcript data.
 */
export async function handleTabState(parsed: ParsedTranscript, sessionId?: string): Promise<void> {
  try {
    // Don't overwrite question state — question hook owns that
    if (parsed.responseState === 'awaitingInput') return;

    // PRIMARY: Convert working title to past tense
    let shortTitle: string | null = null;
    const currentState = readTabState(sessionId);
    if (currentState) {
      let rawTitle = stripPrefix(currentState.title);
      // Strip session prefix (e.g., "KITTY TAB | Removing redundancy." → "Removing redundancy.")
      const pipeIdx = rawTitle.indexOf(' | ');
      if (pipeIdx !== -1) {
        rawTitle = rawTitle.slice(pipeIdx + 3);
      }
      if (rawTitle && rawTitle !== 'Done.' && rawTitle !== 'Processing.' && rawTitle !== 'Processing request.' && rawTitle !== getWorkingFallback() && !rawTitle.endsWith('ready\u2026')) {
        const words = rawTitle.replace(/\.$/, '').split(/\s+/);
        if (words.length >= 2 && words[0].toLowerCase().endsWith('ing')) {
          words[0] = gerundToPastTense(words[0]);
        }
        const candidate = words.join(' ') + '.';
        if (isValidCompletionTitle(candidate)) {
          shortTitle = candidate;
        }
      }
    }

    // FALLBACK 1: Extract from voice line
    if (!shortTitle) {
      shortTitle = extractTabTitle(parsed.plainCompletion);
    }

    // FALLBACK 2: Extract from response content (TASK, SUMMARY sections)
    if (!shortTitle) {
      shortTitle = extractFromResponseContent(parsed.currentResponseText);
      if (shortTitle) {
        console.error(`[TabState] Extracted title from response content: "${shortTitle}"`);
      }
    }

    // FALLBACK 3: Pass null — let setPhaseTab use session name
    // "Task complete." is meaningless; the session name at least identifies the work
    if (!shortTitle) {
      console.error(`[TabState] All extraction strategies failed, deferring to session name`);
    }

    if (sessionId) {
      // Completion with session prefix: "NAME | summary"
      setPhaseTab('COMPLETE', sessionId, shortTitle?.replace(/\.$/, '') || undefined);

      console.error(`[TabState] Completion: "${shortTitle || '(session name fallback)'}"`);
    } else {
      // No session ID fallback: "✅ summary"
      const tabTitle = `✅ ${shortTitle || 'Done.'}`;
      console.error(`[TabState] ${parsed.responseState}: "${tabTitle}"`);
      setTabState({ title: tabTitle, state: 'completed', sessionId: undefined });
    }
  } catch (error) {
    console.error('[TabState] Failed:', error);
  }
}
