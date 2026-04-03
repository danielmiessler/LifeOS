---
name: Aphorisms
description: CRUD on {PRINCIPAL.NAME}'s curated aphorism collection — search by theme, add with metadata, research thinkers, match quotes to newsletter content. USE WHEN aphorism, quote, saying, find quote for newsletter, research thinker quotes, add aphorism, search aphorisms, find aphorism.
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/Aphorisms/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.


## 🚨 MANDATORY: Voice Notification (REQUIRED BEFORE ANY ACTION)

**You MUST send this notification BEFORE doing anything else when this skill is invoked.**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:8888/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the WORKFLOWNAME workflow in the Aphorisms skill to ACTION"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running the **WorkflowName** workflow in the **Aphorisms** skill to ACTION...
   ```

**This is not optional. Execute this curl command immediately upon skill invocation.**

## Workflow Routing

**When executing a workflow, output this notification directly:**

```
Running the **WorkflowName** workflow in the **Aphorisms** skill to ACTION...
```

| Request Pattern | Route To |
|---|---|
| Find aphorism, quote for newsletter, match aphorism, suggest quote, aphorism recommendation | `Workflows/FindAphorism.md` |
| Add quote, add aphorism, save quote, new aphorism, store quote | `Workflows/AddAphorism.md` |
| Research thinker, find quotes from, what did X say, thinker quotes on | `Workflows/ResearchThinker.md` |
| Search aphorisms, find quotes on, quotes about, quotes matching, what aphorisms | `Workflows/SearchAphorisms.md` |

---

## When to Activate This Skill

### Direct Aphorism Requests
- "find aphorism", "find a quote", "find quote for X"
- "search aphorisms", "search quotes", "look up quote"
- "what aphorism", "which quote", "perfect quote for"
- "suggest aphorism", "recommend quote", "match quote to"
- "aphorism for newsletter", "quote for blog post", "quote for article"

### Database Management
- "add aphorism", "add quote", "save this quote"
- "new aphorism", "include quote", "store this"
- "update aphorism database", "manage quotes"

### Research & Discovery
- "research [thinker] quotes", "find [author] aphorisms"
- "what did [philosopher] say about", "quotes from [thinker]"
- "Hitchens quotes", "Feynman wisdom", "Spinoza aphorisms"
- "Sam Harris on [topic]", "David Deutsch quotes"

### Theme-Based Search
- "aphorisms about [theme]", "quotes on [topic]"
- "show quotes about resilience", "wisdom on learning"
- "stoic quotes", "quotes matching [keyword]"

### Newsletter Workflow Integration
- User working on newsletter and needs aphorism
- Mentions "newsletter" + "quote" or "aphorism"
- Content analysis for quote matching
- Avoiding previously used quotes

### Use Case Indicators
- Need wisdom quote to open/close newsletter
- Want thematically relevant aphorism
- Building quote collection
- Researching philosopher's ideas
- Managing aphorism library

---

## Core Capabilities

### 1. Intelligent Quote Matching
Analyze newsletter or article content to find the perfect thematic aphorism:
- Extract key themes from content
- Match themes to aphorism database
- Consider tone and style alignment
- Avoid recently used quotes
- Provide multiple options with rationale

### 2. Comprehensive Database
Curated collection organized by:
- **Author** - Thinkers aligned with TELOS philosophy
- **Theme** - Categories like resilience, learning, stoicism, risk, progress
- **Context** - Background on quote origin and meaning
- **Usage History** - Track which quotes used in which newsletters

### 3. Thinker Research
Deep research on key philosophers:
- **Christopher Hitchens** - Rationality, skepticism, intellectual honesty
- **David Deutsch** - Knowledge creation, optimism, explanations
- **Sam Harris** - Rationality, meditation, free will, morality
- **Baruch Spinoza** - Ethics, reason, freedom, nature
- **Richard Feynman** - Curiosity, scientific thinking, doubt, clarity

### 4. Theme-Based Organization
Aphorisms categorized by themes matching user content:
- **Work Ethic & Excellence** - Craft, mastery, high standards
- **Resilience & Strength** - Adversity, persistence, growth
- **Learning & Education** - Curiosity, continuous improvement
- **Stoicism & Control** - Internal locus, acceptance, discipline
- **Risk & Action** - Courage, failure, experimentation
- **Wisdom & Truth** - Rationality, evidence, honest inquiry

---

## Database Structure

**Location:** `~/.claude/skills/aphorisms/Database/aphorisms.md`

**Current Collections:**
1. **Initial Collection (Rahil Arora)** - 15 curated quotes covering core themes
2. **Thinkers Aligned with TELOS** - Sections for Hitchens, Deutsch, Harris, Spinoza, Feynman (to be populated)
3. **Theme Index** - Quick reference by category
4. **Newsletter Usage History** - Tracking to avoid repetition

**Metadata Per Aphorism:**
- Full quote text
- Author attribution
- Theme tags
- Context and background
- Source reference (when available)

---

## Available Workflows

### Quote Discovery & Matching

**find-aphorism.md** - Intelligent newsletter content analysis
- Analyze content themes and tone
- Search database for thematic matches
- Consider usage history
- Provide top 3-5 recommendations with rationale
- Include quote, author, and why it fits

### Database Management

**add-aphorism.md** - Structured quote addition
- Accept quote text and author
- Extract or assign themes
- Add context and background
- Update theme index
- Validate uniqueness

### Research Operations

**research-thinker.md** - Deep thinker research
- Research specific philosopher's relevant quotes
- Focus on TELOS-aligned themes
- Add quotes to appropriate database section
- Include context and sources
- Update theme index

### Search & Discovery

**search-aphorisms.md** - Theme and keyword search
- Search by theme, keyword, or author
- Return matching aphorisms
- Sort by relevance or usage
- Provide context for each result

---

## Integration Points

### Newsletter Content Skill
- Automatic aphorism suggestions when creating newsletter
- Theme analysis from newsletter content
- Usage tracking for variety

### Research Skill
- Deep thinker research capabilities
- Web research for quote verification
- Source attribution and context

### Writing Skill
- Blog post quote recommendations
- Story explanation enhancement
- Content opening/closing quotes

---

## Key Thinkers & Philosophy Alignment

### Why These Thinkers?

All five thinkers align with TELOS themes of **wisdom, rationality, truth-seeking, and human flourishing:**

**Christopher Hitchens**
- Intellectual honesty and skepticism
- Question everything, follow evidence
- "What can be asserted without evidence can be dismissed without evidence"

**David Deutsch**
- Optimistic epistemology - problems are solvable
- Knowledge creation through criticism
- Emphasis on explanations, not just predictions

**Sam Harris**
- Scientific rationality applied to ethics
- Importance of reason and evidence
- Mindfulness and self-awareness

**Baruch Spinoza**
- Ethics based on reason
- Freedom through understanding
- Reality acceptance and wisdom

**Richard Feynman**
- Curiosity-driven learning
- Doubt as a tool for knowledge
- Clarity of thought and explanation
- Scientific honesty

### Research Priority

1. **Immediate**: Analyze previous newsletters for aphorism patterns
2. **Phase 1**: Research Hitchens and Feynman (most quotable, clear style)
3. **Phase 2**: Research Harris and Deutsch (contemporary, relevant)
4. **Phase 3**: Research Spinoza (historical, philosophical depth)

---

## Usage Examples

### Example 1: Finding Aphorism for Newsletter

**User:** "I'm writing a newsletter about overcoming setbacks in AI research. Find me a good aphorism."

**Skill Response:**
1. Analyze themes: resilience, adversity, persistence, progress
2. Search database for matching themes
3. Recommend top 3 options:
   - Rocky Balboa quote (direct, powerful on getting hit and moving forward)
   - Bob Marley quote (strength through necessity)
   - Marcus Aurelius quote (stoic control focus)
4. Provide rationale for each

### Example 2: Adding New Quote

**User:** "Add this quote: 'The cure for boredom is curiosity. There is no cure for curiosity.' - Dorothy Parker"

**Skill Response:**
1. Parse quote and author
2. Identify themes: curiosity, learning, passion
3. Add to database with context
4. Update theme index
5. Confirm addition

### Example 3: Researching Thinker

**User:** "Research David Deutsch quotes about knowledge and optimism"

**Skill Response:**
1. Research Deutsch's works (The Beginning of Infinity, The Fabric of Reality)
2. Extract relevant quotes on knowledge creation and optimism
3. Add to database with source attribution
4. Organize by theme
5. Report findings

### Example 4: Theme Search

**User:** "Show me all aphorisms about learning and education"

**Skill Response:**
1. Search database for learning/education theme
2. Return matching quotes:
   - Gandhi (live/learn)
   - Krishnamurti (lifelong learning)
   - Confucius (learning + thinking)
   - Aaron Swartz (curiosity)
3. Provide context for each

---

## Best Practices

### Quote Selection for Newsletter
1. **Match tone** - Ensure quote tone aligns with newsletter content
2. **Thematic relevance** - Direct connection to main themes
3. **Avoid repetition** - Check usage history
4. **Provide variety** - Rotate between authors and themes
5. **Context matters** - Consider whether reader needs background

### Database Maintenance
1. **Verify accuracy** - Check quote text and attribution
2. **Add context** - Include source and background when possible
3. **Theme consistently** - Use established theme categories
4. **Track usage** - Update history to avoid overuse
5. **Quality over quantity** - Curate, don't just collect

### Thinker Research
1. **Primary sources** - Prefer direct quotes from books/speeches
2. **Context critical** - Include enough background for understanding
3. **Avoid misattribution** - Verify quote authenticity
4. **TELOS alignment** - Focus on wisdom, rationality, truth-seeking
5. **Practical wisdom** - Quotes should be actionable or profound

---

## Future Enhancements

### Planned Features
1. **Automatic theme detection** - ML-based content analysis
2. **Quote recommendation engine** - Collaborative filtering based on past selections
3. **Integration with previous newsletters** - Analyze historical aphorism usage patterns
4. **Expanded thinker research** - Add more philosophers aligned with TELOS
5. **Mood/tone matching** - Match quote emotional tone to content
6. **Quote formatting** - Auto-format for newsletter style

### Long-term Vision
- Comprehensive wisdom library covering all content needs
- Predictive recommendations based on newsletter draft
- Historical analysis of most impactful quotes
- Community contributions (vetted)
- Integration with other writing workflows

---

## Quick Reference

**Most Used Commands:**
- "Find aphorism for this newsletter" → Analyze content and recommend
- "Add this quote" → Add to database with metadata
- "Research [thinker] quotes" → Deep research and database population
- "Search aphorisms about [theme]" → Theme-based search

**Database Location:**
`~/.claude/skills/aphorisms/Database/aphorisms.md`

**Current Collection Size:**
- 15 initial quotes (Rahil Arora collection)
- 5 thinker sections (to be populated)
- 12+ theme categories

**Key Thinkers:**
Hitchens, Deutsch, Harris, Spinoza, Feynman

---

## Related Skills

**newsletter-content** - Newsletter creation and content suggestions
**research** - Web research and content analysis
**writing** - Blog post and content creation
**personal** - User's philosophy and values context

---

Last Updated: 2025-11-20
