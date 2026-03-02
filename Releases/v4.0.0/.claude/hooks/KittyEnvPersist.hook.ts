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

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { getPaiDir } from './lib/paths';
import { setTabState, readTabState } from './lib/tab-setter';
import { getDAName } from './lib/identity';

const paiDir = getPaiDir();

// Skip for subagents
const claudeProjectDir = process.env.CLAUDE_PROJECT_DIR || '';
const isSubagent = claudeProjectDir.includes('/.claude/Agents/') ||
                  process.env.CLAUDE_AGENT_TYPE !== undefined;
if (isSubagent) process.exit(0);

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
}

// Reset tab title to clean state — prevents stale titles bleeding through
try {
  const current = readTabState();
  if (current && (current.state === 'working' || current.state === 'thinking')) {
    console.error(`🔄 Tab in ${current.state} state — preserving title through compaction`);
  } else {
    setTabState({ title: `${getDAName()} ready…`, state: 'idle' });
    console.error('🔄 Tab title reset to clean state');
  }
} catch (err) {
  console.error(`⚠️ Failed to reset tab title: ${err}`);
}

process.exit(0);
