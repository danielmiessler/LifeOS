# Score Workflow

**When to use:** User wants to score a past flinch, check their accuracy stats, or see patterns ready for integration.

**Core principle:** Turn signals into data. Scoring is what separates instrumentation from journaling.

## Steps

### Step 1: Determine Sub-Action

The Score workflow handles three related actions:

| User Intent | Command |
|---|---|
| Score a specific flinch | `flinch --score <id> <outcome>` |
| View accuracy and pattern stats | `flinch --stats` |
| See patterns ready for voice reference updates | `flinch --refine` |

### Step 2a: Score a Flinch

```bash
bun ~/.claude/skills/Flinch/src/Tools/flinch.ts --score <id> <outcome>
```

**Outcome values:**
- `correct` -- The signal was right. The thing I felt turned out to be real.
- `wrong` -- The signal was noise. Nothing was actually wrong (or right).
- `unclear` -- Can't tell yet, or the situation is ambiguous.

**Scoring guidance for the user:**
- "Correct" means the body signal pointed at something real, even if the specific interpretation was off
- "Wrong" means the signal was noise -- fatigue, anxiety, or random firing
- "Unclear" is legitimate -- not everything resolves cleanly

### Step 2b: View Stats

```bash
bun ~/.claude/skills/Flinch/src/Tools/flinch.ts --stats
```

Stats display:
- Total flinches captured
- Scored vs. unscored count
- Overall accuracy (correct / scored)
- Accuracy broken down by state
- Pattern frequency with refine flags at 3+

**When presenting stats, highlight:**
- Which states produce the most reliable signals
- Which states produce noise
- Any patterns hitting the 3+ refine threshold

### Step 2c: Refine Patterns

```bash
bun ~/.claude/skills/Flinch/src/Tools/flinch.ts --refine
```

Shows patterns that have occurred 3+ times. These are candidates for integration into the voice reference anti-pattern list or other system rules.

**When presenting refinement candidates:**
- Show the pattern name and count
- Reference the voice reference file path
- Suggest running with the primary AI agent to integrate

## Intent-to-Flag Mapping

| User Says | Action |
|---|---|
| "That flinch was right" | `--score <id> correct` (ask for ID if not provided) |
| "Score that last one as wrong" | `--score <id> wrong` (get ID from most recent review) |
| "How accurate am I?" | `--stats` |
| "Show my flinch stats" | `--stats` |
| "Am I more accurate when rested?" | `--stats`, highlight accuracy-by-state |
| "Any patterns ready to act on?" | `--refine` |
| "What does my gut keep flagging?" | `--stats`, focus on pattern frequency |
| "Score all of these as correct" | Run `--score` for each ID sequentially |

## After Scoring

- If accuracy-by-state reveals a clear pattern (e.g., "90% when rested, 40% when tired"), surface it
- If a pattern hits 3+ occurrences, mention the `--refine` option
- Do not over-interpret. Present the data. The user draws conclusions.
- Return to previous context unless user wants to continue reviewing
