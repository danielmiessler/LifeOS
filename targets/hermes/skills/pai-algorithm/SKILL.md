---
name: pai-algorithm
description: "PAI v5.0 Algorithm — 7-phase execution loop (OBSERVE → THINK → PLAN → BUILD → EXECUTE → VERIFY → LEARN). USE WHEN the task requires structured problem-solving, complex work decomposition, criteria-driven verification, or multi-phase execution. NOT FOR simple Q&A, direct commands, or single-step tasks."
version: 5.0.0
author: PAI v5.0 → Hermes Port
license: MIT
metadata:
  hermes:
    tags: [pai, algorithm, lifecycle, methodology, structured-work]
    related_skills: [pai-isa, pai-telos, deep-research, plan]
---

# PAI Algorithm v6.3.0 (Hermes Port)

## Overview

The Algorithm is a 7-phase universal execution loop that drives every non-trivial task. It is modeled on the scientific method and uses David Deutsch's framing of "hard-to-vary explanations" as the standard for "good."

The Algorithm classifies every task into an effort tier (E1–E5) based on complexity, time budget, and risk. The tier determines ISA section requirements, thinking skill requirements, and verification rigor.

## Mode Classification

Before execution begins, classify the user request into one of three modes:

| Mode | When | Behavior |
|------|------|----------|
| **MINIMAL** | Simple Q&A, one-line answers, direct commands | Answer directly, no phases |
| **NATIVE** | Standard tool use, moderate complexity | Use tools directly, no Algorithm |
| **ALGORITHM** | Complex work, multi-step, criteria-driven | Full 7-phase loop below |

## The 7 Phases

```
OBSERVE → THINK → PLAN → BUILD → EXECUTE → VERIFY → LEARN
```

### Phase 1: OBSERVE
**Goal:** Understand the request completely. Reverse-engineer what "done" means.

1. Read the user's request
2. Load context from MEMORY — check WORK/ for active tasks, KNOWLEDGE/ for relevant entities, USER/ for identity
3. Classify effort tier (E1–E5)
4. Scaffold an ISA (Ideal State Artifact) — call `pai-isa` skill with `scaffold` workflow
5. Define atomic, testable ISCs (Ideal State Criteria)

**Exit criteria:** ISA exists with all ISCs for the effort tier

### Phase 2: THINK
**Goal:** Identify risks, run premortem, select thinking capabilities.

1. Select appropriate thinking capabilities from the closed list (see Thinking Capabilities below)
2. Run premortem — what could go wrong?
3. Check prerequisites — are all dependencies available?
4. Identify unknowns and risks

**Exit criteria:** Risk register populated, thinking capabilities selected

### Phase 3: PLAN
**Goal:** Design the approach. Define features with dependencies.

1. Design the implementation approach
2. Choose depth vs breadth
3. Define features with dependency ordering
4. Identify parallelizable workstreams (use `pai-delegation` if 3+ independent streams)
5. Check feasibility against constraints

**Exit criteria:** Feature breakdown with dependency graph, parallel work identified

### Phase 4: BUILD
**Goal:** Prepare artifacts, set up test harness.

1. Create or prepare artifacts
2. Invoke necessary capabilities (skills, tools)
3. Create test harness — prep the verification infrastructure

**Exit criteria:** All prerequisites ready for execution

### Phase 5: EXECUTE
**Goal:** Do the work. Execute features in dependency order.

1. Execute features in dependency order
2. Mark ISCs as they pass in the ISA
3. If a feature cannot be completed, revise the ISA and retry

**Exit criteria:** All features executed, ISCs marked as passing or failing

### Phase 6: VERIFY
**Goal:** Prove every ISC passes with concrete evidence.

1. Test every ISC with concrete evidence (command output, file content, API response)
2. Collect evidence paths in the Verification section of the ISA
3. If E4/E5: run cross-vendor audit (use a second model/provider)
4. If all ISCs pass → advance to LEARN. If not → revise ISA and return to EXECUTE

**Exit criteria:** Every ISC has pass/fail with evidence. All pass → advance. Any fail → revise.

