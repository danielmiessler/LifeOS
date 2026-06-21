---
name: Science
description: "The scientific method as a universal problem-solving algorithm — goal-first, hypothesis-plural, falsifiable experiments, honest measurement. Seven core workflows: DefineGoal, GenerateHypotheses (minimum 3 required — single-hypothesis testing is confirmation bias), DesignExperiment, MeasureResults, AnalyzeResults, Iterate, and FullCycle. Two diagnostic shortcuts: QuickDiagnosis (15-minute rule for fast debugging) and StructuredInvestigation (complex multi-factor issues). Scales across micro (TDD, minutes), meso (feature validation, hours-days), and macro (MVP launch, weeks-months). Reference files: METHODOLOGY.md (deep dive on each phase), Protocol.md (how other skills invoke Science), Templates.md (goal/hypothesis/experiment/results templates), Examples.md (worked examples across scales). Integrates with Council (hypothesis validation), Evals (measurement), Development (parallel experiment worktrees), and RedTeam (stress-test hypotheses). RootCauseAnalysis applies Science to failure investigation — pair them when investigating incidents. NOT FOR multi-angle lens passes on requirements (use IterativeDepth for pre-build exploration). USE WHEN think about, figure out, experiment, iterate, improve, optimize, hypothesis, science, full cycle, quick diagnosis, structured investigation, what might work, how do we test, what happened, analyze results."
effort: high
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/Science/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

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

## Gotchas

- **Hypothesis-test-analyze is the core loop.** Don't skip the hypothesis step — going straight to testing is just trial-and-error, not science.
- **Minimum 3 hypotheses before testing.** Single-hypothesis testing is confirmation bias.
- **Measurements must be specific and reproducible.** "It seems better" is not a measurement.
- **Full cycle is for systematic investigation.** For quick debugging, use quick diagnosis mode.

## Examples

**Example 1: Quick diagnosis**
```
User: "figure out why Surface time filters show stale items"
→ Quick diagnosis mode
→ Hypothesis: timestamp format mismatch in D1
→ Test: query D1 for actual stored format
→ Analyze: compare stored vs expected format
→ Result: ISO string vs Unix timestamp mismatch
```

**Example 2: Full systematic investigation**
```
User: "experiment with different prompt structures for better output"
→ Full cycle mode
→ 3+ hypotheses generated
→ Controlled experiments with measurements
→ Analysis identifies winning approach
→ Iterates until convergence
```

## Execution Log

After completing any workflow, append a single JSONL entry:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"Science","workflow":"WORKFLOW_USED","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> ~/.claude/PAI/MEMORY/SKILLS/execution.jsonl
```

Replace `WORKFLOW_USED` with the workflow executed, `8_WORD_SUMMARY` with a brief input description, and `SECONDS` with approximate wall-clock time. Log `status: "error"` if the workflow failed.
