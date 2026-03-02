# Research Quick Reference

## Three Research Modes

| Trigger | Mode | Config | Speed |
|---------|------|--------|-------|
| "quick research", "minor research" | Quick | 1 Perplexity agent | ~10-15s |
| "do research", "research this" | Standard | 3 agents (Perplexity + Claude + Gemini) | ~15-30s |
| "extensive research" | Extensive | 12 agents (4 types x 3 threads each) | ~60-90s |

## Extract Alpha Philosophy

Based on Shannon's information theory: **real information is what's different.**

**HIGH-ALPHA:** Surprising, counterintuitive, connects domains unexpectedly
**LOW-ALPHA:** Common knowledge, obvious implications, generic advice

Output: 24-30 insights, Paul Graham style, 8-12 word bullets

## Three-Layer Retrieval

1. **Layer 1:** WebFetch/WebSearch (try first)
2. **Layer 2:** BrightData MCP (CAPTCHA, bot detection)
3. **Layer 3:** Apify MCP (specialized scrapers)

Only escalate when previous layer fails.

## Examples

**Example 1: Quick research on a topic**
```
User: "quick research on Texas hot sauce brands"
-> Spawns 1 Perplexity agent with single query
-> Returns top brands with brief descriptions
-> Completes in ~10-15 seconds
```

**Example 2: Standard research (default)**
```
User: "do research on AI agent frameworks"
-> Spawns 3 agents in parallel (Perplexity + Claude + Gemini)
-> Each searches from different perspective
-> Returns synthesized findings with multiple viewpoints (~15-30s)
```

**Example 3: Extract alpha from content**
```
User: "extract alpha from this YouTube video" [URL]
-> Extracts transcript via fabric -y
-> Runs deep thinking deep analysis
-> Returns 24-30 high-alpha insights in Paul Graham style bullets
```
