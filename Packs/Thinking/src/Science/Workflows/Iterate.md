# Iterate Workflow

**Phase 7 of the Scientific Cycle**

The feedback loop. Based on analysis, decide what's next and close the cycle.

---

## The Core Principle

**The power is in the cycle speed, not individual experiments.**

Fast cycles > perfect experiments.

The goal is continuous learning and convergence toward the goal, not getting it right the first time.

---

## The Iteration Decision Tree

Based on your analysis:

```
Analysis Complete
       │
       ▼
┌──────────────┐
│ Goal Achieved? │
└──────┬───────┘
       │
   ┌───┴───┐
   │       │
  YES      NO
   │       │
   ▼       ▼
 SHIP    Continue
   │       │
   │   ┌───┴────────────────────┐
   │   │                        │
   │   ▼                        ▼
   │ Hypothesis          All Hypotheses
   │ Confirmed?              Tested?
   │   │                        │
   │ ┌─┴─┐                  ┌───┴───┐
   │ YES NO                 YES     NO
   │ │   │                   │       │
   │ ▼   ▼                   ▼       ▼
   │ Implement  Test Next   Generate   Test Next
   │ Solution   Hypothesis  New Hyp.   Hypothesis
   │                           │
   │                           │
   └────── Monitor ◄───────────┘
```

---

## Iteration Paths

### Path 1: Goal Achieved - SHIP

```markdown
## Iteration: Goal Achieved

**Status:** SUCCESS

**Actions:**
- [ ] Document the solution
- [ ] Implement in production
- [ ] Set up monitoring
- [ ] Capture learnings for future reference
- [ ] Archive experiment materials

**Learnings to Preserve:**
- [What worked and why]
- [What we'd do differently]
- [Generalizable insights]
```

**Key Warning:** Don't over-iterate. When the goal is achieved, ship. Perfect is the enemy of good.

### Path 2: Hypothesis Confirmed - Implement & Monitor

```markdown
## Iteration: Hypothesis Confirmed

**Confirmed Hypothesis:** [Name]

**Implementation Plan:**
1. [Implementation step 1]
2. [Implementation step 2]
3. [Implementation step 3]

**Monitoring Plan:**
- Metric to watch: [What]
- Check frequency: [How often]
- Rollback trigger: [If this happens]

**Next Cycle:**
- Goal still applies
- Watch for new issues that emerge
```

### Path 3: Hypothesis Refuted - Try Next

```markdown
## Iteration: Hypothesis Refuted

**Refuted Hypothesis:** [Name]
**Why It Failed:** [Brief explanation]

**Learning:** [What this taught us]

**Next Hypothesis to Test:** [Name]
**Why This One Next:** [Rationale]

**Adjustments to Approach:**
- [Any changes based on what we learned]
```

### Path 4: All Hypotheses Exhausted - Generate New

```markdown
## Iteration: Need New Hypotheses

**Hypotheses Tested:**
- H1: REFUTED - [why]
- H2: REFUTED - [why]
- H3: REFUTED - [why]

**What We Learned From Failures:**
- [Pattern in failures]
- [Assumptions that were wrong]

**New Direction:**
- [Insight from failures that suggests new approach]

**New Hypotheses to Generate:**
- Consider orthogonal approaches
- Challenge fundamental assumptions
- Look at analogous problems

**Action:** Return to GenerateHypotheses with updated context
```

### Path 5: Inconclusive - Better Experiment Needed

```markdown
## Iteration: Inconclusive Results

**Why Inconclusive:**
- [Data quality issues]
- [Sample size too small]
- [Confounding variables]

**Improved Experiment Design:**
- [What to change]
- [How to get cleaner data]

**Action:** Return to DesignExperiment with refined approach
```

### Path 6: Paradigm Shift - Reframe the Problem

```markdown
## Iteration: Paradigm Shift Needed

**The Original Frame:**
[How we were thinking about the problem]

**Why It's Wrong:**
[Evidence that the whole approach is off]

**New Frame:**
[How we should think about it instead]

**New Goal:**
[Revised goal based on new understanding]

**Action:** Return to DefineGoal with fundamentally new approach
```

---

## The Anti-Pattern: Infinite Iteration

**Infinite iteration without shipping is as bad as shipping without iteration.**

Signs you're stuck:
- Same hypotheses cycling without progress
- Scope keeps expanding
- "Just one more experiment" repeatedly
- Fear of declaring success or failure

**When to Stop:**
- Goal is achieved (even partially)
- Diminishing returns on further experiments
- Time/resource constraints require decision
- Problem has changed (environment shifted)
- Better opportunity elsewhere

**The Rule:** Set iteration limits upfront. "We will run 5 cycles max, then decide."

---

## Updating the World Model

Each iteration should update your understanding:

```markdown
## World Model Update

**Before This Cycle:**
- We believed: [previous understanding]
- We assumed: [previous assumptions]

**After This Cycle:**
- We now know: [updated understanding]
- We've learned: [new knowledge]

**Confidence Changes:**
- [Belief X]: [increased/decreased] because [evidence]
- [Belief Y]: [increased/decreased] because [evidence]

**Bayesian Update:**
- Prior: [what we thought before]
- Evidence: [what we observed]
- Posterior: [what we think now]
```

---

## Documentation for Future Cycles

Before closing an iteration, capture:

```markdown
## Iteration Record: [Cycle Number]

**Date:** [When]
**Duration:** [How long this cycle took]

**Starting State:**
- Goal: [What we were trying to achieve]
- Hypotheses: [What we were testing]

**Experiments Run:**
- [Experiment 1]: [Result]
- [Experiment 2]: [Result]

**Outcome:**
- [GOAL ACHIEVED / CONTINUE / PIVOT]

**Key Learning:**
- [Most important insight from this cycle]

**Next Action:**
- [What happens next]
```

---

## Template

```markdown
# Iteration Decision: [Cycle N]

**Analysis Summary:** [One sentence on what we learned]

**Decision:** [SHIP / CONTINUE / PIVOT / STOP]

**Rationale:** [Why this decision]

**If Continuing:**
- Next hypothesis: [Name]
- Next experiment: [Brief description]

**If Shipping:**
- Implementation plan: [Brief]
- Monitoring plan: [Brief]

**If Pivoting:**
- New direction: [Description]
- Why: [What changed]

**If Stopping:**
- Why stopping: [Reason]
- What we learned anyway: [Takeaway]

**World Model Update:**
- [Key belief change]

**Time to Next Decision:** [When we'll evaluate again]
```

---

## Common Pitfalls

### Pitfall 1: Premature Stopping
❌ Giving up after one failed hypothesis
✅ Systematic exploration of hypothesis space

### Pitfall 2: Refusing to Stop
❌ Endless iteration seeking perfection
✅ Shipping when goal is achieved

### Pitfall 3: Not Learning from Failure
❌ "That didn't work, let's try something else"
✅ "That didn't work because X, which teaches us Y"

### Pitfall 4: Ignoring Paradigm Shifts
❌ Staying in the same frame despite evidence it's wrong
✅ Recognizing when fundamental reframing is needed

### Pitfall 5: No Documentation
❌ Moving on without recording learnings
✅ Capturing insights for future reference

---

## Integration: Completing the Cycle

Iteration closes the loop:

```
GOAL → OBSERVE → HYPOTHESIZE → EXPERIMENT → MEASURE → ANALYZE → ITERATE
  ▲                                                              │
  │                                                              │
  └──────────────────────────────────────────────────────────────┘
```

The cycle continues until:
- Goal is achieved
- Problem is resolved
- Decision is made to stop

**Each cycle should be FASTER than the last** as you learn and refine.
