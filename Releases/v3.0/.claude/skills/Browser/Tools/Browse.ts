#!/usr/bin/env bun
/**
 * Browse CLI Tool v2.0.0 - Debug-First Browser Automation
 *
 * Browser automation with debugging visibility by DEFAULT.
 * Console logs, network requests, and errors are always captured.
 *
 * Usage:
 *   bun run Browse.ts <url>                    # Navigate with full diagnostics
 *   bun run Browse.ts errors                   # Show console errors
 *   bun run Browse.ts network                  # Show network activity
 *   bun run Browse.ts failed                   # Show failed requests (4xx, 5xx)
 *   bun run Browse.ts screenshot [path]        # Take screenshot of current page
 *   bun run Browse.ts click <selector>         # Click element
 *   bun run Browse.ts fill <selector> <value>  # Fill input field
 *
 * Session auto-starts on first use. No explicit start needed.
 */

import { PlaywrightBrowser } from '../index.ts'
import { getIdentity } from '../../../hooks/lib/identity'

const VOICE_SERVER = 'http://localhost:8888/notify/personality'
const STATE_FILE = '/tmp/browser-session.json'
const DEFAULT_PORT = 9222
const SESSION_TIMEOUT = 5000 // 5s to wait for session start
const SETTINGS_PATH = `${process.env.HOME}/.claude/settings.json`

// ============================================
// SETTINGS
// ============================================

interface Settings {
  techStack?: {
    browser?: string
    terminal?: string
    packageManager?: string
    devServerPort?: number
  }
}

async function getSettings(): Promise<Settings> {
  try {
    const file = Bun.file(SETTINGS_PATH)
    if (await file.exists()) {
      return JSON.parse(await file.text())
    }
  } catch {}
  return {}
}

async function getBrowser(): Promise<string> {
  const settings = await getSettings()
  return settings.techStack?.browser || 'Dia'
}

// ============================================
// TYPES
// ============================================

interface SessionState {
  pid: number
  port: number
  sessionId: string
  startedAt: string
  headless: boolean
  url: string
}

interface Diagnostics {
  errors: Array<{ type: string; text: string; timestamp: number }>
  warnings: Array<{ type: string; text: string; timestamp: number }>
  failedRequests: Array<{
    url: string
    method: string
    status: number
    statusText?: string
  }>
  stats: {
    totalRequests: number
    totalResponses: number
    totalSize: number
    avgDuration: number
  }
  pageTitle: string
  pageUrl: string
}

// ============================================
// UTILITIES
// ============================================

async function notify(message: string): Promise<void> {
  try {
    const identity = getIdentity()
    const personality = identity.personality

    if (!personality?.baseVoice) {
      // Fall back to simple notify if no personality configured
      await fetch('http://localhost:8888/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, play: true })
      })
      return
    }

    await fetch(VOICE_SERVER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        personality: {
          name: identity.name.toLowerCase(),
          base_voice: personality.baseVoice,
          enthusiasm: personality.enthusiasm,
          energy: personality.energy,
          expressiveness: personality.expressiveness,
          resilience: personality.resilience,
          composure: personality.composure,
          optimism: personality.optimism,
          warmth: personality.warmth,
          formality: personality.formality,
          directness: personality.directness,
          precision: personality.precision,
          curiosity: personality.curiosity,
          playfulness: personality.playfulness,
        }
      })
    })
  } catch {
    // Voice server not running - silent fail
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 3) + '...'
}

// ============================================
// SESSION MANAGEMENT
// ============================================

async function getSessionState(): Promise<SessionState | null> {
  try {
    const file = Bun.file(STATE_FILE)
    if (await file.exists()) {
      const content = await file.text()
      if (content.trim()) {
        return JSON.parse(content)
      }
    }
  } catch {}
  return null
}

async function isSessionRunning(): Promise<boolean> {
  const state = await getSessionState()
  if (!state) return false

  try {
    const res = await fetch(`http://localhost:${state.port}/health`, {
      signal: AbortSignal.timeout(1000)
    })
    return res.ok
  } catch {
    // Server not responding - clean up orphan state
    try {
      const fs = await import('fs/promises')
      await fs.unlink(STATE_FILE)
    } catch {}
    return false
  }
}

