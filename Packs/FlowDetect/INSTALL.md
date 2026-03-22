# Installing FlowDetect

Welcome to FlowDetect. This guide walks you through installing the flow state detection hook for Claude Code.

**What you are installing:** A hook and analysis engine that detects flow states during AI sessions by analyzing your message patterns — brevity, typos, punctuation drops, command directness, and velocity.

**Time required:** 5-10 minutes.

---

## Phase 1: System Analysis

Run these checks to confirm your environment is ready.

```bash
# Verify bun is installed (required for hook execution)
bun --version

# Verify Python 3 is installed (required for analysis engine)
python3 --version

# Verify Claude Code config directory exists
ls -la ~/.claude/

# Verify Claude Code project directories exist (these contain the transcripts)
ls -d ~/.claude/projects/ 2>/dev/null || echo "No projects directory — FlowDetect needs session transcripts to analyze"

# Verify settings.json exists (or will need to be created)
ls -la ~/.claude/settings.json 2>/dev/null || echo "settings.json not found — will create during install"

# Verify write access
touch ~/.claude/.install-test && rm ~/.claude/.install-test && echo "Write access confirmed"
```

**Required:**
- `bun` runtime installed and on PATH
- `python3` (3.8+) installed and on PATH
- `~/.claude/` directory exists
- `~/.claude/projects/` directory with at least one project containing JSONL transcripts

---

## Phase 2: User Questions

Before installing, decide:

1. **Transcript directories** — FlowDetect needs to know where your Claude Code session transcripts live. Default paths are listed in `flowdetect.py` under `TRANSCRIPT_DIRS`. You will likely need to update these to match your project directory names.

2. **CSV output location** — Where should flow score results be written? Default: `~/flowdetect_results.csv`. Change `OUTPUT_CSV` in `flowdetect.py` if you want a different location.

3. **Biometric integration** (optional) — If you have a Garmin or other wearable, FlowDetect can suggest starting a recording session when deep flow is detected. No configuration needed for this — it is a suggestion in the output, not an automated action.

---

## Phase 3: Installation

```bash
# Step 1: Create the hooks directory
mkdir -p ~/.claude/hooks

# Step 2: Copy the hook
cp src/Tools/FlowDetect.hook.ts ~/.claude/hooks/FlowDetect.hook.ts

# Step 3: Make hook executable
chmod +x ~/.claude/hooks/FlowDetect.hook.ts

# Step 4: Copy the analysis engine
cp src/Tools/flowdetect.py ~/flowdetect.py

# Step 5: Make analysis engine executable
chmod +x ~/flowdetect.py

# Step 6: Update transcript paths in flowdetect.py
# Edit TRANSCRIPT_DIRS to match your Claude Code project directories:
# python3 or your editor of choice
echo "IMPORTANT: Edit ~/flowdetect.py and update TRANSCRIPT_DIRS to match your project paths"
```

### Configure Claude Code

Add the FlowDetect hook to your `~/.claude/settings.json`. If the file does not exist, create it.

If `settings.json` already exists and has a `hooks` section, add the SessionEnd entry:

```json
{
  "hooks": {
    "SessionEnd": [
      {
        "type": "command",
        "command": "~/.claude/hooks/FlowDetect.hook.ts"
      }
    ]
  }
}
```

If `settings.json` already has other SessionEnd hooks, add this entry to the existing SessionEnd array. Do not overwrite other hooks.

### Update Transcript Paths

Open `~/flowdetect.py` and update the `TRANSCRIPT_DIRS` list to include your Claude Code project directories. These are typically at `~/.claude/projects/` and named after the working directory path with dashes replacing slashes:

```python
TRANSCRIPT_DIRS = [
    Path(os.path.expanduser("~/.claude/projects/-root--claude")),
    Path(os.path.expanduser("~/.claude/projects/-root")),
    # Add your project directories here
]
```

List your actual project directories:

```bash
ls ~/.claude/projects/
```

---

## Phase 4: Verification

See [VERIFY.md](VERIFY.md) for verification steps.

Quick check:

```bash
# Verify hook is in place
ls -la ~/.claude/hooks/FlowDetect.hook.ts

# Verify analysis engine is in place
ls -la ~/flowdetect.py

# Run a test analysis (will process all available transcripts)
python3 ~/flowdetect.py --csv && echo "CSV generated successfully" || echo "Analysis failed — check transcript paths"

# Check output
ls -la ~/flowdetect_results.csv
```
