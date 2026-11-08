// Section boundaries of every ISA reader, pinned on one fixture (public issue #2527).
//
// "current reader boundaries" records what each reader sees TODAY, defects included. Moving a reader onto
// IsaSections changes its block here in the same commit, so the boundary change is reviewed, never silent.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { h2Sections } from "../IsaLadder";
import { isaSections as reviewSections } from "../Review";
import { parseEvalsText, parseTestStrategyText } from "./IsaTestStrategy";
import { extractCriteriaSection } from "../../../hooks/lib/isa-utils";
import { isaBody, parseIsaClaimsText } from "./IsaClaims";
import { countCheckboxLines, parseClaims } from "../IsaFrontier";

const FIXTURE = join(import.meta.dir, "IsaSections.fixture.md");
const text = readFileSync(FIXTURE, "utf8");
const ids = (s: string | null) => [...(s ?? "").matchAll(/ISC-\w+/g)].map((m) => m[0]);

describe("current reader boundaries", () => {
  test("IsaLadder.h2Sections reads headings inside the four-backtick fence", () => {
    expect(h2Sections(isaBody(text)).map((s) => s.title)).toEqual(
      ["Ideal State", "Criteria", "Anti-claims", "Test Strategy", "Test Strategy Notes", "Evals", "Examples", "Evals", "Test Strategy", "Criteria", "Decisions"]);
  });
  test("Review.isaSections splits at H3 and reads headings inside the four-backtick fence", () => {
    expect(reviewSections(text).map((s) => s.heading)).toEqual(
      ["", "Ideal State", "L3 · One sentence", "Criteria", "Anti-claims", "Test Strategy", "Test Strategy Notes", "Evals", "ISC-1 · real eval", "Examples", "Evals", "ISC-91 · eval inside a four-backtick fence", "Test Strategy", "Criteria", "Decisions"]);
  });
  test("parseEvalsText finds only the real Evals block", () => {
    const evals = parseEvalsText(text, FIXTURE);
    expect([...evals.evals.keys()]).toEqual(["ISC-1"]);
    expect(evals.errors).toEqual([]);
  });
  test("parseTestStrategyText takes fenced rows and Test Strategy Notes, and a fenced `## ` comment ends it", () => {
    expect(parseTestStrategyText(text, FIXTURE).probes.map((p) => p.isc)).toEqual(["ISC-90", "ISC-1", "ISC-3", "ISC-91"]);
  });
  test("extractCriteriaSection ends at the fenced `## Criteria` line", () => {
    expect(ids(extractCriteriaSection(text))).toEqual(["ISC-1"]);
  });
  test("parseIsaClaimsText skips fences, ends at `---`, and reads `## Anti-claims` as anti", () => {
    expect(parseIsaClaimsText(text).claims.map((c) => `${c.id}${c.anti ? " anti" : ""}`)).toEqual(["ISC-1", "ISC-2", "ISC-A1 anti"]);
  });
  test("IsaFrontier.parseClaims reads the same claims; countCheckboxLines stops at the fenced `## Criteria`", () => {
    expect(parseClaims(text).map((c) => c.id)).toEqual(["ISC-1", "ISC-2", "ISC-A1"]);
    expect(countCheckboxLines(text)).toBe(1);
  });
});
