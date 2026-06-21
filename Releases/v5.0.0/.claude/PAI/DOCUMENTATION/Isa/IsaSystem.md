# ISA System

The ISA — Ideal State Artifact — is the universal primitive that holds the articulated ideal state of any thing whose ideal state we are pursuing. Project, application, library, infrastructure, work session, art piece, strategic decision: the ISA is one document that articulates done, drives the build, verifies the build, and records the evolution of understanding. This document explains the architecture, how the pieces fit together, and how the ISA relates to the rest of the PAI subsystem family.

The companion documents:

- **Format spec** — `PAI/DOCUMENTATION/IsaFormat.md` — the file-shape contract: frontmatter fields, body section schemas, ID-stability rule, status markers.
- **Skill** — `~/.claude/skills/ISA/SKILL.md` — the workflows that generate, refine, score, and merge ISAs (Scaffold, Interview, CheckCompleteness, Reconcile, Seed, Append).
- **Algorithm doctrine** — `PAI/ALGORITHM/v6.3.0.md` (or LATEST) — the invocation cadence: when each workflow fires across the seven Algorithm phases.

If this document and the format spec disagree, the format spec wins and this document updates to match.

---

## Five Identities

The ISA is one primitive with five simultaneous identities. Authors think of it as one document; pursuers (humans and agents) read it through whichever lens the current phase requires.

1. **Ideal state articulation** — the written hard-to-vary explanation of done, in the Deutsch sense. Removing or weakening any part changes what done means.
2. **Test harness** — the ISCs *are* the tests. Every ISC names a single binary tool probe; the collection of probes is the project's full test surface.
3. **Build verification** — passing the ISCs verifies what was built. There is no separate "acceptance suite" — the ISA covers it.
4. **Done condition** — the task is complete when every ISC passes. `progress: N/N` and `phase: complete` are mechanical consequences of the ISC truth state.
5. **System of record** — for the thing being articulated. For project ISAs (`<project>/ISA.md`), the document is the long-lived authoritative description of the project's ideal state across many work sessions.

The five identities exist because pursuit is iterative. At OBSERVE the ISA is articulation; at PLAN it is the work breakdown; at BUILD it is the contract being met; at VERIFY it is the test harness; at LEARN it is the system of record being refined.

---

## Three-Guardrail Taxonomy

Three concepts that are adjacent but bind different surfaces. Authors confuse them constantly; the ISA forces them apart.

| Guardrail | Binds | Tone | Lives In | Example |
|-----------|-------|------|----------|---------|
| **Principles** | The *thinking* | Aspirational, generalizable, substrate-independent | `## Principles` | "User-facing systems prioritize responsiveness." |
| **Constraints** | The *solution space* | Immovable, non-negotiable architectural mandates | `## Constraints` | "We do not roll our own cryptography — OAuth via industry-standard libraries only." |
| **Out of Scope** | The *vision* | Declared, explicit, prose anti-vision | `## Out of Scope` | "Mobile native apps are not part of v1." |
| **Anti-criteria** | The *test surface* | Granular, testable, yes/no derived probes | `## Criteria` (with `Anti:` prefix) | "Anti: `/admin` returns 200 in v1 build." |

The first three are author-stated declarative content. **Anti-criteria are derived** — they are how Out of Scope, Constraints, and Principles become probe-able. Out of Scope says "no user accounts in v1"; the anti-criterion says "Anti: `/api/login` returns 404 in v1 build" — same idea, now testable.

At least one anti-criterion is required at every tier. Anti-criteria are not optional; their absence at OBSERVE is a hard CheckCompleteness failure.

---

## Twelve-Section Body

The ISA body has twelve sections in fixed order. Sections never appear empty; the tier completeness gate decides which are required at which effort tier. The ordering is doctrine.

| # | Section | Purpose | Written At |
|---|---------|---------|------------|
| 1 | `## Problem` | What is broken or missing right now that makes the ideal state worth pursuing | OBSERVE |
| 2 | `## Vision` | What euphoric surprise looks like — experiential intent, 1–5 sentences | OBSERVE |
| 3 | `## Out of Scope` | Anti-vision — what is *not* included in this ideal state, declared upfront in prose | OBSERVE |
| 4 | `## Principles` | Substrate-independent truths the work must respect | OBSERVE |
| 5 | `## Constraints` | Immovable architectural mandates that bound the solution space | OBSERVE |
| 6 | `## Goal` | The hard-to-vary spine — 1–3 sentences naming verifiable done | OBSERVE |
| 7 | `## Criteria` | Atomic ISCs — one binary tool probe each, including derived `Anti:` ISCs | OBSERVE → EXECUTE |
| 8 | `## Test Strategy` | Per-ISC verification approach — `isc \| type \| check \| threshold \| tool` | OBSERVE / PLAN |
| 9 | `## Features` | Work breakdown — `name \| satisfies \| depends_on \| parallelizable` | PLAN |
| 10 | `## Decisions` | Timestamped decision log including dead ends; `refined:` prefix for restructures | any phase |
| 11 | `## Changelog` | Conjecture / refuted-by / learned / criterion-now entries — Deutsch error-correction trail | LEARN |
| 12 | `## Verification` | Evidence per ISC — quoted command output, file content, screenshot path | VERIFY |

