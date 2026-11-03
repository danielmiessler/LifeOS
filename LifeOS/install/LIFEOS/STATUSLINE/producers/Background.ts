import { mkdirSync, readdirSync, rmSync, rmdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, sep } from "node:path";
import { invariant, InvariantViolation } from "../../TOOLS/Invariant";
import { mtime, readText, type Cache } from "../Cache";

/** Live subagent transcripts, shared by every session through a 10-second cache and a stale-after-60-second mkdir lock. */
const memo = new WeakMap<Cache, string[]>();

/** find's `-mmin -2`: the age, rounded up to a whole minute, is under two. */
function underTwoMinutes(path: string, now: number): boolean {
  const at = mtime(path);
  return at > 0 && Math.ceil(Math.max(0, now - at) / 60) < 2;
}

/** `projects/*\/*\/subagents/agent-*.jsonl` at exactly depth 4, modified in the last two minutes. Null when the tree cannot be read. */
function findLiveTranscripts(projects: string, now: number): string[] | null {
  let top;
  try { top = readdirSync(projects, { withFileTypes: true }); } catch { return null; }
  const found: string[] = [];
  for (const project of top) {
    if (!project.isDirectory()) continue;
    let sessions;
    try { sessions = readdirSync(join(projects, project.name), { withFileTypes: true }); } catch { continue; }
    for (const session of sessions) {
      if (!session.isDirectory()) continue;
      const dir = join(projects, project.name, session.name, "subagents");
      let files;
      try { files = readdirSync(dir, { withFileTypes: true }); } catch { continue; }
      for (const file of files) {
        if (file.isFile() && /^agent-.*\.jsonl$/.test(file.name) && underTwoMinutes(join(dir, file.name), now)) found.push(join(dir, file.name));
      }
    }
  }
  return found;
}

/**
 * Whether any Claude Code session on this machine wrote to its transcript within `window` seconds: a main transcript
 * (projects/<project>/<session>.jsonl) or a live subagent. Drives the shared usage TTL, which no longer depends on whichever
 * session happened to render.
 */
export function anySessionActive(state: { cache: Cache; now: number; claude: string }, window: number): boolean {
  if (backgroundTranscripts(state).length > 0) return true;
  const projects = join(state.claude, "projects");
  let top;
  try { top = readdirSync(projects, { withFileTypes: true }); } catch { return false; }
  for (const project of top) {
    if (!project.isDirectory()) continue;
    let files;
    try { files = readdirSync(join(projects, project.name), { withFileTypes: true }); } catch { continue; }
    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith(".jsonl")) continue;
      const at = mtime(join(projects, project.name, file.name));
      if (at > 0 && state.now - at <= window) return true;
    }
  }
  return false;
}

export function backgroundTranscripts(state: { cache: Cache; now: number; claude: string }): string[] {
  const { cache, now } = state;
  const known = memo.get(cache);
  if (known) return known;
  const file = "bg-agents.txt", lock = "bg-agents.lock";
  if (cache.text(file) === null || now - mtime(cache.path(file)) > 10) {
    const lockPath = cache.path(lock);
    if (mtime(lockPath) > 0 && now - mtime(lockPath) > 60) rmSync(lockPath, { recursive: true, force: true });
    let held = false;
    try { mkdirSync(lockPath, { mode: 0o700 }); held = true; } catch { /* another writer holds it */ }
    if (held) {
      try {
        const found = findLiveTranscripts(join(state.claude, "projects"), now);
        if (found !== null) cache.put(file, found.map((line) => `${line}\n`).join(""));
      } finally {
        try { rmdirSync(lockPath); } catch { /* already gone */ }
      }
    }
  }
  const lines = (cache.text(file) ?? "").split("\n").filter((line) => line !== "");
  memo.set(cache, lines);
  return lines;
}

/** An mkdir mutex held by one refresh. `abandon` leaves the directory in place so its own age rule throttles the next attempt. */
export interface Lock { readonly path: string; release(): void; abandon(): void }
const held = new Set<Lock>();

function tryMkdir(path: string): boolean {
  try { mkdirSync(path, { mode: 0o700 }); return true; } catch { return false; }
}

/**
 * Bash's tide/cosmos/location lock: skip while the holder is younger than `staleAfter`, otherwise take over. The
 * taker writes an owner token inside, and release removes the directory only while that token is still its own: a peer
 * that took a stale lock over (the bash's rmdir + mkdir, or another refresher) keeps it.
 */
