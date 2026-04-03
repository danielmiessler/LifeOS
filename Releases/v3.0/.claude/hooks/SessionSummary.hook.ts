#!/usr/bin/env bun
// Paperclip agent isolation: skip PAI hooks in Paperclip child processes
if (process.env.PAPERCLIP_AGENT_ID) process.exit(0);
/**
 * SessionSummary.hook.ts - Mark Work Complete and Clear State (SessionEnd)
 *
 * PURPOSE:
 * Finalizes a Claude Code session by marking the current work directory as
 * COMPLETED and clearing the session state. This ensures clean session boundaries
 * and accurate work tracking.
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
 * - Updates: MEMORY/WORK/<dir>/META.yaml (status: COMPLETED, completed_at timestamp)
 * - Deletes: MEMORY/STATE/current-work.json (clears session state)
 * - Resets: Kitty tab title and color to defaults (no lingering colored backgrounds)
 *
 * INTER-HOOK RELATIONSHIPS:
 * - DEPENDS ON: AutoWorkCreation (expects WORK/ structure and current-work.json)
 * - COORDINATES WITH: WorkCompletionLearning (both run at SessionEnd)
 * - MUST RUN BEFORE: None (final cleanup)
 * - MUST RUN AFTER: WorkCompletionLearning (learning capture uses state before clear)
 *
 * STATE TRANSITIONS:
 * - META.yaml status: "ACTIVE" → "COMPLETED"
 * - META.yaml completed_at: null → ISO timestamp
 * - current-work.json: exists → deleted
 *
 * DESIGN NOTES:
 * - Does NOT write to SESSIONS/ directory (WORK/ is the primary tracking system)
 * - Deleting current-work.json signals a clean slate for next session
 *
 * ERROR HANDLING:
 * - No current work: Logs message, exits gracefully
 * - Missing META.yaml: Skips update, continues to state clear
 * - File operation failures: Logged to stderr
 *
 * PERFORMANCE:
 * - Non-blocking: Yes
 * - Typical execution: <50ms
 */

import { writeFileSync, existsSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { getISOTimestamp } from './lib/time';
import { setTabState, cleanupKittySession } from './lib/tab-setter';

const BASE_DIR = process.env.PAI_DIR || join(process.env.HOME!, '.claude');
const MEMORY_DIR = join(BASE_DIR, 'MEMORY');
const STATE_DIR = join(MEMORY_DIR, 'STATE');
const WORK_DIR = join(MEMORY_DIR, 'WORK');

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
  current_task: string;
  task_title: string;
  task_count: number;
  created_at: string;
}

/**
 * Mark work directory as completed and clear session state
 */
function clearSessionWork(sessionId?: string): void {
  try {
    const stateFile = findStateFile(sessionId);
    if (!stateFile) {
      console.error('[SessionSummary] No current work to complete');
      return;
    }

    // Read current work state
    const content = readFileSync(stateFile, 'utf-8');
    const currentWork: CurrentWork = JSON.parse(content);

    // Guard: don't process another session's state
    if (sessionId && currentWork.session_id !== sessionId) {
      console.error('[SessionSummary] State file belongs to different session, skipping');
      return;
    }

    // Mark work directory as COMPLETED
    if (currentWork.session_dir) {
      const metaPath = join(WORK_DIR, currentWork.session_dir, 'META.yaml');
      if (existsSync(metaPath)) {
        let metaContent = readFileSync(metaPath, 'utf-8');
        metaContent = metaContent.replace(/^status: "ACTIVE"$/m, 'status: "COMPLETED"');
        metaContent = metaContent.replace(/^completed_at: null$/m, `completed_at: "${getISOTimestamp()}"`);
        writeFileSync(metaPath, metaContent, 'utf-8');
        console.error(`[SessionSummary] Marked work directory as COMPLETED: ${currentWork.session_dir}`);
      }
    }

    // Delete state file
    unlinkSync(stateFile);
    console.error('[SessionSummary] Cleared session work state');
  } catch (error) {
    console.error(`[SessionSummary] Error clearing session work: ${error}`);
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
    // NOTE: Does NOT write to SESSIONS/ - WORK/ is the primary system
    clearSessionWork(sessionId);

    // Reset Kitty tab to neutral styling — no lingering colored backgrounds
    try {
      setTabState({ title: '', state: 'idle', sessionId });
      console.error('[SessionSummary] Tab reset to default styling');
    } catch {
      console.error('[SessionSummary] Tab reset failed (non-critical)');
    }

    // Clean up per-session kitty env file (prevents unbounded file accumulation)
    if (sessionId) {
      cleanupKittySession(sessionId);
      console.error(`[SessionSummary] Cleaned up kitty session: ${sessionId}`);
    }

    console.error('[SessionSummary] Session ended, work marked complete');
    process.exit(0);
  } catch (error) {
    // Silent failure - don't disrupt workflow
    console.error(`[SessionSummary] SessionEnd hook error: ${error}`);
    process.exit(0);
  }
}

main();
