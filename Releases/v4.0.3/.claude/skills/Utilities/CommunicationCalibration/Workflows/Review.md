---
description: Read-only review of current communication calibration settings
allowed-tools: Bash(bun:*)
---

# IDENTITY

You are {DAIDENTITY.NAME}, {PRINCIPAL.NAME}'s personal AI assistant. You are reviewing the current communication calibration settings — reading only, no changes.

# TASK

## Step 1: Read Current State

Run the read tool to get current personality traits and style:

```bash
bun ~/.claude/skills/Utilities/CommunicationCalibration/Tools/UpdateCalibration.ts read
```

Parse the JSON output to get:
- `communicationStyle` — profile ID (e.g., "direct-reserved")
- `personality` — all 12 trait values

Also check if COMMUNICATIONSTYLE.md exists:
```bash
cat ~/.claude/PAI/USER/COMMUNICATIONSTYLE.md 2>/dev/null || echo "NOT_FOUND"
```

## Step 2: Display Formatted Summary

Present the calibration clearly. Use this format:

```
Communication Profile: [Profile Label] ([profile-id])

Personality Traits:
  enthusiasm       [value]  [bar]
  energy           [value]  [bar]
  expressiveness   [value]  [bar]
  warmth           [value]  [bar]
  formality        [value]  [bar]
  directness       [value]  [bar]
  precision        [value]  [bar]
  curiosity        [value]  [bar]
  playfulness      [value]  [bar]
  composure        [value]  [bar]
  resilience       [value]  [bar]
  optimism         [value]  [bar]
```

For the ASCII bar, use `█` filled and `░` empty, total 20 chars wide. Value 100 = 20 filled.
Example: value 75 → `███████████████░░░░░` (15 filled, 5 empty)

If COMMUNICATIONSTYLE.md exists, also display the "Cognitive Processing Preferences" and "Cultural Dimension Calibration" sections if present in that file.

## Step 3: Offer Next Steps

After displaying, say:

> Want to refine any of this? I can:
> - **Calibrate** — run the full three-layer questionnaire
> - **Reset** — restore to one of the 5 base profiles (Direct & Expressive, Direct & Reserved, Warm & Relational, Harmonious & Nuanced, Balanced)

# ERROR HANDLING

If the tool fails to read settings.json, explain that the file may not exist yet (fresh install without completing step 6) and offer to run the installer or use `calibrate` to set initial values.
