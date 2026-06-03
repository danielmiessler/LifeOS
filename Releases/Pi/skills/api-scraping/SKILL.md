---
name: api-scraping
description: Web scraping and API integration patterns. HTTP clients, pagination handling, rate limiting, auth patterns, data extraction from HTML/JSON/XML, error recovery, and caching. USE WHEN scrape, web scrape, API, REST, HTTP, fetch, extract data, crawl, spider, data ingestion, webhook, integration.
metadata:
  author: pai
  version: 1.0.0
---

# API & Scraping — Data Integration

## Patterns

### REST API
- **Auth**: Basic, Bearer token, OAuth2, API key
- **Pagination**: Page-based, cursor-based, offset-based
- **Rate Limiting**: Backoff (exponential), retry-after headers, queuing
- **Error Handling**: Retry 5xx, log 4xx, circuit break on sustained failures

### Web Scraping
- **Extraction**: CSS selectors, XPath, regex, structured parsing
- **Dynamic pages**: Headless browser, wait for selectors, intercept network
- **Anti-bot**: Rotate user-agents, respect robots.txt, throttle requests
- **Fallback**: If HTML parse fails, try regex; if JS render needed, switch to headless

### Data Formats
| Format | Parser | Notes |
|--------|--------|-------|
| JSON | json.loads | Nested, schema-aware |
| HTML | BeautifulSoup/Parse | Fragile to DOM changes |
| XML | ElementTree | Namespace-aware |
| CSV | csv reader | Header mapping |
| YAML | yaml.safe_load | Config files |

## Workflow
1. **Discover** endpoints/URLs and auth requirements
2. **Request** with appropriate headers and backoff
3. **Parse** into structured records
4. **Validate** schema and data quality
5. **Store** with provenance (source URL, timestamp)
6. **Monitor** for breakage (schema changes, status codes)
