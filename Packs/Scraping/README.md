---
name: Scraping
pack-id: danielmiessler-scraping-v1.0.0
version: 1.0.0
author: danielmiessler
description: Web scraping via progressive escalation (Bright Data proxy) and social media platform actors (Apify) — from simple URL fetch to CAPTCHA-solving proxy networks
type: skill
purpose-type: [scraping, data-extraction, web-crawling, social-media]
platform: claude-code
dependencies: []
keywords: [scraping, bright-data, apify, proxy, crawl, bot-detection, CAPTCHA, twitter, instagram, linkedin, tiktok, youtube, facebook, google-maps, amazon, web-scraper, four-tier]
---

# Scraping

> Web scraping that actually works -- progressive escalation from simple fetch to CAPTCHA-solving proxy networks, plus direct TypeScript access to social media and business data platforms.

---

## The Problem

Web scraping is the most fragile part of any data pipeline. Sites actively resist automated access, and each one uses different countermeasures. The typical experience:

- **First attempt fails** -- you try to fetch a URL and get a 403, a CAPTCHA, or an empty page
- **Manual escalation** -- you switch to curl with custom headers, then to a headless browser, then wonder if you need a proxy
- **Social media is locked down** -- every platform has its own API, rate limits, and authentication requirements
- **Token waste** -- MCP-based scraping dumps massive unfiltered datasets into your model context
- **No unified interface** -- you need different tools for every site and every platform

The fundamental issue: scraping should automatically try the simplest approach first and escalate only when needed, with social media platforms accessible through a single consistent interface.

---

## The Solution

The Scraping skill provides two complementary subsystems that cover the full spectrum of web data extraction.

**BrightData subsystem (URL scraping with progressive escalation):**
1. **Tier 1: WebFetch** -- Built-in Claude Code tool, fast and simple
2. **Tier 2: Chrome-Header Curl** -- Custom browser headers to bypass basic bot detection
3. **Tier 3: Playwright Browser** -- Full browser automation for JavaScript-heavy sites
4. **Tier 4: Bright Data MCP** -- Professional proxy network with CAPTCHA solving and residential IPs
5. **Multi-Page Crawling** -- Light crawl (up to 50 pages) or full Bright Data Crawl API for entire sites

**Apify subsystem (social media and platform scraping):**
6. **5 Social Platforms** -- Instagram, LinkedIn, TikTok, YouTube, Facebook with full API coverage
7. **Business Data** -- Google Maps search, place details, and review extraction with contact info
8. **E-commerce** -- Amazon product details, pricing, and reviews
9. **General Web Scraper** -- Custom multi-page crawling with page functions
10. **99% Token Savings** -- File-based MCP architecture filters data in code before reaching model context

The BrightData subsystem auto-escalates: it starts with the fastest, cheapest method and only moves to expensive proxy scraping when simpler approaches fail. The Apify subsystem provides direct TypeScript wrappers around 9 popular Apify actors, with data filtering in code that saves 97-99% on tokens compared to raw MCP calls.

---

## Installation

This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using `INSTALL.md`.

