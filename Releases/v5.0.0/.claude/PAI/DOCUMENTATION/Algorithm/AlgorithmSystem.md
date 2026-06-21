# The Algorithm System

**The gravitational center of PAI — everything else exists to serve it.**

The Algorithm is PAI's universal engine for accomplishing any task. It transitions from **Current State** to **Ideal State** through verifiable iteration, using Ideal State Criteria (ISC) as the quality gate. Every interaction — memory capture, hook execution, learning synthesis — feeds back into improving the Algorithm itself.

**Current version:** v6.3.0
**Spec location:** `PAI/ALGORITHM/v6.3.0.md` (canonical pointer: `PAI/ALGORITHM/LATEST`)
**Goal:** Euphoric Surprise — 9-10 user ratings on every response.

**v6.3.0 frame shift:** the thinking-capability vocabulary becomes a **CLOSED ENUMERATION** — selection MUST come verbatim from a fixed list (IterativeDepth, ApertureOscillation, FeedbackMemoryConsult, Advisor, ReReadCheck, FirstPrinciples, SystemsThinking, RootCauseAnalysis, Council, RedTeam, Science, BeCreative, Ideate, BitterPillEngineering, Evals, WorldThreatModel, Fabric patterns, ContextSearch, ISA). Inventing generic labels ("decomposition", "tradeoff analysis", "deep reasoning") is a **PHANTOM thinking capability** and counts as a CRITICAL FAILURE. The new **Capability-Name Audit Gate** fires at the OBSERVE→THINK boundary — every name in `🏹 CAPABILITIES SELECTED` must appear verbatim in the closed list, bolded with `**Name**`. New thinking capabilities are added by editing `capabilities.md` and bumping the Algorithm minor version — never by ad-hoc invention at run time.

**Lineage:** v6.3.0 inherits the v6.2.0 twelve-section ISA frame (Problem, Vision, Out of Scope, Principles, Constraints, Goal, Criteria, Test Strategy, Features, Decisions, Changelog, Verification) — the ISA is a **System of Record** with a three-guardrail taxonomy (Principles bind thinking, Constraints bind solution space, Anti-criteria bind test surface), Out of Scope as its own anti-vision section, HARD tier-completeness gates at every tier, the **ISA Skill** at `~/.claude/skills/ISA/` owning canonical workflows (Scaffold, Interview, CheckCompleteness, Reconcile, Seed, Append), and the ID-stability rule (ISC IDs never re-number on edit; splits become `ISC-N.M`, drops become tombstones). Earlier lineage: v6.1.0 thinking-floor hardening (HARD floors, cannot be relaxed via "show your math"), v6.0.0 mode-selection floor (`PromptProcessing.hook.ts` at UserPromptSubmit decides MODE/TIER), v5.x BPE compaction + capability count-floor restoration.

---

## Core Concept

The Algorithm applies at every scale — fixing a typo, building a feature, launching a company. The pattern is always the same:

```
Current State -> [7 Phases] -> Ideal State
                    ^
              ISC verification at each step
```

PAI is not a static tool. The Algorithm continuously upgrades itself based on accumulated evidence from ratings, reflections, and knowledge capture. The ISA is the artifact that carries that evidence forward across sessions.

---

## The 7 Phases

| Phase | Icon | Purpose |
|-------|------|---------|
| **OBSERVE** | Eye | Reverse-engineer the request. Set effort level. Select capabilities. Scaffold or load the ISA via `Skill("ISA", "scaffold from prompt at tier T")`. Run preflight gates including the Mode-Selection Floor. |
| **THINK** | Brain | Identify risks, assumptions, failure modes. Search `MEMORY/KNOWLEDGE/` for prior work. Refine ISC. Predict satisfaction score. At E2+, hit the HARD thinking-capability floor. |
| **PLAN** | Clipboard | Determine scope strategy (depth/breadth). Decide session splitting. Run isolation gate for parallel agents. May call `Skill("ISA", "extract feature X as ephemeral file")` to derive a Ralph-Loop view. |
| **BUILD** | Hammer | Invoke selected capabilities via tool calls. Preparation work. Stage decisions, but defer authoritative writes to LEARN — Decisions/Changelog/Verification entries are appended through `Skill("ISA", "append ...")`. |
| **EXECUTE** | Lightning | Do the work. Check off ISC criteria as each passes. Update ISA progress in real-time using stable ISC IDs (no re-numbering). |
| **VERIFY** | Checkmark | Verify every criterion with evidence. Confirm capability invocations met tier minimums (HARD on thinking, soft on delegation). Apply the Verification Doctrine (Rules 1, 2, 2a, 3). Check preflight compliance. |
| **LEARN** | Book | Reflect on what worked and what didn't. Route findings through the Learning Router (8 types). Append Decisions/Changelog/Verification via the ISA Skill — the Append workflow is the gate that keeps the Deutsch conjecture/refutation/learning Changelog format from degrading. |

