// work-events-stat-race.test.ts — deterministic reproduction of the stat/read race
// in replayOntoSnapshot.
//
// Bug: replayOntoSnapshot() measures the log size with stat(), then reads the
// whole file and replays from `offset` to the end of the buffer. Appends happen
// outside the events lock, so an event written between the stat and the read is
// "included in the replay but not covered by the returned offset". On the next
// replay that event is folded a second time, and if an offset-advance was emitted
// in the meantime it can roll a field back to a stale value.
//
// Fix: subarray(offset, min(size, buf.length)) — the replayed range and the
// returned offset always agree.
//
// Reproduction: mock only statSync to simulate "the file grew after the stat".
// The dynamic import must come after mock.module, so this lives in its own file.
//
// Run: bun test hooks/tests/work-events-stat-race.test.ts

import { test, expect, mock } from 'bun:test';
import * as realFs from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const FIX = join(tmpdir(), `work-events-statrace-${process.pid}`);
const LOG = join(FIX, 'work-events.jsonl');

test('stat -> append -> read window: events past the measured size are excluded from the replay and match the returned offset', async () => {
  realFs.rmSync(FIX, { recursive: true, force: true });
  realFs.mkdirSync(FIX, { recursive: true });

  const evA = JSON.stringify({ v: 1, ts: 't1', slug: 'a', op: 'upsert', src: 'test', fields: { phase: 'execute' } }) + '\n';
  const evB = JSON.stringify({ v: 1, ts: 't2', slug: 'a', op: 'upsert', src: 'test', fields: { phase: 'starting' } }) + '\n';
  realFs.writeFileSync(LOG, evA + evB); // the real file holds A+B (B = the event appended after the stat)
  const sizeAtStat = Buffer.byteLength(evA); // at stat time only A existed

  // Intercept statSync for LOG so it reports "the size up to A" — reproducing the
  // window where B was appended just after the stat. mock.module also patches the
  // existing static imports (realFs included), so capture the original statSync by
  // value before patching to avoid infinite recursion (fake -> patched realFs.statSync -> fake).
  const origStatSync = realFs.statSync;
  const fakeStatSync = (p: any, ...rest: any[]) => {
    const st = origStatSync(p, ...rest);
    if (String(p) === LOG) return { ...st, size: sizeAtStat };
    return st;
  };
  // bun's 'fs' interop exposes both named and default paths, so cover both.
  mock.module('fs', () => ({ ...realFs, statSync: fakeStatSync, default: { ...realFs, statSync: fakeStatSync } }));
  const { replayOntoSnapshot } = await import('../lib/work-events');

  const { registry, offset } = replayOntoSnapshot({ sessions: {} } as any, LOG);

  // Before the fix: B (starting) is replayed but offset stays at sizeAtStat, so B
  // is double-applied on the next replay.
  // After the fix: the replay is clamped to the measured size (A/execute only) and
  // offset is sizeAtStat — consistent.
  expect(registry.sessions.a.phase).toBe('execute');
  expect(offset).toBe(sizeAtStat);

  mock.restore();
  realFs.rmSync(FIX, { recursive: true, force: true });
});
