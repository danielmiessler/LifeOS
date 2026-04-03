# Transcribe.ts

Word-level transcription via Whisper. Uses insanely-fast-whisper (MPS accelerated) with fallback to standard whisper CLI.

## Usage

```bash
bun ~/.claude/skills/Utilities/AudioEditor/Tools/Transcribe.ts <audio-file> [--output <path>]
```

## Options

| Flag | Description |
|------|-------------|
| `--output <path>` | Specify output JSON path (default: `<filename>.transcript.json`) |

## Output Format

JSON with word-level timestamps (insanely-fast-whisper format):

```json
{
  "text": "Full transcript text...",
  "chunks": [
    { "text": "word", "timestamp": [0.0, 0.5] }
  ]
}
```

## Requirements

One of:
- `insanely-fast-whisper` (preferred, MPS accelerated)
- `whisper` (standard OpenAI whisper CLI)
