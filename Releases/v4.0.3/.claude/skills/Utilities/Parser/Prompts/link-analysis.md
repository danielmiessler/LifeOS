# Link Analysis Prompt (Gemini)

**Purpose:** Extract and classify all links from content with context and relevance

**When to Use:** All content types after raw content extraction

---

## Prompt Template

```
You are analyzing links for a newsletter database. Extract ALL links from the following content and provide detailed classification and context for each.

CONTENT TO ANALYZE:
"""
{content_text}
"""

CONTENT TYPE: {type}

---

TASK: COMPREHENSIVE LINK EXTRACTION AND ANALYSIS

For each link found in the content, provide:

**1. URL (full URL)**
**2. Domain (extracted from URL)**
**3. Title (anchor text, link text, or title of linked resource)**
**4. Description (what does this link point to?)**
**5. Link Type (classify the purpose of the link)**
**6. Context (why is this link included? what's the surrounding discussion?)**
**7. Position (where in content does this appear?)**

---

LINK TYPES (classify each link as ONE of these):

- **reference**: Citations, sources backing up claims
- **source**: Primary sources (original research, official docs, press releases)
- **related**: Related articles, further reading, "see also" links
- **tool**: Links to tools, products, services, apps
- **research**: Academic papers, studies, preprints (ArXiv, etc.)
- **product**: Commercial products, SaaS, hardware
- **social**: Social media profiles, tweets
- **other**: Anything that doesn't fit above categories

---

POSITION VALUES (where link appears):

- **beginning**: First third of content
- **middle**: Middle third of content
- **end**: Final third of content
- **sidebar**: Sidebar, related links section, author bio
- **footer**: Footer, references section, citations

---

LINK EXTRACTION GUIDELINES:

**What to Extract:**
- ALL hyperlinks in main content
- Links in author bios
- Links in footnotes/references
- Links in image captions
- Links in video descriptions (for YouTube)
- Links in newsletter sections
- Tweet links in threads

**What to Skip:**
- Navigation links (header/footer menus)
- Social share buttons
- "Subscribe" or "Follow" CTAs (unless in author bio)
- Cookie policy, privacy policy links
- Ad links (mark sponsored if extracting)

**URL Handling:**
- Use full URL, not shortened versions
- Expand t.co links (Twitter) if possible
- Expand bit.ly and other URL shorteners
- Use canonical URL if available

**Domain Extraction:**
- Extract root domain (e.g., "openai.com" not "https://www.openai.com/blog")
- Remove www. prefix
- Include subdomain if meaningful (e.g., "blog.anthropic.com" → "anthropic.com")

**Title Extraction:**
- Use anchor text if it's descriptive
- If anchor text is generic ("click here"), use linked page title
- For research papers: Use paper title
- For tweets: Use first few words or "Tweet by @username"

**Description:**
- 1-2 sentences explaining what the link is
- What type of resource (article, video, tool, paper, etc.)
- What topic it covers
- Why it's relevant

**Context:**
- Why is this link included in the content?
- What claim does it support?
- What discussion surrounds it?
- How does author frame it?

**Position:**
- Approximate location in content
- Think about flow: beginning/middle/end
- Or special sections: sidebar, footer, references

---

OUTPUT FORMAT:

Return as JSON array:

```json
[
  {
    "url": "https://full.url/path",
    "domain": "domain.com",
    "title": "Link title or anchor text",
    "description": "1-2 sentence description of linked resource",
    "link_type": "reference|source|related|tool|research|product|social|other",
    "context": "Why this link is included and its relevance",
    "position": "beginning|middle|end|sidebar|footer"
  }
]
```

---

QUALITY STANDARDS:

**Completeness:**
- Extract ALL meaningful links
- Don't miss links in footnotes, bios, descriptions
- Include both inline and reference links

**Accuracy:**
- Correct link types
- Accurate descriptions
- Meaningful context (not just "link to article")

**Usefulness:**
- Context should help reader understand value of link
- Description should make it clear what resource is
- Position helps understand flow of content

**Special Cases:**

**Research Papers:**
```json
{
  "url": "https://arxiv.org/abs/2301.12345",
  "domain": "arxiv.org",
  "title": "Attention Is All You Need",
  "description": "Foundational paper on transformer architecture from 2017",
  "link_type": "research",
  "context": "Cited as the origin of attention mechanisms discussed in article",
  "position": "middle"
}
```

**Products/Tools:**
```json
{
  "url": "https://github.com/langchain-ai/langchain",
  "domain": "github.com",
  "title": "LangChain GitHub Repository",
  "description": "Open-source framework for building LLM applications",
  "link_type": "tool",
  "context": "Mentioned as example of LLM orchestration framework with active development",
  "position": "middle"
}
```

**Tweets/Social:**
```json
{
  "url": "https://twitter.com/sama/status/123456",
  "domain": "twitter.com",
  "title": "Tweet by Sam Altman announcing GPT-4",
  "description": "Twitter announcement from OpenAI CEO about GPT-4 release",
  "link_type": "social",
  "context": "Original announcement source linked as primary reference",
  "position": "beginning"
}
```

**Official Sources:**
```json
{
  "url": "https://openai.com/blog/gpt-4",
  "domain": "openai.com",
  "title": "GPT-4 Official Announcement",
  "description": "Official OpenAI blog post detailing GPT-4 capabilities and benchmarks",
  "link_type": "source",
  "context": "Primary source for all claims about GPT-4 performance and features",
  "position": "beginning"
}
```

---

Do not include any explanatory text outside the JSON array.
```

