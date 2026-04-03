#!/usr/bin/env bun
/**
 * RelationshipMemory.hook.ts - Extract relationship notes from sessions
 *
 * PURPOSE:
 * Analyzes session transcripts to extract relationship-relevant learnings
 * and appends them to the daily relationship log. This builds the memory
 * that makes our relationship feel like it's growing.
 *
 * TRIGGER: Stop (session end)
 *
 * INPUT:
 * - session_id: Current session identifier
 * - transcript_path: Path to conversation transcript
 *
 * OUTPUT:
 * - Writes to: MEMORY/RELATIONSHIP/YYYY-MM/YYYY-MM-DD.md
 * - May update: PAI/USER/ABOUT_DANIEL.md (significant learnings)
 *
 * RELATIONSHIP NOTE TYPES:
 * - W (World): Objective facts about {PRINCIPAL.NAME}'s situation
 * - B (Biographical): What happened this session (first-person DA)
 * - O (Opinion): Preference/belief with confidence
 *
 * EXAMPLES:
 * - W @Principal: Currently focused on PAI infrastructure improvements
 * - B @DA: Successfully debugged voice notifications after 5 attempts
 * - O(c=0.85) @Principal: Appreciates when I admit mistakes early
 */

import { writeFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';
import { getPaiDir } from './lib/paths';
import { getPSTComponents } from './lib/time';
import { getDAName, getPrincipalName } from './lib/identity';
import { parseTranscript } from '../PAI/Tools/TranscriptParser';

interface HookInput {
  session_id: string;
  transcript_path?: string;
  last_assistant_message?: string;  // v2.1.47+ — final response text
}

interface RelationshipNote {
  type: 'W' | 'B' | 'O';
  entities: string[];
  content: string;
  confidence?: number;
}

interface TranscriptEntry {
  type: 'user' | 'assistant';
  text: string;
}

/**
 * Read stdin with timeout
 */
async function readStdinWithTimeout(timeout: number = 5000): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    const timer = setTimeout(() => reject(new Error('Timeout')), timeout);
    process.stdin.on('data', (chunk) => { data += chunk.toString(); });
    process.stdin.on('end', () => { clearTimeout(timer); resolve(data); });
    process.stdin.on('error', (err) => { clearTimeout(timer); reject(err); });
  });
}

/**
 * Read transcript using shared TranscriptParser
 */
function readTranscriptEntries(path: string): TranscriptEntry[] {
  if (!path || !existsSync(path)) return [];

  try {
    const parsed = parseTranscript(path);
    // Combine user prompts and assistant completions into entry pairs
    const entries: TranscriptEntry[] = [];
    if (parsed.userPrompt) {
      entries.push({ type: 'user', text: parsed.userPrompt });
    }
    if (parsed.plainCompletion) {
      entries.push({ type: 'assistant', text: parsed.plainCompletion });
    }
    return entries;
  } catch {
    return [];
  }
}

/**
 * Analyze transcript for relationship-relevant content
 */
