/**
 * Boundary — the shared primitives for every place LifeOS touches a path, a write, a lock or a
 * secret on its way out (ISA 20261015-boundary-primitives, C3).
 *
 *   confinedPath(root, p)      the real path of `p` when it stays inside `root`, else null. Every
 *                              existing component is resolved physically (symlinks followed, `..`
 *                              taken from the real parent), never folded lexically first.
 *   atomicWrite(path, data)    owner-only by default (0600 file, 0700 for directories it creates):
 *                              temp file in the same directory, fsync, rename over the target, so a
 *                              symlink at the target is replaced, never written through.
 *   withLock(lockPath, fn)     an exclusive lock file stamped {pid, host, nonce}. A stale lock is
 *                              broken only after re-checking it is still the exact lock that was
 *                              judged stale, so two recoverers never both acquire.
 *   redact / redactStructured  the one redactor, over hooks/lib/label-redact (label, PIN, passphrase,
 *   isVerificationCode         verification-code rules) and hooks/lib/egress-shapes (secret shapes).
 *
 * New tools import these instead of hand-rolling path, write, lock or redaction code.
 * @version 1.0.0
 */

import {
  closeSync, fstatSync, fsyncSync, linkSync, lstatSync, mkdirSync, chmodSync, fchmodSync,
  openSync, readFileSync, realpathSync, renameSync, statSync, unlinkSync, writeSync,
} from "node:fs"
import { randomUUID } from "node:crypto"
import { hostname } from "node:os"
import { basename, dirname, isAbsolute, join, parse, sep } from "node:path"
import { invariant, InvariantViolation } from "../Invariant"
import {
  isVerificationCode as labelIsVerificationCode,
  redactLabelled,
  redactStructured as labelRedactStructured,
} from "../../../hooks/lib/label-redact"

// ── confinedPath ─────────────────────────────────────────────────────────────

function within(real: string, realRoot: string): boolean {
  if (real === realRoot) return true
  const prefix = realRoot.endsWith(sep) ? realRoot : realRoot + sep
  return real.startsWith(prefix)
}

function errCode(e: unknown): string | undefined {
  return (e as NodeJS.ErrnoException | undefined)?.code
}

/**
 * The real path `p` names when it stays inside `root`, or null. A relative `p` is walked from the
 * real root and refused the moment it leaves it; an absolute `p` is walked from `/` and judged by
 * where it lands. Each existing component is resolved through the filesystem, so `link/../x` with
 * `link` pointing outside goes where the kernel would go. After the first missing component the
 * rest is appended as written. Refused (null): a missing root, `..` after a missing component, a
 * dangling or looping symlink, a component under a file, and any result outside the root.
 */
export function confinedPath(root: string, p: string): string | null {
  if (typeof root !== "string" || root === "" || typeof p !== "string") return null
  let realRoot: string
  try { realRoot = realpathSync(root) } catch { return null }

  const relative = !isAbsolute(p)
  const rootPrefix = isAbsolute(p) ? parse(p).root : ""
  let cur = relative ? realRoot : rootPrefix
  let curIsDir = true
  let missing = false
  const tail: string[] = []

  const parts = isAbsolute(p) ? p.slice(rootPrefix.length).split(/[\\/]+/) : p.split(/[\\/]+/)
  for (const comp of parts) {
    if (comp === "" || comp === ".") continue
    if (missing) {
      if (comp === "..") return null
      tail.push(comp)
      continue
    }
    if (!curIsDir) return null
    if (comp === "..") {
      cur = dirname(cur)
    } else {
      const next = cur.endsWith(sep) ? cur + comp : cur + sep + comp
      let st
      try { st = lstatSync(next) } catch (e) {
        if (errCode(e) === "ENOENT") { missing = true; tail.push(comp); continue }
        return null
      }
      if (st.isSymbolicLink()) {
        try { cur = realpathSync(next) } catch { return null }
        try { curIsDir = statSync(cur).isDirectory() } catch { return null }
      } else {
        cur = next
        curIsDir = st.isDirectory()
      }
    }
    if (relative && !within(cur, realRoot)) return null
  }

  const result = tail.length ? join(cur, ...tail) : cur
  return within(result, realRoot) ? result : null
}

