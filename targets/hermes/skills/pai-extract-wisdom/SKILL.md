---
name: pai-extract-wisdom
description: "Content-adaptive wisdom extraction from any source. 5 depth levels from Instant to Comprehensive. Always includes contrarian perspectives and spicy takes."
version: 5.0.0
author: PAI v5.0 → Hermes Port
use_when: "You need deep wisdom extraction from articles, papers, books, talks, or any content — not just summarization but surprising insights, contrarian views, actionable takeaways, and the 'spicy' angle."
not_for: "Simple summarization (use pai-fabric/sumarize); extracting structured data points; content that needs verbatim quotation only."
tags: [extraction, wisdom, analysis, insights, contrarian, deep-dive]
---

# pai-extract-wisdom: Content-Adaptive Wisdom Extraction

## Workflow Routing

| Trigger | Route |
|---------|-------|
| User provides URL | web_extract(url) → assess content type → extract at chosen depth |
| User provides text directly | Assess content type → extract at chosen depth |
| User provides file path | read_file(path) → assess content type → extract |
| User wants quick overview | Depth 1: Instant → 30-second read |
| User wants deep analysis | Depth 5: Comprehensive → full breakdown with contrarian takes |
| User wants the "spicy" angle | Extract all depths → highlight contrarian section → expand |

## Depth Levels

### Level 1: Instant (30-second read)
```
1. Identify: source type, author, main claim, year
2. Extract: 3 key points (one sentence each)
3. One contrarian thought (required)
4. One spicy take (required)
5. Output: ~100 words total
```

### Level 2: Quick (2-minute read)
```
1. All of Level 1
2. Add: 5 key insights ranked by surprisingness
3. Add: 2 actionable takeaways
4. Add: 1 question this raises
5. Output: ~250 words
```

### Level 3: Standard (5-minute read)
```
1. All of Level 2
2. Source evaluation: credibility, bias, evidence quality
3. Key quotes (3-5) with context
4. Connections to related ideas/fields
5. 3 contrarian perspectives (required)
6. 2 spicy takes (required)
7. Output: ~500 words
```

### Level 4: Deep (10-minute read)
```
1. All of Level 3
2. Argument reconstruction: premises → reasoning → conclusion
3. Evidence audit: what's cited, what's missing
4. Alternative interpretations (3+)
5. Counter-arguments to each major claim
6. Practical applications by domain
7. 5 contrarian perspectives (required)
8. 3 spicy takes (required)
9. Output: ~1000 words
```

### Level 5: Comprehensive (full analysis)
```
1. All of Level 4
2. Full argument map (premises, claims, evidence, conclusions)
3. Historical/situational context
4. Cross-reference with contradictory sources
5. Intellectual genealogy (what ideas led to this)
6. Future implications and scenarios
7. 7+ contrarian perspectives (required)
8. 5+ spicy takes (required)
9. "What the author won't say" section
10. "What's obviously wrong" section
11. Actionable synthesis — what to do with this
12. Output: ~2000 words
```

## Step-by-Step Procedures

### 1. Content Ingestion
```
1. Determine content source:
   a. URL → web_extract(url) → raw text
   b. Text → use directly
   c. File → read_file(path) → raw text
   d. PDF → extract text content
2. Assess content type:
   - Length: short (<1K), medium (1K-5K), long (5K-50K), very long (>50K)
   - Type: academic_paper, news_article, blog_post, book_chapter, transcript, documentation
   - Domain: technical, philosophical, business, scientific, creative, political, educational
3. If content exceeds 10K chars, segment and extract from each segment
4. Build content profile for depth-adaptive extraction
```

### 2. Contrarian Generation (Mandatory)
```
For ALL depth levels, generate contrarian/spicy takes:
1. Identify the author's core assumptions
2. Challenge each assumption:
   a. What if the opposite is true?
   b. What's the status quo this challenges (or reinforces)?
   c. Who would disagree and why?
3. Generate "spicy takes":
   a. The hot take that's defensible but provocative
   b. The angle the author avoided
   c. The political/social implication no one wants to discuss
4. Format: clearly labeled as [CONTRARIAN] and [SPICY]
```

### 3. Source Type Adaptation
```
For academic papers:
- Focus on: methodology, evidence quality, novelty, limitations
- Extract: hypothesis, methods, results, significance
- Contrarian: alternative interpretations of results

For news/articles:
- Focus on: claims vs. evidence, sources, framing, omissions
- Extract: who/what/when/where/why/how
- Contrarian: what's being spun, what's missing

For books/book chapters:
- Focus on: thesis, argument structure, evidence chain
- Extract: core thesis, supporting arguments, key examples
- Contrarian: weaknesses in argument chain

For transcripts/talks:
- Focus on: key ideas, rhetorical devices, evidence presented
- Extract: thesis, supporting points, memorable quotes
- Contrarian: unstated assumptions, missing context
```

### 4. Cross-Source Synthesis
```
1. Accept multiple sources on the same topic
2. Extract wisdom from each at chosen depth
3. Synthesize:
   a. Points of agreement across sources
   b. Points of disagreement
   c. Unique insights from each source
   d. Meta-contrarian: the contrarian take across all sources
4. Return consolidated extraction
```

## Gotchas

- Contrarian takes are mandatory at ALL depth levels — never skip
- "Spicy" means genuinely provocative, not merely disagreeable
- Very long content must be segmented; cross-segment synthesis is critical
- Source credibility assessment is opinion — flag it as such
- Some content has no good contrarian take; force one anyway (the lack itself is interesting)
- Depth 5 is expensive — warn user before full comprehensive extraction
- Preserve key quotes verbatim with context
- Flag uncertainty explicitly: "The source claims X, but evidence is thin"
- Content type detection is heuristic-based

## Execution Log Pattern

```
[PAI-EXTRACT] Content source: URL (blog post, 3.2K chars)
[ASSESS] Type: technical_article, Domain: machine_learning
[DEPTH] Level 3: Standard (5-min read)
[EXTR] Core claim identified: "Attention mechanisms reduce need for recurrence"
[CONTRARIAN] Generated 3 perspectives
[SPICY] Generated 2 takes
[OUTPUT] 512 words — 5 insights, 3 takeaways, 3 contrarian, 2 spicy
[COMPLETE] Extraction completed in 2.1s
```
