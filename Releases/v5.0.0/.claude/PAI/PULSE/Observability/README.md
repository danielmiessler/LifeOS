# Pulse Observability — Telos Dashboard

Next.js static-export dashboard served by the Pulse daemon at `localhost:31337`. Displays the six-dimension life OS view: goals, challenges, strategies, projects, team, budget, and preference context.

## Development

```bash
bun install
bun dev          # starts Next.js at :3333
bun run build    # static export to out/
bun test tests/  # run contract test suite
```

The Pulse daemon serves the static export from `out/` at port 31337. During development, run the daemon and Next.js dev server simultaneously; the dev server at :3333 gets live HMR while the daemon at :31337 serves the last build.

## Architecture

Data flows through three layers:

```
TELOS markdown files (PAI/USER/TELOS/)
        ↓  parse functions (observability.ts)
/api/telos/overview  JSON response
        ↓  use-telos-data.ts hook
React state (Telos type, merged over FALLBACK)
        ↓  components (_v7/)
Dashboard UI
```

### Layer 1 — Parse (`observability.ts`)

Six exported pure functions transform markdown files into typed values:

| Function | Input | Output |
|---|---|---|
| `cleanInlineMarkdown` | raw markdown string | plain text |
| `firstParagraph` | markdown string | first non-empty paragraph |
| `firstBodyParagraph` | markdown string | first paragraph after the first heading |
| `parseBullets` | markdown string | string[] of bullet text |
| `parseNestedHeadings` | markdown string | Record<heading, string[]> |
| `extractSnapshotSection` | markdown string, section name | section body text |

`buildPreferences()` composes these to read `BOOKS.md`, `MOVIES.md`, `BANDS.md`, `AUTHORS.md`, and `WISDOM.md` from `PAI/USER/TELOS/` and return a `PreferenceContext` object.

**Format requirement for `extractSnapshotSection`:** the function expects `---` to appear *before* the section content (immediately after the `## Heading` line). If `---` appears after content, the function returns an empty string for that section.

### Layer 2 — API (`/api/telos/overview`)

`handleTelosOverview()` in `observability.ts` assembles the JSON response. Key fields:

- `dimensions` — 6 items; IDs are the canonical set: `health, money, freedom, creative, relationships, rhythms`
- `subtabs` — 5 items (rhythms excluded); IDs match their dimension: `health, money, freedom, creative, relationships`
- `preferences` — populated by `buildPreferences()`; all 8 fields must be present

### Layer 3 — Normalize (`use-telos-data.ts`)

The hook fetches the API and merges it over `FALLBACK` from `data.ts`. Merge rules:

- Arrays (goals, missions, challenges, strategies, problems) — API wins only when non-empty; empty array falls back to FALLBACK
- Objects (owner, idealState, dimensions, subtabs, preferences) — API wins on any non-null value
- Each array item gets default fields spread before the API values (e.g. goals get `pct: 0, delta: 0, dims: [], metrics: []`)

### SPARK_SEEDS coupling

`subtabs.tsx` contains a static `SPARK_SEEDS` constant keyed by subtab ID:

```ts
const SPARK_SEEDS = {
  health:        [...],
  money:         [...],
  freedom:       [...],
  creative:      [...],
  relationships: [...],
}
```

`SPARK_SEEDS[active]` is looked up at render time using the active subtab's ID. **If a key is missing, the spark graph renders blank.** The keys must exactly match the IDs the API returns.

## Key coupling points

These are the places where a change in one file silently breaks another:

| Coupling | Files involved | What breaks |
|---|---|---|
| `SPARK_SEEDS` keys ↔ API subtab IDs | `subtabs.tsx` ↔ `observability.ts` | Spark graphs render blank |
| `FALLBACK.subtabs` IDs ↔ API subtab IDs | `data.ts` ↔ `observability.ts` | SPARK_SEEDS lookup fails on first render before API loads |
| `PreferenceContext` fields ↔ `buildPreferences()` output ↔ `sections.tsx` render | `data.ts` ↔ `observability.ts` ↔ `sections.tsx` | Missing fields render empty or throw |
| `extractSnapshotSection` format ↔ SNAPSHOT.md structure | `observability.ts` ↔ `PAI/USER/TELOS/SNAPSHOT.md` | Snapshot sections return empty strings |

## Adding a new preference field

Three files must change together:

1. `data.ts` — add field to `PreferenceContext` interface + FALLBACK value
2. `observability.ts` — populate field in `buildPreferences()` return object
3. `sections.tsx` — add render block inside the Preferences component

## Adding a new subtab dimension

Four things must change together:

1. `observability.ts` — add to subtabs assembly in `handleTelosOverview()`
2. `data.ts` — add to `FALLBACK.subtabs`
3. `subtabs.tsx` — add key to `SPARK_SEEDS` with seed data
4. Tests — update `EXPECTED_SUBTAB_IDS` in `telos-component-contracts.test.ts` and counts in `telos-api.test.ts`

## Tests

```
tests/
  observability-parsers.test.ts     # 41 tests — pure parse functions against fixtures
  telos-api.test.ts                 # 21 tests — live API contract (skipped if server down)
  telos-data-normalization.test.ts  # 18 tests — merge/normalize logic
  telos-component-contracts.test.ts # 15 tests — FALLBACK shape + SPARK_SEEDS alignment
  fixtures/
    books.md       # synthetic bullet list
    bands.md       # synthetic bullet list
    wisdom.md      # synthetic aphorism blockquotes + body paragraphs
    snapshot.md    # synthetic sections with --- before content
    goals.md       # synthetic ### G0: heading format
```

See `tests/CONTRACTS.md` for the full contract documentation and reasoning behind each test layer.