// ── atomicWrite ──────────────────────────────────────────────────────────────

export interface AtomicWriteOptions {
  /** File mode, 0..0o777. Default 0o600. */
  mode?: number
  /** Mode for parent directories this call creates, 0o700..0o777. Default 0o700. Existing ones keep theirs. */
  dirMode?: number
}

/** Create the missing ancestors of `dir`, each with `dirMode` whatever the umask. Existing directories are untouched. */
function ensureDir(dir: string, dirMode: number): void {
  const missing: string[] = []
  let d = dir
  for (;;) {
    try {
      const st = statSync(d)
      invariant(st.isDirectory(), `atomicWrite: parent ${d} exists and is not a directory`)
      break
    } catch (e) {
      if (e instanceof InvariantViolation) throw e
      if (errCode(e) !== "ENOENT") throw e
      missing.push(d)
      const up = dirname(d)
      invariant(up !== d, `atomicWrite: no existing ancestor for ${dir}`)
      d = up
    }
  }
  for (const m of missing.reverse()) {
    try {
      mkdirSync(m, { mode: dirMode })
    } catch (e) {
      if (errCode(e) === "EEXIST") continue // a peer made it; it keeps its own mode
      throw e
    }
    if (process.platform !== "win32") chmodSync(m, dirMode)
  }
}

/**
 * Write `data` to `path` atomically: a same-directory temp file created exclusively with `mode`,
 * fsynced, then renamed over `path`. Readers see the old file or the new one, never a partial one.
 */
export function atomicWrite(path: string, data: string | Uint8Array, opts: AtomicWriteOptions = {}): void {
  const mode = opts.mode ?? 0o600
  const dirMode = opts.dirMode ?? 0o700
  invariant(typeof path === "string" && path.length > 0, "atomicWrite: path must be a non-empty string")
  invariant(isAbsolute(path), `atomicWrite: path must be absolute, got ${JSON.stringify(path)}`)
  invariant(Number.isInteger(mode) && mode >= 0 && mode <= 0o777, `atomicWrite: file mode must be within 0..0o777, got 0o${mode.toString(8)}`)
  invariant(Number.isInteger(dirMode) && dirMode >= 0o700 && dirMode <= 0o777, `atomicWrite: dirMode must be within 0o700..0o777, got 0o${dirMode.toString(8)}`)
  invariant(typeof data === "string" || data instanceof Uint8Array, "atomicWrite: data must be a string or bytes")

  const dir = dirname(path)
  ensureDir(dir, dirMode)

  const bytes = typeof data === "string" ? Buffer.from(data, "utf8") : data
  const tmp = join(dir, `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`)
  const fd = openSync(tmp, "wx", mode)
  let renamed = false
  try {
    try {
      fchmodSync(fd, mode)
      let off = 0
      while (off < bytes.length) off += writeSync(fd, bytes, off, bytes.length - off)
      fsyncSync(fd)
      if (process.platform !== "win32") { invariant((fstatSync(fd).mode & 0o777) === mode, `atomicWrite: temp file mode is not 0o${mode.toString(8)}`) }
    } finally {
      closeSync(fd)
    }
    renameSync(tmp, path)
    renamed = true
  } finally {
    if (!renamed) { try { unlinkSync(tmp) } catch { /* already gone */ } }
  }
}

// ── withLock ─────────────────────────────────────────────────────────────────

export interface LockHolder {
  pid: number
  host: string
  nonce: string
  /** The exact bytes written to the lock file; release and stale-break compare against these. */
  raw: string
}

export interface LockObservation {
  /** The lock file's bytes when observed. */
  raw: string
  /** Inode when observed, so a rewritten lock with identical bytes is still a different lock. */
  ino: number
  /** True when the holder is provably gone (same host, pid not running) or the lock is older than staleMs. */
  stale: boolean
}

