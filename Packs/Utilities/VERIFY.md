# Utilities Verification

> **FOR AI AGENTS:** Complete this checklist AFTER installation. Every file check must pass before declaring the pack installed. Dependency checks are informational only.

---

## File Verification

### Check SKILL.md exists

```bash
CLAUDE_DIR="$HOME/.claude"
[ -f "$CLAUDE_DIR/skills/Utilities/SKILL.md" ] && echo "OK SKILL.md" || echo "MISSING SKILL.md"
```

**Expected:** SKILL.md present at `~/.claude/skills/Utilities/SKILL.md`.

### Check sub-skill directories exist

```bash
CLAUDE_DIR="$HOME/.claude"
for subskill in Aphorisms AudioEditor Browser Cloudflare CreateCLI CreateSkill Delegation Documents Evals Fabric PAIUpgrade Parser Prompting; do
  [ -d "$CLAUDE_DIR/skills/Utilities/$subskill" ] && echo "OK $subskill/" || echo "MISSING $subskill/"
done
```

**Expected:** All 13 sub-skill directories present (or only those the user selected during installation).

### Check sub-skill SKILL.md files exist

```bash
CLAUDE_DIR="$HOME/.claude"
for subskill in Aphorisms AudioEditor Browser Cloudflare CreateCLI CreateSkill Delegation Documents Evals Fabric PAIUpgrade Parser Prompting; do
  if [ -d "$CLAUDE_DIR/skills/Utilities/$subskill" ]; then
    [ -f "$CLAUDE_DIR/skills/Utilities/$subskill/SKILL.md" ] && echo "OK $subskill/SKILL.md" || echo "MISSING $subskill/SKILL.md"
  fi
done
```

**Expected:** Every installed sub-skill directory contains a SKILL.md file.

### Check frontmatter is valid

```bash
CLAUDE_DIR="$HOME/.claude"
if [ -f "$CLAUDE_DIR/skills/Utilities/SKILL.md" ]; then
  head -1 "$CLAUDE_DIR/skills/Utilities/SKILL.md" | grep -q "^---" && echo "OK SKILL.md frontmatter" || echo "ERROR SKILL.md missing frontmatter"
  grep -q "^name:" "$CLAUDE_DIR/skills/Utilities/SKILL.md" && echo "OK SKILL.md has name field" || echo "ERROR SKILL.md missing name field"
  grep -q "^description:" "$CLAUDE_DIR/skills/Utilities/SKILL.md" && echo "OK SKILL.md has description" || echo "ERROR SKILL.md missing description"
fi
```

**Expected:** Frontmatter block with name and description fields present.

### Check routing table integrity

```bash
CLAUDE_DIR="$HOME/.claude"
if [ -f "$CLAUDE_DIR/skills/Utilities/SKILL.md" ]; then
  echo "Checking routing table..."
  for subskill in Aphorisms AudioEditor Browser Cloudflare CreateCLI CreateSkill Delegation Documents Evals Fabric PAIUpgrade Parser Prompting; do
    grep -q "$subskill" "$CLAUDE_DIR/skills/Utilities/SKILL.md" && echo "  OK $subskill referenced in routing table" || echo "  WARNING $subskill not found in routing table"
  done
fi
```

**Expected:** All installed sub-skills are referenced in the routing table.

### Check key sub-skill contents

```bash
CLAUDE_DIR="$HOME/.claude"

# Check sub-skills with Workflows/ directories
for subskill in Aphorisms AudioEditor Browser Cloudflare CreateCLI CreateSkill Documents Evals Fabric PAIUpgrade Parser Prompting; do
  if [ -d "$CLAUDE_DIR/skills/Utilities/$subskill" ]; then
    [ -d "$CLAUDE_DIR/skills/Utilities/$subskill/Workflows" ] && echo "OK $subskill/Workflows/" || echo "INFO $subskill/Workflows/ not present"
  fi
done

# Check Evals has its key directories
if [ -d "$CLAUDE_DIR/skills/Utilities/Evals" ]; then
  for dir in Data Graders Results Suites Tools Types UseCases Workflows; do
    [ -d "$CLAUDE_DIR/skills/Utilities/Evals/$dir" ] && echo "OK Evals/$dir/" || echo "WARNING Evals/$dir/ missing"
  done
fi

# Check Documents has format directories
if [ -d "$CLAUDE_DIR/skills/Utilities/Documents" ]; then
  for dir in Docx Pdf Pptx Xlsx Workflows; do
    [ -d "$CLAUDE_DIR/skills/Utilities/Documents/$dir" ] && echo "OK Documents/$dir/" || echo "WARNING Documents/$dir/ missing"
  done
fi

# Check Parser has its key directories
if [ -d "$CLAUDE_DIR/skills/Utilities/Parser" ]; then
  for dir in Lib Prompts Schema Tests Utils Web Workflows; do
    [ -d "$CLAUDE_DIR/skills/Utilities/Parser/$dir" ] && echo "OK Parser/$dir/" || echo "WARNING Parser/$dir/ missing"
  done
fi
```

