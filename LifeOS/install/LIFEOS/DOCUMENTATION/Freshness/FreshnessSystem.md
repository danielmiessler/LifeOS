---
version: 1.2.3
---

# Freshness System

> Freshness protects the loop's inputs. The LifeOS (`LifeOs/LifeOsThesis.md`) hill-climbs against its picture of your current state and your TELOS — if those files silently age, the OS optimizes toward a person who no longer exists. The convention below makes constitutional staleness visible before it becomes drift.

Every file that loads into the DA's context at session start carries a known recency. This is the freshness convention — `pai-freshness-v1`. It exists because constitutional context that drifts silently is worse than missing context: the model behaves with confidence on stale ground and the principal can't tell.

## Why

Six files load at every session as the constitutional context layer. They shape every prompt, every routing decision, every identity assertion:

- `LIFEOS/USER/DIGITAL_ASSISTANT/DA_IDENTITY.md` — the DA's voice, personality, relationship pact
- `LIFEOS/USER/PRINCIPAL/PRINCIPAL_IDENTITY.md` — the principal's identity, role, worldview
- `LIFEOS/USER/PROJECTS.md` — project registry + routing aliases
- `LIFEOS/LIFEOS_SYSTEM_PROMPT.md` — constitutional rules
- `LIFEOS/USER/TELOS/PRINCIPAL_TELOS.md` — TELOS summary (auto-generated)
- `LIFEOS/DOCUMENTATION/ARCHITECTURE_SUMMARY.md` — subsystem index (auto-generated)

Plus the underlying `LIFEOS/USER/TELOS/TELOS.md` whose sections drive `PRINCIPAL_TELOS.md` and the per-section `ContextCheckin` workflow.

Without a freshness signal, a 6-month-old PROJECTS table looks identical to one updated yesterday. The principal has no surface to know which constitutional file deserves a review pass. The model has no way to surface drift before it becomes silent damage.

## Convention

### File-level frontmatter (every constitutional file)

```yaml
---
last_updated: 2026-05-04T03:00:00-07:00
last_updated_by: <da-name>
convention: pai-freshness-v1
last_reviewed: 2026-05-04T18:27:00.868Z
last_reviewed_by: <principal>
---
```

`last_updated` is an ISO-8601 timestamp of the most recent *write* to the file (any author, including auto-bumps from migrations and generators). `last_updated_by` is a free-form agent or human identifier (e.g. your DA name, your username, `migration`, `GenerateTelosSummary`). `convention` is the schema version — bump when the format changes.

`last_reviewed` is the ISO-8601 timestamp of the most recent **principal review** of the content. It is explicitly distinct from `last_updated`: migrations, auto-generators, and incidental writes do NOT bump it. Only the Interview skill's `ContextCheckin` workflow (or an equivalent principal-driven review flow) calls `bumpReviewedTimestamp`. **The freshness signal — A-F grade, statusline FRESH line, `most_stale` ranking — is computed from `last_reviewed`, not `last_updated`.** Without this distinction, every byte change would reset the clock and the signal would degrade to noise.

