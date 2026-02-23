# Science Templates

Reusable templates for structured scientific thinking. Copy and adapt as needed.

---

## Goal Template

```markdown
## Goal: [Name]

**Created:** [Date]
**Status:** [ACTIVE / ACHIEVED / ABANDONED]

### Outcome
[What will be true when we succeed - specific and observable]

### Success Criteria
**Quantitative:**
- [ ] [Metric 1]: [target]
- [ ] [Metric 2]: [target]

**Qualitative:**
- [ ] [Observable behavior 1]

### Thresholds
- **Minimum:** [Bare minimum win]
- **Target:** [What we're aiming for]
- **Stretch:** [Outstanding success]

### Constraints
- **Time:** [Deadline]
- **Resources:** [Budget, people]
- **Quality:** [Standards to maintain]

### Anti-Goals
- [Out of scope item 1]
- [Out of scope item 2]
```

**Quick Version:**
```markdown
### Goal: [Name]
- **Success:** [One-sentence outcome]
- **Metric:** [Primary measurable target]
- **Deadline:** [When]
- **NOT doing:** [Key anti-goal]
```

---

## Hypothesis Template

```markdown
## Hypothesis: [Name]

**ID:** H[N]
**Status:** [UNTESTED / TESTING / CONFIRMED / REFUTED / INCONCLUSIVE]

### Claim
**Statement:** [Precise, testable statement]
**If-Then:** If [condition], then [outcome], because [mechanism]

### Rationale
1. [Reason 1]
2. [Reason 2]

### Falsification
**WRONG if:** [Specific observable outcome that disproves it]

### Testing
- **Cost:** [Time/resources]
- **Minimum Experiment:** [Briefest test description]
- **Confidence:** [Low/Med/High] - [Why]
```

**Quick Version:**
```markdown
### H[N]: [Name]
- **Claim:** [What we think]
- **Because:** [Why]
- **Wrong if:** [Falsification]
- **Test cost:** [Low/Med/High]
```

---

## Experiment Template

```markdown
## Experiment: [Name]

**ID:** EXP-[N]
**Testing:** H[N]
**Status:** [DESIGNED / RUNNING / COMPLETE / ABORTED]

### Success Criteria (PRE-COMMITTED)
- **CONFIRMED if:** [Condition]
- **REFUTED if:** [Condition]
- **INCONCLUSIVE if:** [Condition]

### Variables
- **Independent (we change):** [Variable]
- **Dependent (we measure):** [Metric]
- **Controls (constant):** [Variables]

### Method
1. [Step 1]
2. [Step 2]
3. [Step 3]

### Data Collection
| Metric | How Measured | Target |
|--------|--------------|--------|
| [Name] | [Method]     | [Value]|

### Timeline
- **Duration:** [How long]
- **Stopping:** [When to stop early]
```

**Quick Version:**
```markdown
### EXP: [Name]
- **Testing:** H[N]
- **Method:** [Brief description]
- **Measuring:** [Primary metric]
- **Success if:** [Condition]
- **Failure if:** [Condition]
```

---

## Results Template

```markdown
## Results: [Experiment Name]

**Experiment:** EXP-[N]
**Hypothesis:** H[N]
**Date:** [When run]

### Summary
**Verdict:** [CONFIRMED / REFUTED / INCONCLUSIVE]
**One-Sentence:** [What happened]

### Data
| Metric | Baseline | Result | Change | Target | Met? |
|--------|----------|--------|--------|--------|------|
| [Name] | [Value]  | [Value]| [Delta]| [Value]| Y/N  |

### Observations
- [Key observation 1]
- [Key observation 2]

### Analysis
| Criterion | Required | Achieved | Status |
|-----------|----------|----------|--------|
| [Crit 1]  | [Value]  | [Value]  | Y/N    |

### Learnings
1. [Key insight]
2. [Surprise finding]

### Next Steps
- [Recommended action]
- [Follow-up question]
```

**Quick Version:**
```markdown
### Results: [Experiment]
- **Tested:** H[N]
- **Verdict:** [CONFIRMED/REFUTED/INCONCLUSIVE]
- **Key Metric:** [Value] vs [Target]
- **Learning:** [Main insight]
- **Next:** [Action]
```
