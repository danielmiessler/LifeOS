# Thinking v1.0.0 - Installation Guide

**This guide is designed for AI agents installing this pack into a user's infrastructure.**

---

## AI Agent Instructions

**This is a wizard-style installation.** Use Claude Code's native tools to guide the user through installation:

1. **AskUserQuestion** - For user decisions and confirmations
2. **TodoWrite** - For progress tracking
3. **Bash/Read/Write** - For actual installation
4. **VERIFY.md** - For final validation

### Welcome Message

Before starting, greet the user:
```
"I'm installing Thinking v1.0.0 — multi-mode analytical and creative thinking.

This pack adds the Thinking skill with seven modes:
- FirstPrinciples — decompose to axioms, challenge assumptions, reconstruct
- IterativeDepth — multi-angle deep exploration through progressive lenses
- BeCreative — divergent idea generation with six creativity workflows
- Council — multi-agent debate with visible transcripts
- RedTeam — adversarial validation and stress testing
- WorldThreatModelHarness — world model and threat analysis
- Science — hypothesis-test-analyze cycles (the meta-skill)

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

# Check for existing Thinking skill
if [ -d "$CLAUDE_DIR/skills/Thinking" ]; then
  echo "WARNING Existing Thinking skill found at: $CLAUDE_DIR/skills/Thinking"
  echo "Contents:"
  ls -la "$CLAUDE_DIR/skills/Thinking/" 2>/dev/null
else
  echo "OK No existing Thinking skill (clean install)"
fi

# Check for existing sub-domain directories
for subdir in FirstPrinciples IterativeDepth BeCreative Council RedTeam WorldThreatModelHarness Science; do
  if [ -d "$CLAUDE_DIR/skills/Thinking/$subdir" ]; then
    echo "WARNING Existing sub-domain found: Thinking/$subdir"
  fi
done

# Check for PAI infrastructure (optional)
if [ -d "$CLAUDE_DIR/PAI" ]; then
  echo "OK PAI directory exists (full integration available)"
else
  echo "INFO PAI directory not found (skill will work standalone)"
fi

# Check for skill customizations directory
if [ -d "$CLAUDE_DIR/PAI/USER/SKILLCUSTOMIZATIONS" ]; then
  echo "OK Skill customizations directory exists"
else
  echo "INFO No skill customizations directory (skill will use defaults)"
fi
```

### 1.2 Present Findings

Tell the user what you found:
```
"Here's what I found on your system:
- Skills directory: [exists / will be created]
- Existing Thinking skill: [found — will ask about conflict / not found]
- PAI infrastructure: [found (full integration) / not found (standalone mode)]
- Skill customizations: [found / not found]

The Thinking skill has no external dependencies. All seven modes work
immediately after installation."
```

---

## Phase 2: User Questions

**Use AskUserQuestion tool at each decision point.**

### Question 1: Conflict Resolution (if existing skill found)

**Only ask if existing Thinking skill directory detected:**

```json
{
  "header": "Conflict — Existing Thinking Skill",
  "question": "An existing Thinking skill was found. How should I proceed?",
  "multiSelect": false,
  "options": [
    {"label": "Backup and Replace (Recommended)", "description": "Creates timestamped backup of existing skill directory, then installs new version"},
    {"label": "Replace Without Backup", "description": "Removes existing skill directory and installs fresh"},
    {"label": "Abort Installation", "description": "Cancel installation, keep existing skill"}
  ]
}
```

### Question 2: Final Confirmation

```json
{
  "header": "Install Thinking Skill",
  "question": "Ready to install Thinking v1.0.0?",
  "multiSelect": false,
  "options": [
    {"label": "Yes, install now (Recommended)", "description": "Copies all skill files to ~/.claude/skills/Thinking/"},
    {"label": "Show me what will change", "description": "Lists all files and directories that will be created"},
    {"label": "Cancel", "description": "Abort installation"}
  ]
}
```

