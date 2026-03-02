#!/usr/bin/env bun
/**
 * YouTubeApi.ts - YouTube Data API v3 client
 *
 * Usage:
 *   bun ~/.claude/skills/YouTube/Tools/YouTubeApi.ts <command> [options]
 *
 * Commands:
 *   channel              Get channel statistics
 *   videos [count]       Get recent videos with stats (default: 10)
 *   video <id|title>     Get stats for specific video
 *   search <query>       Search channel videos
 *
 * Environment:
 *   YOUTUBE_API_KEY      API key (required)
 *   YOUTUBE_CHANNEL_ID   Channel ID (default: UCnCikd0s4i9KoDtaHPlK-JA)
 *
 * @author PAI System
 * @version 1.0.0
 */

import { readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  dim: '\x1b[2m'
}

// Load environment
function loadEnv(): Record<string, string> {
  const envPath = process.env.PAI_CONFIG_DIR ? join(process.env.PAI_CONFIG_DIR, '.env') : join(homedir(), '.config', 'PAI', '.env')
  const env: Record<string, string> = {}
  try {
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
      const match = line.match(/^([^#=]+)=(.*)$/)
      if (match) {
        env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '')
      }
    }
  } catch {
    // Ignore if file doesn't exist
  }
  return env
}

const env = loadEnv()
const API_KEY = process.env.YOUTUBE_API_KEY || env.YOUTUBE_API_KEY
const CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID || env.YOUTUBE_CHANNEL_ID || 'UCnCikd0s4i9KoDtaHPlK-JA'
const BASE_URL = 'https://www.googleapis.com/youtube/v3'

if (!API_KEY) {
  console.error(`${colors.red}Error: YOUTUBE_API_KEY not set${colors.reset}`)
  process.exit(1)
}

// API helpers
async function apiGet<T>(endpoint: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE_URL}${endpoint}`)
  url.searchParams.set('key', API_KEY)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString())
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || `API error: ${res.status}`)
  }
  return res.json()
}

// Format numbers with commas
function formatNum(n: string | number): string {
  return Number(n).toLocaleString()
}

// Commands
async function getChannel(): Promise<void> {
  interface ChannelResponse {
    items: Array<{
      snippet: { title: string; description: string; customUrl: string }
      statistics: { subscriberCount: string; viewCount: string; videoCount: string }
    }>
  }

  const data = await apiGet<ChannelResponse>('/channels', {
    part: 'snippet,statistics',
    id: CHANNEL_ID
  })

  const ch = data.items[0]
  console.log(`\n${colors.bold}${colors.cyan}Channel: ${ch.snippet.title}${colors.reset}`)
  console.log(`${colors.dim}${ch.snippet.customUrl}${colors.reset}\n`)
  console.log(`${colors.green}Subscribers:${colors.reset} ${formatNum(ch.statistics.subscriberCount)}`)
  console.log(`${colors.green}Total Views:${colors.reset} ${formatNum(ch.statistics.viewCount)}`)
  console.log(`${colors.green}Videos:${colors.reset}      ${formatNum(ch.statistics.videoCount)}`)
}

async function getRecentVideos(count: number = 10): Promise<void> {
  interface SearchResponse {
    items: Array<{
      id: { videoId: string }
      snippet: { title: string; publishedAt: string }
    }>
  }

  interface VideosResponse {
    items: Array<{
      id: string
      statistics: { viewCount: string; likeCount: string; commentCount: string }
    }>
  }

  // Get recent videos
  const search = await apiGet<SearchResponse>('/search', {
    part: 'snippet',
    channelId: CHANNEL_ID,
    order: 'date',
    maxResults: count.toString(),
    type: 'video'
  })

  const videoIds = search.items.map(v => v.id.videoId).join(',')

  // Get stats
  const stats = await apiGet<VideosResponse>('/videos', {
    part: 'statistics',
    id: videoIds
  })

  const statsMap = new Map(stats.items.map(v => [v.id, v.statistics]))

  console.log(`\n${colors.bold}${colors.cyan}Recent Videos${colors.reset}\n`)
  console.log(`${colors.dim}${'Title'.padEnd(50)} ${'Views'.padStart(10)} ${'Likes'.padStart(8)}${colors.reset}`)
  console.log('-'.repeat(70))

  for (const video of search.items) {
    const s = statsMap.get(video.id.videoId)
    const title = video.snippet.title.slice(0, 48).padEnd(50)
    const views = formatNum(s?.viewCount || 0).padStart(10)
    const likes = formatNum(s?.likeCount || 0).padStart(8)
    console.log(`${title} ${colors.green}${views}${colors.reset} ${colors.yellow}${likes}${colors.reset}`)
  }
}

async function getVideoStats(query: string): Promise<void> {
  interface SearchResponse {
    items: Array<{ id: { videoId: string } }>
  }

  interface VideoResponse {
    items: Array<{
      id: string
      snippet: { title: string; publishedAt: string; description: string }
      statistics: { viewCount: string; likeCount: string; commentCount: string }
      contentDetails: { duration: string }
    }>
  }

  let videoId = query

  // If not a video ID, search for it
  if (!query.match(/^[a-zA-Z0-9_-]{11}$/)) {
    const search = await apiGet<SearchResponse>('/search', {
      part: 'snippet',
      channelId: CHANNEL_ID,
      q: query,
      type: 'video',
      maxResults: '1'
    })
    if (!search.items.length) {
      console.error(`${colors.red}No video found matching: ${query}${colors.reset}`)
      process.exit(1)
    }
    videoId = search.items[0].id.videoId
  }

  const data = await apiGet<VideoResponse>('/videos', {
    part: 'snippet,statistics,contentDetails',
    id: videoId
  })

  if (!data.items.length) {
    console.error(`${colors.red}Video not found: ${videoId}${colors.reset}`)
    process.exit(1)
  }

  const v = data.items[0]
  console.log(`\n${colors.bold}${colors.cyan}${v.snippet.title}${colors.reset}`)
  console.log(`${colors.dim}https://youtube.com/watch?v=${v.id}${colors.reset}\n`)
  console.log(`${colors.green}Views:${colors.reset}    ${formatNum(v.statistics.viewCount)}`)
  console.log(`${colors.green}Likes:${colors.reset}    ${formatNum(v.statistics.likeCount)}`)
  console.log(`${colors.green}Comments:${colors.reset} ${formatNum(v.statistics.commentCount)}`)
  console.log(`${colors.green}Published:${colors.reset} ${new Date(v.snippet.publishedAt).toLocaleDateString()}`)
}

