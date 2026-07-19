---
version: 1.8.0
---

# LifeOS Tools - CLI Utilities Reference

> CLI-first is how the Life OS stays deterministic (`LIFEOS/DOCUMENTATION/LifeOs/LifeOsThesis.md`): the hill-climb's moves are code you can script, test, and trust — prompts orchestrate, code executes.

This file documents single-purpose CLI utilities that have been consolidated from individual skills. These are pure command-line tools that wrap APIs or external commands.

**Philosophy:** Simple utilities don't need separate skills. Document them here, execute them directly.

**Model:** Following the `Tools/fabric/` pattern - 242+ Fabric patterns documented as utilities rather than individual skills.

---

## Inference.ts - Unified AI Inference Tool

**Location:** `{{LIFEOS_DIR}}/TOOLS/Inference.ts`

**Use this — never import `@anthropic-ai/sdk` directly.** Inference.ts handles auth, retries, timeouts, and LifeOS-specific defaults. Hooks, skills, agents, and ad-hoc Bash all route through it.

Single inference tool with four run levels for different speed/capability trade-offs — the same four-level abstraction as `EFFORT_MODEL` in `models.ts` (max→fable, high→opus, medium→sonnet, low→haiku; one-line mapping edit on a lineup change).

**Executed-model verification (v6.29.0).** `--level max` genuinely runs Fable (spawns `claude --model claude-fable-5`), unlike an `Agent(model:fable)` dispatch which downgrades to Opus — so this is the real Fable carrier for E4/E5 reasoning. Every run reads the executed model back from the JSON envelope's `modelUsage` (`verifyExecutedModel` — filters Claude Code's per-turn background haiku pass, then takes the highest-output model as the answer's author and checks its family; presence alone can't tell a tiny classifier pass from real authorship). The result carries `executedModel` + `modelDowngraded`; the CLI prints a `[model] requested=… → executed=…` line to stderr (stdout stays the clean answer); any downgrade is logged to `MEMORY/OBSERVABILITY/model-verification.jsonl`. The tool reports what RAN, never what it requested.

**Usage:**
```bash
# Low (Haiku) - quick tasks, simple generation
bun "${LIFEOS_DIR}/TOOLS/Inference.ts" --level low "System prompt" "User prompt"

# Medium (Sonnet) - balanced reasoning, typical analysis
bun "${LIFEOS_DIR}/TOOLS/Inference.ts" --level medium "System prompt" "User prompt"

# High (Opus) - deep reasoning, strategic decisions
bun "${LIFEOS_DIR}/TOOLS/Inference.ts" --level high "System prompt" "User prompt"

# Max (Fable) - hardest reasoning, top tier
bun "${LIFEOS_DIR}/TOOLS/Inference.ts" --level max "System prompt" "User prompt"

# With JSON output
bun "${LIFEOS_DIR}/TOOLS/Inference.ts" --json --level low "Return JSON" "Input"

# Custom timeout
bun "${LIFEOS_DIR}/TOOLS/Inference.ts" --level medium --timeout 60000 "Prompt" "Input"
```

**Run Levels:**
| Level | Model | Default Timeout | Use Case |
|-------|-------|-----------------|----------|
| **low** | Haiku | 15s | Quick tasks, simple generation, basic classification |
| **medium** | Sonnet | 30s | Balanced reasoning, typical analysis, decisions |
| **high** | Opus | 90s | Deep reasoning, strategic decisions, complex analysis |
| **max** | Fable | 120s | Keystone decisions, hardest reasoning (the TheRouter classifier that formerly used this level was retired 2026-07-11) |

**Programmatic Usage:**
```typescript
// From hooks (at {{LIFEOS_ROOT}}/hooks/):
import { inference } from '../../.claude/LIFEOS/TOOLS/Inference';

const result = await inference({
  systemPrompt: 'Analyze this',
  userPrompt: 'Content to analyze',
  level: 'medium',  // 'low' | 'medium' | 'high' | 'max'
  expectJson: true,   // optional: parse JSON response
  timeout: 30000,     // optional: custom timeout
});

if (result.success) {
  console.log(result.output);
  console.log(result.parsed);  // if expectJson: true
}
```

**When to Use:**
- "quick inference" → low
- "analyze this" → medium
- "deep analysis" → high
- keystone decisions (classifier) → max
- Hooks use this for sentiment analysis, tab titles, work classification

