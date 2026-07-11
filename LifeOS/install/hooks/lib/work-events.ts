/**
 * work-events — append-only event log + derived snapshot for work.json.
 *
 * Write path (writers): diff → appendWorkEvents() → foldToSnapshot() under lock.
 * Read path (readers):  readLiveRegistry() = snapshot + suffix replay. Never writes.
 *
 * Invariants (tested in hooks/work-events.test.ts):
 *   - File order is authoritative. The reducer never sorts by timestamp.
 *   - Replay is idempotent: re-applying a suffix converges to the same state,
 *     which is what makes the compaction crash window (snapshot written, log
 *     not yet truncated) safe.
 *   - A torn trailing line (crash mid-append) is skipped silently; a corrupt
 *     MIDDLE line is skipped and reported to work-anomalies.jsonl.
 *   - Events without a non-empty slug are rejected at append time.
 *
 * Concurrency primitives (first-principles checked 2026-06-10):
 *   - One appendFileSync call per event batch → O_APPEND offset placement is
 *     atomic per write() on local filesystems; no interleaved lines.
 *   - mkdir lock with mtime-based stale takeover; a skipped fold is safe
 *     because readers replay the suffix themselves.
 *   - Snapshot replace stays tmp+rename (atomic on same filesystem).
 */

import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs';
import { dirname, join } from 'path';
import { paiPath } from './paths';

export interface WorkEvent {
  v: 1;
  ts: string;
  slug: string;
  op: 'upsert' | 'delete';
  /** Changed/added fields for upsert. Values may legitimately be null. */
  fields?: Record<string, unknown>;
  /** Field names removed from the row (kept separate so null stays a value). */
  unset?: string[];
  /** sessionUUID when the row carries one — identity for forensics. */
  uuid?: string;
  /** Writer tag, e.g. 'AlgoPhase', 'ISASync', 'SessionCleanup'. */
  src: string;
}

export interface Registry {
  sessions: Record<string, any>;
}

export interface Snapshot extends Registry {
  _events_offset?: number;
  _folded_at?: string;
}

export function workEventsPath(): string {
  return paiPath('MEMORY', 'STATE', 'work-events.jsonl');
}
export function workSnapshotPath(): string {
  return paiPath('MEMORY', 'STATE', 'work.json');
}
function lockPath(logPath: string): string {
  return logPath + '.lock';
}
function anomalyPath(): string {
  return paiPath('MEMORY', 'OBSERVABILITY', 'work-anomalies.jsonl');
}

const LOCK_STALE_MS = 10_000;
/** Compact when the log grows past this many bytes. */
export const COMPACT_THRESHOLD_BYTES = 1_048_576;

// ── Pure core ──────────────────────────────────────────────────────────────

/**
 * Fold events onto a base registry, in the order given (file order).
 * Pure: returns a new object; never mutates `base`; never consults clocks.
 */
export function foldEvents(base: Registry, events: WorkEvent[]): Registry {
  const sessions: Record<string, any> = {};
  for (const [slug, row] of Object.entries(base.sessions || {})) {
    sessions[slug] = { ...(row as Record<string, unknown>) };
  }
  for (const ev of events) {
    if (!ev || typeof ev !== 'object') continue;
    if (typeof ev.slug !== 'string' || ev.slug.length === 0) continue;
    if (ev.op === 'delete') {
      delete sessions[ev.slug];
      continue;
    }
    if (ev.op === 'upsert') {
      const row = sessions[ev.slug] ?? {};
      if (ev.fields) Object.assign(row, ev.fields);
      if (Array.isArray(ev.unset)) for (const k of ev.unset) delete row[k];
      sessions[ev.slug] = row;
    }
  }
  return { sessions };
}

/**
 * Parse raw log text into events. A final unterminated line is treated as a
 * torn tail and skipped silently; any other unparseable line is an anomaly.
 */
export function parseEventLines(
  raw: string,
  onAnomaly?: (line: string, index: number) => void,
): WorkEvent[] {
  const out: WorkEvent[] = [];
  const lines = raw.split('\n');
  const lastIdx = lines.length - 1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    try {
      const ev = JSON.parse(line);
      if (ev && typeof ev === 'object') out.push(ev as WorkEvent);
    } catch {
      const isTornTail = i === lastIdx && !raw.endsWith('\n');
      if (!isTornTail) onAnomaly?.(line, i);
    }
  }
  return out;
}

