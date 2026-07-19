---
last_updated: 2026-07-11T00:00:00Z
last_updated_by: kai
convention: pai-freshness-v1
last_reviewed: 2026-05-25T18:45:00Z
last_reviewed_by: {{PRINCIPAL_NAME}}
version: 1.0.3
---

# Curation Coverage — what LifeOS autonomic systems touch

LifeOS has several autonomic curation pipelines, each with its own SLA and write boundary. This document is the canonical matrix of which files are touched by which pipeline, and what's left to manual writes.

The principle is: **anything that matters for LifeOS's context should be managed and curated**, with different SLAs for different content types. Hot-layer memory loads every turn; identity-doctrine proposals fire on conversation cadence; TELOS reviews fire on a slower cron; manual files remain manual until promoted.

## The four mutation tiers (memory subsystem)

Defined in `LIFEOS/TOOLS/MutationTier.ts` as a closed allowlist (default-deny):

| Tier | Behavior | Files |
|---|---|---|
| **A** | Auto, set-overwrite | `PRINCIPAL_MEMORY.md`, `DA_MEMORY.md` |
| **B** | Logged append + audit | `PROJECTS.md`, `CONTACTS.md`, `MEMORY/KNOWLEDGE/**`, `MEMORY/IDEAS/**` |
| **C** | Propose-only (Telegram approval, or auto-apply at confidence ≥ 0.70) | `PRINCIPAL_IDENTITY.md`, `DA_IDENTITY.md`, `WRITINGSTYLE.md`, `DEFINITIONS.md`, `CANONICAL_CONTENT.md`, `RESUME.md`, `OPERATIONAL_RULES.md` |
| **D** | Untouchable by memory subsystem | Everything else |

A new file added to `{{LIFEOS_ROOT}}/` is Tier D by default until a code change promotes it.

## Coverage matrix

### Curated by the memory subsystem (Reviewer + MutationTier)

| File | Tier | Cadence | Subtype | Currently emitting? |
|---|---|---|---|---|
| `USER/PRINCIPAL/PRINCIPAL_MEMORY.md` | A | 8 turns / 30 min / 2 idle | `memory` (actor=daniel) | ✓ live (set-overwrite) |
| `USER/DIGITAL_ASSISTANT/DA_MEMORY.md` | A | Same | `memory` (actor=kai) | ✓ live (set-overwrite) |
| `USER/PROJECTS.md` | B | Same | `proposal` (kind=projects) — propose-first | P1 extends |
| `USER/CONTACTS.md` | B | Same | `proposal` (kind=contacts) — propose-first | P1 extends |
| `MEMORY/KNOWLEDGE/**` | B | Same | `knowledge` (append with `related:` merge) | ✓ live |
| `MEMORY/IDEAS/**` | B | Same | `idea` (append) | ✓ live |
| `USER/PRINCIPAL/PRINCIPAL_IDENTITY.md` | C | Same | `proposal` (kind=identity) | ✓ live |
| `USER/DIGITAL_ASSISTANT/DA_IDENTITY.md` | C | Same | `proposal` (kind=identity) | ✓ live |
| `USER/PRINCIPAL/WRITINGSTYLE.md` | C | Same | `proposal` (kind=style) | P1 extends |
| `USER/DEFINITIONS.md` | C | Same | `proposal` (kind=definition) | P1 extends |
| `USER/CANONICAL_CONTENT.md` | C | Same | `proposal` (kind=canonical-content) | P1 extends |
| `USER/PRINCIPAL/RESUME.md` | C | Same | `proposal` (kind=resume) | P1 extends |
| `USER/CONFIG/OPERATIONAL_RULES.md` | C | Same | `proposal` (kind=operational-rule) | P1 extends |

### Curated by OTHER autonomic pipelines (orthogonal to MutationTier)

These files are Tier D from the memory subsystem's POV (untouchable by the reviewer) but have their own dedicated writer:

| File | Writer | Trigger | Cadence |
|---|---|---|---|
| `USER/TELOS/PRINCIPAL_TELOS.md` | `LIFEOS/TOOLS/GenerateTelosSummary.ts` | TELOS source-file change | Manual run; planned cron in P2 |
| `USER/TELOS/LIFEOS_STATE.json` | `LIFEOS/TOOLS/ComputeGap.ts` | Cron / Stop hook | Hourly |
| `DOCUMENTATION/ARCHITECTURE_SUMMARY.md` | `LIFEOS/TOOLS/ArchitectureSummaryGenerator.ts` | `DocIntegrity.hook.ts` on Stop | Per session end |
| `MEMORY/WORK/**/ISA.md` | `hooks/ISASync.hook.ts` | Algorithm phase transitions | Per Edit (debounced 30s) |
| `MEMORY/LEARNING/**` | `WorkCompletionLearning`, `SatisfactionCapture`, `FailureCapture` hooks | UserPromptSubmit, Stop, tool failures | Per event |
| `MEMORY/RELATIONSHIP/**` | `RelationshipMemory.hook.ts` | UserPromptSubmit | Per turn (batched) |
| `MEMORY/WISDOM/**` | `WisdomFrameUpdater`, `WisdomCrossFrameSynthesizer` | Algorithm LEARN phase | Per LEARN; planned monthly cron in P3 |
| `MEMORY/SECURITY/**` | `SecurityPipeline.hook.ts` | Tool calls | Per event |
| `MEMORY/OBSERVABILITY/**` | Many hooks (EventLogger, MemoryReviewer, etc.) | Tool events | Continuous |
| `MEMORY/STATE/work.json` | `hooks/ISASync.hook.ts`, `LIFEOS/TOOLS/AlgoPhase.ts` | Phase transitions | Per change |
| `MEMORY/STATE/session-names.json` | `LIFEOS/TOOLS/SessionRename.ts` (manual), `SessionAnalysis` (auto-name) | First prompt at session start; manual rename | One-shot per session |
| `MEMORY/VOICE/voice-events.jsonl` | Pulse VoiceServer | Voice event | Per fire |

