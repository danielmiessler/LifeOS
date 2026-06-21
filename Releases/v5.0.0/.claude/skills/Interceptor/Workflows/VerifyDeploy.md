# VerifyDeploy Workflow

---

Verify a deployment by opening the target URL in real Chrome, checking for errors, and capturing screenshot evidence. Works with both authenticated and public pages since Interceptor uses your real browser sessions.

## When to Use

- After deploying any web project
- When the Algorithm's Verification Doctrine Rule 1 requires live-probe evidence
- After CSS/layout/content changes that need visual confirmation
- When agent-browser can't reach the page (auth wall, bot detection)

## Steps

### 1. Open the Target URL

```bash
interceptor open "<DEPLOY_URL>"
```

This navigates, waits for DOM stability, and returns the element tree + visible text in one call. If the page requires authentication, Interceptor uses your real Chrome sessions automatically.

For pages that load slowly (heavy SPAs, SSR hydration):

```bash
interceptor open "<DEPLOY_URL>" --timeout 10000
```

### 2. Check for Errors

Run JS in the page context to capture console errors:

```bash
interceptor eval "JSON.stringify(window.__interceptor_errors || [])" --main
```

Check for visible error indicators in the element tree from Step 1. Look for:
- Error banners, modals, or toast messages
- "404", "500", "not found", "error" in visible text
- Blank/empty content areas that should have content

### 3. Check Network for Failed Requests

```bash
interceptor net log --json
```

Look for non-200 status codes, especially:
- 404s on JS/CSS chunks (missing build artifacts)
- 500s on API endpoints
- CORS errors

### 4. Capture Screenshot Evidence

```bash
( cd /tmp/pai-screenshots && interceptor screenshot --save )
```

Read the screenshot image to visually confirm the page renders correctly. This is the live-probe evidence the Verification Doctrine requires.

For full-page captures (long pages, below-the-fold content):

```bash
( cd /tmp/pai-screenshots && interceptor screenshot --full --save )
```

### 5. Report

If everything passes: mark the ISC criterion as `[x]` with the screenshot as evidence.

If errors found: report the specific errors (console, network, visual) before attempting fixes. Do NOT theorize from code — the browser evidence is primary.

## Notes

- For authenticated pages, Interceptor uses your real Chrome login sessions. No profile setup needed.
- For public pages where speed matters and auth isn't needed, agent-browser (Browser skill) is acceptable.
- Always use `http://localhost:PORT` instead of `localhost:PORT` for local dev URLs.
- If Chrome is not running, start it first. Interceptor requires an active Chrome instance with the extension loaded.
