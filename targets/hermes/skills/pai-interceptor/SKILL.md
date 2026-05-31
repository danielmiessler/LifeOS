---
name: pai-interceptor
description: "Real Chrome browser automation via a browser extension interface. Zero CDP fingerprint, passes all bot detection systems. USE WHEN you need to automate a real Chrome browser in a way that avoids detection — for sites with aggressive anti-bot measures, complex web apps requiring full browser environments, or scraping tasks where headless Chrome is blocked. NOT FOR general browsing (use pai-browser), simple HTTP requests, or internal API testing."
version: 5.0.0
author: PAI v5.0 → Hermes Port
license: MIT
metadata:
  hermes:
    tags: [pai]
    related_skills: []
tags: [browser, automation, extension, chrome, undetected, interception]
---

<!-- Voice notification — fire-and-forget on invocation -->
```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the pai-interceptor skill"}' \
  > /dev/null 2>&1 &
```


# pai-interceptor: Real Chrome Browser Automation via Extension

## Workflow Routing

| Trigger | Route |
|---------|-------|
| User wants undetected browser automation | Load extension → inject scripts → execute actions → collect data |
| User needs to automate a CDP-sensitive site | Extension proxy → DOM manipulation → capture network → data extraction |
| User wants to intercept/modify network requests | Configure extension rules → navigate → capture/modify → report |
| User needs to interact with page as real user | Extension script injection → click/type/scroll → snapshot |
| User wants to extract data from JS-rendered SPA | Extension DOM snapshot → postMessage bridge → structured output |

## Step-by-Step Procedures

### 1. Extension Setup & Loading
```
1. Create extension directory structure:
   extension/
   ├── manifest.json
   ├── background.js
   ├── content.js
   ├── popup.html
   └── icons/
2. manifest.json configuration:
   {
     "manifest_version": 3,
     "name": "PAI Interceptor",
     "version": "5.0.0",
     "permissions": [
       "scripting",
       "activeTab",
       "webRequest",
       "storage",
       "tabs"
     ],
     "host_permissions": ["<all_urls>"],
     "background": { "service_worker": "background.js" },
     "content_scripts": [{
       "matches": ["<all_urls>"],
       "js": ["content.js"]
     }]
   }
3. Load extension into Chrome:
   a. Open chrome://extensions
   b. Enable Developer mode
   c. Load unpacked → select extension directory
4. Verify extension is loaded and has appropriate permissions
```

### 2. Script Injection & Execution
```
1. Extension background script exposes message API:
   - paintMessage: { action, payload }
   - Actions: "navigate", "click", "type", "extract", "snapshot"
2. Content script receives messages and executes in page context:
   a. "navigate": window.location.href = url
   b. "click": document.querySelector(selector).click()
   c. "type": Dispatch input events on element
   d. "extract": Return DOM text/attributes
   e. "snapshot": Serialize DOM structure
3. Results returned via chrome.runtime.sendMessage
4. No CDP protocol used — everything is real browser API
```

### 3. Network Interception & Modification
```
1. Register webRequest listeners in background.js:
   - chrome.webRequest.onBeforeRequest:
     Modify or block requests
   - chrome.webRequest.onBeforeSendHeaders:
     Add/modify request headers
   - chrome.webRequest.onHeadersReceived:
     Modify response headers
2. Configure interception rules:
   - Block: scripts, images, analytics
   - Modify: user-agent, referer, cookies
   - Capture: specific API responses
3. Rule configuration via storage API:
   - chrome.storage.local.set({ rules: [...] })
   - Rules evaluated in order (first match wins)
4. Captured responses stored and relayed back
```

### 4. DOM Manipulation & Data Extraction
```
1. Content script provides DOM manipulation:
   a. Query elements: querySelector, querySelectorAll
   b. Extract text: element.textContent, innerText
   c. Extract attributes: getAttribute, dataset
   d. Extract computed styles: getComputedStyle
2. Page-level script execution:
   - Execute arbitrary JS in page context
   - Access page variables and functions
   - Override or monkey-patch functions
3. Data extraction pipeline:
   a. Navigate to page
   b. Wait for specific DOM conditions
   c. Extract via content script
   d. Return structured data via messages
```

### 5. Anti-Fingerprinting Configuration
```
Since this uses a real browser extension (not CDP):
- No navigator.webdriver flag
- No CDP-specific API traces
- Standard Chrome extension API calls
- Real mouse/keyboard events (not synthesized via CDP)
- Consistent fingerprint with real browser

Additional anti-detection:
- Randomize timing of actions (100-500ms variance)
- Use natural scrolling behavior
- Avoid rapid-fire API calls
- Maintain consistent tab/window state
```

### 6. Full Automation Workflow
```
1. Load extension into Chrome instance
2. Open new tab via extension API (not CDP)
3. Navigate via content script
4. Wait for page load (DOMContentLoaded + custom selectors)
5. Execute interactions:
   a. Scroll to element
   b. Click with natural delay
   c. Type character by character with variable timing
   d. Wait for async updates
6. Extract desired data
7. Repeat for multi-step flows
8. Close tab when complete
```

## Extension Communication Protocol

```
┌──────────┐  chrome.runtime.sendMessage  ┌──────────────┐
│  Host    │ ◄──────────────────────────► │  Background   │
│  Process │                              │  Script       │
└──────────┘                              └──────┬───────┘
                                   chrome.tabs.executeScript │
                                                 │
                                          ┌──────▼───────┐
                                          │  Content      │
                                          │  Script       │
                                          │  (per tab)    │
                                          └──────┬───────┘
                                                 │
                                          Page Context
```

## Gotchas

- Extension must be manually loaded or loaded via Chrome policies
- No CDP means no network throttling, screenshot, or console capture built-in
- Extension APIs are limited to what Chrome exposes (no raw DevTools access)
- Manifest V3 has restrictions on remotely hosted code
- Content scripts run in isolated world; need window.postMessage for page JS access
- Extension may be disabled by enterprise Chrome policies
- Some sites detect extensions via API fingerprinting
- Extension is visible in chrome://extensions and toolbar
- Network interception can break sites that depend on specific resources
- Tab management requires extension to be active (not suspended)

## Execution Log Pattern

```
[PAI-INTERCEPTOR] Loading extension: PAI Interceptor v5.0.0
[EXT] Extension loaded with permissions: scripting, webRequest, tabs
[TAB] Opened new tab → https://target-site.com
[NAV] Navigation completed in 1.2s (DOMContentLoaded)
[INJECT] Content script active in page context
[CLICK] Clicked #login-button with 230ms natural delay
[TYPE] Typed "user@example.com" into #email-field (8 chars, avg 85ms/char)
[EXTRACT] Extracted dashboard data: 5 widgets, 23 data points
[COMPLETE] Automation completed — 0 CDP calls, all via extension API
```
