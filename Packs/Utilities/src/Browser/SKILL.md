---
name: Browser
description: Visual verification and browser automation via Playwright. Headless or headed Chrome. USE WHEN browser, screenshot, debug web, verify UI, troubleshoot frontend, automate browser, browse website, review stories, run stories, recipe, web automation.
version: 3.3.0
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/Browser/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.


## MANDATORY: Voice Notification (REQUIRED BEFORE ANY ACTION)

**You MUST send this notification BEFORE doing anything else when this skill is invoked.**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:8888/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the WORKFLOWNAME workflow in the Browser skill to ACTION"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running the **WorkflowName** workflow in the **Browser** skill to ACTION...
   ```

**This is not optional. Execute this curl command immediately upon skill invocation.**

# Browser v3.3.0 — CLI-First Browser Automation

**`playwright-cli` first. Agents only when reasoning is needed. Stories and Recipes for composable automation.**

---

## Workflow Routing (READ THIS FIRST)

| Trigger Words | Workflow | What It Does |
|--------------|----------|-------------|
| "review stories", "run stories", "ui review", "validate stories" | `Workflows/ReviewStories.md` | Fan out YAML stories to parallel UIReviewers |
| "automate", "recipe", "template", or a recipe name | `Workflows/Automate.md` | Load and execute a parameterized recipe template |
| "update", "check version" | `Workflows/Update.md` | Verify browser tools are current and working |

If the user's request matches a trigger above, route to that workflow. Otherwise, use the decision tree below.

---

## CLI-First Decision Tree

Every browser task enters this tree. Pick the FIRST match:

| Task | Tool | Time | Tokens | Cost |
|------|------|------|--------|------|
| **Multi-step interaction** (navigate, click, fill, assert) | `playwright-cli -s=<name>` | ~3s | 0 | Free |
| **Screenshot a URL** | `bunx playwright screenshot "<url>" <file>` | ~2s | 0 | Free |
| **Save page as PDF** | `bunx playwright pdf <url> <file>` | ~2s | 0 | Free |
| **Dump page HTML** | Chrome `--headless=new --dump-dom <url>` | ~1s | 0 | Free |
| **Check if page loads** | `curl -sf <url> > /dev/null` | <1s | 0 | Free |
| **Verify after code change** | `playwright-cli` or `bunx playwright screenshot` + Read | ~3s | 0 | Free |
| **Extract text content** | `playwright-cli -s=<name> snapshot` | ~2s | 0 | Free |
| **AI-driven multi-step interaction** (needs reasoning about what to do) | BrowserAgent | ~30s | ~30K | ~$0.09 |
| **Structured test validation** (user stories with assertions) | UIReviewer | ~30s | ~30K | ~$0.09 |
| **Parallel page checks** (8+ pages) | Multiple BrowserAgents | ~30s | ~30K each | Scales |
| **Authenticated session** (SSO, cookies, extensions) | Headed Chrome via `claude --chrome` | ~6s | 0 | Free |

**The rule:** `playwright-cli` handles most multi-step work for FREE. BrowserAgent costs 30K tokens — only pay for it when you need AI decision-making about what to click/type next.

---

## Philosophy

Browser automation should use standard CLI tools, not custom code. `playwright-cli` provides named sessions with ref-based interaction for multi-step work. `bunx playwright` handles one-shot screenshots and PDFs. BrowserAgent provides AI reasoning for complex tasks. No custom code to maintain.

**Headless by default.** All automation runs headless. When the user says "show me", open the URL in their preferred browser from `~/.claude/PAI/USER/TECHSTACKPREFERENCES.md`:

```bash
open -a "$BROWSER" "<url>"  # BROWSER from tech stack prefs
```

---

## Tier 1: playwright-cli (Primary Tool — Zero Tokens)

`playwright-cli` (`@playwright/cli`) provides named sessions, accessibility snapshots, and ref-based element interaction. This is the PRIMARY browser tool for all multi-step work.

### Session Lifecycle (CRITICAL)

Every `playwright-cli` session MUST follow this pattern:

```bash
# 1. OPEN a named session (--persistent keeps browser alive between commands)
playwright-cli -s=my-session open https://example.com --persistent

# 2. WORK — snapshot, click, fill, screenshot, etc.
playwright-cli -s=my-session snapshot
playwright-cli -s=my-session click e12
playwright-cli -s=my-session fill e15 "hello"
playwright-cli -s=my-session screenshot --filename=/tmp/shot.png

# 3. CLOSE — ALWAYS close when done. Non-negotiable.
playwright-cli -s=my-session close
```

**If you don't close your session, you leave a zombie browser process.**

### Core Commands

```bash
# Navigation
playwright-cli -s=<name> open <url> --persistent   # Open URL in named session
playwright-cli -s=<name> goto <url>                 # Navigate within session

