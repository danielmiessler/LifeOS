# Batch Entity Extraction with Gemini 3 Pro

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the BatchEntityExtractionGemini3 workflow in the Parser skill to extract entities"}' \
  > /dev/null 2>&1 &
```

Running the **BatchEntityExtractionGemini3** workflow in the **Parser** skill to extract entities...

## Purpose

Extract structured entities from multiple URLs in a single batch request using Gemini 3 Pro's 1M context window for better entity recognition, relationship extraction, and cross-article entity resolution.

## Gemini 3 Pro Advantages

**Superior Entity Recognition:**
- Better identification of people, companies, and concepts
- Deep reasoning for relationship extraction
- Multimodal capability (extract from PDFs, images in articles)

**Batch Processing:**
- 1M context window supports 10-50 URLs per request
- Faster than individual parsing
- Better cross-article entity resolution
- Consistent entity recognition across content

**Enhanced Accuracy:**
- More accurate role/affiliation detection
- Better sentiment analysis
- Improved topic classification
- Superior relationship mapping

## Integration with parser

This workflow ENHANCES the existing parser:
- **Current**: Uses GeminiResearcher for individual extraction
- **New**: Uses Gemini 3 Pro directly for batch entity accuracy
- **Schema**: Compatible with `schema/content-schema.json`
- **Collision Detection**: Integrates with `entity-index.json`
- **Output**: Deterministic JSON with GUIDs

## Workflow Steps

### 1. URL Collection

**Input**: List of URLs to parse

```bash
# Interactive collection
urls=(
  "https://example.com/article-1"
  "https://example.com/article-2"
  "https://example.com/article-3"
)

# Or from file
urls=$(cat urls.txt)

# Or from clipboard
urls=$(pbpaste)
```

**Pre-flight Check**: Check for already-parsed URLs

```typescript
import { isContentAlreadyParsed } from '../utils/collision-detection';

const entityIndex = JSON.parse(
  fs.readFileSync('~/.claude/skills/parser/entity-index.json', 'utf-8')
);

const newUrls = urls.filter(url => !isContentAlreadyParsed(url, entityIndex));
console.log(`Skipping ${urls.length - newUrls.length} already-parsed URLs`);
console.log(`Processing ${newUrls.length} new URLs`);
```

### 2. Content Fetching

**Option A: WebFetch (Simple)**
```bash
for url in "${urls[@]}"; do
  echo "=== URL: $url ==="
  curl -s "$url" | html2text
  echo "---"
done > batch-content.txt
```

**Option B: Firecrawl (Better Quality)**
```typescript
import { WebFetch } from '@tool/webfetch';

const contents = await Promise.all(
  urls.map(async (url) => {
    const content = await WebFetch(url, "Extract all text content");
    return {
      url,
      content
    };
  })
);
```

**Option C: Bright Data (Production)**
```typescript
import { scrapeAsMarkdown } from '~/.claude/skills/mcp/Providers/brightdata/actors';

const contents = await Promise.all(
  urls.map(async (url) => {
    const markdown = await scrapeAsMarkdown(url);
    return {
      url,
      markdown
    };
  })
);
```

### 3. Batch Context Assembly

Concatenate all content with clear separators for Gemini 3 Pro:

```typescript
function assembleBatchContext(contents: Array<{url: string, content: string}>): string {
  return contents.map((item, index) => `
===========================================
ARTICLE ${index + 1} of ${contents.length}
URL: ${item.url}
===========================================

${item.content}

`).join('\n\n');
}

