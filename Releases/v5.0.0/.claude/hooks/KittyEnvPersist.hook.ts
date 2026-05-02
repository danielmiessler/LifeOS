#!/usr/bin/env bun
/**
 * KittyEnvPersist.hook.ts - Kitty terminal env persistence + tab reset (SessionStart)
 *
 * PURPOSE:
 * Persists Kitty terminal environment variables (KITTY_LISTEN_ON, KITTY_WINDOW_ID)
 * to disk so hooks running later (without terminal context) can control tabs.
 * Also resets tab title to clean state at session start.
 *
 * TRIGGER: SessionStart
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { getPaiDir } from './lib/paths';
import { setTabState, readTabState, persistKittySession } from './lib/tab-setter';
import { getDAName } from './lib/identity';

const paiDir = getPaiDir();

// Skip for subagents
const claudeProjectDir = process.env.CLAUDE_PROJECT_DIR || '';
const isSubagent = claudeProjectDir.includes('/.claude/Agents/') ||
                  process.env.CLAUDE_AGENT_TYPE !== undefined;
if (isSubagent) process.exit(0);

// Read session_id + source from stdin (SessionStart hook input)
// source ∈ {"startup", "resume", "compact", "clear"}; absent on older CC versions.
let sessionId = '';
let source = '';
try {
  const raw = readFileSync(0, 'utf-8');
  if (raw) {
    const parsed = JSON.parse(raw);
    sessionId = String(parsed.session_id || '');
    source = String(parsed.source || '');
  }
} catch { /* best-effort */ }

// Persist Kitty environment for hooks that run later without terminal context
const kittyListenOn = process.env.KITTY_LISTEN_ON;
const kittyWindowId = process.env.KITTY_WINDOW_ID;
if (kittyListenOn && kittyWindowId) {
  const stateDir = join(paiDir, 'MEMORY', 'STATE');
  if (!existsSync(stateDir)) mkdirSync(stateDir, { recursive: true });
  writeFileSync(
    join(stateDir, 'kitty-env.json'),
    JSON.stringify({ KITTY_LISTEN_ON: kittyListenOn, KITTY_WINDOW_ID: kittyWindowId }, null, 2)
  );
  // Per-session file — required by out-of-process consumers (Pulse voice daemon) that
  // can't inherit KITTY_* env vars but have session_id. See hooks/lib/tab-setter.ts.
  if (sessionId) persistKittySession(sessionId, kittyListenOn, kittyWindowId);
}

// Reset tab title to clean state — prevents stale titles bleeding through when a
// kitty window is reused for a brand-new Claude session. Only `source: "compact"`
// is the same running session continuing; every other source (startup, resume,
// clear, or missing) is a distinct session and MUST drop the prior title so
// SessionAnalysis can rebuild it from THIS session's own name.
try {
  if (source === 'compact') {
    const current = readTabState(sessionId);
    if (current && (current.state === 'working' || current.state === 'thinking')) {
      console.error(`🔄 Tab in ${current.state} state — preserving title through compaction`);
    } else {
      setTabState({ title: `${getDAName()} ready…`, state: 'idle', sessionId });
      console.error('🔄 Tab title reset to clean state (post-compact, no live work)');
    }
  } else {
    setTabState({ title: `${getDAName()} ready…`, state: 'idle', sessionId });
    console.error(`🔄 Tab title reset for new session (source=${source || 'unspecified'})`);
  }
} catch (err) {
  console.error(`⚠️ Failed to reset tab title: ${err}`);
}

process.exit(0);
