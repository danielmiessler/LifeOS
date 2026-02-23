#!/usr/bin/env bun
/**
 * Browser Session Server v2.0.0 - Debug-First Persistent Browser
 *
 * Persistent Playwright browser with ALWAYS-ON event capture.
 * Console logs, network requests, and errors captured from launch.
 *
 * Usage:
 *   # Started automatically by Browse.ts (not directly)
 *   BROWSER_PORT=9222 bun run BrowserSession.ts
 *
 * New API (v2.0.0):
 *   GET  /diagnostics  - Full diagnostic summary (errors, warnings, failed requests)
 *   GET  /console      - All console logs
 *   GET  /network      - All network activity
 *
 * Standard API:
 *   GET  /health       - Server health check
 *   GET  /session      - Current session info
 *   POST /navigate     - Navigate to URL (clears logs for fresh page)
 *   POST /click        - Click element
 *   POST /fill         - Fill input
 *   POST /screenshot   - Take screenshot
 *   GET  /text         - Get visible text
 *   POST /evaluate     - Run JavaScript
 *   POST /stop         - Stop server
 */

import { PlaywrightBrowser } from '../index.ts'

const CONFIG = {
  port: parseInt(process.env.BROWSER_PORT || '9222'),
  headless: process.env.BROWSER_HEADLESS === 'true',
  viewport: {
    width: parseInt(process.env.BROWSER_WIDTH || '1920'),
    height: parseInt(process.env.BROWSER_HEIGHT || '1080')
  },
  stateFile: '/tmp/browser-session.json',
  idleTimeout: 30 * 60 * 1000 // 30 minutes
}

const browser = new PlaywrightBrowser()
const sessionId = crypto.randomUUID().slice(0, 8)
const startedAt = new Date().toISOString()
let lastActivity = Date.now()

// ============================================
// STATE MANAGEMENT
// ============================================

async function saveState(): Promise<void> {
  try {
    const state = {
      pid: process.pid,
      port: CONFIG.port,
      sessionId,
      startedAt,
      headless: CONFIG.headless,
      url: browser.getUrl()
    }
    await Bun.write(CONFIG.stateFile, JSON.stringify(state, null, 2))
  } catch (error) {
    console.error('Failed to save state:', error)
  }
}

async function cleanup(): Promise<void> {
  console.log('\nShutting down browser session...')
  try {
    await browser.close()
  } catch {}
  try {
    const file = Bun.file(CONFIG.stateFile)
    if (await file.exists()) {
      await Bun.write(CONFIG.stateFile, '')
      const fs = await import('fs/promises')
      await fs.unlink(CONFIG.stateFile)
    }
  } catch {}
  console.log('Session closed.')
  process.exit(0)
}

// ============================================
// IDLE TIMEOUT
// ============================================

function checkIdleTimeout(): void {
  const idle = Date.now() - lastActivity
  if (idle > CONFIG.idleTimeout) {
    console.log(`Idle timeout (${Math.round(idle / 60000)} minutes) - shutting down`)
    cleanup()
  }
}

// Check every minute
setInterval(checkIdleTimeout, 60 * 1000)

// ============================================
// RESPONSE HELPERS
// ============================================

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}

function success(data?: any): Response {
  return json({ success: true, data })
}

function error(message: string, status = 500): Response {
  return json({ success: false, error: message }, status)
}

// ============================================
// LAUNCH BROWSER
// ============================================

console.log('Starting browser session...')
console.log(`  Port: ${CONFIG.port}`)
console.log(`  Headless: ${CONFIG.headless}`)
console.log(`  Viewport: ${CONFIG.viewport.width}x${CONFIG.viewport.height}`)
console.log(`  Idle timeout: ${CONFIG.idleTimeout / 60000} minutes`)

await browser.launch({
  headless: CONFIG.headless,
  viewport: CONFIG.viewport
})

// ============================================
// HTTP SERVER
// ============================================

