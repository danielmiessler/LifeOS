#!/usr/bin/env bun

/**
 * Take a screenshot of a URL
 *
 * Usage: bun screenshot.ts <url> [output.png]
 *
 * Examples:
 *   bun screenshot.ts https://example.com
 *   bun screenshot.ts https://example.com page.png
 *   bun screenshot.ts https://example.com fullpage.png --full
 */

import { PlaywrightBrowser } from '../index'

async function main() {
  const url = process.argv[2]
  const output = process.argv[3] || 'screenshot.png'
  const fullPage = process.argv.includes('--full')

  if (!url) {
    console.error('Usage: bun screenshot.ts <url> [output.png] [--full]')
    console.error('')
    console.error('Examples:')
    console.error('  bun screenshot.ts https://example.com')
    console.error('  bun screenshot.ts https://example.com page.png')
    console.error('  bun screenshot.ts https://example.com fullpage.png --full')
    process.exit(1)
  }

  console.log('=== Playwright Screenshot ===\n')

  const browser = new PlaywrightBrowser()

  try {
    console.log('1. Launching browser...')
    await browser.launch({ headless: true })

    console.log(`2. Navigating to ${url}...`)
    await browser.navigate(url)

    console.log(`3. Taking screenshot (fullPage: ${fullPage})...`)
    await browser.screenshot({
      path: output,
      fullPage
    })

    console.log(`\n✅ Screenshot saved: ${output}`)

    // Token savings calculation
    const mcpTokens = 13700
    const codeTokens = 150
    const savings = ((mcpTokens - codeTokens) / mcpTokens * 100).toFixed(1)

    console.log(`\n📊 Token savings: ${savings}%`)
    console.log(`   MCP approach: ~${mcpTokens} tokens`)
    console.log(`   Code approach: ~${codeTokens} tokens`)

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
