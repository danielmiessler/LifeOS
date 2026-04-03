# Scraping v1.0.0 - Installation Guide

**This guide is designed for AI agents installing this pack into a user's infrastructure.**

---

## AI Agent Instructions

**This is a wizard-style installation.** Use Claude Code's native tools to guide the user through installation:

1. **AskUserQuestion** - For user decisions and confirmations
2. **TodoWrite** - For progress tracking
3. **Bash/Read/Write** - For actual installation
4. **VERIFY.md** - For final validation

### Welcome Message

Before starting, greet the user:
```
"I'm installing Scraping v1.0.0 — web scraping with progressive escalation and social media platform access.

This pack adds the Scraping skill with two subsystems:
- BrightData — 4-tier progressive URL scraping (WebFetch > Curl > Playwright > Proxy)
- Apify — Direct TypeScript access to 9 social media and data platforms

Let me analyze your system and guide you through installation."
```

---

## Phase 1: System Analysis

**Execute this analysis BEFORE any file operations.**

### 1.1 Run These Commands

```bash
# Check for Claude Code skills directory
CLAUDE_DIR="$HOME/.claude"
echo "Claude directory: $CLAUDE_DIR"

# Check if skills directory exists
if [ -d "$CLAUDE_DIR/skills" ]; then
  echo "OK Skills directory exists at: $CLAUDE_DIR/skills"
else
  echo "INFO Skills directory does not exist (will be created)"
fi

# Check for existing Scraping skill
if [ -d "$CLAUDE_DIR/skills/Scraping" ]; then
  echo "WARNING Existing Scraping skill found at: $CLAUDE_DIR/skills/Scraping"
  ls -la "$CLAUDE_DIR/skills/Scraping/" 2>/dev/null
else
  echo "OK No existing Scraping skill (clean install)"
fi

# Check for BrightData subdirectory
if [ -d "$CLAUDE_DIR/skills/Scraping/BrightData" ]; then
  echo "WARNING Existing BrightData subsystem found"
else
  echo "OK No existing BrightData subsystem"
fi

# Check for Apify subdirectory
if [ -d "$CLAUDE_DIR/skills/Scraping/Apify" ]; then
  echo "WARNING Existing Apify subsystem found"
else
  echo "OK No existing Apify subsystem"
fi

# Check for bun runtime (required for Apify TypeScript tools)
if command -v bun &>/dev/null; then
  echo "OK bun runtime found: $(bun --version)"
else
  echo "WARNING bun not found (required for Apify TypeScript actor wrappers)"
fi

# Check for Apify API token
if [ -n "$APIFY_TOKEN" ]; then
  echo "OK Apify API token found in environment"
elif [ -f "$HOME/Projects/PAI/.env" ] && grep -q "APIFY_TOKEN" "$HOME/Projects/PAI/.env" 2>/dev/null; then
  echo "OK Apify API token found in PAI .env"
else
  echo "INFO Apify API token not found (needed for social media and platform scraping)"
fi

# Check for Bright Data MCP
if [ -f "$CLAUDE_DIR/mcp.json" ] 2>/dev/null; then
  if grep -q -i "bright" "$CLAUDE_DIR/mcp.json" 2>/dev/null; then
    echo "OK Bright Data MCP configured"
  else
    echo "INFO Bright Data MCP not configured (Tier 4 proxy scraping unavailable)"
  fi
else
  echo "INFO No MCP configuration found (Tier 4 proxy scraping unavailable)"
fi

# Check for Playwright
if command -v playwright &>/dev/null || npx playwright --version &>/dev/null 2>&1; then
  echo "OK Playwright available (Tier 3 browser automation)"
else
  echo "INFO Playwright not found (Tier 3 browser automation unavailable, will skip to Tier 4)"
fi

# Check for user customizations
if [ -d "$CLAUDE_DIR/PAI/USER/SKILLCUSTOMIZATIONS/BrightData" ]; then
  echo "OK BrightData customizations found"
else
  echo "INFO No BrightData customizations (skill will use defaults)"
fi

if [ -d "$CLAUDE_DIR/PAI/USER/SKILLCUSTOMIZATIONS/Apify" ]; then
  echo "OK Apify customizations found"
else
  echo "INFO No Apify customizations (skill will use defaults)"
fi
```

### 1.2 Present Findings