/**
 * Field-level diff: what events turn `prev` into `next`?
 * Compares per-row, per-field (JSON-encoded equality).
 */
export function diffRegistry(prev: Registry, next: Registry, src: string): WorkEvent[] {
  const events: WorkEvent[] = [];
  const ts = new Date().toISOString();
  const prevSessions = prev.sessions || {};
  const nextSessions = next.sessions || {};

  for (const [slug, nextRow] of Object.entries(nextSessions) as [string, Record<string, unknown>][]) {
    const prevRow = (prevSessions[slug] ?? {}) as Record<string, unknown>;
    const fields: Record<string, unknown> = {};
    const unset: string[] = [];
    for (const [k, v] of Object.entries(nextRow)) {
      if (JSON.stringify(prevRow[k]) !== JSON.stringify(v)) fields[k] = v;
    }
    for (const k of Object.keys(prevRow)) {
      if (!(k in nextRow)) unset.push(k);
    }
    // Empty-row creation still needs an event (fc counterexample, seed
    // 1619301911: prev={}, next={"s-alpha":{}} produced zero events).
    const isNewRow = !(slug in prevSessions);
    if (!isNewRow && Object.keys(fields).length === 0 && unset.length === 0) continue;
    const ev: WorkEvent = { v: 1, ts, slug, op: 'upsert', src };
    if (Object.keys(fields).length) ev.fields = fields;
    if (unset.length) ev.unset = unset;
    const uuid = nextRow['sessionUUID'];
    if (typeof uuid === 'string' && uuid) ev.uuid = uuid;
    events.push(ev);
  }
  for (const slug of Object.keys(prevSessions)) {
    if (!(slug in nextSessions)) events.push({ v: 1, ts, slug, op: 'delete', src });
  }
  return events;
}

// ── IO layer ───────────────────────────────────────────────────────────────

function reportAnomaly(line: string, index: number, logPath: string): void {
  try {
    appendFileSync(
      anomalyPath(),
      JSON.stringify({
        ts: new Date().toISOString(),
        type: 'work-events.corrupt-line',
        log: logPath,
        index,
        line: line.slice(0, 200),
      }) + '\n',
    );
  } catch {
    /* observability must never break the write path */
  }
}

/** Append events (single write call). Slug-less events are dropped. */
export function appendWorkEvents(events: WorkEvent[], logPath = workEventsPath()): number {
  const valid = events.filter(
    (e) => e && typeof e.slug === 'string' && e.slug.length > 0 && (e.op === 'upsert' || e.op === 'delete'),
  );
  if (valid.length === 0) return 0;
  mkdirSync(dirname(logPath), { recursive: true });
  appendFileSync(logPath, valid.map((e) => JSON.stringify(e)).join('\n') + '\n');
  return valid.length;
}

function readSnapshot(snapPath: string): Snapshot {
  try {
    const data = JSON.parse(readFileSync(snapPath, 'utf-8'));
    return data && data.sessions ? data : { sessions: {} };
  } catch {
    return { sessions: {} };
  }
}

/**
 * Replay the log suffix beyond the snapshot's offset onto the snapshot.
 * If the recorded offset exceeds the log size (rotation/compaction), replay
 * from 0 — safe because the reducer is idempotent.
 */
export function replayOntoSnapshot(
  snapshot: Snapshot,
  logPath = workEventsPath(),
): { registry: Registry; offset: number } {
  let size = 0;
  try {
    size = statSync(logPath).size;
  } catch {
    return { registry: { sessions: snapshot.sessions || {} }, offset: 0 };
  }
  let offset = typeof snapshot._events_offset === 'number' ? snapshot._events_offset : 0;
  if (offset < 0 || offset > size) offset = 0;
  if (offset === size) return { registry: { sessions: snapshot.sessions || {} }, offset: size };
  let suffix = '';
  try {
    const buf = readFileSync(logPath);
    // Clamp the replay range to the size measured by stat() above. Appends happen
    // outside the lock, so the file can grow between the stat and this read. If we
    // replayed past the measured size while still returning that (smaller) size as
    // the offset, the extra events would be applied a second time on the next
    // replay — and an offset-advance emitted in the meantime could roll a field
    // back to a stale value. Events in [size, buf.length) sit after the returned
    // offset, so the next read/fold picks them up exactly once.
    suffix = buf.subarray(offset, Math.min(size, buf.length)).toString('utf-8');
  } catch {
    return { registry: { sessions: snapshot.sessions || {} }, offset };
  }
  const events = parseEventLines(suffix, (line, idx) => reportAnomaly(line, idx, logPath));
  return { registry: foldEvents({ sessions: snapshot.sessions || {} }, events), offset: size };
}