const batchContext = assembleBatchContext(contents);
```

**Context Size Management:**
- Target: 500K-800K tokens per batch
- Limit: 10-50 URLs depending on article length
- If exceeds: Split into multiple batches

### 4. Gemini 3 Entity Extraction

**Prompt Template:**

```typescript
const extractionPrompt = `You are a precise entity extraction system. Extract structured entities from these ${contents.length} articles following the EXACT schema provided.

CRITICAL REQUIREMENTS:
1. Extract ALL mentioned people, companies, links, and sources
2. Use EXACT field names from schema
3. Maintain consistency across articles (same entity = same name)
4. Provide rich context and relationships
5. Return VALID JSON only (no markdown, no explanations)

SCHEMA (REQUIRED FIELDS):
{
  "articles": [
    {
      "url": "original URL",
      "content_id": "leave empty - will be assigned",
      "people": [
        {
          "id": "leave empty - will be assigned",
          "name": "Full Name",
          "role": "author|subject|mentioned|quoted|expert|interviewer|interviewee",
          "title": "Job title or null",
          "company": "Current company or null",
          "social": {
            "twitter": "@handle or null",
            "linkedin": "URL or null",
            "email": "email or null",
            "website": "URL or null"
          },
          "context": "Why mentioned in content",
          "importance": "primary|secondary|minor"
        }
      ],
      "companies": [
        {
          "id": "leave empty - will be assigned",
          "name": "Company Name",
          "domain": "domain.com or null",
          "industry": "AI|security|fintech|etc or null",
          "context": "Relevance in content",
          "mentioned_as": "subject|source|example|competitor|partner|acquisition|product|other",
          "sentiment": "positive|neutral|negative|mixed"
        }
      ],
      "links": [
        {
          "id": "leave empty - will be assigned",
          "url": "Full URL",
          "domain": "domain.com",
          "title": "Link text or null",
          "description": "What link points to or null",
          "link_type": "reference|source|related|tool|research|product|social|other",
          "context": "Why included",
          "position": "beginning|middle|end|sidebar|footer"
        }
      ],
      "sources": [
        {
          "id": "leave empty - will be assigned",
          "publication": "Publication name or null",
          "author": "Original author or null",
          "url": "Source URL or null",
          "published_date": "ISO 8601 date or null",
          "source_type": "research_paper|news_article|blog_post|twitter_thread|podcast|video|book|other"
        }
      ],
      "topics": {
        "primary_category": "AI|security|tech|business|science",
        "secondary_categories": ["related", "categories"],
        "tags": ["specific", "tags"],
        "keywords": ["important", "terms"],
        "themes": ["broader", "concepts"],
        "newsletter_sections": ["Headlines", "Analysis", "Tools", "AI", "Security"]
      }
    }
  ]
}

CROSS-ARTICLE ENTITY RESOLUTION:
- If same person appears in multiple articles, use IDENTICAL name
- If same company appears in multiple articles, use IDENTICAL name and domain
- Maintain entity consistency for better deduplication

ARTICLES TO PROCESS:
${batchContext}

Return ONLY the JSON object above with all entities extracted. No markdown, no explanations.`;
```

**Execute with Gemini 3 Pro:**

```bash
# Using llm CLI with Gemini 3 Pro
llm -m gemini-3-pro-preview "$(cat extraction-prompt.txt)" > raw-entities.json

# Or via API
curl https://generativelanguage.googleapis.com/v1/models/gemini-3-pro:generateContent \
  -H "Content-Type: application/json" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -d "{
    \"contents\": [{
      \"parts\": [{
        \"text\": \"$(cat extraction-prompt.txt)\"
      }]
    }],
    \"generationConfig\": {
      \"temperature\": 0.1,
      \"maxOutputTokens\": 8192
    }
  }" > raw-entities.json
```

**Temperature Settings:**
- `0.1` for deterministic entity extraction
- Low temperature = more consistent entity naming
- Better for deduplication

### 5. Collision Detection & GUID Assignment

Process the extracted entities and assign GUIDs:

```typescript
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

interface EntityIndex {
  version: string;
  last_updated: string;
  people: Record<string, any>;
  companies: Record<string, any>;
  links: Record<string, any>;
  sources: Record<string, any>;
}

function normalizeName(name: string): string {
  return name.toLowerCase().trim();
}

function normalizeUrl(url: string): string {
  return url.toLowerCase().trim().replace(/\/$/, '');
}

function normalizeDomain(domain: string | null): string | null {
  return domain ? domain.toLowerCase().trim() : null;
}

