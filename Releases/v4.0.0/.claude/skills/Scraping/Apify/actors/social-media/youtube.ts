/**
 * YouTube Scraper
 *
 * Top Actors:
 * - streamers/youtube-scraper (40,455 users, 4.40 rating, $0.005/video)
 * - apidojo/youtube-scraper (4,336 users, 3.88 rating, $0.50/1k videos)
 *
 * Extract YouTube channels, videos, comments - no API quotas/limits!
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

export interface YouTubeChannelInput {
  /** YouTube channel URL or ID */
  channelUrl: string
  /** Maximum number of videos to include */
  maxVideos?: number
}

export interface YouTubeChannel extends UserProfile {
  id: string
  title: string
  url: string
  description?: string
  subscribersCount?: number
  videosCount?: number
  viewsCount?: number
  joinedDate?: string
  country?: string
  thumbnailUrl?: string
  bannerUrl?: string
  verified?: boolean
  videos?: YouTubeVideo[]
}

export interface YouTubeVideo extends Post {
  id: string
  url: string
  title: string
  description?: string
  channelId?: string
  channelTitle?: string
  channelUrl?: string
  publishedAt: string
  viewsCount: number
  likesCount?: number
  commentsCount?: number
  duration?: string
  thumbnailUrl?: string
  tags?: string[]
  category?: string
}

export interface YouTubeSearchInput extends PaginationOptions {
  /** Search query */
  query: string
  /** Maximum number of videos */
  maxResults?: number
  /** Upload date filter */
  uploadDate?: 'hour' | 'today' | 'week' | 'month' | 'year'
  /** Duration filter */
  duration?: 'short' | 'medium' | 'long'
  /** Sort by */
  sortBy?: 'relevance' | 'date' | 'viewCount' | 'rating'
}

export interface YouTubeCommentsInput extends PaginationOptions {
  /** YouTube video URL or ID */
  videoUrl: string
  /** Maximum number of comments */
  maxResults?: number
}

export interface YouTubeComment {
  id: string
  text: string
  authorName: string
  authorChannelUrl?: string
  likesCount: number
  replyCount?: number
  publishedAt: string
}

/* ============================================================================
 * FUNCTIONS
 * ========================================================================= */

/**
 * Scrape YouTube channel data
 *
 * @param input - Channel scraping options
 * @param options - Actor run options
 * @returns YouTube channel with videos
 *
 * @example
 * ```typescript
 * const channel = await scrapeYouTubeChannel({
 *   channelUrl: 'https://www.youtube.com/@exampleuser',
 *   maxVideos: 50
 * })
 *
 * // Filter in code - only high-performing videos
 * const topVideos = channel.videos
 *   ?.filter(v => v.viewsCount > 10000)
 *   .sort((a, b) => b.viewsCount - a.viewsCount)
 *   .slice(0, 10)
 * ```
 */
export async function scrapeYouTubeChannel(
  input: YouTubeChannelInput,
  options?: ActorRunOptions
): Promise<YouTubeChannel> {
  const apify = new Apify()

  const run = await apify.callActor('streamers/youtube-channel-scraper', {
    startUrls: [input.channelUrl],
    maxResults: input.maxVideos || 50
  }, options)

  await apify.waitForRun(run.id)

  const finalRun = await apify.getRun(run.id)
  if (finalRun.status !== 'SUCCEEDED') {
    throw new Error(`YouTube channel scraping failed: ${finalRun.status}`)
  }

  const dataset = apify.getDataset(finalRun.defaultDatasetId)
  const items = await dataset.listItems()

  if (items.length === 0) {
    throw new Error(`Channel not found: ${input.channelUrl}`)
  }

  // First item is channel info, rest are videos
  const channelData = items[0]
  const videos = items.slice(1).map(transformVideo)

  return {
    id: channelData.channelId,
    title: channelData.title,
    fullName: channelData.title,
    url: channelData.url || input.channelUrl,
    description: channelData.description,
    bio: channelData.description,
    subscribersCount: channelData.numberOfSubscribers,
    followersCount: channelData.numberOfSubscribers,
    videosCount: channelData.numberOfVideos,
    viewsCount: channelData.numberOfViews,
    joinedDate: channelData.joinedDate,
    country: channelData.country,
    thumbnailUrl: channelData.thumbnailUrl,
    bannerUrl: channelData.bannerUrl,
    verified: channelData.verified,
    videos
  }
}