async function ensureSession(): Promise<number> {
  // Check if already running
  const state = await getSessionState()
  if (state) {
    try {
      const res = await fetch(`http://localhost:${state.port}/health`, {
        signal: AbortSignal.timeout(1000)
      })
      if (res.ok) {
        return state.port
      }
    } catch {}
  }

  // Need to start session
  const port = DEFAULT_PORT

  // Check port availability
  try {
    const res = await fetch(`http://localhost:${port}/health`, {
      signal: AbortSignal.timeout(500)
    })
    if (res.ok) {
      return port // Already running on this port
    }
  } catch {}

  // Start server in background
  const { spawn } = await import('child_process')
  const serverPath = new URL('./BrowserSession.ts', import.meta.url).pathname

  // Respect HEADLESS env var - default to true if not set
  const headless = process.env.HEADLESS !== 'false' && process.env.BROWSER_HEADLESS !== 'false'

  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    BROWSER_PORT: String(port),
    BROWSER_HEADLESS: String(headless)
  }

  // If headed mode, don't detach - keep connected
  const child = spawn('bun', ['run', serverPath], {
    detached: headless,
    stdio: headless ? 'ignore' : 'inherit',
    env
  })
  if (headless) child.unref()

  // Wait for server to be ready
  for (let i = 0; i < 30; i++) {
    await Bun.sleep(200)
    try {
      const res = await fetch(`http://localhost:${port}/health`, {
        signal: AbortSignal.timeout(1000)
      })
      if (res.ok) {
        return port
      }
    } catch {}
  }

  throw new Error('Failed to start browser session')
}

async function sessionCommand(
  endpoint: string,
  body?: any,
  method = 'POST'
): Promise<any> {
  const port = await ensureSession()

  const options: RequestInit = {
    method,
    signal: AbortSignal.timeout(60000) // 60s for long operations
  }

  if (body && method !== 'GET') {
    options.headers = { 'Content-Type': 'application/json' }
    options.body = JSON.stringify(body)
  }

  const url = method === 'GET' && body
    ? `http://localhost:${port}/${endpoint}?${new URLSearchParams(body)}`
    : `http://localhost:${port}/${endpoint}`

  const res = await fetch(url, options)
  const data = await res.json() as { success: boolean; data?: any; error?: string }

  if (data.success) {
    return data.data
  } else {
    throw new Error(data.error || 'Unknown error')
  }
}

// ============================================
// DIAGNOSTIC FORMATTING
// ============================================

function formatDiagnostics(
  diag: Diagnostics,
  screenshotPath?: string
): string {
  const lines: string[] = []

  // Screenshot (if taken)
  if (screenshotPath) {
    lines.push(`📸 Screenshot: ${screenshotPath}`)
    lines.push('')
  }

  // Console errors
  if (diag.errors.length > 0) {
    lines.push(`🔴 Console Errors (${diag.errors.length}):`)
    for (const err of diag.errors.slice(0, 5)) {
      lines.push(`   • ${truncate(err.text, 100)}`)
    }
    if (diag.errors.length > 5) {
      lines.push(`   ... and ${diag.errors.length - 5} more`)
    }
    lines.push('')
  }

  // Console warnings
  if (diag.warnings.length > 0) {
    lines.push(`⚠️ Console Warnings (${diag.warnings.length}):`)
    for (const warn of diag.warnings.slice(0, 3)) {
      lines.push(`   • ${truncate(warn.text, 100)}`)
    }
    if (diag.warnings.length > 3) {
      lines.push(`   ... and ${diag.warnings.length - 3} more`)
    }
    lines.push('')
  }

  // Failed requests
  if (diag.failedRequests.length > 0) {
    lines.push(`🌐 Failed Requests (${diag.failedRequests.length}):`)
    for (const req of diag.failedRequests.slice(0, 5)) {
      const urlPath = new URL(req.url).pathname
      lines.push(`   • ${req.method} ${truncate(urlPath, 50)} → ${req.status} ${req.statusText || ''}`)
    }
    if (diag.failedRequests.length > 5) {
      lines.push(`   ... and ${diag.failedRequests.length - 5} more`)
    }
    lines.push('')
  }

  // Network summary
  lines.push(`📊 Network: ${diag.stats.totalRequests} requests | ${formatBytes(diag.stats.totalSize)} | avg ${Math.round(diag.stats.avgDuration)}ms`)

  // Final status
  const hasIssues = diag.errors.length > 0 || diag.failedRequests.length > 0
  if (hasIssues) {
    lines.push(`⚠️ Page: "${diag.pageTitle}" loaded with issues`)
  } else {
    lines.push(`✅ Page: "${diag.pageTitle}" loaded successfully`)
  }

  return lines.join('\n')
}

// ============================================
// COMMANDS
// ============================================

