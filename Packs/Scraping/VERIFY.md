# Scraping Verification

> **FOR AI AGENTS:** Complete this checklist AFTER installation. Every file check must pass before declaring the pack installed. Dependency checks are informational only.

---

## File Verification

### Check SKILL.md exists at target

```bash
CLAUDE_DIR="$HOME/.claude"
[ -f "$CLAUDE_DIR/skills/Scraping/SKILL.md" ] && echo "OK Scraping SKILL.md" || echo "MISSING Scraping SKILL.md"
[ -f "$CLAUDE_DIR/skills/Scraping/BrightData/SKILL.md" ] && echo "OK BrightData SKILL.md" || echo "MISSING BrightData SKILL.md"
[ -f "$CLAUDE_DIR/skills/Scraping/Apify/SKILL.md" ] && echo "OK Apify SKILL.md" || echo "MISSING Apify SKILL.md"
```

**Expected:** All three SKILL.md files present (or two if user chose a single subsystem).

### Check subdirectories exist

```bash
CLAUDE_DIR="$HOME/.claude"

echo "BrightData subdirectories:"
[ -d "$CLAUDE_DIR/skills/Scraping/BrightData/Workflows" ] && echo "  OK BrightData/Workflows" || echo "  MISSING BrightData/Workflows"

echo "Apify subdirectories:"
[ -d "$CLAUDE_DIR/skills/Scraping/Apify/actors" ] && echo "  OK Apify/actors" || echo "  MISSING Apify/actors"
[ -d "$CLAUDE_DIR/skills/Scraping/Apify/actors/social-media" ] && echo "  OK Apify/actors/social-media" || echo "  MISSING Apify/actors/social-media"
[ -d "$CLAUDE_DIR/skills/Scraping/Apify/actors/business" ] && echo "  OK Apify/actors/business" || echo "  MISSING Apify/actors/business"
[ -d "$CLAUDE_DIR/skills/Scraping/Apify/actors/ecommerce" ] && echo "  OK Apify/actors/ecommerce" || echo "  MISSING Apify/actors/ecommerce"
[ -d "$CLAUDE_DIR/skills/Scraping/Apify/actors/web" ] && echo "  OK Apify/actors/web" || echo "  MISSING Apify/actors/web"
[ -d "$CLAUDE_DIR/skills/Scraping/Apify/types" ] && echo "  OK Apify/types" || echo "  MISSING Apify/types"
[ -d "$CLAUDE_DIR/skills/Scraping/Apify/skills" ] && echo "  OK Apify/skills" || echo "  MISSING Apify/skills"
[ -d "$CLAUDE_DIR/skills/Scraping/Apify/examples" ] && echo "  OK Apify/examples" || echo "  MISSING Apify/examples"
[ -d "$CLAUDE_DIR/skills/Scraping/Apify/Workflows" ] && echo "  OK Apify/Workflows" || echo "  MISSING Apify/Workflows"
```

**Expected:** All directories present for installed subsystems.

### Check frontmatter validity

```bash
CLAUDE_DIR="$HOME/.claude"
for skill_file in \
  "$CLAUDE_DIR/skills/Scraping/SKILL.md" \
  "$CLAUDE_DIR/skills/Scraping/BrightData/SKILL.md" \
  "$CLAUDE_DIR/skills/Scraping/Apify/SKILL.md"; do
  if [ -f "$skill_file" ]; then
    basename_dir=$(echo "$skill_file" | sed "s|$CLAUDE_DIR/skills/Scraping/||")
    head -1 "$skill_file" | grep -q "^---" && echo "OK $basename_dir frontmatter" || echo "ERROR $basename_dir missing frontmatter"
    grep -q "^name:" "$skill_file" && echo "OK $basename_dir has name field" || echo "ERROR $basename_dir missing name field"
    grep -q "^description:" "$skill_file" && echo "OK $basename_dir has description" || echo "ERROR $basename_dir missing description"
  fi
done
```

**Expected:** All SKILL.md files have valid YAML frontmatter with name and description fields.

### Check BrightData workflow files

```bash
CLAUDE_DIR="$HOME/.claude"

echo "BrightData workflows:"
[ -f "$CLAUDE_DIR/skills/Scraping/BrightData/Workflows/FourTierScrape.md" ] && echo "  OK FourTierScrape.md" || echo "  MISSING FourTierScrape.md"
[ -f "$CLAUDE_DIR/skills/Scraping/BrightData/Workflows/Crawl.md" ] && echo "  OK Crawl.md" || echo "  MISSING Crawl.md"
```

**Expected:** Both BrightData workflow files present.

### Check Apify actor files

