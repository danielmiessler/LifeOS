/**
 * TikTok Scraper
 *
 * Top Actors:
 * - clockworks/tiktok-scraper (90,141 users, 4.61 rating)
 * - scraptik/tiktok-api (1,329 users, 4.68 rating, $0.002/request - LOWEST COST)
 *
 * Extract TikTok profiles, videos, hashtags, comments without login.
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

export interface TikTokProfileInput {
  /** TikTok username (without @) */
  username: string
  /** Maximum number of videos to include */
  maxVideos?: number
}

export interface TikTokProfile extends UserProfile {
  id: string
  username: string
  nickname?: string
  signature?: string
  verified?: boolean
  followersCount: number
  followingCount: number
  heartCount?: number
  videoCount?: number
  videos?: TikTokVideo[]
}

export interface TikTokVideo extends Post {
  id: string
  url: string
  text?: string
  desc?: string
  createTime: string
  videoUrl?: string
  coverUrl?: string
  playCount?: number
  likeCount: number
  commentCount: number
  shareCount: number
  downloadCount?: number
  musicTitle?: string
  musicAuthor?: string
  authorUsername?: string
  authorNickname?: string
  hashtags?: string[]
  mentions?: string[]
  isAd?: boolean
}

export interface TikTokHashtagInput extends PaginationOptions {
  /** Hashtag (without #) */
  hashtag: string
  /** Maximum number of videos to scrape */
  maxResults?: number
}

export interface TikTokCommentsInput extends PaginationOptions {
  /** TikTok video URL */
  videoUrl: string
  /** Maximum number of comments to scrape */
  maxResults?: number
}

export interface TikTokComment {
  id: string
  text: string
  createTime: string
  likeCount: number
  replyCount?: number
  username: string
  userNickname?: string
}

/* ============================================================================
 * FUNCTIONS
 * ========================================================================= */

/**
 * Scrape TikTok profile data
 *
 * @param input - Profile scraping options
 * @param options - Actor run options
 * @returns TikTok profile with videos
 *
 * @example
 * ```typescript
 * const profile = await scrapeTikTokProfile({
 *   username: 'exampleuser',
 *   maxVideos: 30
 * })
 *
 * // Filter in code - only viral videos
 * const viral = profile.videos?.filter(v => v.playCount > 1000000)
 * ```
 */
export async function scrapeTikTokProfile(
  input: TikTokProfileInput,
  options?: ActorRunOptions
): Promise<TikTokProfile> {
  const apify = new Apify()

  const run = await apify.callActor('clockworks/tiktok-profile-scraper', {
    profiles: [`https://www.tiktok.com/@${input.username}`],
    resultsPerPage: input.maxVideos || 30
  }, options)

  await apify.waitForRun(run.id)

  const finalRun = await apify.getRun(run.id)
  if (finalRun.status !== 'SUCCEEDED') {
    throw new Error(`TikTok profile scraping failed: ${finalRun.status}`)
  }

  const dataset = apify.getDataset(finalRun.defaultDatasetId)
  const items = await dataset.listItems({ limit: 1 })

  if (items.length === 0) {
    throw new Error(`Profile not found: @${input.username}`)
  }

  const profile = items[0]

  return {
    id: profile.authorMeta?.id,
    username: input.username,
    nickname: profile.authorMeta?.name,
    fullName: profile.authorMeta?.name,
    bio: profile.authorMeta?.signature,
    signature: profile.authorMeta?.signature,
    verified: profile.authorMeta?.verified,
    followersCount: profile.authorMeta?.fans || 0,
    followingCount: profile.authorMeta?.following || 0,
    heartCount: profile.authorMeta?.heart,
    videoCount: profile.authorMeta?.video,
    videos: profile.posts?.map(transformVideo)
  }
}

