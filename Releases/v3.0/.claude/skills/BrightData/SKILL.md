---
name: BrightData
description: Progressive URL scraping. USE WHEN Bright Data, scrape URL, web scraping tiers. SkillSearch('brightdata') for docs.
context: fork
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/skills/PAI/USER/SKILLCUSTOMIZATIONS/BrightData/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.


## 🚨 MANDATORY: Voice Notification (REQUIRED BEFORE ANY ACTION)

**You MUST send this notification BEFORE doing anything else when this skill is invoked.**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:8888/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the WORKFLOWNAME workflow in the BrightData skill to ACTION"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running the **WorkflowName** workflow in the **BrightData** skill to ACTION...
   ```

**This is not optional. Execute this curl command immediately upon skill invocation.**

## Workflow Routing

**When executing a workflow, output this notification directly:**

```
Running the **WorkflowName** workflow in the **Brightdata** skill to ACTION...
```

**CRITICAL: This workflow implements progressive escalation for URL content retrieval.**

**When user requests scraping/fetching URL content:**
Examples: "scrape this URL", "fetch this page", "get content from [URL]", "pull content from this site", "retrieve [URL]", "can't access this site", "this site is blocking me", "use Bright Data to fetch"
→ **READ:** ~/.claude/skills/brightdata/Workflows/Four-tier-scrape.md
→ **EXECUTE:** Four-tier progressive scraping workflow (WebFetch → Curl → Browser Automation → Bright Data MCP)

---

## When to Activate This Skill

### Direct Scraping Requests (Categories 1-4)
- "scrape this URL", "scrape [URL]", "scrape this page"
- "fetch this URL", "fetch [URL]", "fetch this page", "fetch content from"
- "pull content from [URL]", "pull this page", "pull from this site"
- "get content from [URL]", "retrieve [URL]", "retrieve this page"
- "do scraping on [URL]", "run scraper on [URL]"
- "basic scrape", "quick scrape", "simple fetch"
- "comprehensive scrape", "deep scrape", "full content extraction"

### Access & Bot Detection Issues (Categories 5-7)
- "can't access this site", "site is blocking me", "getting blocked"
- "bot detection", "CAPTCHA", "access denied", "403 error"
- "need to bypass bot detection", "get around blocking"
- "this URL won't load", "can't fetch this page"
- "use Bright Data", "use the scraper", "use advanced scraping"

### Result-Oriented Requests (Category 8)
- "get me the content from [URL]"
- "extract text from [URL]"
- "download this page content"
- "convert [URL] to markdown"
- "need the HTML from this site"

### Use Case Indicators
- User needs web content for research or analysis
- Standard methods (WebFetch) are failing
- Site has bot detection or rate limiting
- Need reliable content extraction
- Converting web pages to structured format (markdown)

---

## Core Capabilities

**Progressive Escalation Strategy:**
1. **Tier 1: WebFetch** - Fast, simple, built-in Claude Code tool
2. **Tier 2: Customized Curl** - Chrome-like browser headers to bypass basic bot detection
3. **Tier 3: Browser Automation** - Full browser automation using Playwright for JavaScript-heavy sites
4. **Tier 4: Bright Data MCP** - Professional scraping service that handles CAPTCHA and advanced bot detection

**Key Features:**
- Automatic fallback between tiers
- Preserves content in markdown format
- Handles bot detection and CAPTCHA
- Works with any URL
- Efficient resource usage (only escalates when needed)

---

## Workflow Overview

**four-tier-scrape.md** - Complete URL content scraping with four-tier fallback strategy
- **When to use:** Any URL content retrieval request
- **Process:** Start with WebFetch → If fails, use curl with Chrome headers → If fails, use Browser Automation → If fails, use Bright Data MCP
- **Output:** URL content in markdown format

---

## Extended Context

**Integration Points:**
- **WebFetch Tool** - Built-in Claude Code tool for basic URL fetching
- **Bash Tool** - For executing curl commands with custom headers
- **Browser Automation** - Playwright-based browser automation for JavaScript rendering
- **Bright Data MCP** - `mcp__Brightdata__scrape_as_markdown` for advanced scraping

**When Each Tier Is Used:**
- **Tier 1 (WebFetch):** Simple sites, public content, no bot detection
- **Tier 2 (Curl):** Sites with basic user-agent checking, simple bot detection
- **Tier 3 (Browser Automation):** Sites requiring JavaScript execution, dynamic content loading
- **Tier 4 (Bright Data):** Sites with CAPTCHA, advanced bot detection, residential proxy requirements

**Configuration:**
No configuration required - all tools are available by default in Claude Code

---

## Examples

**Example 1: Simple Public Website**

User: "Scrape https://example.com"

Skill Response:
1. Routes to three-tier-scrape.md
2. Attempts Tier 1 (WebFetch)
3. Success → Returns content in markdown
4. Total time: <5 seconds

**Example 2: Site with JavaScript Requirements**

User: "Can't access this site https://dynamic-site.com"

Skill Response:
1. Routes to four-tier-scrape.md
2. Attempts Tier 1 (WebFetch) → Fails (blocked)
3. Attempts Tier 2 (Curl with Chrome headers) → Fails (JavaScript required)
4. Attempts Tier 3 (Browser Automation) → Success
5. Returns content in markdown
6. Total time: ~15-20 seconds

**Example 3: Site with Advanced Bot Detection**

User: "Scrape https://protected-site.com"

Skill Response:
1. Routes to four-tier-scrape.md
2. Attempts Tier 1 (WebFetch) → Fails (blocked)
3. Attempts Tier 2 (Curl) → Fails (advanced detection)
4. Attempts Tier 3 (Browser Automation) → Fails (CAPTCHA)
5. Attempts Tier 4 (Bright Data MCP) → Success
6. Returns content in markdown
7. Total time: ~30-40 seconds

**Example 4: Explicit Bright Data Request**

User: "Use Bright Data to fetch https://difficult-site.com"

Skill Response:
1. Routes to four-tier-scrape.md
2. User explicitly requested Bright Data
3. Goes directly to Tier 4 (Bright Data MCP) → Success
4. Returns content in markdown
5. Total time: ~5-10 seconds

---

**Related Documentation:**
- `~/.claude/skills/PAI/SkillSystem.md` - Canonical structure guide
- `~/.claude/skills/PAI/CONSTITUTION.md` - Overall PAI philosophy

**Last Updated:** 2025-11-23
