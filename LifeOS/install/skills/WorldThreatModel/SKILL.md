---
name: WorldThreatModel
version: 1.0.16
description: "Persistent world-model harness that stress-tests ideas, strategies, and investments against 11 time horizons from 6 months to 50 years, each a deep analysis of geopolitics, tech, economics, society, and security, in Fast/Standard/Deep tiers. USE WHEN threat model, world model, test idea, future analysis, time horizon, stress test against future, long-term risk. NOT FOR single-shot idea attack (use RedTeam)."
effort: high
---

# World Threat Model Harness

## What It Does

Stress-tests an idea, strategy, or investment against 11 time horizons from 6 months to 50 years. Each horizon is a deep (~10 page) world model covering geopolitics, technology, economics, society, environment, security, and wildcards. Three speed tiers: Fast (~2 min, single synthesizer), Standard (~10 min, 11 parallel agents plus RedTeam and FirstPrinciples), Deep (~1 hr, adds Research and Council). Three workflows: TestIdea returns a probability-weighted scenario matrix across all 11 horizons; UpdateModels and ViewModels handle the rest. (A dedicated TestScenario workflow for named alternative-future scenarios is planned, not yet built — scenario files under `Scenarios/` are consumed by TestIdea today.)

## The Problem

Most plans get tested against the present, or against the next year or two at most — so they break the moment the world shifts on a timeline you never modeled. A strategy that looks great at the 1-year horizon can be fatal at 10 years, and a 50-year bet can ignore the near-term cascade that kills it first. Holding all those horizons in your head at once, with real geopolitical, economic, and technological reasoning behind each, is more than any single pass can do. This harness keeps 11 persistent world models warm and runs your idea against all of them at the same time, with adversarial analysis on top.

## How It Works

A system of 11 persistent world models spanning 6 months to 50 years. Each model is a deep (~10 page)
analysis of geopolitics, technology, economics, society, environment, security, and wildcards for that
time horizon. Ideas, strategies, and investments are tested against ALL horizons simultaneously using
adversarial analysis (RedTeam, FirstPrinciples, Council).

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **TestIdea** | "test idea", "test strategy", "test investment", "how will this hold up", "stress test", "test against future" — test any input against all 11 world models | `Workflows/TestIdea.md` |
| **UpdateModels** | "update world model", "update models", "refresh models", "new analysis" — refresh world model content with new research/analysis | `Workflows/UpdateModels.md` |
| **ViewModels** | "view world model", "show models", "current models", "model status" — read and summarize current world model state | `Workflows/ViewModels.md` |

## Tier System

All workflows support three execution tiers:

| Tier | Target Time | Strategy | When to Use |
|------|-------------|----------|-------------|
| **Fast** | ~2 min | Single agent synthesizes across all models | Quick gut-check, casual exploration |
| **Standard** | ~10 min | 11 parallel agents + RedTeam + FirstPrinciples | Most use cases, good depth/speed balance |
| **Deep** | Up to 1 hr | 11 parallel agents + per-horizon Research + RedTeam + Council + FirstPrinciples | High-stakes decisions, major investments |

**Default tier:** Standard. User specifies with "fast", "deep", or tier defaults to Standard.

## World Model Storage

Models are stored at: `{{LIFEOS_DIR}}/MEMORY/RESEARCH/WorldModels/`

### Horizon Models (base views)

| File | Horizon |
|------|---------|
| `INDEX.md` | Summary of all models with last-updated dates |
| `6-month.md` | 6-month outlook |
| `1-year.md` | 1-year outlook |
| `2-year.md` | 2-year outlook |
| `3-year.md` | 3-year outlook |
| `5-year.md` | 5-year outlook |
| `7-year.md` | 7-year outlook |
| `10-year.md` | 10-year outlook |
| `15-year.md` | 15-year outlook |
| `20-year.md` | 20-year outlook |
| `30-year.md` | 30-year outlook |
| `50-year.md` | 50-year outlook |

### Scenario Models (alternative futures)

Stored at: `{{LIFEOS_DIR}}/MEMORY/RESEARCH/WorldModels/Scenarios/`

| File | Scenario |
|------|----------|
| `great-correction-2027.md` | Severe US crash (2027 ± 12mo) — AI capex burst + housing + credit cascade |

## Context Files

| File | Purpose |
|------|---------|
| `ModelTemplate.md` | Template structure for world model documents |
| `OutputFormat.md` | Template for TestIdea results output |

## Skill Integrations

This skill orchestrates multiple LifeOS capabilities:

- **RedTeam** — Adversarial stress testing of ideas against each horizon
- **FirstPrinciples** — Decompose idea assumptions into hard/soft/assumption constraints
- **Council** — Multi-perspective debate on idea viability across horizons
- **Research** — Deep research for model creation and updates

## Voice Notification

Before any workflow execution:
```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the WORKFLOWNAME workflow in the WorldThreatModel skill to ACTION"}' \
  > /dev/null 2>&1 &
```

Then output: `Running the **WorkflowName** workflow in the **WorldThreatModel** skill to ACTION...`

## Customization Check

Before execution, check for user customizations at:
`{{LIFEOS_DIR}}/USER/CUSTOMIZATIONS/SKILLS/WorldThreatModel/`

## Gotchas

- **11 time horizons (6mo-50yr).** Don't over-index on short-term predictions — the value is in long-term structural analysis.
- **Threat models are hypothetical.** Present as scenarios with probability ranges, not predictions.
- **Update models when major world events occur.** Static threat models decay in accuracy.

## Examples

**Example 1: Test an investment thesis**
```
User: "threat model my bet on AI-first content creation"
→ Analyzes across 11 time horizons (6mo to 50yr)
→ Identifies structural risks at each horizon
→ Returns probability-weighted scenario matrix
```

**Example 2: Stress test a strategy**
```
User: "what could go wrong with our newsletter business model?"
→ Maps threat vectors: market, technology, regulatory, competitive
→ Returns prioritized risk register with mitigations
```

## Execution Log

After completing any workflow, append a single JSONL entry:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"WorldThreatModel","workflow":"WORKFLOW_USED","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> "${LIFEOS_DIR}/MEMORY/SKILLS/execution.jsonl"
```

Replace `WORKFLOW_USED` with the workflow executed, `8_WORD_SUMMARY` with a brief input description, and `SECONDS` with approximate wall-clock time. Log `status: "error"` if the workflow failed.
