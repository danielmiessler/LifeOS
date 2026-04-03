# Thinking Skill Verification

> **FOR AI AGENTS:** Complete this checklist AFTER installation. Every file check must pass before declaring the pack installed. Dependency checks are informational only.

---

## File Verification

### Check top-level SKILL.md exists

```bash
CLAUDE_DIR="$HOME/.claude"
[ -f "$CLAUDE_DIR/skills/Thinking/SKILL.md" ] && echo "OK SKILL.md" || echo "MISSING SKILL.md"
```

**Expected:** SKILL.md present at `~/.claude/skills/Thinking/SKILL.md`.

### Check thinking mode SKILL.md files

```bash
CLAUDE_DIR="$HOME/.claude"
for subdir in FirstPrinciples IterativeDepth BeCreative Council RedTeam WorldThreatModelHarness Science; do
  [ -f "$CLAUDE_DIR/skills/Thinking/$subdir/SKILL.md" ] && echo "OK $subdir/SKILL.md" || echo "MISSING $subdir/SKILL.md"
done
```

**Expected:** All seven thinking mode SKILL.md files present.

### Check workflow directories exist

```bash
CLAUDE_DIR="$HOME/.claude"
for subdir in FirstPrinciples IterativeDepth BeCreative Council RedTeam WorldThreatModelHarness Science; do
  [ -d "$CLAUDE_DIR/skills/Thinking/$subdir/Workflows" ] && echo "OK $subdir/Workflows/" || echo "MISSING $subdir/Workflows/"
done
```

**Expected:** All seven Workflows/ directories present.

### Check key workflow files exist

```bash
CLAUDE_DIR="$HOME/.claude"

echo "FirstPrinciples workflows:"
for wf in Deconstruct.md Challenge.md Reconstruct.md; do
  [ -f "$CLAUDE_DIR/skills/Thinking/FirstPrinciples/Workflows/$wf" ] && echo "  OK $wf" || echo "  MISSING $wf"
done

echo "IterativeDepth workflows:"
[ -f "$CLAUDE_DIR/skills/Thinking/IterativeDepth/Workflows/Explore.md" ] && echo "  OK Explore.md" || echo "  MISSING Explore.md"

echo "BeCreative workflows:"
for wf in StandardCreativity.md MaximumCreativity.md TreeOfThoughts.md IdeaGeneration.md DomainSpecific.md TechnicalCreativityGemini3.md; do
  [ -f "$CLAUDE_DIR/skills/Thinking/BeCreative/Workflows/$wf" ] && echo "  OK $wf" || echo "  MISSING $wf"
done

echo "Council workflows:"
for wf in Debate.md Quick.md; do
  [ -f "$CLAUDE_DIR/skills/Thinking/Council/Workflows/$wf" ] && echo "  OK $wf" || echo "  MISSING $wf"
done

echo "RedTeam workflows:"
for wf in AdversarialValidation.md ParallelAnalysis.md; do
  [ -f "$CLAUDE_DIR/skills/Thinking/RedTeam/Workflows/$wf" ] && echo "  OK $wf" || echo "  MISSING $wf"
done

echo "WorldThreatModelHarness workflows:"
for wf in TestIdea.md UpdateModels.md ViewModels.md; do
  [ -f "$CLAUDE_DIR/skills/Thinking/WorldThreatModelHarness/Workflows/$wf" ] && echo "  OK $wf" || echo "  MISSING $wf"
done

echo "Science workflows:"
for wf in DefineGoal.md GenerateHypotheses.md DesignExperiment.md MeasureResults.md AnalyzeResults.md Iterate.md FullCycle.md QuickDiagnosis.md StructuredInvestigation.md; do
  [ -f "$CLAUDE_DIR/skills/Thinking/Science/Workflows/$wf" ] && echo "  OK $wf" || echo "  MISSING $wf"
done
```

**Expected:** All 26 workflow files present across the seven thinking modes.

### Check supporting reference files

```bash
CLAUDE_DIR="$HOME/.claude"

echo "BeCreative references:"
[ -f "$CLAUDE_DIR/skills/Thinking/BeCreative/Principles.md" ] && echo "  OK Principles.md" || echo "  MISSING Principles.md"
[ -f "$CLAUDE_DIR/skills/Thinking/BeCreative/Templates.md" ] && echo "  OK Templates.md" || echo "  MISSING Templates.md"
[ -f "$CLAUDE_DIR/skills/Thinking/BeCreative/Examples.md" ] && echo "  OK Examples.md" || echo "  MISSING Examples.md"
[ -f "$CLAUDE_DIR/skills/Thinking/BeCreative/ResearchFoundation.md" ] && echo "  OK ResearchFoundation.md" || echo "  MISSING ResearchFoundation.md"
[ -d "$CLAUDE_DIR/skills/Thinking/BeCreative/Assets" ] && echo "  OK Assets/" || echo "  MISSING Assets/"

echo "Council references:"
[ -f "$CLAUDE_DIR/skills/Thinking/Council/CouncilMembers.md" ] && echo "  OK CouncilMembers.md" || echo "  MISSING CouncilMembers.md"
[ -f "$CLAUDE_DIR/skills/Thinking/Council/OutputFormat.md" ] && echo "  OK OutputFormat.md" || echo "  MISSING OutputFormat.md"
[ -f "$CLAUDE_DIR/skills/Thinking/Council/RoundStructure.md" ] && echo "  OK RoundStructure.md" || echo "  MISSING RoundStructure.md"

echo "RedTeam references:"
[ -f "$CLAUDE_DIR/skills/Thinking/RedTeam/Philosophy.md" ] && echo "  OK Philosophy.md" || echo "  MISSING Philosophy.md"
[ -f "$CLAUDE_DIR/skills/Thinking/RedTeam/Integration.md" ] && echo "  OK Integration.md" || echo "  MISSING Integration.md"

echo "IterativeDepth references:"
[ -f "$CLAUDE_DIR/skills/Thinking/IterativeDepth/TheLenses.md" ] && echo "  OK TheLenses.md" || echo "  MISSING TheLenses.md"
[ -f "$CLAUDE_DIR/skills/Thinking/IterativeDepth/ScientificFoundation.md" ] && echo "  OK ScientificFoundation.md" || echo "  MISSING ScientificFoundation.md"

echo "WorldThreatModelHarness references:"
[ -f "$CLAUDE_DIR/skills/Thinking/WorldThreatModelHarness/ModelTemplate.md" ] && echo "  OK ModelTemplate.md" || echo "  MISSING ModelTemplate.md"
[ -f "$CLAUDE_DIR/skills/Thinking/WorldThreatModelHarness/OutputFormat.md" ] && echo "  OK OutputFormat.md" || echo "  MISSING OutputFormat.md"

echo "Science references:"
[ -f "$CLAUDE_DIR/skills/Thinking/Science/METHODOLOGY.md" ] && echo "  OK METHODOLOGY.md" || echo "  MISSING METHODOLOGY.md"
[ -f "$CLAUDE_DIR/skills/Thinking/Science/Protocol.md" ] && echo "  OK Protocol.md" || echo "  MISSING Protocol.md"
[ -f "$CLAUDE_DIR/skills/Thinking/Science/Examples.md" ] && echo "  OK Examples.md" || echo "  MISSING Examples.md"
[ -f "$CLAUDE_DIR/skills/Thinking/Science/Templates.md" ] && echo "  OK Templates.md" || echo "  MISSING Templates.md"
```