async function searchVideos(query: string): Promise<void> {
  interface SearchResponse {
    items: Array<{
      id: { videoId: string }
      snippet: { title: string; publishedAt: string }
    }>
  }

  const data = await apiGet<SearchResponse>('/search', {
    part: 'snippet',
    channelId: CHANNEL_ID,
    q: query,
    type: 'video',
    maxResults: '10'
  })

  console.log(`\n${colors.bold}${colors.cyan}Search: "${query}"${colors.reset}\n`)

  for (const v of data.items) {
    console.log(`${colors.green}${v.snippet.title}${colors.reset}`)
    console.log(`  ${colors.dim}https://youtube.com/watch?v=${v.id.videoId}${colors.reset}`)
  }
}

function showHelp(): void {
  console.log(`
${colors.bold}YouTubeApi${colors.reset} - YouTube Data API v3 client

${colors.cyan}Usage:${colors.reset}
  bun YouTubeApi.ts <command> [options]

${colors.cyan}Commands:${colors.reset}
  channel              Get channel statistics
  videos [count]       Get recent videos with stats (default: 10)
  video <id|title>     Get stats for specific video
  search <query>       Search channel videos

${colors.cyan}Examples:${colors.reset}
  bun YouTubeApi.ts channel
  bun YouTubeApi.ts videos 5
  bun YouTubeApi.ts video "ThreatLocker"
  bun YouTubeApi.ts search "AI agents"
`)
}

// Main
const [cmd, ...args] = process.argv.slice(2)

switch (cmd) {
  case 'channel':
    await getChannel()
    break
  case 'videos':
    await getRecentVideos(parseInt(args[0]) || 10)
    break
  case 'video':
    if (!args[0]) {
      console.error(`${colors.red}Error: video ID or title required${colors.reset}`)
      process.exit(1)
    }
    await getVideoStats(args.join(' '))
    break
  case 'search':
    if (!args[0]) {
      console.error(`${colors.red}Error: search query required${colors.reset}`)
      process.exit(1)
    }
    await searchVideos(args.join(' '))
    break
  case '--help':
  case '-h':
  case undefined:
    showHelp()
    break
  default:
    console.error(`${colors.red}Unknown command: ${cmd}${colors.reset}`)
    showHelp()
    process.exit(1)
}
