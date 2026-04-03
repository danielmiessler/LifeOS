# Media Verification

> **FOR AI AGENTS:** Complete this checklist AFTER installation. Every file check must pass before declaring the pack installed. Dependency checks are informational only.

---

## File Verification

### Check SKILL.md exists at target

```bash
CLAUDE_DIR="$HOME/.claude"
[ -f "$CLAUDE_DIR/skills/Media/SKILL.md" ] && echo "OK Media SKILL.md" || echo "MISSING Media SKILL.md"
[ -f "$CLAUDE_DIR/skills/Media/Art/SKILL.md" ] && echo "OK Art SKILL.md" || echo "MISSING Art SKILL.md"
[ -f "$CLAUDE_DIR/skills/Media/Remotion/SKILL.md" ] && echo "OK Remotion SKILL.md" || echo "MISSING Remotion SKILL.md"
```

**Expected:** All three SKILL.md files present (or two if user chose a single subsystem).

### Check subdirectories exist

```bash
CLAUDE_DIR="$HOME/.claude"

echo "Art subdirectories:"
[ -d "$CLAUDE_DIR/skills/Media/Art/Workflows" ] && echo "  OK Art/Workflows" || echo "  MISSING Art/Workflows"
[ -d "$CLAUDE_DIR/skills/Media/Art/Tools" ] && echo "  OK Art/Tools" || echo "  MISSING Art/Tools"
[ -d "$CLAUDE_DIR/skills/Media/Art/Lib" ] && echo "  OK Art/Lib" || echo "  MISSING Art/Lib"
[ -d "$CLAUDE_DIR/skills/Media/Art/Examples" ] && echo "  OK Art/Examples" || echo "  MISSING Art/Examples"

echo "Remotion subdirectories:"
[ -d "$CLAUDE_DIR/skills/Media/Remotion/Tools" ] && echo "  OK Remotion/Tools" || echo "  MISSING Remotion/Tools"
[ -d "$CLAUDE_DIR/skills/Media/Remotion/Workflows" ] && echo "  OK Remotion/Workflows" || echo "  MISSING Remotion/Workflows"
```

**Expected:** All directories present for installed subsystems.

### Check frontmatter validity

```bash
CLAUDE_DIR="$HOME/.claude"
for skill_file in \
  "$CLAUDE_DIR/skills/Media/SKILL.md" \
  "$CLAUDE_DIR/skills/Media/Art/SKILL.md" \
  "$CLAUDE_DIR/skills/Media/Remotion/SKILL.md"; do
  if [ -f "$skill_file" ]; then
    basename_dir=$(echo "$skill_file" | sed "s|$CLAUDE_DIR/skills/Media/||")
    head -1 "$skill_file" | grep -q "^---" && echo "OK $basename_dir frontmatter" || echo "ERROR $basename_dir missing frontmatter"
    grep -q "^name:" "$skill_file" && echo "OK $basename_dir has name field" || echo "ERROR $basename_dir missing name field"
    grep -q "^description:" "$skill_file" && echo "OK $basename_dir has description" || echo "ERROR $basename_dir missing description"
  fi
done
```

**Expected:** All SKILL.md files have valid YAML frontmatter with name and description fields.

### Check key workflow files

```bash
CLAUDE_DIR="$HOME/.claude"

echo "Art workflows:"
for wf in Essay.md Mermaid.md TechnicalDiagrams.md Comparisons.md Visualize.md Timelines.md; do
  [ -f "$CLAUDE_DIR/skills/Media/Art/Workflows/$wf" ] && echo "  OK $wf" || echo "  MISSING $wf"
done

echo "Art tools:"
for tool in Generate.ts ComposeThumbnail.ts GeneratePrompt.ts; do
  [ -f "$CLAUDE_DIR/skills/Media/Art/Tools/$tool" ] && echo "  OK $tool" || echo "  MISSING $tool"
done

echo "Remotion files:"
[ -f "$CLAUDE_DIR/skills/Media/Remotion/Tools/Render.ts" ] && echo "  OK Render.ts" || echo "  MISSING Render.ts"
[ -f "$CLAUDE_DIR/skills/Media/Remotion/Tools/Theme.ts" ] && echo "  OK Theme.ts" || echo "  MISSING Theme.ts"
[ -f "$CLAUDE_DIR/skills/Media/Remotion/Workflows/ContentToAnimation.md" ] && echo "  OK ContentToAnimation.md" || echo "  MISSING ContentToAnimation.md"
```

**Expected:** All key files present for installed subsystems.

---

## Dependency Checks (Informational)

These checks are NOT blocking -- the skill installs without them, but functionality depends on them.

```bash
echo "Dependencies:"

# bun runtime
if command -v bun &>/dev/null; then
  echo "  AVAILABLE bun $(bun --version)"
else
  echo "  UNAVAILABLE bun (install: curl -fsSL https://bun.sh/install | bash)"
fi

# PAI .env for API keys
PAI_DIR="$HOME/Projects/PAI"
if [ -f "$PAI_DIR/.env" ]; then
  echo "  AVAILABLE PAI .env (API keys)"
else
  echo "  UNAVAILABLE PAI .env (image generation will fail without API keys)"
fi

# Node modules for Art tools
CLAUDE_DIR="$HOME/.claude"
if [ -d "$CLAUDE_DIR/skills/Media/Art/Tools/node_modules" ]; then
  echo "  AVAILABLE Art tool dependencies installed"
else
  echo "  UNAVAILABLE Art tool dependencies (run: cd ~/.claude/skills/Media/Art/Tools && bun install)"
fi

# Node modules for Remotion tools
if [ -d "$CLAUDE_DIR/skills/Media/Remotion/Tools/node_modules" ]; then
  echo "  AVAILABLE Remotion tool dependencies installed"
else
  echo "  UNAVAILABLE Remotion tool dependencies (run: cd ~/.claude/skills/Media/Remotion/Tools && bun install)"
fi

# User customizations
if [ -d "$CLAUDE_DIR/PAI/USER/SKILLCUSTOMIZATIONS/Art" ]; then
  echo "  AVAILABLE Art customizations"
else
  echo "  INFO No Art customizations (defaults will be used)"
fi
```

---

## Installation Checklist

Mark each item as complete:

```markdown
## Media Installation Verification

### Files
- [ ] Media SKILL.md installed at ~/.claude/skills/Media/SKILL.md
- [ ] Art SKILL.md installed (if Art selected)
- [ ] Remotion SKILL.md installed (if Remotion selected)
- [ ] All SKILL.md files have valid YAML frontmatter
- [ ] Art/Workflows/ contains workflow .md files
- [ ] Art/Tools/ contains TypeScript tool files
- [ ] Art/Lib/ contains support files
- [ ] Art/Examples/ contains reference images
- [ ] Remotion/Tools/ contains Render.ts, Theme.ts, and Ref-*.md files
- [ ] Remotion/Workflows/ contains ContentToAnimation.md

### Dependencies
- [ ] bun runtime available
- [ ] API keys configured in PAI .env
- [ ] Art tool dependencies installed (bun install)
- [ ] Remotion tool dependencies installed (bun install)

### Functional (manual test)
- [ ] Requesting an image generation triggers the Art subsystem
- [ ] Generated images appear in ~/Downloads/
- [ ] Requesting video animation triggers the Remotion subsystem
```

---

## Verification Complete

When all file checks pass:

1. **Confirm to user:** "Media skill installation verified successfully"
2. **Recommend:** "Try it now: ask for a header image, diagram, or animation"
3. **Note:** "All generated content goes to ~/Downloads/ for preview first"
