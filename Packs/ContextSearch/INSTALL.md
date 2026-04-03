# Context Search v1.1.0 - Installation Guide

**This guide is designed for AI agents installing this pack into a user's infrastructure.**

---

## AI Agent Instructions

**This is a wizard-style installation.** Use Claude Code's native tools to guide the user through installation:

1. **AskUserQuestion** - For user decisions and confirmations
2. **TodoWrite** - For progress tracking
3. **Bash/Read/write** - For actual installation
4. **VERIFY.md** - For final validation

### Welcome Message

Before starting, greet the user:
```
"I'm installing Context Search v1.1.0 — search prior work to add context to any request.

This pack adds two slash commands:
- /context-search [topic] — full name for discoverability
- /cs [topic] — shortcut for quick access

Let me analyze your system and guide you through installation."
```

---

## Phase 1: System Analysis

**Execute this analysis BEFORE any file operations.**

### 1.1 Run These Commands

```bash
# Check for Claude Code commands directory
CLAUDE_DIR="$HOME/.claude"
echo "Claude directory: $CLAUDE_DIR"

# Check if commands directory exists
if [ -d "$CLAUDE_DIR/commands" ]; then
  echo "OK Commands directory exists at: $CLAUDE_DIR/commands"
  ls -la "$CLAUDE_DIR/commands/" 2>/dev/null
else
  echo "INFO Commands directory does not exist (will be created)"
fi

# Check for existing context-search.md or cs.md commands
if [ -f "$CLAUDE_DIR/commands/context-search.md" ]; then
  echo "WARNING Existing /context-search command found at: $CLAUDE_DIR/commands/context-search.md"
else
  echo "OK No existing /context-search command (clean install)"
fi

if [ -f "$CLAUDE_DIR/commands/cs.md" ]; then
  echo "WARNING Existing /cs command found at: $CLAUDE_DIR/commands/cs.md"
else
  echo "OK No existing /cs command (clean install)"
fi

# Check for legacy /w and /work commands (from prior version)
if [ -f "$CLAUDE_DIR/commands/w.md" ] || [ -f "$CLAUDE_DIR/commands/work.md" ]; then
  echo "INFO Legacy /w or /work commands found (from Work Command v1.0.0)"
fi

# Check for PAI MEMORY structure (optional, enhances results)
if [ -d "$CLAUDE_DIR/MEMORY/WORK" ]; then
  echo "OK PAI MEMORY/WORK directory exists (full functionality available)"
else
  echo "INFO PAI MEMORY/WORK not found (command will work but may return fewer results)"
fi

if [ -f "$CLAUDE_DIR/MEMORY/STATE/work.json" ]; then
  echo "OK work.json session registry exists"
else
  echo "INFO work.json not found (session registry search will be skipped)"
fi

if [ -f "$CLAUDE_DIR/MEMORY/STATE/session-names.json" ]; then
  echo "OK session-names.json exists"
else
  echo "INFO session-names.json not found (session name search will be skipped)"
fi

# Check if ~/.claude is a git repo (for git history search)
if [ -d "$CLAUDE_DIR/.git" ]; then
  echo "OK ~/.claude is a git repository (git history search available)"
else
  echo "INFO ~/.claude is not a git repository (git history search will be skipped)"
fi
```

### 1.2 Present Findings

Tell the user what you found:
```
"Here's what I found on your system:
- Commands directory: [exists / will be created]
- Existing /context-search command: [found — will ask about conflict / not found]
- Existing /cs command: [found — will ask about conflict / not found]
- Legacy /w or /work commands: [found (from Work Command v1.0.0) / not found]
- PAI MEMORY structure: [found (full functionality) / not found (basic functionality)]
- Git repository: [found / not found]

[If MEMORY not found]: Note: Context Search searches PAI's MEMORY directories
for prior work sessions. Without PAI installed, the command will still work but
will only search git history. For full functionality, consider installing PAI:
https://github.com/danielmiessler/Personal_AI_Infrastructure"
```

---

## Phase 2: User Questions

**Use AskUserQuestion tool at each decision point.**

### Question 1: Conflict Resolution (if existing commands found)

**Only ask if existing /context-search or /cs command detected:**

```json
{
  "header": "Conflict — Existing Command",
  "question": "An existing /context-search or /cs command was found. How should I proceed?",
  "multiSelect": false,
  "options": [
    {"label": "Backup and Replace (Recommended)", "description": "Creates timestamped backup of existing command, then installs new version"},
    {"label": "Replace Without Backup", "description": "Overwrites existing command without backup"},
    {"label": "Abort Installation", "description": "Cancel installation, keep existing command"}
  ]
}
```

### Question 2: Legacy Cleanup (if /w or /work found)

**Only ask if legacy /w or /work commands detected:**

