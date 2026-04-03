# Search Aphorisms

**Purpose:** Search aphorism database by theme, keyword, author, or topic to discover relevant quotes.

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the SearchAphorisms workflow in the Aphorisms skill to search quotes"}' \
  > /dev/null 2>&1 &
```

Running **SearchAphorisms** in **Aphorisms**...

---

**When to Use:**
- User wants to explore quotes on specific theme
- User says "search aphorisms about [topic]", "find quotes on [theme]", "show me [keyword] quotes"
- Browsing database for inspiration
- Finding quotes before knowing exact newsletter theme
- Discovering what's available in database

**Prerequisites:**
- Aphorism database exists at `~/.claude/skills/aphorisms/Database/aphorisms.md`
- Search query or theme provided
- Database Read for comprehensive search

---

## Workflow Steps

### Step 1: Parse Search Query

**Identify Search Type:**

**1. Theme Search**
```
User: "Search aphorisms about resilience"
User: "Find quotes on learning"
User: "Show stoicism quotes"
```
→ Search by established theme categories

**2. Keyword Search**
```
User: "Search for quotes with 'curiosity'"
User: "Find aphorisms mentioning 'fear'"
User: "Quotes about 'action'"
```
→ Search quote text for specific words

**3. Author Search**
```
User: "Show me all Feynman quotes"
User: "What do we have from Hitchens?"
User: "Marcus Aurelius aphorisms"
```
→ Filter by specific author

**4. Topic Search**
```
User: "Quotes about overcoming setbacks"
User: "Aphorisms for newsletter about AI hype"
User: "Wisdom on decision-making"
```
→ Semantic search across themes and content

**5. Combination Search**
```
User: "Feynman quotes about learning"
User: "Stoic quotes on control"
User: "Short quotes about action"
```
→ Multiple filters applied

---

### Step 2: Read Database

```bash
Read ~/.claude/skills/aphorisms/Database/aphorisms.md
```

**Load full context:**
- All aphorisms with metadata
- Theme index
- Thinker sections
- Usage history

---

### Step 3: Execute Search

### Theme Search

**Match to established themes:**
- Work Ethic & Excellence
- Resilience & Strength
- Fear & Mindset
- Passion & Enthusiasm
- Competition & Progress
- Curiosity & Intelligence
- Investment & Self-Development
- Present Moment & Enjoyment
- Learning & Education
- Stoicism & Control
- Risk & Action
- Adversity

**Process:**
1. Identify which theme(s) match search query
2. May match multiple themes (e.g., "growth" matches Resilience + Learning)
3. Extract all quotes tagged with matching theme(s)

**Example:**
```
Query: "Search aphorisms about resilience"

Matching Themes: Resilience & Strength, Adversity

Results:
- Bob Marley (strength through necessity)
- Rocky Balboa (getting hit and moving forward)
- Muhammad Ali (suffer now, champion later)
- Unknown (pain → strength)
```

---

### Keyword Search

**Search quote text directly:**
```
For each aphorism in database:
  If keyword appears in quote text:
    Add to results
```

**Case-insensitive:**
- "curiosity" matches "Curiosity", "CURIOSITY", "curious"

**Partial matches:**
- "learn" matches "learning", "learned", "learner"

**Context awareness:**
- Also check author names and contexts for keyword

**Example:**
```
Query: "Find aphorisms mentioning 'fear'"

Results:
- Robert Heller: "Fear is excitement without breath"
- (Any other quotes with "fear" in text or context)
```

---

### Author Search

**Filter by author name:**
```
For each aphorism in database:
  If author matches search:
    Add to results
```

**Flexible matching:**
- "Feynman" matches "Richard Feynman"
- "Marcus Aurelius" matches "Aurelius"
- "Ali" matches "Muhammad Ali"

**Result organization:**
- Group by theme if author has multiple quotes
- Chronological if known
- By source if documented

**Example:**
```
Query: "Show me all Marcus Aurelius quotes"

