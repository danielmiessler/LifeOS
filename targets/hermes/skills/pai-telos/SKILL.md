---
name: pai-telos
description: "PAI v5.0 Telos management — mission, goals, beliefs, wisdom, mental models. USE WHEN checking user goals, updating Telos, generating mission-aligned recommendations, or reviewing life direction. NOT FOR task execution (use pai-algorithm) or simple identity info (in USER/ files)."
version: 5.0.0
author: PAI v5.0 → Hermes Port
license: MIT
metadata:
  hermes:
    tags: [pai, telos, goals, mission, life-os]
    related_skills: [pai-algorithm, pai-isa]
---

# Telos — Life OS (Hermes Port)

## Overview

Telos is the user's mission, goals, beliefs, wisdom, challenges, mental models, and narratives. It is the "why" behind everything PAI does. Every Algorithm task is informed by the user's Telos — what they're trying to become, what they care about, what has worked for them before.

## File Structure

Telos documents live at `~/.hermes/profiles/dev/pai/USER/TELOS/`:

| File | Purpose |
|------|---------|
| `MISSION.md` | Core mission — 1-3 sentences why |
| `GOALS.md` | Current goals with priority, status, dates |
| `BELIEFS.md` | Core beliefs that guide decisions |
| `WISDOM.md` | Lessons learned — atomic insights with context |
| `CHALLENGES.md` | Current challenges and blockers |
| `MENTAL_MODELS.md` | Mental models that have proven useful |
| `NARRATIVES.md` | Personal narratives — stories that define identity |
| `BOOKS.md` | Influential books and key takeaways |

## Workflow Routing

| Trigger | Workflow |
|---------|----------|
| "review telos" | Read and summarize all Telos files |
| "update telos" | Add/update a Telos entry |
| "telemetry report" | Generate McKinsey-style life review |
| "align with telos" | Check if a plan/decision aligns with Telos |
| "telos dashboard" | Generate project dashboard from Telos + goals |

## Key Rules

- **Telos changes.** Goals evolve, beliefs shift, wisdom accumulates. Treat Telos as living documents, not static artifacts.
- **Telos influences everything.** When making decisions, check: does this align with the user's mission? Does it serve their goals? Does it respect their principles?
- **Don't overwrite.** When updating Telos, preserve history. Append new entries, don't delete old ones (unless the user explicitly asks).
- **Bias toward action.** Telos should drive action, not replace it. A goal without a plan is a wish.

## Telos Template

```markdown
## Goal: [Goal Name]

- **Priority:** P0|P1|P2|P3
- **Status:** proposed|active|paused|completed|abandoned
- **Started:** YYYY-MM-DD
- **Target:** YYYY-MM-DD (optional)
- **Description:** Clear statement of what success looks like
- **Key Results:** [Measurable outcomes]
- **Link to Mission:** [How this serves the larger mission]
```

## Execution Log

After every Telos operation:
```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"pai-telos","workflow":"WORKFLOW","status":"ok","duration_s":SECONDS}' >> ~/.hermes/profiles/dev/pai/MEMORY/SKILLS/execution.jsonl
```