---

## Usage Example

**Input:**
```
Content: "OpenAI announced GPT-4 today (https://openai.com/blog/gpt-4). The model shows significant improvements according to this independent analysis (https://example.com/analysis). For comparison, see the original Transformer paper (https://arxiv.org/abs/1706.03762). You can try GPT-4 via ChatGPT Plus (https://chat.openai.com/). Sam Altman shared his thoughts on Twitter (https://twitter.com/sama/status/123)."

Type: article
```

**Expected Output:**
```json
[
  {
    "url": "https://openai.com/blog/gpt-4",
    "domain": "openai.com",
    "title": "GPT-4 Official Announcement",
    "description": "Official OpenAI blog post announcing GPT-4 release with technical details and benchmarks",
    "link_type": "source",
    "context": "Primary source for GPT-4 announcement cited at beginning of article",
    "position": "beginning"
  },
  {
    "url": "https://example.com/analysis",
    "domain": "example.com",
    "title": "Independent GPT-4 Analysis",
    "description": "Third-party analysis of GPT-4 capabilities and performance",
    "link_type": "reference",
    "context": "Supporting evidence for claims about GPT-4 improvements from independent source",
    "position": "beginning"
  },
  {
    "url": "https://arxiv.org/abs/1706.03762",
    "domain": "arxiv.org",
    "title": "Attention Is All You Need",
    "description": "Original 2017 research paper introducing transformer architecture",
    "link_type": "research",
    "context": "Historical comparison point cited to contextualize GPT-4's architectural foundations",
    "position": "middle"
  },
  {
    "url": "https://chat.openai.com/",
    "domain": "openai.com",
    "title": "ChatGPT Plus",
    "description": "ChatGPT subscription service providing access to GPT-4",
    "link_type": "product",
    "context": "Mentioned as the primary way readers can access and try GPT-4",
    "position": "middle"
  },
  {
    "url": "https://twitter.com/sama/status/123",
    "domain": "twitter.com",
    "title": "Sam Altman's tweet about GPT-4",
    "description": "Twitter post from OpenAI CEO sharing personal thoughts on GPT-4 release",
    "link_type": "social",
    "context": "Additional perspective from OpenAI leadership on the announcement",
    "position": "end"
  }
]
```

---

## Validation

**Before returning results, verify:**
- JSON array is valid and parseable
- All links have required fields
- URLs are complete and valid
- Domains are correctly extracted
- Link types match allowed enum values
- Positions match allowed enum values
- Descriptions are informative (not just "article" or "link")
- Context explains relevance
- No duplicate links

---

**This prompt ensures comprehensive link extraction and classification for newsletter database.**
