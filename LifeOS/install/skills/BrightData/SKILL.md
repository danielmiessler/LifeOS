---
name: BrightData
version: 1.2.19
description: "4-tier progressive web scraping that auto-escalates WebFetch to curl to Interceptor to Bright Data proxy for bot detection and CAPTCHAs, with single-URL and multi-page crawl modes, output as markdown. USE WHEN Bright Data, scrape URL, web scraping, bot detection, crawl site, CAPTCHA, can't access, site blocking, extract page content, scrape whole site, spider domain, convert URL to markdown, getting blocked. NOT FOR simple public content (use WebFetch directly), social platform scraping with named actors (use Apify), or real-Chrome bot bypass with logged-in sessions and zero CDP fingerprint (use Interceptor)."
effort: medium
---

## Customization

**Before executing, check for user customizations at:**
`{{LIFEOS_DIR}}/USER/CUSTOMIZATIONS/SKILLS/BrightData/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.


## 🚨 MANDATORY: Voice Notification (REQUIRED BEFORE ANY ACTION)

**You MUST send this notification BEFORE doing anything else when this skill is invoked.**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:31337/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the WORKFLOWNAME workflow in the BrightData skill to ACTION"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running the **WorkflowName** workflow in the **BrightData** skill to ACTION...
   ```

**This is not optional. Execute this curl command immediately upon skill invocation.**

# BrightData

Scrapes a single URL (FourTierScrape) or crawls a whole site (Crawl), escalating through four tiers only as far as each page needs. Output is always markdown. Start at Tier 1 and step up only when blocked — reaching for the heavy proxy every time wastes Tier-4 credits. A Cloudflare `Accept: text/markdown` pre-check runs before Tier 1 (recipe in FourTierScrape.md).

## The four tiers (tool contract)

| Tier | Tool | Wins on | Cost / latency |
|------|------|---------|----------------|
| 1 | WebFetch | public content, no bot detection | free · ~2-5s |
| 2 | curl + Chrome headers | user-agent / basic header checks | free · ~3-7s |
| 3 | Interceptor (real Chrome) | JavaScript-rendered / SPA pages | free · ~10-20s |
| 4 | Bright Data MCP `mcp__Brightdata__scrape_as_markdown` | CAPTCHA, advanced fingerprinting, residential-IP needs | Bright Data credits · ~5-15s |

Playwright is banned across LifeOS — Tier 3 is Interceptor. Skip-ahead: explicit "use Bright Data" → Tier 4; "use browser" → Tier 3; a domain that already failed Tier 1 → start at Tier 2. The exact curl header block, Cloudflare pre-check, and Interceptor commands live in `Workflows/FourTierScrape.md`.

## Workflows

When routing, output: `Running the **WorkflowName** workflow in the **BrightData** skill to ACTION...`

| Workflow | Trigger | File |
|----------|---------|------|
| FourTierScrape | "scrape/fetch/pull/get/retrieve [URL]", "can't access this site", "site is blocking me", "use Bright Data to fetch" | `Workflows/FourTierScrape.md` |
| Crawl | "crawl this site", "spider this domain", "map this website", "get all pages from", "scrape the whole site", "crawl all pages under /docs" | `Workflows/Crawl.md` |

Crawl picks Light Crawl (MCP `scrape_batch` + link loop, ≤50 pages, ~$0.006/page) for a section, or Full Crawl (Bright Data Crawl API `api.brightdata.com/datasets/v3/trigger`, $1.50/1K pages) for whole sites.

## Gotchas

- **4-tier escalation: WebFetch → curl → Interceptor → Bright Data proxy.** Always start at Tier 1 and escalate only when blocked. Playwright is banned across LifeOS.
- **Bright Data proxy has usage costs.** Don't use Tier 4 for sites accessible via Tier 1-3.
- **CAPTCHA-solving introduces latency.** Allow extra time for Tier 4 responses.
- **Credentials in `{{LIFEOS_ROOT}}/.env`** — BRIGHTDATA_API_KEY.

## Execution Log

After completing any workflow, append a single JSONL entry:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"BrightData","workflow":"WORKFLOW_USED","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> "${LIFEOS_DIR}/MEMORY/SKILLS/execution.jsonl"
```

Replace `WORKFLOW_USED` with the workflow executed, `8_WORD_SUMMARY` with a brief input description, and `SECONDS` with approximate wall-clock time. Log `status: "error"` if the workflow failed.
