---
name: FlowDetect
pack-id: northwoodssentinel-flowdetect-v1.0.0
version: 1.0.0
author: NorthwoodsSentinel
description: Detects user flow states during AI sessions by analyzing message patterns — frequency, brevity, typo density, and command directness
type: skill
purpose-type:
  - cognitive-instrumentation
  - flow-detection
  - session-analysis
platform: claude-code
dependencies: []
keywords:
  - flow-state
  - cognitive
  - biometrics
  - session-analysis
  - message-patterns
  - productivity
  - hooks
---

# FlowDetect

> You don't notice flow until it's gone. This catches it while it's happening.

## The Problem

Flow states are the most productive cognitive mode a human can enter. But people rarely realize they are in flow until after they leave it. By the time you notice, the state is gone.

If you work with AI for extended sessions, your message patterns change when you enter flow. You type faster. You skip punctuation. You drop capitalization. Your messages get shorter and more direct — terse commands instead of polite requests. You stop asking questions and start issuing instructions. You stop saying "please" and "thank you."

These are measurable signals. But nobody is measuring them.

If you could detect flow while it is happening, you could:
- **Protect it** — suppress notifications, avoid interruptions, tell the AI to stay terse
- **Capture it** — start biometric recording (heart rate, HRV) to correlate with cognitive state
- **Extend it** — adjust the AI's behavior to maintain the conditions that support flow
- **Study it** — build a personal dataset of when, how, and why you enter flow

## The Solution

FlowDetect analyzes user message patterns during Claude Code sessions to detect flow states. It measures eight flow indicators and four anti-flow indicators across the session transcript, computes a composite flow score (0-100), and classifies the session state.

### Flow Indicators (higher = more flow)

| Indicator | What It Measures |
|-----------|-----------------|
| Message brevity | Shorter messages = less deliberation, more action |
| Typo density | More typos = typing fast, not proofreading |
| Punctuation drops | Less punctuation = not bothering with formality |
| Lowercase starts | Not hitting shift = typing in stream-of-consciousness |
| Imperative ratio | Starting messages with verbs = commanding, not requesting |
| Message velocity | More messages = higher engagement |
| Word dropping | Incomplete sentences = thinking faster than typing |
| Short message ratio | Fraction of messages under 10 words |

### Anti-Flow Indicators (higher = less flow)

| Indicator | What It Measures |
|-----------|-----------------|
| Small talk | Greetings, pleasantries, filler = not in deep focus |
| Deliberation | "Should we...", "What if...", "Maybe..." = planning mode, not execution mode |
| Long messages | Extended explanations = teaching or thinking out loud, not doing |
| Perfect grammar | Proper punctuation and capitalization = careful composition, not flow |

## Installation

See [INSTALL.md](INSTALL.md) for step-by-step setup.

## What's Included

| File | Purpose |
|------|---------|
| `src/Tools/FlowDetect.hook.ts` | Hook that fires at SessionEnd, triggers flow analysis |
| `src/Tools/flowdetect.py` | Core analysis engine — pattern detection, scoring, reporting |
| `src/SKILL.md` | Skill definition with USE WHEN triggers for AI routing |
| `src/Workflows/Detect.md` | Workflow for real-time flow detection during sessions |
| `src/Workflows/Analyze.md` | Workflow for historical session analysis and baseline building |

## What Makes This Different

FlowDetect does not measure productivity. It does not count lines of code or tasks completed. It measures the cognitive state of the human based on how they communicate.

The insight is that flow changes language before it changes output. A person in flow writes differently — shorter, faster, less formal, more direct. These patterns are detectable in any text-based interaction, but they are especially pronounced in AI sessions where the human is issuing rapid instructions.

The scoring algorithm was calibrated against real sessions with confirmed flow states (verified by Garmin biometric data showing sustained elevated heart rate and minimal HRV disruption). A score of 81 on the first live test was confirmed as deep flow by the physiological data.

## Invocation Scenarios

| Scenario | What Happens |
|----------|-------------|
| Session ends normally | Hook fires, analyzes transcript, writes flow score to CSV |
| Mid-session check (AI-initiated) | AI calls flowdetect.py with --live flag to check current flow state |
| Historical analysis | Run flowdetect.py without flags to analyze all sessions and build baseline |
| Quick score check | Run flowdetect.py with --score flag to get just the 0-100 score |
| Biometric correlation | Deep flow detected (score 80+) triggers suggestion to start Garmin recording |