`last_reviewed_by` records who recorded the review (typically the principal's username).

### Per-section markers (TELOS.md only)

TELOS.md additionally carries per-H2 markers so individual sections (Mission, Goals, Problems…) can drift independently:

```markdown
## Mission
<!-- updated: 2026-05-01 by:<da-name> -->

M0: …
```

HTML comments are markdown-invisible (don't render in any preview surface) but trivially greppable.

### Auto-generated derivatives

Files like `PRINCIPAL_TELOS.md` and `ARCHITECTURE_SUMMARY.md` are generated from sources. Their frontmatter carries `derived_from:` plus `generator:`:

```yaml
---
last_updated: 2026-05-04T05:37:23.268Z
last_updated_by: GenerateTelosSummary
convention: pai-freshness-v1
derived_from: LIFEOS/USER/TELOS/TELOS.md
generator: LIFEOS/TOOLS/GenerateTelosSummary.ts
---
```

The `last_updated` on a derivative tracks generator runs but does NOT drive the staleness signal. Effective freshness for derived files is computed from the source — a regenerated file isn't a reviewed file, and the signal we care about is "has a human looked at the source?"

## A-F grade

Each file gets a letter grade A/B/C/D/F derived from `reviewed_age_days : threshold_days`:

| Grade | Ratio | Meaning |
|-------|-------|---------|
| A | ≤25% | Recently reviewed |
| B | ≤50% | Comfortable |
| C | ≤75% | Approaching review window |
| D | ≤100% | Within window but overdue soon |
| F | >100% OR no `last_reviewed` | Overdue or never reviewed |

The overall grade is a GPA-style mean (A=4..F=0) of all per-file letter grades, mapped back to a letter (≥3.5=A, ≥2.5=B, ≥1.5=C, ≥0.5=D, else F). Per-file `pct` is a 0..100 score from review age, NOT write age — `null reviewed_age` (never reviewed) → 0.

Statusline FRESH line and `/api/freshness/summary` both surface these grades.

## Library

Single source: `$LIFEOS_DIR/TOOLS/TelosFreshness.ts` (named for historical reasons; covers all constitutional files).

```ts
// TELOS-specific (per-section)
export function readTelosFreshness(path?: string): TelosFreshness;
export function bumpTelosTimestamp(slug?: string, by?: string, path?: string): { changed: boolean; sectionFound: boolean };
export function sectionSlug(heading: string): string;

// Multi-file constitutional context — read
export function readContextFreshness(): ContextFreshness;
export function readFileFrontmatter(path: string): Record<string, string> | null;

// Multi-file constitutional context — write
export function bumpContextTimestamp(filePath: string, by?: string): { changed: boolean };
//   ↑ writes last_updated. Migrations, generators, and any incidental write should call this.
export function bumpReviewedTimestamp(filePath: string, by?: string): { changed: boolean };
//   ↑ writes last_reviewed. ONLY the Interview workflow (or equivalent principal review) should call this.

// Grade computation
export type FreshnessGrade = "A" | "B" | "C" | "D" | "F";
export function freshnessPct(reviewedAgeDays: number | null, thresholdDays: number): number;
export function freshnessGrade(reviewedAgeDays: number | null, thresholdDays: number): FreshnessGrade;
export function aggregateGrade(grades: FreshnessGrade[]): FreshnessGrade;

// Registry
export const CONTEXT_FRESHNESS_REGISTRY: ContextFile[];
export const STALENESS_THRESHOLDS: Record<string, number>;
```

The registry typed shape:

```ts
interface ContextFile {
  slug: string;                    // canonical key, e.g. "da_identity"
  path: string;                    // absolute path
  threshold_days: number;          // staleness threshold for this file
  derived_from?: string;           // path to source if auto-generated
  is_auto_generated: boolean;
}
```

Every successful write through `bumpTelosTimestamp`, `bumpContextTimestamp`, and `bumpReviewedTimestamp` calls `writeFreshnessCache()` so the statusline render-path cache (see below) stays in sync without a network call.

## Threshold rationale

Thresholds reflect **review cadence, not change cadence**. The right question is "when do I want to be reminded to look?"

| File | Threshold | Rationale |
|------|-----------|-----------|
| `current_state` (TELOS section) | 7d | Operational, fast-moving — what's true today |
| `status` (TELOS section) | 14d | Recent-work tracking |
| `projects` | 30d | Projects added/removed weekly |
| `goals`, `strategies` (TELOS) | 30d | Active work needs monthly check-in |
| `principal_identity` | 90d | Location, role can shift |
| `pai_system_prompt` | 90d | Constitutional — quarterly review |
| `mission`, `beliefs`, `models`, `frames`, `wisdom`, `ideal_state` (TELOS) | 90d | Slow-moving foundational |
| `da_identity` | 180d | Voice, personality — changes rarely |
| Preferences (books, bands, restaurants…) | 180d | Long-tail static |
| `traumas`, `wrong`, `2036` (TELOS) | 365d | Effectively permanent |

Override per-installation by editing the `STALENESS_THRESHOLDS` map.

## CLI

```bash
# Per-section TELOS freshness (the original surface)
bun $LIFEOS_DIR/TOOLS/TelosFreshness.ts
bun $LIFEOS_DIR/TOOLS/TelosFreshness.ts --json
bun $LIFEOS_DIR/TOOLS/TelosFreshness.ts --bump goals

# Multi-file constitutional freshness
bun $LIFEOS_DIR/TOOLS/TelosFreshness.ts context
bun $LIFEOS_DIR/TOOLS/TelosFreshness.ts context --json

# Content quality audit (read-only)
bun $LIFEOS_DIR/TOOLS/ContextAudit.ts
bun $LIFEOS_DIR/TOOLS/ContextAudit.ts --json
```

## Pulse routes

Pulse module at `$LIFEOS_DIR/PULSE/modules/telos.ts` exposes the same data over HTTP:

- `GET /api/telos/freshness` — full TELOS per-section freshness
- `GET /api/telos/freshness/stale` — TELOS stale sections only
- `GET /api/telos/freshness/summary` — small payload for statusline / DA panel
- `GET /api/freshness` — full multi-file constitutional freshness
- `GET /api/freshness/summary` — `{ total, fresh_count, stale_count, overall_pct, overall_grade, most_stale, files: [...] }` for DA panel. Each file entry carries `slug, name, age_days, threshold_days, reviewed_age_days, pct, grade, stale, why`.

Response is cached for 60s. Reload via Pulse `/reload` invalidates the cache and rewrites the statusline cache file.

## Statusline cache (render-path optimization)

The statusline FRESH line cannot afford a network call on every refresh (1s interval, blocking on Pulse-down would freeze rendering). `LIFEOS/TOOLS/FreshnessCache.ts` writes a tiny mirror of `/api/freshness/summary` to a private file the statusline reads directly with `jq`.

```
$LIFEOS_DIR/USER/CACHE/freshness.json
```

The file is private (under `USER/`, never released), atomically written (temp file + rename), shape-identical to `/api/freshness/summary` plus a `generated_at` timestamp, and capped under 4KB.

**Write triggers** — the cache has two drivers because freshness is driven by both content change and time progression:

1. **Mutation events** — every `bumpTelosTimestamp`, `bumpContextTimestamp`, and `bumpReviewedTimestamp` call rewrites the cache after a successful write.
2. **Pulse `invalidate()`** — when the in-memory cache flips, the on-disk cache is rewritten so the next statusline render sees the same view.
3. **SessionStart hook** — `bun LIFEOS/TOOLS/FreshnessCache.ts --quiet` runs async at session start, catching age-progression grade flips (a 28-day file with a 30-day threshold ages to 32 days and flips B→F with no bump event).
4. **CLI** — `bun LIFEOS/TOOLS/FreshnessCache.ts` (or `--rebuild`) for manual rebuild; `--print` to dump JSON without writing; `--quiet` for silent success.

**Read path** — `LIFEOS/LIFEOS_StatusLine.sh` reads the cache file directly:

```bash
_FRESH_CACHE="$CLAUDE_HOME/LIFEOS/USER/CACHE/freshness.json"
[ -s "$_FRESH_CACHE" ] && _FRESH_RAW=$(cat "$_FRESH_CACHE")
echo "$_FRESH_RAW" | jq -r '.files[] | "\(.slug)\t\(.grade)"'
```

No `curl` in the FRESH section's hot path. Missing cache file degrades gracefully to `—` per file plus `—` ALL grade without blocking. End-to-end render time on Pulse-down case dropped from ~1000ms (curl timeout) to <5ms.

Pulse remains the canonical reader for the dashboard; the cache file is the canonical reader for the statusline. Both consume the identical schema.

## Interview integration

`/interview` runs the **ContextCheckin** workflow at `$LIFEOS_ROOT/skills/Interview/Workflows/ContextCheckin.md`. The workflow:

1. Reads `readContextFreshness()` plus `readTelosFreshness()` for the per-section detail.
2. Identifies stale files and stale TELOS sections, sorted most-stale-first.
3. Opens with the most-stale item as the lead — referencing the actual content, not asking generic fill prompts.
4. For derived files (PRINCIPAL_TELOS, ARCHITECTURE_SUMMARY), routes review questions to the source.
5. After every approved edit, calls the appropriate writer:
   - `bumpTelosTimestamp(slug)` for TELOS sections — bumps the per-H2 marker AND the file-level `last_updated`.
   - `bumpReviewedTimestamp(filePath)` for constitutional files — bumps `last_reviewed` (the freshness-clock field). This is the only path that resets the A-F grade.
   - `bumpContextTimestamp(filePath)` is for byte-level writes (auto-generators, migrations) and does NOT count as a review. The Interview workflow does not call it.

## Migration

`MigrateContextFreshness.ts` is the one-shot, idempotent, content-preserving migration that adds frontmatter to constitutional files.

- Backs up each file to its directory's `Backups/` subdirectory before writing.
- For files with existing frontmatter (DA_IDENTITY): injects `last_updated:` into the existing block — does NOT create a duplicate `---` block.
- For files starting with HTML comments (PROJECTS): inserts the frontmatter block ABOVE the comment.
- Verifies sha256 of stripped content matches pre/post; aborts on mismatch.
- Idempotent — running twice produces no diff beyond the timestamp.

## Anti-patterns

- **Bumping `last_reviewed` on a non-review write** — defeats the point. The signal is "principal reviewed," not "byte changed." Migrations, auto-generators, and incidental writes touch `last_updated`; only Interview-style review touches `last_reviewed`. Calling `bumpReviewedTimestamp` from a generator silently degrades the grade signal to noise.
- **Treating `last_updated` as the freshness clock** — the A-F grade reads `last_reviewed`. A file last updated 1 minute ago by a migration but never reviewed is grade F, not A.
- **Treating derived files as first-class freshness sources** — a regenerated file isn't a reviewed file. Use `derived_from:`; effective freshness inherits from the source.
- **Single global threshold** — different files have different review cadences. Per-file thresholds catch real drift without flooding false alarms.
- **Stacking a second YAML block on a file that already has one** — DA_IDENTITY's existing frontmatter must be honored. Inject the field into the existing block.
- **Silent rewrites of constitutional content during freshness updates** — the freshness system writes the marker, not the content. Content edits go through `/interview` with explicit per-edit approval.
- **Caching the statusline freshness via cron or launchd** — the cache has three deterministic write triggers (bump events, Pulse invalidate, SessionStart). A cron job adds a fourth surface that drifts independently and creates ambiguity about which view is current.

## Adjacent freshness system: memory hot-layer mtime cache

The autonomic memory loop (2026-05-22, see `LIFEOS/DOCUMENTATION/Memory/MemorySystem.md`) uses a parallel but separate freshness mechanism for the per-turn context block. `LIFEOS/PULSE/modules/telegram.ts` `buildLifeosContextBlock()` mtime-caches the four constitutional files (DA_IDENTITY, PRINCIPAL_IDENTITY, PRINCIPAL_TELOS, PROJECTS) plus the two hot-layer memory files (`PRINCIPAL_MEMORY.md`, `DA_MEMORY.md`) for 60 seconds, re-reading whenever any per-file mtime changes. The 60s window is short enough to pick up an autonomic memory reviewer write within the same conversational burst, long enough to avoid re-reading on every prompt.

This is structurally distinct from the freshness cache documented above:
- **This file's cache** (`LIFEOS/USER/CACHE/freshness.json`) backs the statusline FRESH line and `/api/freshness/summary`. Driven by `bump*` events + Pulse `invalidate()` + SessionStart hook. Schema = full A-F grade output.
- **Memory hot-layer mtime cache** (in-process, per-Pulse-process) backs the per-turn context injection. Driven by file-system mtime checks. Schema = file content strings.

They share neither code nor data store; they're parallel solutions to the "context drift" problem at different scopes (session-spanning user review cadence vs. intra-session memory write propagation).

## Cross-references

- Library: `LIFEOS/TOOLS/TelosFreshness.ts`
- Statusline cache writer: `LIFEOS/TOOLS/FreshnessCache.ts`
- Statusline reader: `LIFEOS/LIFEOS_StatusLine.sh` (FRESH section)
- Cache file (private): `LIFEOS/USER/CACHE/freshness.json`
- Migration: `LIFEOS/TOOLS/MigrateContextFreshness.ts`
- Audit: `LIFEOS/TOOLS/ContextAudit.ts`
- TELOS-specific docs: `LIFEOS/USER/TELOS/README.md`
- Pulse module: `LIFEOS/PULSE/modules/telos.ts`
- Interview workflow: `skills/Interview/Workflows/ContextCheckin.md`
- Generator (TELOS summary): `LIFEOS/TOOLS/GenerateTelosSummary.ts`
- Generator (architecture summary): `LIFEOS/TOOLS/ArchitectureSummaryGenerator.ts`
- ISA: `LIFEOS/MEMORY/WORK/20260504-statusline-freshness-cache/ISA.md`
