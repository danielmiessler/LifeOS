# Parse Content Workflow

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the ParseContent workflow in the Parser skill to parse URLs"}' \
  > /dev/null 2>&1 &
```

Running the **ParseContent** workflow in the **Parser** skill to parse URLs...

**Purpose:** Main orchestration workflow for parsing any URL into deterministic JSON schema

**When to Use:** User provides one or more URLs for parsing into structured data

---

## Workflow Steps

### 1. Input Validation

**Receive URL(s) from User:**
- Single URL: `"Parse this: https://example.com/article"`
- Multiple URLs: List of URLs (newline or comma-separated)
- Batch file: Path to text file with URLs (one per line)

**Validate inputs:**
- Check URL format (must be valid HTTP/HTTPS)
- Test URL accessibility (returns 200 OK)
- Detect redirects and follow to canonical URL
- Log any inaccessible URLs for error reporting

---

### 2. Content Type Detection

**Route to:** `Workflows/Detect-content-type.md`

**For each URL, determine:**
- YouTube video (youtube.com, youtu.be domains)
- PDF document (*.pdf extension or Content-Type: application/pdf)
- Twitter/X thread (twitter.com, x.com domains with /status/ path)
- Newsletter (substack.com, beehiiv.com, convertkit domains)
- Web article (generic HTML content)

**Detection priority:**
1. Domain-based detection (YouTube, Twitter, known platforms)
2. Extension-based detection (PDF, HTML)
3. Content-Type header inspection
4. Default to "generic" web article if uncertain

---

### 3. Specialized Extraction

**Route to appropriate extractor based on content type:**

**YouTube Videos** → `Workflows/extract/Youtube.md`
- Use Fabric `yt --transcript` for transcript
- Scrape page for metadata
- Extract channel information
- Parse description for links

**Web Articles** → `Workflows/extract/Article.md`
- Use Gemini Researcher for full content scraping
- Extract HTML metadata (OpenGraph, Twitter Cards, JSON-LD)
- Parse article body for entities and links
- Identify author, publication, date

**PDF Documents** → `Workflows/extract/Pdf.md`
- Extract text content from PDF
- Parse metadata (author, title, date)
- Use Gemini for entity extraction
- Handle citations and references

**Newsletter HTML** → `Workflows/extract/Newsletter.md`
- Parse HTML structure
- Extract individual sections/stories
- Identify links with context
- Preserve formatting for excerpts

**Twitter/X Threads** → `Workflows/extract/Twitter.md`
- Fetch entire thread
- Combine tweets into coherent content
- Extract @mentions and #hashtags
- Parse engagement metrics

**Generic Web Pages** → `Workflows/extract/Article.md` (fallback)
- Extract whatever content is available
- Lower confidence scores
- Flag as "generic" type

---

### 4. Gemini Analysis

**For ALL content types, use Gemini Researcher to extract:**

**People Extraction** (use `prompts/entity-extraction.md`)
- Identify all people mentioned
- Determine roles (author, subject, quoted, etc.)
- Find social handles and affiliations
- Assess importance (primary/secondary/minor)

**Company Extraction** (use `prompts/entity-extraction.md`)
- Identify all companies/organizations
- Extract domains and industry classifications
- Determine mention context (subject, competitor, partner, etc.)
- Assess sentiment (positive, neutral, negative, mixed)

**Topic Classification** (use `prompts/topic-classification.md`)
- Determine primary and secondary categories
- Extract tags, keywords, themes
- Map to newsletter sections (Headlines, Analysis, Tools, etc.)
- Identify audience relevance

**Summarization** (use `prompts/summarization.md`)
- Generate short summary (1-2 sentences, Twitter-length)
- Generate medium summary (paragraph, newsletter preview)
- Generate long summary (comprehensive, multiple paragraphs)
- Extract key excerpts/quotes

**Link Analysis** (use `prompts/link-analysis.md`)
- Identify all URLs in content
- Classify link types (reference, source, related, tool, etc.)
- Extract context for each link
- Determine position in content

**Content Analysis:**
- Overall sentiment (positive, neutral, negative, mixed)
- Importance score (1-10 scale)
- Novelty score (1-10, how new/unique)
- Controversy score (1-10, how polarizing)
- Trending potential (low, medium, high)
- Key insights extraction

---

### 5. Schema Population

**Generate UUID:**
- Create UUID v4 for content.id
- Ensures uniqueness across all parsed content

**Populate all 9 schema sections:**

1. **content**: Core content data
   - id, type, title
   - summary (short, medium, long)
   - content (full_text, transcript, excerpts)
   - metadata (URLs, dates, language, word count, platform)

2. **people**: Array of person objects
   - name, role, title, company
   - social handles (twitter, linkedin, email, website)
   - context and importance

3. **companies**: Array of company objects
   - name, domain, industry
   - context, mentioned_as, sentiment

4. **topics**: Topic classification
   - primary_category, secondary_categories
   - tags, keywords, themes
   - newsletter_sections

5. **links**: Array of link objects
   - url, domain, title, description
   - link_type, context, position

6. **sources**: Array of source objects
   - publication, author, url
   - published_date, source_type

7. **newsletter_metadata**: Newsletter-specific fields
   - issue_number (null for new content)
   - section (null, User assigns later)
   - position_in_section (null)
   - editorial_note (null, User adds later)
   - include_in_newsletter (false by default)
   - scheduled_date (null)

8. **analysis**: Automated analysis
   - sentiment
   - importance_score, novelty_score, controversy_score
   - relevance_to_audience (array)
   - key_insights (array)
   - related_content_ids (empty array initially)
   - trending_potential

9. **extraction_metadata**: Processing info
   - processed_date (current timestamp)
   - processing_method (gemini, fabric, hybrid)
   - confidence_score (0-1 scale)
   - warnings (array of any issues)
   - version ("1.0.0")

**Schema Invariants:**
- ALL fields must be present (use null for missing data)
- NEVER omit schema fields
- Arrays can be empty but must exist
- Dates in ISO 8601 format
- Confidence score reflects extraction quality

---

### 6. Validation

**Validate against schema:**
- Load `schema/content-schema.json`
- Validate populated data against schema
- Check all required fields present
- Verify data types match schema
- Ensure enums use allowed values

**If validation fails:**
- Log validation errors to warnings array
- Attempt to fix common issues (type coercion, etc.)
- Re-validate after fixes
- If still fails, output with low confidence score

**Quality checks:**
- Title non-empty
- At least short summary populated
- Source URL present
- Processed date valid
- UUID format correct

---

### 7. Output Generation

**Generate filename:**
- Format: `{timestamp}_{sanitized-title}.json`
- timestamp: `YYYYMMDD-HHMMSS` format
- sanitized-title: lowercase, replace spaces with hyphens, remove special chars
- Example: `20251114-153045_ai-breakthrough-anthropic.json`

**Write JSON file:**
- Pretty-print with 2-space indentation
- Location: Current directory (or User-specified path)
- UTF-8 encoding
- Ensure valid JSON syntax

**Output to User:**
```
✅ Parsed: [title]
📄 Output: [filename]
📊 Stats: [word_count] words, [people_count] people, [company_count] companies, [link_count] links
🎯 Confidence: [confidence_score]
⚠️ Warnings: [warnings if any]
```

---

### 8. Batch Processing

**For multiple URLs:**

**Sequential processing:**
1. Process URLs one at a time
2. Update User after each completion
3. Continue even if one fails
4. Collect all results and errors

**Progress updates:**
```
Processing 1 of 5: [URL]
✅ Completed: [filename]

