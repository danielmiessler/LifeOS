---
name: pai-aphorisms
description: "CRUD operations for a curated aphorism collection — content-based matching, themed search, thinker research, and newsletter integration. Organizes quotes by author, theme, context, and newsletter usage history to prevent repetition. Four workflows: FindAphorism (analyze newsletter content, match themes, return 3-5 ranked recommendations with rationale), AddAphorism (parse quote + author, extract themes, validate uniqueness, update theme index), ResearchThinker (deep research on philosopher, add sourced quotes to database), SearchAphorisms (search by theme, keyword, or author). Database stored as structured markdown. Theme index supports 12+ categories: Work Ethic, Resilience, Learning, Stoicism, Risk, Wisdom, Truth-seeking, Excellence, Curiosity, Freedom, Rationality, Clarity. Supported thinkers: Hitchens, Feynman, Deutsch, Sam Harris, Spinoza, plus any requested author. Newsletter integration: tracks which quotes used in which issues to enforce variety; content theme extraction drives automated matching. USE WHEN you need to manage/manipulate/search a collection of aphorisms or quotes. NOT FOR general knowledge management."
version: 5.0.0
author: PAI v5.0 → Hermes Port
license: MIT
metadata:
  hermes_tags: [pai, aphorisms, quotes, newsletter, content, philosophy]
  related_skills: [pai-writing, pai-research]
---

<!-- Voice notification — fire-and-forget on invocation -->
```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the pai-aphorisms skill"}' \
  > /dev/null 2>&1 &
```


# pai-aphorisms — Curated Aphorism Collection Manager

## Overview

Manages a curated aphorism collection with full CRUD — content-based matching,
themed search, thinker research, and database maintenance. Organizes quotes by
author, theme, context, and newsletter usage history to prevent repetition.

### Database Location

The aphorism database lives at:
`~/.hermes/pai/skills/aphorisms/Database/aphorisms.md`

Each entry includes: full quote text, author attribution, theme tags,
context/background, source reference, and usage history.

### Theme Categories

| Theme | Description |
|-------|-------------|
| Work Ethic & Excellence | Craft, mastery, high standards, results |
| Resilience & Strength | Adversity, persistence, growth through challenge |
| Learning & Education | Knowledge acquisition, continuous improvement |
| Stoicism & Control | Internal locus, acceptance, discipline |
| Risk & Action | Courage, failure acceptance, experimentation |
| Wisdom & Truth | Rationality, evidence, honest inquiry |
| Curiosity & Intelligence | Questioning, intellectual drive |
| Passion & Enthusiasm | Full commitment, love for craft |
| Competition & Progress | Self-improvement, personal benchmarks |
| Present Moment & Enjoyment | Mindfulness, appreciation |
| Investment & Self-Development | Personal growth, skill building |
| Adversity | Challenges, setbacks, overcoming difficulty |

## Workflow Routing

| Request Pattern | Route To |
|-----------------|----------|
| Find aphorism, quote for newsletter, match aphorism, suggest quote, aphorism recommendation | FindAphorism — analyze content, match themes, rank 3-5 recommendations |
| Add quote, add aphorism, save quote, new aphorism, store quote | AddAphorism — parse, verify, dedup, theme tag, write to database |
| Research thinker, find quotes from, what did X say, thinker quotes on | ResearchThinker — deep research on philosopher, add sourced quotes |
| Search aphorisms, find quotes on, quotes about, quotes matching, what aphorisms | SearchAphorisms — search by theme, keyword, author, or topic |

## FindAphorism — Content-Based Matching

Analyze newsletter/article content to find the perfect thematic aphorism.

**Process:**
1. **Get content** — Accept URL, pasted text, or theme description
2. **Analyze themes** — Extract core topic, emotional tone, key messages, TELOS alignment
3. **Read database** — Load aphorism.md, scan theme index
4. **Match & score** — Rank by thematic relevance (0-10), tonal alignment (0-10), message reinforcement (0-10), philosophical alignment (0-10), freshness (0-10)
5. **Recommend top 3-5** — Provide full quote, author, rationale, placement suggestion, and score

