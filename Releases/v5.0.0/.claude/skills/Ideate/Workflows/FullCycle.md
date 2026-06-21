# FullCycle — All 9 Phases via Loop Controller

**Default Ideate workflow.** Runs the full evolutionary cycle through all 9 phases (CONSUME → DREAM → DAYDREAM → CONTEMPLATE → STEAL → MATE → TEST → EVOLVE → META-LEARN), with a Loop Controller that decides continue / pivot / stop after each cycle.

## Inputs

- **Problem statement** (required): the question or challenge to ideate against
- **time_scale** (optional, default `weeks`): `hours | days | weeks | months | years | decades` → maps to time budget
- **domains** (optional): seed list of domains to consume from
- **seed_urls / seed_ideas** (optional): starting material for cycle 1
- **Loop config** (optional): see Configuration in `../SKILL.md`

## Phase Flow

Phases run **sequentially within a cycle** (each phase consumes the previous phase's output). Agents within a phase run **in parallel** (Council pattern). Two mid-cycle checkpoints gate progression. The Loop Controller decides cycle-boundary actions.

### Phase 1: CONSUME (Ingest)

**Input:** Problem statement + optional seeds. On cycle 2+, also receives survivors from EVOLVE, research questions from META-LEARN, and domain weight adjustments.

**How:**
- Invoke `Skill("Research")` in standard or extensive mode across problem-adjacent and problem-distant domains
- Require minimum 3 distinct domains per cycle (prevents monoculture)
- Domain selection is weighted by Meta-Learner output but includes a random lottery element
- Extract atomic ideas (one concept per item); tag each with source domain, confidence, surprise factor
- Diversity requirement: span at least 3 of: direct domain, adjacent domain, distant domain, historical, contrarian

**Agent:** The Glutton — voracious, omnivorous. Trait composition: `enthusiastic + research + thorough`

### Phase 2: DREAM (Perturb at noise=0.9)

**Input:** Raw Input Pool from CONSUME

**How:**
- Invoke `Skill("BeCreative")` MaximumCreativity workflow
- Each agent receives a random subset of the Input Pool (default N/3) selected by Fisher-Yates shuffle with cryptographic seed (NOT LLM-selected — structural randomness)
- Instruction: "Forget the problem. Just combine these inputs freely. What connections do you see that nobody has made?"
- 3 agents × 3-5 fragments = 9-15 dream fragments per cycle

**Distinguishing feature:** DREAM has NO awareness of the problem. Pure free-association on random input subsets.

**Agent:** The Dreamer — wild, poetic. Trait composition: `creative + visionary + unconventional`

### Phase 3: DAYDREAM (Perturb at noise=0.5)

**Input:** Raw Input Pool + Dream Fragments + Problem Statement (loosely held)

**How:**
- Agents receive accumulated material PLUS a gentle reminder of the problem
- Instruction: "The problem exists in the background. You're not trying to solve it. You're wandering. What catches your eye?"
- 2-3 agents × 3-5 tangential insights each

**Distinguishing feature:** DAYDREAM knows about the problem but isn't trying to solve it. The constraint relaxation IS the mechanism.

**Agent:** The Wanderer — curious, easily distracted. Trait composition: `curious + exploratory + playful`

### Phase 4: CONTEMPLATE (Perturb at noise=0.1) — MANDATORY

**ENFORCEMENT:** Skipping CONTEMPLATE is a hard error. Without it, STEAL and MATE operate on disconnected material.

**Input:** Everything accumulated so far (Input Pool + Dream Fragments + Tangential Insights + Problem Statement front-and-center)

**How:**
- Invoke `Skill("IterativeDepth")` with 4 lenses: Literal, Failure, Analogical, Constraint Inversion
- Instruction: "Given everything you've seen — now think seriously. What patterns emerge? What would a structured approach look like?"
- 2-4 agents × 2-4 structured analyses each

**Mid-Cycle Checkpoint A:**
- Gate: "Do at least 30% of structured analyses reference the original problem statement?"
- If FAIL: re-run CONTEMPLATE with problem statement injected more prominently

**Agent:** The Sage — deep, methodical. Trait composition: `analytical + systematic + precise`

### Phase 5: STEAL (Cross-Pollinate)

**Input:** Problem Statement + Structured Analyses

**How:**
- Invoke `Skill("Research")` targeting domains selected via weighted random lottery from the 50+ candidate domain pool
- Each cycle's STEAL must include at least 1 domain NOT used in the previous cycle (forced exploration)
- For each foreign domain, find 2-3 patterns/solutions/approaches that solve analogous problems
- Map each foreign pattern onto the problem: "In [foreign domain], they solve [analogous problem] by [technique]. Applied to our problem: [mapping]."
- 3-5 agents × different foreign domain each

**Agent:** The Thief — street-smart, no respect for domain boundaries. Trait composition: `resourceful + cross-domain + opportunistic`

### Phase 6: MATE (Genetic Recombination)

**Input:** ALL accumulated ideas from phases 1-5

**How:**
- Select idea pairs using Fisher-Yates shuffle (structural randomness, not LLM-selected)
- Pre-allocated cross-phase slots: first 20% of pairs are forced cross-phase (e.g. Dream Fragment + Borrowed Pattern)
- For each pair, perform THREE operations:
  - **Crossover:** element A from idea 1 + element B from idea 2
  - **Mutation:** dice-roll from 8 mutation operations (see Structural Randomness Engine in `../SKILL.md`)
  - **Cloning with drift:** copy one parent with small random modifications
- Each agent produces 3-5 offspring; minimum 10 offspring per cycle (prevents premature convergence)
- Explicitly instruct agents to produce BAD ideas too — selection happens in TEST

**Agent:** The Matchmaker — sees compatibility where others don't. Trait composition: `creative + combinatorial + bold`

### Phase 7: TEST (Select)

**Input:** All Offspring Ideas from MATE + Problem Statement (as fitness function)

**Scoring dimensions (each 0-100):** Feasibility, Novelty, Impact, Elegance

**How:**
- Invoke `Skill("RedTeam")` to adversarially attack each candidate
- 3-5 judge agents independently score each candidate on all 4 dimensions
- Final score = average across judges; confidence = inverse of variance
- Each judge provides: score, 1-sentence supporting argument, 1-sentence counterargument
- **External validation** (optional): pluggable hooks add real-world signal as score modifiers

**Mid-Cycle Checkpoint B:**
- Gate: "Is this cycle's avg composite score >= previous cycle's avg − 5 points?"
- If FAIL: increment `stagnation_counter` in Loop Controller. If counter ≥ 2, Meta-Learner is triggered to propose strategy pivot before EVOLVE.

**Agent:** The Judge — harsh, fair. Trait composition: `critical + analytical + skeptical`

### Phase 8: EVOLVE (Iterate)

**Input:** Scored Candidates from TEST

**How:**
- **Selection:** Rank by composite score (adjusted for external validation if enabled)
- **Kill threshold:** Bottom 50% eliminated (no carry-forward)
- **Elitism:** Top 10% carry forward UNCHANGED
- **Mutation:** Remaining 40% carry forward with dice-roll mutations from 8 defined operations
- **Diversity injection:** Add 2-3 completely new random ideas (immigrants) to prevent gene pool collapse
- **Output report:** ideas in, ideas out, average fitness, diversity index, top 3 candidates
- **Feed forward:** Survivors + full scoring data passed to META-LEARN

**Agent:** The Curator — cold, efficient. Trait composition: `strategic + decisive + unsentimental`

### Phase 9: META-LEARN (Lamarckian Learning)

**Input:** Full cycle results — survivors, killed ideas, scoring data, provenance chains, phase contribution stats

**How:**

1. **Fitness landscape analysis:** which parent domains produced highest-scoring offspring? which phases contributed most to survivors? what scoring dimensions are hardest to satisfy?

2. **Strategy adjustments (JSON output):**
   ```json
   {
     "domain_weights": {"biology": 1.5, "history": 0.5},
     "phase_weights": {"DREAM": 0.7, "STEAL": 1.3},
     "noise_adjustment": -0.1,
     "new_domains_to_explore": ["game-theory", "logistics"],
     "kill_threshold_adjustment": 0.05,
     "breeding_strategy": "favor cross-domain over within-domain"
   }
   ```

3. **Question generation:** synthesizes 3-5 specific research questions based on what this cycle revealed; these seed the next cycle's CONSUME phase

**Agent:** The Scientist — meta-analytical. Trait composition: `meta-analytical + strategic + adaptive`

## Loop Controller Decision

After META-LEARN completes, the Loop Controller evaluates:

```
IF budget_seconds_remaining <= 0:
    STOP (budget exhausted)
ELIF stagnation_counter >= 3:
    IF strategy_pivots_remaining > 0:
        PIVOT (shift domains, noise levels, agent composition)
    ELSE:
        STOP (exhausted all strategies)
ELIF fitness_history[-1].diversity_index < 0.3:
    PIVOT (diversity collapse — inject immigrants and widen search)
ELIF fitness_history[-1].top_score >= target_score (if set):
    STOP (target reached)
ELSE:
    CONTINUE
```

On STOP, invoke the Insight Extractor (The Historian) for post-loop analysis.

## Post-Loop: Insight Extractor

Runs once after the Loop Controller issues STOP. Analyzes the entire evolutionary run.

**Output sections:**
- Dominant Lineages (which idea families dominated, common ancestors of top scorers)
- Fertile Combinations (which domain pairings produced breakthrough offspring)
- Fitness Landscape (peaks, valleys, unexplored regions)
- Problem Understanding (what the process revealed about the problem itself)
- Recommendations for Further Exploration

**Agent:** The Historian — retrospective, sees the forest. Trait composition: `archival + synthesizing + retrospective`

## State Persistence

Each run persists to `~/.claude/PAI/MEMORY/WORK/{slug}/ideate/`. See `../SKILL.md` § "State Persistence" for the full directory layout and idea data structure.

## Final Output

See `../SKILL.md` § "Final Output Format" for the markdown template.

## Execution Log

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"Ideate","workflow":"FullCycle","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> ~/.claude/PAI/MEMORY/SKILLS/execution.jsonl
```
