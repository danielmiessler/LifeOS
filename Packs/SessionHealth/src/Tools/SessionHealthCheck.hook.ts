#!/usr/bin/env bun
/**
 * SessionHealthCheck.hook.ts - Intra-Session Age & Turn Watchdog (UserPromptSubmit)
 *
 * PURPOSE:
 * Monitors session health by tracking age (hours) and turn count.
 * Warns at thresholds to prevent context degradation from overlong sessions.
 * Direct response to 2026-03-17 incident: 28-hour, 1,372-turn session caused
 * measurable output degradation during high-stakes document work.
 *
 * TRIGGER: UserPromptSubmit
 *
 * INPUT:
 * - stdin: { session_id, prompt, transcript_path, hook_event_name }
 *
 * OUTPUT:
 * - stdout: <system-reminder> warning when thresholds exceeded (injected into context)
 * - stderr: Log lines for terminal visibility
 * - exit(0): Always (non-blocking, never fails the hook)
 *
 * SIDE EFFECTS:
 * - Reads: /tmp/pai-session-start.txt (written by LoadContext at SessionStart)
 * - Reads/Writes: /tmp/pai-session-turns.json (turn counter, keyed by session_id)
 *
 * INTER-HOOK RELATIONSHIPS:
 * - DEPENDS ON: LoadContext.hook.ts (writes session start timestamp via recordSessionStart)
 * - COORDINATES WITH: DriftMonRun.hook.ts (complementary — DriftMon is post-session, this is intra-session)
 *
 * ERROR HANDLING:
 * - All errors caught and logged to stderr. Never blocks or fails the session.
 *
 * PERFORMANCE:
 * - Blocking but fast (<20ms). File reads only, no inference.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';

// ── Constants ──

const SESSION_START_FILE = '/tmp/pai-session-start.txt';
const TURN_COUNTER_FILE = '/tmp/pai-session-turns.json';

// Thresholds
const AGE_WARN_HOURS = 8;
const AGE_HARD_WARN_HOURS = 12;
const TURN_WARN = 500;
const TURN_HARD_WARN = 800;

// ── Stdin Reader ──

async function readStdin(): Promise<{ session_id: string; prompt?: string } | null> {
  try {
    const chunks: Buffer[] = [];
    const reader = Bun.stdin.stream().getReader();
    const timeout = new Promise<void>(r => setTimeout(r, 500));
    const read = (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(Buffer.from(value));
      }
    })();
    await Promise.race([read, timeout]);
    const text = Buffer.concat(chunks).toString('utf-8').trim();
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

// ── Session Age ──

function getSessionAgeHours(): number {
  try {
    if (!existsSync(SESSION_START_FILE)) return 0;
    const startMs = parseInt(readFileSync(SESSION_START_FILE, 'utf-8').trim());
    if (isNaN(startMs)) return 0;
    return (Date.now() - startMs) / 1000 / 60 / 60;
  } catch {
    return 0;
  }
}

// ── Turn Counter ──

interface TurnState {
  session_id: string;
  count: number;
}

function incrementTurnCount(sessionId: string): number {
  try {
    let state: TurnState = { session_id: sessionId, count: 0 };

    if (existsSync(TURN_COUNTER_FILE)) {
      const raw = readFileSync(TURN_COUNTER_FILE, 'utf-8').trim();
      const parsed = JSON.parse(raw) as TurnState;
      // Reset if different session
      if (parsed.session_id === sessionId) {
        state = parsed;
      }
    }

    state.session_id = sessionId;
    state.count += 1;
    writeFileSync(TURN_COUNTER_FILE, JSON.stringify(state));
    return state.count;
  } catch {
    return 0;
  }
}

// ── Warning Generation ──

function formatDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ── Main ──

async function main() {
  try {
    const input = await readStdin();
    const sessionId = input?.session_id || 'unknown';

    const ageHours = getSessionAgeHours();
    const turnCount = incrementTurnCount(sessionId);

    const warnings: string[] = [];

    // Age checks
    if (ageHours >= AGE_HARD_WARN_HOURS) {
      warnings.push(
        `🔴 SESSION AGE CRITICAL: ${formatDuration(ageHours)} (limit: ${AGE_HARD_WARN_HOURS}h). ` +
        `This session MUST be closed. Context degradation is occurring. ` +
        `Tell Rob: "This session is ${formatDuration(ageHours)} old. Close it and start fresh before any more work."`
      );
    } else if (ageHours >= AGE_WARN_HOURS) {
      warnings.push(
        `🟡 SESSION AGE WARNING: ${formatDuration(ageHours)} (warning at ${AGE_WARN_HOURS}h, limit: ${AGE_HARD_WARN_HOURS}h). ` +
        `Consider wrapping up and starting a fresh session soon.`
      );
    }

    // Turn count checks
    if (turnCount >= TURN_HARD_WARN) {
      warnings.push(
        `🔴 TURN COUNT CRITICAL: ${turnCount} turns (limit: ${TURN_HARD_WARN}). ` +
        `High context load. Close this session and start fresh.`
      );
    } else if (turnCount >= TURN_WARN) {
      warnings.push(
        `🟡 TURN COUNT WARNING: ${turnCount} turns (warning at ${TURN_WARN}, limit: ${TURN_HARD_WARN}). ` +
        `Context load is building. Consider a fresh session for complex work.`
      );
    }

    // Output warnings to stdout (injected into Claude's context)
    if (warnings.length > 0) {
      const block = [
        '<system-reminder>',
        '⚠️ SESSION HEALTH CHECK',
        ...warnings,
        'Reference: 2026-03-17 incident — 28hr/1372-turn session caused context collapse during deadline work.',
        '</system-reminder>',
      ].join('\n');

      console.log(block);
      console.error(`[SessionHealthCheck] Warnings fired: age=${formatDuration(ageHours)}, turns=${turnCount}`);
    } else {
      // Periodic status to stderr (every 100 turns)
      if (turnCount % 100 === 0) {
        console.error(`[SessionHealthCheck] Status: age=${formatDuration(ageHours)}, turns=${turnCount} — healthy`);
      }
    }
  } catch (err) {
    console.error(`[SessionHealthCheck] Error: ${err}`);
  }

  process.exit(0);
}

main();
