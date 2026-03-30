# BetterInsights v1.0.0 - Installation Guide

**This guide is designed for AI agents installing this pack into a user's infrastructure.**

---

## AI Agent Instructions

**This is a wizard-style installation.** Use Claude Code's native tools to guide the user through installation:

1. **AskUserQuestion** - For user decisions and confirmations
2. **Bash/Read/Write** - For actual installation
3. **VERIFY.md** - For final validation

### Welcome Message

Before starting, greet the user:
```
"I'm installing BetterInsights v1.0.0 -- a /better-insights command that fixes
the undercounting in Claude Code's built-in /insights.

It scans ALL your session data, separates human messages from tool results,
classifies sessions as interactive vs automated, and reports token usage.

Let me analyze your system and guide you through installation."
```

---

## Phase 1: System Analysis

**Execute this analysis BEFORE any file operations.**

### 1.1 Run These Commands

```bash
# Check for Claude Code skills directory
CLAUDE_DIR="$HOME/.claude"
echo "Claude directory: $CLAUDE_DIR"

# Check if skills directory exists
if [ -d "$CLAUDE_DIR/skills" ]; then
  echo "OK Skills directory exists at: $CLAUDE_DIR/skills"
else
  echo "INFO Skills directory does not exist (will be created)"
fi

# Check for existing BetterInsights skill
if [ -d "$CLAUDE_DIR/skills/BetterInsights" ]; then
  echo "WARNING Existing BetterInsights skill found"
  ls -la "$CLAUDE_DIR/skills/BetterInsights/" 2>/dev/null
else
  echo "OK No existing BetterInsights skill (clean install)"
fi

# Check Python availability
python3 --version 2>&1 || echo "ERROR Python 3 not found"

# Check for session data
SESSION_COUNT=$(find "$CLAUDE_DIR/projects" -name "*.jsonl" 2>/dev/null | wc -l)
echo "Session files found: $SESSION_COUNT"
```

### 1.2 Assess Results

- Python 3.6+ required
- If existing BetterInsights found, ask user whether to overwrite
- If no session files found, warn that report will be empty until sessions accumulate

---

## Phase 2: User Questions

Ask the user:

1. **Confirm installation location**: "I'll install to `~/.claude/skills/BetterInsights/`. This adds a `/better-insights` command. OK?"

---

## Phase 3: Backup

If existing BetterInsights skill exists:

```bash
BACKUP_DIR="$HOME/.claude/skills/BetterInsights.backup.$(date +%Y%m%d%H%M%S)"
cp -r "$HOME/.claude/skills/BetterInsights" "$BACKUP_DIR"
echo "Backup created at: $BACKUP_DIR"
```

---

## Phase 4: Installation

### 4.1 Create Skill Directory

```bash
mkdir -p "$HOME/.claude/skills/BetterInsights"
```

### 4.2 Copy Source Files

Copy from this pack's `src/` directory:

| Source | Destination |
|--------|------------|
| `src/SKILL.md` | `~/.claude/skills/BetterInsights/SKILL.md` |
| `src/full_insights.py` | `~/.claude/skills/BetterInsights/full_insights.py` |

### 4.3 Verify File Permissions

```bash
chmod +x "$HOME/.claude/skills/BetterInsights/full_insights.py"
```

---

## Phase 5: Verification

Run the checks in `VERIFY.md` and report results to the user.

---

## Rollback

If anything goes wrong:

```bash
# Remove installed skill
rm -rf "$HOME/.claude/skills/BetterInsights"

# Restore backup if exists
BACKUP=$(ls -d "$HOME/.claude/skills/BetterInsights.backup."* 2>/dev/null | tail -1)
if [ -n "$BACKUP" ]; then
  mv "$BACKUP" "$HOME/.claude/skills/BetterInsights"
  echo "Restored from backup"
fi
```
