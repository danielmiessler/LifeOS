# QuickCycle — Compressed 4-Phase Single Cycle

**Use when:** you want fast novelty without the full Loop Controller machinery. Single cycle, no META-LEARN, no strategy pivots, no Lamarckian feedback. Trades depth for speed.

**Phase set:** CONSUME → STEAL → MATE → TEST. Skips DREAM, DAYDREAM, CONTEMPLATE (the perturbation phases) and EVOLVE/META-LEARN (the iteration phases). Output is a single batch of scored candidates.

## Inputs

- **Problem statement** (required)
- **domains** (optional, defaults to 2-3 domains chosen heuristically from the problem)
- **target_count** (optional, default 8): how many scored candidates to return

## Steps

### 1. CONSUME
- Invoke `Skill("Research")` in standard mode (NOT extensive — speed matters)
- Pull from 2-3 domains (default for QuickCycle): direct domain + 1-2 distant domains
- Extract atomic ideas, tag with source domain
- Output: 10-20 raw input items

### 2. STEAL
- Invoke `Skill("Research")` targeting 2 foreign domains via random lottery from the standard 50+ domain pool
- For each foreign domain, find 2-3 patterns/solutions
- Map each foreign pattern onto the problem
- Output: 4-6 borrowed pattern mappings

### 3. MATE
- Combine CONSUME output + STEAL output into one pool
- Fisher-Yates shuffle the pool, pair adjacent items (no cross-phase enforcement at this scale — pool is already mixed)
- For each pair: crossover + dice-roll mutation (8 mutation operations from `../SKILL.md` § Structural Randomness Engine)
- Skip the cloning-with-drift step (only crossover + mutation in QuickCycle for speed)
- Output: `target_count` × 1.5 offspring (15-20% will be killed in TEST)

### 4. TEST
- 3 judge agents independently score each offspring on 4 dimensions: Feasibility, Novelty, Impact, Elegance
- Final score = average; confidence = inverse of variance
- Each judge: score + 1-sentence supporting argument + 1-sentence counterargument
- Skip RedTeam adversarial pass (FullCycle has it; QuickCycle trades depth for speed)
- Skip external validation hooks
- Drop bottom 25%; return top `target_count` ranked by composite score

## Output

Markdown report with:
- Top N candidates ranked by composite score
- Each candidate: scores per dimension, supporting/counter argument, provenance (parent IDs + operation type)
- One-line summary of input pool composition

No Insight Extractor (single cycle has no cross-cycle pattern to extract). No Loop Controller state file.

## When NOT to use this

- Need genuinely novel ideas (no DREAM/DAYDREAM = bounded creativity) → use FullCycle
- Need adaptive strategy (no META-LEARN = no learning across cycles) → use FullCycle
- Just need divergent ideas without scoring → use `Skill("BeCreative")` instead

## Execution Log

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"Ideate","workflow":"QuickCycle","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> ~/.claude/PAI/MEMORY/SKILLS/execution.jsonl
```