```json
{
  "header": "Legacy Commands",
  "question": "Legacy /w and /work commands were found from Work Command v1.0.0. Context Search replaces these. Remove them?",
  "multiSelect": false,
  "options": [
    {"label": "Remove legacy commands (Recommended)", "description": "Deletes w.md and work.md — /context-search and /cs replace them"},
    {"label": "Keep legacy commands", "description": "Leaves /w and /work in place alongside the new commands"}
  ]
}
```

### Question 3: Command Selection

```json
{
  "header": "Command Names",
  "question": "Which command names would you like to install?",
  "multiSelect": false,
  "options": [
    {"label": "Both /context-search and /cs (Recommended)", "description": "/context-search for discoverability, /cs for quick access"},
    {"label": "Only /context-search", "description": "Full name only"},
    {"label": "Only /cs", "description": "Shortcut only"}
  ]
}
```

### Question 4: Final Confirmation

```json
{
  "header": "Install",
  "question": "Ready to install Context Search v1.1.0?",
  "multiSelect": false,
  "options": [
    {"label": "Yes, install now (Recommended)", "description": "Copies command files to ~/.claude/commands/"},
    {"label": "Show me what will change", "description": "Lists all files that will be created"},
    {"label": "Cancel", "description": "Abort installation"}
  ]
}
```

**If user chose "Show me what will change":**
```
"Files to be created:
- ~/.claude/commands/context-search.md (slash command definition)
- ~/.claude/commands/cs.md (slash command definition, shortcut)

No other files will be modified. No hooks, no configuration changes."
```

Then re-ask the final confirmation question.

---

## Phase 3: Backup (If Needed)

**Only execute if user chose "Backup and Replace":**

```bash
CLAUDE_DIR="$HOME/.claude"
BACKUP_DIR="$CLAUDE_DIR/Backups/context-search-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup existing commands
[ -f "$CLAUDE_DIR/commands/context-search.md" ] && cp "$CLAUDE_DIR/commands/context-search.md" "$BACKUP_DIR/context-search.md" && echo "Backed up context-search.md"
[ -f "$CLAUDE_DIR/commands/cs.md" ] && cp "$CLAUDE_DIR/commands/cs.md" "$BACKUP_DIR/cs.md" && echo "Backed up cs.md"

echo "Backup created at: $BACKUP_DIR"
```

---

## Phase 4: Installation

**Create a TodoWrite list to track progress:**

```json
{
  "todos": [
    {"content": "Create commands directory", "status": "pending", "activeForm": "Creating commands directory"},
    {"content": "Copy command files", "status": "pending", "activeForm": "Copying command files"},
    {"content": "Run verification", "status": "pending", "activeForm": "Running verification"}
  ]
}
```

### 4.1 Create Commands Directory

**Mark todo "Create commands directory" as in_progress.**

```bash
CLAUDE_DIR="$HOME/.claude"
mkdir -p "$CLAUDE_DIR/commands"
```

**Mark todo as completed.**

### 4.2 Copy Command Files

**Mark todo "Copy command files" as in_progress.**

**Copy files based on user's command selection:**

**For "Both /context-search and /cs" (default):**
```bash
PACK_DIR="$(pwd)"
CLAUDE_DIR="$HOME/.claude"
cp "$PACK_DIR/src/commands/context-search.md" "$CLAUDE_DIR/commands/context-search.md"
cp "$PACK_DIR/src/commands/cs.md" "$CLAUDE_DIR/commands/cs.md"
echo "Installed /context-search and /cs commands"
```

**For "Only /context-search":**
```bash
PACK_DIR="$(pwd)"
CLAUDE_DIR="$HOME/.claude"
cp "$PACK_DIR/src/commands/context-search.md" "$CLAUDE_DIR/commands/context-search.md"
echo "Installed /context-search command"
```

**For "Only /cs":**
```bash
PACK_DIR="$(pwd)"
CLAUDE_DIR="$HOME/.claude"
cp "$PACK_DIR/src/commands/cs.md" "$CLAUDE_DIR/commands/cs.md"
echo "Installed /cs command"
```

**Mark todo as completed.**

---

## Phase 5: Verification

**Mark todo "Run verification" as in_progress.**

**Execute all checks from VERIFY.md:**

