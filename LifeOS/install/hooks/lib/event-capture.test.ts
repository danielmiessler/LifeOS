/**
 * appendPrivateRecord writes a JSONL row into an owner-only directory. On Windows stat reports
 * 0o666, so the 0700/0600 assertions threw after the row had already been written.
 * Run: bun test hooks/lib/event-capture.test.ts
 */
import { expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { appendPrivateRecord } from './event-capture';
import { hasPosixModes } from './portable-path';

test('appendPrivateRecord appends one row and keeps the file private', () => {
  const base = mkdtempSync(join(tmpdir(), 'event-capture-'));
  try {
    const file = join(base, 'records', 'events.jsonl');
    appendPrivateRecord(file, { event: 'a' });
    appendPrivateRecord(file, { event: 'b' });
    expect(readFileSync(file, 'utf-8').trim().split('\n').map((l) => JSON.parse(l).event)).toEqual(['a', 'b']);
    if (hasPosixModes()) expect(statSync(file).mode & 0o777).toBe(0o600);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
