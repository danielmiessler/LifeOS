/**
 * Twitter/X Scraper
 *
 * Top Actor:
 * - apidojo/twitter-scraper-lite (Unlimited, no rate limits, event-based pricing)
 *
 * Extract Twitter/X profiles, tweets, followers, and search results.
 */

import { Apify } from '../../index'
import type {
  UserProfile,
  Post,
  PaginationOptions,
  ActorRunOptions
} from '../../types'

/* ============================================================================
 * TYPES
 * ========================================================================= */

export interface TwitterProfileInput {
  /** Twitter username (without @) */
  username: string
  /** Include tweets in profile response */
  includeTweets?: boolean
  /** Maximum number of tweets to fetch */
  maxTweets?: number
}

export interface TwitterProfile extends UserProfile {
  username: string
  displayName: string
  bio?: string
  location?: string
  website?: string
  profileImageUrl?: string
  bannerImageUrl?: string
  followersCount?: number
  followingCount?: number
  tweetsCount?: number
  verified?: boolean
  createdAt?: string
  latestTweets?: TwitterTweet[]
}

export interface TwitterTweetsInput extends PaginationOptions {
  /** Twitter username (without @) */
  username: string
  /** Maximum number of tweets to scrape */
  maxTweets?: number
  /** Include replies */
  includeReplies?: boolean
  /** Include retweets */
  includeRetweets?: boolean
}

export interface TwitterSearchInput extends PaginationOptions {
  /** Search query */
  query: string
  /** Maximum number of tweets to return */
  maxTweets?: number
  /** Search type: "Latest", "Top", "People", "Photos", "Videos" */
  searchType?: string
}

export interface TwitterTweet extends Post {
  id: string
  url: string
  text: string
  authorUsername: string
  authorDisplayName: string
  timestamp: string
  likesCount: number
  retweetsCount: number
  repliesCount: number
  viewsCount?: number
  hashtags?: string[]
  mentions?: string[]
  imageUrls?: string[]
  videoUrl?: string
  isRetweet?: boolean
  isReply?: boolean
  quotedTweet?: TwitterTweet
}

/* ============================================================================
 * FUNCTIONS
 * ========================================================================= */

/**
 * Scrape Twitter/X profile data
 *
 * @param input - Profile scraping options
 * @param options - Actor run options
 * @returns Twitter profile data
 *
 * @example
 * ```typescript
 * // Scrape profile with latest tweets
 * const profile = await scrapeTwitterProfile({
 *   username: 'exampleuser',
 *   includeTweets: true,
 *   maxTweets: 20
 * })
 *
 * console.log(`${profile.displayName} (@${profile.username})`)
 * console.log(`Followers: ${profile.followersCount}`)
 * console.log(`Latest tweets: ${profile.latestTweets?.length}`)
 * ```
 */
export async function scrapeTwitterProfile(
  input: TwitterProfileInput,
  options?: ActorRunOptions
): Promise<TwitterProfile> {
  const apify = new Apify()

  const run = await apify.callActor('apidojo/twitter-scraper-lite', {
    mode: 'profile',
    username: input.username,
    maxTweets: input.includeTweets ? (input.maxTweets || 20) : 0
  }, options)

  await apify.waitForRun(run.id)

  const finalRun = await apify.getRun(run.id)
  if (finalRun.status !== 'SUCCEEDED') {
    throw new Error(`Twitter profile scraping failed: ${finalRun.status}`)
  }

  const dataset = apify.getDataset(finalRun.defaultDatasetId)
  const items = await dataset.listItems({ limit: 100 })

  if (items.length === 0) {
    throw new Error(`Profile not found: @${input.username}`)
  }

  // First item is profile, rest are tweets
  const profileData = items[0]
  const tweets = items.slice(1)

  return {
    username: profileData.username || input.username,
    displayName: profileData.name || profileData.displayName,
    bio: profileData.description || profileData.bio,
    location: profileData.location,
    website: profileData.url || profileData.website,
    profileImageUrl: profileData.profileImageUrl,
    bannerImageUrl: profileData.bannerImageUrl,
    followersCount: profileData.followersCount || profileData.followers,
    followingCount: profileData.followingCount || profileData.following,
    tweetsCount: profileData.tweetsCount || profileData.tweets,
    verified: profileData.verified || profileData.isVerified,
    createdAt: profileData.createdAt,
    latestTweets: tweets.map(mapToTwitterTweet)
  }
}