```bash
CLAUDE_DIR="$HOME/.claude"

echo "Apify social media actors:"
for actor in instagram.ts linkedin.ts tiktok.ts youtube.ts facebook.ts twitter.ts; do
  [ -f "$CLAUDE_DIR/skills/Scraping/Apify/actors/social-media/$actor" ] && echo "  OK $actor" || echo "  MISSING $actor"
done

echo "Apify business actors:"
[ -f "$CLAUDE_DIR/skills/Scraping/Apify/actors/business/google-maps.ts" ] && echo "  OK google-maps.ts" || echo "  MISSING google-maps.ts"

echo "Apify ecommerce actors:"
[ -f "$CLAUDE_DIR/skills/Scraping/Apify/actors/ecommerce/amazon.ts" ] && echo "  OK amazon.ts" || echo "  MISSING amazon.ts"

echo "Apify web actors:"
[ -f "$CLAUDE_DIR/skills/Scraping/Apify/actors/web/web-scraper.ts" ] && echo "  OK web-scraper.ts" || echo "  MISSING web-scraper.ts"

echo "Apify entry point and config:"
[ -f "$CLAUDE_DIR/skills/Scraping/Apify/index.ts" ] && echo "  OK index.ts" || echo "  MISSING index.ts"
[ -f "$CLAUDE_DIR/skills/Scraping/Apify/package.json" ] && echo "  OK package.json" || echo "  MISSING package.json"
[ -f "$CLAUDE_DIR/skills/Scraping/Apify/tsconfig.json" ] && echo "  OK tsconfig.json" || echo "  MISSING tsconfig.json"
```

**Expected:** All actor wrapper files and configuration files present.

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

# Apify API token
if [ -n "$APIFY_TOKEN" ]; then
  echo "  AVAILABLE Apify API token (environment)"
elif [ -f "$HOME/Projects/PAI/.env" ] && grep -q "APIFY_TOKEN" "$HOME/Projects/PAI/.env" 2>/dev/null; then
  echo "  AVAILABLE Apify API token (PAI .env)"
else
  echo "  UNAVAILABLE Apify API token (get from https://console.apify.com/account/integrations)"
fi

# Bright Data MCP
CLAUDE_DIR="$HOME/.claude"
if [ -f "$CLAUDE_DIR/mcp.json" ] && grep -q -i "bright" "$CLAUDE_DIR/mcp.json" 2>/dev/null; then
  echo "  AVAILABLE Bright Data MCP (Tier 4 proxy scraping)"
else
  echo "  UNAVAILABLE Bright Data MCP (Tier 4 proxy scraping unavailable)"
fi

# Playwright
if command -v playwright &>/dev/null || npx playwright --version &>/dev/null 2>&1; then
  echo "  AVAILABLE Playwright (Tier 3 browser automation)"
else
  echo "  UNAVAILABLE Playwright (Tier 3 browser automation unavailable)"
fi

# Apify node modules
if [ -d "$CLAUDE_DIR/skills/Scraping/Apify/node_modules" ]; then
  echo "  AVAILABLE Apify dependencies installed"
else
  echo "  UNAVAILABLE Apify dependencies (run: cd ~/.claude/skills/Scraping/Apify && bun install)"
fi

# User customizations
if [ -d "$CLAUDE_DIR/PAI/USER/SKILLCUSTOMIZATIONS/BrightData" ]; then
  echo "  AVAILABLE BrightData customizations"
else
  echo "  INFO No BrightData customizations (defaults will be used)"
fi

if [ -d "$CLAUDE_DIR/PAI/USER/SKILLCUSTOMIZATIONS/Apify" ]; then
  echo "  AVAILABLE Apify customizations"
else
  echo "  INFO No Apify customizations (defaults will be used)"
fi
```

---

## Installation Checklist

Mark each item as complete:

```markdown
## Scraping Installation Verification

### Files
- [ ] Scraping SKILL.md installed at ~/.claude/skills/Scraping/SKILL.md
- [ ] BrightData SKILL.md installed (if BrightData selected)
- [ ] Apify SKILL.md installed (if Apify selected)
- [ ] All SKILL.md files have valid YAML frontmatter
- [ ] BrightData/Workflows/ contains FourTierScrape.md and Crawl.md
- [ ] Apify/actors/social-media/ contains 6 platform wrappers
- [ ] Apify/actors/business/ contains google-maps.ts
- [ ] Apify/actors/ecommerce/ contains amazon.ts
- [ ] Apify/actors/web/ contains web-scraper.ts
- [ ] Apify entry point (index.ts) and config files present

### Dependencies
- [ ] bun runtime available (for Apify tools)
- [ ] Apify API token configured
- [ ] Bright Data MCP configured (for Tier 4)
- [ ] Apify dependencies installed (bun install)

### Functional (manual test)
- [ ] Saying "scrape [URL]" triggers BrightData 4-tier workflow
- [ ] Tier 1 (WebFetch) works on a simple public URL
- [ ] Apify social media scraper returns filtered results
```

---

## Verification Complete

When all file checks pass:

1. **Confirm to user:** "Scraping skill installation verified successfully"
2. **Recommend:** "Try it now: say 'scrape' followed by any URL"
3. **Note:** "The system auto-escalates through 4 tiers as needed. Most URLs succeed at Tier 1-2."
