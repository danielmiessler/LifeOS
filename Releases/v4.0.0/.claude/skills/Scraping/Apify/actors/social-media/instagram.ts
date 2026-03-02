/**
 * Instagram Scraper
 *
 * Apify Actor: apify/instagram-scraper (145,279 users, 4.60 rating)
 * Pricing: $0.50-$2.70 per 1000 results (tiered)
 *
 * Extract Instagram profiles, posts, hashtags, comments without login.
 */

import { Apify } from '../../index'
import type {
  UserProfile,
  Post,
  EngagementMetrics,
  PaginationOptions,
  ActorRunOptions
} from '../../types'

/* ============================================================================
 * TYPES
 * ========================================================================= */

export interface InstagramProfileInput {
  /** Instagram username (without @) */
  username: string
  /** Maximum number of latest posts to include */
  maxPosts?: number
  /** Include profile metadata */
  includeMetadata?: boolean
}

export interface InstagramProfile extends UserProfile {
  username: string
  fullName: string
  biography?: string
  externalUrl?: string
  followersCount: number
  followingCount: number
  postsCount: number
  isPrivate?: boolean
  isVerified?: boolean
  latestPosts?: InstagramPost[]
}

export interface InstagramPost extends Post {
  id: string
  shortCode: string
  url: string
  caption?: string
  imageUrl?: string
  videoUrl?: string
  likesCount: number
  commentsCount: number
  timestamp: string
  type: 'Image' | 'Video' | 'Sidecar'
  location?: {
    name?: string
    slug?: string
  }
  hashtags?: string[]
  mentions?: string[]
  isSponsored?: boolean
}

export interface InstagramPostsInput extends PaginationOptions {
  /** Instagram username (without @) */
  username: string
  /** Maximum number of posts to scrape */
  maxResults?: number
}

export interface InstagramHashtagInput extends PaginationOptions {
  /** Hashtag (without #) */
  hashtag: string
  /** Maximum number of posts to scrape */
  maxResults?: number
}

export interface InstagramCommentInput extends PaginationOptions {
  /** Instagram post URL */
  postUrl: string
  /** Maximum number of comments to scrape */
  maxResults?: number
}

export interface InstagramComment {
  id: string
  text: string
  timestamp: string
  likesCount: number
  ownerUsername: string
  ownerProfilePicUrl?: string
}

/* ============================================================================
 * FUNCTIONS
 * ========================================================================= */

/**
 * Scrape Instagram profile data
 *
 * @param input - Profile scraping options
 * @param options - Actor run options (memory, timeout)
 * @returns Profile data with optional latest posts
 *
 * @example
 * ```typescript
 * // Get profile with latest 12 posts
 * const profile = await scrapeInstagramProfile({
 *   username: 'exampleuser',
 *   maxPosts: 12
 * })
 *
 * // Filter in code - only high-engagement posts
 * const viralPosts = profile.latestPosts?.filter(p => p.likesCount > 10000)
 * console.log(`Found ${viralPosts?.length} viral posts`)
 * ```
 */
export async function scrapeInstagramProfile(
  input: InstagramProfileInput,
  options?: ActorRunOptions
): Promise<InstagramProfile> {
  const apify = new Apify()

  // Call the Instagram Profile Scraper actor
  const run = await apify.callActor('apify/instagram-profile-scraper', {
    usernames: [input.username],
    resultsLimit: input.maxPosts || 12
  }, options)

  // Wait for completion
  await apify.waitForRun(run.id)

  // Check status
  const finalRun = await apify.getRun(run.id)
  if (finalRun.status !== 'SUCCEEDED') {
    throw new Error(`Instagram profile scraping failed: ${finalRun.status}`)
  }

  // Get results
  const dataset = apify.getDataset(finalRun.defaultDatasetId)
  const items = await dataset.listItems({ limit: 1 })

  if (items.length === 0) {
    throw new Error(`Profile not found: @${input.username}`)
  }

  const profile = items[0]

  // Transform to our interface
  return {
    id: profile.id,
    username: profile.username,
    fullName: profile.fullName || profile.username,
    biography: profile.biography,
    externalUrl: profile.externalUrl,
    profilePictureUrl: profile.profilePicUrl,
    followersCount: profile.followersCount || 0,
    followingCount: profile.followsCount || 0,
    postsCount: profile.postsCount || 0,
    isPrivate: profile.private,
    isVerified: profile.verified,
    verified: profile.verified,
    latestPosts: profile.latestPosts?.map((post: any) => transformPost(post))
  }
}

/**
 * Scrape Instagram posts from a profile
 *
 * @param input - Posts scraping options
 * @param options - Actor run options
 * @returns Array of Instagram posts
 *
 * @example
 * ```typescript
 * // Scrape latest 50 posts
 * const posts = await scrapeInstagramPosts({
 *   username: 'exampleuser',
 *   maxResults: 50
 * })
 *
 * // Filter in code - posts from last 30 days with high engagement
 * const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)
 * const recentPopular = posts.filter(p =>
 *   new Date(p.timestamp).getTime() > thirtyDaysAgo &&
 *   p.likesCount > 1000
 * )
 *
 * // Only filtered results reach model context!
 * console.log(recentPopular)
 * ```
 */
