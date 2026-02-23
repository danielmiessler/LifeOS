# Entity System Reference

This document describes the Parser skill's entity extraction, GUID assignment, and collision detection system.

---

## Key Features

### 1. Deterministic JSON Schema
- **Version:** 1.0.0
- **Schema:** `Schema/content-schema.json`
- **Validation:** All outputs validated against schema
- **Required Sections:** 9 top-level sections (content, people, companies, topics, links, sources, newsletter_metadata, analysis, extraction_metadata)

### 2. Entity Collision Detection
- **Purpose:** Prevent duplicate entities across parsed content
- **Entity Index:** `entity-index.json` tracks all people, companies, links, sources
- **GUID Assignment:** Every entity gets a UUID v4 for deduplication
- **Canonical Identifiers:** Normalized names/URLs for collision detection
- **Knowledge Graph:** Track entity occurrences and relationships across content

### 3. Content Deduplication
- **Before Parsing:** Check if URL already exists in entity index
- **Skip Duplicates:** Avoid re-parsing already processed content
- **Reference Existing:** Return existing content ID if already parsed

### 4. Multi-Source Entity Extraction
- **Gemini Researcher:** Primary extraction agent for comprehensive analysis
- **WebFetch:** Content retrieval from URLs
- **Hybrid Processing:** Combine automated extraction with manual validation

---

## Entity GUIDs

All entities include required GUID fields:

```json
{
  "people": [
    {
      "id": "uuid-v4-here",
      "name": "Example Person",
      "role": "author"
    }
  ],
  "companies": [
    {
      "id": "uuid-v4-here",
      "name": "Anthropic",
      "domain": "anthropic.com"
    }
  ],
  "links": [
    {
      "id": "uuid-v4-here",
      "url": "https://example.com"
    }
  ],
  "sources": [
    {
      "id": "uuid-v4-here",
      "publication": "ArXiv"
    }
  ]
}
```

---

## Collision Detection Overview

**Full documentation:** `Workflows/CollisionDetection.md`

**Quick Overview:**
1. Load entity index before parsing
2. For each extracted entity, compute canonical identifier
3. Check if canonical ID exists in index
4. If exists: reuse existing GUID
5. If new: generate new GUID and add to index
6. Update index after parsing

**Benefits:**
- Build knowledge graph over time
- Track entity mentions across content
- Prevent duplicate database entries
- Enable relationship queries ("what else mentions Anthropic?")

---

## Utilities

- **`Utils/collision-detection.ts`:** TypeScript collision detection utilities
- **`processContentEntities()`:** Assign GUIDs to all extracted entities
- **`isUrlAlreadyParsed()`:** Check if URL already processed
- **`getExistingContentId()`:** Get content ID for parsed URL

---

## Related Files

- **Schema:** `Schema/content-schema.json`, `Schema/schema.ts`
- **Library:** `Lib/parser.ts`, `Lib/validators.ts`
- **Entity Index:** `entity-index.json`
- **Prompts:** `Prompts/entity-extraction.md`, `Prompts/summarization.md`