/**
 * Search YouTube videos
 *
 * @param input - Search parameters
 * @param options - Actor run options
 * @returns Array of YouTube videos
 *
 * @example
 * ```typescript
 * const videos = await searchYouTube({
 *   query: 'artificial intelligence tutorial',
 *   maxResults: 100,
 *   uploadDate: 'month',
 *   sortBy: 'viewCount'
 * })
 *
 * // Filter in code - only videos with high engagement
 * const engaging = videos.filter(v =>
 *   v.viewsCount > 50000 &&
 *   (v.likesCount || 0) > 1000
 * )
 * ```
 */
export async function searchYouTube(
  input: YouTubeSearchInput,
  options?: ActorRunOptions
): Promise<YouTubeVideo[]> {
  const apify = new Apify()

  const run = await apify.callActor('streamers/youtube-scraper', {
    searchKeywords: input.query,
    maxResults: input.maxResults || 50,
    uploadDate: input.uploadDate,
    videoDuration: input.duration,
    sortBy: input.sortBy || 'relevance'
  }, options)

  await apify.waitForRun(run.id)

  const finalRun = await apify.getRun(run.id)
  if (finalRun.status !== 'SUCCEEDED') {
    throw new Error(`YouTube search failed: ${finalRun.status}`)
  }

  const dataset = apify.getDataset(finalRun.defaultDatasetId)
  const items = await dataset.listItems({
    limit: input.maxResults || 1000,
    offset: input.offset || 0
  })

  return items.map(transformVideo)
}

/**
 * Scrape YouTube comments from a video
 *
 * @param input - Comment scraping options
 * @param options - Actor run options
 * @returns Array of comments
 *
 * @example
 * ```typescript
 * const comments = await scrapeYouTubeComments({
 *   videoUrl: 'https://www.youtube.com/watch?v=ABC123',
 *   maxResults: 500
 * })
 *
 * // Filter in code - only highly-liked comments
 * const popular = comments
 *   .filter(c => c.likesCount > 100)
 *   .sort((a, b) => b.likesCount - a.likesCount)
 * ```
 */
export async function scrapeYouTubeComments(
  input: YouTubeCommentsInput,
  options?: ActorRunOptions
): Promise<YouTubeComment[]> {
  const apify = new Apify()

  const run = await apify.callActor('streamers/youtube-comments-scraper', {
    startUrls: [input.videoUrl],
    maxComments: input.maxResults || 100
  }, options)

  await apify.waitForRun(run.id)

  const finalRun = await apify.getRun(run.id)
  if (finalRun.status !== 'SUCCEEDED') {
    throw new Error(`YouTube comments scraping failed: ${finalRun.status}`)
  }

  const dataset = apify.getDataset(finalRun.defaultDatasetId)
  const items = await dataset.listItems({
    limit: input.maxResults || 1000,
    offset: input.offset || 0
  })

  return items.map((comment: any) => ({
    id: comment.id,
    text: comment.text,
    authorName: comment.authorText,
    authorChannelUrl: comment.authorChannelUrl,
    likesCount: comment.likesCount || 0,
    replyCount: comment.replyCount,
    publishedAt: comment.publishedTimeText
  }))
}

/* ============================================================================
 * HELPERS
 * ========================================================================= */

function transformVideo(video: any): YouTubeVideo {
  return {
    id: video.id,
    url: video.url || `https://www.youtube.com/watch?v=${video.id}`,
    title: video.title,
    text: video.title,
    description: video.description,
    channelId: video.channelId,
    channelTitle: video.channelName || video.channelTitle,
    channelUrl: video.channelUrl,
    publishedAt: video.date || video.publishedAt,
    timestamp: video.date || video.publishedAt,
    viewsCount: video.views || video.viewsCount || 0,
    likesCount: video.likes || video.likesCount,
    commentsCount: video.numberOfComments || video.commentsCount,
    duration: video.duration,
    thumbnailUrl: video.thumbnail || video.thumbnailUrl,
    tags: video.tags,
    category: video.category
  }
}
