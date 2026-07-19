---
name: ISA
version: 1.0.13
description: "Owns the Ideal State Artifact — the primitive holding a project or task's articulated ideal state; scaffolds, interviews, scores completeness, reconciles feature excerpts to master, seeds from a repo, and appends decisions/changelog/verification across a locked fourteen-section order. USE WHEN ISA, ISC, ideal state, ideal state criteria, project specification, hill-climb, articulating done. NOT FOR creating new skills (use CreateSkill)."
effort: medium
---

## 🚨 MANDATORY: Voice Notification (REQUIRED BEFORE ANY ACTION)

**You MUST send this notification BEFORE doing anything else when this skill is invoked.**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:31337/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the WORKFLOWNAME workflow in the ISA skill"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running the **WorkflowName** workflow in the **ISA** skill to ACTION...
   ```

**This is not optional. Execute this curl command immediately upon skill invocation.**

# ISA — Ideal State Artifact

## What It Does

The ISA is the single document that articulates "done" for any thing whose ideal state we are pursuing — a project, an application, a library, infrastructure, a work session, an art piece, a strategic decision. It serves five identities at once: ideal state articulation, test harness, build verification, done condition, system of record. This skill owns the canonical template, the workflows that generate and refine ISAs, and the example library.

## The Problem

Most work starts without a written, testable definition of what finished looks like, so "done" drifts — the goal in your head at the start isn't the goal you settle for at the end, and there's no record of which one was right. Criteria stay vague enough that anything passes, decisions and dead ends get forgotten and re-litigated, and when work spans multiple sessions or multiple agents there's no shared source of truth for what's been verified. The ISA fixes "done" as a hard-to-vary explanation with atomic, probe-able criteria, a stable-ID structure that survives edits, and an audit trail of what was conjectured, refuted, and learned.

## How It Works

The ISA is a single document with a locked fourteen-section body. A tier completeness gate decides which sections are required at which effort level, and five workflows generate, deepen, score, and reconcile the artifact across sessions and agents.

---

## The Fourteen-Section Body (locked; spec v2.13.0, Algorithm v7.0.0)

Every ISA may have up to fourteen body sections. The tier completeness gate decides which are required at which effort tier; sections never appear empty. **Order is fixed**.

| # | Section | Purpose | Written At |
|---|---------|---------|------------|
| 1 | `## Problem` | What is broken or missing right now that makes the ideal state worth pursuing | OBSERVE |
| 2 | `## Vision` | What euphoric surprise looks like — experiential intent, 1–5 sentences | OBSERVE |
| 3 | `## Out of Scope` | Anti-vision — what is *not* included in this ideal state, declared upfront in prose | OBSERVE |
| 4 | `## Principles` | Substrate-independent truths (Deutsch reach) the work must respect | OBSERVE |
| 5 | `## Constraints` | Immovable architectural mandates that bound the solution space | OBSERVE |
| 6 | `## Dependencies` | Cross-ISA needs, one machine-readable `requires: <slug> — <contract>` line each — only when the ISA participates in a hierarchy | OBSERVE |
| 7 | `## Goal` | The hard-to-vary spine — 1–3 sentences naming verifiable done | OBSERVE |
| 8 | `## Criteria` | Atomic ISCs (Ideal State Criteria) — one binary tool probe each, including derived `Anti:` ISCs | OBSERVE → EXECUTE |
| 9 | `## Bridge Criteria` | Cross-ISA integration ISCs (`Bridge:` prefix) verified across the seam as a distinct VERIFY pass — only when the ISA has siblings | OBSERVE → EXECUTE |
| 10 | `## Test Strategy` | Per-ISC verification approach — `isc | type | check | threshold | tool | anchors_to` | OBSERVE/PLAN |
| 11 | `## Features` | Work breakdown — `name | description | satisfies: [ISC-N…] | depends_on: [feature…] | parallelizable: bool` | PLAN |
| 12 | `## Decisions` | Timestamped decision log including dead ends; `refined:` prefix for Goal/ISC restructures | any phase |
| 13 | `## Changelog` | Conjecture / refuted-by / learned / criterion-now entries — Deutsch error-correction trail | LEARN |
| 14 | `## Verification` | Evidence that each ISC passed — quoted command output, file content, screenshot path | VERIFY |

`## Dependencies` and `## Bridge Criteria` are **conditional-required**: mandatory when the ISA has any `parent:`/`children:`/cross-ISA relationship, omitted (like any empty section) for a standalone single-ISA task. Multi-ISA trees are rare (<4% of archived ISAs) — full mechanics in `LIFEOS/DOCUMENTATION/Isa/IsaHierarchy.md`.

