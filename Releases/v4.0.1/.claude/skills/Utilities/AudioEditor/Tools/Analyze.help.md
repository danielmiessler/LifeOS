# Analyze.ts

LLM-powered edit classification using Claude. Reads a word-level transcript and classifies segments for cutting.

## Usage

```bash
bun ~/.claude/skills/Utilities/AudioEditor/Tools/Analyze.ts <transcript.json> [--output <path>] [--aggressive]
```

## Options

| Flag | Description |
|------|-------------|
| `--output <path>` | Specify output JSON path (default: `<filename>.edits.json`) |
| `--aggressive` | Tighter thresholds: cuts single filler words, 1.5s pauses, more word repetition |

## Classification Types

| Type | Description |
|------|-------------|
| `CUT_EDIT_MARKER` | Speaker says "edit" as a verbal cue (highest priority) |
| `CUT_STUTTER` | Unintentional word repetition ("the the", "I I") |
| `CUT_FALSE_START` | Abandoned sentence restart |
| `CUT_SELF_CORRECTION` | Speaker corrects themselves |
| `CUT_FILLER` | Standalone filler words ("um", "uh", "ah") |
| `CUT_DEAD_AIR` | Long pauses (>5s standard, >3s aggressive) |

## Output Format

```json
[
  {
    "type": "CUT_FILLER",
    "start": 12.5,
    "end": 13.1,
    "reason": "Standalone 'um' hesitation",
    "context": "and um we decided to",
    "confidence": 0.9
  }
]
```

## Requirements

- `ANTHROPIC_API_KEY` environment variable
