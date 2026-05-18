/**
 * Markdown → Telegram HTML converter.
 *
 * Telegram's parse_mode "HTML" supports a small tag set: b, i, u, s, code,
 * pre, a, tg-spoiler. It does not render headers, lists, or tables. This
 * helper converts a useful subset of common markdown emitted by the DA into
 * that tag set so prose renders cleanly on phones.
 *
 * HTML special chars are escaped first so model-emitted '<', '>', '&' survive
 * verbatim inside the message body.
 *
 * Design choices:
 *  - Code blocks and inline code are stashed to placeholders BEFORE other
 *    transforms run, so bold/italic/etc. cannot leak into code content.
 *  - Italic markers (* and _) require punctuation/whitespace/tag-boundary on
 *    both sides so snake_case identifiers and arithmetic stars are not
 *    mangled, while still allowing italic to nest inside bold tags.
 *  - Unbalanced markers render as literal characters — no broken HTML can be
 *    emitted, so chunk-splitting before conversion is safe.
 *  - Headers and bullets collapse to <b> lines and "• " glyphs respectively,
 *    since Telegram does not natively render either.
 */
export function mdToHtml(text: string): string {
  let out = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

  // Stash code blocks first so subsequent bold/italic/etc. cannot mutate
  // their contents. Placeholder sentinels cannot appear in normal model
  // output and no other regex below matches against them.
  const stash: string[] = []
  const place = (html: string): string => {
    const i = stash.length
    stash.push(html)
    return ` CODE${i} `
  }

  out = out.replace(
    /```[a-zA-Z0-9_+-]*\n([\s\S]*?)```/g,
    (_, code) => place(`<pre>${code.replace(/\n$/, "")}</pre>`),
  )
  out = out.replace(/`([^`\n]+)`/g, (_, code) => place(`<code>${code}</code>`))

  // Links [text](url)
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
  // Bold **x**
  out = out.replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>")
  // Italic *x* / _x_ — boundary includes HTML tag chars (<, >) so italic can
  // nest inside bold (e.g. **a _b_**) while still rejecting snake_case.
  out = out.replace(/(^|[\s(>])\*([^*\n]+)\*(?=[\s).,!?:;<]|$)/g, "$1<i>$2</i>")
  out = out.replace(/(^|[\s(>])_([^_\n]+)_(?=[\s).,!?:;<]|$)/g, "$1<i>$2</i>")
  // Strikethrough ~~x~~
  out = out.replace(/~~([^~\n]+)~~/g, "<s>$1</s>")
  // ATX headers
  out = out.replace(/^#{1,6}\s+(.+)$/gm, "<b>$1</b>")
  // Bullet markers
  out = out.replace(/^\s*[-*+]\s+/gm, "• ")

  // Restore code placeholders.
  out = out.replace(/ CODE(\d+) /g, (_, i) => stash[Number(i)]!)
  return out
}
