# Science Methodology - The Deep Dive

**This document elaborates on each phase of the scientific method as applied within PAI.**

The power of this methodology is its universality and its iteration speed. Apply it at micro-scale (TDD cycles) or macro-scale (product strategy). The pattern remains the same.

---

## Phase 0: GOAL - The North Star

### Why Goal First?

**You cannot judge experiments without success criteria.**

Every failed project shares one trait: vague or shifting goals. "Make it better" is not a goal. "Reduce customer churn by 20% within 3 months" is a goal.

### The Goal Specification Process

**1. Outcome Statement**
What will exist or change when we succeed?
- Be specific about the end state
- Describe it as if it already happened
- Make it concrete and observable

**2. Measurable Indicators**
How will we KNOW we succeeded?
- Quantitative metrics (numbers we can measure)
- Qualitative indicators (observable behaviors)
- Leading indicators (early signals)
- Lagging indicators (final confirmation)

**3. Success Threshold**
What level constitutes "success"?
- Minimum viable success (acceptable)
- Target success (goal)
- Stretch success (exceeds expectations)

**4. Constraints**
What are the boundaries?
- Time constraints (deadlines)
- Resource constraints (budget, people)
- Quality constraints (must maintain X)
- Technical constraints (must work with Y)

**5. Anti-Goals**
What are we explicitly NOT trying to do?
- Prevents scope creep
- Clarifies trade-offs
- Keeps focus sharp

### Goal Quality Checklist

| Criteria | Question |
|----------|----------|
| **Specific** | Is it clear what success looks like? |
| **Measurable** | Can we objectively determine if we achieved it? |
| **Falsifiable** | Could we fail? (If no, goal is too vague) |
| **Timebound** | When do we need to achieve it? |
| **Constrained** | Do we know our limits? |

### Example Goal Specifications

**Weak Goal:**
> "Improve the login experience"