**Technical Details:**
- Uses Claude CLI with subscription (not API key)
- Disables tools and hooks to prevent recursion
- Returns latency metrics for monitoring

---

## RemoveBg.ts - Remove Image Backgrounds

**Location:** `{{LIFEOS_DIR}}/TOOLS/RemoveBg.ts`

Remove backgrounds from images using local `rembg` (no external API).

**Usage:**
```bash
# Remove background from single image (overwrites; renames .jpg→.png)
bun "${LIFEOS_DIR}/TOOLS/RemoveBg.ts" /path/to/image.png

# Remove background and save to different path
bun "${LIFEOS_DIR}/TOOLS/RemoveBg.ts" /path/to/input.png /path/to/output.png

# Process multiple images
bun "${LIFEOS_DIR}/TOOLS/RemoveBg.ts" image1.png image2.png image3.png
```

**Requirements:**
- `rembg` installed at `~/.local/bin/rembg` (override with `REMBG_BIN` env var)
- Install: `pipx install rembg` (or `uv tool install rembg`)

**When to Use:**
- "remove background from this image"
- "remove the background"
- "make this image transparent"

---

## AddBg.ts - Add Background Color

**Location:** `{{LIFEOS_DIR}}/TOOLS/AddBg.ts`

Add solid background color to transparent images.

**Usage:**
```bash
# Add specific background color
bun "${LIFEOS_DIR}/TOOLS/AddBg.ts" /path/to/transparent.png "#EAE9DF" /path/to/output.png

# Add your brand background color (uses the color from LifeOS config)
bun "${LIFEOS_DIR}/TOOLS/AddBg.ts" /path/to/transparent.png --brand /path/to/output.png
```

**When to Use:**
- "add background to this image"
- "create thumbnail with UL background"
- "add the brand color background"

**Example brand color:** `#EAE9DF` (warm paper/sepia tone — configure your own via LifeOS config)

---

## GetTranscript.ts - Extract YouTube Transcripts

**Location:** `{{LIFEOS_DIR}}/TOOLS/GetTranscript.ts`

Extract transcripts from YouTube videos using yt-dlp (via fabric).

**Usage:**
```bash
# Extract transcript to stdout
bun "${LIFEOS_DIR}/TOOLS/GetTranscript.ts" "https://www.youtube.com/watch?v=VIDEO_ID"

# Save transcript to file
bun "${LIFEOS_DIR}/TOOLS/GetTranscript.ts" "https://www.youtube.com/watch?v=VIDEO_ID" --save /path/to/transcript.txt
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

## MemoryRetriever.ts - Compressed Knowledge Retrieval

**Location:** `{{LIFEOS_DIR}}/TOOLS/MemoryRetriever.ts`

BM25-lite search across the Knowledge Archive with optional LLM compression. Finds relevant notes by keyword matching, tag co-occurrence, and content frequency, then compresses results into a dense context-efficient summary.

**Usage:**
```bash
# Search and return compressed results (default: top 3)
bun "${LIFEOS_DIR}/TOOLS/MemoryRetriever.ts" "memory architecture"

# Return top 5 results
bun "${LIFEOS_DIR}/TOOLS/MemoryRetriever.ts" "security policy" --top 5

# Skip LLM compression, return raw excerpts
bun "${LIFEOS_DIR}/TOOLS/MemoryRetriever.ts" "karpathy" --raw

# Custom token budget for output
bun "${LIFEOS_DIR}/TOOLS/MemoryRetriever.ts" "threat model" --budget 800
```

**Scoring:**
| Signal | Weight | Source |
|--------|--------|--------|
| Title match | +10 | Frontmatter title |
| Tag match | +5 | Frontmatter tags |
| Related slug match | +3 | Frontmatter related field |
| Content frequency | BM25 | Full body text |

**When to Use:**
- "what do we know about X" → search knowledge
- "find related notes about Y" → search + follow links
- Context loading during Algorithm THINK phase knowledge checks
- Retrieving compressed context for constrained token budgets

---

## KnowledgeGraph.ts - Associative Knowledge Navigation

**Location:** `{{LIFEOS_DIR}}/TOOLS/KnowledgeGraph.ts`

Builds an in-memory graph from Knowledge Archive frontmatter (tags, wikilinks, related fields) and enables BFS traversal for associative recall. No persistent storage — computed from existing markdown files at query time.

**Usage:**
```bash
# BFS traversal from a note (default: 2 hops)
bun "${LIFEOS_DIR}/TOOLS/KnowledgeGraph.ts" traverse karpathy

