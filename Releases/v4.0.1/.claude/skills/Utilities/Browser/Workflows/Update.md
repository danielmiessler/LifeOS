# Update Workflow

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the Update workflow in the Browser skill to sync capabilities"}' \
  > /dev/null 2>&1 &
```

Running **Update** in **Browser**...

---

Verify browser tools are current and working.

## When to Use

- After playwright-cli or Playwright releases new version
- If browser tools fail unexpectedly
- Periodic capability check

## Steps

### 1. Check Versions

```bash
playwright-cli --version
bunx playwright --version
```

### 2. Verify playwright-cli Works

```bash
# Open a test session
playwright-cli -s=update-test open https://example.com --persistent

# Get snapshot
playwright-cli -s=update-test snapshot

# Screenshot
playwright-cli -s=update-test screenshot --filename=/tmp/update-test.png

# Close session
playwright-cli -s=update-test close
```

### 3. Verify bunx playwright Works

```bash
bunx playwright screenshot "https://example.com" /tmp/bunx-test.png
```

### 4. Verify BrowserAgent Works

```
Task(subagent_type="BrowserAgent", prompt="Navigate to https://example.com. Take a snapshot. Report page title.")
```

### 5. Core playwright-cli Commands Reference

| Command | Purpose |
|---------|---------|
| `open <url> --persistent` | Start named session |
| `goto <url>` | Navigate within session |
| `snapshot` | Accessibility tree with refs |
| `screenshot --filename=<path>` | Visual capture |
| `click <ref>` | Click element |
| `fill <ref> "<value>"` | Fill input |
| `type "<text>"` | Type text |
| `press <key>` | Press key |
| `select <ref> "<value>"` | Select option |
| `hover <ref>` | Hover element |
| `eval "<js>"` | Run JavaScript |
| `close` | End session |

### 6. Verify Stories and Recipes Directories

```bash
# Stories directory exists with YAML files
ls skills/Utilities/Browser/Stories/*.yaml

# Recipes directory exists with template files
ls skills/Utilities/Browser/Recipes/*.md
```

### 7. Validate Story Pipeline

```
# Quick validation: run one story from HackerNews.yaml
Task(subagent_type="UIReviewer", prompt="
  Validate Hacker News front page loads.
  URL: https://news.ycombinator.com
  Steps: 1. Wait for page to load.
  Assertions: 1. Page contains 'Hacker News'. 2. Story links are visible.
")
```

## Version Tracking

```
# Last sync: 2026-02-17
# Version: 3.3.0
# Primary tool: playwright-cli (@playwright/cli)
# Fallback: bunx playwright (one-shot screenshots/PDFs)
# Agents: BrowserAgent, UIReviewer (both use playwright-cli internally)
# Headed mode: claude --chrome (Claude Code Chrome integration)
# Orchestration: ReviewStories (parallel story validation), Automate (recipe templates)
# Custom code: NONE
```
