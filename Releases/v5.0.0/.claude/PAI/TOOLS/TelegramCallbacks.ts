/**
 * TelegramCallbacks.ts — consumer-side helper for the Pulse Telegram callback
 * bridge.
 *
 * Pulse's Telegram daemon (see PULSE/modules/telegram.ts) forwards every
 * inline-keyboard `callback_query` press to a JSONL side-channel at
 * `~/.claude/PAI/PULSE/state/telegram/callbacks.jsonl`. Any PAI worker that
 * needs to ask the user a yes/no via `@<DA>_bot` reads that file with this
 * helper.
 *
 * See DOCUMENTATION/Notifications/TelegramCallbacks.md for the producer-side
 * contract and the full security model.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const HOME = process.env.HOME ?? "";
const DEFAULT_CALLBACKS_LOG = join(HOME, ".claude", "PAI", "PULSE", "state", "telegram", "callbacks.jsonl");

export interface TelegramCallback {
  /** Telegram update_id — monotonic per bot. Use this for cross-run dedup. */
  updateId: number;
  /** Epoch ms when Pulse logged the press. */
  timestamp: number;
  /** Telegram callback_query id (already acked by Pulse). */
  id: string;
  /** Telegram user id of the presser (passes Pulse's allowedUsers gate). */
  fromId: number;
  fromUsername?: string;
  /** message_id of the message that owned the keyboard. */
  messageId?: number;
  chatId?: number;
  /** Raw callback_data string. UNTRUSTED — validate before acting. */
  data: string;
}

interface RawEntry {
  update_id?: unknown;
  ts?: unknown;
  callback_query_id?: unknown;
  from_id?: unknown;
  from_username?: unknown;
  message_id?: unknown;
  chat_id?: unknown;
  data?: unknown;
}

function parseEntry(line: string): TelegramCallback | null {
  let raw: RawEntry;
  try { raw = JSON.parse(line) as RawEntry; } catch { return null; }
  if (typeof raw.update_id !== "number" ||
      typeof raw.ts !== "number" ||
      typeof raw.callback_query_id !== "string" ||
      typeof raw.from_id !== "number" ||
      typeof raw.data !== "string") {
    return null;
  }
  return {
    updateId: raw.update_id,
    timestamp: raw.ts,
    id: raw.callback_query_id,
    fromId: raw.from_id,
    fromUsername: typeof raw.from_username === "string" ? raw.from_username : undefined,
    messageId: typeof raw.message_id === "number" ? raw.message_id : undefined,
    chatId: typeof raw.chat_id === "number" ? raw.chat_id : undefined,
    data: raw.data,
  };
}

interface ReadResult { entries: TelegramCallback[]; nextOffset: number }

function readEntriesAfter(path: string, byteOffset: number): ReadResult {
  if (!existsSync(path)) return { entries: [], nextOffset: 0 };
  const size = statSync(path).size;
  if (size <= byteOffset) return { entries: [], nextOffset: size };
  const slice = readFileSync(path).subarray(byteOffset, size);
  const text = slice.toString("utf8");
  const entries: TelegramCallback[] = [];
  let consumed = 0;
  for (const rawLine of text.split("\n")) {
    if (rawLine.length === 0) { consumed += 1; continue; }
    consumed += Buffer.byteLength(rawLine, "utf8") + 1;
    const parsed = parseEntry(rawLine);
    if (parsed) entries.push(parsed);
    else process.stderr.write(`[TelegramCallbacks] skipping malformed line at offset ${byteOffset + consumed}\n`);
  }
  return { entries, nextOffset: byteOffset + Math.min(consumed, slice.length) };
}

export interface WaitOptions {
  /** Hard ceiling. Returns null on timeout. */
  timeoutMs: number;
  /** Match function — return true on the entry you want. */
  predicate: (cb: TelegramCallback) => boolean;
  /** File-poll cadence in ms. Default 1500. */
  pollMs?: number;
  /**
   * Resume across restarts: skip entries whose `updateId` is ≤ this value.
   * Persist the returned entry's `updateId` and pass it back next time.
   * If omitted, helper starts at end-of-file (no replay of stale presses).
   */
  sinceUpdateId?: number;
  /** Override the JSONL path. Defaults to ~/.claude/PAI/PULSE/state/telegram/callbacks.jsonl. */
  path?: string;
}

/**
 * Tail the Pulse callback JSONL until `predicate` matches an entry or
 * `timeoutMs` elapses. Returns the matching callback (already acked by
 * Pulse) or null on timeout.
 */
export async function waitForCallback(opts: WaitOptions): Promise<TelegramCallback | null> {
  const path = opts.path ?? DEFAULT_CALLBACKS_LOG;
  const pollMs = opts.pollMs ?? 1500;
  let offset: number;
  if (opts.sinceUpdateId === undefined) {
    offset = existsSync(path) ? statSync(path).size : 0;
  } else {
    offset = 0;
  }
  const deadline = Date.now() + opts.timeoutMs;
  while (Date.now() < deadline) {
    const { entries, nextOffset } = readEntriesAfter(path, offset);
    offset = nextOffset;
    for (const e of entries) {
      if (opts.sinceUpdateId !== undefined && e.updateId <= opts.sinceUpdateId) continue;
      if (opts.predicate(e)) return e;
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return null;
}

export { DEFAULT_CALLBACKS_LOG };
