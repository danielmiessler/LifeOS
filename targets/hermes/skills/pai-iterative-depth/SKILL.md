---
name: pai-iterative-depth
description: "Multi-angle sequential exploration using 20 grounded techniques. 2-8 sequential passes through systematically different perspectives. Each pass uses a different lens from a library of 20 rigorous techniques."
version: 1.0.0
author: PAI v5.0 → Hermes Port
license: MIT
metadata:
  hermes:
    tags: [pai, thinking, iterative, multi-angle, exploration, depth]
    related_skills: [pai-aperture-oscillation, pai-systems-thinking, pai-ideate]
---

# Iterative Depth — Multi-Angle Sequential Exploration

## Overview

Examine a problem through systematically different perspectives across 2-8 sequential passes. Each pass uses a distinct, grounded technique from a library of 20. After all passes, synthesize findings across perspectives.

**Core principle:** No single lens reveals the full picture. The intersection of multiple perspectives reveals insights invisible to any one angle.

## When to Use

| Signal | Example |
|--------|---------|
| Problem feels one-dimensional | "We keep looking at this the same way" |
| Need comprehensive understanding | "I want to really understand this" |
| Stuck in a single frame | "Maybe I'm looking at this wrong" |
| Multi-stakeholder issue | "Different people see this differently" |
| Creative block on complex problem | "I've exhausted my usual approaches" |

## Routing Table

| Input Pattern | Route |
|---------------|-------|
| "Explore this from every angle" | Full 8-pass with varied techniques |
| "I need a different perspective" | 2-4 pass with deliberately contrasting techniques |
| "Understanding a complex concept" | Hermeneutic Circle + Historical + Dialectical |
| "Making a decision with trade-offs" | Ethical + Practical + Aesthetic |
| "Design/creative problem" | Aesthetic + Historical + Comparative |

## 20 Grounded Techniques

| # | Technique | Core Question | Best For |
|---|-----------|---------------|----------|
| 1 | **Hermeneutic Circle** | How does each part relate to the whole? | Deep understanding of texts/systems |
| 2 | **Six Thinking Hats** | What would [neutral/emotional/cautious/optimistic/creative/structured] thinking reveal? | Decision-making, team alignment |
| 3 | **Dialectical** | What is the thesis, antithesis, and synthesis? | Resolving contradictions |
| 4 | **Historical** | How did we get here? What patterns recur? | Understanding path dependence |
| 5 | **Comparative** | How does this compare to alternatives? | Evaluating options |
| 6 | **Ethical** | What are the moral dimensions and stakeholders? | Value-sensitive decisions |
| 7 | **Practical** | How does this work in practice vs. theory? | Implementation planning |
| 8 | **Aesthetic** | What makes this elegant, beautiful, or coherent? | Design, architecture, art |
| 9 | **Structural** | What are the underlying systems and flows? | Complex systems |
| 10 | **Temporal** | How does this play out over time? | Strategy, forecasting |
| 11 | **Spatial** | What's the physical layout or topology? | Physical systems, geography |
| 12 | **Relational** | Who are the stakeholders and their relationships? | Organizational problems |
| 13 | **Economic** | What are the costs, incentives, and value flows? | Business decisions |
| 14 | **Ecological** | What are the resource flows and environmental impacts? | Sustainability |
| 15 | **Narrative** | What story is being told? Whose voice is missing? | Communication, culture |
| 16 | **Paradoxical** | What contradictions are inherently true? | Deep insights, innovation |
| 17 | **Bodily/Embodied** | What's the physical or sensory experience? | UX, product design |
| 18 | **Game-Theoretic** | How would strategic actors behave? | Strategy, negotiation |
| 19 | **Network** | What are the connection patterns and node roles? | Distributed systems, organizations |
| 20 | **Contrarian** | What if the opposite is true? | Stress-testing, blind spots |

## Procedure: 2-8 Pass Execution

### Step 1: Select Techniques

