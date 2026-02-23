# Screenshot Workflow

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the Screenshot workflow in the Browser skill to capture screenshots"}' \
  > /dev/null 2>&1 &
```

Running **Screenshot** in **Browser**...

---

Take a screenshot of a URL.

## Steps

1. **Launch browser**
   ```typescript
   import { PlaywrightBrowser } from '~/.claude/skills/Browser/index.ts'
   const browser = new PlaywrightBrowser()
   await browser.launch({ headless: true })
   ```

2. **Navigate to URL**
   ```typescript
   await browser.navigate(url)
   ```

3. **Take screenshot**
   ```typescript
   await browser.screenshot({
     path: '/tmp/screenshot.png',
     fullPage: false  // true for full page
   })
   ```

4. **Close browser**
   ```typescript
   await browser.close()
   ```

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `path` | - | Output file path |
| `fullPage` | false | Capture full scrollable page |
| `selector` | - | Capture specific element |
| `type` | 'png' | 'png' or 'jpeg' |
| `quality` | - | JPEG quality (0-100) |

## Example: Element Screenshot

```typescript
await browser.screenshot({
  selector: '.hero-section',
  path: '/tmp/hero.png'
})
```

## Example: Mobile Screenshot

```typescript
await browser.launch()
await browser.setDevice('iPhone 14')
await browser.navigate(url)
await browser.screenshot({ path: '/tmp/mobile.png' })
```
