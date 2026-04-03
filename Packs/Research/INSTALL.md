# Research v1.0.0 - Installation Guide

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
"I'm installing Research v1.0.0 — comprehensive research and content extraction for Claude Code.

This pack adds the Research skill with:
- 4 research modes (Quick / Standard / Extensive / Deep Investigation)
- 14 specialized workflows (content extraction, Fabric patterns, AI trends, etc.)
- 2 domain templates for deep investigation
- Mandatory URL verification on all outputs

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

# Check for existing Research skill
if [ -d "$CLAUDE_DIR/skills/Research" ]; then
  echo "WARNING Existing Research skill found at: $CLAUDE_DIR/skills/Research"
  ls -la "$CLAUDE_DIR/skills/Research/" 2>/dev/null
else
  echo "OK No existing Research skill (clean install)"
fi

# Check for Workflows subdirectory
if [ -d "$CLAUDE_DIR/skills/Research/Workflows" ]; then
  echo "WARNING Existing Workflows directory found"
  ls -1 "$CLAUDE_DIR/skills/Research/Workflows/"*.md 2>/dev/null | wc -l | tr -d ' '
else
  echo "OK No existing Workflows directory"
fi

# Check for Templates subdirectory
if [ -d "$CLAUDE_DIR/skills/Research/Templates" ]; then
  echo "WARNING Existing Templates directory found"
else
  echo "OK No existing Templates directory"
fi

# Check for Perplexity API key availability
if [ -n "$PERPLEXITY_API_KEY" ]; then
  echo "OK Perplexity API key found in environment"
elif [ -f "$HOME/Projects/PAI/.env" ] && grep -q "PERPLEXITY" "$HOME/Projects/PAI/.env" 2>/dev/null; then
  echo "OK Perplexity API key found in PAI .env"
else
  echo "INFO Perplexity API key not found (needed for Quick/Standard/Extensive research modes)"
fi

# Check for Fabric CLI
if command -v fabric &>/dev/null; then
  echo "OK Fabric CLI found: $(which fabric)"
else
  echo "INFO Fabric CLI not found (needed for Fabric patterns and YouTube extraction)"
fi

# Check for PAI MEMORY structure
if [ -d "$CLAUDE_DIR/MEMORY" ]; then
  echo "OK PAI MEMORY directory exists (research artifacts will be stored)"
else
  echo "INFO PAI MEMORY not found (research output will use working directory)"
fi

# Check for user customizations
if [ -d "$CLAUDE_DIR/PAI/USER/SKILLCUSTOMIZATIONS/Research" ]; then
  echo "OK Research customizations found"
else
  echo "INFO No Research customizations (skill will use defaults)"
fi
```

### 1.2 Present Findings

Tell the user what you found:
```
"Here's what I found on your system:
- Skills directory: [exists / will be created]
- Existing Research skill: [found -- will ask about conflict / not found]
- Perplexity API key: [found / not found -- needed for multi-agent research]
- Fabric CLI: [found / not found -- needed for Fabric patterns]
- PAI MEMORY: [found / not found]
- Research customizations: [found / not found]

[If Perplexity not found]: Note: The Research skill's Quick, Standard, and Extensive
modes use Perplexity for web search. Without a Perplexity API key, you can still use
Claude Research (free, built-in WebSearch) and all content analysis workflows.

