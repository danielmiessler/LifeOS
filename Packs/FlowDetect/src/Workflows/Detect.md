# Detect Workflow

## Purpose

Detect flow states during or after AI sessions by analyzing user message patterns in the session transcript.

## When This Runs

- **Automatically:** The hook fires at SessionEnd, running `flowdetect.py --csv` to update the baseline dataset
- **On demand:** The AI or user can invoke `flowdetect.py --live SESSION_ID` mid-session to check current flow state
- **Score only:** `flowdetect.py --score SESSION_ID` returns just the numeric score for scripting or threshold checks

## Process

### Step 1: Read Session Transcript

FlowDetect reads the JSONL transcript for the target session. It extracts only user messages, filtering out:
- Tool result messages (system-generated, not user-typed)
- System command messages
- Messages with system-reminder tags (stripped before analysis)

A minimum of 3 user messages is required. Fewer than that and the session is skipped.

### Step 2: Compute Metrics

Twelve metrics are computed from the user messages:

**Flow indicators (higher = more flow):**
1. **Median message length** — Words per message. Shorter = more flow.
2. **Short message ratio** — Fraction of messages under 10 words.
3. **Typo density** — Missing apostrophes and known typo patterns per 100 words.
4. **Punctuation density** — Punctuation marks per 100 characters. Lower = more flow.
5. **Lowercase start ratio** — Fraction of messages starting with lowercase letter.
6. **Imperative ratio** — Fraction of messages starting with command verbs (do, fix, build, run, check...).
7. **Message velocity** — Total message count as engagement proxy.
8. **Word dropping score** — Fraction of messages that are sentence fragments (3 words or fewer, no verbs).

**Anti-flow indicators (higher = less flow):**
9. **Small talk ratio** — Fraction of messages containing greetings, thanks, pleasantries.
10. **Deliberation ratio** — Fraction of messages with uncertainty markers ("should we", "what if", "maybe").
11. **Capitalization ratio** — Fraction of messages starting with uppercase (inverse of lowercase start).
12. **Average message length** — Mean words per message (complement to median).

### Step 3: Compute Composite Score

The composite flow score starts at 50 (neutral) and adjusts based on each metric:

- Shorter messages: up to +15 points
- High short message ratio: up to +10 points
- Higher typo density: up to +10 points
- Lower punctuation: up to +8 points
- Lowercase starts: up to +7 points
- Imperative commands: up to +8 points
- Small talk: up to -8 points
- Deliberation: up to -8 points
- High message count: up to +7 points
- Word dropping: up to +5 points

Final score is clamped to 0-100.

### Step 4: Classify and Report

| Score | Classification | Suggested Action |
|-------|---------------|-----------------|
| 80-100 | DEEP FLOW | Suggest biometric capture, protect the state |
| 65-79 | FLOW | Note good session momentum |
| 45-64 | ENGAGED | No action needed |
| 30-44 | DELIBERATE | No action needed |
| 0-29 | EXPLORATORY | No action needed |

In `--live` mode, the score is compared against the baseline (z-score) to show how this session compares to the user's typical sessions.

### Step 5: Output

- **CSV mode (--csv):** Writes all session metrics to CSV file for baseline building
- **Live mode (--live):** Prints flow state, score, z-score, key metrics, and suggestions
- **Score mode (--score):** Prints just the numeric score (0-100)
- **Full report (no flags):** Prints comprehensive analysis with rankings, distributions, and baselines
