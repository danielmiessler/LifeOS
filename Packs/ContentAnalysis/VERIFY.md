# ContentAnalysis Skill Verification

> **FOR AI AGENTS:** Complete this checklist AFTER installation. Every file check must pass before declaring the pack installed. Enhancement checks are informational only.

---

## File Verification

### Check SKILL.md exists

```bash
CLAUDE_DIR="$HOME/.claude"
[ -f "$CLAUDE_DIR/skills/ContentAnalysis/SKILL.md" ] && echo "OK SKILL.md" || echo "MISSING SKILL.md"
```

**Expected:** SKILL.md present at `~/.claude/skills/ContentAnalysis/SKILL.md`.

### Check directories exist

```bash
CLAUDE_DIR="$HOME/.claude"
[ -d "$CLAUDE_DIR/skills/ContentAnalysis/ExtractWisdom" ] && echo "OK ExtractWisdom/" || echo "MISSING ExtractWisdom/"
[ -d "$CLAUDE_DIR/skills/ContentAnalysis/ExtractWisdom/Workflows" ] && echo "OK ExtractWisdom/Workflows/" || echo "MISSING ExtractWisdom/Workflows/"
```

**Expected:** Both subdirectories present.

### Check sub-skill files exist

```bash
CLAUDE_DIR="$HOME/.claude"
[ -f "$CLAUDE_DIR/skills/ContentAnalysis/ExtractWisdom/SKILL.md" ] && echo "OK ExtractWisdom/SKILL.md" || echo "MISSING ExtractWisdom/SKILL.md"
[ -f "$CLAUDE_DIR/skills/ContentAnalysis/ExtractWisdom/Workflows/Extract.md" ] && echo "OK Extract.md workflow" || echo "MISSING Extract.md workflow"
```

**Expected:** Both files present.

### Check frontmatter is valid

```bash
CLAUDE_DIR="$HOME/.claude"

echo "Checking top-level SKILL.md..."
if [ -f "$CLAUDE_DIR/skills/ContentAnalysis/SKILL.md" ]; then
  head -1 "$CLAUDE_DIR/skills/ContentAnalysis/SKILL.md" | grep -q "^---" && echo "OK Has frontmatter opener" || echo "ERROR Missing frontmatter"
  grep -q "^name:" "$CLAUDE_DIR/skills/ContentAnalysis/SKILL.md" && echo "OK Has name field" || echo "ERROR Missing name field"
  grep -q "^description:" "$CLAUDE_DIR/skills/ContentAnalysis/SKILL.md" && echo "OK Has description field" || echo "ERROR Missing description"
fi

echo "Checking ExtractWisdom SKILL.md..."
if [ -f "$CLAUDE_DIR/skills/ContentAnalysis/ExtractWisdom/SKILL.md" ]; then
  head -1 "$CLAUDE_DIR/skills/ContentAnalysis/ExtractWisdom/SKILL.md" | grep -q "^---" && echo "OK Has frontmatter opener" || echo "ERROR Missing frontmatter"
  grep -q "^name:" "$CLAUDE_DIR/skills/ContentAnalysis/ExtractWisdom/SKILL.md" && echo "OK Has name field" || echo "ERROR Missing name field"
  grep -q "^description:" "$CLAUDE_DIR/skills/ContentAnalysis/ExtractWisdom/SKILL.md" && echo "OK Has description field" || echo "ERROR Missing description"
fi
```

**Expected:** Both SKILL.md files have frontmatter with name and description fields.

### Check skill content is complete

