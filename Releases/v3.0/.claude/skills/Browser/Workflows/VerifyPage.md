# VerifyPage Workflow

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the VerifyPage workflow in the Browser skill to verify page loads"}' \
  > /dev/null 2>&1 &
```

Running **VerifyPage** in **Browser**...

---

Verify a page loads correctly and check for errors.

## Steps

1. **Launch and navigate**
   ```typescript
   import { PlaywrightBrowser } from '~/.claude/skills/Browser/index.ts'
   const browser = new PlaywrightBrowser()
   await browser.launch({ headless: true })

   const startTime = Date.now()
   await browser.navigate(url)
   const loadTime = Date.now() - startTime
   ```

2. **Check basic info**
   ```typescript
   const title = await browser.getTitle()
   const finalUrl = browser.getUrl()  // Check for redirects
   ```

3. **Verify specific element (optional)**
   ```typescript
   await browser.waitForSelector(selector, { timeout: 5000 })
   const text = await browser.getVisibleText(selector)
   ```

4. **Check for console errors**
   ```typescript
   const errors = browser.getConsoleLogs({ type: 'error' })
   if (errors.length > 0) {
     console.log('Console errors:', errors)
   }
   ```

5. **Take verification screenshot**
   ```typescript
   await browser.screenshot({ path: '/tmp/verify.png' })
   ```

6. **Close browser**
   ```typescript
   await browser.close()
   ```

## Example: Full Verification

```typescript
import { PlaywrightBrowser } from '~/.claude/skills/Browser/index.ts'

const browser = new PlaywrightBrowser()
await browser.launch({ headless: true })

await browser.navigate('https://example.com')

// Basic checks
const title = await browser.getTitle()
console.log(`Title: ${title}`)

// Check specific element
await browser.waitForSelector('h1')
const heading = await browser.getVisibleText('h1')
console.log(`H1: ${heading}`)

// Console errors
const errors = browser.getConsoleLogs({ type: 'error' })
console.log(`Errors: ${errors.length}`)

// Evidence
await browser.screenshot({ path: '/tmp/verify.png' })

await browser.close()
```

## CLI Usage

```bash
bun ~/.claude/skills/Browser/examples/verify-page.ts https://example.com
```
