/**
 * Containment checks on native paths. Each case builds its paths with path.join, so on Windows
 * they carry "\" separators; before portable-path these checks tested `root + "/"` and never
 * matched there (rootFor returned null, isContained false, rootOf null).
 * Run: bun test hooks/lib/containment-paths.test.ts
 */
import { describe, expect, test } from 'bun:test';
import { mkdtempSync, realpathSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { isContained, relativeToClaudeRoot } from './containment-zones';
import { classifyForms, realpathDeepest, rootFor } from './system-file-guard-core';
import { rootOf } from './handed-paths';
import { getClaudeDir } from './paths';

describe('containment-zones', () => {
  const root = join(tmpdir(), 'cfg-root', '.claude');
  test('a USER path is "/"-keyed and inside the USER zone', () => {
    const p = join(root, 'LIFEOS', 'USER', 'PRINCIPAL', 'PRINCIPAL_MEMORY.md');
    expect(relativeToClaudeRoot(p, root)).toBe('LIFEOS/USER/PRINCIPAL/PRINCIPAL_MEMORY.md');
    expect(isContained(p, root)).toBe(true);
  });
  test('a system path is outside every zone; a path outside the root stays absolute', () => {
    expect(isContained(join(root, 'LIFEOS', 'TOOLS', 'Secrets.ts'), root)).toBe(false);
    const outside = join(tmpdir(), 'elsewhere', 'x.md');
    expect(relativeToClaudeRoot(outside, root)).toBe(outside);
  });
});

test('classifyForms sorts a USER path and a system path under a real root', () => {
  const root = mkdtempSync(join(tmpdir(), 'guard-root-'));
  try {
    const user = classifyForms(join(root, 'LIFEOS', 'USER', 'PRINCIPAL', 'x.md'), root);
    expect(user.unresolved).toBe(false);
    expect(user.verdicts.map((v) => v.classification)).toContain('user');
    expect(user.verdicts[0].relPath).toBe('LIFEOS/USER/PRINCIPAL/x.md');
    const system = classifyForms(join(root, 'LIFEOS', 'TOOLS', 'x.ts'), root);
    expect(system.verdicts.map((v) => v.classification)).toEqual(system.verdicts.map(() => 'system'));
    expect(system.verdicts.length).toBeGreaterThan(0);
    expect(realpathDeepest(join(root, 'missing', 'x.md'))).toBe(join(realpathSync(root), 'missing', 'x.md'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('system-file-guard rootFor finds the config root for a path under it', () => {
  const root = getClaudeDir();
  expect(rootFor(join(root, 'LIFEOS', 'TOOLS', 'x.ts'))).toBe(root);
  expect(rootFor(join(root + '-backup', 'x.ts'))).toBeNull();
});

test('handed-paths rootOf places a file under Downloads', () => {
  const base = mkdtempSync(join(tmpdir(), 'handed-'));
  try {
    const roots = { downloads: join(base, 'Downloads'), desktop: join(base, 'Desktop') };
    expect(rootOf(join(roots.downloads, 'report.pdf'), roots)).toBe('downloads');
    expect(rootOf(join(base, 'Documents', 'report.pdf'), roots)).toBeNull();
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
