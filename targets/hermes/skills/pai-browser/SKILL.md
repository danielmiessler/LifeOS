---
name: pai-browser
description: "Headless browser automation via Hermes browser tools. Recipe-based navigation, clicking, typing, snapshot extraction, and vision analysis."
version: 5.0.0
author: PAI v5.0 → Hermes Port
license: MIT
metadata:
  hermes:
    tags: [pai]
    related_skills: []
use_when: "You need to automate a web browser — fill forms, scrape SPAs, capture screenshots, or run recipe-based user flows on live sites."
not_for: "Static HTML parsing (use web_extract instead); large-scale crawling without rate limiting; bypassing authentication or CAPTCHA systems."
tags: [browser, automation, headless, scraping, recipes, web]
---

<!-- Voice notification — fire-and-forget on invocation -->
```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the pai-browser skill"}' \
  > /dev/null 2>&1 &
```


# pai-browser: Headless Browser Automation

## Workflow Routing

| Trigger | Route |
|---------|-------|
| User wants to visit a URL | browser_navigate → browser_snapshot → report |
| User wants to fill a form | browser_navigate → browser_type → browser_click → browser_snapshot |
| User needs visual analysis | browser_navigate → browser_vision → describe |
| User provides a recipe file | Parse recipe → execute step sequence → validate → report |
| User needs data extraction | browser_navigate → browser_snapshot → extract structured data |

## Step-by-Step Procedures

### 1. Basic Navigation & Snapshot
```
1. browser_navigate(url=user_url)
2. browser_snapshot()                    # capture current DOM state
3. Present summary of page content to user
```

### 2. Form Filling & Submission
```
1. browser_navigate(url=user_url)
2. For each field in form_spec:
   a. browser_type(selector=field_selector, text=field_value)
3. browser_click(selector=submit_button_selector)
4. browser_snapshot()                    # confirm result
5. Report success/failure
```

### 3. Recipe-Based Automation
```
1. Load recipe from file or user prompt
   - Recipe format: JSON with steps array
   - Each step: {action, selector, value?, wait_ms?}
2. For each step in recipe:
   a. If action == "navigate": browser_navigate(url=step.value)
   b. If action == "click": browser_click(selector=step.selector)
   c. If action == "type": browser_type(selector=step.selector, text=step.value)
   d. If action == "snapshot": browser_snapshot()
   e. If action == "wait": sleep(step.value_ms)
   f. If action == "vision": browser_vision(query=step.value)
3. Validate final state matches expected outcome
4. Return execution log
```

### 4. Visual Analysis Workflow
```
1. browser_navigate(url=target_url)
2. browser_snapshot()
3. browser_vision(query="Describe the current page layout, key elements, and any data tables visible")
4. Return structured description of visual content
```

### 5. Multi-Page Data Extraction
```
1. browser_navigate(url=start_url)
2. loop:
   a. browser_snapshot()
   b. Extract data from current page
   c. Try to find "next page" button selector
   d. If found: browser_click(selector=next_selector)
   e. Else: break
3. Aggregate all extracted data
4. Return as structured output
```

## Recipe Format

```json
{
  "name": "Recipe Name",
  "description": "What this recipe does",
  "steps": [
    {"action": "navigate", "value": "https://example.com"},
    {"action": "wait", "value_ms": 2000},
    {"action": "type", "selector": "#search", "value": "query"},
    {"action": "click", "selector": "button[type=submit]"},
    {"action": "snapshot", "label": "search_results"}
  ],
  "expected_outcome": "Search results page visible"
}
```

## Gotchas

- browser_* tools require the browser server to be running; check connection first
- Selectors must be valid CSS selectors supported by Playwright
- Single-page apps may need explicit waits after navigation
- browser_vision is expensive — use sparingly, prefer snapshot-based extraction
- Some sites block headless browsers; use user-agent rotation if available
- Recipes with rapid-fire actions may trigger rate limiting
- Snapshot captures DOM text but not all computed styles
- Vision queries work best with specific questions ("What color is the button?") not vague ones

## Execution Log Pattern

```
[PAI-BROWSER] Starting browser automation
[NAVIGATE] → https://example.com
[SNAPSHOT] Page loaded: "Example Domain" - 1 heading, 1 paragraph
[TYPE] #search ← "query text"
[CLICK] button[type=submit]
[SNAPSHOT] Results page: 23 items found
[COMPLETE] Browser automation finished in 4.2s
```