function getOrCreatePerson(
  personData: any,
  entityIndex: EntityIndex,
  contentId: string
): string {
  const canonicalId = normalizeName(personData.name);

  if (entityIndex.people[canonicalId]) {
    // Reuse existing GUID
    const existing = entityIndex.people[canonicalId];
    existing.occurrences++;
    if (!existing.content_ids.includes(contentId)) {
      existing.content_ids.push(contentId);
    }
    return existing.id;
  } else {
    // Create new GUID
    const personId = uuidv4();
    entityIndex.people[canonicalId] = {
      id: personId,
      name: personData.name,
      first_seen: new Date().toISOString(),
      occurrences: 1,
      content_ids: [contentId]
    };
    return personId;
  }
}

function getOrCreateCompany(
  companyData: any,
  entityIndex: EntityIndex,
  contentId: string
): string {
  const canonicalId = companyData.domain
    ? normalizeDomain(companyData.domain)!
    : normalizeName(companyData.name);

  if (entityIndex.companies[canonicalId]) {
    const existing = entityIndex.companies[canonicalId];
    existing.occurrences++;
    if (!existing.content_ids.includes(contentId)) {
      existing.content_ids.push(contentId);
    }
    return existing.id;
  } else {
    const companyId = uuidv4();
    entityIndex.companies[canonicalId] = {
      id: companyId,
      name: companyData.name,
      domain: companyData.domain,
      first_seen: new Date().toISOString(),
      occurrences: 1,
      content_ids: [contentId]
    };
    return companyId;
  }
}

function getOrCreateLink(
  linkData: any,
  entityIndex: EntityIndex,
  contentId: string
): string {
  const canonicalId = normalizeUrl(linkData.url);

  if (entityIndex.links[canonicalId]) {
    const existing = entityIndex.links[canonicalId];
    existing.occurrences++;
    if (!existing.content_ids.includes(contentId)) {
      existing.content_ids.push(contentId);
    }
    return existing.id;
  } else {
    const linkId = uuidv4();
    entityIndex.links[canonicalId] = {
      id: linkId,
      url: linkData.url,
      first_seen: new Date().toISOString(),
      occurrences: 1,
      content_ids: [contentId]
    };
    return linkId;
  }
}

function getOrCreateSource(
  sourceData: any,
  entityIndex: EntityIndex,
  contentId: string
): string {
  const canonicalId = sourceData.url
    ? normalizeUrl(sourceData.url)
    : `${normalizeName(sourceData.author || '')}|${normalizeName(sourceData.publication || '')}`;

  if (entityIndex.sources[canonicalId]) {
    const existing = entityIndex.sources[canonicalId];
    existing.occurrences++;
    if (!existing.content_ids.includes(contentId)) {
      existing.content_ids.push(contentId);
    }
    return existing.id;
  } else {
    const sourceId = uuidv4();
    entityIndex.sources[canonicalId] = {
      id: sourceId,
      url: sourceData.url,
      author: sourceData.author,
      publication: sourceData.publication,
      first_seen: new Date().toISOString(),
      occurrences: 1,
      content_ids: [contentId]
    };
    return sourceId;
  }
}

function processArticleEntities(
  articleData: any,
  entityIndex: EntityIndex
): any {
  // Generate content ID
  const contentId = uuidv4();

  // Process people
  const people = articleData.people.map((person: any) => ({
    ...person,
    id: getOrCreatePerson(person, entityIndex, contentId)
  }));

  // Process companies
  const companies = articleData.companies.map((company: any) => ({
    ...company,
    id: getOrCreateCompany(company, entityIndex, contentId)
  }));

  // Process links
  const links = articleData.links.map((link: any) => ({
    ...link,
    id: getOrCreateLink(link, entityIndex, contentId)
  }));

  // Process sources
  const sources = articleData.sources.map((source: any) => ({
    ...source,
    id: getOrCreateSource(source, entityIndex, contentId)
  }));

  return {
    ...articleData,
    content_id: contentId,
    people,
    companies,
    links,
    sources
  };
}

// Main processing
const entityIndexPath = '~/.claude/skills/parser/entity-index.json';
const entityIndex: EntityIndex = JSON.parse(fs.readFileSync(entityIndexPath, 'utf-8'));

const rawEntities = JSON.parse(fs.readFileSync('raw-entities.json', 'utf-8'));

const processedArticles = rawEntities.articles.map((article: any) =>
  processArticleEntities(article, entityIndex)
);

// Update entity index last_updated timestamp
entityIndex.last_updated = new Date().toISOString();

