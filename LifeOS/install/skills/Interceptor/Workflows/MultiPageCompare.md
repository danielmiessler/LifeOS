# MultiPageCompare

Extracting facts from N pages to answer a comparative question — "who designed Python vs JavaScript", "what year did each of these papers publish", "compare pricing across these three product pages". The answer lives in plain prose on each page; structure (refs, tree) doesn't matter. Need fast, sequential fact extraction with minimal context bloat.

## Preflight Isolation Gate (MANDATORY first step)

```bash
source $LIFEOS_DIR/USER/CUSTOMIZATIONS/SKILLS/Interceptor/preferences.env
bash $LIFEOS_ROOT/skills/Interceptor/Tools/PreflightIsolation.sh
```

Non-zero exit → STOP and surface the message verbatim. Do not fall back to the Default profile. `--context "$INTERCEPTOR_TEST_CONTEXT_ID"` (the pinned isolated context from `preferences.env`) is doctrine on every `open` below, not optional — it does not count against the command budget.

## Command Budget

**2 + 1 per page.** 3 commands for two pages, 4 for three, 5 for four:

1. `interceptor open <url-1> --text-only` → 1 (open + read prose in one shot)
2. `interceptor open <url-2> --text-only` → 1
3. (... 1 more per page ...)
4. Answer with the facts extracted.

If a page returns the wrong section (TOC instead of article body), spend 1 extra command on a scoped `read e<ref> --text-only` — once, not twice. Then commit.

## Why this exists

Without explicit guidance, the agent thrashes on multi-page comparisons — opens A, opens B, then re-opens A trying to "go back," sometimes mixing `tab new` and `navigate`. Tab-state confusion. This workflow prevents that.

## Procedure

1. **One `open --text-only` per page.** `--text-only` returns prose without the actionable-element tree — the only thing you need for fact extraction. Cuts ~70% of per-page token cost.

   ```bash
   interceptor open "https://en.wikipedia.org/wiki/Python_(programming_language)" --text-only --context "$INTERCEPTOR_TEST_CONTEXT_ID"
   interceptor open "https://en.wikipedia.org/wiki/JavaScript" --text-only --context "$INTERCEPTOR_TEST_CONTEXT_ID"
   ```

2. **Read each result in your context.** The text is already there from the `open` call — no follow-up `read` needed. Each `open` is open + wait + read in one round-trip.

3. **Answer from the texts.** Quote the exact fact from each page, naming the page it came from. If a page's text didn't contain the fact, say so for that page and answer only for the pages where you found it. Don't re-open.

## Anti-patterns

- **DO NOT use `tab new`** — `interceptor open` already creates a tab. `tab new` then `navigate` is the most common over-spend on this task type.
- **DO NOT use `navigate` after `open`** — `open` already navigates. `navigate` is for changing pages *within an already-managed tab*.
- **DO NOT re-open the same page** — your context still has its text from the first call. The second call is identical bytes.
- **DO NOT use full `interceptor read`** — the tree is irrelevant when you're extracting prose facts.
- **DO NOT chain `open` calls before reading any results** — read each one before opening the next, so you can decide whether you have enough.

## Context routing

`--context "$INTERCEPTOR_TEST_CONTEXT_ID"` is mandatory on every `open` (set by the preflight gate at the top), not a conditional you reach for only when multiple browsers are connected. With one context left, a bare command silently auto-routes to whatever single context remains — including Default. Always pass the pinned context:

```bash
interceptor open <url> --text-only --context "$INTERCEPTOR_TEST_CONTEXT_ID"
```

## When NOT to use this workflow

- **Single-page tasks** — use `ReadAndExtract.md`. This is for ≥ 2 pages.
- **Tasks where the answer requires clicking something on each page** — use `ReadAndExtract.md` or `VerifyDeploy.md` with `--tree-only --tree-format compact`.
- **Pages behind auth or with heavy JS rendering** — `--text-only` may miss content loaded after first paint. Fall back to full `read` for those specific pages, but stay sequential.

## Output format

```
Page 1 (Python wiki): Guido van Rossum, released 1991.
Page 2 (JavaScript wiki): Brendan Eich, released 1995.

Answer: Python was designed by Guido van Rossum (1991); JavaScript by Brendan Eich (1995). Python predates JavaScript by 4 years.
```

If you couldn't extract a fact, name the page and what you tried:

```
Page 1: extracted (Guido van Rossum, 1991).
Page 2: page text did not include the creator's name; the byline was rendered post-load.
```

Don't invent the missing fact. Don't retry indefinitely.
