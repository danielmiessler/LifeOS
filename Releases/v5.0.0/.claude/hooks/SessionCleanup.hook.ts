#!/usr/bin/env bun
/**
 * SessionCleanup.hook.ts - Mark Work Complete and Clear State (SessionEnd)
 *
 * PURPOSE:
 * Finalizes a Claude Code session by marking the current work directory as
 * COMPLETED, clearing session state, resetting Kitty tab, and cleaning up
 * session name entries.
 *
 * TRIGGER: SessionEnd
 *
 * INPUT:
 * - stdin: Hook input JSON (session_id, transcript_path)
 * - Files: MEMORY/STATE/current-work.json
 *
 * OUTPUT:
 * - stdout: None
 * - stderr: Status messages
 * - exit(0): Always (non-blocking)
 *
 * SIDE EFFECTS:
 * - Updates: MEMORY/WORK/<dir>/ISA.md (or legacy PRD.md) or META.yaml (status: COMPLETED)
 * - Deletes: MEMORY/STATE/current-work.json (clears session state)
 * - Resets: Kitty tab title and color to defaults
 * - Cleans: session-names.json entry (prevents ghost entries)
 *
 * INTER-HOOK RELATIONSHIPS:
 * - COORDINATES WITH: WorkCompletionLearning (both run at SessionEnd)
 * - MUST RUN AFTER: WorkCompletionLearning (learning capture uses state before clear)
 *
 * PERFORMANCE:
 * - Non-blocking: Yes
 * - Typical execution: <50ms
 */

