#!/usr/bin/env bun
/**
 * ConfigAudit.hook.ts - ConfigChange Event Logger
 *
 * PURPOSE:
 * Security audit trail for configuration changes. Logs what changed, when,
 * and in which session. Uses file-diff against a cached snapshot to detect
 * which top-level keys actually changed (the event stdin doesn't provide this).
 *
 * TRIGGER: ConfigChange (command-only event)
 *
 * OUTPUTS:
 * - MEMORY/OBSERVABILITY/config-changes.jsonl (structured audit log)
 * - stderr logging for hook diagnostics
 *
 * PERFORMANCE: <30ms (file read + diff + append)
 */

import { existsSync, mkdirSync, appendFileSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { paiPath, getSettingsPath } from './lib/paths';
import { getISOTimestamp } from './lib/time';

interface ConfigChangeInput {
  session_id: string;
  transcript_path: string;
  hook_event_name: string;
  config_path?: string;
  config_key?: string;
  old_value?: unknown;
  new_value?: unknown;
}

interface ConfigChangeEvent {
  timestamp: string;
  event: 'config_change';
  session_id: string;
  config_path: string;
  config_key: string;
  change_summary: string;
}

const OBS_DIR = paiPath('MEMORY', 'OBSERVABILITY');
const AUDIT_FILE = join(OBS_DIR, 'config-changes.jsonl');
const SNAPSHOT_PATH = '/tmp/pai-settings-snapshot.json';

// Sensitive keys that warrant extra logging
const SENSITIVE_KEYS = new Set([
  'permissions', 'hooks', 'env', 'mcpServers',
  'permissions.allow', 'permissions.deny', 'permissions.ask',
]);

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    const timer = setTimeout(() => resolve(data), 2000);
    process.stdin.on('data', (chunk) => { data += chunk.toString(); });
    process.stdin.on('end', () => { clearTimeout(timer); resolve(data); });
    process.stdin.on('error', () => { clearTimeout(timer); resolve(data); });
  });
}

/**
 * Diff current settings.json against cached snapshot.
 * Returns array of top-level keys that changed, plus a summary string.
 */
function diffSettings(): { changedKeys: string[]; summary: string } {
  const settingsPath = getSettingsPath();
  let current: Record<string, unknown> = {};
  let snapshot: Record<string, unknown> = {};

  try {
    current = JSON.parse(readFileSync(settingsPath, 'utf-8'));
  } catch {
    return { changedKeys: ['settings.json'], summary: 'could not read settings.json' };
  }

  try {
    if (existsSync(SNAPSHOT_PATH)) {
      snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf-8'));
    }
  } catch {
    // No snapshot or corrupt — treat everything as new
  }

  // Save new snapshot for next comparison
  try {
    writeFileSync(SNAPSHOT_PATH, JSON.stringify(current), 'utf-8');
  } catch {
    // Non-fatal
  }

  // If no prior snapshot, we can't diff
  if (Object.keys(snapshot).length === 0) {
    return { changedKeys: ['initial'], summary: 'initial snapshot (no prior to diff)' };
  }

  // Compare top-level keys
  const allKeys = new Set([...Object.keys(current), ...Object.keys(snapshot)]);
  const changed: string[] = [];
  const summaryParts: string[] = [];

  for (const key of allKeys) {
    const curVal = JSON.stringify(current[key]);
    const snapVal = JSON.stringify(snapshot[key]);

    if (curVal !== snapVal) {
      changed.push(key);

      if (!(key in snapshot)) {
        summaryParts.push(`${key}: added`);
      } else if (!(key in current)) {
        summaryParts.push(`${key}: removed`);
      } else {
        // For arrays/objects, try to show what changed at second level
        if (typeof current[key] === 'object' && current[key] && typeof snapshot[key] === 'object' && snapshot[key]) {
          const curObj = current[key] as Record<string, unknown>;
          const snapObj = snapshot[key] as Record<string, unknown>;
          const subKeys = new Set([...Object.keys(curObj), ...Object.keys(snapObj)]);
          const subChanged: string[] = [];
          for (const sk of subKeys) {
            if (JSON.stringify(curObj[sk]) !== JSON.stringify(snapObj[sk])) {
              subChanged.push(sk);
            }
          }
          if (subChanged.length <= 3) {
            summaryParts.push(`${key}.{${subChanged.join(',')}}: modified`);
          } else {
            summaryParts.push(`${key}: ${subChanged.length} sub-keys modified`);
          }
        } else {
          const newStr = JSON.stringify(current[key]).slice(0, 80);
          summaryParts.push(`${key}: → ${newStr}`);
        }
      }
    }
  }

  if (changed.length === 0) {
    return { changedKeys: ['unchanged'], summary: 'no diff detected (possible race)' };
  }

  return { changedKeys: changed, summary: summaryParts.join('; ') };
}

async function main() {
  try {
    const input = await readStdin();
    if (!input.trim()) { process.exit(0); }

    const data: ConfigChangeInput = JSON.parse(input);

    // Use file-diff to determine what actually changed
    const { changedKeys, summary } = diffSettings();
    const configKey = changedKeys.join(',');
    const isSensitive = changedKeys.some(k => SENSITIVE_KEYS.has(k));

    const event: ConfigChangeEvent = {
      timestamp: getISOTimestamp(),
      event: 'config_change',
      session_id: data.session_id,
      config_path: data.config_path || 'settings.json',
      config_key: configKey,
      change_summary: summary,
    };

    if (!existsSync(OBS_DIR)) mkdirSync(OBS_DIR, { recursive: true });
    appendFileSync(AUDIT_FILE, JSON.stringify(event) + '\n', 'utf-8');

    const sensitivity = isSensitive ? ' [SENSITIVE]' : '';
    console.error(`[ConfigAudit] Logged: ${configKey}${sensitivity} — ${summary}`);
  } catch (err) {
    console.error(`[ConfigAudit] Error: ${err}`);
  }
  process.exit(0);
}

main();
