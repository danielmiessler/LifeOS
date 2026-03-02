# URL Verification Protocol

**MANDATORY for all research workflows in this skill.**

## Critical Warning

```
---------------------------------------------------------------
  EVERY URL MUST BE VERIFIED BEFORE INCLUDING IN RESULTS
  Research agents HALLUCINATE URLs - NEVER trust them blindly
  A single broken link is a CATASTROPHIC FAILURE
---------------------------------------------------------------
```

## Why This Matters

Research agents (Perplexity, Gemini, Claude, Grok) frequently HALLUCINATE URLs that look plausible but don't exist. This includes:
- URLs with correct domain but wrong path
- URLs with plausible article titles that were never published
- URLs combining real domains with fabricated paths
- URLs to articles that were deleted or moved

## Verification Workflow

Before including ANY URL in research results:

1. **Verify with WebFetch** - Actually fetch the URL and confirm it returns content (not 404, 403, or error)
2. **Confirm content matches claim** - The fetched content must actually support what you're citing it for
3. **Use curl as backup** - `curl -s -o /dev/null -w "%{http_code}" -L URL` to check HTTP status
4. **NEVER include unverified URLs** - If you can't verify it, DON'T include it

```bash
# Step 1: Check HTTP status
curl -s -o /dev/null -w "%{http_code}" -L "https://example.com/article"

# Step 2: If 200, verify content with WebFetch
WebFetch(url, "Confirm this article exists and summarize its main point")

# Step 3: Only include if BOTH checks pass
```

## Acceptable vs Unacceptable

| Acceptable | Unacceptable |
|------------|--------------|
| URL verified via WebFetch returns actual content | URL from research agent without verification |
| URL returns 200 AND content matches citation | URL returns 403/404/500 |
| URL content actually supports the claim | URL exists but content doesn't match |

**Broken links destroy credibility. Verify EVERY URL.**
