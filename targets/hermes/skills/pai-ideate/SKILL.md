---
name: pai-ideate
description: "9-phase evolutionary ideation engine: CONSUME -> DREAM -> DAYDREAM -> CONTEMPLATE -> STEAL -> MATE -> TEST -> EVOLVE -> META-LEARN. Integrates IterativeDepth, RedTeam, and Council internally for multi-lens exploration. USE WHEN evolving a rough idea into something refined through structured creative phases — from initial consumption through mutation, testing, and meta-learning. NOT FOR one-shot idea generation, convergent problem-solving, or tasks with a single correct solution."
version: 5.0.0
author: PAI v5.0 → Hermes Port
license: MIT
metadata:
  hermes:
    tags: [pai, thinking, ideation, creativity, evolution, idea-generation]
    related_skills: [pai-be-creative, pai-iterative-depth, pai-red-team, pai-science]
---

<!-- Voice notification — fire-and-forget on invocation -->
```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the pai-ideate skill"}' \
  > /dev/null 2>&1 &
```


# Ideate — Evolutionary Ideation

## Overview

A complete ideation lifecycle that evolves a rough seed idea through 9 structured phases into a refined, tested concept. Each phase builds on the previous, integrating multiple thinking capabilities (IterativeDepth, RedTeam, Council) at specific points.

**Core principle:** Ideas are not born fully formed. They evolve through consumption, incubation, recombination, and testing.

## When to Use

| Signal | Example |
|--------|---------|
| Have a rough idea that needs development | "I have a starting point but it's not fully formed" |
| Need a creative solution to a defined problem | "We need to solve X creatively" |
| Existing approaches aren't working | "Everything we've tried has failed" |
| Product/feature ideation | "We need something new in this space" |
| Starting from scratch on a creative brief | "Here's the problem, go create" |

## Routing Table

| Input Pattern | Route |
|---------------|-------|
| "I have a vague idea, help me develop it" | Full 9-phase loop |
| "Generate new ideas for [problem]" | CONSUME → DREAM → DAYDREAM then select |
| "I have too many ideas, refine them" | CONTEMPLATE → MATE → TEST |
| "Improve an existing concept" | STEAL → MATE → EVOLVE |
| "Learn from my ideation process" | META-LEARN phase only |
| "Quick ideation session" | DREAM → TEST (compressed) |

## 9-Phase Evolutionary Loop

### Phase 1: CONSUME

**Purpose:** Feed the mind with relevant material. Ideas need fuel.

**Procedure:**

1. **Research the problem space:**
   ```
   - What already exists? (competitors, prior art)
   - What are the known approaches?
   - What are the pain points with existing solutions?
   - What constraints must we work within?

   Use web_search for competitive analysis
   Use read_file for internal documentation
   Use delegate_task for parallel research
   ```

2. **Research adjacent spaces:**
   ```
   - What works in related domains?
   - What analogous problems have been solved?
   - What approaches from other fields might apply?
   ```

3. **Collect inspiration:**
   ```
   - Save examples, patterns, and anti-patterns
   - Note what you appreciate and what you'd change
   - Identify gaps in the current landscape
   ```

**Output:** Research brief with competitive landscape, adjacent inspirations, and identified gaps.

### Phase 2: DREAM

**Purpose:** Unconstrained generation. No judgment, no filtering.

**Procedure:**

1. **Generate freely:**
   ```
   - Quantity over quality (target: 20+ ideas)
   - No criticism during generation
   - Include wild, impractical ideas
   - Build on previous ideas (yes, and...)
   ```

2. **Use prompts for variety:**
   ```
   - What would an ideal solution look like with unlimited resources?
   - What's the most counterintuitive approach?
   - What would a 10x improvement look like?
   - What would a child/novice/expert in a different field propose?
   ```

**Output:** Raw idea list (20+ items, uncurated).

### Phase 3: DAYDREAM

**Purpose:** Incubation — let the subconscious work. Step away from active generation.

**Procedure:**

1. **Take a break from active ideation:**
   ```
   - Do something unrelated for several minutes
   - Let the mind wander
   - Do not force connections
   ```

2. **Return and capture:**
   ```
   - Note any ideas that surfaced during incubation
   - Note any connections you see
   - Note any feelings about certain ideas (often subconscious evaluation)
   ```

**Output:** Incubation notes — emergent ideas and felt evaluations.

### Phase 4: CONTEMPLATE

**Purpose:** Deep, structured reflection on the generated ideas.

**Procedure:**

1. **Cluster ideas by theme:**
   ```
   - Group similar ideas
   - Identify underlying patterns
   - Note which clusters feel most promising
   ```

2. **Evaluate each cluster:**
   ```
   Criteria:
   - Novelty: How different from existing approaches?
   - Feasibility: Can we actually build this?
   - Impact: How much does this improve things?
   - Alignment: Does this fit our constraints and goals?
   ```

3. **Select top 3-5 candidates:**
   ```
   From the clusters, pick the most promising directions.
   Don't commit yet — just narrow the field.
   ```

**Output:** Clustered and evaluated idea set with top candidates identified.

### Phase 5: STEAL

**Purpose:** Deliberately borrow and adapt from other domains. Nothing is truly original.

**Procedure:**

1. **Identify parallel domains:**
   ```
   - Domains with similar structural problems
   - Domains with elegant solutions to analogous challenges
   - Unrelated domains that might have transferable patterns
   ```

