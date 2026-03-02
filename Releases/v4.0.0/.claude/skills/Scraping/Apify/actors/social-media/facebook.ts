/**
 * Facebook Scraper
 *
 * Top Actors:
 * - apify/facebook-posts-scraper (35,226 users, 4.56 rating)
 * - apify/facebook-groups-scraper (16,182 users, 4.19 rating)
 * - apify/facebook-comments-scraper (17,173 users, 4.46 rating)
 *
 * Extract Facebook posts, groups, comments, pages without login.
 */

import { Apify } from '../../index'
import type {
  Post,
  UserProfile,
  PaginationOptions,
  ActorRunOptions
} from '../../types'

/* ============================================================================
 * TYPES
 * ========================================================================= */

export interface FacebookPostsInput extends PaginationOptions {
  /** Facebook page or profile URLs */
  pageUrls: string[]
  /** Maximum number of posts per page */
  maxPostsPerPage?: number
  /** Date range filter */
  fromDate?: string
  toDate?: string
}

export interface FacebookPost extends Post {
  id: string
  url: string
  text?: string
  postDate: string
  pageUrl?: string
  pageName?: string
  likesCount?: number
  commentsCount?: number
  sharesCount?: number
  imageUrls?: string[]
  videoUrl?: string
  type?: 'post' | 'video' | 'image' | 'link'
}

export interface FacebookGroupsInput extends PaginationOptions {
  /** Facebook group URLs */
  groupUrls: string[]
  /** Maximum posts per group */
  maxPostsPerGroup?: number
  /** Include comments */
  includeComments?: boolean
}

export interface FacebookGroupPost extends FacebookPost {
  groupName?: string
  groupUrl?: string
  authorName?: string
  authorUrl?: string
  comments?: FacebookComment[]
}

export interface FacebookCommentsInput extends PaginationOptions {
  /** Facebook post URLs */
  postUrls: string[]
  /** Maximum comments per post */
  maxCommentsPerPost?: number
}

export interface FacebookComment {
  id: string
  text: string
  date: string
  likesCount?: number
  authorName?: string
  authorUrl?: string
}

/* ============================================================================
 * FUNCTIONS
 * ========================================================================= */

/**
 * Scrape Facebook posts from pages or profiles
 *
 * @param input - Posts scraping options
 * @param options - Actor run options
 * @returns Array of Facebook posts
 *
 * @example
 * ```typescript
 * const posts = await scrapeFacebookPosts({
 *   pageUrls: ['https://www.facebook.com/SomePage'],
 *   maxPostsPerPage: 100
 * })
 *
 * // Filter in code - only high-engagement posts
 * const viral = posts.filter(p =>
 *   p.likesCount > 1000 || p.sharesCount > 100
 * )
 * ```
 */
export async function scrapeFacebookPosts(
  input: FacebookPostsInput,
  options?: ActorRunOptions
): Promise<FacebookPost[]> {
  const apify = new Apify()

  const run = await apify.callActor('apify/facebook-posts-scraper', {
    startUrls: input.pageUrls.map(url => ({ url })),
    maxPosts: input.maxPostsPerPage || 50,
    fromDate: input.fromDate,
    toDate: input.toDate
  }, options)

  await apify.waitForRun(run.id)

  const finalRun = await apify.getRun(run.id)
  if (finalRun.status !== 'SUCCEEDED') {
    throw new Error(`Facebook posts scraping failed: ${finalRun.status}`)
  }

  const dataset = apify.getDataset(finalRun.defaultDatasetId)
  const items = await dataset.listItems({
    limit: input.maxResults || 1000,
    offset: input.offset || 0
  })

  return items.map((post: any) => ({
    id: post.id,
    url: post.url,
    text: post.text,
    caption: post.text,
    postDate: post.time,
    timestamp: post.time,
    pageUrl: post.pageUrl,
    pageName: post.pageName,
    likesCount: post.likes,
    commentsCount: post.comments,
    sharesCount: post.shares,
    imageUrls: post.images,
    videoUrl: post.video,
    type: post.postType
  }))
}

