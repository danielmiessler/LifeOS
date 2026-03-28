# CopilotCLI Pack v1.0.0 - Installation Guide

**This guide is designed for AI agents installing this pack into a user's Copilot CLI infrastructure.**

---

## AI Agent Instructions

**This is a wizard-style installation.** Use GitHub Copilot CLI's native tools to guide the user through installation:

1. **ask_user** - For user decisions and confirmations
2. **sql** - For progress tracking
3. **powershell / bash** - For actual installation (PowerShell on Windows, bash on Mac/Linux)
4. **VERIFY.md** - For final validation

### Welcome Message

Before starting, greet the user:
```
"I'm installing CopilotCLI Pack v1.0.0 — PAI skills ported for GitHub Copilot CLI.

This pack adds four skill files to ~/.copilot/pai/:
- agents.md     — custom agent composition system
- investigation.md — structured investigation with Kusto/ICM/ADO tools
- research.md   — multi-source research and synthesis workflows
- thinking.md   — multi-mode analytical and creative reasoning

Optionally, I can add skill references to ~/.copilot/copilot-instructions.md
so Copilot knows about the skills automatically.

Let me analyze your system and guide you through installation."
```

---

## Phase 1: System Analysis

**Execute this analysis BEFORE any file operations.**

### 1.1 Run These Commands

**Windows (PowerShell):**
```powershell
$PAI_DIR = "$env:USERPROFILE\.copilot\pai"
$COPILOT_DIR = "$env:USERPROFILE\.copilot"

Write-Host "Copilot directory: $COPILOT_DIR"

if (Test-Path $COPILOT_DIR) {
  Write-Host "OK Copilot directory exists"
} else {
  Write-Host "ERROR Copilot CLI not installed (directory not found: $COPILOT_DIR)"
}

if (Test-Path $PAI_DIR) {
  Write-Host "OK pai directory exists at: $PAI_DIR"
} else {
  Write-Host "INFO pai directory does not exist (will be created)"
}

foreach ($file in @("agents.md", "investigation.md", "research.md", "thinking.md")) {
  if (Test-Path "$PAI_DIR\$file") {
    Write-Host "WARNING Existing file found: pai/$file"
  } else {
    Write-Host "OK No existing $file (clean install)"
  }
}

if (Test-Path "$COPILOT_DIR\copilot-instructions.md") {
  Write-Host "OK copilot-instructions.md exists (optional integration available)"
} else {
  Write-Host "INFO copilot-instructions.md not found (optional integration will create it)"
}
```

**Mac/Linux (bash):**
```bash
PAI_DIR="$HOME/.copilot/pai"
COPILOT_DIR="$HOME/.copilot"

echo "Copilot directory: $COPILOT_DIR"

if [ -d "$COPILOT_DIR" ]; then
  echo "OK Copilot directory exists"
else
  echo "ERROR Copilot CLI not installed (directory not found: $COPILOT_DIR)"
fi

if [ -d "$PAI_DIR" ]; then
  echo "OK pai directory exists at: $PAI_DIR"
else
  echo "INFO pai directory does not exist (will be created)"
fi

for file in agents.md investigation.md research.md thinking.md; do
  if [ -f "$PAI_DIR/$file" ]; then
    echo "WARNING Existing file found: pai/$file"
  else
    echo "OK No existing $file (clean install)"
  fi
done

if [ -f "$COPILOT_DIR/copilot-instructions.md" ]; then
  echo "OK copilot-instructions.md exists (optional integration available)"
else
  echo "INFO copilot-instructions.md not found (optional integration will create it)"
fi
```

### 1.2 Present Findings

Tell the user what you found:
```
"Here's what I found on your system:
- Copilot CLI directory: [exists / ERROR: not found]
- pai directory: [exists / will be created]
- Existing skill files: [list any conflicts / none found]
- copilot-instructions.md: [exists / not found]

The CopilotCLI pack has no external dependencies. All four skills work
immediately after installation."
```

**If Copilot CLI directory is not found:** Stop and inform the user that GitHub Copilot CLI must be installed first. Do not proceed.

---

## Phase 2: User Questions

**Use ask_user tool at each decision point.**

### Question 1: Conflict Resolution (if existing skill files found)

