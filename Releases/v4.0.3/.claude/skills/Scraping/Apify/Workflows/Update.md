# Update Workflow

Check Apify API and actor ecosystem for updates.

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the Update workflow in the Apify skill to check updates"}' \
  > /dev/null 2>&1 &
```

Running **Update** in **Apify**...

---

## When to Use

- Monthly capability check
- After Apify announces new features
- If actor calls fail unexpectedly
- When new popular actors become available

## Official Source

**API Docs:** https://docs.apify.com/api/v2
**Changelog:** https://docs.apify.com/api/v2/changelog
**Actor Store:** https://apify.com/store

## Steps

### 1. Check API Changelog

```bash
open https://docs.apify.com/api/v2/changelog
```

Review for:
- New endpoints
- Breaking changes
- Deprecated features
- Rate limit changes

### 2. Check Popular Actors

Review commonly used actors for updates:

| Actor | Purpose | Check For |
|-------|---------|-----------|
| apify/instagram-scraper | Instagram posts/profiles | Schema changes |
| apify/twitter-scraper | Twitter/X data | API changes |
| apify/google-maps-scraper | Business data | New fields |
| apify/web-scraper | General scraping | New options |

### 3. Test Current Implementation

```bash
# Verify API wrapper works
bun run ../scrape-instagram.ts --help 2>/dev/null || echo "Check script"
```

### 4. Update Implementation

If new critical functionality found:
1. Update `index.ts` API wrapper
2. Add new actor scripts to skill
3. Update type definitions
4. Update SKILL.md documentation

### 5. Update Actor Registry

Maintain list of tested actors:

| Actor | Last Tested | Status |
|-------|-------------|--------|
| instagram-scraper | 2026-01 | Working |
| twitter-scraper | 2026-01 | Working |
| google-maps | 2026-01 | Working |

## Version Tracking

```
# Last sync: 2026-01-03
# Apify API: v2
# Tested actors: 10+
# Known issues: None
```
