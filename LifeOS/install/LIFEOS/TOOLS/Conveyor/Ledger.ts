/**
 * Conveyor Ledger - append-only content pipeline event log.
 *
 * Write path (writers): appendEvents() writes one JSONL batch append.
 * Read path (readers): readState() parses the whole log and folds from zero.
 *
 * Invariants:
 *   - File order is authoritative. The reducer never sorts by timestamp.
 *   - foldEvents() is pure: returns a new object, never mutates base, never
 *     consults clocks.
 *   - A torn trailing line (crash mid-append) is skipped silently; a corrupt
 *     MIDDLE line is skipped and reported through onAnomaly.
 *   - Events without a non-empty id, or without a valid op, are dropped before
 *     append and ignored during fold.
 *   - No snapshot, compaction, or lock: the log stays small enough to replay.
 */

import { appendFileSync, mkdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';
import { claudeDir } from "../lifeos-root";

// Derivative legs per the ratified produce map (master ISA D-12):
// youtube = long-form UL-bumper edit + full-metadata upload; shorts = _VIDEO Clips;
// social = _SOCIALPOST → _WRITING audit → _BROADCAST payloads; omny = podcast audio;
// discord = community post.
export const LEGS = ['youtube', 'shorts', 'social', 'omny', 'discord'] as const;
export type Leg = typeof LEGS[number];
export type LegStatus = 'pending' | 'running' | 'done' | 'failed' | 'changes-requested';
export type Stage = 'inbox' | 'prep' | 'produce' | 'review' | 'publishing' | 'done';

export interface ContentEvent {
  v: 1;
  ts: string;
  id: string;
  op: 'upsert' | 'delete';
  fields?: Record<string, unknown>;
  unset?: string[];
  src: string;
}

export interface ContentItem {
  id: string;
  path: string;
  title: string;
  type: string;
  content_hash: string;
  stage: Stage;
  legs: Record<Leg, LegStatus>;
  created: string;
  updated: string;
  [k: string]: unknown;
}

export interface ContentState {
  items: Record<string, ContentItem>;
}

// -- Paths ------------------------------------------------------------------

export function eventsPath(): string {
  return join(
    process.env.LIFEOS_DIR || join(claudeDir(), 'LIFEOS'),
    'MEMORY',
    'STATE',
    'content-pipeline',
    'events.jsonl',
  );
}

// -- Pure core ---------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isValidEvent(value: unknown): value is ContentEvent {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string' || value.id.length === 0) return false;
  return value.op === 'upsert' || value.op === 'delete';
}

/**
 * Fold events onto a base state, in the order given (file order).
 * Pure: returns a new object; never mutates `base`; never consults clocks.
 */
export function foldEvents(base: ContentState, events: ContentEvent[]): ContentState {
  const items: Record<string, ContentItem> = {};
  const baseItems = isRecord(base.items) ? base.items : {};
  for (const [id, item] of Object.entries(baseItems)) {
    if (isRecord(item)) items[id] = { ...(item as ContentItem) };
  }

  for (const event of events) {
    if (!isValidEvent(event)) continue;
    if (event.op === 'delete') {
      delete items[event.id];
      continue;
    }
    const previous = items[event.id] ? { ...items[event.id] } : ({ id: event.id } as ContentItem);
    const fields = isRecord(event.fields) ? event.fields : {};
    const next = { ...previous, ...fields } as ContentItem;
    if (Array.isArray(event.unset)) {
      for (const key of event.unset) {
        if (typeof key === 'string') delete (next as Record<string, unknown>)[key];
      }
    }
    items[event.id] = next;
  }

  return { items };
}

/**
 * Parse raw log text into events. A final unterminated line is treated as a
 * torn tail and skipped silently; any other unparseable line is an anomaly.
 */
export function parseEventLines(
  raw: string,
  onAnomaly?: (line: string, index: number) => void,
): ContentEvent[] {
  const events: ContentEvent[] = [];
  const lines = raw.split('\n');
  const lastIdx = lines.length - 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    try {
      const parsed = JSON.parse(line);
      if (isRecord(parsed)) events.push(parsed as unknown as ContentEvent);
    } catch {
      const isTornTail = i === lastIdx && !raw.endsWith('\n');
      if (!isTornTail) onAnomaly?.(line, i);
    }
  }

  return events;
}

// -- IO layer ----------------------------------------------------------------

export function appendEvents(events: ContentEvent[], logPath = eventsPath()): number {
  const valid = events.filter(isValidEvent);
  if (valid.length === 0) return 0;
  mkdirSync(dirname(logPath), { recursive: true });
  appendFileSync(logPath, valid.map((event) => JSON.stringify(event)).join('\n') + '\n');
  return valid.length;
}

export function readState(logPath = eventsPath()): ContentState {
  try {
    const raw = readFileSync(logPath, 'utf-8');
    return foldEvents({ items: {} }, parseEventLines(raw));
  } catch {
    return { items: {} };
  }
}

// -- Constructors and lookup -------------------------------------------------

function pendingLegs(): Record<Leg, LegStatus> {
  const legs = {} as Record<Leg, LegStatus>;
  for (const leg of LEGS) legs[leg] = 'pending';
  return legs;
}

export function newItemEvent(input: {
  id: string;
  path: string;
  title: string;
  type: string;
  content_hash: string;
  src: string;
  extra?: Record<string, unknown>;
}): ContentEvent {
  const ts = new Date().toISOString();
  return {
    v: 1,
    ts,
    id: input.id,
    op: 'upsert',
    fields: {
      id: input.id,
      path: input.path,
      title: input.title,
      type: input.type,
      content_hash: input.content_hash,
      stage: 'inbox',
      legs: pendingLegs(),
      created: ts,
      updated: ts,
      ...(input.extra || {}),
    },
    src: input.src,
  };
}

export function findByHash(state: ContentState, content_hash: string): ContentItem | undefined {
  for (const item of Object.values(state.items)) {
    if (item.content_hash === content_hash) return item;
  }
  return undefined;
}
