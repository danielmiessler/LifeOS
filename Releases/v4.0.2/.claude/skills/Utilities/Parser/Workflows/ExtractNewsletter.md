# Newsletter Extraction Workflow

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the ExtractNewsletter workflow in the Parser skill to parse newsletters"}' \
  > /dev/null 2>&1 &
```

Running the **ExtractNewsletter** workflow in the **Parser** skill to parse newsletters...

**Purpose:** Extract structured content from newsletter HTML (Substack, Beehiiv, ConvertKit, etc.)

**When to Use:** Content type detected as "newsletter" from known newsletter domains

---

## Extraction Steps

### 1. Newsletter Platform Detection

**Identify platform:**
- Substack: `*.substack.com`
- Beehiiv: `*.beehiiv.com`
- ConvertKit: `*.convertkit.com`
- Ghost: `*.ghost.io`
- Buttondown: `buttondown.email`

**Platform-specific parsing:**
- Each platform has different HTML structure
- Adapt selectors based on platform
- Extract platform-specific metadata

---

### 2. Newsletter Metadata Extraction

**Extract newsletter-level metadata:**
- Newsletter name
- Issue number (if present)
- Publication date
- Author/creator
- Newsletter description
- Subscribe URL
- Social links

**Example (Substack):**
```html
<meta property="og:site_name" content="AI Weekly Newsletter">
<meta property="article:published_time" content="2024-01-15T10:00:00Z">
<meta name="author" content="Author Name">
```

---

### 3. Section/Story Parsing

**Parse newsletter structure:**

**Common sections:**
- Main story/featured content
- News roundup
- Tool recommendations
- Sponsored content
- Upcoming events
- Community highlights

**For each section:**
- Section title/header
- Section description
- Individual items/stories within section

**Example structure:**
```
Newsletter: AI Weekly #42
├── Main Story: GPT-4 Announced
├── Headlines (5 items)
│   ├── OpenAI releases GPT-4
│   ├── Google announces Gemini Pro
│   ├── Meta open-sources Llama 3
│   ├── Anthropic raises $500M
│   └── New AI safety regulations
├── Tools (3 items)
│   ├── LangChain v0.2
│   ├── AutoGPT updates
│   └── New Hugging Face models
└── Analysis: AI Scaling Laws Revisited
```

---

### 4. Individual Item Extraction

**For each newsletter item/story:**

**Extract:**
- Item title/headline
- Item description/summary
- Author commentary (if separate from description)
- Links (primary link + any supporting links)
- Position in newsletter (section + order)
- Inline images (if relevant)

**Example item:**
```json
{
  "title": "OpenAI Releases GPT-4",
  "summary": "OpenAI's latest model shows significant improvements in reasoning...",
  "editorial_note": "This is huge - multimodal capabilities open new possibilities",
  "links": [
    {
      "url": "https://openai.com/blog/gpt-4",
      "title": "Official announcement",
      "type": "primary"
    },
    {
      "url": "https://twitter.com/sama/status/123",
      "title": "Sam Altman's tweet",
      "type": "reference"
    }
  ],
  "section": "Headlines",
  "position": 1
}
```

---

### 5. Link Context Extraction

**For all links in newsletter:**

**Extract context:**
- What section is the link in?
- What's the surrounding text?
- Is it the primary source or supporting reference?
- Author's commentary on the link

**Example:**
```json
{
  "url": "https://openai.com/blog/gpt-4",
  "domain": "openai.com",
  "title": "GPT-4 Announcement",
  "description": "Official blog post about GPT-4 release",
  "link_type": "source",
  "context": "Featured in 'Headlines' section as major AI announcement with positive commentary",
  "position": "beginning"
}
```

---

### 6. Author/Editorial Voice Extraction

**Identify author's commentary:**

**Distinguish between:**
- Original source material (quoted/linked)
- Author's commentary/analysis
- Editorial notes
- Personal takes

**Example:**
```
Original: "GPT-4 achieves 90th percentile on bar exam"
Author commentary: "This is a significant milestone, though real-world legal work requires more than exam performance"
```

**Extract as:**
- `editorial_note` in newsletter_metadata
- Separate excerpts showing author's voice
- Sentiment analysis of author's take

---

### 7. Sponsored Content Detection

**Identify sponsored/promotional content:**

**Indicators:**
- "Sponsored by" labels
- "Partner content" labels
- Affiliate disclosure
- Ad blocks

**Flag sponsored content:**
- Note in `link_type` as "sponsored"
- Lower importance score
- Separate from editorial content

---

### 8. Gemini Analysis

**Send newsletter content to Gemini:**

**Extract:**
- All people mentioned across all items
- All companies mentioned
- Topics covered (aggregate across items)
- Overall newsletter themes
- Audience relevance

**Generate newsletter-level summary:**
- Short: "Weekly AI news covering GPT-4 release, Gemini updates, and new tools"
- Medium: Paragraph summarizing all major items
- Long: Comprehensive summary of entire newsletter

---

### 9. Multi-Item vs Single-Item Mode

**Decision: Parse as single item or multiple items?**

**Single-item mode (default):**
- Entire newsletter is one content item
- All links aggregated
- Newsletter-level summary
- Good for: archiving full newsletters

**Multi-item mode (optional future feature):**
- Each newsletter section/story becomes separate content item
- More granular database entries
- Better for: extracting individual stories for newsletter database

**For now: Use single-item mode**
- Simpler implementation
- Preserves newsletter structure
- Can split later if needed

---

### 10. Schema Population

**Populate content section:**
```json
{
  "content": {
    "id": "uuid-generated",
    "type": "newsletter",
    "title": "AI Weekly #42 - GPT-4 and More",
    "summary": {
      "short": "Weekly AI news covering GPT-4, Gemini, Llama 3, and new tools",
      "medium": "This week's newsletter covers major AI announcements including OpenAI's GPT-4 release with multimodal capabilities, Google's Gemini Pro updates, Meta's Llama 3 open-source release, and a roundup of new tools including LangChain v0.2. Also includes analysis on AI scaling laws and regulatory developments.",
      "long": "[Comprehensive summary of all sections and items]"
    },
    "content": {
      "full_text": "[Full newsletter text with all items]",
      "transcript": null,
      "excerpts": [
        "\"GPT-4 is a game-changer for multimodal AI\" - Author commentary",
        "This week saw three major model releases in one week",
        "Scaling laws may be hitting diminishing returns"
      ]
    },
    "metadata": {
      "source_url": "https://newsletter.substack.com/p/issue-42",
      "canonical_url": "https://newsletter.substack.com/p/issue-42",
      "published_date": "2024-01-15T10:00:00Z",
      "accessed_date": "2024-01-16T15:30:00Z",
      "language": "en",
      "word_count": 2000,
      "read_time_minutes": 8,
      "author_platform": "substack"
    }
  },
  "newsletter_metadata": {
    "issue_number": 42,
    "section": null,
    "position_in_section": null,
    "editorial_note": "Aggregate of author commentary throughout newsletter",
    "include_in_newsletter": false,
    "scheduled_date": null
  }
}
```

**Links array includes ALL links from all newsletter items**

**Topics aggregate all topics mentioned across items**

---

## Error Handling

**Paywall/subscription required:**
- Extract preview content if available
- Extract metadata from page
- Note in warnings: "Full content requires subscription"
- Confidence: 0.4-0.6

**Complex HTML structure:**
- Fall back to generic article extraction
- May lose newsletter-specific structure
- Log warning
- Confidence: 0.6-0.7

---

## Output Example

**Successful extraction:**
```
✅ Extracted newsletter
📧 Title: AI Weekly #42 - GPT-4 and More
📅 Published: 2024-01-15
📝 Content: 2,000 words (~8 min read)
📰 Issue: #42
🔗 Links: 18 (across all sections)
👥 People: 7
🏢 Companies: 12
🎯 Confidence: 0.89
```

---

**This workflow handles comprehensive newsletter extraction with section/item parsing.**