async function debugUrl(url: string): Promise<void> {
  console.log(`PAI Browser Action: Navigating to ${url}`)

  // Navigate
  await sessionCommand('navigate', { url })

  // Take screenshot
  const timestamp = Date.now()
  const screenshotPath = `/tmp/browse-${timestamp}.png`
  console.log(`PAI Browser Action: Taking screenshot`)
  await sessionCommand('screenshot', { path: screenshotPath })

  // Get diagnostics
  const diag = await sessionCommand('diagnostics', {}, 'GET') as Diagnostics

  // Output
  console.log(`PAI Browser Results:`)
  console.log(formatDiagnostics(diag, screenshotPath))
}

async function showErrors(): Promise<void> {
  console.log(`PAI Browser Action: Checking console errors`)
  const diag = await sessionCommand('diagnostics', {}, 'GET') as Diagnostics

  console.log(`PAI Browser Results:`)
  if (diag.errors.length === 0) {
    console.log('✅ No console errors')
    return
  }

  console.log(`🔴 Console Errors (${diag.errors.length}):\n`)
  for (const err of diag.errors) {
    const time = new Date(err.timestamp).toLocaleTimeString()
    console.log(`[${time}] ${err.text}\n`)
  }
}

async function showWarnings(): Promise<void> {
  console.log(`PAI Browser Action: Checking console warnings`)
  const diag = await sessionCommand('diagnostics', {}, 'GET') as Diagnostics

  console.log(`PAI Browser Results:`)
  if (diag.warnings.length === 0) {
    console.log('✅ No console warnings')
    return
  }

  console.log(`⚠️ Console Warnings (${diag.warnings.length}):\n`)
  for (const warn of diag.warnings) {
    const time = new Date(warn.timestamp).toLocaleTimeString()
    console.log(`[${time}] ${warn.text}\n`)
  }
}

async function showConsole(): Promise<void> {
  console.log(`PAI Browser Action: Getting console output`)
  const logs = await sessionCommand('console', {}, 'GET') as Array<{
    type: string
    text: string
    timestamp: number
  }>

  console.log(`PAI Browser Results:`)
  if (logs.length === 0) {
    console.log('📋 No console output')
    return
  }

  console.log(`📋 Console Output (${logs.length} entries):\n`)
  for (const log of logs) {
    const time = new Date(log.timestamp).toLocaleTimeString()
    const icon = log.type === 'error' ? '🔴' :
                 log.type === 'warning' ? '⚠️' :
                 log.type === 'info' ? 'ℹ️' : '   '
    console.log(`${icon} [${time}] ${log.text}`)
  }
}

async function showNetwork(): Promise<void> {
  console.log(`PAI Browser Action: Getting network activity`)
  const logs = await sessionCommand('network', {}, 'GET') as Array<{
    type: string
    url: string
    method: string
    status?: number
    duration?: number
    size?: number
  }>

  console.log(`PAI Browser Results:`)
  if (logs.length === 0) {
    console.log('🌐 No network activity')
    return
  }

  // Show only responses (more useful)
  const responses = logs.filter(l => l.type === 'response')

  console.log(`🌐 Network Activity (${responses.length} responses):\n`)
  for (const log of responses.slice(-20)) {
    const urlPath = new URL(log.url).pathname
    const status = log.status || 0
    const icon = status >= 400 ? '❌' : status >= 300 ? '↪️' : '✅'
    const size = log.size ? formatBytes(log.size) : ''
    const duration = log.duration ? `${log.duration}ms` : ''
    console.log(`${icon} ${status} ${log.method} ${truncate(urlPath, 50)} ${size} ${duration}`)
  }
}

async function showFailed(): Promise<void> {
  console.log(`PAI Browser Action: Checking failed requests`)
  const diag = await sessionCommand('diagnostics', {}, 'GET') as Diagnostics

  console.log(`PAI Browser Results:`)
  if (diag.failedRequests.length === 0) {
    console.log('✅ No failed requests')
    return
  }

  console.log(`🌐 Failed Requests (${diag.failedRequests.length}):\n`)
  for (const req of diag.failedRequests) {
    console.log(`❌ ${req.status} ${req.method} ${req.url}`)
  }
}

async function takeScreenshot(path?: string): Promise<void> {
  const screenshotPath = path || `/tmp/screenshot-${Date.now()}.png`
  console.log(`PAI Browser Action: Taking screenshot`)
  await sessionCommand('screenshot', { path: screenshotPath })
  console.log(`PAI Browser Results: Screenshot saved to ${screenshotPath}`)
}

