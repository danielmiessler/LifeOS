---
name: Ideate
version: 1.0.16
description: "Evolutionary ideation engine — loop-controlled multi-cycle idea generation through phases of dreaming, cross-domain stealing, recombination, fitness testing, selection, and Lamarckian meta-learning, producing ranked novel solution candidates with provenance. USE WHEN ideate, id8, novel ideas, evolve ideas, dream up solutions, innovate, breakthrough ideas, idea evolution, multi-cycle creativity, need genuinely new approaches. NOT FOR quick single-pass brainstorming (use BeCreative)."
effort: high
context: fork
---

## Customization

Before executing, check for user customizations at:
`$LIFEOS_DIR/USER/CUSTOMIZATIONS/SKILLS/Ideate/`

# Ideate — The Cognitive Progress Engine

## What It Does

Ideate is a loop-controlled evolutionary creativity engine. It runs multiple cycles of consuming, dreaming, stealing, breeding, and testing ideas over simulated time scales from hours to decades, driven by a first-class Loop Controller and a Lamarckian Meta-Learner. It produces ranked novel solution candidates with full provenance — where each idea came from and how it evolved.

## The Problem

A single-pass brainstorm collapses fast. Ask a model for ideas and it converges on the obvious handful, biased toward its training distribution, because soft temperature tweaks just reshuffle the same probability mass. You get variations on one theme, not genuinely different directions. Hard problems need ideas that came from somewhere else — a foreign domain, an unexpected recombination, a constraint flipped on its head — and they need a way to kill the weak ones and breed the strong ones across many rounds. One pass can't do that.

## How It Works

This is an evolutionary *system*, not a single-pass tool. **This is NOT BeCreative** — BeCreative is a single-pass diversity tool. Ideate runs multiple cycles driven by a Loop Controller and a Lamarckian Meta-Learner.

## The Core Insight

Human creativity reduces to 5 irreducible functions:

| Function | What It Does | Human Analog |
|----------|--------------|--------------|
| **INGEST** | Gather diverse raw material | Reading, conversations, experiences |
| **PERTURB** | Recombine inputs with controlled noise | Dreaming, daydreaming, shower thoughts |
| **CROSS-POLLINATE** | Map patterns from foreign domains | "Stealing" ideas from unrelated fields |
| **SELECT** | Score against fitness function | Critical thinking, peer review, testing |
| **ITERATE** | Feed survivors back as inputs | Sleep cycles, weeks of study, years of work |

The 9 workflow phases expand these into a richer human-legible system. DREAM, DAYDREAM, and CONTEMPLATE are PERTURB at different noise levels. MATE is PERTURB on existing ideas. META-LEARN adds the Lamarckian advantage — analyzing WHY ideas worked and steering future generation.

## The 9 Phases (Summary)

| # | Phase | Noise | What it does |
|---|-------|-------|--------------|
| 1 | **CONSUME** | — | Multi-domain research, atomic idea extraction |
| 2 | **DREAM** | 0.9 | Free-association on random input subsets, no problem awareness |
| 3 | **DAYDREAM** | 0.5 | Tangential wandering with the problem held loosely |
| 4 | **CONTEMPLATE** | 0.1 | Structured analysis via 4 lenses (mandatory; checkpoint A gates) |
| 5 | **STEAL** | — | Cross-domain pattern borrowing via weighted random domain lottery |
| 6 | **MATE** | — | Genetic recombination via Fisher-Yates shuffle + 8 mutation operations |
| 7 | **TEST** | — | Multi-judge scoring on Feasibility/Novelty/Impact/Elegance (checkpoint B gates) |
| 8 | **EVOLVE** | — | Selection: kill bottom 50%, elite top 10%, mutate the rest, immigrant injection |
| 9 | **META-LEARN** | — | Lamarckian strategy adjustment + next-cycle question generation |

Post-loop: the Insight Extractor runs for cross-cycle pattern analysis.

Full phase mechanics live in `Workflows/FullCycle.md`.

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| FullCycle | "ideate", "id8", "novel ideas for X", "evolve ideas for X", default | `Workflows/FullCycle.md` |
| QuickCycle | "quick novelty for X", "fast brainstorm with scoring" | `Workflows/QuickCycle.md` |
| Dream | "dream on X", "free-associate these inputs", "wild recombinations" | `Workflows/Dream.md` |
| Steal | "steal ideas from biology for X", "cross-pollinate from Y" | `Workflows/Steal.md` |
| Mate | "breed these ideas", "recombine X and Y" | `Workflows/Mate.md` |
| Test | "score these candidates", "test these ideas against fitness" | `Workflows/Test.md` |

## The Loop Controller

