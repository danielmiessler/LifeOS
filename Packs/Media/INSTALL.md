# Media v1.0.0 - Installation Guide

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
"I'm installing Media v1.0.0 — visual and video content creation for Claude Code.

This pack adds the Media skill with two subsystems:
- Art — illustrations, diagrams, infographics, thumbnails, and more (20 workflows)
- Remotion — programmatic video creation with React

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

# Check for existing Media skill
if [ -d "$CLAUDE_DIR/skills/Media" ]; then
  echo "WARNING Existing Media skill found at: $CLAUDE_DIR/skills/Media"
  ls -la "$CLAUDE_DIR/skills/Media/" 2>/dev/null
else
  echo "OK No existing Media skill (clean install)"
fi

# Check for Art subdirectory
if [ -d "$CLAUDE_DIR/skills/Media/Art" ]; then
  echo "WARNING Existing Art subsystem found"
else
  echo "OK No existing Art subsystem"
fi

# Check for Remotion subdirectory
if [ -d "$CLAUDE_DIR/skills/Media/Remotion" ]; then
  echo "WARNING Existing Remotion subsystem found"
else
  echo "OK No existing Remotion subsystem"
fi

# Check for bun runtime (required for TypeScript tools)
if command -v bun &>/dev/null; then
  echo "OK bun runtime found: $(bun --version)"
else
  echo "WARNING bun not found (required for image generation and video rendering tools)"
fi

# Check for PAI environment file (API keys)
PAI_DIR="$HOME/Projects/PAI"
if [ -f "$PAI_DIR/.env" ]; then
  echo "OK PAI .env file found (API keys available)"
else
  echo "INFO PAI .env not found (you will need API keys for image generation models)"
fi

# Check for user customizations
if [ -d "$CLAUDE_DIR/PAI/USER/SKILLCUSTOMIZATIONS/Art" ]; then
  echo "OK Art customizations found"
else
  echo "INFO No Art customizations (skill will use defaults)"
fi

if [ -d "$CLAUDE_DIR/PAI/USER/SKILLCUSTOMIZATIONS/Remotion" ]; then
  echo "OK Remotion customizations found"
else
  echo "INFO No Remotion customizations (skill will use defaults)"
fi
```

### 1.2 Present Findings

Tell the user what you found:
```
"Here's what I found on your system:
- Skills directory: [exists / will be created]
- Existing Media skill: [found -- will ask about conflict / not found]
- bun runtime: [found (version) / not found -- needed for tools]
- PAI .env: [found / not found -- needed for API keys]
- Art customizations: [found / not found]
- Remotion customizations: [found / not found]

[If bun not found]: Note: The Media skill's TypeScript tools (image generation,
video rendering, thumbnail composition) require bun. Install it with:
curl -fsSL https://bun.sh/install | bash

[If .env not found]: Note: Image generation requires API keys for at least one
backend (Gemini, Flux, OpenAI, Midjourney). These are configured in the PAI .env file."
```

---

## Phase 2: User Questions

**Use AskUserQuestion tool at each decision point.**

### Question 1: Conflict Resolution (if existing skill found)

**Only ask if existing Media skill detected:**

```json
{
  "header": "Conflict -- Existing Media Skill",
  "question": "An existing Media skill was found. How should I proceed?",
  "multiSelect": false,
  "options": [
    {"label": "Backup and Replace (Recommended)", "description": "Creates timestamped backup of existing skill, then installs new version"},
    {"label": "Replace Without Backup", "description": "Overwrites existing skill without backup"},
    {"label": "Abort Installation", "description": "Cancel installation, keep existing skill"}
  ]
}
```

### Question 2: Subsystem Selection

```json
{
  "header": "Subsystems",
  "question": "Which subsystems would you like to install?",
  "multiSelect": false,
  "options": [
    {"label": "Both Art and Remotion (Recommended)", "description": "Full visual + video content creation"},
    {"label": "Art only", "description": "Static visuals only (illustrations, diagrams, thumbnails)"},
    {"label": "Remotion only", "description": "Video creation only (requires Art preferences for theming)"}
  ]
}
```

### Question 3: Final Confirmation

```json
{
  "header": "Install",
  "question": "Ready to install Media v1.0.0?",
  "multiSelect": false,
  "options": [
    {"label": "Yes, install now (Recommended)", "description": "Copies skill files to ~/.claude/skills/Media/"},
    {"label": "Show me what will change", "description": "Lists all files and directories that will be created"},
    {"label": "Cancel", "description": "Abort installation"}
  ]
}
```

**If user chose "Show me what will change":**
```
"Directories to be created:
- ~/.claude/skills/Media/
- ~/.claude/skills/Media/Art/
- ~/.claude/skills/Media/Art/Workflows/ (20 workflow files)
- ~/.claude/skills/Media/Art/Tools/ (4 TypeScript tools + config)
- ~/.claude/skills/Media/Art/Lib/ (2 support files)
- ~/.claude/skills/Media/Art/Examples/ (4 reference images)
- ~/.claude/skills/Media/Remotion/
- ~/.claude/skills/Media/Remotion/Tools/ (2 TypeScript tools + 28 reference docs)
- ~/.claude/skills/Media/Remotion/Workflows/ (1 workflow file)

