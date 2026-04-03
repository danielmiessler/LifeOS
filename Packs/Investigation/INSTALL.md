# Investigation v1.0.0 - Installation Guide

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
"I'm installing Investigation v1.0.0 -- OSINT and people-finding with structured investigations across public sources.

This pack installs the Investigation skill, which includes:
- OSINT sub-skill with 279 cataloged sources and 7 investigation workflows
- PrivateInvestigator sub-skill with 5 people-finding workflows
- Ethical authorization framework

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

# Check if Investigation skill directory exists
if [ -d "$CLAUDE_DIR/skills/Investigation" ]; then
  echo "WARNING Existing Investigation skill found at: $CLAUDE_DIR/skills/Investigation"
  ls -la "$CLAUDE_DIR/skills/Investigation/" 2>/dev/null
else
  echo "OK No existing Investigation skill (clean install)"
fi

# Check for skills directory
if [ -d "$CLAUDE_DIR/skills" ]; then
  echo "OK Skills directory exists at: $CLAUDE_DIR/skills"
else
  echo "INFO Skills directory does not exist (will be created)"
fi

# Check for OSINT subdirectory specifically
if [ -d "$CLAUDE_DIR/skills/Investigation/OSINT" ]; then
  echo "WARNING Existing OSINT sub-skill found"
  ls -la "$CLAUDE_DIR/skills/Investigation/OSINT/" 2>/dev/null
else
  echo "OK No existing OSINT sub-skill"
fi

# Check for PrivateInvestigator subdirectory
if [ -d "$CLAUDE_DIR/skills/Investigation/PrivateInvestigator" ]; then
  echo "WARNING Existing PrivateInvestigator sub-skill found"
  ls -la "$CLAUDE_DIR/skills/Investigation/PrivateInvestigator/" 2>/dev/null
else
  echo "OK No existing PrivateInvestigator sub-skill"
fi

# Check for user customization directories
if [ -d "$CLAUDE_DIR/PAI/USER/SKILLCUSTOMIZATIONS/OSINT" ]; then
  echo "OK OSINT user customizations found (will be preserved)"
else
  echo "INFO No OSINT user customizations found"
fi

if [ -d "$CLAUDE_DIR/PAI/USER/SKILLCUSTOMIZATIONS/PrivateInvestigator" ]; then
  echo "OK PrivateInvestigator user customizations found (will be preserved)"
else
  echo "INFO No PrivateInvestigator user customizations found"
fi

# Check for Research skill (enhances parallel agent deployment)
if [ -d "$CLAUDE_DIR/skills/Research" ]; then
  echo "OK Research skill found (parallel agent deployment available)"
else
  echo "INFO Research skill not found (investigation still works, parallel deployment enhanced by it)"
fi
```

### 1.2 Present Findings

Tell the user what you found:
```
"Here's what I found on your system:
- Skills directory: [exists / will be created]
- Existing Investigation skill: [found -- will ask about conflict / not found]
- OSINT sub-skill: [found / not found]
- PrivateInvestigator sub-skill: [found / not found]
- User customizations: [found (will be preserved) / not found]
- Research skill: [found (parallel deployment enhanced) / not found (still works)]