Owns inter-cycle state and makes continue/pivot/stop decisions after each cycle's META-LEARN phase. State tracked:

```json
{
  "cycle_count": 0,
  "max_cycles": null,
  "budget_seconds_remaining": 600,
  "fitness_history": [{"cycle": 1, "avg_score": 52.3, "top_score": 68.1, "diversity_index": 0.91}],
  "stagnation_counter": 0,
  "strategy_version": 1,
  "strategy_adjustments": {},
  "loop_decision_log": []
}
```

**Loop Gate logic:**
```
IF budget_seconds_remaining <= 0:        STOP (budget exhausted)
ELIF stagnation_counter >= 3:
    IF strategy_pivots_remaining > 0:    PIVOT (shift domains/noise/agents)
    ELSE:                                STOP (exhausted strategies)
ELIF diversity_index < 0.3:              PIVOT (collapse — inject immigrants)
ELIF top_score >= target_score:          STOP (target reached)
ELSE:                                    CONTINUE
```

## Structural Randomness Engine

LLM "temperature" is soft probability redistribution biased toward the training distribution. Ideate uses **structural randomness** at the data level instead:

- **Input subsetting** (DREAM): Fisher-Yates shuffle picks each agent's input subset
- **Domain lottery** (STEAL): weighted random sampling from the 50+ candidate domain pool
- **Pairing shuffle** (MATE): Fisher-Yates pairs adjacent items; 20% slots forced cross-phase
- **Mutation dice** (EVOLVE): roll an 8-sided die, apply that mutation operation:
  1. Flip one assumption
  2. Invert the constraint
  3. Change the scale (10× bigger or smaller)
  4. Change the time horizon
  5. Merge with a random killed idea's best element
  6. Apply a constraint from a random domain
  7. Remove the most complex component
  8. Add an adversarial requirement

Implementation: `crypto.getRandomValues()` with seed = cycle number + problem hash.

## External Validation Hooks (TEST extension)

Optional pluggable interface that adds real-world signal to internal scoring:

```typescript
interface ValidationHook {
  name: string;
  validate(idea: Idea, problem: Problem): Promise<{ modifier: number; evidence: string }>;
}
```

Built-in hooks: `MarketSearch` (existing implementations), `FeasibilityCheck` (technical blockers), `ExpertPanel` (async human review), `PrototypeSimulation` (generate + test prototype).

## Time-Scale Configuration

| Time scale | Budget | Est. cycles | Agents/phase |
|------------|--------|-------------|--------------|
| `hours` | 5 min | 1-2 | 2-3 |
| `days` | 12 min | 2-4 | 3-4 |
| `weeks` | 25 min | 3-8 | 4-5 |
| `months` | 45 min | 5-15 | 5-6 |
| `years` | 90 min | 8-30 | 6-8 |
| `decades` | 180 min | 15-50+ | 8-10 |

Loop Controller decides actual cycle count adaptively, not a fixed count.

## State Persistence

Each run persists to `$LIFEOS_DIR/MEMORY/WORK/{slug}/ideate/`:

```
ideate/
  config.json           # Problem, time_scale, domains, hooks
  loop-state.json       # Loop Controller (fitness_history, strategy, decisions)
  domain-pool.json      # Weighted domain pool (expanded across cycles)
  cycle-NNN/            # Per-cycle artifacts: input-pool, dreams, daydreams,
                        # analyses, checkpoint-a, stolen, offspring, scores,
                        # checkpoint-b, survivors, meta-learning, summary
  insights.md           # Insight Extractor output (post-loop)
  final-output.md       # Ranked candidate list with full provenance
```

## Idea Data Structure

```json
{
  "id": "idea-042",
  "text": "...",
  "provenance": {
    "parents": ["idea-017", "idea-023"],
    "operation": "crossover",
    "mutation_type": "scale_change",
    "mutation_die_roll": 3,
    "cycle": 3, "phase": "MATE",
    "source_domains": ["mycology", "distributed-systems"],
    "randomness_seed": "a7f3c9..."
  },
  "scores": {
    "feasibility": 72, "novelty": 88, "impact": 65, "elegance": 81,
    "composite": 76.5, "confidence": 0.82, "judge_variance": 8.3,
    "external_validation": {"market_search": {"modifier": -5, "evidence": "..."}},
    "adjusted_composite": 74.5
  },
  "arguments": {"supporting": "...", "counter": "..."}
}
```

## Final Output Format