// Save updated entity index
fs.writeFileSync(entityIndexPath, JSON.stringify(entityIndex, null, 2));

console.log(`Processed ${processedArticles.length} articles`);
console.log(`Entity index updated with new entries`);
```

### 6. Schema Validation

Validate each processed article against the schema:

```typescript
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ strict: false });
addFormats(ajv);

const schema = JSON.parse(
  fs.readFileSync('~/.claude/skills/parser/schema/content-schema.json', 'utf-8')
);

const validate = ajv.compile(schema);

processedArticles.forEach((article: any, index: number) => {
  // Transform to full schema format
  const fullContent = {
    content: {
      id: article.content_id,
      type: "article", // Or detect from URL
      title: article.title || "Untitled",
      summary: {
        short: article.summary?.short || "",
        medium: article.summary?.medium || "",
        long: article.summary?.long || ""
      },
      content: {
        full_text: article.full_text || null,
        transcript: null,
        excerpts: article.excerpts || []
      },
      metadata: {
        source_url: article.url,
        canonical_url: article.url,
        published_date: article.published_date || null,
        accessed_date: new Date().toISOString(),
        language: "en",
        word_count: article.word_count || null,
        read_time_minutes: article.read_time_minutes || null,
        author_platform: "blog" // Or detect
      }
    },
    people: article.people,
    companies: article.companies,
    topics: article.topics,
    links: article.links,
    sources: article.sources,
    newsletter_metadata: {
      issue_number: null,
      section: null,
      position_in_section: null,
      editorial_note: null,
      include_in_newsletter: false,
      scheduled_date: null
    },
    analysis: {
      sentiment: "neutral",
      importance_score: 5,
      novelty_score: 5,
      controversy_score: 1,
      relevance_to_audience: ["general_tech"],
      key_insights: article.key_insights || [],
      related_content_ids: [],
      trending_potential: "medium"
    },
    extraction_metadata: {
      processed_date: new Date().toISOString(),
      processing_method: "gemini",
      confidence_score: 0.9,
      warnings: [],
      version: "1.0.0"
    }
  };

  const valid = validate(fullContent);

  if (!valid) {
    console.error(`Article ${index + 1} validation failed:`, validate.errors);
  } else {
    // Save validated content
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `~/.claude/skills/parser/output/${timestamp}_batch-${index + 1}.json`;
    fs.writeFileSync(filename, JSON.stringify(fullContent, null, 2));
    console.log(`Saved: ${filename}`);
  }
});
```

### 7. Entity Index Update

The entity index is automatically updated during step 5. Verify the update:

```bash
# Check entity counts
cat ~/.claude/skills/parser/entity-index.json | jq '{
  people_count: (.people | length),
  companies_count: (.companies | length),
  links_count: (.links | length),
  sources_count: (.sources | length),
  last_updated: .last_updated
}'
```

## Command-Line Integration

### Complete Batch Processing Script

```bash
#!/usr/bin/env bash
# batch-extract.sh - Batch entity extraction with Gemini 3 Pro

set -euo pipefail

