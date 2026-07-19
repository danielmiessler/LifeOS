---
name: Science
version: 1.1.17
description: "The scientific method as a universal problem-solving algorithm — goal-first, plural falsifiable hypotheses, designed experiments, and honest measurement, scaling from TDD to feature validation to MVP launch. USE WHEN think about, figure out, experiment, iterate, optimize, hypothesis, science, full cycle, quick diagnosis, structured investigation, how do we test, analyze results. NOT FOR multi-angle lens passes (use IterativeDepth)."
effort: high
---

## Customization

**Before executing, check for user customizations at:**
`{{LIFEOS_DIR}}/USER/CUSTOMIZATIONS/SKILLS/Science/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.


## 🚨 MANDATORY: Voice Notification (REQUIRED BEFORE ANY ACTION)

**You MUST send this notification BEFORE doing anything else when this skill is invoked.**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:31337/notify \
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

## What It Does

Applies the scientific method as a general problem-solving algorithm: define the goal first, generate multiple hypotheses, design experiments that can fail, measure honestly, analyze against the goal, iterate. Seven core workflows plus two diagnostic shortcuts (quick 15-minute debugging and structured multi-factor investigation). It scales from micro (TDD) to meso (feature validation) to macro (MVP launch).

## The Problem

Most problem-solving is guessing dressed up as work. You pick the first idea that comes to mind, change something, and call it done when it "seems better" — which is confirmation bias, not progress. Without a clear definition of success you can't tell whether a change helped, so you keep tweaking forever or stop too early. Single-hypothesis thinking means you only ever test the idea you already believed. This skill forces the discipline that fixes all of that: a stated goal, at least three competing hypotheses, falsifiable tests, and measurement that compares to the goal rather than to your hopes.

## How It Works

The whole thing is one repeating cycle, and the goal anchors it — without clear success criteria you cannot judge results:

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

The answer emerges from the cycle, not from guessing.

---


## Workflow Routing

**Output when executing:** `Running the **WorkflowName** workflow in the **Science** skill to ACTION...`

### Core Workflows

| Workflow | Trigger | File |
|----------|---------|------|
| **DefineGoal** | "define the goal", "what are we trying to achieve" | `Workflows/DefineGoal.md` |
| **GenerateHypotheses** | "what might work", "ideas", "hypotheses" | `Workflows/GenerateHypotheses.md` |
| **DesignExperiment** | "how do we test", "experiment design" | `Workflows/DesignExperiment.md` |
| **MeasureResults** | "what happened", "measure", "results" | `Workflows/MeasureResults.md` |
| **AnalyzeResults** | "analyze", "compare to goal" | `Workflows/AnalyzeResults.md` |
| **Iterate** | "iterate", "try again", "next cycle" | `Workflows/Iterate.md` |
| **FullCycle** | Full structured cycle | `Workflows/FullCycle.md` |

### Diagnostic Workflows

| Workflow | Trigger | File |
|----------|---------|------|
| **QuickDiagnosis** | Quick debugging (15-min rule) | `Workflows/QuickDiagnosis.md` |
| **StructuredInvestigation** | Complex investigation | `Workflows/StructuredInvestigation.md` |

---

## Resource Index

| Resource | Description |
|----------|-------------|
| `Methodology.md` | Deep dive into each phase |
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

## Anti-Patterns

| Bad | Good |
|-----|------|
| "Make it better" | "Reduce load time from 3s to 1s" |
| "I think X will work" | "Here are 3 approaches: X, Y, Z" |
| "Prove I'm right" | "Design test that could disprove" |
| "Pretend failure didn't happen" | "What did we learn?" |
| "Keep experimenting forever" | "Ship and learn from production" |

---

## Gotchas

- **Minimum 3 hypotheses before testing.** Single-hypothesis testing is confirmation bias — going straight to a single test is trial-and-error, not science.
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
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"Science","workflow":"WORKFLOW_USED","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> "${LIFEOS_DIR}/MEMORY/SKILLS/execution.jsonl"
```

Replace `WORKFLOW_USED` with the workflow executed, `8_WORD_SUMMARY` with a brief input description, and `SECONDS` with approximate wall-clock time. Log `status: "error"` if the workflow failed.
