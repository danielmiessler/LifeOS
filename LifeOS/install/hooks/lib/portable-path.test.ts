/**
 * portable-path: the Windows behaviour is exercised through path.win32, so these run on any OS.
 * Run: bun test hooks/lib/portable-path.test.ts
 */
import { describe, expect, test } from 'bun:test';
import path from 'path';
import { hasPosixModes, isWithin, rootRelativeKey } from './portable-path';

const W = path.win32;
const P = path.posix;
const ROOT_W = 'C:\\Users\\A\\.claude';

describe('isWithin on Windows paths', () => {
  test('a backslash descendant is inside (root + "/" never matched it)', () => {
    expect(isWithin(`${ROOT_W}\\LIFEOS\\USER\\x.md`, ROOT_W, W)).toBe(true);
  });
  test('case and separator style do not matter', () => {
    expect(isWithin('c:/users/a/.claude/LIFEOS/USER/x.md', ROOT_W, W)).toBe(true);
    expect(isWithin(`${ROOT_W}\\LIFEOS`, 'c:\\users\\a\\.CLAUDE\\', W)).toBe(true);
  });
  test('the root itself is inside; a sibling sharing a prefix is not', () => {
    expect(isWithin(ROOT_W, ROOT_W + '\\', W)).toBe(true);
    expect(isWithin('C:\\Users\\A\\.claude-backup\\x', ROOT_W, W)).toBe(false);
    expect(isWithin('D:\\Users\\A\\.claude\\x', ROOT_W, W)).toBe(false);
  });
  test('.. is folded before the test', () => {
    expect(isWithin(`${ROOT_W}\\LIFEOS\\..\\..\\evil`, ROOT_W, W)).toBe(false);
  });
});

describe('isWithin on POSIX paths', () => {
  test('prefix sibling and case are distinct', () => {
    expect(isWithin('/home/a/.claude/x', '/home/a/.claude/', P)).toBe(true);
    expect(isWithin('/home/a/.claude-backup/x', '/home/a/.claude', P)).toBe(false);
    expect(isWithin('/home/a/.CLAUDE/x', '/home/a/.claude', P)).toBe(false);
  });
});

describe('rootRelativeKey', () => {
  test('a Windows memory file keys as LIFEOS/USER/... with forward slashes', () => {
    expect(rootRelativeKey(ROOT_W, `${ROOT_W}\\LIFEOS\\USER\\PRINCIPAL\\PRINCIPAL_MEMORY.md`, W))
      .toBe('LIFEOS/USER/PRINCIPAL/PRINCIPAL_MEMORY.md');
  });
  test('the Windows key equals the POSIX key for the same file', () => {
    const win = rootRelativeKey('c:/users/a/.claude/', `${ROOT_W}\\LIFEOS\\MEMORY\\KNOWLEDGE\\Ideas\\x.md`, W);
    const mac = rootRelativeKey('/Users/a/.claude', '/Users/a/.claude/LIFEOS/MEMORY/KNOWLEDGE/Ideas/x.md', P);
    expect(win).toBe('LIFEOS/MEMORY/KNOWLEDGE/Ideas/x.md');
    expect(win).toBe(mac);
  });
  test('the root is "" and an outside path is null', () => {
    expect(rootRelativeKey(ROOT_W, ROOT_W, W)).toBe('');
    expect(rootRelativeKey(ROOT_W, 'C:\\Users\\A\\elsewhere.md', W)).toBeNull();
  });
});

test('hasPosixModes is false only on win32', () => {
  expect(hasPosixModes('win32')).toBe(false);
  expect(hasPosixModes('linux')).toBe(true);
  expect(hasPosixModes('darwin')).toBe(true);
});
