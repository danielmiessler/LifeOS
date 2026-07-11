# Memory System

> In Life OS terms (`LIFEOS/DOCUMENTATION/LifeOs/LifeOsThesis.md`), memory is how the OS knows your **current state**. The hill-climb is only as good as the system's picture of where you actually are — what you're working on, what failed, who you know, what you learned. Every capture pipeline below exists to sharpen that picture so the gap to ideal state is measured against reality, not guesses.

**LifeOS's file-system-based memory. Everything we know, everything we've learned, everything we've researched, everything we're working on.**

This is not a narrow event log or a preferences store. This is LifeOS's comprehensive knowledge system — the full shared memory between the principal and the DA. If we built knowledge together, it belongs here. That includes: work tracking, learnings from failures and successes, research and OSINT investigations, contact dossiers, security events, runtime state, voice events, observability metrics, and any other knowledge that would be valuable in future conversations.

**Two storage layers:**
- **LifeOS MEMORY** (`~/.claude/LIFEOS/MEMORY/`) — structured, hook-driven, entity-based
- **Auto-Memory** (`~/.claude/projects/<project>/memory/`) — unstructured learnings, research findings, contact profiles, reference material — anything Claude captures during sessions

Both layers are memory. Both are persistent. Both should be used.

**Version:** 8.2 (Proposal Subtypes + Session Rename CLI, 2026-05-25; preserves 8.1 inventory + drift + autonomic loop + health gate)
**Location:** `~/.claude/LIFEOS/MEMORY/` + `~/.claude/projects/<project>/memory/`

---

## Architecture

**Claude Code's `projects/` is the source of truth for transcripts. Hooks capture domain-specific events directly. Harvesting tools extract learnings from session transcripts. Auto-memory captures everything else — research, OSINT, contact profiles, reference material.**

```
User Request
    ↓
Claude Code projects/ (native transcript storage - 30-day retention)
    ↓
Hook Events trigger domain-specific captures:
    ├── Algorithm (AI) → WORK/
    ├── SatisfactionCapture → LEARNING/SIGNALS/
    ├── WorkCompletionLearning → LEARNING/
    ├── RelationshipMemory → RELATIONSHIP/
    ├── ToolActivityTracker / ToolFailureTracker / ConfigAudit / TeammateIdle → OBSERVABILITY/
    ├── Pulse voice handler → VOICE/
    └── SecurityPipeline → SECURITY/
    ↓
Knowledge capture (inline):
    ├── Algorithm LEARN phase → KNOWLEDGE/ (writes People/Companies/Ideas/Research with schema)
    └── Algorithm LEARN phase → WISDOM/FRAMES/ (Level-3 wisdom updates)
    ↓
Harvesting (periodic):
    ├── SessionHarvester → LEARNING/ (extracts corrections, errors, insights)
    ├── SessionHarvester --mine → KNOWLEDGE/_harvest-queue/ (mines decisions, preferences, milestones, problems)
    ├── KnowledgeHarvester → KNOWLEDGE/ (validates schema, maintenance)
    ├── LearningPatternSynthesis → LEARNING/SYNTHESIS/ (aggregates ratings)
    └── WisdomCrossFrameSynthesizer → WISDOM/PRINCIPLES/ (cross-frame principles)
    ↓
Retrieval & Navigation (on-demand):
    ├── MemoryRetriever → compressed context from KNOWLEDGE/ (BM25 search + LLM compression)
    └── KnowledgeGraph → associative traversal over KNOWLEDGE/ (tags + wikilinks + related fields)
```

**Key insight:** Hooks write directly to specialized directories. There is no intermediate "firehose" layer — Claude Code's `projects/` serves that purpose natively. Retrieval tools read the same markdown files without any intermediate index or database.

---

## Typed-Item Memory System (Autonomic Loop)

The autonomic mutation loop sits on top of the existing Memory subsystem inventory below. Architectural concepts (turn-cadence reviewer, cap-as-prompt, set-overwrite writes, debounced cancellable scheduler) reimplemented natively in TypeScript/Bun. Zero runtime dependency on third-party agent frameworks.

**Health gate & per-turn indicator (2026-05-24 addendum):**

- `LIFEOS/TOOLS/MemoryHealthCheck.ts` — 22-check CLI. Verifies hook files on disk, hooks registered in BOTH `settings.system.json` AND `settings.json` (catches the regression class where edits to the derived file silently revert at SessionStart), state file readable, last reviewer fire within 7 days, at least one historical reviewer run captured, both `_MEMORY.md` files present. Exit 0/1/2 = ok/warn/critical. Writes per-invocation row to `MEMORY/OBSERVABILITY/memory-health.jsonl`.
- `hooks/MemoryHealthGate.hook.ts` — Stop-chain hook running the check on every turn end. WARN/CRITICAL surfaces to stderr. Non-blocking.
- `<autonomic-memory>` additionalContext block — `MemoryReviewTrigger.hook.ts` emits this on every UserPromptSubmit. Carries `turns_since_last_review`, `pending_review`, `last_review_clock`, `minutes_since_last_review`, `last_review_dispatch`, `last_review_breakdown`, `last_review_items`, `dispatched_since_last_turn`, `proposals_since_last_turn`, `proposals_kind`, `health_overall`, `health_detail`, `cadence`.
- Seven-state render table in `LIFEOS/LIFEOS_SYSTEM_PROMPT.md` NATIVE mode template — UNHEALTHY (🚨) / ACTIVE / PENDING / WAITING / BUILDING / IDLE-WARM / COLD. The DA renders one `🧠 MEMORY:` line as the first item of CONTENT on every turn. Silence-by-default is explicitly rejected.
- Source-of-truth wiring: all three hooks (`MemoryReviewTrigger`, `MemoryReviewFire`, `MemoryHealthGate`) live in `settings.system.json` so `LIFEOS/TOOLS/MergeSettings.ts` regeneration at SessionStart preserves them.

### Thirty-second story

> {{DA_NAME}} has one memory system. Every item in it has a type — memory, idea, knowledge, or proposal. A background reviewer reads recent conversation and emits typed items. The system routes each item to the right place based on type. Memory items load into every prompt. Ideas and knowledge load when relevant. Proposals get surfaced in Telegram for yes/no/edit. Four safety tiers gate writes by destination. That's it.

### Type registry

Defined in `LIFEOS/TOOLS/MemoryTypes.ts`. Frozen at module load — adding a type requires source edit + commit, not runtime mutation.

| Type | Storage | Load timing | Tier | Write mode |
|---|---|---|---|---|
| `memory` | `USER/PRINCIPAL/PRINCIPAL_MEMORY.md` (actor=daniel), `USER/DIGITAL_ASSISTANT/DA_MEMORY.md` (actor=kai) | always (hot-layer, every prompt) | A | set-overwrite, cap 48 × 256 chars |
| `idea` | `MEMORY/IDEAS/<slug>.md` | on relevance (BM25) | B | append (atomic rename) + tier-b-writes.jsonl audit |
| `knowledge` | `MEMORY/KNOWLEDGE/{People,Companies,Research}/<slug>.md` | on relevance (BM25) | B | append + tier-b-writes.jsonl audit, with `related:` cross-link merge |
| `proposal` | `MEMORY/OBSERVABILITY/pending-proposals.jsonl` | Telegram surface only | C (gates the eventual write) | queue (status: pending → sent → accepted/rejected/edited/auto-applied) |

**Type is data, tier is permission.** Type tells the routing layer WHERE an item belongs. Tier tells the writer WHETHER the write is allowed. They're orthogonal — never collapsed.

### Proposal subtypes (P1 2026-05-25)

Proposals carry a `target_kind` discriminator that tells the reviewer which curated-context file class the proposal targets. The reviewer's prompt teaches the model when to emit each subtype; the dispatcher validates `(target_kind, target_file)` against the closed allowlist in `PROPOSAL_KIND_TO_FILES` (`LIFEOS/TOOLS/MemoryTypes.ts`); the Telegram surfacer renders the subtype as a `[kind]` badge in the proposal header. `target_kind` is optional for backwards compat — when absent, the dispatcher infers it from `target_file`.

