# Interact Workflow

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the Interact workflow in the Browser skill to interact with elements"}' \
  > /dev/null 2>&1 &
```

Running **Interact** in **Browser**...

---

Fill forms, click buttons, and interact with page elements.

## Steps

1. **Launch and navigate**
   ```typescript
   import { PlaywrightBrowser } from '~/.claude/skills/Browser/index.ts'
   const browser = new PlaywrightBrowser()
   await browser.launch({ headless: false })  // Watch it work
   await browser.navigate(url)
   ```

2. **Interact with elements**
   ```typescript
   await browser.fill('#email', 'test@example.com')
   await browser.fill('#password', 'secret')
   await browser.click('button[type="submit"]')
   ```

3. **Wait for result**
   ```typescript
   await browser.waitForNavigation()
   // or
   await browser.waitForSelector('.success-message')
   ```

4. **Verify and close**
   ```typescript
   const result = await browser.getVisibleText('.result')
   await browser.close()
   ```

## Common Interactions

### Click
```typescript
await browser.click('button')
await browser.click('#submit-btn')
await browser.click('a[href="/login"]')
```

### Fill Input
```typescript
await browser.fill('input[name="email"]', 'test@example.com')
await browser.fill('#search', 'query')
```

### Type with Delay (Realistic)
```typescript
await browser.type('#search', 'query', 50)  // 50ms between keys
```

### Select Dropdown
```typescript
await browser.select('#country', 'US')
await browser.select('#tags', ['tag1', 'tag2'])  // Multi-select
```

### Press Keys
```typescript
await browser.pressKey('Enter')
await browser.pressKey('Escape')
await browser.pressKey('Tab', '#input-field')  // On specific element
```

### Hover
```typescript
await browser.hover('.dropdown-trigger')
await browser.click('.dropdown-item')  // Now visible
```

### Drag and Drop
```typescript
await browser.drag('#draggable', '#drop-zone')
```

### File Upload
```typescript
await browser.uploadFile('input[type="file"]', '/path/to/file.pdf')
```

## Example: Login Flow

```typescript
import { PlaywrightBrowser } from '~/.claude/skills/Browser/index.ts'

const browser = new PlaywrightBrowser()
await browser.launch({ headless: false })

await browser.navigate('https://example.com/login')
await browser.fill('#email', 'user@example.com')
await browser.fill('#password', 'password123')
await browser.click('button[type="submit"]')

await browser.waitForNavigation()
const welcomeText = await browser.getVisibleText('.welcome-message')
console.log(`Logged in: ${welcomeText}`)

await browser.close()
```