async function navigate(url: string): Promise<void> {
  console.log(`PAI Browser Action: Navigating to ${url}`)
  const result = await sessionCommand('navigate', { url })
  console.log(`PAI Browser Results: Navigated to ${result.url}`)
}

async function click(selector: string): Promise<void> {
  console.log(`PAI Browser Action: Clicking ${selector}`)
  await sessionCommand('click', { selector })
  console.log(`PAI Browser Results: Clicked ${selector}`)
}

async function fill(selector: string, value: string): Promise<void> {
  console.log(`PAI Browser Action: Filling ${selector}`)
  await sessionCommand('fill', { selector, value })
  console.log(`PAI Browser Results: Filled ${selector}`)
}

async function type(selector: string, text: string): Promise<void> {
  console.log(`PAI Browser Action: Typing in ${selector}`)
  await sessionCommand('type', { selector, text })
  console.log(`PAI Browser Results: Typed in ${selector}`)
}

async function evaluate(script: string): Promise<void> {
  console.log(`PAI Browser Action: Evaluating JavaScript`)
  const result = await sessionCommand('evaluate', { script })
  console.log(`PAI Browser Results:`)
  console.log(JSON.stringify(result.result, null, 2))
}

async function showStatus(): Promise<void> {
  console.log(`PAI Browser Action: Getting session status`)
  try {
    const state = await getSessionState()
    if (!state) {
      console.log('PAI Browser Results: No session running')
      return
    }

    const session = await sessionCommand('session', {}, 'GET')
    console.log('PAI Browser Results:')
    console.log('Browser Session:')
    console.log(`  ID: ${session.sessionId}`)
    console.log(`  Port: ${session.port}`)
    console.log(`  URL: ${session.url || '(none)'}`)
    console.log(`  Title: ${session.title || '(none)'}`)
    console.log(`  Started: ${session.startedAt}`)
    console.log(`  Idle timeout: ${session.idleTimeout}`)
  } catch {
    console.log('PAI Browser Results: Session not responding')
  }
}

async function restart(): Promise<void> {
  console.log(`PAI Browser Action: Restarting session`)
  // Stop if running
  try {
    const state = await getSessionState()
    if (state) {
      await fetch(`http://localhost:${state.port}/stop`, {
        method: 'POST',
        signal: AbortSignal.timeout(2000)
      })
      await Bun.sleep(500)
    }
  } catch {}

  // Clean up state file
  try {
    const fs = await import('fs/promises')
    await fs.unlink(STATE_FILE)
  } catch {}

  // Start fresh
  await ensureSession()
  console.log('PAI Browser Results: Session restarted')
}

async function stop(): Promise<void> {
  console.log(`PAI Browser Action: Stopping session`)
  const state = await getSessionState()
  if (!state) {
    console.log('PAI Browser Results: No session running')
    return
  }

  try {
    await fetch(`http://localhost:${state.port}/stop`, {
      method: 'POST',
      signal: AbortSignal.timeout(2000)
    })
    console.log('PAI Browser Results: Session stopped')
  } catch {
    console.log('PAI Browser Results: Session already stopped')
  }
}

async function startHeaded(url?: string): Promise<void> {
  console.log(`PAI Browser Action: Starting headed session`)

  // Stop any existing session
  const state = await getSessionState()
  if (state) {
    try {
      await fetch(`http://localhost:${state.port}/stop`, {
        method: 'POST',
        signal: AbortSignal.timeout(2000)
      })
      await Bun.sleep(1000)
    } catch {}
  }

  // Clean up state file
  try {
    const fs = await import('fs/promises')
    await fs.unlink(STATE_FILE)
  } catch {}

  // Start server in headed mode as detached background process
  const { spawn } = await import('child_process')
  const serverPath = new URL('./BrowserSession.ts', import.meta.url).pathname
  const port = DEFAULT_PORT

  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    BROWSER_PORT: String(port),
    BROWSER_HEADLESS: 'false'
  }

  console.log('PAI Browser Results: Starting headed browser...')

  // Detach so it runs in background but window stays visible
  const child = spawn('bun', ['run', serverPath], {
    detached: true,
    stdio: 'ignore',
    env
  })
  child.unref()

  // Wait for server to be ready
  for (let i = 0; i < 30; i++) {
    await Bun.sleep(300)
    try {
      const res = await fetch(`http://localhost:${port}/health`, {
        signal: AbortSignal.timeout(1000)
      })
      if (res.ok) {
        console.log('PAI Browser Results: Headed session ready!')
        console.log('Browser window should be visible. Use normal commands to interact.')
        if (url) {
          await sessionCommand('navigate', { url })
          console.log(`PAI Browser Results: Navigated to ${url}`)
        }
        return
      }
    } catch {}
  }
  console.error('PAI Browser Results: Failed to start headed session')
}