# Inspection (zero tokens — machine-readable)
playwright-cli -s=<name> snapshot                   # Accessibility tree with refs
playwright-cli -s=<name> screenshot --filename=<path>  # Visual capture

# Interaction (use refs from snapshot)
playwright-cli -s=<name> click <ref>                # Click element by ref
playwright-cli -s=<name> fill <ref> "<value>"       # Fill input by ref
playwright-cli -s=<name> type "<text>"              # Type text (keyboard)
playwright-cli -s=<name> press <key>                # Press key (Enter, Tab, etc.)
playwright-cli -s=<name> select <ref> "<value>"     # Select dropdown option
playwright-cli -s=<name> hover <ref>                # Hover over element

# JavaScript
playwright-cli -s=<name> eval "<js>"                # Execute JavaScript

# Session management
playwright-cli -s=<name> close                      # ALWAYS close when done
```

### Ref-Based Interaction Pattern

The `snapshot` command returns an accessibility tree where every interactive element has a ref (e.g., `e12`, `e34`). Use these refs for reliable interaction:

```bash
# 1. Get the page structure
playwright-cli -s=login snapshot
# Output: heading "Login" [ref=e3], textbox "Email" [ref=e12], textbox "Password" [ref=e15], button "Sign In" [ref=e18]

# 2. Interact using refs
playwright-cli -s=login fill e12 "user@example.com"
playwright-cli -s=login fill e15 "password123"
playwright-cli -s=login click e18

# 3. Verify result
playwright-cli -s=login snapshot  # Check new page state
```

### Named Sessions for Parallelism

Each `-s=<name>` creates an isolated browser instance. Run multiple sessions simultaneously:

```bash
# Parallel: 3 independent browser sessions
playwright-cli -s=page-a open http://localhost:3000/page-a --persistent &
playwright-cli -s=page-b open http://localhost:3000/page-b --persistent &
playwright-cli -s=page-c open http://localhost:3000/page-c --persistent &
```

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `PLAYWRIGHT_MCP_VIEWPORT_SIZE` | Set viewport: `1440x900` |
| `PLAYWRIGHT_MCP_HEADLESS` | Set to `false` for headed mode |

```bash
# Custom viewport
PLAYWRIGHT_MCP_VIEWPORT_SIZE=1440x900 playwright-cli -s=wide open https://example.com --persistent
```

---

## Tier 1b: bunx playwright (Quick One-Shot Commands)

For simple one-shot operations where you don't need a session:

```bash
# Screenshot a page (no session needed)
bunx playwright screenshot "https://example.com" /tmp/screenshot.png

# Screenshot with options
bunx playwright screenshot --browser chromium --full-page "https://example.com" /tmp/full.png

# Save as PDF
bunx playwright pdf "https://example.com" /tmp/page.pdf

# Wait for network idle before screenshot
bunx playwright screenshot --wait-for-timeout 3000 "https://example.com" /tmp/loaded.png
```

### Chrome Headless CLI

```bash
# Dump DOM (raw HTML)
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --dump-dom "https://example.com"

# Screenshot
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --screenshot=/tmp/chrome-shot.png "https://example.com"

# Print to PDF
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --print-to-pdf=/tmp/page.pdf "https://example.com"
```

### Quick Checks

```bash
# Does the page load?
curl -sf "https://example.com" > /dev/null && echo "UP" || echo "DOWN"

# What status code?
curl -so /dev/null -w "%{http_code}" "https://example.com"

