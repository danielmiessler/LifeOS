# Browser Automation

> **PAI 3.0 Alpha** — This system is under active development. APIs, configuration formats, and features may change without notice.

**Debug-first browser automation with always-on visibility.**

**Tool:** `~/.claude/skills/Browser/Tools/Browse.ts`
**Status:** Active — Production

---

## Overview

PAI uses Playwright-based browser automation for visual verification of web development work. The Browser skill provides screenshot capture, console log monitoring, network request tracking, and error detection.

**Core Principle:** Every web development change must be verified visually before claiming completion. "Build passes" is not verification — only a screenshot showing the actual rendered page is verification.

---

## Usage

```bash
# Take a screenshot of a URL
bun run ~/.claude/skills/Browser/Tools/Browse.ts --url "http://localhost:3000" --screenshot

# Navigate and interact
bun run ~/.claude/skills/Browser/Tools/Browse.ts --url "http://localhost:3000/login" --click "#submit"
```

## When to Use Browser Automation

| Scenario | Required? |
|----------|-----------|
| Creating/modifying web pages | Yes — screenshot after every build |
| Fixing visual bugs | Yes — before AND after screenshots |
| Deploying websites | Yes — screenshot deployed page |
| Changing CSS/layout | Yes — screenshot every change |
| Server restart with new code | Yes — verify page loads |
| Any "it works" claim | Yes — screenshot as evidence |

## The Verification Loop

Every web development task follows this mandatory cycle:

```
1. Make code change
2. Build (bun run build / npm run build)
3. Restart server if needed
4. Screenshot with Browser skill
5. Compare screenshot against requirements
6. If ANY defect → go to step 1
7. If clean → report with screenshot evidence
```

## Capabilities

- **Screenshots** — Full page or element-specific capture
- **Console Monitoring** — Captures console.log, warnings, and errors
- **Network Tracking** — Records API calls and response status codes
- **Error Detection** — Identifies JavaScript errors and failed resources
- **Interactive Testing** — Click, type, navigate, wait for elements

## See Also

- Browser skill: `~/.claude/skills/Browser/`
- AI Steering Rules: "Browser-First Web Development" section

---

**Last Updated:** 2026-02-14
