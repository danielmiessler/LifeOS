/**
 * TelegramCallbacks.test.ts — fixture-based tests for the JSONL reader.
 * Run: `bun test Releases/v5.0.0/.claude/PAI/TOOLS/TelegramCallbacks.test.ts`
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { waitForCallback } from "./TelegramCallbacks";

let tmp: string;
let logPath: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "tg-cb-"));
  logPath = join(tmp, "callbacks.jsonl");
});
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function writeEntry(updateId: number, data: string, opts: { messageId?: number; chatId?: number } = {}) {
  const entry = {
    update_id: updateId,
    ts: Date.now(),
    callback_query_id: `cbid-${updateId}`,
    from_id: 12345,
    from_username: "tester",
    message_id: opts.messageId ?? 100 + updateId,
    chat_id: opts.chatId ?? 9999,
    data,
  };
  appendFileSync(logPath, JSON.stringify(entry) + "\n");
}

describe("waitForCallback", () => {
  test("returns matching entry when predicate hits", async () => {
    writeEntry(1, "approve:abc");
    writeEntry(2, "skip:abc");
    writeEntry(3, "approve:xyz");
    const cb = await waitForCallback({
      timeoutMs: 200,
      pollMs: 20,
      predicate: (e) => e.data === "skip:abc",
      sinceUpdateId: 0,
      path: logPath,
    });
    expect(cb).not.toBeNull();
    expect(cb!.updateId).toBe(2);
    expect(cb!.data).toBe("skip:abc");
    expect(cb!.fromId).toBe(12345);
  });

  test("returns null on timeout when nothing matches", async () => {
    writeEntry(1, "approve:abc");
    const cb = await waitForCallback({
      timeoutMs: 100,
      pollMs: 20,
      predicate: (e) => e.data === "never:matches",
      sinceUpdateId: 0,
      path: logPath,
    });
    expect(cb).toBeNull();
  });

  test("sinceUpdateId skips already-processed entries", async () => {
    writeEntry(1, "approve:abc");
    writeEntry(2, "approve:abc");
    writeEntry(3, "approve:abc");
    const cb = await waitForCallback({
      timeoutMs: 100,
      pollMs: 20,
      predicate: (e) => e.data === "approve:abc",
      sinceUpdateId: 2,
      path: logPath,
    });
    expect(cb).not.toBeNull();
    expect(cb!.updateId).toBe(3);
  });

  test("default offset starts at EOF — does not replay pre-existing entries", async () => {
    writeEntry(1, "stale:1");
    writeEntry(2, "stale:2");
    const promise = waitForCallback({
      timeoutMs: 200,
      pollMs: 20,
      predicate: (e) => e.data.startsWith("fresh:"),
      path: logPath,
    });
    setTimeout(() => writeEntry(3, "fresh:3"), 50);
    const cb = await promise;
    expect(cb).not.toBeNull();
    expect(cb!.updateId).toBe(3);
  });

  test("malformed JSON line is skipped, others still parsed", async () => {
    writeEntry(1, "good:1");
    writeFileSync(logPath, "{not valid json\n", { flag: "a" });
    writeEntry(2, "good:2");
    const cb = await waitForCallback({
      timeoutMs: 100,
      pollMs: 20,
      predicate: (e) => e.data === "good:2",
      sinceUpdateId: 0,
      path: logPath,
    });
    expect(cb).not.toBeNull();
    expect(cb!.updateId).toBe(2);
  });

  test("missing log file → returns null on timeout, no crash", async () => {
    const missing = join(tmp, "does-not-exist.jsonl");
    const cb = await waitForCallback({
      timeoutMs: 80,
      pollMs: 20,
      predicate: () => true,
      path: missing,
    });
    expect(cb).toBeNull();
  });
});
