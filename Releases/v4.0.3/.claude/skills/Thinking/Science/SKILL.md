---
name: science
description: "Hypothesis-test-analyze cycles for systematic problem-solving — the meta-skill governing all others. Define goal, generate hypotheses, design experiment, measure results, analyze, iterate. USE WHEN think about, figure out, try approaches, experiment with, iterate on, improve, optimize, define goal, generate hypotheses, design experiment, measure results, analyze results, full cycle, quick diagnosis, structured investigation, science, hypothesis."
---

## Customization

Check for user customizations at `~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/Science/` — load and apply if present, otherwise use defaults.

## Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the WORKFLOWNAME workflow in the Science skill to ACTION"}' \
  > /dev/null 2>&1 &
```

Output: `Running the **WorkflowName** workflow in the **Science** skill to ACTION...`

# Science - The Universal Algorithm

The scientific method applied to everything. GOAL → OBSERVE → HYPOTHESIZE (multiple) → EXPERIMENT → MEASURE → ANALYZE → ITERATE.

**The goal is CRITICAL.** Without clear success criteria, you cannot judge results.

---

## Workflow Routing

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
| Quick debugging (15-min rule) | `Workflows/QuickDiagnosis.md` |
| Complex investigation | `Workflows/StructuredInvestigation.md` |

**Validation checkpoint:** Each phase must produce a measurable artifact before proceeding to the next.

---

## Resources

| Resource | Description |
|----------|-------------|
| `METHODOLOGY.md` | Deep dive into each phase |
| `Protocol.md` | How skills implement Science |
| `Templates.md` | Goal, Hypothesis, Experiment, Results templates |
| `Examples.md` | Worked examples across scales |

## Integration Points

| Phase | Skills to Invoke |
|-------|-----------------|
| **Goal** | Council for validation |
| **Observe** | Research for context |
| **Hypothesize** | Council for ideas, RedTeam for stress-test |
| **Experiment** | Development (Worktrees) for parallel tests |
| **Measure** | Evals for structured measurement |
| **Analyze** | Council for multi-perspective analysis |

## Key Principles

1. **Goal-First** — Define success before starting
2. **Hypothesis Plurality** — Minimum 3 ideas, never just one
3. **Minimum Viable Experiments** — Smallest test that teaches
4. **Falsifiability** — Experiments must be able to fail
5. **Measure What Matters** — Only goal-relevant data
6. **Honest Analysis** — Compare to goal, not expectations
7. **Rapid Iteration** — Cycle speed > perfect experiments

## Scale

| Level | Cycle Time | Example |
|-------|-----------|---------|
| **Micro** | Minutes | TDD: test, code, refactor |
| **Meso** | Hours-Days | Feature: spec, implement, validate |
| **Macro** | Weeks-Months | Product: MVP, launch, measure PMF |

---
