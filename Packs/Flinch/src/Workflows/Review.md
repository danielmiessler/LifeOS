# Review Workflow

**When to use:** User wants to see their unscored flinches. End-of-day review, weekly check-in, or curiosity about what signals have been firing.

**Core principle:** Surface the signals. Let the user decide what to do with them.

## Steps

### Step 1: Run Review Command

```bash
bun ~/.claude/skills/Flinch/src/Tools/flinch.ts --review
```

This displays all unscored entries with:
- Flinch ID
- Age (hours since capture)
- State at capture (if provided)
- Signal description
- Trigger (if provided)

### Step 2: Present Results

Show the user their unscored flinches. For each entry, the key information is:
- What they felt (signal)
- When (age in hours)
- What state they were in
- What triggered it

### Step 3: Offer Scoring

Ask if the user wants to score any of the entries. Do not pressure. Some entries may need more time before they can be evaluated.

**Scoring prompts:**
- "Do any of these feel ready to score? You can mark them correct, wrong, or unclear."
- "Some of these are fresh -- you may want to wait and see how they play out."

### Step 4: Score if Requested

If the user wants to score entries, route to the Score workflow (`Workflows/Score.md`).

## Intent-to-Flag Mapping

| User Says | Action |
|---|---|
| "Show me my flinches" | Run `--review` |
| "What have I flagged recently?" | Run `--review` |
| "Any unscored signals?" | Run `--review` |
| "Let's do a flinch review" | Run `--review`, then offer scoring |
| "How many unscored do I have?" | Run `--review`, report count |
| "Show me everything" | Run `--review` for unscored, then `--stats` for scored |

## After Review

- If user wants to score: transition to Score workflow
- If user wants stats: run `flinch --stats`
- If user just wanted to see them: return to previous context
- Do not interpret or analyze the signals unless asked
