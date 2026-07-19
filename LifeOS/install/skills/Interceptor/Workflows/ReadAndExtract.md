# ReadAndExtract

Extract structured information from a webpage — a fact, value, list, table contents. Use when the answer lives in the DOM, an XHR response, or rendered text, and you need to return it as data.

## Preflight Isolation Gate (MANDATORY first step)

```bash
source $LIFEOS_DIR/USER/CUSTOMIZATIONS/SKILLS/Interceptor/preferences.env
bash $LIFEOS_ROOT/skills/Interceptor/Tools/PreflightIsolation.sh
```

Non-zero exit → STOP and surface the message verbatim. Do not fall back to the Default profile. Every browser verb in this workflow passes `--context "$INTERCEPTOR_TEST_CONTEXT_ID"` (the pinned isolated context from `preferences.env`) — the examples below omit it for brevity, but append it to each call. Screenshots, if any, go through `Tools/Capture.sh`, never raw `interceptor screenshot`.

## Command Budget

**3 commands, max 4.**

1. `interceptor open <url>` — preflight; returns tree + flat text by default
2. **One** narrow read (only if step 1 was insufficient): pick exactly ONE of `read --text-only`, `read --markdown --text-only`, or `read --tree-only --tree-format compact`. Never run two content surfaces.
3. Optional: `read <ref>` for a sub-element OR `find "<text>"` if the first read missed.

If you're at command 4 without the value, commit with what's there. Don't add a 5th read.

**Mode-swap rule:** if step 2 needs structure (exact-text task, tables, decoy-prone page), use `--markdown --text-only` *instead of* plain `--text-only`. Don't run both — they're the same content rendered differently.

## Decision tree

1. **Plain page text?** → `read --text-only` (smallest surface).
2. **Specific element?** → `find "<text>"` or `read e<ref>`.
3. **Sub-tree?** → `read e<ref>` to scope.
4. **Iframe?** → `read --include-frames`, refs like `e2_7`.
5. **Client-side SPA state?** → `inspect` (tree + network) or `state` for framework state.
6. **API response?** → `net log --filter <pattern>` or `inspect --net-only`.
7. **None of the above?** → `eval --main "expression"` as escape hatch.

## When `read` returns less than expected

`read` appends `... (truncated: showed X of Y chars ...)` when capped. Look for the marker before assuming data isn't there.

Fix in one command:

- `read e<ref> --text-only` — scope to a known section (cheapest)
- `read --text-only --full` — widen to 200K chars
- `find "<target>"` — jump straight to the element (cheapest if you know the text)

**Do NOT fetch `?action=raw`, `view-source:`, or any markup-level URL.** Rendered text is easier than source.

## Use `--markdown` when

- Task says "report the exact X" / "the summary text" / "the exact phrasing" — visual hierarchy disambiguates.
- Page has obviously emphasized text adjacent to plain copy that could be mistaken for the answer.
- You need a clean table render (markdown pipe tables > scraped prose).

## Don't use `--markdown` when

- The fact is a single value (date, name, number) — flat text is faster.
- You already ran `--text-only` and got the answer. Don't re-read in a different mode.

## SPA state / XHR data

```bash
interceptor state --context "$INTERCEPTOR_TEST_CONTEXT_ID"                              # Common framework probes
interceptor eval --main "window.__APP_STATE__" --context "$INTERCEPTOR_TEST_CONTEXT_ID"  # Targeted page-world read
interceptor net log --filter graphql --limit 10 --context "$INTERCEPTOR_TEST_CONTEXT_ID"
interceptor inspect --net-only --context "$INTERCEPTOR_TEST_CONTEXT_ID"
```

## Iframes

```bash
interceptor read --include-frames --context "$INTERCEPTOR_TEST_CONTEXT_ID"
interceptor act e2_7 --context "$INTERCEPTOR_TEST_CONTEXT_ID"    # Framed ref directly
```

## Output format

- **Single value:** quote verbatim, no prose padding.
- **List:** bulleted, exact strings, source order.
- **Table:** markdown table preserving columns.
- **Network response:** exact JSON path + value.

If value is missing or empty, say "not found" with the exact selector or filter that returned nothing. Don't invent a default.
