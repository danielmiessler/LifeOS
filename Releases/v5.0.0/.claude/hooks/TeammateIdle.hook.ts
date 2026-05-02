#!/usr/bin/env bun
/**
 * TeammateIdle.hook.ts - Teammate Idle Event Logger
 *
 * PURPOSE:
 * Logs when agent team members go idle for observability.
 * Does NOT block or redirect — pure logging.
 * Future: could implement reassignment logic for specific team patterns.
 *
 * TRIGGER: TeammateIdle (fires when an agent team member becomes idle)
 *
 * OUTPUTS:
 * - MEMORY/OBSERVABILITY/teammate-events.jsonl (structured event log)
 *
 * PERFORMANCE: <10ms (file append only, no inference)
 */

import { existsSync, mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';
import { paiPath } from './lib/paths';
import { getISOTimestamp } from './lib/time';

interface TeammateIdleInput {
  session_id: string;
  transcript_path: string;
  cwd: string;
  permission_mode: string;
  hook_event_name: string;
  teammate_name: string;
  team_name: string;
}

const OBS_DIR = paiPath('MEMORY', 'OBSERVABILITY');
const LOG_FILE = join(OBS_DIR, 'teammate-events.jsonl');

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    const timer = setTimeout(() => resolve(data), 2000);
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => { clearTimeout(timer); resolve(data); });
  });
}

async function main() {
  try {
    const raw = await readStdin();
    if (!raw.trim()) process.exit(0);

    const input: TeammateIdleInput = JSON.parse(raw);

    if (!existsSync(OBS_DIR)) mkdirSync(OBS_DIR, { recursive: true });

    const event = {
      timestamp: getISOTimestamp(),
      event: 'teammate_idle',
      session_id: input.session_id,
      teammate_name: input.teammate_name,
      team_name: input.team_name,
    };

    appendFileSync(LOG_FILE, JSON.stringify(event) + '\n');
  } catch {
    // Silently exit — never block agent teams
  }

  process.exit(0);
}

main();
