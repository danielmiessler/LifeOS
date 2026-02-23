# Design Experiment Workflow

**Phase 3 of the Scientific Cycle**

Design the smallest experiment that meaningfully tests the hypothesis. This workflow ensures experiments are efficient, valid, and actionable.

---

## The Core Principle

**Minimum Viable Experiment**

Not every experiment needs to be comprehensive. The goal is LEARNING, not perfection.

Ask:
- What's the **fastest** way to learn if this works?
- What's the **cheapest** way to get meaningful data?
- What would **DISPROVE** the hypothesis?
- What's the **minimum sample size** for confidence?

---

## The Experiment Design Process

### Step 1: Define Success Criteria

**Before running, know what outcomes mean.**

```markdown
## Success Criteria

**Hypothesis CONFIRMED if:**
[Specific observable outcome that supports the hypothesis]

**Hypothesis REFUTED if:**
[Specific observable outcome that contradicts the hypothesis]

**INCONCLUSIVE if:**
[Conditions that mean we need more data]
```

**The key insight:** Define these BEFORE running the experiment. This prevents post-hoc rationalization.

### Step 2: Identify Variables

```markdown
## Variables

**Independent Variable (what we're changing):**
[The thing we're manipulating]

**Dependent Variable (what we're measuring):**
[The outcome we're observing]

**Control Variables (what we're holding constant):**
- [Variable 1]: held at [value]
- [Variable 2]: held at [value]

**Confounding Variables (what might skew results):**
- [Potential confounder 1]: mitigated by [strategy]
- [Potential confounder 2]: mitigated by [strategy]
```

### Step 3: Design the Test

```markdown
## Experiment Design

**Method:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Control (baseline):**
[What we're comparing against]

**Treatment:**
[What we're testing]

**Measurement Approach:**
- Primary metric: [What we're measuring]
- How measured: [Collection method]
- When measured: [Timing]
- By whom: [Who collects]
```

### Step 4: Plan Data Collection

```markdown
## Data Collection Plan

**Data Points:**
- [Metric 1]: collected via [method]
- [Metric 2]: collected via [method]

**Sample Size:**
[How many data points needed]

**Duration:**
[How long to run]

**Collection Schedule:**
[When/how often to collect]

**Data Storage:**
[Where raw data will be preserved]
```

### Step 5: Define Stopping Rules

```markdown
## Stopping Rules

**Stop early if:**
- [Condition for early success]
- [Condition for early failure]
- [Safety condition]

**Continue until:**
- [Minimum duration/sample reached]

**Declare done when:**
- [Clear endpoint condition]
```

---

## Experiment Quality Checklist

| Criterion | Question | ✅ |
|-----------|----------|---|
| **Minimal** | Is this the smallest test that gives meaningful data? | |
| **Falsifiable** | Could this experiment prove the hypothesis wrong? | |
| **Measurable** | Do we know exactly what we're measuring? | |
| **Controlled** | Have we isolated the variable we're testing? | |
| **Reproducible** | Could someone else run this experiment? | |
| **Pre-committed** | Are success criteria defined before running? | |

---

## Domain-Specific Experiment Patterns

### Code Experiments

**Tool:** Worktrees for parallel experiments

```markdown
## Code Experiment Design

**Hypothesis:** [Implementation approach X will work]

**Branches:**
- control: Current implementation
- treatment-1: Approach A
- treatment-2: Approach B

**Test Method:**
- Run test suite on each branch
- Measure performance benchmarks
- Compare code complexity metrics

**Success Criteria:**
- All tests pass
- Performance meets threshold
- Complexity doesn't increase
```

### Prompt Experiments

**Tool:** Evals Skill (MANDATORY)

**For ALL prompt experiments, invoke the Evals skill directly.**

Evals implements the Science Protocol for prompt engineering. Don't reinvent evaluation - use the battle-tested methodology.

**Invocation:**
```
→ Invoke Evals skill, ComparePrompts workflow
→ Follow Evals' Science Protocol Alignment checklist
→ Use Evals' statistical rigor (SEM, confidence intervals)
```

**What Evals Provides:**
- Position swapping (mitigates LLM positional bias)
- Multi-judge panels (reduces individual model quirks)
- Statistical significance testing
- Pre-commitment enforcement
- Paradigm check when stuck

