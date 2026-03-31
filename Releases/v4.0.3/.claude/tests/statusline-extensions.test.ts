#!/usr/bin/env bun
/**
 * statusline-extensions.test.ts — Tests for statusline user extensions architecture
 *
 * Tests the extension contract, NOT any specific extension content.
 * Uses a mock extensions.sh that exercises the prefetch → source → display pipeline.
 *
 * Run: bun test tests/statusline-extensions.test.ts
 */

import { describe, test, expect, beforeAll, beforeEach, afterAll, afterEach } from 'bun:test';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { $ } from 'bun';

const PAI_DIR = process.env.PAI_DIR || join(process.env.HOME!, '.claude');
const EXTENSIONS_DIR = join(PAI_DIR, 'PAI/USER/STATUSLINE');
const EXTENSIONS_PATH = join(EXTENSIONS_DIR, 'extensions.sh');
const STATUSLINE_PATH = join(PAI_DIR, 'statusline-command.sh');
const HOOK_PATH = join(PAI_DIR, 'hooks/StatuslineExtensions.hook.ts');

// ─── Mock extension for testing ─────────────────────────────────────────────

const MOCK_EXTENSION = `#!/bin/bash
# Mock extension for testing the architecture contract

MOCK_ICON='\\033[38;2;100;200;100m'

user_statusline_prefetch() {
    local tmp_dir="\$1"
    echo -e "mock_value=42\\nmock_label='test'" > "\$tmp_dir/user-ext.sh"
}

user_statusline_display() {
    local val=\${mock_value:-0}
    [ "\$val" -eq 0 ] && return
    case "\$MODE" in
        nano)       printf "\${MOCK_ICON}T\${RESET} \${val}\\n" ;;
        micro)      printf "\${MOCK_ICON}T\${RESET} TEST: \${val}\\n" ;;
        mini|normal) printf "\${MOCK_ICON}T\${RESET} TEST: \${val} \${mock_label}\\n" ;;
    esac
}
`;

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Run a bash snippet that sources the mock extension with statusline stubs */
async function runWithMockExtension(script: string, env: Record<string, string> = {}): Promise<string> {
  const fullScript = `
    set -e
    export PAI_DIR="${PAI_DIR}"
    get_mtime() { stat -c %Y "$1" 2>/dev/null || stat -f %m "$1" 2>/dev/null || echo 0; }
    get_usage_color() { echo '\\033[38;2;74;222;128m'; }
    RESET='\\033[0m'
    SLATE_500='\\033[38;2;100;116;139m'
    SLATE_600='\\033[38;2;71;85;105m'
    USAGE_RESET='\\033[38;2;148;163;184m'
    USER_TZ="UTC"
    MODE="${env.MODE || 'normal'}"
    source "${EXTENSIONS_PATH}"
    ${script}
  `;
  return await $`bash -c ${fullScript}`.env({ ...process.env, ...env, PAI_DIR }).text();
}

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'pai-test-'));
}

// ─── Setup: swap in mock extension ──────────────────────────────────────────

let realExtensionBackup: string | null = null;

beforeAll(() => {
  if (existsSync(EXTENSIONS_PATH)) {
    realExtensionBackup = readFileSync(EXTENSIONS_PATH, 'utf-8');
  }
  mkdirSync(EXTENSIONS_DIR, { recursive: true });
  writeFileSync(EXTENSIONS_PATH, MOCK_EXTENSION);
});

afterAll(() => {
  if (realExtensionBackup !== null) {
    writeFileSync(EXTENSIONS_PATH, realExtensionBackup);
  } else {
    rmSync(EXTENSIONS_PATH, { force: true });
  }
});

// ─── Test: Extension contract ───────────────────────────────────────────────

