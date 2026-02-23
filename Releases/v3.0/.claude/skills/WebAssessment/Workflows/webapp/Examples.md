# Web Application Testing Examples

## Overview
Common Playwright testing patterns for web application security testing and functionality verification.

## Examples Location
`~/.claude/skills/Webassessment/webapp-examples/`

## Available Examples

### 1. Element Discovery (`element_discovery.py`)

**Purpose:** Discover buttons, links, and inputs on a page using Playwright's locator API.

**When to use:**
- Reconnaissance on unknown web applications
- Finding interactive elements for testing
- Building test automation scripts

**Example Usage:**
```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('https://example.com')
    page.wait_for_load_state('networkidle')

    # Discover all buttons
    buttons = page.locator('button').all()
    print(f"Found {len(buttons)} buttons")

    # Discover all links
    links = page.locator('a').all()
    print(f"Found {len(links)} links")

    # Discover all inputs
    inputs = page.locator('input').all()
    print(f"Found {len(inputs)} inputs")

    browser.close()
```

**Key Patterns:**
- Use `locator()` for flexible element selection
- Use `.all()` to get all matching elements
- Use role-based selectors for accessibility

### 2. Static HTML Automation (`static_html_automation.py`)

**Purpose:** Test local HTML files without running a web server.

**When to use:**
- Testing static HTML pages
- Rapid prototyping and iteration
- Offline testing scenarios

**Example Usage:**
```python
from playwright.sync_api import sync_playwright
from pathlib import Path

html_file = Path('/path/to/file.html').absolute()
file_url = f'file://{html_file}'

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto(file_url)

    # Since it's static, no need to wait for networkidle
    # Directly interact with elements
    page.locator('button#submit').click()

    # Check results
    result = page.locator('#result').inner_text()
    print(f"Result: {result}")

    browser.close()
```

**Key Patterns:**
- Use `file://` protocol for local files
- Convert path to absolute path
- No networkidle wait needed for static HTML
- Faster iteration for testing

### 3. Console Logging (`console_logging.py`)

**Purpose:** Capture browser console logs during automation for debugging and error detection.

**When to use:**
- Debugging JavaScript errors
- Monitoring for security warnings
- Capturing application logs

**Example Usage:**
```python
from playwright.sync_api import sync_playwright

def handle_console(msg):
    print(f"[{msg.type}] {msg.text}")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    # Register console message handler
    page.on('console', handle_console)

    page.goto('https://example.com')
    page.wait_for_load_state('networkidle')

    # Perform actions that might generate console logs
    page.locator('button#trigger-error').click()

    browser.close()
```

**Key Patterns:**
- Use `page.on('console', handler)` to capture logs
- Filter by message type (log, warn, error, info)
- Capture logs before they're cleared

### 4. Form Automation

**Purpose:** Fill and submit forms programmatically.

**Example:**
```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('https://example.com/login')
    page.wait_for_load_state('networkidle')

    # Fill form fields
    page.locator('input[name="username"]').fill('testuser')
    page.locator('input[name="password"]').fill('testpass')

    # Submit form
    page.locator('button[type="submit"]').click()

    # Wait for navigation
    page.wait_for_url('https://example.com/dashboard')

    # Verify login success
    assert 'Dashboard' in page.title()

    browser.close()
```

**Key Patterns:**
- Use `.fill()` for input fields
- Use `.click()` for submit buttons
- Wait for navigation with `wait_for_url()`
- Verify success with assertions

### 5. Screenshot Capture

**Purpose:** Take screenshots for visual verification and debugging.

**Example:**
```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('https://example.com')
    page.wait_for_load_state('networkidle')

    # Full page screenshot
    page.screenshot(path='/tmp/full-page.png', full_page=True)

    # Element screenshot
    page.locator('#vulnerable-section').screenshot(path='/tmp/element.png')

    # Viewport screenshot
    page.screenshot(path='/tmp/viewport.png')

    browser.close()
```

**Key Patterns:**
- Use `full_page=True` for complete page capture
- Use `.locator().screenshot()` for specific elements
- Screenshots saved immediately (no async needed in sync mode)

### 6. Network Interception

**Purpose:** Monitor and intercept network requests.