```markdown
# Ideate Results: [Problem]

**Time scale:** [scale] | **Budget used:** X of Y min | **Cycles:** N (adaptive)
**Strategy pivots:** M | **Total ideas:** X | **Survived:** Y | **Kill rate:** Z%

## Top Candidates (ranked by adjusted composite score)

### 1. [Title] — Score: 85.2/100 (confidence: 0.91)

**The idea:** [2-3 sentences]
**Scores:** Feasibility: 78 | Novelty: 92 | Impact: 84 | Elegance: 87
**External validation:** [hook results]
**Provenance:** Born in cycle N from [operation] of [parents]. Mutation: [type].
**For it:** [supporting argument]
**Against it:** [counterargument]

## Evolution Summary
| Cycle | Ideas In | Survived | Top Score | Diversity | Strategy | Decision |
|-------|----------|----------|-----------|-----------|----------|----------|

## Meta-Learning Trajectory
- [How strategy evolved across cycles]

## Evolutionary Insights (from The Historian)
- [Dominant lineages, fertile combinations, fitness landscape, problem revelations]
```

## Configuration

```json
{
  "problem": "...",
  "time_scale": "weeks",
  "domains": ["primary", "adjacent-1", "adjacent-2"],
  "scoring_weights": {"feasibility": 1.0, "novelty": 1.0, "impact": 1.0, "elegance": 1.0},
  "convergence_prevention": {
    "cross_phase_breeding_min": 0.2,
    "immigrant_ideas_per_cycle": 3,
    "kill_threshold": 0.5,
    "forced_new_domain_per_cycle": true
  },
  "loop_control": {
    "mode": "adaptive",
    "target_score": null,
    "max_stagnation_cycles": 3,
    "max_strategy_pivots": 2,
    "diversity_floor": 0.3
  },
  "external_validation": {"enabled": false, "hooks": ["MarketSearch"]},
  "randomness": {"seed": null, "subset_ratio": 0.33, "mutation_operations": 8}
}
```

## Integration with Other Skills

| Skill | Phase | How |
|-------|-------|-----|
| Research | CONSUME, STEAL | Multi-agent parallel research, cross-domain patterns |
| BeCreative | DREAM, DAYDREAM | MaximumCreativity workflow for high-noise recombination |
| IterativeDepth | CONTEMPLATE | 4-lens analysis (Literal, Failure, Analogical, Constraint Inversion) |
| FirstPrinciples | CONTEMPLATE | Decompose to axioms, challenge assumptions |
| RedTeam | TEST | Adversarial attack on candidates to find fatal flaws |
| Custom agents | ALL | Inline briefs (name + role + stance) for unique cognitive personalities per phase, launched with `general-purpose` |
| Council | MATE (optional) | Debate between ideas before breeding |

## Algorithm Integration

When the LifeOS Algorithm sets `mode: ideate` (via `LIFEOS/ALGORITHM/ideate-loop.md`), it loads this skill and routes to `Workflows/FullCycle.md` by default. Tunable parameters from the algorithm's `parameter-schema.md` map to the configuration above. The Meta-Learner may adjust parameters within bounds; user-explicit overrides are auto-locked.

## Examples

- "id8 on retention strategies for the newsletter" → FullCycle: all 9 phases, Loop Controller decides cycle count, ranked candidates with provenance.
- "quick novelty pass on these three feature ideas" → QuickCycle: one compressed cycle with fitness scoring.
- "steal ideas from biology for cache invalidation" → Steal: cross-domain borrowing only, no full evolution loop.

## Gotchas

- **Ideate is for multi-cycle evolutionary ideation — not quick brainstorming.** For fast divergent ideas, use BeCreative.
- **The Loop Controller manages cycle count — don't override it manually.** Trust the budget-based cycling.
- **Meta-learner adjustments happen automatically within parameter bounds.** Don't manually tune mid-cycle.
- **CONTEMPLATE is mandatory.** Skipping it degrades MATE quality because STEAL operates on disconnected material.
- **Structural randomness defeats LLM bias.** Don't substitute "interesting pairs picked by the LLM" for Fisher-Yates — the bias is the problem.

## Citations

- The 9-phase decomposition and the path-to-ASI mapping derive from a publicly published 2024 essay on cognitive progress and a possible path to ASI. The framework name *Cognitive Progress Workflow* refers to that essay.
- The Lamarckian advantage framing (Phase 9 META-LEARN) borrows from research on auto-research loops and meta-learning in agent systems (cf. Karpathy auto-research pattern).
- Structural randomness as a defeat for LLM-bias is empirical — see internal experiments comparing LLM-picked pairings vs Fisher-Yates pairings on diversity metrics.

## Execution Log

After completing any workflow, append a single JSONL entry:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"Ideate","workflow":"WORKFLOW_USED","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> $LIFEOS_DIR/MEMORY/SKILLS/execution.jsonl
```
