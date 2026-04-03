# Security v1.0.0 - Installation Guide

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
"I'm installing Security v1.0.0 — unified security assessment and intelligence.

This pack adds the Security skill with five sub-domains:
- Recon — network reconnaissance and enumeration
- WebAssessment — web app security testing
- PromptInjection — LLM security testing
- SECUpdates — security news aggregation
- AnnualReports — vendor report analysis

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

# Check for existing Security skill
if [ -d "$CLAUDE_DIR/skills/Security" ]; then
  echo "WARNING Existing Security skill found at: $CLAUDE_DIR/skills/Security"
  echo "Contents:"
  ls -la "$CLAUDE_DIR/skills/Security/" 2>/dev/null
else
  echo "OK No existing Security skill (clean install)"
fi

# Check for existing sub-domain directories
for subdir in Recon WebAssessment PromptInjection SECUpdates AnnualReports; do
  if [ -d "$CLAUDE_DIR/skills/Security/$subdir" ]; then
    echo "WARNING Existing sub-domain found: Security/$subdir"
  fi
done

# Check for PAI infrastructure (optional, enhances integration)
if [ -f "$CLAUDE_DIR/CLAUDE.md" ]; then
  echo "OK CLAUDE.md exists (PAI may be installed)"
else
  echo "INFO CLAUDE.md not found"
fi

if [ -d "$CLAUDE_DIR/PAI" ]; then
  echo "OK PAI directory exists (full integration available)"
else
  echo "INFO PAI directory not found (skill will work standalone)"
fi

# Check for user customizations directory
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
- Existing Security skill: [found — will ask about conflict / not found]
- PAI infrastructure: [found (full integration) / not found (standalone mode)]
- Skill customizations: [found / not found]

[If PAI not found]: Note: The Security skill works standalone but integrates
more deeply with PAI infrastructure for voice notifications, skill customizations,
and cross-skill coordination. For full functionality, consider installing PAI:
https://github.com/danielmiessler/Personal_AI_Infrastructure"
```

---

## Phase 2: User Questions

**Use AskUserQuestion tool at each decision point.**

### Question 1: Conflict Resolution (if existing skill found)

**Only ask if existing Security skill directory detected:**

```json
{
  "header": "Conflict — Existing Security Skill",
  "question": "An existing Security skill was found. How should I proceed?",
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
  "header": "Install Security Skill",
  "question": "Ready to install Security v1.0.0?",
  "multiSelect": false,
  "options": [
    {"label": "Yes, install now (Recommended)", "description": "Copies all skill files to ~/.claude/skills/Security/"},
    {"label": "Show me what will change", "description": "Lists all files and directories that will be created"},
    {"label": "Cancel", "description": "Abort installation"}
  ]
}
```

**If user chose "Show me what will change":**
```
"Directories to be created:
- ~/.claude/skills/Security/
- ~/.claude/skills/Security/Recon/ (with Tools/, Workflows/, Data/)
- ~/.claude/skills/Security/WebAssessment/ (with BugBountyTool/, FfufResources/, OsintTools/, Workflows/, WebappScripts/, WebappExamples/)
- ~/.claude/skills/Security/PromptInjection/ (with Workflows/)
- ~/.claude/skills/Security/SECUpdates/ (with Workflows/, State/)
- ~/.claude/skills/Security/AnnualReports/ (with Tools/)

Files to be created: 60+ files across all sub-domains (SKILL.md files, workflows, tools, data, examples)

No other files will be modified. No hooks, no configuration changes."
```

Then re-ask the final confirmation question.

---

## Phase 3: Backup (If Needed)

**Only execute if user chose "Backup and Replace":**

```bash
CLAUDE_DIR="$HOME/.claude"
BACKUP_DIR="$CLAUDE_DIR/Backups/security-skill-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup existing Security skill
if [ -d "$CLAUDE_DIR/skills/Security" ]; then
  cp -r "$CLAUDE_DIR/skills/Security" "$BACKUP_DIR/Security"
  echo "Backed up Security skill directory"
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
mkdir -p "$CLAUDE_DIR/skills/Security"
mkdir -p "$CLAUDE_DIR/skills/Security/Recon/Tools"
mkdir -p "$CLAUDE_DIR/skills/Security/Recon/Workflows"
mkdir -p "$CLAUDE_DIR/skills/Security/Recon/Data"
mkdir -p "$CLAUDE_DIR/skills/Security/WebAssessment/BugBountyTool/src"
mkdir -p "$CLAUDE_DIR/skills/Security/WebAssessment/FfufResources"
mkdir -p "$CLAUDE_DIR/skills/Security/WebAssessment/OsintTools"
mkdir -p "$CLAUDE_DIR/skills/Security/WebAssessment/WebappExamples"
mkdir -p "$CLAUDE_DIR/skills/Security/WebAssessment/WebappScripts"
mkdir -p "$CLAUDE_DIR/skills/Security/WebAssessment/Workflows/bug-bounty"
mkdir -p "$CLAUDE_DIR/skills/Security/WebAssessment/Workflows/ffuf"
mkdir -p "$CLAUDE_DIR/skills/Security/WebAssessment/Workflows/osint"
mkdir -p "$CLAUDE_DIR/skills/Security/WebAssessment/Workflows/pentest"
mkdir -p "$CLAUDE_DIR/skills/Security/WebAssessment/Workflows/webapp"
mkdir -p "$CLAUDE_DIR/skills/Security/PromptInjection/Workflows"
mkdir -p "$CLAUDE_DIR/skills/Security/SECUpdates/Workflows"
mkdir -p "$CLAUDE_DIR/skills/Security/SECUpdates/State"
mkdir -p "$CLAUDE_DIR/skills/Security/AnnualReports/Tools"
echo "Created all skill directories"
```

**Mark todo as completed.**

### 4.2 Copy Skill Files

**Mark todo "Copy skill files" as in_progress.**

```bash
PACK_DIR="$(pwd)"
CLAUDE_DIR="$HOME/.claude"