**Example:**
```python
from playwright.sync_api import sync_playwright

def handle_request(request):
    print(f"Request: {request.method} {request.url}")

def handle_response(response):
    print(f"Response: {response.status} {response.url}")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    # Register network handlers
    page.on('request', handle_request)
    page.on('response', handle_response)

    page.goto('https://example.com')
    page.wait_for_load_state('networkidle')

    browser.close()
```

**Key Patterns:**
- Use `page.on('request', handler)` for request monitoring
- Use `page.on('response', handler)` for response monitoring
- Check for sensitive data in requests/responses

### 7. Authentication State Management

**Purpose:** Maintain authentication across multiple test sessions.

**Example:**
```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Login
    page.goto('https://example.com/login')
    page.locator('input[name="username"]').fill('testuser')
    page.locator('input[name="password"]').fill('testpass')
    page.locator('button[type="submit"]').click()
    page.wait_for_url('https://example.com/dashboard')

    # Save authentication state
    context.storage_state(path='auth.json')

    browser.close()

# Later: Reuse authentication
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(storage_state='auth.json')
    page = context.new_page()

    # Already authenticated
    page.goto('https://example.com/dashboard')
    # No need to login again

    browser.close()
```

**Key Patterns:**
- Save state with `context.storage_state(path='file')`
- Restore state with `new_context(storage_state='file')`
- Persist cookies and localStorage

## Testing Patterns for Security

### IDOR Testing
```python
# Test if user IDs can be enumerated
page.goto('https://example.com/profile/1234')
original_content = page.content()

# Try different user ID
page.goto('https://example.com/profile/1235')
new_content = page.content()

# Check if unauthorized access occurred
if new_content != original_content and 'Access Denied' not in new_content:
    print("Potential IDOR vulnerability!")
```

### XSS Testing
```python
# Test for reflected XSS
xss_payload = '<script>alert(1)</script>'
page.goto(f'https://example.com/search?q={xss_payload}')
page.wait_for_load_state('networkidle')

# Check if payload is reflected unencoded
if xss_payload in page.content():
    print("Potential XSS vulnerability!")
```

### CSRF Testing
```python
# Test for CSRF protection
page.goto('https://example.com/settings')
page.wait_for_load_state('networkidle')

# Check for CSRF token
form_html = page.locator('form').inner_html()
if 'csrf' not in form_html.lower() and '_token' not in form_html.lower():
    print("Potential missing CSRF protection!")
```

## Using with Server Helper

For dynamic applications, use the server helper:

```bash
python ~/.claude/skills/Webassessment/webapp-scripts/with_server.py \
    --server "npm run dev" \
    --port 5173 \
    -- python my_test.py
```

## Best Practices

1. **Always wait for networkidle** - On dynamic apps
2. **Use descriptive selectors** - Role-based or data-testid
3. **Capture screenshots** - For proof-of-concept documentation
4. **Monitor console** - Catch JavaScript errors
5. **Save authentication** - Reuse login state across tests
6. **Clean up resources** - Always close browser

## Reconnaissance-Then-Action Pattern

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('https://example.com')
    page.wait_for_load_state('networkidle')

    # 1. Reconnaissance - take screenshot
    page.screenshot(path='/tmp/inspect.png', full_page=True)

    # 2. Reconnaissance - discover elements
    buttons = page.locator('button').all()
    forms = page.locator('form').all()
    inputs = page.locator('input').all()

    print(f"Found: {len(buttons)} buttons, {len(forms)} forms, {len(inputs)} inputs")

    # 3. Action - interact based on discoveries
    if len(forms) > 0:
        # Analyze first form
        form_html = forms[0].inner_html()
        print(form_html)

        # Test for XSS
        if len(inputs) > 0:
            inputs[0].fill('<script>alert(1)</script>')
            buttons[0].click()
            page.wait_for_timeout(1000)

            # Check if XSS executed
            page.screenshot(path='/tmp/xss-result.png')

    browser.close()
```

## See Also

- Web app testing guide: `~/.claude/skills/Webassessment/Workflows/webapp/testing-guide.md`
- Server helper script: `~/.claude/skills/Webassessment/webapp-scripts/with_server.py`
- Playwright documentation: https://playwright.dev/python/