| `target_kind` | Target file | Trigger for emission |
|---|---|---|
| `identity` | `USER/PRINCIPAL/PRINCIPAL_IDENTITY.md` or `USER/DIGITAL_ASSISTANT/DA_IDENTITY.md` | {{PRINCIPAL_NAME}} reveals a durable identity-level fact about himself or about how he wants {{DA_NAME}} to operate |
| `style` | `USER/PRINCIPAL/WRITINGSTYLE.md` | {{PRINCIPAL_NAME}} corrects voice/tone/cadence in a way that generalizes — banned vocabulary, preferred constructions |
| `definition` | `USER/DEFINITIONS.md` | {{PRINCIPAL_NAME}} defines a term (coined concept, principle's exact meaning, acronym) future {{DA_NAME}} must interpret correctly |
| `canonical-content` | `USER/CANONICAL_CONTENT.md` | {{PRINCIPAL_NAME}} names a piece of content (post, talk, framework) as canonical to his body of work |
| `resume` | `USER/PRINCIPAL/RESUME.md` | {{PRINCIPAL_NAME}} mentions a career fact (new role, certification, achievement) that should land in the resume |
| `operational-rule` | `USER/CONFIG/OPERATIONAL_RULES.md` | {{PRINCIPAL_NAME}} states an operating directive about HOW {{DA_NAME}}/LifeOS should handle a class of work |
| `projects` | `USER/PROJECTS.md` | {{PRINCIPAL_NAME}} names a new project that should be in the project routing table |
| `contacts` | `USER/CONTACTS.md` | {{PRINCIPAL_NAME}} mentions a person 3+ times with role, relationship, and why they matter |

Confidence guidance:
- **≥ 0.70** — auto-apply silently to the target file (the queue row transitions `pending → auto-applied` and the reviewer's `dispatchItems` calls `applyProposalEdit`)
- **0.40–0.69** — Telegram surfacing with `[kind]` badge for principal `yes/no/edit #id` reply
- **< 0.40** — discouraged unless cross-session pattern is clear

### Curation coverage at a glance

The reviewer + four-tier classifier covers a defined slice of `~/.claude/` content. The canonical coverage matrix (which files the system curates, which it ignores, which other autonomic pipelines own) lives in [`CurationCoverage.md`](./CurationCoverage.md).

### Four mutation tiers

Defined in `LIFEOS/TOOLS/MutationTier.ts` — code-only allowlist, default-deny on everything not enumerated:

| Tier | Behavior | Paths |
|---|---|---|
| A | Auto, full set-overwrite | `PRINCIPAL_MEMORY.md`, `DA_MEMORY.md` |
| B | Logged-append (tier-b-writes.jsonl audit row per write) | `PROJECTS.md`, `CONTACTS.md`, `MEMORY/KNOWLEDGE/**`, `MEMORY/IDEAS/**` |
| C | Propose-only (queue + Telegram approval) | `PRINCIPAL_IDENTITY.md`, `DA_IDENTITY.md`, `WRITINGSTYLE.md`, `DEFINITIONS.md`, `CANONICAL_CONTENT.md`, `RESUME.md` |
| D | Untouchable by the memory system | everything else (`.env`, `settings.json`, `hooks/`, code, `CLAUDE.md`, `LIFEOS_SYSTEM_PROMPT.md`, `Algorithm/`, `skills/`, …) |

### Components

- **`LIFEOS/TOOLS/MemoryTypes.ts`** — type registry. Resolvers for storage path per item.
- **`LIFEOS/TOOLS/MemoryWriter.ts`** — set-overwrite primitive for Tier A memory files. Atomic rename, lock sidecar, prefix soft-convention, dedupe, cap enforcement.
- **`LIFEOS/TOOLS/MemorySystem.ts`** — the single public API. `add(item)` routes by type; `find(query, options)` returns BM25 top-K.
- **`LIFEOS/TOOLS/MemoryRetriever.ts`** — BM25 retriever over the typed-item corpus including the two hot-layer memory files. Pure-function, no LLM call, ~30ms over 500+ notes.
- **`LIFEOS/TOOLS/MemoryReviewer.ts`** — the autonomic centerpiece. Single-pass orchestrator: locate most-recent harness transcript, extract last N exchanges, call `Inference.ts` (Sonnet, env-scrubbed subscription billing, `--tools ""`), parse `{items:[...]}` JSON, route each typed item through `MemorySystem.add()`.
- **`LIFEOS/TOOLS/MutationTier.ts`** — tier classifier. Pure function, no config file (code-only allowlist).
- **`LIFEOS/TOOLS/MemoryStatus.ts`** — read-only `kai status` viewer for terminal use.
- **`hooks/MemoryReviewTrigger.hook.ts`** — UserPromptSubmit handler. Increments turn count, sets `pending_review=true` when cadence gates fire.
- **`hooks/MemoryReviewFire.hook.ts`** — Stop handler. If `pending_review=true`, spawns the reviewer detached with env-scrub.
- **`LIFEOS/PULSE/modules/telegram.ts`** — adds `## PRINCIPAL MEMORY` and `## DA MEMORY` blocks to the per-turn LifeOS CONTEXT injection (mtime-cached 60s); intercepts `yes #id` / `no #id` / `edit #id <text>` / `proposals` replies for proposal handling; piggy-backs one pending proposal onto the next reply.

### Reviewer cadence

State at `MEMORY/OBSERVABILITY/review-state.json`. Trigger conditions are AND-gated; defaults in `USER/CONFIG/memory-review.json`:

- `turn_count >= 8` AND
- `minutes_since_last_review >= 30` AND
- `idle_minutes >= 2`

When all three hold, the next Stop hook spawns the reviewer subprocess. New UserPromptSubmit before Stop cancels (debounce — Honcho's dream-scheduler pattern, vendored).

### Per-turn retrieval

`buildLifeosContextBlock(query)` in `LIFEOS/PULSE/modules/telegram.ts` calls `getRelevantContext(query)` (in `MemoryRetriever.ts`); the BM25 top-K (default 5, score threshold 0.20) renders as a `## RELEVANT MEMORY` block injected after the hot-layer memory files and before `PRINCIPAL_TELOS`. Below-threshold returns empty (no header noise). Cache TTL 60s by query-hash. Graph traversal (`KnowledgeGraph.ts`) stays available as a separate explicit call — not on the hot path.

### Observability

| Stream | Path | Written by |
|---|---|---|
| Memory-file writes | `MEMORY/OBSERVABILITY/memory-writes.jsonl` | MemoryWriter |
| Reviewer runs | `MEMORY/OBSERVABILITY/reviewer-runs.jsonl` | MemoryReviewer |
| Reviewer-fire events | `MEMORY/OBSERVABILITY/reviewer-fires.jsonl` | MemoryReviewFire hook |
| Tier-B append audit | `MEMORY/OBSERVABILITY/tier-b-writes.jsonl` | MemorySystem.add |
| Proposal lifecycle | `MEMORY/OBSERVABILITY/identity-proposals.jsonl` | telegram.ts surfacer |
| Proposal replies | `MEMORY/OBSERVABILITY/proposal-replies.jsonl` | telegram.ts reply handler |
| Per-turn retrievals | `MEMORY/OBSERVABILITY/memory-retrievals.jsonl` | MemoryRetriever |

### Reading status

```
bun ~/.claude/LIFEOS/TOOLS/MemoryStatus.ts          # human-formatted block
bun ~/.claude/LIFEOS/TOOLS/MemoryStatus.ts --json   # machine-readable
```

Reports hot-layer file utilization, corpus sizes, pending-proposals depth, reviewer state, last reviewer run, last retrieval.

---

## Curation + Visibility + Recoverability (2026-06-06, Hermes/Honcho parity — CANONICAL)

Source ISA: `LIFEOS/MEMORY/WORK/20260605-203000_memory-alive-hermes-curation/ISA.md`. This supersedes the prior 2026-05-28 `<autonomic-memory>` banner and the every-turn heartbeat-enforcement approach (both are gone — see *Superseded* below).

The autonomic loop now genuinely **adjusts** and is **visible**, fixing the two defects that made the prior build look complete while it was silently frozen.

### Curation, not appending (the forgetting model)

The reviewer runs in **curation mode**: it reads the file's CURRENT entries (`readCurrentMemorySnapshot`) plus recent conversation and returns the **full desired next state** via a `memory` item with `op: "set"` + `entries[]`. `MemorySystem.add` routes `op:"set"` to `MemoryWriter.setEntries` as a REPLACE — so **forgetting is omission**: a stale fact is dropped by leaving it out, a contradicted fact is superseded (drop old + write new). This is the Honcho peer-card model ("replaces the entire card — does not merge"), chosen over Hermes substring verbs because full-set replace is atomic and unfragile. The reviewer prompt enforces: supersede contradictions, merge duplicates, **consolidate before adding when ≥80% full (≥39/48)**, write **declarative facts not directives** (Hermes verbatim), and an expanded do-not-save list (task progress, SHAs, PR numbers, anything stale in 7 days). Legacy `op:"add"` merge-append is retained for back-compat. This permanently kills the `EAT_CAP` cap-jam: the system can always drop to make room.

### Data-loss guard (in-lock)

set-overwrite has a whole-file blast radius. `MemoryWriter.setEntries` computes a **catastrophic-shrink guard IN-LOCK** (against the just-read prior state, race-free): it blocks a result that is near-empty (`< 3` entries) OR a mass deletion (`>50%` dropped) **with zero additions**, while ALLOWING honest large consolidation (many drops accompanied by additions). `ESUSPECT_SHRINK` is the error; `allowDrastic` opts out for legitimate restores. (This guard exists because a cross-vendor audit wiped the live file with an empty `op:"set"` — it's now structurally impossible.)

### Per-write snapshots (recoverability)

Every Tier-A write calls `snapshotBeforeWrite` — the prior file content is copied to a ring buffer at `MEMORY/OBSERVABILITY/memory-snapshots/<file>__<ts>.md` (last 30 per file) before the overwrite. So any individual autonomic write is reversible — not just at git-commit granularity. Recover via `bun LIFEOS/TOOLS/MemoryRestore.ts {list | restore <snap> | latest <principal|da>}`.

### Always-on visibility (`🧠 MEMORY` + `🩺 health`)

`hooks/MemoryDeltaSurface.hook.ts` (UserPromptSubmit, synchronous — stdout must inject) is the visible heartbeat — **deterministic and always-on** as of 2026-06-11 (principal-directed Hermes-style redesign). Every primary-session prompt gets a `<pai-memory-delta>` block with one of two line forms, rendered **verbatim** (hook-computed, never model-computed — the every-turn *self-policed* line remains the failure to never repeat):

- **Delta form** (rows newer than the monotonic cursor where `updated_by === "MemorySystem.add"`, smoke/manual/restore skipped): `🧠 MEMORY: +N learned · −M dropped — "<samples>" · <grade> (<n>/<t> fresh)`. Samples are truncated and pass an instruction-shape filter (`[withheld — instruction-shaped]`) because memory items can originate from external content and verbatim echo into context is an injection channel.
- **Heartbeat form** (no new rows): `🧠 MEMORY: <grade> (<n>/<t> fresh) · due: <stalest> · last curation … ago` — freshness from `USER/CACHE/freshness.json` with a 24h staleness guard (`⚠ freshness data Nd ago`, never confident stale numbers; missing/corrupt cache degrades to `no data`/`unreadable`, exit 0).
- It also reads the latest `memory-health.jsonl` row; when CRITICAL it injects `<pai-memory-health>` → a `🩺 MEMORY HEALTH:` line that nags every turn until fixed. This is the "silent failure is impossible to ignore" guarantee — the cap-jam sat unread in that log for two weeks.

**Liveness guards (2026-06-11, after the 5-day dead surface):** the hook's registration was clobbered by a concurrent-session whole-file `settings.json` rewrite (`787f66ef7`) and change-only silence hid it. Now: the hook touches `MEMORY/STATE/delta-surface-heartbeat` every run; `MemoryHealthCheck` lists it in `REQUIRED_HOOKS` (both settings files) and goes CRITICAL via `delta-surface-dead` when memory writes run >24h past the heartbeat. This bounds detection to ≤24h for guarded hooks — the settings writer itself is still last-writer-wins (class fix outstanding).

`OutputFormatGate.hook.ts` keeps the heartbeat check at `log` (observability only) — it NEVER blocks on the line, because absence can be legitimate (subagents, hook errors) and blocking was the 2026-05-28 failure mode.

### Health detection

`MemoryHealthCheck.ts` (run on Stop by `MemoryHealthGate.hook.ts`) now also detects the silent-failure class: **cap-pressure** (`≥44/48` → warn) and **reviewer failures** (recent runs with `ok:false`/`parse_ok:false` → warn; any `EAT_CAP` drop in a dispatch → CRITICAL, the real data-loss signal).

### Superseded

The 2026-05-28 `<autonomic-memory>` frozen banner (emitted by `MemoryReviewTrigger`) and the every-turn `OutputFormatGate` heartbeat *enforcement* are gone. The banner was model-noise; the enforcement made an every-turn line mandatory and failed compliance repeatedly. Both replaced by the change-only hook-fed surfaces above plus the deterministic `🧠 MEM` statusline.

### 3. Inline "what just landed" narration

When `dispatched_since_last_turn > 0` and the latest reviewer run dispatched at least one item, the banner's line 2 surfaces a verbatim excerpt of the most recent item:

- `memory` type → last entry of `PRINCIPAL_MEMORY.md` or `DA_MEMORY.md` (whichever was written), truncated to 80 chars.
- `knowledge` / `idea` types → file slug (without `.md`).
- `proposal` type → target file path.

`LIFEOS_SYSTEM_PROMPT.md` § 🧠 MEMORY indicator's ACTIVE-state row extended: when the banner shows a `└── +N just landed` line, the heartbeat line in `📃 CONTENT` (NATIVE) or SUMMARY CONTENT (ALGORITHM) must append the verbatim suffix (truncated to 60 chars).

### 4. `kai insights [--days N]` CLI

`LIFEOS/TOOLS/MemoryInsights.ts` — pure deterministic delta reader over `MEMORY/OBSERVABILITY/*.jsonl`. Default window `--days 1`. Sections: window, memory growth (per file), knowledge / idea adds, proposals by status (with 3 recent samples), reviewer runs (success rate, p50 / p95 latency), health snapshot, freshness verdict.

```
$ bun LIFEOS/TOOLS/MemoryInsights.ts --days 1
kai insights — last 1 day(s)
════════════════════════════════════════════════════════════
window: 2026-05-27 17:00 → 2026-05-28 17:00

Memory growth:
  PRINCIPAL_MEMORY.md   +4 entries (mtime: 2026-05-28 16:27)
  DA_MEMORY.md          +1 entries (mtime: 2026-05-27 21:30)

Knowledge / Ideas:
  knowledge notes added  4
  idea notes added       2

Proposals (3 total in window):
  auto-applied   3

Reviewer runs (5 total):
  succeeded   3
  failed      2
  p50 latency 31212ms
  p95 latency 60078ms

Health:
  overall   ok
  counts    critical=0 warn=0 ok=22

Verdict: fresh-with-misses
```

`fresh` / `fresh-with-misses` / `stale` / `cold` / `degraded` / `unhealthy` are the canonical verdict values.

---

## Directory Inventory (authoritative)

This is the canonical list of every directory under `~/.claude/LIFEOS/MEMORY/`. The `MemoryDirIntegrity.ts` drift handler (called by `DocIntegrity.hook.ts` on Stop) parses this table and warns whenever the on-disk tree contains a directory not listed here, or this table lists a directory that no longer exists. Add new memory subsystems by adding a row to this table FIRST, then creating the directory.

| Directory | Class | Status | Purpose | Primary writers |
|-----------|-------|--------|---------|-----------------|
| `KNOWLEDGE/` | core | active | Curated knowledge archive (People / Companies / Ideas / Research) | Algorithm LEARN, KnowledgeHarvester, manual `/knowledge add` |
| `WORK/` | core | active | Per-session work directories with ISA.md as source of truth | Algorithm execution, ISASync, SessionCleanup |
| `LEARNING/` | core | active | Categorized learnings (SYSTEM/ALGORITHM/FAILURES/SYNTHESIS/REFLECTIONS/SIGNALS) | SatisfactionCapture, WorkCompletionLearning, SessionHarvester, FailureCapture, LearningPatternSynthesis |
| `WISDOM/` | core | active | Level-3 compounding wisdom — FRAMES/, PRINCIPLES/, META/ | Algorithm LEARN, WisdomFrameUpdater, WisdomCrossFrameSynthesizer |
| `RESEARCH/` | core | active | Agent research outputs and OSINT dossiers | Agent task completions, OSINT workflows |
| `SECURITY/` | core | active | Security audit events (blocks, confirmations, alerts) | SecurityPipeline.hook.ts |
| `STATE/` | core | active | Ephemeral runtime state (algorithms, sessions, kitty, tab-titles, events.jsonl) | Many hooks; see STATE/ section |
| `OBSERVABILITY/` | core | active | Structured event/metric JSONL feeds for the Observability pipeline (NOT auto-rotated today; rotation queued with the sensor-loop iteration) | ToolActivityTracker, ToolFailureTracker, ConfigAudit, TeammateIdle, observability-transport, ComputeGap, CostTracker, syslog (Pulse), HomeSensorDetector, Speedtest |
| `VOICE/` | core | active | Voice notification audit log (ElevenLabs events) | Pulse pulse.ts voice handler |
| `RELATIONSHIP/` | core | active | Daily {{PRINCIPAL_NAME}}↔{{DA_NAME}} interaction notes, opinions, reflections | RelationshipMemory.hook.ts, RelationshipReflect, OpinionTracker |
| `VERIFICATION/` | core | active | Cross-vendor audit findings (Cato, etc.) | CrossVendorAudit |
| `TEAMS/` | core | active | Team configuration and membership snapshots | TeammateIdle, manual writes |
| `SKILLS/` | core | active | Skill-execution telemetry log | ShadowRelease (test-shadow-release), skill instrumentation |
| `PAISYSTEMUPDATES/` | core | active | Architecture change history | Manual via CreateUpdate.ts |
| `PLANS/` | core | active | Implementation plan documents (multi-session) | Manual + agent writes |
| `REFERENCE/` | core | active | Reference materials and specs preserved for recall | Manual writes |
| `BOOKMARKS/` | core | active | External bookmark state (X/Twitter sync) | _X skill PullBookmarks |
| `DATA/` | core | active | Generic structured data dumps from skills | Various skills (e.g. _CRIMESTATS) |
| `SCRATCHPAD/` | core | active | Ad-hoc scratch artifacts (queries, drafts, experiments) | Ad-hoc |
| `PROJECT/` | core | active | Singular per-project notes (distinct from `LIFEOS/USER/PROJECTS/`) | Ad-hoc |
| `ARCHIVE/` | core | active | Archived legacy memory content | Manual archival |
| `AUTO/` | core | reserved | Reserved capture surface — auto-memory role retired in v7.4; stub README retained for taxonomy stability | (none active) |
| `RAW/` | core | reserved | Reserved capture surface — firehose role retired in v7.0; stub README retained for taxonomy stability | (none active) |
| `_AIRGRADIENT/` | skill-private | active | _AIRGRADIENT skill state (sensor data) | _AIRGRADIENT skill |
| `_HELIOS/` | skill-private | active | _HELIOS skill assessment artifacts | _HELIOS skill |
| `_BROWSER_STATE/` | skill-private | active | Browser-skill profile/cookie scratch (twitter/, README) | Browser skill |
| `_NETWORK/` | skill-private | active | _NETWORK skill device/route inventory | _NETWORK skill |
| `PULSE_DATA/` | core | active | Pulse v2 Data Plane materialized JSON (e.g. goals.json + .meta.json) | Pulse adapters via RebuildAll |

**Class definitions:**
- **core** — top-level LifeOS subsystem; written by core hooks/pipelines; documented in this file.
- **skill-private** — `_X`-prefixed directory owned by an individual skill named `_X`. Content schema is the skill's responsibility, not the core memory system. Listed here so the drift hook recognizes them; full documentation lives in the owning skill's SKILL.md.
- **reserved** — directory exists in the taxonomy and ships with public releases (via `ShadowRelease.ts` FLAT_README_ROOTS) but is not currently written by any core component. Either stays reserved or gets removed in a future migration.

**Adding a memory subsystem:** Add a row above, create the directory with a one-page README, and (if it has structured frequency) add a writer reference to the Hook Integration table below. The drift hook will accept the new directory on next Stop.

---

## Skill-Private Memory (the `_X` Convention)

Skills that need to persist their own state may create a directory under `MEMORY/` whose name is the skill's name with an underscore prefix. Examples: the `_NETWORK` skill writes to `MEMORY/_NETWORK/`, the `_AIRGRADIENT` skill writes to `MEMORY/_AIRGRADIENT/`, the `_HELIOS` skill writes to `MEMORY/_HELIOS/`.

These directories are listed in the Directory Inventory so the drift hook recognizes them, but their internal structure is owned by the skill that writes them. Documentation for what lives inside lives in the skill's SKILL.md, not here.

**Why the convention:** the underscore prefix sorts these to the top of `ls` output and visually separates skill-owned data from core LifeOS subsystems. It also mirrors the `_*` convention already used for `KNOWLEDGE/_archive/`, `KNOWLEDGE/_embeddings/`, `KNOWLEDGE/_harvest-queue/`, and `KNOWLEDGE/_index.md`/`_schema.md` — anything underscore-prefixed is metadata, queue, or scope-private.

---

## Directory Details

### Claude Code projects/ — Native Session Storage

**Location:** `~/.claude/projects/-Users-{username}--claude/`
*(Replace `{username}` with your system username, e.g., `-Users-john--claude`)*
**What populates it:** Claude Code automatically (every conversation)
**Content:** Complete session transcripts in JSONL format
**Format:** `{uuid}.jsonl` — one file per session
**Retention:** 30 days (Claude Code manages cleanup)
**Purpose:** Source of truth for all session data; harvesting tools read from here

This is the actual "firehose" — every message, tool call, and response. LifeOS leverages this native storage rather than duplicating it.

### KNOWLEDGE/ — Organized Knowledge Archive

**What populates it:** Algorithm LEARN phase (direct writes with schema enforcement), manual `/knowledge add`, KnowledgeHarvester.ts (validates against schema, reflections disabled)
**Content:** Curated knowledge notes organized by entity type — people, companies, ideas, research. Topic is a tag, not a domain.
**Format:** Markdown files with YAML frontmatter (entity_type, tags, status). Full object type definitions in `_schema.md`.
**Purpose:** Browsable, organized archive of entities we'd look up by name — harvested from sessions and manual captures

**4 entity types:** People (human beings — OSINT, contacts, profiles), Companies (organizations — research, competitors, partners), Ideas (insights, theses, analyses, frameworks), Research (multi-source investigations with methodology and verified findings)
**The lookup test:** "Would {{PRINCIPAL_NAME}} look this up by name?" — if yes, it's knowledge. If not, it belongs in WORK/ or LEARNING/.
**Research vs. Ideas:** If it involved multiple sources, parallel investigation, verification, and produced a comprehensive dataset — it's research. A single insight or thesis is an idea. Research entries link to full output in WORK/.
**What doesn't belong:** Task logs, algorithm reflections, ISA checklists, verification stubs → WORK/ and LEARNING/, not KNOWLEDGE/
**Note types:** reference, synthesis, moc, source, temporal
**Status lifecycle:** seedling → budding → evergreen (90-day expiry for unreferenced seedlings → `_archive/`)
**Linking:** `[[kebab-case-wikilinks]]` for explicit links, tags for cross-cutting, `rg` for backlinks, semantic embeddings deferred
**Navigation:** `_index.md` MOC dashboards per entity type (auto-generated, structured: recently-updated, most-referenced, by-tag, seedlings)

**Key principle:** Algorithm LEARN phase writes directly with proper schemas (best context to capture what was learned). Harvester validates against schema and handles maintenance. Topic (security, AI, business) is a tag on the entity, not a separate domain.

### WORK/ — Primary Work Tracking

**What populates it:**
- Algorithm (AI) creates work dir with ISA.md during execution
- `WorkCompletionLearning.hook.ts` on Stop (updates ISA/THREAD)
- `SessionCleanup.hook.ts` on SessionEnd (marks COMPLETED)

**Content:** Flat work directories with a single ISA.md as source of truth
**Format:** `WORK/{timestamp}_{slug}/ISA.md` — consolidated metadata + ISC + decisions + changelog
**Purpose:** Track all discrete work units with lineage, verification, and feedback

**ISA.md Structure (v4.0 — consolidated single file):**
- **YAML frontmatter** — session metadata (id, title, session_id, status, effort_level, completed_at, iteration count, verification_summary)
- **STATUS** — progress table (criteria passing, phase, next action, blockers)
- **APPETITE** — time budget, circuit breaker, ISC target count
- **CONTEXT** — problem space from user prompt, key files
- **RISKS & RABBIT HOLES** — populated during THINK phase
- **PLAN** — populated during PLAN phase
- **IDEAL STATE CRITERIA** — checkbox markdown (`- [x]`/`- [ ]`) as system of record
- **DECISIONS** — non-obvious technical decisions logged during BUILD/EXECUTE
- **CHANGELOG** — timestamped entries replacing THREAD.md

**Work Directory Lifecycle:**
1. Algorithm execution → AI creates work dir with ISA.md (frontmatter includes session metadata)
2. `PostToolUse` → ISASync syncs ISA frontmatter to work.json on Write/Edit
3. `SessionEnd` → SessionCleanup marks ISA status COMPLETED, clears state

**Note:** Legacy work directories (pre-2026-02-22) may have META.yaml, ISC.json, THREAD.md alongside ISA.md. All consumers check ISA.md frontmatter first, fall back to legacy files.

### LEARNING/ — Categorized Learnings

**What populates it:**
- `SatisfactionCapture.hook.ts` (explicit ratings + implicit sentiment + low-rating learnings)
- `WorkCompletionLearning.hook.ts` (significant work session completions)
- `SessionHarvester.ts` (periodic extraction from projects/ transcripts)
- `LearningPatternSynthesis.ts` (aggregates ratings into pattern reports)

**Structure:**
- `LEARNING/SYSTEM/YYYY-MM/` — LIFEOS/tooling learnings (infrastructure issues)
- `LEARNING/ALGORITHM/YYYY-MM/` — Task execution learnings (approach errors)
- `LEARNING/SYNTHESIS/YYYY-MM/` — Aggregated pattern analysis (weekly/monthly reports)
- `LEARNING/REFLECTIONS/algorithm-reflections.jsonl` — Algorithm performance reflections (Q1/Q2/Q3 from LEARN phase)
- `LEARNING/SIGNALS/ratings.jsonl` — All user satisfaction ratings

**Categorization logic:**
| Directory | When Used | Example Triggers |
|-----------|-----------|------------------|
| `SYSTEM/` | Tooling/infrastructure failures | hook crash, config error, deploy failure |
| `ALGORITHM/` | Task execution issues | wrong approach, over-engineered, missed the point |
| `FAILURES/` | Full context for low ratings (1-3) | severe frustration, repeated errors |
| `REFLECTIONS/` | Algorithm performance analysis | per-session 3-question reflection from LEARN phase |
| `SYNTHESIS/` | Pattern aggregation | weekly analysis, recurring issues |

### LEARNING/FAILURES/ — Full Context Failure Analysis

**What populates it:**
- `SatisfactionCapture.hook.ts` via `FailureCapture.ts` (for ratings 1-3)
- Manual migration via `bun FailureCapture.ts --migrate`

**Content:** Complete context dumps for low-sentiment events
**Format:** `FAILURES/YYYY-MM/{timestamp}_{8-word-description}/`
**Purpose:** Enable retroactive learning system analysis by preserving full context

**Each failure directory contains:**
| File | Description |
|------|-------------|
| `CONTEXT.md` | Human-readable analysis with metadata, root cause notes |
| `transcript.tail.jsonl` | Last 200 lines of the conversation (bounded) |
| `sentiment.json` | Sentiment analysis output (rating, confidence, detailed analysis) |
| `tool-calls.json` | Extracted tool calls with inputs and outputs |

**Directory naming:** `YYYY-MM-DD-HHMMSS_eight-word-description-from-inference`
- Timestamp in PST
- 8-word description generated by fast inference to capture failure essence

**Rating thresholds:**
| Rating | Capture Level |
|--------|--------------|
| 1 | Full failure capture + learning file |
| 2 | Full failure capture + learning file |
| 3 | Full failure capture + learning file |
| 4-5 | Learning file only (if warranted) |
| 6-10 | No capture (positive/neutral) |

**Why this exists:** When significant frustration occurs (1-3), a brief summary isn't enough. Full context enables:
1. Root cause identification — what sequence led to the failure?
2. Pattern detection — do similar failures share characteristics?
3. Systemic improvement — what changes would prevent this class of failure?

### WISDOM/ — Compounding Domain Knowledge (Level 3)

**What populates it:** Algorithm LEARN phase writes Frames; `WisdomFrameUpdater.ts` updates them with new observations; `WisdomCrossFrameSynthesizer.ts` extracts cross-domain principles.
**Content:** Domain-specific Frames (living models of communication, development, deployment, etc.), cross-frame Principles, and META frame-health metrics.
**Format:** Markdown frames per domain (`FRAMES/{domain}.md`), markdown principles (`PRINCIPLES/verified.md`), JSON/markdown health reports (`META/`).
**Purpose:** Anticipation, taste, contextual judgment, transfer — the layer above LEARNING/ patterns. While LEARNING/ captures events (Level 1) and patterns (Level 2), WISDOM/ captures Frames — living, contextual, evolving models of each domain.

**Structure:**
- `FRAMES/` — Domain-specific wisdom models (communication.md, development.md, deployment.md, etc.)
- `PRINCIPLES/` — Cross-domain principles confirmed across 3+ frames (`verified.md`)
- `META/` — Frame health metrics and system status

**Dual-loop integration:** Algorithm OBSERVE reads Frames → work happens → Algorithm LEARN writes Frames. Knowledge compounds across sessions.

**Tools:**
- `WisdomDomainClassifier.ts` — Route requests to relevant frames
- `WisdomFrameUpdater.ts` — Update frames with new observations
- `WisdomCrossFrameSynthesizer.ts` — Extract shared principles and generate health reports

### RESEARCH/ — Investigations & Agent Outputs

**What populates it:** Agent tasks write directly; OSINT workflows; any multi-agent research
**Content:** Agent completion outputs, OSINT dossiers, investigation reports, competitive analysis, deep dives
**Format:** `RESEARCH/YYYY-MM/YYYY-MM-DD-HHMMSS_AGENT-type_description.md`
**Purpose:** Archive of all research and investigation work — the structured output side of knowledge we build together

**Note:** Research findings should ALSO be summarized as auto-memory entries (reference type in `projects/<project>/memory/`) so they're discoverable at session start. RESEARCH/ holds the full output; auto-memory holds the summary and pointer.

### SECURITY/ — Security Events (Active — v3.0)

**What populates it:** `SecurityPipeline.hook.ts` on tool validation
**Content:** Security audit events (blocks, confirmations, alerts)
**Format:** `SECURITY/security-events.jsonl`
**Purpose:** Security decision audit trail

### STATE/ — Fast Runtime Data

**What populates it:** Various tools and hooks
**Content:** High-frequency read/write JSON files for runtime state
**Key Property:** Ephemeral — can be rebuilt from RAW or other sources. Optimized for speed, not permanence.

**Key contents:**
- `algorithms/` — Per-session algorithm state files (`{sessionId}.json` — phase, criteria, effort level, active flag)
- `kitty-sessions/` — Per-session Kitty terminal env (`{sessionId}.json` — listenOn, windowId for tab control and voice gating)
- `tab-titles/` — Per-window tab state (`{windowId}.json` — title, color, phase for daemon recovery)
- `session-names.json` — Auto-generated session names from SessionAutoName hook
- `work.json` — Canonical session registry. Keyed by slug; each entry holds `sessionUUID`, `phase`, `progress`, `criteria[]`, `phaseHistory[]`, `lastToolActivity`, etc. Written by `ISASync.hook.ts` on every ISA edit and by `PromptProcessing.hook.ts` for native rows. Read by `/api/algorithm`, `/api/life/work`, `ULWorkSync`, `SessionCleanup`, `WorkCompletionLearning`. The pre-v6.9 `current-work.json` pointer is gone — `work.json` is the single source of truth.
- `progress/` — Multi-session project tracking
- `integrity/` — System health check results

This is mutable state that changes during execution — not historical records. If deleted, system recovers gracefully.

**`events.jsonl` — Unified Event Log:**

An append-only JSONL file where hooks emit structured, typed events alongside their normal state writes. Each line is a JSON object with `timestamp`, `session_id`, `source`, `type`, and type-specific fields. The type field uses a dot-separated topic hierarchy (e.g., `algorithm.phase`, `work.created`, `rating.captured`, `voice.sent`). This file is an observability layer — it does NOT replace any of the mutable state files listed above. Events are written by `${LIFEOS_DIR}/hooks/lib/observability-transport.ts` using synchronous append, and errors are silently swallowed so the event log never disrupts hook execution. Consumers can tail or `fs.watch` this file for real-time visibility into LifeOS activity.

### OBSERVABILITY/ — Structured Telemetry

**What populates it:** Many hooks and tools write `*.jsonl` files here for the Observability pipeline.
**Content:** Tool activity, tool failures, config changes, teammate events, anthropic call sites, anthropic costs, gap history, session costs, vendor costs, statement spend, UniFi syslog, speedtest, home-sensor, perimeter.
**Format:** Append-only JSONL, one file per source (e.g. `tool-failures.jsonl`, `anthropic-cost.jsonl`, `config-changes.jsonl`).
**Purpose:** Single canonical home for structured telemetry consumed by Pulse Observability dashboards.

**Writers (non-exhaustive):**
- `hooks/ToolActivityTracker.hook.ts` → `tool-activity.jsonl`
- `hooks/ToolFailureTracker.hook.ts` → `tool-failures.jsonl`
- `hooks/ConfigAudit.hook.ts` → `config-changes.jsonl`
- (No rotation: OBSERVABILITY/ and SECURITY/ JSONLs are NOT auto-rotated today — rotation is queued with the sensor-loop iteration. The former log-rotation lib in hooks/lib was dead code with zero importers and was removed 2026-06-12.)
- `LIFEOS/TOOLS/CostTracker.ts` → `anthropic-cost.jsonl`, `anthropic-call-sites.json`
- `LIFEOS/TOOLS/ComputeGap.ts` → `gap-history.jsonl`
- `LIFEOS/PULSE/Performance/cost-aggregator.ts` → `session-costs.jsonl`
- `LIFEOS/PULSE/modules/syslog.ts` → `unifi-syslog.jsonl`
- `skills/_HOMESECURITY/Tools/HomeSensorDetector.ts` → `home-sensor.jsonl`, `perimeter.jsonl`
- `skills/_NETWORK/Tools/Speedtest.ts` → `speedtest.jsonl`

### VOICE/ — Voice Notification Log

**What populates it:** Pulse `pulse.ts` voice handler on every ElevenLabs notify call.
**Content:** Voice event audit trail (timestamps, voice_id, message, status).
**Format:** `voice-events.jsonl` (append-only).
**Purpose:** Reconstruct what {{DA_NAME}} said when, debug voice flakiness, charge-back ElevenLabs spend.

### RELATIONSHIP/ — {{PRINCIPAL_NAME}}↔{{DA_NAME}} Interaction History

**What populates it:**
- `hooks/RelationshipMemory.hook.ts` writes daily notes (mood, micro-events, opinions {{PRINCIPAL_NAME}} shared)

**Content:** Daily relationship notes (mood, micro-events, opinions {{PRINCIPAL_NAME}} shared).
**Format:** `RELATIONSHIP/YYYY-MM/YYYY-MM-DD.md`
**Purpose:** Long-term context {{DA_NAME}} uses to remain in-relationship across sessions. Surfaced at session start by `LoadContext.hook.ts` (Recent Relationship Notes block).

### VERIFICATION/ — Cross-Vendor Audit Findings

**What populates it:** `LIFEOS/TOOLS/CrossVendorAudit.ts` (Cato auditor pipeline).
**Content:** Cato audit findings on Algorithm E4/E5 ISAs (cross-vendor blind-spot detection via GPT-5.5).
**Format:** `cato-findings.jsonl`.
**Purpose:** Audit trail for the cross-vendor verification pipeline.

### TEAMS/ — Team Configuration

**What populates it:** Team management workflows; `TeammateIdle.hook.ts` writes teammate-event metadata that overlaps with OBSERVABILITY but membership/config snapshots live here.
**Content:** Team membership snapshots organized by team name (architecture/, content/, design/, engineering/, marketing/).
**Format:** Markdown + JSON per team directory.
**Purpose:** Persistent record of which agents make up which teams, used by ComposeAgent and team workflows.

### SKILLS/ — Skill Execution Telemetry

**What populates it:** Skill instrumentation; `skills/_LIFEOS/Tools/ShadowRelease.ts` writes test-run logs.
**Content:** Skill execution events (start/finish, duration, outcomes), shadow release test results.
**Format:** Append-only JSONL (`execution.jsonl`, `test-shadow-release.jsonl`).
**Purpose:** Observability into skill behavior across sessions; release-test history.

### PLANS/ — Implementation Plan Documents

**What populates it:** Manual writes during planning sessions, agent writes during ALGORITHM PLAN phase for multi-session work.
**Content:** Implementation plans (architecture, security-restructure, etc.) that span more than one session.
**Format:** Markdown files, slug-based filenames.
**Purpose:** Stable home for plans that need to outlive a single ISA work directory.

### REFERENCE/ — Reference Materials

**What populates it:** Manual writes.
**Content:** Specifications, primer documents, reference notes worth re-reading (algorithm specifications, project primers).
**Format:** Markdown.
**Purpose:** Long-lived reference material that is not knowledge (per the "look up by name" test) but is also not a per-session work artifact.

### BOOKMARKS/ — External Bookmark State

**What populates it:** `_X` skill PullBookmarks workflow.
**Content:** Bookmark sync state (CSV of pulled X/Twitter bookmarks, seen-IDs registry).
**Format:** `bookmarks.csv` + state files.
**Purpose:** Incremental bookmark ingestion without re-pulling history.

### DATA/ — Generic Skill Data Dumps

**What populates it:** Various skills that need to persist structured datasets (e.g. `_CRIMESTATS` writes to `DATA/CrimeStats/`).
**Content:** Per-skill data subdirectories with structured datasets.
**Format:** Per-skill (CSV, JSON, etc.).
**Purpose:** Catch-all for skill-produced data that is too generic for skill-private memory but isn't research output.

### SCRATCHPAD/ — Ad-Hoc Scratch

**What populates it:** Ad-hoc writes during exploratory work.
**Content:** Throwaway queries, drafts, experiments, search-result dumps that may or may not graduate to KNOWLEDGE/.
**Format:** Mixed.
**Purpose:** Working area; nothing here is durable knowledge.

### PROJECT/ — Singular Project Notes

**What populates it:** Ad-hoc writes during project-specific deep work.
**Content:** Per-project deep-dive notes that don't belong in `USER/PROJECTS.md` (which is the project registry).
**Format:** Markdown per project.
**Purpose:** Provide a memory home for project-specific reasoning that outgrows a single ISA but is not a published project doc. Distinct from `LIFEOS/USER/PROJECTS/`.

### ARCHIVE/ — Archived Memory Content

**What populates it:** Manual archival of legacy memory content.
**Content:** Whatever has been retired from the active memory tree but is worth keeping retrievable.
**Format:** Mixed.
**Purpose:** Quarantine zone for content that should not appear in active retrieval.

### AUTO/ — Reserved (legacy auto-memory location)

**Status:** Reserved. The auto-memory role moved to `~/.claude/projects/<project>/memory/` in v7.4 (2026-03-31). This directory is retained as a stub with its README so the public release taxonomy stays stable; nothing currently writes to it. Content that would historically have landed here now lands in CC native memory.

### RAW/ — Reserved (legacy firehose location)

**Status:** Reserved. The firehose role moved to Claude Code's native `projects/` JSONL transcripts in v7.0 (2026-01-12). This directory is retained as a stub with its README so the public release taxonomy stays stable; nothing currently writes to it.

### PAISYSTEMUPDATES/ — Change History

**What populates it:** Manual via CreateUpdate.ts tool
**Content:** Canonical tracking of all system changes
**Purpose:** Track architectural decisions and system changes over time

---

## Hook Integration

| Hook | Trigger | Writes To |
|------|---------|-----------|
| Algorithm (AI) | During execution | WORK/ISA.md, KNOWLEDGE/, WISDOM/FRAMES/ (work.json is written by ISASync, not the AI) |
| ISASync.hook.ts | PostToolUse (Write/Edit) | STATE/work.json (syncs ISA frontmatter) |
| WorkCompletionLearning.hook.ts | SessionEnd | LEARNING/ (significant work) |
| SessionCleanup.hook.ts | SessionEnd | WORK/ISA.md (status→COMPLETED), clears STATE |
| SatisfactionCapture.hook.ts | UserPromptSubmit | LEARNING/SIGNALS/, LEARNING/, FAILURES/ (1-3) |
| RelationshipMemory.hook.ts | UserPromptSubmit / Stop | RELATIONSHIP/YYYY-MM/YYYY-MM-DD.md |
| ToolActivityTracker.hook.ts | PostToolUse | OBSERVABILITY/tool-activity.jsonl |
| ToolFailureTracker.hook.ts | PostToolUse | OBSERVABILITY/tool-failures.jsonl |
| ConfigAudit.hook.ts | PostToolUse (settings.json edits) | OBSERVABILITY/config-changes.jsonl |
| TeammateIdle.hook.ts | (idle) | OBSERVABILITY/teammate-events.jsonl, TEAMS/ |
| SecurityPipeline.hook.ts | PreToolUse | SECURITY/ |
| Pulse voice handler | (HTTP /notify) | VOICE/voice-events.jsonl |
| PreCompact.hook.ts | PreCompact | stdout (handover context) |
| DocIntegrity.hook.ts | Stop | (no MEMORY writes — runs DocCrossRefIntegrity + RebuildArchSummary + MemoryDirIntegrity) |

> **Note:** All hooks listed above also emit typed events to `STATE/events.jsonl` via `appendEvent()`. See [../Hooks/HookSystem.md § Unified Event System](../Hooks/HookSystem.md) for event types and consumer details.

## Harvesting & Retrieval Tools

| Tool | Purpose | Reads From | Writes To |
|------|---------|------------|-----------|
| SessionHarvester.ts | Extract learnings from transcripts | projects/ | LEARNING/ |
| SessionHarvester.ts --mine | Mine conversations for decisions, preferences, milestones, problems | projects/ | KNOWLEDGE/_harvest-queue/ |
| KnowledgeHarvester.ts | Validate schemas, maintenance, contradictions | KNOWLEDGE/, auto-memory | KNOWLEDGE/ |
| LearningPatternSynthesis.ts | Aggregate ratings into patterns | LEARNING/SIGNALS/ | LEARNING/SYNTHESIS/ |
| FailureCapture.ts | Full context dumps for low ratings | projects/, SIGNALS/ | LEARNING/FAILURES/ |
| MemoryRetriever.ts | BM25 search + LLM compression for context retrieval | KNOWLEDGE/ | (stdout — read-only) |
| KnowledgeGraph.ts | Associative graph navigation over tags/wikilinks | KNOWLEDGE/ | (stdout — read-only) |
| WisdomDomainClassifier.ts | Route requests to relevant frames | WISDOM/FRAMES/ | (stdout — read-only) |
| WisdomFrameUpdater.ts | Update frames with new observations | WISDOM/FRAMES/ | WISDOM/FRAMES/ |
| WisdomCrossFrameSynthesizer.ts | Extract shared principles, frame health | WISDOM/FRAMES/ | WISDOM/PRINCIPLES/, WISDOM/META/ |
| RelationshipReflect.ts | Scan recent relationship notes, generate reflections | RELATIONSHIP/ | RELATIONSHIP/ |
| OpinionTracker.ts | Log confidence-tracked opinions | (CLI input) | RELATIONSHIP/ |
| CostTracker.ts | Track Anthropic API spend | (callsites) | OBSERVABILITY/anthropic-cost.jsonl |
| ComputeGap.ts | Compute Current↔Ideal gap, track over time | TELOS/, USER/ | OBSERVABILITY/gap-history.jsonl |
| CrossVendorAudit.ts | Run Cato audits | WORK/ISA.md | VERIFICATION/cato-findings.jsonl |
| ActivityParser.ts | Parse recent file changes | projects/ | (analysis only) |

---

## Drift Detection (Memory Inventory)

The `MemoryDirIntegrity.ts` handler (run from `DocIntegrity.hook.ts` on Stop) keeps the Directory Inventory table above honest. On every Stop where any system file changed, it:

1. Lists every directory under `~/.claude/LIFEOS/MEMORY/` (one level deep, excluding `.git`, `.DS_Store`, etc.)
2. Parses the Directory Inventory table in this file
3. Reports any directory on disk not in the table (**unknown subsystem**)
4. Reports any directory in the table not on disk (**missing subsystem** — only flagged for `active` rows; `reserved` rows are allowed to be empty or absent)
5. Logs to stderr with `[MemoryDirIntegrity]` tag and emits a `doc.integrity.memory_dir` event to `STATE/events.jsonl`

If the handler reports drift, the fix is to either (a) add the new subsystem to the inventory table above, or (b) remove the stray directory from disk. Drift is a soft warning; the hook never blocks.

---

## Data Flow

```
User Request
    ↓
Claude Code → projects/{uuid}.jsonl (native transcript)
    ↓
Algorithm (AI) → WORK/{timestamp}_{slug}/ISA.md   (ISASync.hook.ts mirrors to STATE/work.json on PostToolUse)
    ↓
[Work happens — AI writes ISA directly, ISASync keeps work.json + KV in sync]
    ↓
[If context compacts] → PreCompact.hook.ts → stdout handover (preserved through compaction)
    ↓
Auto-Memory → projects/<project>/memory/MEMORY.md (Claude writes learnings)
    ↓
SatisfactionCapture → LEARNING/SIGNALS/ + LEARNING/
    ↓
WorkCompletionLearning → LEARNING/ (for significant work, reads ISA.md frontmatter)
    ↓
SessionEnd hooks → SessionCleanup marks the matching work.json entry phase=complete; ULWorkSync pushes the ISA to gh issue in WORK.REPO

[Between sessions]
    ↓
Auto-Dream (server-controlled) → consolidates memory/MEMORY.md

[Periodic harvesting]
    ↓
SessionHarvester → scans projects/ → writes LEARNING/
LearningPatternSynthesis → analyzes SIGNALS/ → writes SYNTHESIS/
WisdomCrossFrameSynthesizer → analyzes FRAMES/ → writes PRINCIPLES/
```

---

## Quick Reference

### Check current work
```bash
# All sessions (active + resumable), keyed by slug:
jq '.sessions | to_entries | map({slug: .key, phase: .value.phase, updatedAt: .value.updatedAt}) | sort_by(.updatedAt) | reverse' ~/.claude/LIFEOS/MEMORY/STATE/work.json

# Just the non-complete ones:
jq '.sessions | to_entries | map(select(.value.phase != "complete")) | from_entries' ~/.claude/LIFEOS/MEMORY/STATE/work.json

ls ~/.claude/LIFEOS/MEMORY/WORK/ | tail -5
```

### Check ratings
```bash
tail ~/.claude/LIFEOS/MEMORY/LEARNING/SIGNALS/ratings.jsonl
```

### View session transcripts
```bash
# List recent sessions (newest first)
# Replace {username} with your system username
ls -lt ~/.claude/projects/-Users-{username}--claude/*.jsonl | head -5

# View last session events
tail ~/.claude/projects/-Users-{username}--claude/$(ls -t ~/.claude/projects/-Users-{username}--claude/*.jsonl | head -1) | jq .
```

### Check learnings
```bash
ls ~/.claude/LIFEOS/MEMORY/LEARNING/SYSTEM/
ls ~/.claude/LIFEOS/MEMORY/LEARNING/ALGORITHM/
ls ~/.claude/LIFEOS/MEMORY/LEARNING/SYNTHESIS/
```

### Check failures
```bash
# List recent failure captures
ls -lt ~/.claude/LIFEOS/MEMORY/LEARNING/FAILURES/$(date +%Y-%m)/ 2>/dev/null | head -10

# View a specific failure
cat ~/.claude/LIFEOS/MEMORY/LEARNING/FAILURES/2026-01/*/CONTEXT.md | head -100

# Migrate historical low ratings to FAILURES
bun run ~/.claude/LIFEOS/TOOLS/FailureCapture.ts --migrate
```

### Check observability
```bash
# Recent tool failures
tail ~/.claude/LIFEOS/MEMORY/OBSERVABILITY/tool-failures.jsonl | jq .

# Anthropic spend ledger
tail ~/.claude/LIFEOS/MEMORY/OBSERVABILITY/anthropic-cost.jsonl | jq .

# Config edits this session
tail ~/.claude/LIFEOS/MEMORY/OBSERVABILITY/config-changes.jsonl | jq .
```

### Check relationship notes
```bash
# Today's note
cat ~/.claude/LIFEOS/MEMORY/RELATIONSHIP/$(date +%Y-%m)/$(date +%Y-%m-%d).md 2>/dev/null

# Generate a reflection
bun run ~/.claude/LIFEOS/TOOLS/RelationshipReflect.ts
```

### Check multi-session progress
```bash
ls ~/.claude/LIFEOS/MEMORY/STATE/progress/
```

### Run harvesting tools
```bash
# Harvest learnings from recent sessions
bun run ~/.claude/LIFEOS/TOOLS/SessionHarvester.ts --recent 10

# Mine conversations for decisions, preferences, milestones, problems
bun run ~/.claude/LIFEOS/TOOLS/SessionHarvester.ts --mine --recent 10

# Generate pattern synthesis
bun run ~/.claude/LIFEOS/TOOLS/LearningPatternSynthesis.ts --week
```

### Retrieve knowledge (compressed context)
```bash
# Search knowledge archive with BM25 ranking
bun run ~/.claude/LIFEOS/TOOLS/MemoryRetriever.ts "query terms"

# Raw excerpts without LLM compression
bun run ~/.claude/LIFEOS/TOOLS/MemoryRetriever.ts "query terms" --raw --top 5
```

### Navigate knowledge graph
```bash
# Graph stats: nodes, edges, clusters
bun run ~/.claude/LIFEOS/TOOLS/KnowledgeGraph.ts stats

# BFS traversal from a note
bun run ~/.claude/LIFEOS/TOOLS/KnowledgeGraph.ts traverse <slug> --hops 2

# Directly connected notes
bun run ~/.claude/LIFEOS/TOOLS/KnowledgeGraph.ts related <slug>

# Find notes by tag
bun run ~/.claude/LIFEOS/TOOLS/KnowledgeGraph.ts find <tag>
```

### Check the inventory drift hook
```bash
# Run the drift handler ad-hoc against current MEMORY/
bun run ~/.claude/hooks/handlers/MemoryDirIntegrity.ts
```

---

## Migration History

**2026-05-01:** Memory System v8.1 — Full Subsystem Inventory + Drift Detection
- Documented all live core subsystems that had grown organically since v7.x: OBSERVABILITY/, VOICE/, RELATIONSHIP/, WISDOM/, TEAMS/, VERIFICATION/, SKILLS/, PLANS/, REFERENCE/, BOOKMARKS/, DATA/, SCRATCHPAD/, PROJECT/, ARCHIVE/.
- Added the **Directory Inventory** authoritative table (used by drift hook) — every MEMORY/ subdirectory is listed with class, status, purpose, and writers.
- Documented the `_X` skill-private convention and listed `_AIRGRADIENT/`, `_HELIOS/`, `_NETWORK/` so the drift hook recognizes them.
- Reclassified `AUTO/` and `RAW/` as **reserved** (their active roles were retired in v7.4 and v7.0 respectively but the directories still ship in the public-release taxonomy via `ShadowRelease.ts` FLAT_README_ROOTS).
- Added `MemoryDirIntegrity.ts` handler to `DocIntegrity.hook.ts` — diffs MEMORY/ on disk against this file's inventory table on every Stop and warns on drift. Same pattern as `DocCrossRefIntegrity.ts`.
- Reduced `MEMORY/README.md` to a stub redirecting to this canonical doc, ending the dual-doc drift between the v7.6 doc and the v8.0 README.
- No data was moved or deleted; this migration is documentation + drift detection only.

**2026-04-07:** Memory System v7.6 — Retrieval + Navigation + Mining + Temporal
- Added `MemoryRetriever.ts` — BM25-lite search across KNOWLEDGE/ with optional LLM compression via Inference.ts low. Returns compressed context within configurable token budget.
- Added `KnowledgeGraph.ts` — In-memory graph over KNOWLEDGE/ frontmatter tags, wikilinks, and related fields. BFS traversal, stats, hubs, related notes, tag search. Computed at query time, zero persistent storage.
- Added `--mine` flag to `SessionHarvester.ts` — Regex-based classification of conversation segments into decisions, preferences, milestones, problems. Candidates written to `KNOWLEDGE/_harvest-queue/` for review, never directly to KNOWLEDGE/.
- Added `valid_from`/`valid_until` optional frontmatter fields to all 4 entity types in `_schema.md` — Temporal fact validity tracking. Contradiction detector now skips note pairs with non-overlapping validity windows.
- Updated `KnowledgeHarvester.ts contradictions` command to check temporal fields before flagging pairs.
- Knowledge skill updated with `graph`, `retrieve`, and `mine` commands.
- Pulse wiki module's `/api/wiki/graph` endpoint uses wikilinks only; `KnowledgeGraph.ts` provides richer graph (tags + wikilinks + related fields) via CLI.
- Inspired by MemPalace (Ben Sigman) analysis — adapted 4 techniques to LifeOS's file-based architecture without adding vector DB, SQLite, or any opaque storage.

**2026-04-05:** Knowledge Archive v2.1 — Research entity type added
- Added Research as 4th entity type in KNOWLEDGE/ — for multi-source investigations with methodology, sources, and verified findings
- Research vs. Ideas: multi-source investigation = research, single insight = idea
- Schema includes methodology, agent_count, source_session fields
- Observatory API and KnowledgeHarvester updated to support Research domain
- MEMORY/RESEARCH/ remains as raw agent output archive; KNOWLEDGE/Research/ holds curated entries

**2026-04-02:** Knowledge Archive v2.0 — Entity-based redesign
- Redesigned from 8 topic-based domains (Business, Health, Learnings, People, Projects, Research, Security, Technology) to 3 entity types: People, Companies, Ideas
- Topic is now a tag on the entity, not a separate domain folder
- Strict schema per entity type defined in `_schema.md`
- Algorithm LEARN phase writes directly to KNOWLEDGE/ with proper schemas (no harvester intermediary needed)
- Harvester reflections disabled; harvester now validates against schema and handles maintenance
- The lookup test: "Would {{PRINCIPAL_NAME}} look this up by name?" — if not, it's not knowledge
- Observatory renders type-specific layouts per entity type

**2026-04-01:** v7.5 — Comprehensive Knowledge Store
- Updated documentation to reflect that memory is LifeOS's everything — not just prefs and events
- Auto-memory stores all shared knowledge: research, OSINT, contact dossiers, reference material, not just corrections/patterns
- RESEARCH/ section expanded to cover investigations, OSINT workflows, competitive analysis
- Added guidance: research findings should be summarized in auto-memory (reference type) for discoverability
- Clarified two-layer architecture: LifeOS MEMORY (structured/hook-driven) + Auto-Memory (everything else)

**2026-03-31:** v7.4 — Eliminated LIFEOS/MEMORY/AUTO active role
- Removed `autoMemoryDirectory` setting from settings.json (was still redirecting to LIFEOS/MEMORY/AUTO/)
- Migrated 2 unique feedback items to CC's native memory at `~/.claude/projects/-Users-{YourName}--claude/memory/`
- AUTO/ retained as a stub directory with README for taxonomy stability — see Directory Inventory above (status: reserved)
- Updated LifeOS Upgrade redistribution workflow to scan CC native memory path
- Updated statusline token estimation to use CC native memory path

**2026-03-24:** v7.3 — Auto-Memory & PreCompact Integration
- Enabled Claude Code's built-in auto-memory using default path (`~/.claude/projects/<project>/memory/`)
- Replaced blocking MEMORY.md ("Do Not Store Memories Here") with clean index
- Created `PreCompact.hook.ts` — captures work state before conversation compaction
- Added PreCompact hook to settings.json (matcher: `"*"` for auto + manual)
- Documented auto-dream (server-controlled consolidation feature)
- LifeOS hooks and auto-memory now coexist: hooks for structured domain events, auto-memory for unstructured learnings

**2026-02-22:** v7.2 — ISA Consolidation (v4.0 work directories)
- Consolidated META.yaml, ISC.json, THREAD.md into single ISA.md per work directory
- ISA.md frontmatter now holds session metadata (title, session_id, status, completed_at)
- ISC section in ISA (checkbox markdown) is the system of record for criteria
- CHANGELOG section in ISA replaces THREAD.md
- All hooks updated: SessionCleanup, WorkCompletionLearning, LoadContext
- Legacy fallback preserved: consumers check ISA.md first, fall back to META.yaml/ISC.json
- Dropped never-populated sections: NON-SCOPE, ASSUMPTIONS, OPEN QUESTIONS

**2026-01-17:** v7.1 — Full Context Failure Analysis
- Added LEARNING/FAILURES/ directory for comprehensive failure captures
- Created FailureCapture.ts tool for generating context dumps
- Updated RatingCapture.hook.ts to create failure captures for ratings 1-3
- Each failure gets its own directory with transcript, sentiment, tool-calls, and context
- Directory names use 8-word descriptions generated by fast inference
- Added migration capability via `bun FailureCapture.ts --migrate`

**2026-01-12:** v7.0 — Projects-native architecture
- The RAW/ firehose role was retired in favor of Claude Code's `projects/` JSONL transcripts as the source of truth.
- RAW/ retained as a stub directory with README for taxonomy stability — see Directory Inventory above (status: reserved).
- Removed EventLogger.hook.ts (was duplicating what projects/ already captures)
- Created SessionHarvester.ts to extract learnings from projects/ transcripts
- Created WorkCompletionLearning.hook.ts for session-end learning capture
- Created LearningPatternSynthesis.ts for rating pattern aggregation
- Added LEARNING/SYNTHESIS/ for pattern reports
- Updated ActivityParser.ts to use projects/ as data source
- Removed archive functionality from lifeos.ts (Claude Code handles 30-day cleanup)

**2026-01-11:** v6.1 — Removed RECOVERY system
- Deleted RECOVERY/ directory (5GB of redundant snapshots)
- Removed RecoveryJournal.hook.ts, recovery-engine.ts, snapshot-manager.ts
- Git provides all necessary rollback capability

**2026-01-11:** v6.0 — Major consolidation
- WORK is now the PRIMARY work tracking system (not SESSIONS)
- Deleted SESSIONS/ directory entirely
- Merged SIGNALS/ into LEARNING/SIGNALS/
- Merged PROGRESS/ into STATE/progress/
- Merged integrity-checks/ into STATE/integrity/
- Fixed AutoWorkCreation hook (prompt vs user_prompt field)
- Updated all hooks to use correct paths

**2026-01-10:** v5.0 — Documentation consolidation
- Consolidated WORKSYSTEM.md into MEMORYSYSTEM.md

**2026-01-09:** v4.0 — Major restructure
- Moved BACKUPS to `~/.claude/BACKUPS/` (outside MEMORY)
- Renamed RAW-OUTPUTS to RAW
- All directories now ALL CAPS

**2026-01-05:** v1.0 — Unified Memory System migration
- Previous: `~/.claude/history/`, `~/.claude/context/`, `~/.claude/progress/`
- Current: `~/.claude/LIFEOS/MEMORY/`
- Files migrated: 8,415+

---

## Claude Code Auto-Memory & Auto-Dream

LifeOS coexists with Claude Code's built-in memory system rather than replacing it.

### Auto-Memory
**Location:** `~/.claude/projects/<project>/memory/` (default, matches system prompt injection)
**Writer:** Claude (automatic, during sessions)
**Index:** `MEMORY.md` — first 200 lines loaded at every session start
**Content:** Everything that doesn't have a structured hook — research findings, OSINT dossiers, contact profiles, user preferences, corrections, patterns, reference material, and any other knowledge built during sessions

Auto-memory is not a narrow preferences store. It is the general-purpose knowledge layer of LifeOS's memory system. If we built knowledge together and it would be valuable in a future conversation, it belongs here. Types include:
- **user** — who {{PRINCIPAL_NAME}} is, how to work with him
- **feedback** — corrections and confirmed approaches
- **project** — ongoing work context, decisions, deadlines
- **reference** — pointers to external resources, research summaries, contact dossiers, OSINT findings

LifeOS's hooks capture structured domain-specific events (LEARNING/, WORK/, SIGNALS/). Auto-memory captures everything else.

**Configuration:**
- Enabled by default (`autoMemoryEnabled` not set = true)
- No custom `autoMemoryDirectory` — uses default path so system prompt path matches
- Manage via `/memory` command in any session

### Auto-Dream (Server-Controlled)
**Trigger:** Server-side feature flag — runs between sessions when 24+ hours and 5+ sessions have elapsed
**What it does:** Background subagent consolidates auto-memory files — prunes stale entries, resolves contradictions, converts relative dates, deduplicates

LifeOS doesn't control auto-dream activation. When it runs, it operates on the auto-memory directory above.

### PreCompact Hook
**What:** Preserves active work context before conversation compaction
**Hook:** `PreCompact.hook.ts` (matcher: `"*"`)
**Captures:** Active task, ISA summary, files modified, key decisions, session ID
**Output:** Structured handover note on stdout, preserved through compaction

### How LifeOS Memory and Auto-Memory Coexist

| System | Writer | Content | Loaded When |
|--------|--------|---------|-------------|
| Auto-Memory (`MEMORY.md`) | Claude | All shared knowledge: research, contacts, corrections, patterns, references | First 200 lines at session start |
| LifeOS WORK/ | Algorithm + hooks | Task tracking, ISAs, ISC | On demand via LoadContext |
| LifeOS LEARNING/ | Hooks + harvesters | Ratings, failures, synthesis | On demand via dynamic context |
| LifeOS WISDOM/ | Algorithm LEARN + harvesters | Frames, principles, frame health | OBSERVE phase reads frames; on-demand |
| LifeOS RELATIONSHIP/ | RelationshipMemory hook | Daily {{PRINCIPAL_NAME}}↔{{DA_NAME}} notes | LoadContext (recent notes block) |
| LifeOS OBSERVABILITY/ | Many hooks | Tool activity, costs, config audits | Pulse dashboards |
| LifeOS VOICE/ | Pulse voice handler | Voice notification audit | On demand |
| LifeOS STATE/ | Hooks | Ephemeral runtime state | On demand |
| Auto-Dream | Claude (subagent) | Consolidated auto-memory | Runs between sessions |
| PreCompact | Hook | Work-in-progress handover | Before compaction |

---

## Related Documentation

- **Hook System:** `../Hooks/HookSystem.md`
- **Architecture:** `../LifeosSystemArchitecture.md`
- **ISA format:** `../IsaFormat.md`
- **Drift handler source:** `~/.claude/hooks/handlers/MemoryDirIntegrity.ts`

### Retrieval absence statements + tag-match semantics (2026-06-10)

Both retrieval CLIs now state absence affirmatively instead of returning silence: `MemoryRetriever.ts` prints `No prior work found on "<query>" in the knowledge corpus.` and ContextSearch prints an equivalent line naming its five searched sources. Implemented in the retrieval layer — the model is never asked to assert absences it can't know.

Semantic change in `MemoryRetriever.ts` tag matching: reverse containment (query-term ⊇ tag) now requires tag length ≥ 4. Short tags (`ai`, `sec`) still match via exact/forward containment; what's gone is garbage terms swallowing short tags, which had made the zero-hit branch unreachable.