**What is PAI?** See the [PAI Project Overview](https://github.com/danielmiessler/Personal_AI_Infrastructure#what-is-pai).

---

## What's Included

| Component | Path | Purpose |
|-----------|------|---------|
| Skill router | `src/SKILL.md` | Top-level routing between BrightData and Apify subsystems |
| BrightData skill | `src/BrightData/SKILL.md` | Progressive URL scraping skill definition and activation triggers |
| Four-tier scrape | `src/BrightData/Workflows/FourTierScrape.md` | Single-URL scraping with 4-tier escalation |
| Crawl workflow | `src/BrightData/Workflows/Crawl.md` | Multi-page crawling with link discovery |
| Apify skill | `src/Apify/SKILL.md` | Social media and platform scraping skill definition |
| Apify integration | `src/Apify/INTEGRATION.md` | Integration guide and architecture notes |
| Apify README | `src/Apify/README.md` | Detailed documentation and examples |
| Actor wrappers | `src/Apify/actors/` | TypeScript wrappers for 9 Apify actors (social-media/, business/, ecommerce/, web/) |
| Apify types | `src/Apify/types/` | TypeScript type definitions |
| Apify skills | `src/Apify/skills/` | Pre-built skill scripts (e.g., get-user-tweets.ts) |
| Apify examples | `src/Apify/examples/` | Usage examples: smoke test, comparison test, Instagram scraper |
| Update workflow | `src/Apify/Workflows/Update.md` | Auto-update workflow for Apify actor catalog |
| Entry point | `src/Apify/index.ts` | Main TypeScript entry point |
| Package config | `src/Apify/package.json` | Node/bun dependencies |
| TS config | `src/Apify/tsconfig.json` | TypeScript configuration |

**Summary:**
- **Subdirectories:** 2 subsystems (BrightData, Apify)
- **BrightData workflows:** 2 (FourTierScrape, Crawl)
- **Apify actor wrappers:** 9 platforms (Instagram, LinkedIn, TikTok, YouTube, Facebook, Google Maps, Amazon, Web Scraper)
- **Dependencies:** bun (for Apify TypeScript tools), Apify API token (for social media scraping), Bright Data MCP (for Tier 4 proxy scraping)

---

## What Makes This Different

This sounds similar to using a scraping API or headless browser directly, which also extracts web content. What makes this approach different?

The Scraping skill combines two distinct approaches that cover different scraping needs. For URL-based scraping, it uses progressive escalation -- starting free and fast, only paying for expensive proxy scraping when cheaper methods fail. Most URLs succeed at Tier 1 or 2, so you rarely need Tier 4. For social media scraping, it uses a file-based MCP architecture that filters data in TypeScript before it reaches the model context, achieving 97-99% token savings compared to raw MCP calls. A single Instagram profile scrape via MCP costs ~52,000 tokens; the same operation through the Apify subsystem costs ~500 tokens because only filtered results reach the model.

- Progressive 4-tier escalation minimizes cost and latency
- Auto-detection: tell it to "scrape this URL" and it figures out the approach
- Apify subsystem covers 9 platforms with consistent TypeScript API
- File-based filtering saves 97-99% tokens on social media data
- Multi-page crawling with link discovery and site mapping
- Handles CAPTCHA, JavaScript rendering, and advanced bot detection

---

## Invocation Scenarios

| Trigger | What Happens |
|---------|--------------|
| "scrape https://example.com" | BrightData: 4-tier progressive scrape starting at WebFetch |
| "can't access this site" / "site is blocking me" | BrightData: starts at higher tier, escalates to proxy |
| "use Bright Data to fetch [URL]" | BrightData: jumps directly to Tier 4 proxy |
| "crawl all pages under /docs" | BrightData: multi-page crawl with link discovery |
| "scrape this person's Instagram" | Apify: Instagram profile + posts via TypeScript wrapper |
| "get tweets from @username" | Apify: Twitter/X scraper via pre-built skill |
| "find restaurants in Austin on Google Maps" | Apify: Google Maps search with contact extraction |
| "scrape Amazon reviews for this product" | Apify: Amazon product reviews extraction |
| "scrape LinkedIn jobs for AI engineer" | Apify: LinkedIn job search with filtering |
| "crawl this entire website" | BrightData: Bright Data Crawl API for full-site extraction |

---

## Example Usage

### Simple URL Scrape

```
User: "scrape https://blog.example.com/article"

AI:
1. Routes to BrightData > FourTierScrape
2. Tier 1 (WebFetch): Attempts fast fetch
3. Success -- returns content in markdown
4. Total time: <5 seconds, zero cost
```

### Protected Site with Bot Detection

```
User: "this site keeps blocking me: https://protected-site.com"

AI:
1. Routes to BrightData > FourTierScrape
2. Tier 1 (WebFetch): Fails (403)
3. Tier 2 (Chrome-header curl): Fails (bot detection)
4. Tier 3 (Playwright browser): Fails (CAPTCHA)
5. Tier 4 (Bright Data proxy): Success
6. Returns content in markdown
7. Total time: ~30-40 seconds
```

### Social Media Intelligence

```
User: "analyze competitor's Instagram engagement"

AI:
1. Routes to Apify > Instagram scraper
2. Fetches profile + last 100 posts via TypeScript wrapper
3. Filters in code: only posts from last 30 days with >5000 likes
4. Returns top 10 performing posts to model context
5. Token cost: ~500 (vs ~52,000 via raw MCP)
```

### Lead Generation

```
User: "find highly-rated restaurants in Austin with contact info"

AI:
1. Routes to Apify > Google Maps search
2. Searches with contact info extraction enabled
3. Filters in code: rating >= 4.5, reviews >= 100, has email or phone
4. Returns qualified leads with name, rating, email, phone, address
```

---

## Configuration

### BrightData Subsystem

No configuration required for Tiers 1-3 (WebFetch, curl, Playwright are built-in).

**Tier 4 requires:** Bright Data MCP configured in Claude Code. The MCP provides `scrape_as_markdown` and `scrape_batch` tools.

**Crawl API requires:** Bright Data API credentials for `api.brightdata.com/datasets/v3/trigger`.

### Apify Subsystem

**Required:**
- **bun** runtime for executing TypeScript actor wrappers
- **Apify API token** -- get from https://console.apify.com/account/integrations
- Set as `APIFY_TOKEN=apify_api_xxxxx...` in your environment or PAI .env

**Actor run options (configurable per call):**
- Memory: 128-8192 MB
- Timeout: configurable in seconds
- Build: `latest` or specific build number

---

## Customization

### Recommended Customization

No customization needed -- the skill works as-is with auto-escalation.

### Optional Customization

| Customization | Location | Impact |
|--------------|----------|--------|
| BrightData preferences | `SKILLCUSTOMIZATIONS/BrightData/PREFERENCES.md` | Default tier behavior, proxy preferences |
| Apify preferences | `SKILLCUSTOMIZATIONS/Apify/PREFERENCES.md` | Default actor settings, memory allocation |
| Skip tiers | Directly request "use Bright Data" | Jumps to Tier 4 for known-difficult sites |
| Custom page functions | Apify Web Scraper `pageFunction` parameter | Custom extraction logic for specific sites |

---

## Credits

- **Original concept:** Daniel Miessler -- developed as part of the [PAI](https://github.com/danielmiessler/Personal_AI_Infrastructure) system
- **Inspired by:** The frustration of scraping failures and the cost of unfiltered MCP data in model context

---

## Related Work

- **PAI Research Skill** -- Research routes to Scraping for content retrieval and web scraping workflows
- **Bright Data** -- The professional proxy and scraping infrastructure behind Tier 4
- **Apify** -- The actor platform providing social media and web scraping capabilities

---

## Works Well With

- **Research Pack** -- Research uses Scraping for content retrieval when standard methods fail
- **PAI OSINT Skill** -- OSINT investigations leverage Scraping for social media and business intelligence
- **Media Pack** -- Scraping can extract content that Media then visualizes

---

## Changelog

### 1.0.0 - 2026-03-15
- Initial release
- BrightData subsystem with 4-tier progressive URL scraping
- BrightData multi-page crawling (light and full)
- Apify subsystem with 9 platform actor wrappers
- File-based MCP architecture for 97-99% token savings
- Social media coverage: Instagram, LinkedIn, TikTok, YouTube, Facebook
- Business data: Google Maps with contact extraction
- E-commerce: Amazon products and reviews
- General-purpose web scraper with custom page functions
