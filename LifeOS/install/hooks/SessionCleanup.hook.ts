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
 * - Files: MEMORY/STATE/work.json (canonical session registry)
 *
 * OUTPUT:
 * - stdout: None
 * - stderr: Status messages
 * - exit(0): Always (non-blocking)
 *
 * SIDE EFFECTS:
 * - Updates: MEMORY/WORK/<slug>/ISA.md (or legacy PRD.md) or META.yaml (status: COMPLETED)
 * - Marks ALL work.json rows owned by this session UUID as phase=complete
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

import { writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { getISOTimestamp } from './lib/time';
import { setTabState, cleanupKittySession } from './lib/tab-setter';
import { readRegistry, writeRegistry, findArtifactPath, findActiveSessionByUUID } from './lib/isa-utils';

// Normalize env path vars that Claude Code injects without shell expansion (LifeOS#1404)
for (const k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const v = process.env[k];
  if (v && /^\$\{?HOME\}?(\/|$)/.test(v)) process.env[k] = v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}


const BASE_DIR = process.env.LIFEOS_DIR || join(process.env.HOME!, '.claude', 'LIFEOS');
const MEMORY_DIR = join(BASE_DIR, 'MEMORY');
const STATE_DIR = join(MEMORY_DIR, 'STATE');
const WORK_DIR = join(MEMORY_DIR, 'WORK');

/**
 * Mark active work as completed.
 *
 * Active work is resolved by sessionUUID against MEMORY/STATE/work.json
 * (the canonical session registry). Updates the ISA frontmatter
 * (or legacy META.yaml) for the resolved slug, then marks every work.json
 * row owned by this UUID as phase=complete so dashboards close the row.
 */
function clearSessionWork(sessionId?: string): void {
  try {
    // Resolve the active session row for this hook UUID. If none, there is
    // nothing to mark — most native sessions hit this path on harness exit.
    const active = sessionId ? findActiveSessionByUUID(sessionId) : null;

    if (active) {
      const slug = active.slug;
      const workPath = join(WORK_DIR, slug);
      const isaPath = findArtifactPath(slug);
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
        console.error(`[SessionCleanup] Marked work directory as COMPLETED: ${slug}`);
      }
    } else if (sessionId) {
      console.error(`[SessionCleanup] No active work session for sessionId=${sessionId}`);
    } else {
      console.error('[SessionCleanup] No session_id from hook input — nothing to mark');
    }

    // Mark every work.json entry owned by this session UUID as complete.
    // Without this, native tabs and interrupted algorithms linger as "live"
    // on the agents dashboard until their stale window elapses.
    if (sessionId) {
      try {
        const registry = readRegistry();
        // work.json updatedAt must be UTC toISOString() like every other writer.
        // getISOTimestamp() emits local "-07:00" format, which corrupts string
        // sorts in readers (statusline MODE picker) against Z-format rows.
        const ts = new Date().toISOString();
        let touched = 0;
        for (const [, session] of Object.entries(registry.sessions) as [string, any][]) {
          if (session.sessionUUID !== sessionId) continue;
          if (session.phase === 'complete') continue;
          session.phase = 'complete';
          session.updatedAt = ts;
          touched++;
        }
        if (touched > 0) {
          writeRegistry(registry);
          console.error(`[SessionCleanup] Marked ${touched} work.json session(s) complete for UUID ${sessionId}`);
        }
      } catch (e) {
        console.error(`[SessionCleanup] Failed to mark work.json sessions complete: ${e}`);
      }
    }

    // Clean session-names.json entry to prevent IDLE ghost on activity page
    if (sessionId) {
      const snPath = join(STATE_DIR, 'session-names.json');
      try {
        if (existsSync(snPath)) {
          const names = JSON.parse(readFileSync(snPath, 'utf-8'));
          if (names[sessionId]) {
            delete names[sessionId];
            writeFileSync(snPath, JSON.stringify(names, null, 2), 'utf-8');
            console.error(`[SessionCleanup] Removed session ${sessionId} from session-names.json`);
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