describe('extension contract', () => {
  test('extensions file passes bash syntax check', async () => {
    const result = await $`bash -n ${EXTENSIONS_PATH}`.quiet();
    expect(result.exitCode).toBe(0);
  });

  test('defines user_statusline_prefetch function', async () => {
    const output = await runWithMockExtension('type -t user_statusline_prefetch');
    expect(output.trim()).toBe('function');
  });

  test('defines user_statusline_display function', async () => {
    const output = await runWithMockExtension('type -t user_statusline_display');
    expect(output.trim()).toBe('function');
  });
});

// ─── Test: Prefetch → source → display pipeline ────────────────────────────

describe('prefetch writes variables that display reads', () => {
  let tmpDir: string;

  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  test('prefetch creates user-ext.sh with expected variables', async () => {
    await runWithMockExtension(`user_statusline_prefetch "${tmpDir}"`);
    const content = readFileSync(join(tmpDir, 'user-ext.sh'), 'utf-8');
    expect(content).toContain('mock_value=42');
    expect(content).toContain("mock_label='test'");
  });

  test('display produces output when variables are set', async () => {
    const output = await runWithMockExtension(`
      mock_value=42
      mock_label='test'
      user_statusline_display
    `);
    const plain = output.replace(/\x1b\[[0-9;]*m/g, '');
    expect(plain).toContain('42');
    expect(plain).toContain('TEST:');
  });

  test('display produces no output when variables are zeroed', async () => {
    const output = await runWithMockExtension(`
      mock_value=0
      user_statusline_display
    `);
    expect(output.trim()).toBe('');
  });

  test('full pipeline: prefetch → source → display', async () => {
    // Simulates what statusline-command.sh does
    const output = await runWithMockExtension(`
      user_statusline_prefetch "${tmpDir}"
      source "${tmpDir}/user-ext.sh"
      user_statusline_display
    `);
    const plain = output.replace(/\x1b\[[0-9;]*m/g, '');
    expect(plain).toContain('42');
  });
});

// ─── Test: Display respects MODE ────────────────────────────────────────────

describe('display adapts to terminal mode', () => {
  const vars = 'mock_value=42; mock_label="test"';

  test('nano mode produces compact output', async () => {
    const output = await runWithMockExtension(`${vars}; user_statusline_display`, { MODE: 'nano' });
    const plain = output.replace(/\x1b\[[0-9;]*m/g, '');
    expect(plain).toContain('42');
    expect(plain).not.toContain('TEST:');
  });

  test('micro mode includes label', async () => {
    const output = await runWithMockExtension(`${vars}; user_statusline_display`, { MODE: 'micro' });
    const plain = output.replace(/\x1b\[[0-9;]*m/g, '');
    expect(plain).toContain('TEST:');
  });

  test('normal mode includes full detail', async () => {
    const output = await runWithMockExtension(`${vars}; user_statusline_display`, { MODE: 'normal' });
    const plain = output.replace(/\x1b\[[0-9;]*m/g, '');
    expect(plain).toContain('TEST:');
    expect(plain).toContain('test');
  });
});

// ─── Test: statusline-command.sh wiring ─────────────────────────────────────

describe('statusline-command.sh has extension wiring', () => {
  let content: string;

  beforeAll(() => {
    content = readFileSync(STATUSLINE_PATH, 'utf-8');
  });

  test('sources the extensions file', () => {
    expect(content).toContain('_USER_EXTENSIONS=');
    expect(content).toContain('extensions.sh');
  });

  test('calls prefetch in the parallel block', () => {
    expect(content).toContain('user_statusline_prefetch');
    // Verify it runs in background (subshell with &)
    const prefetchLine = content.split('\n').find(l => l.includes('user_statusline_prefetch'));
    expect(prefetchLine).toContain('&');
  });

  test('sources user-ext.sh from parallel results', () => {
    expect(content).toContain('user-ext.sh');
  });

  test('calls display function', () => {
    expect(content).toContain('user_statusline_display');
  });

  test('prefetch guard checks function exists before calling', () => {
    const prefetchLine = content.split('\n').find(l => l.includes('user_statusline_prefetch'));
    expect(prefetchLine).toContain('type -t');
  });

  test('display guard checks function exists before calling', () => {
    const displayLine = content.split('\n').find(l =>
      l.includes('user_statusline_display') && l.includes('type -t')
    );
    expect(displayLine).toBeDefined();
  });

  test('extension source is conditional on file existence', () => {
    expect(content).toContain('[ -f "$_USER_EXTENSIONS" ]');
  });
});

// ─── Test: Self-healing hook ────────────────────────────────────────────────

describe('StatuslineExtensions.hook.ts', () => {
  let backupContent: string;
  let strippedContent: string;

  beforeEach(() => {
    backupContent = readFileSync(STATUSLINE_PATH, 'utf-8');
    // Strip all extension markers to simulate a fresh upgrade
    strippedContent = backupContent
      .split('\n')
      .filter(line =>
        !line.includes('_USER_EXTENSIONS') &&
        !line.includes('user_statusline_prefetch') &&
        !line.includes('user_statusline_display') &&
        !line.includes('user-ext.sh') &&
        !line.includes('Source user statusline') &&
        !line.includes('USER EXTENSIONS')
      )
      .join('\n');
  });

  afterEach(() => {
    writeFileSync(STATUSLINE_PATH, backupContent);
  });

  test('injects all architecture markers into a stripped statusline', async () => {
    writeFileSync(STATUSLINE_PATH, strippedContent);
    await $`bun ${HOOK_PATH}`.env({ ...process.env, PAI_DIR }).quiet();

    const patched = readFileSync(STATUSLINE_PATH, 'utf-8');
    expect(patched).toContain('_USER_EXTENSIONS');
    expect(patched).toContain('user_statusline_prefetch');
    expect(patched).toContain('user_statusline_display');
    expect(patched).toContain('user-ext.sh');
  });

  test('is idempotent — no changes on second run', async () => {
    const before = readFileSync(STATUSLINE_PATH, 'utf-8');
    await $`bun ${HOOK_PATH}`.env({ ...process.env, PAI_DIR }).quiet();

    const after = readFileSync(STATUSLINE_PATH, 'utf-8');
    expect(after).toBe(before);
  });

  test('no-ops when extensions file does not exist', async () => {
    const tempPath = EXTENSIONS_PATH + '.bak';
    await $`mv ${EXTENSIONS_PATH} ${tempPath}`;

    try {
      writeFileSync(STATUSLINE_PATH, strippedContent);
      await $`bun ${HOOK_PATH}`.env({ ...process.env, PAI_DIR }).quiet();

      const content = readFileSync(STATUSLINE_PATH, 'utf-8');
      expect(content).toBe(strippedContent);
    } finally {
      await $`mv ${tempPath} ${EXTENSIONS_PATH}`;
    }
  });

  test('patched statusline passes bash syntax check', async () => {
    writeFileSync(STATUSLINE_PATH, strippedContent);
    await $`bun ${HOOK_PATH}`.env({ ...process.env, PAI_DIR }).quiet();

    const result = await $`bash -n ${STATUSLINE_PATH}`.quiet();
    expect(result.exitCode).toBe(0);
  });
});

// ─── Test: Graceful degradation ─────────────────────────────────────────────

describe('graceful degradation without extensions', () => {
  test('statusline-command.sh syntax is valid even without extensions file', async () => {
    // The source line is conditional, so missing file should be fine
    const result = await $`bash -n ${STATUSLINE_PATH}`.quiet();
    expect(result.exitCode).toBe(0);
  });

  test('prefetch guard does not error when function is undefined', async () => {
    // Simulate what happens if extensions.sh doesn't exist
    const result = await $`bash -c 'type -t user_statusline_prefetch &>/dev/null && echo defined || echo undefined'`.text();
    expect(result.trim()).toBe('undefined');
  });
});