---

## Three-Guardrail Taxonomy (Principles vs Constraints vs Anti-criteria)

Adjacent concepts. Distinguished by **who they bind**.

| Guardrail | Binds | Tone | Example | Lives In |
|-----------|-------|------|---------|----------|
| **Principles** | The *thinking* | Aspirational, generalizable | "User-facing systems prioritize responsiveness." | `## Principles` |
| **Constraints** | The *solution space* | Immovable, non-negotiable | "We do not roll our own cryptography — OAuth via industry-standard libraries only." | `## Constraints` |
| **Out of Scope** | The *vision* | Declared, explicit, prose | "Mobile native apps are not part of v1." | `## Out of Scope` |
| **Anti-criteria** | The *test surface* | Granular, testable, yes/no | "Anti: /admin returns 200 in v1 build." | `## Criteria` (with `Anti:` prefix) |

The first three are author-stated (declarative). Anti-criteria are derived — they are how Out of Scope, Constraints, and Principles become probe-able.

---

## Tier Completeness Gate (HARD at all tiers)

Quality gates, not section counts (Algorithm v7.0.0 R2) — sections exist because content exists. Required per tier:

| Tier | Required Sections |
|------|-------------------|
| **E1** | Goal, Criteria |
| **E2** | Problem, Goal, Criteria, Test Strategy |
| **E3** | Problem, Vision, Out of Scope, Constraints, Goal, Criteria, Features, Test Strategy |
| **E4** | All fourteen sections (empty sections never appear — Dependencies/Bridge Criteria only when cross-ISA links exist) |
| **E5** | All fourteen (same conditional rule) + active Interview workflow run before BUILD |

**Project ISA override:** any `<project>/ISA.md` requires E3+ structure regardless of the active task's tier. The project file is the long-lived source of truth; one transient E1 task must not downgrade it.

`CheckCompleteness` workflow enforces this gate. A miss blocks `phase: complete` until the missing sections are filled in.

---

## Workflow Routing

Match the verb in the request to a workflow. When ambiguous, default to Scaffold for new ISAs and CheckCompleteness for audits.

| Verb / Intent | Workflow | File |
|---------------|----------|------|
| "scaffold", "create", "generate", "new ISA from this prompt", "extract feature as ephemeral" | **Scaffold** | `Workflows/Scaffold.md` |
| "interview me", "fill in the ISA", "deepen", "ask me questions" | **Interview** | `Workflows/Interview.md` |
| "check", "audit", "score this ISA", "is it complete?" | **CheckCompleteness** | `Workflows/CheckCompleteness.md` |
| "reconcile", "merge feature file back", "ephemeral → master" | **Reconcile** | `Workflows/Reconcile.md` |
| "seed", "bootstrap from this repo", "draft an ISA from existing code" | **Seed** | `Workflows/Seed.md` |
| "append decision", "append changelog", "append verification", "record C/R/L entry" | **Append** | `Workflows/Append.md` |

**When executing a workflow, output this notification directly:**

```
Running the **WorkflowName** workflow in the **ISA** skill to ACTION...
```

---

## Gotchas

The highest-information-density part of this skill. Each entry captures a non-obvious failure mode that has bitten real ISA work.