**Scoring criteria:**
- Thematic Relevance: Direct match to newsletter's core themes
- Tonal Alignment: Quote mood matches newsletter tone
- Message Reinforcement: Quote strengthens key messages
- Philosophical Alignment: Embodies TELOS philosophy
- Freshness: Not used recently (check usage history)

## AddAphorism — Structured Quote Addition

**Process:**
1. **Parse input** — Extract quote text and author from user request
2. **Verify accuracy** — WebSearch to confirm exact wording and correct attribution; flag misattributions
3. **Check duplicates** — Read existing database; reject exact/similar duplicates or confirm with user
4. **Analyze themes** — Assign 1-3 primary theme categories
5. **Add context** — Source (book, speech, interview), background (circumstances), relevance (why it matters)
6. **Format & place** — Standard markdown format; place in appropriate theme or thinker section
7. **Update theme index** — Add author reference to relevant categories
8. **Write to database** — Use Edit tool to insert quote and update index
9. **Confirm to user** — Summary with quote, author, themes, location, and database stats

**Batch addition:** Process multiple quotes in sequence with single Edit pass.
**Research-driven addition:** If only a topic is given, research the exact quote first.

## ResearchThinker — Deep Thinker Research

Deep research on specific philosophers/thinkers to discover relevant aphorisms.

**Key thinkers:**
- **Christopher Hitchens** — Rationality, skepticism, intellectual honesty (God Is Not Great, Hitch-22)
- **David Deutsch** — Knowledge creation, optimism, explanations (The Beginning of Infinity)
- **Sam Harris** — Rationality, meditation, free will, morality (The End of Faith, Waking Up)
- **Baruch Spinoza** — Ethics, reason, freedom through understanding (Ethics)
- **Richard Feynman** — Curiosity, scientific thinking, doubt, clarity (Surely You're Joking...)
- Plus any author requested by the user

**Process:**
1. **Identify target** — Thinker name, optional theme focus, desired quote count (default 10-15)
2. **Research** — Parallel research across primary sources, quote collections, academic sources, interviews
3. **Filter & verify** — Authenticity (critical), TELOS alignment, quotability, thematic relevance, uniqueness
4. **Add context** — Source attribution, background, relevance for each selected quote
5. **Organize by theme** — Group quotes under thinker section by theme category
6. **Format & write** — Standard markdown format; Edit database to replace placeholder with organized quotes
7. **Update theme index** — Add thinker to relevant theme categories
8. **Report findings** — Summary with total quotes added, per-theme counts, top 3 highlights, philosophy summary

## SearchAphorisms — Theme, Keyword & Author Search

**Search types:**
- **Theme search** — Match to established categories (resilience, learning, stoicism, etc.)
- **Keyword search** — Case-insensitive matching in quote text, author names, and contexts
- **Author search** — Filter by specific author (flexible name matching)
- **Topic (semantic) search** — Analyze topic semantically, identify related themes and keywords
- **Combination search** — Apply multiple filters (e.g., Feynman quotes about learning)

**Ranking:** Relevance (0-10), Quotability (0-10), Freshness (0-10); total max 30.

**Advanced filters:** Exclude author, recency (unused quotes), length (short/long), source type (book vs film).

**No results found:** Suggest broader search, related themes, or offer to research new quotes.

## Newsletter Integration

- Tracks which quotes used in which newsletter issues
- Usage history prevents repetition across issues
- Content theme extraction drives automated matching
- After quote selection, update usage history in database
- Seasonal/temporal context awareness (e.g., New Year = fresh starts)

## Gotchas

- **Search by theme, not exact text.** The collection is organized by conceptual themes, not keyword matching.
- **Always include attribution and source when adding new aphorisms.** Unattributed quotes are useless.
- **Duplicate detection:** Check if the aphorism already exists before adding. Same idea, different wording, still counts as duplicate.
- **Verify accuracy.** Many popular quotes are misattributed. Always cross-reference before adding.
- **Freshness matters.** Avoid reusing quotes within 3 months for the same newsletter audience.
- **Author diversity.** Rotate between classical and contemporary thinkers; avoid overusing a single author.

## Execution Log Pattern

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"pai-aphorisms","workflow":"WORKFLOW","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> ~/.hermes/pai/MEMORY/SKILLS/execution.jsonl
```
