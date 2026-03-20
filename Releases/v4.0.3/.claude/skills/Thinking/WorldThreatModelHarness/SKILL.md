---
name: world-threat-model-harness
description: Stress-test ideas, strategies, and investments across 11 time horizons (6mo-50yr). Update and view world models. USE WHEN threat model, world model, test idea, test strategy, future analysis, test investment, test against future, stress test idea, time horizon analysis, update models, view models, refresh models, model status.
---

# World Threat Model Harness

11 persistent world models (6mo-50yr) covering geopolitics, technology, economics, society, environment, security, and wildcards. Test ideas, strategies, and investments against ALL horizons simultaneously using RedTeam, FirstPrinciples, and Council.

## Notification

```bash
curl -s -X POST http://localhost:8888/notify -H "Content-Type: application/json" -d '{"message": "Running WORKFLOW_NAME in the World Threat Model Harness", "voice_id": "fTtv3eikoepIosk8dTZ5"}'
```

## Customization

Check for user customizations at `~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/WorldThreatModelHarness/` — if present, load and apply overrides before proceeding.

## Workflow Routing

| Trigger | Workflow |
|---------|----------|
| "test idea", "test strategy", "test investment", "stress test", "test against future" | `Workflows/TestIdea.md` |
| "update world model", "update models", "refresh models" | `Workflows/UpdateModels.md` |
| "view world model", "show models", "model status" | `Workflows/ViewModels.md` |

## Tier System

| Tier | Time | Strategy |
|------|------|----------|
| **Fast** | ~2 min | Single agent synthesizes across all models |
| **Standard** (default) | ~10 min | 11 parallel agents + RedTeam + FirstPrinciples |
| **Deep** | Up to 1 hr | 11 parallel agents + per-horizon Research + RedTeam + Council + FirstPrinciples |

## World Model Storage

Location: `$PAI_DIR/MEMORY/RESEARCH/WorldModels/`

Files: `INDEX.md`, `6-month.md`, `1-year.md`, `2-year.md`, `3-year.md`, `5-year.md`, `7-year.md`, `10-year.md`, `15-year.md`, `20-year.md`, `30-year.md`, `50-year.md`

## Context Files

- `ModelTemplate.md` — Template structure for world model documents
- `OutputFormat.md` — Template for TestIdea results output

## Skill Integrations

- **RedTeam** — Adversarial stress testing against each horizon
- **FirstPrinciples** — Decompose assumptions into hard/soft/assumption constraints
- **Council** — Multi-perspective debate on viability across horizons
- **Research** — Deep research for model creation and updates
