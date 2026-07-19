---
version: 1.5.19
---

# LifeOS ISA Format Specification v2.13.0 (Algorithm v6.25.0)

> **v2.13.0 (Algorithm v6.25.0) — ISA scale + a real deletion.** The body grows from twelve sections to **fourteen**: `## Dependencies` (after Constraints) declares cross-ISA needs machine-readably; `## Bridge Criteria` (after Criteria) holds cross-ISA integration ISCs verified at VERIFY across the seam. New optional frontmatter `parent:` / `children:` links ISAs into a tree with **constraint inheritance** (a child cannot violate an ancestor Constraint). **The hard numeric ISC count floors (≥16/≥32/≥128/≥256) are DELETED** and replaced by the **Coverage Gate** — every subsystem named in Vision/Goal has a container ISC decomposed via the Splitting Test to single-probe leaves; coverage is the gate, count never is. Full doctrine in Algorithm v6.25.0 § *ISA Hierarchy & Cross-ISA Integration* and § *ISC Quality System*. The harness executor (`isa run`, reads `## Test Strategy`) is the paired build, tracked separately.

> **LifeOS moves people from current state to ideal state** by writing down what done looks like as testable claims, then refining the writing until every claim survives every test it can be subjected to. The ISA is that written record — the LifeOS loop (`LIFEOS/DOCUMENTATION/LifeOs/LifeOsThesis.md`) at single-artifact scale.

> **The ISA — Ideal State Artifact — is the universal primitive with five identities: ideal state articulation, test harness, build verification, done condition, and system of record. Its ISCs are the testable claims that decompose it. The artifact is universal: same primitive whether the unit is software, science, philosophy, art, life, an application, a CLI tool, a library, infrastructure — anything whose ideal state we're articulating.**

> **See also:** `LIFEOS/DOCUMENTATION/Isa/IsaSystem.md` for the system-architecture doc (five identities, three guardrails, six workflows, two homes, subsystem relationships). This file is the file-shape contract; that file is the conceptual frame. They are siblings, not duplicates.

The ISA is the single source of truth for the thing being articulated.
The AI writes all ISA content directly using Write/Edit tools and the ISA skill workflows. Hooks only read ISAs to sync state.

**v2.7 (Algorithm v6.2.0+, still current at v6.3.0):** the body grew from six sections to **twelve in fixed order**: Problem, Vision, Out of Scope, Principles, Constraints, Goal, Criteria, Test Strategy, Features, Decisions, Changelog, Verification. Three-guardrail taxonomy locks the conceptual surface (Principles bind thinking, Constraints bind solution space, Out of Scope binds vision, Anti-criteria bind test surface). Tier Completeness Gate is HARD at every tier (E1 = Goal+Criteria; E5 = all twelve + active Interview). New ID-stability rule prevents ISC renumbering on edit. New `## Changelog` section uses Deutsch conjecture/refutation/learning format. Empty sections never appear. The ISA Skill at `$LIFEOS_ROOT/skills/ISA/` owns the canonical template and six workflows; Algorithm at OBSERVE invokes `Skill("ISA", "scaffold from prompt at tier T")` at E2+. Full skeleton, tier gate table, three-guardrail table, and ID-stability rule live in the skill's SKILL.md and `Examples/canonical-isa.md`. The Append workflow gates the Changelog format and refuses partial entries (all four pieces — `conjectured`, `refuted by`, `learned`, `criterion now` — are required).

**v2.6 (Algorithm v6.0.0+):** Two ISA homes are now canonical:
- **Project ISAs** at `<project>/ISA.md` — for any thing with persistent identity (applications, CLI tools, libraries, content pipelines, infrastructure, the Algorithm itself). Lives in the project's repo as system of record. Tasks operating on the project read/modify/extend this single file.
- **Task ISAs** at `MEMORY/WORK/{slug}/ISA.md` — for ad-hoc work that doesn't belong to a persistent thing. One-shot tasks, system-design sessions, ephemeral investigations.

The format is identical for both; the lifecycle differs. Project ISAs grow continuously across many tasks; task ISAs are created at OBSERVE and archived at `phase: complete`. v6.0.x mechanics for `<project>/ISA.md` parser support, OBSERVE/PLAN inheritance resolver, Pulse rendering, and project-ISA seeding migration are forthcoming patches.

## What an ISA Is

**The ISA is one primitive with five identities** (Algorithm v6.0.0+):

1. **Ideal state articulation** — the written hard-to-vary explanation of "done" (Deutsch sense)
2. **Test harness** — ISCs ARE the tests, with named probes; for complex projects the ISCs cover application logic, performance, security, RBAC, build, deploy
3. **Build verification** — passing the ISCs verifies what was built
4. **Done condition** — task complete when all ISCs pass
5. **System of record** — for the thing being articulated (the application, the library, the algorithm itself, etc.)

LifeOS moves people from current state to ideal state by writing down what done looks like as testable claims, then refining the writing until every claim survives every test it can be subjected to. The ISA is that written record. The same primitive applies in any domain — code, science, art, philosophy, life decisions, business strategy, applications, CLI tools, libraries, infrastructure.

**Don't invent parallel artifacts.** No `acceptance.yaml`, no `acceptance.ts`, no separate test specs. The ISA covers this surface. For complex apps with rich application logic, the ISA naturally has many more ISCs because the ideal state of a complex app includes API behavior, performance budgets, security model, RBAC/visibility, auth flow, and data integrity invariants alongside task-specific deliverables. They aren't "in addition to" the ISA — they ARE the ISA.

Each ISC is a testable claim — one part of the explanation that can be tried against reality and either pass or fail. Hard-to-variability and testability are the same property: an ISC is hard-to-vary **if and only if** you can name a test that would falsify it. If you can't say what failure looks like, the ISC isn't hard-to-vary; it can be satisfied with anything. The whole ISA is hard-to-vary when removing or weakening any part changes what "done" actually means.

**The ISA is a living explanation.** It tightens through pursuit. The Goal sharpens, ISCs split or merge, decompositions clarify — driven by your feedback, by tool outputs, by signal returning from research, by ISCs failing verification. The ISA at OBSERVE captures the best initial articulation; by LEARN it has been refined by everything the work surfaced. Hard-to-variability is the **outcome** of the algorithmic process, not its precondition. "Done" includes "the explanation became hard-to-vary enough that we know we hit it" — not just checkbox completion.

