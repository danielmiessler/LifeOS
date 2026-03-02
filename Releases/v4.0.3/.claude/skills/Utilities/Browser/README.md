# Browser — CLI-First Browser Automation

**`playwright-cli` for multi-step work. `bunx playwright` for one-shot screenshots. BrowserAgent only when AI reasoning is needed.**

## Architecture

| Tier | Tool | Tokens | When |
|------|------|--------|------|
| **1** | `playwright-cli` | 0 | Multi-step interaction (navigate, click, fill, assert) |
| **1b** | `bunx playwright screenshot/pdf` | 0 | Quick one-shot screenshots and PDFs |
| **2** | BrowserAgent / UIReviewer | ~30K | AI needs to decide what to do next |
| **3** | Headed Chrome (`claude --chrome`) | 0 | Authenticated sessions, extensions |

## Quick Start

```bash
# One-shot screenshot (no session needed)
bunx playwright screenshot "https://example.com" /tmp/shot.png

# Multi-step session with playwright-cli
playwright-cli -s=demo open https://example.com --persistent
playwright-cli -s=demo snapshot          # Get element refs
playwright-cli -s=demo click e6          # Click by ref
playwright-cli -s=demo screenshot --filename=/tmp/demo.png
playwright-cli -s=demo close             # ALWAYS close

# Verify a web app change
playwright-cli -s=verify open http://localhost:3000 --persistent
playwright-cli -s=verify screenshot --filename=/tmp/verify.png
# Read /tmp/verify.png with Read tool for visual inspection
playwright-cli -s=verify close
```

## Key Concepts

### Named Sessions
Every `playwright-cli` session uses `-s=<name>` for isolation. Multiple sessions run in parallel. **Always close your sessions.**

### Ref-Based Interaction
`snapshot` returns an accessibility tree with refs (`e12`, `e34`). Use these refs for `click`, `fill`, etc. — more reliable than CSS selectors.

### Zero Custom Code
Zero custom code — no TypeScript wrappers, no custom classes. Everything uses standard CLI tools:
- `playwright-cli` — named sessions, ref-based interaction
- `bunx playwright` — one-shot screenshots and PDFs
- Chrome headless — DOM dumps

## Requirements

- `@playwright/cli` (`bun install -g @playwright/cli@latest`)
- Playwright (`bun install -g playwright`)
- Chrome (for headed mode and headless CLI)

## Files

| File | Purpose |
|------|---------|
| `SKILL.md` | Full skill documentation with decision tree and workflow routing |
| `Stories/` | YAML user story definitions for UIReviewer validation |
| `Stories/README.md` | Story format documentation and conventions |
| `Stories/HackerNews.yaml` | Example: Hacker News front page validation |
| `Stories/ExampleApp.yaml` | Template: localhost app testing patterns |
| `Recipes/` | Parameterized Markdown workflow templates |
| `Recipes/README.md` | Recipe format documentation |
| `Recipes/SummarizePage.md` | Recipe: extract page content summary |
| `Recipes/ScreenshotCompare.md` | Recipe: before/after visual comparison |
| `Recipes/FormFill.md` | Recipe: fill form fields with provided data |
| `Workflows/ReviewStories.md` | Orchestrator: fan out stories to parallel UIReviewers |
| `Workflows/Automate.md` | Template engine: load and execute recipes |
| `Workflows/Update.md` | Version check and verification workflow |
| `~/.claude/agents/BrowserAgent.md` | AI-driven browser agent definition |
| `~/.claude/agents/UIReviewer.md` | User story validation agent definition |

## Related

- [BrowserAgent](~/.claude/agents/BrowserAgent.md)
- [UIReviewer](~/.claude/agents/UIReviewer.md)
- [Playwright CLI docs](https://playwright.dev)
