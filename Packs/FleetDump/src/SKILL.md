---
name: FleetDump
description: >
  USE WHEN the user asks what their AI fleet did today, yesterday, or on a specific date.
  USE WHEN the user wants a daily standup or activity summary across their AI infrastructure.
  USE WHEN the user asks about git commits, fleet dispatches, memory changes, or flinch log status.
  USE WHEN the user wants to feed activity data to an external governor or oversight system.
  USE WHEN reviewing whether the day's pace was sustainable.
---

# FleetDump

Collect daily activity from all AI systems and infrastructure into a single dated markdown summary.

## Workflow Routing

| Trigger | Workflow | Description |
|---------|----------|-------------|
| "what did the fleet do today" | [Dump](Workflows/Dump.md) | Collect and write today's activity |
| "fleet dump" | [Dump](Workflows/Dump.md) | Run the daily activity collection |
| "yesterday's activity" | [Dump](Workflows/Dump.md) | Collect yesterday's fleet activity |
| "activity for [date]" | [Dump](Workflows/Dump.md) | Collect activity for a specific date |
| "review today's dump" | [Review](Workflows/Review.md) | Read and interpret an existing fleet dump |
| "was today sustainable" | [Review](Workflows/Review.md) | Analyze pace and patterns from the dump |
| "what should the governor know" | [Dump](Workflows/Dump.md) + [Review](Workflows/Review.md) | Generate and interpret for governor feed |

## Quick Reference

```bash
# Today
python3 src/Tools/fleet-dump.py

# Yesterday
python3 src/Tools/fleet-dump.py --yesterday

# Specific date
python3 src/Tools/fleet-dump.py --date 2026-03-14
```

**Output:** Dated markdown file with session estimate, git activity, GitHub activity, fleet dispatches, work sessions, memory changes, flinch log, and governor questions.

**Requirements:** Python 3, git, optionally `gh` CLI for cross-repo GitHub monitoring.

## Examples

**User:** "Run the fleet dump."
**Action:** Run `python3 src/Tools/fleet-dump.py`, confirm output file was written, summarize key activity.

**User:** "What did we do yesterday?"
**Action:** Run `python3 src/Tools/fleet-dump.py --yesterday`, read the output, present the activity summary with session duration and commit highlights.

**User:** "Review today's fleet dump and tell me if the pace is sustainable."
**Action:** Read the existing dump file, analyze commit volume, session span, and pace flags. Cross-reference with vitals if available. Give an honest assessment.
