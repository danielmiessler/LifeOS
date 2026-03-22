# Flinch -- Installation Guide

Welcome to Flinch. This guide walks you through installing the somatic signal capture tool into your PAI environment.

## Prerequisites

- Bun runtime (`bun` command available)
- Claude Code (claude-code CLI)
- PAI infrastructure with skills and tools directories
- Bash shell access

---

## Phase 1: System Analysis

Run these checks to verify your environment is ready.

```bash
# Check Bun is installed
command -v bun >/dev/null && echo "PASS: Bun is installed ($(bun --version))" || echo "FAIL: Bun not found -- install from https://bun.sh"

# Check PAI skills directory exists
ls -d ~/.claude/skills/ 2>/dev/null && echo "PASS: Skills directory exists" || echo "FAIL: No skills directory at ~/.claude/skills/"

# Check PAI tools directory exists
ls -d ~/.claude/tools/ 2>/dev/null && echo "PASS: Tools directory exists" || echo "FAIL: No tools directory at ~/.claude/tools/ -- create it"

# Check for existing Flinch installation
ls -d ~/.claude/skills/Flinch/ 2>/dev/null && echo "WARNING: Existing Flinch skill found -- backup recommended" || echo "PASS: No existing skill installation"
command -v flinch >/dev/null && echo "WARNING: Existing flinch command found" || echo "PASS: No existing flinch command"

# Check write permissions
touch ~/.claude/skills/.install-test 2>/dev/null && rm ~/.claude/skills/.install-test && echo "PASS: Write permissions OK" || echo "FAIL: Cannot write to skills directory"
```

---

## Phase 2: User Questions

Before installing, decide:

1. **Log directory:** Flinch stores data at `~/.claude/flowlabs/logs/somatic_history.jsonl` by default. Override by setting the `PAI_DIR` environment variable.

2. **PATH integration:** Do you want `flinch` available as a global command? If yes, you will symlink the tool to a directory in your PATH.

3. **Voice reference path:** The `--refine` command references `projects/-root--claude/memory/rob-voice-reference.md` for pattern integration. Adjust in the source if your voice reference file is elsewhere.

---

## Phase 3: Installation

```bash
# Create skill directory structure
mkdir -p ~/.claude/skills/Flinch/src/Tools
mkdir -p ~/.claude/skills/Flinch/src/Workflows

# Create log directory
mkdir -p ~/.claude/flowlabs/logs

# Copy skill definition
cp src/SKILL.md ~/.claude/skills/Flinch/src/SKILL.md

# Copy tool
cp src/Tools/flinch.ts ~/.claude/skills/Flinch/src/Tools/flinch.ts

# Copy workflow files
cp src/Workflows/Capture.md ~/.claude/skills/Flinch/src/Workflows/Capture.md
cp src/Workflows/Review.md ~/.claude/skills/Flinch/src/Workflows/Review.md
cp src/Workflows/Score.md ~/.claude/skills/Flinch/src/Workflows/Score.md

# Make tool executable
chmod +x ~/.claude/skills/Flinch/src/Tools/flinch.ts

# Optional: Create global command symlink
mkdir -p ~/.claude/tools
ln -sf ~/.claude/skills/Flinch/src/Tools/flinch.ts ~/.claude/tools/flinch
# If ~/.claude/tools is in your PATH, 'flinch' is now a global command
```

---

## Phase 4: Verification

Run the verification suite to confirm installation.

```bash
# Run full verification
bash VERIFY.md
```

Or see [VERIFY.md](VERIFY.md) for individual checks you can run manually.

---

## Post-Installation

After installation, use Flinch directly from the command line:

```bash
# Quick capture
flinch "chest tightening when the proposal felt off"

# Review unscored
flinch --review

# Score a past flinch
flinch --score f-abc123 correct

# Check your accuracy
flinch --stats
```

The skill definition also allows natural language invocation through Claude Code:
- "Log a flinch"
- "I just felt something off"
- "Review my flinches"
- "How accurate are my gut instincts?"

## Uninstallation

```bash
rm -rf ~/.claude/skills/Flinch/
rm -f ~/.claude/tools/flinch
# Optional: remove log data
rm -f ~/.claude/flowlabs/logs/somatic_history.jsonl
```