**Expected:** All supporting reference files present.

### Check frontmatter validity

```bash
CLAUDE_DIR="$HOME/.claude"
for skill_file in \
  "$CLAUDE_DIR/skills/Thinking/SKILL.md" \
  "$CLAUDE_DIR/skills/Thinking/FirstPrinciples/SKILL.md" \
  "$CLAUDE_DIR/skills/Thinking/IterativeDepth/SKILL.md" \
  "$CLAUDE_DIR/skills/Thinking/BeCreative/SKILL.md" \
  "$CLAUDE_DIR/skills/Thinking/Council/SKILL.md" \
  "$CLAUDE_DIR/skills/Thinking/RedTeam/SKILL.md" \
  "$CLAUDE_DIR/skills/Thinking/WorldThreatModelHarness/SKILL.md" \
  "$CLAUDE_DIR/skills/Thinking/Science/SKILL.md"; do
  if [ -f "$skill_file" ]; then
    basename_dir=$(echo "$skill_file" | sed "s|$CLAUDE_DIR/skills/Thinking/||")
    head -1 "$skill_file" | grep -q "^---" && echo "OK $basename_dir frontmatter" || echo "ERROR $basename_dir missing frontmatter"
    grep -q "^name:" "$skill_file" && echo "OK $basename_dir has name field" || echo "ERROR $basename_dir missing name field"
    grep -q "^description:" "$skill_file" && echo "OK $basename_dir has description" || echo "ERROR $basename_dir missing description"
  fi
done
```

**Expected:** All eight SKILL.md files have valid YAML frontmatter with `name` and `description` fields.

---

## Informational Dependency Checks

These checks are NOT blocking -- the Thinking skill has no external dependencies.

```bash
echo "PAI integration (informational):"
CLAUDE_DIR="$HOME/.claude"
[ -d "$CLAUDE_DIR/PAI" ] && echo "  AVAILABLE PAI infrastructure" || echo "  UNAVAILABLE PAI infrastructure (skill works standalone)"
[ -d "$CLAUDE_DIR/PAI/USER/SKILLCUSTOMIZATIONS" ] && echo "  AVAILABLE Skill customizations directory" || echo "  UNAVAILABLE Skill customizations (defaults will be used)"

echo ""
echo "The Thinking skill has no external dependencies."
echo "All seven modes work immediately after installation."
```

---

## Installation Checklist

Mark each item as complete:

```markdown
## Thinking Skill Installation Verification

### Files
- [ ] Top-level SKILL.md installed at ~/.claude/skills/Thinking/SKILL.md
- [ ] FirstPrinciples/SKILL.md installed with Workflows/ (3 workflows)
- [ ] IterativeDepth/SKILL.md installed with Workflows/ (1 workflow) and reference files
- [ ] BeCreative/SKILL.md installed with Workflows/ (6 workflows), Assets/, and reference files
- [ ] Council/SKILL.md installed with Workflows/ (2 workflows) and reference files
- [ ] RedTeam/SKILL.md installed with Workflows/ (2 workflows) and reference files
- [ ] WorldThreatModelHarness/SKILL.md installed with Workflows/ (3 workflows) and reference files
- [ ] Science/SKILL.md installed with Workflows/ (9 workflows) and reference files
- [ ] All SKILL.md files have valid YAML frontmatter

### Functional (manual test)
- [ ] Saying "decompose from first principles" triggers FirstPrinciples mode
- [ ] Saying "be creative" triggers BeCreative mode
- [ ] Saying "council debate" triggers Council mode
- [ ] Saying "red team this" triggers RedTeam mode
- [ ] Saying "figure out why" triggers Science mode
```

---

## Verification Complete

When all file checks pass:

1. **Confirm to user:** "Thinking skill installation verified successfully"
2. **Recommend:** "Try it now: 'decompose this from first principles', 'council debate on [topic]', or 'figure out why [problem]'"
3. **Note:** "Restart Claude Code if the skill isn't recognized yet"