```bash
CLAUDE_DIR="$HOME/.claude"

echo "=== Context Search Verification ==="

# Check command files exist
echo "Checking command files..."
[ -f "$CLAUDE_DIR/commands/context-search.md" ] && echo "OK /context-search command installed" || echo "SKIP /context-search not installed (user chose /cs only)"
[ -f "$CLAUDE_DIR/commands/cs.md" ] && echo "OK /cs command installed" || echo "SKIP /cs not installed (user chose /context-search only)"

# Check frontmatter is valid
echo "Checking frontmatter..."
if [ -f "$CLAUDE_DIR/commands/context-search.md" ]; then
  head -1 "$CLAUDE_DIR/commands/context-search.md" | grep -q "^---" && echo "OK context-search.md has valid frontmatter" || echo "ERROR context-search.md missing frontmatter"
fi
if [ -f "$CLAUDE_DIR/commands/cs.md" ]; then
  head -1 "$CLAUDE_DIR/commands/cs.md" | grep -q "^---" && echo "OK cs.md has valid frontmatter" || echo "ERROR cs.md missing frontmatter"
fi

# Check file contents are complete
echo "Checking file contents..."
if [ -f "$CLAUDE_DIR/commands/context-search.md" ]; then
  grep -q "CONTEXT SEARCH" "$CLAUDE_DIR/commands/context-search.md" && echo "OK context-search.md contains context search template" || echo "ERROR context-search.md incomplete"
  grep -q "work.json" "$CLAUDE_DIR/commands/context-search.md" && echo "OK context-search.md references session registry" || echo "ERROR context-search.md missing search sources"
fi

# Check data sources (informational, not blocking)
echo ""
echo "Data source availability (informational):"
[ -f "$CLAUDE_DIR/MEMORY/STATE/work.json" ] && echo "  OK work.json — session registry available" || echo "  INFO work.json — not found (install PAI for this feature)"
[ -d "$CLAUDE_DIR/MEMORY/WORK" ] && echo "  OK MEMORY/WORK — PRD directory available" || echo "  INFO MEMORY/WORK — not found (install PAI for this feature)"
[ -f "$CLAUDE_DIR/MEMORY/STATE/session-names.json" ] && echo "  OK session-names.json — session names available" || echo "  INFO session-names.json — not found (install PAI for this feature)"
[ -d "$CLAUDE_DIR/.git" ] && echo "  OK .git — git history available" || echo "  INFO .git — not found (git history search unavailable)"

echo ""
echo "=== Verification Complete ==="
```

**Mark todo as completed when file checks pass.**

---

## Success/Failure Messages

### On Success

```
"Context Search v1.1.0 installed successfully!

What's available:
- /context-search [topic] — search prior work to add context
- /cs [topic] — same command, quick shortcut

Two usage modes:
- Standalone: /cs authentication — browse prior work, then ask a question
- Paired: /cs authentication + 'now add rate limiting' — search then execute

Try it now: Type '/cs' followed by any topic you've worked on before.

Example: /cs authentication
Example: /cs dashboard
Example: /cs deploy

Note: Results improve the more you use PAI's work tracking system (PRDs, session names, git commits)."
```

### On Success (Without PAI MEMORY)

```
"Context Search v1.1.0 installed successfully!

The commands are ready, but PAI's MEMORY system isn't installed yet.
Right now, the commands will search git history only.

For full functionality (PRD search, session registry, work directories), install PAI:
https://github.com/danielmiessler/Personal_AI_Infrastructure

Try it now: /cs [any topic]"
```

### On Failure

```
"Installation encountered issues. Here's what to check:

1. Ensure ~/.claude/ directory exists (created by Claude Code)
2. Check write permissions on ~/.claude/commands/
3. Run the verification commands in VERIFY.md

Need help? Open an issue at https://github.com/danielmiessler/Personal_AI_Infrastructure/issues"
```

---

## Troubleshooting

### Commands not showing up after installation

Restart Claude Code. Custom commands from `~/.claude/commands/` are loaded at session start.

### "No prior work found" for everything

This is expected if PAI's MEMORY system isn't installed. The command searches PAI-specific directories. Options:
1. Install PAI for full work tracking: https://github.com/danielmiessler/Personal_AI_Infrastructure
2. The command will still search git history if `~/.claude/` is a git repo

### Command works but results are sparse

Context Search searches data created by PAI's Algorithm (PRDs, session metadata). The more you use PAI's structured workflow, the richer the search results become.

---

## What's Included

| File | Purpose |
|------|---------|
| `src/commands/context-search.md` | Primary slash command — full name `/context-search` |
| `src/commands/cs.md` | Shortcut slash command — quick form `/cs` |

Both files contain identical logic. The only difference is the `name` field in the frontmatter (`Context Search` vs `cs`), which determines the slash command name in Claude Code.

---

## Usage

### From Claude Code

```
/context-search authentication
/context-search dashboard redesign
/cs deploy
/cs security audit
/cs blog publishing
```

### How It Works

When you type `/cs [topic]`, Claude Code:
1. Loads the command template from `~/.claude/commands/cs.md`
2. Substitutes `$ARGUMENTS` with your topic
3. The AI executes the parallel searches defined in the template
4. Results are presented in a structured format
5. The AI reads the most recent matching PRD for full context
6. In standalone mode, waits for your request; in paired mode, executes the accompanying task

### Integration with PAI

If you have PAI installed, Context Search becomes significantly more powerful:
- **work.json** provides structured session metadata
- **MEMORY/WORK/*/PRD.md** provides full context, criteria, and decisions
- **session-names.json** provides human-readable session names
- **Git history** provides commit-level detail

Without PAI, the command still works but only searches git history.