# Traverse with custom depth
bun "${LIFEOS_DIR}/TOOLS/KnowledgeGraph.ts" traverse mempalace --hops 3

# Show directly connected notes
bun "${LIFEOS_DIR}/TOOLS/KnowledgeGraph.ts" related mempalace

# Graph summary: nodes, edges, clusters
bun "${LIFEOS_DIR}/TOOLS/KnowledgeGraph.ts" stats

# Top 10 most-connected notes
bun "${LIFEOS_DIR}/TOOLS/KnowledgeGraph.ts" hubs

# Find all notes with a specific tag
bun "${LIFEOS_DIR}/TOOLS/KnowledgeGraph.ts" find architecture
```

**Edge Types:**
| Type | Weight | Source |
|------|--------|--------|
| Tag co-occurrence | 1 | Shared tags in frontmatter |
| Wikilink | 3 | `[[slug]]` in body text |
| Related field | 5 | Typed `related:` in frontmatter |

**When to Use:**
- "what's connected to this topic" → traverse
- "show me the knowledge graph" → stats + hubs
- "find related notes" → related <slug>
- Exploring how knowledge connects across domains

---

## Voice Server API - Generate Voice Narration

**Location:** Voice server at `http://localhost:31337/notify`

Send text to the voice server running on localhost for TTS using a configured voice clone.

**Usage:**
```bash
# Single narration segment
curl -X POST http://localhost:31337/notify \
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
- **Server:** `http://localhost:31337/notify`
- **Max Segment:** 450 characters
- **Pause Between:** 2 seconds

**When to Use:**
- "read this to me"
- "voice narrative"
- "speak this"
- "narrate this"
- "perform this"

**Technical Details:**
- Pulse must be running (voice handler lives at `{{LIFEOS_DIR}}/PULSE/VoiceServer/voice.ts`, port 31337)
- Segments longer than 450 chars should be split
- Natural 2-second pauses between segments for storytelling flow
- Uses ElevenLabs API under the hood

---

## extract-transcript.py - Transcribe Audio/Video Files

**Location:** `{{LIFEOS_DIR}}/TOOLS/extract-transcript.py`

Local transcription using faster-whisper (4x faster than OpenAI Whisper, 50% less memory). Self-contained UV script for offline transcription.

**Usage:**
```bash
# Transcribe single file (base.en model - recommended)
cd "${LIFEOS_DIR}/TOOLS/"
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

**Location:** `{{LIFEOS_DIR}}/TOOLS/YouTubeApi.ts`

Wrapper around YouTube Data API v3 for channel statistics and video metrics.

**Usage:**
```bash
# Get channel statistics
bun "${LIFEOS_DIR}/TOOLS/YouTubeApi.ts" --channel-stats

# Get video statistics
bun "${LIFEOS_DIR}/TOOLS/YouTubeApi.ts" --video-stats VIDEO_ID

