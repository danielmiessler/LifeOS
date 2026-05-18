/**
 * Tests for the mdToHtml helper used by the Telegram module.
 *
 * Run with: bun test Releases/v5.0.0/.claude/PAI/PULSE/modules/telegram.test.ts
 */
import { describe, expect, test } from "bun:test"
import { mdToHtml } from "./markdown-html"

describe("mdToHtml", () => {
  test("HTML special chars are escaped first", () => {
    expect(mdToHtml("a < b & c > d")).toBe("a &lt; b &amp; c &gt; d")
  })

  test("bold **x** → <b>x</b>", () => {
    expect(mdToHtml("this is **bold** here")).toBe("this is <b>bold</b> here")
  })

  test("italic *x* with boundary → <i>x</i>", () => {
    expect(mdToHtml("an *emphasised* word")).toBe("an <i>emphasised</i> word")
  })

  test("italic _x_ with boundary → <i>x</i>", () => {
    expect(mdToHtml("an _emphasised_ word")).toBe("an <i>emphasised</i> word")
  })

  test("snake_case underscores survive intact", () => {
    expect(mdToHtml("call connection_reference_name twice")).toBe(
      "call connection_reference_name twice",
    )
  })

  test("inline `code` → <code>code</code>", () => {
    expect(mdToHtml("run `bun test` now")).toBe("run <code>bun test</code> now")
  })

  test("brackets inside inline code are escaped", () => {
    expect(mdToHtml("use `arr<T>` here")).toBe("use <code>arr&lt;T&gt;</code> here")
  })

  test("fenced code blocks → <pre>", () => {
    const input = "```ts\nlet x = 1\nlet y = 2\n```"
    expect(mdToHtml(input)).toBe("<pre>let x = 1\nlet y = 2</pre>")
  })

  test("fenced code with no language tag", () => {
    expect(mdToHtml("```\nhello\n```")).toBe("<pre>hello</pre>")
  })

  test("links [text](url) → <a href>", () => {
    expect(mdToHtml("see [docs](https://example.com) for more")).toBe(
      'see <a href="https://example.com">docs</a> for more',
    )
  })

  test("nested bold + italic", () => {
    expect(mdToHtml("**bold _and italic_**")).toBe("<b>bold <i>and italic</i></b>")
  })

  test("strikethrough ~~x~~ → <s>", () => {
    expect(mdToHtml("this is ~~gone~~ now")).toBe("this is <s>gone</s> now")
  })

  test("ATX headers become bold lines", () => {
    expect(mdToHtml("# Heading\nbody")).toBe("<b>Heading</b>\nbody")
    expect(mdToHtml("### Sub")).toBe("<b>Sub</b>")
  })

  test("bullet markers become bullet glyphs", () => {
    expect(mdToHtml("- one\n- two\n* three\n+ four")).toBe(
      "• one\n• two\n• three\n• four",
    )
  })

  test("unbalanced bold marker renders as literal asterisks (no broken HTML)", () => {
    expect(mdToHtml("starting **but no close")).toBe("starting **but no close")
  })

  test("unbalanced italic underscore renders as literal", () => {
    expect(mdToHtml("snake_case at end_")).toBe("snake_case at end_")
  })

  test("code block content is not re-processed for inline markdown", () => {
    const input = "```\n**not bold**\n```"
    expect(mdToHtml(input)).toBe("<pre>**not bold**</pre>")
  })

  test("URL with underscores is not italicised", () => {
    expect(mdToHtml("[link](https://x.com/my_path_here)")).toBe(
      '<a href="https://x.com/my_path_here">link</a>',
    )
  })

  test("multiple bold spans in one line", () => {
    expect(mdToHtml("**a** and **b**")).toBe("<b>a</b> and <b>b</b>")
  })

  test("empty input returns empty string", () => {
    expect(mdToHtml("")).toBe("")
  })

  test("plain prose with no markdown is unchanged", () => {
    expect(mdToHtml("just a normal sentence.")).toBe("just a normal sentence.")
  })
})