**Worked example.** Same goal, two ISC framings:

```
Goal: ship the H3 onboarding email with paid-tier confirmation.

Fluff:        - [ ] ISC-N: Email is delivered to the user.
              (Trivially passable — almost any send path satisfies it. You can't
              name a test that would distinguish "delivered" from "delivered to spam.")

Load-bearing: - [ ] ISC-N: Email arrives in primary inbox (not Promotions/Spam) within 60s.
              (Names a specific test that would fail; removing it lets a "delivered
              to spam" outcome pass; goal mutates from "user sees the confirmation"
              to "Postmark logged a send.")
```

The fluff version can be satisfied with anything because no test would catch its variation. The load-bearing version names a falsifiable claim. That's the operational core of the doctrine — the Hard-to-Vary ISC Quality Gate (Algorithm) and the granularity rule (one binary tool probe per ISC) are the same rule viewed from epistemic and operational angles.

## Filename and Location

**Two canonical homes (v2.6 / Algorithm v6.0.0+):**

- **Project ISAs:** an `ISA.md` at the project root — for things with persistent identity. The project's repo is the system of record. Tasks targeting the project read/modify/extend this single file. Iteration on the project IS iteration on this file. Examples: human3, Surface, and the Algorithm repo each carry a project-root ISA.
- **Task ISAs:** `MEMORY/WORK/{slug}/ISA.md` — for ad-hoc, one-shot work that doesn't belong to a persistent thing. System-design sessions, ephemeral investigations, exploratory tasks.

**v6.0.x mechanics (forthcoming):** parser updates so `ISASync.hook.ts`, `CheckpointPerISC.hook.ts`, and `hooks/lib/isa-utils.ts` discover `<project>/ISA.md` alongside `MEMORY/WORK/` paths; OBSERVE/PLAN inheritance resolver; Pulse rendering for two homes; project-ISA seeding migration for existing projects.

**Backwards-compat (HISTORICAL — fully removed):** Through Algorithm v4.1.x hooks read `ISA.md` first and fell back to legacy `PRD.md` when present. The `PRD.md` fallback was removed at Algorithm v4.2.0. Algorithm is now at v6.3.0; any remaining `PRD.md` files in `MEMORY/WORK/` are inert legacy artifacts and are not read by any hook or skill.

## Frontmatter (YAML)

Eight required fields, two optional:

```yaml
---
task: "8 word task description"           # What this work is
slug: YYYYMMDD-HHMMSS_kebab-task          # Unique ID, directory name
effort: standard                          # standard|extended|advanced|deep|comprehensive
effort_source: auto                       # auto|explicit — whether effort was auto-detected or set via /eN
phase: observe                            # observe|think|plan|build|execute|verify|learn|complete
progress: 0/8                             # checked criteria / total criteria
mode: iterate                             # iterate|optimize|ideate|loop — Algorithm cognitive pattern
started: 2026-02-24T02:00:00Z            # Creation timestamp (ISO 8601)
updated: 2026-02-24T02:00:00Z            # Last modification timestamp (ISO 8601)
---
```

**`mode:` field values (2026-05-13+, post mode-reorg):** `iterate` | `optimize` | `ideate` | `loop`. The legacy values `interactive` and `loop` (different semantics) are no longer accepted; older ISAs may still carry them and parsers should treat as `iterate`. See `LIFEOS/ALGORITHM/modes/README.md` for canonical mode reference and `LIFEOS/ALGORITHM/modes/{iterate,optimize,ideate,loop,native}.md` for per-mode doctrine. Note: `native` is not an `mode:` value — NATIVE-response sessions don't have ISAs.

Optional field (added on rework/continuation):

```yaml
iteration: 2                              # Incremented when revisiting a completed task
```

Optional fields (NEW v2.13.0 / Algorithm v6.25.0 — ISA hierarchy):

```yaml
parent: 20260706-tolkien-world            # slug of the parent ISA (omit for a root/standalone ISA)
children:                                 # slugs of child ISAs this one rolls up (omit for a leaf)
  - 20260706-combat-system
  - 20260706-magic-system
```

**Semantics:** `parent`/`children` link ISAs into a tree. A child **inherits every ancestor `## Constraints`** — an inherited Constraint cannot be violated by a child ISC; overriding one is a parent-level renegotiation logged in the parent's `## Decisions`, never a silent child override. A parent's `progress:` may roll up its children (`3/5 children closed`). Both fields are omitted for a standalone single-ISA task (the common case). A change to any linked ISA triggers the Algorithm's blast-radius pass (v6.25.0) which lists downstream ISCs to re-verify; **conflict detection is automated, resolution stays human.**

Optional fields (NEW v2.8 / Algorithm v6.4.0+ — Principal-Stated Goal):

```yaml
principal_stated_goal: "verbatim user quote, byte-for-byte"   # NEVER paraphrased
principal_stated_goal_source: prompt                          # prompt | conversation | explicit-revision
principal_stated_goal_signal: 2                               # 1-4 — which detection signal fired
principal_stated_goal_locked: 2026-05-12T17:23:56Z            # ISO-8601 timestamp of capture
```

**Required-when:** OBSERVE goal-detection fired AND minimum-content rule passed (≥ 6 tokens AND propositional content present). Otherwise omitted entirely.

**Lifecycle:** the four fields are immutable across phases unless the user explicitly revises the literal. Revision is recorded as a `## Decisions` row with `refined: principal_stated_goal: was "<old>" now "<new>"`; frontmatter updates only on that explicit revision, and `principal_stated_goal_source` flips to `explicit-revision`.

**Detection signals (the four in v6.4.0):**

| # | Signal | Pattern |
|---|--------|---------|
| 1 | Named metric + threshold | quantitative target ("p95 < 200ms", "70k subscribers") |
| 2 | Explicit outcome assertion | "I want X" / "achieve X" / "do this" |
| 3 | Completion condition | "until X" / "such that X" |
| 4 | Structural/design directive | explicit verb-object on the system ("absorb", "replace", "unify") |

**Fail-closed:** if the candidate literal is < 6 tokens OR contains no propositional content ("make it good"), `principal_stated_goal: null` and the candidate is logged to Decisions.

