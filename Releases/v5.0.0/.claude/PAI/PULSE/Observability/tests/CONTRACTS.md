# Telos ↔ Pulse — Contract Documentation

Documents the contracts between the three data layers, what each test file verifies, and the bugs that were fixed when this suite was written.

---

## The three layers

```
Layer 1 — Parse
  observability.ts pure functions
  Input: markdown files (PAI/USER/TELOS/)
  Output: typed string arrays and records

Layer 2 — API
  /api/telos/overview (handleTelosOverview in observability.ts)
  Input: parse function output + TELOS directory
  Output: JSON matching the Telos TypeScript interface

Layer 3 — Normalize
  use-telos-data.ts React hook
  Input: API JSON + FALLBACK from data.ts
  Output: Telos object (React state)
```

Each layer has a defined contract. A change that crosses a layer boundary without updating both sides causes a silent failure — no TypeScript error, no runtime crash, just wrong data rendered on screen.

---

## Layer 1 — Parse contracts

### `cleanInlineMarkdown(s)`
Strips `**bold**`, `*italic*`, `[text](url)` link text (keeps text, drops URL), and `\`code\`` backticks. Does not strip block-level structure (headings, bullets, blockquotes).

### `firstParagraph(s)`
Returns the first non-empty line of the input after trimming. Useful for extracting a single-sentence summary from a file whose first line is the key content.

### `firstBodyParagraph(s)`
Skips any leading `#` heading lines, then returns the first non-empty paragraph. Use this when a file starts with a heading before the real content.

### `parseBullets(s)`
Returns the text of every `-` or `*` bullet line, stripped of the leading marker and leading/trailing whitespace. Does not descend into nested bullets — only top-level matches. Returns `[]` on no match.

### `parseNestedHeadings(s)`
Returns `Record<string, string[]>` where each key is a `##` or `###` heading (text only, no `#`) and the value is the `parseBullets` output for the lines under that heading until the next heading.

### `extractSnapshotSection(content, sectionName)`
Finds a `## sectionName` heading, then splits on the next `---` divider. Returns the text after the `---`, trimmed.

**Critical format contract:** the `---` must appear *after* the heading and *before* the section content:

```markdown
## Health
---
The actual content goes here.
```

If `---` appears after the content (or not at all), the function returns `""` for that section. The live `SNAPSHOT.md` format uses `---` as a post-heading divider, so real snapshot data returns empty strings and the component falls back to `idealContent` from `buildSubtabs`. The fixture files in this test suite use the function's expected format to exercise the happy path.

---

## Layer 2 — API contracts

`GET /api/telos/overview` must return:

```
owner          { name: string, day: string, streak: number }
idealState     { horizon: string, note: string }
dimensions     array of exactly 6 items
               IDs: health, money, freedom, creative, relationships, rhythms
               each has: id, label, cur, ideal, velo, color (string starting with --)
subtabs        array of exactly 5 items (rhythms excluded)
               IDs: health, money, freedom, creative, relationships
               each has: id, label, dim, cur, ideal, velo, top
               dim === id (each subtab is self-referential to its dimension)
preferences    non-null object
               required arrays: books, films, music, literature, aphorisms
               optional arrays: anime, characters, hobbies
goals          array
missions       array
challenges     array
strategies     array
```

These are not aspirational — they are what the component layer depends on. Missing a field or changing a subtab ID causes a rendering failure.

---

## Layer 3 — Normalize contracts

`use-telos-data.ts` merges API data over FALLBACK. The rules:

**Objects (owner, idealState, dimensions, subtabs, preferences):**
API value replaces FALLBACK when non-null. If the API returns null, FALLBACK is used unchanged.

**Arrays (goals, missions, challenges, strategies, problems):**
API value replaces FALLBACK only when the array is non-empty. Empty array (`[]`) and null both fall back to FALLBACK. This prevents a partial API response from wiping out FALLBACK placeholder data.

**Per-item defaults:**
Each array item gets default field values spread before the API values. This means API items with missing fields still have safe typed values rather than undefined:

| Array | Defaults applied |
|---|---|
| goals | `kpi: "", target: "", pct: 0, delta: 0, dims: [], metrics: []` |
| missions | `horizon: "", active: true, addresses: []` |
| problems | `severity: "med", affects: []` |
| challenges | `note: "", blocks: []` |
| strategies | `overcomes: [], implements: [], active: true` |

