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

Sync Browser FileMCP with official Playwright MCP capabilities.

## When to Use

- Monthly capability check
- After Playwright MCP releases new version
- If browser commands fail unexpectedly

## Official Source

**Repository:** [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp)
**Package:** `@playwright/mcp`

## Steps

### 1. Fetch Latest API Surface

```bash
# Get Playwright MCP README (contains all tools)
curl -s https://raw.githubusercontent.com/microsoft/playwright-mcp/main/README.md > /tmp/playwright-mcp-readme.md

# Check npm package version
npm info @playwright/mcp version
```

### 2. Extract Tool Definitions

Official Playwright MCP tools (core):
- browser_click, browser_close, browser_console_messages
- browser_drag, browser_evaluate, browser_file_upload
- browser_handle_dialog, browser_hover, browser_navigate
- browser_navigate_back, browser_network_requests, browser_press_key
- browser_resize, browser_select_option, browser_snapshot
- browser_take_screenshot, browser_type, browser_wait_for
- browser_tabs, browser_pdf_save

### 3. Compare with FileMCP

| Official Tool | FileMCP Method | Status |
|---------------|----------------|--------|
| browser_click | `click()` | Implemented |
| browser_screenshot | `screenshot()` | Implemented |
| browser_navigate | `navigate()` | Implemented |
| browser_evaluate | `evaluate()` | Implemented |
| browser_fill_form | `fill()` | Implemented |
| (Vision tools) | - | Not needed |
| (Tracing) | - | Nice-to-have |

### 4. Update FileMCP if Needed

For missing critical functionality:
1. Add method to `index.ts`
2. Add CLI command to `Tools/Browse.ts`
3. Update SKILL.md documentation

### 5. Test

```bash
# Verify basic operations
bun run ~/.claude/skills/Browser/Tools/Browse.ts screenshot https://example.com /tmp/test.png
bun run ~/.claude/skills/Browser/Tools/Browse.ts verify https://example.com "body"
```

## Version Tracking

```
# Last sync: 2026-01-03
# Playwright MCP: @playwright/mcp@latest
# FileMCP coverage: 90%+ of core tools
# Known gaps: Vision tools, Testing assertions, Tracing
```