No other files will be modified. No hooks, no configuration changes."
```

Then re-ask the final confirmation question.

---

## Phase 3: Backup (If Needed)

**Only execute if user chose "Backup and Replace":**

```bash
CLAUDE_DIR="$HOME/.claude"
BACKUP_DIR="$CLAUDE_DIR/Backups/media-skill-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup existing Media skill
if [ -d "$CLAUDE_DIR/skills/Media" ]; then
  cp -R "$CLAUDE_DIR/skills/Media" "$BACKUP_DIR/Media"
  echo "Backed up Media skill to: $BACKUP_DIR/Media"
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
    {"content": "Install tool dependencies", "status": "pending", "activeForm": "Installing dependencies"},
    {"content": "Run verification", "status": "pending", "activeForm": "Running verification"}
  ]
}
```

### 4.1 Create Skill Directory Structure

**Mark todo "Create skill directory structure" as in_progress.**

```bash
CLAUDE_DIR="$HOME/.claude"
mkdir -p "$CLAUDE_DIR/skills/Media"
mkdir -p "$CLAUDE_DIR/skills/Media/Art/Workflows"
mkdir -p "$CLAUDE_DIR/skills/Media/Art/Tools"
mkdir -p "$CLAUDE_DIR/skills/Media/Art/Lib"
mkdir -p "$CLAUDE_DIR/skills/Media/Art/Examples"
mkdir -p "$CLAUDE_DIR/skills/Media/Remotion/Tools"
mkdir -p "$CLAUDE_DIR/skills/Media/Remotion/Workflows"
echo "Directory structure created"
```

**Mark todo as completed.**

### 4.2 Copy Skill Files

**Mark todo "Copy skill files" as in_progress.**

```bash
PACK_DIR="$(pwd)"
CLAUDE_DIR="$HOME/.claude"

# Copy top-level SKILL.md
cp "$PACK_DIR/src/SKILL.md" "$CLAUDE_DIR/skills/Media/SKILL.md"

# Copy Art subsystem
cp -R "$PACK_DIR/src/Art/." "$CLAUDE_DIR/skills/Media/Art/"

# Copy Remotion subsystem
cp -R "$PACK_DIR/src/Remotion/." "$CLAUDE_DIR/skills/Media/Remotion/"

echo "All skill files copied"
```

**For "Art only" — skip the Remotion copy.**
**For "Remotion only" — skip the Art copy.**

**Mark todo as completed.**

### 4.3 Install Tool Dependencies

**Mark todo "Install tool dependencies" as in_progress.**

```bash
CLAUDE_DIR="$HOME/.claude"

# Install Art tool dependencies
if [ -f "$CLAUDE_DIR/skills/Media/Art/Tools/package.json" ]; then
  cd "$CLAUDE_DIR/skills/Media/Art/Tools" && bun install
  echo "Art tool dependencies installed"
fi

# Install Remotion tool dependencies
if [ -f "$CLAUDE_DIR/skills/Media/Remotion/Tools/package.json" ]; then
  cd "$CLAUDE_DIR/skills/Media/Remotion/Tools" && bun install
  echo "Remotion tool dependencies installed"
fi
```

**Mark todo as completed.**

---

## Phase 5: Verification

**Mark todo "Run verification" as in_progress.**

**Execute all checks from VERIFY.md:**

```bash
CLAUDE_DIR="$HOME/.claude"

echo "=== Media Skill Verification ==="

# Check SKILL.md exists
echo "Checking skill files..."
[ -f "$CLAUDE_DIR/skills/Media/SKILL.md" ] && echo "OK Media SKILL.md installed" || echo "ERROR Media SKILL.md missing"
[ -f "$CLAUDE_DIR/skills/Media/Art/SKILL.md" ] && echo "OK Art SKILL.md installed" || echo "SKIP Art not installed"
[ -f "$CLAUDE_DIR/skills/Media/Remotion/SKILL.md" ] && echo "OK Remotion SKILL.md installed" || echo "SKIP Remotion not installed"

