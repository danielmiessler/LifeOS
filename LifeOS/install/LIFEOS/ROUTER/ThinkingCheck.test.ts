import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { THINKING_SKILLS } from "./Depth";
import { THINKING_WORDS, main, checkLines, checkThinking, fitFlags, fitLines, parseThinking, parseThinkingLine, sessionTranscript, sessionTranscripts, skillCalls, thinkingLine } from "./ThinkingCheck";

const ISA = `---
task: t
---
## Features

### F0 · Cross-cutting
Why: invariants.
Lane: inline
Thinking: RedTeam·light ; skipped Council=one approach already chosen, FirstPrinciples=constraints fixed by upstream, SystemsThinking=no recurring loop at issue

- [ ] ISC-1: a.

### F1 · Record
Why: the record is visible.
Lane: inline
Thinking: none=the design mirrors the existing Lane line; no open fork remains after the principal's yes

- [ ] ISC-2: b.

### F2 · Catalog
Why: every pattern is findable.
Lane: SeniorEngineer · high
Thinking: FirstPrinciples·light, Superior·full ; skipped RedTeam=one failure mode and a check covers it, Council=no competing design

- [ ] ISC-3: c.

### F3 · Unplanned
Why: no thinking line here.

- [ ] ISC-4: d.

### F4 · Typo
Why: a word not in the roster is named, never dropped.
Thinking: RedTeem·full ; skipped Council=too simple

- [ ] ISC-5: e.

## Test Strategy
`;

describe("line", () => {
  test("parses every planned feature and leaves the unplanned one out", () => {
    const plans = parseThinking(ISA);
    expect(plans.map((p) => p.feature)).toEqual(["F0", "F1", "F2", "F4"]);
  });
  test("a none line keeps its whole phrase, semicolon included", () => {
    const f1 = parseThinking(ISA).find((p) => p.feature === "F1")!;
    expect(f1.ran).toEqual([]);
    expect(f1.skipped).toEqual([]);
    expect(f1.none).toBe("the design mirrors the existing Lane line; no open fork remains after the principal's yes");
    expect(f1.unknown).toEqual([]);
  });
  test("ran skills carry their mode and skipped skills their phrase", () => {
    const f2 = parseThinking(ISA).find((p) => p.feature === "F2")!;
    expect(f2.ran).toEqual([{ skill: "FirstPrinciples", mode: "light", known: true }, { skill: "Superior", mode: "full", known: true }]);
    expect(f2.skipped.map((s) => [s.skill, s.phrase])).toEqual([["RedTeam", "one failure mode and a check covers it"], ["Council", "no competing design"]]);
  });
  test("an unknown skill word is named, never dropped, and a lazy phrase is called out", () => {
    const f4 = parseThinking(ISA).find((p) => p.feature === "F4")!;
    expect(f4.unknown).toEqual(["RedTeem"]);
    expect(f4.lazy).toEqual(["Council"]);
    expect(thinkingLine([f4])).toContain("(unknown skill RedTeem)");
    expect(thinkingLine([f4])).toContain("(no reason given for Council)");
  });
  test("draws one segment per planned feature", () => {
    const line = thinkingLine(parseThinking(ISA));
    expect(line.startsWith("🧠 THINKING ▸ ")).toBe(true);
    expect(line).toContain("F0 RedTeam·light (skipped Council, FirstPrinciples, SystemsThinking)");
    expect(line).toContain("F1 none");
    expect(line).toContain("F2 FirstPrinciples·light, Superior·full (skipped RedTeam, Council)");
    expect(line).not.toContain("F3");
  });
  test("no planned feature draws nothing", () => {
    expect(thinkingLine(parseThinking("## Features\n\n### F1 · x\nWhy: y.\n\n- [ ] ISC-1: z.\n"))).toBe("");
  });
});

