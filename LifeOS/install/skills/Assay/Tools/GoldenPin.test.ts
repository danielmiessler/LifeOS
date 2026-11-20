import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { check } from "./GoldenPin";

const isa = (fm = "golden_set: golden\n") => `---\nslug: x\n${fm}---\n\n# ISA\n`;

function repo() {
  const dir = mkdtempSync(join(tmpdir(), "goldenpin-"));
  const sh = (...args: string[]) => spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd: dir });
  const put = (rel: string, body: string) => { mkdirSync(join(dir, rel, ".."), { recursive: true }); writeFileSync(join(dir, rel), body); };
  const commit = (msg: string) => { sh("add", "-A"); sh("commit", "-qm", msg); };
  sh("init", "-q");
  return { dir, put, commit, sh, isa: join(dir, "ISA.md") };
}

/** The honest order: ISA and golden set committed alone, then the build. */
function built() {
  const r = repo();
  r.put("ISA.md", isa()); r.put("golden/strong.json", '{"verdict":"invite"}'); r.put("golden/weak.json", '{"verdict":"decline"}'); r.commit("golden set");
  r.put("src/grade.ts", "export {}"); r.commit("build");
  return r;
}

const errs = (r: { isa: string }) => { const v = check(r.isa); return v.applies ? v.errors.join("\n") : "not applicable"; };

test("green: golden set unchanged since its pin", () => {
  expect(errs(built())).toBe("");
});

test("green: golden edits before the first build commit belong to the pin", () => {
  const r = repo(); r.put("ISA.md", isa()); r.put("golden/a.json", "1"); r.commit("golden");
  r.put("golden/a.json", "2"); r.commit("golden fix"); r.put("src/x.ts", "x"); r.commit("build");
  expect(errs(r)).toBe("");
});

test("an ISA without golden_set is out of scope", () => {
  const r = repo(); r.put("ISA.md", isa("")); r.commit("isa");
  expect(check(r.isa).applies).toBe(false);
});

test("red: a golden case edited after the build", () => {
  const r = built(); r.put("golden/weak.json", '{"verdict":"invite"}');
  expect(errs(r)).toMatch(/changed since its pin.*golden\/weak\.json/);
});

test("red: a new case, even one hidden by an ignore rule", () => {
  const r = built(); writeFileSync(join(r.dir, ".git", "info", "exclude"), "golden/easy.json\n"); r.put("golden/easy.json", "{}");
  expect(errs(r)).toMatch(/golden\/easy\.json/);
});

test("red: a pinned case deleted", () => {
  const r = built(); rmSync(join(r.dir, "golden", "weak.json"));
  expect(errs(r)).toMatch(/golden\/weak\.json/);
});

test("red: cases written after the build cannot become the pin", () => {
  const r = repo(); r.put("ISA.md", isa()); r.commit("isa"); r.put("src/x.ts", "x"); r.commit("build");
  r.put("golden/a.json", "fits the output"); r.commit("golden"); r.put("src/y.ts", "y"); r.commit("more");
  expect(errs(r)).toMatch(/not committed before the first build commit/);
});

test("red: golden_set declared in the same commit as the build", () => {
  const r = repo(); r.put("ISA.md", isa()); r.put("golden/a.json", "1"); r.put("src/x.ts", "x"); r.commit("all at once");
  expect(errs(r)).toMatch(/same commit as other changes/);
});

test("red: no build commit yet", () => {
  const r = repo(); r.put("ISA.md", isa()); r.put("golden/a.json", "1"); r.commit("golden");
  expect(errs(r)).toMatch(/no build commit yet/);
});

test("red: committed golden_set dropped or repointed", () => {
  const dropped = built(); dropped.put("ISA.md", isa(""));
  expect(errs(dropped)).toMatch(/now "\(removed\)"/);
  const moved = built(); moved.put("easy/a.json", "{}"); moved.commit("easy cases"); moved.put("ISA.md", isa("golden_set: easy\n"));
  expect(errs(moved)).toMatch(/was "golden".*now "easy"/);
});