/**
 * Scrape tweets from a Twitter/X user
 *
 * @param input - Tweets scraping options
 * @param options - Actor run options
 * @returns Array of tweets
 *
 * @example
 * ```typescript
 * // Get latest tweets
 * const tweets = await scrapeTwitterTweets({
 *   username: 'exampleuser',
 *   maxTweets: 100,
 *   includeReplies: false
 * })
 *
 * // Filter in code - only high engagement
 * const viral = tweets.filter(t =>
 *   t.likesCount > 100 || t.retweetsCount > 50
 * )
 * ```
 */
export async function scrapeTwitterTweets(
  input: TwitterTweetsInput,
  options?: ActorRunOptions
): Promise<TwitterTweet[]> {
  const apify = new Apify()

  const run = await apify.callActor('apidojo/twitter-scraper-lite', {
    mode: 'tweets',
    username: input.username,
    maxTweets: input.maxTweets || 100,
    includeReplies: input.includeReplies !== false,
    includeRetweets: input.includeRetweets !== false
  }, options)

  await apify.waitForRun(run.id)

  const finalRun = await apify.getRun(run.id)
  if (finalRun.status !== 'SUCCEEDED') {
    throw new Error(`Twitter tweets scraping failed: ${finalRun.status}`)
  }

  const dataset = apify.getDataset(finalRun.defaultDatasetId)
  const items = await dataset.listItems({
    limit: input.maxTweets || 1000,
    offset: input.offset || 0
  })

  return items.map(mapToTwitterTweet)
}

/**
 * Search Twitter/X for tweets
 *
 * @param input - Search parameters
 * @param options - Actor run options
 * @returns Array of tweets matching search
 *
 * @example
 * ```typescript
 * // Search for AI security tweets
 * const tweets = await searchTwitter({
 *   query: 'AI security',
 *   maxTweets: 50,
 *   searchType: 'Latest'
 * })
 *
 * // Filter in code - only from verified users
 * const verifiedTweets = tweets.filter(t =>
 *   t.authorVerified === true
 * )
 * ```
 */
export async function searchTwitter(
  input: TwitterSearchInput,
  options?: ActorRunOptions
): Promise<TwitterTweet[]> {
  const apify = new Apify()

  const run = await apify.callActor('apidojo/twitter-scraper-lite', {
    mode: 'search',
    query: input.query,
    maxTweets: input.maxTweets || 100,
    searchType: input.searchType || 'Latest'
  }, options)

  await apify.waitForRun(run.id)

  const finalRun = await apify.getRun(run.id)
  if (finalRun.status !== 'SUCCEEDED') {
    throw new Error(`Twitter search failed: ${finalRun.status}`)
  }

  const dataset = apify.getDataset(finalRun.defaultDatasetId)
  const items = await dataset.listItems({
    limit: input.maxTweets || 1000,
    offset: input.offset || 0
  })

  return items.map(mapToTwitterTweet)
}

/* ============================================================================
 * HELPERS
 * ========================================================================= */

function mapToTwitterTweet(tweet: any): TwitterTweet {
  return {
    id: tweet.id || tweet.tweetId,
    url: tweet.url || `https://twitter.com/${tweet.authorUsername}/status/${tweet.id}`,
    text: tweet.text || tweet.fullText,
    authorUsername: tweet.authorUsername || tweet.username,
    authorDisplayName: tweet.authorName || tweet.displayName,
    timestamp: tweet.createdAt || tweet.timestamp,
    likesCount: tweet.likesCount || tweet.likes || 0,
    retweetsCount: tweet.retweetsCount || tweet.retweets || 0,
    repliesCount: tweet.repliesCount || tweet.replies || 0,
    viewsCount: tweet.viewsCount || tweet.views,
    commentsCount: tweet.repliesCount || tweet.replies || 0,
    hashtags: tweet.hashtags,
    mentions: tweet.mentions,
    imageUrls: tweet.media?.filter((m: any) => m.type === 'photo').map((m: any) => m.url),
    videoUrl: tweet.media?.find((m: any) => m.type === 'video')?.url,
    isRetweet: tweet.isRetweet,
    isReply: tweet.isReplyTo !== undefined,
    quotedTweet: tweet.quotedTweet ? mapToTwitterTweet(tweet.quotedTweet) : undefined,
    caption: tweet.text || tweet.fullText
  }
}