Tell the user what you found:
```
"Here's what I found on your system:
- Skills directory: [exists / will be created]
- Existing Scraping skill: [found -- will ask about conflict / not found]
- bun runtime: [found (version) / not found -- needed for Apify tools]
- Apify API token: [found / not found -- needed for social media scraping]
- Bright Data MCP: [configured / not configured -- needed for Tier 4 proxy]
- Playwright: [found / not found -- needed for Tier 3 browser automation]

[If bun not found]: Note: The Apify subsystem's TypeScript actor wrappers require bun.
Install it with: curl -fsSL https://bun.sh/install | bash

[If Apify token not found]: Note: Social media and platform scraping requires an Apify API token.
Get one at: https://console.apify.com/account/integrations

[If Bright Data MCP not configured]: Note: Tier 4 proxy scraping (for CAPTCHA and advanced bot detection)
requires the Bright Data MCP. Tiers 1-3 work without it."
```

---

## Phase 2: User Questions

**Use AskUserQuestion tool at each decision point.**

### Question 1: Conflict Resolution (if existing skill found)

**Only ask if existing Scraping skill detected:**

```json
{
  "header": "Conflict -- Existing Scraping Skill",
  "question": "An existing Scraping skill was found. How should I proceed?",
  "multiSelect": false,
  "options": [
    {"label": "Backup and Replace (Recommended)", "description": "Creates timestamped backup of existing skill, then installs new version"},
    {"label": "Replace Without Backup", "description": "Overwrites existing skill without backup"},
    {"label": "Abort Installation", "description": "Cancel installation, keep existing skill"}
  ]
}
```

### Question 2: Subsystem Selection

```json
{
  "header": "Subsystems",
  "question": "Which subsystems would you like to install?",
  "multiSelect": false,
  "options": [
    {"label": "Both BrightData and Apify (Recommended)", "description": "Full URL scraping + social media platform access"},
    {"label": "BrightData only", "description": "Progressive URL scraping with 4-tier escalation"},
    {"label": "Apify only", "description": "Social media and platform scraping via TypeScript actors"}
  ]
}
```

### Question 3: Final Confirmation

```json
{
  "header": "Install",
  "question": "Ready to install Scraping v1.0.0?",
  "multiSelect": false,
  "options": [
    {"label": "Yes, install now (Recommended)", "description": "Copies skill files to ~/.claude/skills/Scraping/"},
    {"label": "Show me what will change", "description": "Lists all files and directories that will be created"},
    {"label": "Cancel", "description": "Abort installation"}
  ]
}
```

**If user chose "Show me what will change":**
```
"Directories to be created:
- ~/.claude/skills/Scraping/
- ~/.claude/skills/Scraping/BrightData/
- ~/.claude/skills/Scraping/BrightData/Workflows/ (2 workflow files)
- ~/.claude/skills/Scraping/Apify/
- ~/.claude/skills/Scraping/Apify/actors/ (4 subdirectories with 9 actor wrappers)
- ~/.claude/skills/Scraping/Apify/types/ (type definitions)
- ~/.claude/skills/Scraping/Apify/skills/ (pre-built scripts)
- ~/.claude/skills/Scraping/Apify/examples/ (usage examples)
- ~/.claude/skills/Scraping/Apify/Workflows/ (1 workflow file)

No other files will be modified. No hooks, no configuration changes."
```

Then re-ask the final confirmation question.

---

## Phase 3: Backup (If Needed)

**Only execute if user chose "Backup and Replace":**

```bash
CLAUDE_DIR="$HOME/.claude"
BACKUP_DIR="$CLAUDE_DIR/Backups/scraping-skill-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup existing Scraping skill
if [ -d "$CLAUDE_DIR/skills/Scraping" ]; then
  cp -R "$CLAUDE_DIR/skills/Scraping" "$BACKUP_DIR/Scraping"
  echo "Backed up Scraping skill to: $BACKUP_DIR/Scraping"
fi

echo "Backup created at: $BACKUP_DIR"
```

---

## Phase 4: Installation

**Create a TodoWrite list to track progress:**

```json
{
  "todos": [
    {"content": "Create skill directory structure", "status": "pending", "activeForm": "Creating directories"},
    {"content": "Copy skill files", "status": "pending", "activeForm": "Copying files"},
    {"content": "Install Apify dependencies", "status": "pending", "activeForm": "Installing dependencies"},
    {"content": "Run verification", "status": "pending", "activeForm": "Running verification"}
  ]
}
```

### 4.1 Create Skill Directory Structure

**Mark todo "Create skill directory structure" as in_progress.**

