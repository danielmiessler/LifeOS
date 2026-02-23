---
name: Science
description: Universal thinking and iteration engine based on the scientific method. USE WHEN user says "think about", "figure out", "try approaches", "experiment with", "test this idea", "iterate on", "improve", "optimize", OR any problem-solving that benefits from structured hypothesis-test-analyze cycles. THE meta-skill that other workflows implement.
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/skills/PAI/USER/SKILLCUSTOMIZATIONS/Science/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.


## 🚨 MANDATORY: Voice Notification (REQUIRED BEFORE ANY ACTION)

**You MUST send this notification BEFORE doing anything else when this skill is invoked.**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:8888/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the WORKFLOWNAME workflow in the Science skill to ACTION"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running the **WorkflowName** workflow in the **Science** skill to ACTION...
   ```

**This is not optional. Execute this curl command immediately upon skill invocation.**

# Science - The Universal Algorithm

**The scientific method applied to everything. The meta-skill that governs all other skills.**

## The Universal Cycle

```
GOAL -----> What does success look like?
   |
OBSERVE --> What is the current state?
   |
HYPOTHESIZE -> What might work? (Generate MULTIPLE)
   |
EXPERIMENT -> Design and run the test
   |
MEASURE --> What happened? (Data collection)
   |
ANALYZE --> How does it compare to the goal?
   |
ITERATE --> Adjust hypothesis and repeat
   |
   +------> Back to HYPOTHESIZE
```

**The goal is CRITICAL.** Without clear success criteria, you cannot judge results.

---


## Workflow Routing

**Output when executing:** `Running the **WorkflowName** workflow in the **Science** skill to ACTION...`

### Core Workflows

| Trigger | Workflow |
|---------|----------|
| "define the goal", "what are we trying to achieve" | `Workflows/DefineGoal.md` |
| "what might work", "ideas", "hypotheses" | `Workflows/GenerateHypotheses.md` |
| "how do we test", "experiment design" | `Workflows/DesignExperiment.md` |
| "what happened", "measure", "results" | `Workflows/MeasureResults.md` |
| "analyze", "compare to goal" | `Workflows/AnalyzeResults.md` |
| "iterate", "try again", "next cycle" | `Workflows/Iterate.md` |
| Full structured cycle | `Workflows/FullCycle.md` |

### Diagnostic Workflows

| Trigger | Workflow |
|---------|----------|
| Quick debugging (15-min rule) | `Workflows/QuickDiagnosis.md` |
| Complex investigation | `Workflows/StructuredInvestigation.md` |

---

## Resource Index

| Resource | Description |
|----------|-------------|
| `METHODOLOGY.md` | Deep dive into each phase |
| `Protocol.md` | How skills implement Science |
| `Templates.md` | Goal, Hypothesis, Experiment, Results templates |
| `Examples.md` | Worked examples across scales |

---

## Domain Applications

| Domain | Manifestation | Related Skill |
|--------|---------------|---------------|
| **Coding** | TDD (Red-Green-Refactor) | Development |
| **Products** | MVP -> Measure -> Iterate | Development |
| **Research** | Question -> Study -> Analyze | Research |
| **Prompts** | Prompt -> Eval -> Iterate | Evals |
| **Decisions** | Options -> Council -> Choose | Council |

---

## Scale of Application

| Level | Cycle Time | Example |
|-------|-----------|---------|
| **Micro** | Minutes | TDD: test, code, refactor |
| **Meso** | Hours-Days | Feature: spec, implement, validate |
| **Macro** | Weeks-Months | Product: MVP, launch, measure PMF |

---

## Integration Points

| Phase | Skills to Invoke |
|-------|-----------------|
| **Goal** | Council for validation |
| **Observe** | Research for context |
| **Hypothesize** | Council for ideas, RedTeam for stress-test |
| **Experiment** | Development (Worktrees) for parallel tests |
| **Measure** | Evals for structured measurement |
| **Analyze** | Council for multi-perspective analysis |

---

## Key Principles (Quick Reference)

1. **Goal-First** - Define success before starting
2. **Hypothesis Plurality** - NEVER just one idea (minimum 3)
3. **Minimum Viable Experiments** - Smallest test that teaches
4. **Falsifiability** - Experiments must be able to fail
5. **Measure What Matters** - Only goal-relevant data
6. **Honest Analysis** - Compare to goal, not expectations
7. **Rapid Iteration** - Cycle speed > perfect experiments

---

## Anti-Patterns

| Bad | Good |
|-----|------|
| "Make it better" | "Reduce load time from 3s to 1s" |
| "I think X will work" | "Here are 3 approaches: X, Y, Z" |
| "Prove I'm right" | "Design test that could disprove" |
| "Pretend failure didn't happen" | "What did we learn?" |
| "Keep experimenting forever" | "Ship and learn from production" |

---

## Quick Start

1. **Goal** - What does success look like?
2. **Observe** - What do we know?
3. **Hypothesize** - At least 3 ideas
4. **Experiment** - Minimum viable tests
5. **Measure** - Collect goal-relevant data
6. **Analyze** - Compare to success criteria
7. **Iterate** - Adjust and repeat

**The answer emerges from the cycle, not from guessing.**