```bash
CLAUDE_DIR="$HOME/.claude"

echo "Checking top-level routing..."
if [ -f "$CLAUDE_DIR/skills/ContentAnalysis/SKILL.md" ]; then
  grep -q "Workflow Routing" "$CLAUDE_DIR/skills/ContentAnalysis/SKILL.md" && echo "  OK Has workflow routing" || echo "  ERROR Missing workflow routing"
  grep -q "ExtractWisdom" "$CLAUDE_DIR/skills/ContentAnalysis/SKILL.md" && echo "  OK References ExtractWisdom" || echo "  ERROR Missing ExtractWisdom reference"
fi

echo "Checking ExtractWisdom content..."
if [ -f "$CLAUDE_DIR/skills/ContentAnalysis/ExtractWisdom/SKILL.md" ]; then
  grep -q "Dynamic Section" "$CLAUDE_DIR/skills/ContentAnalysis/ExtractWisdom/SKILL.md" && echo "  OK Has dynamic section methodology" || echo "  ERROR Missing dynamic section methodology"
  grep -q "Depth Level" "$CLAUDE_DIR/skills/ContentAnalysis/ExtractWisdom/SKILL.md" && echo "  OK Has depth levels" || echo "  ERROR Missing depth levels"
  grep -q "Tone Rules" "$CLAUDE_DIR/skills/ContentAnalysis/ExtractWisdom/SKILL.md" && echo "  OK Has tone rules" || echo "  ERROR Missing tone rules"
  grep -q "Quality Check" "$CLAUDE_DIR/skills/ContentAnalysis/ExtractWisdom/SKILL.md" && echo "  OK Has quality checks" || echo "  ERROR Missing quality checks"
  grep -q "One-Sentence Takeaway" "$CLAUDE_DIR/skills/ContentAnalysis/ExtractWisdom/SKILL.md" && echo "  OK Has closing section definitions" || echo "  ERROR Missing closing sections"
fi
```

**Expected:** All content sections present in both files.

---

## Enhancement Availability (Informational)

These checks are NOT blocking -- the skill works without these, but output improves with them.

```bash
CLAUDE_DIR="$HOME/.claude"

echo "Enhancements:"
[ -f "$CLAUDE_DIR/PAI/USER/WRITINGSTYLE.md" ] && echo "  AVAILABLE Writing style definition (voice calibration)" || echo "  UNAVAILABLE Writing style (skill uses built-in voice standards)"
[ -d "$CLAUDE_DIR/PAI/USER/SKILLCUSTOMIZATIONS/ExtractWisdom" ] && echo "  AVAILABLE User customizations for ExtractWisdom" || echo "  UNAVAILABLE User customizations (optional, create at ~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/ExtractWisdom/)"
```

---

## Installation Checklist

Mark each item as complete:

```markdown
## ContentAnalysis Skill Installation Verification

### Files
- [ ] SKILL.md installed at ~/.claude/skills/ContentAnalysis/SKILL.md
- [ ] SKILL.md has valid YAML frontmatter with name and description
- [ ] ExtractWisdom/SKILL.md installed with full extraction methodology
- [ ] ExtractWisdom/SKILL.md has valid YAML frontmatter
- [ ] ExtractWisdom/Workflows/Extract.md installed

### Content Integrity
- [ ] Top-level SKILL.md contains workflow routing to ExtractWisdom
- [ ] ExtractWisdom SKILL.md contains dynamic section methodology
- [ ] ExtractWisdom SKILL.md contains depth level definitions (Instant through Comprehensive)
- [ ] ExtractWisdom SKILL.md contains tone rules (Level 3 conversational)
- [ ] ExtractWisdom SKILL.md contains quality check checklist

### Functional (manual test)
- [ ] "extract wisdom from [content]" triggers the ContentAnalysis skill
- [ ] Output contains dynamic sections specific to the content analyzed
- [ ] Bullets follow Level 3 conversational voice standards
```

---

## Quick Functional Test

After installation, test with any content:

```
extract wisdom from [paste a YouTube URL or article]
```

**Expected behavior:**
- The AI scans the content for wisdom domains
- Builds dynamic sections specific to what the content contains
- Outputs 5-12 sections (Full depth) with conversational bullets
- Includes closing sections: One-Sentence Takeaway, If You Only Have 2 Minutes, References and Rabbit Holes
- Section names are specific and headline-worthy, not generic categories

If the output uses static sections (IDEAS, QUOTES, HABITS, FACTS), the ExtractWisdom SKILL.md was not properly loaded.

---

## Verification Complete

When all file checks pass:

1. **Confirm to user:** "ContentAnalysis skill installation verified successfully"
2. **Recommend:** "Try it now: 'extract wisdom from' followed by a YouTube URL or article"
3. **Note:** "Customize extraction preferences at ~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/ExtractWisdom/"
