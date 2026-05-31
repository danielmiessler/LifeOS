---
name: pai-apify
description: "Social media scraping via Apify actors. Supports Instagram, LinkedIn, TikTok, and YouTube data extraction through Apify's pre-built actor marketplace with structured data output."
version: 5.0.0
author: PAI v5.0 → Hermes Port
use_when: "You need to extract data from social media platforms — Instagram profiles/posts, LinkedIn profiles/jobs, TikTok videos/users, or YouTube channels/videos — using Apify's scalable actor infrastructure."
not_for: "Scraping without Apify credits; bypassing platform authentication or rate limits; collecting private/protected account data."
tags: [apify, scraping, social-media, instagram, linkedin, tiktok, youtube]
---

# pai-apify: Social Media Scraping via Apify Actors

## Workflow Routing

| Trigger | Route |
|---------|-------|
| User wants Instagram profile data | Select actor → configure profile input → run → parse results |
| User wants LinkedIn company data | Select actor → configure URL → run → extract people/jobs |
| User wants TikTok video data | Select actor → configure hashtag/user → run → structured output |
| User wants YouTube channel analytics | Select actor → configure channel URL → run → extract videos/stats |
| User wants custom Apify actor | Search actors → match to use case → configure → run |
| User wants scheduled scraping | Set up actor → configure schedule → output to dataset |

## Step-by-Step Procedures

### 1. Instagram Profile & Post Scraping
```
1. Actor: apify/instagram-scraper (or equivalent)
2. Input configuration:
   - profiles: ["@username"] or profile URLs
   - hashtags: ["#topic"] (optional)
   - postsLimit: N (number of posts)
   - commentsLimit: N (per post)
   - proxy: { useApifyProxy: true }
3. Run actor:
   - terminal() call with Apify API or delegate_task to Apify MCP
   - Or use web_extract on Apify actor page to configure
4. Parse results:
   - Profile: username, followers, following, posts count, bio
   - Posts: caption, likes, comments, date, media URLs, hashtags
   - Stories: available stories, views, replies
5. Return structured data
```

### 2. LinkedIn Data Extraction
```
1. Actor: apify/linkedin-profile-scraper (profiles)
   or: apify/linkedin-jobs-scraper (jobs)
   or: apify/linkedin-company-scraper (companies)
2. Profile input:
   - urls: ["https://linkedin.com/in/username"]
   - scrapeCompanyInfo: true
   - scrapeExperience: true
   - scrapeEducation: true
3. Jobs input:
   - searchQuery: "software engineer"
   - location: "San Francisco"
   - maxResults: 50
4. Company input:
   - urls: ["https://linkedin.com/company/name"]
   - scrapePeople: true (if available)
5. Run actor → parse results
6. Return structured profile/job/company data
```

### 3. TikTok Video & User Scraping
```
1. Actor: apify/tiktok-scraper (or vacuum/tiktok-*)
2. Input configuration:
   - searchType: "hashtag" | "user" | "video" | "trending"
   - searchQuery: "#viral" or "@creator" or video URL
   - maxPosts: 50
   - scrapeComments: true
3. Run actor
4. Parse results:
   - Video: description, plays, likes, shares, comments count, author
   - User: followers, following, likes, bio, verified status
   - Audio: original sound name, author
5. Return structured data
```

### 4. YouTube Channel & Video Analytics
```
1. Actor: apify/youtube-scraper (or similar)
2. Input configuration:
   - channelUrls: ["https://youtube.com/@channel"]
   - videoUrls: ["https://youtube.com/watch?v=..."] (alternative)
   - maxVideos: 50
   - scrapeComments: true
   - sortBy: "newest" | "popular" | "oldest"
3. Run actor
4. Parse results:
   - Channel: subscribers, total views, videos count, description
   - Video: title, views, likes, comments, duration, published date
   - Comments: text, author, likes, replies
5. Return structured data
```

### 5. Custom Actor Discovery & Execution
```
1. User describes scraping need
2. Search Apify actor store:
   a. web_extract("https://apify.com/store?q=<query>")
   b. List top matching actors with descriptions, pricing, rating
3. User selects actor
4. Determine input schema:
   a. Read actor's README/documentation
   b. Identify required and optional input fields
5. Configure input from user's target
6. Run actor
7. Return processed results
```

### 6. Result Management
```
1. After actor run completes:
   a. Download dataset as JSON/CSV
   b. Parse and structure results
   c. Handle pagination if dataset is large
2. For large datasets:
   a. Read results in chunks
   b. Summarize total counts and key stats
   c. Provide sample rows
3. Offer export formats:
   - JSON (structured)
   - Markdown table
   - CSV
```

## Key Apify Actors Reference

| Platform | Recommended Actor | Use Case |
|----------|------------------|----------|
| Instagram | apify/instagram-scraper | Profiles, posts, stories, comments |
| LinkedIn | apify/linkedin-profile-scraper | Profiles, experience, education |
| LinkedIn | apify/linkedin-jobs-scraper | Job search, company jobs |
| LinkedIn | apify/linkedin-company-scraper | Company info, employees |
| TikTok | apify/tiktok-scraper | Videos, users, hashtags, comments |
| YouTube | apify/youtube-scraper | Channels, videos, comments, analytics |

## Gotchas

- Apify actors require API token and credits (set APIFY_TOKEN)
- Rate limits vary by actor and plan level
- LinkedIn scraping requires logged-in session in some actors
- Instagram may block scraping of private accounts
- TikTok API changes frequently; actors may need updates
- YouTube data is rate-limited by API quotas
- Results may include duplicates; always deduplicate client-side
- Some actors return nested JSON; flatten before presenting
- Proxy usage (Apify Proxy) is recommended to avoid IP blocks
- Respect platform rate limits and terms of service
- Large scrapes can consume significant credits; estimate before running

## Execution Log Pattern

```
[PAI-APIFY] Platform: Instagram | Target: @example_user
[ACTOR] apify/instagram-scraper (v2.4.1)
[INPUT] profile: @example_user, posts: 30, comments: 5
[RUN] Actor started — ID: abc123
[WAIT] Run completed in 12.4s (30 posts, 142 comments)
[PARSE] Profile: 12.4K followers, 342 posts, bio: "Photographer"
[OUTPUT] 30 posts, 142 comments, 5 story highlights
[EXPORT] JSON structured data ready
[COMPLETE] Instagram scrape completed
```