Results:
Marcus Aurelius (1 quote):

**Stoicism & Control:**
- "You have power over your mind - not outside events. Realize this, and you will find strength."
```

---

### Topic Search (Semantic)

**More complex - requires understanding:**

**Process:**
1. Analyze topic semantically
2. Identify related themes
3. Look for keyword variations
4. Check quote contexts for relevance

**Example:**
```
Query: "Quotes about overcoming setbacks"

Analysis:
- Primary themes: Resilience, Adversity, Strength
- Related concepts: Persistence, growth, difficulty
- Keywords: setback, challenge, overcome, persist, adversity

Search:
1. Themes: Resilience & Strength, Adversity
2. Keywords: "setback", "challenge", "adversity", "difficulty"
3. Context: Any mention of overcoming challenges

Results: [Combined theme + keyword matches]
```

---

### Combination Search

**Apply multiple filters:**

**Example:**
```
Query: "Feynman quotes about learning"

Filters:
1. Author = Feynman
2. Theme = Learning & Education OR Curiosity & Intelligence

Process:
- Get all Feynman quotes
- Filter for those tagged with learning/curiosity themes
- Return intersection

Results: [Feynman quotes specifically about learning]
```

---

### Step 4: Rank Results

**Ranking Criteria:**

**1. Relevance Score (0-10)**
- Exact theme match: 10
- Keyword in quote: 8-10
- Keyword in context: 5-7
- Related theme: 4-6
- Tangential: 1-3

**2. Quotability (0-10)**
- Clear, concise: 8-10
- Needs some context: 5-7
- Complex or long: 3-4

**3. Freshness (0-10)**
- Never used: 10
- Used >6 months ago: 7-9
- Used recently: 3-6
- Used very recently: 0-2

**Total Score:** Sum (max 30)

**Sort results:**
- Highest score first
- Break ties by quotability
- Secondary sort by author diversity

---

### Step 5: Format Results

**Standard Format:**

```markdown
## Search Results: "[Query]"

**Found [N] matching aphorisms**

---

### Result 1: [Quote Summary/First Few Words]

**"[Full quote text]"**

**Author:** [Author Name]
**Themes:** [Theme 1], [Theme 2]
**Context:** [Brief context]

**Why This Matches:**
[Specific relevance to search query]

**Usage:** [Last used: date / Never used]

**Score:** [X/30]

---

### Result 2: [Quote Summary]

[Same format...]

---

[All results...]

---

## Summary

**Total Results:** [N]
**By Theme:**
- [Theme 1]: [N] quotes
- [Theme 2]: [N] quotes

**By Author:**
- [Author 1]: [N] quotes
- [Author 2]: [N] quotes

