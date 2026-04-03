# Agents v1.0.0 - Installation Guide

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
"I'm installing Agents v1.0.0 -- custom agent composition from traits, voices, and personalities.

This pack installs the Agents skill, which includes:
- Dynamic agent composition from a trait library
- Voice assignment with prosody control
- Parallel agent orchestration
- Persistent named agents

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

# Check if Agents skill directory exists
if [ -d "$CLAUDE_DIR/skills/Agents" ]; then
  echo "WARNING Existing Agents skill found at: $CLAUDE_DIR/skills/Agents"
  ls -la "$CLAUDE_DIR/skills/Agents/" 2>/dev/null
else
  echo "OK No existing Agents skill (clean install)"
fi

# Check for skills directory
if [ -d "$CLAUDE_DIR/skills" ]; then
  echo "OK Skills directory exists at: $CLAUDE_DIR/skills"
else
  echo "INFO Skills directory does not exist (will be created)"
fi

# Check for user customization directory
if [ -d "$CLAUDE_DIR/PAI/USER/SKILLCUSTOMIZATIONS/Agents" ]; then
  echo "OK User customizations found (will be preserved)"
  ls -la "$CLAUDE_DIR/PAI/USER/SKILLCUSTOMIZATIONS/Agents/" 2>/dev/null
else
  echo "INFO No user customizations found (none to preserve)"
fi

# Check for Bun runtime (required for TypeScript tools)
if command -v bun &> /dev/null; then
  echo "OK Bun runtime available: $(bun --version)"
else
  echo "WARNING Bun runtime not found (required for ComposeAgent.ts and other tools)"
  echo "  Install with: curl -fsSL https://bun.sh/install | bash"
fi

# Check for existing tool dependencies
if [ -f "$CLAUDE_DIR/skills/Agents/Tools/node_modules/.package-lock.json" ] || [ -d "$CLAUDE_DIR/skills/Agents/Tools/node_modules" ]; then
  echo "OK Existing tool dependencies found"
else
  echo "INFO Tool dependencies will need to be installed after copy"
fi
```

### 1.2 Present Findings

Tell the user what you found:
```
"Here's what I found on your system:
- Skills directory: [exists / will be created]
- Existing Agents skill: [found -- will ask about conflict / not found]
- User customizations: [found (will be preserved) / not found]
- Bun runtime: [available / not found -- needed for TypeScript tools]