/**
 * Scrape Facebook groups posts
 *
 * @param input - Groups scraping options
 * @param options - Actor run options
 * @returns Array of group posts
 *
 * @example
 * ```typescript
 * const posts = await scrapeFacebookGroups({
 *   groupUrls: ['https://www.facebook.com/groups/somegroupid'],
 *   maxPostsPerGroup: 50,
 *   includeComments: true
 * })
 *
 * // Filter in code - only posts with active discussion
 * const activeDiscussions = posts.filter(p =>
 *   p.commentsCount > 10
 * )
 * ```
 */
export async function scrapeFacebookGroups(
  input: FacebookGroupsInput,
  options?: ActorRunOptions
): Promise<FacebookGroupPost[]> {
  const apify = new Apify()

  const run = await apify.callActor('apify/facebook-groups-scraper', {
    startUrls: input.groupUrls.map(url => ({ url })),
    maxPosts: input.maxPostsPerGroup || 50,
    includeComments: input.includeComments || false
  }, options)

  await apify.waitForRun(run.id)

  const finalRun = await apify.getRun(run.id)
  if (finalRun.status !== 'SUCCEEDED') {
    throw new Error(`Facebook groups scraping failed: ${finalRun.status}`)
  }

  const dataset = apify.getDataset(finalRun.defaultDatasetId)
  const items = await dataset.listItems({
    limit: input.maxResults || 1000,
    offset: input.offset || 0
  })

  return items.map((post: any) => ({
    id: post.id,
    url: post.url,
    text: post.text,
    caption: post.text,
    postDate: post.time,
    timestamp: post.time,
    groupName: post.groupName,
    groupUrl: post.groupUrl,
    authorName: post.authorName,
    authorUrl: post.authorUrl,
    likesCount: post.likes,
    commentsCount: post.comments,
    sharesCount: post.shares,
    imageUrls: post.images,
    videoUrl: post.video,
    comments: post.comments?.map((c: any) => ({
      id: c.id,
      text: c.text,
      date: c.time,
      likesCount: c.likes,
      authorName: c.authorName,
      authorUrl: c.authorUrl
    }))
  }))
}

/**
 * Scrape Facebook comments from posts
 *
 * @param input - Comments scraping options
 * @param options - Actor run options
 * @returns Array of comments
 *
 * @example
 * ```typescript
 * const comments = await scrapeFacebookComments({
 *   postUrls: ['https://www.facebook.com/post/123'],
 *   maxCommentsPerPost: 200
 * })
 *
 * // Filter in code - only highly-liked comments
 * const topComments = comments
 *   .filter(c => c.likesCount > 50)
 *   .sort((a, b) => b.likesCount - a.likesCount)
 * ```
 */
export async function scrapeFacebookComments(
  input: FacebookCommentsInput,
  options?: ActorRunOptions
): Promise<FacebookComment[]> {
  const apify = new Apify()

  const run = await apify.callActor('apify/facebook-comments-scraper', {
    startUrls: input.postUrls.map(url => ({ url })),
    maxComments: input.maxCommentsPerPost || 100
  }, options)

  await apify.waitForRun(run.id)

  const finalRun = await apify.getRun(run.id)
  if (finalRun.status !== 'SUCCEEDED') {
    throw new Error(`Facebook comments scraping failed: ${finalRun.status}`)
  }

  const dataset = apify.getDataset(finalRun.defaultDatasetId)
  const items = await dataset.listItems({
    limit: input.maxResults || 1000,
    offset: input.offset || 0
  })

  return items.map((comment: any) => ({
    id: comment.id,
    text: comment.text,
    date: comment.time,
    likesCount: comment.likes,
    authorName: comment.authorName,
    authorUrl: comment.authorUrl
  }))
}