The phrase "Bitter Pill discipline" applies: empty sections are excluded entirely from the file. CheckCompleteness distinguishes `present` / `thin` / `missing` / `empty` and only `empty` is acceptable for `Verification` before VERIFY phase.

For complex applications the ISA naturally has many more ISCs because the ideal state of a complex app includes API behavior, performance budgets, security model, RBAC/visibility, auth flow, and data integrity invariants alongside the task-specific deliverables. They are not "in addition to" the ISA — they ARE the ISA. Don't invent parallel artifacts (`acceptance.yaml`, `acceptance.ts`, separate test specs) — the ISA already covers this surface.

---

## Tier Completeness Gate

The completeness gate is HARD at all tiers. It mirrors the Algorithm's thinking-floor non-relaxability rule: required sections per tier must be populated before `phase: complete` is allowed.

| Tier | Required Sections |
|------|-------------------|
| **E1** | Goal, Criteria |
| **E2** | Problem, Goal, Criteria, Test Strategy |
| **E3** | Problem, Vision, Out of Scope, Constraints, Goal, Criteria, Features, Test Strategy |
| **E4** | All twelve sections |
| **E5** | All twelve + active Interview workflow run before BUILD |

**Project ISA override:** any `<project>/ISA.md` requires E3+ structure regardless of the active task's tier. The project file is the long-lived source of truth; one transient E1 task on the project must NOT downgrade the structural minimum.

CheckCompleteness enforces the gate. A miss blocks `phase: complete` until missing sections are populated.

The ISC count also has a tier floor: at E2+ the natural granular decomposition must yield at least the floor count (E2 ≥ 16, E3 ≥ 32, E4 ≥ 128, E5 ≥ 256). At **E2/E3** the floor is soft — relaxable with show-your-math justification in `## Decisions` when the work surface is genuinely small. At **E4/E5** the floor is HARD on the count — under-decomposition is rejected and the work must keep splitting via the Splitting Test until each ISC is one binary tool probe.

---

## Six Workflows

The ISA skill at `~/.claude/skills/ISA/` owns six workflows. They map verb-in-the-request to a deterministic procedure.

| Workflow | Trigger Verbs | Purpose |
|----------|---------------|---------|
| **Scaffold** | "scaffold", "create", "generate", "new ISA from this prompt", "extract feature as ephemeral" | Generate a fresh ISA at the requested tier with all required sections populated. |
| **Interview** | "interview me", "fill in the ISA", "deepen", "ask me questions" | Adaptive Q-and-A that fills thin sections; mandatory before BUILD at E5. |
| **CheckCompleteness** | "check", "audit", "score this ISA", "is it complete?" | Score against the tier completeness gate; pass/fail + structured gap report. |
| **Reconcile** | "reconcile", "merge feature file back", "ephemeral → master" | Deterministic merge of an ephemeral feature-file excerpt back into master, keyed on stable ISC IDs. |
| **Seed** | "seed", "bootstrap from this repo", "draft an ISA from existing code" | Bootstrap a draft project ISA from a repository's README, code structure, and recent commits. |
| **Append** | "append decision", "append changelog", "append verification" | Canonical writer for the three append-only sections; refuses partial Changelog C/R/L entries. |

All six workflows share a single notification block at the top of their procedure. Append exists specifically to prevent the Deutsch C/R/L Changelog format from degrading via free-form prose creep — the four-piece structure is the format invariant and Append refuses to write a partial entry.

---

## Two Homes (Project ISAs vs Task ISAs)

The ISA has two canonical homes. The format is identical for both; the lifecycle differs.

**Project ISAs** — `<project>/ISA.md` — for any thing with persistent identity (an application, a CLI tool, a library, infrastructure, an art project, the Algorithm itself). The ISA lives in the project's repo as system of record. Tasks operating on the project read this ISA at OBSERVE, modify it during BUILD/EXECUTE, and commit refinements at LEARN. Iteration on the project IS iteration on the ISA. Project ISAs grow continuously across many tasks; they are never "completed" — they are the long-lived articulation of an evolving ideal state.

**Task ISAs** — `MEMORY/WORK/{slug}/ISA.md` — for ad-hoc work that doesn't belong to a persistent thing. One-shot tasks, system-design sessions, ephemeral investigations. Created at OBSERVE; archived at `phase: complete`.

A task ISA is the ISA *of a one-shot effort*. A project ISA is the ISA *of a thing* that the work happens against. The former is created and finished within an Algorithm run; the latter is read, extended, and committed across many runs.

---

## Ephemeral Feature Files (Ralph Loop / Maestro pattern)