**Multi-literal:** if a prompt contains multiple candidate literals, the first detected wins as `principal_stated_goal:`; the others demote to derived Constraints.

Optional fields (NEW v2.9 / Algorithm v6.5.0+ — Density × Tier Gate at OBSERVE):

```yaml
density_score: 0.42                    # 0..1 — Stage-2 density computed at Scaffold preflight
interview_invoked: true                # whether Stage-2 fired the interview
divergence_risk: medium                # low | medium | high — how much speculation made it into the ISA
density_gate_acknowledged: true        # always true on E3+ ISAs after Stage 2 runs (audit trail marker)
context_checks_fired: [observe-density, observe-sufficiency, plan-refresh]   # NEW v2.10 / Algorithm v6.7.0+ — list of Context Sufficiency checks that ran
context_sufficient: true               # NEW v2.10 / Algorithm v6.7.0+ — final boolean after all OBSERVE-phase checks; null if no check ran
frame_drift: none                      # NEW v2.11 / Algorithm v6.8.0+ — none | detected | skipped_no_goal_literal | null — VERIFY-entry three-boolean test result
frame_drift_summary: ""                # NEW v2.11 / Algorithm v6.8.0+ — ≤140 chars; set only when frame_drift: detected
```

**Required-when:** the four v6.5.0 fields populate together when `INTERVIEW_ELIGIBLE: true` (v6.7.0 extends eligibility to all ALGORITHM tiers). The two v6.7.0 fields populate when ANY Context Sufficiency check ran (Density Gate at any tier, Sufficiency Check at OBSERVE, or PLAN-entry Refresh). The two v6.8.0 fields populate when Frame-Drift Check ran at VERIFY — i.e., when ISA has non-null `principal_stated_goal`. If `principal_stated_goal: null` (or absent), `frame_drift: skipped_no_goal_literal`. Otherwise all six are omitted entirely (Bitter Pill discipline).

**Lifecycle:**
- `density_score`: immutable once set at OBSERVE — represents the prompt-state at scaffold time.
- `interview_invoked`: immutable.
- `divergence_risk`: may be updated mid-task (e.g., VERIFY surfaces additional drift); track changes in `## Decisions`.
- `density_gate_acknowledged`: presence-of-key IS the v6.5.0+ version marker; the value is always `true` once set.
- `frame_drift`: written at VERIFY entry; immutable thereafter. Revision requires explicit Decisions row.
- `frame_drift_summary`: immutable once set (only when `frame_drift: detected`).

**Semantics of `divergence_risk`:**

| Value | Meaning |
|-------|---------|
| `low` | gate didn't fire (score ≥ 0.5) OR all 3 questions answered |
| `medium` | gate fired, some questions answered then `proceed` |
| `high` | gate fired, immediate `proceed` override OR interview aborted mid-stream |

**Backwards-compat guard:** v6.4.0 and earlier ISAs lack these keys entirely. `CheckCompleteness` fires the v6.5.0 checks only when `density_score` key is explicitly present in frontmatter — mirroring the v6.4.0 `principal_stated_goal` guard pattern. `CheckCompleteness` fires the v6.7.0 checks only when `context_sufficient` key is present. `CheckCompleteness` fires the v6.8.0 Frame-Drift checks only when `frame_drift` key is present. Pulse `parseFrontmatter` (in `LIFEOS/PULSE/modules/wiki.ts` and `user-index.ts`) is tolerant of unknown keys, so older ISAs continue rendering unchanged across all version boundaries.

Optional fields (NEW v2.10 / 2026-05-13 — Response Mode + Journey Surface):

> **`response_mode` / `algorithm_mode` RETIRED 2026-07-11.** Mode classification (minimal/native/algorithm) was abolished system-wide and `TheRouter.hook.ts` — its setter — was deleted; nothing writes these keys on new sessions. Existing ISAs keep them (tolerant parsing). The Journey Surface fields (`current_state`/`ideal_state`/`capabilities_invoked`) are unaffected.

```yaml
response_mode: algorithm        # minimal | native | algorithm — Layer 1, formerly set by TheRouter.hook.ts (retired 2026-07-11)
algorithm_mode: iterate         # iterate | optimize | ideate | loop — Layer 2 (alias of `mode:` for clarity)

current_state: "Code has 47 type errors blocking deploy"   # The "before" — one-line summary of reality now
ideal_state: "Zero type errors, deploy passes CI"          # The "after" — one-line summary of done; aligned with Goal

capabilities_invoked:           # Array of capabilities actually invoked via tool call
  - ISA                         # (closed enumeration, see LIFEOS/ALGORITHM/capabilities.md)
  - SystemsThinking
  - FirstPrinciples
  - Forge                       # delegate agents also recorded here (build or audit mode)
```

**Required-when:**
- `response_mode`: populated on every session for which any ISA state is captured (i.e., NATIVE sessions that surface in Pulse get `response_mode: native` even without a full ISA — recorded in session metadata, not the ISA file).
- `algorithm_mode`: populated when `response_mode: algorithm`. Mirrors the existing `mode:` field — kept as separate explicit alias for clarity in Pulse rendering and for future extensions where `mode:` might carry richer semantics.
- `current_state` / `ideal_state`: optional one-line summaries for the Pulse Journey Strip. Populated when the Algorithm can produce a clean one-liner during OBSERVE (most multi-file work qualifies). If both are absent, the Journey Strip falls back to ISC progress count.
- `capabilities_invoked`: populated incrementally as the Algorithm fires each capability via tool call. Appended-only — no removal on revert. Mirrors the `🏹 CAPABILITIES SELECTED` block in Algorithm phase output, but records actual invocations not intended ones.

**Lifecycle:**
- `response_mode`: immutable once set at session start. Formerly set by `TheRouter.hook.ts` via additionalContext propagation (retired 2026-07-11 — no longer written on new sessions).
- `algorithm_mode`: changes only when the Algorithm explicitly switches mode (rare; e.g., user mid-task says "actually let's ideate this").
- `current_state`: immutable once written. The "before" snapshot doesn't change as work progresses.
- `ideal_state`: should align with `principal_stated_goal:` when set; can be refined as the ISA tightens (matches the "living explanation" pattern).
- `capabilities_invoked`: append-only. Ordered by first-invocation timestamp implicit in the array.

