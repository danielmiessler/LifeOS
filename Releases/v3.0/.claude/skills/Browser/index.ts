/**
 * Playwright Code-First Interface
 *
 * Replaces token-heavy Playwright MCP with direct code execution.
 * Savings: ~13,700 tokens (MCP) → ~50-200 tokens (per-operation)
 *
 * @example
 * const browser = new PlaywrightBrowser()
 * await browser.launch()
 * await browser.navigate('https://example.com')
 * const screenshot = await browser.screenshot()
 * await browser.close()
 */

import { chromium, firefox, webkit, type Browser, type Page, type BrowserContext } from 'playwright'

export type BrowserType = 'chromium' | 'firefox' | 'webkit'

export interface LaunchOptions {
  browser?: BrowserType
  headless?: boolean
  viewport?: { width: number; height: number }
  userAgent?: string
}

export interface NavigateOptions {
  timeout?: number
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit'
}

export interface ScreenshotOptions {
  selector?: string
  fullPage?: boolean
  path?: string
  type?: 'png' | 'jpeg'
  quality?: number
}

export interface ClickOptions {
  button?: 'left' | 'right' | 'middle'
  clickCount?: number
  delay?: number
  timeout?: number
}

export interface FillOptions {
  timeout?: number
  force?: boolean
}

export interface ConsoleLogEntry {
  type: string
  text: string
  timestamp: number
}

export interface NetworkLogEntry {
  type: 'request' | 'response'
  url: string
  method: string
  status?: number
  statusText?: string
  headers?: Record<string, string>
  resourceType?: string
  timestamp: number
  duration?: number
  size?: number
}

export interface DialogInfo {
  type: 'alert' | 'confirm' | 'prompt' | 'beforeunload'
  message: string
  defaultValue?: string
}

/**
 * Main Playwright browser controller
 *
 * Provides all browser automation capabilities without MCP overhead.
 * Each method is a direct wrapper around Playwright APIs.
 */
export class PlaywrightBrowser {
  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private page: Page | null = null
  private consoleLogs: ConsoleLogEntry[] = []
  private networkLogs: NetworkLogEntry[] = []
  private requestTimings: Map<string, number> = new Map()
  private pendingDialog: DialogInfo | null = null
  private autoHandleDialogs: boolean = false
  private dialogResponse: string | boolean = true

  /**
   * Launch browser instance
   */
  async launch(options?: LaunchOptions): Promise<void> {
    const browserType = options?.browser || 'chromium'
    const launcher = browserType === 'firefox' ? firefox : browserType === 'webkit' ? webkit : chromium

    this.browser = await launcher.launch({
      headless: options?.headless ?? false
    })

    this.context = await this.browser.newContext({
      viewport: options?.viewport || { width: 1280, height: 720 },
      userAgent: options?.userAgent
    })

    this.page = await this.context.newPage()

    // Attach all event listeners
    this.attachPageListeners(this.page)
  }

