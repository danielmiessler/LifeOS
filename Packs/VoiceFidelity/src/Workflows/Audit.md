# Audit Workflow

Full Prufrock indexical grounding audit.

## When to Use

User wants a deep audit before publishing high-stakes content. Goes beyond voice-score to check whether the text carries identity signals — not just "does it match my style" but "does it sound like it came from a real person in a real place."

## Step 1: Identify Document

Get the file path or accept piped stdin.

## Step 2: Run Prufrock

```bash
bun ~/.claude/skills/VoiceFidelity/Tools/prufrock.ts <document> --verbose
```

### Intent-to-Flag Mapping

| User Says | Flag | Effect |
|-----------|------|--------|
| "audit this", "run prufrock" | (default) | Full automated + manual checklist |
| "verbose", "show flags" | `--verbose` | Show all flagged items per layer |
| "just the checklist" | `--checklist-only` | Manual review questions only |
| "json output" | `--json` | Raw JSON for programmatic use |

## Step 3: Interpret Automated Layers

Five automated checks scored out of 100:

| Layer | What It Checks | Severity |
|-------|---------------|----------|
| L1 Formulaic Integrity | Mangled idioms, near-miss expressions | HIGH |
| L2 Regional Grounding | Regional, professional, cultural markers | HIGH |
| L4 Register Fit | Tone consistency, over-formalization | MEDIUM-HIGH |
| L5 Embodied Detail | Generic sensory placeholders vs real experience | MEDIUM |
| L6 Temporal Integrity | Vague timelines, narrative compression | MEDIUM |

## Step 4: Walk Through Manual Checklist

Present the five manual review questions and ask the user to answer:

| Layer | Question |
|-------|---------|
| L3 Community-of-Practice | Would an insider say it THIS way? |
| L7 Provenance Safety | Where did each piece of info come from? |
| L8 Cross-Layer Consistency | Does this sound like one coherent person? |
| L9 Narrative vs Truth | Does this feel too clean? Were facts verified? |
| L10 Stance Authenticity | Does the emotional stance feel real? |

## Step 5: Red Team Quick Check

Present the 10-question pre-publish checklist. 3+ yes = rewrite.

## Step 6: Combined Verdict

For maximum confidence, run BOTH voice-score and prufrock:

```bash
bun ~/.claude/skills/VoiceFidelity/Tools/voice-score.ts <document>
bun ~/.claude/skills/VoiceFidelity/Tools/prufrock.ts <document>
```

Both must pass before high-stakes content ships.
