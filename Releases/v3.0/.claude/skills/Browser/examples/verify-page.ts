#!/usr/bin/env bun

/**
 * Verify a page loads correctly
 *
 * Usage: bun verify-page.ts <url> [selector]
 *
 * Examples:
 *   bun verify-page.ts https://example.com
 *   bun verify-page.ts https://example.com "h1"
 *   bun verify-page.ts https://example.com ".main-content"
 */

import { PlaywrightBrowser } from '../index'

async function main() {
  const url = process.argv[2]
  const selector = process.argv[3]

  if (!url) {
    console.error('Usage: bun verify-page.ts <url> [selector]')
    console.error('')
    console.error('Examples:')
    console.error('  bun verify-page.ts https://example.com')
    console.error('  bun verify-page.ts https://example.com "h1"')
    process.exit(1)
  }

  console.log('=== Page Verification ===\n')

  const browser = new PlaywrightBrowser()

  try {
    console.log('1. Launching browser...')
    await browser.launch({ headless: true })

    console.log(`2. Navigating to ${url}...`)
    const startTime = Date.now()
    await browser.navigate(url)
    const loadTime = Date.now() - startTime

    console.log(`   ✅ Page loaded in ${loadTime}ms`)

    // Get page title
    const title = await browser.getTitle()
    console.log(`\n3. Page title: "${title}"`)

    // Get current URL (check for redirects)
    const finalUrl = browser.getUrl()
    if (finalUrl !== url) {
      console.log(`   ⚠️  Redirected to: ${finalUrl}`)
    }

    // Check for specific selector if provided
    if (selector) {
      console.log(`\n4. Checking for selector: ${selector}`)
      try {
        await browser.waitForSelector(selector, { timeout: 5000 })
        const text = await browser.getVisibleText(selector)
        console.log(`   ✅ Found! Content: "${text.slice(0, 100)}${text.length > 100 ? '...' : ''}"`)
      } catch {
        console.log(`   ❌ Selector not found within 5s`)
      }
    }

    // Check console for errors
    const errors = browser.getConsoleLogs({ type: 'error' })
    if (errors.length > 0) {
      console.log(`\n⚠️  Console errors (${errors.length}):`)
      errors.slice(0, 3).forEach(err => {
        console.log(`   - ${err.text.slice(0, 100)}`)
      })
    } else {
      console.log('\n✅ No console errors')
    }

    console.log('\n=== Verification Complete ===')

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error)
    process.exit(1)
  } finally {
    await browser.close()
  }
}

if (import.meta.main) {
  main()
}

export { main }
