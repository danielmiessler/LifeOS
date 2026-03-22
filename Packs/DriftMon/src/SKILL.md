---
name: DriftMon
description: >
  AI behavioral drift detector that measures hedging, refusals, softeners, and
  meta-commentary across sessions using statistical baselines.
  USE WHEN: You suspect your AI's output quality is degrading over time.
  USE WHEN: You want to establish a behavioral baseline for your AI sessions.
  USE WHEN: You need to compare behavioral patterns between different AI systems.
  USE WHEN: You want evidence-based monitoring of AI behavioral consistency.
---

# DriftMon

Behavioral anomaly detection for AI systems. Establishes statistical baselines from session data and flags deviations.

## Customization

### Signal Dictionaries

All detection patterns are defined at the top of `driftmon.py`. Modify these to match your domain:

- **REFUSAL_PATTERNS**: Literal strings indicating the AI is declining to help
- **HEDGE_WORDS**: Regex patterns for qualifying language
- **SOFTENER_PHRASES**: Literal strings for performative agreeableness
- **META_COMMENTARY_PHRASES**: Regex patterns for the AI commenting on the user's state
- **SOMATIC_WORDS**: Regex patterns for body-state language
- **IDENTITY_VALIDATION_PHRASES**: Literal strings for identity-affirming language

### Outlier Threshold

The default threshold is 2 standard deviations (z-score >= 2.0). To adjust sensitivity, change the threshold in the `print_report` and `analyze_new_file` functions:

```python
if abs(z) >= 2.0:  # Change to 1.5 for higher sensitivity, 3.0 for lower
```

### Input Format

DriftMon expects learning files with a `<details><summary>Full Response</summary>` section containing the AI's response text. For ChatGPT markdown, it expects `### YYYY-MM-DD HH:MM:SS | ASSISTANT` headers.

To add support for other formats, add a new extraction function following the pattern of `extract_response_text` or `extract_mirror_turns`.

## Workflow Routing

| Trigger | Workflow | Description |
|---------|----------|-------------|
| Manual analysis run | [Analyze](Workflows/Analyze.md) | Run analysis and interpret results |
| Continuous monitoring setup | [Monitor](Workflows/Monitor.md) | Automate analysis at session end |

## Quick Reference

```
Analyzer:        driftmon.py (Python 3, stdlib only)
Hook:            DriftMonRun.hook.ts (SessionEnd, optional)
Input:           MEMORY/LEARNING/**/*.md files
Output:          CSV file + terminal report
Metrics:         12 behavioral signals
Baseline:        Mean + standard deviation per metric
Outlier:         z-score >= 2.0
Modes:           baseline, --csv, --new FILE, --mirror DIR
```

## Examples

**Weekly drift check:**

Run `python3 driftmon.py` to see the full report. Check the OUTLIERS section for sessions that deviated significantly from baseline. If refusal count is trending up, investigate what changed.

**Comparing Claude and ChatGPT:**

Run `python3 driftmon.py --mirror /path/to/chatgpt/exports/` to see how ChatGPT's behavioral patterns differ from Claude's baseline. The DELTA table shows which metrics diverge most.

**Pre-deployment check:**

Before promoting a new system prompt or configuration, run a session and then `python3 driftmon.py --new /path/to/new-session.md` to verify the output falls within normal behavioral range.