**Pulse surfacing** (planned with React component build — see `LIFEOS/DOCUMENTATION/Pulse/PulseMetadata.md`):
- `response_mode` → `ResponseModeBadge` (MINIMAL/NATIVE/ALGORITHM pill, distinct color per layer).
- `algorithm_mode` → `AlgorithmModeBadge` (iterate/optimize/ideate/loop pill — shown only when response_mode: algorithm).
- `current_state` / `ideal_state` → `JourneyStrip` (horizontal viz with ISC progress dots between the two endpoints).
- `capabilities_invoked` → `CapabilitiesStrip` (chips for each invoked capability, hover reveals tier-floor compliance status).

**Backwards-compat guard:** ISAs created before 2026-05-13 lack these keys entirely. Pulse `parseFrontmatter` is tolerant of unknown/missing keys — older ISAs render unchanged, the new badges/strips simply don't appear for them. The presence of `response_mode` is the v2.10+ version marker.

Optional fields (optimize mode — shared):

```yaml
eval_mode: metric                          # metric|eval — which evaluation strategy
target_type: code                          # skill|prompt|agent|code|function — auto-detected
target_path: "train.py"                    # What we're optimizing (file or directory)
baseline: 0.9979                          # Current best score (updated on improvement)
experiment_count: 0                       # Total experiments run
max_experiments: null                     # Optional: stop after N experiments
time_budget: 300                          # Seconds per experiment (0 = unlimited)
sandbox_path: ""                          # Auto-populated: where sandbox copy lives
```

Optional fields (optimize mode — metric mode):

```yaml
metric_name: "val_bpb"                    # Human-readable metric name
metric_command: "uv run train.py"         # Shell command that produces the metric
metric_direction: lower                   # lower|higher — which direction is "better"
metric_extract: "grep '^val_bpb:' run.log | cut -d' ' -f2"  # Extract metric from output
mutable_files: ["train.py"]              # Files the agent may modify
metric_target: null                       # Optional: stop when metric reaches this value
```

Optional fields (optimize mode — eval mode):

```yaml
eval_criteria:                             # Binary yes/no eval questions (3-6)
  - "Does the output contain specific facts with sources?"
  - "Is the output structured with clear sections?"
  - "Does the output avoid generic filler content?"
test_inputs:                               # Representative inputs to test against (3-5)
  - "research AI trends"
  - "quick research on quantum computing"
  - "deep investigation of supply chain attacks"
runs_per_experiment: 3                    # How many times to run per experiment
```

Optional fields (tunable parameters — ideate, optimize, loop modes):

```yaml
algorithm_config:
  preset: explore                          # Named preset (optional)
  focus: 0.25                              # Composite focus 0.0-1.0 (optional, ideate only)
  params:                                  # Resolved individual parameter values
    problemConnection: 0.28                # Ideation: problem connection strictness
    selectionPressure: 0.30                # Ideation: cull aggressiveness
    domainDiversity: 0.74                  # Ideation: source domain diversity
    phaseBalance: 0.33                     # Ideation: generative vs analytical phase balance
    ideaVolume: 31                         # Ideation: ideas per cycle
    mutationRate: 0.63                     # Ideation: evolution mutation intensity
    generativeTemperature: 0.74            # Ideation: DREAM/DAYDREAM wildness
    maxCycles: 4                           # Ideation: evolutionary cycles
    stepSize: 0.3                          # Optimize: mutation boldness
    regressionTolerance: 0.1               # Optimize: accept temporary regression
    earlyStopPatience: 3                   # Optimize: no-improvement patience
    maxIterations: 10                      # Optimize/Loop: hard iteration cap
    contextCarryover: 0.43                 # Cross-mode: history carried between cycles
    parallelAgents: 1                      # Cross-mode: agents per workstream
  locked_params: [parallelAgents]          # Params meta-learner cannot adjust
  user_overrides: []                       # Params user explicitly set (auto-locked)
  meta_learner_adjustments:                # History of meta-learner changes (ideate)
    - cycle: 2
      parameter: selectionPressure
      from: 0.30
      to: 0.45
      rationale: "Ideas converging too slowly"
```

### Field Rules