Each phase transition requires an ISA update. Phase headers are mandatory output. **Phase tracking:** `hooks/lib/isa-utils.ts::appendPhase()` records ISA-sourced entries in `work.json` phaseHistory. It also writes top-level `session.phase` and drives `setPhaseTab()` for the terminal tab icon, so `/agents` UI and kitty tabs reflect the live phase. The ISA edit is the single phase signal.

---

## Effort Levels

| Tier | Shortcut | Budget | ISC Floor | Thinking (HARD) | Delegation (soft) | When |
|------|----------|--------|-----------|-----------------|-------------------|------|
| Standard | `/e1` | <90s | none | 0-1 | 0 | Normal request (default) |
| Extended | `/e2` | <3min | >=16 | >=2 | >=1 | Quality must be extraordinary |
| Advanced | `/e3` | <10min | >=32 | >=4 | >=2 | Substantial multi-file work |
| Deep | `/e4` | <30min | >=128 | >=6 | >=2 | Complex design or cross-system change |
| Comprehensive | `/e5` | <120min+ | >=256 | >=8 | >=4 | No time pressure, ideal-state pursuit |

**Thinking floor is HARD (v6.1.0).** It cannot be relaxed via the "show your math" override. Under-floor on thinking is a verification failure, not a documented choice.

**Delegation floor is soft.** Under-floor delegation is allowed if the model documents in `## Decisions` why the work was not parallelizable — typical in single-file refactors or strictly sequential pipelines.

**Capability count** = distinct skills/agents actually invoked via tool call. Text-only references do not count. The capabilities table is in `PAI/ALGORITHM/capabilities.md`.

### Tier Completeness Gate (HARD at every tier)

Each tier has a minimum set of ISA sections that must be populated before BUILD begins. The `Skill("ISA", "checkCompleteness")` workflow is the gate.

| Tier | Required ISA sections |
|------|----------------------|
| **E1** | Goal, Criteria |
| **E2** | Problem, Goal, Criteria, Test Strategy |
| **E3** | Problem, Vision, Out of Scope, Principles, Constraints, Goal, Criteria, Test Strategy, Features |
| **E4** | All twelve sections |
| **E5** | All twelve sections **plus** the Interview workflow run (`Skill("ISA", "interview")`) before BUILD |

If the gate fails, the Algorithm does not proceed. There is no override prose — the missing sections must be filled.

---

## ISC Quality System

ISC (Ideal State Criteria) are the atomic verification units. Every criterion must be binary-testable and one verifiable end-state.

**Format (v5.5.0+ preserved):** `- [ ] ISC-N: criterion text`. No bracketed category letter, no `-A-` namespace — all ISCs number sequentially in one pool. The criterion phrasing reveals its shape; the `Anti:` / `Antecedent:` prose prefixes carry the doctrinal kind.

**Three doctrinal kinds, preserved as prose prefix conventions:**

- **Positive criterion** — `- [ ] ISC-N: what must be true`. The default.
- **Anti-criterion** — `- [ ] ISC-N: Anti: what must NOT happen`. >=1 required (a goal with zero failure modes worth naming is under-specified). These are *derived* anti-criteria — the test-surface guardrail. They are distinct from the **Out of Scope** section, which is the "anti-vision" guardrail bound to the solution space, not the test surface.
- **Antecedent** — `- [ ] ISC-N: Antecedent: precondition that produces the target experience`. >=1 required when the goal is experiential.

### ID-Stability Rule

**ISC IDs never re-number on edit.**

- Inserting a new criterion appends; existing IDs do not shift.
- Splitting an existing criterion produces `ISC-N.M` children (e.g., ISC-7 splits into ISC-7.1 and ISC-7.2). The original ID is retired but never reused.
- Dropping a criterion leaves a tombstone (`- [-] ISC-N: <retired> — reason`). The ID is never reused.

