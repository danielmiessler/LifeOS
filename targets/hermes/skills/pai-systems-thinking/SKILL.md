---
name: pai-systems-thinking
description: "Structural analysis of complex problems using the Iceberg Model, Causal Loop Diagrams, 12 Leverage Points, and 10 canonical Archetypes. 5 workflows for understanding system behavior, feedback loops, and intervention points."
version: 1.0.0
author: PAI v5.0 → Hermes Port
license: MIT
metadata:
  hermes:
    tags: [pai, thinking, systems-thinking, feedback-loops, leverage-points, archetypes]
    related_skills: [pai-first-principles, pai-root-cause-analysis, pai-iterative-depth]
---

# Systems Thinking

## Overview

Analyze problems through a structural lens — looking beyond events to the patterns, system structures, and mental models that generate them. Based on the work of Donella Meadows, Peter Senge, and Jay Forrester.

**Core insight:** The same problem will recur until the system structure that generates it is changed.

## When to Use

| Signal | Example |
|--------|---------|
| Same problems keep occurring | "Why do we keep having this outage?" |
| Actions have unintended consequences | "We fixed X but Y got worse" |
| Delayed feedback | "We made a change but don't see results yet" |
| Multiple stakeholders with conflicting views | "Everyone sees the problem differently" |
| Complex, interconnected issues | "Everything affects everything else" |

## Routing Table

| User Need | Route |
|-----------|-------|
| "Understand this system" | Full Iceberg + Causal Loop diagram |
| "Where should I intervene?" | Leverage Point analysis |
| "This pattern looks familiar" | Archetype matching |
| "Fix recurring problem" | Archetype + Leverage Point combo |
| "Why did my fix backfire?" | Causal Loop + Feedback analysis |
| "Map the stakeholders" | Mental Model identification (Iceberg lower levels) |

## 5 Workflows

### Workflow 1: Iceberg Model — Multi-Level Analysis

**Purpose:** See beyond surface events to underlying structures.

**Procedure:**