async function openUrl(url: string): Promise<void> {
  console.log(`PAI Browser Action: Opening URL in browser`)
  // Use browser from settings.json techStack
  const browser = await getBrowser()
  const { spawn } = await import('child_process')
  spawn('open', ['-a', browser, url], { detached: true, stdio: 'ignore' }).unref()
  console.log(`PAI Browser Results: Opened in ${browser}: ${url}`)
}

// ============================================
// MAIN
// ============================================

function showHelp(): void {
  console.log(`
Browse CLI v2.0.0 - Debug-First Browser Automation

Usage:
  bun run Browse.ts <url>                    Navigate with full diagnostics
  bun run Browse.ts errors                   Show console errors
  bun run Browse.ts warnings                 Show console warnings
  bun run Browse.ts console                  Show all console output
  bun run Browse.ts network                  Show network activity
  bun run Browse.ts failed                   Show failed requests (4xx, 5xx)
  bun run Browse.ts screenshot [path]        Take screenshot of current page
  bun run Browse.ts navigate <url>           Navigate without full report
  bun run Browse.ts click <selector>         Click element
  bun run Browse.ts fill <selector> <value>  Fill input field
  bun run Browse.ts type <selector> <text>   Type with delay
  bun run Browse.ts eval "<javascript>"      Execute JavaScript
  bun run Browse.ts open <url>               Open in user's browser
  bun run Browse.ts headed [url]             Start VISIBLE browser session
  bun run Browse.ts status                   Show session info
  bun run Browse.ts restart                  Restart session (clear state)
  bun run Browse.ts stop                     Stop session

Session auto-starts on first use. No explicit start needed.

Examples:
  bun run Browse.ts https://example.com
  bun run Browse.ts errors
  bun run Browse.ts click "#submit"
  bun run Browse.ts fill "#email" "test@example.com"
  `)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const command = args[0]

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    showHelp()
    return
  }

  try {
    // URL detection - if it looks like a URL, treat as debug command
    if (command.startsWith('http://') || command.startsWith('https://') || command.startsWith('localhost')) {
      const url = command.startsWith('localhost') ? `http://${command}` : command
      await debugUrl(url)
      return
    }

    // Named commands
    switch (command) {
      case 'errors':
        await showErrors()
        break

      case 'warnings':
        await showWarnings()
        break

      case 'console':
        await showConsole()
        break

      case 'network':
        await showNetwork()
        break

      case 'failed':
        await showFailed()
        break

      case 'screenshot':
        await takeScreenshot(args[1])
        break

      case 'navigate':
        if (!args[1]) {
          console.error('URL required')
          process.exit(1)
        }
        await navigate(args[1])
        break

      case 'click':
        if (!args[1]) {
          console.error('Selector required')
          process.exit(1)
        }
        await click(args[1])
        break

      case 'fill':
        if (!args[1] || !args[2]) {
          console.error('Selector and value required')
          process.exit(1)
        }
        await fill(args[1], args[2])
        break

      case 'type':
        if (!args[1] || !args[2]) {
          console.error('Selector and text required')
          process.exit(1)
        }
        await type(args[1], args[2])
        break

      case 'eval':
        if (!args[1]) {
          console.error('JavaScript code required')
          process.exit(1)
        }
        await evaluate(args[1])
        break

      case 'open':
        if (!args[1]) {
          console.error('URL required')
          process.exit(1)
        }
        await openUrl(args[1])
        break

      case 'status':
        await showStatus()
        break

      case 'restart':
        await restart()
        break

      case 'stop':
        await stop()
        break

      case 'headed':
        // Start headed session, optionally navigate to URL
        await startHeaded(args[1])
        break

      // Legacy session commands (redirect to new interface)
      case 'session':
        const subCmd = args[1]
        if (subCmd === 'start') {
          await ensureSession()
          console.log('Session started (auto-starts on any command now)')
        } else if (subCmd === 'stop') {
          await stop()
        } else if (subCmd === 'status') {
          await showStatus()
        } else {
          console.log('Session commands deprecated. Session auto-starts on first use.')
          console.log('Use: Browse.ts <url> | errors | network | failed | etc.')
        }
        break

      default:
        console.error(`Unknown command: ${command}`)
        console.log('Run with --help for usage')
        process.exit(1)
    }
  } catch (err: any) {
    console.error(`Error: ${err.message}`)
    process.exit(1)
  }
}

main()
