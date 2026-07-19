---
name: Optimize
version: 1.0.10
description: "Autonomous optimization loop — hill-climb any target. Code with metrics, or skills/prompts/agents with LLM-as-judge. USE WHEN optimize, hill climb, improve metric, reduce latency, optimize skill, optimize prompt, eval mode."
disable-model-invocation: true
effort: medium
---

# /optimize — Autonomous Optimization v2

## What It Does

Runs an autonomous optimization loop against any target. The agent modifies the target, measures the result, keeps improvements, discards failures, and repeats until it stops climbing. Two modes: metric mode for code targets that produce a number (latency, bundle size), and eval mode for skills, prompts, or agents judged by LLM-as-judge binary evals.

## The Problem

Tuning a thing for a measurable outcome is slow, boring, manual work. You change a file, run the measurement, eyeball whether it got better, keep or revert, then do it again — dozens of times. People give up after a few rounds and settle for "good enough" far short of the real ceiling. The targets without a clean number (a skill's quality, a prompt's effectiveness) are worse: there's no easy way to tell if a change actually helped. This skill runs that whole loop for you and only keeps changes that measurably win.

## How It Works

Two modes drive the same hill-climb loop:

- **Metric mode** — code targets with a shell command that produces a number (the original).
- **Eval mode** — skills, prompts, agents, or any text target judged by LLM-as-judge binary evals.

Inspired by Karpathy's [autoresearch](https://github.com/karpathy/autoresearch) and extended with LLM-as-judge evaluation.

## Invocation

### Metric Mode (code targets)

```
/optimize --metric "lighthouse_score" --higher-is-better \
  --measure "npx lighthouse http://localhost:3000 --output=json" \
  --extract "jq '.categories.performance.score * 100' lighthouse.json" \
  --files "src/**/*.tsx,src/**/*.css" \
  --budget 120

/optimize --resume        # Resume a previous optimization loop
/optimize --status        # Show results summary from last/current run
```

### Eval Mode (skill/prompt/agent targets)

```
/optimize --target "$LIFEOS_ROOT/skills/ExtractWisdom"
/optimize --target "$LIFEOS_ROOT/skills/Research/Workflows/QuickResearch.md"
/optimize --target "prompts/my-prompt.md"
/optimize --target "$LIFEOS_ROOT/skills/ExtractWisdom" --max-experiments 20
```

In eval mode, the system automatically:
1. Detects the target type (skill, prompt, agent, code, function)
2. Reads the target to understand its purpose and constraints
3. Generates 3-6 binary eval criteria and 3-5 test inputs
4. Presents criteria + inputs for your approval before starting
5. Runs the optimization loop using LLM-as-judge scoring
6. Presents a recommendation (apply/reject/partial) when done

## What Happens

This skill triggers the LifeOS Algorithm in `mode: optimize`:

1. **OBSERVE** — Define or auto-detect the target, set eval_mode
2. **THINK** — Analyze codebase/skill, generate hypothesis queue
3. **PLAN** — Prioritize hypotheses by expected impact
4. **BUILD** — Phase 0: TARGET ANALYSIS (see `optimize-loop.md`)
   - Detect target type, auto-generate eval criteria (eval mode), set up sandbox, baseline
5. **EXECUTE** — The autonomous loop (`optimize-loop.md`):
   - Hypothesize → Modify target → Measure (metric or eval) → Keep/Revert → Repeat
   - Metric mode: ~12 experiments/hour (at 5-min budget)
   - Eval mode: ~6-8 experiments/hour (multi-run judging is slower)
6. **VERIFY** — Phase 9: RECOMMEND — diff, summary, apply/reject/partial options
7. **LEARN** — Phase 10: EXTRACT LEARNINGS — what worked, what didn't, structured insights

