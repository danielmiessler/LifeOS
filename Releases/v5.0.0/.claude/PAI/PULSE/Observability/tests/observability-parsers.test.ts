import { describe, test, expect } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"
import {
  cleanInlineMarkdown,
  firstParagraph,
  firstBodyParagraph,
  parseBullets,
  parseNestedHeadings,
  extractSnapshotSection,
} from "../observability"

type ParsedHeading = { id: string; title: string; body: string }

const FIXTURES = join(import.meta.dir, "fixtures")
const read = (name: string) => readFileSync(join(FIXTURES, name), "utf8")

// ─── cleanInlineMarkdown ────────────────────────────────────────────────────

describe("cleanInlineMarkdown", () => {
  test("strips **bold** markers", () => {
    expect(cleanInlineMarkdown("**bold**")).toBe("bold")
  })

  test("strips *italic* markers", () => {
    expect(cleanInlineMarkdown("*italic*")).toBe("italic")
  })

  test("strips mixed bold and italic in one string", () => {
    expect(cleanInlineMarkdown("**bold** and *italic*")).toBe("bold and italic")
  })

  test("trims surrounding whitespace", () => {
    expect(cleanInlineMarkdown("  hello world  ")).toBe("hello world")
  })

  test("handles empty string", () => {
    expect(cleanInlineMarkdown("")).toBe("")
  })

  test("leaves plain text unchanged", () => {
    expect(cleanInlineMarkdown("plain text")).toBe("plain text")
  })
})

// ─── firstParagraph ─────────────────────────────────────────────────────────

describe("firstParagraph", () => {
  test("returns first non-empty paragraph when multiple exist", () => {
    const result = firstParagraph("First paragraph.\n\nSecond paragraph.")
    expect(result).toBe("First paragraph.")
  })

  test("strips inline markdown from result", () => {
    const result = firstParagraph("**Bold opening** paragraph.")
    expect(result).toBe("Bold opening paragraph.")
  })

  test("collapses internal newlines within paragraph to single space", () => {
    const result = firstParagraph("Line one\nLine two\nLine three")
    expect(result).toBe("Line one Line two Line three")
  })

  test("heading-only content returns the heading text (no heading filtering here)", () => {
    const result = firstParagraph("# Just a Heading")
    expect(result.length).toBeGreaterThan(0)
  })

  test("skips leading blank lines and finds first content", () => {
    const result = firstParagraph("\n\nActual paragraph content here.")
    expect(result).toBe("Actual paragraph content here.")
  })
})

// ─── firstBodyParagraph ─────────────────────────────────────────────────────

describe("firstBodyParagraph", () => {
  test("skips # heading paragraph and returns next qualifying paragraph", () => {
    const result = firstBodyParagraph(
      "# Title\n\nThis is the real body paragraph with enough characters to qualify."
    )
    expect(result).toBe("This is the real body paragraph with enough characters to qualify.")
  })

  test("skips --- divider and returns next qualifying paragraph", () => {
    const result = firstBodyParagraph(
      "---\n\nReal paragraph with enough characters here to qualify."
    )
    expect(result).toBe("Real paragraph with enough characters here to qualify.")
  })

  test("skips paragraphs shorter than 20 characters", () => {
    const result = firstBodyParagraph(
      "Short.\n\nThis paragraph is long enough to be returned by the function."
    )
    expect(result).toBe("This paragraph is long enough to be returned by the function.")
  })

  test("skips > blockquote paragraphs", () => {
    const result = firstBodyParagraph(
      "> **Some aphorism here**\n\nThis is a real paragraph long enough to qualify for return."
    )
    expect(result).toBe("This is a real paragraph long enough to qualify for return.")
  })

  test("returns empty string when all content is heading/divider/short", () => {
    expect(firstBodyParagraph("# Title\n\n---\n\nShort.")).toBe("")
  })

  test("strips inline markdown from returned paragraph", () => {
    const result = firstBodyParagraph(
      "**Bold** and *italic* in a paragraph that is definitely long enough to qualify."
    )
    expect(result).toBe("Bold and italic in a paragraph that is definitely long enough to qualify.")
  })

  test("returns empty string for empty input", () => {
    expect(firstBodyParagraph("")).toBe("")
  })
})

// ─── parseBullets ────────────────────────────────────────────────────────────

