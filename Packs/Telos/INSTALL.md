# Telos v1.0.0 - Installation Guide

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
"I'm installing Telos v1.0.0 — Life OS and project analysis framework.

This pack adds the Telos skill with:
- Personal TELOS — life context system (beliefs, goals, wisdom, books, etc.)
- Project TELOS — organizational analysis with dependency mapping and dashboards
- Four workflows: Update, InterviewExtraction, CreateNarrativePoints, WriteReport
- Dashboard and Report templates (full Next.js applications)

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

# Check for existing Telos skill
if [ -d "$CLAUDE_DIR/skills/Telos" ]; then
  echo "WARNING Existing Telos skill found at: $CLAUDE_DIR/skills/Telos"
  echo "Contents:"
  ls -la "$CLAUDE_DIR/skills/Telos/" 2>/dev/null
else
  echo "OK No existing Telos skill (clean install)"
fi

# Check for existing sub-directories
for subdir in Workflows Tools DashboardTemplate ReportTemplate; do
  if [ -d "$CLAUDE_DIR/skills/Telos/$subdir" ]; then
    echo "WARNING Existing directory found: Telos/$subdir"
  fi
done

# Check for PAI infrastructure
if [ -d "$CLAUDE_DIR/PAI" ]; then
  echo "OK PAI directory exists"
else
  echo "INFO PAI directory not found (personal TELOS features will be limited)"
fi

# Check for personal TELOS files
if [ -d "$CLAUDE_DIR/PAI/USER/TELOS" ]; then
  echo "OK Personal TELOS directory exists at: $CLAUDE_DIR/PAI/USER/TELOS"
  ls "$CLAUDE_DIR/PAI/USER/TELOS/"*.md 2>/dev/null | wc -l | xargs echo "  TELOS files found:"
else
  echo "INFO Personal TELOS directory not found (personal context features unavailable)"
  echo "  Personal TELOS is created during PAI setup, not by this skill pack"
fi

# Check for bun (needed for dashboard/report templates)
if command -v bun >/dev/null 2>&1; then
  echo "OK bun is available (dashboard and report templates can be built)"
else
  echo "INFO bun not found (install bun for dashboard and report template builds)"
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
- Existing Telos skill: [found — will ask about conflict / not found]
- PAI infrastructure: [found / not found]
- Personal TELOS files: [found (N files) / not found]
- bun runtime: [found / not found]

[If personal TELOS not found]: Note: Personal TELOS files (beliefs, goals, books, etc.)
are created during PAI setup, not by this skill pack. The Telos skill will work for
project analysis without them. For personal life context features, set up PAI first:
https://github.com/danielmiessler/Personal_AI_Infrastructure

[If bun not found]: Note: The Dashboard and Report templates are Next.js applications
that require bun or npm to build. The core Telos skill works without them."
```

---

## Phase 2: User Questions

**Use AskUserQuestion tool at each decision point.**

### Question 1: Conflict Resolution (if existing skill found)

**Only ask if existing Telos skill directory detected:**

```json
{
  "header": "Conflict — Existing Telos Skill",
  "question": "An existing Telos skill was found. How should I proceed?",
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
  "header": "Install Telos Skill",
  "question": "Ready to install Telos v1.0.0?",
  "multiSelect": false,
  "options": [
    {"label": "Yes, install now (Recommended)", "description": "Copies all skill files to ~/.claude/skills/Telos/"},
    {"label": "Show me what will change", "description": "Lists all files and directories that will be created"},
    {"label": "Cancel", "description": "Abort installation"}
  ]
}
```

**If user chose "Show me what will change":**
```
"Directories to be created:
- ~/.claude/skills/Telos/
- ~/.claude/skills/Telos/Workflows/
- ~/.claude/skills/Telos/Tools/
- ~/.claude/skills/Telos/DashboardTemplate/ (full Next.js app with App/, Components/, Lib/)
- ~/.claude/skills/Telos/ReportTemplate/ (full Next.js app with App/, Components/, Lib/, Public/Fonts/)

Files to be created: 40+ files including SKILL.md, 4 workflow files, 1 TypeScript tool,
dashboard pages and components, report pages and components, font files, and config files.

No other files will be modified. No hooks, no configuration changes.
Personal TELOS files at ~/.claude/PAI/USER/TELOS/ will NOT be touched."
```

Then re-ask the final confirmation question.

---

## Phase 3: Backup (If Needed)

**Only execute if user chose "Backup and Replace":**

```bash
CLAUDE_DIR="$HOME/.claude"
BACKUP_DIR="$CLAUDE_DIR/Backups/telos-skill-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup existing Telos skill
if [ -d "$CLAUDE_DIR/skills/Telos" ]; then
  cp -r "$CLAUDE_DIR/skills/Telos" "$BACKUP_DIR/Telos"
  echo "Backed up Telos skill directory"
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
mkdir -p "$CLAUDE_DIR/skills/Telos"
mkdir -p "$CLAUDE_DIR/skills/Telos/Workflows"
mkdir -p "$CLAUDE_DIR/skills/Telos/Tools"
mkdir -p "$CLAUDE_DIR/skills/Telos/DashboardTemplate"
mkdir -p "$CLAUDE_DIR/skills/Telos/ReportTemplate"
echo "Created all skill directories"
```

**Mark todo as completed.**

### 4.2 Copy Skill Files

**Mark todo "Copy skill files" as in_progress.**

```bash
PACK_DIR="$(pwd)"
CLAUDE_DIR="$HOME/.claude"

