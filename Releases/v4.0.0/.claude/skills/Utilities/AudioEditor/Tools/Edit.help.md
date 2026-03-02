# Edit.ts

Execute audio edits with ffmpeg. Reads an edit decision list and applies cuts with crossfades.

## Usage

```bash
bun ~/.claude/skills/Utilities/AudioEditor/Tools/Edit.ts <audio-file> <edits.json> [--output <path>]
```

## Options

| Flag | Description |
|------|-------------|
| `--output <path>` | Specify output file path (default: `<filename>_edited.<ext>`) |

## Features

- 40ms qsin crossfades at every edit point
- Room tone extraction and gap filling
- Preserves original codec and bitrate
- Supports MP3, WAV, FLAC, M4A/AAC

## Requirements

- `ffmpeg` and `ffprobe` installed