**Only ask if any of the four target files already exist in pai/:**

```
ask_user: "One or more skill files already exist in ~/.copilot/pai/. How should I proceed?

Options:
1. Backup and Replace (Recommended) — creates timestamped backup of existing files, then installs new versions
2. Replace Without Backup — overwrites existing files without backup
3. Abort Installation — cancel installation, keep existing files"
```

### Question 2: copilot-instructions.md Integration

**Always ask this question:**

```
ask_user: "Should I add skill references to ~/.copilot/copilot-instructions.md?

This makes Copilot aware of the installed skills so it can use them automatically
without you needing to reference the files manually.

Options:
1. Yes, add skill references (Recommended) — appends a PAI skills section to copilot-instructions.md (creates the file if it doesn't exist)
2. No, skip this step — install skill files only, no changes to copilot-instructions.md"
```

### Question 3: Final Confirmation

```
ask_user: "Ready to install CopilotCLI Pack v1.0.0?

Options:
1. Yes, install now (Recommended) — copies 4 skill files to ~/.copilot/pai/
2. Show me what will change — lists all files that will be created or modified
3. Cancel — abort installation"
```

**If user chose "Show me what will change":**
```
"Files to be created in ~/.copilot/pai/:
- agents.md      — custom agent composition system
- investigation.md — structured investigation workflows
- research.md    — multi-source research and synthesis
- thinking.md    — multi-mode analytical and creative reasoning

[If copilot-instructions.md integration selected:]
- ~/.copilot/copilot-instructions.md — appended with PAI skills section
  (or created if it doesn't exist)

No other files will be modified. No hooks, no system changes.
No external dependencies required."
```

Then re-ask the final confirmation question.

---

## Phase 3: Backup (If Needed)

**Only execute if user chose "Backup and Replace":**

**Windows (PowerShell):**
```powershell
$PAI_DIR = "$env:USERPROFILE\.copilot\pai"
$TIMESTAMP = Get-Date -Format "yyyyMMdd-HHmmss"
$BACKUP_DIR = "$env:USERPROFILE\.copilot\Backups\pai-$TIMESTAMP"

New-Item -ItemType Directory -Path $BACKUP_DIR -Force | Out-Null

foreach ($file in @("agents.md", "investigation.md", "research.md", "thinking.md")) {
  if (Test-Path "$PAI_DIR\$file") {
    Copy-Item "$PAI_DIR\$file" "$BACKUP_DIR\$file"
    Write-Host "Backed up: $file"
  }
}

Write-Host "Backup created at: $BACKUP_DIR"
```

**Mac/Linux (bash):**
```bash
PAI_DIR="$HOME/.copilot/pai"
BACKUP_DIR="$HOME/.copilot/Backups/pai-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

for file in agents.md investigation.md research.md thinking.md; do
  if [ -f "$PAI_DIR/$file" ]; then
    cp "$PAI_DIR/$file" "$BACKUP_DIR/$file"
    echo "Backed up: $file"
  fi
done

echo "Backup created at: $BACKUP_DIR"
```

---

## Phase 4: Installation

**Create a sql table to track progress:**

```sql
CREATE TABLE IF NOT EXISTS install_todos (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'pending'
);
INSERT OR REPLACE INTO install_todos (id, title) VALUES
  ('create-dir',     'Create pai directory'),
  ('copy-files',     'Copy skill files'),
  ('instructions',   'Update copilot-instructions.md'),
  ('verify',         'Run verification');
```

### 4.1 Create pai Directory

**Mark todo 'create-dir' as in_progress.**

**Windows (PowerShell):**
```powershell
$PAI_DIR = "$env:USERPROFILE\.copilot\pai"
New-Item -ItemType Directory -Path $PAI_DIR -Force | Out-Null
Write-Host "OK pai directory ready at: $PAI_DIR"
```

**Mac/Linux (bash):**
```bash
PAI_DIR="$HOME/.copilot/pai"
mkdir -p "$PAI_DIR"
echo "OK pai directory ready at: $PAI_DIR"
```

**Mark todo 'create-dir' as done.**

```sql
UPDATE install_todos SET status = 'done' WHERE id = 'create-dir';
```

### 4.2 Copy Skill Files