# Copy entire src/ contents to target
cp -r "$PACK_DIR/src/"* "$CLAUDE_DIR/skills/Telos/"
echo "Copied all Telos skill files"

# Verify top-level SKILL.md
[ -f "$CLAUDE_DIR/skills/Telos/SKILL.md" ] && echo "OK SKILL.md installed" || echo "ERROR SKILL.md missing"
```

**Mark todo as completed.**

---

## Phase 5: Verification

**Mark todo "Run verification" as in_progress.**

**Execute all checks from VERIFY.md:**

```bash
CLAUDE_DIR="$HOME/.claude"

echo "=== Telos Skill Verification ==="

# Check top-level SKILL.md
echo "Checking skill file..."
[ -f "$CLAUDE_DIR/skills/Telos/SKILL.md" ] && echo "OK SKILL.md" || echo "MISSING SKILL.md"

# Check workflows
echo "Checking workflows..."
for wf in Update.md InterviewExtraction.md CreateNarrativePoints.md WriteReport.md; do
  [ -f "$CLAUDE_DIR/skills/Telos/Workflows/$wf" ] && echo "OK Workflows/$wf" || echo "MISSING Workflows/$wf"
done

# Check tools
echo "Checking tools..."
[ -f "$CLAUDE_DIR/skills/Telos/Tools/UpdateTelos.ts" ] && echo "OK Tools/UpdateTelos.ts" || echo "MISSING Tools/UpdateTelos.ts"

# Check templates
echo "Checking templates..."
[ -d "$CLAUDE_DIR/skills/Telos/DashboardTemplate" ] && echo "OK DashboardTemplate/" || echo "MISSING DashboardTemplate/"
[ -d "$CLAUDE_DIR/skills/Telos/ReportTemplate" ] && echo "OK ReportTemplate/" || echo "MISSING ReportTemplate/"
[ -f "$CLAUDE_DIR/skills/Telos/DashboardTemplate/package.json" ] && echo "OK DashboardTemplate/package.json" || echo "MISSING DashboardTemplate/package.json"
[ -f "$CLAUDE_DIR/skills/Telos/ReportTemplate/package.json" ] && echo "OK ReportTemplate/package.json" || echo "MISSING ReportTemplate/package.json"

# Check frontmatter
echo "Checking frontmatter..."
head -1 "$CLAUDE_DIR/skills/Telos/SKILL.md" | grep -q "^---" && echo "OK SKILL.md has valid frontmatter" || echo "ERROR SKILL.md missing frontmatter"

echo ""
echo "=== Verification Complete ==="
```

**Mark todo as completed when file checks pass.**

---

## Success/Failure Messages

### On Success

```
"Telos v1.0.0 installed successfully!

What's available:
- Personal TELOS — 'add to my TELOS books', 'what are my beliefs?', 'update my goals'
- Project analysis — 'analyze ~/Projects/MyApp with TELOS'
- Dashboards — 'build a dashboard for [project]'
- Narrative points — 'create TELOS narrative, n=24'
- Reports — 'write a TELOS report for [project]'

The skill auto-detects whether you're asking about personal context or project analysis
and routes accordingly."
```

### On Success (Without Personal TELOS)

```
"Telos v1.0.0 installed successfully!

The skill is ready for project analysis, narrative generation, and report building.

Personal TELOS features (beliefs, goals, books, etc.) require the TELOS files
at ~/.claude/PAI/USER/TELOS/. These are created during PAI setup:
https://github.com/danielmiessler/Personal_AI_Infrastructure

Try it now: 'analyze [any project directory] with TELOS'"
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

### "Personal TELOS not found" errors

Personal TELOS files live at `~/.claude/PAI/USER/TELOS/`, which is created during PAI setup -- not by this skill pack. The Telos skill works for project analysis without personal TELOS files.

### Dashboard or report template build fails

These templates require `bun` (or `npm`) and Node.js. Install bun (`curl -fsSL https://bun.sh/install | bash`) and run `bun install` in the template directory before `bun dev`.

### Update workflow not creating backups

Ensure the personal TELOS directory has write permissions. The Update workflow creates timestamped backup files in the same directory before modifying any file.

---

## What's Included

| Directory | Purpose |
|-----------|---------|
| `src/SKILL.md` | Main Telos skill with routing, context detection, and analysis methodology |
| `src/Workflows/` | Four workflows: Update, InterviewExtraction, CreateNarrativePoints, WriteReport |
| `src/Tools/` | TypeScript tool for TELOS updates |
| `src/DashboardTemplate/` | Complete Next.js dashboard app with shadcn/ui components |
| `src/ReportTemplate/` | Complete Next.js report app with professional typography and styling |

All files in `src/` are copied to `~/.claude/skills/Telos/` during installation.