export function acquireLock(cache: Cache, name: string, staleAfter: number): Lock | null {
  const path = cache.path(name);
  // dirname, not a "/" prefix: on Windows cache.path() joins with "\\" (the prefix check failed every refresh there).
  invariant(dirname(path) === cache.root && staleAfter > 0, "refresh locks live directly in the cache root");
  const ownerFile = join(path, "owner");
  if (!tryMkdir(path)) {
    if (cache.now - mtime(path) < staleAfter) return null;
    rmSync(ownerFile, { force: true });
    try { rmdirSync(path); } catch { /* not empty or already reaped */ }
    if (!tryMkdir(path)) return null;
  }
  const token = `${process.pid}.${crypto.randomUUID()}`;
  // A peer that reaped and re-took the directory between our mkdir and this write owns it now.
  try { writeFileSync(ownerFile, `${token}\n`, { mode: 0o600, flag: "wx" }); } catch { return null; }
  const lock: Lock = {
    path,
    release() {
      if (!held.delete(lock)) return;
      invariant(path.startsWith(cache.root + sep), "a lock release stays in the cache root");
      if (readText(ownerFile)?.trim() !== token) return;
      rmSync(ownerFile, { force: true });
      try { rmdirSync(path); } catch { /* already gone */ }
    },
    abandon() { held.delete(lock); },
  };
  held.add(lock);
  return lock;
}

/** Release every lock this process still holds. Called on exit and from the refresher's signal handlers. */
export function releaseHeldLocks(): void {
  for (const lock of [...held]) lock.release();
}

// A hard exit mid-refresh must not leak a lock the next refresh would have to wait out.
process.on("exit", releaseHeldLocks);

export interface RefreshJob { name: string; run: () => Promise<void> }
export interface RefreshReport { ran: string[]; timedOut: string[]; failed: Array<{ name: string; error: string }> }

/**
 * Await every job, concurrently, until `deadlineMs`. A job still running at the deadline is left behind and its lock is
 * abandoned in place, so the lock's own staleness rule (30/90/15 seconds) throttles a retry. Nothing is detached.
 */
export async function runRefreshes(jobs: readonly RefreshJob[], deadlineMs: number): Promise<RefreshReport> {
  const report: RefreshReport = { ran: [], timedOut: [], failed: [] };
  if (jobs.length === 0) return report;
  const pending = new Set(jobs.map((job) => job.name));
  let violation: InvariantViolation | null = null;
  const work = jobs.map(async (job) => {
    try { await job.run(); report.ran.push(job.name); }
    catch (error) {
      // An impossible state fails loud: it is never filed as an ordinary refresh failure.
      if (error instanceof InvariantViolation) { violation ??= error; return; }
      report.failed.push({ name: job.name, error: error instanceof Error ? error.message : String(error) });
    }
    finally { pending.delete(job.name); }
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    Promise.allSettled(work),
    new Promise<void>((resolve) => { timer = setTimeout(resolve, deadlineMs); }),
  ]);
  clearTimeout(timer);
  if (violation !== null) throw violation;
  report.timedOut = [...pending];
  for (const lock of [...held]) lock.abandon();
  return report;
}

/** A mutex whose holder writes its pid. `reapable` decides, from the recorded owner and the lock's age, whether an existing holder is dead. */
export function acquireOwnedLock(cache: Cache, name: string, reapable: (owner: number | null, age: number) => boolean): Lock | null {
  const path = cache.path(name);
  invariant(path.startsWith(cache.root + sep), "refresh locks live directly in the cache root");
  return acquireOwnedLockAt(path, cache.now, reapable);
}

/** The same mutex at an absolute path, for caches an environment variable moves out of the cache root. */
export function acquireOwnedLockAt(path: string, now: number, reapable: (owner: number | null, age: number) => boolean): Lock | null {
  invariant(isAbsolute(path) && path.endsWith(".lock"), "an owned lock is an absolute .lock directory");
  const pidFile = join(path, "pid");
  if (!tryMkdir(path)) {
    const text = readText(pidFile)?.trim() ?? "";
    const owner = /^\d+$/.test(text) && Number(text) > 0 ? Number(text) : null;
    if (!reapable(owner, now - mtime(path))) return null;
    rmSync(pidFile, { force: true });
    try { rmdirSync(path); } catch { /* not empty or already reaped */ }
    if (!tryMkdir(path)) return null;
  }
  writeFileSync(pidFile, `${process.pid}\n`, { mode: 0o600 });
  const lock: Lock = {
    path,
    release() {
      if (!held.delete(lock)) return;
      if (readText(pidFile)?.trim() === String(process.pid)) { rmSync(pidFile, { force: true }); try { rmdirSync(path); } catch { /* already gone */ } }
    },
    abandon() { held.delete(lock); },
  };
  held.add(lock);
  return lock;
}

/** True when a process with this pid exists (kill -0). */
export function alive(pid: number | null): boolean {
  if (pid === null) return false;
  try { process.kill(pid, 0); return true; } catch (error) { return (error as NodeJS.ErrnoException).code === "EPERM"; }
}
