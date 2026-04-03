# Clean Workflow

Clean, edit, and polish audio files by removing filler words, stutters, false starts, dead air, and edit markers.

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the Clean workflow in the AudioEditor skill to clean audio"}' \
  > /dev/null 2>&1 &
```

Running the **Clean** workflow in the **AudioEditor** skill to clean audio...

## Step 1: Locate the Audio File

Identify the audio file from the user's request. Check common locations:
- Explicit path provided by user
- `~/Downloads/` for recently downloaded files
- Use `fd` to search if needed: `fd -e mp3 -e wav -e m4a -e flac '<keyword>' ~/Downloads`

If multiple matches exist, ask the user which file to use.

## Step 2: Determine Flags from Intent

Map the user's request to Pipeline.ts flags:

| User Says | Flag | Effect |
|-----------|------|--------|
| "preview", "show edits", "what would you cut" | `--preview` | Show proposed edits without executing |
| "aggressive", "tight", "heavy edit" | `--aggressive` | Tighter silence/filler thresholds |
| "polish", "cleanvoice", "final pass" | `--polish` | Cleanvoice API cloud polish (requires CLEANVOICE_API_KEY) |
| (default) | (none) | Standard cleaning with conservative thresholds |

## Step 3: Run the Pipeline

```bash
bun ~/.claude/skills/Utilities/AudioEditor/Tools/Pipeline.ts \
  "<audio-file-path>" \
  [FLAGS_FROM_INTENT_MAPPING] \
  --output "<output-path>"
```

**Output naming convention:** `<original-name>_edited.<ext>` in the same directory as the input file.

**Timeout:** Set a 10-minute timeout. Transcription of long files can take several minutes on MPS.

## Step 4: Report Results

After the pipeline completes, report:
- Number of edits applied
- Total time removed
- Original vs edited duration
- Output file path
- Artifacts generated (transcript, edits JSON, edited audio)

If `--preview` was used, display the edit list and ask if the user wants to proceed with execution.

## Individual Tool Usage

For debugging or partial workflows, individual tools can be run standalone:

```bash
# Transcription only
bun ~/.claude/skills/Utilities/AudioEditor/Tools/Transcribe.ts <file>

# Analysis only (requires transcript)
bun ~/.claude/skills/Utilities/AudioEditor/Tools/Analyze.ts <transcript.json>

# Edit only (requires audio + edits)
bun ~/.claude/skills/Utilities/AudioEditor/Tools/Edit.ts <file> <edits.json>

# Polish only (requires CLEANVOICE_API_KEY)
bun ~/.claude/skills/Utilities/AudioEditor/Tools/Polish.ts <file>
```
