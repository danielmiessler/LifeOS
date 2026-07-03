---
name: pai-knowledge
description: "PAI v5.0 Knowledge management — typed knowledge graph with People, Companies, Ideas. USE WHEN adding, searching, or updating knowledge entities, harvesting wisdom, or checking cross-references. NOT FOR task memory (use WORK/) or simple Q&A."
version: 5.0.0
author: PAI v5.0 → Hermes Port
license: MIT
metadata:
  hermes:
    tags: [pai, knowledge, memory, graph, entities]
    related_skills: [pai-algorithm, pai-telos]
---

<!-- Voice notification — fire-and-forget on invocation -->
```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the pai-knowledge skill"}' \
  > /dev/null 2>&1 &
```


# Knowledge — Typed Knowledge Graph (Hermes Port)

## Overview

The Knowledge system manages a typed graph of entities — People, Companies, Ideas, Research, Blogs — with cross-references via wikilinks. This is the curated memory layer that persists across sessions.

## Entity Types

| Type | Directory | What Goes Here |
|------|-----------|----------------|
| People | `MEMORY/KNOWLEDGE/People/` | Individuals you interact with or reference |
| Companies | `MEMORY/KNOWLEDGE/Companies/` | Organizations, products, services |
| Ideas | `MEMORY/KNOWLEDGE/Ideas/` | Concepts, theories, frameworks |
| Research | `MEMORY/KNOWLEDGE/Research/` | Papers, articles, investigations |
| Blogs | `MEMORY/KNOWLEDGE/Blogs/` | Regular content sources |

## Entity Format (Markdown + Frontmatter)

```markdown
---
type: People|Companies|Ideas|Research|Blogs
related: [slug-of-related-entity]
tags: [tag1, tag2]
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

# Entity Name

Key information about this entity. Use [[Wikilinks]] to reference other entities.

## Key Facts

- Fact 1
- Fact 2

## Notes

Freeform contextual notes.

## References

- Source URLs or citations
```

## Cross-Reference Types

| Type | Syntax | How It Works |
|------|--------|--------------|
| Wikilink | `[[Page Name]]` | Links to another entity by name |
| Related | `related: [slug1, slug2]` | Declared in frontmatter |
| Tag | `tags: [tag1, tag2]` | Tag-based grouping |
| Backlink | (computed) | Reverse index from wikilinks |

## Workflow Routing

| Trigger | Workflow |
|---------|----------|
| "search knowledge" | Search for entities matching a query |
| "add entity" | Create a new knowledge entity |
| "harvest wisdom" | Extract wisdom from content into KNOWLEDGE/ |
| "link entities" | Add cross-references between entities |
| "knowledge status" | Show health dashboard |
| "check integrity" | Verify all wikilinks resolve |

## Gotchas

- **KNOWLEDGE is curated.** It is promoted from other memory tiers after review. Not every task output belongs here.
- **Append-mostly.** Don't delete old knowledge entries. Add new, superseding entries.
- **Wikilinks must resolve.** If you create a wikilink to `[[Company Name]]`, ensure the file exists. Orphaned links should be flagged.
- **Tags are a secondary index.** The primary index is wikilinks and directory structure.

## Execution Log

After every Knowledge operation:
```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"pai-knowledge","workflow":"WORKFLOW","status":"ok|error","duration_s":SECONDS}' >> ~/.hermes/pai/MEMORY/SKILLS/execution.jsonl
```
