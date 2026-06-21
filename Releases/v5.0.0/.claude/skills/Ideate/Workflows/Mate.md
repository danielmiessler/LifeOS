# Mate — MATE Phase Only (Genetic Recombination)

**Use when:** you have a pool of existing ideas and want to breed novel offspring via crossover + mutation. No new research, no scoring — pure recombination.

**Phase invoked:** MATE only.

## Inputs

- **Idea pool** (required): list of existing ideas to breed (typically 8-30 items)
- **Phase tags** (optional): mark each input idea with its origin phase (e.g. "Dream", "Steal", "Contemplate") to enable cross-phase pairing enforcement
- **Offspring count** (optional, default 10): minimum number of offspring to produce
- **Cross-phase ratio** (optional, default 0.2): proportion of pairings forced cross-phase

## Steps

1. **Pair selection via Fisher-Yates shuffle:**
   - Bucket inputs by phase tag (if provided)
   - Pre-allocate `cross_phase_ratio × offspring_count` slots — these are forced cross-phase pairs (one input from each of two different phase buckets, randomized within bucket)
   - Remaining slots: shuffle the full pool, pair adjacent items
   - Critical: do NOT ask the LLM to pick "interesting pairs" — structural randomness defeats LLM bias toward training-distribution-favored pairings

2. **Spawn Matchmaker agents in parallel** via Task tool. Each receives a subset of the pairs. For each pair, the agent performs THREE operations:

   - **Crossover:** "Take element A from idea 1, element B from idea 2. Combine into a new idea."
   - **Mutation:** Roll an 8-sided die. Apply the corresponding mutation operation:
     1. Flip one assumption
     2. Invert the constraint
     3. Change the scale (10× bigger or smaller)
     4. Change the time horizon
     5. Merge with a random element from another idea in the pool
     6. Apply a constraint from a random domain
     7. Remove the most complex component
     8. Add an adversarial requirement
   - **Cloning with drift:** "Copy one parent idea with small random modifications."

   Trait composition: `creative + combinatorial + bold`

3. **Explicitly instruct agents to produce BAD ideas too** — selection is not happening here, so don't pre-filter. Diversity matters more than quality at this phase.

4. **Aggregate offspring** with full provenance:
   - Parent IDs
   - Operation type (crossover / mutation / clone)
   - Mutation die-roll (if mutation was applied)
   - Phase-bucket origins of parents

## Output

```json
[
  {
    "id": "offspring-001",
    "text": "Apply mycelial chemical-gradient signaling to API rate limiting",
    "provenance": {
      "parents": ["idea-007", "idea-019"],
      "operation": "crossover",
      "mutation_die_roll": null,
      "parent_phases": ["Steal", "Contemplate"],
      "is_cross_phase": true
    }
  },
  {
    "id": "offspring-002",
    "text": "...",
    "provenance": { "parents": ["idea-003"], "operation": "clone-with-drift", ... }
  }
]
```

## Distinguishing Notes

- **Pairing randomness defeats LLM bias.** "Interesting pairs" picked by an LLM converge on training-distribution patterns. Random pairs surface the surprises.
- **Cross-phase enforcement is the convergence brake.** Without it, the gene pool narrows to one phase's flavor. The 20% floor is empirical.
- **Bad offspring are wanted here.** Selection is downstream. Filtering at MATE collapses diversity.

## Execution Log

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"Ideate","workflow":"Mate","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> ~/.claude/PAI/MEMORY/SKILLS/execution.jsonl
```
