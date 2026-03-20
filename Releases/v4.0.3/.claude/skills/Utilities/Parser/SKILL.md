---
name: parser
description: "Extract structured JSON from URLs, files, videos, PDFs with entity extraction, collision detection, and batch support. USE WHEN parse, extract, URL, transcript, entities, JSON, batch, content, YouTube, PDF, article, newsletter, Twitter, browser extension, collision detection, detect content type."
---

## Customization

Check for user customizations at `~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/Parser/` — load and apply if present, otherwise use defaults.

## Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the WORKFLOWNAME workflow in the Parser skill to ACTION"}' \
  > /dev/null 2>&1 &
```

Output: `Running the **WorkflowName** workflow in the **Parser** skill to ACTION...`

# Parser

Parse any content into structured JSON with entity extraction and collision detection.

## Workflow Routing

### Core Workflows

| Workflow | Trigger | File |
|----------|---------|------|
| **ParseContent** | "parse this", "extract from URL" | `Workflows/ParseContent.md` |
| **BatchEntityExtractionGemini3** | "batch extract", "Gemini extraction" | `Workflows/BatchEntityExtractionGemini3.md` |
| **CollisionDetection** | "check duplicates", "entity collision" | `Workflows/CollisionDetection.md` |
| **DetectContentType** | "what type is this", "auto-detect" | `Workflows/DetectContentType.md` |

### Content Type Workflows

| Workflow | Trigger | File |
|----------|---------|------|
| **ExtractNewsletter** | "parse newsletter" | `Workflows/ExtractNewsletter.md` |
| **ExtractTwitter** | "parse tweet", "X thread" | `Workflows/ExtractTwitter.md` |
| **ExtractArticle** | "parse article", "web page" | `Workflows/ExtractArticle.md` |
| **ExtractYoutube** | "parse YouTube", "video transcript" | `Workflows/ExtractYoutube.md` |
| **ExtractPdf** | "parse PDF", "document" | `Workflows/ExtractPdf.md` |
| **ExtractBrowserExtension** | "analyze extension", "browser extension security" | `Workflows/ExtractBrowserExtension.md` |

**Validation checkpoint:** Run CollisionDetection before parsing to avoid duplicate work.

## Core Paths

- **Schema:** `Schema/content-schema.json`
- **Entity Index:** `entity-index.json`
- **Output:** `Output/`
- **Reference:** `EntitySystem.md` — entity extraction, GUIDs, collision detection

## Examples

**Parse YouTube video:**
```
User: "parse this YouTube video for the newsletter"
→ ExtractYoutube → transcript via YouTube API → entity extraction (people, companies, topics) → structured JSON
```

**Batch parse URLs:**
```
User: "parse these 5 URLs into JSON for the database"
→ ParseContent per URL → auto-detect content type → extract entities with collision detection → validated JSON per schema
```

**Check duplicates:**
```
User: "have I already parsed this article?"
→ CollisionDetection → check URL against entity-index.json → return existing ID or proceed with parsing
```

## Quick Reference

- **Output Format:** JSON validated against `Schema/content-schema.json`
- **Entity Types:** people, companies, links, sources, topics
- **Deduplication:** Via `entity-index.json` with UUID v4 GUIDs