The Reconcile workflow depends on this rule. Without stable IDs, ephemeral feature files cannot deterministically merge back into the master ISA.

### Splitting Test

Apply to every criterion before finalizing:

- **"And"/"With"** joins two verifiable things — split.
- **Independent failure** — part A can pass while B fails — split.
- **Scope words** ("all", "every", "complete") — enumerate.
- **Domain boundary** crosses UI/API/data/logic — one per boundary.

### Quality Gates (must pass before leaving OBSERVE)

1. **Granularity** — every ISC has a nameable single-tool probe.
2. **Tier floor (HARD on the count)** — total ISC count meets the tier floor (E2 >=16, E3 >=32, E4 >=128, E5 >=256). Under-floor either keeps splitting or — at E2/E3 only — documents under-decomposition in `## Decisions` with a load-bearing reason. E4/E5 cannot under-floor.
3. **Doctrinal minimums** — anti-criteria >=1; antecedent >=1 when the goal is experiential.

> Canonical doctrine lives in `PAI/ALGORITHM/v6.3.0.md` (or follow `PAI/ALGORITHM/LATEST`). This summary is convenience-only — when in doubt, read the spec.

---

## Mode-Selection Floor (v6.0.0)

`EscalationGate.hook.ts` runs at **UserPromptSubmit** and writes a `MODE_FLOOR` entry into the session context. It closes the v5.0.0 BPE under-cut where the model could under-classify a deeply complex question as exploratory and bypass the Algorithm entirely.

**Five trigger families** force ALGORITHM (the floor floors *up*, never down):

1. **Doctrine-affecting** — the prompt would change a Founding Principle, a hook, an Algorithm rule, or a SKILL.md.
2. **Architectural-locator** — the work touches the Algorithm core, ISA format, or any file in `PAI/ALGORITHM/`, `PAI/DOCUMENTATION/`, `hooks/`, or `skills/`.
3. **Multi-project** — the work spans two or more projects in `PROJECTS.md`.
4. **Soft-user-signal** — phrases like "make sure this is right", "no shortcuts", "production-grade", "cover every edge case", or any explicit effort shortcut (`/e2`–`/e5`).
5. **Hard-to-vary explanation work** — the prompt asks for a *why*, an explanation, a doctrine, or a model that must hold across cases (Deutsch). Surface explanation tasks survive in NATIVE; deep ones do not.

**Three-axis NATIVE -> ALGORITHM gate.** Even without a hard trigger, the prompt is escalated to ALGORITHM if it scores high on two of three axes:

- **Scope axis** — multi-file, multi-system, or multi-session.
- **Risk axis** — irreversible, security-sensitive, or affects shared state.
- **Reasoning axis** — requires comparing alternatives, building a model, or articulating a hard-to-vary explanation.

The hook never *prevents* the model from going deeper — it prevents it from going shallower than the prompt deserves.

---

## Mode System

The Algorithm supports multiple execution modes detected during OBSERVE.

| Mode | Trigger | Phase Compression |
|------|---------|-------------------|
| **Standard** | Default | All 7 phases |
| **Fast-path** | Verbatim command, single tool call (E1 only) | OBSERVE -> EXECUTE -> VERIFY |
| **Research** | Analysis/review, no code changes (E1/E2 only) | OBSERVE -> THINK -> EXECUTE -> VERIFY -> LEARN |
| **Ideate** | `ideate [problem]`, `id8`, `generate ideas for` | All 7, with ideate-loop.md overlay |
| **Optimize** | `optimize [target]` | All 7, with optimize-loop.md overlay |

Mode detection logic: `PAI/ALGORITHM/mode-detection.md`.

### Tunable Parameters (Ideate & Optimize)

Both modes accept tunable parameters resolved via preset, focus value, individual overrides, or tone inference. Parameters are stored in ISA `algorithm_config:` frontmatter.

Presets: `dream`, `explore`, `directed`, `surgical` (ideate) | `cautious`, `aggressive` (optimize).

---

## Knowledge Archive Integration

The Algorithm's THINK and LEARN phases integrate with the Knowledge Archive (entity types: People, Companies, Ideas, Research):

