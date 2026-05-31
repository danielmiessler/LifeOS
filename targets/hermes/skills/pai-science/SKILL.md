---
name: pai-science
description: "The scientific method as a universal algorithm for rigorous inquiry. 7 workflows covering the complete hypothesis→experiment→measure→iterate cycle. Three scales: micro (minutes), meso (hours), macro (days)."
version: 5.0.0
author: PAI v5.0 → Hermes Port
license: MIT
metadata:
  hermes:
    tags: [pai, thinking, science, scientific-method, hypothesis, experimentation]
    related_skills: [pai-first-principles, pai-red-team, pai-iterative-depth]
---

# Science — The Scientific Method as Universal Algorithm

## Overview

Apply the scientific method as a general-purpose reasoning algorithm. Not limited to lab science — applies to any domain where you need to move from uncertainty to validated knowledge through structured inquiry.

**Core loop:** DefineGoal → GenerateHypotheses → DesignExperiment → Measure → Analyze → Iterate

**Scales:**
- **Micro (minutes):** Quick A/B tests, code experiments
- **Meso (hours):** Feature validation, design decisions
- **Macro (days):** Strategy validation, product pivots

## When to Use

| Signal | Example |
|--------|---------|
| Need to resolve a disagreement | "We have two conflicting theories" |
| Need to validate a hypothesis | "We think X will improve Y" |
| Root cause is unknown | "We don't know why this is happening" |
| Need measurements, not opinions | "Everyone has different intuitions" |
| Iterating toward a solution | "We've tried changing things but not systematically" |

## Routing Table

| User Need | Route |
|-----------|-------|
| "Test this hypothesis" | FullCycle or DesignExperiment → Measure → Analyze |
| "I need an experiment design" | DesignExperiment workflow |
| "Measure this system" | Measure workflow |
| "Analyze this data" | Analyze workflow |
| "Generate explanations for this phenomenon" | GenerateHypotheses |
| "Improve my current approach" | Iterate workflow |
| "Run a full scientific investigation" | FullCycle |

## 7 Workflows

### Workflow 1: DefineGoal

**Purpose:** Clearly articulate what you're trying to learn or validate.

**Procedure:**
```
1. State the question: "I want to know whether..."
2. Define success: "I'll know the answer when I can measure..."
3. Set scope: "I'm investigating [domain], not [other domain]"
4. Identify constraints: Time, resources, ethical limits, access
5. Document assumptions: "I assume that [X] is true"

Output: A one-paragraph goal statement with success criteria.
```

### Workflow 2: GenerateHypotheses

**Purpose:** Propose testable explanations for the phenomenon in question.

**Procedure:**

1. **Brainstorm all possible explanations:**
   ```
   What could explain this?
   What mechanisms might be at play?
   What would need to be true?
   Use delegate_task for parallel hypothesis generation
   ```

2. **Filter to testable hypotheses:**
   ```
   - Falsifiable: Can we imagine evidence that would disprove it?
   - Measurable: Can we observe or measure the predicted effect?
   - Specific: Does it make a concrete prediction?
   ```

3. **Rank by plausibility:**
   ```
   High: Strong evidence already, consistent with known facts
   Medium: Plausible but unverified
   Low: Possible but unlikely
   Contrarian: Low probability but high impact if true
   ```

4. **Design null hypothesis:**
   ```
   H₀: The effect does not exist / the relationship is random
   This is what you must disprove
   ```

**Output:** Ranked list of testable hypotheses with null hypothesis for each.

### Workflow 3: DesignExperiment

**Purpose:** Create a rigorous experimental protocol.

**Procedure:**

1. **Define variables:**
   ```
   Independent variable: What you change
   Dependent variable: What you measure
   Control variables: What you keep constant
   Confounding variables: What might skew results
   ```

2. **Design the protocol:**
   ```
   - Sample size: How many trials/observations?
   - Control group: What's the baseline comparison?
   - Blinding: Is there bias in measurement?
   - Randomization: Are assignments unbiased?
   ```

3. **Pre-commit to analysis method:**
   ```
   - What statistic will you use?
   - What counts as a significant result?
   - What would make you reject the hypothesis?
   ```

4. **Check for pitfalls:**
   ```
   - Is the experiment ethical?
   - Can the results be replicated?
   - Are there order effects?
   - Is the measurement reliable?
   ```

**Output:** Written experimental protocol with all variables defined.

### Workflow 4: Measure

**Purpose:** Collect data systematically and without bias.

