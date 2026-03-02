# The Science Protocol

**Skills don't call Science. They implement it.**

This document defines the Science Protocol - the interface that skills embody when they apply systematic, evidence-based iteration to their domain.

---

## The Core Insight

Science is not a service that other skills invoke. It's a **protocol they implement**.

Like how TCP/IP defines communication patterns without caring what's being communicated, Science defines the iteration pattern without caring what domain it's applied to.

**The Distinction:**

| Model | Description | Coupling |
|-------|-------------|----------|
| **Service (Wrong)** | Development calls Science.analyze() | High - Science must know all skills |
| **Protocol (Right)** | Development implements ScienceProtocol | Low - Skills are independently compliant |

---

## The Protocol Interface

Any Science-compliant workflow exhibits these behaviors:

```typescript
interface ScienceProtocol {
  // Phase 0: What are we trying to achieve?
  goal: {
    successCriteria: string[];      // How will we know we succeeded?
    measurableIndicators: Metric[]; // What numbers define success?
    constraints: string[];          // What are our limits?
    antiGoals?: string[];           // What are we NOT trying to do?
  };

  // Phase 1: What is the current state?
  observe(): Observation;

  // Phase 2: What might work? (MUST be plural)
  hypothesize(): Hypothesis[];  // Minimum 3

  // Phase 3-4: Design and run tests
  experiment(hypothesis: Hypothesis): ExperimentResult;

  // Phase 5-6: What happened? How does it compare?
  measure(result: ExperimentResult): Measurement;
  analyze(measurement: Measurement, goal: Goal): Analysis;

  // Phase 7: What's next?
  iterate(analysis: Analysis): NextAction;
}
```

---

## How Skills Implement Science

Skills don't import Science. They declare compliance through structure and behavior.

### Development (TDD)

```yaml
skill: Development
implements: Science
mapping:
  goal: Test assertion defines expected behavior
  observe: Read existing code, understand context
  hypothesize: Generate implementation approaches
  experiment: Write code following TDD Red-Green-Refactor
  measure: Run tests, check coverage
  analyze: All green? Meets spec?
  iterate: Refactor, or move to next feature
```

**The Cycle:**
```
Write Test (GOAL) → Run Test (OBSERVE - it fails) →
Think of Fix (HYPOTHESIZE) → Write Code (EXPERIMENT) →
Run Test (MEASURE) → Pass/Fail? (ANALYZE) →
Refactor or Continue (ITERATE)
```

### Evals (Prompt Optimization)

**Evals is the canonical Science implementation for prompts.**

When doing prompt experiments, DO NOT build ad-hoc evaluation. Invoke Evals directly.

```yaml
skill: Evals
implements: Science
mapping:
  goal: Eval criteria (threshold, metrics) - pre-committed before running
  observe: Baseline prompt performance measurement
  hypothesize: Prompt variations with FALSIFIABLE claims
  experiment: Run eval suite with position swapping, multi-judge panels
  measure: Scores, SEM, confidence intervals
  analyze: Compare to pre-committed threshold, statistical significance
  iterate: Refine prompt, try next hypothesis, or declare success
```

**The Cycle:**
```
Define Use Case (GOAL) → Run Baseline (OBSERVE) →
Generate Variants (HYPOTHESIZE) → Compare Prompts (EXPERIMENT) →
Collect Scores (MEASURE) → Statistical Analysis (ANALYZE) →
Pick Winner or Refine (ITERATE)
```

**Evals adds domain-specific rigor:**
- **Position swapping** - mitigates LLM positional bias
- **Multi-judge panels** - reduces model quirks (7x cheaper than single large judge)
- **Reasoning-first scoring** - 13%+ accuracy improvement
- **Paradigm check** - when to question the entire eval framework

### Research (Investigation)

```yaml
skill: Research
implements: Science
mapping:
  goal: Research question to answer
  observe: Literature review, existing knowledge
  hypothesize: Possible answers to investigate
  experiment: Deep investigation of each hypothesis
  measure: Evidence gathering, source quality
  analyze: Synthesize findings
  iterate: Deeper questions emerge
```

### Council (Debate)

```yaml
skill: Council
implements: Science
mapping:
  goal: Decision to make
  observe: Initial positions from each perspective
  hypothesize: Multiple viewpoints as competing hypotheses
  experiment: Structured debate rounds
  measure: Arguments, counterarguments
  analyze: Synthesis, convergence points
  iterate: Refined positions until consensus
```

### Worktree (Parallel Experiments)

```yaml
skill: Development/Worktree
implements: Science
mapping:
  goal: Find best implementation approach
  observe: Base branch state
  hypothesize: Named variant approaches
  experiment: Parallel development in worktrees
  measure: Code quality, test results, performance
  analyze: Compare implementations
  iterate: Pick winner, merge, cleanup
```

### RedTeam (Adversarial Analysis)

```yaml
skill: RedTeam
implements: Science
mapping:
  goal: Strongest possible argument/product
  observe: Original argument or design
  hypothesize: Attack vectors (32 agents generate them)
  experiment: Multi-agent assault on every angle
  measure: Vulnerability scores
  analyze: Steelman response to each attack
  iterate: Refined, attack-hardened output
```

