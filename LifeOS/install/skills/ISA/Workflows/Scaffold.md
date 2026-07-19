# Scaffold Workflow

Generate a fresh ISA from a prompt at a specified effort tier. The output is a populated ISA file at the canonical location with all required sections per tier.

## When to invoke

- The Algorithm at OBSERVE: `Skill("ISA", "scaffold from prompt: <user message> at tier <tier>")`
- User directly: `Skill("ISA", "scaffold from prompt: <prompt>")` — defaults tier to E3 if unspecified
- Ephemeral feature mode: `Skill("ISA", "extract feature <name> as ephemeral file from <master-isa-path>")`

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| prompt | yes | The user's request — verbatim or distilled |
| tier | yes | E1 / E2 / E3 / E4 / E5 |
| project | no | If task targets a known project from PROJECTS.md, the project ISA path is used; otherwise a task ISA at `MEMORY/WORK/{slug}/ISA.md` |
| ephemeral_feature | no | If set, scaffold a feature-file excerpt instead of a full ISA |

## Output

A markdown file at one of:
- `<project-root>/ISA.md` — when `project` is supplied (existing project ISA is read-extended, not overwritten)
- `{{LIFEOS_DIR}}/MEMORY/WORK/{slug}/ISA.md` — when no project (slug = `YYYYMMDD-HHMMSS_kebab-task-description`)
- `{{LIFEOS_DIR}}/MEMORY/WORK/{slug}/_ephemeral/<feature>.md` — when `ephemeral_feature` is set

## Procedure

### Step 1 — Voice notification

```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the Scaffold workflow in the ISA skill"}' \
  > /dev/null 2>&1 &
```

### Step 2 — Pick the canonical template

Always start by reading `{{LIFEOS_ROOT}}/skills/ISA/Examples/canonical-isa.md` for section headers and tone. For E1 reference, read `e1-minimal.md`. For E5 reference, read `e5-enterprise.md`.

### Step 3 — Preserve principal-stated goal, then derive (Algorithm v7.0.0 R1)

**The canonical rule:** Step 3 must populate `principal_stated_goal` (frontmatter) AND the first quoted sentence of `## Goal` verbatim — both from the same byte-for-byte literal — BEFORE producing any derived section. Derivation (Out of Scope, Constraints, Principles, distilled Goal continuation, ISCs) follows the preservation, anchored to it. If detection does not fire, the preservation step is a no-op and derivation proceeds as today.

#### Step 3a — Detect and preserve the literal goal

Run the four-signal detector on the prompt:

| # | Signal | Pattern | Examples |
|---|--------|---------|----------|
| 1 | **Named metric + threshold** | quantitative target | "get p95 latency under 200ms" · "grow LinkedIn to 70k" · "open rate above 35%" |
| 2 | **Explicit outcome assertion** | "I want X" / "achieve X" / "do this" | "I want Pulse showing all four time horizons" |
| 3 | **Completion condition** | "until X" / "such that X" | "refactor until tests pass" · "ship such that Cato returns no critical findings" |
| 4 | **Structural/design directive** | explicit verb-object on the system | "design how ISA absorbs Codex /goal semantics" · "unify three skills into one" |

**Fail-closed minimum-content rule:** if a candidate literal is under 6 tokens OR contains no propositional content ("make it good", "do better", "refactor this"), set `principal_stated_goal: null` and log the candidate to a Decisions row. Better silent than anchoring against useless text.

**Multi-literal:** if multiple candidates ("do X and Y by Z"), **first wins as `principal_stated_goal:`**; others demote to derived Constraints with `derived_from: principal_stated_goal compound` annotation.

**Classifier handshake:** `TheRouter.hook.ts` may emit `GOAL_SIGNAL: <1|2|3|4|none>` in additionalContext. Trust as hint, re-validate via the detector above.

When detection fires + min-content passes, write the four frontmatter fields:

```yaml
principal_stated_goal: "the verbatim user quote, byte-for-byte"
principal_stated_goal_source: prompt   # prompt | conversation | explicit-revision
principal_stated_goal_signal: <1-4>
principal_stated_goal_locked: <ISO-8601>
```

Copy the verbatim quote into `## Goal` as the first sentence, in quotes, before any derived prose.

#### Step 3b — Derive the residue