2. **Extract mechanisms, not products:**
   ```
   Don't copy the surface. Extract the underlying mechanism:
   - How does it work at a functional level?
   - What principle makes it effective?
   - What would this look like in our domain?
   ```

3. **Apply to each top candidate:**
   ```
   For each candidate idea:
   - Apply 2-3 mechanisms from other domains
   - How does it transform the idea?
   - What new possibilities emerge?
   ```

**Output:** Enriched ideas with borrowed mechanisms from adjacent domains.

### Phase 6: MATE

**Purpose:** Combine ideas to create stronger hybrids.

**Procedure:**

1. **Cross-pollinate:**
   ```
   - Combine features from different top candidates
   - Merge a strong mechanism with a strong domain fit
   - Resolve weaknesses of A with strengths of B
   ```

2. **Create integrated concepts:**
   ```
   For each combination:
   - Describe the integrated concept
   - What does A contribute?
   - What does B contribute?
   - What emerges that neither had alone?
   ```

3. **Refine to 2-3 strong integrated concepts.**

**Output:** 2-3 hybrid concepts with traceability to source ideas.

### Phase 7: TEST

**Purpose:** Stress-test concepts before investing further.

**Procedure:**

1. **Apply Red Team analysis to each concept:**
   ```
   Use pai-red-team workflow (delegate_task for parallel adversarial agents):
   - Find weaknesses and failure modes
   - Identify hidden assumptions
   - Surface implementation risks
   ```

2. **Apply practical feasibility check:**
   ```
   - Can we actually build/deliver this?
   - What resources would it require?
   - What's the simplest version that works?
   ```

3. **Score concepts:**
   ```
   Score each concept on:
   - Novelty (1-5)
   - Feasibility (1-5)
   - Impact (1-5)
   - Risk (1-5, inverted)
   Select the highest-scoring concept(s)
   ```

**Output:** Tested concept with scored evaluation and identified risks.

### Phase 8: EVOLVE

**Purpose:** Iterative refinement of the selected concept.

**Procedure:**

1. **Identify improvement opportunities:**
   ```
   - From Red Team findings: what needs strengthening?
   - From feasibility check: what needs simplifying?
   - From original goals: what's drifting off-mission?
   ```

2. **Make targeted improvements:**
   ```
   - Strengthen weak aspects
   - Simplify over-complex aspects
   - Remove elements that don't serve the core purpose
   ```

3. **Re-test critical changes:**
   ```
   - Does each change make the concept better?
   - Avoid feature creep — only change what needs changing
   ```

**Output:** Refined concept version with documented evolution.

### Phase 9: META-LEARN

**Purpose:** Capture process insights to improve future ideation.

**Procedure:**

1. **Review the ideation process:**
   ```
   - Which phases were most productive?
   - Which were bottlenecks?
   - What would you do differently next time?
   ```

2. **Capture learnings:**
   ```
   Write to execution log and/or MEMORY:
   - What phase surprised you?
   - What technique worked unexpectedly well?
   - What would you skip?
   ```

3. **Identify pattern for next time:**
   ```
   Based on what worked:
   - Build a custom workflow for similar future problems
   - Note which research angles were most valuable
   ```

**Output:** Process review with improvement recommendations for next ideation.

## Compressed Mode (Quick)

When time is limited:

```
1. CONSUME (condensed) — 3 quick research angles
2. DREAM — 10 ideas, not 20
3. CONTEMPLATE — Quick cluster and score
4. STEAL — Apply one mechanism from adjacent domain
5. TEST — Ask 3 hard questions, not full Red Team
```

## Hermes Tools Integration

| Phase | Tool | Usage |
|-------|------|-------|
| CONSUME | `web_search`, `read_file`, `delegate_task` | Research |
| DREAM | `terminal`, `write_file` | Idea capture |
| DAYDREAM | (wait/break) | Incubation |
| CONTEMPLATE | `terminal` | Clustering, scoring |
| STEAL | `web_search` | Cross-domain inspiration |
| MATE | `write_file` | Hybrid concept docs |
| TEST | `delegate_task` | Parallel Red Team |
| EVOLVE | `terminal`, `write_file` | Refinement |
| META-LEARN | `read_file`, `terminal` | Process review |

## Gotchas / Pitfalls

### 1. Skipping DAYDREAM
**Problem:** Rushing from generation to evaluation without incubation.
**Fix:** DAYDREAM is not optional. Even 5 minutes of unrelated activity produces measurably better evaluation.

### 2. Falling in Love Too Early
**Problem:** Committing to an idea before testing it.
**Fix:** Don't pick a favorite until at least Phase 7. Treat all candidates skeptically.

### 3. Insufficient CONSUME
**Problem:** Generating ideas without understanding the landscape.
**Fix:** You can't generate good ideas in a vacuum. Spend at least 20% of total time on consumption.

### 4. Premature STEAL
**Problem:** Borrowing from other domains before having your own ideas.
**Fix:** Only start STEAL after you have original ideas to enrich. Stealing before dreaming produces derivative work.

### 5. Feature Creep in EVOLVE
**Problem:** Adding more features instead of refining the core.
**Fix:** In EVOLVE, ask "what can I remove?" as often as "what can I add?"

## Execution Log

After every invocation:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"pai-ideate","phases":"CONSUME,DREAM,DAYDREAM,CONTEMPLATE,STEAL,MATE,TEST,EVOLVE,META-LEARN","status":"ok","duration_s":SECONDS}' >> ~/.hermes/pai/MEMORY/SKILLS/execution.jsonl
```
