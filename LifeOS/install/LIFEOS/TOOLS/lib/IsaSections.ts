/**
 * IsaSections — how an ISA is cut into sections, in one place (public issue #2527).
 *
 *   SECTION_ALIASES              every name a criteria, bridge or anti section has gone by
 *   CRITERIA_HEADING_RE          generated from SECTION_ALIASES; isa-utils, IsaClaims and IsaFrontier
 *   BRIDGE_HEADING_RE            re-export these instead of keeping hand-copied literals
 *   ANTI_HEADING_RE
 *   isaSections(text)            the ISA's H1–H3 sections, with fences and frontmatter handled once
 *   findSections(sections, kind) the sections whose heading is one of that kind's names
 *
 * The readers that scan sections on their own (IsaLadder.h2Sections, Review.isaSections, parseEvalsText,
 * parseTestStrategyText, isa-utils.extractCriteriaSection, parseIsaClaimsText, IsaFrontier) keep their own rules
 * for now. IsaSections.test.ts pins what each of them sees on IsaSections.fixture.md, so moving one onto
 * isaSections() is a single change whose boundary difference shows in that test.
 *
 * This module imports nothing. IsaClaims and IsaFrontier copied the criteria regex rather than pull in
 * isa-utils and its hook graph; a leaf module ends the copies without that cost.
 */

type Alias = { level: 2 | 3; pattern: string };

/**
 * Heading names by section kind, as regex fragments. The criteria entries, in the order the readers have always
 * alternated them, are `## Criteria` and `## ISC Criteria`, `## Claims`, `## IDEAL STATE CRITERIA`,
 * `### Criteria`, and `## Features`. A feature-block ISA (v2.16.0) holds its criteria under `## Features`,
 * nested in `### F<n>` H3s, so the section runs to the next H2. A legacy ISA keeps a `## Claims`/`## Criteria`
 * section that comes before its `## Features` pointer table, and that table has no `- [ ]` lines.
 */
export const SECTION_ALIASES = {
  criteria: [
    { level: 2, pattern: String.raw`(?:ISC\s+)?Criteria` },
    { level: 2, pattern: String.raw`Claims` },
    { level: 2, pattern: String.raw`IDEAL\s+STATE\s+CRITERIA` },
    { level: 3, pattern: String.raw`Criteria` },
    { level: 2, pattern: String.raw`Features` },
  ],
  // `## Bridge Criteria` (ISAFormat row 12): cross-ISA integration ISCs, counted like criteria (public issue #2186).
  bridge: [{ level: 2, pattern: String.raw`Bridge\s+Criteria` }],
  // `## Anti-criteria` (current) or `## Anti-claims` (legacy).
  anti: [{ level: 2, pattern: String.raw`Anti-(?:criteria|claims)` }],
} as const satisfies Record<string, readonly Alias[]>;

export type SectionKind = keyof typeof SECTION_ALIASES;

/** `wholeLine` matches the heading line to its end (`[^\n]*$`); otherwise only the heading's start. */
function headingSource(aliases: readonly Alias[], wholeLine: boolean): string {
  const alts = aliases.map((a) => `${"#".repeat(a.level)}\\s+${a.pattern}\\b${wholeLine ? "[^\\n]*" : ""}`);
  return `^${alts.length === 1 ? alts[0] : `(?:${alts.join("|")})`}${wholeLine ? "$" : ""}`;
}

export const CRITERIA_HEADING_RE = new RegExp(headingSource(SECTION_ALIASES.criteria, true), "im");
export const BRIDGE_HEADING_RE = new RegExp(headingSource(SECTION_ALIASES.bridge, true), "im");
export const ANTI_HEADING_RE = new RegExp(headingSource(SECTION_ALIASES.anti, false), "i");

export interface IsaSection {
  level: 1 | 2 | 3;
  /** Heading text, trimmed, closing `#`s removed. */
  title: string;
  /** Character offsets into the text passed in: the heading line's start, the first character after it, the section's end. */
  start: number;
  bodyStart: number;
  end: number;
}

const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---[^\S\r\n]*(?:\r?\n|$)/;
const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const HEADING = /^ {0,3}(#{1,3})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/;

/**
 * The H1–H3 sections of an ISA. Frontmatter is skipped. A fence closes only on the same character, at least as
 * long, with nothing after it, so a ``` line inside a ```` block stays inside; an unclosed fence runs to the end.
 * Headings inside fences are text. A section ends at the next heading of the same or a higher level (an H2 ends at
 * the next H2 or H1), or at the end of the text; a `---` rule is body text.
 */
export function isaSections(text: string): IsaSection[] {
  const heads: Omit<IsaSection, "end">[] = [];
  let offset = text.match(FRONTMATTER)?.[0].length ?? 0;
  let fence: { char: string; size: number } | null = null;
  for (const line of text.slice(offset).split("\n")) {
    const start = offset;
    offset += line.length + 1;
    const bare = line.replace(/\r$/, "");
    const f = FENCE.exec(bare);
    if (fence) {
      if (f && f[1]![0] === fence.char && f[1]!.length >= fence.size && !f[2]!.trim()) fence = null;
      continue;
    }
    if (f && !(f[1]![0] === "`" && f[2]!.includes("`"))) { fence = { char: f[1]![0]!, size: f[1]!.length }; continue; }
    const h = HEADING.exec(bare);
    if (h) heads.push({ level: h[1]!.length as 1 | 2 | 3, title: h[2]!.trim(), start, bodyStart: Math.min(offset, text.length) });
  }
  return heads.map((h, i) => {
    const next = heads.slice(i + 1).find((n) => n.level <= h.level);
    return { ...h, end: next ? next.start : text.length };
  });
}

/** The sections whose level and title match one of `kind`'s names. */
export function findSections(sections: IsaSection[], kind: SectionKind): IsaSection[] {
  const names = SECTION_ALIASES[kind].map((a) => ({ level: a.level, re: new RegExp(`^${a.pattern}\\b`, "i") }));
  return sections.filter((s) => names.some((n) => n.level === s.level && n.re.test(s.title)));
}