- **ID-stability is the cornerstone of Reconcile — never re-number on edit.** When the Splitting Test produces a finer-grained version of `ISC-7`, preserve `ISC-7` as the parent and add `ISC-7.1`, `ISC-7.2`, etc. Even when an ISC is dropped, leave a tombstone (`- [ ] ISC-N: [DROPPED — see Decisions YYYY-MM-DD]`). Reconcile keys on stable IDs; renumbering breaks ephemeral feature-file merges silently and the failure mode looks like "the worker's checkmarks didn't land in master."
- **Ephemeral files are derived views, never sources of truth.** Scaffold's `--ephemeral` mode produces a slice of the master ISA at `MEMORY/WORK/{slug}/_ephemeral/<feature>.md`. Workers operate against that slice; Reconcile merges back. Hand-editing master content from an ephemeral file is policy-forbidden — the master is what persists; the ephemeral is what gets archived.
- **The Changelog format is non-negotiable.** Every entry needs all four pieces (`conjectured`, `refuted by`, `learned`, `criterion now`) in that order. Append refuses to write a partial C/R/L; if any of the four is missing, the entry is a Decision, not a Changelog. The format is what makes the Deutsch error-correction trail auditable across sessions.
- **Project ISAs upgrade tier to `max(declared, E3)` regardless of the active task's tier.** A `<project>/ISA.md` is the long-lived system of record for a thing with persistent identity. One transient E1 task on the project must NOT downgrade the structural minimum. CheckCompleteness applies this override automatically.
- **Empty sections never appear.** The fourteen-section body is a *capacity*, not a *requirement* at every tier. Sections required-but-empty for the tier are populated; sections not required and not yet written are simply absent from the file. CheckCompleteness distinguishes `present` / `missing` / `empty` and only `empty` is acceptable for `Verification` before VERIFY phase — section length is never graded; a one-sentence section can be exactly right.
- **Anti-criteria are derived from Out of Scope plus regression-prevention concerns.** They are how the prose-guardrails (Out of Scope, Constraints, Principles) become probe-able. At least one is required at every tier; the absence of an anti-criterion at OBSERVE is a hard CheckCompleteness failure.
- **Antecedents are required when the goal is experiential.** For art, design, content, and anything that has to "land," at least one ISC must use the `Antecedent:` prefix to name a precondition that reliably produces the target experience. Verifiable goals (build, deploy, schema) don't need antecedents; experiential goals always do.
- **Reconcile is deterministic — there are no conflicts to resolve.** Either an ISC ID exists in master (mechanical merge) or it doesn't (abort with ID-stability violation). If the ephemeral made structural changes (split ISC-7 into ISC-7.1/ISC-7.2), those structural changes belong in master via a separate Edit by the user *before* Reconcile runs.
- **The format spec wins on contradiction.** `IsaFormat.md` is the file-shape contract. If this skill's prose ever drifts from the format spec, the spec is canonical and the skill updates to match — not the reverse.
- **Features are vertical slices, not horizontal layers.** Each `## Features` entry cuts end-to-end to a verifiable increment satisfying ≥1 ISC — not "the data layer" then "the API layer." A Feature you can't independently verify on its own is a horizontal slice; re-slice it vertically. This is a rule about the *shape of the decomposition* (the artifact), not about how to write code — it exists so every Feature produces a testable increment. (Pocock's tracer-bullet / vertical-slice principle, folded into Features where it belongs.)
- **Prefer test-first probes (red-before-build).** Where an ISC's probe is a *runnable* test (`bun-test`/`bun-property`/`bash`/`curl`/`SELECT`), write it so it FAILS before EXECUTE and passes after — the probe exists and is red before the build, green after. Probes that can only be a screenshot or manual check are exempt. This tightens the existing Inline-Verification Mandate from "name the probe" to "run the probe red first," and it is a rule about *when the probe is written/run* (the process), NOT a coding-craft instruction telling a capable model how to do TDD. (The structural kernel of Pocock's `tdd`, folded into the ISC layer; the red/green/refactor *mechanics* are deliberately NOT encoded — a competent coder does those unprompted.)

---

## Examples

The `Examples/` directory holds reference ISAs spanning the tier (E1–E5) × domain (code / art / design / ops / marketplace / enterprise) matrix. (Authored pre-v6.25.0, so they omit Dependencies and Bridge Criteria and may show retired frontmatter keys; they are historical — the fourteen-section order above wins on shape.) Always start by reading the canonical showpiece before scaffolding a new ISA — copy its section headers, then populate. Pick the example closest to your domain + scale as a template.

**Showpiece**

| File | Purpose |
|------|---------|
| `Examples/canonical-isa.md` | **BeanLine** — peer-to-peer specialty-coffee marketplace. The showpiece reference, fully populated across every section with real-feeling Decisions and a four-piece C/R/L Changelog. Read this first. |

**Code**

| File | Tier | Purpose |
|------|------|---------|
| `Examples/e1-minimal.md` | E1 | Add a `--no-color` flag to a CLI tool. <90s task, Goal + 4 ISCs only. Demonstrates the fast-path floor. |
| `Examples/e2-backup-verify.md` | E2 | Add SHA-256 verification to a backup CLI's `--verify` mode. Single-domain, 18 ISCs. |
| `Examples/e3-project.md` | E3 | Build an arxiv metadata extractor CLI. Mid-size project, 12 ISCs, eight sections. |
| `Examples/e4-api-migration.md` | E4 | Migrate a public API from REST to GraphQL with 6-month backwards-compat. Cross-cutting, 73 ISCs, every section populated. |
| `Examples/e5-desktop-app.md` | E5 | **WattWatch** — open-source desktop app for personal home-energy monitoring. Single-user app pattern, 50 ISCs, populated Changelog. |

