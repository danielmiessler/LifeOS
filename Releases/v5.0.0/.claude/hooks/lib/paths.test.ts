/**
 * Path resolution semantics — regression tests for two-domain config.
 *
 * Architecture reference: PAI/DOCUMENTATION/PAISystemArchitecture.md L18-34
 *
 * Run: bun test hooks/lib/paths.test.ts
 *
 * Each test sets env, calls the lib, asserts. No fixtures, no helpers.
 * Both libs are tested — they implement the same env-var contract as
 * mirror duplicates per architecture C1 (no cross-domain relative imports).
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { homedir } from 'os';
import { join, isAbsolute } from 'path';

import * as claude from './paths';
import * as pai from '../../PAI/lib/paths';

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

describe('Claude domain — getClaudeDir()', () => {
  test('unset → ~/.claude', () => {
    expect(claude.getClaudeDir()).toBe(join(HOME, '.claude'));
  });

  test('CLAUDE_CONFIG_DIR=/opt/claude → /opt/claude (no .claude appended)', () => {
    process.env.CLAUDE_CONFIG_DIR = '/opt/claude';
    expect(claude.getClaudeDir()).toBe('/opt/claude');
  });

  test('CLAUDE_CONFIG_DIR=/b/.claude → /b/.claude', () => {
    process.env.CLAUDE_CONFIG_DIR = '/b/.claude';
    expect(claude.getClaudeDir()).toBe('/b/.claude');
  });

  test('CLAUDE_CONFIG_DIR=$HOME/custom → expanded', () => {
    process.env.CLAUDE_CONFIG_DIR = '$HOME/custom';
    expect(claude.getClaudeDir()).toBe(join(HOME, 'custom'));
  });

  test('CLAUDE_CONFIG_DIR="" → treated as unset → ~/.claude', () => {
    process.env.CLAUDE_CONFIG_DIR = '';
    expect(claude.getClaudeDir()).toBe(join(HOME, '.claude'));
  });

  test('CLAUDE_CONFIG_DIR="   " (whitespace) → treated as unset → ~/.claude', () => {
    process.env.CLAUDE_CONFIG_DIR = '   ';
    expect(claude.getClaudeDir()).toBe(join(HOME, '.claude'));
  });

  test('CLAUDE_CONFIG_DIR=relative/path → throws', () => {
    process.env.CLAUDE_CONFIG_DIR = 'relative/path';
    expect(() => claude.getClaudeDir()).toThrow(/CLAUDE_CONFIG_DIR/);
  });
});

describe('Claude domain — derived helpers', () => {
  test('getSettingsPath() → ${CLAUDE_CONFIG_DIR}/settings.json', () => {
    process.env.CLAUDE_CONFIG_DIR = '/opt/claude';
    expect(claude.getSettingsPath()).toBe('/opt/claude/settings.json');
  });

  test('getSettingsPath() is absolute regardless of cwd', () => {
    const cwd = process.cwd();
    try {
      process.chdir('/tmp');
      expect(isAbsolute(claude.getSettingsPath())).toBe(true);
    } finally {
      process.chdir(cwd);
    }
  });

  test('getEnvPath() → ${CLAUDE_CONFIG_DIR}/.env', () => {
    process.env.CLAUDE_CONFIG_DIR = '/opt/claude';
    expect(claude.getEnvPath()).toBe('/opt/claude/.env');
  });
});

describe('PAI domain — getPaiDir()', () => {
  test('both unset → ~/.claude/PAI', () => {
    expect(pai.getPaiDir()).toBe(join(HOME, '.claude', 'PAI'));
  });

  test('CLAUDE_CONFIG_DIR=/opt/claude, PAI_DIR unset → /opt/claude/PAI', () => {
    process.env.CLAUDE_CONFIG_DIR = '/opt/claude';
    expect(pai.getPaiDir()).toBe('/opt/claude/PAI');
  });

  test('PAI_DIR=/data/pai → /data/pai (PAI_DIR wins)', () => {
    process.env.PAI_DIR = '/data/pai';
    expect(pai.getPaiDir()).toBe('/data/pai');
  });

  test('cross-domain split: CLAUDE_CONFIG_DIR=/b/.claude, PAI_DIR=/a/PAI → both honored', () => {
    process.env.CLAUDE_CONFIG_DIR = '/b/.claude';
    process.env.PAI_DIR = '/a/PAI';
    expect(claude.getClaudeDir()).toBe('/b/.claude');
    expect(pai.getPaiDir()).toBe('/a/PAI');
  });

  test('PAI_DIR=relative/path → throws', () => {
    process.env.CLAUDE_CONFIG_DIR = '/opt/claude';
    process.env.PAI_DIR = 'relative/path';
    expect(() => pai.getPaiDir()).toThrow(/PAI_DIR/);
  });

  test('PAI_DIR="" + CLAUDE_CONFIG_DIR=/opt/claude → /opt/claude/PAI (empty = unset)', () => {
    process.env.CLAUDE_CONFIG_DIR = '/opt/claude';
    process.env.PAI_DIR = '';
    expect(pai.getPaiDir()).toBe('/opt/claude/PAI');
  });

  test('PAI_DIR="   " + CLAUDE_CONFIG_DIR=/opt/claude → /opt/claude/PAI (whitespace = unset)', () => {
    process.env.CLAUDE_CONFIG_DIR = '/opt/claude';
    process.env.PAI_DIR = '   ';
    expect(pai.getPaiDir()).toBe('/opt/claude/PAI');
  });

  test('PAI_DIR=$HOME/custom-pai → expanded', () => {
    process.env.PAI_DIR = '$HOME/custom-pai';
    expect(pai.getPaiDir()).toBe(join(HOME, 'custom-pai'));
  });
});

describe('PAI domain — derived helpers', () => {
  test('getMemoryDir() → ${PAI_DIR}/MEMORY', () => {
    process.env.PAI_DIR = '/data/pai';
    expect(pai.getMemoryDir()).toBe('/data/pai/MEMORY');
  });

  test('paiPath(a, b) → ${PAI_DIR}/a/b', () => {
    process.env.PAI_DIR = '/data/pai';
    expect(pai.paiPath('TOOLS', 'foo.ts')).toBe('/data/pai/TOOLS/foo.ts');
  });

  test('cross-domain rule: paths from PAI lib are absolute regardless of cwd', () => {
    process.env.CLAUDE_CONFIG_DIR = '/opt/claude';
    process.env.PAI_DIR = '/data/pai';
    const cwd = process.cwd();
    try {
      process.chdir('/tmp');
      expect(isAbsolute(pai.getMemoryDir())).toBe(true);
      expect(pai.getMemoryDir()).toBe('/data/pai/MEMORY');
    } finally {
      process.chdir(cwd);
    }
  });
});
