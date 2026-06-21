---
name: Browser
description: "Headless browser automation via agent-browser — Rust CLI daemon with persistent auth profiles for fast, scriptable, parallel browser work. Supports batch commands, network interception, device emulation, per-site profile auth (one-time headed login, headless forever after), and parallel isolated sessions via --session. Workflows: ReviewStories (fan out YAML user stories to parallel UIReviewers), Automate (load/run parameterized recipe templates), Update. Delegates to general-purpose agents with agent-browser instructions for background parallel scraping. Falls back to Interceptor if site has bot detection. USE WHEN headless browser, batch scrape, fast screenshot, dev server test, parallel browser, background automation, extract data, review stories, automate recipe, batch screenshots, scrape multiple pages in parallel. NOT FOR deploy verification or UI confirmation with real Chrome (use Interceptor). NOT FOR simple single-URL fetching (use WebFetch). NOT FOR CAPTCHA or bot-detection bypass (use BrightData or Interceptor)."
version: 10.0.0
effort: medium
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/Browser/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# Browser v10.0.0 — Browser Automation

**Tool:** `agent-browser` — headless Rust CLI daemon with persistent auth profiles.

**If agent-browser isn't working or a site has bot detection, use the Interceptor skill instead.** Interceptor is a Chrome extension with zero CDP fingerprint — passes all major bot detection checks.

### Does the site need auth?

Use `--profile ~/.agent-browser/profiles/<site>`. If profile exists, auth is automatic. If not, run `--headed` once for login, then headless forever.

---

## agent-browser

Native Rust daemon. Persistent profiles for auth. Headless by default.

### Quick One-Shot Commands

```bash
agent-browser open https://example.com && agent-browser screenshot /tmp/shot.png
agent-browser open https://example.com && agent-browser screenshot --full /tmp/full.png
agent-browser open https://example.com && agent-browser pdf /tmp/page.pdf
```

### Session-Based Interaction

```bash
# 1. OPEN
agent-browser open https://example.com

# 2. WORK
agent-browser snapshot                    # a11y tree with @eN refs (for AI)
agent-browser click @e12                  # click by ref
agent-browser fill @e15 "hello"           # fill input by ref
agent-browser screenshot /tmp/shot.png    # screenshot
agent-browser eval "document.title"       # run JS

# 3. CLOSE — when done
agent-browser close
```

### Authenticated Browsing (Per-Site Profiles)

**First-time setup (headed, one-time):**
```bash
# Close any running daemon first
agent-browser close --all

# Launch headed with persistent profile — log in manually
agent-browser --headed --profile ~/.agent-browser/profiles/<site> open https://example.com

# After login completes, all future runs reuse the profile headlessly
```

**Subsequent runs (headless, automatic):**
```bash
agent-browser --profile ~/.agent-browser/profiles/<site> open https://example.com
# Auth is automatic — cookies, IndexedDB, cache all persist
```

**To add a new site:** Close daemon, run `--headed --profile ~/.agent-browser/profiles/<name>` once, log in, done.

### Auth Vault (Alternative)

```bash
agent-browser auth save mysite --url https://example.com --username user --password-stdin
agent-browser auth login mysite    # auto-fills login form
agent-browser auth list            # show saved profiles
```

### Batch Execution

```bash
# Send multiple commands in one shot (fewer tool calls = fewer tokens)
echo '[["open","https://example.com"],["snapshot"],["click","@e12"]]' | agent-browser batch
```

### Advanced Features

```bash
# Connect to already-running Chrome
agent-browser --auto-connect snapshot

# Network interception
agent-browser route "**/*.{png,jpg}" abort     # block images
agent-browser route "https://api.com/*" mock '{"data":"test"}'

# Device emulation
agent-browser --device "iPhone 15" open https://example.com

# Session persistence (cookies + localStorage by name)
agent-browser --session-name myapp open https://example.com
```

### agent-browser Rules

- **Daemon model** — first command starts daemon, subsequent commands connect instantly.
- **Refs use @eN syntax** — `@e12` not `e12`.
- **Profiles persist everything** — cookies, IndexedDB, cache, localStorage.
- **Close with `agent-browser close`** or `close --all` to kill daemon.

---

### Delegating Browser Work to Agents

When you need parallel or background browser work (scraping multiple pages, monitoring), spawn **general-purpose agents** with browser instructions. No dedicated browser agent type needed — this skill IS the expertise.

```
Agent(subagent_type="general-purpose", prompt="
  Use agent-browser CLI for all browser work.
  Commands: open <url>, snapshot, click @eN, fill @eN 'text', screenshot /path.
  For authenticated sites: --profile ~/.agent-browser/profiles/<site>
  Refs use @eN syntax from snapshots.
  [your specific task instructions here]
")
```

For parallel isolation, each agent uses `--session <name>`:
```
Agent 1: agent-browser --session scrape1 open https://site-a.com
Agent 2: agent-browser --session scrape2 open https://site-b.com
```

**Fallback:** If agent-browser fails or the site has bot detection, use the **Interceptor** skill instead.

**Legacy built-in agents — DEPRECATED, do not invoke.** BrowserAgent and UIReviewer are Claude Code built-ins whose internals cannot be modified; they run browser automation that PAI no longer uses. Route all browser work through the **Interceptor** skill (verification, authenticated flows) or **agent-browser** (headless scraping).

---

## Workflow Routing

| Trigger Words | Workflow | What It Does |
|--------------|----------|-------------|
| "review stories", "run stories", "ui review", "validate stories" | `Workflows/ReviewStories.md` | Fan out YAML stories to parallel UIReviewers |
| "automate", "recipe", "template", or a recipe name | `Workflows/Automate.md` | Load and execute a parameterized recipe template |
| "update", "check version" | `Workflows/Update.md` | Verify browser tools are current and working |

---

## Stories — YAML User Story Validation

Define user stories in YAML and validate them in parallel with UIReviewer agents.

**Directory:** `skills/Browser/Stories/`

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

---

## Recipes — Parameterized Templates

Reusable Markdown templates with `{PROMPT}` injection.

**Directory:** `skills/Browser/Recipes/`

| Recipe | Description | Tool |
|--------|-------------|------|
| `SummarizePage.md` | Extract content summary | BrowserAgent |
| `ScreenshotCompare.md` | Before/after comparison | agent-browser |
| `FormFill.md` | Fill form fields | agent-browser |

Run with: `"automate SummarizePage for https://example.com"`

---

## Execution Log

After completing any workflow, append a single JSONL entry:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"Browser","workflow":"WORKFLOW_USED","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> ~/.claude/PAI/MEMORY/SKILLS/execution.jsonl
```