```bash
CLAUDE_DIR="$HOME/.claude"
mkdir -p "$CLAUDE_DIR/skills/Scraping"
mkdir -p "$CLAUDE_DIR/skills/Scraping/BrightData/Workflows"
mkdir -p "$CLAUDE_DIR/skills/Scraping/Apify/actors/social-media"
mkdir -p "$CLAUDE_DIR/skills/Scraping/Apify/actors/business"
mkdir -p "$CLAUDE_DIR/skills/Scraping/Apify/actors/ecommerce"
mkdir -p "$CLAUDE_DIR/skills/Scraping/Apify/actors/web"
mkdir -p "$CLAUDE_DIR/skills/Scraping/Apify/types"
mkdir -p "$CLAUDE_DIR/skills/Scraping/Apify/skills"
mkdir -p "$CLAUDE_DIR/skills/Scraping/Apify/examples"
mkdir -p "$CLAUDE_DIR/skills/Scraping/Apify/Workflows"
echo "Directory structure created"
```

**Mark todo as completed.**

### 4.2 Copy Skill Files

**Mark todo "Copy skill files" as in_progress.**

```bash
PACK_DIR="$(pwd)"
CLAUDE_DIR="$HOME/.claude"

# Copy top-level SKILL.md
cp "$PACK_DIR/src/SKILL.md" "$CLAUDE_DIR/skills/Scraping/SKILL.md"

# Copy BrightData subsystem
cp -R "$PACK_DIR/src/BrightData/." "$CLAUDE_DIR/skills/Scraping/BrightData/"

# Copy Apify subsystem
cp -R "$PACK_DIR/src/Apify/." "$CLAUDE_DIR/skills/Scraping/Apify/"

echo "All skill files copied"
```

**For "BrightData only" -- skip the Apify copy.**
**For "Apify only" -- skip the BrightData copy.**

**Mark todo as completed.**

### 4.3 Install Apify Dependencies

**Mark todo "Install Apify dependencies" as in_progress.**

```bash
CLAUDE_DIR="$HOME/.claude"

# Install Apify dependencies (if Apify subsystem was installed)
if [ -f "$CLAUDE_DIR/skills/Scraping/Apify/package.json" ]; then
  cd "$CLAUDE_DIR/skills/Scraping/Apify" && bun install
  echo "Apify dependencies installed"
else
  echo "SKIP Apify not installed, skipping dependency install"
fi
```

**Mark todo as completed.**

---

## Phase 5: Verification

**Mark todo "Run verification" as in_progress.**

**Execute all checks from VERIFY.md:**

```bash
CLAUDE_DIR="$HOME/.claude"

echo "=== Scraping Skill Verification ==="

# Check SKILL.md exists
echo "Checking skill files..."
[ -f "$CLAUDE_DIR/skills/Scraping/SKILL.md" ] && echo "OK Scraping SKILL.md installed" || echo "ERROR Scraping SKILL.md missing"
[ -f "$CLAUDE_DIR/skills/Scraping/BrightData/SKILL.md" ] && echo "OK BrightData SKILL.md installed" || echo "SKIP BrightData not installed"
[ -f "$CLAUDE_DIR/skills/Scraping/Apify/SKILL.md" ] && echo "OK Apify SKILL.md installed" || echo "SKIP Apify not installed"

# Check subdirectories
echo "Checking directories..."
[ -d "$CLAUDE_DIR/skills/Scraping/BrightData/Workflows" ] && echo "OK BrightData/Workflows exists" || echo "SKIP BrightData/Workflows"
[ -d "$CLAUDE_DIR/skills/Scraping/Apify/actors" ] && echo "OK Apify/actors exists" || echo "SKIP Apify/actors"
[ -d "$CLAUDE_DIR/skills/Scraping/Apify/types" ] && echo "OK Apify/types exists" || echo "SKIP Apify/types"

# Check frontmatter
echo "Checking frontmatter..."
head -1 "$CLAUDE_DIR/skills/Scraping/SKILL.md" | grep -q "^---" && echo "OK SKILL.md has valid frontmatter" || echo "ERROR SKILL.md missing frontmatter"

# Check BrightData workflows
if [ -d "$CLAUDE_DIR/skills/Scraping/BrightData/Workflows" ]; then
  [ -f "$CLAUDE_DIR/skills/Scraping/BrightData/Workflows/FourTierScrape.md" ] && echo "OK FourTierScrape.md present" || echo "ERROR FourTierScrape.md missing"
  [ -f "$CLAUDE_DIR/skills/Scraping/BrightData/Workflows/Crawl.md" ] && echo "OK Crawl.md present" || echo "ERROR Crawl.md missing"
fi

# Check Apify actor directories
if [ -d "$CLAUDE_DIR/skills/Scraping/Apify/actors" ]; then
  for platform in social-media business ecommerce web; do
    [ -d "$CLAUDE_DIR/skills/Scraping/Apify/actors/$platform" ] && echo "OK actors/$platform present" || echo "ERROR actors/$platform missing"
  done
fi

echo ""
echo "=== Verification Complete ==="
```