function analyzeForRelationship(entries: TranscriptEntry[]): RelationshipNote[] {
  const notes: RelationshipNote[] = [];

  // Patterns that indicate relationship-relevant content
  const patterns = {
    preference: /(?:prefer|like|want|appreciate|enjoy|love|hate|dislike)\s+(?:when|that|to)/i,
    frustration: /(?:frustrat|annoy|bother|irritat)/i,
    positive: /(?:great|awesome|perfect|excellent|good job|well done|nice)/i,
    learning: /(?:learn|discover|realize|understand|figure out)/i,
    milestone: /(?:first time|finally|breakthrough|success|accomplish)/i,
  };

  // Track what happened this session
  let sessionSummary: string[] = [];
  let danielPreferences: string[] = [];
  let frustrations: string[] = [];
  let positives: string[] = [];

  for (const entry of entries) {
    const text = entry.text;
    if (!text || text.length < 10) continue;

    // User messages might reveal preferences
    if (entry.type === 'user') {
      if (patterns.preference.test(text)) {
        // Extract preference (simplified - would benefit from LLM analysis)
        const snippet = text.slice(0, 200);
        danielPreferences.push(snippet);
      }

      if (patterns.frustration.test(text)) {
        frustrations.push(text.slice(0, 150));
      }

      if (patterns.positive.test(text)) {
        positives.push(text.slice(0, 150));
      }
    }

    // Assistant messages with SUMMARY tags indicate completed work
    if (entry.type === 'assistant') {
      const summaryMatch = text.match(/SUMMARY:\s*([^\n]+)/i);
      if (summaryMatch) {
        sessionSummary.push(summaryMatch[1].trim());
      }

      // Check for milestones
      if (patterns.milestone.test(text)) {
        const snippet = text.match(/[^.]*(?:first time|finally|breakthrough|success)[^.]*/i)?.[0];
        if (snippet) {
          sessionSummary.push(snippet.trim());
        }
      }
    }
  }

  // Generate relationship notes from analysis

  // B (Biographical) - What the DA did this session
  if (sessionSummary.length > 0) {
    const uniqueSummaries = [...new Set(sessionSummary)].slice(0, 3);
    for (const summary of uniqueSummaries) {
      notes.push({
        type: 'B',
        entities: [`@${getDAName()}`],
        content: summary
      });
    }
  }

  // O (Opinion) - Inferred preferences
  if (positives.length >= 2) {
    notes.push({
      type: 'O',
      entities: [`@${getPrincipalName()}`],
      content: 'Responded positively to this session\'s approach',
      confidence: 0.70
    });
  }

  if (frustrations.length >= 2) {
    notes.push({
      type: 'O',
      entities: [`@${getPrincipalName()}`],
      content: 'Experienced frustration during this session (likely tooling-related)',
      confidence: 0.75
    });
  }

  return notes;
}

/**
 * Format notes for markdown
 */
function formatNotes(notes: RelationshipNote[]): string {
  if (notes.length === 0) return '';

  const lines: string[] = [];
  const { hours, minutes } = getPSTComponents();

  lines.push(`\n## ${hours}:${minutes} PST\n`);

  for (const note of notes) {
    const entities = note.entities.join(' ');
    const confidence = note.confidence ? `(c=${note.confidence.toFixed(2)})` : '';
    lines.push(`- ${note.type}${confidence} ${entities}: ${note.content}`);
  }

  return lines.join('\n') + '\n';
}

/**
 * Ensure relationship memory directory exists
 */
function ensureRelationshipDir(paiDir: string): string {
  const { year, month, day } = getPSTComponents();
  const monthDir = join(paiDir, 'MEMORY', 'RELATIONSHIP', `${year}-${month}`);

  if (!existsSync(monthDir)) {
    mkdirSync(monthDir, { recursive: true });
  }

  return join(monthDir, `${year}-${month}-${day}.md`);
}

/**
 * Initialize daily relationship file if needed
 */
function initDailyFile(filepath: string): void {
  if (existsSync(filepath)) return;

  const { year, month, day } = getPSTComponents();
  const header = `# Relationship Notes: ${year}-${month}-${day}

*Auto-captured from sessions. Manual additions welcome.*

---
`;

  writeFileSync(filepath, header, 'utf-8');
}

async function main() {
  try {
    console.error('[RelationshipMemory] Hook started');

    const input = await readStdinWithTimeout();
    const data: HookInput = JSON.parse(input);

    if (!data.transcript_path) {
      console.error('[RelationshipMemory] No transcript path, exiting');
      process.exit(0);
    }

    // Read and analyze transcript — prefer last_assistant_message over full parse
    const entries = readTranscriptEntries(data.transcript_path);
    if (data.last_assistant_message) {
      entries.push({ type: 'assistant', text: data.last_assistant_message });
    }
    if (entries.length === 0) {
      console.error('[RelationshipMemory] No transcript entries, exiting');
      process.exit(0);
    }

    console.error(`[RelationshipMemory] Analyzing ${entries.length} transcript entries`);

    const notes = analyzeForRelationship(entries);
    if (notes.length === 0) {
      console.error('[RelationshipMemory] No relationship notes to capture');
      process.exit(0);
    }

    // Write to daily relationship file
    const paiDir = getPaiDir();
    const filepath = ensureRelationshipDir(paiDir);
    initDailyFile(filepath);

    const formatted = formatNotes(notes);
    appendFileSync(filepath, formatted, 'utf-8');

    console.error(`[RelationshipMemory] Captured ${notes.length} notes to ${filepath}`);
    process.exit(0);

  } catch (err) {
    console.error(`[RelationshipMemory] Error: ${err}`);
    process.exit(0); // Don't fail the session end
  }
}

main();
