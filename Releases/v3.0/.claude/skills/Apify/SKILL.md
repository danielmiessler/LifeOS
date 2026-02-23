---
name: Apify
description: Social media scraping, business data, e-commerce via Apify actors. USE WHEN Twitter, Instagram, LinkedIn, TikTok, YouTube, Facebook, Google Maps, Amazon scraping.
context: fork
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/skills/PAI/USER/SKILLCUSTOMIZATIONS/Apify/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.


## 🚨 MANDATORY: Voice Notification (REQUIRED BEFORE ANY ACTION)

**You MUST send this notification BEFORE doing anything else when this skill is invoked.**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:8888/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the WORKFLOWNAME workflow in the Apify skill to ACTION"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running the **WorkflowName** workflow in the **Apify** skill to ACTION...
   ```

**This is not optional. Execute this curl command immediately upon skill invocation.**

# Apify - Social Media & Web Scraping

Direct TypeScript access to 9 popular Apify actors with 99% token savings.

## 🔌 File-Based MCP

This skill is a **file-based MCP** - a code-first API wrapper that replaces token-heavy MCP protocol calls.

**Why file-based?** Filter data in code BEFORE returning to model context = 97.5% token savings.

**Architecture:** See `~/.claude/skills/PAI/DOCUMENTATION/FileBasedMCPs.md`

## 🎯 Overview

Direct TypeScript access to the 9 most popular Apify actors without MCP overhead. Filter and transform data in code BEFORE it reaches the model context.

## 📊 Available Actors

### Social Media (5 platforms)
- **Instagram** (145k users, 4.60★) - Profiles, posts, hashtags, comments
- **LinkedIn** (26k users, 4.10★) - Profiles, jobs, posts
- **TikTok** (90k users, 4.61★) - Profiles, videos, hashtags, comments
- **YouTube** (40k users, 4.40★) - Channels, videos, comments, search
- **Facebook** (35k users, 4.56★) - Posts, groups, comments

### Business & Lead Generation
- **Google Maps** (198k users, 4.76★) - **HIGHEST VALUE!**
  - Search businesses, extract contacts, reviews, images
  - Perfect for lead generation

### E-commerce
- **Amazon** (8k users, 4.97★) - Products, reviews, pricing

### Web Scraping
- **Web Scraper** (94k users, 4.39★) - General-purpose, works with ANY website

## 🚀 Quick Start

### Basic Usage Pattern

```typescript
import { scrapeInstagramProfile, searchGoogleMaps } from '~/.claude/skills/Apify/actors'

// 1. Call the actor wrapper
const profile = await scrapeInstagramProfile({
  username: 'target_username',
  maxPosts: 50
})

// 2. Filter in code - BEFORE data reaches model!
const viral = profile.latestPosts?.filter(p => p.likesCount > 10000)

// 3. Only filtered results reach model context
console.log(viral) // ~10 posts instead of 50
```

## 📚 Examples by Use Case

### Social Media Monitoring

**Instagram - Track engagement:**
```typescript
import { scrapeInstagramProfile, scrapeInstagramPosts } from '~/.claude/skills/Apify/actors'

// Get profile with recent posts
const profile = await scrapeInstagramProfile({
  username: 'competitor',
  maxPosts: 100
})

// Filter in code - only high-performing posts from last 30 days
const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)
const topRecent = profile.latestPosts
  ?.filter(p =>
    new Date(p.timestamp).getTime() > thirtyDaysAgo &&
    p.likesCount > 5000
  )
  .sort((a, b) => b.likesCount - a.likesCount)
  .slice(0, 10)

// Only 10 posts reach model instead of 100!
```

**LinkedIn - Job search:**
```typescript
import { searchLinkedInJobs } from '~/.claude/skills/Apify/actors'

const jobs = await searchLinkedInJobs({
  keywords: 'AI engineer',
  location: 'San Francisco',
  remote: true,
  maxResults: 200
})

// Filter in code - only senior roles at well-funded startups
const topJobs = jobs.filter(j =>
  j.seniority?.includes('Senior') &&
  parseInt(j.applicants || '0') > 50
)
```

**TikTok - Trend analysis:**
```typescript
import { scrapeTikTokHashtag } from '~/.claude/skills/Apify/actors'

const videos = await scrapeTikTokHashtag({
  hashtag: 'ai',
  maxResults: 500
})

// Filter in code - only viral content
const viral = videos
  .filter(v => v.playCount > 1000000)
  .sort((a, b) => b.playCount - a.playCount)
  .slice(0, 20)
```

### Lead Generation (Business Intelligence)

**Google Maps - Local business leads:**
```typescript
import { searchGoogleMaps } from '~/.claude/skills/Apify/actors'