**Art (experiential — antecedents required)**

| File | Tier | Purpose |
|------|------|---------|
| `Examples/e3-essay.md` | E3 | Write a 1500-word essay on a specific thesis. Experiential goal, antecedent ISCs, post-publish reception probes. |
| `Examples/e5-album.md` | E5 | **Mariner Frequencies** — produce a 12-track instrumental album over 6 months. Long-form experiential, multi-act Changelog. |

**Design (experiential)**

| File | Tier | Purpose |
|------|------|---------|
| `Examples/e3-help-redesign.md` | E3 | Redesign a CLI tool's `--help` output for first-encounter clarity. Antecedents + usability tests. |
| `Examples/e4-brand-identity.md` | E4 | **Cardinal** — brand identity for a small fintech startup (logo + type + color + voice + first 5 marketing surfaces). 56 ISCs, 6 antecedents. |

**Ops**

| File | Tier | Purpose |
|------|------|---------|
| `Examples/e2-rotate-credential.md` | E2 | Rotate a production deploy credential in CI. Demonstrates the ISA primitive applied to ops/runbook work. 16 ISCs. |

**Enterprise**

| File | Tier | Purpose |
|------|------|---------|
| `Examples/e5-enterprise.md` | E5 | **Beacon Health Alliance** — multi-region HIPAA-compliant patient portal for a 50-hospital network. Compliance anti-criteria, multi-team parallelizable features, 68 ISCs, every section populated. The E5 reference Scaffold reads. |

---

## ID Stability Rule

**ISC IDs never re-number on edit.** When the Splitting Test produces a finer-grained version of `ISC-7`, the original number is preserved as the parent and children become `ISC-7.1`, `ISC-7.2`, etc. Do not collapse the numbering even if the ISC is dropped — leave a tombstone marker so historical references in Decisions, Changelog, and Verification remain valid.

This rule exists because `Reconcile` is keyed on ISC IDs. If IDs renumber across edits, ephemeral feature-file reconciliation breaks silently. The renumbering ban is what makes feature-file workflows safe.

---

## Ephemeral Feature Files (Ralph Loop / Maestro pattern)

When a feature is to be worked in an isolated context (Ralph Loop, Maestro, parallel coding-agent instances), the Algorithm invokes:

```
Skill("ISA", "extract feature <name> as ephemeral file")
```

`Scaffold` (with `--ephemeral` mode) produces a derived view at `MEMORY/WORK/{slug}/_ephemeral/<feature>.md` containing only the slice relevant to that feature: the Vision and Goal as read-only context, the relevant Constraints, the ISCs in the feature's `satisfies:` list with stable IDs, the matching Test Strategy entries, and an empty Verification section.

A fresh-context agent operates against the ephemeral file alone. At completion, `Reconcile` deterministically merges ISC checkmarks, Verification evidence, Decisions entries, and any new Changelog entries back to master, then archives the ephemeral file under `_ephemeral/.archive/`.

**Ephemeral files are derived views. They are never sources of truth. They are never hand-edited as policy. The master ISA is what persists.**

---

## Relationship to the Algorithm

The Algorithm at OBSERVE invokes this skill to scaffold or read an ISA. The skill does not run the Algorithm — it owns the artifact the Algorithm operates on.

- OBSERVE: `Skill("ISA", "scaffold from prompt at tier T")` → returns populated ISA at canonical location.
- OBSERVE: `Skill("ISA", "check completeness of <path> at tier T")` → pass/fail + gap report.
- PLAN: `Skill("ISA", "extract feature <name> as ephemeral file")` → ephemeral excerpt.
- LEARN: `Skill("ISA", "reconcile <ephemeral-path> → <master-path>")` → deterministic merge.

The Algorithm doctrine spec at `{{LIFEOS_DIR}}/ALGORITHM/v7.0.0.md` (or LATEST) governs invocation cadence. This skill is invocation-agnostic — it works the same whether called by the Algorithm or directly by the user.

---

## Format spec cross-reference

The full ISA format spec lives at `{{LIFEOS_DIR}}/DOCUMENTATION/Isa/IsaFormat.md`. This skill implements that spec; if there is ever a contradiction, the format spec wins and this skill is updated to match.

The system-architecture doc — five identities, three-guardrail taxonomy, fourteen-section body, six workflows, two homes, subsystem relationships — lives at `{{LIFEOS_DIR}}/DOCUMENTATION/Isa/IsaSystem.md`. Read that for the conceptual frame; read this file (and `IsaFormat.md`) for the operational contract.