# Check subdirectories
echo "Checking directories..."
[ -d "$CLAUDE_DIR/skills/Media/Art/Workflows" ] && echo "OK Art/Workflows exists" || echo "SKIP Art/Workflows"
[ -d "$CLAUDE_DIR/skills/Media/Art/Tools" ] && echo "OK Art/Tools exists" || echo "SKIP Art/Tools"
[ -d "$CLAUDE_DIR/skills/Media/Art/Lib" ] && echo "OK Art/Lib exists" || echo "SKIP Art/Lib"
[ -d "$CLAUDE_DIR/skills/Media/Art/Examples" ] && echo "OK Art/Examples exists" || echo "SKIP Art/Examples"
[ -d "$CLAUDE_DIR/skills/Media/Remotion/Tools" ] && echo "OK Remotion/Tools exists" || echo "SKIP Remotion/Tools"
[ -d "$CLAUDE_DIR/skills/Media/Remotion/Workflows" ] && echo "OK Remotion/Workflows exists" || echo "SKIP Remotion/Workflows"

# Check frontmatter
echo "Checking frontmatter..."
head -1 "$CLAUDE_DIR/skills/Media/SKILL.md" | grep -q "^---" && echo "OK SKILL.md has valid frontmatter" || echo "ERROR SKILL.md missing frontmatter"

# Check workflow count
if [ -d "$CLAUDE_DIR/skills/Media/Art/Workflows" ]; then
  WORKFLOW_COUNT=$(ls -1 "$CLAUDE_DIR/skills/Media/Art/Workflows/"*.md 2>/dev/null | wc -l | tr -d ' ')
  echo "OK Art workflows installed: $WORKFLOW_COUNT"
fi

# Check tools
if [ -d "$CLAUDE_DIR/skills/Media/Art/Tools" ]; then
  [ -f "$CLAUDE_DIR/skills/Media/Art/Tools/Generate.ts" ] && echo "OK Generate.ts present" || echo "ERROR Generate.ts missing"
  [ -f "$CLAUDE_DIR/skills/Media/Art/Tools/ComposeThumbnail.ts" ] && echo "OK ComposeThumbnail.ts present" || echo "ERROR ComposeThumbnail.ts missing"
fi

echo ""
echo "=== Verification Complete ==="
```

**Mark todo as completed when file checks pass.**

---

## Success/Failure Messages

### On Success

```
"Media v1.0.0 installed successfully!

What's available:
- Art subsystem with 20 visual workflows (headers, diagrams, thumbnails, comics, etc.)
- Remotion subsystem for programmatic video creation
- TypeScript tools for image generation and video rendering

Try it now: Ask for any visual content, for example:
- 'create a header image for my blog post about AI'
- 'make a mermaid diagram of the auth flow'
- 'animate the key points from my newsletter'

All generated content goes to ~/Downloads/ for preview before final placement.

Note: You'll need API keys for your preferred image generation model in ${PAI_DIR}/.env"
```

### On Failure

```
"Installation encountered issues. Here's what to check:

1. Ensure ~/.claude/ directory exists (created by Claude Code)
2. Check write permissions on ~/.claude/skills/
3. Verify bun is installed: curl -fsSL https://bun.sh/install | bash
4. Run the verification commands in VERIFY.md

Need help? Open an issue at https://github.com/danielmiessler/Personal_AI_Infrastructure/issues"
```

---

## Troubleshooting

### Image generation fails

Ensure API keys are configured in `${PAI_DIR}/.env` for at least one supported model (Gemini, Flux, OpenAI).

### bun not found

Install bun: `curl -fsSL https://bun.sh/install | bash` — then restart your terminal.

### Tool dependencies not installed

Run `cd ~/.claude/skills/Media/Art/Tools && bun install` and `cd ~/.claude/skills/Media/Remotion/Tools && bun install` manually.

### Generated images look wrong

Create or update `~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/Art/PREFERENCES.md` with your aesthetic preferences, default model, and reference images.

---

## What's Included

| Path | Purpose |
|------|---------|
| `src/SKILL.md` | Top-level routing between Art and Remotion |
| `src/Art/SKILL.md` | Art skill definition with workflow routing |
| `src/Art/Workflows/` | 20 specialized visual creation workflows |
| `src/Art/Tools/` | TypeScript tools: Generate, ComposeThumbnail, GeneratePrompt, GenerateMidjourneyImage |
| `src/Art/Lib/` | Support: Discord bot, Midjourney client |
| `src/Art/Examples/` | 4 reference images for style consistency |
| `src/Remotion/SKILL.md` | Remotion skill definition |
| `src/Remotion/*.md` | ArtIntegration, CriticalRules, Patterns |
| `src/Remotion/Tools/` | Render.ts, Theme.ts, 28 Ref-*.md pattern references |
| `src/Remotion/Workflows/` | ContentToAnimation workflow |