**If user chose "Show me what will change":**
```
"Directories to be created:
- ~/.claude/skills/Thinking/
- ~/.claude/skills/Thinking/FirstPrinciples/ (with Workflows/)
- ~/.claude/skills/Thinking/IterativeDepth/ (with Workflows/)
- ~/.claude/skills/Thinking/BeCreative/ (with Assets/, Workflows/)
- ~/.claude/skills/Thinking/Council/ (with Workflows/)
- ~/.claude/skills/Thinking/RedTeam/ (with Workflows/)
- ~/.claude/skills/Thinking/WorldThreatModelHarness/ (with Workflows/)
- ~/.claude/skills/Thinking/Science/ (with Workflows/)

Files to be created: 50+ files across all modes (SKILL.md files, workflows,
principles, methodology, templates, examples, assets)

No other files will be modified. No hooks, no configuration changes.
No external dependencies required."
```

Then re-ask the final confirmation question.

---

## Phase 3: Backup (If Needed)

**Only execute if user chose "Backup and Replace":**

```bash
CLAUDE_DIR="$HOME/.claude"
BACKUP_DIR="$CLAUDE_DIR/Backups/thinking-skill-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup existing Thinking skill
if [ -d "$CLAUDE_DIR/skills/Thinking" ]; then
  cp -r "$CLAUDE_DIR/skills/Thinking" "$BACKUP_DIR/Thinking"
  echo "Backed up Thinking skill directory"
fi

echo "Backup created at: $BACKUP_DIR"
```

---

## Phase 4: Installation

**Create a TodoWrite list to track progress:**

```json
{
  "todos": [
    {"content": "Create skill directory structure", "status": "pending", "activeForm": "Creating skill directories"},
    {"content": "Copy skill files", "status": "pending", "activeForm": "Copying skill files"},
    {"content": "Run verification", "status": "pending", "activeForm": "Running verification"}
  ]
}
```

### 4.1 Create Skill Directory Structure

**Mark todo "Create skill directory structure" as in_progress.**

```bash
CLAUDE_DIR="$HOME/.claude"
mkdir -p "$CLAUDE_DIR/skills/Thinking"
mkdir -p "$CLAUDE_DIR/skills/Thinking/FirstPrinciples/Workflows"
mkdir -p "$CLAUDE_DIR/skills/Thinking/IterativeDepth/Workflows"
mkdir -p "$CLAUDE_DIR/skills/Thinking/BeCreative/Assets"
mkdir -p "$CLAUDE_DIR/skills/Thinking/BeCreative/Workflows"
mkdir -p "$CLAUDE_DIR/skills/Thinking/Council/Workflows"
mkdir -p "$CLAUDE_DIR/skills/Thinking/RedTeam/Workflows"
mkdir -p "$CLAUDE_DIR/skills/Thinking/WorldThreatModelHarness/Workflows"
mkdir -p "$CLAUDE_DIR/skills/Thinking/Science/Workflows"
echo "Created all skill directories"
```

**Mark todo as completed.**

### 4.2 Copy Skill Files

**Mark todo "Copy skill files" as in_progress.**

```bash
PACK_DIR="$(pwd)"
CLAUDE_DIR="$HOME/.claude"

# Copy entire src/ contents to target
cp -r "$PACK_DIR/src/"* "$CLAUDE_DIR/skills/Thinking/"
echo "Copied all Thinking skill files"

# Verify top-level SKILL.md
[ -f "$CLAUDE_DIR/skills/Thinking/SKILL.md" ] && echo "OK SKILL.md installed" || echo "ERROR SKILL.md missing"
```

**Mark todo as completed.**

---

## Phase 5: Verification

**Mark todo "Run verification" as in_progress.**

**Execute all checks from VERIFY.md:**

