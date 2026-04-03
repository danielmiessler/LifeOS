# Define Goal Workflow

**Phase 0 of the Scientific Cycle**

You cannot judge experiments without success criteria. This workflow ensures crystal-clear goals before any investigation begins.

---

## The Core Question

**"What does success look like?"**

If you can't answer this precisely, stop. Define it before proceeding.

---

## The Goal Specification Process

### Step 1: Outcome Statement

**What will exist or change when we succeed?**

```markdown
## Outcome
[Describe the end state as if it already happened]
```

**Examples:**
- ❌ "Make the app faster" (vague)
- ✅ "Page load time is under 1 second for 95% of users"

- ❌ "Fix the bug" (vague)
- ✅ "Users can complete checkout without encountering the 500 error"

- ❌ "Improve the content" (vague)
- ✅ "Blog post generates 50+ comments and 1000+ shares"

### Step 2: Measurable Indicators

**How will we KNOW we succeeded?**

```markdown
## Indicators

**Quantitative:**
- [Metric 1]: [target value]
- [Metric 2]: [target value]

**Qualitative:**
- [Observable behavior 1]
- [Observable behavior 2]

**Leading (early signals):**
- [What we'll see first if on track]

**Lagging (final confirmation):**
- [What confirms we truly succeeded]
```

### Step 3: Success Thresholds

**What level constitutes success?**

```markdown
## Thresholds

**Minimum (acceptable):**
- [Bare minimum to call it a win]

**Target (goal):**
- [What we're actually aiming for]

**Stretch (exceeds expectations):**
- [Outstanding success looks like]
```

This prevents binary thinking. Sometimes "partial success" is valuable information.

### Step 4: Constraints

**What are our boundaries?**

```markdown
## Constraints

**Time:** [Deadline or time budget]
**Resources:** [Budget, people, tools available]
**Quality:** [Standards that must be maintained]
**Technical:** [System limitations]
**Ethical:** [What we won't do]
```

### Step 5: Anti-Goals

**What are we explicitly NOT trying to do?**

```markdown
## Anti-Goals
- [Out of scope item 1]
- [Out of scope item 2]
- [Out of scope item 3]
```

This prevents scope creep and clarifies trade-offs.

---

## Goal Quality Checklist

Before proceeding, verify:

| Criterion | Question | ✅ |
|-----------|----------|---|
| **Specific** | Is it clear what success looks like? | |
| **Measurable** | Can we objectively determine if we achieved it? | |
| **Falsifiable** | Could we fail? (If no, goal is too vague) | |
| **Timebound** | When do we need to achieve it? | |
| **Constrained** | Do we know our limits? | |

**If any box is unchecked, refine the goal.**

---

## Pre-Registration Principle

**Lock your success criteria BEFORE gathering evidence.**

This is crucial for avoiding confirmation bias. Once you've defined success:

1. Write it down
2. Timestamp it
3. Don't change it post-hoc

If you find yourself wanting to move goalposts after seeing data, that's a red flag. Either your original goal was wrong (and you should acknowledge that), or you're falling into confirmation bias.

---

## Template

```markdown
# Goal Specification: [Project/Problem Name]

**Date:** [When this was defined]
**Owner:** [Who is accountable]

## Outcome
[What will be true when we succeed]

## Success Criteria
- [ ] [Measurable criterion 1]
- [ ] [Measurable criterion 2]
- [ ] [Measurable criterion 3]

## Thresholds
- **Minimum:** [Acceptable level]
- **Target:** [Actual goal]
- **Stretch:** [Outstanding]

## Constraints
- **Time:** [Deadline]
- **Resources:** [Limits]
- **Quality:** [Standards]

## Anti-Goals
- [Not trying to do X]
- [Not trying to do Y]

## Pre-Registration
This goal specification was locked at [timestamp] and will not be modified after data collection begins.
```

---

## Common Pitfalls

### Pitfall 1: Vague Outcomes
❌ "Make it better"
✅ "Reduce load time from 3s to under 1s"

### Pitfall 2: No Falsifiability
❌ "Improve user experience" (how would you fail?)
✅ "Increase task completion rate from 60% to 80%"

### Pitfall 3: Moving Goalposts
❌ "Well, we didn't hit the metric, but qualitatively it feels better..."
✅ "We didn't hit the metric. That's a failure. What did we learn?"

### Pitfall 4: Missing Constraints
❌ "Optimize the system" (with unlimited time and resources?)
✅ "Optimize the system within 2 weeks using existing infrastructure"

### Pitfall 5: Scope Creep via Unstated Anti-Goals
❌ Project keeps expanding because boundaries weren't defined
✅ Explicitly stated: "We are NOT redesigning the entire auth system"

---

## Integration with Next Phase

Once the goal is defined, proceed to **GatherContext** or **GenerateHypotheses**.

A well-defined goal enables:
- Focused observation (what to look for)
- Relevant hypotheses (what might achieve the goal)
- Meaningful experiments (tests that relate to success criteria)
- Honest analysis (clear comparison to targets)
