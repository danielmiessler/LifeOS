// Tests for the learning-digest staleness guard.
//
// loadLearningDigest() previously showed the N most-recent entries per category
// with no date and no age cutoff, so a quiet category surfaced weeks-old signals
// as if current. These tests cover the date helpers and the end-to-end behavior
// (fresh shown, stale hidden) against throwaway temp fixtures.
//
// Run:  bun test learning-readback.test.ts
import { test, expect } from "bun:test";
import { mkdirSync, writeFileSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { parseLearningDate, isFresh, loadLearningDigest } from "../lib/learning-readback.ts";

test("parseLearningDate extracts the timestamp and rejects bad names", () => {
  const d = parseLearningDate("2026-06-20-091530_LEARNING_sentiment-rating-7.md");
  expect(d).not.toBeNull();
  expect(d!.getFullYear()).toBe(2026);
  expect(d!.getMonth()).toBe(5); // June (0-indexed)
  expect(parseLearningDate("not-a-learning-file.md")).toBeNull();
});

test("isFresh includes recent, excludes old and unparseable", () => {
  const now = new Date(2026, 5, 20, 12, 0, 0);
  expect(isFresh("2026-06-19-100000_LEARNING_x.md", 21, now)).toBe(true);
  expect(isFresh("2026-04-01-100000_LEARNING_x.md", 21, now)).toBe(false);
  expect(isFresh("garbled.md", 21, now)).toBe(false);
});

function pad(n: number): string { return String(n).padStart(2, "0"); }

function writeLearning(base: string, subdir: string, d: Date, feedback: string, rating: number) {
  const month = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  const stamp = `${month}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const dir = join(base, "MEMORY", "LEARNING", subdir, month);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${stamp}_LEARNING_test.md`), `---\nrating: ${rating}\n---\n**Feedback:** ${feedback}\n`);
}

test("loadLearningDigest shows fresh entries and hides stale ones", () => {
  const base = mkdtempSync(join(tmpdir(), "lrb-"));
  const now = new Date();
  const stale = new Date(now.getTime() - 60 * 86_400_000); // 60 days ago

  writeLearning(base, "ALGORITHM", now, "fresh signal here", 7);
  writeLearning(base, "ALGORITHM", stale, "stale signal here", 3);

  const out = loadLearningDigest(base) || "";
  expect(out).toContain("fresh signal here");
  expect(out).not.toContain("stale signal here");
});
