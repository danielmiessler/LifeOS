# VoiceFidelity Verification

> **FOR AI AGENTS:** Complete this checklist AFTER installation. Every file check must pass before declaring the pack installed.

---

## File Verification

### Check SKILL.md exists

```bash
CLAUDE_DIR="$HOME/.claude"
[ -f "$CLAUDE_DIR/skills/VoiceFidelity/SKILL.md" ] && echo "OK VoiceFidelity SKILL.md" || echo "MISSING VoiceFidelity SKILL.md"
```

### Check subdirectories exist

```bash
CLAUDE_DIR="$HOME/.claude"
[ -d "$CLAUDE_DIR/skills/VoiceFidelity/Workflows" ] && echo "OK Workflows/" || echo "MISSING Workflows/"
[ -d "$CLAUDE_DIR/skills/VoiceFidelity/Tools" ] && echo "OK Tools/" || echo "MISSING Tools/"
```

### Check tools exist and are executable

```bash
CLAUDE_DIR="$HOME/.claude"
for tool in voice-extract.ts voice-score.ts prufrock.ts; do
  if [ -f "$CLAUDE_DIR/skills/VoiceFidelity/Tools/$tool" ]; then
    [ -x "$CLAUDE_DIR/skills/VoiceFidelity/Tools/$tool" ] && echo "OK $tool (executable)" || echo "WARNING $tool exists but not executable"
  else
    echo "MISSING $tool"
  fi
done
```

### Check workflows exist

```bash
CLAUDE_DIR="$HOME/.claude"
for wf in Extract.md Score.md Audit.md; do
  [ -f "$CLAUDE_DIR/skills/VoiceFidelity/Workflows/$wf" ] && echo "OK $wf" || echo "MISSING $wf"
done
```

### Check reference docs exist

```bash
CLAUDE_DIR="$HOME/.claude"
[ -f "$CLAUDE_DIR/skills/VoiceFidelity/IndexicalGroundingFramework.md" ] && echo "OK Framework doc" || echo "MISSING Framework doc"
[ -f "$CLAUDE_DIR/skills/VoiceFidelity/VoiceCardTemplate.md" ] && echo "OK Voice card template" || echo "MISSING Voice card template"
```

### Check frontmatter validity

```bash
CLAUDE_DIR="$HOME/.claude"
SKILL_FILE="$CLAUDE_DIR/skills/VoiceFidelity/SKILL.md"
if [ -f "$SKILL_FILE" ]; then
  head -1 "$SKILL_FILE" | grep -q "^---" && echo "OK frontmatter present" || echo "ERROR missing frontmatter"
  grep -q "^name:" "$SKILL_FILE" && echo "OK name field" || echo "ERROR missing name"
  grep -q "^description:" "$SKILL_FILE" && echo "OK description field" || echo "ERROR missing description"
fi
```

---

## Runtime Verification

### Check bun can run tools

```bash
CLAUDE_DIR="$HOME/.claude"
bun "$CLAUDE_DIR/skills/VoiceFidelity/Tools/voice-extract.ts" 2>&1 | head -5
echo "---"
bun "$CLAUDE_DIR/skills/VoiceFidelity/Tools/voice-score.ts" 2>&1 | head -5
echo "---"
bun "$CLAUDE_DIR/skills/VoiceFidelity/Tools/prufrock.ts" 2>&1 | head -5
```

**Expected:** Each tool should print its usage help (not a crash or import error).

### Test scoring (if profile exists)

```bash
CLAUDE_DIR="$HOME/.claude"
if [ -f "$CLAUDE_DIR/tools/voice-profile.json" ]; then
  echo "Testing voice-score with existing profile..."
  echo "This is a test sentence. It should score against the profile." | bun "$CLAUDE_DIR/skills/VoiceFidelity/Tools/voice-score.ts"
else
  echo "SKIP No voice profile found. Run voice-extract first to create one."
fi
```

---

## Symlink Verification (if installed)

```bash
CLAUDE_DIR="$HOME/.claude"
for tool in voice-extract voice-score prufrock; do
  if [ -L "$CLAUDE_DIR/tools/$tool" ]; then
    echo "OK $tool symlink exists"
    readlink "$CLAUDE_DIR/tools/$tool"
  else
    echo "INFO $tool symlink not created (standalone install)"
  fi
done
```

---

## Summary

All checks should show OK. If any show MISSING or ERROR, re-run the relevant installation step from INSTALL.md.

**Minimum viable install:** SKILL.md + 3 tools + 3 workflows. Framework and voice card are recommended but not required.