# Copy entire src/ contents to target
cp -r "$PACK_DIR/src/"* "$CLAUDE_DIR/skills/Security/"
echo "Copied all Security skill files"

# Verify top-level SKILL.md
[ -f "$CLAUDE_DIR/skills/Security/SKILL.md" ] && echo "OK SKILL.md installed" || echo "ERROR SKILL.md missing"
```

**Mark todo as completed.**

---

## Phase 5: Verification

**Mark todo "Run verification" as in_progress.**

**Execute all checks from VERIFY.md:**

```bash
CLAUDE_DIR="$HOME/.claude"

echo "=== Security Skill Verification ==="

# Check top-level SKILL.md
echo "Checking top-level skill file..."
[ -f "$CLAUDE_DIR/skills/Security/SKILL.md" ] && echo "OK SKILL.md" || echo "MISSING SKILL.md"

# Check sub-domain SKILL.md files
echo "Checking sub-domain skill files..."
for subdir in Recon WebAssessment PromptInjection SECUpdates AnnualReports; do
  [ -f "$CLAUDE_DIR/skills/Security/$subdir/SKILL.md" ] && echo "OK $subdir/SKILL.md" || echo "MISSING $subdir/SKILL.md"
done

# Check key directories
echo "Checking directories..."
for dir in Recon/Tools Recon/Workflows Recon/Data WebAssessment/Workflows PromptInjection/Workflows SECUpdates/Workflows AnnualReports/Tools; do
  [ -d "$CLAUDE_DIR/skills/Security/$dir" ] && echo "OK $dir/" || echo "MISSING $dir/"
done

# Check frontmatter
echo "Checking frontmatter..."
head -1 "$CLAUDE_DIR/skills/Security/SKILL.md" | grep -q "^---" && echo "OK SKILL.md has valid frontmatter" || echo "ERROR SKILL.md missing frontmatter"

echo ""
echo "=== Verification Complete ==="
```

**Mark todo as completed when file checks pass.**

---

## Success/Failure Messages

### On Success

```
"Security v1.0.0 installed successfully!

What's available:
- Recon — 'do recon on example.com', 'passive recon on 10.0.0.0/24'
- WebAssessment — 'pentest this web app', 'create a threat model'
- PromptInjection — 'test this chatbot for prompt injection'
- SECUpdates — 'what's new in security?'
- AnnualReports — 'analyze the CrowdStrike annual report'

The skill routes automatically based on your request. Just describe what you need
and the Security skill handles the rest."
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

### Sub-domain not routing correctly

Check that the sub-domain's SKILL.md exists at the expected path (e.g., `~/.claude/skills/Security/Recon/SKILL.md`). The top-level SKILL.md routes based on keyword matching -- verify your request contains one of the trigger keywords listed in the routing table.

### Tools not executing

Some tools require external dependencies (e.g., nmap for port scanning, ffuf for fuzzing). The skill will tell you what is needed when it tries to invoke a tool that is not available.

---

## What's Included

| Directory | Purpose |
|-----------|---------|
| `src/SKILL.md` | Top-level router for all security sub-domains |
| `src/Recon/` | Network reconnaissance tools, workflows, and data |
| `src/WebAssessment/` | Web app security testing with fuzzing, OSINT, and automation |
| `src/PromptInjection/` | LLM prompt injection testing methodology and workflows |
| `src/SECUpdates/` | Security news aggregation from multiple sources |
| `src/AnnualReports/` | Annual vendor report fetching and analysis tools |

All files in `src/` are copied to `~/.claude/skills/Security/` during installation.
