---
name: Parser
description: Parse URLs, files, videos to JSON. USE WHEN parse, extract, URL, transcript, entities, JSON, batch, content, YouTube, PDF, article. SkillSearch('parser') for docs.
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/skills/PAI/USER/SKILLCUSTOMIZATIONS/Parser/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.


## 🚨 MANDATORY: Voice Notification (REQUIRED BEFORE ANY ACTION)

**You MUST send this notification BEFORE doing anything else when this skill is invoked.**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:8888/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the WORKFLOWNAME workflow in the Parser skill to ACTION"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running the **WorkflowName** workflow in the **Parser** skill to ACTION...
   ```

**This is not optional. Execute this curl command immediately upon skill invocation.**

# Parser

Parse any content into structured JSON with entity extraction and collision detection.

---


## Workflow Routing

**When executing a workflow, output this notification:**

```
Running the **WorkflowName** workflow in the **Parser** skill to ACTION...
```

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

### Security Workflows

| Workflow | Trigger | File |
|----------|---------|------|
| **ExtractBrowserExtension** | "analyze extension", "browser extension security" | `Workflows/ExtractBrowserExtension.md` |

---

## Context Files

- **EntitySystem.md** - Entity extraction, GUIDs, collision detection reference

---

## Core Paths

- **Schema:** `Schema/content-schema.json`
- **Entity Index:** `entity-index.json`
- **Output:** `Output/`

---

## Examples

**Example 1: Parse YouTube video**
```
User: "parse this YouTube video for the newsletter"
--> Invokes Youtube workflow
--> Extracts transcript via YouTube API
--> Identifies people, companies, topics mentioned
--> Returns structured JSON with entities and key insights
```

**Example 2: Batch parse article URLs**
```
User: "parse these 5 URLs into JSON for the database"
--> Invokes ParseContent workflow for each
--> Detects content type for each URL
--> Extracts entities with collision detection
--> Assigns GUIDs, checks for duplicates
--> Returns validated JSON per schema
```

**Example 3: Check for duplicate content**
```
User: "have I already parsed this article?"
--> Invokes CollisionDetection workflow
--> Checks URL against entity index
--> Returns existing content ID if found
--> Skips re-parsing, saves time
```

---

## Quick Reference

- **Schema Version:** 1.0.0
- **Output Format:** JSON validated against `Schema/content-schema.json`
- **Entity Types:** people, companies, links, sources, topics
- **Deduplication:** Via entity-index.json with UUID v4 GUIDs
