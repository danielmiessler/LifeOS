#!/usr/bin/env bun
/**
 * SyncIdentityToSettings.ts — Mirror PRINCIPAL_IDENTITY.md frontmatter
 * `preferences` block into settings.json `.preferences`.
 *
 * Source of truth: LIFEOS/USER/PRINCIPAL/PRINCIPAL_IDENTITY.md frontmatter (snake_case)
 * Mirror:         settings.json `.preferences` (camelCase, what consumers read)
 *
 * Consumers that read settings.json `.preferences`:
 *   - LIFEOS_StatusLine.sh  → `.preferences.temperatureUnit`
 *
 * Idempotent: writes only when the mirrored block actually changed.
 *
 * Invocation:
 *   bun LIFEOS/TOOLS/SyncIdentityToSettings.ts          # silent unless changed
 *   bun LIFEOS/TOOLS/SyncIdentityToSettings.ts --verbose
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { paiUserDir } from './LifeosConfig';
import { claudeDir } from "./lifeos-root";

const HOME = homedir();
const PRINCIPAL_PATH = join(paiUserDir(), 'PRINCIPAL/PRINCIPAL_IDENTITY.md');
const SETTINGS_PATH = join(claudeDir(), "settings.json");
const VERBOSE = process.argv.includes('--verbose');

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function parseFrontmatter(text: string): Record<string, any> {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  // Minimal YAML — only what PRINCIPAL_IDENTITY uses (top-level keys + one
  // level of nesting via two-space indent). No arrays, no anchors.
  const out: Record<string, any> = {};
  let currentSection: string | null = null;
  for (const raw of m[1].split('\n')) {
    if (!raw.trim() || raw.trimStart().startsWith('#')) continue;
    const indent = raw.length - raw.trimStart().length;
    const line = raw.trim();
    if (indent === 0) {
      const [k, ...rest] = line.split(':');
      const v = rest.join(':').trim();
      if (v === '') {
        currentSection = k.trim();
        out[currentSection] = {};
      } else {
        currentSection = null;
        out[k.trim()] = v;
      }
    } else if (indent === 2 && currentSection) {
      const [k, ...rest] = line.split(':');
      out[currentSection][k.trim()] = rest.join(':').trim();
    }
  }
  return out;
}

const principalText = readFileSync(PRINCIPAL_PATH, 'utf-8');
const fm = parseFrontmatter(principalText);
const principalPrefs = (fm.preferences ?? {}) as Record<string, string>;

if (Object.keys(principalPrefs).length === 0) {
  if (VERBOSE) console.error('No preferences block in PRINCIPAL_IDENTITY frontmatter — nothing to sync.');
  process.exit(0);
}

const camelPrefs: Record<string, string> = {};
for (const [k, v] of Object.entries(principalPrefs)) {
  camelPrefs[snakeToCamel(k)] = v;
}

const settingsRaw = readFileSync(SETTINGS_PATH, 'utf-8');
const settings = JSON.parse(settingsRaw);
const existing = settings.preferences ?? {};

// Merge: principal-derived keys overwrite, other manual keys preserved.
const merged = { ...existing, ...camelPrefs };
const changed = JSON.stringify(merged) !== JSON.stringify(existing);

if (!changed) {
  if (VERBOSE) console.error('Preferences already in sync.');
  process.exit(0);
}

settings.preferences = merged;
const out = JSON.stringify(settings, null, 2) + '\n';
writeFileSync(SETTINGS_PATH, out);

const summary = Object.entries(camelPrefs)
  .map(([k, v]) => `${k}=${v}`)
  .join(', ');
console.error(`✓ Synced PRINCIPAL_IDENTITY → settings.json preferences: ${summary}`);
