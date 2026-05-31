---
name: pai-be-creative
description: "Divergent ideation via Verbalized Sampling — a research-backed technique producing demonstrably more diverse outputs. 7 workflows: Standard, Maximum, IdeaGeneration, TreeOfThoughts, DomainSpecific, Technical, SyntheticDataExpansion."
version: 1.0.0
author: PAI v5.0 → Hermes Port
license: MIT
metadata:
  hermes:
    tags: [pai, thinking, creativity, divergent-thinking, ideation, verbalized-sampling]
    related_skills: [pai-ideate, pai-iterative-depth, pai-science]
---

# Be Creative — Divergent Ideation via Verbalized Sampling

## Overview

A structured approach to divergent thinking that uses Verbalized Sampling — explicitly externalizing the exploration process through language rather than relying solely on latent-space sampling. Research shows this produces more diverse, novel outputs compared to standard prompting approaches.

**Core mechanism:** Instead of relying on the model's internal randomness, explicitly narrate the search space, evaluate diversity, and make directed jumps.

## When to Use

| Signal | Example |
|--------|---------|
| Need genuinely novel ideas | "I don't want incremental improvements" |
| Brainstorming session | "We need 20 ideas, not 3" |
| Stuck in a creative rut | "All my ideas sound the same" |
| Need broad coverage of possibility space | "What are all the approaches?" |
| Domain-specific creativity required | "Creative solutions in [domain]" |

## Routing Table

| User Need | Route |
|-----------|-------|
| "Generate creative ideas" | Standard or Maximum workflow |
| "Need specific number of ideas" | IdeaGeneration with N parameter |
| "Explore decision tree" | TreeOfThoughts |
| "Creative in [specific domain]" | DomainSpecific |
| "Creative technical solution" | Technical |
| "Generate synthetic training data" | SyntheticDataExpansion |
| "Maximum diversity" | Maximum workflow |

## 7 Workflows

### Workflow 1: Standard

**Purpose:** General-purpose divergent ideation with good diversity.

**Procedure:**

1. **Framing:**
   ```
   Define the problem/opportunity in one sentence
   Specify output format (list, descriptions, concepts)
   Set quantity target (5-15 ideas)
   ```

2. **Exploration phase:**
   ```
   For each idea slot:
   - Check: is this similar to previous ideas?
   - If yes, make a deliberate jump to a different region of idea space
   - Explicitly note which dimensions you're exploring
   ```

3. **Diversity check:**
   ```
   After generation:
   - Cluster ideas by similarity
   - Identify underrepresented clusters
   - Generate additional ideas for underrepresented areas
   ```

**Output:** N diverse ideas with cluster coverage tracking.

### Workflow 2: Maximum

**Purpose:** Push for maximum diversity across the idea space.

**Procedure:**

1. **Map the idea space:**
   ```
   Identify key dimensions of variation:
   - Approach (direct/indirect/inverse)
   - Scale (small/large/systemic)
   - Risk (safe/risky/transformative)
   - Time (short-term/long-term)
   - Perspective (user/creator/competitor)
   ```

2. **Generate one idea per region:**
   ```
   For each combination of dimensions, generate at least one idea.
   Target: Cover all extreme points of the possibility space.
   ```

3. **Verify coverage:**
   ```
   For each dimension pair, check:
   - Do we have ideas at both extremes?
   - Are there empty regions?
   - Generate fillers for empty regions
   ```

**Output:** Maximum-coverage idea set with explicit dimension mapping.

### Workflow 3: IdeaGeneration

**Purpose:** Generate a specific number of ideas with consistent quality.

**Procedure:**

1. **Set target N** (requested number of ideas)
2. **Calculate batches:**
   ```
   Batch size = N × 1.5 (oversample to allow pruning)
   Number of batches = ceil(N × 1.5 / batch_size)
   ```

3. **Generate in batches:**
   ```
   Batch 1: Generate first 50% of ideas
   Batch 2: Generate remaining 50% (instructed to be different from Batch 1)
   ```

4. **Diversity filter:**
   ```
   - Remove duplicates
   - Remove near-duplicates (same idea, different wording)
   - Select top N by novelty (not just feasibility)
   ```

5. **Quality check:**
   ```
   - Each idea is complete (has a clear description)
   - Each idea is distinct (adds something new)
   - Coverage is reasonable (not all in one cluster)
   ```

**Output:** N distinct, quality-checked ideas.

### Workflow 4: TreeOfThoughts

**Purpose:** Explore branching paths from a starting point, evaluating and expanding at each node.

**Procedure:**

1. **Define root problem/opportunity**
2. **Generate initial branches (3-5):**
   ```
   What are the fundamentally different approaches?
   Each branch is a high-level direction.
   ```

3. **For each branch, generate sub-branches:**
   ```
   Given this direction:
   - What are 3-5 specific implementations?
   - What are the key variations?
   ```

