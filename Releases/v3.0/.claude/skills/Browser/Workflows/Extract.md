# Extract Workflow

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the Extract workflow in the Browser skill to extract page content"}' \
  > /dev/null 2>&1 &
```

Running **Extract** in **Browser**...

---

Extract content from web pages.

## Steps

1. **Launch and navigate**
   ```typescript
   import { PlaywrightBrowser } from '~/.claude/skills/Browser/index.ts'
   const browser = new PlaywrightBrowser()
   await browser.launch({ headless: true })
   await browser.navigate(url)
   ```

2. **Extract content**
   ```typescript
   // Text content
   const text = await browser.getVisibleText()

   // Specific element
   const heading = await browser.getVisibleText('h1')

   // HTML
   const html = await browser.getVisibleHtml({
     selector: 'article',
     removeScripts: true,
     removeStyles: true,
     minify: true
   })
   ```

3. **Close browser**
   ```typescript
   await browser.close()
   ```

## Extraction Methods

### Get All Visible Text
```typescript
const allText = await browser.getVisibleText()
```

### Get Element Text
```typescript
const title = await browser.getVisibleText('h1')
const articles = await browser.getVisibleText('.article-list')
```

### Get Clean HTML
```typescript
const html = await browser.getVisibleHtml({
  selector: 'main',
  removeScripts: true,
  removeStyles: true,
  removeComments: true,
  minify: true
})
```

### Run JavaScript
```typescript
const data = await browser.evaluate(() => {
  return {
    title: document.title,
    links: Array.from(document.querySelectorAll('a')).map(a => a.href),
    timestamp: Date.now()
  }
})
```

### Get Accessibility Tree
```typescript
const a11y = await browser.getAccessibilityTree()
// Structured data about page elements
```

## Example: Article Extraction

```typescript
import { PlaywrightBrowser } from '~/.claude/skills/Browser/index.ts'

const browser = new PlaywrightBrowser()
await browser.launch({ headless: true })

await browser.navigate('https://example.com/article')

// Wait for content to load
await browser.waitForSelector('article')

// Extract
const title = await browser.getVisibleText('h1')
const content = await browser.getVisibleText('article')
const html = await browser.getVisibleHtml({
  selector: 'article',
  removeScripts: true
})

console.log({ title, contentLength: content.length })

await browser.close()
```

## Example: Save as PDF

```typescript
await browser.navigate('https://example.com/report')
await browser.savePdf('/tmp/report.pdf', {
  format: 'A4',
  printBackground: true
})
```