describe("parseBullets", () => {
  test("extracts - dash bullet lines", () => {
    expect(parseBullets("- apple\n- banana")).toEqual(["apple", "banana"])
  })

  test("extracts * asterisk bullet lines", () => {
    expect(parseBullets("* one\n* two")).toEqual(["one", "two"])
  })

  test("ignores ## heading lines", () => {
    expect(parseBullets("## Section Heading\n- item one\n- item two")).toEqual(["item one", "item two"])
  })

  test("ignores blank lines between bullets", () => {
    expect(parseBullets("- a\n\n- b\n\n- c")).toEqual(["a", "b", "c"])
  })

  test("returns empty array for empty input", () => {
    expect(parseBullets("")).toEqual([])
  })

  test("returns empty array for input with no bullet lines", () => {
    expect(parseBullets("# Heading\n\nSome paragraph text.")).toEqual([])
  })

  test("books fixture — returns exactly 6 items", () => {
    expect(parseBullets(read("books.md"))).toHaveLength(6)
  })

  test("bands fixture — returns exactly 7 items", () => {
    expect(parseBullets(read("bands.md"))).toHaveLength(7)
  })

  test("books fixture first item contains 'Sample Novel One' (italic markers stripped)", () => {
    const items = parseBullets(read("books.md"))
    expect(items[0]).toContain("Sample Novel One")
  })
})

// ─── parseNestedHeadings ─────────────────────────────────────────────────────

describe("parseNestedHeadings", () => {
  test("parses ### G0: Title format — id and title correct", () => {
    const result: ParsedHeading[] = parseNestedHeadings("### G0: Sample Goal Alpha\nbody text", "G")
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("G0")
    expect(result[0].title).toBe("Sample Goal Alpha")
  })

  test("captures body text under heading", () => {
    const result: ParsedHeading[] = parseNestedHeadings(
      "### G0: Title\nbody line one\nbody line two",
      "G"
    )
    expect(result[0].body).toContain("body line one")
  })

  test("two adjacent headings produce two entries with correct ids", () => {
    const result: ParsedHeading[] = parseNestedHeadings("## G0: First\n## G1: Second", "G")
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe("G0")
    expect(result[1].id).toBe("G1")
  })

  test("body captures content across blank lines between headings", () => {
    const result: ParsedHeading[] = parseNestedHeadings(
      "## M0: Primary Mission\nsome body\n\nmore body",
      "M"
    )
    expect(result[0].body).toContain("some body")
    expect(result[0].body).toContain("more body")
  })

  test("returns empty array for empty string", () => {
    expect(parseNestedHeadings("", "G")).toEqual([])
  })

  test("goals fixture with prefix G — returns 3 entries", () => {
    const result: ParsedHeading[] = parseNestedHeadings(read("goals.md"), "G")
    expect(result).toHaveLength(3)
  })

  test("goals fixture G0 has correct id and title", () => {
    const result: ParsedHeading[] = parseNestedHeadings(read("goals.md"), "G")
    expect(result[0].id).toBe("G0")
    expect(result[0].title).toBe("Sample Goal Alpha")
  })

  test("goals fixture G0 body contains Status field value", () => {
    const result: ParsedHeading[] = parseNestedHeadings(read("goals.md"), "G")
    expect(result[0].body).toContain("in progress")
  })

  test("handles ## level-2 headings in addition to ###", () => {
    const result: ParsedHeading[] = parseNestedHeadings("## P0: Sample Problem\nbody", "P")
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("P0")
  })
})

// ─── extractSnapshotSection ──────────────────────────────────────────────────

describe("extractSnapshotSection", () => {
  test("extracts non-empty content under ## Health heading", () => {
    const snapshot = read("snapshot.md")
    expect(extractSnapshotSection(snapshot, "Health").length).toBeGreaterThan(0)
  })

  test("Work section contains expected project context text", () => {
    const snapshot = read("snapshot.md")
    expect(extractSnapshotSection(snapshot, "Work")).toContain("primary project")
  })

  test("returns empty string for a nonexistent heading", () => {
    expect(extractSnapshotSection(read("snapshot.md"), "Nonexistent")).toBe("")
  })

  test("Health section does not bleed into Work section content", () => {
    const snapshot = read("snapshot.md")
    expect(extractSnapshotSection(snapshot, "Health")).not.toContain("primary project")
  })

  test("Emotional Bandwidth section contains expected stress context", () => {
    const snapshot = read("snapshot.md")
    expect(extractSnapshotSection(snapshot, "Emotional Bandwidth")).toContain("release valve")
  })
})