[If Research skill not found]: Note: The Investigation skill can deploy parallel
research agents through PAI's Research skill. Without it, investigations still
work but may use fewer parallel threads."
```

---

## Phase 2: User Questions

**Use AskUserQuestion tool at each decision point.**

### Question 1: Conflict Resolution (if existing skill found)

**Only ask if existing Investigation skill detected:**

```json
{
  "header": "Conflict -- Existing Investigation Skill",
  "question": "An existing Investigation skill was found. How should I proceed?",
  "multiSelect": false,
  "options": [
    {"label": "Backup and Replace (Recommended)", "description": "Creates timestamped backup of existing skill directory, then installs new version"},
    {"label": "Replace Without Backup", "description": "Overwrites existing skill directory without backup"},
    {"label": "Abort Installation", "description": "Cancel installation, keep existing skill"}
  ]
}
```

### Question 2: Sub-Skill Selection

```json
{
  "header": "Sub-Skills",
  "question": "Which investigation sub-skills would you like to install?",
  "multiSelect": false,
  "options": [
    {"label": "Both OSINT and PrivateInvestigator (Recommended)", "description": "Full investigation capability: company intel, people search, domain recon, due diligence"},
    {"label": "OSINT only", "description": "Company, entity, domain, and organization investigations"},
    {"label": "PrivateInvestigator only", "description": "People-finding, social media search, reverse lookups"}
  ]
}
```

### Question 3: Final Confirmation

```json
{
  "header": "Install",
  "question": "Ready to install Investigation v1.0.0?",
  "multiSelect": false,
  "options": [
    {"label": "Yes, install now (Recommended)", "description": "Copies skill files to ~/.claude/skills/Investigation/"},
    {"label": "Show me what will change", "description": "Lists all files and directories that will be created"},
    {"label": "Cancel", "description": "Abort installation"}
  ]
}
```

**If user chose "Show me what will change":**
```
"Files and directories to be created:
- ~/.claude/skills/Investigation/SKILL.md (top-level routing)

OSINT sub-skill (if selected):
- ~/.claude/skills/Investigation/OSINT/SKILL.md (OSINT skill definition)
- ~/.claude/skills/Investigation/OSINT/SOURCES.JSON (279 cataloged sources)
- ~/.claude/skills/Investigation/OSINT/SOURCES.md (human-readable source reference)
- ~/.claude/skills/Investigation/OSINT/EthicalFramework.md (authorization framework)
- ~/.claude/skills/Investigation/OSINT/Methodology.md (collection and reporting standards)
- ~/.claude/skills/Investigation/OSINT/PeopleTools.md (people search reference)
- ~/.claude/skills/Investigation/OSINT/CompanyTools.md (business database reference)
- ~/.claude/skills/Investigation/OSINT/EntityTools.md (threat intel reference)
- ~/.claude/skills/Investigation/OSINT/Workflows/ (7 investigation workflows)

PrivateInvestigator sub-skill (if selected):
- ~/.claude/skills/Investigation/PrivateInvestigator/SKILL.md (PI skill definition)
- ~/.claude/skills/Investigation/PrivateInvestigator/Workflows/ (5 people-finding workflows)

No other files will be modified. User customizations are never touched."
```

Then re-ask the final confirmation question.

---

## Phase 3: Backup (If Needed)

**Only execute if user chose "Backup and Replace":**

```bash
CLAUDE_DIR="$HOME/.claude"
BACKUP_DIR="$CLAUDE_DIR/Backups/investigation-skill-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup existing skill directory
if [ -d "$CLAUDE_DIR/skills/Investigation" ]; then
  cp -r "$CLAUDE_DIR/skills/Investigation" "$BACKUP_DIR/Investigation"
  echo "Backed up Investigation skill to: $BACKUP_DIR/Investigation"
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
    {"content": "Copy OSINT sub-skill files", "status": "pending", "activeForm": "Copying OSINT files"},
    {"content": "Copy PrivateInvestigator sub-skill files", "status": "pending", "activeForm": "Copying PrivateInvestigator files"},
    {"content": "Run verification", "status": "pending", "activeForm": "Running verification"}
  ]
}
```

### 4.1 Create Skill Directory Structure

**Mark todo "Create skill directory structure" as in_progress.**

```bash
CLAUDE_DIR="$HOME/.claude"
mkdir -p "$CLAUDE_DIR/skills/Investigation"
mkdir -p "$CLAUDE_DIR/skills/Investigation/OSINT"
mkdir -p "$CLAUDE_DIR/skills/Investigation/OSINT/Workflows"
mkdir -p "$CLAUDE_DIR/skills/Investigation/PrivateInvestigator"
mkdir -p "$CLAUDE_DIR/skills/Investigation/PrivateInvestigator/Workflows"
echo "Created Investigation skill directory structure"
```

**Mark todo as completed.**

### 4.2 Copy Top-Level and OSINT Files

**Mark todo "Copy OSINT sub-skill files" as in_progress.**

**Skip this step if user chose "PrivateInvestigator only".**

```bash
PACK_DIR="$(pwd)"
CLAUDE_DIR="$HOME/.claude"

