# PAI Tools - CLI Utilities Reference

This file documents single-purpose CLI utilities that have been consolidated from individual skills. These are pure command-line tools that wrap APIs or external commands.

**Philosophy:** Simple utilities don't need separate skills. Document them here, execute them directly.

**Model:** Following the `Tools/fabric/` pattern - 242+ Fabric patterns documented as utilities rather than individual skills.

---

## Inference.ts - Unified AI Inference Tool

**Location:** `~/.claude/skills/PAI/Tools/Inference.ts`

Single inference tool with three run levels for different speed/capability trade-offs.

**Usage:**
```bash
# Fast (Haiku) - quick tasks, simple generation
bun ~/.claude/skills/PAI/Tools/Inference.ts --level fast "System prompt" "User prompt"

# Standard (Sonnet) - balanced reasoning, typical analysis
bun ~/.claude/skills/PAI/Tools/Inference.ts --level standard "System prompt" "User prompt"

# Smart (Opus) - deep reasoning, strategic decisions
bun ~/.claude/skills/PAI/Tools/Inference.ts --level smart "System prompt" "User prompt"

# With JSON output
bun ~/.claude/skills/PAI/Tools/Inference.ts --json --level fast "Return JSON" "Input"

# Custom timeout
bun ~/.claude/skills/PAI/Tools/Inference.ts --level standard --timeout 60000 "Prompt" "Input"
```

**Run Levels:**
| Level | Model | Default Timeout | Use Case |
|-------|-------|-----------------|----------|
| **fast** | Haiku | 15s | Quick tasks, simple generation, basic classification |
| **standard** | Sonnet | 30s | Balanced reasoning, typical analysis, decisions |
| **smart** | Opus | 90s | Deep reasoning, strategic decisions, complex analysis |

**Programmatic Usage:**
```typescript
import { inference } from '../skills/PAI/Tools/Inference';

const result = await inference({
  systemPrompt: 'Analyze this',
  userPrompt: 'Content to analyze',
  level: 'standard',  // 'fast' | 'standard' | 'smart'
  expectJson: true,   // optional: parse JSON response
  timeout: 30000,     // optional: custom timeout
});

if (result.success) {
  console.log(result.output);
  console.log(result.parsed);  // if expectJson: true
}
```

**When to Use:**
- "quick inference" → fast
- "analyze this" → standard
- "deep analysis" → smart
- Hooks use this for sentiment analysis, tab titles, work classification

**Technical Details:**
- Uses Claude CLI with subscription (not API key)
- Disables tools and hooks to prevent recursion
- Returns latency metrics for monitoring

---

## RemoveBg.ts - Remove Image Backgrounds

**Location:** `~/.claude/skills/PAI/Tools/RemoveBg.ts`

Remove backgrounds from images using the remove.bg API.

**Usage:**
```bash
# Remove background from single image (overwrites original)
bun ~/.claude/skills/PAI/Tools/RemoveBg.ts /path/to/image.png

# Remove background and save to different path
bun ~/.claude/skills/PAI/Tools/RemoveBg.ts /path/to/input.png /path/to/output.png

# Process multiple images
bun ~/.claude/skills/PAI/Tools/RemoveBg.ts image1.png image2.png image3.png
```

**Environment Variables:**
- `REMOVEBG_API_KEY` - Required for background removal (from `${PAI_DIR}/.env`)

**When to Use:**
- "remove background from this image"
- "remove the background"
- "make this image transparent"

---

## AddBg.ts - Add Background Color

**Location:** `~/.claude/skills/PAI/Tools/AddBg.ts`

Add solid background color to transparent images.

**Usage:**
```bash
# Add specific background color
bun ~/.claude/skills/PAI/Tools/AddBg.ts /path/to/transparent.png "#EAE9DF" /path/to/output.png

# Add UL brand background color
bun ~/.claude/skills/PAI/Tools/AddBg.ts /path/to/transparent.png --ul-brand /path/to/output.png
```

**When to Use:**
- "add background to this image"
- "create thumbnail with UL background"
- "add the brand color background"

**UL Brand Color:** `#EAE9DF` (warm paper/sepia tone)

---

## GetTranscript.ts - Extract YouTube Transcripts

**Location:** `~/.claude/skills/PAI/Tools/GetTranscript.ts`

Extract transcripts from YouTube videos using yt-dlp (via fabric).

