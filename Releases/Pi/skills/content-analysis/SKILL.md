---
name: content-analysis
description: Content extraction and analysis for video, podcast, article, and YouTube content. Extracts structured insights, key takeaways, and wisdom. USE WHEN extract wisdom, content analysis, analyze content, insight report, analyze video, analyze podcast, extract insights, key takeaways, what did I miss, extract from YouTube.
metadata:
  author: pai
  version: 1.0.0
---

# Content Analysis Skill

## Extraction Framework

For any content (article, video, podcast, document):

1. **Summary** — 25-50 word overview
2. **Key Ideas** — 5-15 most important ideas
3. **Insights** — Non-obvious observations
4. **Quotes** — Notable direct quotes
5. **Habits** — Actionable habits mentioned
6. **Facts** — Surprising or important facts
7. **Recommendations** — Books, tools, resources mentioned
8. **Action Items** — What to do with this knowledge

## Output Format

```
## Content Analysis: [Title]

### One-Sentence Summary
[25-50 words]

### Key Ideas (ranked by importance)
1. [Idea]
2. [Idea]

### Insights
- [Non-obvious observation]

### Notable Quotes
> "Quote" — Speaker

### Action Items
- [ ] [Actionable takeaway]
```
