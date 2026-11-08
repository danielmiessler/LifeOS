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
import { CRITERIA_HEADING_RE as UTILS_CRITERIA } from "../../../hooks/lib/isa-utils";
import { ANTI_HEADING_RE as CLAIMS_ANTI, BRIDGE_HEADING_RE as CLAIMS_BRIDGE, CLAIMS_HEADING_RE } from "./IsaClaims";
import { countCheckboxLines, FRONTIER_CRITERIA_HEADING_RE, parseClaims } from "../IsaFrontier";
import { ANTI_HEADING_RE, BRIDGE_HEADING_RE, CRITERIA_HEADING_RE, findSections, isaSections } from "./IsaSections";

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

describe("SECTION_ALIASES generates the heading regexes", () => {
  // The literals isa-utils, IsaClaims and IsaFrontier each kept by hand before this module.
  const CRITERIA_LITERAL = /^(?:##\s+(?:ISC\s+)?Criteria\b[^\n]*|##\s+Claims\b[^\n]*|##\s+IDEAL\s+STATE\s+CRITERIA\b[^\n]*|###\s+Criteria\b[^\n]*|##\s+Features\b[^\n]*)$/im;
  const BRIDGE_LITERAL = /^##\s+Bridge\s+Criteria\b[^\n]*$/im;
  const ANTI_LITERAL = /^##\s+Anti-(?:criteria|claims)\b/i;
  const same = (a: RegExp, b: RegExp) => expect([a.source, a.flags]).toEqual([b.source, b.flags]);
  test("byte-equal to the literals they replace", () => {
    same(CRITERIA_HEADING_RE, CRITERIA_LITERAL);
    same(BRIDGE_HEADING_RE, BRIDGE_LITERAL);
    same(ANTI_HEADING_RE, ANTI_LITERAL);
  });
  test("isa-utils, IsaClaims and IsaFrontier export the one generated regex", () => {
    expect(UTILS_CRITERIA).toBe(CRITERIA_HEADING_RE);
    expect(CLAIMS_HEADING_RE).toBe(CRITERIA_HEADING_RE);
    expect(FRONTIER_CRITERIA_HEADING_RE).toBe(CRITERIA_HEADING_RE);
    expect(CLAIMS_BRIDGE).toBe(BRIDGE_HEADING_RE);
    expect(CLAIMS_ANTI).toBe(ANTI_HEADING_RE);
  });
});

describe("isaSections", () => {
  const sections = isaSections(text);
  const body = (s: { bodyStart: number; end: number }) => text.slice(s.bodyStart, s.end);
  test("headings inside fences, the four-backtick one included, are text", () => {
    expect(sections.map((s) => `${s.level} ${s.title}`)).toEqual([
      "1 ISA section boundaries fixture", "2 Ideal State", "3 L3 · One sentence", "2 Criteria", "2 Anti-claims",
      "2 Test Strategy", "2 Test Strategy Notes", "2 Evals", "3 ISC-1 · real eval", "2 Examples", "2 Decisions"]);
  });
  test("a section runs to the next heading of its level or higher; `---` stays inside", () => {
    const [criteria] = findSections(sections, "criteria");
    expect(ids(body(criteria!))).toEqual(["ISC-1", "ISC-90", "ISC-90", "ISC-90", "ISC-2", "ISC-3"]);
    expect(body(sections.find((s) => s.title === "Ideal State")!)).toContain("L3 · One sentence");
    expect(sections.find((s) => s.title === "ISA section boundaries fixture")!.end).toBe(text.length);
  });
  test("findSections matches a kind's names at their level, and only those", () => {
    expect(findSections(sections, "anti").map((s) => s.title)).toEqual(["Anti-claims"]);
    expect(findSections(sections, "bridge")).toEqual([]);
    expect(findSections(isaSections("## ISC Criteria\n- [ ] ISC-1\n### Criteria\n## Features\n"), "criteria").map((s) => `${s.level} ${s.title}`))
      .toEqual(["2 ISC Criteria", "3 Criteria", "2 Features"]);
  });
  test("frontmatter is skipped and offsets index the text passed in", () => {
    expect(sections[0]!.start).toBe(text.indexOf("# ISA section boundaries fixture"));
    for (const s of sections) expect(text.slice(s.start, s.bodyStart)).toMatch(/^#{1,3} /);
  });
  test("an unclosed fence runs to the end; a backtick info string with a backtick is not a fence", () => {
    expect(isaSections("## A\n```\n## B\n").map((s) => s.title)).toEqual(["A"]);
    expect(isaSections("## A\n``` x ` y\n## B\n").map((s) => s.title)).toEqual(["A", "B"]);
    expect(isaSections("## A\n~~~~\n~~~\n## B\n~~~~\n## C\n").map((s) => s.title)).toEqual(["A", "C"]);
  });
});