# Get latest uploads
bun "${LIFEOS_DIR}/TOOLS/YouTubeApi.ts" --latest-videos
```

**Environment Variables:**
- `YOUTUBE_API_KEY` - Required for API access (from `{{LIFEOS_ROOT}}/.env`)
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

## RTK — Context Reduction Proxy

**Location:** `~/.local/bin/rtk` (installed via `curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh`)

**Repository:** [github.com/rtk-ai/rtk](https://github.com/rtk-ai/rtk) (MIT license)

Transparent CLI proxy that compresses Bash command output by 60-90%, reducing token consumption in Claude Code sessions. Integrated via PreToolUse hook — commands are automatically rewritten to `rtk` equivalents before execution.

**How It Works:**
- PreToolUse hook (`ContextReduction.hook.sh`) intercepts Bash commands
- Rewrites `git status` → `rtk git status`, `bun test` → `rtk bun test`, etc.
- RTK binary executes the command, applies command-specific compression
- Returns compact output via `updatedInput` — AI receives fewer tokens

**Compression Coverage (50+ commands):**

| Domain | Commands | Typical Savings |
|--------|----------|----------------|
| Git | status, log, diff, commit, push, pull | 85-99% |
| Build | cargo, tsc, Next.js builds | 75-87% |
| Test | pytest, vitest, jest, cargo test | 94-99% |
| Lint | eslint, ruff, pylint, mypy, prettier | 80-90% |
| Package | npm, pnpm, pip, bun | 70-95% |
| File ops | ls, tree, find, grep, diff | 50-80% |
| Infrastructure | docker, kubectl, aws, psql | varies |
| GitHub CLI | gh pr, gh issue, gh run | 30%+ |

**Key Commands:**
```bash
rtk gain              # Token savings dashboard
rtk gain --history    # Historical savings data
rtk discover          # Find unoptimized commands
rtk verify            # Check installation integrity
```

**When to Use:**
- Automatic — the PreToolUse hook handles everything transparently
- Direct invocation for analytics: `rtk gain`, `rtk discover`

**Technical Details:**
- Rust binary, zero runtime dependencies
- 3-tier parsing: JSON → regex → passthrough (graceful degradation)
- SQLite tracking database at `~/.config/rtk/history.db`
- Config at `~/.config/rtk/config.toml`
- Hook requires `jq` (for JSON stdin parsing)

---

## Monitor Tool — Event-Driven Background Watching

The Monitor tool starts a background script whose stdout lines become chat notifications. Instead of polling in a loop (burning tokens), the script runs independently and wakes you when something happens. Zero token cost between events.

**Key rules:**
- Each stdout line = one notification. Stderr goes to output file only.
- Always use `grep --line-buffered` in pipes (otherwise pipe buffering delays events).
- Poll intervals: 30s+ for remote APIs, 0.5-1s for local checks.
- Handle transient failures: `curl ... || true` in poll loops.
- Set `persistent: true` for session-length watches. Cancel with `TaskStop`.

### Recipe: Agent Watchdog (auto-triggered by hook)

The Pulse agent-guard hook automatically injects a watchdog reminder when background agents are spawned. The watchdog monitors tool-activity.jsonl for silence while agents are active:

```text
Monitor({
  description: "Agent watchdog",
  persistent: true,
  timeout_ms: 3600000,
  command: "bun {{LIFEOS_DIR}}/TOOLS/AgentWatchdog.ts"
})
```

Alerts when no tool calls detected for 90 seconds with active agents. Rate-limited to one alert per 60 seconds. Runs for the session lifetime — covers all background agents.

### Recipe: Deploy Monitoring

Watch a Cloudflare Pages or Workers deploy for completion or errors:

```bash
# Monitor wrangler deploy output (run deploy with Bash(run_in_background), then tail its output)
Monitor({
  description: "Cloudflare deploy status",
  persistent: false,
  timeout_ms: 300000,
  command: "tail -f /tmp/deploy.log | grep --line-buffered -E '(Published|Error|Failed|SUCCESS)'"
})
```

### Recipe: Pulse Log Tailing

Watch Pulse daemon logs for errors during a debugging session:

```text
Monitor({
  description: "Pulse error watcher",
  persistent: true,
  timeout_ms: 300000,
  command: "tail -f {{LIFEOS_ROOT}}/Pulse/logs/pulse-stdout.log | grep --line-buffered -i -E '(error|fatal|crash|unhandled)'"
})
```

### Recipe: Build/Test Watching

Monitor a long test suite and get notified on failures:

```text
Monitor({
  description: "Test failure watcher",
  persistent: false,
  timeout_ms: 600000,
  command: "tail -f /tmp/test-output.log | grep --line-buffered -E '(FAIL|ERROR|✗|AssertionError)'"
})
```

### Recipe: PR/CI Status Monitoring

Poll GitHub for CI status changes on a PR:

```text
Monitor({
  description: "CI status for PR #42",
  persistent: true,
  timeout_ms: 3600000,
  command: "last_status=''; while true; do status=$(gh pr checks 42 --json state --jq '.[].state' 2>/dev/null | sort -u | tr '\\n' ','); if [ \"$status\" != \"$last_status\" ]; then echo \"CI: $status\"; last_status=\"$status\"; fi; sleep 30; done"
})
```

### Recipe: Security Scan Watching

Tail security scan results for critical findings:

```text
Monitor({
  description: "Security scan critical findings",
  persistent: false,
  timeout_ms: 600000,
  command: "tail -f /tmp/security-scan.log | grep --line-buffered -i 'CRITICAL'"
})
```

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

1. **Add tool file:** Place `.ts` or `.py` file directly in `{{LIFEOS_DIR}}/TOOLS/`
   - Use **Title Case** for filenames (e.g., `GetTranscript.ts`, not `get-transcript.ts`)
   - Keep the directory flat - NO subdirectories

2. **Document here:** Add section to this file with:
   - Tool location (e.g., `~/.claude/`)
   - Usage examples
   - When to use triggers
   - Environment variables (if any)

3. **Update `CLAUDE.md` routing table:** Ensure TOOLS.md is referenced in the documentation index

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

## algorithm.ts - The Algorithm CLI

**Location:** `{{LIFEOS_DIR}}/TOOLS/algorithm.ts`

Run the LifeOS Algorithm in Loop, Interactive, Ideate, or Optimize mode against a ISA.

**Usage:**
```bash
# Run modes
algorithm -m loop -p <ISA> [-n 128]           # Autonomous loop execution
algorithm -m interactive -p <ISA>              # Interactive claude session
algorithm -m optimize -p <ISA>                 # Autonomous metric optimization
algorithm -m ideate -p <ISA>                   # Evolutionary ideation session