Distill what remains:
- Explicit wants beyond the literal (these become Vision + derived Goal prose)
- Explicit not-wants (these become Out of Scope)
- Implied not-wants (industry/context inference — these become Out of Scope)
- Constraints implied by the domain (these become Constraints)
- Principles implied by the user's TELOS (responsiveness, information density, operator-first, etc. — these become Principles)

**The key inversion:** today's distillation runs first and loses the literal. The new rule preserves first, derives second — and derived content is anchored to the preserved literal via the `anchors_to` column in Test Strategy.

### Step 3.5 — Ambiguity check (Algorithm v7.0.0 R3)

One rule, replacing the deleted v6.x density-formula machinery: **could I be wrong about what done means?**

If materially ambiguous — the goal supports ≥2 interpretations leading to materially different builds, or required content can't be scaffolded without speculation — ask up to 3 targeted questions (E3+) or prepend the ambiguity flag (E1/E2): `⚠️ Picking X over Y because R; redirect if wrong.` Literal whole-response `proceed` accepts reasoned defaults.

**Skip conditions (do not run the check):**
- `INTERVIEW_ELIGIBLE: false` in the most recent `TheRouter.hook.ts` additionalContext block (the hook decided this is fast-path work). Line absent — e.g. a continuation prompt where the hook didn't re-fire — → infer eligibility from the running tier: `true` iff tier ≥ E3. This handoff is explicit text-passing; no shared state, no subprocess IPC. The model is the carrier.
- The scaffold call has `ephemeral_feature` set (ephemeral mode operates on an already-scaffolded master).

**Record the outcome in frontmatter** — `context_sufficient: true|false` and `interview_invoked: true|false` (the only two keys v7 ISAs carry for this check; the v6.x density/divergence/acknowledgment ceremony keys are deleted).

**Re-check later:** when late-surfacing information — a premortem result, a mid-build discovery — would have changed the Goal, Vision, or Out of Scope had it been known at scaffold time, re-run the one rule and log a Decisions row naming the shift. Never blocks a phase transition.

#### Interview mechanics (when questions fire)

Emit ONE message to the user before scaffolding any sections beyond Goal:

```
I have N questions before I scaffold this. The goal is clear on X but underdetermined on Y. Say `proceed` to scaffold on reasoned defaults; otherwise answer one at a time:

1. <Q1 — chosen from the bounded shape library>
2. <Q2>
3. <Q3>
```

**Q-shape library (use 1-3 in priority order based on which sections are thinnest):**

| Thinnest section | Bounded question shape |
|---|---|
| Vision / Goal | "When this is done, what does the user feel? What would make them rate it 9-10?" |
| Out of Scope | "What would be tempting to add but distract from the core?" |
| Constraints | "What architectural mandates or things-that-must-not-change bound this work?" |
| Test Strategy | "How will you verify it worked? What probe or check would prove the goal landed?" |
| Goal (sparse) | "In one sentence, what's the smallest version of this that still counts as done?" |
| Features | "What are the major work units? What can run in parallel vs sequential?" |
| Principles | "What truths must this work respect regardless of how it's built?" |

Maximum 3 questions per fire. Each is one-question-per-turn; write answers back into the ISA before asking the next — the document fills as the principal answers. Stop early when the signal stops (two contentless answers in a row) or the principal says done.

#### `proceed` semantics

The literal override is `proceed` — **whole-response match only**, trim + lowercase: `response.trim().toLowerCase() === 'proceed'`. Substring matches ("I want to proceed with X") are NOT the override and route to question-1's answer.

#### Logging the outcome (in ISA frontmatter)

```yaml
context_sufficient: true    # false when ambiguity was flagged or `proceed` accepted reasoned defaults
interview_invoked: false    # true when targeted questions were actually asked
```

| Path | `context_sufficient` | `interview_invoked` |
|---|---|---|
| No material ambiguity found | true | false |
| Questions asked, principal answered them | true | true |
| Questions asked, principal said `proceed` | false | true |
| E1/E2 ambiguity flag prepended | false | false |

When the principal invokes `proceed` after seeing the questions:
1. Append a Decisions row: `YYYY-MM-DD HH:MM: ambiguity check fired, principal invoked proceed — reasoned defaults: <named defaults>`
2. Set frontmatter `context_sufficient: false`.
3. VERIFY surfaces the accepted defaults in `## Verification` as a known risk rather than a surprise.