**If the merge logic in `use-telos-data.ts` changes, the tests in `telos-data-normalization.test.ts` must be updated to match.** The normalization test file contains a local copy of the merge function to keep it pure and testable without mounting a React component.

---

## SPARK_SEEDS coupling

`subtabs.tsx` renders a spark graph for each subtab using a static seed:

```ts
const SPARK_SEEDS = {
  health:        [...],
  money:         [...],
  freedom:       [...],
  creative:      [...],
  relationships: [...],
}
```

`SPARK_SEEDS[active]` is looked up where `active` is the currently selected subtab's `id` from the API response. **The keys must exactly match the subtab IDs the API returns.** If a key is missing, `SPARK_SEEDS[active]` is `undefined` and the Spark component renders with its default flat line.

**Bug fixed:** Before this test suite was added, `SPARK_SEEDS` had keys `{business, finances, health, work, life}` — the old FALLBACK subtab IDs — instead of the API-returned IDs `{health, money, freedom, creative, relationships}`. Every tab except `health` rendered a flat default spark graph.

The `FALLBACK.subtabs` IDs in `data.ts` must also match the API contract. Before the fix, FALLBACK used the old IDs. The first render (before the API response arrives) used FALLBACK, so `SPARK_SEEDS[active]` was already wrong from the start.

---

## Preferences coupling

`buildPreferences()` in `observability.ts` populates the `preferences` field from TELOS markdown files. The output keys must match the `PreferenceContext` interface in `data.ts`, and `sections.tsx` must have a render block for each field it wants to display.

**Bug fixed:** `preferences` was hardcoded to `null` in the API response. The component fell back to FALLBACK preferences (four generic placeholder strings per field). Real books, films, and music from the user's TELOS files were never read.

**Bug fixed:** The `music` field was missing from the `PreferenceContext` interface and from FALLBACK, so even after `buildPreferences()` was wired up, music was absent. Three files had to change together: the interface in `data.ts`, the FALLBACK value in `data.ts`, and the render block in `sections.tsx`.

---

## Test file index

### `observability-parsers.test.ts`
Tests all six parse functions against the fixture files. These are pure functions with no side effects — the tests confirm exact output for known input and serve as regression guards when the parse logic changes.

Coverage: cleanInlineMarkdown, firstParagraph, firstBodyParagraph, parseBullets, parseNestedHeadings, extractSnapshotSection.

### `telos-api.test.ts`
Integration tests against a live Pulse server at `localhost:31337`. All tests are guarded by `if (!serverUp) return` — a 3-second probe in `beforeAll` determines whether the server is reachable. Tests are silently skipped when the server is down, so this file never fails in CI that doesn't run the daemon.

Covers: HTTP 200, owner/idealState shape, dimensions count and IDs, subtabs count and IDs, subtab `dim === id` invariant, preferences field presence.

### `telos-data-normalization.test.ts`
Tests the merge/normalize contract as a pure function without mounting React. Contains a local copy of the merge logic from `use-telos-data.ts` — if the hook changes, this file must stay in sync.

Covers: null/empty/partial API data for all primitive arrays; per-item default injection; structural guarantees (dimensions, subtabs, preferences always present in result).

### `telos-component-contracts.test.ts`
Tests FALLBACK data shape and documents the SPARK_SEEDS contract.

Covers: FALLBACK preferences field presence, FALLBACK subtab shape (velo, label, cur, ideal), SPARK_SEEDS alignment (FALLBACK subtab IDs must equal the keys in SPARK_SEEDS), dimensions count and color field format.

---

## Fixture file contracts

All fixture files use synthetic placeholder data — no personal information belongs in the source repo.

| File | Format expected by | Key format detail |
|---|---|---|
| `books.md` | `parseBullets` | `- Title — Author` bullet lines under `##` headings |
| `bands.md` | `parseBullets` | `- Band Name` bullet lines |
| `wisdom.md` | `extractSnapshotSection`, body paragraph tests | `> **aphorism**` blockquotes; body paragraphs after headings |
| `snapshot.md` | `extractSnapshotSection` | `## Heading\n---\ncontent` — `---` before content |
| `goals.md` | `parseNestedHeadings` | `### G0: Title` headings with `**Status:**` etc. fields under each |

The snapshot fixture format (`---` before content) differs from the real `SNAPSHOT.md` (`---` after content) by design — the fixtures test what the function *can* parse; real snapshot data takes a different code path.