```markdown
## Prompt Experiment Design

**Hypothesis:** [Prompt variant X will perform better]
**Falsified if:** [Variant X performance ≤ baseline, or improvement < threshold]

**Variants (aim for 3+):**
- baseline: Current prompt
- variant-1: [Modified prompt A]
- variant-2: [Modified prompt B]
- variant-3: [Modified prompt C - different direction]

**Eval Method (via Evals skill):**
- Run eval suite with each variant
- N=100 samples per variant
- Position swapping enabled
- Measure accuracy, format compliance

**Success Criteria (pre-committed):**
- Variant exceeds baseline by > 5%
- Statistical significance p < 0.05
- No regression on secondary metrics
```

**CLI Quick Reference:**
```bash
# Run prompt comparison via Evals skill
bun run ~/.claude/skills/Evals/EvalServer/cli-run.ts \
  --use-case <name> \
  --compare prompts/baseline.md prompts/variant-1.md \
  --position-swap
```

### Feature Experiments

**Tool:** Feature flags, A/B tests

```markdown
## Feature Experiment Design

**Hypothesis:** [Feature X will improve metric Y]

**Groups:**
- control: 50% of users (no feature)
- treatment: 50% of users (with feature)

**Measurement:**
- Primary: [Conversion rate]
- Secondary: [Engagement, retention]

**Duration:** 2 weeks minimum

**Success Criteria:**
- Lift > 5% with 95% confidence
- No degradation in secondary metrics
```

### Research Experiments

**Tool:** Parallel research agents

```markdown
## Research Experiment Design

**Hypothesis:** [Theory X explains phenomenon Y]

**Investigation Approach:**
- Agent 1: Search for supporting evidence
- Agent 2: Search for contradicting evidence
- Agent 3: Search for alternative explanations

**Evidence Evaluation:**
- Source quality rating
- Recency
- Consensus level

**Success Criteria:**
- Preponderance of high-quality evidence
- No strong contradicting evidence
```

---

## Parallel Experiment Design

When hypotheses are independent, design experiments to run simultaneously.

```
Hypothesis 1 ─────► Experiment 1 ─────► Results 1 ─┐
                                                   │
Hypothesis 2 ─────► Experiment 2 ─────► Results 2 ─┼─► Analysis
                                                   │
Hypothesis 3 ─────► Experiment 3 ─────► Results 3 ─┘
```

**Benefits:**
- Faster time to insight
- Reduces sequential bias
- Enables direct comparison

**Requirements:**
- Experiments must be independent
- Resources available for parallel execution
- Results can be meaningfully compared

---

## Template

```markdown
# Experiment Design: [Name]

**Testing Hypothesis:** [Which hypothesis]
**Date:** [When designed]

## Success Criteria
- CONFIRMED if: [condition]
- REFUTED if: [condition]
- INCONCLUSIVE if: [condition]

## Variables
- **Independent:** [What we change]
- **Dependent:** [What we measure]
- **Controls:** [What we hold constant]

## Method
1. [Step 1]
2. [Step 2]
3. [Step 3]

## Data Collection
- **Metrics:** [What we collect]
- **Sample Size:** [How many]
- **Duration:** [How long]

## Stopping Rules
- Stop early if: [condition]
- Continue until: [condition]

## Resources Needed
- [Resource 1]
- [Resource 2]
```

---

## Common Pitfalls

### Pitfall 1: Over-Engineering
❌ Building elaborate test infrastructure for a simple question
✅ Finding the minimum viable test that answers the question

### Pitfall 2: Confirmation Design
❌ Designing tests that can only succeed
✅ Designing tests that could definitively fail

### Pitfall 3: Moving Targets
❌ Changing success criteria after seeing results
✅ Pre-committing to criteria before running

### Pitfall 4: Ignoring Confounders
❌ Assuming all differences are due to the treatment
✅ Identifying and controlling for other variables

### Pitfall 5: Insufficient Sample
❌ Declaring results from N=3
✅ Understanding minimum sample for statistical validity

---

## Integration with Next Phases

A well-designed experiment enables:
- **Clear execution** - steps are defined
- **Objective measurement** - metrics are specified
- **Honest analysis** - success criteria are pre-committed
- **Efficient iteration** - learn quickly, move on
