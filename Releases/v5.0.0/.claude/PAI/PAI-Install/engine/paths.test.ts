/**
 * Installer Path Resolution — regression tests.
 *
 * Tests the PAI installer's intake of install location via env vars and
 * CLI flags, with precedence: CLI flag > env var > default.
 *
 * Architecture reference: PAI/DOCUMENTATION/PAISystemArchitecture.md "## Directory Structure"
 *
 * Contract symmetry: the installer's resolved values MUST match the runtime
 * lib's `getClaudeDir()` / `getPaiDir()` for the same env, so installer and
 * runtime agree on where things live.
 *
 * Run: bun test PAI/PAI-Install/engine/paths.test.ts
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { homedir } from 'os';
import { join } from 'path';

import { resolveInstallPaths } from './paths';
import { detectSystem } from './detect';
import { getClaudeDir, getPaiDir } from '../../lib/paths';

const HOME = homedir();

let saved: { CLAUDE_CONFIG_DIR?: string; PAI_DIR?: string };

beforeEach(() => {
  saved = {
    CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR,
    PAI_DIR: process.env.PAI_DIR,
  };
  delete process.env.CLAUDE_CONFIG_DIR;
  delete process.env.PAI_DIR;
});
afterEach(() => {
  if (saved.CLAUDE_CONFIG_DIR === undefined) delete process.env.CLAUDE_CONFIG_DIR;
  else process.env.CLAUDE_CONFIG_DIR = saved.CLAUDE_CONFIG_DIR;
  if (saved.PAI_DIR === undefined) delete process.env.PAI_DIR;
  else process.env.PAI_DIR = saved.PAI_DIR;
});

describe('resolveInstallPaths — defaults', () => {
  test('no env, no flags → ~/.claude + ~/.claude/PAI', () => {
    const { claudeConfigDir, paiDir } = resolveInstallPaths({});
    expect(claudeConfigDir).toBe(join(HOME, '.claude'));
    expect(paiDir).toBe(join(HOME, '.claude', 'PAI'));
  });
});

describe('resolveInstallPaths — env vars', () => {
  test('CLAUDE_CONFIG_DIR=/opt/claude → /opt/claude + /opt/claude/PAI', () => {
    process.env.CLAUDE_CONFIG_DIR = '/opt/claude';
    const { claudeConfigDir, paiDir } = resolveInstallPaths({});
    expect(claudeConfigDir).toBe('/opt/claude');
    expect(paiDir).toBe('/opt/claude/PAI');
  });

  test('PAI_DIR=/data/pai (alone) → ~/.claude + /data/pai', () => {
    process.env.PAI_DIR = '/data/pai';
    const { claudeConfigDir, paiDir } = resolveInstallPaths({});
    expect(claudeConfigDir).toBe(join(HOME, '.claude'));
    expect(paiDir).toBe('/data/pai');
  });

  test('cross-domain split: CLAUDE_CONFIG_DIR=/b/.claude, PAI_DIR=/a/PAI → both honored', () => {
    process.env.CLAUDE_CONFIG_DIR = '/b/.claude';
    process.env.PAI_DIR = '/a/PAI';
    const { claudeConfigDir, paiDir } = resolveInstallPaths({});
    expect(claudeConfigDir).toBe('/b/.claude');
    expect(paiDir).toBe('/a/PAI');
  });

  test('empty CLAUDE_CONFIG_DIR → treated as unset', () => {
    process.env.CLAUDE_CONFIG_DIR = '';
    const { claudeConfigDir, paiDir } = resolveInstallPaths({});
    expect(claudeConfigDir).toBe(join(HOME, '.claude'));
    expect(paiDir).toBe(join(HOME, '.claude', 'PAI'));
  });

  test('whitespace-only CLAUDE_CONFIG_DIR → treated as unset', () => {
    process.env.CLAUDE_CONFIG_DIR = '   ';
    const { claudeConfigDir } = resolveInstallPaths({});
    expect(claudeConfigDir).toBe(join(HOME, '.claude'));
  });

  test('relative CLAUDE_CONFIG_DIR → throws', () => {
    process.env.CLAUDE_CONFIG_DIR = 'relative/path';
    expect(() => resolveInstallPaths({})).toThrow(/CLAUDE_CONFIG_DIR/);
  });

  test('relative PAI_DIR → throws', () => {
    process.env.PAI_DIR = 'relative/pai';
    expect(() => resolveInstallPaths({})).toThrow(/PAI_DIR/);
  });
});

describe('resolveInstallPaths — CLI flags override env', () => {
  test('flag wins over env (CLAUDE_CONFIG_DIR)', () => {
    process.env.CLAUDE_CONFIG_DIR = '/x';
    const { claudeConfigDir, paiDir } = resolveInstallPaths({ cliClaudeConfigDir: '/y' });
    expect(claudeConfigDir).toBe('/y');
    expect(paiDir).toBe('/y/PAI');
  });

  test('flag wins over env (PAI_DIR)', () => {
    process.env.PAI_DIR = '/x';
    const { paiDir } = resolveInstallPaths({ cliPaiDir: '/y' });
    expect(paiDir).toBe('/y');
  });

  test('both flags → both honored', () => {
    const { claudeConfigDir, paiDir } = resolveInstallPaths({
      cliClaudeConfigDir: '/y',
      cliPaiDir: '/z',
    });
    expect(claudeConfigDir).toBe('/y');
    expect(paiDir).toBe('/z');
  });

  test('relative flag → throws with source name', () => {
    expect(() =>
      resolveInstallPaths({ cliClaudeConfigDir: 'relative/path' })
    ).toThrow(/--claude-config-dir/);
    expect(() =>
      resolveInstallPaths({ cliPaiDir: 'relative/path' })
    ).toThrow(/--pai-dir/);
  });

  test('cliClaude + PAI_DIR="   " (whitespace env) → PAI defaults under CLI Claude', () => {
    process.env.PAI_DIR = '   ';
    const { claudeConfigDir, paiDir } = resolveInstallPaths({ cliClaudeConfigDir: '/y' });
    expect(claudeConfigDir).toBe('/y');
    expect(paiDir).toBe('/y/PAI');
  });

  test('cliClaude + PAI_DIR="" (empty env) → PAI defaults under CLI Claude', () => {
    process.env.PAI_DIR = '';
    const { claudeConfigDir, paiDir } = resolveInstallPaths({ cliClaudeConfigDir: '/y' });
    expect(claudeConfigDir).toBe('/y');
    expect(paiDir).toBe('/y/PAI');
  });
});

describe('contract symmetry — installer matches runtime lib', () => {
  test('default env → installer agrees with getClaudeDir/getPaiDir', () => {
    const { claudeConfigDir, paiDir } = resolveInstallPaths({});
    expect(claudeConfigDir).toBe(getClaudeDir());
    expect(paiDir).toBe(getPaiDir());
  });

  test('CLAUDE_CONFIG_DIR=/opt/claude → installer agrees with runtime', () => {
    process.env.CLAUDE_CONFIG_DIR = '/opt/claude';
    const { claudeConfigDir, paiDir } = resolveInstallPaths({});
    expect(claudeConfigDir).toBe(getClaudeDir());
    expect(paiDir).toBe(getPaiDir());
  });

  test('cross-domain split → installer agrees with runtime', () => {
    process.env.CLAUDE_CONFIG_DIR = '/b/.claude';
    process.env.PAI_DIR = '/a/PAI';
    const { claudeConfigDir, paiDir } = resolveInstallPaths({});
    expect(claudeConfigDir).toBe(getClaudeDir());
    expect(paiDir).toBe(getPaiDir());
  });
});

describe('detectSystem integration', () => {
  test('produces both claudeConfigDir and paiDir on DetectionResult', () => {
    process.env.CLAUDE_CONFIG_DIR = '/opt/claude';
    process.env.PAI_DIR = '/data/pai';
    const result = detectSystem();
    expect(result.claudeConfigDir).toBe('/opt/claude');
    expect(result.paiDir).toBe('/data/pai');
  });

  test('default env → claudeConfigDir=~/.claude, paiDir=~/.claude/PAI', () => {
    const result = detectSystem();
    expect(result.claudeConfigDir).toBe(join(HOME, '.claude'));
    expect(result.paiDir).toBe(join(HOME, '.claude', 'PAI'));
  });
});
