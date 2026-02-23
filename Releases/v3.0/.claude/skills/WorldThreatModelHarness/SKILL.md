---
name: WorldThreatModelHarness
description: >
  Persistent world model system across 11 time horizons (6mo→50yr) for adversarial analysis of ideas,
  strategies, and investments. USE WHEN threat model, world model, test idea, test strategy, future analysis,
  test investment, how will this hold up, test against future, update world models, view world models,
  time horizon analysis, adversarial future test, stress test idea.
implements: Science
science_cycle_time: macro
context: fork
---

# World Threat Model Harness

A system of 11 persistent world models spanning 6 months to 50 years. Each model is a deep (~10 page)
analysis of geopolitics, technology, economics, society, environment, security, and wildcards for that
time horizon. Ideas, strategies, and investments are tested against ALL horizons simultaneously using
adversarial analysis (RedTeam, FirstPrinciples, Council).

## Workflow Routing

| Trigger | Workflow | Description |
|---------|----------|-------------|
| "test idea", "test strategy", "test investment", "how will this hold up", "stress test", "test against future" | `Workflows/TestIdea.md` | Test any input against all 11 world models |
| "update world model", "update models", "refresh models", "new analysis" | `Workflows/UpdateModels.md` | Refresh world model content with new research/analysis |
| "view world model", "show models", "current models", "model status" | `Workflows/ViewModels.md` | Read and summarize current world model state |

## Tier System

All workflows support three execution tiers:

| Tier | Target Time | Strategy | When to Use |
|------|-------------|----------|-------------|
| **Fast** | ~2 min | Single agent synthesizes across all models | Quick gut-check, casual exploration |
| **Standard** | ~10 min | 11 parallel agents + RedTeam + FirstPrinciples | Most use cases, good depth/speed balance |
| **Deep** | Up to 1 hr | 11 parallel agents + per-horizon Research + RedTeam + Council + FirstPrinciples | High-stakes decisions, major investments |

**Default tier:** Standard. User specifies with "fast", "deep", or tier defaults to Standard.

## World Model Storage

Models are stored at: `~/.claude/MEMORY/RESEARCH/WorldModels/`

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

## Context Files

| File | Purpose |
|------|---------|
| `ModelTemplate.md` | Template structure for world model documents |
| `OutputFormat.md` | Template for TestIdea results output |

## Skill Integrations

This skill orchestrates multiple PAI capabilities:

- **RedTeam** — Adversarial stress testing of ideas against each horizon
- **FirstPrinciples** — Decompose idea assumptions into hard/soft/assumption constraints
- **Council** — Multi-perspective debate on idea viability across horizons
- **Research** — Deep research for model creation and updates

## Voice Notification

Before any workflow execution:
```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running WORKFLOW_NAME in the World Threat Model Harness", "voice_id": "YOUR_VOICE_ID_HERE"}'
```

## Customization Check

Before execution, check for user customizations at:
`~/.claude/skills/PAI/USER/SKILLCUSTOMIZATIONS/WorldThreatModelHarness/`