**Procedure:**

```
1. Run the experiment according to protocol
2. Record raw data immediately (never from memory)
3. Log conditions (timestamp, environment, anomalies)
4. Note any deviations from protocol
5. Do NOT analyze during collection (prevents p-hacking)

For software experiments:
  - Use terminal to run benchmarks/tests
  - Use read_file for log collection
  - Use delegate_task for distributed measurement
```

**Output:** Raw data with metadata and condition logs.

### Workflow 5: Analyze

**Purpose:** Process data to draw valid conclusions.

**Procedure:**

1. **Preprocess data:**
   ```
   - Clean missing values
   - Check for outliers
   - Normalize if needed
   ```

2. **Visualize:**
   ```
   - Distribution plots (histograms, box plots)
   - Comparison plots (bar charts, scatter plots)
   - Time series (if temporal data)
   ```

3. **Apply statistical test:**
   ```
   - Parametric: t-test, ANOVA (normal distributions)
   - Non-parametric: Mann-Whitney, Kruskal-Wallis
   - Bayesian: Credible intervals, Bayes factors
   ```

4. **Interpret results:**
   ```
   - Is the effect statistically significant?
   - Is it practically significant (effect size)?
   - Could confounding variables explain the result?
   - Does this support or refute the hypothesis?
   ```

**Output:** Statistical results, visualizations, and interpretation.

### Workflow 6: Iterate

**Purpose:** Refine based on findings and run the next experiment.

**Procedure:**

```
1. Review results from Analyze phase
2. Update hypothesis based on evidence
3. Identify new questions raised by results
4. Design next experiment (narrower scope, higher confidence)
5. Return to DesignExperiment or generate entirely new hypotheses

Maximum iterations: Until:
  - Hypothesis is confirmed to required confidence
  - Hypothesis is conclusively disproven
  - Effort exceeds value of answer
  - You hit an irreducible unknown
```

**Output:** Updated hypothesis and next experiment design.

### Workflow 7: FullCycle — Complete Scientific Investigation

**Purpose:** End-to-end investigation from question to conclusion.

**Procedure:**

```
1. DefineGoal → Write goal statement
2. GenerateHypotheses → Create ranked hypothesis list
3. DesignExperiment → Write protocol
4. Measure → Collect data
5. Analyze → Process and interpret
6. Iterate → If inconclusive, redesign and repeat
7. Conclude → Document what was learned, confidence level, and remaining unknowns

Use delegate_task for:
  - Parallel hypothesis testing
  - Distributed measurement
  - Independent analysis for verification
```

**Output:** Scientific report with methods, results, conclusions, and confidence assessment.

## Hermes Tools Integration

| Workflow | Tool | Usage |
|----------|------|-------|
| DefineGoal | `write_file` | Document goal |
| GenerateHypotheses | `delegate_task` | Parallel hypothesis generation |
| DesignExperiment | `terminal`, `write_file` | Protocol document |
| Measure | `terminal`, `delegate_task` | Run experiments, collect data |
| Analyze | `terminal` | Statistical analysis, plotting |
| Iterate | `read_file` | Review prior cycles |
| FullCycle | All tools | Complete investigation |

## Gotchas / Pitfalls

### 1. Confirmation Bias in Experiment Design
**Problem:** Designing an experiment that can only confirm your hypothesis, not disprove it.
**Fix:** Design the experiment that would most clearly show you're WRONG. If you can't imagine such an experiment, the hypothesis isn't testable.

### 2. P-Hacking / Data Dredging
**Problem:** Running many tests until one is significant by chance.
**Fix:** Pre-register your analysis plan. Don't analyze until all data is collected.

### 3. Over-Generalization
**Problem:** Applying results from a narrow experiment to a broad domain.
**Fix:** Explicitly state the boundaries of your conclusion. What domain does this apply to?

### 4. Ignoring Negative Results
**Problem:** Disregarding experiments that disprove the hypothesis.
**Fix:** Negative results are equally informative. Document them.

### 5. Scale Mismatch
**Problem:** Using a micro-scale method for a macro-scale question.
**Fix:** Match the experimental investment to the question's importance. Not everything needs a full RCT.

## Execution Log

After every invocation:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"pai-science","workflow":"WORKFLOW_NAME","scale":"micro|meso|macro","status":"ok","duration_s":SECONDS}' >> ~/.hermes/profiles/dev/pai/MEMORY/SKILLS/execution.jsonl
```
