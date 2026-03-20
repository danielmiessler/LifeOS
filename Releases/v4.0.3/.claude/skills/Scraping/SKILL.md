---
name: scraping
description: "Web scraping via progressive escalation (Bright Data proxy) and social media platform actors (Apify). USE WHEN scraping, Bright Data, proxy, crawl, scrape URL, Twitter scraping, Instagram scraping, LinkedIn scraping, TikTok scraping, YouTube scraping, Facebook scraping, Google Maps, Amazon scraping, Apify, bot detection, CAPTCHA, spider, four tier scrape, site blocking."
---

# Scraping

Route to the appropriate web scraping sub-skill based on target.

## Workflow Routing

| Request Pattern | Route To | Use Case |
|---|---|---|
| Bright Data, scrape URL, proxy, crawl, progressive scraping, Chrome headers | `BrightData/SKILL.md` | General web scraping with 4-tier escalation (direct → headers → proxy → browser) for bot detection bypass |
| Twitter, Instagram, LinkedIn, TikTok, YouTube, Facebook, Google Maps, Amazon, Apify | `Apify/SKILL.md` | Platform-specific actors with pre-built scrapers for social media and marketplaces |

## Examples

```
"Scrape this URL" → BrightData (progressive escalation)
"Get tweets from @user" → Apify (Twitter actor)
"Extract Google Maps reviews" → Apify (Google Maps actor)
"Crawl this site, it blocks bots" → BrightData (proxy + browser tier)
```
