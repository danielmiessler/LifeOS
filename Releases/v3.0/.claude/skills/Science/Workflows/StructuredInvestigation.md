# Structured Investigation Workflow

**Level 2 Science - For problems taking hours to days**

When Quick Diagnosis isn't enough, or the problem requires systematic exploration. This is the workhorse workflow for most non-trivial problems.

---

## When to Use

- Quick Diagnosis escalated (15+ minutes without resolution)
- Problem involves multiple systems or unknowns
- Multiple people disagree on the cause
- High stakes - wrong answer costs significant time/resources
- You need to document your investigation for others

## Anti-Triggers (Don't Use When)

- Problem can be solved in 5 minutes
- You're doing creative/generative work
- The answer is obvious to domain experts
- Formal process would take longer than just doing the work

---

## The Workflow

### Phase 1: Define the Goal (5 minutes)

**Be specific.** Vague goals = vague results.

```markdown
## Goal Definition

**Outcome:** [What will exist/change when we succeed?]

**Success Criteria:**
- [ ] [Measurable criterion 1]
- [ ] [Measurable criterion 2]
- [ ] [Measurable criterion 3]

**Constraints:**
- Time: [Deadline or time budget]
- Resources: [What we have available]
- Quality: [Standards that must be maintained]

**Anti-Goals (what we're NOT trying to do):**
- [Explicitly out of scope item 1]
- [Explicitly out of scope item 2]
```

**Quality Check:** Can someone else read this and know exactly when we've succeeded?

### Phase 2: Gather Context (15-30 minutes)

**Understand before you hypothesize.**

```markdown
## Current State Observation

**What we know:**
- [Fact 1 - with source/evidence]
- [Fact 2 - with source/evidence]
- [Fact 3 - with source/evidence]

**What we don't know:**
- [Gap 1 - what information would help?]
- [Gap 2 - what information would help?]

**What has been tried:**
- [Previous attempt 1] - Result: [outcome]
- [Previous attempt 2] - Result: [outcome]

**Baseline measurements:**
- [Metric 1]: [current value]
- [Metric 2]: [current value]
```

**Quality Check:** Did we look for disconfirming evidence, not just confirming evidence?

### Phase 3: Generate Hypotheses (15 minutes)

**Minimum 3 hypotheses. Better: 5-10 for important problems.**

```markdown
## Hypotheses

### H1: [Name]
**Claim:** [What we believe is happening/will work]
**Rationale:** [Why we think this]
**Evidence For:** [What supports this]
**Evidence Against:** [What challenges this]
**Falsification Test:** This is WRONG if [observable outcome]
**Cost to Test:** [Time/resources needed]
**Confidence:** [Low/Medium/High]

### H2: [Name]
[Same structure]

### H3: [Name]
[Same structure]
```

**The Plurality Requirement:** Single-hypothesis thinking leads to confirmation bias. Force yourself to consider alternatives.

**Quality Check:** For each hypothesis, can you articulate what would prove it wrong?

### Phase 4: Design Experiments (15 minutes)

**Minimum Viable Experiments - the smallest test that gives meaningful data.**

```markdown
## Experiment Design

### Experiment for H1

**Method:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Measuring:**
- Primary metric: [What confirms/refutes]
- Secondary metrics: [Supporting data]

**Success Criteria:**
- CONFIRMED if: [condition]
- REFUTED if: [condition]
- INCONCLUSIVE if: [condition]

**Duration:** [How long to run]
**Resources:** [What's needed]
```

**Prioritization:** Order experiments by (likelihood of success) × (cost to test). Cheap, high-likelihood first.

### Phase 5: Execute Experiments

**Run experiments. Collect data. Don't peek prematurely.**

```markdown
## Experiment Execution

### Experiment 1: [Name]
**Started:** [timestamp]
**Status:** [Running/Complete]
**Raw Observations:**
- [Observation 1]
- [Observation 2]
**Anomalies:** [Anything unexpected]
```

**Parallel Execution:** When experiments are independent, run them simultaneously.

### Phase 6: Measure Results

**Collect data related to success criteria.**

```markdown
## Results

### Experiment 1 Results
| Metric | Expected | Actual | Delta |
|--------|----------|--------|-------|
| [Name] | [Value]  | [Value]| [+/-] |

**Qualitative Observations:**
- [Notable event 1]
- [Notable event 2]

**Data Quality Notes:**
- [Any issues with collection]
```

### Phase 7: Analyze Against Goal

**Compare results to success criteria. Be honest.**

```markdown
## Analysis

### Goal Comparison
| Success Criterion | Required | Achieved | Status |
|-------------------|----------|----------|--------|
| [Criterion 1]     | [Value]  | [Value]  | ✅/❌  |
| [Criterion 2]     | [Value]  | [Value]  | ✅/❌  |

### Hypothesis Status
- H1: [CONFIRMED/REFUTED/INCONCLUSIVE] - because [evidence]
- H2: [CONFIRMED/REFUTED/INCONCLUSIVE] - because [evidence]
- H3: [CONFIRMED/REFUTED/INCONCLUSIVE] - because [evidence]

### Key Learnings
1. [What we learned that changes our understanding]
2. [Surprises - what we didn't expect]
3. [New questions that emerged]

### Implications
- [How this changes our approach]
- [What to do next]
```

### Phase 8: Iterate

**Based on analysis, decide next action.**

Options:
1. **Goal achieved** → Document learnings, done
2. **Promising hypothesis** → Deeper investigation of that path
3. **All hypotheses failed** → Generate new hypotheses, new cycle
4. **Need more data** → Design additional experiments
5. **Problem reframed** → Return to Phase 1 with new understanding

---

## Documentation Artifact

After completing, produce a summary:

```markdown
## Investigation Summary: [Problem Name]

**Date:** [When]
**Duration:** [How long]

**Goal:** [What we were trying to achieve]

**Key Finding:** [One-sentence summary]

**Hypotheses Tested:**
- H1: [CONFIRMED/REFUTED]
- H2: [CONFIRMED/REFUTED]
- H3: [CONFIRMED/REFUTED]

**Resolution:** [What we did / what we learned]

**Learnings for Future:**
- [Generalizable insight 1]
- [Generalizable insight 2]
```

---

## Escalation to Full Cycle

Escalate to FullCycle workflow when:
- Investigation spans multiple days/weeks
- Multiple stakeholders need to review methodology
- Results will be published or shared externally
- Statistical rigor is required
- The problem is at macro scale (product strategy, architecture)
