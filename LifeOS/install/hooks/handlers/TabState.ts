/**
 * TabState.ts - Terminal Tab State Manager
 *
 * PURPOSE:
 * Updates Kitty terminal tab title and color on response completion.
 * Converts the working title to past tense as primary strategy,
 * falls back to voice line extraction, then generic fallback.
 *
 * Pure handler: receives pre-parsed transcript data, updates Kitty tab.
 * Called by TabState.hook.ts (Stop branch; formerly ResponseTabReset.hook.ts).
 */

import { setTabState, readTabState, tabTitleActivity, getSessionShortLabel, setAscentTab, isDegenerateDesc, resolveSessionRow } from '../lib/tab-setter';
import { isValidCompletionTitle, gerundToPastTense, getWorkingFallback, trimToValidTitle, toGerund } from '../lib/output-validators';
import { closerPattern, getDAName } from '../lib/identity';
import { stripVoiceTags } from '../../LIFEOS/TOOLS/VoiceTags';

import type { ParsedTranscript } from '../../LIFEOS/TOOLS/TranscriptParser';

/**
 * Extract tab title from voice line. Takes first sentence, caps at 4 words.
 * If first sentence is too short (1 word like "Fixed."), combines with next words.
 * Validates with isValidCompletionTitle. Returns null if invalid.
 */
function extractTabTitle(voiceLine: string): string | null {
  if (!voiceLine || voiceLine.length < 3) return null;

  const cleaned = stripVoiceTags(voiceLine
    .replace(new RegExp(`^${closerPattern()}\\s*`), ''))
    .replace(new RegExp(`^${getDAName()}:\\s*`, 'i'), '')
    .replace(/^(Done\.?\s*)/i, '')
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
    if (words.length >= 2) {
      // Convert imperative verb to past tense via gerund: "Fix" → "Fixing" → "Fixed"
      const verb = words[0];
      const gerund = toGerund(verb);
      const past = gerundToPastTense(gerund);
      const titleWords = [past, ...words.slice(1, 4)];
      return trimToValidTitle(titleWords, isValidCompletionTitle);
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
      let rawTitle = tabTitleActivity(currentState.title, sessionId ? getSessionShortLabel(sessionId) : null);
      if (rawTitle && !isDegenerateDesc(rawTitle) && rawTitle !== 'Done.' && rawTitle !== 'Processing.' && rawTitle !== 'Processing request.' && rawTitle !== getWorkingFallback() && !rawTitle.endsWith('ready\u2026')) {
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

    // FALLBACK 3: Pass null — let setAscentTab use session name
    // "Task complete." is meaningless; the session name at least identifies the work
    if (!shortTitle) {
      console.error(`[TabState] All extraction strategies failed, deferring to session name`);
    }

    if (sessionId) {
      // A turn ending is not the same as a RUN ending. A native turn (no ISA)
      // is done — cairn. But an ISA whose criteria are still open is mid-climb;
      // stamping cairn here painted a live run green at every turn end and then
      // seeded the next prompt with priorAscent=cairn, wiping it to ⚡ traverse
      // (found 2026-09-07). Resolve the run's real state from work.json — the
      // SAME row Pulse reads — and only paint cairn when the run truly is one.
      const row = resolveSessionRow(sessionId);
      const stampState = row?.hasIsa && row.ascent && row.ascent !== 'cairn' ? row.ascent : 'cairn';
      // A non-cairn state is still climbing — keep the working description
      // (composeAscentTitle carries it over); the past-tense summary is only
      // honest at cairn.
      const summary = stampState === 'cairn' ? shortTitle?.replace(/\.$/, '') || undefined : undefined;
      setAscentTab(stampState, sessionId, summary);

      console.error(`[TabState] Turn end (${stampState}): "${stampState === 'cairn' ? (shortTitle || '(session name fallback)') : 'mid-run, state preserved'}"`);
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