test("red: a side branch from the anchor with rewritten cases, merged in", () => {
  const r = repo(); r.put("ISA.md", isa()); r.put("golden/a.json", "hard"); r.commit("golden"); r.sh("branch", "-M", "main");
  r.put("src/x.ts", "x"); r.commit("build");
  r.sh("checkout", "-qb", "side", "HEAD^"); r.put("golden/a.json", "easy"); r.commit("rewrite"); r.put("src/y.ts", "y"); r.commit("dummy");
  r.sh("merge", "-q", "--no-ff", "-m", "m", "main");
  expect(errs(r)).toMatch(/has merges/);
});

// Review.ts (isaAt) reads the working-tree ISA when the ISA has no copy at the span's base; the pin must hold anyway.
test("red: an ISA new in the review span still pins its cases from history", () => {
  const r = repo(); r.put("README.md", "older history"); r.commit("base");
  r.put("ISA.md", isa()); r.put("golden/a.json", "1"); r.commit("isa + golden"); r.put("src/x.ts", "x"); r.commit("build");
  r.put("golden/a.json", "2");
  expect(errs(r)).toMatch(/changed since its pin/);
});

test("red: an uncommitted ISA cannot declare a pin after the fact", () => {
  const r = repo(); r.put("golden/a.json", "1"); r.commit("golden"); r.put("src/x.ts", "x"); r.commit("build");
  r.put("ISA.md", isa());
  expect(errs(r)).toMatch(/golden_set is not committed/);
});

test("red: a merge that resolves the ISA without golden_set cannot reset the anchor", () => {
  const r = repo(); r.put("README.md", "base"); r.commit("base"); r.sh("branch", "-M", "main");
  r.put("ISA.md", isa()); r.put("golden/a.json", "hard"); r.commit("isa + golden"); r.put("src/x.ts", "x"); r.commit("build");
  r.sh("checkout", "-qb", "side", "HEAD~2"); r.put("ISA.md", isa("")); r.commit("isa without golden_set");
  r.sh("merge", "-q", "--no-ff", "--no-commit", "main"); r.put("ISA.md", isa("")); r.put("golden/a.json", "easy"); r.sh("add", "-A"); r.sh("commit", "-qm", "merge");
  expect(errs(r)).toMatch(/now "\(removed\)"/);
  r.put("ISA.md", isa()); r.commit("declare again"); r.put("src/y.ts", "y"); r.commit("dummy build");
  expect(errs(r)).not.toBe("");
});

test("red: a committed repoint to another folder", () => {
  const r = built(); r.put("ISA.md", isa("golden_set: easy\n")); r.put("easy/a.json", "{}"); r.commit("repoint"); r.put("src/y.ts", "y"); r.commit("dummy");
  expect(errs(r)).toMatch(/was "golden".*now "easy"/);
});

test("red: the first build commit itself rewrites the cases", () => {
  const r = repo(); r.put("ISA.md", isa()); r.put("golden/a.json", "hard"); r.commit("golden");
  r.put("src/x.ts", "x"); r.put("golden/a.json", "easy"); r.commit("build + rewrite");
  expect(errs(r)).toMatch(/changed since its pin/);
});

test("red: a declaration introduced only inside a merge commit", () => {
  const r = repo(); r.put("README.md", "base"); r.commit("base"); r.sh("branch", "-M", "main");
  r.sh("checkout", "-qb", "side"); r.put("notes.md", "n"); r.commit("side");
  r.sh("checkout", "-q", "main"); r.put("src/x.ts", "x"); r.commit("build");
  r.sh("merge", "-q", "--no-ff", "--no-commit", "side"); r.put("ISA.md", isa()); r.put("golden/a.json", "fitted"); r.sh("add", "-A"); r.sh("commit", "-qm", "merge");
  r.put("src/y.ts", "y"); r.commit("dummy build");
  expect(errs(r)).not.toBe("");
});

test("red: a build in a folder that only shares the golden set's name prefix still counts", () => {
  const r = repo(); r.put("ISA.md", isa()); r.put("golden/a.json", "hard"); r.commit("golden");
  r.put("golden-src/build.ts", "b"); r.commit("build");
  r.put("golden/a.json", "easy"); r.commit("fit"); r.put("src/y.ts", "y"); r.commit("more build");
  expect(errs(r)).toMatch(/changed since its pin/);
});
