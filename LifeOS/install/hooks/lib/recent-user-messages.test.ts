import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { recentUserMessages, conversationContext } from "./recent-user-messages";

const u = (content: unknown, extra: object = {}) => JSON.stringify({ type: "user", message: { role: "user", content }, ...extra });
const a = (t: string) => JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: t }] } });

function transcript(lines: string[]): string {
  const p = join(mkdtempSync(join(tmpdir(), "tr-")), "t.jsonl");
  writeFileSync(p, lines.join("\n") + "\n");
  return p;
}

test("query = current prompt + 3 previous text messages, newest first, skipping everything else", () => {
  const p = transcript([
    u("old message zero"),
    a("reply"),
    u("first about the queue"),
    u([{ type: "tool_result", tool_use_id: "x", content: "TOOL_RESULT" }]),
    u("<task-notification>TASK_NOTIF</task-notification>"),
    u("<system-reminder>SYSTEM_REMINDER</system-reminder>"),
    u("hook output", { isMeta: true }),
    u("<lifeos-ground>HOOK_BLOCK</lifeos-ground>"),
    u([{ type: "text", text: "second with a text block" }, { type: "image", source: {} }]),
    a("another reply"),
    u("third about the worker"),
    u("fourth and current"), // the transcript may already hold the current prompt
  ]);
  expect(recentUserMessages(p, 3, "fourth and current")).toEqual(["first about the queue", "second with a text block", "third about the worker"]);
  expect(conversationContext("fourth and current", p)).toBe("third about the worker\nsecond with a text block\nfirst about the queue");
  const ctx = conversationContext("fourth and current", p);
  for (const t of ["fourth and current", "old message zero", "TOOL_RESULT", "TASK_NOTIF", "SYSTEM_REMINDER", "HOOK_BLOCK", "hook output"]) expect(ctx).not.toContain(t);
});

test("a missing or invalid transcript never throws", () => {
  expect(recentUserMessages(undefined)).toEqual([]);
  expect(recentUserMessages("/does/not/exist.jsonl")).toEqual([]);
  expect(conversationContext("hi", "/does/not/exist.jsonl")).toBe("");
});
