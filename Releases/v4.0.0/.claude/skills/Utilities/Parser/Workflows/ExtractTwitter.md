# Twitter/X Thread Extraction Workflow

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the ExtractTwitter workflow in the Parser skill to parse tweets"}' \
  > /dev/null 2>&1 &
```

Running the **ExtractTwitter** workflow in the **Parser** skill to parse tweets...

**Purpose:** Extract tweets, threads, and metadata from Twitter/X

**When to Use:** Content type detected as "tweet_thread" from twitter.com or x.com domains

---

## Extraction Steps

### 1. Thread Detection and Fetching

**Determine if single tweet or thread:**
- Fetch initial tweet
- Check for thread indicator (replies from same author)
- Follow thread if present

**Fetch entire thread:**
- Get all tweets in conversation from same author
- Maintain chronological order
- Include reply context if relevant

**API alternatives (if Twitter API unavailable):**
- Use Bright Data Twitter scraper (via mcp skill)
- Scrape page HTML directly
- Use third-party Twitter API alternatives
- Try nitter instances as fallback

---

### 2. Tweet Metadata Extraction

**For each tweet in thread:**
- Tweet ID
- Author username and display name
- Tweet text
- Timestamp
- Engagement metrics (likes, retweets, replies, views)
- Media attachments (images, videos, links)
- Quoted tweets
- @mentions
- #hashtags

**Thread-level metadata:**
- Total tweets in thread
- Total engagement (sum across all tweets)
- Thread start time
- Thread end time (if completed)

---

### 3. Author Information

**Extract author details:**
- Username (@handle)
- Display name
- Bio
- Profile URL
- Follower count
- Following count
- Verified status
- Profile picture URL
- Location (if listed)
- Website (if listed)

**Add to people array:**
```json
{
  "name": "Author Display Name",
  "role": "author",
  "title": "Title from bio",
  "company": "Company from bio",
  "social": {
    "twitter": "@authorhandle",
    "linkedin": "[extracted from bio or pinned tweet]",
    "email": null,
    "website": "https://authorwebsite.com"
  },
  "context": "Twitter thread author discussing [topic]",
  "importance": "primary"
}
```

---

### 4. Thread Reconstruction

**Combine thread into coherent content:**

**Concatenate tweets:**
- Join all tweets in chronological order
- Preserve paragraph breaks
- Mark tweet boundaries if needed

**Example:**
```
Tweet 1/10: Let me explain why GPT-4 is such a big deal 🧵

Tweet 2/10: First, the multimodal capabilities mean it can process both text and images natively. This opens up entirely new use cases.

Tweet 3/10: Second, the reasoning improvements are substantial. On the bar exam, it scores in the 90th percentile vs GPT-3.5's 10th percentile.

[...continue for all tweets...]
```

**Full text with markers:**
```
[1/10] Let me explain why GPT-4 is such a big deal 🧵

[2/10] First, the multimodal capabilities...

