/**
 * LedgerCore — generic append-only ledger primitives shared by STATVS and Cortex.
 *
 * Nothing here knows about STATVS rows or Cortex events. It carries the pieces
 * every hash-chained JSONL ledger needs: content hashing, canonical JSON, the
 * chain step, an O_EXCL lockfile with stale takeover, a tail reader that never
 * reads the whole file, and torn-final-line quarantine.
 *
 * Lifted from CortexLedgerCore.ts (2026-10-15, STATVS ISA ISC-26) so both
 * ledgers share one implementation.
 *
 * withFileLock contract: returns `{ ok: true, value }` when the action ran and
 * `{ ok: false, message }` when the lock could not be taken (timeout or an
 * acquisition error such as EACCES). An exception thrown by the action itself
 * propagates after the lock is released, so an InvariantViolation is never
 * turned into a typed error here.
 *
 * @version 1.0.0
 */

import {
  closeSync,
  fstatSync,
  linkSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, resolve as pathResolve } from "node:path";
import { createHash } from "node:crypto";
import { invariant } from "../Invariant";

// ── Hashing ──

export function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/** Stable stringify: sorted keys at every depth, so hash input never depends on insertion order. Undefined values in objects are dropped, as JSON.stringify drops them. */
export function canonicalJson(value: unknown): string {
  if (value === undefined) return "null";
  if (Array.isArray(value)) return "[" + value.map((v) => (v === undefined ? "null" : canonicalJson(v))).join(",") + "]";
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
    return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(obj[k])).join(",") + "}";
  }
  return JSON.stringify(value);
}

/** One chain step: sha256(prev + canonical row-without-hash). */
export function rowHash(prev: string, rowSansHash: Record<string, unknown>): string {
  return sha256(prev + canonicalJson(rowSansHash));
}

// ── Locking ──

export type LockResult<T> = { ok: true; value: T } | { ok: false; message: string };

export interface LockOptions {
  /** Give up after this long. Default 5000 ms. */
  deadlineMs?: number;
  /** A lock whose mtime is older than this is taken over. Default 10000 ms. */
  staleMs?: number;
  /** Sleep between attempts. Default 25 ms. A jittered value in [retryMs/2, retryMs] is used. */
  retryMs?: number;
}

/**
 * Take over a stale O_EXCL lock. The takeover is serialized by a second O_EXCL file
 * (`<lock>.takeover`), and the rename is checked by inode: the lock moved aside must be
 * the very file judged stale. A contender whose stale observation was overtaken (the
 * stale lock already replaced by a fresh one) therefore never removes the fresh lock.
 * The takeover file is held only for a few syscalls; one left by a crash is cleared
 * after `staleMs` like any other stale lock.
 *
 * Even so, a live holder whose action runs past `staleMs` loses its lock. Ledgers that
 * cannot tolerate that use withKernelLock below, which has no staleness at all.
 */
function tryTakeStale(lockPath: string, staleMs: number): void {
  let seen: { ino: number; mtimeMs: number };
  try { seen = statSync(lockPath); } catch { return; }
  if (Date.now() - seen.mtimeMs < staleMs) return;
  const gate = `${lockPath}.takeover`;
  let gfd: number;
  try { gfd = openSync(gate, "wx"); } catch {
    try { if (Date.now() - statSync(gate).mtimeMs > staleMs) unlinkSync(gate); } catch { /* raced */ }
    return;
  }
  try {
    let now: { ino: number; mtimeMs: number };
    try { now = statSync(lockPath); } catch { return; }
    if (now.ino !== seen.ino || Date.now() - now.mtimeMs < staleMs) return; // overtaken
    const aside = `${lockPath}.stale-${process.pid}-${Math.random().toString(36).slice(2)}`;
    try { renameSync(lockPath, aside); } catch { return; }
    // Only takeover-gate holders rename the lock, so what moved is the inode checked above.
    try {
      if (statSync(aside).ino !== seen.ino) {
        try { linkSync(aside, lockPath); } catch { /* cannot happen while the gate is held */ }
      }
    } catch { /* aside vanished */ }
    try { unlinkSync(aside); } catch { /* best-effort */ }
  } finally {
    try { closeSync(gfd); } catch { /* ignore */ }
    try { unlinkSync(gate); } catch { /* best-effort */ }
  }
}