export async function scrapeInstagramPosts(
  input: InstagramPostsInput,
  options?: ActorRunOptions
): Promise<InstagramPost[]> {
  const apify = new Apify()

  // Use the main Instagram scraper for posts
  const run = await apify.callActor('apify/instagram-post-scraper', {
    usernames: [input.username],
    resultsLimit: input.maxResults || 50
  }, options)

  await apify.waitForRun(run.id)

  const finalRun = await apify.getRun(run.id)
  if (finalRun.status !== 'SUCCEEDED') {
    throw new Error(`Instagram posts scraping failed: ${finalRun.status}`)
  }

  const dataset = apify.getDataset(finalRun.defaultDatasetId)
  const items = await dataset.listItems({
    limit: input.maxResults || 1000,
    offset: input.offset || 0
  })

  return items.map(transformPost)
}

/**
 * Scrape Instagram posts by hashtag
 *
 * @param input - Hashtag scraping options
 * @param options - Actor run options
 * @returns Array of Instagram posts with that hashtag
 *
 * @example
 * ```typescript
 * // Scrape top 100 posts for a hashtag
 * const posts = await scrapeInstagramHashtag({
 *   hashtag: 'ai',
 *   maxResults: 100
 * })
 *
 * // Filter in code - only videos with high views
 * const popularVideos = posts.filter(p =>
 *   p.type === 'Video' &&
 *   p.likesCount > 5000
 * ).slice(0, 10)
 * ```
 */
export async function scrapeInstagramHashtag(
  input: InstagramHashtagInput,
  options?: ActorRunOptions
): Promise<InstagramPost[]> {
  const apify = new Apify()

  const run = await apify.callActor('apify/instagram-hashtag-scraper', {
    hashtags: [input.hashtag],
    resultsLimit: input.maxResults || 100
  }, options)

  await apify.waitForRun(run.id)

  const finalRun = await apify.getRun(run.id)
  if (finalRun.status !== 'SUCCEEDED') {
    throw new Error(`Instagram hashtag scraping failed: ${finalRun.status}`)
  }

  const dataset = apify.getDataset(finalRun.defaultDatasetId)
  const items = await dataset.listItems({
    limit: input.maxResults || 1000,
    offset: input.offset || 0
  })

  return items.map(transformPost)
}

/**
 * Scrape Instagram comments from a post
 *
 * @param input - Comment scraping options
 * @param options - Actor run options
 * @returns Array of comments
 *
 * @example
 * ```typescript
 * const comments = await scrapeInstagramComments({
 *   postUrl: 'https://www.instagram.com/p/ABC123/',
 *   maxResults: 100
 * })
 *
 * // Filter in code - only comments with likes
 * const popularComments = comments
 *   .filter(c => c.likesCount > 10)
 *   .sort((a, b) => b.likesCount - a.likesCount)
 *   .slice(0, 10)
 * ```
 */
export async function scrapeInstagramComments(
  input: InstagramCommentInput,
  options?: ActorRunOptions
): Promise<InstagramComment[]> {
  const apify = new Apify()

  const run = await apify.callActor('apify/instagram-comment-scraper', {
    directUrls: [input.postUrl],
    resultsLimit: input.maxResults || 100
  }, options)

  await apify.waitForRun(run.id)

  const finalRun = await apify.getRun(run.id)
  if (finalRun.status !== 'SUCCEEDED') {
    throw new Error(`Instagram comments scraping failed: ${finalRun.status}`)
  }

  const dataset = apify.getDataset(finalRun.defaultDatasetId)
  const items = await dataset.listItems({
    limit: input.maxResults || 1000,
    offset: input.offset || 0
  })

  return items.map((item: any) => ({
    id: item.id,
    text: item.text,
    timestamp: item.timestamp,
    likesCount: item.likesCount || 0,
    ownerUsername: item.ownerUsername,
    ownerProfilePicUrl: item.ownerProfilePicUrl
  }))
}

/* ============================================================================
 * HELPERS
 * ========================================================================= */

/**
 * Transform raw Instagram post data to our standard format
 */
function transformPost(post: any): InstagramPost {
  return {
    id: post.id,
    shortCode: post.shortCode,
    url: post.url || `https://www.instagram.com/p/${post.shortCode}/`,
    caption: post.caption,
    imageUrl: post.displayUrl || post.imageUrl,
    videoUrl: post.videoUrl,
    likesCount: post.likesCount || 0,
    commentsCount: post.commentsCount || 0,
    viewsCount: post.videoViewCount,
    timestamp: post.timestamp,
    type: post.type || (post.videoUrl ? 'Video' : 'Image'),
    location: post.locationName ? {
      name: post.locationName,
      slug: post.locationSlug
    } : undefined,
    hashtags: post.hashtags,
    mentions: post.mentions,
    isSponsored: post.isSponsored,
    text: post.caption,
    author: post.ownerUsername ? {
      username: post.ownerUsername,
      fullName: post.ownerFullName
    } : undefined
  }
}