  /**
   * Ensure browser is launched
   */
  private ensurePage(): Page {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.')
    }
    return this.page
  }

  /**
   * Attach event listeners to a page (console, network, dialog)
   * Called when creating new pages to maintain consistent monitoring
   */
  private attachPageListeners(page: Page): void {
    // Capture console logs
    page.on('console', msg => {
      this.consoleLogs.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: Date.now()
      })
    })

    // Capture network requests
    page.on('request', request => {
      const timestamp = Date.now()
      this.requestTimings.set(request.url(), timestamp)
      this.networkLogs.push({
        type: 'request',
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType(),
        headers: request.headers(),
        timestamp
      })
    })

    // Capture network responses
    page.on('response', async response => {
      const url = response.url()
      const requestTime = this.requestTimings.get(url)
      const timestamp = Date.now()

      let size = 0
      try {
        const body = await response.body()
        size = body.length
      } catch {
        // Response body not available (e.g., redirects)
      }

      this.networkLogs.push({
        type: 'response',
        url,
        method: response.request().method(),
        status: response.status(),
        statusText: response.statusText(),
        headers: response.headers(),
        resourceType: response.request().resourceType(),
        timestamp,
        duration: requestTime ? timestamp - requestTime : undefined,
        size
      })
    })

    // Capture dialogs
    page.on('dialog', async dialog => {
      this.pendingDialog = {
        type: dialog.type() as DialogInfo['type'],
        message: dialog.message(),
        defaultValue: dialog.defaultValue()
      }

      if (this.autoHandleDialogs) {
        if (typeof this.dialogResponse === 'string') {
          await dialog.accept(this.dialogResponse)
        } else if (this.dialogResponse) {
          await dialog.accept()
        } else {
          await dialog.dismiss()
        }
        this.pendingDialog = null
      }
    })
  }

  // ============================================
  // NAVIGATION
  // ============================================

  /**
   * Navigate to URL
   */
  async navigate(url: string, options?: NavigateOptions): Promise<void> {
    const page = this.ensurePage()
    await page.goto(url, {
      timeout: options?.timeout || 30000,
      waitUntil: options?.waitUntil || 'load'
    })
  }

  /**
   * Go back in browser history
   */
  async goBack(): Promise<void> {
    const page = this.ensurePage()
    await page.goBack()
  }

  /**
   * Go forward in browser history
   */
  async goForward(): Promise<void> {
    const page = this.ensurePage()
    await page.goForward()
  }

  /**
   * Reload current page
   */
  async reload(): Promise<void> {
    const page = this.ensurePage()
    await page.reload()
  }

  /**
   * Get current URL
   */
  getUrl(): string {
    return this.ensurePage().url()
  }

  /**
   * Get page title
   */
  async getTitle(): Promise<string> {
    return await this.ensurePage().title()
  }

  // ============================================
  // CAPTURE
  // ============================================

  /**
   * Take screenshot
   *
   * @returns Base64 encoded image or saves to path
   */
  async screenshot(options?: ScreenshotOptions): Promise<Buffer> {
    const page = this.ensurePage()

    if (options?.selector) {
      const element = await page.locator(options.selector)
      return await element.screenshot({
        path: options?.path,
        type: options?.type || 'png',
        quality: options?.quality
      })
    }

    return await page.screenshot({
      path: options?.path,
      fullPage: options?.fullPage || false,
      type: options?.type || 'png',
      quality: options?.quality
    })
  }

  /**
   * Get visible text content
   */
  async getVisibleText(selector?: string): Promise<string> {
    const page = this.ensurePage()

    if (selector) {
      return await page.locator(selector).textContent() || ''
    }

    return await page.evaluate(() => document.body.innerText)
  }

  /**
   * Get HTML content (with optional cleanup)
   */
  async getVisibleHtml(options?: {
    selector?: string
    removeScripts?: boolean
    removeStyles?: boolean
    removeComments?: boolean
    minify?: boolean
  }): Promise<string> {
    const page = this.ensurePage()

    let html = options?.selector
      ? await page.locator(options.selector).innerHTML()
      : await page.content()

    if (options?.removeScripts) {
      html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    }

    if (options?.removeStyles) {
      html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    }

    if (options?.removeComments) {
      html = html.replace(/<!--[\s\S]*?-->/g, '')
    }

    if (options?.minify) {
      html = html.replace(/\s+/g, ' ').trim()
    }

    return html
  }

  /**
   * Save page as PDF
   */
  async savePdf(path: string, options?: {
    format?: 'A4' | 'Letter' | 'Legal' | 'Tabloid'
    printBackground?: boolean
    margin?: { top?: string; right?: string; bottom?: string; left?: string }
  }): Promise<Buffer> {
    const page = this.ensurePage()

    return await page.pdf({
      path,
      format: options?.format || 'A4',
      printBackground: options?.printBackground ?? true,
      margin: options?.margin
    })
  }

  // ============================================
  // INTERACTION
  // ============================================

  /**
   * Click element
   */
  async click(selector: string, options?: ClickOptions): Promise<void> {
    const page = this.ensurePage()
    await page.click(selector, {
      button: options?.button,
      clickCount: options?.clickCount,
      delay: options?.delay,
      timeout: options?.timeout
    })
  }

  /**
   * Hover over element
   */
  async hover(selector: string): Promise<void> {
    const page = this.ensurePage()
    await page.hover(selector)
  }

  /**
   * Fill input field
   */
  async fill(selector: string, value: string, options?: FillOptions): Promise<void> {
    const page = this.ensurePage()
    await page.fill(selector, value, {
      timeout: options?.timeout,
      force: options?.force
    })
  }

  /**
   * Type text (character by character, for realistic input)
   */
  async type(selector: string, text: string, delay?: number): Promise<void> {
    const page = this.ensurePage()
    await page.locator(selector).pressSequentially(text, { delay: delay || 50 })
  }

  /**
   * Select dropdown option
   */
  async select(selector: string, value: string | string[]): Promise<void> {
    const page = this.ensurePage()
    await page.selectOption(selector, value)
  }

  /**
   * Press keyboard key
   */
  async pressKey(key: string, selector?: string): Promise<void> {
    const page = this.ensurePage()

    if (selector) {
      await page.locator(selector).press(key)
    } else {
      await page.keyboard.press(key)
    }
  }

  /**
   * Drag element to target
   */
  async drag(sourceSelector: string, targetSelector: string): Promise<void> {
    const page = this.ensurePage()
    await page.dragAndDrop(sourceSelector, targetSelector)
  }

  /**
   * Upload file
   */
  async uploadFile(selector: string, filePath: string | string[]): Promise<void> {
    const page = this.ensurePage()
    await page.setInputFiles(selector, filePath)
  }

  // ============================================
  // VIEWPORT
  // ============================================

  /**
   * Resize viewport
   */
  async resize(width: number, height: number): Promise<void> {
    const page = this.ensurePage()
    await page.setViewportSize({ width, height })
  }

  /**
   * Set device emulation
   */
  async setDevice(device: string): Promise<void> {
    const page = this.ensurePage()
    const devices = await import('playwright').then(m => m.devices)
    const deviceConfig = devices[device]

    if (!deviceConfig) {
      throw new Error(`Unknown device: ${device}. See Playwright devices list.`)
    }

    await page.setViewportSize(deviceConfig.viewport)
  }

  // ============================================
  // IFRAME SUPPORT
  // ============================================

  /**
   * Click element inside iframe
   */
  async iframeClick(iframeSelector: string, elementSelector: string): Promise<void> {
    const page = this.ensurePage()
    const frame = page.frameLocator(iframeSelector)
    await frame.locator(elementSelector).click()
  }

  /**
   * Fill input inside iframe
   */
  async iframeFill(iframeSelector: string, elementSelector: string, value: string): Promise<void> {
    const page = this.ensurePage()
    const frame = page.frameLocator(iframeSelector)
    await frame.locator(elementSelector).fill(value)
  }

  // ============================================
  // JAVASCRIPT EXECUTION
  // ============================================

  /**
   * Execute JavaScript in page context
   */
  async evaluate<T>(script: string | (() => T)): Promise<T> {
    const page = this.ensurePage()
    return await page.evaluate(script as any)
  }

  /**
   * Get console logs
   */
  getConsoleLogs(options?: {
    type?: 'all' | 'error' | 'warning' | 'log' | 'info' | 'debug'
    search?: string
    limit?: number
    clear?: boolean
  }): ConsoleLogEntry[] {
    let logs = [...this.consoleLogs]

    if (options?.type && options.type !== 'all') {
      logs = logs.filter(log => log.type === options.type)
    }

    if (options?.search) {
      logs = logs.filter(log => log.text.includes(options.search!))
    }

    if (options?.limit) {
      logs = logs.slice(-options.limit)
    }

    if (options?.clear) {
      this.consoleLogs = []
    }

    return logs
  }

  /**
   * Set custom user agent
   */
  async setUserAgent(userAgent: string): Promise<void> {
    if (!this.context) {
      throw new Error('Browser not launched. Call launch() first.')
    }

    // Need to create new page with new context for UA change
    const newContext = await this.browser!.newContext({ userAgent })
    const newPage = await newContext.newPage()

    // Attach event listeners to new page
    this.attachPageListeners(newPage)

    await this.context.close()
    this.context = newContext
    this.page = newPage
  }

  // ============================================
  // NETWORK MONITORING (matches browser_network_requests)
  // ============================================

  /**
   * Get network logs (requests and responses)
   *
   * @example
   * const logs = browser.getNetworkLogs({ type: 'response', status: 200 })
   * const apiCalls = browser.getNetworkLogs({ urlPattern: /api/ })
   * const errors = browser.getNetworkLogs({ status: [400, 401, 403, 404, 500] })
   */
  getNetworkLogs(options?: {
    type?: 'request' | 'response' | 'all'
    urlPattern?: string | RegExp
    method?: string | string[]
    status?: number | number[]
    resourceType?: string | string[]
    limit?: number
    clear?: boolean
  }): NetworkLogEntry[] {
    let logs = [...this.networkLogs]

    // Filter by type
    if (options?.type && options.type !== 'all') {
      logs = logs.filter(log => log.type === options.type)
    }

    // Filter by URL pattern
    if (options?.urlPattern) {
      const pattern = options.urlPattern instanceof RegExp
        ? options.urlPattern
        : new RegExp(options.urlPattern)
      logs = logs.filter(log => pattern.test(log.url))
    }

    // Filter by method
    if (options?.method) {
      const methods = Array.isArray(options.method) ? options.method : [options.method]
      logs = logs.filter(log => methods.includes(log.method))
    }

    // Filter by status (responses only)
    if (options?.status) {
      const statuses = Array.isArray(options.status) ? options.status : [options.status]
      logs = logs.filter(log => log.status && statuses.includes(log.status))
    }

    // Filter by resource type
    if (options?.resourceType) {
      const types = Array.isArray(options.resourceType) ? options.resourceType : [options.resourceType]
      logs = logs.filter(log => log.resourceType && types.includes(log.resourceType))
    }

    // Limit results
    if (options?.limit) {
      logs = logs.slice(-options.limit)
    }

    // Clear logs if requested
    if (options?.clear) {
      this.networkLogs = []
      this.requestTimings.clear()
    }

    return logs
  }

  /**
   * Clear all network logs
   */
  clearNetworkLogs(): void {
    this.networkLogs = []
    this.requestTimings.clear()
  }

  /**
   * Get network summary statistics
   */
  getNetworkStats(): {
    totalRequests: number
    totalResponses: number
    byStatus: Record<number, number>
    byResourceType: Record<string, number>
    totalSize: number
    avgDuration: number
  } {
    const responses = this.networkLogs.filter(l => l.type === 'response')

    const byStatus: Record<number, number> = {}
    const byResourceType: Record<string, number> = {}
    let totalSize = 0
    let totalDuration = 0
    let durationCount = 0

    for (const log of responses) {
      if (log.status) {
        byStatus[log.status] = (byStatus[log.status] || 0) + 1
      }
      if (log.resourceType) {
        byResourceType[log.resourceType] = (byResourceType[log.resourceType] || 0) + 1
      }
      totalSize += log.size || 0
      if (log.duration) {
        totalDuration += log.duration
        durationCount++
      }
    }

    return {
      totalRequests: this.networkLogs.filter(l => l.type === 'request').length,
      totalResponses: responses.length,
      byStatus,
      byResourceType,
      totalSize,
      avgDuration: durationCount > 0 ? totalDuration / durationCount : 0
    }
  }

  // ============================================
  // DIALOG HANDLING (matches browser_handle_dialog)
  // ============================================

  /**
   * Configure automatic dialog handling
   *
   * @param auto - Whether to auto-handle dialogs
   * @param response - Response for prompts (string) or confirm/alert (boolean)
   */
  setDialogHandler(auto: boolean, response?: string | boolean): void {
    this.autoHandleDialogs = auto
    this.dialogResponse = response ?? true
  }

  /**
   * Get pending dialog (if any)
   */
  getPendingDialog(): DialogInfo | null {
    return this.pendingDialog
  }

  /**
   * Handle pending dialog manually
   */
  async handleDialog(action: 'accept' | 'dismiss', promptText?: string): Promise<void> {
    const page = this.ensurePage()

    // Wait briefly for dialog if not already captured
    if (!this.pendingDialog) {
      await this.wait(100)
    }

    if (!this.pendingDialog) {
      throw new Error('No pending dialog to handle')
    }

    // The dialog was already stored, we need to wait for the next one if already handled
    // This is a simplification - for more complex cases, we'd queue dialogs
    page.once('dialog', async dialog => {
      if (action === 'accept') {
        await dialog.accept(promptText)
      } else {
        await dialog.dismiss()
      }
    })

    this.pendingDialog = null
  }

  // ============================================
  // WAIT FOR TEXT (matches browser_wait_for)
  // ============================================

  /**
   * Wait for text to appear or disappear
   */
  async waitForText(text: string, options?: {
    state?: 'visible' | 'hidden'
    timeout?: number
  }): Promise<void> {
    const page = this.ensurePage()
    const locator = page.getByText(text)

    if (options?.state === 'hidden') {
      await locator.waitFor({ state: 'hidden', timeout: options?.timeout })
    } else {
      await locator.waitFor({ state: 'visible', timeout: options?.timeout })
    }
  }

  // ============================================
  // TAB MANAGEMENT (matches browser_tabs)
  // ============================================

  /**
   * Get all open tabs/pages
   */
  getTabs(): { url: string; title: string; index: number }[] {
    if (!this.context) {
      throw new Error('Browser not launched. Call launch() first.')
    }

    return this.context.pages().map((page, index) => ({
      url: page.url(),
      title: '', // Would need async to get title
      index
    }))
  }

  /**
   * Create new tab
   */
  async newTab(url?: string): Promise<void> {
    if (!this.context) {
      throw new Error('Browser not launched. Call launch() first.')
    }

    this.page = await this.context.newPage()

    // Attach all event listeners to new page
    this.attachPageListeners(this.page)

    if (url) {
      await this.page.goto(url)
    }
  }

  /**
   * Switch to tab by index
   */
  async switchTab(index: number): Promise<void> {
    if (!this.context) {
      throw new Error('Browser not launched. Call launch() first.')
    }

    const pages = this.context.pages()
    if (index < 0 || index >= pages.length) {
      throw new Error(`Tab index ${index} out of range (0-${pages.length - 1})`)
    }

    this.page = pages[index]
    await this.page.bringToFront()
  }

  /**
   * Close current tab
   */
  async closeTab(): Promise<void> {
    const page = this.ensurePage()
    await page.close()

    // Switch to another tab if available
    if (this.context) {
      const pages = this.context.pages()
      this.page = pages.length > 0 ? pages[pages.length - 1] : null
    }
  }

  // ============================================
  // WAITING
  // ============================================

  /**
   * Wait for element
   */
  async waitForSelector(selector: string, options?: {
    state?: 'attached' | 'detached' | 'visible' | 'hidden'
    timeout?: number
  }): Promise<void> {
    const page = this.ensurePage()
    await page.waitForSelector(selector, {
      state: options?.state,
      timeout: options?.timeout
    })
  }

  /**
   * Wait for navigation
   */
  async waitForNavigation(options?: {
    url?: string | RegExp
    timeout?: number
  }): Promise<void> {
    const page = this.ensurePage()
    await page.waitForURL(options?.url || '**/*', {
      timeout: options?.timeout
    })
  }

  /**
   * Wait for network idle
   */
  async waitForNetworkIdle(timeout?: number): Promise<void> {
    const page = this.ensurePage()
    await page.waitForLoadState('networkidle', { timeout })
  }

  /**
   * Wait fixed time (use sparingly)
   */
  async wait(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms))
  }

  // ============================================
  // RESPONSE MONITORING
  // ============================================

  /**
   * Wait for specific response
   */
  async waitForResponse(urlPattern: string | RegExp, options?: {
    timeout?: number
  }): Promise<{ status: number; body: string }> {
    const page = this.ensurePage()

    const response = await page.waitForResponse(urlPattern, {
      timeout: options?.timeout
    })

    return {
      status: response.status(),
      body: await response.text()
    }
  }

  // ============================================
  // ACCESSIBILITY
  // ============================================

  /**
   * Get accessibility tree snapshot
   * Uses ARIA snapshot for accessibility-focused content representation
   */
  async getAccessibilityTree(): Promise<string> {
    const page = this.ensurePage()
    // ariaSnapshot provides accessibility tree representation
    return await page.locator(':root').ariaSnapshot()
  }

  // ============================================
  // CLEANUP
  // ============================================

  /**
   * Close browser
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
      this.context = null
      this.page = null
      this.consoleLogs = []
      this.networkLogs = []
      this.requestTimings.clear()
      this.pendingDialog = null
    }
  }
}

// Export singleton for simple usage
export const browser = new PlaywrightBrowser()

// Export types (using type-only export to avoid runtime issues)
export type { Browser, Page, BrowserContext }