/**
 * Run `action` while holding an O_EXCL lockfile. The lock's directory is created
 * on first use. See the module header for the result contract. Release removes the
 * lockfile only while it is still this holder's own (same inode), so a holder whose
 * lock was taken over never deletes its successor's lock.
 */
export function withFileLock<T>(lockPath: string, action: () => T, opts: LockOptions = {}): LockResult<T> {
  const deadlineMs = opts.deadlineMs ?? 5000;
  const staleMs = opts.staleMs ?? 10000;
  const retryMs = opts.retryMs ?? 25;
  const deadline = Date.now() + deadlineMs;
  let fd: number | null = null;
  let madeDir = false;
  for (;;) {
    try {
      fd = openSync(lockPath, "wx");
      break;
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code === "ENOENT" && !madeDir) {
        madeDir = true;
        try { mkdirSync(dirname(lockPath), { recursive: true }); } catch (me: unknown) {
          return { ok: false, message: `lock directory create failed: ${(me as Error)?.message ?? String(me)}` };
        }
        continue;
      }
      if (code !== "EEXIST") return { ok: false, message: `lock acquisition failed: ${(e as Error)?.message ?? String(e)}` };
      if (Date.now() > deadline) return { ok: false, message: `lock held past deadline: ${lockPath}` };
      tryTakeStale(lockPath, staleMs);
      const sleep = retryMs <= 1 ? retryMs : retryMs / 2 + Math.random() * (retryMs / 2);
      Bun.sleepSync(sleep);
    }
  }
  let ownIno = -1;
  try { ownIno = fstatSync(fd).ino; } catch { /* unknown: release below skips the unlink check */ }
  try {
    return { ok: true, value: action() };
  } finally {
    try { closeSync(fd); } catch { /* ignore */ }
    try { if (ownIno < 0 || statSync(lockPath).ino === ownIno) unlinkSync(lockPath); } catch { /* best-effort */ }
  }
}

// ── Kernel locks ──

type FlockFn = (fd: number, op: number) => number;
let flockFn: FlockFn | null | undefined;
const LOCK_EX = 2;
const LOCK_NB = 4;

function flock(): FlockFn | null {
  if (flockFn !== undefined) return flockFn;
  try {
    // flock(2) through libc. The kernel releases the lock when the holder's fd closes,
    // including when the process dies, and never while a live holder is merely slow.
    const { dlopen, FFIType } = require("bun:ffi") as typeof import("bun:ffi");
    const libc = process.platform === "darwin" ? "libc.dylib" : "libc.so.6";
    const lib = dlopen(libc, { flock: { args: [FFIType.i32, FFIType.i32], returns: FFIType.i32 } });
    flockFn = (fd, op) => lib.symbols.flock(fd, op) as number;
  } catch {
    flockFn = null;
  }
  return flockFn;
}

/**
 * Run `action` while holding an flock(2) lock on `lockPath`. Unlike withFileLock there is
 * no staleness and no takeover: a dead holder's lock is released by the kernel at once, a
 * live holder (however slow, or suspended) keeps it, and two holders can never overlap.
 * The lockfile is created on first use and never removed (removing it would let a waiter
 * lock an unlinked inode). Same result contract as withFileLock; `staleMs` is ignored.
 * `deadlineMs: 0` makes exactly one attempt.
 */
