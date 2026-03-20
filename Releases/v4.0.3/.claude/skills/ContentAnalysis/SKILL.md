---
name: content-analysis
description: "Content extraction and analysis — wisdom extraction from videos, podcasts, articles, and YouTube. USE WHEN extract wisdom, content analysis, analyze content, insight report, analyze video, analyze podcast, extract insights, key takeaways, extract from YouTube."
---

# ContentAnalysis

Routes content extraction and analysis requests to the appropriate workflow.

## Workflow Routing

| Request Pattern | Route To |
|---|---|
| Extract wisdom, content analysis, insight report, analyze content | `ExtractWisdom/SKILL.md` |

## Examples

```
User: "extract wisdom from this YouTube video"
--> Route to ExtractWisdom/SKILL.md

User: "analyze this podcast and give me key takeaways"
--> Route to ExtractWisdom/SKILL.md

User: "what are the insights from this article?"
--> Route to ExtractWisdom/SKILL.md
```