/**
 * Scrape TikTok videos by hashtag
 *
 * @param input - Hashtag scraping options
 * @param options - Actor run options
 * @returns Array of TikTok videos
 *
 * @example
 * ```typescript
 * const videos = await scrapeTikTokHashtag({
 *   hashtag: 'ai',
 *   maxResults: 100
 * })
 *
 * // Filter in code - only high engagement
 * const topVideos = videos
 *   .filter(v => v.likeCount > 10000)
 *   .sort((a, b) => b.likeCount - a.likeCount)
 *   .slice(0, 10)
 * ```
 */
export async function scrapeTikTokHashtag(
  input: TikTokHashtagInput,
  options?: ActorRunOptions
): Promise<TikTokVideo[]> {
  const apify = new Apify()

  const run = await apify.callActor('clockworks/tiktok-hashtag-scraper', {
    hashtags: [input.hashtag],
    resultsPerPage: input.maxResults || 100
  }, options)

  await apify.waitForRun(run.id)

  const finalRun = await apify.getRun(run.id)
  if (finalRun.status !== 'SUCCEEDED') {
    throw new Error(`TikTok hashtag scraping failed: ${finalRun.status}`)
  }

  const dataset = apify.getDataset(finalRun.defaultDatasetId)
  const items = await dataset.listItems({
    limit: input.maxResults || 1000,
    offset: input.offset || 0
  })

  return items.map(transformVideo)
}

/**
 * Scrape TikTok comments from a video
 *
 * @param input - Comment scraping options
 * @param options - Actor run options
 * @returns Array of comments
 *
 * @example
 * ```typescript
 * const comments = await scrapeTikTokComments({
 *   videoUrl: 'https://www.tiktok.com/@user/video/123',
 *   maxResults: 200
 * })
 *
 * // Filter in code - only popular comments
 * const popular = comments.filter(c => c.likeCount > 50)
 * ```
 */
export async function scrapeTikTokComments(
  input: TikTokCommentsInput,
  options?: ActorRunOptions
): Promise<TikTokComment[]> {
  const apify = new Apify()

  const run = await apify.callActor('clockworks/tiktok-comments-scraper', {
    postURLs: [input.videoUrl],
    maxComments: input.maxResults || 100
  }, options)

  await apify.waitForRun(run.id)

  const finalRun = await apify.getRun(run.id)
  if (finalRun.status !== 'SUCCEEDED') {
    throw new Error(`TikTok comments scraping failed: ${finalRun.status}`)
  }

  const dataset = apify.getDataset(finalRun.defaultDatasetId)
  const items = await dataset.listItems({
    limit: input.maxResults || 1000,
    offset: input.offset || 0
  })

  return items.map((comment: any) => ({
    id: comment.cid,
    text: comment.text,
    createTime: comment.createTime,
    likeCount: comment.diggCount || 0,
    replyCount: comment.replyCommentTotal,
    username: comment.user?.uniqueId,
    userNickname: comment.user?.nickname
  }))
}

/* ============================================================================
 * HELPERS
 * ========================================================================= */

function transformVideo(video: any): TikTokVideo {
  return {
    id: video.id,
    url: video.webVideoUrl || `https://www.tiktok.com/@${video.authorMeta?.name}/video/${video.id}`,
    text: video.text,
    desc: video.text,
    caption: video.text,
    createTime: video.createTime,
    timestamp: video.createTime,
    videoUrl: video.videoUrl,
    coverUrl: video.covers?.default,
    playCount: video.playCount,
    viewsCount: video.playCount,
    likeCount: video.diggCount || 0,
    likesCount: video.diggCount || 0,
    commentCount: video.commentCount || 0,
    commentsCount: video.commentCount || 0,
    shareCount: video.shareCount || 0,
    sharesCount: video.shareCount || 0,
    downloadCount: video.downloadCount,
    musicTitle: video.musicMeta?.musicName,
    musicAuthor: video.musicMeta?.musicAuthor,
    authorUsername: video.authorMeta?.name,
    authorNickname: video.authorMeta?.nickName,
    hashtags: video.hashtags?.map((h: any) => h.name),
    mentions: video.mentions,
    isAd: video.isAd
  }
}
