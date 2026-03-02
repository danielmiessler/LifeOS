# Content Type Detection Workflow

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the DetectContentType workflow in the Parser skill to detect content"}' \
  > /dev/null 2>&1 &
```

Running the **DetectContentType** workflow in the **Parser** skill to detect content...

**Purpose:** Detect content type from URL to route to appropriate extraction workflow

**When to Use:** Before parsing any URL, determine what type of content it is

---

## Detection Logic

### 1. Domain-Based Detection (Highest Priority)

**YouTube Videos:**
```
Domain matches:
- youtube.com
- youtu.be
- m.youtube.com

Path patterns:
- /watch?v=*
- /v/*
- /embed/*
- youtu.be/* (short links)

→ Type: "video"
→ Route to: Workflows/ExtractYoutube.md
```

**Twitter/X Threads:**
```
Domain matches:
- twitter.com
- x.com
- mobile.twitter.com

Path patterns:
- /*/status/* (individual tweet or thread start)
- /i/web/status/* (web interface)

→ Type: "tweet_thread"
→ Route to: Workflows/ExtractTwitter.md
```

**Newsletter Platforms:**
```
Domain matches:
- *.substack.com
- *.beehiiv.com
- *.convertkit.com
- *.ghost.io
- buttondown.email

→ Type: "newsletter"
→ Route to: Workflows/ExtractNewsletter.md
```

**ArXiv Papers:**
```
Domain matches:
- arxiv.org

Path patterns:
- /pdf/* (direct PDF link)
- /abs/* (abstract page, extract PDF link)

→ Type: "pdf"
→ Route to: Workflows/ExtractPdf.md
```

---

### 2. Extension-Based Detection

**PDF Documents:**
```
URL ends with:
- .pdf

Content-Type header:
- application/pdf

→ Type: "pdf"
→ Route to: Workflows/ExtractPdf.md
```

---

### 3. Content-Type Header Detection

**After fetching URL, check Content-Type:**

```typescript
If Content-Type === "application/pdf":
  → Type: "pdf"
  → Route to: Workflows/ExtractPdf.md

If Content-Type === "video/mp4" or similar:
  → Type: "video"
  → Extract if possible, otherwise flag as unsupported

If Content-Type === "text/html":
  → Continue to HTML analysis (step 4)
```

---

### 4. HTML Metadata Analysis

**For HTML content, check OpenGraph and meta tags:**

**Video Detection:**
```html
<meta property="og:type" content="video">
<meta property="og:video:url" ...>

→ Check if YouTube embed → Route to YouTube workflow
→ Otherwise: Extract video URL, attempt download
```

**Article Detection:**
```html
<meta property="og:type" content="article">
<meta name="article:published_time" ...>
<meta name="article:author" ...>

→ Type: "article"
→ Route to: Workflows/ExtractArticle.md
```

**Podcast Detection:**
```html
<meta property="og:type" content="music.song"> (often used for podcasts)
Links to .mp3, .m4a audio files

→ Type: "podcast"
→ Note: Transcript extraction may not be available
→ Route to: Workflows/ExtractArticle.md (extract show notes)
```

---

### 5. Default Fallback

**If no specific type detected:**
```
→ Type: "generic"
→ Route to: Workflows/ExtractArticle.md
→ Flag: Lower confidence score
→ Extract whatever content is available
```

---

## Detection Algorithm

```typescript
function detectContentType(url: string): ContentType {
  // 1. Parse URL
  const parsedUrl = new URL(url);
  const domain = parsedUrl.hostname;
  const path = parsedUrl.pathname;
  const extension = path.split('.').pop()?.toLowerCase();

  // 2. Domain-based detection (highest priority)
  if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
    return 'video';
  }

  if (domain.includes('twitter.com') || domain.includes('x.com')) {
    if (path.includes('/status/')) {
      return 'tweet_thread';
    }
  }

  if (domain.includes('substack.com') ||
      domain.includes('beehiiv.com') ||
      domain.includes('convertkit.com') ||
      domain.includes('ghost.io') ||
      domain.includes('buttondown.email')) {
    return 'newsletter';
  }

  if (domain.includes('arxiv.org')) {
    return 'pdf';
  }

  // 3. Extension-based detection
  if (extension === 'pdf') {
    return 'pdf';
  }

  // 4. Fetch and check Content-Type
  const response = await fetch(url, { method: 'HEAD' });
  const contentType = response.headers.get('content-type');

  if (contentType?.includes('application/pdf')) {
    return 'pdf';
  }

  if (contentType?.includes('text/html')) {
    // 5. HTML metadata analysis
    const html = await fetch(url).then(r => r.text());
    const ogType = extractMetaTag(html, 'og:type');

    if (ogType === 'video') {
      return 'video';
    }

    if (ogType === 'article') {
      return 'article';
    }

    if (ogType === 'music.song') {
      return 'podcast';
    }
  }

  // 6. Default fallback
  return 'generic';
}
```

---

## Routing Map

**Content Type → Extraction Workflow**

```
video          → Workflows/ExtractYoutube.md
tweet_thread   → Workflows/ExtractTwitter.md
newsletter     → Workflows/ExtractNewsletter.md
pdf            → Workflows/ExtractPdf.md
article        → Workflows/ExtractArticle.md
podcast        → Workflows/ExtractArticle.md (extract show notes)
generic        → Workflows/ExtractArticle.md (fallback)
```

---

## Examples

**Example 1: YouTube Video**
```
Input: https://youtube.com/watch?v=abc123

Detection:
1. Domain = "youtube.com" → MATCH
2. Path = "/watch?v=abc123" → MATCH pattern
3. Type = "video"
4. Route to: Workflows/ExtractYoutube.md
```

**Example 2: Substack Newsletter**
```
Input: https://newsletter.substack.com/p/weekly-update

Detection:
1. Domain = "newsletter.substack.com" → MATCH
2. Type = "newsletter"
3. Route to: Workflows/ExtractNewsletter.md
```

**Example 3: ArXiv PDF**
```
Input: https://arxiv.org/pdf/2401.12345.pdf

Detection:
1. Domain = "arxiv.org" → MATCH
2. Path includes "/pdf/" → MATCH
3. Extension = ".pdf" → MATCH
4. Type = "pdf"
5. Route to: Workflows/ExtractPdf.md
```

**Example 4: Generic Blog Post**
```
Input: https://randomblog.com/post/interesting-article

Detection:
1. Domain = "randomblog.com" → No match
2. Extension = None
3. Fetch Content-Type = "text/html"
4. Check OpenGraph: og:type = "article" → MATCH
5. Type = "article"
6. Route to: Workflows/ExtractArticle.md
```

**Example 5: Unknown Content**
```
Input: https://unknown-site.com/page

Detection:
1. Domain → No match
2. Extension → No match
3. Content-Type = "text/html"
4. OpenGraph → No article type found
5. Type = "generic" (fallback)
6. Route to: Workflows/ExtractArticle.md
7. Flag: Lower confidence score
```

---

## Error Handling

**If URL is inaccessible:**
- Return error with 404/403/500 status
- Log to extraction_metadata.warnings
- Attempt to use archive.org cached version
- If archive fails, return partial data with low confidence

**If Content-Type is ambiguous:**
- Default to "generic" type
- Route to article extraction (most versatile)
- Set confidence_score to 0.5 or lower
- Log ambiguity in warnings

**If redirect chain is too long:**
- Follow up to 5 redirects
- Use final destination URL for detection
- Log redirect chain in warnings
- Update canonical_url in metadata

---

**This workflow ensures accurate content type detection for optimal extraction routing.**