**Usage:**
```bash
# Extract transcript to stdout
bun ~/.claude/skills/PAI/Tools/GetTranscript.ts "https://www.youtube.com/watch?v=VIDEO_ID"

# Save transcript to file
bun ~/.claude/skills/PAI/Tools/GetTranscript.ts "https://www.youtube.com/watch?v=VIDEO_ID" --save /path/to/transcript.txt
```

**Supported URL Formats:**
- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/watch?v=VIDEO_ID&t=123` (with timestamp)
- `https://youtube.com/shorts/VIDEO_ID` (YouTube Shorts)

**When to Use:**
- "get the transcript from this YouTube video"
- "extract transcript from this video"
- "fabric -y <url>" (user explicitly mentions fabric)

**Technical Details:**
- Uses `fabric -y` under the hood
- Prioritizes manual captions when available
- Falls back to auto-generated captions
- Multi-language support (detects automatically)

---

## Voice Server API - Generate Voice Narration

**Location:** Voice server at `http://localhost:8888/notify`

Send text to the voice server running on localhost for TTS using a configured voice clone.

**Usage:**
```bash
# Single narration segment
curl -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Your text here",
    "voice_id": "$ELEVENLABS_VOICE_ID",
    "title": "Voice Narrative"
  }'

# Pause between segments
sleep 2
```

**Voice Configuration:**
- **Voice ID:** Set via `ELEVENLABS_VOICE_ID` environment variable
- **Stability:** 0.55 (natural variation in storytelling)
- **Similarity Boost:** 0.85 (maintains authentic sound)
- **Server:** `http://localhost:8888/notify`
- **Max Segment:** 450 characters
- **Pause Between:** 2 seconds

**When to Use:**
- "read this to me"
- "voice narrative"
- "speak this"
- "narrate this"
- "perform this"

**Technical Details:**
- Voice server must be running (`~/.claude/skills/VoiceServer/`)
- Segments longer than 450 chars should be split
- Natural 2-second pauses between segments for storytelling flow
- Uses ElevenLabs API under the hood

---

## extract-transcript.py - Transcribe Audio/Video Files

**Location:** `~/.claude/skills/PAI/Tools/extract-transcript.py`

Local transcription using faster-whisper (4x faster than OpenAI Whisper, 50% less memory). Self-contained UV script for offline transcription.

**Usage:**
```bash
# Transcribe single file (base.en model - recommended)
cd ~/.claude/skills/PAI/Tools/
uv run extract-transcript.py /path/to/audio.m4a

# Use different model
uv run extract-transcript.py audio.m4a --model small.en

# Generate subtitles
uv run extract-transcript.py video.mp4 --format srt

# Batch transcribe folder
uv run extract-transcript.py /path/to/folder/ --batch --model base.en
```

**Supported Formats:**
- **Audio:** m4a, mp3, wav, flac, ogg, aac, wma
- **Video:** mp4, mov, avi, mkv, webm, flv

**Output Formats:**
- **txt** - Plain text transcript (default)
- **json** - Structured JSON with timestamps
- **srt** - SubRip subtitle format
- **vtt** - WebVTT subtitle format

**Model Options:**
| Model | Size | Speed | Accuracy | Use Case |
|-------|------|-------|----------|----------|
| tiny.en | 75MB | Fastest | Basic | Quick drafts, testing |
| **base.en** | 150MB | Fast | Good | **General use (recommended)** |
| small.en | 500MB | Medium | Very Good | Important recordings |
| medium | 1.5GB | Slow | Excellent | Production quality |
| large-v3 | 3GB | Slowest | Best | Critical accuracy needs |

**When to Use:**
- "transcribe this audio"
- "transcribe recording"
- "extract transcript from audio"
- "convert audio to text"
- "generate subtitles"

**Technical Details:**
- 100% local processing (no API calls, completely offline)
- First run auto-installs dependencies via UV (~30 seconds)
- Models auto-download from HuggingFace on first use
- Apple Silicon (M1/M2/M3) optimized
- Processing speed: ~3-5 minutes for 36MB audio file (base.en model)

**Prerequisites:**
- UV package manager: `curl -LsSf https://astral.sh/uv/install.sh | sh`
- No manual model download required (auto-downloads on first use)

---

## YouTubeApi.ts - YouTube Channel & Video Stats