// Search with contact info extraction
const places = await searchGoogleMaps({
  query: 'restaurants in Austin',
  maxResults: 500,
  includeReviews: true,
  maxReviewsPerPlace: 20,
  scrapeContactInfo: true // Extracts emails from websites!
})

// Filter in code - only highly-rated with email/phone
const qualifiedLeads = places
  .filter(p =>
    p.rating >= 4.5 &&
    p.reviewsCount >= 100 &&
    (p.email || p.phone)
  )
  .map(p => ({
    name: p.name,
    rating: p.rating,
    reviews: p.reviewsCount,
    email: p.email,
    phone: p.phone,
    website: p.website,
    address: p.address
  }))

// Export leads - only qualified results!
console.log(`Found ${qualifiedLeads.length} qualified leads`)
```

**Google Maps - Review sentiment analysis:**
```typescript
import { scrapeGoogleMapsReviews } from '~/.claude/skills/Apify/actors'

const reviews = await scrapeGoogleMapsReviews({
  placeUrl: 'https://maps.google.com/maps?cid=12345',
  maxResults: 1000
})

// Filter in code - analyze sentiment by rating
const recentNegative = reviews
  .filter(r => {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)
    return (
      r.rating <= 2 &&
      new Date(r.publishedAtDate).getTime() > thirtyDaysAgo &&
      r.text.length > 50
    )
  })

// Identify common complaints
const complaints = recentNegative.map(r => r.text)
```

### E-commerce & Competitive Intelligence

**Amazon - Price monitoring:**
```typescript
import { scrapeAmazonProduct } from '~/.claude/skills/Apify/actors'

const product = await scrapeAmazonProduct({
  productUrl: 'https://www.amazon.com/dp/B08L5VT894',
  includeReviews: true,
  maxReviews: 200
})

// Filter in code - only recent negative reviews
const recentNegative = product.reviews
  ?.filter(r => {
    const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)
    return (
      r.rating <= 2 &&
      new Date(r.date).getTime() > weekAgo
    )
  })

console.log(`Price: $${product.price}`)
console.log(`Rating: ${product.rating}/5`)
console.log(`Recent issues: ${recentNegative?.length} complaints`)
```

### Custom Web Scraping

**Any Website - Custom extraction:**
```typescript
import { scrapeWebsite } from '~/.claude/skills/Apify/actors'

const products = await scrapeWebsite({
  startUrls: ['https://example.com/products'],
  linkSelector: 'a.product-link',
  maxPagesPerCrawl: 100,
  pageFunction: `
    async function pageFunction(context) {
      const { request, $, log } = context

      return {
        url: request.url,
        title: $('h1.product-title').text(),
        price: $('span.price').text(),
        inStock: $('.in-stock').length > 0,
        description: $('.description').text()
      }
    }
  `
})

// Filter in code - only available products under $100
const affordable = products.filter(p =>
  p.inStock &&
  parseFloat(p.price.replace('$', '')) < 100
)
```

## 🎨 Advanced Patterns

### Pattern 1: Multi-Platform Social Listening

```typescript
import {
  scrapeInstagramHashtag,
  scrapeTikTokHashtag,
  searchYouTube
} from '~/.claude/skills/Apify/actors'

// Run all platforms in parallel
const [instagramPosts, tiktokVideos, youtubeVideos] = await Promise.all([
  scrapeInstagramHashtag({ hashtag: 'ai', maxResults: 100 }),
  scrapeTikTokHashtag({ hashtag: 'ai', maxResults: 100 }),
  searchYouTube({ query: '#ai', maxResults: 100 })
])

// Combine and filter - only viral content across all platforms
const allViral = [
  ...instagramPosts.filter(p => p.likesCount > 10000),
  ...tiktokVideos.filter(v => v.playCount > 100000),
  ...youtubeVideos.filter(v => v.viewsCount > 50000)
]

console.log(`Found ${allViral.length} viral posts across 3 platforms`)
```

### Pattern 2: Lead Enrichment Pipeline

```typescript
import { searchGoogleMaps, scrapeLinkedInProfile } from '~/.claude/skills/Apify/actors'

// 1. Find businesses on Google Maps
const restaurants = await searchGoogleMaps({
  query: 'restaurants in SF',
  maxResults: 100,
  scrapeContactInfo: true
})

// 2. Filter for qualified leads
const qualified = restaurants.filter(r =>
  r.rating >= 4.5 &&
  r.email &&
  r.reviewsCount >= 50
)

// 3. Enrich with LinkedIn data (if available)
const enriched = await Promise.all(
  qualified.map(async (restaurant) => {
    // Try to find LinkedIn company page
    // ... additional enrichment logic
    return restaurant
  })
)
```

### Pattern 3: Competitive Analysis Dashboard

```typescript
import {
  scrapeInstagramProfile,
  scrapeYouTubeChannel,
  scrapeTikTokProfile
} from '~/.claude/skills/Apify/actors'

