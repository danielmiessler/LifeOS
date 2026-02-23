/**
 * SystemIntegrity.ts - Automatic system integrity maintenance handler
 *
 * Detects PAI system changes from the transcript and spawns background
 * IntegrityMaintenance.ts to update references and document changes.
 *
 * TRIGGER: Stop hook (via StopOrchestrator)
 *
 * SIDE EFFECTS:
 * - Spawns background IntegrityMaintenance.ts process
 * - Updates MEMORY/STATE/integrity-state.json
 *
 * THROTTLING:
 * - 5-minute cooldown between runs
 * - Deduplicates identical change sets
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { spawn } from 'child_process';
import { join } from 'path';
import { paiPath } from '../lib/paths';
import {
  parseToolUseBlocks,
  isSignificantChange,
  isInCooldown,
  isDuplicateRun,
  hashChanges,
  getCooldownEndTime,
  determineSignificance,
  inferChangeType,
  generateDescriptiveTitle,
  type FileChange,
} from '../lib/change-detection';
import type { ParsedTranscript } from '../../skills/PAI/Tools/TranscriptParser';

interface HookInput {
  session_id: string;
  transcript_path: string;
  hook_event_name: string;
}

const STATE_DIR = paiPath('MEMORY', 'STATE');
const STATE_FILE = join(STATE_DIR, 'integrity-state.json');
const INTEGRITY_SCRIPT = paiPath('skills', 'PAI', 'Tools', 'IntegrityMaintenance.ts');


/**
 * Update the integrity state file.
 */
function updateIntegrityState(changes: FileChange[]): void {
  try {
    if (!existsSync(STATE_DIR)) {
      mkdirSync(STATE_DIR, { recursive: true });
    }

    const state = {
      last_run: new Date().toISOString(),
      last_changes_hash: hashChanges(changes),
      cooldown_until: getCooldownEndTime(),
    };

    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    console.error('[SystemIntegrity] Updated state file');
  } catch (error) {
    console.error('[SystemIntegrity] Failed to update state:', error);
  }
}

/**
 * Spawn the IntegrityMaintenance script in the background.
 */
function spawnIntegrityMaintenance(
  changes: FileChange[],
  hookInput: HookInput
): void {
  try {
    // Check if script exists
    if (!existsSync(INTEGRITY_SCRIPT)) {
      console.error('[SystemIntegrity] IntegrityMaintenance.ts not found:', INTEGRITY_SCRIPT);
      return;
    }

    // Pre-compute title and metadata for logging
    const filteredChanges = changes.filter(c => c.category !== null);
    const title = generateDescriptiveTitle(filteredChanges);
    const significance = determineSignificance(filteredChanges);
    const changeType = inferChangeType(filteredChanges);

    console.error(`[SystemIntegrity] Title: ${title}`);
    console.error(`[SystemIntegrity] Significance: ${significance}`);
    console.error(`[SystemIntegrity] Change type: ${changeType}`);

    // Prepare input data
    const inputData = JSON.stringify({
      session_id: hookInput.session_id,
      transcript_path: hookInput.transcript_path,
      changes: filteredChanges.map(c => ({
        tool: c.tool,
        path: c.path,
        category: c.category,
        isPhilosophical: c.isPhilosophical,
        isStructural: c.isStructural,
      })),
    });

    // Spawn detached process
    const child = spawn('bun', [INTEGRITY_SCRIPT], {
      detached: true,
      stdio: ['pipe', 'ignore', 'inherit'],  // stdin for input, ignore stdout, inherit stderr for logging
      env: { ...process.env },
    });

    // Write input data to stdin
    child.stdin?.write(inputData);
    child.stdin?.end();

    // Detach from parent
    child.unref();

    console.error(`[SystemIntegrity] Spawned IntegrityMaintenance (pid: ${child.pid})`);
  } catch (error) {
    console.error('[SystemIntegrity] Failed to spawn IntegrityMaintenance:', error);
  }
}

/**
 * Handle system integrity check with pre-parsed transcript data.
 *
 * This handler:
 * 1. Parses the transcript for file modification tool_use blocks
 * 2. Filters for PAI system paths (excludes WORK/, LEARNING/, scratch/)
 * 3. Checks throttle cooldown (max once per 5 min)
 * 4. Spawns background IntegrityMaintenance.ts if changes detected
 */
export async function handleSystemIntegrity(
  parsed: ParsedTranscript,
  hookInput: HookInput
): Promise<void> {
  console.error('[SystemIntegrity] Checking for system changes...');

  // Check cooldown
  if (isInCooldown()) {
    console.error('[SystemIntegrity] In cooldown period, skipping');
    return;
  }

  // Parse changes from transcript
  const changes = parseToolUseBlocks(hookInput.transcript_path);
  console.error(`[SystemIntegrity] Found ${changes.length} file changes in transcript`);

  // Filter to only PAI system changes
  const systemChanges = changes.filter(c => c.category !== null);
  console.error(`[SystemIntegrity] ${systemChanges.length} are PAI system changes`);

  if (systemChanges.length === 0) {
    console.error('[SystemIntegrity] No system changes detected, skipping');
    return;
  }

  // Check if significant
  if (!isSignificantChange(systemChanges)) {
    console.error('[SystemIntegrity] Changes not significant enough, skipping');
    return;
  }

  // Check for duplicate run
  if (isDuplicateRun(changes)) {
    console.error('[SystemIntegrity] Duplicate change set, skipping');
    return;
  }

  // Log what we found
  console.error('[SystemIntegrity] Significant changes detected:');
  for (const change of systemChanges.slice(0, 5)) {
    console.error(`  - [${change.category}] ${change.path}`);
  }
  if (systemChanges.length > 5) {
    console.error(`  ... and ${systemChanges.length - 5} more`);
  }

  // Update state before spawning
  updateIntegrityState(systemChanges);

  // Voice notification removed — the "documenting" message from IntegrityMaintenance
  // already implies the check happened. No need for a separate "checking" announcement.

  // Spawn background process
  spawnIntegrityMaintenance(systemChanges, hookInput);

  console.error('[SystemIntegrity] Background integrity check started');
}
