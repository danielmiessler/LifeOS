---
name: VitalsDump
description: >
  USE WHEN the user asks about their biometrics, vitals, sleep, HRV, readiness, Body Battery,
  stress levels, or resting heart rate. USE WHEN the user wants to check their physical state
  before starting work. USE WHEN correlating cognitive performance with body data. USE WHEN
  the user mentions Oura, Garmin, wearables, or health tracking in the context of their AI workflow.
---

# VitalsDump

Pull daily biometric summaries from Oura Ring and Garmin Connect into structured markdown.

## Workflow Routing

| Trigger | Workflow | Description |
|---------|----------|-------------|
| "check my vitals" | [Dump](Workflows/Dump.md) | Pull today's biometric summary |
| "how did I sleep" | [Dump](Workflows/Dump.md) | Pull sleep data for today or yesterday |
| "pull yesterday's vitals" | [Dump](Workflows/Dump.md) | Pull biometric summary for yesterday |
| "vitals for [date]" | [Dump](Workflows/Dump.md) | Pull biometric summary for a specific date |
| "am I ready for deep work" | [Dump](Workflows/Dump.md) | Check readiness and Body Battery before a session |
| "why was yesterday rough" | [Dump](Workflows/Dump.md) | Pull yesterday's vitals to find physiological explanation |

## Quick Reference

```bash
# Today
python3 src/Tools/vitals-dump.py

# Yesterday
python3 src/Tools/vitals-dump.py --yesterday

# Specific date
python3 src/Tools/vitals-dump.py --date 2026-03-14
```

**Output:** Dated markdown file with Oura data, Garmin data, governor flags, and cross-reference table.

**Credentials:** `OURA_TOKEN`, `GARMIN_EMAIL`, `GARMIN_PASSWORD` as env vars or in `~/.claude/.credentials.json`.

## Examples

**User:** "Check my vitals before we start this session."
**Action:** Run `python3 src/Tools/vitals-dump.py`, read the output file, summarize key findings and any governor flags.

**User:** "I had a terrible work session yesterday. Pull my vitals."
**Action:** Run `python3 src/Tools/vitals-dump.py --yesterday`, read the output, correlate sleep/HRV/stress with the reported experience.

**User:** "Show me March 14th vitals."
**Action:** Run `python3 src/Tools/vitals-dump.py --date 2026-03-14`, read and present the report.