4. **Prune and expand:**
   ```
   Evaluate each node:
   - Promising → expand further (depth)
   - Unpromising → prune (document why)
   - Ambiguous → note and maybe revisit
   ```

5. **Select best leaf nodes:**
   ```
   From the expanded tree:
   - Pick the most promising 3-5 full paths
   - Each path is a root-to-leaf chain
   ```

**Output:** Decision tree with expanded nodes, pruned branches, and selected paths.

### Workflow 5: DomainSpecific

**Purpose:** Creative ideation tailored to a specific domain.

**Procedure:**

1. **Domain analysis:**
   ```
   - What are the domain's conventions and norms? (to challenge)
   - What are the domain's hard constraints? (to respect)
   - What are the domain's typical failure modes? (to avoid)

   Use web_search for domain research
   Use read_file for internal domain docs
   ```

2. **Constraint-aware ideation:**
   ```
   Apply domain constraints as generative constraints:
   - "Given we can't do X, what interesting things CAN we do?"
   - "What would be creative while respecting [domain constraint]?"
   ```

3. **Cross-domain analogies:**
   ```
   - Find analogous structures in OTHER domains
   - Translate the mechanism to this domain
   - Check: does the analogy hold given domain constraints?
   ```

4. **Domain evaluation:**
   ```
   Score ideas on:
   - Novelty within domain
   - Feasibility within domain
   - Impact within domain
   ```

**Output:** Domain-appropriate creative ideas with constraint compliance noted.

### Workflow 6: Technical

**Purpose:** Creative solutions to technical problems with engineering constraints.

**Procedure:**

1. **Technical framing:**
   ```
   - What's the technical requirement?
   - What are the system constraints? (performance, scale, reliability)
   - What's the current architecture?
   ```

2. **Generative techniques:**
   ```
   - What if we changed the architecture?
   - What if we used a different algorithm/approach?
   - What if we removed a constraint?
   - What if we combined two existing approaches?
   ```

3. **Evaluate on technical criteria:**
   ```
   - Performance impact
   - Complexity change
   - Maintenance cost
   - Scalability
   - Compatibility
   ```

**Output:** Technical creative proposals with impact assessment.

### Workflow 7: SyntheticDataExpansion

**Purpose:** Generate diverse synthetic training data or test cases.

**Procedure:**

1. **Analyze existing data:**
   ```
   - What patterns are overrepresented?
   - What edge cases are missing?
   - What variations exist in the real world?

   Use read_file for existing data
   ```

2. **Define expansion dimensions:**
   ```
   Identify axes of variation:
   - Input format variations
   - Difficulty levels
   - Edge cases
   - Adversarial examples
   ```

3. **Generate systematically:**
   ```
   For each dimension, generate examples:
   - Standard cases (model existing distribution)
   - Edge cases (boundary conditions)
   - Adversarial cases (designed to break naive approaches)
   - Rare but realistic cases (low probability, high information)
   ```

4. **Quality filter:**
   ```
   - Are examples realistic?
   - Are they distinct from existing data?
   - Do they cover intended dimensions?
   ```

**Output:** Expanded dataset with coverage across specified dimensions.

## Hermes Tools Integration

| Workflow | Tool | Usage |
|----------|------|-------|
| All workflows | `terminal`, `write_file` | Idea capture, clustering |
| DomainSpecific | `web_search`, `read_file` | Domain research |
| Technical | `read_file` | Architecture docs |
| SyntheticData | `read_file`, `terminal` | Data analysis, generation |
| Diversity check | `delegate_task` | Parallel clustering |
| TreeOfThoughts | `terminal` | Tree structure capture |

## Gotchas / Pitfalls

### 1. False Diversity
**Problem:** Generating ideas that sound different but are structurally identical.
**Fix:** Check if ideas differ on substance (approach, mechanism) or just surface details (wording, example).

### 2. Premature Constraint Acceptance
**Problem:** Accepting domain constraints that aren't actually binding.
**Fix:** During generation, note constraints but don't filter by them until evaluation. Creative ideas often work around supposed constraints.

### 3. Verbalized Sampling Overhead
**Problem:** Spending too much time mapping the space and not enough generating.
**Fix:** Spend ~20% of time on space mapping, 60% on generation, 20% on evaluation.

### 4. Idea Attachment
**Problem:** Getting attached to early ideas and resisting alternatives.
**Fix:** Generate all ideas before evaluating any. Don't form opinions during generation.

### 5. Conformity in TreeOfThoughts
**Problem:** Sub-branches converging to similar solutions.
**Fix:** Actively push for divergence at each branch level. If two branches look similar, prune one and generate a genuinely different alternative.

## Execution Log

After every invocation:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"pai-be-creative","workflow":"Standard|Maximum|IdeaGeneration|TreeOfThoughts|DomainSpecific|Technical|SyntheticDataExpansion","ideas_generated":N,"status":"ok","duration_s":SECONDS}' >> ~/.hermes/profiles/dev/pai/MEMORY/SKILLS/execution.jsonl
```
