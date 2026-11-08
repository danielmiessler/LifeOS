// Per-install approval phrases for restate answers (public issue #2595). Each test pins one of the
// conditions in that thread: CLEAN_YES unchanged, phrases from a USER/CONFIG file, accents folded (NFD),
// and approval plus a request kept unclean.
import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { approvalPhrases, isListedApproval, restateIsClean } from "./IsaAlign";

const block = (answer: string) => `Principal: "${answer}"`;
const dir = mkdtempSync(join(tmpdir(), "approval-"));
const file = (body: string) => { const p = join(dir, `p-${Math.random().toString(36).slice(2)}.txt`); writeFileSync(p, body); return p; };
const pt = approvalPhrases(file("# Portuguese answers\nsim\naceito\né isso\nsim, por favor\nmanda ver  # also a yes\n"));

describe("CLEAN_YES is unchanged", () => {
  test("an English yes is clean with no phrase file", () => expect(restateIsClean(block("yes"), new Set())).toBe(true));
  test("an English hedge stays unclean", () => expect(restateIsClean(block("yes but change L2"), new Set())).toBe(false));
});

describe("phrases come from the install's file", () => {
  test("no file means no extra phrases", () => expect(approvalPhrases(join(dir, "absent.txt")).size).toBe(0));
  test("without the file a Portuguese yes is unclean, as today", () => expect(restateIsClean(block("sim"), new Set())).toBe(false));
  test("comments and blank lines are ignored", () => expect([...pt].sort()).toEqual(["aceito", "e isso", "manda ver", "sim", "sim por favor"]));
  test("a listed phrase is a clean yes", () => expect(restateIsClean(block("sim"), pt)).toBe(true));
  test("a read error is thrown, never read as no phrases", () => {
    const d = join(dir, "is-a-dir.txt"); mkdirSync(d);
    expect(() => approvalPhrases(d)).toThrow();
  });
});

describe("accents do not matter (NFD)", () => {
  test("listed with an accent, typed without", () => expect(isListedApproval("e isso", pt)).toBe(true));
  test("case and trailing punctuation", () => expect(isListedApproval("É ISSO.", pt)).toBe(true));
  test("listed without an accent, typed with one", () => expect(isListedApproval("é isso", approvalPhrases(file("e isso\n")))).toBe(true));
});

describe("approval plus a request stays unclean", () => {
  test("sim, mas o L2...", () => expect(restateIsClean(block("sim, mas o L2 precisa mudar"), pt)).toBe(false));
  test("a yes and then a change in a second sentence", () => expect(isListedApproval("sim. muda o L2.", pt)).toBe(false));
  test("two listed sentences are clean", () => expect(isListedApproval("sim. aceito.", pt)).toBe(true));
  test("a question is not a yes", () => expect(isListedApproval("sim?", pt)).toBe(false));
  test("commas do not split a listed phrase", () => expect(isListedApproval("Sim, por favor!", pt)).toBe(true));
});

process.on("exit", () => rmSync(dir, { recursive: true, force: true }));
