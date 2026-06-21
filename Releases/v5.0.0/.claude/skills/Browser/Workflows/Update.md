# Update Workflow

---

Verify browser tools are current and working.

## When to Use

- After agent-browser releases new version
- If browser tools fail unexpectedly
- Periodic capability check

## Steps

### 1. Check Versions

```bash
agent-browser --version
```

### 2. Verify Headless agent-browser

```bash
agent-browser --session update-test open https://example.com
agent-browser --session update-test snapshot
agent-browser --session update-test screenshot /tmp/update-test.png
```

### 3. Verify One-Shot Screenshot

```bash
agent-browser open https://example.com && agent-browser screenshot /tmp/oneshot-test.png
```

### 4. Verify BrowserAgent

```
Agent(subagent_type="BrowserAgent", prompt="Navigate to https://example.com. Take a snapshot. Report page title.")
```

### 5. Verify Stories and Recipes

```bash
ls ~/.claude/skills/Browser/Stories/*.yaml
ls ~/.claude/skills/Browser/Recipes/*.md
```

## Version Tracking

```
# Last sync: 2026-04-04
# Version: 8.0.0
# Headless: agent-browser (Rust CLI daemon, headless default)
# One-shot: agent-browser open <url> && agent-browser screenshot <path>
# Agents: BrowserAgent, UIReviewer (both headless agent-browser)
# Orchestration: ReviewStories, Automate
# Custom code: NONE
```