export interface WithLockOptions {
  /** How long to wait for a live holder. Default 5000 ms; 0 tries once. */
  timeoutMs?: number
  /** Age after which a lock whose holder cannot be checked counts as stale. Default 5 minutes. */
  staleMs?: number
  /** Pause between attempts. Default 50 ms. */
  retryMs?: number
}

export class LockBusyError extends Error {
  constructor(public readonly lockPath: string, public readonly holder: string | null) {
    super(`lock busy: ${lockPath}`)
    this.name = "LockBusyError"
  }
}

const DEFAULT_TIMEOUT_MS = 5_000
const DEFAULT_STALE_MS = 5 * 60_000
const DEFAULT_RETRY_MS = 50
/** A `.break` guard older than this was left by a crashed breaker and may be cleared. */
const BREAKER_STALE_MS = 30_000

function sleepSync(ms: number): void {
  if (ms > 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function pidAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true } catch (e) { return errCode(e) === "EPERM" }
}

function readLock(lockPath: string): { raw: string; ino: number; mtimeMs: number } | null {
  let fd: number
  try { fd = openSync(lockPath, "r") } catch (e) {
    if (errCode(e) === "ENOENT") return null
    throw e
  }
  try {
    const st = fstatSync(fd)
    return { raw: readFileSync(fd, "utf8"), ino: st.ino, mtimeMs: st.mtimeMs }
  } finally {
    closeSync(fd)
  }
}

/** Read the lock and judge whether its holder is gone. Null when there is no lock. */
function observe(lockPath: string, staleMs: number): LockObservation | null {
  const seen = readLock(lockPath)
  if (!seen) return null
  let stale = Date.now() - seen.mtimeMs > staleMs
  try {
    const h = JSON.parse(seen.raw) as Partial<LockHolder>
    if (typeof h.pid === "number" && Number.isInteger(h.pid) && h.pid > 0 && h.host === hostname()) {
      stale = !pidAlive(h.pid)
    }
  } catch { /* unparseable: judged by age alone */ }
  return { raw: seen.raw, ino: seen.ino, stale }
}

/** Take the lock if nobody holds it: the identity is written to a temp file, then hard-linked into
 * place, which fails if the lock exists. Null when it is held. */
function tryAcquire(lockPath: string): LockHolder | null {
  invariant(typeof lockPath === "string" && isAbsolute(lockPath), `withLock: lock path must be absolute, got ${JSON.stringify(lockPath)}`)
  ensureDir(dirname(lockPath), 0o700)
  const identity = { pid: process.pid, host: hostname(), nonce: randomUUID() }
  const raw = JSON.stringify(identity)
  const tmp = `${lockPath}.${identity.nonce}.tmp`
  const fd = openSync(tmp, "wx", 0o600)
  try {
    try {
      fchmodSync(fd, 0o600)
      writeSync(fd, raw)
      fsyncSync(fd)
    } finally {
      closeSync(fd)
    }
    try {
      linkSync(tmp, lockPath)
    } catch (e) {
      if (errCode(e) === "EEXIST") return null
      throw e
    }
    return { ...identity, raw }
  } finally {
    try { unlinkSync(tmp) } catch { /* already gone */ }
  }
}

function sameLock(a: { raw: string; ino: number } | null, b: LockObservation): boolean {
  return !!a && a.raw === b.raw && a.ino === b.ino
}

/** Remove a lock judged stale, only if it is still exactly the lock that was observed. One breaker at a
 * time (a `.break` guard); the lock is renamed aside and compared again, and put back on a mismatch.
 * True when the observed lock was removed. */
function breakStale(lockPath: string, seen: LockObservation): boolean {
  invariant(seen && typeof seen.raw === "string" && seen.stale, "withLock: breakStale needs a stale observation")
  const breaker = `${lockPath}.break`
  let bfd: number
  try {
    bfd = openSync(breaker, "wx", 0o600)
  } catch (e) {
    if (errCode(e) !== "EEXIST") throw e
    try {
      if (Date.now() - statSync(breaker).mtimeMs > BREAKER_STALE_MS) unlinkSync(breaker)
    } catch { /* gone already */ }
    return false
  }
  closeSync(bfd)
  try {
    if (!sameLock(readLock(lockPath), seen)) return false
    const aside = `${lockPath}.stale.${randomUUID()}`
    try { renameSync(lockPath, aside) } catch (e) {
      if (errCode(e) === "ENOENT") return false
      throw e
    }
    const moved = readLock(aside)
    if (moved && sameLock(moved, seen)) {
      unlinkSync(aside)
      return true
    }
    // Someone else's lock was moved: put it back unless a new holder already took the path.
    try { linkSync(aside, lockPath) } catch { /* path retaken; the moved lock's holder will find it gone */ }
    try { unlinkSync(aside) } catch { /* gone */ }
    return false
  } finally {
    try { unlinkSync(breaker) } catch { /* gone */ }
  }
}