**Expected:** Sub-skills contain their expected subdirectories.

---

## Dependency Availability (Informational)

These checks are NOT blocking -- the skill installs without these, but specific sub-skills require them at runtime.

```bash
echo "Dependencies:"
command -v bun &>/dev/null && echo "  AVAILABLE bun runtime ($(bun --version))" || echo "  UNAVAILABLE bun (needed by CreateCLI, Evals, PAIUpgrade, Parser)"
command -v ffmpeg &>/dev/null && echo "  AVAILABLE ffmpeg" || echo "  UNAVAILABLE ffmpeg (needed by AudioEditor)"
command -v wrangler &>/dev/null && echo "  AVAILABLE wrangler" || echo "  UNAVAILABLE wrangler (needed by Cloudflare)"
command -v fabric &>/dev/null && echo "  AVAILABLE fabric" || echo "  UNAVAILABLE fabric (needed by Fabric)"
```

---

## Installation Checklist

Mark each item as complete:

```markdown
## Utilities Installation Verification

### Core Files
- [ ] SKILL.md installed at ~/.claude/skills/Utilities/SKILL.md
- [ ] SKILL.md has valid YAML frontmatter with name and description
- [ ] SKILL.md contains routing table with all 13 sub-skill entries

### Sub-Skill Directories (check each installed)
- [ ] Aphorisms/ with SKILL.md, Database/, Workflows/
- [ ] AudioEditor/ with SKILL.md, Tools/, Workflows/
- [ ] Browser/ with SKILL.md, Recipes/, Stories/, Workflows/
- [ ] Cloudflare/ with SKILL.md, Workflows/
- [ ] CreateCLI/ with SKILL.md, Patterns.md, Workflows/
- [ ] CreateSkill/ with SKILL.md, Workflows/
- [ ] Delegation/ with SKILL.md
- [ ] Documents/ with SKILL.md, Docx/, Pdf/, Pptx/, Xlsx/, Workflows/
- [ ] Evals/ with SKILL.md, Data/, Graders/, Suites/, Tools/, Workflows/
- [ ] Fabric/ with SKILL.md, Patterns/, Workflows/
- [ ] PAIUpgrade/ with SKILL.md, Tools/, Workflows/
- [ ] Parser/ with SKILL.md, Lib/, Prompts/, Schema/, Workflows/
- [ ] Prompting/ with SKILL.md, Templates/, Tools/

### Dependencies (informational)
- [ ] bun runtime available
- [ ] ffmpeg available
- [ ] wrangler available
- [ ] fabric available

### Functional (manual test)
- [ ] "Create a CLI" routes to CreateCLI sub-skill
- [ ] "Parse this URL" routes to Parser sub-skill
- [ ] "Deploy to Cloudflare" routes to Cloudflare sub-skill
```

---

## Quick Functional Test

After installation, restart Claude Code and try:

```
Create a simple CLI that prints hello world
```

**Expected behavior:**
- The AI recognizes the Utilities skill and routes to CreateCLI
- CLI scaffolding begins with TypeScript patterns
- No errors or crashes

If the skill is not recognized, ensure you restarted Claude Code after installation.

---

## Verification Complete

When all file checks pass:

1. **Confirm to user:** "Utilities installation verified successfully"
2. **Recommend:** "Try any of the 13 sub-skills -- for example, 'Create a CLI that wraps the GitHub API'"
3. **Note:** "Some sub-skills require external tools (ffmpeg, wrangler, fabric) -- install as needed"