# Presets (ideate)
algorithm -m ideate -p <ISA> --preset dream        # Pure free-form dreaming
algorithm -m ideate -p <ISA> --preset explore       # Broad exploration
algorithm -m ideate -p <ISA> --preset balanced      # Default balanced
algorithm -m ideate -p <ISA> --preset directed      # Problem-focused
algorithm -m ideate -p <ISA> --preset surgical      # Maximum analytical focus
algorithm -m ideate -p <ISA> --preset wild-but-picky  # Dream wildly, select ruthlessly

# Presets (optimize)
algorithm -m optimize -p <ISA> --preset cautious    # Small steps, no regression
algorithm -m optimize -p <ISA> --preset aggressive   # Large steps, accepts regression

# Focus dial (ideate only, 0.0=dream, 1.0=laser)
algorithm -m ideate -p <ISA> --focus 0.2

# Individual parameter overrides (repeatable)
algorithm -m ideate -p <ISA> --focus 0.2 --param selectionPressure=0.9
algorithm -m optimize -p <ISA> --param stepSize=0.8 --param regressionTolerance=0.3

# Management
algorithm new -t <title> [-e <effort>]         # Create a new ISA
algorithm status [-p <ISA>]                    # Show ISA status
algorithm pause -p <ISA>                       # Pause a running loop
algorithm resume -p <ISA>                      # Resume a paused loop
algorithm stop -p <ISA>                        # Stop a loop
```

**Parameter schema:** `{{LIFEOS_DIR}}/ALGORITHM/parameter-schema.md`

---

## AlgorithmPhaseReport.ts - Algorithm State Reporter

**Location:** `{{LIFEOS_DIR}}/TOOLS/AlgorithmPhaseReport.ts`

Writes algorithm execution state to `algorithm-phase.json` for dashboard consumption.

**Usage:**
```bash
# Phase transitions
bun AlgorithmPhaseReport.ts phase --phase OBSERVE --task "Auth rebuild" --sla Standard

# Criteria tracking
bun AlgorithmPhaseReport.ts criterion --id 1 --desc "JWT rejects expired tokens" --status pending
bun AlgorithmPhaseReport.ts criterion --id 1 --status completed --evidence "Tests pass"

# Agent tracking
bun AlgorithmPhaseReport.ts agent --name engineer-1 --type Engineer --status active

# Capabilities
bun AlgorithmPhaseReport.ts capabilities --list "Task Tool,Engineer Agents"

# Parameter configuration (v3.16.0+)
bun AlgorithmPhaseReport.ts config --preset dream --focus 0.25 --mode ideate

# Meta-learner adjustment tracking (v3.16.0+)
bun AlgorithmPhaseReport.ts meta-adjust --param selectionPressure --from 0.3 --to 0.45 --rationale "text"
```

---

## KnowledgeHarvester.ts - Knowledge Archive Harvester

**Location:** `{{LIFEOS_DIR}}/TOOLS/KnowledgeHarvester.ts`

Validate and maintain the KNOWLEDGE/ archive (4 entity types: People, Companies, Ideas, Research). Validates against schemas in `_schema.md`, handles MOC regeneration and maintenance. Note: Algorithm LEARN phase writes knowledge directly; harvester reflections are disabled. The harvester's primary role is now validation, maintenance, and index regeneration.

**Usage:**
```bash
# Harvest from all sources
bun "${LIFEOS_DIR}/TOOLS/KnowledgeHarvester.ts" harvest

