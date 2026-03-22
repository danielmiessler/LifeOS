# Installing PreCompact

Welcome to PreCompact. This guide walks you through installing the AI-authored fidelity preamble hook for Claude Code.

**What you are installing:** A hook that fires before context compaction, letting your AI write its own continuity document instead of relying on the system's lossy summary.

**Time required:** 5-10 minutes.

---

## Phase 1: System Analysis

Run these checks to confirm your environment is ready.

```bash
# Verify bun is installed (required for hook execution)
bun --version

# Verify Claude Code config directory exists
ls -la ~/.claude/

# Verify settings.json exists (or will need to be created)
ls -la ~/.claude/settings.json 2>/dev/null || echo "settings.json not found — will create during install"

# Verify write access to Claude config
touch ~/.claude/.install-test && rm ~/.claude/.install-test && echo "Write access confirmed"
```

**Required:**
- `bun` runtime installed and on PATH
- `~/.claude/` directory exists
- Write access to `~/.claude/`

---

## Phase 2: User Questions

Before installing, decide:

1. **Local preamble storage path** — Default: `~/.claude/MEMORY/STATE/`. This is where preamble files are written before and after compaction. Change only if you have a different memory directory structure.

2. **Fleet output** (optional) — If you run multiple AI instances that share context, PreCompact can write preambles to a shared git repository. Default: disabled. Set `MVOS_COMMS_PATH` environment variable to enable.

3. **Inference provider** — The hook uses an inference call to extract session state. By default it looks for a local inference module at `~/.claude/PAI/Tools/Inference`. If you do not have this, the hook falls back to writing a raw state dump without AI-powered extraction.

---

## Phase 3: Installation

```bash
# Step 1: Create the hooks directory
mkdir -p ~/.claude/hooks

# Step 2: Create the memory state directory
mkdir -p ~/.claude/MEMORY/STATE

# Step 3: Copy the hook
cp src/Tools/PreCompactStateDump.hook.ts ~/.claude/hooks/PreCompactStateDump.hook.ts

# Step 4: Make it executable
chmod +x ~/.claude/hooks/PreCompactStateDump.hook.ts

# Step 5: Copy supporting library files (if they exist in your PAI installation)
# If you don't have these, the hook will need adaptation — see notes below.
# cp src/Tools/lib/hook-io.ts ~/.claude/hooks/lib/hook-io.ts
# cp src/Tools/lib/paths.ts ~/.claude/hooks/lib/paths.ts
```

### Configure Claude Code

Add the PreCompact hook to your `~/.claude/settings.json`. If the file does not exist, create it.

If `settings.json` already exists and has a `hooks` section, add the PreCompact entry:

```json
{
  "hooks": {
    "PreCompact": [
      {
        "type": "command",
        "command": "~/.claude/hooks/PreCompactStateDump.hook.ts"
      }
    ]
  }
}
```

If `settings.json` already has other hook entries, merge this into the existing `hooks` object. Do not overwrite other hooks.

### Adapting Without PAI Infrastructure

The hook as shipped imports from `./lib/hook-io` and `./lib/paths`. These are part of the broader PAI hook infrastructure. If you are using PreCompact standalone:

1. Replace the `readHookInput()` call with direct `stdin` reading (the hook receives JSON on stdin with `session_id` and `transcript_path`)
2. Replace `getPaiDir()` with a hardcoded path to your Claude config directory (typically `~/.claude`)
3. Replace the `inference()` call with your preferred LLM API call, or remove it to use the raw fallback mode

---

## Phase 4: Verification

See [VERIFY.md](VERIFY.md) for verification steps.

Quick check:

```bash
# Verify hook is in place and executable
ls -la ~/.claude/hooks/PreCompactStateDump.hook.ts

# Verify settings.json has the hook configured
grep -l "PreCompact" ~/.claude/settings.json

# Verify memory directory exists
ls -d ~/.claude/MEMORY/STATE/
```

The hook will fire automatically the next time your Claude Code session approaches the context window limit. You will see `[PreCompact]` messages in stderr when it runs.