**Mark todo 'copy-files' as in_progress.**

```sql
UPDATE install_todos SET status = 'in_progress' WHERE id = 'copy-files';
```

**Windows (PowerShell):**
```powershell
$PACK_DIR = (Get-Location).Path
$PAI_DIR = "$env:USERPROFILE\.copilot\pai"

foreach ($file in @("agents.md", "investigation.md", "research.md", "thinking.md")) {
  Copy-Item "$PACK_DIR\src\$file" "$PAI_DIR\$file" -Force
  if (Test-Path "$PAI_DIR\$file") {
    Write-Host "OK Installed: $file"
  } else {
    Write-Host "ERROR Failed to install: $file"
  }
}
```

**Mac/Linux (bash):**
```bash
PACK_DIR="$(pwd)"
PAI_DIR="$HOME/.copilot/pai"

for file in agents.md investigation.md research.md thinking.md; do
  cp "$PACK_DIR/src/$file" "$PAI_DIR/$file"
  [ -f "$PAI_DIR/$file" ] && echo "OK Installed: $file" || echo "ERROR Failed to install: $file"
done
```

**Mark todo 'copy-files' as done.**

```sql
UPDATE install_todos SET status = 'done' WHERE id = 'copy-files';
```

### 4.3 Update copilot-instructions.md (Optional)

**Only execute if user chose to add skill references. Mark todo 'instructions' as in_progress.**

```sql
UPDATE install_todos SET status = 'in_progress' WHERE id = 'instructions';
```

