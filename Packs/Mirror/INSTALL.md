# Mirror Engine -- Installation Guide

Welcome to Mirror Engine. This guide walks you through installing the structured metacognitive reflection system into your PAI environment.

## Prerequisites

- Claude Code (claude-code CLI)
- PAI infrastructure with skills directory (`~/.claude/skills/` or equivalent)
- Bash shell access

---

## Phase 1: System Analysis

Run these checks to verify your environment is ready.

```bash
# Check PAI skills directory exists
ls -d ~/.claude/skills/ 2>/dev/null && echo "PASS: Skills directory exists" || echo "FAIL: No skills directory at ~/.claude/skills/"

# Check for existing Mirror installation
ls -d ~/.claude/skills/Thinking/Mirror/ 2>/dev/null && echo "WARNING: Existing Mirror installation found -- backup recommended" || echo "PASS: No existing installation"

# Check write permissions
touch ~/.claude/skills/.install-test 2>/dev/null && rm ~/.claude/skills/.install-test && echo "PASS: Write permissions OK" || echo "FAIL: Cannot write to skills directory"
```

---

## Phase 2: User Questions

Before installing, decide:

1. **Customization directory:** Do you want to create a customization directory at `~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/Mirror/` for personal preferences? (Recommended for tuning reflection style, data paths, or interaction rules.)

2. **Data directory:** The concept library lives at `skills/Thinking/Mirror/Data/concepts.json`. If you have existing concept data, back it up before proceeding.

3. **Memory integration:** Mirror references several memory paths (`patterns.md`, session directories, memoir research). Ensure these exist or adjust paths in your customization preferences.

---

## Phase 3: Installation

```bash
# Create skill directory structure
mkdir -p ~/.claude/skills/Thinking/Mirror/src/Workflows
mkdir -p ~/.claude/skills/Thinking/Mirror/src/Data

# Copy core skill definition
cp src/SKILL.md ~/.claude/skills/Thinking/Mirror/src/SKILL.md

# Copy workflow files
cp src/Workflows/Witness.md ~/.claude/skills/Thinking/Mirror/src/Workflows/Witness.md
cp src/Workflows/Mirror.md ~/.claude/skills/Thinking/Mirror/src/Workflows/Mirror.md
cp src/Workflows/Architect.md ~/.claude/skills/Thinking/Mirror/src/Workflows/Architect.md
cp src/Workflows/Indexer.md ~/.claude/skills/Thinking/Mirror/src/Workflows/Indexer.md

# Copy data files
cp src/Data/concepts.json ~/.claude/skills/Thinking/Mirror/src/Data/concepts.json

# Optional: Create customization directory
mkdir -p ~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/Mirror/
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

After installation, Mirror Engine is available through natural language invocation. Say things like:

- "I need to reflect on something"
- "Hold this thought"
- "What's the pattern here?"
- "Mirror this for me"

The skill will route to the appropriate workflow (Witness, Mirror, Architect, or Indexer) based on your state and request.

## Uninstallation

```bash
rm -rf ~/.claude/skills/Thinking/Mirror/
# Optional: remove customizations
rm -rf ~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/Mirror/
```