- `task`: Imperative mood, max 60 chars. Describes the deliverable, not the process.
- `slug`: Format `YYYYMMDD-HHMMSS_kebab-description`. Used as directory name under `MEMORY/WORK/`.
- `effort`: Determines ISC count range and time budget. See Algorithm for tier definitions.
- `phase`: Updated at the START of each Algorithm phase. Set to `complete` when done.
- `progress`: Format `M/N` where M = checked ISC criteria, N = total ISC criteria. Updated immediately when a criterion passes (don't wait for VERIFY).
- `mode`: `interactive` (single Algorithm run), `loop` (multiple iterations toward ideal state), or `optimize` (autonomous optimization loop). `interactive` and `loop` determine whether `iteration` tracking is active. `optimize` enables experiment tracking. When optimize mode is active, `eval_mode` determines whether measurement uses a shell command (metric) or LLM-as-judge (eval).
- `started`: Set once at creation. Never modified.
- `updated`: Set on every Edit/Write. Use current ISO 8601 timestamp.
- `iteration`: Omitted on first run. Set to `2` on first continuation, incremented thereafter.
- `algorithm_config`: Omitted for interactive mode. Written during OBSERVE when mode is ideate, optimize, or loop. Contains resolved parameter values (after preset → focus → overrides resolution). The `params` section always contains the RESOLVED values, not raw user input. Full parameter schema: `$LIFEOS_DIR/ALGORITHM/parameter-schema.md`.

## Body Sections (v2.7)

**Twelve sections in fixed order.** Each appears only when populated — never create empty placeholder sections (Bitter Pill discipline preserved). The Tier Completeness Gate determines which sections are required at which effort tier.

| # | Section | Purpose | Written At |
|---|---------|---------|------------|
| 1 | `## Problem` | What is broken or missing right now | OBSERVE |
| 2 | `## Vision` | Experiential intent — what euphoric surprise looks like | OBSERVE |
| 3 | `## Out of Scope` | Anti-vision — what is *not* included, declared in prose | OBSERVE |
| 4 | `## Principles` | Substrate-independent truths the work must respect | OBSERVE |
| 5 | `## Constraints` | Immovable architectural mandates (plus every Constraint inherited from `parent:`) | OBSERVE |
| 6 | `## Dependencies` | **NEW v2.13.0 (v6.25.0)** — cross-ISA needs, one machine-readable line each: `requires: <slug> — <what/contract>`. OBSERVE loads these ISAs into context before scaffolding criteria. Omit when the ISA has no cross-ISA needs. | OBSERVE |
| 7 | `## Goal` | Hard-to-vary spine — 1–3 sentences naming verifiable done | OBSERVE |
| 8 | `## Criteria` | Atomic ISCs (one binary tool probe each), including derived `Anti:` / `Antecedent:` | OBSERVE → EXECUTE |
| 9 | `## Bridge Criteria` | **NEW v2.13.0 (v6.25.0)** — cross-ISA integration ISCs: `- [ ] ISC-N: Bridge: <what must hold across the seam>`, with `anchors_to: cross: <slug>` in Test Strategy. Verified at VERIFY as a distinct pass after leaf criteria. Omit when the ISA integrates with no siblings. | OBSERVE → EXECUTE |
| 10 | `## Test Strategy` | Per-ISC verification (`isc \| anchors_to \| type \| check \| threshold \| tool`) — the harness contract `isa run` reads. `anchors_to` traces to `literal`, `derived: <sub-claim>`, or **`cross: <slug>`** (v2.13.0, bridge ISCs) | OBSERVE/PLAN |
| 11 | `## Features` | Work breakdown (`name \| satisfies \| depends_on \| parallelizable \| intelligence`) — `intelligence` is NEW v2.9 (v6.18.0): optional per-task dispatch level (`low\|medium\|high\|max`), empty = inherit the tier curve; down-route-only, scored to the Feature's hardest ISC, producer-locked (see Algorithm § Per-Task Intelligence Routing) | PLAN |
| 12 | `## Decisions` | Timestamped log including dead ends; `refined:` prefix | any phase |
| 13 | `## Changelog` | Conjecture / refuted-by / learned / criterion-now entries | LEARN |
| 14 | `## Verification` | Evidence per ISC (leaf + bridge) | VERIFY |

(Optimize mode adds `## Experiments` between Test Strategy and Features. `## Dependencies` and `## Bridge Criteria` appear only when the ISA participates in a hierarchy — a single-ISA task omits both, exactly like any other empty section.)

### Tier Completeness Gate (HARD at every tier, NEW v2.7)

| Tier | Required Sections |
|------|-------------------|
| **E1** | Goal, Criteria |
| **E2** | Problem, Goal, Criteria, Test Strategy |
| **E3** | Problem, Vision, Out of Scope, Constraints, Goal, Criteria, Features, Test Strategy |
| **E4** | All fourteen* |
| **E5** | All fourteen* + active Interview workflow run before BUILD |

\* `## Dependencies` and `## Bridge Criteria` are **conditional-required**: mandatory when the ISA has any `parent:`/`children:`/cross-ISA relationship, omitted (like any empty section) for a standalone single-ISA task. A hierarchical ISA that omits them fails the gate; a standalone one that omits them passes.

Project ISA override: any `<project>/ISA.md` requires E3+ structure regardless of task tier. Enforced by `Skill("ISA", "check completeness")`.

### Three-Guardrail Taxonomy (NEW v2.7)

Distinguished by *who they bind*: Principles bind the **thinking** (substrate-independent); Constraints bind the **solution space** (immovable); Out of Scope binds the **vision** (declarative anti-vision); Anti-criteria bind the **test surface** (granular `Anti:` ISCs derived from the first three).

### ID-Stability Rule (NEW v2.7)

ISC IDs never re-number on edit. Splits become `ISC-N.M` (parent preserved); drops become tombstones (`- [ ] ISC-N: [DROPPED — see Decisions]`). Reconcile depends on this; renumbering breaks ephemeral feature reconciliation silently.

### ISC Type Vocabulary (v2.12 / Algorithm v6.10.0 candidate)

The `type` column of `## Test Strategy` accepts a closed vocabulary of probe types. Each type names a specific verification mechanism with known schema and tool form.

| Type | Schema columns | Probe form | When to use |
|------|---------------|------------|-------------|
| `bun-test` | `check \| threshold \| tool` | `bun test <file>:<-t pattern>` exits 0 | Example-based correctness — fixed-input deterministic code |
| `bun-property` | `property \| generator \| runs \| tool` | `fc.assert(fc.property(gen, pred), { numRuns })` | Universal-quantified correctness — pure functions, parsers, serializers, math, data transforms |
| `bash` | `check \| threshold \| tool` | shell command exits 0 / output matches | grep, diff, curl, jq probes |
| `manual` | `check \| tool` | principal-recognizes-on-encounter | Experiential ISCs — design, voice, "feels right" |
| `screenshot` | `check \| tool` | Interceptor-captured image | UI rendering verification |
| `eval` | `check \| threshold \| tool` | `Skill("Evals")` rubric passes | Agent transcript quality, multi-turn flows |

**`bun-property` row shape:**

```
| isc      | anchors_to | type          | property                                | generator                              | runs | tool |
| ISC-N    | literal    | bun-property  | round-trip: parse(serialize(x)) ≡ x     | fc.record({...isa frontmatter schema}) | 1000 | bun test test/hooks/lib/isa-utils.property.test.ts -t "round-trips" |
```

- `property` — prose statement of the universal claim.
- `generator` — fast-check generator with constraints (`fc.integer({min, max})`, `fc.record({...})`, etc.) bounded to the function's actual input domain.
- `runs` — `numRuns` budget. Default 1000. 10000 for invariant-critical ISCs. 100 for slow generators.
- `tool` — `bun test <file>:<-t pattern>` form, as with `bun-test`.

**At E3+**, every pure-function ISC SHOULD have at least one `bun-property` row in `## Test Strategy`. When property form doesn't apply (impure function, infinite-state machine, externally-driven dependency), record the reason in `## Decisions`. See `skills/Hardening/Workflows/PropertyTest.md` for candidate detection logic and the ten property categories.

**Anti-ISCs default to universal form at E3+.** An Anti-ISC that says "API_KEY isn't in env" should be re-expressed as `∀ env-var-name. env-var-name !~ /API_KEY|AUTH_TOKEN/i in spawned env` — a property covering the failure-mode pattern, not the single instance. Example-shaped Anti-ISCs remain acceptable when the input domain is finite and small (named enums, fixed input sets), or when a `## Decisions` row records why universal form doesn't apply.

### Blast-radius probe strictness (convention, not new structure)

Match probe strictness to what the ISC touches, not to a uniform default. When an ISC touches **high-blast** surface — `.env`/secrets, auth, principal data, money movement, a push to a *public* remote, or a prod deploy — its `## Test Strategy` row must name a deterministic probe (`bash`/`bun-test`/`screenshot`, never `manual`) and the change satisfying it should land in a small, line-readable diff. **Low-blast** ISCs — static content, internal plumbing, anything reaching no network, DB, or principal data — can be verified empirically (test, output match, screenshot) without a line-by-line read, and tolerate large diffs.

This adds no field and no section. It's a probe-selection convention layered on the granularity rule and Test Strategy: high-blast surface is the same surface the release containment gates, `SystemFileGuard`, and `settings.json` `permissions.deny` already protect — the convention just makes ISCs over that surface name their stricter probe explicitly, and frees trivial changes from ceremony they don't need.

### Section format spec

The detailed schema for each new v2.7 section (Problem / Vision / Out of Scope / Principles / Constraints / Test Strategy / Features / Changelog) lives in the ISA skill's `Examples/canonical-isa.md` showpiece and `SKILL.md` reference. The skill is the system of record for the format itself; this spec file points to it. (v6.2.x: the per-section schema may be pulled into this file directly when there's a need for a hook-readable single source of truth.)