import { writeFileSync, existsSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { getMemoryDir, getStateDir, getWorkDir } from './lib/paths';
import { getISOTimestamp } from './lib/time';
import { setTabState, cleanupKittySession } from './lib/tab-setter';
import { readRegistry, writeRegistry, findArtifactPath } from './lib/isa-utils';

const MEMORY_DIR = getMemoryDir();
const STATE_DIR = getStateDir();
const WORK_DIR = getWorkDir();

// Session-scoped state file lookup with legacy fallback
function findStateFile(sessionId?: string): string | null {
  if (sessionId) {
    const scoped = join(STATE_DIR, `current-work-${sessionId}.json`);
    if (existsSync(scoped)) return scoped;
  }
  const legacy = join(STATE_DIR, 'current-work.json');
  if (existsSync(legacy)) return legacy;
  return null;
}

interface CurrentWork {
  session_id: string;
  session_dir: string;
  created_at: string;
  /** Path to the session's Ideal State Artifact (ISA.md, or legacy PRD.md). */
  isa_path?: string;
  /** @deprecated use isa_path. Kept so older state files still parse. */
  prd_path?: string;
  // Legacy fields (backward compat)
  current_task?: string;
  task_title?: string;
  task_count?: number;
}

/**
 * Mark work directory as completed and clear session state
 */
function clearSessionWork(sessionId?: string): void {
  try {
    const stateFile = findStateFile(sessionId);
    if (!stateFile) {
      console.error('[SessionCleanup] No current work to complete');
      return;
    }

    // Read current work state
    const content = readFileSync(stateFile, 'utf-8');
    const currentWork: CurrentWork = JSON.parse(content);

    // Guard: don't process another session's state
    if (sessionId && currentWork.session_id !== sessionId) {
      console.error('[SessionCleanup] State file belongs to different session, skipping');
      return;
    }

    // Mark work directory as COMPLETED — update ISA.md frontmatter (primary,
    // with legacy PRD.md fallback) or META.yaml (legacy)
    if (currentWork.session_dir) {
      const workPath = join(WORK_DIR, currentWork.session_dir);
      const isaPath = findArtifactPath(currentWork.session_dir);
      const metaPath = join(workPath, 'META.yaml');
      let marked = false;

      // Primary: update the ISA frontmatter — set phase: complete (modern format)
      // and status: COMPLETED (legacy compat for any old artifacts still around).
      // findArtifactPath prefers ISA.md and falls back to legacy PRD.md.
      if (isaPath && existsSync(isaPath)) {
        let isaContent = readFileSync(isaPath, 'utf-8');
        isaContent = isaContent.replace(/^phase:.*$/m, 'phase: complete');
        isaContent = isaContent.replace(/^updated:.*$/m, `updated: ${getISOTimestamp()}`);
        isaContent = isaContent.replace(/^status: ACTIVE$/m, 'status: COMPLETED');
        isaContent = isaContent.replace(/^completed_at: null$/m, `completed_at: "${getISOTimestamp()}"`);
        writeFileSync(isaPath, isaContent, 'utf-8');
        marked = true;
      }

      // Legacy fallback: update META.yaml if it exists
      if (existsSync(metaPath)) {
        let metaContent = readFileSync(metaPath, 'utf-8');
        metaContent = metaContent.replace(/^status: "ACTIVE"$/m, 'status: "COMPLETED"');
        metaContent = metaContent.replace(/^completed_at: null$/m, `completed_at: "${getISOTimestamp()}"`);
        writeFileSync(metaPath, metaContent, 'utf-8');
        marked = true;
      }

      if (marked) {
        console.error(`[SessionCleanup] Marked work directory as COMPLETED: ${currentWork.session_dir}`);
      }
    }

    // Mark every work.json entry owned by this session UUID as complete.
    // Without this, native tabs and interrupted algorithms linger as "live"
    // on the agents dashboard until their stale window elapses.
    const endingUUID = sessionId || currentWork.session_id;
    if (endingUUID) {
      try {
        const registry = readRegistry();
        const ts = getISOTimestamp();
        let touched = 0;
        for (const [, session] of Object.entries(registry.sessions) as [string, any][]) {
          if (session.sessionUUID !== endingUUID) continue;
          if (session.phase === 'complete') continue;
          session.phase = 'complete';
          session.updatedAt = ts;
          touched++;
        }
        if (touched > 0) {
          writeRegistry(registry);
          console.error(`[SessionCleanup] Marked ${touched} work.json session(s) complete for UUID ${endingUUID}`);
        }
      } catch (e) {
        console.error(`[SessionCleanup] Failed to mark work.json sessions complete: ${e}`);
      }
    }

    // Delete state file
    unlinkSync(stateFile);
    console.error('[SessionCleanup] Cleared session work state');

    // Clean session-names.json entry to prevent IDLE ghost on activity page
    if (sessionId || currentWork.session_id) {
      const sid = sessionId || currentWork.session_id;
      const snPath = join(STATE_DIR, 'session-names.json');
      try {
        if (existsSync(snPath)) {
          const names = JSON.parse(readFileSync(snPath, 'utf-8'));
          if (names[sid]) {
            delete names[sid];
            writeFileSync(snPath, JSON.stringify(names, null, 2), 'utf-8');
            console.error(`[SessionCleanup] Removed session ${sid} from session-names.json`);
          }
        }
      } catch (e) {
        console.error(`[SessionCleanup] Failed to clean session-names.json: ${e}`);
      }
    }
  } catch (error) {
    console.error(`[SessionCleanup] Error clearing session work: ${error}`);
  }
}

async function main() {
  try {
    // Read input from stdin with timeout — SessionEnd hooks may receive
    // empty or slow stdin. Proceed regardless since state is read from disk.
    let sessionId: string | undefined;
    try {
      const input = await Promise.race([
        Bun.stdin.text(),
        new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
      ]);
      if (input && input.trim()) {
        const parsed = JSON.parse(input);
        sessionId = parsed.session_id;
      }
    } catch {
      // Timeout or parse error — proceed without session_id
    }

    // Mark work as complete and clear state
    clearSessionWork(sessionId);

    // Reset Kitty tab to neutral styling — no lingering colored backgrounds
    try {
      setTabState({ title: '', state: 'idle', sessionId });
      console.error('[SessionCleanup] Tab reset to default styling');
    } catch {
      console.error('[SessionCleanup] Tab reset failed (non-critical)');
    }

    // Clean up per-session kitty env file (prevents unbounded file accumulation)
    if (sessionId) {
      cleanupKittySession(sessionId);
      console.error(`[SessionCleanup] Cleaned up kitty session: ${sessionId}`);
    }

    console.error('[SessionCleanup] Session ended, work marked complete');
    process.exit(0);
  } catch (error) {
    // Silent failure - don't disrupt workflow
    console.error(`[SessionCleanup] SessionEnd hook error: ${error}`);
    process.exit(0);
  }
}

main();
