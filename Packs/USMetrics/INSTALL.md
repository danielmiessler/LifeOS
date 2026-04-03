# USMetrics v1.0.0 - Installation Guide

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
"I'm installing USMetrics v1.0.0 -- 68 US economic indicators with trend analysis and cross-metric correlation.

This skill adds two workflows:
- UpdateData -- fetch live data from FRED, EIA, Treasury APIs
- GetCurrentState -- generate comprehensive economic analysis

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

# Check for existing USMetrics skill
if [ -d "$CLAUDE_DIR/skills/USMetrics" ]; then
  echo "WARNING Existing USMetrics skill found at: $CLAUDE_DIR/skills/USMetrics"
  ls -la "$CLAUDE_DIR/skills/USMetrics/" 2>/dev/null
else
  echo "OK No existing USMetrics skill (clean install)"
fi

# Check for USMetrics subdirectories
for subdir in Tools Workflows; do
  if [ -d "$CLAUDE_DIR/skills/USMetrics/$subdir" ]; then
    echo "WARNING Existing $subdir directory found"
  fi
done

# Check for bun runtime
if command -v bun &>/dev/null; then
  echo "OK bun runtime available: $(bun --version)"
else
  echo "WARNING bun runtime not found (required for TypeScript tools)"
fi

# Check for API keys
if [ -n "$FRED_API_KEY" ]; then
  echo "OK FRED_API_KEY is set"
else
  echo "INFO FRED_API_KEY not set (required for UpdateData workflow)"
fi

if [ -n "$EIA_API_KEY" ]; then
  echo "OK EIA_API_KEY is set"
else
  echo "INFO EIA_API_KEY not set (required for UpdateData workflow)"
fi

# Check for PAI data directory
if [ -d "$CLAUDE_DIR/skills/PAI" ] || [ -d "$HOME/.claude/PAI" ]; then
  echo "OK PAI infrastructure detected"
else
  echo "INFO PAI infrastructure not detected (skill will still install)"
fi
```

### 1.2 Present Findings

Tell the user what you found:
```
"Here's what I found on your system:
- Skills directory: [exists / will be created]
- Existing USMetrics skill: [found -- will ask about conflict / not found]
- bun runtime: [found (version) / not found -- required for tools]
- FRED_API_KEY: [set / not set -- needed for data fetching]
- EIA_API_KEY: [set / not set -- needed for data fetching]
- PAI infrastructure: [found / not found]

[If bun not found]: Note: The TypeScript tools require bun to run. Install it with:
curl -fsSL https://bun.sh/install | bash

[If API keys not set]: Note: The UpdateData workflow requires FRED_API_KEY and EIA_API_KEY
to fetch live data. You can get free keys at:
- FRED: https://fred.stlouisfed.org/docs/api/api_key.html
- EIA: https://www.eia.gov/opendata/register.php"
```

---

## Phase 2: User Questions

**Use AskUserQuestion tool at each decision point.**

### Question 1: Conflict Resolution (if existing skill found)

**Only ask if existing USMetrics skill detected:**

```json
{
  "header": "Conflict -- Existing Skill",
  "question": "An existing USMetrics skill was found. How should I proceed?",
  "multiSelect": false,
  "options": [
    {"label": "Backup and Replace (Recommended)", "description": "Creates timestamped backup of existing skill directory, then installs new version"},
    {"label": "Replace Without Backup", "description": "Overwrites existing skill without backup"},
    {"label": "Abort Installation", "description": "Cancel installation, keep existing skill"}
  ]
}
```

### Question 2: Final Confirmation

```json
{
  "header": "Install",
  "question": "Ready to install USMetrics v1.0.0?",
  "multiSelect": false,
  "options": [
    {"label": "Yes, install now (Recommended)", "description": "Copies skill files to ~/.claude/skills/USMetrics/"},
    {"label": "Show me what will change", "description": "Lists all files and directories that will be created"},
    {"label": "Cancel", "description": "Abort installation"}
  ]
}
```

**If user chose "Show me what will change":**
```
"Files and directories to be created:
- ~/.claude/skills/USMetrics/SKILL.md (skill definition and routing)
- ~/.claude/skills/USMetrics/Tools/UpdateSubstrateMetrics.ts (data fetching tool)
- ~/.claude/skills/USMetrics/Tools/FetchFredSeries.ts (FRED API tool)
- ~/.claude/skills/USMetrics/Tools/GenerateAnalysis.ts (analysis generation tool)
- ~/.claude/skills/USMetrics/Workflows/UpdateData.md (data update workflow)
- ~/.claude/skills/USMetrics/Workflows/GetCurrentState.md (analysis workflow)

No other files will be modified. No hooks, no configuration changes."
```

Then re-ask the final confirmation question.

---

## Phase 3: Backup (If Needed)

**Only execute if user chose "Backup and Replace":**

```bash
CLAUDE_DIR="$HOME/.claude"
BACKUP_DIR="$CLAUDE_DIR/Backups/USMetrics-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup existing skill directory
if [ -d "$CLAUDE_DIR/skills/USMetrics" ]; then
  cp -r "$CLAUDE_DIR/skills/USMetrics" "$BACKUP_DIR/USMetrics"
  echo "Backed up USMetrics skill directory"
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
mkdir -p "$CLAUDE_DIR/skills/USMetrics"
mkdir -p "$CLAUDE_DIR/skills/USMetrics/Tools"
mkdir -p "$CLAUDE_DIR/skills/USMetrics/Workflows"
echo "Created USMetrics skill directory structure"
```

**Mark todo as completed.**

### 4.2 Copy Skill Files

**Mark todo "Copy skill files" as in_progress.**

```bash
PACK_DIR="$(pwd)"
CLAUDE_DIR="$HOME/.claude"

