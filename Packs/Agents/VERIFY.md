# Agents Skill Verification

> **FOR AI AGENTS:** Complete this checklist AFTER installation. Every file check must pass before declaring the pack installed. Dependency checks are informational only.

---

## File Verification

### Check SKILL.md exists

```bash
CLAUDE_DIR="$HOME/.claude"
[ -f "$CLAUDE_DIR/skills/Agents/SKILL.md" ] && echo "OK SKILL.md" || echo "MISSING SKILL.md"
```

**Expected:** SKILL.md present at `~/.claude/skills/Agents/SKILL.md`.

### Check directories exist

```bash
CLAUDE_DIR="$HOME/.claude"
[ -d "$CLAUDE_DIR/skills/Agents/Data" ] && echo "OK Data/" || echo "MISSING Data/"
[ -d "$CLAUDE_DIR/skills/Agents/Tools" ] && echo "OK Tools/" || echo "MISSING Tools/"
[ -d "$CLAUDE_DIR/skills/Agents/Templates" ] && echo "OK Templates/" || echo "MISSING Templates/"
[ -d "$CLAUDE_DIR/skills/Agents/Workflows" ] && echo "OK Workflows/" || echo "MISSING Workflows/"
[ -d "$CLAUDE_DIR/skills/Agents/Scratchpad" ] && echo "OK Scratchpad/" || echo "MISSING Scratchpad/"
```

**Expected:** All five subdirectories present.

### Check key files exist

```bash
CLAUDE_DIR="$HOME/.claude"

echo "Data files..."
[ -f "$CLAUDE_DIR/skills/Agents/Data/Traits.yaml" ] && echo "OK Traits.yaml" || echo "MISSING Traits.yaml"

echo "Tool files..."
[ -f "$CLAUDE_DIR/skills/Agents/Tools/ComposeAgent.ts" ] && echo "OK ComposeAgent.ts" || echo "MISSING ComposeAgent.ts"
[ -f "$CLAUDE_DIR/skills/Agents/Tools/LoadAgentContext.ts" ] && echo "OK LoadAgentContext.ts" || echo "MISSING LoadAgentContext.ts"
[ -f "$CLAUDE_DIR/skills/Agents/Tools/SpawnAgentWithProfile.ts" ] && echo "OK SpawnAgentWithProfile.ts" || echo "MISSING SpawnAgentWithProfile.ts"
[ -f "$CLAUDE_DIR/skills/Agents/Tools/package.json" ] && echo "OK package.json" || echo "MISSING package.json"

echo "Template files..."
[ -f "$CLAUDE_DIR/skills/Agents/Templates/DynamicAgent.hbs" ] && echo "OK DynamicAgent.hbs" || echo "MISSING DynamicAgent.hbs"
[ -f "$CLAUDE_DIR/skills/Agents/Templates/CUSTOMAGENTTEMPLATE.md" ] && echo "OK CUSTOMAGENTTEMPLATE.md" || echo "MISSING CUSTOMAGENTTEMPLATE.md"

echo "Workflow files..."
[ -f "$CLAUDE_DIR/skills/Agents/Workflows/CreateCustomAgent.md" ] && echo "OK CreateCustomAgent.md" || echo "MISSING CreateCustomAgent.md"
[ -f "$CLAUDE_DIR/skills/Agents/Workflows/ListTraits.md" ] && echo "OK ListTraits.md" || echo "MISSING ListTraits.md"
[ -f "$CLAUDE_DIR/skills/Agents/Workflows/SpawnParallelAgents.md" ] && echo "OK SpawnParallelAgents.md" || echo "MISSING SpawnParallelAgents.md"

echo "Context files..."
for ctx in AgentPersonalities AgentProfileSystem ArchitectContext ArtistContext ClaudeResearcherContext CodexResearcherContext DesignerContext EngineerContext GeminiResearcherContext GrokResearcherContext PerplexityResearcherContext QATesterContext; do
  [ -f "$CLAUDE_DIR/skills/Agents/${ctx}.md" ] && echo "OK ${ctx}.md" || echo "MISSING ${ctx}.md"
done
```

**Expected:** All files present.

### Check frontmatter is valid

```bash
CLAUDE_DIR="$HOME/.claude"
if [ -f "$CLAUDE_DIR/skills/Agents/SKILL.md" ]; then
  head -1 "$CLAUDE_DIR/skills/Agents/SKILL.md" | grep -q "^---" && echo "OK SKILL.md has frontmatter opener" || echo "ERROR SKILL.md missing frontmatter"
  grep -q "^name:" "$CLAUDE_DIR/skills/Agents/SKILL.md" && echo "OK SKILL.md has name field" || echo "ERROR SKILL.md missing name field"
  grep -q "^description:" "$CLAUDE_DIR/skills/Agents/SKILL.md" && echo "OK SKILL.md has description field" || echo "ERROR SKILL.md missing description"
fi
```

