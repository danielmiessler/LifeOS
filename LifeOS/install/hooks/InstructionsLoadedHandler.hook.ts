#!/usr/bin/env bun
/**
 * InstructionsLoadedHandler.hook.ts - LifeOS Instruction Integrity Audit (InstructionsLoaded)
 *
 * Computes SHA-256 hashes of critical LifeOS instruction files and compares against
 * stored known-good baselines. Logs any changes for audit trail. Read-only — never
 * blocks session start.
 *
 * TRIGGER: InstructionsLoaded (fires when CLAUDE.md and rules files are loaded)
 *
 * INPUT:
 * - event: Loaded instruction details (from stdin JSON)
 *
 * OUTPUT:
 * - No stdout (read-only audit hook, no additionalContext)
 * - Always exits 0 (never blocks session start)
 *
 * SIDE EFFECTS:
 * - Creates/updates: MEMORY/STATE/instruction-hashes.json (baseline hashes)
 * - Appends to: MEMORY/STATE/instruction-integrity.jsonl (change log)
 *
 * PERFORMANCE: <20ms typical. Non-blocking.
 */

import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Normalize env path vars that Claude Code injects without shell expansion (LifeOS#1404)
for (const k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const v = process.env[k];
  if (v && /^\$\{?HOME\}?(\/|$)/.test(v)) process.env[k] = v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}


// ========================================
// Configuration
// ========================================

const HOME = homedir();
const LIFEOS_DIR = process.env.LIFEOS_DIR || join(HOME, '.claude', 'LIFEOS');
const STATE_DIR = join(LIFEOS_DIR, 'MEMORY', 'STATE');
const HASHES_FILE = join(STATE_DIR, 'instruction-hashes.json');
const INTEGRITY_LOG = join(STATE_DIR, 'instruction-integrity.jsonl');

/** Critical LifeOS instruction files to monitor */
const CRITICAL_FILES: Record<string, string> = {
  'CLAUDE.md': join(HOME, '.claude', 'CLAUDE.md'),
  'SYSTEM-PROMPT': join(LIFEOS_DIR, 'LIFEOS_SYSTEM_PROMPT.md'),
  'DA_IDENTITY': join(LIFEOS_DIR, 'USER', 'DA_IDENTITY.md'),
  'PRINCIPAL_IDENTITY': join(LIFEOS_DIR, 'USER', 'PRINCIPAL_IDENTITY.md'),
};

// ========================================
// Types
// ========================================

interface StoredHashes {
  created: string;
  updated: string;
  hashes: Record<string, string>;
}

interface IntegrityLogEntry {
  timestamp: string;
  event: 'hash_changed' | 'file_missing' | 'baseline_created';
  file: string;
  path: string;
  old_hash?: string;
  new_hash?: string;
  message?: string;
}

// ========================================
// Hashing
// ========================================

async function hashFile(path: string): Promise<string | null> {
  try {
    const file = Bun.file(path);
    if (!await file.exists()) return null;
    const content = await file.arrayBuffer();
    const hasher = new Bun.CryptoHasher('sha256');
    hasher.update(new Uint8Array(content));
    return hasher.digest('hex');
  } catch {
    return null;
  }
}

// ========================================
// State Management
// ========================================

async function loadStoredHashes(): Promise<StoredHashes | null> {
  try {
    const file = Bun.file(HASHES_FILE);
    if (!await file.exists()) return null;
    return await file.json() as StoredHashes;
  } catch {
    return null;
  }
}

async function saveHashes(hashes: Record<string, string>): Promise<void> {
  if (!existsSync(STATE_DIR)) {
    mkdirSync(STATE_DIR, { recursive: true });
  }
  const now = new Date().toISOString();
  const stored = await loadStoredHashes();
  const data: StoredHashes = {
    created: stored?.created || now,
    updated: now,
    hashes,
  };
  await Bun.write(HASHES_FILE, JSON.stringify(data, null, 2) + '\n');
}

async function appendIntegrityLog(entry: IntegrityLogEntry): Promise<void> {
  if (!existsSync(STATE_DIR)) {
    mkdirSync(STATE_DIR, { recursive: true });
  }
  const file = Bun.file(INTEGRITY_LOG);
  const existing = await file.exists() ? await file.text() : '';
  await Bun.write(INTEGRITY_LOG, existing + JSON.stringify(entry) + '\n');
}

// ========================================
// Main
// ========================================

async function main(): Promise<void> {
  // Read and discard stdin (hook contract requires consuming it)
  try {
    const reader = Bun.stdin.stream().getReader();
    const readLoop = (async () => {
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
    })();
    // Capture the timer so it can be cleared after Promise.race resolves.
    // Without the clear, the orphan setTimeout keeps the process alive for
    // the full 200ms on every Bash/Read/Edit/Write tool call — ~1.1s of
    // accumulated drag per turn (tzioup/americo_80329 finding).
    let stdinTimer: ReturnType<typeof setTimeout> | undefined;
    const stdinTimeout = new Promise<void>(r => { stdinTimer = setTimeout(r, 200); });
    try {
      await Promise.race([readLoop, stdinTimeout]);
    } finally {
      if (stdinTimer) clearTimeout(stdinTimer);
    }
  } catch {
    // Stdin read failure is fine — we only need to audit files
  }

  const now = new Date().toISOString();

  // Compute current hashes for all critical files
  const currentHashes: Record<string, string> = {};
  const missingFiles: string[] = [];

  for (const [label, path] of Object.entries(CRITICAL_FILES)) {
    const hash = await hashFile(path);
    if (hash) {
      currentHashes[label] = hash;
    } else {
      missingFiles.push(label);
    }
  }

  // Load stored baseline
  const stored = await loadStoredHashes();

  if (!stored) {
    // First run — create baseline
    await saveHashes(currentHashes);
    await appendIntegrityLog({
      timestamp: now,
      event: 'baseline_created',
      file: '*',
      path: HASHES_FILE,
      message: `Baseline created with ${Object.keys(currentHashes).length} files`,
    });
    process.exit(0);
    return;
  }

  // Compare against stored hashes
  let changed = false;

  for (const [label, path] of Object.entries(CRITICAL_FILES)) {
    const oldHash = stored.hashes[label];
    const newHash = currentHashes[label];

    if (oldHash && !newHash) {
      // File was present before but is now missing
      await appendIntegrityLog({
        timestamp: now,
        event: 'file_missing',
        file: label,
        path,
        old_hash: oldHash,
        message: `WARNING: Critical file missing — was previously tracked`,
      });
      changed = true;
    } else if (oldHash && newHash && oldHash !== newHash) {
      // Hash changed
      await appendIntegrityLog({
        timestamp: now,
        event: 'hash_changed',
        file: label,
        path,
        old_hash: oldHash,
        new_hash: newHash,
      });
      changed = true;
    }
    // New file appearing (no oldHash, has newHash) — just add to baseline silently
  }

  // Update stored hashes if anything changed or new files appeared
  if (changed || Object.keys(currentHashes).length !== Object.keys(stored.hashes).length) {
    await saveHashes(currentHashes);
  }

  process.exit(0);
}

main().catch(() => process.exit(0));
