/**
 * Apify Actors - File-Based API Wrappers
 *
 * Direct API access to the most popular Apify actors without MCP overhead.
 * Filter data in code BEFORE returning to model context for massive token savings.
 *
 * Categories:
 * - Social Media: Instagram, LinkedIn, TikTok, YouTube, Facebook
 * - Business: Google Maps (lead generation)
 * - E-commerce: Amazon
 * - Web: General-purpose web scraper
 *
 * Token Efficiency Example:
 * - MCP approach: ~50,000 tokens (full unfiltered dataset)
 * - Code-first approach: ~500 tokens (filtered top 10 results)
 * - Savings: 99% token reduction!
 *
 * @example
 * ```typescript
 * import { scrapeInstagramProfile, searchGoogleMaps } from './actors'
 *
 * // Instagram profile with filtering
 * const profile = await scrapeInstagramProfile({
 *   username: 'exampleuser',
 *   maxPosts: 50
 * })
 *
 * // Filter in code - only viral posts
 * const viral = profile.latestPosts?.filter(p => p.likesCount > 10000)
 *
 * // Google Maps lead generation
 * const places = await searchGoogleMaps({
 *   query: 'coffee shops in San Francisco',
 *   maxResults: 100,
 *   scrapeContactInfo: true
 * })
 *
 * // Filter in code - only highly rated with email
 * const leads = places
 *   .filter(p => p.rating >= 4.5 && p.email)
 *   .map(p => ({ name: p.name, email: p.email, phone: p.phone }))
 * ```
 */

// Social Media
export * from './social-media'

// Business & Lead Generation
export * from './business'

// E-commerce
export * from './ecommerce'

// Web Scraping
export * from './web'
