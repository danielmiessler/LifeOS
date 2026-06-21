# Reproduce Workflow

---

Reproduce a reported bug by opening the affected page in real Chrome BEFORE reading any code. Captures console errors, network failures, and visual state as primary evidence. Code analysis comes after reproduction, never before.

## When to Use

- Any time a UI or page bug is reported ("blank screen", "broken layout", "page won't load")
- Before writing any fix for a web-facing issue
- When someone reports something looks wrong on a deployed site
- As the mandatory first step in the Algorithm's Diagnostic preflight gate

## Steps

### 1. Open the Affected Page

```bash
interceptor open "<BUG_URL>"
```

Do NOT read code first. Do NOT form theories. Open the page and look at it.

### 2. Capture Visual State

```bash
( cd /tmp/pai-screenshots && interceptor screenshot --save )
```

Read the screenshot. Is the reported bug visible? Document what you see vs what's expected.

### 3. Check Console Errors

```bash
interceptor eval "(() => {
  const entries = performance.getEntriesByType('resource').filter(e => e.name.includes('.js') || e.name.includes('.css'));
  const failed = entries.filter(e => e.transferSize === 0 && e.decodedBodySize === 0);
  return JSON.stringify({ consoleCheck: 'done', failedResources: failed.map(e => e.name) });
})()" --main
```

Also check for JS errors in the network log:

```bash
interceptor net log --json
```

Look for:
- 404s on JS/CSS bundles (missing build artifacts — a common root cause of blank-screen deploys)
- Failed API calls (500s, timeouts)
- CORS errors
- Mixed content warnings

### 4. Check Page Content

```bash
interceptor read --text-only
```

Compare visible text content against what's expected. Empty or missing sections indicate rendering failures.

### 5. Document Findings

Before touching any code, document:
- What the page actually shows (screenshot evidence)
- Console errors found (with specific error messages)
- Network failures (with specific URLs and status codes)
- Gap between expected and actual state

Only THEN proceed to code analysis with specific hypotheses grounded in the browser evidence.

## Notes

- This workflow exists because of real production incidents where hours were spent on code analysis and wrong-theory fixes were shipped to prod — when the actual cause (missing JS chunks, 404s on bundles, CORS errors) was visible in the browser console in under a minute. Reproduce first, theorize second.
- "curl returns 200" is NOT reproduction. You must SEE the rendered page.
- Code analysis without reproduction is speculation, not debugging.
- For authenticated pages, Interceptor uses your real Chrome sessions automatically.
