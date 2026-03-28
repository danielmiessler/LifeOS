# CopilotCLI Skills Verification

> **FOR AI AGENTS:** Complete this checklist AFTER installation. Every file check must pass before declaring the pack installed.

---

## File Verification

### Check all 4 skill files exist

```bash
PAI_DIR="$HOME/.copilot/pai"
for skill in thinking.md research.md investigation.md agents.md; do
  [ -f "$PAI_DIR/$skill" ] && echo "OK $skill" || echo "MISSING $skill"
done
```

**Windows PowerShell equivalent:**

```powershell
$PAI_DIR = "$env:USERPROFILE\.copilot\pai"
@("thinking.md", "research.md", "investigation.md", "agents.md") | ForEach-Object {
  if (Test-Path "$PAI_DIR\$_") { Write-Host "OK $_" } else { Write-Host "MISSING $_" }
}
```

**Expected:** All four skill files present at `~/.copilot/pai/`.

---

## Content Validation

### Check for Claude Code-specific patterns (SHOULD NOT be present)

```bash
PAI_DIR="$HOME/.copilot/pai"
FORBIDDEN_PATTERNS=("AskUserQuestion" "TodoWrite" "curl localhost:8888" "{PRINCIPAL.NAME}")

for skill in thinking.md research.md investigation.md agents.md; do
  echo "Checking $skill for Claude Code patterns..."
  for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
    grep -q "$pattern" "$PAI_DIR/$skill" && echo "  ERROR: Found '$pattern'" || true
  done
done
```

**Windows PowerShell equivalent:**

```powershell
$PAI_DIR = "$env:USERPROFILE\.copilot\pai"
$ForbiddenPatterns = @("AskUserQuestion", "TodoWrite", "curl localhost:8888", "{PRINCIPAL.NAME}")

@("thinking.md", "research.md", "investigation.md", "agents.md") | ForEach-Object {
  $skill = $_
  Write-Host "Checking $skill for Claude Code patterns..."
  
  $content = Get-Content "$PAI_DIR\$skill" -Raw
  $ForbiddenPatterns | ForEach-Object {
    if ($content -match [regex]::Escape($_)) {
      Write-Host "  ERROR: Found '$_'"
    }
  }
}
```

**Expected:** No forbidden patterns found in any skill file.

### Check for Copilot CLI-specific patterns (SHOULD be present)

```bash
PAI_DIR="$HOME/.copilot/pai"
REQUIRED_PATTERNS=("task(agent_type" "web_fetch" "mode=\"background\"")

for skill in thinking.md research.md investigation.md agents.md; do
  echo "Checking $skill for Copilot CLI patterns..."
  for pattern in "${REQUIRED_PATTERNS[@]}"; do
    grep -q "$pattern" "$PAI_DIR/$skill" && echo "  OK: Found '$pattern'" || echo "  MISSING: '$pattern'"
  done
done
```

**Windows PowerShell equivalent:**

```powershell
$PAI_DIR = "$env:USERPROFILE\.copilot\pai"
$RequiredPatterns = @("task(agent_type", "web_fetch", "mode=`"background`"")

@("thinking.md", "research.md", "investigation.md", "agents.md") | ForEach-Object {
  $skill = $_
  Write-Host "Checking $skill for Copilot CLI patterns..."
  
  $content = Get-Content "$PAI_DIR\$skill" -Raw
  $RequiredPatterns | ForEach-Object {
    if ($content -match [regex]::Escape($_)) {
      Write-Host "  OK: Found '$_'"
    } else {
      Write-Host "  WARNING: '$_' not found"
    }
  }
}
```

**Expected:** All required Copilot CLI patterns found in skill files.

---

## Optional: Integration Checks

### Check copilot-instructions.md references the skills

```bash
COPILOT_INSTRUCTIONS="$HOME/.copilot/copilot-instructions.md"
if [ -f "$COPILOT_INSTRUCTIONS" ]; then
  echo "Checking copilot-instructions.md for skill references..."
  grep -q "thinking.md" "$COPILOT_INSTRUCTIONS" && echo "  OK: thinking.md referenced" || echo "  MISSING: thinking.md reference"
  grep -q "research.md" "$COPILOT_INSTRUCTIONS" && echo "  OK: research.md referenced" || echo "  MISSING: research.md reference"
  grep -q "investigation.md" "$COPILOT_INSTRUCTIONS" && echo "  OK: investigation.md referenced" || echo "  MISSING: investigation.md reference"
  grep -q "agents.md" "$COPILOT_INSTRUCTIONS" && echo "  OK: agents.md referenced" || echo "  MISSING: agents.md reference"
else
  echo "UNAVAILABLE: copilot-instructions.md not found (optional integration)"
fi
```

**Windows PowerShell equivalent:**

```powershell
$COPILOT_INSTRUCTIONS = "$env:USERPROFILE\.copilot\copilot-instructions.md"
if (Test-Path $COPILOT_INSTRUCTIONS) {
  Write-Host "Checking copilot-instructions.md for skill references..."
  
  $content = Get-Content $COPILOT_INSTRUCTIONS -Raw
  @("thinking.md", "research.md", "investigation.md", "agents.md") | ForEach-Object {
    if ($content -match [regex]::Escape($_)) {
      Write-Host "  OK: $_ referenced"
    } else {
      Write-Host "  MISSING: $_ reference"
    }
  }
} else {
  Write-Host "UNAVAILABLE: copilot-instructions.md not found (optional integration)"
}
```

**Expected:** Skills referenced in copilot-instructions.md (informational only).

---

## Installation Checklist

Mark each item as complete:

```markdown
## CopilotCLI Skills Installation Verification

### Files
- [ ] thinking.md installed at ~/.copilot/pai/thinking.md
- [ ] research.md installed at ~/.copilot/pai/research.md
- [ ] investigation.md installed at ~/.copilot/pai/investigation.md
- [ ] agents.md installed at ~/.copilot/pai/agents.md

### Content Validation
- [ ] No Claude Code-specific patterns (AskUserQuestion, TodoWrite, curl localhost:8888, {PRINCIPAL.NAME})
- [ ] Copilot CLI patterns present (task(agent_type, web_fetch, mode="background")

### Functional (manual test)
- [ ] `copilot ask` can reference thinking skill
- [ ] `copilot ask` can reference research skill
- [ ] `copilot ask` can reference investigation skill
- [ ] `copilot ask` can reference agents skill
```

---

## Verification Complete

When all file checks and content validation pass:

1. **Confirm to user:** "CopilotCLI skills installation verified successfully"
2. **Recommend:** "Try it now with `copilot ask 'help me think about [problem]'` or reference investigation skills"
3. **Note:** "Restart GitHub Copilot CLI if the skills aren't recognized yet"
