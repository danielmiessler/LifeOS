# Web Scraping Workflow

Web scraping and crawling using WebFetch for simple pages, BrightData MCP for CAPTCHA/blocking, and Apify MCP for social media. Includes HTML parsing, rate limiting, and best practices for ethical scraping.

## 🎯 Load Full PAI Context

**Before starting any task with this skill, load complete PAI context:**

`read ~/.claude/skills/PAI/SKILL.md`

This provides access to:
- Complete contact list (Angela, Bunny, Saša, Greg, team members)
- Stack preferences (TypeScript>Python, bun>npm, uv>pip)
- Security rules and repository safety protocols
- Response format requirements (structured emoji format)
- Voice IDs for agent routing (ElevenLabs)
- Personal preferences and operating instructions

## When to Activate This Skill
- Scrape web pages
- Extract data from websites
- Crawl multiple pages
- Collect web data
- Extract links or content
- Data extraction tasks

## Decision Tree

1. **Simple pages?** → Use WebFetch first
2. **CAPTCHA/blocking?** → Use BrightData MCP (`mcp__brightdata__*`)
3. **Social media?** → Use Apify MCP

## Common Tasks

### Extract All Links from Page
1. Use WebFetch to get HTML
2. Parse HTML for <a> tags
3. Extract href attributes

### Scrape Product Listings
1. Use appropriate tool (WebFetch or BrightData)
2. Parse HTML for product containers
3. Extract data (title, price, image, etc.)

### Crawl Multiple Pages
1. Start with index/listing page
2. Extract links to detail pages
3. Fetch each detail page
4. Extract data from each

## Best Practices

### Do's
✅ Check robots.txt first
✅ Add delays between requests
✅ Handle errors gracefully
✅ Use appropriate tool for site
✅ Cache results when possible

### Don'ts
❌ Don't scrape too fast
❌ Don't ignore rate limits
❌ Don't scrape personal data without permission
❌ Don't bypass security maliciously

## Rate Limiting
- Add delays between requests (`sleep 1`)
- Respect robots.txt
- Don't overwhelm servers

## Supplementary Resources
For advanced scraping: `read ~/.claude/docs/web-scraping-advanced.md`
For MCP tools: `read ~/.claude/docs/mcp-servers-reference.md`
