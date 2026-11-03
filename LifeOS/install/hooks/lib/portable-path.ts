/**
 * portable-path.ts — path tests and keys that hold on Windows as well as POSIX.
 *
 *   isWithin(child, root)          `child` is `root` or below it: a path test, not a string test.
 *   rootRelativeKey(root, abs)     "LIFEOS/USER/x.md", the "/"-separated key ledgers and logs store.
 *   hasPosixModes()                whether stat mode bits mean anything on this platform.
 *
 * The idioms these replace (`p.startsWith(root + "/")`, `abs.replace(ROOT + "/", "")`,
 * `abs.split("/").pop()`, `(stat.mode & 0o777) === 0o600`) are silently wrong on Windows, where
 * paths use "\", compare case-insensitively and report no POSIX permission bits. Every helper
 * takes the path implementation as its last argument, so a test on Linux or macOS can pass
 * `path.win32` and exercise the Windows behaviour without a Windows machine.
 * @version 1.0.0
 */

import path, { type PlatformPath } from 'path';

/** The running platform's path module; tests pass `path.win32` or `path.posix` instead. */
export const nativePath: PlatformPath = path;

const isWin = (p: PlatformPath): boolean => p.sep === '\\';

/** Normalized (native separators, `.`/`..` folded) with trailing separators trimmed; a bare root keeps its own. */
function trimmed(s: string, p: PlatformPath): string {
  let n = p.normalize(s);
  const root = p.parse(n).root;
  while (n.length > root.length && n.endsWith(p.sep)) n = n.slice(0, -1);
  return n;
}

/** The form two paths are compared in: trimmed, and case-folded on Windows (NTFS is case-insensitive). */
function comparable(s: string, p: PlatformPath): string {
  const n = trimmed(s, p);
  return isWin(p) ? n.toLowerCase() : n;
}

/**
 * True when `child` is `root` itself or a descendant. Separators, trailing separators and (on
 * Windows) case do not matter, and `/a/bc` is not inside `/a/b`. Lexical only: resolve symlinks
 * first when the answer guards a write (Boundary.confinedPath does).
 */
export function isWithin(child: string, root: string, p: PlatformPath = nativePath): boolean {
  if (!child || !root) return false;
  const c = comparable(child, p);
  const r = comparable(root, p);
  if (c === r) return true;
  return c.startsWith(r.endsWith(p.sep) ? r : r + p.sep);
}

/**
 * `abs` relative to `root` as a "/"-separated key ("LIFEOS/USER/PRINCIPAL/PRINCIPAL_MEMORY.md"),
 * the same string on every platform; "" for the root itself; null when `abs` is outside `root`.
 * Ledgers key rows by this, so a Windows key must match the one a Mac wrote for the same file.
 */
export function rootRelativeKey(root: string, abs: string, p: PlatformPath = nativePath): string | null {
  if (!isWithin(abs, root, p)) return null;
  const r = trimmed(root, p);
  let rest = trimmed(abs, p).slice(r.length);
  while (rest.startsWith(p.sep)) rest = rest.slice(1);
  return rest.split(p.sep).join('/');
}

/**
 * Whether stat mode bits are meaningful here. Windows reports 0o666 for every file and directory
 * whatever chmod asked, and access is governed by the user profile's ACL instead, so an assertion
 * such as `(stat.mode & 0o777) === 0o600` can only fail there. Gate such assertions on this.
 */
export function hasPosixModes(platform: string = process.platform): boolean {
  return platform !== 'win32';
}