```
Select 2-8 techniques based on problem type.

Minimum diversity rule: No two techniques from the same category.
- Cognitive: Hermeneutic Circle, Six Thinking Hats, Dialectical, Narrative
- Temporal: Historical, Temporal
- Spatial: Spatial, Structural, Network
- Evaluative: Comparative, Ethical, Practical, Economic, Contrarian
- Creative: Aesthetic, Paradoxical, Bodily
- Strategic: Game-Theoretic, Relational, Ecological

Example selection for a product decision:
Pass 1: Six Thinking Hats (cognitive)
Pass 2: Historical (temporal)
Pass 3: Comparative (evaluative)
Pass 4: Paradoxical (creative)
Pass 5: Game-Theoretic (strategic)
```

### Step 2: Execute Each Pass Sequentially

For each pass:

```
1. Read prior pass outputs (to build, not repeat)
2. Apply the technique to the problem
3. Document findings structured by technique
4. Note: new insights, contradictions with prior passes, deepened understanding
```

**Example pass output:**

```
=== Pass 3: Comparative ===
Technique: Compare to alternatives
Applied to: [Problem] 
Comparisons made:
- [Alternative A]: Similar in X, different in Y → insight about Y
- [Alternative B]: Opposite approach → reveals hidden assumption about Z
Key findings:
1. [Finding specific to this lens]
2. [Finding that contradicts prior pass]
3. [Finding that deepens prior pass understanding]
```

### Step 3: Synthesize Across Passes

After all passes complete:

```
1. Map findings from each pass to common themes
2. Identify contradictions across passes (these are the richest insights)
3. Assess which perspectives were most revealing
4. Generate integrated understanding:
   - What do multiple lenses agree on? (high confidence)
   - What does only one lens reveal? (unique insight, flag for verification)
   - What do different lenses disagree on? (tension, needs exploration)
```

### Step 4: Determine if Additional Passes Needed

```
Continue if:
- Contradictions remain unresolved
- A new technique suggests itself based on findings
- Coverage is insufficient for the decision at hand

Stop if:
- Findings are converging (diminishing returns)
- 8 passes reached (max)
- Sufficient understanding for the purpose
```

## Pass Count Guidance

| Passes | When |
|--------|------|
| 2 | Quick check, need another angle fast |
| 3 | Standard diversity check |
| 4 | Thorough exploration |
| 5-6 | Complex problem with high stakes |
| 7-8 | Maximum depth, existential/philosophical questions |

## Hermes Tools Integration

| Step | Tool | Usage |
|------|------|-------|
| Select techniques | `read_file` | Reference technique library |
| Execute pass | `terminal`, `write_file` | Document pass findings |
| Synthesize | `delegate_task` | Parallel pass analysis |
| Deepen | `web_search` | Research specific angles |
| All passes | `read_file` | Prior pass outputs |

## Gotchas / Pitfalls

### 1. Shallow Passes
**Problem:** Each pass produces superficial observations rather than deep analysis.
**Fix:** Spend at least 2-3 minutes in each technique. If you can write the finding in one sentence, you haven't gone deep enough.

### 2. Lens Fatigue
**Problem:** Passes 5+ produce diminishing returns because you're mentally exhausted.
**Fix:** Take a break between passes. Or reduce pass count — 4 good passes > 8 shallow ones.

### 3. Premature Synthesis
**Problem:** Synthesizing before all passes complete, biasing later passes.
**Fix:** Treat each pass independently. Do NOT attempt to integrate until all passes are done.

### 4. Technique Loyalty
**Problem:** Favoring techniques you're comfortable with.
**Fix:** Force yourself to include 1-2 techniques you don't normally use. The discomfort signals value.

### 5. Contradiction Avoidance
**Problem:** Smoothing over contradictions between passes.
**Fix:** Contradictions between different lenses are the most valuable output. Surface them explicitly.

## Execution Log

After every invocation:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"pai-iterative-depth","passes":N,"techniques":"TECH1,TECH2,...","status":"ok","duration_s":SECONDS}' >> ~/.hermes/profiles/dev/pai/MEMORY/SKILLS/execution.jsonl
```
