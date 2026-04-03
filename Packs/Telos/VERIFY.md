# Telos Skill Verification

> **FOR AI AGENTS:** Complete this checklist AFTER installation. Every file check must pass before declaring the pack installed. Dependency checks are informational only.

---

## File Verification

### Check SKILL.md exists

```bash
CLAUDE_DIR="$HOME/.claude"
[ -f "$CLAUDE_DIR/skills/Telos/SKILL.md" ] && echo "OK SKILL.md" || echo "MISSING SKILL.md"
```

**Expected:** SKILL.md present at `~/.claude/skills/Telos/SKILL.md`.

### Check workflow files exist

```bash
CLAUDE_DIR="$HOME/.claude"
for wf in Update.md InterviewExtraction.md CreateNarrativePoints.md WriteReport.md; do
  [ -f "$CLAUDE_DIR/skills/Telos/Workflows/$wf" ] && echo "OK Workflows/$wf" || echo "MISSING Workflows/$wf"
done
```

**Expected:** All four workflow files present.

### Check tools exist

```bash
CLAUDE_DIR="$HOME/.claude"
[ -f "$CLAUDE_DIR/skills/Telos/Tools/UpdateTelos.ts" ] && echo "OK Tools/UpdateTelos.ts" || echo "MISSING Tools/UpdateTelos.ts"
```

**Expected:** UpdateTelos.ts present.

### Check template directories exist

```bash
CLAUDE_DIR="$HOME/.claude"

echo "DashboardTemplate:"
[ -d "$CLAUDE_DIR/skills/Telos/DashboardTemplate" ] && echo "  OK DashboardTemplate/" || echo "  MISSING DashboardTemplate/"
[ -d "$CLAUDE_DIR/skills/Telos/DashboardTemplate/App" ] && echo "  OK DashboardTemplate/App/" || echo "  MISSING DashboardTemplate/App/"
[ -d "$CLAUDE_DIR/skills/Telos/DashboardTemplate/Components" ] && echo "  OK DashboardTemplate/Components/" || echo "  MISSING DashboardTemplate/Components/"
[ -d "$CLAUDE_DIR/skills/Telos/DashboardTemplate/Lib" ] && echo "  OK DashboardTemplate/Lib/" || echo "  MISSING DashboardTemplate/Lib/"
[ -f "$CLAUDE_DIR/skills/Telos/DashboardTemplate/package.json" ] && echo "  OK DashboardTemplate/package.json" || echo "  MISSING DashboardTemplate/package.json"

echo "ReportTemplate:"
[ -d "$CLAUDE_DIR/skills/Telos/ReportTemplate" ] && echo "  OK ReportTemplate/" || echo "  MISSING ReportTemplate/"
[ -d "$CLAUDE_DIR/skills/Telos/ReportTemplate/App" ] && echo "  OK ReportTemplate/App/" || echo "  MISSING ReportTemplate/App/"
[ -d "$CLAUDE_DIR/skills/Telos/ReportTemplate/Components" ] && echo "  OK ReportTemplate/Components/" || echo "  MISSING ReportTemplate/Components/"
[ -d "$CLAUDE_DIR/skills/Telos/ReportTemplate/Lib" ] && echo "  OK ReportTemplate/Lib/" || echo "  MISSING ReportTemplate/Lib/"
[ -f "$CLAUDE_DIR/skills/Telos/ReportTemplate/package.json" ] && echo "  OK ReportTemplate/package.json" || echo "  MISSING ReportTemplate/package.json"
[ -d "$CLAUDE_DIR/skills/Telos/ReportTemplate/Public/Fonts" ] && echo "  OK ReportTemplate/Public/Fonts/" || echo "  MISSING ReportTemplate/Public/Fonts/"
```

**Expected:** Both template directories present with their subdirectories and package.json files.

### Check frontmatter validity

```bash
CLAUDE_DIR="$HOME/.claude"
skill_file="$CLAUDE_DIR/skills/Telos/SKILL.md"

if [ -f "$skill_file" ]; then
  head -1 "$skill_file" | grep -q "^---" && echo "OK SKILL.md frontmatter" || echo "ERROR SKILL.md missing frontmatter"
  grep -q "^name:" "$skill_file" && echo "OK SKILL.md has name field" || echo "ERROR SKILL.md missing name field"
  grep -q "^description:" "$skill_file" && echo "OK SKILL.md has description" || echo "ERROR SKILL.md missing description"
fi
```

