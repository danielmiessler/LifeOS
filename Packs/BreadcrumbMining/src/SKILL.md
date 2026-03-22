---
name: BreadcrumbMining
description: Mine tagged insights from AI conversation history and capture breadcrumbs in real time. USE WHEN breadcrumb, mine conversations, mine insights, tag insight, eureka, remember this, search history, find breadcrumbs, conversation mining, tagged moments, capture insight, review breadcrumbs.
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/BreadcrumbMining/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# BreadcrumbMining

Your AI conversations are the richest record of your own thinking that has ever existed. This skill mines them for the insights you tagged — and the ones you didn't know you tagged.

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Mine** | "mine breadcrumbs", "search history", "find insights" | `Workflows/Mine.md` |
| **Tag** | "remember this", "eureka", "tag this", "breadcrumb" | `Workflows/Tag.md` |
| **Review** | "show breadcrumbs", "review tags", "recent insights" | `Workflows/Review.md` |

## Quick Reference

| Tool | Command | What It Does |
|------|---------|-------------|
| breadcrumb-mine | `bun Tools/breadcrumb-mine.ts --dir ~/chats/` | Scan conversation history for tagged insights |
| breadcrumb-tag | `bun Tools/breadcrumb-tag.ts "your insight"` | Capture a breadcrumb right now |
| breadcrumb-tag | `bun Tools/breadcrumb-tag.ts --review` | Show recent breadcrumbs |

**Supported formats:** ChatGPT JSON exports, Claude JSONL, Markdown/text files

## Examples

**Example 1: Mine ChatGPT history**
```
User: "mine my ChatGPT history for breadcrumbs"
→ Runs breadcrumb-mine on the ChatGPT export folder
→ Returns categorized index of tagged insights
→ Shows distribution: healing, flow, somatic, identity, etc.
```

**Example 2: Tag a live insight**
```
User: "eureka: the moat IS the corpus"
→ Runs breadcrumb-tag to capture it with timestamp
→ Auto-detects tag (eureka) and category (product-idea)
```

**Example 3: Review recent tags**
```
User: "show me my recent breadcrumbs"
→ Runs breadcrumb-tag --review
→ Shows last 30 days of captured insights
```