# Check for URL input
if [ $# -eq 0 ]; then
  echo "Usage: $0 <url1> <url2> ... <urlN>"
  echo "   or: cat urls.txt | xargs $0"
  exit 1
fi

URLS=("$@")
SKILL_DIR="$HOME/.claude/skills/parser"
OUTPUT_DIR="$SKILL_DIR/output"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

echo "Processing ${#URLS[@]} URLs..."

# Fetch content
echo "Fetching content..."
BATCH_CONTENT=""
for i in "${!URLS[@]}"; do
  url="${URLS[$i]}"
  echo "Fetching: $url"
  content=$(curl -s "$url" | html2text)
  BATCH_CONTENT+="
===========================================
ARTICLE $((i+1)) of ${#URLS[@]}
URL: $url
===========================================

$content

"
done

# Create extraction prompt
cat > /tmp/extraction-prompt.txt <<EOF
You are a precise entity extraction system. Extract structured entities from these ${#URLS[@]} articles following the EXACT schema provided.

[... full prompt from step 4 ...]

ARTICLES TO PROCESS:
$BATCH_CONTENT

Return ONLY the JSON object with all entities extracted. No markdown, no explanations.
EOF

# Extract with Gemini 3 Pro
echo "Extracting entities with Gemini 3 Pro..."
llm -m gemini-3-pro-preview "$(cat /tmp/extraction-prompt.txt)" > /tmp/raw-entities.json

# Process entities and assign GUIDs
echo "Processing entities and assigning GUIDs..."
bun run "$SKILL_DIR/utils/process-batch.ts" /tmp/raw-entities.json

echo "Batch processing complete!"
echo "Results saved to: $OUTPUT_DIR"
```

### TypeScript CLI Tool

```typescript
#!/usr/bin/env bun
// utils/process-batch.ts

import { processArticleEntities } from './collision-detection';
import fs from 'fs';

const rawEntitiesPath = process.argv[2];
if (!rawEntitiesPath) {
  console.error('Usage: process-batch.ts <raw-entities.json>');
  process.exit(1);
}

const entityIndexPath = `${process.env.HOME}/.claude/skills/parser/entity-index.json`;
const entityIndex = JSON.parse(fs.readFileSync(entityIndexPath, 'utf-8'));

const rawEntities = JSON.parse(fs.readFileSync(rawEntitiesPath, 'utf-8'));

const processedArticles = rawEntities.articles.map((article: any) =>
  processArticleEntities(article, entityIndex)
);

// Update entity index
entityIndex.last_updated = new Date().toISOString();
fs.writeFileSync(entityIndexPath, JSON.stringify(entityIndex, null, 2));

// Save processed articles
processedArticles.forEach((article: any, index: number) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const filename = `${process.env.HOME}/.claude/skills/parser/output/${timestamp}_batch-${index + 1}.json`;
  fs.writeFileSync(filename, JSON.stringify(article, null, 2));
  console.log(`Saved: ${filename}`);
});

console.log(`Processed ${processedArticles.length} articles`);
```

## Performance Characteristics

**Single Article (Current):**
- Time: ~30-60 seconds per URL
- Cost: 1 API call per URL
- Quality: Good entity recognition

**Batch Processing (Gemini 3 Pro):**
- Time: ~60-120 seconds for 10-50 URLs
- Cost: 1 API call for entire batch
- Quality: Better cross-article entity resolution
- Speedup: 10-50x faster
- Cost Savings: 90-98% reduction

**Example: 20 URLs**
- Old: 20 API calls × 45s = 15 minutes
- New: 1 API call × 90s = 90 seconds
- Speedup: 10x faster
- Cost: 95% cheaper

## Best Practices

**Batch Size:**
- Start small: 5-10 URLs for testing
- Optimal: 10-20 URLs per batch
- Maximum: 50 URLs (stay under 1M context limit)

**Entity Consistency:**
- Use low temperature (0.1) for deterministic output
- Include cross-article resolution instructions in prompt
- Review first batch output for consistency

**Error Handling:**
- Validate schema compliance before saving
- Log validation errors for manual review
- Implement retry logic for API failures

**Incremental Processing:**
- Check entity index before fetching content
- Skip already-parsed URLs
- Process new URLs only

**Quality Control:**
- Spot-check first batch manually
- Verify GUID assignments are correct
- Ensure entity deduplication is working

## Troubleshooting

**Issue: Context too large**
- Solution: Reduce batch size or use excerpts instead of full content

**Issue: Inconsistent entity naming**
- Solution: Lower temperature, add more examples to prompt

**Issue: Missing entities**
- Solution: Adjust extraction prompt to be more explicit about requirements

**Issue: GUID collisions**
- Solution: Check canonical ID normalization logic

**Issue: Schema validation fails**
- Solution: Review required fields, ensure all are present

## Future Enhancements

1. **Automatic Batch Sizing**: Dynamically determine optimal batch size based on content length
2. **Parallel Batch Processing**: Process multiple batches in parallel
3. **Entity Enrichment**: Fetch additional data (LinkedIn profiles, company info)
4. **Fuzzy Deduplication**: Detect similar but not identical entities
5. **Knowledge Graph Visualization**: Graph relationships between entities
6. **Newsletter Integration**: Auto-suggest newsletter sections based on topics
