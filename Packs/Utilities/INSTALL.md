# Utilities v1.0.0 - Installation Guide

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
"I'm installing Utilities v1.0.0 -- thirteen developer utility sub-skills in one unified routing layer.

This skill adds capabilities for:
- CLI generation, skill scaffolding, agent delegation
- Document processing, content parsing, audio editing
- Evaluations, Fabric patterns, Cloudflare deployment
- Browser automation, meta-prompting, aphorisms

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
  ls -la "$CLAUDE_DIR/skills/" 2>/dev/null
else
  echo "INFO Skills directory does not exist (will be created)"
fi

# Check for existing Utilities skill
if [ -d "$CLAUDE_DIR/skills/Utilities" ]; then
  echo "WARNING Existing Utilities skill found at: $CLAUDE_DIR/skills/Utilities"
  ls -la "$CLAUDE_DIR/skills/Utilities/" 2>/dev/null
else
  echo "OK No existing Utilities skill (clean install)"
fi

# Check for existing sub-skill directories
for subskill in Aphorisms AudioEditor Browser Cloudflare CreateCLI CreateSkill Delegation Documents Evals Fabric PAIUpgrade Parser Prompting; do
  if [ -d "$CLAUDE_DIR/skills/Utilities/$subskill" ]; then
    echo "WARNING Existing $subskill sub-skill found"
  fi
done

# Check for PAI infrastructure
if [ -d "$CLAUDE_DIR/skills/PAI" ] || [ -d "$HOME/.claude/PAI" ]; then
  echo "OK PAI infrastructure detected"
else
  echo "INFO PAI infrastructure not detected (some sub-skills may have reduced functionality)"
fi

# Check optional dependencies (informational)
echo ""
echo "Optional dependency checks:"
command -v bun &>/dev/null && echo "  OK bun runtime available" || echo "  INFO bun not found (needed for TypeScript tools in CreateCLI, Evals, PAIUpgrade, Parser)"
command -v ffmpeg &>/dev/null && echo "  OK ffmpeg available" || echo "  INFO ffmpeg not found (needed for AudioEditor sub-skill)"
command -v wrangler &>/dev/null && echo "  OK wrangler available" || echo "  INFO wrangler not found (needed for Cloudflare sub-skill)"
command -v fabric &>/dev/null && echo "  OK fabric available" || echo "  INFO fabric not found (needed for Fabric sub-skill)"
```

### 1.2 Present Findings

Tell the user what you found:
```
"Here's what I found on your system:
- Skills directory: [exists / will be created]
- Existing Utilities skill: [found -- will ask about conflict / not found]
- PAI infrastructure: [found / not found]

Optional dependencies (not required for installation):
- bun: [found / not found -- used by CreateCLI, Evals, PAIUpgrade, Parser]
- ffmpeg: [found / not found -- used by AudioEditor]
- wrangler: [found / not found -- used by Cloudflare]
- fabric: [found / not found -- used by Fabric]

Note: All sub-skills install regardless of dependencies. Missing dependencies only
affect specific workflows at runtime."
```

---

## Phase 2: User Questions

**Use AskUserQuestion tool at each decision point.**

### Question 1: Conflict Resolution (if existing skill found)

**Only ask if existing Utilities skill detected:**

```json
{
  "header": "Conflict -- Existing Skill",
  "question": "An existing Utilities skill was found. How should I proceed?",
  "multiSelect": false,
  "options": [
    {"label": "Backup and Replace (Recommended)", "description": "Creates timestamped backup of existing skill directory, then installs new version"},
    {"label": "Replace Without Backup", "description": "Overwrites existing skill without backup"},
    {"label": "Abort Installation", "description": "Cancel installation, keep existing skill"}
  ]
}
```

### Question 2: Sub-Skill Selection

```json
{
  "header": "Sub-Skill Selection",
  "question": "Which sub-skills would you like to install?",
  "multiSelect": false,
  "options": [
    {"label": "All 13 sub-skills (Recommended)", "description": "Installs the full Utilities suite -- CreateCLI, CreateSkill, Delegation, PAIUpgrade, Evals, Documents, Parser, AudioEditor, Fabric, Cloudflare, Browser, Prompting, Aphorisms"},
    {"label": "Let me choose", "description": "Select individual sub-skills to install"}
  ]
}
```

**If user chose "Let me choose":** Present a multi-select with all 13 sub-skills listed. Always include SKILL.md regardless of selection.

### Question 3: Final Confirmation

```json
{
  "header": "Install",
  "question": "Ready to install Utilities v1.0.0?",
  "multiSelect": false,
  "options": [
    {"label": "Yes, install now (Recommended)", "description": "Copies skill files to ~/.claude/skills/Utilities/"},
    {"label": "Show me what will change", "description": "Lists all files and directories that will be created"},
    {"label": "Cancel", "description": "Abort installation"}
  ]
}
```

**If user chose "Show me what will change":**
```
"Directories and files to be created:
- ~/.claude/skills/Utilities/SKILL.md (routing layer)
- ~/.claude/skills/Utilities/Aphorisms/ (quote database management)
- ~/.claude/skills/Utilities/AudioEditor/ (audio cleaning and editing)
- ~/.claude/skills/Utilities/Browser/ (browser automation)
- ~/.claude/skills/Utilities/Cloudflare/ (infrastructure deployment)
- ~/.claude/skills/Utilities/CreateCLI/ (CLI generation with patterns)
- ~/.claude/skills/Utilities/CreateSkill/ (skill scaffolding)
- ~/.claude/skills/Utilities/Delegation/ (parallel agent coordination)
- ~/.claude/skills/Utilities/Documents/ (document processing)
- ~/.claude/skills/Utilities/Evals/ (evaluation framework)
- ~/.claude/skills/Utilities/Fabric/ (pattern execution)
- ~/.claude/skills/Utilities/PAIUpgrade/ (system improvement)
- ~/.claude/skills/Utilities/Parser/ (data extraction)
- ~/.claude/skills/Utilities/Prompting/ (meta-prompting)

