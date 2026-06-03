---
name: knowledge
description: Typed knowledge graph management. Entities: People, Companies, Ideas, Projects, Resources, Events. Wikilinks for cross-referencing, search and retrieval patterns, harvest and ingestion workflows. USE WHEN knowledge, capture information, link concepts, knowledge graph, entity tracking, research notes, wikilinks, cross-reference, harvest knowledge.
metadata:
  author: pai
  version: 1.0.0
---

# Knowledge — Graph Management

## Entity Types

| Type | Fields | Example |
|------|--------|---------|
| **People** | Name, role, expertise, connections | [[Person:Ada Lovelace]] |
| **Companies** | Name, domain, products, stage | [[Company:OpenAI]] |
| **Ideas** | Concept, source, evidence, status | [[Idea:Recursive Self-Improvement]] |
| **Projects** | Goal, status, timeline, dependencies | [[Project:Pai-v5]] |
| **Resources** | Type, URL, summary, tags | [[Resource:Attention Paper]] |
| **Events** | Date, participants, outcomes | [[Event:2025 Summit]] |

## Wikilinks
Use [[Type:Name]] syntax to reference entities. The knowledge graph builds from these links automatically.

## Search & Retrieval
- **Exact**: Search by name or type
- **Fuzzy**: Search by description or tags
- **Related**: Follow wikilinks from an entity
- **Timeline**: Sort by creation or event date

## Harvest Workflow
1. **Identify** the source material
2. **Extract** entities and relationships
3. **Type** each entity correctly
4. **Link** with wikilinks to existing entities
5. **Verify** accuracy against source
6. **Store** with timestamp and provenance
