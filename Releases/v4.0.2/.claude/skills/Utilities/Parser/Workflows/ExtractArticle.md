# Article Extraction Workflow

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the ExtractArticle workflow in the Parser skill to parse articles"}' \
  > /dev/null 2>&1 &
```

Running the **ExtractArticle** workflow in the **Parser** skill to parse articles...

**Purpose:** Extract content, metadata, and entities from web articles and generic web pages

**When to Use:** Content type detected as "article" or "generic" web content

---

## Extraction Steps

### 1. Content Scraping (Gemini Researcher)

**Use GeminiResearcher agent for full content extraction:**

Launch Gemini Researcher with 2M token context:
```
Prompt: "Extract the full article content from this URL including all text, metadata, and structure. Preserve formatting and identify main content vs sidebar/ads."
URL: [article URL]
```

**Extract:**
- Main article body (clean text)
- Headlines and subheadlines
- Pull quotes and callouts
- Image captions
- Author byline
- Publication date and time
- Publication name
- Article category/section

**Content cleaning:**
- Remove ads and promotional content
- Remove navigation menus
- Remove cookie banners
- Remove social share buttons
- Preserve article text, quotes, and inline links

---

### 2. HTML Metadata Extraction

**Parse HTML for structured metadata:**

**OpenGraph tags:**
```html
<meta property="og:title" content="...">
<meta property="og:description" content="...">
<meta property="og:type" content="article">
<meta property="og:url" content="...">
<meta property="og:image" content="...">
<meta property="og:site_name" content="...">
```

**Twitter Card tags:**
```html
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="...">
<meta name="twitter:description" content="...">
<meta name="twitter:creator" content="@username">
```

**Article-specific tags:**
```html
<meta property="article:published_time" content="2024-01-15T10:00:00Z">
<meta property="article:modified_time" content="2024-01-15T11:30:00Z">
<meta property="article:author" content="Author Name">
<meta property="article:section" content="Technology">
<meta property="article:tag" content="AI">
```

**JSON-LD structured data:**
```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "...",
  "author": {
    "@type": "Person",
    "name": "Author Name",
    "url": "..."
  },
  "datePublished": "2024-01-15T10:00:00Z",
  "publisher": {
    "@type": "Organization",
    "name": "Publication Name"
  }
}
```

---

### 3. Author Information Extraction

**Extract author details:**

**From metadata:**
- Author name (meta tags, byline, JSON-LD)
- Author bio (if available on page)
- Author photo URL
- Author social links (Twitter, LinkedIn)

**Author page scraping (if linked):**
- Full bio
- Email address (if public)
- Website
- Social media profiles
- Other articles by author

**Add to people array:**
```json
{
  "name": "Author Name",
  "role": "author",
  "title": "Senior Writer at Publication",
  "company": "Publication Name",
  "social": {
    "twitter": "@authorhandle",
    "linkedin": "https://linkedin.com/in/authorname",
    "email": "author@publication.com",
    "website": "https://authorwebsite.com"
  },
  "context": "Article author, writes about AI and technology",
  "importance": "primary"
}
```

---

### 4. Link Extraction and Classification

**Extract all links from article body:**

**For each link:**
- URL
- Anchor text (link title)
- Surrounding context (sentence/paragraph)
- Position in article (beginning, middle, end)

**Classify link types:**
- **reference**: Citations to other articles/sources
- **source**: Primary sources (research papers, official docs)
- **related**: Related articles on same site
- **tool**: Links to tools, products, services
- **research**: Academic papers, studies
- **product**: Commercial products mentioned
- **social**: Social media profiles
- **other**: Miscellaneous

**Example:**
```json
{
  "url": "https://arxiv.org/abs/2401.12345",
  "domain": "arxiv.org",
  "title": "Attention Is All You Need",
  "description": "Research paper on transformer architecture",
  "link_type": "research",
  "context": "Article cites this paper when discussing transformer models",
  "position": "middle"
}
```

---

### 5. Gemini Entity Extraction

**Send article content to Gemini:**

**Prompt:** Use `prompts/entity-extraction.md`

**Extract:**

**People mentioned:**
- Names of people discussed in article
- Roles and titles
- Companies/organizations they're affiliated with
- Why they're mentioned

**Companies/organizations:**
- All companies mentioned
- Industry classifications
- How they're discussed (subject, competitor, example, etc.)
- Sentiment (positive, neutral, negative)

**Products/tools:**
- Software, hardware, services mentioned
- Associated companies
- Context of mention

**Example extractions:**
```json
// Person
{
  "name": "Sam Altman",
  "role": "subject",
  "title": "CEO of OpenAI",
  "company": "OpenAI",
  "social": {
    "twitter": "@sama",
    "linkedin": null,
    "email": null,
    "website": null
  },
  "context": "Quoted discussing GPT-4 capabilities and future plans",
  "importance": "primary"
}

