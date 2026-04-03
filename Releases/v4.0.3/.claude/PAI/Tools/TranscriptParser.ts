#!/usr/bin/env bun
/**
 * TranscriptParser.ts - Claude transcript parsing utilities
 *
 * Shared library for extracting content from Claude Code transcript files.
 * Used by Stop hooks for voice, tab state, and response capture.
 *
 * CLI Usage:
 *   bun TranscriptParser.ts <transcript_path>
 *   bun TranscriptParser.ts <transcript_path> --voice
 *   bun TranscriptParser.ts <transcript_path> --plain
 *   bun TranscriptParser.ts <transcript_path> --structured
 *   bun TranscriptParser.ts <transcript_path> --state
 *
 * Module Usage:
 *   import { parseTranscript, getLastAssistantMessage } from './TranscriptParser'
 */

import { readFileSync } from 'fs';
import { getIdentity } from '../../hooks/lib/identity';

const DA_IDENTITY = getIdentity();

// ============================================================================
// Types
// ============================================================================

export interface StructuredResponse {
  date?: string;
  summary?: string;
  analysis?: string;
  actions?: string;
  results?: string;
  status?: string;
  next?: string;
  completed?: string;
}

export type ResponseState = 'awaitingInput' | 'completed' | 'error';

export interface ParsedTranscript {
  /** Raw transcript content */
  raw: string;
  /** Last assistant message text */
  lastMessage: string;
  /** Full text from current response turn (all assistant blocks combined) */
  currentResponseText: string;
  /** Voice completion text (for TTS) */
  voiceCompletion: string;
  /** Plain completion text (for tab title) */
  plainCompletion: string;
  /** Structured sections extracted from response */
  structured: StructuredResponse;
  /** Response state for tab coloring */
  responseState: ResponseState;
}

// ============================================================================
// Core Parsing Functions
// ============================================================================

/**
 * Safely convert Claude content (string or array of blocks) to plain text.
 */
export function contentToText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map(c => {
        if (typeof c === 'string') return c;
        if (c?.text) return c.text;
        if (c?.content) return contentToText(c.content);
        return '';
      })
      .join(' ')
      .trim();
  }
  return '';
}

/**
 * Parse last assistant message from transcript content.
 * Takes raw content string to avoid re-reading file.
 */
export function parseLastAssistantMessage(transcriptContent: string): string {
  const lines = transcriptContent.trim().split('\n');
  let lastAssistantMessage = '';

  for (const line of lines) {
    if (line.trim()) {
      try {
        const entry = JSON.parse(line) as any;
        if (entry.type === 'assistant' && entry.message?.content) {
          const text = contentToText(entry.message.content);
          if (text) {
            lastAssistantMessage = text;
          }
        }
      } catch {
        // Skip invalid JSON lines
      }
    }
  }

  return lastAssistantMessage;
}

/**
 * Collect assistant text from the CURRENT response turn only.
 * A "turn" is everything after the last human message in the transcript.
 * This prevents voice/completion extraction from picking up stale lines
 * from previous turns when the Stop hook fires.
 *
 * Within a single turn, there may be multiple assistant entries
 * (text → tool_use → tool_result → more text). All are collected.
 */
export function collectCurrentResponseText(transcriptContent: string): string {
  const lines = transcriptContent.trim().split('\n');

  // Find the index of the last REAL user prompt.
  // Claude Code transcript uses type='user' for both actual user prompts AND
  // tool_result entries (which are mid-response). Real user prompts have at
  // least one {type:'text'} content block. Tool results only have {type:'tool_result'}.
  let lastHumanIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim()) {
      try {
        const entry = JSON.parse(lines[i]) as any;
        if (entry.type === 'human' || entry.type === 'user') {
          const content = entry.message?.content;
          // String content = real user message
          if (typeof content === 'string') {
            lastHumanIndex = i;
          } else if (Array.isArray(content)) {
            // Check for text blocks — indicates a real user prompt
            const hasText = content.some((b: any) => b?.type === 'text' && b?.text?.trim());
            if (hasText) {
              lastHumanIndex = i;
            }
          }
        }
      } catch {
        // Skip invalid JSON lines
      }
    }
  }

  // Collect only assistant text AFTER the last human message
  const textParts: string[] = [];
  for (let i = lastHumanIndex + 1; i < lines.length; i++) {
    if (lines[i].trim()) {
      try {
        const entry = JSON.parse(lines[i]) as any;
        if (entry.type === 'assistant' && entry.message?.content) {
          const text = contentToText(entry.message.content);
          if (text) {
            textParts.push(text);
          }
        }
      } catch {
        // Skip invalid JSON lines
      }
    }
  }

  return textParts.join('\n');
}