# Harvest from specific source
bun "${LIFEOS_DIR}/TOOLS/KnowledgeHarvester.ts" harvest --source work

# Preview without writing
bun "${LIFEOS_DIR}/TOOLS/KnowledgeHarvester.ts" harvest --dry-run

# Archive health dashboard
bun "${LIFEOS_DIR}/TOOLS/KnowledgeHarvester.ts" status

# Regenerate all MOC dashboards
bun "${LIFEOS_DIR}/TOOLS/KnowledgeHarvester.ts" index
```

**Sources:**
| Source | Flag | What It Scans |
|--------|------|---------------|
| memory | `--source memory` | Auto-memory files from Claude sessions |
| work | `--source work` | WORK/ directory ISAs and session artifacts |
| reflections | `--source reflections` | Learning/reflection documents |
| research | `--source research` | RESEARCH/ directory content |

**When to Use:**
- "harvest knowledge"
- "update knowledge archive"
- "knowledge status"
- "regenerate knowledge index"

---

## models.ts + UpdateModels.ts — Model ID Registry & Release Auto-Track

**Location:** `{{LIFEOS_DIR}}/TOOLS/models.ts` (registry) + `{{LIFEOS_DIR}}/TOOLS/UpdateModels.ts` (updater).

`models.ts` is the **single source of truth** for current Claude model IDs (`CURRENT.opus/sonnet/haiku`) plus cross-vendor pins (inventory only). The rule of the road:

- **Prefer aliases.** Consumers that accept a string and don't need a pinned ID use the tier alias (`"opus"`/`"sonnet"`/`"haiku"`) — the `claude` CLI resolves them to the latest, so they never drift. Pulse manifests and `Inference.ts` work this way.
- **Import the registry** only when you genuinely need a pinned ID (e.g. `ContextAudit.ts`'s drift check imports `currentModel("opus")`).
- **Never** hardcode a dated ID in live code — that's the bug class this replaced (`ContextAudit` checked for `claude-opus-4-7` long after 4.8 shipped).

**On a new model release (propose-not-auto):**
1. The `_NEWS` Anthropic monitor (`CheckAnthropicChanges.ts`) scans fetched source bodies for a new Claude ID and, on a hit, records it to `LIFEOS/MEMORY/OBSERVABILITY/model-releases.jsonl` and best-effort fires `/notify` (voice/Telegram). It never edits the registry. (A model bump is a command, not a markdown-section text edit, so it deliberately does NOT use the `pending-proposals.jsonl` Telegram queue — that queue's apply path only appends text under a header.)
2. A human reviews, then bumps the one edit point: `bun "${LIFEOS_DIR}/TOOLS/UpdateModels.ts" --apply <tier> <new-id>`.
3. Confirm nothing else drifted: `bun "${LIFEOS_DIR}/TOOLS/UpdateModels.ts" --check` (also runnable any time as a drift alarm; exit 1 on drift).

Historical Algorithm doctrine snapshots (`LIFEOS/ALGORITHM/v*.md`) keep their period IDs and are excluded from the drift scan.

## ArchitectureSummaryGenerator.ts - Architecture Summary Generator

**Location:** `{{LIFEOS_DIR}}/TOOLS/ArchitectureSummaryGenerator.ts`

Generate `LIFEOS_ARCHITECTURE_SUMMARY.md` from LifeosSystemArchitecture.md and subsystem docs. Provides a compact architecture overview derived from the master architecture document.

**Usage:**
```bash
# Generate/regenerate the architecture summary
bun "${LIFEOS_DIR}/TOOLS/ArchitectureSummaryGenerator.ts" generate

