---
name: pai-first-principles
description: "Physics-based reasoning: DECONSTRUCT to irreducible truths -> CHALLENGE each assumption -> RECONSTRUCT from fundamentals. Constraint classification (hard/soft/assumption). Musk methodology: strip away analogy until only fundamental truths remain. USE WHEN the problem benefits from first-principles decomposition — breaking down assumptions to their irreducible elements and rebuilding from fundamentals. NOT FOR tasks with well-known solutions, problems where analogy is sufficient, or situations requiring quick answers."
version: 5.0.0
author: PAI v5.0 → Hermes Port
license: MIT
metadata:
  hermes:
    tags: [pai, thinking, first-principles, reasoning, decomposition, constraints]
    related_skills: [pai-systems-thinking, pai-pai-root-cause-analysis, pai-red-team]
---

<!-- Voice notification — fire-and-forget on invocation -->
```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the pai-first-principles skill"}' \
  > /dev/null 2>&1 &
```


# First Principles Thinking

## Overview

Reason from foundational truths rather than analogy. Strip away all assumptions until only irreducible facts remain, then rebuild the solution from those facts. Particularly effective for innovation problems where existing approaches are suboptimal.

**Core pattern:** DECONSTRUCT → CHALLENGE → RECONSTRUCT

## When to Use

| Signal | Example |
|--------|---------|
| Existing solutions are expensive/complex | "Why does X cost so much?" |
| Analogy-based reasoning keeps failing | "We've always done it this way" |
| Need breakthrough, not incremental | "What if we ignored all existing products?" |
| Problem feels "stuck" | Same approaches keep producing same results |
| Constraint-heavy domain | Regulatory, physics, resource-bound problems |

## Routing Table

| Input Pattern | Route |
|---------------|-------|
| "Break this down from first principles" | Full DECONSTRUCT → CHALLENGE → RECONSTRUCT |
| "What assumptions am I making?" | CHALLENGE phase only |
| "Is this constraint real?" | Constraint Classification workflow |
| "Rebuild this from scratch" | RECONSTRUCT phase only |
| "Why does this cost so much?" | DECONSTRUCT (cost decomposition) |

## Core Methodology: 3-Phase Process

### Phase 1: DECONSTRUCT

**Goal:** Identify all components, assumptions, and constraints. Separate what is known from what is believed.

**Procedure:**

1. **List all components** — Break the system/problem into atomic parts
   ```
   Use read_file or web_search to gather current understanding
   List every component, process, rule, and dependency
   ```

2. **Identify assumptions** — For each component, ask: "What must be true for this to work?"
   ```
   Run through each component and surface hidden assumptions
   Look for "we assume X because we've always done it that way"
   ```

3. **Classify constraints** — For each component/assumption:
   - **HARD** — Physical law, mathematical limit, immutable regulation (cannot be changed)
   - **SOFT** — Cost, time, skill, resource availability (can be changed with effort)
   - **ASSUMPTION** — "Everyone knows X" statements, design choices, conventions (may be false)

4. **Map dependencies** — Which constraints depend on which assumptions?
   ```
   terminal: write dependency map to file
   delegate_task: parallel analysis of each major component
   ```

**Output:** Deconstructed component list with constraint classifications.

### Phase 2: CHALLENGE

**Goal:** Systematically attack every assumption and soft constraint. Determine what is genuinely irreducible.

**Procedure:**

1. **Challenge each ASSUMPTION:**
   - What if this is false?
   - Who says this has to be this way?
   - What would happen if we removed this entirely?
   - Is this a law of physics or a law of man?

2. **Challenge each SOFT constraint:**
   - What would it cost to remove this?
   - What if we had unlimited resources?
   - What if the timeline were 10x longer/shorter?
   - What if we changed the constraint instead of working around it?

3. **Verify each HARD constraint:**
   - Is this truly immutable? Check via `web_search`
   - Could a different framing bypass this?
   - Are there precedents where this was thought hard but wasn't?

4. **Identify knowledge gaps:**
   ```
   Use web_search to verify factual claims
   Use delegate_task to research specific constraint questions
   ```

**Output:** Validated constraint set — hardened truths vs. debunked assumptions.

### Phase 3: RECONSTRUCT

**Goal:** Build a new solution from the irreducible truths only.

**Procedure:**

1. **List irreducible truths** — Only what survived CHALLENGE phase
2. **Identify degrees of freedom** — What can we now change?
3. **Generate solution paths** from first principles:
   - What does a minimal viable solution look like?
   - What does an ideal solution look like (no soft constraints)?
   - What's the most elegant solution given only hard constraints?
4. **Test against reality** — Does the solution violate any hard constraint?
5. **Compare to existing solutions** — Why didn't existing approaches do this?

**Output:** Reconstructed solution with traceability back to first principles.

## Constraint Classification Workflow

### Step-by-step

```
1. List every constraint mentioned or implied
2. For each constraint, ask 3 questions:
   a. Source: Where does this constraint come from? (physics, regulation, convention, preference)
   b. Evidence: Is there independent verification that this constraint is real?
   c. Malleability: What would need to change to remove this?
3. Classify: HARD | SOFT | ASSUMPTION
4. For SOFT and ASSUMPTION, note what it would take to remove
```

### Classification Examples

| Constraint | Source | Classification |
|------------|--------|---------------|
| "Objects fall at 9.8 m/s²" | Physics | HARD |
| "Must comply with GDPR" | Regulation | HARD |
| "Budget is $50K" | Business | SOFT |
| "We need 10 engineers" | Assumption | ASSUMPTION (maybe 3 good ones suffice) |
| "Users prefer blue buttons" | Design belief | ASSUMPTION |

## Hermes Tools Integration

| Phase | Tool | Usage |
|-------|------|-------|
| DECONSTRUCT | `read_file`, `web_search` | Gather current understanding |
| DECONSTRUCT | `terminal` | Write component maps to files |
| CHALLENGE | `web_search` | Verify constraint reality |
| CHALLENGE | `delegate_task` | Parallel constraint research |
| RECONSTRUCT | `terminal` | Write solution proposals |
| All phases | `read_file` | Reference prior work and ISAs |

## Gotchas / Pitfalls

### 1. False Irreducibility
**Problem:** Declaring something a "first principle" that is actually an assumption.
**Fix:** Apply CHALLENGE to your own first principles. If it can't survive iteration, it's not irreducible.

### 2. Analysis Paralysis
**Problem:** Endless decomposition without reconstruction.
**Fix:** Set a time budget. Phase 1 ≤ 40%, Phase 2 ≤ 30%, Phase 3 ≥ 30%.

### 3. Convenient Truncation
**Problem:** Stopping decomposition when you find an answer you like.
**Fix:** Decompose one more level past the comfortable answer.

### 4. Hidden Assumptions in Language
**Problem:** Words like "should," "must," "obviously," "of course" mask assumptions.
**Fix:** Scan your output for these words. Challenge every one.

### 5. Authority Bias in Constraints
**Problem:** Accepting a constraint because "the expert said so."
**Fix:** Check expert claims against physics and data. Experts have assumptions too.

## Execution Log

After every invocation:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"pai-first-principles","phase":"PHASE_NAME","status":"ok","duration_s":SECONDS}' >> ~/.hermes/profiles/dev/pai/MEMORY/SKILLS/execution.jsonl
```