**Strong Goal:**
> **Outcome:** Users can log in without frustration, as measured by reduced support tickets and improved satisfaction
>
> **Indicators:**
> - Login-related support tickets drop from 50/week to <10/week
> - Time-to-login decreases from 15s avg to <5s avg
> - User satisfaction survey shows >4.5/5 for login experience
>
> **Threshold:**
> - Minimum: 50% reduction in tickets
> - Target: 80% reduction + <5s login
> - Stretch: Zero tickets + <3s login + biometric support
>
> **Constraints:**
> - Must maintain existing auth integrations (OAuth, SAML)
> - No new third-party dependencies without security review
> - Ship within 2 sprints
>
> **Anti-Goals:**
> - Not redesigning the entire auth system
> - Not adding new auth methods (that's a separate project)

---

## Phase 1: OBSERVE - Understanding Current State

### Why Observation First?

**You cannot solve what you do not understand.**

Jumping to solutions without understanding the problem space leads to:
- Solving symptoms instead of root causes
- Reinventing existing solutions
- Missing critical constraints
- Building on false assumptions

### The Observation Process

**1. Gather Existing Knowledge**
- What do we already know about this problem?
- What has been tried before?
- What do experts say?
- What does research show?

**2. Map the Current State**
- How does the system work now?
- Where are the pain points?
- What are the workarounds people use?
- What data do we have?

**3. Identify Gaps**
- What don't we know?
- What assumptions are we making?
- What could we be wrong about?
- What would change our approach if true?

**4. Establish Baseline**
- What are the current metrics?
- What is "normal" performance?
- What does the trend look like?
- What are the benchmarks?

### Observation Quality Checklist

| Criteria | Question |
|----------|----------|
| **Comprehensive** | Did we look broadly before focusing? |
| **Grounded** | Is our understanding based on data, not assumptions? |
| **Unbiased** | Did we look for disconfirming evidence? |
| **Current** | Is our information up-to-date? |
| **Quantified** | Do we have baseline metrics? |

### Tools for Observation

| Tool | Use For |
|------|---------|
| **Research Skill** | External knowledge, precedent, best practices |
| **Grep/Glob** | Codebase exploration |
| **Metrics/Analytics** | Performance baselines |
| **Council** | Multi-perspective understanding |
| **User Interviews** | Direct feedback (if applicable) |

---

## Phase 2: HYPOTHESIZE - Generating Candidates

### The Plurality Principle

**NEVER generate just one hypothesis.**

Single-hypothesis thinking leads to:
- Confirmation bias (you'll see evidence that supports it)
- Missed alternatives (better solutions exist)
- Overinvestment (sunk cost in one approach)
- Narrow framing (the real solution might be orthogonal)

**Minimum: 3 hypotheses. Better: 5-10 for important problems.**

### The Hypothesis Generation Process

**1. Divergent Phase (Quantity over Quality)**
- Generate as many ideas as possible
- No judgment yet - all ideas welcome
- Build on others' ideas
- Explore orthogonal approaches
- Include contrarian ideas

**2. Categorization Phase**
- Group similar hypotheses
- Identify different "axes" of solution space
- Note which assumptions each hypothesis challenges

**3. Refinement Phase**
- Make each hypothesis specific and testable
- Clarify what success looks like for each
- Identify what would DISPROVE each (falsifiability)

**4. Prioritization Phase**
- Rank by expected value (likelihood × impact)
- Rank by cost to test (cheaper experiments first)
- Identify dependencies between hypotheses

### Hypothesis Quality Checklist

| Criteria | Question |
|----------|----------|
| **Specific** | Is it clear what this hypothesis claims? |
| **Testable** | Can we design an experiment to test it? |
| **Falsifiable** | Could evidence disprove it? |
| **Distinct** | Does it differ meaningfully from other hypotheses? |
| **Actionable** | Would confirming it tell us what to do? |

### Hypothesis Template

```markdown
## Hypothesis: [Short Name]

**Claim:** [What we believe will work]

**Rationale:** [Why we think this might work]

**Testable Prediction:** If this hypothesis is correct, then [observable outcome]

**Falsification Criteria:** This hypothesis is WRONG if [observable outcome]

**Cost to Test:** [Time/resources needed]

**Confidence Level:** [Low/Medium/High] - [Why]
```

### Tools for Hypothesis Generation

| Tool | Use For |
|------|---------|
| **Council Skill** | Multi-perspective brainstorming |
| **RedTeam Skill** | Stress-testing hypotheses |
| **Research Skill** | Finding what's worked elsewhere |
| **Becreative Skill** | Exploring creative approaches |
| **Parallel Agents** | Generating many ideas simultaneously |

---

## Phase 3: EXPERIMENT - Designing Tests

### The Minimum Viable Experiment

**Design the smallest experiment that tests the hypothesis.**

Not every experiment needs to be comprehensive. The goal is LEARNING, not perfection.

Ask:
- What's the fastest way to learn if this works?
- What's the cheapest way to get meaningful data?
- What would DISPROVE the hypothesis?
- What's the minimum sample size for confidence?

### The Experiment Design Process

**1. Define Success Criteria**
- What outcome confirms the hypothesis?
- What outcome refutes the hypothesis?
- What outcome is inconclusive (need more data)?

**2. Design the Test**
- What will we do?
- What will we measure?
- How will we measure it?
- What's the control (if applicable)?

**3. Identify Variables**
- Independent variable (what we're changing)
- Dependent variable (what we're measuring)
- Control variables (what we're keeping constant)
- Confounding variables (what might skew results)

**4. Plan Data Collection**
- What data do we need?
- How will we collect it?
- When will we collect it?
- How much is enough?

**5. Define Stopping Criteria**
- When do we stop the experiment?
- What constitutes "enough" data?
- When do we declare success/failure/inconclusive?

### Experiment Quality Checklist

| Criteria | Question |
|----------|----------|
| **Minimal** | Is this the smallest test that gives meaningful data? |
| **Falsifiable** | Could this experiment prove the hypothesis wrong? |
| **Measurable** | Do we know exactly what we're measuring? |
| **Controlled** | Have we isolated the variable we're testing? |
| **Reproducible** | Could someone else run this experiment? |

### Experiment Template

```markdown
## Experiment: [Name]

**Testing Hypothesis:** [Which hypothesis this tests]

**Method:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Measuring:**
- Primary metric: [What we're measuring]
- Secondary metrics: [Other useful data]

**Success Criteria:**
- Hypothesis CONFIRMED if: [condition]
- Hypothesis REFUTED if: [condition]
- INCONCLUSIVE if: [condition]

**Duration:** [How long to run]

**Resources Needed:** [What's required]
```

### Tools for Experimentation

| Domain | Tools |
|--------|-------|
| **Code** | Worktrees (parallel experiments), TDD, Feature flags |
| **Prompts** | Evals skill, A/B testing |
| **UI/UX** | Worktrees, Chrome MCP, Design variants |
| **Business** | A/B tests, Small launches, Pilot programs |
| **Ideas** | Small audience tests, Draft → feedback loops |

---

## Phase 4: EXECUTE - Running Experiments

### Parallel Execution

**When experiments are independent, run them in parallel.**

This is where PAI shines:
- Multiple worktrees for code experiments
- Multiple agents for research experiments
- Multiple eval runs for prompt experiments

Sequential experiments waste time when parallel is possible.

### The Execution Process

**1. Preparation**
- Verify all prerequisites are met
- Ensure measurement infrastructure is ready
- Confirm success/failure criteria are clear
- Set up logging/data collection

**2. Execution**
- Run the experiment as designed
- Don't change parameters mid-experiment (unless aborting)
- Document any unexpected events
- Capture all relevant data

**3. Observation**
- Monitor progress (don't just set and forget)
- Note anomalies
- Be ready to abort if experiment is clearly failing
- Don't peek at results prematurely (avoid bias)

### Execution Quality Checklist

| Criteria | Question |
|----------|----------|
| **Faithful** | Did we run the experiment as designed? |
| **Complete** | Did we collect all the data we planned? |
| **Documented** | Did we record what happened? |
| **Unbiased** | Did we avoid peeking or adjusting mid-experiment? |

---

## Phase 5: MEASURE - Collecting Data

### Data Collection Principles

**1. Measure What Matters**
Only collect data that relates to the goal. More data ≠ better data.

**2. Quantify Where Possible**
Numbers enable comparison. "It felt faster" < "Load time dropped 40%"

**3. Capture Context**
Numbers without context are meaningless. Record conditions, anomalies, environment.

**4. Preserve Raw Data**
Always keep raw data. Derived metrics can be recalculated; raw data cannot be recovered.

### The Measurement Process

**1. Collect Primary Metrics**
- The main thing you're testing
- Direct measurement of success criteria

**2. Collect Secondary Metrics**
- Supporting context
- Early warning indicators
- Sanity checks

**3. Capture Qualitative Data**
- Observations
- Feedback
- Anomalies
- Surprises

**4. Validate Data Quality**
- Are there outliers?
- Is the data complete?
- Are there obvious errors?
- Do the numbers make sense?

### Measurement Template

```markdown
## Results: [Experiment Name]

**Date:** [When run]
**Duration:** [How long]

**Primary Metrics:**
| Metric | Before | After | Change |
|--------|--------|-------|--------|
| [Name] | [Value] | [Value] | [Δ%] |

**Secondary Metrics:**
| Metric | Value | Notes |
|--------|-------|-------|
| [Name] | [Value] | [Context] |

**Observations:**
- [Notable event 1]
- [Notable event 2]

**Raw Data Location:** [Link/path]
```

---

## Phase 6: ANALYZE - Comparing to Goal

### The Analysis Process

**1. Compare to Success Criteria**
- Did we meet the goal?
- By how much did we exceed or fall short?
- Is the difference statistically significant?

**2. Determine Hypothesis Status**
- CONFIRMED: Evidence supports the hypothesis
- REFUTED: Evidence contradicts the hypothesis
- INCONCLUSIVE: Need more data

**3. Identify Learnings**
- What did we learn?
- What surprised us?
- What does this change about our understanding?

**4. Generate New Questions**
- What new questions emerged?
- What would we do differently?
- What should we explore next?

### Analysis Quality Checklist

| Criteria | Question |
|----------|----------|
| **Objective** | Are we comparing to goal, not to our expectations? |
| **Honest** | Are we acknowledging negative results? |
| **Statistical** | Have we accounted for variance and significance? |
| **Learning-Focused** | Did we extract insights, not just verdicts? |

### Analysis Template

```markdown
## Analysis: [Experiment Name]

**Goal Comparison:**
| Success Criteria | Required | Actual | Status |
|-----------------|----------|--------|--------|
| [Metric 1] | [Value] | [Value] | ✅/❌ |
| [Metric 2] | [Value] | [Value] | ✅/❌ |

**Hypothesis Status:** [CONFIRMED / REFUTED / INCONCLUSIVE]

**Key Learnings:**
1. [Learning 1]
2. [Learning 2]
3. [Learning 3]

**Surprises:**
- [What we didn't expect]

**New Questions:**
- [Question that emerged]

**Implications for Next Iteration:**
- [How this changes our approach]
```

---

## Phase 7: ITERATE - The Feedback Loop

### The Iteration Process

**1. Update World Model**
- What do we now know that we didn't before?
- How does this change our understanding?
- What assumptions were validated or invalidated?

**2. Refine Hypotheses**
- Which hypotheses should we continue exploring?
- Which should we abandon?
- What new hypotheses emerged?

**3. Plan Next Cycle**
- What's the next experiment?
- What's the new goal (if it changed)?
- What's the new observation needed?

**4. Decide: Continue or Ship**
- Have we learned enough?
- Is it time to ship and learn from production?
- Is further experimentation valuable?

### When to Stop Iterating

**Stop when:**
- Goal is achieved
- Further iteration has diminishing returns
- Time/resource constraints require shipping
- The problem has changed (pivot)

**Don't stop because:**
- We're frustrated
- We want to avoid negative results
- The experiment is taking longer than expected
- We're attached to our hypothesis

### The Iteration Anti-Pattern

**Infinite iteration without shipping** is as bad as **shipping without iteration**.

The goal is PROGRESS, not perfection. At some point, ship and learn from production.

---

## Meta: Science Applied to Science

This methodology applies to itself.

**Goal:** Improve how we solve problems

**Observe:** Track which experiments produce insights

**Hypothesize:** Try different experiment designs

**Experiment:** Apply methodology variations

**Measure:** Track learning rate, success rate

**Analyze:** Compare methodology versions

**Iterate:** Evolve the methodology itself

---

## Integration with PAI Skills

### Development Skill
Science manifests as TDD:
- **Goal** = Test (defines expected behavior)
- **Hypothesize** = Implementation approach
- **Experiment** = Write code
- **Measure** = Run tests
- **Analyze** = All green?
- **Iterate** = Refactor

### Evals Skill
Science manifests as prompt evaluation:
- **Goal** = Eval criteria
- **Hypothesize** = Prompt variations
- **Experiment** = Run evals
- **Measure** = Scores
- **Analyze** = Compare to baseline
- **Iterate** = Refine prompt

### Research Skill
Science manifests as investigation:
- **Goal** = Research question
- **Observe** = Literature review
- **Hypothesize** = Possible answers
- **Experiment** = Investigation
- **Measure** = Evidence gathering
- **Analyze** = Synthesize findings
- **Iterate** = Deeper questions

### Council Skill
Science manifests as collaborative exploration:
- **Observe** = Initial positions
- **Hypothesize** = Multiple perspectives
- **Experiment** = Debate rounds
- **Analyze** = Synthesis
- **Iterate** = Refined positions

---

## Summary

The scientific method is not complicated. It's:

1. **Know what you want** (Goal)
2. **Understand where you are** (Observe)
3. **Guess how to get there** (Hypothesize)
4. **Try your guesses** (Experiment)
5. **See what happened** (Measure)
6. **Compare to what you wanted** (Analyze)
7. **Adjust and repeat** (Iterate)

**The power is in the discipline of the cycle, not any individual step.**

Apply this everywhere. To code. To products. To ideas. To life.

This is how progress happens.
