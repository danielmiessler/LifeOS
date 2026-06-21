---
name: AudioEditor
description: "AI-powered audio and video editing pipeline: Whisper word-level transcription (insanely-fast-whisper on MPS) → Claude segment classification (KEEP / CUT_FILLER / CUT_FALSE_START / CUT_STUTTER / CUT_DEAD_AIR / CUT_EDIT_MARKER) → ffmpeg execution with 40ms qsin crossfades and room-tone gap fill → optional Cleanvoice API cloud polish for mouth sounds and loudness normalization. Distinguishes rhetorical pauses from accidental ones. Breaths attenuated to 50% volume (not removed). Preview mode (--preview flag) shows proposed cuts without modifying audio. Aggressive mode (--aggressive flag) applies tighter filler detection thresholds. Polish step (--polish flag) uploads to Cleanvoice API for mouth sound removal and loudness normalization — confirm before cloud upload of sensitive content. Pipeline tools: Transcribe.ts, Analyze.ts, Edit.ts, Polish.ts, Pipeline.ts. Single workflow: Clean.md. Requires ANTHROPIC_API_KEY; CLEANVOICE_API_KEY optional for polish step. USE WHEN: clean audio, edit audio, remove filler words, clean podcast, remove ums, cut dead air, polish audio, trim recording, audio cleanup, cut stutters, edit interview recording, preview edits, aggressive clean. NOT FOR video composition or animation (use Remotion)."
effort: medium
---

# AudioEditor

AI-powered audio/video editing — transcription, intelligent cut detection, automated editing with crossfades, and optional cloud polish.

## Customization

**Before executing, check for user customizations at:**
`~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/AudioEditor/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

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
| **Transcribe** | `bun ${CLAUDE_SKILL_DIR}/Tools/Transcribe.ts <file>` | Word-level transcription via Whisper |
| **Analyze** | `bun ${CLAUDE_SKILL_DIR}/Tools/Analyze.ts <transcript.json>` | LLM-powered edit classification |
| **Edit** | `bun ${CLAUDE_SKILL_DIR}/Tools/Edit.ts <file> <edits.json>` | Execute cuts with crossfades + room tone |
| **Polish** | `bun ${CLAUDE_SKILL_DIR}/Tools/Polish.ts <file>` | Cleanvoice API cloud polish |
| **Pipeline** | `bun ${CLAUDE_SKILL_DIR}/Tools/Pipeline.ts <file> [--polish]` | Full end-to-end pipeline |

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

## Gotchas

- **Transcription accuracy varies with audio quality.** Background noise, multiple speakers, and accents reduce accuracy.
- **Cut detection is heuristic-based.** Always preview edits before committing — automated cuts can remove intentional pauses.
- **Cloud polish uploads audio to external service.** Confirm the user is okay with cloud processing for sensitive content.

## Execution Log

After completing any workflow, append a single JSONL entry:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"AudioEditor","workflow":"WORKFLOW_USED","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> ~/.claude/PAI/MEMORY/SKILLS/execution.jsonl
```

Replace `WORKFLOW_USED` with the workflow executed, `8_WORD_SUMMARY` with a brief input description, and `SECONDS` with approximate wall-clock time. Log `status: "error"` if the workflow failed.