## Example Usage

### Automatic (SessionEnd hook)

The hook fires automatically when a Claude Code session ends. It runs the CSV update mode to build your baseline dataset over time.

### Live Session Check

```bash
# Check flow state of current session
python3 flowdetect.py --live SESSION_ID

# Output:
# FLOW STATE: DEEP FLOW  (score: 81/100, z=+1.8 vs baseline)
#   Messages: 47  |  Median length: 6.0 words
#   Typo density: 2.3  |  Lowercase starts: 0.72
#   Imperatives: 0.45  |  Small talk: 0.02
#
#   Suggestion: You're in deep flow. Consider starting a Garmin session to capture biometrics.
```

### Full Analysis Report

```bash
# Analyze all sessions, build baseline, print report
python3 flowdetect.py

# Output includes:
# - Flow score statistics (mean, median, std, range)
# - Per-metric baselines across all sessions
# - Top 10 flow sessions ranked by score
# - Bottom 5 sessions (least flow)
# - Flow distribution histogram (Deep Flow / Flow / Neutral / Deliberate / Exploratory)
```

### Score Only

```bash
# Get just the numeric score for scripting
python3 flowdetect.py --score SESSION_ID
# Output: 81
```

## Configuration

### Hook Configuration

Add to your Claude Code `settings.json`:

```json
{
  "hooks": {
    "SessionEnd": [
      {
        "type": "command",
        "command": "~/.claude/hooks/FlowDetect.hook.ts"
      }
    ]
  }
}
```

### Transcript Directories

Edit the `TRANSCRIPT_DIRS` list in `flowdetect.py` to point to your Claude Code project directories:

```python
TRANSCRIPT_DIRS = [
    Path("~/.claude/projects/-root--claude"),
    Path("~/.claude/projects/-root"),
    # Add your project directories here
]
```

### Output Path

Default CSV output: `~/flowdetect_results.csv`. Change `OUTPUT_CSV` in `flowdetect.py` to customize.

### Flow Score Thresholds

The default classification brackets:

| Score Range | Classification |
|-------------|---------------|
| 80-100 | DEEP FLOW |
| 65-79 | FLOW |
| 45-64 | ENGAGED |
| 30-44 | DELIBERATE |
| 0-29 | EXPLORATORY |

These can be adjusted in the `print_live_analysis` function.

## Origin

Built as part of Rob Chuvala's FlowLabs cognitive instrumentation project. The hypothesis: if flow changes how you communicate, and AI sessions are pure text communication, then AI transcripts are a rich dataset for flow detection.

First tested during a 5-hour flow session on March 20, 2026. FlowDetect scored the session at 81 (DEEP FLOW). This was independently confirmed by Garmin biometric data showing sustained elevated heart rate and minimal HRV disruption throughout the session. The score matched the subjective experience and the physiological data.

The scoring algorithm was then calibrated across 60+ historical sessions to establish baselines. Sessions known to be exploratory or deliberate scored consistently lower. Sessions known to be high-intensity deep work scored consistently higher.

## Works Well With

- **PreCompact** — If deep flow is detected when context compaction hits, the PreCompact preamble can note the flow state so post-compaction AI maintains flow-protective behavior.
- **Garmin/biometric integration** — When flow score exceeds 80, FlowDetect suggests starting a biometric recording session for physiological correlation.
- **DriftMon** — AI behavioral drift monitoring. FlowDetect watches the human side while DriftMon watches the AI side. Together they instrument the full session.
- Any session analytics or journaling system — FlowDetect outputs standard CSV that any tool can consume.

## Changelog

### 1.0.0 (2026-03-22)
- Initial release
- SessionEnd hook with CSV baseline building
- Live session analysis with --live flag
- Score-only mode with --score flag
- Full report mode with metric baselines and rankings
- 12 flow/anti-flow indicators
- Composite scoring algorithm (0-100)
- Five-tier classification (Deep Flow / Flow / Engaged / Deliberate / Exploratory)