async function analyzeCompetitor(username: string) {
  // Gather data from all platforms
  const [instagram, youtube, tiktok] = await Promise.all([
    scrapeInstagramProfile({ username, maxPosts: 30 }),
    scrapeYouTubeChannel({ channelUrl: `https://youtube.com/@${username}`, maxVideos: 30 }),
    scrapeTikTokProfile({ username, maxVideos: 30 })
  ])

  // Calculate engagement metrics in code
  return {
    username,
    instagram: {
      followers: instagram.followersCount,
      avgLikes: average(instagram.latestPosts?.map(p => p.likesCount) || []),
      engagementRate: calculateEngagement(instagram)
    },
    youtube: {
      subscribers: youtube.subscribersCount,
      avgViews: average(youtube.videos?.map(v => v.viewsCount) || [])
    },
    tiktok: {
      followers: tiktok.followersCount,
      avgPlays: average(tiktok.videos?.map(v => v.playCount) || [])
    }
  }
}
```

## 💰 Token Savings Calculator

**Example: Instagram profile with 100 posts**

**MCP Approach:**
```
1. search-actors → 1,000 tokens
2. call-actor → 1,000 tokens
3. get-actor-output → 50,000 tokens (100 unfiltered posts)
TOTAL: ~52,000 tokens
```

**File-Based Approach:**
```typescript
const profile = await scrapeInstagramProfile({
  username: 'user',
  maxPosts: 100
})

// Filter in code - only top 10 posts
const top = profile.latestPosts
  ?.sort((a, b) => b.likesCount - a.likesCount)
  .slice(0, 10)

// TOTAL: ~500 tokens (only 10 filtered posts reach model)
```

**Savings: 99% reduction (52,000 → 500 tokens)**

## 🔧 Actor Reference

### Social Media

#### Instagram
- `scrapeInstagramProfile(input)` - Profile + posts
- `scrapeInstagramPosts(input)` - Posts from user
- `scrapeInstagramHashtag(input)` - Posts by hashtag
- `scrapeInstagramComments(input)` - Comments on post

#### LinkedIn
- `scrapeLinkedInProfile(input)` - Profile + experience + email
- `searchLinkedInJobs(input)` - Job listings
- `scrapeLinkedInPosts(input)` - Posts from profile/company

#### TikTok
- `scrapeTikTokProfile(input)` - Profile + videos
- `scrapeTikTokHashtag(input)` - Videos by hashtag
- `scrapeTikTokComments(input)` - Comments on video

#### YouTube
- `scrapeYouTubeChannel(input)` - Channel + videos
- `searchYouTube(input)` - Search videos
- `scrapeYouTubeComments(input)` - Comments on video

#### Facebook
- `scrapeFacebookPosts(input)` - Posts from pages
- `scrapeFacebookGroups(input)` - Group posts
- `scrapeFacebookComments(input)` - Post comments

### Business & Lead Generation

#### Google Maps
- `searchGoogleMaps(input)` - Search places (with contact extraction!)
- `scrapeGoogleMapsPlace(input)` - Single place details
- `scrapeGoogleMapsReviews(input)` - Place reviews

### E-commerce

#### Amazon
- `scrapeAmazonProduct(input)` - Product details + reviews
- `scrapeAmazonReviews(input)` - Product reviews only

### Web Scraping

#### General Web
- `scrapeWebsite(input)` - Custom multi-page crawling
- `scrapePage(url, pageFunction)` - Single page extraction

## ⚙️ Configuration

**Environment Variables:**
```bash
# Required - Get from https://console.apify.com/account/integrations
APIFY_TOKEN=apify_api_xxxxx...
```

**Actor Run Options:**
```typescript
{
  memory: 2048,    // MB: 128, 256, 512, 1024, 2048, 4096, 8192
  timeout: 300,    // seconds
  build: 'latest'  // or specific build number
}
```

## 🎯 When to Use This vs MCP

**Use File-Based (this skill):**
- ✅ Need to filter large datasets (>100 results)
- ✅ Want to transform/aggregate data in code
- ✅ Multiple sequential operations
- ✅ Control flow (loops, conditionals)
- ✅ Maximum token efficiency

**Use MCP:**
- ❌ Simple single operations with small results (<10 items)
- ❌ One-off exploratory queries
- ❌ Don't want to write code

## 🔗 Links

- Apify Platform: https://apify.com
- Actor Store: https://apify.com/store
- API Docs: https://docs.apify.com/api/v2

---

**Remember: Filter data in code BEFORE returning to model context. This is where the 99% token savings happen!**