### Manual-only (no autonomic pipeline)

These files are Tier D AND have no other writer. {{PRINCIPAL_NAME}} writes directly; the autonomic system never proposes changes.

| File / Directory | Why manual |
|---|---|
| `USER/TELOS/TELOS.md` + sub-files (GOALS, MISSION, STRATEGIES, NARRATIVES, CHALLENGES, WRONG, TRAUMAS, MODELS) | Belief revision is deep-conviction work; planned P2 TELOS Reviewer will propose changes via the `Telos` skill Update workflow, not direct edit |
| `USER/PRINCIPAL/PRONUNCIATIONS.json` | Voice-server runtime config; principal-curated |
| `USER/CONFIG/memory-review.json` | Cadence config for the memory system itself; principal-curated to avoid recursive auto-tuning |
| `USER/CONFIG/CREDENTIALS/**` | Security boundary — credentials never autonomic |
| `USER/GEAR.md`, `USER/SMARTHOME.md`, `USER/SECURITY/SecurityControls.md`, `USER/DAEMON.md` | Manually curated documentation (GEAR.md also skill-updated by gear-aware skills) |
| `USER/BUSINESS/**`, `USER/HEALTH/**`, `USER/FINANCES/**` | Domain-specific, principal-curated |
| `USER/INTEGRATIONS/*.yaml` | Per-skill config; principal-curated |
| `USER/WORK/config.yaml` | Work-hub config; principal-curated |
| `USER/CUSTOMIZATIONS/**`, `USER/SKILLCUSTOMIZATIONS/**` | Per-skill customizations; principal-curated |
| All of `LIFEOS/DOCUMENTATION/` source files (except auto-generated summary) | Architecture docs; principal-curated (the ArchitectureSummary derives FROM these) |
| `CLAUDE.md`, `LIFEOS_SYSTEM_PROMPT.md` | Constitutional layer; principal-curated |
| `hooks/`, `skills/`, `Algorithm/`, `Tools/` source | Code; principal-curated (the system has no auto-codegen path) |
| `.env`, `settings.json`, `settings.system.json` | Operational config; principal-curated |

## SLAs per content type

Different content types update at fundamentally different rates. The cadence per autonomic surface:

| Content class | Cadence | Reason |
|---|---|---|
| Hot-layer memory (`memory` items) | Per-turn-batched (8 / 30 min / 2 idle) | Loads every turn; needs freshness |
| Knowledge graph (`knowledge`, `idea`) | Same | BM25 retrieval; freshness matters less |
| Identity / style / definition / canonical / resume / operational-rule proposals | Same | Telegram-gated; principal has the final word |
| TELOS reviews (planned P2) | Weekly cron | Belief revision; deep observation window |
| Wisdom frame synthesis (planned P3) | Monthly cron | Compounding wisdom; long observation window |
| Architecture summary | Per-session-end (DocIntegrity hook on Stop) | Tracks source `LifeosSystemArchitecture.md` changes |
| Work / ISA / phase tracking | Per Edit (debounced 30s) | Mirror of in-flight Algorithm runs |
| Observability streams | Continuous (per event) | Append-only telemetry |

## Roadmap

- **P1 (this build, 2026-05-25)** — extend reviewer prompt with 7 new proposal subtypes (`style`, `definition`, `canonical-content`, `resume`, `operational-rule`, `projects`, `contacts`); persist `target_kind` on queue rows; render `[kind]` badge in Telegram; group pending by subtype in `kai status`.
- **P2 (named follow-up ISA)** — TELOS autonomic loop. Weekly `TelosReviewer.ts` cron that reads recent ISAs + LEARNING + WISDOM + recent PRINCIPAL_MEMORY snapshots, emits TELOS-change proposals (goal-deferral, new-strategy, mission-drift) routed via the `Telos` skill Update workflow.
- **P3 (named follow-up ISA)** — WISDOM autonomic loop. Monthly synthesis pass extracts new WISDOM frames from accumulated LEARNING signals; surfaces principle candidates via Telegram for principal review-and-graduate.
- **P4 (named follow-up ISA)** — On-demand LLM-agent retrieval tier (`kai recall "<question>"` CLI/Telegram command) for deep questions that need tool-using LLM loops over KNOWLEDGE. Different latency budget, different use case from per-turn BM25.

## Adding a new file to the curation system

The closed-allowlist posture means new files default to Tier D (untouchable). To bring a new file under autonomic curation:

1. Add the absolute path to the appropriate Tier set in `LIFEOS/TOOLS/MutationTier.ts` (Tier A / B / C).
2. If Tier C — add an entry to `PROPOSAL_KIND_TO_FILES` in `LIFEOS/TOOLS/MemoryTypes.ts` with a new `target_kind` value.
3. Extend the reviewer prompt in `LIFEOS/TOOLS/MemoryReviewer.ts` with subtype guidance describing when to emit a proposal targeting the new kind.
4. Add a row to the matrix above.
5. Regenerate `ARCHITECTURE_SUMMARY.md` (or let the DocIntegrity hook do it on next Stop).
6. Run the MemoryTypes + MemoryReviewer smoke tests; they should still pass.

The principle: code is the source of truth; documentation mirrors. The MutationTier file is the authoritative list — this document is the human-readable view of it.