### Original section specs (v2.6 and earlier — preserved below)

### ## Goal

Written during OBSERVE. **The hard-to-vary spine of the explanation — 1 to 3 sentences max.** States what "done" looks like in coherent prose. Required when the ideal state isn't trivially captured by the frontmatter `task` field — large or experiential work, multi-deliverable tasks, ambiguous targets. Optional for tiny mechanical tasks (`task: rename function foo to bar` already encodes the goal hard-to-variably).

The Goal is the tightest verbal form of the ISA. The rest of the document elaborates and tests it; the ISC set is its decomposition into testable claims; verification confirms the explanation held up. If you can edit the Goal without changing the ISC set, the Goal isn't load-bearing. If the Goal stays and the ISCs drift away from it, the decomposition is wrong.

The Goal is a **living statement** — sharpen it as the work surfaces signal. Log structural Goal changes in `## Decisions` with a `refined:` prefix.

```markdown
## Goal

Recommend a redesigned LifeOS ISA format that closes the diagnosed articulation, probe, and hill-climb gaps while honoring Bitter Pill — no field scaffolding the model doesn't need. The recommendation must be small enough to ship as a minor doctrine bump without re-introducing v4.1-era ceremony, and grounded in the unification: hard-to-vary explanations as the operational quality standard for articulating ideal state in any domain. If approved, IsaFormat goes to v2.5 and Algorithm doctrine bumps to v5.6.0 to recognize the ISA as a living explanation.
```

### ## Context

Written during OBSERVE. Captures:
- What was explicitly requested and not requested
- Why this task matters
- Key constraints and dependencies
- Risks and riskiest assumptions (merged here, no separate Risks section)

For Advanced+ effort, a `### Plan` subsection may be added with technical approach details.

### ## Criteria

ISC (Ideal State Criteria) checkboxes. Written during OBSERVE, checked during EXECUTE/VERIFY.

```markdown
- [ ] ISC-1: Criterion text (8-12 words, binary testable, state not action)
- [ ] ISC-2: Another criterion
- [ ] ISC-3: Anti: What must NOT happen
```

**Rules:**
- Each criterion: 8-12 words, describes an end state (not an action)
- Binary testable: either true or false, no judgment required
- **Atomic**: one verifiable thing per criterion — no compound statements
- Anti-criteria use the `Anti:` prose prefix in the description; **all ISCs number sequentially** in one pool
- ID format: `ISC-N` for every ISC — the `Anti:` / `Antecedent:` prefix carries the doctrinal kind
- Check (`- [x]`) immediately when satisfied — don't batch at VERIFY
- Update frontmatter `progress` on every check change

**Atomicity — the Splitting Test (apply to every criterion):**
- Contains "and"/"with"/"including" joining two verifiable things? → split
- Can part A pass while part B fails independently? → split
- Contains "all"/"every"/"complete"? → enumerate what that means
- Crosses domain boundaries (UI/API/data/logic)? → one per boundary

**Format (Algorithm v5.5.0+):** `- [ ] ISC-N: criterion text` — no bracketed category letter, no `-A-` namespace. **All ISCs number sequentially in one pool.** The criterion phrasing reveals its shape; a competent reader infers the rest. The `Anti:` / `Antecedent:` prose prefixes are the only doctrinal surface signals.

**Two doctrinal kinds preserved as prose prefix conventions:**

| Kind | Surface form | Rule |
|------|--------------|------|
| Anti-criterion | `- [ ] ISC-N: Anti: what must NOT happen` | ≥1 required (a goal with zero failure modes worth naming is under-specified) |
| Antecedent | `- [ ] ISC-N: Antecedent: precondition that produces the target experience` | ≥1 required when the goal is experiential |

**Pre-v5.3.0 ISAs** that use bracketed category tags (`[F]`/`[S]`/`[B]`/`[N]`/`[E]`/`[A]`) still parse correctly via backward-compat in `hooks/lib/isa-utils.ts` — the captured `category` field is retained on `CriterionEntry` for them. New ISAs simply omit the bracket. **v5.3.0–v5.4.0 ISAs** that use `ISC-A-N` numbering for anti-criteria also still parse correctly (the legacy `id.includes('-A-')` check is retained as a backward-compat fallback alongside the new `Anti:` prefix detector).

**Granularity rule:** Split until each criterion is one binary tool probe. A criterion is granular enough when a single tool call (`Read`, `Grep`, `Bash`, `curl`, screenshot, `SELECT`, principal-recognizes-on-encounter for experiential ISCs, etc.) returns yes/no on whether it's met. If you cannot name the probe, the criterion is not yet atomic — split it. The model picks the right grain inside the tier time budget.

