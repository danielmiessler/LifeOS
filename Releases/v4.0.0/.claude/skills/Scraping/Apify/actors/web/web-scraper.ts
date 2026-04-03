/**
 * Web Scraper (General Purpose)
 *
 * Apify Actor: apify/web-scraper (94,522 users, 4.39 rating)
 * Pricing: FREE - only pay for Apify platform usage
 *
 * Crawl any website and extract structured data using JavaScript functions.
 * Most versatile actor - handles ANY website!
 */

import { Apify } from '../../index'
import type {
  PaginationOptions,
  ActorRunOptions
} from '../../types'

/* ============================================================================
 * TYPES
 * ========================================================================= */

export interface WebScraperInput {
  /** URLs to start crawling from */
  startUrls: string[]
  /** JavaScript function to extract data from each page */
  pageFunction?: string
  /** CSS selector for links to follow */
  linkSelector?: string
  /** Pseudo-URLs to match for crawling */
  pseudoUrls?: string[]
  /** Maximum pages to crawl */
  maxPagesPerCrawl?: number
  /** Maximum crawling depth */
  maxCrawlingDepth?: number
  /** Proxy configuration */
  useProxy?: boolean
  /** Wait for dynamic content (ms) */
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2'
}

export interface ScrapedPage {
  url: string
  title?: string
  html?: string
  text?: string
  [key: string]: any // Custom extracted data
}

/* ============================================================================
 * FUNCTIONS
 * ========================================================================= */

/**
 * Scrape data from websites using custom extraction logic
 *
 * @param input - Web scraping configuration
 * @param options - Actor run options
 * @returns Array of scraped pages with extracted data
 *
 * @example
 * ```typescript
 * // Scrape product listings
 * const products = await scrapeWebsite({
 *   startUrls: ['https://example.com/products'],
 *   linkSelector: 'a.product-link',
 *   maxPagesPerCrawl: 100,
 *   pageFunction: `
 *     async function pageFunction(context) {
 *       const { request, $, log } = context
 *
 *       // Extract data using jQuery-like selectors
 *       return {
 *         url: request.url,
 *         title: $('h1.product-title').text(),
 *         price: $('span.price').text(),
 *         description: $('.description').text(),
 *         inStock: $('.in-stock').length > 0
 *       }
 *     }
 *   `
 * })
 *
 * // Filter in code - only available products under $100
 * const affordable = products.filter(p =>
 *   p.inStock &&
 *   parseFloat(p.price.replace('$', '')) < 100
 * )
 * ```
 *
 * @example
 * ```typescript
 * // Simple HTML/text extraction
 * const pages = await scrapeWebsite({
 *   startUrls: ['https://blog.example.com'],
 *   linkSelector: 'a.post-link',
 *   maxPagesPerCrawl: 50,
 *   pageFunction: `
 *     async function pageFunction(context) {
 *       const { request, $, log } = context
 *
 *       return {
 *         url: request.url,
 *         title: $('h1').first().text(),
 *         author: $('.author').text(),
 *         date: $('.date').text(),
 *         content: $('.post-content').text(),
 *         tags: $('.tag').map((i, el) => $(el).text()).get()
 *       }
 *     }
 *   `
 * })
 *
 * // Filter in code - only recent posts
 * const recent = pages.filter(p => {
 *   const postDate = new Date(p.date)
 *   const monthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)
 *   return postDate.getTime() > monthAgo
 * })
 * ```
 */
export async function scrapeWebsite(
  input: WebScraperInput,
  options?: ActorRunOptions
): Promise<ScrapedPage[]> {
  const apify = new Apify()

  // Default page function that extracts basic data
  const defaultPageFunction = `
    async function pageFunction(context) {
      const { request, $, log } = context

      return {
        url: request.url,
        title: $('title').text() || $('h1').first().text(),
        text: $('body').text().trim()
      }
    }
  `

  const run = await apify.callActor('apify/web-scraper', {
    startUrls: input.startUrls.map(url => ({ url })),
    pageFunction: input.pageFunction || defaultPageFunction,
    linkSelector: input.linkSelector,
    pseudoUrls: input.pseudoUrls?.map(pattern => ({ purl: pattern })),
    maxPagesPerCrawl: input.maxPagesPerCrawl || 100,
    maxCrawlingDepth: input.maxCrawlingDepth || 0,
    useProxy: input.useProxy || false,
    waitUntil: input.waitUntil || 'networkidle2'
  }, options)

  await apify.waitForRun(run.id)

  const finalRun = await apify.getRun(run.id)
  if (finalRun.status !== 'SUCCEEDED') {
    throw new Error(`Web scraping failed: ${finalRun.status}`)
  }

  const dataset = apify.getDataset(finalRun.defaultDatasetId)
  const items = await dataset.listItems({
    limit: input.maxPagesPerCrawl || 10000
  })

  return items as ScrapedPage[]
}

/**
 * Extract structured data from a single page
 *
 * @param url - URL to scrape
 * @param pageFunction - JavaScript function to extract data
 * @param options - Actor run options
 * @returns Extracted data
 *
 * @example
 * ```typescript
 * // Scrape a single product page
 * const product = await scrapePage(
 *   'https://example.com/product/123',
 *   `async function pageFunction(context) {
 *     const { $, request } = context
 *     return {
 *       name: $('h1.product-name').text(),
 *       price: $('span.price').text(),
 *       rating: parseFloat($('.rating').attr('data-rating')),
 *       reviews: parseInt($('.review-count').text()),
 *       images: $('img.product-image')
 *         .map((i, el) => $(el).attr('src'))
 *         .get()
 *     }
 *   }`
 * )
 *
 * console.log(`${product.name} - ${product.price}`)
 * console.log(`Rating: ${product.rating}/5 (${product.reviews} reviews)`)
 * ```
 */
export async function scrapePage(
  url: string,
  pageFunction: string,
  options?: ActorRunOptions
): Promise<ScrapedPage> {
  const results = await scrapeWebsite({
    startUrls: [url],
    maxPagesPerCrawl: 1,
    pageFunction
  }, options)

  if (results.length === 0) {
    throw new Error(`Failed to scrape page: ${url}`)
  }

  return results[0]
}