/**
 * Get last assistant message from transcript file.
 * Convenience function that reads file and parses.
 */
export function getLastAssistantMessage(transcriptPath: string): string {
  try {
    const content = readFileSync(transcriptPath, 'utf-8');
    return parseLastAssistantMessage(content);
  } catch (error) {
    console.error('[TranscriptParser] Error reading transcript:', error);
    return '';
  }
}

// ============================================================================
// Extraction Functions
// ============================================================================

/**
 * Extract voice completion line for TTS.
 * Uses LAST match to avoid capturing mentions in analysis text.
 */
export function extractVoiceCompletion(text: string): string {
  // Remove system-reminder tags
  text = text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '');

  // Use global flag and find LAST match (voice line is at end of response)
  const completedPatterns = [
    new RegExp(`🗣️\\s*\\*{0,2}${DA_IDENTITY.name}:?\\*{0,2}\\s*(.+?)(?:\\n|$)`, 'gi'),
    /🎯\s*\*{0,2}COMPLETED:?\*{0,2}\s*(.+?)(?:\n|$)/gi,
  ];

  for (const pattern of completedPatterns) {
    const matches = [...text.matchAll(pattern)];
    if (matches.length > 0) {
      // Use LAST match - the actual voice line at end of response
      const lastMatch = matches[matches.length - 1];
      if (lastMatch && lastMatch[1]) {
        let completed = lastMatch[1].trim();
        // Clean up agent tags
        completed = completed.replace(/^\[AGENT:\w+\]\s*/i, '');
        // Voice server handles sanitization
        return completed.trim();
      }
    }
  }

  // Don't say anything if no voice line found
  return '';
}

/**
 * Extract plain completion text for display/tab titles.
 * Uses LAST match to avoid capturing mentions in analysis text.
 */
export function extractCompletionPlain(text: string): string {
  text = text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '');

  // Use global flag and find LAST match (voice line is at end of response)
  const completedPatterns = [
    new RegExp(`🗣️\\s*\\*{0,2}${DA_IDENTITY.name}:?\\*{0,2}\\s*(.+?)(?:\\n|$)`, 'gi'),
    /🎯\s*\*{0,2}COMPLETED:?\*{0,2}\s*(.+?)(?:\n|$)/gi,
  ];

  for (const pattern of completedPatterns) {
    const matches = [...text.matchAll(pattern)];
    if (matches.length > 0) {
      // Use LAST match - the actual voice line at end of response
      const lastMatch = matches[matches.length - 1];
      if (lastMatch && lastMatch[1]) {
        let completed = lastMatch[1].trim();
        completed = completed.replace(/^\[AGENT:\w+\]\s*/i, '');
        completed = completed.replace(/\[.*?\]/g, '');
        completed = completed.replace(/\*\*/g, '');
        completed = completed.replace(/\*/g, '');
        completed = completed.replace(/[\p{Emoji}\p{Emoji_Component}]/gu, '');
        completed = completed.replace(/\s+/g, ' ').trim();
        return completed;
      }
    }
  }

  // Fallback: try to extract something meaningful from the response
  const summaryMatch = text.match(/📋\s*\*{0,2}SUMMARY:?\*{0,2}\s*(.+?)(?:\n|$)/i);
  if (summaryMatch && summaryMatch[1]) {
    let summary = summaryMatch[1].trim().slice(0, 30);
    return summary.length > 27 ? summary.slice(0, 27) + '…' : summary;
  }

  // No voice line found — return empty, let downstream handle fallback
  return '';
}

/**
 * Extract structured sections from response.
 */
