---
status: RETIRED 2026-07-11 — historical doctrine. Modes/tiers were abolished with Algorithm v8 and system prompt v3.0.0 (one adaptive format). Kept as record only; nothing routes here.
last_updated: 2026-05-13
last_updated_by: kai
convention: pai-freshness-v1
mode: ideate
---

# Ideate Mode — Evolutionary Ideation

The Algorithm mode for generating novel, diverse ideas through nine evolutionary phases. Replaces the old `ideate-loop.md` location.

---

## When this fires

Algorithm OBSERVE detects trigger phrases (case-insensitive):

- `ideate [problem]`
- `id8 [problem]`
- "generate ideas for [problem]"
- "dream up solutions for [problem]"

When triggered, OBSERVE sets `mode: ideate` in ISA frontmatter and loads this doctrine.

## Pulse surface

- Tab: **Ideate**
- Dashboard: `NoveltyDashboard` (`LIFEOS/PULSE/Observability/src/app/novelty/page.tsx`)
- Filter: `algorithmStates.filter(s => s.mode === "ideate")`

## The Nine Phases

Each Ideate cycle runs through nine phases at varying noise levels:

| Phase | Noise | Purpose |
|-------|-------|---------|
| CONSUME | n/a | Read prior work, established knowledge in the problem domain |
| DREAM | 0.9 | Wild, free-form generation — high hallucination tolerance |
| DAYDREAM | 0.5 | Mid-noise associative generation |
| CONTEMPLATE | 0.1 | Tight analytical generation — filter against problem |
| STEAL | n/a | Cross-domain borrowing — look outside the home domain |
| MATE | n/a | Recombine promising ideas from prior phases |
| TEST | n/a | Score generated ideas against a fitness function |
| EVOLVE | n/a | Select survivors; kill the rest per `selectionPressure` |
| META-LEARN | n/a | Lamarckian strategy adjustment — what worked this cycle informs the next |

The Loop Controller drives multiple cycles. Cycle count = `maxCycles` parameter (or time-budget-derived default).

## Parameters

Ideate accepts tunable parameters that control mutation boldness, generation volume, domain diversity, etc. Resolved at OBSERVE from preset, focus value, individual overrides, or tone inference.

### Parameter table

| Parameter | Range | Default | Effect |
|-----------|-------|---------|--------|
| `problemConnection` | 0.0–1.0 | 0.5 | CONTEMPLATE strictness (30% threshold scales with this). CONSUME/STEAL search focus. |
| `selectionPressure` | 0.0–1.0 | 0.5 | EVOLVE kill threshold → keep percentage. TEST scoring strictness. |
| `domainDiversity` | 0.0–1.0 | 0.5 | CONSUME domain count (1-2 low, 7+ high). STEAL domain selection diversity. |
| `phaseBalance` | 0.0–1.0 | 0.5 | Time/agent allocation across phases (low → more DREAM/STEAL/MATE; high → more CONSUME/TEST/EVOLVE). |
| `ideaVolume` | 0.0–1.0 | 0.5 | Ideas generated per cycle across DREAM/DAYDREAM/MATE. |
| `mutationRate` | 0.0–1.0 | 0.3 | EVOLVE mutation intensity. |
| `generativeTemperature` | 0.0–1.0 | 0.7 | DREAM/DAYDREAM wildness/hallucination level. |
| `maxCycles` | 1–20 | from effort | Loop Controller max cycles. |
| `contextCarryover` | 0.0–1.0 | 0.3 | History carried between cycles in CONSUME. |
| `parallelAgents` | 1–8 | from effort | Agents spawned per phase. |

### Named presets

| Preset | Tone keywords | Effect |
|--------|---------------|--------|
| `dream` | wild, dream, free-form, surprise me, hallucinate | High generativeTemperature, low problemConnection, high domainDiversity |
| `explore` | explore, broad, brainstorm | Balanced — moderate noise, moderate diversity |
| `directed` | focused, practical, actionable | High problemConnection, low generativeTemperature |
| `surgical` | precise, surgical, optimal | Highest problemConnection + selectionPressure |

Full schema and resolution: [`../parameter-schema.md`](../parameter-schema.md).

## Effort tier mapping

Algorithm effort level maps to Ideate time scale and budget:

| Algorithm Effort | Ideate Time Scale | Budget |
|------------------|-------------------|--------|
| Standard (E1) | hours | 5 min |
| Extended (E2) | days | 12 min |
| Advanced (E3) | weeks | 25 min |
| Deep (E4) | months | 45 min |
| Comprehensive (E5) | years | 90 min |

## Meta-Learner

Phase 9 (META-LEARN) is a Lamarckian adjustment layer:

- Parameters set INITIAL STATE for the Loop Controller.
- Meta-Learner may adjust parameters within bounds per `parameter-schema.md`.
- User-explicit overrides are auto-locked (Meta-Learner cannot adjust them).
- Default locked: `parallelAgents`, `maxCycles`.
- Adjustments logged with rationale in `algorithm_config.meta_learner_adjustments` on the ISA.

## ISA shape

```yaml
mode: ideate
algorithm_config:
  preset: dream                  # OR explore | directed | surgical
  params:
    problemConnection: 0.3
    generativeTemperature: 0.85
    maxCycles: 4
  meta_learner_adjustments:
    - { cycle: 2, param: ideaVolume, from: 0.5, to: 0.7, reason: "EVOLVE pruned 80% — increase generation" }
principal_stated_goal: "<verbatim if user stated one>"
```

## Integration with Algorithm phases

- **OBSERVE:** trigger detection, parameter resolution, ISA scaffold.
- **THINK:** risks/premortem; for ideate, "what failure modes does the generative loop have?" — e.g., mode collapse, domain narrowness.
- **PLAN:** scope strategy; for ideate, often `breadth-then-depth`.
- **BUILD:** load `Skill("Ideate")` — the 9-phase cognitive cycle engine.
- **EXECUTE:** run cycles; Meta-Learner adjusts between cycles.
- **VERIFY:** evaluate generated ideas against TEST scoring; check capability invocations met tier floors.
- **LEARN:** route winning ideas to KNOWLEDGE; log meta-learner adjustments.

## Examples

- "ideate post ideas about Human 3.0" → `mode: ideate`, `preset: dream`, E2-E3
- "id8 a way to compress mode taxonomy" → `mode: ideate`, `preset: directed`, E3
- "dream up novel UI patterns for ISA editing" → `mode: ideate`, `preset: dream`, E3
- "surgical brainstorm: what to cut from the v6.5.0 doctrine" → `mode: ideate`, `preset: surgical`, E3

## Cross-references

- All modes: [`README.md`](README.md)
- Parameter schema: [`../parameter-schema.md`](../parameter-schema.md)
- Ideate skill (router): `$LIFEOS_ROOT/skills/Ideate/SKILL.md`
- Current Algorithm doctrine: `../v6.5.0.md`
