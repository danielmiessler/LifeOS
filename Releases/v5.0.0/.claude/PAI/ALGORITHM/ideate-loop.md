## Ideate Loop Protocol

Referenced from the Algorithm when `mode: ideate`. This file defines the ideation lifecycle within the Algorithm's phase structure.

### Trigger Detection

User says "ideate [problem]", "id8 [problem]", "generate ideas for [problem]", or "dream up solutions for [problem]" → set `mode: ideate` in ISA frontmatter.

### Parameter Integration

Parameters control ideation behavior along a spectrum from pure free-form dreaming to tight analytical focus. Full schema: `${PAI_DIR}/ALGORITHM/parameter-schema.md`.

**Parameter resolution** (during OBSERVE phase):
1. Algorithm detects preset/focus/params from user request
2. Resolves to individual parameter values per `parameter-schema.md`
3. Writes resolved `algorithm_config:` block to ISA frontmatter

**Parameter → Ideate skill mapping:**

| Parameter | Ideate Skill Effect |
|-----------|-------------------|
| `problemConnection` | CONTEMPLATE checkpoint strictness (30% threshold scales with this value). CONSUME/STEAL search focus. |
| `selectionPressure` | EVOLVE kill threshold (0.5 default → maps to keep percentage). TEST scoring strictness. |
| `domainDiversity` | CONSUME domain count (1-2 at low, 7+ at high). STEAL domain selection diversity. Domain lottery weighting. |
| `phaseBalance` | Agent/time allocation: low values → more DREAM/DAYDREAM/STEAL/MATE agents, high → more CONSUME/CONTEMPLATE/TEST/EVOLVE agents. |
| `ideaVolume` | Ideas generated per cycle across DREAM/DAYDREAM/MATE phases. |
| `mutationRate` | EVOLVE mutation intensity. Dice roll frequency and radical-ness of mutations. |
| `generativeTemperature` | DREAM/DAYDREAM phase prompting — controls wildness/hallucination level of generation. |
| `maxCycles` | Loop Controller max cycles (overrides time-budget default if explicitly set). |
| `contextCarryover` | How much reasoning/history carried between cycles in CONSUME. |
| `parallelAgents` | Agents spawned per phase (within budget). |

**Meta-Learner interaction:**
- Parameters set the INITIAL STATE for the Loop Controller
- The Meta-Learner (Phase 9) may adjust parameters within bounds per `parameter-schema.md`
- User-explicit overrides are auto-locked (meta-learner cannot adjust them)
- Default locked: `parallelAgents`, `maxCycles`
- Adjustments logged with rationale in `algorithm_config.meta_learner_adjustments`

### Integration with Algorithm Phases

**BUILD phase:** Load the Ideate skill (`Skill("Ideate")`) which contains the full 9-phase cognitive cycle engine. Extract the problem statement, determine time scale from effort level mapping:

| Algorithm Effort | Ideate Time Scale | Budget |
|-----------------|---------------|--------|
| Standard | hours | 5 min |
| Extended | days | 12 min |
| Advanced | weeks | 25 min |
| Deep | months | 45 min |
| Comprehensive | years | 90 min |

Set up ISA frontmatter with `mode: ideate` and `time_scale` field. Write problem statement to `## Context`.

**Pass parameters to Ideate skill:** Include the resolved `algorithm_config.params` in the Ideate skill invocation context. The Ideate skill's Loop Controller reads these parameters to configure:
- Phase budget allocation (via `phaseBalance`)
- DREAM/DAYDREAM noise levels (via `generativeTemperature`)
- Domain selection strategy (via `domainDiversity`)
- Selection pressure in EVOLVE (via `selectionPressure`)
- Problem-connection strictness (via `problemConnection`)
- Idea generation volume (via `ideaVolume`)
- Mutation intensity (via `mutationRate`)

**EXECUTE phase:** The Ideate skill takes over execution. It runs the Loop Controller with the 9 cognitive phases (CONSUME → DREAM → DAYDREAM → CONTEMPLATE → STEAL → MATE → TEST → EVOLVE → META-LEARN) for as many cycles as the Loop Controller decides. State persists to `MEMORY/WORK/{slug}/ideate/`.

The Loop Controller's `config.json` includes the parameter block:
```json
{
  "problem": "...",
  "time_scale": "weeks",
  "params": {
    "problemConnection": 0.28,
    "selectionPressure": 0.30,
    "domainDiversity": 0.74,
    "generativeTemperature": 0.74,
    "phaseBalance": 0.33,
    "ideaVolume": 31,
    "mutationRate": 0.63,
    "contextCarryover": 0.43
  },
  "locked_params": ["parallelAgents", "maxCycles"],
  "meta_learner_adjustments": []
}
```

**VERIFY phase:** Present top candidates from the Ideate run. Include:
- Ranked candidates with scores (Feasibility, Novelty, Impact, Elegance)
- Evolution summary (cycles, ideas in/out, strategy pivots)
- Evolutionary insights from The Historian
- Parameter effectiveness: which settings drove the best results, any meta-learner adjustments made

**LEARN phase:** Extract meta-insights from the ideation run:
- Which domain combinations were most fertile
- What the evolutionary process revealed about the problem
- Recommendations for further exploration
- Parameter tuning insights: what parameter settings produced the best results, what would be better next time

### ISA Frontmatter Extensions

For Ideate mode, add to ISA frontmatter:
```yaml
mode: ideate
time_scale: [hours|days|weeks|months|years]
algorithm_config:
  preset: explore
  focus: 0.25
  params:
    problemConnection: 0.28
    selectionPressure: 0.30
    domainDiversity: 0.74
    phaseBalance: 0.33
    ideaVolume: 31
    mutationRate: 0.63
    generativeTemperature: 0.74
    maxCycles: 4
    contextCarryover: 0.43
    parallelAgents: 1
  locked_params: [parallelAgents, maxCycles]
  user_overrides: []
  meta_learner_adjustments: []
cycles_completed: N
total_ideas_generated: N
ideas_survived: N
top_score: N
strategy_pivots: N
```

### Reflections JSONL Extensions

For Ideate mode, add to the Algorithm reflections:
```json
"mode": "id8",
"time_scale": "[scale]",
"cycles_completed": N,
"total_ideas": N,
"survived_ideas": N,
"top_score": N,
"strategy_pivots": N,
"fertile_domains": ["domain1+domain2"],
"preset": "[name|null]",
"focus": [val|null],
"params": {"problemConnection": [val], "selectionPressure": [val], "generativeTemperature": [val]}
```