1. **Events** (tip of iceberg — what's visible):
   ```
   List recent notable events
   Use read_file for incident reports
   Use web_search for external context
   ```

2. **Patterns/Trends** (just below surface):
   ```
   Identify: What patterns do these events follow?
   Look for: recurrence, seasonality, acceleration
   Ask: Has this happened before? How often?
   ```

3. **System Structure** (deeper):
   ```
   Map: What structures generate these patterns?
   Consider: Policies, physical infrastructure, information flows, incentives, power structures
   Use terminal to draw causal loop diagram
   ```

4. **Mental Models** (deepest level):
   ```
   Surface: What beliefs/values create these structures?
   Ask: What do people believe about how this works?
   Ask: What assumptions are baked into the system?
   ```

**Output:** Four-level iceberg map with connections between levels.

### Workflow 2: Causal Loop Diagramming

**Purpose:** Map feedback structures that drive system behavior.

**Procedure:**

1. **Identify variables** — Key elements that change over time
2. **Identify connections** — How does A affect B? (+ for same direction, - for opposite)
3. **Find feedback loops:**
   - **Reinforcing (R)** — Amplifies change (snowballing, virtuous/vicious cycles)
   - **Balancing (B)** — Resists change (goal-seeking, stabilizing)
4. **Identify delays** — Where do effects take time to appear?

```
Format example:
[Population] --(+)--> [Births] --(+)--> [Population]     (R: growth)
[Population] --(+)--> [Deaths] --(+)--> [Population]     (B: balancing, with delay)
```

**Output:** Causal loop diagram with labeled R (reinforcing) and B (balancing) loops.

### Workflow 3: 12 Leverage Points (Meadows)

**Purpose:** Identify where to intervene for maximum effect.

**Procedure — scan from least to most effective:**

| # | Leverage Point | Question to Ask |
|---|---------------|-----------------|
| 12 | Constants/parameters | Can we change the numbers? |
| 11 | Buffer sizes | Can we change the system's capacity to absorb shock? |
| 10 | Stock-and-flow structures | Can we change the physical layout/infrastructure? |
| 9 | Delays | Can we shorten or lengthen feedback delays? |
| 8 | Balancing feedback loops | Can we strengthen negative feedback that corrects problems? |
| 7 | Reinforcing feedback loops | Can we weaken destructive amplifying loops? |
| 6 | Information flows | Can we give people better data to act on? |
| 5 | Rules/incentives | Can we change the reward structure? |
| 4 | Self-organization | Can we let the system evolve its own structure? |
| 3 | Goals | Can we change the system's purpose? |
| 2 | Paradigms | Can we shift the fundamental mindset? |
| 1 | Transcending paradigms | Can we operate without attachment to any paradigm? |

**Output:** Leverage point ranking for the specific system, with action recommendations at each level.

### Workflow 4: Canonical Archetype Matching

**Purpose:** Recognize common system patterns and apply known solutions.

**10 Archetypes:**

| Archetype | Pattern | Fix |
|-----------|---------|-----|
| **1. Fixes That Fail** | Quick fix works briefly, problem returns | Address root cause, not symptom |
| **2. Shifting the Burden** | Dependence on symptomatic solution grows | Strengthen fundamental solution capacity |
| **3. Limits to Success** | Growth hits a plateau | Remove or raise the limiting factor |
| **4. Drifting Goals** | Standards erode as performance lags | Set absolute standards, not relative |
| **5. Success to the Successful** | Winners keep winning (rich get richer) | Create separate tracks or redistribute resources |
| **6. Tragedy of the Commons** | Shared resource depleted by individual use | Establish shared governance |
| **7. Growth and Underinvestment** | Growth stalls because capacity wasn't added | Invest proactively based on demand signals |
| **8. Escalation** | Tit-for-tat spiral | Unilateral de-escalation or new rules |
| **9. Accidental Adversaries** | Allies become enemies due to misunderstanding | Improve communication + shared mental models |
| **10. Attractiveness Principle** | Too many goals dilute focus | Prioritize one dimension of attractiveness |

**Procedure:**
```
1. Describe the problem in one paragraph
2. Match against archetype patterns above
3. If multiple match, look for nested archetypes
4. Apply the known fix pattern for matched archetype
```

### Workflow 5: Intervention Design

**Purpose:** Design a system intervention based on the above analyses.

1. **Map the current system** (Iceberg + Causal Loops)
2. **Identify archetype patterns** present
3. **Rank leverage points** from most accessible to most impactful
4. **Design intervention** targeting at least leverage point #6 or higher
5. **Anticipate side effects** — what new loops might the intervention create?
6. **Design monitoring** — what metrics will indicate success or unwanted side effects?

## Hermes Tools Integration

| Workflow | Tool | Usage |
|----------|------|-------|
| Iceberg | `read_file`, `delegate_task` | Gather event data across multiple perspectives |
| Causal Loops | `terminal` | Draw/write CLD files |
| Leverage Points | `delegate_task` | Parallel analysis of each leverage level |
| Archetype | `read_file` | Reference library of archetype descriptions |
| Intervention | `write_file` | Create intervention plan document |
| Verification | `web_search` | Check for similar systems and known outcomes |

## Gotchas / Pitfalls

### 1. Mistaking Events for Structure
**Problem:** Describing events in detail instead of the structures that produce them.
**Fix:** For every event, ask "What structure made this event likely?"

### 2. Loop Counting as Analysis
**Problem:** Drawing a CLD and calling it done.
**Fix:** A diagram is a tool, not an output. The value is in insights about leverage, delays, and unintended consequences.

### 3. Archetype Misdiagnosis
**Problem:** Applying "Tragedy of the Commons" to something that's actually "Fixes That Fail."
**Fix:** Check: is the problem resource sharing (Commons) or symptom treatment (Fixes)?

### 4. Ignoring Delays
**Problem:** Underestimating how long feedback takes.
**Fix:** Explicitly mark delays on CLDs. Revisit when expected changes don't materialize on schedule.

### 5. Overconfidence in Leverage Points
**Problem:** Assuming high-numbered leverage points (paradigm shifts) are always achievable.
**Fix:** Match leverage point to the sphere of control. A paradigm shift may be leverage point #2 but requires cultural change you can't command.

## Execution Log

After every invocation:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"pai-systems-thinking","workflow":"WORKFLOW_NAME","status":"ok","duration_s":SECONDS}' >> ~/.hermes/profiles/dev/pai/MEMORY/SKILLS/execution.jsonl
```