/** Live read: snapshot + suffix replay. NEVER writes (ISC-39). */
export function readLiveRegistry(
  snapPath = workSnapshotPath(),
  logPath = workEventsPath(),
): Registry {
  const snapshot = readSnapshot(snapPath);
  return replayOntoSnapshot(snapshot, logPath).registry;
}

/** Staleness = no progress: newest of dir mtime and heartbeat-file mtime. */
function lockAgeMs(lock: string): number {
  let newest = 0;
  try {
    newest = statSync(lock).mtimeMs;
  } catch {
    return -1; // lock gone
  }
  try {
    const hb = statSync(join(lock, '.heartbeat')).mtimeMs;
    if (hb > newest) newest = hb;
  } catch {}
  return Date.now() - newest;
}

function acquireLock(lock: string): boolean {
  try {
    mkdirSync(lock);
    return true;
  } catch {
    const age = lockAgeMs(lock);
    if (age === -1 || age > LOCK_STALE_MS) {
      // Stale (no heartbeat for LOCK_STALE_MS) or vanished — take over.
      try {
        rmSync(lock, { recursive: true, force: true });
      } catch {}
      try {
        mkdirSync(lock);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

function releaseLock(lock: string): void {
  try {
    rmSync(lock, { recursive: true, force: true });
  } catch {}
}

/**
 * Fold appended events into the snapshot (tmp+rename), under the mkdir lock.
 * On contention the fold is skipped — events stay in the log and the next
 * writer (or any live reader) picks them up. Compacts the log past the
 * threshold: snapshot is rewritten at offset 0 FIRST, then the log truncated;
 * a crash between the two double-applies an idempotent suffix (converges).
 */
export function foldToSnapshot(
  snapPath = workSnapshotPath(),
  logPath = workEventsPath(),
  thresholdBytes = COMPACT_THRESHOLD_BYTES,
): boolean {
  const lock = lockPath(logPath);
  if (!acquireLock(lock)) return false;
  try {
    // Heartbeat: refresh lock mtime so "stale" means "no progress for 10s",
    // not "acquired 10s ago" — protects a legitimately slow fold (large
    // suffix replay on a loaded machine) from a TOCTOU steal mid-write.
    try {
      writeFileSync(join(lock, '.heartbeat'), String(Date.now()));
    } catch {}
    const snapshot = readSnapshot(snapPath);
    const { registry, offset } = replayOntoSnapshot(snapshot, logPath);
    const compact = offset > thresholdBytes;
    const next: Snapshot = {
      sessions: registry.sessions,
      _events_offset: compact ? 0 : offset,
      _folded_at: new Date().toISOString(),
    };
    // Monotonic publish guard: if a concurrent folder (double-steal window)
    // already published a snapshot with a HIGHER offset against the same log,
    // renaming ours over it would regress state. Compaction (offset 0 +
    // truncate) is exempt — it deliberately resets the offset.
    if (!compact) {
      const current = readSnapshot(snapPath) as Snapshot;
      if (typeof current._events_offset === 'number' && current._events_offset > offset) {
        return false;
      }
    }
    mkdirSync(dirname(snapPath), { recursive: true });
    const tmp = snapPath + '.tmp';
    writeFileSync(tmp, JSON.stringify(next, null, 2));
    renameSync(tmp, snapPath);
    if (compact) {
      try {
        writeFileSync(logPath, '');
      } catch {}
    }
    return true;
  } catch {
    return false;
  } finally {
    releaseLock(lock);
  }
}