# Page title extraction
curl -s "https://example.com" | grep -o '<title>[^<]*</title>'
```

### VERIFY Phase (CLI-First Pattern)

The mandatory verification loop for web development:

```
1. Make code change
2. Build
3. playwright-cli -s=verify open <url> --persistent
4. playwright-cli -s=verify screenshot --filename=/tmp/verify.png
5. Read /tmp/verify.png (visual inspection via Read tool)
6. If defect → fix → go to step 2
7. If clean → playwright-cli -s=verify close → report with screenshot evidence
```

**This replaces the old pattern of spawning a BrowserAgent for every verification.** BrowserAgent verification is only needed when you need the agent to check console errors, network requests, AND interact with the page — not for simple visual checks.

---

## Tier 2: BrowserAgent & UIReviewer (When AI Reasoning Is Needed)

For tasks requiring AI decision-making about what to do next. Both agents use `playwright-cli` internally.

**When to use BrowserAgent:**
- Complex flows where you need to inspect the page to decide the next action
- Combined check: screenshot + console errors + network requests + diagnosis
- Tasks requiring adaptive navigation (SPAs, dynamic content)

**When to use UIReviewer:**
- Structured user story validation with defined steps and assertions
- Parallel test execution (one UIReviewer per story)

**Agent definitions:** `~/.claude/agents/BrowserAgent.md` and `~/.claude/agents/UIReviewer.md`

**Usage:**

```
# Multi-step interaction needing AI reasoning (worth the 30K token cost)
Task(subagent_type="BrowserAgent", prompt="
  Navigate to http://localhost:3000/login.
  Type 'admin' into the username field.
  Type 'password' into the password field.
  Click 'Sign In'.
  Wait for the dashboard to load.
  Take a screenshot.
  Check console for errors.
  Report: screenshot path, any errors, dashboard content summary.
")

# Structured test validation
Task(subagent_type="UIReviewer", prompt="
  URL: http://localhost:3000.
  Steps: 1. Click 'Blog'. 2. Assert: blog listing visible. 3. Click first article. 4. Assert: article content visible.
")

# Parallel verification (8 pages at once)
Task(subagent_type="BrowserAgent", prompt="Check http://localhost:3000/page1")
Task(subagent_type="BrowserAgent", prompt="Check http://localhost:3000/page2")
```

---

## Tier 3: Headed Chrome (Authenticated Sessions)

For tasks requiring your logged-in browser state, extensions, or cookies.

**How it works:** Claude Code's `--chrome` flag connects to your actual Chrome browser. Single session, not parallelizable, but has access to all your cookies, sessions, and extensions.

**When to use:**
- Sites requiring login you can't easily replicate (SSO, 2FA)
- Tasks that need browser extensions (Claude extension, password managers)
- Shopping, booking, account management
- Any task where "use my Chrome" makes sense

**Usage:**
```bash
# Proper way: launch Claude Code with Chrome integration
claude --chrome
```

**Mid-session workaround** (when you need headed Chrome without restarting):
```bash
# Launch Chrome with remote debugging on your profile
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/Library/Application Support/Google/Chrome" \
  --profile-directory="Default" \
  --no-first-run \
  "<url>" &
```

**Limitations:**
- Single session only (bound to your physical browser)
- NOT parallelizable
- Visible browser window required

---

## Accessibility Snapshots (Token-Efficient Browsing)

The `playwright-cli snapshot` command returns a structured accessibility tree. This is:
- **Zero tokens** — runs as a CLI command, no AI needed
- **Machine-readable** — elements have refs you can click/fill directly
- **Better for content extraction** — structured text, not pixels

Use snapshots when you need to read page content or interact with elements. Use screenshots when you need visual verification.

---

## Debugging Workflow

**Scenario: "Why isn't the user list loading?"**

**Step 1 (CLI — free):**
```bash
# Quick check: does the page load at all?
curl -so /dev/null -w "%{http_code}" "http://myapp.com/users"

# Visual check
playwright-cli -s=debug open http://myapp.com/users --persistent
playwright-cli -s=debug screenshot --filename=/tmp/debug.png
playwright-cli -s=debug snapshot  # Check page structure
playwright-cli -s=debug close
```

**Step 2 (only if CLI isn't enough — 30K tokens):**
```
Task(subagent_type="BrowserAgent", prompt="
  Navigate to http://myapp.com/users.
  Take a screenshot.
  Check console for errors.
  Check network requests for failed calls (4xx, 5xx).
  Summarize: what's working, what's broken.
")
```

---

---

## Stories — YAML User Story Validation

Define user stories in YAML format and validate them in parallel with UIReviewer agents.

**Directory:** `skills/Utilities/Browser/Stories/`

```yaml
name: App Name
url: https://example.com
stories:
  - name: Story name
    steps:
      - action: click
        target: "LLM-readable description"
    assertions:
      - type: snapshot_contains
        text: "expected text"
```

Run with: `"review stories"` or `"run stories in HackerNews.yaml"`

See `Stories/README.md` for full format documentation.

---

## Recipes — Parameterized Workflow Templates

Reusable Markdown templates with `{PROMPT}` injection and frontmatter defaults.

**Directory:** `skills/Utilities/Browser/Recipes/`

| Recipe | Description | Tool |
|--------|-------------|------|
| `SummarizePage.md` | Navigate to URL and extract content summary | BrowserAgent |
| `ScreenshotCompare.md` | Before/after screenshot comparison | playwright-cli |
| `FormFill.md` | Fill form fields with provided data | playwright-cli |

Run with: `"automate SummarizePage for https://example.com"`

See `Recipes/README.md` for full format documentation.

---

**Last Updated:** 2026-02-17