This rule **is** the operational form of hard-to-variability. An ISC that has a single binary probe is hard-to-vary, because the probe would catch any weakening. An ISC with no nameable probe is not hard-to-vary, because it can be satisfied with anything. Testability and hard-to-variability are the same property described from operational and epistemic angles.

**Nested ISCs are allowed when they help organize a complex ISA.** Use markdown nested checkboxes; ID format `ISC-N.M.K` for hierarchical IDs (parent `ISC-1` has children `ISC-1.1`, `ISC-1.2`; child `ISC-1.1` has grandchildren `ISC-1.1.1`, `ISC-1.1.2`). The granularity rule applies at the **leaf** level — leaves are atomic testable claims; parents are aggregations that pass when all descendant leaves pass. Don't nest for the sake of nesting; flat is fine when the ISA is small. The point is organization, not decomposition for its own sake.

**Coverage Gate — replaces the count floors (Algorithm v6.25.0).** The hard numeric ISC floors (E2 ≥16, E3 ≥32, E4 ≥128, E5 ≥256) are **DELETED**. They were a count anchor, and a count rewards splitting theater — atomizing to hit a number rather than to reach a probe. The gate now is **coverage**: every subsystem named in Vision/Goal has a container ISC, and every container decomposes via the Splitting Test until each leaf is a single binary tool probe. A 24-leaf ISA passes if it covers the surface; a 300-leaf ISA fails if a named subsystem has none. Never split to hit a number; split until each leaf is one probe, then stop. Coverage is checkable by the harness; a count never was.

**Doctrinal minimums (preserved across versions):** anti-criteria ≥1 (a goal with zero failure modes worth naming is under-specified). Antecedent ≥1 when the goal is experiential (the doctrinal hook for aesthetic/resonant work). v5.3.0 expressed both as prose prefixes (`Anti:` / `Antecedent:`) rather than bracket letters; v5.5.0 dropped the residual `ISC-A-N` numbering so anti-criteria number sequentially in the same pool as every other ISC. The gate rules themselves are unchanged.

