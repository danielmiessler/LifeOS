# Capture Workflow

**When to use:** User wants to log a somatic signal in the moment. They felt something -- chest tightening, gut pull, excitement spike, eye-roll, fog, hollow feeling -- and want to capture it before it fades.

**Core principle:** Speed. Get the signal logged in 5 seconds. Metadata is optional. The signal is not.

## Steps

### Step 1: Identify the Signal

Listen for the user's description of what they felt. This is the raw signal.

**What counts as a signal:**
- Body sensations (chest tightening, gut pull, shoulders tensing)
- Involuntary reactions (eye-roll, flinch, breath holding)
- State shifts (fog descending, energy draining, excitement spiking)
- Felt-sense impressions ("something's wrong," "this is right," "I don't trust this")

**What does NOT count:**
- Opinions ("I disagree with this approach")
- Analysis ("The architecture has a flaw")
- Emotions without body component ("I'm frustrated" -- ask where they feel it)

### Step 2: Capture with Tool

Run the flinch command with the signal description.

```bash
bun ~/.claude/skills/Flinch/src/Tools/flinch.ts "signal description"
```

### Step 3: Add Optional Metadata

If the user provides additional context, include flags:

| Context Provided | Flag to Add |
|---|---|
| What they were looking at / reading / hearing | `--trigger <source>` |
| How they're feeling overall (tired, flow, rested, stressed) | `--state <state>` |
| How strong the signal was | `--intensity <1-5>` |
| A named pattern they recognize (e.g., "hedging again") | `--pattern <name>` |

**Do not prompt for metadata unless the user volunteers it.** Speed matters more than completeness.

### Step 4: Confirm Capture

The tool outputs the capture ID and details. Relay this to the user briefly.

**Do not analyze the signal.** Do not interpret what it means. Do not offer advice about it. The capture IS the work.

## Intent-to-Flag Mapping

| User Says | Flags |
|---|---|
| "Something felt off when I read that doc" | `--trigger <doc path>` |
| "I'm exhausted and my gut is saying no" | `--state tired` |
| "Strong one -- like a 4 out of 5" | `--intensity 4` |
| "This is that hedging thing again" | `--pattern hedging` |
| "Just log it, no details" | No flags, signal only |
| "Chest tight, reading the proposal, I'm in flow" | `--trigger proposal --state flow` |

## After Capture

- Do not switch to review or scoring mode unless asked
- Do not analyze the pattern unless asked
- Do not connect it to other sessions unless asked
- Return to whatever the user was doing before the flinch

The flinch is a 5-second interruption, not a mode change.