**Expected:** Frontmatter present with name and description fields.

### Check skill content is complete

```bash
CLAUDE_DIR="$HOME/.claude"
if [ -f "$CLAUDE_DIR/skills/Agents/SKILL.md" ]; then
  echo "Checking SKILL.md content..."
  grep -q "Workflow Routing" "$CLAUDE_DIR/skills/Agents/SKILL.md" && echo "  OK Has workflow routing" || echo "  ERROR Missing workflow routing"
  grep -q "ComposeAgent" "$CLAUDE_DIR/skills/Agents/SKILL.md" && echo "  OK References ComposeAgent tool" || echo "  ERROR Missing ComposeAgent reference"
  grep -q "Traits.yaml" "$CLAUDE_DIR/skills/Agents/SKILL.md" && echo "  OK References trait library" || echo "  ERROR Missing trait library reference"
  grep -q "CREATECUSTOMAGENT\|CreateCustomAgent" "$CLAUDE_DIR/skills/Agents/SKILL.md" && echo "  OK References CreateCustomAgent workflow" || echo "  ERROR Missing workflow reference"
fi
```

**Expected:** All content sections present.

---

## Dependency Checks (Informational)

These checks are NOT blocking -- the skill files are installed regardless. Tools require these dependencies to execute.

```bash
echo "Dependencies:"

# Bun runtime
if command -v bun &> /dev/null; then
  echo "  AVAILABLE Bun runtime: $(bun --version)"
else
  echo "  UNAVAILABLE Bun runtime (install: curl -fsSL https://bun.sh/install | bash)"
fi

# Tool node_modules
CLAUDE_DIR="$HOME/.claude"
if [ -d "$CLAUDE_DIR/skills/Agents/Tools/node_modules" ]; then
  echo "  AVAILABLE Tool dependencies installed"
else
  echo "  UNAVAILABLE Tool dependencies (run: cd ~/.claude/skills/Agents/Tools && bun install)"
fi

# Voice server
curl -s -o /dev/null -w "%{http_code}" http://localhost:8888/health 2>/dev/null | grep -q "200" && echo "  AVAILABLE Voice server at localhost:8888" || echo "  UNAVAILABLE Voice server (agents work without it, text-only)"

# User customizations
if [ -d "$CLAUDE_DIR/PAI/USER/SKILLCUSTOMIZATIONS/Agents" ]; then
  echo "  AVAILABLE User customizations directory"
else
  echo "  INFO No user customizations (optional, create at ~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/Agents/)"
fi
```

---

## Installation Checklist

Mark each item as complete:

```markdown
## Agents Skill Installation Verification

### Files
- [ ] SKILL.md installed at ~/.claude/skills/Agents/SKILL.md
- [ ] SKILL.md has valid YAML frontmatter with name and description
- [ ] Data/Traits.yaml installed
- [ ] Tools/ directory with ComposeAgent.ts, LoadAgentContext.ts, SpawnAgentWithProfile.ts
- [ ] Templates/ directory with DynamicAgent.hbs and CUSTOMAGENTTEMPLATE.md
- [ ] Workflows/ directory with all three workflow files
- [ ] All agent context files (8 *Context.md files) installed
- [ ] AgentPersonalities.md and AgentProfileSystem.md installed

### Functional (manual test)
- [ ] "Spin up a custom agent" triggers the Agents skill
- [ ] "What traits are available?" shows merged trait list
- [ ] ComposeAgent.ts runs successfully: bun run ~/.claude/skills/Agents/Tools/ComposeAgent.ts --list
```

---

## Quick Functional Test

After installation, test the composition engine:

```bash
cd ~/.claude/skills/Agents/Tools && bun run ComposeAgent.ts --list
```

**Expected behavior:**
- Lists available expertise, personality, and approach traits
- Shows voice mappings
- No errors

If Bun is not installed or dependencies are missing, the test will fail but the skill files are still correctly installed.

---

## Verification Complete

When all file checks pass:

1. **Confirm to user:** "Agents skill installation verified successfully"
2. **Recommend:** "Try it now: 'Spin up 3 custom agents to review this code'"
3. **Note:** "Add your own traits and voices at ~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/Agents/"
