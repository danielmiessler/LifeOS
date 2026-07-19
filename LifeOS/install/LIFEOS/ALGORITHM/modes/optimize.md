---
status: RETIRED 2026-07-11 — historical doctrine. Modes/tiers were abolished with Algorithm v8 and system prompt v3.0.0 (one adaptive format). Kept as record only; nothing routes here.
last_updated: 2026-05-13
last_updated_by: kai
convention: pai-freshness-v1
mode: optimize
---

# Optimize Mode — Eval/Metric-Driven Refinement

The Algorithm mode for iterative refinement against a measurable score. Replaces the old `optimize-loop.md` location.

---

## When this fires

Algorithm OBSERVE detects the trigger phrase `optimize [target]`. The target can be a code file, a prompt, a skill, an agent, or any text artifact with a definable success metric.

## Pulse surface

- Tab: **Optimize**
- Dashboard: `OptimizeDashboard` (`LIFEOS/PULSE/Observability/src/components/activity/OptimizeDashboard.tsx`)
- Filter: `algorithmStates.filter(s => s.mode === "optimize")`

## Two Evaluation Modes

|  | Metric Mode | Eval Mode |
|---|---|---|
| **Target** | Code files | Prompts, skills, agents, any text |
| **Measurement** | Run shell command, extract number | Run target N times, judge outputs, pass rate % |
| **Scoring** | Single numeric value (lower/higher is better) | `passes / (eval_criteria × runs)` as percentage |
| **ISC role** | Guard rails (invariant assertions) | Guard rails (same) |
| **Eval criteria** | N/A — `metric_command` is the signal | 3-6 binary yes/no questions judged by LLM |
| **Sandbox** | Git branch `optimize/{metric_name}` | Directory copy in `MEMORY/WORK/{slug}/sandbox/` |

**Mode detection:**

- If `metric_command` is provided → metric mode.
- If `eval_mode: eval` is set → eval mode.
- If neither → infer from target type (code/function → metric, everything else → eval).

## Parameters

Optimize accepts tunable parameters controlling mutation boldness, regression tolerance, and patience. Resolved at OBSERVE from preset or individual overrides.

| Parameter | Range | Default | Effect |
|-----------|-------|---------|--------|
| `stepSize` | 0.0–1.0 | 0.3 | Change size per experiment. Low = tiny tweaks; high = structural changes. |
| `regressionTolerance` | 0.0–1.0 | 0.1 | Willingness to accept temporary score regression. 0 = never; 1 = freely explore. |
| `earlyStopPatience` | 1–20 | 3 | Consecutive no-improvement experiments before terminating. |
| `maxIterations` | 1–100 | 10 | Maximum total experiments. |

### Named presets

| Preset | stepSize | regressionTolerance | earlyStopPatience | maxIterations | Use For |
|--------|----------|--------------------|--------------------|---------------|---------|
| `cautious` | 0.15 | 0.0 | 5 | 20 | Production systems, stability critical |
| `standard-optimize` | 0.3 | 0.1 | 3 | 10 | Default — moderate approach |
| `aggressive` | 0.7 | 0.5 | 2 | 15 | Prototypes, experiments, local-optima escape |

### Parameter → loop behavior

- `stepSize` → HYPOTHESIZE: controls mutation taxonomy. Low favors `elimination` / `simplify` / `parameter_tune`. High favors `algorithmic` / `restructure` / `rewrite`.
- `regressionTolerance` → DECIDE: at 0.0, any regression triggers revert. At 0.1-0.3, minor regressions (<5%) accepted with structural rationale. At 0.4+, simulated annealing — accepts regression to escape local optima.
- `earlyStopPatience` → Termination + Plateau Protocol. Plateau Level 1 at `earlyStopPatience` experiments; Level 2 at 2×; Level 3 at 3×.
- `maxIterations` → Hard stop. Loop exits when experiment count reaches this.

## ISA shape

```yaml
mode: optimize
algorithm_config:
  preset: cautious               # OR standard-optimize | aggressive
  eval_mode: metric              # OR eval
  metric_command: "bun test --reporter json"   # metric mode only
  eval_criteria:                                # eval mode only
    - "Output is under 200 tokens"
    - "Output uses {{PRINCIPAL_NAME}}'s voice (per WRITINGSTYLE.md)"
    - "Output contains zero AI-isms (per AIWritingPatterns.md)"
  params:
    stepSize: 0.15
    regressionTolerance: 0.0
    earlyStopPatience: 5
    maxIterations: 20
principal_stated_goal: "<verbatim if user stated one>"
```

## The optimization loop

Within the Algorithm phases, Optimize runs an inner experiment loop:

```
HYPOTHESIZE → MUTATE → MEASURE → DECIDE → COMMIT-OR-REVERT
   ↑                                              ↓
   └──────────── continue until termination ──────┘
```

- **HYPOTHESIZE:** propose a mutation type from the taxonomy weighted by `stepSize`.
- **MUTATE:** apply the change to the sandbox (git branch for metric; dir copy for eval).
- **MEASURE:** run `metric_command` (metric mode) or run N evaluations (eval mode).
- **DECIDE:** new score vs baseline → keep (improvement, or regression within `regressionTolerance`) vs revert.
- **COMMIT-OR-REVERT:** apply or roll back; update baseline if kept.

Termination: `maxIterations` reached, OR `earlyStopPatience` consecutive no-improvements, OR ISC guard-rail violation, OR user halt.

## ISC role in Optimize

ISCs are **guard rails** — invariant assertions that must hold regardless of score. Example: "ISC-1: All existing tests still pass" or "ISC-2: Output never contains banned vocabulary." If any ISC fails, the mutation reverts even if the score improved. ISCs are not the optimization target — the metric/eval is.

## Integration with Algorithm phases

- **OBSERVE:** trigger detection, parameter resolution, eval-mode determination, ISA scaffold with metric_command or eval_criteria.
- **THINK:** identify guard-rail ISCs; premortem for the optimization loop (mode collapse, gaming the metric, local optima).
- **PLAN:** typically `single | combined (inseparable)` — optimize is one tight loop.
- **BUILD:** set up sandbox (git branch or dir copy).
- **EXECUTE:** run the optimization loop; log every experiment with hypothesis + score + decision.
- **VERIFY:** confirm ISC guard rails held throughout; final score vs baseline; check Meta-Learner adjustments if any.
- **LEARN:** route winning mutations to KNOWLEDGE; log meta-learner adjustments; tombstone failed mutation taxonomies.

## Examples

- "optimize this prompt for higher engagement" → `mode: optimize`, eval_mode, E3
- "optimize the bundle size of /dashboard" → `mode: optimize`, metric mode (`bun run build`), `preset: cautious`, E3
- "aggressive optimize: cut the API latency in half" → `mode: optimize`, metric mode, `preset: aggressive`, E4

## Cross-references

- All modes: [`README.md`](README.md)
- Parameter schema: [`../parameter-schema.md`](../parameter-schema.md)
- Eval-mode guide: [`../eval-guide.md`](../eval-guide.md)
- Target types: [`../target-types.md`](../target-types.md)
- Optimize skill (router): `{{LIFEOS_ROOT}}/skills/Optimize/SKILL.md`
- Current Algorithm doctrine: `../v6.5.0.md`
