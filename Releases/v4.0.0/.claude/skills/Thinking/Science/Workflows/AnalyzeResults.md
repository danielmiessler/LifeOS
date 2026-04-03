# Analyze Results Workflow

**Phase 6 of the Scientific Cycle**

Compare results to the goal. This workflow ensures honest, objective analysis without confirmation bias.

---

## The Core Question

**"Did we achieve what we set out to achieve?"**

Compare results to PRE-DEFINED success criteria. Not to your expectations. Not to what you hoped for. To what you committed to before starting.

---

## The Analysis Process

### Step 1: Compare to Success Criteria

Pull up the goals defined in DefineGoal. Compare directly.

```markdown
## Goal Comparison

| Success Criterion | Required | Actual | Status |
|-------------------|----------|--------|--------|
| [Criterion 1]     | [Value]  | [Value] | ✅/❌ |
| [Criterion 2]     | [Value]  | [Value] | ✅/❌ |
| [Criterion 3]     | [Value]  | [Value] | ✅/❌ |

**Overall Goal Status:** [ACHIEVED / PARTIALLY ACHIEVED / NOT ACHIEVED]
```

### Step 2: Determine Hypothesis Status

For each hypothesis tested:

```markdown
## Hypothesis Verdicts

### H1: [Name]
**Status:** [CONFIRMED / REFUTED / INCONCLUSIVE]

**Evidence:**
- [What the data showed]
- [How it relates to falsification criteria]

**Confidence:** [High/Medium/Low] because [reasoning]

### H2: [Name]
[Same structure]
```

**Decision Framework:**

| Evidence vs Prediction | Verdict |
|------------------------|---------|
| Data matches prediction | CONFIRMED |
| Data contradicts prediction | REFUTED |
| Data unclear/insufficient | INCONCLUSIVE |

### Step 3: Identify Learnings

What did we learn, beyond the hypothesis verdict?

```markdown
## Key Learnings

**What We Learned:**
1. [Insight that changes our understanding]
2. [Something we now know that we didn't before]

**What Surprised Us:**
1. [Unexpected finding 1]
2. [Unexpected finding 2]

**What Changed About Our Mental Model:**
- [Before: We thought X]
- [After: We now understand Y]
```

### Step 4: Acknowledge Limitations

Be honest about what the data can and cannot tell us.

```markdown
## Limitations

**Methodological Limitations:**
- [Limitation 1 - how it affects conclusions]
- [Limitation 2 - how it affects conclusions]

**Generalizability:**
- [Can we generalize these results? Why/why not?]

**Alternative Interpretations:**
- [Other explanations for the data]
- [What would change our interpretation?]
```

### Step 5: Generate New Questions

Good analysis raises new questions.

```markdown
## New Questions

**Questions That Emerged:**
1. [New question from the findings]
2. [Follow-up investigation needed]

**Hypotheses for Next Cycle:**
- [New hypothesis suggested by data]
- [Refinement of existing hypothesis]
```

---

## Confirmation Bias Countermeasures

### 1. Check Against Pre-Registered Criteria

Did you define success criteria before gathering data? Compare ONLY to those.

If you find yourself saying "Well, we didn't hit the metric, but..." — that's a red flag.

### 2. Consider the Opposite

Ask: "If I wanted to argue the opposite conclusion, what would I say?"

### 3. Seek Disconfirming Interpretation

Ask: "What interpretation of this data would make me LESS confident in my conclusion?"

### 4. Steel-Man the Failure

If hypothesis was refuted, don't dismiss. Ask: "What can we learn from this failure?"

### 5. Red Team Your Analysis

Use RedTeam skill to attack your conclusions.

---

## Statistical Considerations

When sample sizes and quantitative data warrant it:

```markdown
## Statistical Analysis

**Test Used:** [Name and justification]

**Results:**
- Test statistic: [Value]
- p-value: [Value]
- Effect size: [Value and interpretation]
- Confidence interval: [Range]

**Interpretation:**
- [What this means in practical terms]

**Caveats:**
- [Statistical limitations]
- [Assumption violations if any]
```

**Rules of Thumb:**
- p < 0.05 is conventional significance, but effect size matters more
- Large samples can make tiny effects "significant"
- Small samples can hide real effects
- Confidence intervals tell you more than p-values

---

## Analysis Quality Checklist

| Criterion | Question | ✅ |
|-----------|----------|---|
| **Pre-Committed** | Comparing to criteria defined before data? | |
| **Objective** | Letting data speak, not forcing interpretation? | |
| **Honest** | Acknowledging negative or null results? | |
| **Complete** | Considering all the data, not cherry-picking? | |
| **Humble** | Acknowledging limitations and alternatives? | |
| **Learning-Focused** | Extracting insights, not just verdicts? | |

---

## Template

```markdown
# Analysis: [Experiment Name]

**Analysis Date:** [When]
**Analyst:** [Who]

## Goal Comparison
| Criterion | Required | Achieved | Status |
|-----------|----------|----------|--------|
| [Crit 1]  | [Value]  | [Value]  | ✅/❌  |

**Overall:** [ACHIEVED / NOT ACHIEVED]

## Hypothesis Verdicts
- **H1:** [CONFIRMED/REFUTED/INCONCLUSIVE] - [brief reasoning]
- **H2:** [CONFIRMED/REFUTED/INCONCLUSIVE] - [brief reasoning]

## Key Learnings
1. [Main insight]
2. [Secondary insight]

## Surprises
- [What we didn't expect]

## Limitations
- [Methodological concern]

## New Questions
1. [Follow-up question]

## Recommendations
- [What to do next]
```

---

## Common Pitfalls

### Pitfall 1: Moving Goalposts
❌ "We didn't hit the number, but qualitatively it's better..."
✅ "We didn't hit the number. That's a failure. What did we learn?"

### Pitfall 2: Cherry-Picking
❌ Highlighting only data that supports the hypothesis
✅ Presenting all data, including contradictory evidence

### Pitfall 3: Over-Interpreting
❌ Drawing sweeping conclusions from limited data
✅ Matching confidence to evidence strength

### Pitfall 4: Dismissing Failures
❌ "The experiment didn't work, let's move on"
✅ "The experiment failed - why? What does that teach us?"

### Pitfall 5: Confirmation Interpretation
❌ Interpreting ambiguous data as supporting your belief
✅ Explicitly considering alternative interpretations

---

## Integration with Next Phase

Analysis feeds into **Iterate**.

Based on analysis:
- Goal achieved → Document, ship, move on
- Hypothesis confirmed → Implement and monitor
- Hypothesis refuted → Try next hypothesis or generate new ones
- Inconclusive → Design better experiment
- Paradigm shift needed → Return to fundamentals

The cycle continues until the goal is achieved or explicitly abandoned.