Total: 1 routing file + 13 sub-skill directories with their contents.
No other files will be modified. No hooks, no configuration changes."
```

Then re-ask the final confirmation question.

---

## Phase 3: Backup (If Needed)

**Only execute if user chose "Backup and Replace":**

```bash
CLAUDE_DIR="$HOME/.claude"
BACKUP_DIR="$CLAUDE_DIR/Backups/Utilities-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup existing skill directory
if [ -d "$CLAUDE_DIR/skills/Utilities" ]; then
  cp -r "$CLAUDE_DIR/skills/Utilities" "$BACKUP_DIR/Utilities"
  echo "Backed up Utilities skill directory"
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
    {"content": "Copy routing file", "status": "pending", "activeForm": "Copying routing file"},
    {"content": "Copy sub-skill directories", "status": "pending", "activeForm": "Copying sub-skill directories"},
    {"content": "Run verification", "status": "pending", "activeForm": "Running verification"}
  ]
}
```

### 4.1 Create Skill Directory Structure

**Mark todo "Create skill directory structure" as in_progress.**

```bash
CLAUDE_DIR="$HOME/.claude"
mkdir -p "$CLAUDE_DIR/skills/Utilities"
echo "Created Utilities skill directory"
```

**Mark todo as completed.**

### 4.2 Copy Routing File

**Mark todo "Copy routing file" as in_progress.**

```bash
PACK_DIR="$(pwd)"
CLAUDE_DIR="$HOME/.claude"
cp "$PACK_DIR/src/SKILL.md" "$CLAUDE_DIR/skills/Utilities/SKILL.md"
echo "Installed Utilities routing file"
```

**Mark todo as completed.**

### 4.3 Copy Sub-Skill Directories

**Mark todo "Copy sub-skill directories" as in_progress.**

**Copy all selected sub-skill directories (default: all 13):**

```bash
PACK_DIR="$(pwd)"
CLAUDE_DIR="$HOME/.claude"

for subskill in Aphorisms AudioEditor Browser Cloudflare CreateCLI CreateSkill Delegation Documents Evals Fabric PAIUpgrade Parser Prompting; do
  if [ -d "$PACK_DIR/src/$subskill" ]; then
    cp -r "$PACK_DIR/src/$subskill" "$CLAUDE_DIR/skills/Utilities/$subskill"
    echo "Installed $subskill"
  else
    echo "WARNING $subskill not found in pack source"
  fi
done

echo "All sub-skills installed"
```

**Mark todo as completed.**

---

## Phase 5: Verification

**Mark todo "Run verification" as in_progress.**

**Execute all checks from VERIFY.md:**

```bash
CLAUDE_DIR="$HOME/.claude"

echo "=== Utilities Verification ==="

# Check routing file
echo "Checking routing file..."
[ -f "$CLAUDE_DIR/skills/Utilities/SKILL.md" ] && echo "OK SKILL.md installed" || echo "ERROR SKILL.md missing"

# Check all sub-skill directories
echo "Checking sub-skill directories..."
for subskill in Aphorisms AudioEditor Browser Cloudflare CreateCLI CreateSkill Delegation Documents Evals Fabric PAIUpgrade Parser Prompting; do
  if [ -d "$CLAUDE_DIR/skills/Utilities/$subskill" ]; then
    echo "OK $subskill/"
    # Check for SKILL.md in each sub-skill
    [ -f "$CLAUDE_DIR/skills/Utilities/$subskill/SKILL.md" ] && echo "  OK $subskill/SKILL.md" || echo "  WARNING $subskill/SKILL.md missing"
  else
    echo "MISSING $subskill/"
  fi
done

# Check frontmatter
echo "Checking frontmatter..."
head -1 "$CLAUDE_DIR/skills/Utilities/SKILL.md" | grep -q "^---" && echo "OK SKILL.md has valid frontmatter" || echo "ERROR SKILL.md missing frontmatter"