---

## Protocol Compliance Markers

Skills can declare compliance in their SKILL.md frontmatter:

```yaml
---
name: Development
description: ...
implements: Science
science_cycle_time: micro  # micro, meso, macro
---
```

This is **documentation of the mapping**, not runtime coupling.

---

## Integration Points (When Science Orchestrates)

Science explicitly orchestrates only when:

1. **Cross-domain problems** - The problem spans multiple skills
2. **Explicit experimentation requests** - "Try 3 approaches and compare"
3. **Novel problems** - No existing skill pattern fits

**Orchestration Flow:**

```
User: "Figure out best auth approach"
           │
           ▼
┌─────────────────────────────────────────┐
│           SCIENCE ORCHESTRATES           │
└─────────────────────────────────────────┘
           │
           ├──► Goal: Research Skill helps define success criteria
           │
           ├──► Observe: Research Skill gathers context
           │
           ├──► Hypothesize: Council Skill generates approaches
           │
           ├──► Experiment: Worktree runs parallel implementations
           │
           ├──► Measure: Evals Skill compares approaches
           │
           ├──► Analyze: Science synthesizes results
           │
           └──► Iterate: Pick winner or refine
```

---

## Handoff Boundaries

### What Science Provides to Skills

| To Skill | Science Provides |
|----------|------------------|
| Development | Hypothesis to test, success criteria |
| Evals | What to measure, baseline comparison |
| Research | Research questions, scope |
| Council | Options to debate, judgment criteria |
| Worktree | Variant names, comparison criteria |

### What Skills Provide to Science

| From Skill | Skill Provides |
|------------|----------------|
| Development | Test results, coverage metrics |
| Evals | Scores, statistical analysis |
| Research | Findings, evidence quality |
| Council | Synthesis, convergence points |
| Worktree | Diff analysis, recommendations |

---

## Scale-Appropriate Protocol Adherence

| Scale | Cycle Time | Protocol Adherence | State Management |
|-------|------------|-------------------|------------------|
| **Micro** | Seconds-Minutes | Implicit (internalized) | None needed |
| **Meso** | Hours-Days | Explicit when stuck | `.science/` directory |
| **Macro** | Weeks-Months | Formal documentation | Global registry |
| **Meta** | Months-Years | Constitutional | Skill versioning |

**Key Principle:** Don't over-formalize micro-scale work. Let the protocol be implicit until you need its structure.

---

## The Self-Reference Property

Science applies to itself.

The Science skill MUST be able to improve its own methodology using the scientific method:

1. **Goal:** Improve problem-solving effectiveness
2. **Observe:** Track experiment outcomes across domains
3. **Hypothesize:** Try methodology variations
4. **Experiment:** Apply variations to real problems
5. **Measure:** Learning rate, success rate, iteration speed
6. **Analyze:** Compare methodology versions
7. **Iterate:** Update Science documentation

This is tracked in `Meta/` directory.

---

## Bidirectional Skill Integration

### Science → Evals

When Science encounters prompt optimization:

1. **Recognize the domain** - "This is a prompt experiment"
2. **Delegate to specialist** - Invoke Evals skill directly
3. **Use Evals infrastructure** - Don't reinvent position swapping, multi-judge, etc.
4. **Accept Evals output** - Scores, statistics, recommendations

**The directive:** If experimenting with prompts, use Evals. Period.

### Evals → Science

When Evals gets stuck or needs broader framing:

1. **Paradigm check trigger** - 3+ iterations without improvement
2. **Invoke Science explicitly** - `Science/Workflows/StructuredInvestigation.md`
3. **Question the frame** - Is the use case defined correctly? Are we measuring the right thing?
4. **Return with clarity** - New hypothesis, new direction, or confirmation to continue

**The escalation path:** Evals runs implicitly as Science. When implicit fails, go explicit.

### When Science Orchestrates Across Skills

For problems spanning prompt AND code AND research:

```
User: "Improve the summarization pipeline"
           │
           ▼
┌─────────────────────────────────────────┐
│           SCIENCE ORCHESTRATES           │
└─────────────────────────────────────────┘
           │
           ├──► Goal: What does "better" mean? (Science/DefineGoal)
           │
           ├──► Observe: Current performance across dimensions
           │
           ├──► Hypothesize: Multiple improvement paths
           │    ├─ Better prompt (→ Evals)
           │    ├─ Better code (→ Development/Worktree)
           │    └─ Better architecture (→ Research)
           │
           ├──► Experiment: Parallel experiments via appropriate skills
           │
           ├──► Measure: Aggregate results from each skill
           │
           └──► Iterate: Pick winner, next cycle
```

Science orchestrates; specialist skills execute.

---

## Summary

**Science is not a skill you call. It's a pattern you embody.**

- Skills implement the protocol independently
- No runtime coupling required
- Science orchestrates only for cross-domain coordination
- Scale determines formality level
- The protocol improves itself through its own application
- **Evals is the canonical implementation for prompts**
- **When Evals stalls, escalate to explicit Science workflows**