Append the following block to `~/.copilot/copilot-instructions.md` (create the file if it doesn't exist):

**Windows (PowerShell):**
```powershell
$INSTRUCTIONS_FILE = "$env:USERPROFILE\.copilot\copilot-instructions.md"
$PAI_DIR = "$env:USERPROFILE\.copilot\pai"

$block = @"

## PAI Skills

The following skill files are installed in ${PAI_DIR}. Read them when relevant:

- **agents.md** — custom agent composition patterns; use when launching or composing sub-agents
- **investigation.md** — structured investigation with Kusto, ICM, and ADO tools; use for incident triage and root-cause analysis
- **research.md** — multi-source research and synthesis workflows; use when researching topics or gathering information
- **thinking.md** — multi-mode analytical and creative reasoning; use for first-principles analysis, creative brainstorming, red-teaming, or deep exploration
"@

Add-Content -Path $INSTRUCTIONS_FILE -Value $block
Write-Host "OK Updated copilot-instructions.md"
```

**Mac/Linux (bash):**
```bash
INSTRUCTIONS_FILE="$HOME/.copilot/copilot-instructions.md"
PAI_DIR="$HOME/.copilot/pai"

cat >> "$INSTRUCTIONS_FILE" << EOF

## PAI Skills

The following skill files are installed in $PAI_DIR. Read them when relevant:

- **agents.md** — custom agent composition patterns; use when launching or composing sub-agents
- **investigation.md** — structured investigation with Kusto, ICM, and ADO tools; use for incident triage and root-cause analysis
- **research.md** — multi-source research and synthesis workflows; use when researching topics or gathering information
- **thinking.md** — multi-mode analytical and creative reasoning; use for first-principles analysis, creative brainstorming, red-teaming, or deep exploration
EOF

echo "OK Updated copilot-instructions.md"
```

**Mark todo 'instructions' as done.**

```sql
UPDATE install_todos SET status = 'done' WHERE id = 'instructions';
```

---

## Phase 5: Verification

**Mark todo 'verify' as in_progress.**

```sql
UPDATE install_todos SET status = 'in_progress' WHERE id = 'verify';
```

**Execute all checks from VERIFY.md:**

**Windows (PowerShell):**
```powershell
$PAI_DIR = "$env:USERPROFILE\.copilot\pai"

Write-Host "=== CopilotCLI Pack Verification ==="
Write-Host ""

Write-Host "Checking skill files..."
foreach ($file in @("agents.md", "investigation.md", "research.md", "thinking.md")) {
  if (Test-Path "$PAI_DIR\$file") {
    Write-Host "OK $file"
  } else {
    Write-Host "MISSING $file"
  }
}

Write-Host ""
Write-Host "Checking file sizes (non-empty)..."
foreach ($file in @("agents.md", "investigation.md", "research.md", "thinking.md")) {
  $path = "$PAI_DIR\$file"
  if (Test-Path $path) {
    $size = (Get-Item $path).Length
    if ($size -gt 0) {
      Write-Host "OK $file ($size bytes)"
    } else {
      Write-Host "ERROR $file is empty"
    }
  }
}

Write-Host ""
Write-Host "=== Verification Complete ==="
```

**Mac/Linux (bash):**
```bash
PAI_DIR="$HOME/.copilot/pai"

echo "=== CopilotCLI Pack Verification ==="
echo ""

echo "Checking skill files..."
for file in agents.md investigation.md research.md thinking.md; do
  if [ -f "$PAI_DIR/$file" ]; then
    echo "OK $file"
  else
    echo "MISSING $file"
  fi
done

echo ""
echo "Checking file sizes (non-empty)..."
for file in agents.md investigation.md research.md thinking.md; do
  path="$PAI_DIR/$file"
  if [ -f "$path" ]; then
    size=$(wc -c < "$path")
    if [ "$size" -gt 0 ]; then
      echo "OK $file ($size bytes)"
    else
      echo "ERROR $file is empty"
    fi
  fi
done

echo ""
echo "=== Verification Complete ==="
```

**Mark todo 'verify' as done when all file checks pass.**

```sql
UPDATE install_todos SET status = 'done' WHERE id = 'verify';
SELECT id, title, status FROM install_todos;
```

---

## Success/Failure Messages

### On Success

```
"CopilotCLI Pack v1.0.0 installed successfully!

What's available (4 skills):
- agents.md       — 'compose an agent for X', 'launch a sub-agent to...'
- investigation.md — 'investigate this incident', 'triage this failure'
- research.md     — 'research this topic', 'synthesize findings on...'
- thinking.md     — 'think about this from first principles', 'red team this plan',
                    'be creative about...', 'council debate on...'

[If copilot-instructions.md was updated:]
Copilot will now automatically read skill files when relevant — no manual
referencing needed.

[If copilot-instructions.md was skipped:]
To activate skills manually, reference them directly:
  'Read ~/.copilot/pai/thinking.md and then...'
  'Using the investigation skill, help me...'"
```

### On Failure

```
"Installation encountered issues. Here's what to check:

1. Ensure GitHub Copilot CLI is installed and ~/.copilot/ exists
2. Check write permissions on ~/.copilot/pai/
3. Run the verification commands in VERIFY.md
4. Confirm you ran this wizard from the pack root directory (Packs/CopilotCLI/)

Need help? Open an issue at https://github.com/danielmiessler/Personal_AI_Infrastructure/issues"
```

---

## Troubleshooting

### Skills not activating automatically

If you added references to `copilot-instructions.md`, Copilot reads it at session start. Start a new session after installation. If skills still don't activate, verify the PAI section was appended correctly by reading `~/.copilot/copilot-instructions.md`.

### Wrong skill selected

Each skill file contains its own trigger conditions and routing logic. If the wrong skill activates, reference the target file explicitly: *"Using the investigation skill in ~/.copilot/pai/investigation.md, help me..."*

### copilot-instructions.md conflicts

If `copilot-instructions.md` already has a PAI Skills section from a previous installation, do not append again — it will create duplicate entries. Remove the old section first or skip the optional integration step.

### Files installed but Copilot doesn't use them

The `~/.copilot/pai/` directory is a convention-based location. Copilot reads files it's directed to via `copilot-instructions.md` or explicit user requests. Ensure the optional `copilot-instructions.md` step was completed, or reference skills explicitly in your prompts.

---

## What's Included

| File | Purpose |
|------|---------|
| `src/agents.md` | Custom agent composition system — patterns for launching, composing, and managing sub-agents |
| `src/investigation.md` | Structured investigation workflows using Kusto, ICM, ADO, and other tools |
| `src/research.md` | Multi-source research and synthesis — gathering, evaluating, and summarizing information |
| `src/thinking.md` | Multi-mode reasoning — first principles, iterative depth, creative brainstorming, council debate, red-teaming, science |

All four files in `src/` are copied to `~/.copilot/pai/` during installation.
