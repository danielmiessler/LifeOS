#!/usr/bin/env bun
/**
 * SettingsBackport.hook.ts — keep direct settings.json edits from being stepped on
 *
 * TRIGGER: PostToolUse (Write, Edit)
 *
 * settings.json is generated at SessionStart by MergeSettings.ts from
 * settings.system.json + settings.user.json. When settings.json itself is
 * edited directly, this hook runs SettingsBackport.ts, which writes the edited
 * values into settings.user.json so the next regeneration preserves them.
 */

import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { homedir } from 'os';
import { join } from 'path';
import { getSettingsPath, paiPath } from './lib/paths';

const SETTINGS_PATH = getSettingsPath();
const BACKPORT = paiPath('TOOLS', 'SettingsBackport.ts');

let input: any;
try {
  input = JSON.parse(readFileSync(0, 'utf-8'));
} catch {
  process.exit(0);
}

const filePath: string = input.tool_input?.file_path || '';

// Only trigger for the generated settings.json itself
if (!filePath) process.exit(0);
if (join(filePath.replace(/^~/, homedir())) !== SETTINGS_PATH) process.exit(0);

try {
  const out = execSync(`bun run ${BACKPORT}`, { timeout: 10000, stdio: 'pipe' }).toString();
  console.error(`🔁 settings.json edit backported to settings.user.json\n${out.trim()}`);
} catch (err: any) {
  const detail = err?.stderr?.toString?.() || String(err);
  console.error(`⚠️ settings backport failed — this edit WILL be overwritten at next SessionStart: ${detail.trim()}`);
}

process.exit(0);