const server = Bun.serve({
  port: CONFIG.port,

  async fetch(req) {
    const url = new URL(req.url)
    const method = req.method

    // Update activity timestamp on every request
    lastActivity = Date.now()

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      })
    }

    try {
      // ========================================
      // DIAGNOSTIC ENDPOINTS (NEW in v2.0.0)
      // ========================================

      // Full diagnostics - errors, warnings, failed requests, stats
      if (url.pathname === '/diagnostics' && method === 'GET') {
        const allLogs = browser.getConsoleLogs()
        const errors = allLogs.filter(l => l.type === 'error')
        const warnings = allLogs.filter(l => l.type === 'warning')

        const networkLogs = browser.getNetworkLogs({ type: 'response' })
        const failedRequests = networkLogs
          .filter(l => l.status && l.status >= 400)
          .map(l => ({
            url: l.url,
            method: l.method,
            status: l.status!,
            statusText: l.statusText
          }))

        const stats = browser.getNetworkStats()

        return success({
          errors,
          warnings,
          failedRequests,
          stats,
          pageTitle: await browser.getTitle(),
          pageUrl: browser.getUrl()
        })
      }

      // Console logs
      if (url.pathname === '/console' && method === 'GET') {
        const type = url.searchParams.get('type') as any
        const limit = parseInt(url.searchParams.get('limit') || '100')
        const logs = browser.getConsoleLogs({ type: type || undefined, limit })
        return success(logs)
      }

      // Network logs
      if (url.pathname === '/network' && method === 'GET') {
        const limit = parseInt(url.searchParams.get('limit') || '100')
        const logs = browser.getNetworkLogs({ limit })
        return success(logs)
      }

      // ========================================
      // STANDARD ENDPOINTS
      // ========================================

      // Health check
      if (url.pathname === '/health' && method === 'GET') {
        return success({
          status: 'ok',
          sessionId,
          uptime: Date.now() - new Date(startedAt).getTime()
        })
      }

      // Session info
      if (url.pathname === '/session' && method === 'GET') {
        return success({
          sessionId,
          startedAt,
          port: CONFIG.port,
          headless: CONFIG.headless,
          url: browser.getUrl(),
          title: await browser.getTitle(),
          idleTimeout: `${CONFIG.idleTimeout / 60000} minutes`,
          lastActivity: new Date(lastActivity).toISOString()
        })
      }

      // Navigate - CLEARS LOGS for fresh page diagnostics
      if (url.pathname === '/navigate' && method === 'POST') {
        const body = await req.json()
        if (!body.url) return error('url required', 400)

        // Clear logs before navigating for clean diagnostic slate
        browser.getConsoleLogs({ clear: true })
        browser.clearNetworkLogs()

        await browser.navigate(body.url, { waitUntil: body.waitUntil || 'networkidle' })
        await saveState()

        return success({
          url: browser.getUrl(),
          title: await browser.getTitle()
        })
      }

      // Click
      if (url.pathname === '/click' && method === 'POST') {
        const body = await req.json()
        if (!body.selector) return error('selector required', 400)
        await browser.click(body.selector, { timeout: body.timeout })
        return success({ clicked: body.selector })
      }

      // Fill
      if (url.pathname === '/fill' && method === 'POST') {
        const body = await req.json()
        if (!body.selector || body.value === undefined) return error('selector and value required', 400)
        await browser.fill(body.selector, body.value)
        return success({ filled: body.selector })
      }

      // Type (character by character)
      if (url.pathname === '/type' && method === 'POST') {
        const body = await req.json()
        if (!body.selector || !body.text) return error('selector and text required', 400)
        await browser.type(body.selector, body.text, body.delay)
        return success({ typed: body.selector })
      }

      // Screenshot
      if (url.pathname === '/screenshot' && method === 'POST') {
        const body = await req.json()
        const path = body.path || '/tmp/screenshot.png'
        await browser.screenshot({
          path,
          fullPage: body.fullPage || false,
          selector: body.selector
        })
        return success({ path })
      }

      // Get visible text
      if (url.pathname === '/text' && method === 'GET') {
        const selector = url.searchParams.get('selector') || undefined
        const text = await browser.getVisibleText(selector)
        return success({ text })
      }

      // Get HTML
      if (url.pathname === '/html' && method === 'GET') {
        const selector = url.searchParams.get('selector') || undefined
        const html = await browser.getVisibleHtml({ selector })
        return success({ html })
      }

      // Evaluate JavaScript
      if (url.pathname === '/evaluate' && method === 'POST') {
        const body = await req.json()
        if (!body.script) return error('script required', 400)
        const result = await browser.evaluate(body.script)
        return success({ result })
      }

      // Wait for selector
      if (url.pathname === '/wait' && method === 'POST') {
        const body = await req.json()
        if (!body.selector) return error('selector required', 400)
        await browser.waitForSelector(body.selector, {
          state: body.state,
          timeout: body.timeout
        })
        return success({ found: body.selector })
      }

      // Wait for text
      if (url.pathname === '/wait-text' && method === 'POST') {
        const body = await req.json()
        if (!body.text) return error('text required', 400)
        await browser.waitForText(body.text, {
          state: body.state,
          timeout: body.timeout
        })
        return success({ found: body.text })
      }

      // Hover
      if (url.pathname === '/hover' && method === 'POST') {
        const body = await req.json()
        if (!body.selector) return error('selector required', 400)
        await browser.hover(body.selector)
        return success({ hovered: body.selector })
      }

      // Press key
      if (url.pathname === '/press' && method === 'POST') {
        const body = await req.json()
        if (!body.key) return error('key required', 400)
        await browser.pressKey(body.key, body.selector)
        return success({ pressed: body.key })
      }

      // Select dropdown
      if (url.pathname === '/select' && method === 'POST') {
        const body = await req.json()
        if (!body.selector || !body.value) return error('selector and value required', 400)
        await browser.select(body.selector, body.value)
        return success({ selected: body.value })
      }

      // Tabs - list
      if (url.pathname === '/tabs' && method === 'GET') {
        const tabs = browser.getTabs()
        return success({ tabs })
      }

      // Tabs - new
      if (url.pathname === '/tabs' && method === 'POST') {
        const body = await req.json()
        await browser.newTab(body.url)
        return success({ created: true, url: body.url })
      }

      // Tabs - close
      if (url.pathname.startsWith('/tabs/') && method === 'DELETE') {
        const index = parseInt(url.pathname.split('/')[2])
        if (isNaN(index)) return error('invalid tab index', 400)
        await browser.switchTab(index)
        await browser.closeTab()
        return success({ closed: index })
      }

      // Tabs - switch
      if (url.pathname.startsWith('/tabs/') && method === 'POST') {
        const index = parseInt(url.pathname.split('/')[2])
        if (isNaN(index)) return error('invalid tab index', 400)
        await browser.switchTab(index)
        return success({ switched: index })
      }

      // Reload
      if (url.pathname === '/reload' && method === 'POST') {
        await browser.reload()
        return success({ reloaded: true })
      }

      // Go back
      if (url.pathname === '/back' && method === 'POST') {
        await browser.goBack()
        return success({ back: true })
      }

      // Go forward
      if (url.pathname === '/forward' && method === 'POST') {
        await browser.goForward()
        return success({ forward: true })
      }

      // Resize viewport
      if (url.pathname === '/resize' && method === 'POST') {
        const body = await req.json()
        if (!body.width || !body.height) return error('width and height required', 400)
        await browser.resize(body.width, body.height)
        return success({ width: body.width, height: body.height })
      }

      // Stop server
      if (url.pathname === '/stop' && method === 'POST') {
        setTimeout(() => cleanup(), 100)
        return success({ stopping: true })
      }

      return error('Not found', 404)

    } catch (err: any) {
      console.error('Request error:', err.message)
      return error(err.message)
    }
  }
})

await saveState()
console.log(`\nBrowser session started!`)
console.log(`  Session ID: ${sessionId}`)
console.log(`  URL: http://localhost:${CONFIG.port}`)
console.log(`  Diagnostics: http://localhost:${CONFIG.port}/diagnostics`)
console.log(`\nSession will auto-close after ${CONFIG.idleTimeout / 60000} minutes of inactivity.`)
console.log(`Press Ctrl+C to stop manually.`)

// Cleanup handlers
process.on('SIGTERM', cleanup)
process.on('SIGINT', cleanup)
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err)
  cleanup()
})
