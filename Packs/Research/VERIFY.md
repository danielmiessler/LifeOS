# Research Verification

> **FOR AI AGENTS:** Complete this checklist AFTER installation. Every file check must pass before declaring the pack installed. Dependency checks are informational only.

---

## File Verification

### Check SKILL.md exists at target

```bash
CLAUDE_DIR="$HOME/.claude"
[ -f "$CLAUDE_DIR/skills/Research/SKILL.md" ] && echo "OK Research SKILL.md" || echo "MISSING Research SKILL.md"
```

**Expected:** SKILL.md present at `~/.claude/skills/Research/SKILL.md`.

### Check subdirectories exist

```bash
CLAUDE_DIR="$HOME/.claude"

echo "Directories:"
[ -d "$CLAUDE_DIR/skills/Research/Workflows" ] && echo "  OK Workflows/" || echo "  MISSING Workflows/"
[ -d "$CLAUDE_DIR/skills/Research/Templates" ] && echo "  OK Templates/" || echo "  MISSING Templates/"
```

**Expected:** Both Workflows/ and Templates/ directories present.

### Check frontmatter validity

```bash
CLAUDE_DIR="$HOME/.claude"
SKILL_FILE="$CLAUDE_DIR/skills/Research/SKILL.md"

if [ -f "$SKILL_FILE" ]; then
  head -1 "$SKILL_FILE" | grep -q "^---" && echo "OK SKILL.md frontmatter" || echo "ERROR SKILL.md missing frontmatter"
  grep -q "^name:" "$SKILL_FILE" && echo "OK SKILL.md has name field" || echo "ERROR SKILL.md missing name field"
  grep -q "^description:" "$SKILL_FILE" && echo "OK SKILL.md has description" || echo "ERROR SKILL.md missing description"
fi
```

**Expected:** SKILL.md has valid YAML frontmatter with name and description fields.

### Check support files

```bash
CLAUDE_DIR="$HOME/.claude"

echo "Support files:"
[ -f "$CLAUDE_DIR/skills/Research/QuickReference.md" ] && echo "  OK QuickReference.md" || echo "  MISSING QuickReference.md"
[ -f "$CLAUDE_DIR/skills/Research/UrlVerificationProtocol.md" ] && echo "  OK UrlVerificationProtocol.md" || echo "  MISSING UrlVerificationProtocol.md"
[ -f "$CLAUDE_DIR/skills/Research/MigrationNotes.md" ] && echo "  OK MigrationNotes.md" || echo "  MISSING MigrationNotes.md"
```

**Expected:** All three support files present.

### Check all workflow files

```bash
CLAUDE_DIR="$HOME/.claude"

echo "Workflows:"
for wf in QuickResearch.md StandardResearch.md ExtensiveResearch.md DeepInvestigation.md \
          ExtractAlpha.md Retrieve.md YoutubeExtraction.md WebScraping.md \
          ClaudeResearch.md InterviewResearch.md AnalyzeAiTrends.md Fabric.md \
          Enhance.md ExtractKnowledge.md; do
  [ -f "$CLAUDE_DIR/skills/Research/Workflows/$wf" ] && echo "  OK $wf" || echo "  MISSING $wf"
done

WORKFLOW_COUNT=$(ls -1 "$CLAUDE_DIR/skills/Research/Workflows/"*.md 2>/dev/null | wc -l | tr -d ' ')
echo "Total workflows: $WORKFLOW_COUNT (expected: 14)"
```

**Expected:** All 14 workflow files present.

### Check template files

```bash
CLAUDE_DIR="$HOME/.claude"

echo "Templates:"
[ -f "$CLAUDE_DIR/skills/Research/Templates/MarketResearch.md" ] && echo "  OK MarketResearch.md" || echo "  MISSING MarketResearch.md"
[ -f "$CLAUDE_DIR/skills/Research/Templates/ThreatLandscape.md" ] && echo "  OK ThreatLandscape.md" || echo "  MISSING ThreatLandscape.md"

TEMPLATE_COUNT=$(ls -1 "$CLAUDE_DIR/skills/Research/Templates/"*.md 2>/dev/null | wc -l | tr -d ' ')
echo "Total templates: $TEMPLATE_COUNT (expected: 2)"
```

**Expected:** Both template files present.

---

## Dependency Checks (Informational)

These checks are NOT blocking -- the skill installs without them, but some workflows require them.

```bash
echo "Dependencies:"

# Perplexity API key
if [ -n "$PERPLEXITY_API_KEY" ]; then
  echo "  AVAILABLE Perplexity API key (environment variable)"
elif [ -f "$HOME/Projects/PAI/.env" ] && grep -q "PERPLEXITY" "$HOME/Projects/PAI/.env" 2>/dev/null; then
  echo "  AVAILABLE Perplexity API key (PAI .env)"
else
  echo "  UNAVAILABLE Perplexity API key (Quick/Standard/Extensive modes need this)"
fi

# Fabric CLI
if command -v fabric &>/dev/null; then
  echo "  AVAILABLE Fabric CLI ($(which fabric))"
else
  echo "  UNAVAILABLE Fabric CLI (Fabric patterns and YouTube extraction need this)"
fi

# PAI MEMORY structure
CLAUDE_DIR="$HOME/.claude"
if [ -d "$CLAUDE_DIR/MEMORY" ]; then
  echo "  AVAILABLE PAI MEMORY (research artifacts will persist)"
else
  echo "  UNAVAILABLE PAI MEMORY (deep investigation vault requires this)"
fi

# User customizations
if [ -d "$CLAUDE_DIR/PAI/USER/SKILLCUSTOMIZATIONS/Research" ]; then
  echo "  AVAILABLE Research customizations"
else
  echo "  INFO No Research customizations (defaults will be used)"
fi
```

---

## Installation Checklist

Mark each item as complete:

```markdown
## Research Installation Verification

### Files
- [ ] SKILL.md installed at ~/.claude/skills/Research/SKILL.md
- [ ] SKILL.md has valid YAML frontmatter with name and description
- [ ] QuickReference.md installed
- [ ] UrlVerificationProtocol.md installed
- [ ] MigrationNotes.md installed
- [ ] Workflows/ directory contains 14 workflow files
- [ ] Templates/ directory contains 2 template files

### Key Workflows Present
- [ ] QuickResearch.md
- [ ] StandardResearch.md
- [ ] ExtensiveResearch.md
- [ ] DeepInvestigation.md
- [ ] ExtractAlpha.md
- [ ] Fabric.md

### Dependencies (informational)
- [ ] Perplexity API key available
- [ ] Fabric CLI installed
- [ ] PAI MEMORY directory exists

### Functional (manual test)
- [ ] Saying "research [topic]" triggers Standard mode
- [ ] Saying "quick research [topic]" triggers Quick mode
- [ ] URLs in output are verified and accessible
```

---

## Verification Complete

When all file checks pass:

1. **Confirm to user:** "Research skill installation verified successfully"
2. **Recommend:** "Try it now: say 'research' followed by any topic"
3. **Note:** "Standard mode (3 agents) is the default. Say 'quick research' for fast lookups or 'extensive research' for comprehensive coverage"