[3/10] Second, the reasoning improvements...
```

**Clean text (no markers):**
```
Let me explain why GPT-4 is such a big deal. First, the multimodal capabilities mean it can process both text and images natively. This opens up entirely new use cases. Second, the reasoning improvements are substantial...
```

---

### 5. Link Extraction

**Extract all URLs from thread:**

**Types of links:**
- External links (articles, websites)
- Twitter media (images, videos)
- Quoted tweets
- Reply context tweets
- Shortened URLs (expand t.co links)

**For each link:**
```json
{
  "url": "https://openai.com/blog/gpt-4",
  "domain": "openai.com",
  "title": "GPT-4 announcement",
  "description": "Linked in tweet 4/10 when discussing capabilities",
  "link_type": "reference",
  "context": "Primary source for claims about GPT-4 performance",
  "position": "middle"
}
```

---

### 6. Mention and Hashtag Extraction

**Extract @mentions:**
- All mentioned users
- Context of mention (quoting, referencing, replying)
- Add mentioned people to people array if relevant

**Example:**
```json
{
  "name": "Sam Altman",
  "role": "mentioned",
  "title": "CEO of OpenAI",
  "company": "OpenAI",
  "social": {
    "twitter": "@sama",
    "linkedin": null,
    "email": null,
    "website": null
  },
  "context": "Mentioned when discussing GPT-4 announcement",
  "importance": "secondary"
}
```

**Extract #hashtags:**
- Add to tags array
- Use for topic classification

---

### 7. Media Extraction

**Extract media attachments:**
- Images (URLs to Twitter media)
- Videos (URLs, may need special handling)
- GIFs

**Describe media in context:**
- Include image descriptions in excerpts
- Note if media is core to thread (e.g., charts, screenshots)

---

### 8. Gemini Analysis

**Send thread content to Gemini:**

**Extract:**
- Main topic/thesis of thread
- Key arguments and points
- People and companies mentioned (beyond @mentions)
- Technical concepts discussed
- Sentiment and tone

**Generate summaries:**

**Short (1-2 sentences):**
```
Thread explaining GPT-4's significance, covering multimodal capabilities, reasoning improvements, and implications for AI development.
```

**Medium (paragraph):**
```
Comprehensive thread breaking down why GPT-4 represents a major advancement in AI. Covers three main areas: multimodal capabilities enabling text+image processing, substantial reasoning improvements (90th percentile on bar exam), and architectural innovations. Author argues this shifts the landscape for AI applications and discusses potential use cases in education, healthcare, and software development. Includes benchmarks, examples, and links to official announcements.
```

**Long:**
```
[Detailed summary with all key points, arguments, evidence, and conclusions]
```

**Key excerpts:**
- Notable quotes from thread
- Important statistics or claims
- Surprising insights

---

### 9. Topic Classification

**Analyze thread for categorization:**
- Primary topic (AI, tech, politics, etc.)
- Secondary topics
- Extract hashtags as tags
- Identify keywords from content
- Map to newsletter sections

**Example:**
```json
{
  "primary_category": "AI",
  "secondary_categories": ["technology", "business"],
  "tags": [
    "gpt-4",
    "openai",
    "multimodal-ai",
    "ai-benchmarks",
    "language-models"
  ],
  "keywords": [
    "GPT-4",
    "multimodal",
    "reasoning",
    "bar exam",
    "benchmarks"
  ],
  "themes": [
    "AI capability improvements",
    "Multimodal AI emergence",
    "Real-world AI applications"
  ],
  "newsletter_sections": ["AI", "Headlines"]
}
```

---

### 10. Engagement Analysis

**Analyze engagement metrics:**
- Total likes across thread
- Total retweets
- Total replies
- Views (if available)
- Engagement rate

**Use for trending potential:**
- High engagement (10k+ likes): High trending potential
- Medium engagement (1k-10k): Medium
- Low engagement (<1k): Low

**Factor into importance score:**
- Viral threads (100k+ engagement): 9-10
- Popular threads (10k-100k): 7-9
- Moderate threads (1k-10k): 5-7
- Small threads (<1k): 3-5

---

### 11. Schema Population

**Populate content section:**
```json
{
  "content": {
    "id": "uuid-generated",
    "type": "tweet_thread",
    "title": "Why GPT-4 is a Big Deal (10-tweet thread)",
    "summary": {
      "short": "Thread explaining GPT-4's significance and implications",
      "medium": "[paragraph summary]",
      "long": "[comprehensive summary]"
    },
    "content": {
      "full_text": "[Full thread text concatenated]",
      "transcript": null,
      "excerpts": [
        "\"GPT-4 scores in the 90th percentile on the bar exam\"",
        "Key point about multimodal capabilities",
        "Surprising insight about use cases"
      ]
    },
    "metadata": {
      "source_url": "https://twitter.com/user/status/123456",
      "canonical_url": "https://twitter.com/user/status/123456",
      "published_date": "2024-01-15T14:30:00Z",
      "accessed_date": "2024-01-16T16:00:00Z",
      "language": "en",
      "word_count": 850,
      "read_time_minutes": 3,
      "author_platform": "twitter"
    }
  },
  "analysis": {
    "sentiment": "positive",
    "importance_score": 8,
    "novelty_score": 7,
    "controversy_score": 4,
    "relevance_to_audience": ["ai_researchers", "technologists", "general_tech"],
    "key_insights": [
      "GPT-4 represents step-change in reasoning ability",
      "Multimodal capabilities enable new applications",
      "Performance improvements validated on standardized tests"
    ],
    "related_content_ids": [],
    "trending_potential": "high"
  }
}
```

**Engagement metadata (custom field for tweets):**
```json
// Could add to extraction_metadata or custom field
"twitter_metrics": {
  "likes": 15000,
  "retweets": 3000,
  "replies": 500,
  "views": 250000,
  "thread_length": 10
}
```

---

## Error Handling

**Private/protected account:**
```
❌ Tweet is from private account
→ Cannot access content
→ Return minimal metadata (author handle, tweet ID)
→ Confidence: 0.1
→ Warning: "Tweet is from protected account, content unavailable"
```

**Deleted tweet:**
```
❌ Tweet has been deleted
→ Check archive.org or cached versions
→ If unavailable, return error
→ Warning: "Tweet no longer available"
```

**Rate limiting:**
```
⚠️ Twitter API rate limit reached
→ Back off and retry
→ Use alternative scraping methods
→ May reduce data quality
→ Warning: "Rate limited, using fallback extraction"
```

**Thread not fully loaded:**
```
⚠️ Could not fetch entire thread
→ Extract partial thread
→ Note: "Partial thread (X of Y tweets)"
→ Lower confidence score
```

---

## Output Example

**Successful extraction:**
```
✅ Extracted Twitter thread
🐦 Author: @username (Display Name)
📝 Thread: 10 tweets, 850 words
💬 Engagement: 15k likes, 3k retweets, 500 replies
🔗 Links: 5
👥 Mentions: 3
#️⃣ Hashtags: 4
🎯 Confidence: 0.85
🔥 Trending potential: High
```

**Partial extraction:**
```
⚠️ Extracted Twitter thread (partial)
🐦 Author: @username
📝 Thread: 6 of 10 tweets (some tweets unavailable)
🔗 Links: 3
🎯 Confidence: 0.60
⚠️ Warning: Could not fetch complete thread
```

---

**This workflow handles Twitter/X thread extraction with engagement metrics and thread reconstruction.**
