/**
 * Verifies that nextFire for interval triggers aligns with the dispatcher's clock
 * (multiples of period counted from Unix epoch grid) rather than drifting with lastStart.
 *
 * Issue #2788
 */
import { describe, expect, test } from "bun:test";
import { nextFire, occurrencesBetween } from "./schedule.ts";

const interval = (minutes: number) => ({ type: "interval" as const, minutes, missed_run: "once" as const });
const at = (iso: string) => new Date(iso);

const printedNext = (minutes: number, lastRunIso: string, nowIso: string): string =>
  nextFire(interval(minutes), "any-lane", at(nowIso), Date.parse(lastRunIso), "/nonexistent")!.toISOString();

const dispatcherNext = (minutes: number, nowIso: string): string => {
  const now = at(nowIso);
  const found = occurrencesBetween(interval(minutes), now, new Date(now.getTime() + minutes * 2 * 60_000));
  return found[0].at.toISOString();
};

describe("interval trigger: workflow next vs dispatcher clock", () => {
  test("a 60-minute lane whose last run was off the grid: next matches dispatcher next epoch multiple", () => {
    const now = "2026-11-12T23:20:00.000Z";
    expect(printedNext(60, "2026-11-12T22:45:00.000Z", now)).toBe(dispatcherNext(60, now));
  });

  test("a run that starts a few seconds after its tick preserves epoch-grid alignment", () => {
    const now = "2026-11-12T10:01:00.000Z";
    expect(printedNext(15, "2026-11-12T10:00:04.000Z", now)).toBe(dispatcherNext(15, now));
  });

  test("control: they agree when last run started on the grid", () => {
    const now = "2026-11-12T10:01:00.000Z";
    expect(printedNext(15, "2026-11-12T10:00:00.000Z", now)).toBe(dispatcherNext(15, now));
  });
});