**Version notes:**
- **v4.1.0 and earlier** specified per-tier ISC count floors (Standard: 8, Extended: 16, Advanced: 24, Deep: 40, Comprehensive: 64) plus category percentages and capability-count splits.
- **v5.0.0** removed all of that as a BPE-compaction move.
- **v5.2.0** reintroduced the count floors at E2+ only (16/32/128/256) — much higher than v4.1.0 — but kept all the other prescriptions cut (no category percentages, no capability-mix splits).
- **v5.3.0** dropped the bracketed category tags entirely (`[F]`/`[S]`/`[B]`/`[N]`/`[E]`/`[A]`); the two doctrinal gates (anti-criteria ≥1, antecedent ≥1 when experiential) survive via prose prefixes.
- **v5.5.0** dropped the residual `ISC-A-N` numbering for anti-criteria. All ISCs number sequentially as `ISC-N` in one pool; the `Anti:` prose prefix carries the doctrinal kind alone. Parsers retain `id.includes('-A-')` as a backward-compat fallback so v5.3.0–v5.4.0 ISAs still classify correctly.
- **v5.5.0+ Spec v2.5:** added `## Goal` section as the hard-to-vary prose spine (1–3 sentences, required when ideal state isn't trivially captured by `task` frontmatter); explicit living-document doctrine (ISA tightens through pursuit; refinements logged in `## Decisions` with `refined:` prefix); nested ISCs allowed natively for organizing complex ISAs (granularity rule applies at leaves); re-anchored the granularity rule as the operational form of hard-to-variability (testability ≡ hard-to-variability). Tier floors count atomic testable claims (leaves when nested). All v2.4 ISAs continue to parse — the four additions are additive. New ISAs from v2.5 onward should include `## Goal` when non-trivial.
- **Algorithm v6.0.0 / Spec v2.6:** Two ISA homes are canonical — Project ISAs at `<project>/ISA.md` for things with persistent identity, Task ISAs at `MEMORY/WORK/{slug}/ISA.md` for ad-hoc work.
- **Algorithm v6.1.0:** Thinking-capability floor becomes HARD at every tier; tier ISC count floor becomes HARD on count at E4/E5; cannot be relaxed via "show your math".
- **Algorithm v6.2.0 / Spec v2.7 (current shape):** body grew to **twelve sections in fixed order** — Problem, Vision, Out of Scope, Principles, Constraints, Goal, Criteria, Test Strategy, Features, Decisions, Changelog, Verification. Three-guardrail taxonomy locked. ID-stability rule (no re-numbering on edit). The **ISA Skill** at `$LIFEOS_ROOT/skills/ISA/` owns canonical workflows (Scaffold, Interview, CheckCompleteness, Reconcile, Seed, Append). `## Changelog` uses Deutsch conjecture/refutation/learning format; partial entries refused.
- **Algorithm v6.3.0 (current):** thinking-capability vocabulary becomes a **closed enumeration** (verbatim list of 19 names). Phantom thinking-capability names are CRITICAL FAILURE. **Capability-Name Audit Gate** fires at OBSERVE→THINK boundary. The ISA file shape itself is unchanged from v2.7 — v6.3.0 is a doctrine-layer evolution, not a format-layer one.

### ## Experiments (optimize mode only)

Experiment results table. Written during EXECUTE in optimize mode. Shows the most recent 10 experiments plus a summary line.

```markdown
| # | Hypothesis | Metric | Delta | Status | Duration |
|---|-----------|--------|-------|--------|----------|
| 1 | Reduce embedding dim 512→256 | 1.392 | -0.031 | kept | 45s |
| 2 | Add layer normalization | 1.401 | +0.009 | reverted | 62s |
| 3 | Switch to GELU activation | 1.378 | -0.014 | kept | 38s |

**Summary:** 23 experiments, 8 kept (35% hit rate). Baseline: 1.423 → Current: 1.312 (-7.8%)
```

A complete `results.tsv` is also maintained in the ISA directory for machine-parseable history.

### Guard Rail Semantics (optimize mode)

In optimize mode, ISC criteria serve as **guard rails** — assertions that must remain true across ALL experiments, not convergence goals to check off:

```markdown
- [x] ISC-1: Test suite passes after every kept change
- [x] ISC-2: No type errors in mutable files
- [x] ISC-3: Anti: No hardcoded values replacing computed values
```

Guard rails are checked every experiment cycle. A violation triggers automatic revert regardless of metric improvement. They start checked and must REMAIN checked. The `progress` field in optimize mode represents `kept_experiments/total_experiments`, not ISC completion.

### ## Decisions

Timestamped decision log. Written during any phase when non-obvious choices are made.
Include dead ends — failed approaches prevent future sessions from re-exploring them.

**Use the `refined:` prefix when a decision changes the Goal or restructures the ISC set** (split, merge, drop, add). Refinements are the trace of the ISA tightening — they're how the living-document property shows up in the artifact. The git history of the ISA file gives the full diff; `refined:` entries name the *why*.

```markdown
- 2026-02-24 02:00: Chose X over Y because Z
- 2026-02-24 02:15: Rejected approach A due to performance concern
- 2026-02-24 02:30: ❌ DEAD END: Tried B — failed because C (don't retry)
- 2026-02-24 03:00: refined: Goal sharpened — added "without breaking external API" after research surfaced consumer count
- 2026-02-24 03:15: refined: ISC-7 split into ISC-7.1 / ISC-7.2 — Verify probe revealed two distinct failure modes
```

**The `[arch]` tag (architecture-decision harvest).** Prefix a decision with `[arch]` when it belongs in the system-wide architecture log. `LIFEOS/TOOLS/ArchDecisionHarvest.ts` pulls every `[arch]`-tagged decision from `phase: complete` ISAs into `LifeosSystemArchitecture.md` § Architecture Decisions, so a structural choice made inside one task reaches the master doc without anyone copying it by hand. This is the single source of truth for the convention — the doc's log is the consumer, this is the producer.

> **Test — tag `[arch]` iff the decision establishes or changes a structure, contract, or convention that work in *other* tasks must conform to.** Process/sizing/product calls local to this task (which tier, which library for this feature, solo vs delegated) are NOT `[arch]`. A new file-format, a state-management pattern, a naming convention, a pipeline taxonomy, a cross-task protocol IS. Example: `- 2026-06-14 12:00: [arch] JSONL for streaming state — append-only, crash-safe, tailable; replaces single-file JSON snapshot.`

### ## Verification

Evidence for each criterion. Written during VERIFY phase.

```markdown
- ISC-1: Screenshot confirms layout renders correctly
- ISC-2: `bun test` passes, 14/14 tests green
- ISC-3: Confirmed no PII in output via rg
```

## File Location

```
$LIFEOS_DIR/MEMORY/WORK/{slug}/ISA.md
```

Directory created with `mkdir -p MEMORY/WORK/{slug}/` during OBSERVE. Legacy `PRD.md` files in this path are inert — the fallback was removed at Algorithm v4.2.0 and the system is now at v6.3.0.

## Continuation / Rework

When a follow-up prompt continues the same task:

1. AI detects recent ISA matching the task context
2. Edit existing ISA: reset `phase: observe`, add/increment `iteration`, update `updated`
3. Re-enter Algorithm phases as needed
4. Phase history in work.json tracks re-entry (COMPLETE → OBSERVE)

When it's a genuinely new task: create a new ISA with a new slug.

## Sync Pipeline

ISA is read-only from hooks' perspective:

1. **AI writes ISA** via Write/Edit tools
2. **ISASync hook** fires on PostToolUse, reads frontmatter + criteria
3. **work.json** updated with session state (keyed by slug)
4. **Pulse** reads work.json directly from disk via `/api/algorithm`
5. **Dashboard** polls `/api/algorithm` every 2 seconds

The AI is the sole writer. Hooks only read. work.json is derived state.

## Design Rationale

This format is informed by research across Kiro (AWS), spec-kit (GitHub), OpenSpec, BMAD,
Google Design Docs, Amazon 6-pagers, Shape Up pitches, and 48 production LifeOS ISAs.

Key design choices:
- **8 fields, not 15**: Only fields consumed by the sync pipeline. Dead fields waste tokens.
- **12 sections in fixed order (v2.7)**: Problem, Vision, Out of Scope, Principles, Constraints, Goal, Criteria, Test Strategy, Features, Decisions, Changelog, Verification. Each section has a defined purpose; empty sections never appear (Bitter Pill discipline). The earlier 6-section design (v2.5) was extended in v2.7 to surface anti-vision (Out of Scope), thinking guardrails (Principles), solution-space mandates (Constraints), test approach (Test Strategy), work breakdown (Features), and structural learning (Changelog using conjecture/refutation/learning format).
- **Checkboxes over EARS/BDD**: Simpler to parse, write, and verify. ISC pattern proven over 48+ ISAs.
- **YAML frontmatter over JSON**: Universal standard (Jekyll, Hugo, Astro, Kiro, spec-kit all use it).
- **Convention-based sections**: Sections appear when needed, not as empty boilerplate.
- **Reference file pattern**: This spec lives at `$LIFEOS_DIR/DOCUMENTATION/Isa/IsaFormat.md`, not inline in CLAUDE.md. Saves ~2,500 tokens/response.
- **Universal primitive (v2.5)**: The same artifact structure serves software, science, art, philosophy, life decisions, business strategy. Hard-to-variability is the universal quality standard for the writing; testability is its operational form; the scientific method is verification; refinement through pursuit is the living document.
- **Bitter Pill discipline (v2.5)**: No structural fields a smarter model would render unnecessary. Probe fields, separate Ideal State / Current State sections, separate Variation Audit section, and tier-gated additions were all proposed and rejected during v2.5 design — clear ISC text + recurring ILA at phase boundaries do the same work without scaffolding.

## Naming History

The artifact was called "PRD" (Product Requirements Document) through Algorithm v4.0.1. Renamed to **ISA — Ideal State Artifact** in v4.1.0. Three justifications: voice-flow (ISA pronounces as a single word), ISC pairing (ISA holds the ISC), and hard-to-variability (artifact implies a tangible verifiable output, mirrors the doctrine's elevation of the artifact as the unit of hard-to-variability). The rename is vocabulary-only — all v4.0 doctrine semantics preserved verbatim.
