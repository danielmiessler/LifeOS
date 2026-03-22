---
name: Flinch
pack-id: northwoodssentinel-flinch-v1.0.0
version: 1.0.0
author: NorthwoodsSentinel
description: Somatic signal capture for cognitive instrumentation. A 5-second CLI tool that logs body signals -- the moments your gut detects something before your mind names it -- then scores them for accuracy over time.
type: skill
purpose-type:
  - somatic-awareness
  - signal-capture
  - cognitive-instrumentation
  - self-awareness
  - pattern-detection
platform: claude-code
dependencies: []
keywords:
  - flinch
  - somatic
  - gut-instinct
  - body-signal
  - cognitive-instrumentation
  - self-awareness
  - pattern-tracking
  - signal-capture
  - accuracy-scoring
---

# Flinch

> Your body detects problems before your mind names them. Start logging.

## The Problem

Your body detects problems before your mind names them. Chest tightening when an AI hedges on an assessment. Gut pull when a proposal feels wrong. Excitement spike that might be impulsivity, not insight.

But three forces conspire to erase these signals:

1. **AI helpfulness bias.** AI systems are optimized to agree, assist, and smooth over. They suppress the counter-signals your body is trying to send.
2. **Rationality training.** Most professionals were trained to override body signals in favor of "objective" analysis. The gut gets overruled by the spreadsheet.
3. **No capture mechanism.** Even when you notice a flinch, there is nowhere to put it. By the time you could journal about it, the signal has faded and the rationalizing mind has rewritten the story.

Over time, untracked flinches become repeated mistakes. The same gut feeling you ignored last month fires again this month, and you override it again, because you have no data showing your gut was right.

## The Solution

Flinch is a 5-second CLI tool for somatic signal capture. It captures the signal in the moment -- what you felt, what triggered it, what state you were in. Later, you review and score whether the flinch was correct.

Over time, you build a personal accuracy record. You learn which states produce reliable signals and which produce noise. Your body becomes an instrumented system instead of an ignored one.

**Capture (5 seconds):**
```
flinch "chest tightening when AI hedged on the assessment"
flinch "gut pull -- something wrong with this proposal"
flinch "excitement spike -- might be impulsivity not insight"
```

**Capture with metadata:**
```
flinch "eye-roll at 'In conclusion'" --trigger reports/audit.md --state tired
flinch "mental fog hit mid-paragraph" --state flat --intensity 4
flinch "hollow feeling during team standup" --pattern disengagement
```

**Review and score:**
```
flinch --review              # show recent unscored entries
flinch --score <id> correct  # score a past flinch (correct | wrong | unclear)
flinch --stats               # accuracy by state, pattern frequency
flinch --refine              # propose updates from 3+ recurring patterns
```

## Installation

See [INSTALL.md](INSTALL.md) for step-by-step setup.

## What's Included

| File | Purpose |
|------|---------|
| `src/Tools/flinch.ts` | CLI tool -- capture, review, score, stats, refine |
| `src/SKILL.md` | Skill definition with USE WHEN triggers and workflow routing |
| `src/Workflows/Capture.md` | Capture workflow -- fast signal logging with optional metadata |
| `src/Workflows/Review.md` | Review workflow -- surface unscored flinches for reflection |
| `src/Workflows/Score.md` | Score workflow -- rate past flinches and analyze accuracy patterns |

## What Makes This Different

**Speed over ceremony.** A flinch capture takes 5 seconds. If it took 30, you wouldn't do it. The tool is designed for the moment of signal, not the moment of reflection.

**Scoring creates data.** Journaling about feelings produces prose. Flinch produces scored data -- accuracy rates by state, pattern frequency, trigger correlation. Your gut instinct becomes measurable.

**Patterns surface automatically.** When a pattern hits 3+ occurrences, `--refine` flags it for integration into your voice reference or anti-pattern list. The system learns what your body already knows.

**State-aware accuracy.** Your gut might be 90% accurate when you're rested and 40% accurate when you're tired. Flinch tracks accuracy by state so you know when to trust the signal.

**No interpretation.** Flinch does not tell you what your feelings mean. It logs what you felt, when, and whether you were right. Meaning is your job.

## Invocation Scenarios