**Top Recommendation:** [Result #1 title]
```

---

### Step 6: Present Options

**Provide user with:**
1. Full results formatted
2. Summary statistics
3. Top recommendation
4. Related searches suggestions

**Related Searches:**
```markdown
## You Might Also Like

Based on your search for "[Query]", you might also be interested in:
- [Related theme 1]
- [Related theme 2]
- Quotes from [Related author]
```

---

## Advanced Search Features

### Exclude Filter

```
User: "Search resilience quotes but not Rocky Balboa"

Process:
1. Get all resilience quotes
2. Filter out Rocky Balboa quotes
3. Return remaining results
```

### Recency Filter

```
User: "Show me unused quotes about learning"

Process:
1. Get all learning quotes
2. Filter for usage = never OR >6 months
3. Return fresh quotes
```

### Length Filter

```
User: "Short quotes about action"

Process:
1. Get all action quotes
2. Filter for character count < 150
3. Return concise options
```

### Source Filter

```
User: "Quotes from books, not movies"

Process:
1. Check context/source metadata
2. Filter for literary sources
3. Exclude film quotes
```

---

## Search by Use Case

### Newsletter Topic Matching

```
User: "I'm writing about AI safety. What quotes do we have?"

Process:
1. Analyze topic: AI safety = caution, wisdom, responsibility, careful thinking
2. Map to themes: Stoicism & Control, Wisdom & Truth-Seeking, Risk & Action (cautious side)
3. Search across multiple themes
4. Rank by relevance to "careful, wise decision-making"

Results:
- Marcus Aurelius (control what you can)
- Confucius (learning + thinking balance)
- Feynman (if available - on scientific rigor)
```

### Mood Matching

```
User: "I need an inspiring quote"

Process:
1. Identify "inspiring" mood
2. Themes: Excellence, Resilience, Progress, Action
3. Filter for positive, empowering tone
4. Avoid darker or cautionary quotes

Results:
- Tim Grover, Muhammad Ali, Robin Sharma quotes
- Focus on achievement and growth
```

### Audience Matching

```
User: "Quote for technical audience"

Process:
1. Identify technical audience preference
2. Favor: Feynman, Deutsch, scientific thinkers
3. Avoid: Pop culture references, sports figures
4. Emphasize: Rationality, evidence, rigorous thinking

Results:
- Feynman quotes on curiosity and doubt
- Deutsch on knowledge creation
- Harris on rationality
```

---

## Quality Checks

Before returning results:

- [ ] All results genuinely match search query
- [ ] Relevance scores accurately reflect match quality
- [ ] Results ranked appropriately
- [ ] Variety in authors if possible
- [ ] Context explains why each quote matches
- [ ] Usage history noted for freshness
- [ ] Related searches are actually relevant
- [ ] Formatting is clear and scannable

---

## Edge Cases

### No Results Found

```markdown
## Search Results: "[Query]"

**No matching aphorisms found.**

**Suggestions:**
1. **Broaden search** - Try related themes:
   - [Related theme 1]
   - [Related theme 2]

2. **Research new quotes** - Would you like me to research quotes about "[topic]"?

3. **Similar searches that would work:**
   - [Alternative query 1]
   - [Alternative query 2]

**Available themes in database:**
- [List all themes]
```

### Too Many Results

```
Query: "Search for quotes"
(No specific criteria - matches everything)

Response:
"Your search is very broad. Database contains [N] total aphorisms.

Would you like to:
1. Browse by theme (show theme index)
2. Browse by author (show author list)
3. Search by specific topic (ask: what topic?)
4. Show random sampling (10 diverse quotes)"
```

### Ambiguous Query

```
Query: "Search for quotes about change"

Issue: "Change" could mean:
- Personal transformation (growth)
- Taking action (doing something different)
- Accepting reality (stoic acceptance)
- Progress and innovation

Response:
"'Change' can mean several things. Which are you most interested in?
1. Personal growth and transformation
2. Taking action and making things happen
3. Accepting reality and what you can't control
4. Progress and innovation

Or should I show results from all categories?"
```

### Contradictory Search

```
Query: "Stoic quotes about taking big risks"

Issue: Stoicism emphasizes control and caution; big risks are opposite

Response:
"Stoicism and big risk-taking are somewhat contradictory philosophies.

Would you prefer:
1. Stoic quotes about calculated risk (wisdom + action)
2. Risk-taking quotes from non-stoic sources
3. Quotes balancing wisdom with action

Or explain what you're looking for and I'll find the best match?"
```

---

## Integration with Other Workflows

### After Search Results

**Next Actions:**

**1. Use in newsletter:**
- Results feed directly into find-aphorism.md analysis
- User can request: "Use result #3 for my newsletter"

**2. Expand research:**
- If user likes specific author: "Research more [Author] quotes"
- Uses research-thinker.md workflow

**3. Add new quotes:**
- If search reveals gap: "Research quotes about [missing theme]"
- Uses research-thinker.md then add-aphorism.md

---

## Saved Searches

**Track common searches:**
- Newsletter topics frequently covered
- Most-searched themes
- Recurring patterns

**Optimize database:**
- Expand themes that get searched often
- Research thinkers for frequently requested topics

---

## Success Criteria

**Search succeeds when:**
- Results accurately match user query
- User finds relevant quote(s) from results
- Ranking makes sense (best matches first)
- Variety in results when possible
- Clear explanation of why each quote matches
- User can quickly decide which quote to use

**Quality indicators:**
- User says "perfect, exactly what I needed"
- User selects from results without requesting more searches
- Relevance scores align with user perception
- Results are diverse and interesting

---

## Example Execution

### User Input
"Search aphorisms about learning and curiosity"

### Step 1: Parse Query
- **Type:** Theme search + Keyword
- **Themes:** Learning & Education, Curiosity & Intelligence
- **Keywords:** "learn", "learning", "curious", "curiosity"

### Step 2: Read Database
Load full database context

### Step 3: Execute Search

**Theme matches:**
- Curiosity & Intelligence theme: Aaron Swartz, Dorothy Parker (if added), Einstein (if added)
- Learning & Education theme: Gandhi, Krishnamurti, Confucius

**Keyword matches:**
- Any quotes with "learn", "curious", "curiosity" in text

**Results:**
1. Aaron Swartz (curiosity = intelligence)
2. Gandhi (live/learn)
3. Krishnamurti (lifelong learning)
4. Confucius (learning + thinking)
5. Einstein (if added - questioning and curiosity)

### Step 4: Rank Results

**Scores:**
1. Aaron Swartz - 28/30 (exact theme match + keyword + never used)
2. Einstein - 26/30 (exact theme + keyword + highly quotable)
3. Krishnamurti - 24/30 (theme match + keyword + context)
4. Confucius - 23/30 (theme match + keyword)
5. Gandhi - 22/30 (theme match + indirect keyword)

### Step 5: Format Results

```markdown
## Search Results: "learning and curiosity"

**Found 5 matching aphorisms**

---

### Result 1: Curiosity = Intelligence

**"Be curious. Read widely. Try new things. What people call intelligence just boils down to curiosity."**

**Author:** Aaron Swartz
**Themes:** Curiosity & Intelligence
**Context:** Internet activist defining intelligence as active curiosity

**Why This Matches:**
Direct hit on both "curiosity" and learning-oriented message. Reframes intelligence as curiosity in action.

**Usage:** Never used

**Score:** 28/30

---

### Result 2: Never Stop Questioning

**"The important thing is not to stop questioning. Curiosity has its own reason for existing."**

**Author:** Albert Einstein
**Themes:** Curiosity & Intelligence, Learning & Education
**Context:** From 1955 interview "Old Man's Advice to Youth"

**Why This Matches:**
Directly mentions questioning and curiosity. Emphasizes intrinsic value of curiosity.

**Usage:** Never used

**Score:** 26/30

---

[Results 3-5 formatted similarly...]

---

## Summary

**Total Results:** 5
**By Theme:**
- Curiosity & Intelligence: 2 quotes
- Learning & Education: 4 quotes (some overlap)

**By Author:**
- Swartz: 1
- Einstein: 1
- Krishnamurti: 1
- Confucius: 1
- Gandhi: 1

**Top Recommendation:** Aaron Swartz (Result #1)

## You Might Also Like

Based on your search for "learning and curiosity", you might also be interested in:
- Feynman quotes (when added - perfect match for this theme)
- Quotes about "intellectual honesty"
- Quotes about "questioning assumptions"
```

### Step 6: Present
User reviews results and selects Aaron Swartz quote for newsletter

---

## Related Workflows

- **find-aphorism.md** - Use search results for newsletter matching
- **research-thinker.md** - Expand database if search reveals gaps
- **add-aphorism.md** - Add discovered quotes during research

---

**Last Updated:** 2025-11-20