# Copy top-level skill definition
cp "$PACK_DIR/src/SKILL.md" "$CLAUDE_DIR/skills/Investigation/SKILL.md"

# Copy OSINT sub-skill
cp "$PACK_DIR/src/OSINT/SKILL.md" "$CLAUDE_DIR/skills/Investigation/OSINT/SKILL.md"
cp "$PACK_DIR/src/OSINT/SOURCES.JSON" "$CLAUDE_DIR/skills/Investigation/OSINT/SOURCES.JSON"
cp "$PACK_DIR/src/OSINT/SOURCES.md" "$CLAUDE_DIR/skills/Investigation/OSINT/SOURCES.md"
cp "$PACK_DIR/src/OSINT/EthicalFramework.md" "$CLAUDE_DIR/skills/Investigation/OSINT/EthicalFramework.md"
cp "$PACK_DIR/src/OSINT/Methodology.md" "$CLAUDE_DIR/skills/Investigation/OSINT/Methodology.md"
cp "$PACK_DIR/src/OSINT/PeopleTools.md" "$CLAUDE_DIR/skills/Investigation/OSINT/PeopleTools.md"
cp "$PACK_DIR/src/OSINT/CompanyTools.md" "$CLAUDE_DIR/skills/Investigation/OSINT/CompanyTools.md"
cp "$PACK_DIR/src/OSINT/EntityTools.md" "$CLAUDE_DIR/skills/Investigation/OSINT/EntityTools.md"
cp "$PACK_DIR/src/OSINT/Workflows/PeopleLookup.md" "$CLAUDE_DIR/skills/Investigation/OSINT/Workflows/PeopleLookup.md"
cp "$PACK_DIR/src/OSINT/Workflows/CompanyLookup.md" "$CLAUDE_DIR/skills/Investigation/OSINT/Workflows/CompanyLookup.md"
cp "$PACK_DIR/src/OSINT/Workflows/CompanyDueDiligence.md" "$CLAUDE_DIR/skills/Investigation/OSINT/Workflows/CompanyDueDiligence.md"
cp "$PACK_DIR/src/OSINT/Workflows/EntityLookup.md" "$CLAUDE_DIR/skills/Investigation/OSINT/Workflows/EntityLookup.md"
cp "$PACK_DIR/src/OSINT/Workflows/DomainLookup.md" "$CLAUDE_DIR/skills/Investigation/OSINT/Workflows/DomainLookup.md"
cp "$PACK_DIR/src/OSINT/Workflows/OrganizationLookup.md" "$CLAUDE_DIR/skills/Investigation/OSINT/Workflows/OrganizationLookup.md"
cp "$PACK_DIR/src/OSINT/Workflows/DiscoverOSINTSources.md" "$CLAUDE_DIR/skills/Investigation/OSINT/Workflows/DiscoverOSINTSources.md"

echo "Copied OSINT sub-skill files"
```

**Mark todo as completed.**

### 4.3 Copy PrivateInvestigator Files

**Mark todo "Copy PrivateInvestigator sub-skill files" as in_progress.**

**Skip this step if user chose "OSINT only".**

```bash
PACK_DIR="$(pwd)"
CLAUDE_DIR="$HOME/.claude"

# Copy top-level skill definition (if not already copied in 4.2)
cp "$PACK_DIR/src/SKILL.md" "$CLAUDE_DIR/skills/Investigation/SKILL.md"