export function extractStructuredSections(text: string): StructuredResponse {
  const result: StructuredResponse = {};

  text = text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '');

  const patterns: Record<keyof StructuredResponse, RegExp> = {
    date: /📅\s*(.+?)(?:\n|$)/i,
    summary: /📋\s*SUMMARY:\s*(.+?)(?:\n|$)/i,
    analysis: /🔍\s*ANALYSIS:\s*(.+?)(?:\n|$)/i,
    actions: /⚡\s*ACTIONS:\s*(.+?)(?:\n|$)/i,
    results: /✅\s*RESULTS:\s*(.+?)(?:\n|$)/i,
    status: /📊\s*STATUS:\s*(.+?)(?:\n|$)/i,
    next: /➡️\s*NEXT:\s*(.+?)(?:\n|$)/i,
    completed: new RegExp(`(?:🗣️\\s*${DA_IDENTITY.name}:|🎯\\s*COMPLETED:)\\s*(.+?)(?:\\n|$)`, 'i'),
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = text.match(pattern);
    if (match && match[1]) {
      result[key as keyof StructuredResponse] = match[1].trim();
    }
  }

  return result;
}

// ============================================================================
// State Detection
// ============================================================================

/**
 * Detect response state for tab coloring.
 * Takes parsed content to avoid re-reading file.
 */
export function detectResponseState(lastMessage: string, transcriptContent: string): ResponseState {
  try {
    // Check if the LAST assistant message used AskUserQuestion
    const lines = transcriptContent.trim().split('\n');
    let lastAssistantEntry: any = null;

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.type === 'assistant' && entry.message?.content) {
          lastAssistantEntry = entry;
        }
      } catch {}
    }

    if (lastAssistantEntry?.message?.content) {
      const content = Array.isArray(lastAssistantEntry.message.content)
        ? lastAssistantEntry.message.content
        : [];
      for (const block of content) {
        if (block.type === 'tool_use' && block.name === 'AskUserQuestion') {
          return 'awaitingInput';
        }
      }
    }
  } catch (err) {
    console.error('[TranscriptParser] Error detecting response state:', err);
  }

  // Check for error indicators
  if (/📊\s*STATUS:.*(?:error|failed|broken|problem|issue)/i.test(lastMessage)) {
    return 'error';
  }

  const hasErrorKeyword = /\b(?:error|failed|exception|crash|broken)\b/i.test(lastMessage);
  const hasErrorEmoji = /❌|🚨|⚠️/.test(lastMessage);
  if (hasErrorKeyword && hasErrorEmoji) {
    return 'error';
  }

  return 'completed';
}

// ============================================================================
// Unified Parser
// ============================================================================

/**
 * Parse transcript and extract all relevant data in one pass.
 * This is the main function for the orchestrator pattern.
 */
export function parseTranscript(transcriptPath: string): ParsedTranscript {
  try {
    const raw = readFileSync(transcriptPath, 'utf-8');
    const lastMessage = parseLastAssistantMessage(raw);
    // Collect assistant text from CURRENT response turn only.
    // This prevents stale voice lines from previous turns being read
    // when the Stop hook fires. Within the current turn, multiple
    // assistant entries exist (text → tool_use → tool_result → more text).
    const currentResponseText = collectCurrentResponseText(raw);

    return {
      raw,
      lastMessage,
      currentResponseText,
      voiceCompletion: extractVoiceCompletion(currentResponseText),
      plainCompletion: extractCompletionPlain(currentResponseText),
      structured: extractStructuredSections(currentResponseText),
      responseState: detectResponseState(lastMessage, raw),
    };
  } catch (error) {
    console.error('[TranscriptParser] Error parsing transcript:', error);
    return {
      raw: '',
      lastMessage: '',
      currentResponseText: '',
      voiceCompletion: '',
      plainCompletion: '',
      structured: {},
      responseState: 'completed',
    };
  }
}

// ============================================================================
// CLI
// ============================================================================

if (import.meta.main) {
  const args = process.argv.slice(2);
  const transcriptPath = args.find(a => !a.startsWith('-'));

  if (!transcriptPath) {
    console.log(`Usage: bun TranscriptParser.ts <transcript_path> [options]

Options:
  --voice       Output voice completion (for TTS)
  --plain       Output plain completion (for tab titles)
  --structured  Output structured sections as JSON
  --state       Output response state
  --all         Output full parsed transcript as JSON (default)
`);
    process.exit(1);
  }

  const parsed = parseTranscript(transcriptPath);

  if (args.includes('--voice')) {
    console.log(parsed.voiceCompletion);
  } else if (args.includes('--plain')) {
    console.log(parsed.plainCompletion);
  } else if (args.includes('--structured')) {
    console.log(JSON.stringify(parsed.structured, null, 2));
  } else if (args.includes('--state')) {
    console.log(parsed.responseState);
  } else {
    // Default: output everything
    console.log(JSON.stringify(parsed, null, 2));
  }
}
