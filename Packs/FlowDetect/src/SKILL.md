---
name: FlowDetect
description: >
  USE WHEN analyzing user message patterns for flow state indicators, session
  is long-running and user may be in flow, biometric capture should be suggested,
  historical session analysis is needed, or flow score comparison against baseline
  is requested.
---

# FlowDetect Skill

## Workflow Routing

| Situation | Workflow | File |
|-----------|----------|------|
| Check if user is currently in flow | Detect | `Workflows/Detect.md` |
| Analyze historical sessions for flow patterns | Analyze | `Workflows/Analyze.md` |
| Session ending, update baseline | Detect (automatic) | `Workflows/Detect.md` |
| Compare current session to baseline | Detect (--live mode) | `Workflows/Detect.md` |
| Build or rebuild flow score CSV | Analyze (--csv mode) | `Workflows/Analyze.md` |

## Quick Reference

- **Hook trigger:** SessionEnd (automatic CSV update)
- **Live check:** `python3 flowdetect.py --live SESSION_ID`
- **Score only:** `python3 flowdetect.py --score SESSION_ID`
- **Full report:** `python3 flowdetect.py`
- **CSV update:** `python3 flowdetect.py --csv`
- **Score range:** 0-100 (50 = neutral baseline)
- **Flow threshold:** 65+ = flow, 80+ = deep flow
- **Minimum messages:** 3 user messages required for analysis

## Examples

**User is sending rapid, terse commands with typos:**
- This is a flow signal. Run `--live` to confirm.
- If score is 80+, suggest protecting the state (no interruptions, stay terse in responses).

**User asks "am I in flow right now?":**
- Run `--live` or `--score` against the current session transcript.
- Report the score, classification, and which indicators are elevated.

**End of a long session, user wants to know how it went:**
- Run full analysis mode to show where this session ranks against the baseline.
- Highlight the z-score (how many standard deviations above/below the user's average).

**User wants to find their best flow sessions:**
- Run full report mode. Top 10 flow sessions are listed with timestamps.
- Cross-reference with calendar or project notes to identify flow conditions.
