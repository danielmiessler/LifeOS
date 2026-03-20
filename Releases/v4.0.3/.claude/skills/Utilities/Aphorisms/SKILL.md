---
name: aphorisms
description: "CRUD on {PRINCIPAL.NAME}'s curated aphorism collection — search by theme, add with metadata, research thinkers, match quotes to newsletter content. USE WHEN aphorism, quote, saying, find quote for newsletter, research thinker quotes, add aphorism, search aphorisms, find aphorism."
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/Aphorisms/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

## Workflow Routing

| Request Pattern | Route To |
|---|---|
| Find aphorism, quote for newsletter, match aphorism, suggest quote | `Workflows/FindAphorism.md` |
| Add quote, add aphorism, save quote, new aphorism | `Workflows/AddAphorism.md` |
| Research thinker, find quotes from, what did X say | `Workflows/ResearchThinker.md` |
| Search aphorisms, find quotes on, quotes about, quotes matching | `Workflows/SearchAphorisms.md` |

---

## Database

**Location:** `~/.claude/skills/aphorisms/Database/aphorisms.md`

**Collections:** Initial curated quotes (15), thinker sections (Hitchens, Deutsch, Harris, Spinoza, Feynman), theme index, newsletter usage history.

**Metadata per aphorism:** Full quote, author, theme tags, context/background, source reference, usage history.

**Themes:** Work Ethic & Excellence, Resilience & Strength, Learning & Education, Stoicism & Control, Risk & Action, Wisdom & Truth.

---

## Core Capabilities

1. **Intelligent Quote Matching** — Analyze content themes/tone, match against database, consider usage history, provide multiple options with rationale
2. **Thinker Research** — Deep research on key philosophers (Hitchens, Deutsch, Harris, Spinoza, Feynman) for TELOS-aligned quotes
3. **Database Management** — Add quotes with metadata, theme tagging, uniqueness validation, usage tracking
4. **Theme-Based Search** — Search by theme, keyword, or author with relevance sorting

**Validation checkpoint:** When adding quotes, verify attribution accuracy and check for duplicates before writing to database.

---

## Examples

**Find quote for newsletter:**
```
User: "I'm writing about overcoming setbacks in AI research. Find me an aphorism."
--> Extract themes: resilience, adversity, persistence, progress
--> Search database, check usage history
--> Return top 3 matches with rationale for each
```

**Add new quote:**
```
User: "Add: 'The cure for boredom is curiosity.' - Dorothy Parker"
--> Parse quote and author
--> Tag themes: curiosity, learning, passion
--> Add to database, update theme index, confirm
```

**Research thinker:**
```
User: "Research David Deutsch quotes about knowledge and optimism"
--> Research works (The Beginning of Infinity, The Fabric of Reality)
--> Extract relevant quotes with source attribution
--> Add to database, organize by theme
```

---

## Integration Points

- **Newsletter Content skill** — automatic aphorism suggestions, usage tracking for variety
- **Research skill** — web research for quote verification and source attribution
- **Writing skill** — blog post and article quote recommendations

---

## Best Practices

- **Match tone** of quote to content being written
- **Check usage history** to avoid repetition across newsletters
- **Verify attribution** — prefer primary sources (books/speeches)
- **Quality over quantity** — curate, don't just collect
- **TELOS alignment** — focus on wisdom, rationality, truth-seeking themes
