# YouTube Video Extraction Workflow

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the ExtractYoutube workflow in the Parser skill to parse videos"}' \
  > /dev/null 2>&1 &
```

Running the **ExtractYoutube** workflow in the **Parser** skill to parse videos...

**Purpose:** Extract transcript, metadata, and entities from YouTube videos

**When to Use:** Content type detected as "video" from YouTube domains

---

## Extraction Steps

### 1. Transcript Extraction (Fabric)

**Use Fabric yt pattern:**
```bash
yt --transcript "https://youtube.com/watch?v=VIDEO_ID"
```

**Output:**
- Full video transcript with timestamps
- Cleaned text (no overlapping timestamps)
- Speaker labels if available

**If transcript unavailable:**
- Check if auto-captions are disabled
- Check if video is private/restricted
- Log warning: "No transcript available"
- Proceed with metadata-only extraction
- Set confidence_score to 0.4 or lower

---

### 2. Page Metadata Scraping

**Scrape YouTube page for metadata:**

**Required fields:**
- Title: `<meta property="og:title">`
- Description: `<meta property="og:description">`
- Publish date: `<meta itemprop="uploadDate">`
- Channel name: `<meta itemprop="channelId">` or from page
- Channel URL: Extract from page
- Video duration: `<meta itemprop="duration">`
- View count: Extract from page (if available)
- Thumbnail: `<meta property="og:image">`

**Optional fields:**
- Tags/keywords: `<meta name="keywords">`
- Category: Extract from page
- License: Standard YouTube License or Creative Commons

**Example metadata extraction:**
```typescript
{
  title: "Building AGI: Interview with Anthropic CEO",
  description: "Deep dive into AI safety and scaling...",
  published_date: "2024-01-15T10:30:00Z",
  channel_name: "AI Podcast",
  channel_url: "https://youtube.com/@aipodcast",
  duration: "PT1H23M45S", // ISO 8601 duration
  view_count: 125000,
  thumbnail: "https://i.ytimg.com/vi/VIDEO_ID/maxresdefault.jpg"
}
```

---

### 3. Channel Information Extraction

**Extract channel owner details:**

**From channel page (if accessible):**
- Channel owner name
- Channel description
- Social links (Twitter, website, etc.)
- Subscriber count
- Verified status

**Add to people array:**
```json
{
  "name": "Channel Owner Name",
  "role": "author",
  "title": "YouTuber / Podcast Host",
  "company": null,
  "social": {
    "twitter": "@channelowner",
    "linkedin": null,
    "email": null,
    "website": "https://channelwebsite.com"
  },
  "context": "YouTube channel owner and video creator",
  "importance": "primary"
}
```

---

### 4. Description Link Parsing

**Extract all links from video description:**

**Common link types in descriptions:**
- Timestamps (e.g., "0:00 Introduction")
- Referenced websites
- Sponsor links
- Social media links
- Related videos/playlists
- Affiliate links

**For each link:**
```json
{
  "url": "https://example.com/resource",
  "domain": "example.com",
  "title": "Resource mentioned in video",
  "description": "Tool/article/paper discussed",
  "link_type": "reference",
  "context": "Mentioned at 12:34 in discussion of X",
  "position": "beginning" // based on timestamp
}
```

---

### 5. Gemini Analysis

**Send transcript to Gemini for entity extraction:**

**Prompt:** Use `prompts/entity-extraction.md`

**Extract from transcript:**
- All people mentioned (speakers, subjects, guests)
- Companies/organizations discussed
- Products/tools mentioned
- Technical concepts and topics

**People extraction from transcript:**
```json
{
  "name": "Dario Amodei",
  "role": "subject",
  "title": "CEO of Anthropic",
  "company": "Anthropic",
  "social": {
    "twitter": "@darioamodei",
    "linkedin": "...",
    "email": null,
    "website": null
  },
  "context": "Interviewed about AI safety and scaling laws",
  "importance": "primary"
}
```

**Company extraction:**
```json
{
  "name": "Anthropic",
  "domain": "anthropic.com",
  "industry": "AI",
  "context": "Subject of interview, discussed AI safety approach",
  "mentioned_as": "subject",
  "sentiment": "positive"
}
```

---

### 6. Summarization

**Use Gemini to generate summaries:**

**Prompt:** Use `prompts/summarization.md`

**Generate three levels:**

**Short (1-2 sentences):**
```
Interview with Anthropic CEO discussing AI safety, scaling laws, and the path to beneficial AGI.
```

**Medium (paragraph):**
```
Deep dive conversation with Dario Amodei, CEO of Anthropic, covering the company's approach to AI safety through constitutional AI, recent progress with Claude models, thoughts on scaling laws and their limits, and the challenges of building AGI that remains beneficial and aligned with human values. Discussion includes technical details on RLHF, interpretability research, and predictions for the next 5 years of AI development.
```

**Long (multiple paragraphs):**
```
[Comprehensive summary with key points, main arguments, notable quotes, and takeaways]
```

**Extract key excerpts:**
- Notable quotes from speakers
- Important technical explanations
- Surprising insights or predictions

---

### 7. Topic Classification

**Analyze transcript for topics:**

**Primary category:**
- Determine main subject (AI, security, technology, etc.)

**Secondary categories:**
- Related topics discussed

**Tags:**
- Specific technical terms (e.g., "RLHF", "scaling laws", "constitutional AI")
- People mentioned
- Companies mentioned

**Newsletter sections:**
- Map to UL sections (e.g., "AI", "Headlines", "Analysis")

**Example:**
```json
{
  "primary_category": "AI",
  "secondary_categories": ["technology", "business", "research"],
  "tags": [
    "artificial-intelligence",
    "ai-safety",
    "anthropic",
    "claude",
    "rlhf",
    "constitutional-ai",
    "scaling-laws",
    "agi"
  ],
  "keywords": [
    "AI safety",
    "constitutional AI",
    "RLHF",
    "scaling laws",
    "alignment",
    "interpretability"
  ],
  "themes": [
    "Building safe AGI",
    "Scaling vs safety tradeoffs",
    "Future of AI development"
  ],
  "newsletter_sections": ["AI", "Analysis", "Headlines"]
}
```

---

### 8. Content Analysis

**Analyze video for:**

**Sentiment:**
- Overall tone (positive about AI safety, cautious about risks, etc.)

**Importance score (1-10):**
- Based on: Channel authority, view count, topic relevance
- High (8-10): Major announcement, industry leader interview
- Medium (5-7): Informative content, mid-tier channel
- Low (1-4): Opinion piece, small channel

**Novelty score (1-10):**
- How new/unique is the information?
- Original research/announcement: 8-10
- New perspective on known topic: 5-7
- Recap of existing knowledge: 1-4

**Controversy score (1-10):**
- How polarizing or debatable?
- Highly controversial takes: 8-10
- Some debate: 5-7
- Widely accepted: 1-4

**Trending potential:**
- High: Viral topic, major news, controversial
- Medium: Interesting but niche
- Low: Evergreen content, small audience

---

### 9. Schema Population

**Populate content section:**
```json
{
  "content": {
    "id": "uuid-generated",
    "type": "video",
    "title": "Building AGI: Interview with Anthropic CEO",
    "summary": {
      "short": "...",
      "medium": "...",
      "long": "..."
    },
    "content": {
      "full_text": null,
      "transcript": "[Full video transcript]",
      "excerpts": ["Notable quote 1", "Notable quote 2"]
    },
    "metadata": {
      "source_url": "https://youtube.com/watch?v=abc123",
      "canonical_url": "https://youtube.com/watch?v=abc123",
      "published_date": "2024-01-15T10:30:00Z",
      "accessed_date": "2024-01-16T14:22:00Z",
      "language": "en",
      "word_count": 8500, // transcript word count
      "read_time_minutes": 83, // video duration in minutes
      "author_platform": "youtube"
    }
  }
}
```

**Set confidence score:**
- Transcript available + good metadata: 0.85-0.95
- No transcript but good metadata: 0.4-0.6
- Limited metadata: 0.3-0.5

---

## Error Handling

**No transcript available:**
- Log warning: "Transcript unavailable - captions disabled"
- Extract metadata only
- Use video description for some context
- Lower confidence score to 0.4

**Private/restricted video:**
- Log error: "Video is private or restricted"
- Extract minimal public metadata
- Confidence score: 0.2

**Geo-blocked content:**
- Attempt to fetch via VPN/proxy if available
- Otherwise log warning
- Extract public metadata only

**Age-restricted content:**
- May require authenticated request
- Fall back to public metadata if auth unavailable

---

## Output Example

**Successful extraction:**
```
✅ Extracted YouTube video
📺 Title: Building AGI: Interview with Anthropic CEO
⏱️ Duration: 1h 23m
📝 Transcript: 8,500 words
👥 People: 2 (Dario Amodei, Interviewer)
🏢 Companies: 3 (Anthropic, OpenAI, Google)
🔗 Links: 7 (from description)
🎯 Confidence: 0.92
```

**Partial extraction (no transcript):**
```
⚠️ Extracted YouTube video (metadata only - no transcript)
📺 Title: Building AGI: Interview with Anthropic CEO
⏱️ Duration: 1h 23m
📝 Transcript: Not available
👥 People: 1 (channel owner)
🔗 Links: 5 (from description)
🎯 Confidence: 0.45
⚠️ Warning: Captions disabled, transcript unavailable
```

---

**This workflow handles comprehensive YouTube video extraction with Fabric and Gemini.**