# Check routing table
echo "Checking routing table..."
grep -q "CreateCLI" "$CLAUDE_DIR/skills/Utilities/SKILL.md" && echo "OK Routing table references CreateCLI" || echo "ERROR Routing table incomplete"
grep -q "Parser" "$CLAUDE_DIR/skills/Utilities/SKILL.md" && echo "OK Routing table references Parser" || echo "ERROR Routing table incomplete"

# Dependency checks (informational)
echo ""
echo "Dependency availability (informational):"
command -v bun &>/dev/null && echo "  OK bun runtime" || echo "  INFO bun not found"
command -v ffmpeg &>/dev/null && echo "  OK ffmpeg" || echo "  INFO ffmpeg not found"
command -v wrangler &>/dev/null && echo "  OK wrangler" || echo "  INFO wrangler not found"
command -v fabric &>/dev/null && echo "  OK fabric" || echo "  INFO fabric not found"

echo ""
echo "=== Verification Complete ==="
```

**Mark todo as completed when file checks pass.**

---

## Success/Failure Messages

### On Success

```
"Utilities v1.0.0 installed successfully!

What's available (13 sub-skills):
- CreateCLI -- generate TypeScript CLI tools
- CreateSkill -- scaffold new PAI skills
- Delegation -- coordinate parallel agent execution
- PAIUpgrade -- analyze and apply system improvements
- Evals -- run evaluations and benchmarks
- Documents -- process PDF, DOCX, XLSX, PPTX files
- Parser -- extract structured data from URLs and content
- AudioEditor -- clean and edit audio files
- Fabric -- run Fabric patterns
- Cloudflare -- deploy Workers, Pages, and infrastructure
- Browser -- automate browser interactions
- Prompting -- meta-prompting and template engineering
- Aphorisms -- manage quotes and aphorisms

Try it now: Ask for any of the above capabilities by describing what you need.

Example: 'Create a CLI that wraps the GitHub API'
Example: 'Parse this YouTube video transcript'
Example: 'Clean the filler words from this audio file'"
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

### Skill not recognized after installation

Restart Claude Code. Skills from `~/.claude/skills/` are loaded at session start.

### Specific sub-skill not routing correctly

Check that the sub-skill's SKILL.md exists in its directory. The routing table in the top-level SKILL.md references paths like `CreateCLI/SKILL.md` -- if that file is missing, the route will fail.

### Sub-skill workflow fails with missing dependency

Individual sub-skills may require external tools:
- **AudioEditor**: Install ffmpeg (`brew install ffmpeg`)
- **Cloudflare**: Install wrangler (`npm install -g wrangler`)
- **Fabric**: Install fabric (see fabric docs)
- **CreateCLI, Evals, PAIUpgrade, Parser**: Install bun (`curl -fsSL https://bun.sh/install | bash`)

### Large installation size

The Utilities pack is the largest PAI pack because it contains 13 sub-skills with their own tools, workflows, and context files. This is by design -- each sub-skill needs its full context available to function properly.

---

## What's Included

| Directory | Sub-Skill | Key Contents |
|-----------|-----------|-------------|
| `src/SKILL.md` | Router | Top-level routing table for all 13 sub-skills |
| `src/Aphorisms/` | Aphorisms | SKILL.md, Database/, Workflows/ |
| `src/AudioEditor/` | AudioEditor | SKILL.md, Tools/, Workflows/ |
| `src/Browser/` | Browser | SKILL.md, README.md, Recipes/, Stories/, Workflows/ |
| `src/Cloudflare/` | Cloudflare | SKILL.md, Workflows/ |
| `src/CreateCLI/` | CreateCLI | SKILL.md, FrameworkComparison.md, Patterns.md, TypescriptPatterns.md, Workflows/ |
| `src/CreateSkill/` | CreateSkill | SKILL.md, Workflows/ |
| `src/Delegation/` | Delegation | SKILL.md |
| `src/Documents/` | Documents | SKILL.md, Docx/, Pdf/, Pptx/, Xlsx/, Workflows/ |
| `src/Evals/` | Evals | SKILL.md, PROJECT.md, BestPractices.md, CLIReference.md, ScienceMapping.md, ScorerTypes.md, TemplateIntegration.md, Data/, Graders/, Results/, Suites/, Tools/, Types/, UseCases/, Workflows/ |
| `src/Fabric/` | Fabric | SKILL.md, Patterns/, Workflows/ |
| `src/PAIUpgrade/` | PAIUpgrade | SKILL.md, sources.json, youtube-channels.json, Logs/, State/, Tools/, Workflows/ |
| `src/Parser/` | Parser | SKILL.md, README.md, EntitySystem.md, entity-index.json, Lib/, Prompts/, Schema/, Tests/, Utils/, Web/, Workflows/ |
| `src/Prompting/` | Prompting | SKILL.md, Standards.md, Templates/, Tools/ |