### Phase 7: LEARN
**Goal:** Capture what worked, what didn't, and persist learning.

1. Record changelog entry in the ISA (conjecture → refuted-by → learned → criterion-now)
2. Capture satisfaction signal (what went well, what didn't)
3. Persist learnings to MEMORY/LEARNING/
4. Reconcile ephemeral files back to master ISA if applicable

**Exit criteria:** Learning recorded, changelog written, ISA finalized

## Effort Tiers

| Tier | Time Budget | Min ISCs | Required Sections | Thinking Skills | Audit |
|------|-------------|----------|-------------------|-----------------|-------|
| E1 | <90s | Any | Goal, Criteria | — | — |
| E2 | <15min | ≥16 | Problem, Goal, Criteria, Test Strategy | Optional | — |
| E3 | <60min | ≥32 | 8 core sections | Required | — |
| E4 | <2h | ≥128 | All 12 sections | Required | Cross-vendor |
| E5 | <2h+ | ≥256 | All 12 + Interview before BUILD | Required | Cross-vendor |

## Thinking Capabilities (Closed List)

When in THINK phase, select from these 19 named capabilities:

| Capability | When to Use |
|------------|-------------|
| **IterativeDepth** | Need multi-angle exploration of a problem |
| **ApertureOscillation** | Need to switch between tactical and strategic views |
| **FirstPrinciples** | Need to decompose to irreducible truths |
| **SystemsThinking** | Need structural/causal loop analysis |
| **RootCauseAnalysis** | Investigating a failure or incident |
| **Council** | Need multi-agent collaborative debate |
| **RedTeam** | Need adversarial stress-testing of an approach |
| **Science** | Need scientific method (hypothesis → experiment → measure) |
| **BeCreative** | Need divergent ideation |
| **Ideate** | Need evolutionary idea generation |
| **BitterPillEngineering** | Auditing whether instructions over-prompt |
| **Evals** | Need evaluation framework design |
| **WorldThreatModel** | Need long-horizon risk assessment |
| **ContextSearch** | Need cold-start context recovery |
| **ISA** | Need to scaffold or verify an ISA |
| **Advisor** | Need expert consultation |
| **ReReadCheck** | Need to re-read before acting |
| **FeedbackMemoryConsult** | Need to check past feedback |

## Workflow Routing

| Trigger | Workflow |
|---------|----------|
| "run algorithm" | Full 7-phase algorithm |
| "classify" | Mode classification only |
| "scaffold" | OBSERVE only (produce ISA) |
| "verify iscs" | VERIFY only (test all ISCs) |
| "learn phase" | LEARN only (capture learning) |
| "effort tier" | Classify effort tier only |

## Execution Log

After every Algorithm invocation, append to the execution log:

```
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"pai-algorithm","mode":"CLASSIFIED_MODE","effort":"E1-E5","phase":"CURRENT_PHASE","status":"ok|error","duration_s":SECONDS}' >> ~/.hermes/profiles/dev/pai/MEMORY/SKILLS/execution.jsonl
```

## Gotchas

- **Algorithm is NOT for everything.** Use MINIMAL for simple Q&A, NATIVE for standard work. Only invoke the full Algorithm for complex, multi-step tasks.
- **Mode classification must happen before any execution work.** Do not start building before classifying.
- **Phases are sequential.** Do not skip phases. Do not reorder them. Each phase has entry and exit criteria.
- **ISA is the single source of truth.** If you don't have an ISA, you're not running the Algorithm.
- **E4/E5 require cross-vendor audit.** Always use a second model/provider for audit at these tiers. If no second provider is available, flag the limitation.
- **LEARN phase is not optional.** Even if things went badly, capture what was learned. It compounds over time.
- **ISC IDs are immutable.** Never renumber ISCs. Split creates children (ISC-7 → ISC-7.1, ISC-7.2). Dropped ISCs get tombstones.
- **Anti-ISC required.** Every ISA must have at least one Anti-criterion (a test that PROVES the task is NOT done).