```bash
CLAUDE_DIR="$HOME/.claude"

echo "=== Thinking Skill Verification ==="

# Check top-level SKILL.md
echo "Checking top-level skill file..."
[ -f "$CLAUDE_DIR/skills/Thinking/SKILL.md" ] && echo "OK SKILL.md" || echo "MISSING SKILL.md"

# Check sub-domain SKILL.md files
echo "Checking thinking mode skill files..."
for subdir in FirstPrinciples IterativeDepth BeCreative Council RedTeam WorldThreatModelHarness Science; do
  [ -f "$CLAUDE_DIR/skills/Thinking/$subdir/SKILL.md" ] && echo "OK $subdir/SKILL.md" || echo "MISSING $subdir/SKILL.md"
done

# Check key workflow directories
echo "Checking workflow directories..."
for subdir in FirstPrinciples IterativeDepth BeCreative Council RedTeam WorldThreatModelHarness Science; do
  [ -d "$CLAUDE_DIR/skills/Thinking/$subdir/Workflows" ] && echo "OK $subdir/Workflows/" || echo "MISSING $subdir/Workflows/"
done

# Check frontmatter
echo "Checking frontmatter..."
head -1 "$CLAUDE_DIR/skills/Thinking/SKILL.md" | grep -q "^---" && echo "OK SKILL.md has valid frontmatter" || echo "ERROR SKILL.md missing frontmatter"

echo ""
echo "=== Verification Complete ==="
```

**Mark todo as completed when file checks pass.**

---

## Success/Failure Messages

### On Success

```
"Thinking v1.0.0 installed successfully!

What's available (7 modes):
- FirstPrinciples — 'decompose this from first principles'
- IterativeDepth — 'explore this topic in depth'
- BeCreative — 'be creative about solving this', 'brainstorm ideas'
- Council — 'council debate on this decision'
- RedTeam — 'red team this plan', 'stress test this architecture'
- WorldThreatModelHarness — 'test this idea against my world model'
- Science — 'figure out why this is happening', 'design an experiment'

The skill routes automatically based on your request. Just describe the kind
of thinking you need and the right mode activates."
```

### On Failure

```
"Installation encountered issues. Here's what to check:

1. Ensure ~/.claude/ directory exists (created by Claude Code)
2. Check write permissions on ~/.claude/skills/
3. Run the verification commands in VERIFY.md

Need help? Open an issue at https://github.com/danielmiessler/Personal_AI_Infrastructure/issues"
```

---

## Troubleshooting

### Skill not activating after installation

Restart Claude Code. Skills from `~/.claude/skills/` are loaded at session start. Also verify that SKILL.md has valid YAML frontmatter with the `name` and `description` fields.

### Wrong thinking mode selected

The top-level SKILL.md routes based on keyword matching. If the wrong mode activates, try using more specific trigger words. For example, "red team" routes to RedTeam while "debate" routes to Council. Check the routing table in the top-level SKILL.md for the full keyword list.

### Council debates feel shallow

The Council skill supports both Quick (fast consensus) and full Debate (multi-round with cross-reference) workflows. If results are shallow, explicitly ask for a "full council debate" rather than "quick consensus."

### Science mode not iterating

The Science skill has nine distinct workflows. For iterative investigation, use "full scientific investigation" to trigger the FullCycle workflow, which chains all stages together. Individual workflows (DefineGoal, DesignExperiment, etc.) can also be triggered explicitly.

---

## What's Included

| Directory | Purpose |
|-----------|---------|
| `src/SKILL.md` | Top-level router for all seven thinking modes |
| `src/FirstPrinciples/` | Axiom decomposition with Deconstruct, Challenge, Reconstruct workflows |
| `src/IterativeDepth/` | Multi-lens deep exploration with scientific foundation |
| `src/BeCreative/` | Six creativity workflows with principles, templates, examples, and assets |
| `src/Council/` | Multi-agent debate with member definitions, round structure, and output format |
| `src/RedTeam/` | Adversarial validation with philosophy guide and integration notes |
| `src/WorldThreatModelHarness/` | World model management with model template and output format |
| `src/Science/` | Nine scientific method workflows with methodology, protocol, examples, and templates |

All files in `src/` are copied to `~/.claude/skills/Thinking/` during installation.