### Step 4 — Write frontmatter

```yaml
---
task: "8 word task description"
slug: YYYYMMDD-HHMMSS_kebab-description
project: <name>            # only when targeting a known project
effort: <tier>
effort_source: <auto|explicit|gate-floor>
phase: observe
progress: 0/<isc-count>
mode: interactive
started: <ISO-8601>
updated: <ISO-8601>
# R1 — only when goal-signal detection fired + min-content rule passed
principal_stated_goal: "verbatim quote"
principal_stated_goal_source: prompt
principal_stated_goal_signal: 2
principal_stated_goal_locked: <ISO-8601>
# R3 — outcome of the ambiguity check (Step 3.5); the only two keys v7 ISAs carry for it
context_sufficient: true
interview_invoked: false
---
```

### Step 5 — Write required sections per tier

| Tier | Required Sections |
|------|-------------------|
| E1 | Goal, Criteria |
| E2 | Problem, Goal, Criteria, Test Strategy |
| E3 | Problem, Vision, Out of Scope, Constraints, Goal, Criteria, Features, Test Strategy |
| E4 | All fourteen sections (empty sections never appear — Dependencies/Bridge Criteria only when cross-ISA links exist) |
| E5 | All fourteen sections (same conditional rule) + run Interview workflow before BUILD |

**Project ISA override:** if `<project>/ISA.md` is the target, require E3+ sections regardless of the active task's tier.

### Step 6 — Apply the Splitting Test to every ISC

Each ISC must satisfy the granularity rule: one binary tool probe per criterion.

| Test | Split when... |
|------|--------------|
| "And"/"With" | Joins two verifiable things |
| Independent failure | Part A can pass while B fails |
| Scope words | "all", "every", "complete" → enumerate |
| Domain boundary | Crosses UI/API/data/logic → one per boundary |
| **No nameable probe** | You can't say which tool would verify it |

### Step 7 — Anti-criteria reminder

Before finishing, ask: **what must NOT happen?** At least one `Anti:` ISC is required. Anti-criteria typically derive from the Out of Scope section + regression-prevention concerns.

### Step 8 — Antecedent (when goal is experiential)

If the goal is experiential — art, design, content, anything that has to "land" — at least one `Antecedent:` ISC is required. The antecedent names a precondition that reliably produces the target experience.

### Step 9 — Run CheckCompleteness

Before returning, invoke `Workflows/CheckCompleteness.md` against the new ISA at the requested tier. If any required section is missing, fill it before declaring the scaffold complete.

### Step 10 — Return the path

Output the absolute path of the created ISA file. Algorithm OBSERVE consumes this path.

## Ephemeral feature mode

When `ephemeral_feature` is set:

1. Read the master ISA at `master_isa_path`.
2. Locate the feature in `## Features` matching `name == ephemeral_feature`.
3. Extract:
   - `## Vision` and `## Goal` from master (read-only context)
   - `## Constraints` filtered to those relevant to this feature
   - `## Criteria` ISCs whose IDs appear in the feature's `satisfies:` list, with stable IDs preserved
   - `## Test Strategy` entries matching those ISCs
   - `## Decisions` filtered to entries mentioning this feature's ISC IDs (optional)
   - Empty `## Verification` section ready to populate
4. Write to `MEMORY/WORK/{slug}/_ephemeral/<feature>.md`.
5. Add a header comment: `<!-- EPHEMERAL FEATURE FILE — derived from <master-isa-path>. Reconcile via Skill("ISA", "reconcile <this-path> → <master-path>"). Do not hand-edit master from this file. -->`

## Failure modes

- **Tier mismatch:** caller asks for E1 sections but request is clearly E4 work. Surface the mismatch; let the Algorithm decide the correct tier.
- **Missing required section:** CheckCompleteness blocks the return until filled.
- **Coverage gap (v7.0.0 — replaces the deleted numeric count floors):** every subsystem named in Vision/Goal has a container criterion decomposed until each leaf is one binary tool probe; never split to hit a number. A subsystem with no container criterion is the failure — either decompose it or document the deliberate omission in `## Decisions`.
- **ID collision in ephemeral mode:** if the feature's ISC IDs don't exist in master, abort and surface the inconsistency — this is a master-ISA error, not a Scaffold error.