// Company
{
  "name": "OpenAI",
  "domain": "openai.com",
  "industry": "AI",
  "context": "Main subject of article - discussed new model release",
  "mentioned_as": "subject",
  "sentiment": "positive"
}
```

---

### 6. Summarization

**Use Gemini for multi-level summaries:**

**Prompt:** Use `prompts/summarization.md`

**Short summary (1-2 sentences):**
```
OpenAI announces GPT-4, a new large language model with significantly improved reasoning capabilities and multimodal input support.
```

**Medium summary (paragraph):**
```
OpenAI has released GPT-4, the latest iteration of its large language model, featuring substantial improvements in reasoning, problem-solving, and the ability to process both text and images. The model demonstrates better performance on academic benchmarks, reduced hallucinations, and enhanced safety guardrails. GPT-4 is being rolled out to ChatGPT Plus subscribers and enterprise customers, with API access coming soon.
```

**Long summary (multiple paragraphs):**
```
[Comprehensive summary covering: main announcement, key technical improvements, benchmark results, safety considerations, availability timeline, industry reactions, implications for AI development, notable quotes, and future roadmap]
```

**Key excerpts:**
- Pull quotes from sources
- Notable statistics or findings
- Surprising insights

---

### 7. Topic Classification

**Analyze content for categorization:**

**Prompt:** Use `prompts/topic-classification.md`

**Determine:**
- Primary category (AI, security, technology, business, science, etc.)
- Secondary categories
- Specific tags
- Keywords
- Broader themes
- Which newsletter sections this fits

**Example:**
```json
{
  "primary_category": "AI",
  "secondary_categories": ["technology", "business"],
  "tags": [
    "gpt-4",
    "openai",
    "large-language-models",
    "multimodal-ai",
    "chatgpt"
  ],
  "keywords": [
    "GPT-4",
    "OpenAI",
    "language model",
    "reasoning capabilities",
    "multimodal"
  ],
  "themes": [
    "AI model capabilities expanding",
    "Multimodal AI emerging",
    "AI safety and alignment"
  ],
  "newsletter_sections": ["AI", "Headlines", "Tools"]
}
```

---

### 8. Source Extraction

**Identify cited sources in article:**

**Look for:**
- Research papers cited
- Previous news articles referenced
- Official statements/press releases
- Data sources (reports, studies)
- Expert quotes with attribution

**For each source:**
```json
{
  "publication": "Nature",
  "author": "Smith et al.",
  "url": "https://nature.com/articles/paper123",
  "published_date": "2023-12-01T00:00:00Z",
  "source_type": "research_paper"
}
```

---

### 9. Content Analysis

**Analyze article for:**

**Sentiment:**
- Positive (optimistic, favorable)
- Neutral (factual, balanced)
- Negative (critical, cautionary)
- Mixed (balanced pros/cons)

**Importance score (1-10):**
- Major announcement/breakthrough: 8-10
- Significant development: 6-8
- Incremental progress: 4-6
- Minor update: 1-3

**Novelty score (1-10):**
- Original research/exclusive: 9-10
- First coverage of new topic: 7-9
- New angle on known topic: 5-7
- Recap/summary: 1-4

**Controversy score (1-10):**
- Highly debatable/polarizing: 8-10
- Some controversy: 5-7
- Generally accepted: 1-4

**Relevance to audience:**
- Security professionals
- AI researchers
- Technologists
- Executives
- Entrepreneurs
- General tech audience

**Trending potential:**
- High: Viral topic, breaking news
- Medium: Important but niche
- Low: Evergreen content

**Key insights:**
- Main takeaways (3-5 bullet points)
- Novel information
- Action items or implications

---

### 10. Schema Population

**Populate content section:**
```json
{
  "content": {
    "id": "uuid-generated",
    "type": "article",
    "title": "OpenAI Announces GPT-4",
    "summary": {
      "short": "...",
      "medium": "...",
      "long": "..."
    },
    "content": {
      "full_text": "[Complete article text]",
      "transcript": null,
      "excerpts": [
        "\"GPT-4 is our most capable model yet\" - Sam Altman",
        "Key stat about performance"
      ]
    },
    "metadata": {
      "source_url": "https://openai.com/blog/gpt-4",
      "canonical_url": "https://openai.com/blog/gpt-4",
      "published_date": "2024-01-15T10:00:00Z",
      "accessed_date": "2024-01-16T14:30:00Z",
      "language": "en",
      "word_count": 1500,
      "read_time_minutes": 6,
      "author_platform": "blog"
    }
  }
}
```

**Set confidence score:**
- Full extraction with metadata: 0.85-0.95
- Good content, missing some metadata: 0.7-0.84
- Partial extraction: 0.5-0.69
- Minimal/generic extraction: 0.3-0.49

---

## Error Handling

**Paywall content:**
- Extract what's visible (headline, summary)
- Note in warnings: "Content behind paywall"
- Lower confidence score
- Attempt archive.org cached version

**JavaScript-heavy sites:**
- Use headless browser if needed
- Wait for dynamic content to load
- Extract rendered HTML
- May increase processing time

**403/401 errors:**
- Log error in warnings
- Attempt user-agent spoofing
- Try archive.org
- Return partial metadata

**Rate limiting:**
- Respect robots.txt
- Back off if rate limited
- Retry with exponential backoff
- Log in warnings

---

## Output Example

**Successful extraction:**
```
✅ Extracted article
📰 Title: OpenAI Announces GPT-4
✍️ Author: Sam Altman
📅 Published: 2024-01-15
📝 Content: 1,500 words (~6 min read)
👥 People: 3
🏢 Companies: 5
🔗 Links: 12
📚 Sources: 4
🎯 Confidence: 0.91
```

**Partial extraction:**
```
⚠️ Extracted article (partial - paywall detected)
📰 Title: Premium Content Article
📝 Content: 300 words visible (full text unavailable)
🔗 Links: 3 (from visible portion)
🎯 Confidence: 0.52
⚠️ Warning: Content behind paywall, extracted preview only
```

---

**This workflow handles comprehensive article extraction with Gemini Researcher.**