# Copy PrivateInvestigator sub-skill
cp "$PACK_DIR/src/PrivateInvestigator/SKILL.md" "$CLAUDE_DIR/skills/Investigation/PrivateInvestigator/SKILL.md"
cp "$PACK_DIR/src/PrivateInvestigator/Workflows/FindPerson.md" "$CLAUDE_DIR/skills/Investigation/PrivateInvestigator/Workflows/FindPerson.md"
cp "$PACK_DIR/src/PrivateInvestigator/Workflows/SocialMediaSearch.md" "$CLAUDE_DIR/skills/Investigation/PrivateInvestigator/Workflows/SocialMediaSearch.md"
cp "$PACK_DIR/src/PrivateInvestigator/Workflows/PublicRecordsSearch.md" "$CLAUDE_DIR/skills/Investigation/PrivateInvestigator/Workflows/PublicRecordsSearch.md"
cp "$PACK_DIR/src/PrivateInvestigator/Workflows/ReverseLookup.md" "$CLAUDE_DIR/skills/Investigation/PrivateInvestigator/Workflows/ReverseLookup.md"
cp "$PACK_DIR/src/PrivateInvestigator/Workflows/VerifyIdentity.md" "$CLAUDE_DIR/skills/Investigation/PrivateInvestigator/Workflows/VerifyIdentity.md"

echo "Copied PrivateInvestigator sub-skill files"
```

**Mark todo as completed.**

---

## Phase 5: Verification

**Mark todo "Run verification" as in_progress.**

**Execute all checks from VERIFY.md:**

```bash
CLAUDE_DIR="$HOME/.claude"

echo "=== Investigation Skill Verification ==="

# Check top-level SKILL.md
echo "Checking skill definition..."
[ -f "$CLAUDE_DIR/skills/Investigation/SKILL.md" ] && echo "OK SKILL.md installed" || echo "ERROR SKILL.md missing"

# Check OSINT sub-skill
echo "Checking OSINT sub-skill..."
[ -d "$CLAUDE_DIR/skills/Investigation/OSINT" ] && echo "OK OSINT/ directory exists" || echo "SKIP OSINT/ not installed"
[ -f "$CLAUDE_DIR/skills/Investigation/OSINT/SKILL.md" ] && echo "OK OSINT SKILL.md installed" || echo "SKIP OSINT SKILL.md not installed"
[ -f "$CLAUDE_DIR/skills/Investigation/OSINT/SOURCES.JSON" ] && echo "OK SOURCES.JSON installed" || echo "SKIP SOURCES.JSON not installed"
[ -f "$CLAUDE_DIR/skills/Investigation/OSINT/EthicalFramework.md" ] && echo "OK EthicalFramework.md installed" || echo "SKIP EthicalFramework.md not installed"
[ -d "$CLAUDE_DIR/skills/Investigation/OSINT/Workflows" ] && echo "OK OSINT/Workflows/ directory exists" || echo "SKIP OSINT/Workflows/ not installed"

# Count OSINT workflows
if [ -d "$CLAUDE_DIR/skills/Investigation/OSINT/Workflows" ]; then
  OSINT_WF=$(ls -1 "$CLAUDE_DIR/skills/Investigation/OSINT/Workflows/"*.md 2>/dev/null | wc -l | tr -d ' ')
  echo "OK $OSINT_WF OSINT workflow(s) installed (expected 7)"
fi

# Check PrivateInvestigator sub-skill
echo "Checking PrivateInvestigator sub-skill..."
[ -d "$CLAUDE_DIR/skills/Investigation/PrivateInvestigator" ] && echo "OK PrivateInvestigator/ directory exists" || echo "SKIP PrivateInvestigator/ not installed"
[ -f "$CLAUDE_DIR/skills/Investigation/PrivateInvestigator/SKILL.md" ] && echo "OK PI SKILL.md installed" || echo "SKIP PI SKILL.md not installed"
[ -d "$CLAUDE_DIR/skills/Investigation/PrivateInvestigator/Workflows" ] && echo "OK PI/Workflows/ directory exists" || echo "SKIP PI/Workflows/ not installed"

