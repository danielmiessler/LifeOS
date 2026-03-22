---
name: WorkCompletionLearning
pack-id: northwoodssentinel-workcompletionlearning-v1.0.0
version: 1.0.0
author: NorthwoodsSentinel
description: SessionEnd hook that captures work metadata and reflection prompts when significant work completes, writing structured learning files that compound insights across sessions.
type: skill
purpose-type:
  - learning
  - reflection
  - session-management
platform: claude-code
dependencies: []
keywords:
  - learning
  - session-end
  - work-capture
  - reflection
  - meta-learning
  - breadcrumb
  - compound-insights
---

# WorkCompletionLearning

> Stop losing the lessons from how you work. Capture what happened, what worked, and what you would do differently — automatically, every session.

## The Problem

You finish a deep work session. Files changed, problems solved, approaches discovered. Then you start the next thing. The meta-learning — why your approach worked, what surprised you, what patterns you would repeat — evaporates. The work output survives but the insight about the work does not.

This is the gap between doing work and learning from work. Most people never bridge it because the moment of completion is exactly when reflection feels least urgent.

## The Solution

WorkCompletionLearning is a SessionEnd hook that fires when your Claude Code session ends. It checks whether significant work was completed (files changed, multiple work items, manual creation). If so, it captures structured metadata and writes a learning file to a time-organized directory.

The learning file includes: title, duration, tools used, files changed, Ideal State Criteria satisfaction, and reflection prompts. Over weeks and months, these files create a searchable archive of how you work — not just what you produced.

## Installation

See [INSTALL.md](INSTALL.md) for step-by-step setup.

## What's Included

| File | Purpose |
|------|---------|
| `src/Tools/WorkCompletionLearning.hook.ts` | SessionEnd hook — main capture logic |
| `src/lib/learning-utils.ts` | Category classification (ALGORITHM vs SYSTEM) |
| `src/lib/time.ts` | Timezone-aware timestamp utilities |
| `src/SKILL.md` | Skill definition with invocation triggers |
| `src/Workflows/Capture.md` | How learning capture works end-to-end |
| `src/Workflows/Review.md` | How to review and use accumulated learnings |

## What Makes This Different

Most session logging tools capture transcripts or token counts. WorkCompletionLearning captures the shape of the work: what category it fell into, what tools were involved, how long it took, whether the Ideal State Criteria were met. It also provides reflection prompts that surface the meta-learning most people skip.

The output is organized by category (ALGORITHM for process insights, SYSTEM for infrastructure insights) and by month, making it easy to spot patterns over time.

## Invocation Scenarios

| Scenario | What Happens |
|----------|-------------|
| Session ends with files changed | Learning file created automatically |
| Session ends with multiple work items | Learning file created automatically |
| Session ends with manual work flag | Learning file created automatically |
| Trivial session (no changes, single item) | Skipped silently |
| No active work session | Skipped silently |
| Write failure | Logged to stderr, exits cleanly |

## Example Usage

After a session where you built a new API endpoint, the hook creates:

```
MEMORY/LEARNING/ALGORITHM/2026-03/2026-03-22_1730_work_api-endpoint-auth.md
```

Contents:

```markdown
# Work Completion Learning

**Title:** API Endpoint Auth Implementation
**Duration:** 1h 23m
**Category:** ALGORITHM
**Session:** sess_abc123

---

## Ideal State Criteria

**ISC:** 4/5 criteria passing

## What Was Done

- **Files Changed:** 7
- **Tools Used:** Read, Write, Bash, Grep
- **Agents Spawned:** 0

## Insights

*This work session completed successfully. Consider what made it effective:*

- Was the approach straightforward or did it require iteration?
- Were there any blockers or surprises?
- What patterns from this work apply to future tasks?
```

## Configuration

The hook reads its base directory from the `PAI_DIR` environment variable, defaulting to `~/.claude`. Required directory structure:

```
~/.claude/
  MEMORY/
    STATE/          # Current work session state
    WORK/           # Work directory with PRD.md or META.yaml
    LEARNING/
      ALGORITHM/    # Process and approach insights
      SYSTEM/       # Infrastructure and tooling insights
```

The `time.ts` utility reads timezone from your PAI settings via `principal.timezone`, defaulting to UTC.

## Origin

Built by Rob Chuvala after noticing he was solving the same problems repeatedly. The work output was good but the meta-learning — why it worked, what approach he used, what he would do differently — vanished at session end. This hook catches it automatically so insights compound over time instead of resetting to zero every session.

## Works Well With

- **DriftMon** — Analyzes accumulated learning files for behavioral drift signals
- **PAI Algorithm** — The LEARN phase (phase 7) generates insights that this hook persists
- **Any SessionEnd workflow** — Coordinates with cleanup hooks via ordering

## Changelog

### 1.0.0

- Initial release
- SessionEnd hook with significant work detection
- ALGORITHM/SYSTEM category classification
- ISC extraction from PRD.md frontmatter and legacy ISC.json
- Session-scoped state files with legacy fallback
- Timezone-aware file naming
- Reflection prompt generation