# Check if summary is stale (exit 1 if stale, 0 if fresh)
bun "${LIFEOS_DIR}/TOOLS/ArchitectureSummaryGenerator.ts" check
```

**When to Use:**
- "regenerate architecture summary"
- "check if architecture summary is stale"
- After modifying LifeosSystemArchitecture.md

---

## Doctor.ts - Capability Prober & Health Manifest

**Location:** `{{LIFEOS_DIR}}/TOOLS/Doctor.ts`

Probes the external tools LifeOS doctrine assumes but the core install does not ship — `codex` (cross-vendor audit), Interceptor (browser verification), Cloudflare/wrangler (scheduled flows), ElevenLabs (voice) — plus core wiring, and writes an **advisory** capability manifest at `MEMORY/STATE/capabilities.json`. Born from onboarding-friction feedback (discussion #1461): capabilities assumed but never verified degrade silently, and change-scoped checks can't see what's dormant at rest.

Four states per capability: `live` / `broken` / `declined` / `stale`. The manifest is a **TTL'd cache, never truth** — it carries a salted integrity hash and readers re-verify doctrine-critical capabilities live at point-of-use. `declined` is a first-class permanent, silent opt-out. Diagnostic register only — no scores, no percentages.

**Usage:**
```bash
# Probe (offline checks), human table
bun "${LIFEOS_DIR}/TOOLS/Doctor.ts"

# Include network probes (only for configured capabilities — no pre-consent egress)
bun "${LIFEOS_DIR}/TOOLS/Doctor.ts" --network

bun "${LIFEOS_DIR}/TOOLS/Doctor.ts" --json          # machine-readable
bun "${LIFEOS_DIR}/TOOLS/Doctor.ts" --verify        # integrity-check the manifest (exit 2 on tamper)
bun "${LIFEOS_DIR}/TOOLS/Doctor.ts" --reconcile     # hooks declared-on-disk vs registered-in-settings
bun "${LIFEOS_DIR}/TOOLS/Doctor.ts" --statusline    # one glyph if a NEW regression since ack, else empty
bun "${LIFEOS_DIR}/TOOLS/Doctor.ts" decline <cap>   # permanent silent opt-out
bun "${LIFEOS_DIR}/TOOLS/Doctor.ts" enable <cap>    # undo a decline
bun "${LIFEOS_DIR}/TOOLS/Doctor.ts" ack             # acknowledge the current broken set (statusline delta base)
```

**Consumers (read the manifest, never write it):** the statusline delta line (precomputed sidecar), the `AlgorithmNudge` capability row (fires at the moment a broken capability's command fails — reads only `state`, fix command is a static in-hook constant), and the Pulse System Health panel (`/api/doctor`). Never install-fatal: the default run always exits 0; every probe is timeout-bounded.

**When to Use:**
- "run the doctor", "check capabilities", "why is voice/codex/cloudflare not working"
- Post-install (INSTALL.md step 8.5) and any time something feels off

---

## MCP Servers

**Config:** `{{LIFEOS_ROOT}}/.mcp.json`

LifeOS connects to external MCP servers for domain-specific tool access.

| Server | Type | Endpoint | Controllable |
|--------|------|----------|-------------|
| **vendor-mcp** | HTTP | `vendor-protect-mcp.YOUR-SUBDOMAIN.workers.dev/mcp` | Yes (your CF Worker) |
| **cloudflare** | HTTP | `mcp.cloudflare.com/mcp` | No (external) |

### Result Size Override (Claude Code v2.1.91+)

MCP tool results are truncated by default. Servers can override this by adding `_meta["anthropic/maxResultSizeChars"]` to their tool result annotations, allowing results up to **500K characters** without truncation.

**This is a server-side annotation** — the MCP server must add it to its responses. There is no client-side setting.

**Implementation example (in MCP server response):**
```json
{
  "content": [{ "type": "text", "text": "...large result..." }],
  "_meta": {
    "anthropic/maxResultSizeChars": 500000
  }
}
```

**LifeOS applicability:**
- **vendor-mcp** — Can add this annotation (we control the Worker). Useful for `vendor_scan` and `vendor_diff` style tools that return large analysis payloads.
- **cloudflare** — External server; annotation must be added upstream by their maintainers.

---

## Related Documentation

- **Architecture**: `{{LIFEOS_DIR}}/DOCUMENTATION/LifeosSystemArchitecture.md` (master architecture reference)
- **CLI Tools**: `{{LIFEOS_DIR}}/DOCUMENTATION/Tools/Cli.md` (Algorithm CLI, Arbol CLI)

---

**Last Updated:** 2026-04-20