# Count PI workflows
if [ -d "$CLAUDE_DIR/skills/Investigation/PrivateInvestigator/Workflows" ]; then
  PI_WF=$(ls -1 "$CLAUDE_DIR/skills/Investigation/PrivateInvestigator/Workflows/"*.md 2>/dev/null | wc -l | tr -d ' ')
  echo "OK $PI_WF PrivateInvestigator workflow(s) installed (expected 5)"
fi

# Check frontmatter
echo "Checking frontmatter..."
head -1 "$CLAUDE_DIR/skills/Investigation/SKILL.md" | grep -q "^---" && echo "OK SKILL.md has valid frontmatter" || echo "ERROR SKILL.md missing frontmatter"

# Informational checks
echo ""
echo "Enhancement availability (informational):"
[ -d "$CLAUDE_DIR/skills/Research" ] && echo "  AVAILABLE Research skill (parallel agent deployment)" || echo "  INFO Research skill not found (investigations still work)"
[ -d "$CLAUDE_DIR/PAI/USER/SKILLCUSTOMIZATIONS/OSINT" ] && echo "  AVAILABLE OSINT user customizations" || echo "  INFO No OSINT user customizations"
[ -d "$CLAUDE_DIR/PAI/USER/SKILLCUSTOMIZATIONS/PrivateInvestigator" ] && echo "  AVAILABLE PI user customizations" || echo "  INFO No PI user customizations"

echo ""
echo "=== Verification Complete ==="
```

**Mark todo as completed when all file checks pass.**

---

## Success/Failure Messages

### On Success

```
"Investigation v1.0.0 installed successfully!

What's available:
- OSINT investigations: people, company, due diligence, entity, domain, organization
- People-finding: full investigation, social media, public records, reverse lookup, verification
- 279 cataloged OSINT sources across 8 categories
- Ethical authorization framework at every step

Try it now:
- 'do OSINT on [company name]'
- 'due diligence on [company]'
- 'find [person name] from [context]'
- 'reverse lookup [phone/email]'

Customization: Add preferences at:
  ~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/OSINT/
  ~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/PrivateInvestigator/"
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

### OSINT skill not finding sources

Ensure SOURCES.JSON was properly copied:
```bash
[ -f ~/.claude/skills/Investigation/OSINT/SOURCES.JSON ] && echo "OK" || echo "MISSING"
```

### Parallel agents not deploying

The Investigation skill deploys parallel research agents through PAI's Research skill. If Research is not installed, investigations still work but may use fewer simultaneous threads. Check:
```bash
[ -d ~/.claude/skills/Research ] && echo "Research skill available" || echo "Research skill not found"
```

### Ethical framework blocking investigations

The ethical authorization framework is intentional. Before any investigation, you must confirm:
1. Explicit authorization from the client
2. Clear scope definition
3. Legal compliance
4. Documentation in place

See `OSINT/EthicalFramework.md` for complete requirements.

### PrivateInvestigator not routing correctly

Ensure both the top-level SKILL.md and PrivateInvestigator/SKILL.md are installed. The top-level file routes requests between OSINT and PrivateInvestigator based on trigger patterns.

---

## What's Included

| File | Purpose |
|------|---------|
| `src/SKILL.md` | Top-level routing between OSINT and PrivateInvestigator |
| `src/OSINT/SKILL.md` | OSINT skill definition and workflow routing |
| `src/OSINT/SOURCES.JSON` | 279 cataloged OSINT sources |
| `src/OSINT/SOURCES.md` | Human-readable source reference |
| `src/OSINT/EthicalFramework.md` | Authorization and ethical boundaries |
| `src/OSINT/Methodology.md` | Collection and reporting standards |
| `src/OSINT/*Tools.md` | Three tool reference files (People, Company, Entity) |
| `src/OSINT/Workflows/*.md` | Seven OSINT investigation workflows |
| `src/PrivateInvestigator/SKILL.md` | People-finding skill definition |
| `src/PrivateInvestigator/Workflows/*.md` | Five people-finding workflows |