- **THINK phase:** searches `MEMORY/KNOWLEDGE/` for prior work on the current topic. Prevents re-researching known entities. Lookup is BM25 + frontmatter + wikilink (3-pass).
- **LEARN phase:** routes findings through the **Learning Router**. Eight types are recognized:

| Type | Destination |
|------|-------------|
| **knowledge** | `MEMORY/KNOWLEDGE/{People|Companies|Ideas|Research}/` — durable, lookup-by-name |
| **rule** | A rule the system should always follow — proposed for `PAI_SYSTEM_PROMPT.md` or a SKILL.md |
| **gotcha** | A trap to avoid next time — appended to the relevant SKILL.md `Gotchas` section |
| **state** | Operational state (e.g., "X is now deployed at Y") — appended to the relevant project doc |
| **business** | Business-domain learning — `PAI/USER/BUSINESS/` |
| **identity** | Principal/DA identity update — `PAI/USER/PRINCIPAL_IDENTITY.md` or `DA_IDENTITY.md` |
| **doctrine** | An Algorithm- or PAI-level principle — proposed for `PAI/ALGORITHM/v{NEXT}.md` |
| **hook** | A behavior that should be enforced automatically — proposed as a hook |
| **permission** | A new automation permission boundary — proposed for `settings.json` |

The Learning Router is the "Would {{PRINCIPAL_NAME}} look this up by name?" test, generalized. Most sessions still skip — that is correct behavior. Only capture what is genuinely novel and reusable.

---

## ISA as System of Record (v6.2.0)

Every Algorithm run binds to an **Ideal State Artifact** — an ISA. The ISA is the single source of truth for the run: ideal state, build target, test harness, done condition, and post-hoc record.

### Two ISA homes

- **Persistent (project-scoped):** `<project>/ISA.md` — for projects with a persistent identity (Surface, Newark Sentinel, Human 3.0, Pulse, etc.). The ISA lives with the codebase and survives every Algorithm run against that project.
- **Ad-hoc (session-scoped):** `MEMORY/WORK/{slug}/ISA.md` — for one-shot work, debugging sessions, audits, and any task without a persistent home.

The Algorithm picks the home in OBSERVE. Persistent ISAs reload existing state; ad-hoc ISAs scaffold new.

### Twelve sections in fixed order

| # | Section | Purpose |
|---|---------|---------|
| 1 | **Problem** | The current state — what is wrong, missing, or inadequate |
| 2 | **Vision** | The ideal state — what "right" looks like in prose |
| 3 | **Out of Scope** | The anti-vision — explicitly what this is NOT (solution-space guardrail) |
| 4 | **Principles** | The thinking guardrail — what beliefs must hold while reasoning about this |
| 5 | **Constraints** | The solution-space guardrail — what the solution may not do |
| 6 | **Goal** | The single articulated objective for this run |
| 7 | **Criteria** | The ISC list — binary-testable verification units (test-surface guardrail via Anti: ISCs) |
| 8 | **Test Strategy** | How the criteria will actually be probed (live probes, fixtures, advisor calls) |
| 9 | **Features** | The decomposition into work units (each may spawn an ephemeral feature file) |
| 10 | **Decisions** | Decisions made during the run, with reasoning |
| 11 | **Changelog** | Deutsch-format entries — conjecture / refutation / learning |
| 12 | **Verification** | The evidence captured during VERIFY — tool output, links, screenshots |

### Three-guardrail taxonomy

- **Principles** bind *thinking* — what beliefs the model must hold while reasoning. ("Bias toward smaller, deterministic functions.")
- **Constraints** bind the *solution space* — what the solution may not do. ("No new dependencies; bun-only; no Python.")
- **Anti-criteria** (in `## Criteria` as `Anti:` ISCs) bind the *test surface* — what the test must demonstrate did not happen.

The three are not redundant. Out of Scope (section 3) sits above all three as the **anti-vision** — it is what the artifact deliberately is not, articulated before any guardrail is set.

### Ephemeral feature files (Ralph Loop / Maestro pattern)

Large work decomposes. Each feature in `## Features` may spawn an **ephemeral feature file** — a derived view of the master ISA scoped to one feature. The PLAN phase calls `Skill("ISA", "extract feature X as ephemeral file")`.