## Arguments — Metric Mode

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| `--metric NAME` | yes | | Human-readable metric name |
| `--measure COMMAND` | yes | | Shell command that produces the metric |
| `--files GLOB` | yes | | Files the agent may modify (comma-separated) |
| `--higher-is-better` | | (default) | Higher metric values are better |
| `--lower-is-better` | | | Lower metric values are better |
| `--extract COMMAND` | | Last number in stdout | Extract metric from output |
| `--budget SECONDS` | | 300 | Time budget per experiment |
| `--target VALUE` | | none | Stop when metric reaches this value |
| `--max-experiments N` | | none | Stop after N experiments |
| `--locked GLOB` | | none | Files the agent must NOT modify |
| `--constraints TEXT` | | none | Additional rules (e.g., "tests must pass") |

## Arguments — Eval Mode

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| `--target PATH` | yes | | Path to skill directory, prompt file, or agent definition |
| `--max-experiments N` | | none | Stop after N experiments |
| `--runs N` | | 3 | Runs per experiment (more = more reliable, slower) |
| `--criteria "Q1" "Q2"` | | auto-generated | Override auto-generated eval criteria |
| `--inputs "I1" "I2"` | | auto-generated | Override auto-generated test inputs |
| `--budget SECONDS` | | 300 | Time budget per experiment |

## Shared Arguments

| Argument | Description |
|----------|-------------|
| `--resume` | Resume a previous optimization run |
| `--status` | Show results summary |

## Algorithm Integration

When `/optimize` is invoked, the Algorithm enters with `mode: optimize` in the ISA frontmatter. The eval_mode is set based on arguments:

- `--measure` provided → `eval_mode: metric` (git branch sandbox)
- `--target` provided → `eval_mode: eval` (directory sandbox)

ISC criteria become **guard rails** — assertions that must hold true across ALL experiments. Guard rails must REMAIN satisfied perpetually. A violation triggers automatic revert regardless of score improvement.

**Reference files:**
- `$LIFEOS_DIR/ALGORITHM/optimize-loop.md` — the full loop protocol
- `$LIFEOS_DIR/ALGORITHM/eval-guide.md` — how to write good eval criteria
- `$LIFEOS_DIR/ALGORITHM/target-types.md` — target detection and ISC generation

## Examples

### Metric Mode

**Optimize page load time:**
```
/optimize --metric "lighthouse_perf" --higher-is-better \
  --measure "npx lighthouse http://localhost:3000 --output=json --output-path=lh.json" \
  --extract "jq '.categories.performance.score * 100' lh.json" \
  --files "src/**/*.tsx,src/**/*.css" \
  --target 95 --budget 120
```

**Optimize bundle size:**
```
/optimize --metric "bundle_bytes" --lower-is-better \
  --measure "bun run build 2>&1 && du -sb dist/ | cut -f1" \
  --files "src/**/*.ts" \
  --constraints "all tests must pass"
```

**ML training (Karpathy-style):**
```
/optimize --metric "val_bpb" --lower-is-better \
  --measure "uv run train.py > run.log 2>&1 && grep '^val_bpb:' run.log | cut -d' ' -f2" \
  --files "train.py" \
  --locked "prepare.py" \
  --budget 300
```

### Eval Mode

**Optimize a skill's Extract workflow:**
```
/optimize --target "$LIFEOS_ROOT/skills/ExtractWisdom" --max-experiments 15
```

**Optimize a standalone prompt:**
```
/optimize --target "prompts/summarize-article.md" --runs 5
```

**Optimize with custom criteria:**
```
/optimize --target "$LIFEOS_ROOT/skills/Research/Workflows/QuickResearch.md" \
  --criteria "Does the output contain specific facts with sources?" \
            "Is the output structured with clear sections?" \
            "Does the output avoid generic filler?" \
  --inputs "research quantum computing breakthroughs 2025" \
           "quick research on supply chain security" \
           "find recent developments in AI agents"
```

## Gotchas

- **Hill-climbing can get stuck in local optima.** If score plateaus, consider resetting with different initial conditions.
- **Eval mode vs metric mode:** Use metric mode for quantifiable targets (latency, size). Use eval mode for qualitative targets (skill quality, prompt effectiveness).
- **Regression tolerance prevents catastrophic changes.** Don't set it to 0 — some regression in secondary metrics is acceptable if primary metric improves significantly.