/** Release a lock this holder took. Never removes a lock someone else now holds. */
function release(lockPath: string, holder: LockHolder): void {
  invariant(holder && typeof holder.raw === "string" && typeof holder.nonce === "string", "withLock: release needs the holder returned by tryAcquire")
  const now = readLock(lockPath)
  if (!now || now.raw !== holder.raw) return
  const aside = `${lockPath}.rel.${holder.nonce}`
  try { renameSync(lockPath, aside) } catch (e) {
    if (errCode(e) === "ENOENT") return
    throw e
  }
  const moved = readLock(aside)
  if (moved && moved.raw !== holder.raw) {
    try { linkSync(aside, lockPath) } catch { /* path retaken */ }
  }
  try { unlinkSync(aside) } catch { /* gone */ }
}

/**
 * Run `fn` while holding the exclusive lock at `lockPath`. Waits up to `timeoutMs` for a live holder,
 * breaks a stale one, and throws LockBusyError when the wait runs out. The lock is released when `fn`
 * returns or throws, or, for an async `fn`, when its promise settles.
 */
export function withLock<T>(lockPath: string, fn: () => T, opts: WithLockOptions = {}): T {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const staleMs = opts.staleMs ?? DEFAULT_STALE_MS
  const retryMs = opts.retryMs ?? DEFAULT_RETRY_MS
  invariant(typeof fn === "function", "withLock: fn must be a function")
  invariant(timeoutMs >= 0 && staleMs > 0 && retryMs >= 0, "withLock: timeoutMs and retryMs must be >= 0, staleMs > 0")

  const deadline = Date.now() + timeoutMs
  let holder: LockHolder | null = null
  for (let spins = 0; !holder; spins++) {
    holder = tryAcquire(lockPath)
    if (holder) break
    const seen = observe(lockPath, staleMs)
    if (seen === null && spins < 1000) continue // released between our two looks
    if (seen?.stale && breakStale(lockPath, seen)) continue
    if (Date.now() >= deadline) throw new LockBusyError(lockPath, seen?.raw ?? null)
    sleepSync(Math.min(retryMs, Math.max(0, deadline - Date.now())))
  }

  const held = holder
  let result: T
  try {
    result = fn()
  } catch (e) {
    release(lockPath, held)
    throw e
  }
  if (result && typeof (result as { then?: unknown }).then === "function") {
    return (result as unknown as Promise<unknown>).finally(() => release(lockPath, held)) as unknown as T
  }
  release(lockPath, held)
  return result
}

/** The lock steps, exported for race tests that interleave two recoverers deterministically. */
export const _lockInternals = { observe, breakStale, tryAcquire, release }

// ── redaction ────────────────────────────────────────────────────────────────

/** `text` with every secret-shaped value, credential-labelled value, PIN, passphrase and verification
 * code replaced by [REDACTED]. Pure and idempotent; run it on the whole text before any cut. */
export function redact(text: string): string {
  return redactLabelled(text)
}

/** A structured value with secret-keyed leaves (password, token, passphrase, PIN, …) replaced and
 * every other string leaf run through `redact`. Cycles become [CIRCULAR]. Pure. */
export function redactStructured(value: unknown): unknown {
  return labelRedactStructured(value)
}

/** True when a message carries a one-time code (numeric or alphanumeric). Filters drop these before
 * anything reads them. */
export function isVerificationCode(text: string): boolean {
  return labelIsVerificationCode(text)
}