- The ephemeral file lives at `<project-or-slug>/_ephemeral/{feature-slug}.md`.
- It carries the same ISC IDs as the master ISA (ID-stability rule).
- Work proceeds against the ephemeral file. ISCs check off there.
- When the feature completes, the **Reconcile workflow** merges ISC state back into the master ISA via deterministic ISC-ID merge.
- The ephemeral file moves to `_ephemeral/.archive/{feature-slug}.{timestamp}.md`.

This is the Ralph Loop / Maestro pattern: parallel work proceeds without master-ISA contention, and reconciliation is mechanical rather than judgment-based.

### ISA Skill (NEW v6.2.0)

The canonical template, schema, and write logic now live in the **ISA skill** at `~/.claude/skills/ISA/`. The Algorithm calls the skill rather than inlining ISA logic in phases.

| Workflow | Phase | Purpose |
|----------|-------|---------|
| **Scaffold** | OBSERVE | Build a new ISA at the right tier from the prompt |
| **Interview** | OBSERVE (E5 only, BUILD-blocking) | Walk all twelve sections via conversational fill |
| **CheckCompleteness** | end of OBSERVE | Tier-completeness gate (HARD) |
| **Reconcile** | end of EXECUTE | Merge ephemeral feature files back into master ISA |
| **Seed** | OBSERVE | Seed an ad-hoc ISA from a persistent project ISA when crossing the boundary |
| **Append** | LEARN | Append Decisions / Changelog / Verification entries — gates the Deutsch format so it does not degrade |

Frontmatter (unchanged across versions): `task`, `slug`, `effort`, `phase`, `progress`, `mode`, `started`, `updated`.

Full ISA format spec: `PAI/DOCUMENTATION/IsaFormat.md`. ISA skill: `skills/ISA/SKILL.md`.

---

## Verification Doctrine

The Algorithm's VERIFY phase is governed by four numbered rules. They are non-negotiable at E3+ and recommended at E2.

- **Rule 1 — Live-Probe.** Every ISC marked complete must have at least one live-probe evidence artifact attached in `## Verification`: command output, HTTP response, screenshot, file diff, or test result. "Should work" is a verification failure.
- **Rule 2 — Commitment-Boundary Advisor.** Before any commitment that crosses an irreversibility boundary (deploy, push, send, delete, publish), the Algorithm spawns a same-vendor advisor (Claude-family) to second-read the change. The advisor returns a structured verdict and the model resolves any disagreement before crossing.
- **Rule 2a — Cato cross-vendor at E4/E5 (MANDATORY).** At Deep (E4) and Comprehensive (E5) tiers, the same-vendor advisor is supplemented by **Cato**, an OpenAI-family auditor running GPT-5.x. Cato reads the diff and the verification evidence, and returns its own verdict. Cross-vendor coverage exists because same-family models share blind spots — Cato catches what same-family advisors miss. **Skipping Cato at E4/E5 is a critical verification failure.** Cato is invoked by the Algorithm itself (not by Forge or any other delegate).
- **Rule 3 — Conflict-Surfacing.** When the advisor (Rule 2) and Cato (Rule 2a) disagree, or when either disagrees with the model's claim, the conflict is surfaced to the principal in the response — never silently resolved by the model picking a side.

The Verification Doctrine is the bridge between "ran the code" and "trusted the result." It does not produce certainty; it produces auditable disagreement.

---

## Supporting Files

| File | Purpose |
|------|---------|
| `PAI/ALGORITHM/v6.3.0.md` | Full execution spec — the definitive Algorithm reference |
| `PAI/ALGORITHM/LATEST` | Symlink to the active version spec |
| `PAI/ALGORITHM/capabilities.md` | Capability selection tables (thinking, code quality, delegation, research) |
| `PAI/ALGORITHM/mode-detection.md` | Mode and parameter detection logic |
| `PAI/ALGORITHM/ideate-loop.md` | Ideate mode overlay (evolutionary ideation) |
| `PAI/ALGORITHM/optimize-loop.md` | Optimize mode overlay (metric/eval optimization) |
| `PAI/DOCUMENTATION/IsaFormat.md` | ISA format specification |
| `skills/ISA/SKILL.md` | ISA skill — canonical template + six workflows |
| `hooks/PromptProcessing.hook.ts` | UserPromptSubmit hook that decides MODE/TIER and writes the Mode-Selection Floor |
| `hooks/lib/isa-utils.ts` | Phase-tracking and ISA merge utilities |