describe("roster", () => {
  test("line exits 0 and the run's own ISA parses with no unknown skill word", async () => {
    const dir = mkdtempSync(join(tmpdir(), "thinking-check-isa-"));
    writeFileSync(join(dir, "ISA.md"), ISA);
    expect(await main(["line", join(dir, "ISA.md")])).toBe(0);
    expect(await main(["line", join(dir, "missing.md")])).toBe(0);
    expect(await main(["bogus", join(dir, "ISA.md")])).toBe(0);
    const real = join(process.env.CLAUDE_CONFIG_DIR ?? `${process.env.HOME}/.claude`, "LIFEOS/MEMORY/WORK/20261114-190000_thinking-record-and-fabric-catalog/ISA.md");
    if (existsSync(real)) {
      const plans = parseThinking(readFileSync(real, "utf8"));
      expect(plans.length).toBe(3);
      expect(plans.flatMap((p) => p.unknown)).toEqual([]);
      expect(plans.flatMap((p) => p.lazy)).toEqual([]);
    }
  });
  test("every roster word plus Superior parses as ran and as skipped", () => {
    for (const w of [...THINKING_SKILLS, "Superior"]) {
      const ran = parseThinkingLine(`${w}·full`);
      expect(ran.ran).toEqual([{ skill: w, mode: "full", known: true }]);
      const skipped = parseThinkingLine(`none=x ; skipped ${w}=because`);
      expect(skipped.skipped).toEqual([{ skill: w, phrase: "because", known: true }]);
    }
    expect(THINKING_WORDS).toContain("Superior");
  });
  test("a bare skipped line and odd spacing still parse", () => {
    const p = parseThinkingLine("skipped RedTeam = nothing to attack,  first principles=settled");
    expect(p.skipped.map((s) => s.skill)).toEqual(["RedTeam", "FirstPrinciples"]);
    expect(p.ran).toEqual([]);
  });
});