# Copy SKILL.md
cp "$PACK_DIR/src/SKILL.md" "$CLAUDE_DIR/skills/USMetrics/SKILL.md"

# Copy Tools
cp "$PACK_DIR/src/Tools/UpdateSubstrateMetrics.ts" "$CLAUDE_DIR/skills/USMetrics/Tools/UpdateSubstrateMetrics.ts"
cp "$PACK_DIR/src/Tools/FetchFredSeries.ts" "$CLAUDE_DIR/skills/USMetrics/Tools/FetchFredSeries.ts"
cp "$PACK_DIR/src/Tools/GenerateAnalysis.ts" "$CLAUDE_DIR/skills/USMetrics/Tools/GenerateAnalysis.ts"

# Copy Workflows
cp "$PACK_DIR/src/Workflows/UpdateData.md" "$CLAUDE_DIR/skills/USMetrics/Workflows/UpdateData.md"
cp "$PACK_DIR/src/Workflows/GetCurrentState.md" "$CLAUDE_DIR/skills/USMetrics/Workflows/GetCurrentState.md"

echo "Installed USMetrics skill files"
```

**Mark todo as completed.**

---

## Phase 5: Verification

**Mark todo "Run verification" as in_progress.**

**Execute all checks from VERIFY.md:**

```bash
CLAUDE_DIR="$HOME/.claude"

echo "=== USMetrics Verification ==="

# Check SKILL.md exists
echo "Checking skill definition..."
[ -f "$CLAUDE_DIR/skills/USMetrics/SKILL.md" ] && echo "OK SKILL.md installed" || echo "ERROR SKILL.md missing"

# Check directories exist
echo "Checking directories..."
[ -d "$CLAUDE_DIR/skills/USMetrics/Tools" ] && echo "OK Tools/ directory exists" || echo "ERROR Tools/ directory missing"
[ -d "$CLAUDE_DIR/skills/USMetrics/Workflows" ] && echo "OK Workflows/ directory exists" || echo "ERROR Workflows/ directory missing"

# Check tool files
echo "Checking tools..."
[ -f "$CLAUDE_DIR/skills/USMetrics/Tools/UpdateSubstrateMetrics.ts" ] && echo "OK UpdateSubstrateMetrics.ts" || echo "ERROR UpdateSubstrateMetrics.ts missing"
[ -f "$CLAUDE_DIR/skills/USMetrics/Tools/FetchFredSeries.ts" ] && echo "OK FetchFredSeries.ts" || echo "ERROR FetchFredSeries.ts missing"
[ -f "$CLAUDE_DIR/skills/USMetrics/Tools/GenerateAnalysis.ts" ] && echo "OK GenerateAnalysis.ts" || echo "ERROR GenerateAnalysis.ts missing"

# Check workflow files
echo "Checking workflows..."
[ -f "$CLAUDE_DIR/skills/USMetrics/Workflows/UpdateData.md" ] && echo "OK UpdateData.md" || echo "ERROR UpdateData.md missing"
[ -f "$CLAUDE_DIR/skills/USMetrics/Workflows/GetCurrentState.md" ] && echo "OK GetCurrentState.md" || echo "ERROR GetCurrentState.md missing"

# Check frontmatter
echo "Checking frontmatter..."
head -1 "$CLAUDE_DIR/skills/USMetrics/SKILL.md" | grep -q "^---" && echo "OK SKILL.md has valid frontmatter" || echo "ERROR SKILL.md missing frontmatter"

# Dependency checks (informational)
echo ""
echo "Dependency availability (informational):"
command -v bun &>/dev/null && echo "  OK bun runtime available" || echo "  INFO bun not found (required for tools)"
[ -n "$FRED_API_KEY" ] && echo "  OK FRED_API_KEY set" || echo "  INFO FRED_API_KEY not set (required for UpdateData)"
[ -n "$EIA_API_KEY" ] && echo "  OK EIA_API_KEY set" || echo "  INFO EIA_API_KEY not set (required for UpdateData)"

echo ""
echo "=== Verification Complete ==="
```

**Mark todo as completed when file checks pass.**

---

## Success/Failure Messages

### On Success

```
"USMetrics v1.0.0 installed successfully!

What's available:
- UpdateData workflow -- fetches live data from FRED, EIA, Treasury APIs
- GetCurrentState workflow -- generates comprehensive economic analysis

Try it now: Ask 'How is the US economy doing?' or 'Update the US metrics'

Note: The UpdateData workflow requires FRED_API_KEY and EIA_API_KEY environment variables.
Get free API keys at:
- FRED: https://fred.stlouisfed.org/docs/api/api_key.html
- EIA: https://www.eia.gov/opendata/register.php"
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

### UpdateData workflow fails

Check that `bun` is installed and that `FRED_API_KEY` and `EIA_API_KEY` environment variables are set. The TypeScript tools require these to fetch live data.

### Data files not updating

Verify the Substrate data directory path is configured correctly in the skill and tools. The default path is referenced in SKILL.md.

### GetCurrentState shows stale data

Run the UpdateData workflow first to fetch fresh data, then run GetCurrentState for analysis.

---

## What's Included

| File | Purpose |
|------|---------|
| `src/SKILL.md` | Skill definition -- routing, workflows, metric categories, API config |
| `src/Tools/UpdateSubstrateMetrics.ts` | Fetches all 68 metrics and updates Substrate dataset files |
| `src/Tools/FetchFredSeries.ts` | Fetches historical data series from the FRED API |
| `src/Tools/GenerateAnalysis.ts` | Generates analysis report from current Substrate data |
| `src/Workflows/UpdateData.md` | Workflow instructions for live data fetching |
| `src/Workflows/GetCurrentState.md` | Workflow instructions for economic analysis generation |
