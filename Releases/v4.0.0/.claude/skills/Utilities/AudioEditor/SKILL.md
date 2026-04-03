---
name: AudioEditor
description: AI-powered audio/video editing — transcription, intelligent cut detection, automated editing with crossfades, and optional cloud polish. USE WHEN clean audio, edit audio, remove filler words, clean podcast, remove ums, fix audio, cut dead air, polish audio, clean recording, transcribe and edit.
---

# AudioEditor

AI-powered audio/video editing — transcription, intelligent cut detection, automated editing with crossfades, and optional cloud polish.

## Customization

**Before executing, check for user customizations at:**
`~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/AudioEditor/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

## Voice Notification

**You MUST send this notification BEFORE doing anything else when this skill is invoked.**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:8888/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the WORKFLOWNAME workflow in the AudioEditor skill to ACTION"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running the **WorkflowName** workflow in the **AudioEditor** skill to ACTION...
   ```

**This is not optional. Execute this curl command immediately upon skill invocation.**

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Clean** | "clean audio", "edit audio", "remove filler words", "clean podcast", "remove ums", "cut dead air", "polish audio" | `Workflows/Clean.md` |

## Pipeline Architecture

```
Audio Input
    |
[Transcribe] Whisper word-level timestamps (insanely-fast-whisper on MPS)
    |
[Analyze] Claude classifies each segment:
    |   KEEP / CUT_FILLER / CUT_FALSE_START / CUT_EDIT_MARKER / CUT_STUTTER / CUT_DEAD_AIR
    |   Distinguishes rhetorical emphasis from accidental repetition
    |
[Edit] ffmpeg executes cuts:
    |   - 40ms qsin crossfades at every edit point
    |   - Room tone extraction and gap filling
    |   - Breath attenuation (50% volume, not removal)
    |
[Polish] (optional) Cleanvoice API final pass:
        - Mouth sound removal
        - Remaining filler detection
        - Loudness normalization

Output: cleaned MP3/WAV
```

## Tools

| Tool | Command | Purpose |
|------|---------|---------|
| **Transcribe** | `bun ~/.claude/skills/Utilities/AudioEditor/Tools/Transcribe.ts <file>` | Word-level transcription via Whisper |
| **Analyze** | `bun ~/.claude/skills/Utilities/AudioEditor/Tools/Analyze.ts <transcript.json>` | LLM-powered edit classification |
| **Edit** | `bun ~/.claude/skills/Utilities/AudioEditor/Tools/Edit.ts <file> <edits.json>` | Execute cuts with crossfades + room tone |
| **Polish** | `bun ~/.claude/skills/Utilities/AudioEditor/Tools/Polish.ts <file>` | Cleanvoice API cloud polish |
| **Pipeline** | `bun ~/.claude/skills/Utilities/AudioEditor/Tools/Pipeline.ts <file> [--polish]` | Full end-to-end pipeline |

## API Keys Required

| Service | Env Var | Where to Get |
|---------|---------|-------------|
| Anthropic (for analyze step) | `ANTHROPIC_API_KEY` | Already set via Claude Code |
| Cleanvoice (for polish step, optional) | `CLEANVOICE_API_KEY` | cleanvoice.ai Dashboard Settings API Key |

## Examples

**Example 1: Clean a podcast recording**
```
User: "clean up the audio on this podcast file"
-> Invokes Clean workflow
-> Runs full pipeline: transcribe -> analyze -> edit
-> Outputs cleaned MP3 with filler words, stutters, and dead air removed
```

**Example 2: Preview edits before applying**
```
User: "show me what edits you'd make to this recording"
-> Invokes Clean workflow with --preview flag
-> Transcribes and analyzes, shows proposed edits without modifying audio
-> User reviews edit list, then runs again to apply
```

**Example 3: Aggressive clean with cloud polish**
```
User: "aggressively clean this audio and polish it"
-> Invokes Clean workflow with --aggressive --polish flags
-> Tighter thresholds for filler detection
-> Cleanvoice API pass for mouth sounds and normalization
```