**Mark todo as completed when file checks pass.**

---

## Success/Failure Messages

### On Success

```
"Scraping v1.0.0 installed successfully!

What's available:
- BrightData: 4-tier progressive URL scraping (WebFetch > Curl > Playwright > Proxy)
- BrightData: Multi-page crawling with link discovery
- Apify: 9 platform actor wrappers (Instagram, LinkedIn, TikTok, YouTube, Facebook, Google Maps, Amazon, Web Scraper)

Try it now:
- 'scrape [URL]' -- progressive URL scraping
- 'crawl [URL]' -- multi-page crawling
- 'scrape Instagram profile @username' -- social media scraping
- 'find restaurants in Austin on Google Maps' -- business data extraction

The system auto-escalates scraping tiers as needed. Social media data is filtered in code for 97-99% token savings."
```

### On Success (Without Tier 4)

```
"Scraping v1.0.0 installed successfully!

The BrightData subsystem is ready with Tiers 1-3 (WebFetch, curl, Playwright).
Tier 4 (Bright Data proxy with CAPTCHA solving) requires the Bright Data MCP.
Most URLs succeed at Tiers 1-2, so Tier 4 is only needed for heavily protected sites.

Try it now: 'scrape [any URL]'"
```

### On Failure

```
"Installation encountered issues. Here's what to check:

1. Ensure ~/.claude/ directory exists (created by Claude Code)
2. Check write permissions on ~/.claude/skills/
3. Verify bun is installed for Apify: curl -fsSL https://bun.sh/install | bash
4. Run the verification commands in VERIFY.md

Need help? Open an issue at https://github.com/danielmiessler/Personal_AI_Infrastructure/issues"
```

---

## Troubleshooting

### BrightData: All tiers fail

If Tiers 1-3 fail and Tier 4 is not configured, set up the Bright Data MCP in your Claude Code configuration for professional proxy scraping.

### Apify: "APIFY_TOKEN not set"

Get your API token from https://console.apify.com/account/integrations and set it as `APIFY_TOKEN` in your environment or PAI .env file.

### Apify: bun not found

Install bun: `curl -fsSL https://bun.sh/install | bash` -- then restart your terminal.

### Apify: Actor run out of memory

Increase the memory allocation in the actor call options. Default is 2048 MB; for large scraping jobs, try 4096 or 8192 MB.

### Social media scraper returning empty results

Some Apify actors require specific input formats. Check the SKILL.md for each actor's expected parameters (e.g., Instagram expects `username`, not a full URL).

---

## What's Included

| Path | Purpose |
|------|---------|
| `src/SKILL.md` | Top-level routing between BrightData and Apify |
| `src/BrightData/SKILL.md` | BrightData skill: activation triggers, tier descriptions |
| `src/BrightData/Workflows/FourTierScrape.md` | 4-tier progressive URL scraping |
| `src/BrightData/Workflows/Crawl.md` | Multi-page crawling and site mapping |
| `src/Apify/SKILL.md` | Apify skill: actor catalog, usage patterns |
| `src/Apify/INTEGRATION.md` | Integration architecture notes |
| `src/Apify/README.md` | Detailed documentation |
| `src/Apify/index.ts` | Main TypeScript entry point |
| `src/Apify/package.json` | Dependencies |
| `src/Apify/tsconfig.json` | TypeScript configuration |
| `src/Apify/actors/social-media/` | Instagram, LinkedIn, TikTok, YouTube, Facebook, Twitter wrappers |
| `src/Apify/actors/business/` | Google Maps wrapper |
| `src/Apify/actors/ecommerce/` | Amazon wrapper |
| `src/Apify/actors/web/` | General web scraper wrapper |
| `src/Apify/types/` | TypeScript type definitions |
| `src/Apify/skills/` | Pre-built skill scripts |
| `src/Apify/examples/` | Usage examples |
| `src/Apify/Workflows/Update.md` | Actor catalog auto-update workflow |