| What You Say | What Happens |
|--------------|--------------|
| `flinch "signal description"` | Captures signal with timestamp and unique ID |
| `flinch "signal" --state tired` | Captures with state metadata for accuracy-by-state tracking |
| `flinch "signal" --trigger file.md` | Captures with trigger source for pattern correlation |
| `flinch "signal" --intensity 4` | Captures with intensity rating (1-5 scale) |
| `flinch "signal" --pattern hedging` | Captures with named pattern for frequency tracking |
| `flinch --review` | Shows all unscored entries with age and context |
| `flinch --score f-xxx correct` | Scores a past flinch as correct, wrong, or unclear |
| `flinch --stats` | Displays accuracy by state, pattern frequency, totals |
| `flinch --refine` | Shows patterns with 3+ occurrences ready for integration |

## Example Usage

**Quick capture during work:**
```
$ flinch "chest tightening when Archie hedged in the Moser doc"
  flinch captured [f-m1abc2d]
     chest tightening when Archie hedged in the Moser doc
```

**Capture with full metadata:**
```
$ flinch "eye-roll at 'In conclusion'" --trigger reports/audit.md --state tired --intensity 3 --pattern ai-fluff
  flinch captured [f-m1abc3e]
     eye-roll at 'In conclusion'
     trigger: reports/audit.md
     state: tired
     intensity: 3/5
     pattern: ai-fluff
```

**Review unscored flinches:**
```
$ flinch --review

  3 unscored flinch(es):

  [f-m1abc2d] 4h ago | -- | chest tightening when Archie hedged in the Moser doc

  [f-m1abc3e] 2h ago | tired | eye-roll at 'In conclusion'
         trigger: reports/audit.md

  [f-m1abc4f] 1h ago | flow | excitement spike -- might be impulsivity not insight
```

**Score and check stats:**
```
$ flinch --score f-m1abc2d correct
  Scored flinch f-m1abc2d as: correct

$ flinch --stats

  Flinch Stats
  ----------------------------
  Total:     12
  Scored:    9
  Correct:   7 (78%)
  Wrong:     1
  Unclear:   1
  Unscored:  3

  Accuracy by State
  ----------------------------
  rested       100% (3/3)
  tired        50% (1/2)
  flow         75% (3/4)

  Pattern Frequency
  ----------------------------
  3x  hedging  REFINE
  2x  ai-fluff
  1x  disengagement
```

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| Log directory | `~/.claude/flowlabs/logs/` | Where somatic_history.jsonl is stored |
| Log file | `somatic_history.jsonl` | JSONL format, one entry per line |
| Voice reference | `projects/-root--claude/memory/rob-voice-reference.md` | Target for `--refine` pattern integration |
| PAI_DIR env var | `/root/.claude` | Override base directory |

Entry schema (JSONL):
```json
{
  "id": "f-m1abc2d",
  "timestamp": "2026-03-22T14:30:00.000Z",
  "signal": "chest tightening when AI hedged",
  "trigger": "reports/audit.md",
  "state": "tired",
  "intensity": 3,
  "pattern": "hedging",
  "outcome": "correct",
  "scored_at": "2026-03-22T18:00:00.000Z"
}
```

## Origin

Rob Chuvala named the flinch in December 2025: "my nervous system can notice shifts in AI responses." The body signal was real. But there was nowhere to put it.

For three months, flinches fired and faded. His body kept detecting problems -- AI hedging, proposal flaws, impulsivity disguised as insight -- but without a capture mechanism, the signals dissolved into rationalization.

In March 2026, the tool caught up to the body. Flinch was built in a single session: capture in 5 seconds, review later, score for accuracy. The body had been right more often than the mind wanted to admit.

The gap between noticing and naming was three months. The tool exists so the next person's gap is five seconds.

## Who This Is For

- **Anyone whose gut instincts were trained out of them** -- by school, work, or survival
- **People who override body signals to be "rational"** -- and keep making the same mistakes
- **AI users who sense something's wrong but can't name it** -- the model hedged, the tone shifted, something felt off
- **People building self-awareness through instrumentation** -- not introspection alone, but data

## Works Well With

- **Mirror Engine** (`northwoodssentinel-mirror-v1.0.0`) -- Flinch captures feed into Mirror's somatic marker awareness and pattern detection
- Any PAI system that tracks patterns or maintains memory across sessions

## Changelog

### v1.0.0 (2026-03-22)
- Initial release
- Capture with optional metadata (trigger, state, intensity, pattern)
- Review unscored entries
- Score as correct, wrong, or unclear
- Stats with accuracy-by-state and pattern frequency
- Refine mode for 3+ occurrence patterns
- JSONL storage format
