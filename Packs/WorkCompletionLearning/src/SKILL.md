---
name: WorkCompletionLearning
description: >
  Captures structured learning files from completed work sessions at SessionEnd.
  USE WHEN: A session ends with significant work completed (files changed, multiple
  work items, or manual work flag). USE WHEN: You want to review past work patterns
  and meta-learning. USE WHEN: You need to understand what approaches worked in
  previous sessions.
---

# WorkCompletionLearning

Bridges the gap between doing work and learning from work. Fires automatically at SessionEnd when significant work is detected.

## Customization

### Category Classification

Edit `lib/learning-utils.ts` to adjust how learnings are categorized:

- **ALGORITHM**: Process, approach, and method insights (default)
- **SYSTEM**: Infrastructure, tooling, and configuration insights

Add patterns to `algorithmIndicators` or `systemIndicators` arrays to match your vocabulary.

### Significant Work Threshold

In the main hook, the `hasSignificantWork` check determines whether a learning is captured. Adjust these conditions:

- `files_changed.length > 0` — any file modification triggers capture
- `task_count > 1` — multiple work items trigger capture
- `source === 'MANUAL'` — manually flagged work always captures

### Reflection Prompts

Edit the `writeLearning` function's template to change the reflection questions. Current prompts:

- Was the approach straightforward or did it require iteration?
- Were there any blockers or surprises?
- What patterns from this work apply to future tasks?

## Workflow Routing

| Trigger | Workflow | Description |
|---------|----------|-------------|
| Session ends with significant work | [Capture](Workflows/Capture.md) | Automatic learning file creation |
| Review accumulated learnings | [Review](Workflows/Review.md) | Browse and search past learnings |

## Quick Reference

```
Hook trigger:     SessionEnd
Input:            stdin JSON (session_id), disk state files
Output:           MEMORY/LEARNING/{category}/{YYYY-MM}/{date}_{time}_work_{slug}.md
Categories:       ALGORITHM (process), SYSTEM (infrastructure)
Skip conditions:  No active work, no metadata, trivial session
Error handling:   Silent exit (never disrupts workflow)
Performance:      <100ms typical
```

## Examples

**Automatic capture after building a feature:**

Session ends. Hook reads `current-work.json`, finds the work directory, reads `PRD.md` frontmatter, extracts ISC satisfaction (3/4 passing), notes 12 files changed and 4 tools used. Writes learning file to `MEMORY/LEARNING/ALGORITHM/2026-03/2026-03-22_1430_work_feature-auth-api.md`.

**Skipped trivial session:**

Session ends. Hook reads `current-work.json`, finds the work directory, sees zero files changed, single work item, non-manual source. Logs "Trivial work session, skipping learning capture" to stderr and exits.

**Reviewing patterns over time:**

After two weeks, browse `MEMORY/LEARNING/ALGORITHM/2026-03/` to see all process learnings for the month. Notice that sessions involving API work consistently take longer than expected. Adjust future estimation.