Processing 2 of 5: [URL]
❌ Failed: [error message]

...
```

**Summary report:**
```
📊 Batch Processing Complete
✅ Successful: 4/5
❌ Failed: 1/5

Output files:
- 20251114-153045_article-1.json
- 20251114-153120_video-transcript.json
- 20251114-153215_research-paper.json
- 20251114-153305_twitter-thread.json

Failed:
- https://example.com/broken (404 Not Found)
```

---

## Error Handling

**Network errors:**
- Retry up to 3 times with exponential backoff
- Log error details to warnings
- Set confidence_score to 0.3 or lower
- Output partial data if any was extracted

**Parsing errors:**
- Fall back to generic extraction
- Populate what's possible
- Flag in warnings array
- Never fail completely - always output valid JSON

**Gemini API errors:**
- Retry with exponential backoff
- Fall back to simpler extraction methods
- Reduce confidence score accordingly
- Log API error in warnings

**Unsupported content:**
- Default to generic web page extraction
- Flag as "generic" content type
- Extract basic metadata (title, URL, date)
- Set confidence_score to 0.5 or lower

---

## Quality Assurance

**Before outputting JSON:**

1. **Completeness check:**
   - All 9 schema sections present
   - All required fields populated (or null)
   - No undefined values

2. **Data quality check:**
   - Title makes sense
   - Summaries coherent
   - People/companies have names
   - Links have valid URLs
   - Dates in ISO 8601 format

3. **Confidence assessment:**
   - High (0.8-1.0): Complete extraction, verified data
   - Medium (0.5-0.79): Most data extracted, some gaps
   - Low (0.0-0.49): Partial extraction, many uncertainties

4. **Warning review:**
   - Log any extraction issues
   - Note missing fields
   - Flag low-confidence extractions
   - Document any assumptions made

---

## Usage Examples

**Example 1: Single Article**
```
User: "Parse this article: https://anthropic.com/news/claude-3"

{DAIDENTITY.NAME}:
1. Detects web article type
2. Uses Gemini to scrape and analyze
3. Extracts entities, topics, links
4. Generates summaries
5. Populates schema
6. Validates and outputs JSON

✅ Parsed: Claude 3 Model Family Announcement
📄 Output: 20251114-153045_claude-3-announcement.json
📊 Stats: 2,500 words, 5 people, 3 companies, 12 links
🎯 Confidence: 0.92
```

**Example 2: YouTube Video**
```
User: "Parse this YouTube video: https://youtube.com/watch?v=abc123"

{DAIDENTITY.NAME}:
1. Detects YouTube video type
2. Uses Fabric for transcript extraction
3. Scrapes video metadata
4. Gemini analyzes transcript for entities
5. Extracts channel info and description links
6. Outputs JSON

✅ Parsed: AI Safety Interview with Anthropic CEO
📄 Output: 20251114-153120_ai-safety-interview.json
📊 Stats: 8,000 words (transcript), 3 people, 5 companies, 7 links
🎯 Confidence: 0.88
```

**Example 3: Batch Processing**
```
User: "Parse these 3 URLs:
- https://arxiv.org/pdf/2401.12345
- https://twitter.com/user/status/123
- https://newsletter.com/issue/42"

{DAIDENTITY.NAME}:
[Processes each sequentially]

📊 Batch Processing Complete
✅ Successful: 3/3

Output files:
- 20251114-153215_attention-all-you-need.json (PDF)
- 20251114-153340_ai-breakthrough-thread.json (Twitter)
- 20251114-153425_weekly-ai-news.json (Newsletter)
```

---

**This workflow handles all content parsing requests with deterministic JSON output.**
