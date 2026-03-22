---
name: Flinch
description: Somatic signal capture for cognitive instrumentation -- fast CLI logging of body signals with scoring and pattern analysis. USE WHEN flinch, gut feeling, something feels off, body signal, somatic, chest tightening, gut pull, excitement spike, log a signal, capture what I felt, review flinches, score flinch, flinch accuracy, flinch stats, pattern refine, trust my gut, override instinct, nervous system signal, felt something wrong.
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/Flinch/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# Flinch -- Somatic Signal Capture

A 5-second CLI tool that captures body signals, reviews them later, and scores whether the signal was correct. Turns gut instinct from something you ignore into something you measure.

**Tool location:** `~/.claude/skills/Flinch/src/Tools/flinch.ts`
**Runtime:** `bun flinch.ts <args>`

## Workflow Routing

Route to the appropriate workflow based on user intent.

| User Intent | Route To | Tool Command |
|---|---|---|
| Capture a signal in the moment | `Workflows/Capture.md` | `flinch "signal"` |
| Review unscored flinches | `Workflows/Review.md` | `flinch --review` |
| Score a past flinch or check accuracy | `Workflows/Score.md` | `flinch --score <id> <outcome>` or `flinch --stats` |
| See patterns ready for integration | `Workflows/Score.md` | `flinch --refine` |
| Default / "log a flinch" | `Workflows/Capture.md` | `flinch "signal"` |

## Quick Reference

```
# Capture
flinch "description of what you felt"
flinch "signal" --trigger file.md --state tired --intensity 3 --pattern hedging

# Review
flinch --review              # show unscored entries

# Score
flinch --score <id> correct  # score as correct, wrong, or unclear

# Analyze
flinch --stats               # accuracy and pattern stats
flinch --refine              # show patterns at 3+ occurrences
```

## Optional Flags for Capture

| Flag | Value | Purpose |
|---|---|---|
| `--trigger` | file path or context | What triggered the signal |
| `--state` | free text (e.g., tired, flow, rested) | Your state when the signal fired |
| `--intensity` | 1-5 | How strong the signal was |
| `--pattern` | named pattern (e.g., hedging, ai-fluff) | Recurring pattern category |

## Data Storage

| Data | Path |
|---|---|
| Signal log | `~/.claude/flowlabs/logs/somatic_history.jsonl` |
| Voice reference (for --refine) | `projects/-root--claude/memory/rob-voice-reference.md` |

## Examples

**Fast capture during a session:**
```
User: "Something felt off when Archie hedged on the assessment."
Action: Run flinch "chest tightening when Archie hedged on the assessment"
```

**Capture with context:**
```
User: "I'm tired and this proposal feels wrong but I can't say why."
Action: Run flinch "gut pull -- something wrong with this proposal" --state tired --intensity 3
```

**End-of-day review:**
```
User: "Show me what I flagged today."
Action: Run flinch --review
Then: Walk through each entry, ask if user wants to score them.
```

**Accuracy check:**
```
User: "How reliable are my gut instincts?"
Action: Run flinch --stats
Then: Highlight accuracy-by-state patterns.
```

## Design Principles

1. **Speed over ceremony.** Capture in 5 seconds or it won't get captured.
2. **No interpretation.** Log what was felt, not what it means.
3. **Scoring creates data.** Without outcome scoring, flinches are just journal entries.
4. **State matters.** Accuracy varies by state -- track it.
5. **Patterns surface themselves.** At 3+ occurrences, the system flags them.