**Expected:** SKILL.md has valid YAML frontmatter with `name` and `description` fields.

### Check key component files

```bash
CLAUDE_DIR="$HOME/.claude"

echo "Dashboard components:"
[ -f "$CLAUDE_DIR/skills/Telos/DashboardTemplate/App/page.tsx" ] && echo "  OK App/page.tsx" || echo "  MISSING App/page.tsx"
[ -f "$CLAUDE_DIR/skills/Telos/DashboardTemplate/App/layout.tsx" ] && echo "  OK App/layout.tsx" || echo "  MISSING App/layout.tsx"
[ -f "$CLAUDE_DIR/skills/Telos/DashboardTemplate/Components/sidebar.tsx" ] && echo "  OK Components/sidebar.tsx" || echo "  MISSING Components/sidebar.tsx"

echo "Report components:"
[ -f "$CLAUDE_DIR/skills/Telos/ReportTemplate/App/page.tsx" ] && echo "  OK App/page.tsx" || echo "  MISSING App/page.tsx"
[ -f "$CLAUDE_DIR/skills/Telos/ReportTemplate/App/layout.tsx" ] && echo "  OK App/layout.tsx" || echo "  MISSING App/layout.tsx"
[ -f "$CLAUDE_DIR/skills/Telos/ReportTemplate/Components/cover-page.tsx" ] && echo "  OK Components/cover-page.tsx" || echo "  MISSING Components/cover-page.tsx"
```

**Expected:** Key component files present in both templates.

---

## Informational Dependency Checks

These checks are NOT blocking -- the skill works without these, but functionality improves with them.

```bash
CLAUDE_DIR="$HOME/.claude"

echo "Personal TELOS availability (informational):"
if [ -d "$CLAUDE_DIR/PAI/USER/TELOS" ]; then
  echo "  AVAILABLE Personal TELOS directory"
  ls "$CLAUDE_DIR/PAI/USER/TELOS/"*.md 2>/dev/null | wc -l | xargs echo "  Files found:"
else
  echo "  UNAVAILABLE Personal TELOS (install PAI for personal life context features)"
fi

echo ""
echo "Runtime availability (informational):"
command -v bun >/dev/null 2>&1 && echo "  AVAILABLE bun (for dashboard/report builds)" || echo "  UNAVAILABLE bun (install for dashboard/report builds)"
command -v node >/dev/null 2>&1 && echo "  AVAILABLE node" || echo "  UNAVAILABLE node"

echo ""
echo "PAI integration (informational):"
[ -d "$CLAUDE_DIR/PAI" ] && echo "  AVAILABLE PAI infrastructure" || echo "  UNAVAILABLE PAI infrastructure (skill works standalone for project analysis)"
[ -d "$CLAUDE_DIR/PAI/USER/SKILLCUSTOMIZATIONS" ] && echo "  AVAILABLE Skill customizations directory" || echo "  UNAVAILABLE Skill customizations (defaults will be used)"
```

---

## Installation Checklist

Mark each item as complete:

```markdown
## Telos Skill Installation Verification

### Files
- [ ] SKILL.md installed at ~/.claude/skills/Telos/SKILL.md
- [ ] SKILL.md has valid YAML frontmatter with name and description
- [ ] Workflows/ directory with Update.md, InterviewExtraction.md, CreateNarrativePoints.md, WriteReport.md
- [ ] Tools/ directory with UpdateTelos.ts
- [ ] DashboardTemplate/ directory with App/, Components/, Lib/, package.json
- [ ] ReportTemplate/ directory with App/, Components/, Lib/, Public/Fonts/, package.json

### Functional (manual test)
- [ ] Saying "what are my TELOS goals?" reads personal TELOS files (if available)
- [ ] Saying "analyze [project dir] with TELOS" triggers project analysis
- [ ] Saying "create TELOS narrative" triggers CreateNarrativePoints workflow
```

---

## Verification Complete

When all file checks pass:

1. **Confirm to user:** "Telos skill installation verified successfully"
2. **Recommend:** "Try it now: 'analyze [any project directory] with TELOS' or 'what are my beliefs?'"
3. **Note:** "Restart Claude Code if the skill isn't recognized yet"
