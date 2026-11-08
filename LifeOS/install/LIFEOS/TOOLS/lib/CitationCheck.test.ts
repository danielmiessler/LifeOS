// CitationCheck and ReferenceCheck --content (public issue #2221).
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkCitation, findCitations, isRotten } from "./CitationCheck";

let root = "", outsideDir = "";
beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "citation-root-"));
  outsideDir = mkdtempSync(join(tmpdir(), "citation-outside-"));
  mkdirSync(join(root, "hooks"));
  writeFileSync(join(root, "hooks/Foo.ts"), ["const a = 1;", "if (!session) return;", "log('x');", "log('x');", "use `tick` here"].join("\n"));
  writeFileSync(join(outsideDir, "Secret.ts"), "if (!session) return;\n");
  symlinkSync(join(outsideDir, "Secret.ts"), join(root, "hooks/Link.ts"));
});
afterAll(() => { rmSync(root, { recursive: true, force: true }); rmSync(outsideDir, { recursive: true, force: true }); });

describe("checkCitation", () => {
  test("ok: the cited line holds the snippet", () => {
    expect(checkCitation(root, "hooks/Foo.ts", 2, "if (!session)")).toEqual({ state: "ok" });
  });
  test("moved: the snippet is on exactly one other line", () => {
    expect(checkCitation(root, "hooks/Foo.ts", 1, "if (!session)")).toEqual({ state: "moved", foundAt: [2] });
  });
  test("ambiguous: the snippet is on several other lines", () => {
    expect(checkCitation(root, "hooks/Foo.ts", 1, "log('x')")).toEqual({ state: "ambiguous", foundAt: [3, 4] });
  });
  test("changed: the snippet is nowhere in the file", () => {
    expect(checkCitation(root, "hooks/Foo.ts", 2, "if (!user)")).toEqual({ state: "changed" });
  });
  test("gone: the file does not exist", () => {
    expect(checkCitation(root, "hooks/Bar.ts", 2, "if (!session)")).toEqual({ state: "gone" });
  });
  test("dir: the path is a directory", () => {
    expect(checkCitation(root, "hooks", 2, "if (!session)")).toEqual({ state: "dir" });
  });
  test("outside: a symlink or a ../ path that leaves the checked tree", () => {
    expect(checkCitation(root, "hooks/Link.ts", 1, "if (!session)")).toEqual({ state: "outside" });
    const rel = join("..", outsideDir.split("/").pop()!, "Secret.ts");
    expect(checkCitation(root, rel, 1, "if (!session)")).toEqual({ state: "outside" });
    expect(checkCitation(root, join(outsideDir, "Secret.ts"), 1, "if (!session)")).toEqual({ state: "outside" });
  });
  test("~/.claude/ reads as the checked root", () => {
    expect(checkCitation(root, "~/.claude/hooks/Foo.ts", 2, "if (!session)")).toEqual({ state: "ok" });
  });
  test("only ok and moved are not rotten", () => {
    expect(["ok", "moved", "ambiguous", "changed", "gone", "dir", "outside"].filter(s => !isRotten(s as any))).toEqual(["ok", "moved"]);
  });
});

describe("findCitations", () => {
  test("single and double backtick snippets, pointers without a snippet counted, fences skipped", () => {
    const text = [
      "See `hooks/Foo.ts:2` — `if (!session)` and `hooks/Foo.ts:5` — `` use `tick` here ``.",
      "Also `hooks/Foo.ts:3` with no snippet, and `step:2`, which is not a path.",
      "```",
      "`hooks/Foo.ts:9` — `example only`",
      "```",
    ].join("\n");
    const { citations, withoutSnippet } = findCitations(text);
    expect(citations).toEqual([
      { line: 1, path: "hooks/Foo.ts", citedLine: 2, snippet: "if (!session)" },
      { line: 1, path: "hooks/Foo.ts", citedLine: 5, snippet: "use `tick` here" },
    ]);
    expect(withoutSnippet).toBe(1);
    expect(checkCitation(root, "hooks/Foo.ts", 5, citations[1].snippet).state).toBe("ok");
  });
});

describe("ReferenceCheck --content", () => {
  const tool = join(import.meta.dir, "..", "ReferenceCheck.ts");
  const run = (...args: string[]) => {
    const p = Bun.spawnSync(["bun", tool, "--root", root, "--json", ...args], { stdout: "pipe", stderr: "pipe" });
    return { code: p.exitCode, json: JSON.parse(p.stdout.toString()) };
  };
  beforeAll(() => {
    writeFileSync(join(root, "NOTES.md"), "Holds: `hooks/Foo.ts:2` — `if (!session)`.\nMoved: `hooks/Foo.ts:1` — `if (!session)`.\nRotten: `hooks/Foo.ts:2` — `if (!user)`.\nBare: `hooks/Foo.ts:3`.\n");
  });
  test("the default run does not read citations and its output has no content key", () => {
    const { code, json } = run();
    expect(json.content).toBeUndefined();
    expect(code).toBe(0);
  });
  test("--stale alone does not read citations either", () => {
    expect(run("--stale").json.content).toBeUndefined();
  });
  test("--content reports moved and rotten citations, counts pointers without a snippet, and exits 1", () => {
    const { code, json } = run("--content");
    expect(json.content.citations).toBe(3);
    expect(json.content.ok).toBe(1);
    expect(json.content.moved.map((c: any) => [c.line, c.foundAt])).toEqual([[2, [2]]]);
    expect(json.content.rotten.map((c: any) => [c.line, c.state])).toEqual([[3, "changed"]]);
    expect(json.content.withoutSnippet).toBe(1);
    expect(code).toBe(1);
  });
});
