import { describe, expect, test } from "bun:test";
import { MIN_RUNS, skipStats, verdictFor, windowFor } from "./thinking";

const row = (session: string | null, choice: string | null, daysAgo = 1, isa_key?: string) => JSON.stringify({
  ts: new Date(Date.now() - daysAgo * 86_400_000).toISOString(), caller: "thinking-fit", session, ...(isa_key ? { isa_key } : {}),
  answers: choice ? { changed: { type: "choice", choice, probabilities: { would_change: choice === "would_change" ? 0.8 : 0.2, no_change: choice === "would_change" ? 0.2 : 0.8 } } } : null,
  error: choice ? null : "timeout",
});

describe("thinking adapter", () => {
  test("answers unknown under the run floor", () => {
    const text = [row("s1", "no_change"), row("s2", "would_change"), row("s3", "no_change")].join("\n");
    const s = skipStats(text, Date.now() - 7 * 86_400_000);
    expect(s.runs).toBe(3);
    expect(verdictFor(s, 20).verdict).toBe("unknown");
  });
  test("answers a percent once enough runs are judged", () => {
    const lines: string[] = [];
    for (let i = 0; i < 12; i++) lines.push(row(`s${i}`, i < 2 ? "would_change" : "no_change"));
    lines.push(row("s0", null));
    lines.push(JSON.stringify({ ts: new Date().toISOString(), caller: "route-fit", session: "x", answers: { fit: { type: "choice", choice: "fits" } } }));
    const s = skipStats(lines.join("\n"), Date.now() - 7 * 86_400_000);
    expect(s.rows).toBe(13);
    expect(s.judged).toBe(12);
    expect(s.runs).toBe(12);
    expect(s.share).toBe(16.7);
    expect(verdictFor(s, 20)).toEqual({ verdict: "pass", evidence: "2 of 12 skipped skills judged would-have-changed (16.7%) across 12 runs; ideal ≤ 20%" });
    expect(verdictFor(s, 10).verdict).toBe("fail");
    expect(MIN_RUNS).toBe(10);
  });
  test("anonymous rows pool into one run; an ISA key counts as a run", () => {
    const anon: string[] = [];
    for (let i = 0; i < 10; i++) anon.push(row(null, "no_change"));
    const s = skipStats(anon.join("\n"), Date.now() - 7 * 86_400_000);
    expect(s.judged).toBe(10);
    expect(s.runs).toBe(1);
    expect(verdictFor(s, 20).verdict).toBe("unknown");
    const keyed: string[] = [];
    for (let i = 0; i < 10; i++) keyed.push(row(null, "no_change", 1, `/isa-${i}/ISA.md`));
    expect(skipStats(keyed.join("\n"), Date.now() - 7 * 86_400_000).runs).toBe(10);
  });
  test("rows outside the window are not counted", () => {
    const text = [row("old", "would_change", 30), row("new", "no_change", 1)].join("\n");
    expect(skipStats(text, Date.now() - 7 * 86_400_000).rows).toBe(1);
  });
  test("the ref carries the window", () => {
    expect(windowFor({ answerer: { adapter: "thinking", ref: "thinking-skips:14" } } as any)).toBe(14);
    expect(windowFor({ answerer: { adapter: "thinking" } } as any)).toBe(7);
  });
});