export function withKernelLock<T>(lockPath: string, action: () => T, opts: LockOptions = {}): LockResult<T> {
  const deadlineMs = opts.deadlineMs ?? 5000;
  const retryMs = opts.retryMs ?? 25;
  if (process.platform === "win32") return withWindowsKernelLock(lockPath, action, deadlineMs, retryMs);
  const fl = flock();
  if (!fl) return { ok: false, message: "lock acquisition failed: flock(2) unavailable" };
  let fd: number;
  try {
    fd = openSync(lockPath, "a");
  } catch (e: unknown) {
    if ((e as { code?: string })?.code !== "ENOENT") return { ok: false, message: `lock acquisition failed: ${(e as Error)?.message ?? String(e)}` };
    try {
      mkdirSync(dirname(lockPath), { recursive: true });
      fd = openSync(lockPath, "a");
    } catch (me: unknown) {
      return { ok: false, message: `lock directory create failed: ${(me as Error)?.message ?? String(me)}` };
    }
  }
  const deadline = Date.now() + deadlineMs;
  try {
    for (;;) {
      if (fl(fd, LOCK_EX | LOCK_NB) === 0) break;
      if (Date.now() >= deadline) return { ok: false, message: `lock held past deadline: ${lockPath}` };
      Bun.sleepSync(retryMs <= 1 ? retryMs : retryMs / 2 + Math.random() * (retryMs / 2));
    }
    return { ok: true, value: action() };
  } finally {
    try { closeSync(fd); } catch { /* closing releases the flock */ }
  }
}

// Windows has no flock(2). Its kernel lock with the same contract is a handle opened with share
// mode 0: no other process can open the file until the handle closes, and Windows closes it when
// the holder exits or dies. No staleness, no takeover, and the lockfile is never removed.
type Win32Lock = { open: (path: string) => bigint | null; close: (h: bigint) => void };
let win32Lock: Win32Lock | null | undefined;

function win32(): Win32Lock | null {
  if (win32Lock !== undefined) return win32Lock;
  try {
    const { dlopen, FFIType, ptr } = require("bun:ffi") as typeof import("bun:ffi");
    const k32 = dlopen("kernel32.dll", {
      CreateFileW: { args: [FFIType.ptr, FFIType.u32, FFIType.u32, FFIType.ptr, FFIType.u32, FFIType.u32, FFIType.ptr], returns: FFIType.i64 },
      CloseHandle: { args: [FFIType.i64], returns: FFIType.i32 },
    });
    const GENERIC_READ_WRITE = 0xc0000000, OPEN_ALWAYS = 4, FILE_ATTRIBUTE_NORMAL = 0x80;
    win32Lock = {
      open: (path) => {
        const wide = Buffer.from(`${path}\0`, "utf16le");
        const h = BigInt(k32.symbols.CreateFileW(ptr(wide), GENERIC_READ_WRITE, 0, null, OPEN_ALWAYS, FILE_ATTRIBUTE_NORMAL, null) as number | bigint);
        return h === -1n || h === 0n ? null : h; // INVALID_HANDLE_VALUE: held elsewhere (sharing violation)
      },
      close: (h) => { k32.symbols.CloseHandle(h); },
    };
  } catch {
    win32Lock = null;
  }
  return win32Lock;
}

function withWindowsKernelLock<T>(lockPath: string, action: () => T, deadlineMs: number, retryMs: number): LockResult<T> {
  const w = win32();
  if (!w) return { ok: false, message: "lock acquisition failed: kernel32 CreateFileW unavailable" };
  try { mkdirSync(dirname(lockPath), { recursive: true }); } catch (e: unknown) {
    return { ok: false, message: `lock directory create failed: ${(e as Error)?.message ?? String(e)}` };
  }
  const deadline = Date.now() + deadlineMs;
  let h = w.open(lockPath);
  while (h === null) {
    if (Date.now() >= deadline) return { ok: false, message: `lock held past deadline: ${lockPath}` };
    Bun.sleepSync(retryMs <= 1 ? retryMs : retryMs / 2 + Math.random() * (retryMs / 2));
    h = w.open(lockPath);
  }
  const held = h;
  try {
    return { ok: true, value: action() };
  } finally {
    w.close(held);
  }
}

// ── Tail reading ──

export interface TailState {
  /** The last newline-terminated line, without its newline; null when there is none. */
  line: string | null;
  /** Bytes after the last newline: a torn or in-flight final line. Empty when the file ends on a newline. */
  torn: string;
  /** File size in bytes at read time. */
  size: number;
}