[If Bun not found]: Note: The Agents skill includes TypeScript tools that require Bun.
Install it with: curl -fsSL https://bun.sh/install | bash"
```

---

## Phase 2: User Questions

**Use AskUserQuestion tool at each decision point.**

### Question 1: Conflict Resolution (if existing skill found)

**Only ask if existing Agents skill detected:**

```json
{
  "header": "Conflict -- Existing Agents Skill",
  "question": "An existing Agents skill was found. How should I proceed?",
  "multiSelect": false,
  "options": [
    {"label": "Backup and Replace (Recommended)", "description": "Creates timestamped backup of existing skill directory, then installs new version"},
    {"label": "Replace Without Backup", "description": "Overwrites existing skill directory without backup"},
    {"label": "Abort Installation", "description": "Cancel installation, keep existing skill"}
  ]
}
```

### Question 2: Install Tool Dependencies

```json
{
  "header": "Tool Dependencies",
  "question": "The Agents skill includes TypeScript tools that need dependencies installed. Install them now?",
  "multiSelect": false,
  "options": [
    {"label": "Yes, install dependencies (Recommended)", "description": "Runs 'bun install' in the Tools directory after copying files"},
    {"label": "Skip for now", "description": "Copy files only, install dependencies manually later"}
  ]
}
```

### Question 3: Final Confirmation

```json
{
  "header": "Install",
  "question": "Ready to install Agents v1.0.0?",
  "multiSelect": false,
  "options": [
    {"label": "Yes, install now (Recommended)", "description": "Copies skill files to ~/.claude/skills/Agents/"},
    {"label": "Show me what will change", "description": "Lists all files and directories that will be created"},
    {"label": "Cancel", "description": "Abort installation"}
  ]
}
```

**If user chose "Show me what will change":**
```
"Files and directories to be created:
- ~/.claude/skills/Agents/SKILL.md (skill definition and routing)
- ~/.claude/skills/Agents/Data/Traits.yaml (trait library)
- ~/.claude/skills/Agents/Tools/ComposeAgent.ts (composition engine)
- ~/.claude/skills/Agents/Tools/LoadAgentContext.ts (context loader)
- ~/.claude/skills/Agents/Tools/SpawnAgentWithProfile.ts (agent launcher)
- ~/.claude/skills/Agents/Tools/package.json (tool dependencies)
- ~/.claude/skills/Agents/Tools/bun.lock (dependency lockfile)
- ~/.claude/skills/Agents/Templates/DynamicAgent.hbs (prompt template)
- ~/.claude/skills/Agents/Templates/CUSTOMAGENTTEMPLATE.md (custom agent template)
- ~/.claude/skills/Agents/Workflows/CreateCustomAgent.md (composition workflow)
- ~/.claude/skills/Agents/Workflows/ListTraits.md (trait listing workflow)
- ~/.claude/skills/Agents/Workflows/SpawnParallelAgents.md (parallel launch workflow)
- ~/.claude/skills/Agents/AgentPersonalities.md (personality definitions)
- ~/.claude/skills/Agents/AgentProfileSystem.md (profile architecture)
- ~/.claude/skills/Agents/*Context.md (8 agent context files)
- ~/.claude/skills/Agents/Scratchpad/ (working notes)

No other files will be modified. User customizations at
~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/Agents/ are never touched."
```

Then re-ask the final confirmation question.

---

## Phase 3: Backup (If Needed)

**Only execute if user chose "Backup and Replace":**

```bash
CLAUDE_DIR="$HOME/.claude"
BACKUP_DIR="$CLAUDE_DIR/Backups/agents-skill-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup existing skill directory
if [ -d "$CLAUDE_DIR/skills/Agents" ]; then
  cp -r "$CLAUDE_DIR/skills/Agents" "$BACKUP_DIR/Agents"
  echo "Backed up Agents skill to: $BACKUP_DIR/Agents"
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
    {"content": "Install tool dependencies", "status": "pending", "activeForm": "Installing tool dependencies"},
    {"content": "Run verification", "status": "pending", "activeForm": "Running verification"}
  ]
}
```

### 4.1 Create Skill Directory Structure

**Mark todo "Create skill directory structure" as in_progress.**

```bash
CLAUDE_DIR="$HOME/.claude"
mkdir -p "$CLAUDE_DIR/skills/Agents"
mkdir -p "$CLAUDE_DIR/skills/Agents/Data"
mkdir -p "$CLAUDE_DIR/skills/Agents/Tools"
mkdir -p "$CLAUDE_DIR/skills/Agents/Templates"
mkdir -p "$CLAUDE_DIR/skills/Agents/Workflows"
mkdir -p "$CLAUDE_DIR/skills/Agents/Scratchpad"
echo "Created Agents skill directory structure"
```

**Mark todo as completed.**

### 4.2 Copy Skill Files

**Mark todo "Copy skill files" as in_progress.**

```bash
PACK_DIR="$(pwd)"
CLAUDE_DIR="$HOME/.claude"

# Copy all files from src/ to skill directory
cp "$PACK_DIR/src/SKILL.md" "$CLAUDE_DIR/skills/Agents/SKILL.md"
cp "$PACK_DIR/src/Data/Traits.yaml" "$CLAUDE_DIR/skills/Agents/Data/Traits.yaml"
cp "$PACK_DIR/src/Tools/ComposeAgent.ts" "$CLAUDE_DIR/skills/Agents/Tools/ComposeAgent.ts"
cp "$PACK_DIR/src/Tools/LoadAgentContext.ts" "$CLAUDE_DIR/skills/Agents/Tools/LoadAgentContext.ts"
cp "$PACK_DIR/src/Tools/SpawnAgentWithProfile.ts" "$CLAUDE_DIR/skills/Agents/Tools/SpawnAgentWithProfile.ts"
cp "$PACK_DIR/src/Tools/package.json" "$CLAUDE_DIR/skills/Agents/Tools/package.json"
cp "$PACK_DIR/src/Tools/bun.lock" "$CLAUDE_DIR/skills/Agents/Tools/bun.lock"
cp "$PACK_DIR/src/Templates/DynamicAgent.hbs" "$CLAUDE_DIR/skills/Agents/Templates/DynamicAgent.hbs"
cp "$PACK_DIR/src/Templates/CUSTOMAGENTTEMPLATE.md" "$CLAUDE_DIR/skills/Agents/Templates/CUSTOMAGENTTEMPLATE.md"
cp "$PACK_DIR/src/Workflows/CreateCustomAgent.md" "$CLAUDE_DIR/skills/Agents/Workflows/CreateCustomAgent.md"
cp "$PACK_DIR/src/Workflows/ListTraits.md" "$CLAUDE_DIR/skills/Agents/Workflows/ListTraits.md"
cp "$PACK_DIR/src/Workflows/SpawnParallelAgents.md" "$CLAUDE_DIR/skills/Agents/Workflows/SpawnParallelAgents.md"
cp "$PACK_DIR/src/AgentPersonalities.md" "$CLAUDE_DIR/skills/Agents/AgentPersonalities.md"
cp "$PACK_DIR/src/AgentProfileSystem.md" "$CLAUDE_DIR/skills/Agents/AgentProfileSystem.md"
cp "$PACK_DIR/src/ArchitectContext.md" "$CLAUDE_DIR/skills/Agents/ArchitectContext.md"
cp "$PACK_DIR/src/ArtistContext.md" "$CLAUDE_DIR/skills/Agents/ArtistContext.md"
cp "$PACK_DIR/src/ClaudeResearcherContext.md" "$CLAUDE_DIR/skills/Agents/ClaudeResearcherContext.md"
cp "$PACK_DIR/src/CodexResearcherContext.md" "$CLAUDE_DIR/skills/Agents/CodexResearcherContext.md"
cp "$PACK_DIR/src/DesignerContext.md" "$CLAUDE_DIR/skills/Agents/DesignerContext.md"
cp "$PACK_DIR/src/EngineerContext.md" "$CLAUDE_DIR/skills/Agents/EngineerContext.md"
cp "$PACK_DIR/src/GeminiResearcherContext.md" "$CLAUDE_DIR/skills/Agents/GeminiResearcherContext.md"
cp "$PACK_DIR/src/GrokResearcherContext.md" "$CLAUDE_DIR/skills/Agents/GrokResearcherContext.md"
cp "$PACK_DIR/src/PerplexityResearcherContext.md" "$CLAUDE_DIR/skills/Agents/PerplexityResearcherContext.md"
cp "$PACK_DIR/src/QATesterContext.md" "$CLAUDE_DIR/skills/Agents/QATesterContext.md"
cp "$PACK_DIR/src/REDESIGN-SUMMARY.md" "$CLAUDE_DIR/skills/Agents/REDESIGN-SUMMARY.md"
cp -r "$PACK_DIR/src/Scratchpad/" "$CLAUDE_DIR/skills/Agents/Scratchpad/"

echo "Copied all Agents skill files"
```

**Mark todo as completed.**

### 4.3 Install Tool Dependencies

**Mark todo "Install tool dependencies" as in_progress.**

**Only execute if user approved dependency installation:**

```bash
CLAUDE_DIR="$HOME/.claude"
cd "$CLAUDE_DIR/skills/Agents/Tools" && bun install
echo "Tool dependencies installed"
```

**If user chose "Skip for now":**
```
"Skipped dependency installation. To install later, run:
  cd ~/.claude/skills/Agents/Tools && bun install"
```

**Mark todo as completed.**

---

## Phase 5: Verification

**Mark todo "Run verification" as in_progress.**

**Execute all checks from VERIFY.md:**

```bash
CLAUDE_DIR="$HOME/.claude"

echo "=== Agents Skill Verification ==="

# Check SKILL.md exists
echo "Checking skill definition..."
[ -f "$CLAUDE_DIR/skills/Agents/SKILL.md" ] && echo "OK SKILL.md installed" || echo "ERROR SKILL.md missing"

# Check directories exist
echo "Checking directories..."
[ -d "$CLAUDE_DIR/skills/Agents/Data" ] && echo "OK Data/ directory exists" || echo "ERROR Data/ missing"
[ -d "$CLAUDE_DIR/skills/Agents/Tools" ] && echo "OK Tools/ directory exists" || echo "ERROR Tools/ missing"
[ -d "$CLAUDE_DIR/skills/Agents/Templates" ] && echo "OK Templates/ directory exists" || echo "ERROR Templates/ missing"
[ -d "$CLAUDE_DIR/skills/Agents/Workflows" ] && echo "OK Workflows/ directory exists" || echo "ERROR Workflows/ missing"

# Check key files
echo "Checking key files..."
[ -f "$CLAUDE_DIR/skills/Agents/Data/Traits.yaml" ] && echo "OK Traits.yaml installed" || echo "ERROR Traits.yaml missing"
[ -f "$CLAUDE_DIR/skills/Agents/Tools/ComposeAgent.ts" ] && echo "OK ComposeAgent.ts installed" || echo "ERROR ComposeAgent.ts missing"
[ -f "$CLAUDE_DIR/skills/Agents/Templates/DynamicAgent.hbs" ] && echo "OK DynamicAgent.hbs installed" || echo "ERROR DynamicAgent.hbs missing"

# Check workflows
echo "Checking workflows..."
[ -f "$CLAUDE_DIR/skills/Agents/Workflows/CreateCustomAgent.md" ] && echo "OK CreateCustomAgent workflow" || echo "ERROR CreateCustomAgent missing"
[ -f "$CLAUDE_DIR/skills/Agents/Workflows/ListTraits.md" ] && echo "OK ListTraits workflow" || echo "ERROR ListTraits missing"
[ -f "$CLAUDE_DIR/skills/Agents/Workflows/SpawnParallelAgents.md" ] && echo "OK SpawnParallelAgents workflow" || echo "ERROR SpawnParallelAgents missing"

# Check frontmatter
echo "Checking frontmatter..."
head -1 "$CLAUDE_DIR/skills/Agents/SKILL.md" | grep -q "^---" && echo "OK SKILL.md has valid frontmatter" || echo "ERROR SKILL.md missing frontmatter"

echo ""
echo "=== Verification Complete ==="
```

**Mark todo as completed when all file checks pass.**

---

## Success/Failure Messages

### On Success

```
"Agents v1.0.0 installed successfully!

What's available:
- Custom agent composition from traits (expertise + personality + approach)
- Voice assignment with prosody control
- Parallel agent orchestration
- Persistent named agents with save/load

Try it now:
- 'Spin up 3 custom security agents'
- 'What agent traits are available?'
- 'Create a custom agent for code review'

Customization: Add your own traits, voices, and named agents at:
  ~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/Agents/"
```

### On Failure

```
"Installation encountered issues. Here's what to check:

1. Ensure ~/.claude/ directory exists (created by Claude Code)
2. Check write permissions on ~/.claude/skills/
3. Ensure Bun is installed for TypeScript tools: curl -fsSL https://bun.sh/install | bash
4. Run the verification commands in VERIFY.md

Need help? Open an issue at https://github.com/danielmiessler/Personal_AI_Infrastructure/issues"
```

---

## Troubleshooting

### ComposeAgent.ts fails to run

Ensure Bun is installed: `bun --version`. If not, install with:
```bash
curl -fsSL https://bun.sh/install | bash
```

Then install dependencies:
```bash
cd ~/.claude/skills/Agents/Tools && bun install
```

### Agents have no voice

Voice output requires a running ElevenLabs voice server at localhost:8888. Without it, agents still work -- they just produce text output without audio.

### Custom traits not appearing

User customizations must be placed in:
```
~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/Agents/Traits.yaml
```

The composition engine merges this with the base `Data/Traits.yaml` at runtime.

---

## What's Included

| File | Purpose |
|------|---------|
| `src/SKILL.md` | Skill definition, workflow routing, configuration docs |
| `src/Data/Traits.yaml` | Base trait library |
| `src/Tools/ComposeAgent.ts` | Agent composition engine |
| `src/Tools/LoadAgentContext.ts` | Agent context loader |
| `src/Tools/SpawnAgentWithProfile.ts` | Agent launcher |
| `src/Templates/DynamicAgent.hbs` | Dynamic prompt template |
| `src/Templates/CUSTOMAGENTTEMPLATE.md` | Custom agent definition template |
| `src/Workflows/*.md` | Three workflow definitions |
| `src/*Context.md` | Eight agent context definitions |
| `src/AgentPersonalities.md` | Personality definitions |
| `src/AgentProfileSystem.md` | Profile architecture |