**Location:** `~/.claude/skills/PAI/Tools/YouTubeApi.ts`

Wrapper around YouTube Data API v3 for channel statistics and video metrics.

**Usage:**
```bash
# Get channel statistics
bun ~/.claude/skills/PAI/Tools/YouTubeApi.ts --channel-stats

# Get video statistics
bun ~/.claude/skills/PAI/Tools/YouTubeApi.ts --video-stats VIDEO_ID

# Get latest uploads
bun ~/.claude/skills/PAI/Tools/YouTubeApi.ts --latest-videos
```

**Environment Variables:**
- `YOUTUBE_API_KEY` - Required for API access (from `${PAI_DIR}/.env`)
- `YOUTUBE_CHANNEL_ID` - Default channel ID

**When to Use:**
- "get YouTube stats"
- "YouTube channel statistics"
- "video performance metrics"
- "subscriber count"

**Data Retrieved:**
- Total subscribers
- Total views
- Total videos
- Recent upload performance
- View counts, likes, comments per video

**Technical Details:**
- Uses YouTube Data API v3 REST endpoints
- Quota: 10,000 units per day (free tier)
- Each API call costs ~3-5 quota units

---

## TruffleHog - Scan for Exposed Secrets

**Location:** System-installed CLI tool (`brew install trufflehog`)

Scan directories for 700+ types of credentials and secrets.

**Usage:**
```bash
# Scan directory
trufflehog filesystem /path/to/directory

# Scan git repository
trufflehog git file:///path/to/repo

# Scan with verified findings only
trufflehog filesystem /path/to/directory --only-verified
```

**Installation:**
```bash
brew install trufflehog
```

**When to Use:**
- "check for secrets"
- "scan for sensitive data"
- "find API keys"
- "detect credentials"
- "security audit before commit"

**What It Detects:**
- API keys (OpenAI, AWS, GitHub, Stripe, 700+ services)
- OAuth tokens
- Private keys (SSH, PGP, SSL/TLS)
- Database connection strings
- Passwords in code
- Cloud provider credentials

**Technical Details:**
- Scans files, git history, and commits
- Uses entropy detection + regex patterns
- Verifies findings when possible (calls APIs to check if keys are valid)
- No API key required (standalone CLI tool)

---

## Integration with Other Skills

### Art Skill
- Background removal: `RemoveBg.ts`
- Add backgrounds: `AddBg.ts`

### Blogging Skill
- Image optimization: `RemoveBg.ts`, `AddBg.ts`
- Social preview thumbnails

### Research Skill
- YouTube transcripts: `GetTranscript.ts`
- Audio/video transcription: `extract-transcript.py`
- Voice narration: Voice server API

### Metrics Skill
- YouTube analytics: `YouTubeApi.ts`

### Security Workflows
- Secret scanning: `trufflehog` (system tool)

---

## Adding New Tools

When adding a new utility tool to this system:

1. **Add tool file:** Place `.ts` or `.py` file directly in `~/.claude/skills/PAI/Tools/`
   - Use **Title Case** for filenames (e.g., `GetTranscript.ts`, not `get-transcript.ts`)
   - Keep the directory flat - NO subdirectories

2. **Document here:** Add section to this file with:
   - Tool location (e.g., `~/.claude/skills/PAI/Tools/ToolName.ts`)
   - Usage examples
   - When to use triggers
   - Environment variables (if any)

3. **Update PAI/SKILL.md:** Ensure SYSTEM/TOOLS.md is in the documentation index

4. **Test:** Verify tool works from new location

**Don't create a separate skill** if the entire functionality is just a CLI command with parameters.

---

## Deprecated Skills

The following skills have been consolidated into this Tools system:

- **Images** → `Tools/RemoveBg.ts`, `Tools/AddBg.ts` (2024-12-22)
- **VideoTranscript** → `Tools/GetTranscript.ts` (2024-12-22)
- **VoiceNarration** → Voice server API (2024-12-22)
- **ExtractTranscript** → `Tools/extract-transcript.py`, `Tools/ExtractTranscript.ts` (2024-12-22)
- **YouTube** → `Tools/YouTubeApi.ts` (2024-12-22)
- **Sensitive** → `trufflehog` system tool (2024-12-22)

Archived skill files have been removed.

---

**Last Updated:** 2026-01-12