/** Read the end of a file backwards in growing chunks until the last complete line is found. Missing file → empty state. */
export function tailState(path: string, bytes = 4096): TailState {
  let fd: number;
  try { fd = openSync(path, "r"); } catch (e: unknown) {
    if ((e as { code?: string })?.code === "ENOENT") return { line: null, torn: "", size: 0 };
    throw e;
  }
  try {
    return tailStateFd(fd, bytes);
  } finally {
    closeSync(fd);
  }
}

/** Tail state of an already-open fd (any mode that allows reading). The fd stays open. */
export function tailStateFd(fd: number, bytes = 4096): TailState {
  {
    const size = fstatSync(fd).size;
    if (size === 0) return { line: null, torn: "", size: 0 };
    let chunk = Math.max(64, bytes);
    for (;;) {
      const len = Math.min(chunk, size);
      const buf = Buffer.allocUnsafe(len);
      let got = 0;
      while (got < len) {
        const n = readSync(fd, buf, got, len - got, size - len + got);
        if (n <= 0) break;
        got += n;
      }
      const text = buf.subarray(0, got);
      const lastNl = text.lastIndexOf(10);
      // Need the newline that ends the last complete line AND the one before it (or file start).
      if (lastNl >= 0) {
        const prevNl = lastNl === 0 ? -1 : text.lastIndexOf(10, lastNl - 1);
        if (prevNl >= 0 || len === size) {
          return {
            line: text.subarray(prevNl + 1, lastNl).toString("utf8"),
            torn: text.subarray(lastNl + 1).toString("utf8"),
            size,
          };
        }
      } else if (len === size) {
        return { line: null, torn: text.toString("utf8"), size };
      }
      chunk *= 4;
    }
  }
}

/** The last complete line of a file without reading the whole file, or null. */
export function readTail(path: string, bytes = 4096): string | null {
  return tailState(path, bytes).line;
}

// ── Torn-tail quarantine ──

export interface QuarantineOptions {
  /** File name for the quarantined bytes, given the ISO stamp with `:` and `.` replaced by `-`. Default `torn-<stamp>-<pid>-<basename>.txt`. */
  fileName?: (stamp: string) => string;
  /** Temp path used for the truncate-by-rename. Default `<path>.tmp-<pid>`. */
  tmpPath?: string;
}

/**
 * Move a torn final line (bytes after the last newline) to
 * `<quarantineDir>/torn-<iso>-<pid>-<basename>.txt` and truncate the file to its
 * last newline via tmp+rename. Returns the number of bytes moved (0 when the file
 * ends on a newline). The caller holds the file's lock. `opts` lets a ledger with
 * an established on-disk layout (Cortex) keep its own quarantine and temp names.
 */
export function quarantineTornTail(path: string, quarantineDir: string, opts: QuarantineOptions = {}): number {
  const raw = readFileSync(path);
  const lastNl = raw.lastIndexOf(10);
  const keep = raw.subarray(0, lastNl + 1);
  const torn = raw.subarray(lastNl + 1);
  if (torn.length === 0) return 0;
  invariant(keep.length + torn.length === raw.length, "quarantine split must cover the file exactly");
  mkdirSync(quarantineDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const name = opts.fileName ? opts.fileName(stamp) : `torn-${stamp}-${process.pid}-${basename(path)}.txt`;
  const qPath = pathResolve(quarantineDir, name);
  invariant(dirname(qPath) === pathResolve(quarantineDir), "quarantine file must land inside the quarantine dir");
  writeFileSync(qPath, torn, { flag: "wx" });
  const tmp = opts.tmpPath ?? `${path}.tmp-${process.pid}`;
  invariant(tmp !== path, "quarantine temp path must differ from the ledger path");
  try { unlinkSync(tmp); } catch { /* absent is normal */ }
  writeFileSync(tmp, keep, { flag: "wx" });
  renameSync(tmp, path);
  return torn.length;
}