[If Fabric not found]: Note: The Fabric workflow and YouTube extraction use the Fabric CLI.
Install it with: brew install fabric (or see https://github.com/danielmiessler/fabric)"
```

---

## Phase 2: User Questions

**Use AskUserQuestion tool at each decision point.**

### Question 1: Conflict Resolution (if existing skill found)

**Only ask if existing Research skill detected:**

```json
{
  "header": "Conflict -- Existing Research Skill",
  "question": "An existing Research skill was found. How should I proceed?",
  "multiSelect": false,
  "options": [
    {"label": "Backup and Replace (Recommended)", "description": "Creates timestamped backup of existing skill, then installs new version"},
    {"label": "Replace Without Backup", "description": "Overwrites existing skill without backup"},
    {"label": "Abort Installation", "description": "Cancel installation, keep existing skill"}
  ]
}
```

### Question 2: Final Confirmation

```json
{
  "header": "Install",
  "question": "Ready to install Research v1.0.0?",
  "multiSelect": false,
  "options": [
    {"label": "Yes, install now (Recommended)", "description": "Copies skill files to ~/.claude/skills/Research/"},
    {"label": "Show me what will change", "description": "Lists all files and directories that will be created"},
    {"label": "Cancel", "description": "Abort installation"}
  ]
}
```

**If user chose "Show me what will change":**
```
"Directories to be created:
- ~/.claude/skills/Research/
- ~/.claude/skills/Research/Workflows/ (14 workflow files)
- ~/.claude/skills/Research/Templates/ (2 template files)

Files to be created:
- ~/.claude/skills/Research/SKILL.md (skill definition and routing)
- ~/.claude/skills/Research/QuickReference.md (mode comparison)
- ~/.claude/skills/Research/UrlVerificationProtocol.md (URL verification rules)
- ~/.claude/skills/Research/MigrationNotes.md (upgrade notes)

No other files will be modified. No hooks, no configuration changes."
```

Then re-ask the final confirmation question.

---

## Phase 3: Backup (If Needed)

**Only execute if user chose "Backup and Replace":**

```bash
CLAUDE_DIR="$HOME/.claude"
BACKUP_DIR="$CLAUDE_DIR/Backups/research-skill-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup existing Research skill
if [ -d "$CLAUDE_DIR/skills/Research" ]; then
  cp -R "$CLAUDE_DIR/skills/Research" "$BACKUP_DIR/Research"
  echo "Backed up Research skill to: $BACKUP_DIR/Research"
fi

echo "Backup created at: $BACKUP_DIR"
```

---

## Phase 4: Installation

**Create a TodoWrite list to track progress:**

```json
{
  "todos": [
    {"content": "Create skill directory structure", "status": "pending", "activeForm": "Creating directories"},
    {"content": "Copy skill files", "status": "pending", "activeForm": "Copying files"},
    {"content": "Run verification", "status": "pending", "activeForm": "Running verification"}
  ]
}
```

### 4.1 Create Skill Directory Structure

**Mark todo "Create skill directory structure" as in_progress.**

```bash
CLAUDE_DIR="$HOME/.claude"
mkdir -p "$CLAUDE_DIR/skills/Research"
mkdir -p "$CLAUDE_DIR/skills/Research/Workflows"
mkdir -p "$CLAUDE_DIR/skills/Research/Templates"
echo "Directory structure created"
```

**Mark todo as completed.**

### 4.2 Copy Skill Files

**Mark todo "Copy skill files" as in_progress.**

```bash
PACK_DIR="$(pwd)"
CLAUDE_DIR="$HOME/.claude"

# Copy top-level files
cp "$PACK_DIR/src/SKILL.md" "$CLAUDE_DIR/skills/Research/SKILL.md"
cp "$PACK_DIR/src/QuickReference.md" "$CLAUDE_DIR/skills/Research/QuickReference.md"
cp "$PACK_DIR/src/UrlVerificationProtocol.md" "$CLAUDE_DIR/skills/Research/UrlVerificationProtocol.md"
cp "$PACK_DIR/src/MigrationNotes.md" "$CLAUDE_DIR/skills/Research/MigrationNotes.md"

# Copy all workflows
cp "$PACK_DIR/src/Workflows/"*.md "$CLAUDE_DIR/skills/Research/Workflows/"

# Copy all templates
cp "$PACK_DIR/src/Templates/"*.md "$CLAUDE_DIR/skills/Research/Templates/"

echo "All skill files copied"
```

**Mark todo as completed.**

---

## Phase 5: Verification

**Mark todo "Run verification" as in_progress.**

**Execute all checks from VERIFY.md:**

```bash
CLAUDE_DIR="$HOME/.claude"

echo "=== Research Skill Verification ==="

# Check SKILL.md exists
echo "Checking skill files..."
[ -f "$CLAUDE_DIR/skills/Research/SKILL.md" ] && echo "OK Research SKILL.md installed" || echo "ERROR Research SKILL.md missing"
[ -f "$CLAUDE_DIR/skills/Research/QuickReference.md" ] && echo "OK QuickReference.md installed" || echo "ERROR QuickReference.md missing"
[ -f "$CLAUDE_DIR/skills/Research/UrlVerificationProtocol.md" ] && echo "OK UrlVerificationProtocol.md installed" || echo "ERROR UrlVerificationProtocol.md missing"

# Check subdirectories
echo "Checking directories..."
[ -d "$CLAUDE_DIR/skills/Research/Workflows" ] && echo "OK Workflows/ exists" || echo "ERROR Workflows/ missing"
[ -d "$CLAUDE_DIR/skills/Research/Templates" ] && echo "OK Templates/ exists" || echo "ERROR Templates/ missing"

# Count workflows
WORKFLOW_COUNT=$(ls -1 "$CLAUDE_DIR/skills/Research/Workflows/"*.md 2>/dev/null | wc -l | tr -d ' ')
echo "OK Workflows installed: $WORKFLOW_COUNT (expected: 14)"

# Count templates
TEMPLATE_COUNT=$(ls -1 "$CLAUDE_DIR/skills/Research/Templates/"*.md 2>/dev/null | wc -l | tr -d ' ')
echo "OK Templates installed: $TEMPLATE_COUNT (expected: 2)"

# Check frontmatter
echo "Checking frontmatter..."
head -1 "$CLAUDE_DIR/skills/Research/SKILL.md" | grep -q "^---" && echo "OK SKILL.md has valid frontmatter" || echo "ERROR SKILL.md missing frontmatter"

# Check key workflows exist
echo "Checking key workflows..."
for wf in QuickResearch.md StandardResearch.md ExtensiveResearch.md DeepInvestigation.md ExtractAlpha.md Fabric.md; do
  [ -f "$CLAUDE_DIR/skills/Research/Workflows/$wf" ] && echo "  OK $wf" || echo "  MISSING $wf"
done

echo ""
echo "=== Verification Complete ==="
```

**Mark todo as completed when file checks pass.**

---

## Success/Failure Messages

### On Success

```
"Research v1.0.0 installed successfully!

What's available:
- 4 research modes: Quick (10-15s) / Standard (15-30s) / Extensive (60-90s) / Deep (3-60min)
- 14 specialized workflows (content extraction, Fabric patterns, AI trends, etc.)
- 2 deep investigation templates (Market Research, Threat Landscape)

Try it now:
- 'research [any topic]' -- Standard mode (default)
- 'quick research on [topic]' -- Fast single-agent lookup
- 'extensive research on [topic]' -- 12-agent comprehensive sweep
- 'deep investigation of [topic]' -- Progressive iterative deep-dive

All research URLs are verified before delivery. Artifacts persist across sessions."
```

### On Success (Without Perplexity)

```
"Research v1.0.0 installed successfully!

The skill is ready, but no Perplexity API key was detected.
Right now, you can use:
- Claude Research (free, uses built-in WebSearch)
- Extract Alpha, Extract Knowledge, Enhance (content analysis)
- Fabric patterns (if Fabric CLI is installed)

For full multi-agent research (Quick/Standard/Extensive modes), add a Perplexity API key."
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

### "research" command not triggering the skill

The Research skill is triggered by the word "research" in natural language, not as a slash command. Say "research [topic]" or "do research on [topic]."

### Perplexity research returning errors

Check that your Perplexity API key is valid and has credits. The key should be in your PAI .env file or exported as `PERPLEXITY_API_KEY`.

### Fabric patterns not working

Install the Fabric CLI: `brew install fabric` or follow instructions at https://github.com/danielmiessler/fabric

### Deep investigation not persisting

Ensure `~/.claude/MEMORY/RESEARCH/` directory exists. If PAI MEMORY is not installed, create it manually: `mkdir -p ~/.claude/MEMORY/RESEARCH/`

---

## What's Included

| Path | Purpose |
|------|---------|
| `src/SKILL.md` | Skill definition, trigger words, research mode routing |
| `src/QuickReference.md` | Mode comparison table and detailed examples |
| `src/UrlVerificationProtocol.md` | Mandatory URL verification rules |
| `src/MigrationNotes.md` | Upgrade notes from prior versions |
| `src/Workflows/QuickResearch.md` | 1-agent fast lookup |
| `src/Workflows/StandardResearch.md` | 3-agent parallel research (default) |
| `src/Workflows/ExtensiveResearch.md` | 12-agent comprehensive research |
| `src/Workflows/DeepInvestigation.md` | Iterative progressive deep investigation |
| `src/Workflows/ExtractAlpha.md` | Deep content analysis |
| `src/Workflows/Retrieve.md` | Protected content retrieval |
| `src/Workflows/YoutubeExtraction.md` | YouTube transcript extraction |
| `src/Workflows/WebScraping.md` | General web scraping |
| `src/Workflows/ClaudeResearch.md` | Free Claude WebSearch |
| `src/Workflows/InterviewResearch.md` | Interview preparation |
| `src/Workflows/AnalyzeAiTrends.md` | AI trends analysis |
| `src/Workflows/Fabric.md` | 242+ Fabric pattern processing |
| `src/Workflows/Enhance.md` | Content enhancement |
| `src/Workflows/ExtractKnowledge.md` | Structured knowledge extraction |
| `src/Templates/MarketResearch.md` | Deep investigation domain template |
| `src/Templates/ThreatLandscape.md` | Deep investigation domain template |
