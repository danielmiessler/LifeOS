# Polish.ts

Cleanvoice API cloud polish for final audio cleanup.

## Usage

```bash
bun ~/.claude/skills/Utilities/AudioEditor/Tools/Polish.ts <audio-file> [--output <path>]
```

## Options

| Flag | Description |
|------|-------------|
| `--output <path>` | Specify output file path (default: `<filename>_polished.<ext>`) |

## Features

- Mouth sound removal
- Remaining filler word detection
- Loudness normalization
- Polls API for completion (up to 30 min timeout)

## Requirements

- `CLEANVOICE_API_KEY` environment variable
- Get key at: cleanvoice.ai Dashboard Settings API Key