describe("check", () => {
  const transcript = [
    JSON.stringify({ type: "user", message: { content: "go" } }),
    JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Skill", input: { skill: "RedTeam", args: "attack it" } }] } }),
    JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Skill", input: { skill: "ISA" } }, { type: "text", text: "Skill" }] } }),
    JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Skill", input: { skill: "plugin:Council" } }] } }),
    JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Bash", input: { command: "echo Skill" } }] } }),
  ].join("\n");
  test("reads only roster skills invoked through the Skill tool", () => {
    expect(skillCalls(transcript)).toEqual(["RedTeam", "Council"]);
  });
  test("compares the written plan with what ran", () => {
    const results = checkThinking(parseThinking(ISA), skillCalls(transcript));
    const f0 = results.find((r) => r.feature === "F0")!;
    expect(f0.ran).toEqual(["RedTeam"]);
    expect(f0.missing).toEqual([]);
    const f2 = results.find((r) => r.feature === "F2")!;
    expect(f2.missing).toEqual(["FirstPrinciples", "Superior"]);
    expect(f2.unwritten).toEqual(["Council"]);
    const lines = checkLines(results);
    expect(lines[0]).toBe("🧠 Thinking check ▸ 1 of 4 written skills ran");
    expect(lines).toContain("✓ F0: RedTeam ran");
    expect(lines).toContain("⚠️ F2: FirstPrinciples written, never ran");
    expect(lines).toContain("ℹ️ ran but not written: Council");
  });
  test("finds a session transcript under the projects dir and refuses an odd id", () => {
    const dir = mkdtempSync(join(tmpdir(), "thinking-check-"));
    mkdirSync(join(dir, "-Users-x"));
    writeFileSync(join(dir, "-Users-x", "abc-123.jsonl"), transcript);
    expect(sessionTranscript("abc-123", dir)).toBe(join(dir, "-Users-x", "abc-123.jsonl"));
    expect(sessionTranscript("nope", dir)).toBeNull();
    expect(sessionTranscript("../abc-123", dir)).toBeNull();
  });
  test("a skill a subagent ran counts: subagent sidechains are read beside the main transcript", () => {
    const dir = mkdtempSync(join(tmpdir(), "thinking-check-sub-"));
    mkdirSync(join(dir, "-Users-x", "abc-123", "subagents", "workflows", "wf1"), { recursive: true });
    writeFileSync(join(dir, "-Users-x", "abc-123.jsonl"), transcript);
    writeFileSync(join(dir, "-Users-x", "abc-123", "subagents", "agent-1.jsonl"), JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Skill", input: { skill: "FirstPrinciples" } }] } }));
    writeFileSync(join(dir, "-Users-x", "abc-123", "subagents", "workflows", "wf1", "a.jsonl"), JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Skill", input: { skill: "Superior" } }] } }));
    const files = sessionTranscripts("abc-123", dir);
    expect(files.length).toBe(3);
    const invoked = files.flatMap((f) => skillCalls(require("node:fs").readFileSync(f, "utf8")));
    expect(invoked.sort()).toEqual(["Council", "FirstPrinciples", "RedTeam", "Superior"]);
    expect(sessionTranscripts("nope", dir)).toEqual([]);
  });
});

describe("fit", () => {
  const plans = parseThinking(ISA);
  test("flags a clear would-change and ignores the rest", async () => {
    const ask = async (state: any) => ({ answers: { changed: { type: "choice", choice: state.skipped_skill === "RedTeam" ? "would_change" : "no_change", probabilities: state.skipped_skill === "RedTeam" ? { would_change: 0.82, no_change: 0.18 } : { would_change: 0.3, no_change: 0.7 } } } });
    const { flags, skipped } = await fitFlags(plans, ask as any, undefined, {});
    expect(flags).toEqual([{ feature: "F2", skill: "RedTeam", confidence: 0.82 }]);
    expect(skipped).toEqual([]);
  });
  test("the shadow row carries the ISA key when one is given", async () => {
    const seen: any[] = [];
    const ask = async (_s: any, _q: any, opts: any) => { seen.push(opts); return { answers: { changed: { type: "choice", choice: "no_change", probabilities: { would_change: 0.1, no_change: 0.9 } } } }; };
    await fitFlags(plans, ask as any, "sess-1", {}, "/x/ISA.md");
    expect(seen.length).toBe(6);
    expect(seen[0].extra).toEqual({ isa_key: "/x/ISA.md" });
    expect(seen[0].session).toBe("sess-1");
  });
  test("a would-change under the bar is no flag", async () => {
    const ask = async () => ({ answers: { changed: { type: "choice", choice: "would_change", probabilities: { would_change: 0.55, no_change: 0.45 } } } });
    const { flags } = await fitFlags(plans, ask as any, undefined, {});
    expect(flags).toEqual([]);
  });
  test("an unavailable engine is said once, a disabled one is silent, a flag is drawn", () => {
    expect(fitLines([], ["F0 Council: engine HTTP 401: {...}", "F2 RedTeam: engine HTTP 401: {...}"])).toEqual(["ℹ️ Thinking fit unjudged: 2 skips not judged (engine HTTP 401)"]);
    expect(fitLines([], ["engine disabled"])).toEqual([]);
    expect(fitLines([], [])).toEqual([]);
    expect(fitLines([{ feature: "F2", skill: "RedTeam", confidence: 0.82 }], ["F0 Council: timeout"])).toEqual(["⚠️ Thinking fit F2: RedTeam was skipped and would likely have changed the result (82%)"]);
  });
  test("an engine failure is no flag, and a disabled engine asks nothing", async () => {
    let calls = 0;
    const boom = async () => { calls++; throw new Error("engine down"); };
    const { flags, skipped } = await fitFlags(plans, boom as any, undefined, {});
    expect(flags).toEqual([]);
    expect(skipped.length).toBe(6);
    calls = 0;
    const off = await fitFlags(plans, boom as any, undefined, { LIFEOS_GLANCE_DISABLED: "1" });
    expect(off.flags).toEqual([]);
    expect(calls).toBe(0);
  });
});
