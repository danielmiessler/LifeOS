#!/usr/bin/env bun
/**
 * PreCompact.hook.ts - Preserve Context Before Compaction (PreCompact)
 *
 * PURPOSE:
 * Captures critical session context before Claude Code compresses the
 * conversation. Outputs a structured handover note that survives compaction,
 * ensuring continuity of work-in-progress state, active decisions, and
 * file context across the compression boundary.
 *
 * TRIGGER: PreCompact (both auto and manual)
 *
 * INPUT:
 * - stdin: Hook input JSON (session_id, transcript_path)
 * - Files: MEMORY/STATE/current-work*.json, active plans, task state
 *
 * OUTPUT:
 * - stdout: Structured handover context (preserved through compaction)
 * - stderr: Status messages
 * - exit(0): Always (non-blocking)
 *
 * PERFORMANCE:
 * - Non-blocking: Yes
 * - Typical execution: <100ms
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { findArtifactPath } from './lib/isa-utils';
import { getMemoryDir, getStateDir, getWorkDir } from './lib/paths';

const MEMORY_DIR = getMemoryDir();
const STATE_DIR = getStateDir();
const WORK_DIR = getWorkDir();

interface HookInput {
  session_id?: string;
  transcript_path?: string;
  cwd?: string;
}

function readJSON(path: string): any {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

function readText(path: string): string | null {
  try {
    if (!existsSync(path)) return null;
    return readFileSync(path, 'utf-8').trim();
  } catch {
    return null;
  }
}

function getCurrentWork(sessionId?: string): any {
  // Try session-scoped state first
  if (sessionId) {
    const scoped = join(STATE_DIR, `current-work-${sessionId}.json`);
    const data = readJSON(scoped);
    if (data) return data;
  }
  // Fall back to legacy global state
  return readJSON(join(STATE_DIR, 'current-work.json'));
}

/**
 * Read the active session's Ideal State Artifact (ISA.md, or legacy PRD.md).
 * `slug` is the session directory name under MEMORY/WORK/.
 */
function getActiveISA(slug: string): string | null {
  const path = findArtifactPath(slug);
  return path ? readText(path) : null;
}

function getRecentStateFiles(): string[] {
  try {
    if (!existsSync(STATE_DIR)) return [];
    return readdirSync(STATE_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => join(STATE_DIR, f));
  } catch {
    return [];
  }
}

async function main() {
  // Parse stdin
  let input: HookInput = {};
  try {
    const stdin = await Bun.stdin.text();
    if (stdin.trim()) {
      input = JSON.parse(stdin);
    }
  } catch {
    // Continue with empty input
  }

  const sections: string[] = [];

  // Section 1: Current work context
  const work = getCurrentWork(input.session_id);
  if (work) {
    sections.push('## Active Work');
    if (work.description) sections.push(`**Task:** ${work.description}`);
    if (work.directory) sections.push(`**Directory:** ${work.directory}`);
    if (work.status) sections.push(`**Status:** ${work.status}`);
    if (work.started_at) sections.push(`**Started:** ${work.started_at}`);

    // Get ISA if available
    if (work.directory) {
      const dirName = basename(work.directory);
      const isa = getActiveISA(dirName);
      if (isa) {
        // Include first 40 lines of the artifact for context
        const isaLines = isa.split('\n').slice(0, 40);
        sections.push('');
        sections.push('### ISA Summary');
        sections.push(isaLines.join('\n'));
      }
    }

    // Include files changed
    if (work.files_changed && work.files_changed.length > 0) {
      sections.push('');
      sections.push('### Files Modified');
      for (const f of work.files_changed.slice(0, 20)) {
        sections.push(`- ${f}`);
      }
    }

    // Include key decisions
    if (work.decisions && work.decisions.length > 0) {
      sections.push('');
      sections.push('### Key Decisions');
      for (const d of work.decisions) {
        sections.push(`- ${d}`);
      }
    }
  }

  // Section 2: Working directory context
  if (input.cwd) {
    sections.push('');
    sections.push(`## Working Directory`);
    sections.push(`\`${input.cwd}\``);
  }

  // Section 3: Session ID for continuity
  if (input.session_id) {
    sections.push('');
    sections.push(`## Session`);
    sections.push(`ID: ${input.session_id}`);
  }

  // Only output if we have meaningful context
  if (sections.length > 0) {
    const handover = [
      '# Pre-Compaction Handover',
      `*Captured: ${new Date().toISOString()}*`,
      '',
      ...sections,
    ].join('\n');

    // stdout: preserved through compaction
    console.log(handover);
    // stderr: status feedback
    console.error('[PreCompact] Context captured for compaction handover');
  } else {
    console.error('[PreCompact] No active work context to preserve');
  }
}

main().catch(err => {
  console.error(`[PreCompact] Error: ${err.message}`);
  process.exit(0); // Non-blocking
});
