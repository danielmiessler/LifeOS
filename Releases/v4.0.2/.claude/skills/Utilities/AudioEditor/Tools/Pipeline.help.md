# Pipeline.ts

End-to-end audio editing pipeline that chains all tools: Transcribe -> Analyze -> Edit -> (optional) Polish.

## Usage

```bash
bun ~/.claude/skills/Utilities/AudioEditor/Tools/Pipeline.ts <audio-file> [options]
```

## Options

| Flag | Description |
|------|-------------|
| `--polish` | Apply Cleanvoice cloud polish after editing (requires `CLEANVOICE_API_KEY`) |
| `--aggressive` | Tighter detection thresholds for filler words and pauses |
| `--preview` | Show proposed edits without executing them |
| `--output <path>` | Specify output file path |

## Output

- Edited audio: `<filename>_edited.<ext>` (same directory as input)
- Transcript: `<filename>.transcript.json`
- Edit decisions: `<filename>.edits.json`

## Examples

```bash
# Standard clean
bun Pipeline.ts ~/Downloads/podcast.mp3

# Preview edits first
bun Pipeline.ts ~/Downloads/podcast.mp3 --preview

# Aggressive clean with polish
bun Pipeline.ts ~/Downloads/podcast.mp3 --aggressive --polish

# Custom output path
bun Pipeline.ts ~/Downloads/podcast.mp3 --output ~/Desktop/cleaned.mp3
```
