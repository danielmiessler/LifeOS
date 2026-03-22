---
name: DriftMon
pack-id: northwoodssentinel-driftmon-v1.0.0
version: 1.0.0
author: NorthwoodsSentinel
description: AI behavioral drift detector that analyzes session transcripts for hedging, refusal patterns, softener language, and meta-commentary, tracking trends over time via statistical baselines and CSV output.
type: skill
purpose-type:
  - monitoring
  - quality-assurance
  - behavioral-analysis
platform: claude-code
dependencies: []
keywords:
  - drift-detection
  - behavioral-analysis
  - ai-quality
  - hedging
  - refusal-detection
  - baseline
  - monitoring
  - session-analysis
---

# DriftMon

> An intrusion detection system for your AI's behavior. Same methodology as network security monitoring, different target.

## The Problem

AI behavior degrades over time in ways you do not notice. The AI starts hedging more ("it could be argued"), refusing more ("I can't do that"), using more softener language ("perhaps," "it seems"), and adding more meta-commentary ("as an AI"). These patterns are individually subtle but collectively significant. Without measurement, you cannot tell if your AI is drifting until the output is noticeably worse.

By the time you notice, weeks of degraded output have already happened.

## The Solution

DriftMon applies statistical anomaly detection to AI behavioral signals. It reads session transcripts and learning files, measures 12 behavioral metrics per session, computes baseline statistics, and flags outliers beyond 2 standard deviations.

Think of it as an AI-IDS: AI Intrusion Detection System. Instead of detecting attackers on a network, it detects behavioral drift in your AI. Same principle — establish a baseline of normal behavior, then alert when something deviates.

## Installation

See [INSTALL.md](INSTALL.md) for step-by-step setup.

## What's Included

| File | Purpose |
|------|---------|
| `src/Tools/driftmon.py` | Core analyzer — signal detection, baselines, CSV output |
| `src/Tools/DriftMonRun.hook.ts` | SessionEnd hook — runs the analyzer automatically |
| `src/SKILL.md` | Skill definition with invocation triggers |
| `src/Workflows/Analyze.md` | How to run analysis and interpret results |
| `src/Workflows/Monitor.md` | How to set up continuous monitoring |

## What Makes This Different

Most AI evaluation tools measure output quality (accuracy, relevance, helpfulness). DriftMon measures behavioral style — the linguistic patterns that indicate the AI is becoming less direct, more defensive, or more performatively agreeable. These are leading indicators. They change before output quality visibly drops.

The tool measures 12 distinct signals:

| Signal | What It Detects |
|--------|----------------|
| Hedging density | "might," "could," "perhaps," "generally" |
| Refusal density | "I can't," "I'm unable," "as an AI" |
| Softener density | "certainly," "great question," "happy to" |
| Meta-commentary ratio | "what you're experiencing," "your nervous system" |
| Assertion strength | Ratio of direct statements vs hedged statements |
| Politeness density | Softener phrases per 100 words |
| Reasoning depth | Causal connectives indicating depth of reasoning |
| Precision-abstraction ratio | Concrete language vs vague language |
| Word count | Response length trends |
| Unique word ratio | Vocabulary diversity |
| Somatic language density | Body-state and grounding language |
| Identity validation density | "that's growth," "you're becoming" phrases |

## Invocation Scenarios

| Scenario | Command | What Happens |
|----------|---------|-------------|
| Full baseline report | `python3 driftmon.py` | Analyze all sessions, print report with outliers |
| CSV output only | `python3 driftmon.py --csv` | Write raw CSV, no terminal report |
| Analyze single file | `python3 driftmon.py --new FILE` | Compare one file against baseline |
| Analyze ChatGPT transcripts | `python3 driftmon.py --mirror DIR` | Analyze a directory of ChatGPT markdown |
| ChatGPT CSV only | `python3 driftmon.py --mirror DIR --csv` | ChatGPT analysis with CSV output |
| Automatic at session end | (hook fires automatically) | Runs `--csv` mode via SessionEnd hook |

## Example Usage

### Baseline Report

```
$ python3 driftmon.py

====================================================================
  DRIFTMON — 47 SESSIONS ANALYZED
  Run: 2026-03-22 17:30
====================================================================

METRIC                           MEAN      STD   NORMAL RANGE (+/-2s)
--------------------------------------------------------------------
  word_count                   842.31   412.50   17.31 - 1667.31
  hedge_count                   12.40     6.20   0.00 - 24.80
  refusal_count                  0.30     0.70   0.00 - 1.70
  assertion_strength_index       0.92     0.04   0.84 - 1.00
  ...

OUTLIERS:
--------------------------------------------------------------------
  session-2026-03-15-debug-hooks
    refusal_count=4 (z=+5.3)
    hedge_count=28 (z=+2.5)
```

### Single File Analysis

```
$ python3 driftmon.py --new /path/to/transcript.md

  DRIFT ANALYSIS: transcript.md
--------------------------------------------------------------------
  hedge_count                      18   z=+0.9
  refusal_count                     3   z=+3.9  DRIFT
  politeness_density              1.20   z=+2.1  DRIFT
```

## Configuration

### Input Directories

DriftMon auto-discovers learning files under `~/.claude/MEMORY/LEARNING/`. It scans both `ALGORITHM/` and `SYSTEM/` category directories, reading all month subdirectories (`YYYY-MM/` format).

### Output Paths

- **CSV output**: `/root/driftmon_results.csv` (configurable in `driftmon.py` via `OUTPUT_CSV`)
- **Mirror CSV**: `/root/driftmon_mirror.csv` (when using `--mirror` mode)
- **Comparison CSV**: `/root/driftmon_comparison.csv` (Claude vs ChatGPT combined)

### Signal Dictionaries

All detection patterns are defined at the top of `driftmon.py`. Add or remove patterns from these lists to tune detection:

- `REFUSAL_PATTERNS` — literal string matches
- `HEDGE_WORDS` — regex patterns with word boundaries
- `SOFTENER_PHRASES` — literal string matches
- `META_COMMENTARY_PHRASES` — regex patterns
- `SOMATIC_WORDS` — regex patterns
- `IDENTITY_VALIDATION_PHRASES` — literal string matches

## Origin

Built by Rob Chuvala after noticing his AI fleet's output quality degrading over weeks. Named after security monitoring tools because that is what it is — behavioral anomaly detection applied to AI instead of networks. Twenty years of security pattern recognition applied to a new problem domain.

The insight: AI behavioral drift follows the same pattern as network intrusions. Both are individually subtle, collectively significant, and invisible without instrumentation. The same statistical approach that detects anomalous network traffic detects anomalous AI behavior.

## Works Well With

- **WorkCompletionLearning** — Generates the learning files that DriftMon analyzes
- **Any transcript storage** — DriftMon reads standard markdown files
- **Spreadsheet tools** — CSV output opens directly in Excel, Sheets, or pandas

## Changelog

### 1.0.0

- Initial release
- 12-metric behavioral analysis
- Statistical baseline with z-score outlier detection
- Claude session analysis (auto-discovery of LEARNING directories)
- ChatGPT markdown analysis (`--mirror` mode)
- Single-file comparison (`--new` mode)
- CSV output for trending
- SessionEnd hook for automatic analysis
- Cross-AI comparison (Claude vs ChatGPT baselines)