When a feature is to be worked in an isolated context — Ralph Loop, Maestro, parallel coding-agent instances — Scaffold's `--ephemeral` mode produces a derived view at `MEMORY/WORK/{slug}/_ephemeral/<feature>.md` containing only the slice relevant to that feature: the Vision and Goal as read-only context, the relevant Constraints, the ISCs in the feature's `satisfies:` list with stable IDs preserved, the matching Test Strategy entries, and an empty Verification section.

A fresh-context agent operates against the ephemeral file alone. At completion, Reconcile deterministically merges ISC checkmarks, Verification evidence, Decisions entries, and any new Changelog entries back to master, then archives the ephemeral file under `_ephemeral/.archive/<feature>-<YYYY-MM-DD>.md`.

**Ephemeral files are derived views.** They are never sources of truth. They are never hand-edited as policy. The master ISA is what persists. ID-stability across edits is what makes this pattern safe — Reconcile keys on stable ISC IDs, so renumbering on edit would break ephemeral merges silently.

---

## ID Stability Rule

ISC IDs never re-number on edit. When the Splitting Test produces a finer-grained version of `ISC-7`, the original number is preserved as the parent and children become `ISC-7.1`, `ISC-7.2`, etc. When an ISC is dropped, leave a tombstone (`- [ ] ISC-N: [DROPPED — see Decisions YYYY-MM-DD]`) so historical references in Decisions, Changelog, and Verification remain valid.

This rule exists because Reconcile is keyed on ISC IDs. If IDs renumber across edits, ephemeral feature-file reconciliation breaks silently — workers' checkmarks fail to land in master, and the failure mode looks like "the worker did the work but the merge didn't take." The renumbering ban is what makes the ephemeral-feature workflow safe.

---

## Relationships to Other PAI Subsystems

The ISA is the artifact every other PAI subsystem orbits.

- **Algorithm** (`PAI/DOCUMENTATION/Algorithm/AlgorithmSystem.md`, `PAI/ALGORITHM/v6.3.0.md`) — invokes the ISA skill. OBSERVE invokes Scaffold; OBSERVE end + VERIFY invoke CheckCompleteness; PLAN may invoke ephemeral-extract; LEARN invokes Reconcile and Append. The Algorithm's seven phases are operational; the ISA is the durable artifact those phases write to.
- **Memory** (`PAI/DOCUMENTATION/Memory/MemorySystem.md`) — task ISAs live under `MEMORY/WORK/{slug}/`. The Memory subsystem provides the directory structure and the WORK→LEARNING→KNOWLEDGE compaction lifecycle. Task ISAs are archived to KNOWLEDGE when their associated learnings have been harvested.
- **Skills** (`PAI/DOCUMENTATION/Skills/SkillSystem.md`) — the ISA skill is one skill among many; it follows the same canonical form (TitleCase directory for public, `_ALLCAPS` for private; `Workflows/` + optional `Tools/` + optional `Examples/`; mandatory notification block; mandatory Gotchas section).
- **Hooks** (`PAI/DOCUMENTATION/Hooks/HookSystem.md`) — `ISASync.hook.ts` watches Edit/Write events on ISA frontmatter and syncs `phase` and `progress` to Pulse via `work.json`. `CheckpointPerISC.hook.ts` auto-commits per-ISC transitions. Hooks only read the ISA; the ISA is mutated by the AI directly via Edit/Write or via the ISA skill's workflows.
- **CreateSkill** (`~/.claude/skills/CreateSkill/SKILL.md`) — the public-skill content rule that the ISA skill itself must obey. Public skills like ISA are stranger-safe; private skills like `<your-release-skill>` carry identity-bound content.
- **Pulse** (`PAI/DOCUMENTATION/Pulse/PulseSystem.md`) — renders ISA `phase` and `progress` in real-time. The dashboard's phase widget reflects ISA frontmatter mutations as they happen.

The ISA is the gravitational center the rest of the system orbits — every task is a transition from current state to ideal state, and the ISA is what articulates the ideal state for that specific task or project.

---

## Cross-References

- **Format spec (file-shape contract):** `PAI/DOCUMENTATION/IsaFormat.md`
- **Skill (workflow implementations):** `~/.claude/skills/ISA/SKILL.md`
- **Skill canonical example:** `~/.claude/skills/ISA/Examples/canonical-isa.md`
- **Algorithm doctrine:** `PAI/ALGORITHM/v6.3.0.md` (current); `PAI/ALGORITHM/LATEST` for version pointer
- **Algorithm system doc:** `PAI/DOCUMENTATION/Algorithm/AlgorithmSystem.md`
- **Memory system doc:** `PAI/DOCUMENTATION/Memory/MemorySystem.md`
- **Skills system doc:** `PAI/DOCUMENTATION/Skills/SkillSystem.md`
- **Hooks system doc:** `PAI/DOCUMENTATION/Hooks/HookSystem.md`
- **Master architecture:** `PAI/DOCUMENTATION/PAISystemArchitecture.md`
- **Architecture summary:** `PAI/DOCUMENTATION/ARCHITECTURE_SUMMARY.md` (auto-generated)
