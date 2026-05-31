---
name: pai-brightdata
description: "Progressive web scraping with 4 escalation tiers: WebFetch -> curl -> agent-browser -> Bright Data MCP. Automatically escalates when simpler methods fail. USE WHEN you need to scrape web content that may be behind JavaScript rendering, anti-bot protections, or complex client-side logic. NOT FOR static HTML pages that curl can handle, or sites requiring authenticated sessions."
version: 5.0.0
author: PAI v5.0 → Hermes Port
license: MIT
metadata:
  hermes:
    tags: [pai, scraping, web, brightdata]
    related_skills: []
tags: [scraping, web, brightdata, proxy, browser, progressive]
---

<!-- Voice notification — fire-and-forget on invocation -->
```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the pai-brightdata skill"}' \
  > /dev/null 2>&1 &
```


# pai-brightdata: Progressive Web Scraping

## Scraping Tiers

### Tier 1: WebFetch (Static HTML)
```
Method: web_extract(url)
Best for: Static HTML pages, no JavaScript rendering
Speed: Instant (~0.5s)
Cost: Free
Success rate on modern web: ~40%
Detection risk: High (easily detected as bot)
```

### Tier 2: curl (Raw HTTP)
```
Method: terminal( curl -sL -A "<user-agent>" <url> )
Best for: Pages that check User-Agent but don't need JS
Speed: Fast (~1-2s)
Cost: Free
Success rate: ~55%
Detection risk: Medium (UA spoofing helps)
Variants:
- curl -sL → follow redirects
- curl --compressed → handle gzip/deflate
- curl -H "Accept: text/html" → request HTML
- curl -H "Cookie: ..." → with session cookies
```

### Tier 3: agent-browser (Hermes Browser)
```
Method: browser_navigate → browser_snapshot
Best for: JavaScript-rendered SPAs, dynamic content
Speed: Moderate (~3-8s)
Cost: Free (local browser)
Success rate: ~75%
Detection risk: Medium (headless browser detection)
Enhancements:
- Wait for specific selectors with delays
- Scroll to trigger lazy loading
- Intercept and parse XHR responses
```

### Tier 4: Bright Data MCP (Enterprise Proxy)
```
Method: Bright Data's proxy network + MCP integration
Best for: Anti-bot protected sites, geo-restricted content
Speed: Variable (depends on proxy pool)
Cost: Paid (Bright Data subscription)
Success rate: ~95%
Detection risk: Very Low (residential IPs)
Capabilities:
- Residential IP proxy network
- Browser fingerprint masking
- CAPTCHA solving integration
- Geolocation targeting
- Session persistence
```

## Step-by-Step Procedures

### 1. Progressive Scrape (Auto-Escalate)
```
1. Start with Tier 1 (WebFetch):
   a. result = web_extract(url)
   b. Check if returned meaningful content:
      - Contains expected data? (keywords, structure, length > 200 chars)
      - Or contains "JavaScript required", "enable JavaScript", etc.
      - Or status code indicates blocking (403, 429, 503)
   c. If PASS → return result (done)
   d. If FAIL → escalate to Tier 2

2. Escalate to Tier 2 (curl):
   a. Try with common user agents:
      - Chrome 120 on Windows
      - Safari on macOS
      - Mobile Chrome on Android
   b. Check if content is meaningful
   c. If PASS → return parsed result
   d. If FAIL → escalate to Tier 3

3. Escalate to Tier 3 (agent-browser):
   a. browser_navigate(url)
   b. Wait for page load + JS execution
   c. browser_snapshot() or browser_vision()
   d. Check for CAPTCHA or anti-bot pages
   e. If PASS → return extracted content
   f. If FAIL (CAPTCHA/blocked) → escalate to Tier 4

4. Escalate to Tier 4 (Bright Data MCP):
   a. Configure Bright Data proxy with:
      - Target URL
      - Geolocation (if needed)
      - Session persistence
      - Browser fingerprint
   b. Execute via Bright Data MCP tools
   c. Handle CAPTCHA if triggered
   d. Return extracted content
```

### 2. Targeted Tier Selection
```
1. User provides URL and optionally a tier preference
2. If user specifies tier → use directly
3. If no preference → use auto-escalation
4. URL pattern analysis for tier recommendation:
   - Static blogs (WordPress, Medium) → Tier 1
   - Documentation sites → Tier 1 or 2
   - SPAs (React, Vue, Angular) → Tier 3
   - E-commerce (Amazon, Walmart) → Tier 3 or 4
   - Social media → Tier 3 or 4
   - Anti-bot protected → Tier 4
```

### 3. Data Extraction Pipeline
```
Regardless of tier, after getting page content:
1. Parse HTML/JSON content
2. Extract structured data using selectors or regex:
   a. CSS selectors for known patterns
   b. XPath for complex navigation
   c. Regex for text patterns
3. Clean and normalize data:
   - Trim whitespace
   - Remove HTML tags from text
   - Parse dates to standard format
   - Handle encoding issues
4. Validate extracted data:
   - Check required fields are present
   - Verify expected data types
   - Flag suspicious/missing values
5. Return structured result
```

### 4. Anti-Detection Configuration (Tier 4)
```
1. Configure Bright Data proxy settings:
   - proxy_country: US, GB, DE, etc. (geolocation)
   - proxy_type: residential (default), datacenter
   - session_id: for persistent sessions
   - dns: avoid DNS leakage
2. Browser fingerprint settings:
   - viewport: randomize window size
   - user_agent: latest Chrome/Firefox/Safari
   - webgl_vendor: Intel/AMD/NVIDIA
   - timezone: match geolocation
   - language: match geolocation
3. Request behavior:
   - random_delay: 1-5 seconds between requests
   - scroll_behavior: human-like scrolling
   - mouse_movement: simulate cursor paths
```

## Gotchas

- Tier 1/2 cannot handle JavaScript-rendered content at all
- Dynamic content may appear different from curl/WebFetch vs browser
- Some sites detect headless browsers even in Tier 3
- Bright Data MCP requires subscription; check credentials first
- Auto-escalation adds latency; for known-simple pages, skip to Tier 1
- CAPTCHA pages in Tier 3 should immediately trigger Tier 4
- Always respect robots.txt unless specifically authorized otherwise
- Rate limiting applies at all tiers; add delays between requests
- Some sites block known datacenter IPs; Tier 4 residential proxies help
- Session cookies from earlier tiers don't carry to later tiers

## Execution Log Pattern

```
[PAI-BRIGHTDATA] URL: https://example.com/products
[TIER 1] WebFetch → FAIL (403 Forbidden)
[TIER 2] curl (Chrome UA) → FAIL (JS required)
[TIER 3] agent-browser → FAIL (CAPTCHA detected)
[TIER 4] Bright Data MCP (residential, US) → SUCCESS
[EXTRACT] 24 products extracted (name, price, rating, availability)
[PARSE] Prices normalized to USD, dates parsed
[COMPLETE] Progressive scrape completed in 18.7s (Tier 4)
```