---

## Version History

| Version | Key Changes |
|---------|-------------|
| **v6.3.0** (current) | **Closed enumeration of thinking capabilities** — IterativeDepth, ApertureOscillation, FeedbackMemoryConsult, Advisor, ReReadCheck, FirstPrinciples, SystemsThinking, RootCauseAnalysis, Council, RedTeam, Science, BeCreative, Ideate, BitterPillEngineering, Evals, WorldThreatModel, Fabric patterns, ContextSearch, ISA. Phantom thinking-capability names (anything off-list) are CRITICAL FAILURE. **Capability-Name Audit Gate** fires at OBSERVE→THINK boundary — every selected name must appear verbatim in the closed list. New thinking capabilities require editing `capabilities.md` and bumping the Algorithm minor version |
| v6.2.0 | Twelve-section ISA in fixed order; three-guardrail taxonomy (Principles / Constraints / Anti-criteria) with Out of Scope as anti-vision; HARD tier-completeness gate at every tier; **ISA Skill** introduced at `~/.claude/skills/ISA/` with six workflows (Scaffold, Interview, CheckCompleteness, Reconcile, Seed, Append); ID-stability rule formalized (no re-numbering, splits become ISC-N.M, drops become tombstones); ephemeral feature files (Ralph Loop / Maestro) with deterministic reconcile |
| v6.1.0 | Thinking-floor hardening — thinking capability minimums become HARD at every tier; cannot be relaxed via "show your math"; delegation floor remains soft |
| v6.0.0 | Frame shift — ISA elevated to universal primitive with five identities; two ISA homes (project / ad-hoc); Mode-Selection Floor introduced via `EscalationGate.hook.ts` (UserPromptSubmit) closing the v5.0.0 BPE under-cut |
| v5.x | BPE compaction (single-pool ISC numbering, prose-prefix doctrinal kinds) and capability count-floor restoration to v4.1.0-era numbers |
| v3.26.0 | Doctrine tightening: Deliverable Manifest (PLAN), Inline Verification mandate (EXECUTE), Reproduce-First blocking gate (OBSERVE) |
| v3.25.0 | Capability expansion: SystemsThinking and RootCauseAnalysis skills added to the thinking lattice |
| v3.24.0 | Five hardening patches (P1-P5) closing RedTeam-identified escape hatches |
| v3.23.0 | Verification Doctrine: three rules (Live-Probe, Commitment-Boundary Advisor, Conflict-Surfacing) |
| v3.18.0 | E-level shortcuts (/e1-/e5) for explicit effort control |
| v3.17.0 | LEARN phase writes knowledge directly to KNOWLEDGE/ archive |
| v3.16.0 | Knowledge Archive integration |
| v3.14.x | ISC category tags, splitting test, quality gates |
| Earlier | Phase structure established, ISA system, effort tiers |

---

## Context Recovery

**Mid-session (after compaction):**

1. Read most recent ISA — has phase, progress, all ISC state, all twelve sections.
2. Check TaskList for in-flight work.
3. Re-verify auth tokens if needed.
4. Jump to current phase — do not re-run earlier phases.

**Cold-start (new session on existing work):**

1. Read ISA from `<project>/ISA.md` if persistent, else from `~/.claude/PAI/MEMORY/WORK/{slug}/ISA.md`.
2. `~/.claude/PAI/MEMORY/STATE/work.json` has the session registry.
3. If ephemeral feature files exist under `_ephemeral/`, reconcile before resuming.

---

## Rules

- No freeform output — every response uses the Algorithm's summary format.
- No phantom capabilities — every selected capability must be invoked via tool call.
- ISA is the AI's responsibility, mediated through the ISA skill — no hook writes to ISA bodies.
- ISC quality gates and the tier-completeness gate must pass before leaving OBSERVE.
- Thinking floor is HARD; delegation floor is soft with documented reason.
- ISC IDs never re-number — splits become ISC-N.M, drops become tombstones.
- The Mode-Selection Floor only floors up — never down.
- No silent stalls — hung execution is failure.

---

*Full execution spec: `PAI/ALGORITHM/v6.3.0.md` (or `PAI/ALGORITHM/LATEST`) | ISA format: `PAI/DOCUMENTATION/IsaFormat.md` | ISA skill: `skills/ISA/SKILL.md`*
