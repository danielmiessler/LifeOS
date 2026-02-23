# Find Aphorism for Newsletter Content

**Purpose:** Analyze newsletter or article content to recommend the perfect thematically-aligned aphorism from the database.

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the FindAphorism workflow in the Aphorisms skill to find quotes"}' \
  > /dev/null 2>&1 &
```

Running **FindAphorism** in **Aphorisms**...

---

**When to Use:**
- User provides newsletter draft or URL and requests aphorism
- User describes newsletter theme and wants quote recommendation
- User says "find aphorism for this", "what quote fits this", "suggest quote"
- Working on newsletter and needs opening/closing wisdom quote

**Prerequisites:**
- Aphorism database exists at `~/.claude/skills/aphorisms/Database/aphorisms.md`
- Newsletter content or URL provided by user
- Clear understanding of newsletter theme (if not provided, extract from content)

---

## Workflow Steps

### Step 1: Get Newsletter Content

**If URL provided:**
```bash
# Use WebFetch to get content
WebFetch(url, "Extract main article content, title, and key themes")
```

**If content pasted:**
- Receive full text directly from user

**If theme described:**
- Work with theme description only (e.g., "newsletter about overcoming setbacks")

**Expected Outcome:**
- Full newsletter text OR clear theme description

---

### Step 2: Analyze Content Themes

**Extract Primary Themes:**

Use deep thinking for deep thematic analysis. Identify:

1. **Core Topic** - What is the newsletter fundamentally about?
   - Examples: AI safety, personal productivity, security vulnerabilities, market analysis

2. **Emotional Tone** - What's the mood/feeling?
   - Examples: Optimistic, cautionary, reflective, urgent, inspirational

3. **Key Messages** - What are the 2-3 main takeaways?
   - Examples: "Persistence matters more than talent", "Question assumptions", "Focus on fundamentals"

4. **Philosophical Alignment** - Which TELOS themes are present?
   - Wisdom & Truth-seeking
   - Rationality & Evidence
   - Human flourishing & Progress
   - Resilience & Growth
   - Learning & Curiosity
   - Stoicism & Control
   - Risk & Action
   - Excellence & Mastery

5. **Audience Context** - Who is this for?
   - newsletter subscribers (technical, curious, rationalist)
   - Blog readers (varied technical background)
   - Social media audience (quick insights)

**Analysis Output:**
```markdown
### Content Analysis
- **Core Topic**: [Topic]
- **Emotional Tone**: [Tone]
- **Key Messages**:
  1. [Message 1]
  2. [Message 2]
  3. [Message 3]
- **TELOS Themes**: [Theme 1], [Theme 2], [Theme 3]
- **Audience**: [Context]
```

---

### Step 3: Read Aphorism Database

**Load database:**
```bash
Read ~/.claude/skills/aphorisms/Database/aphorisms.md
```

**Review relevant sections:**
1. Check theme index for matching categories
2. Review aphorisms in matching theme categories
3. Note usage history to avoid recently used quotes

**Expected Outcome:**
- Full database context loaded
- Theme-relevant sections identified

---

### Step 4: Match Aphorisms to Themes

**Matching Criteria:**

For each potential aphorism, score on:

1. **Thematic Relevance** (0-10)
   - Does the quote directly address the newsletter's core themes?
   - Strong connection = 8-10
   - Tangential connection = 4-7
   - Weak connection = 0-3

2. **Tonal Alignment** (0-10)
   - Does the quote's mood match the newsletter's tone?
   - Perfect match = 8-10
   - Compatible = 5-7
   - Mismatched = 0-4

3. **Message Reinforcement** (0-10)
   - Does the quote strengthen the newsletter's key messages?
   - Strongly reinforces = 8-10
   - Somewhat supports = 4-7
   - Neutral or contradictory = 0-3

4. **Philosophical Alignment** (0-10)
   - Does the quote embody TELOS philosophy?
   - Deep alignment = 8-10
   - Some alignment = 5-7
   - Misaligned = 0-4

5. **Freshness** (0-10)
   - Has this quote been used recently?
   - Not used recently = 10
   - Used 6+ months ago = 7-9
   - Used within 6 months = 3-6
   - Used within 3 months = 0-2

**Total Score:** Sum of all criteria (max 50)

**Select Top 3-5 Candidates:**
- All candidates should score 35+ (70%)
- Prefer variety in authors
- Balance well-known vs lesser-known quotes

---

### Step 5: Generate Recommendations

**Format for Each Recommendation:**

```markdown
### Recommendation [N]: [Quote Summary]

**Quote:**
"[Full quote text]"

**Author:** [Author Name]

**Why This Fits:**
- **Thematic Relevance**: [Specific connection to newsletter themes]
- **Tonal Alignment**: [How mood/style matches]
- **Message Support**: [Which key message it reinforces]
- **TELOS Alignment**: [Which philosophy themes it embodies]

**Placement Suggestion:**
[Opening quote / Closing quote / Section divider] - [Reasoning]

**Context (if needed):**
[Brief background on quote or author if readers might need it]

**Score:** [X/50]
```

**Provide 3-5 Recommendations:**
- **#1: Best Overall Match** - Highest total score
- **#2: Alternative Strong Match** - Second-best or different tone
- **#3: Safe Classic** - Well-known, universally resonant
- **#4 (optional): Unexpected Choice** - High relevance but lesser-known author/quote
- **#5 (optional): Philosophical Depth** - For readers seeking deeper wisdom

---

### Step 6: Present to User

**Summary Format:**

```markdown
## Aphorism Recommendations for "[Newsletter Title/Theme]"

### Content Analysis Summary
[Brief 2-3 sentence summary of themes and tone]

### Top Recommendations

[Include all recommendations from Step 5]

### Quick Decision Guide
- **For maximum impact**: Recommendation #1
- **For variety** (if #1 author used recently): Recommendation #2
- **For broad appeal**: Recommendation #3
- **For surprise/delight**: Recommendation #4
- **For philosophical depth**: Recommendation #5

### Usage Tracking
Remember to update usage history in database after selection.
```

---

## Advanced Techniques

### Multi-Newsletter Analysis

If user has multiple newsletter drafts:
1. Analyze all content simultaneously
2. Find thematic through-lines
3. Recommend aphorisms that span themes
4. Ensure variety across newsletters

### Seasonal/Temporal Context

Consider:
- Time of year (e.g., New Year = fresh starts, growth quotes)
- Current events (avoid tone-deaf selections)
- Recent newsletter themes (ensure variety)

### Author Diversity

Track author usage over time:
- Avoid overusing same author
- Rotate between classical and contemporary
- Balance well-known and obscure thinkers

---

## Common Patterns

### Pattern 1: Resilience/Adversity Newsletter
**Common Themes:** Setbacks, challenges, persistence, growth through difficulty
**Go-To Quotes:** Rocky Balboa, Marcus Aurelius, Muhammad Ali, Bob Marley
**Tone:** Inspirational, empowering, realistic about difficulty

### Pattern 2: Learning/Curiosity Newsletter
**Common Themes:** Knowledge acquisition, continuous improvement, intellectual honesty
**Go-To Quotes:** Feynman, Aaron Swartz, Confucius, Krishnamurti
**Tone:** Encouraging, thoughtful, emphasizing growth mindset

### Pattern 3: Action/Risk Newsletter
**Common Themes:** Taking chances, overcoming fear, experimenting, moving forward
**Go-To Quotes:** "If you try, you risk failure", Robert Heller (fear = excitement), Tim Grover
**Tone:** Bold, action-oriented, courage-focused

### Pattern 4: Excellence/Mastery Newsletter
**Common Themes:** High standards, craft, dedication, results over effort
**Go-To Quotes:** Tim Grover, Muhammad Ali, Robin Sharma (investment)
**Tone:** Demanding, uncompromising, focused on outcomes

### Pattern 5: Stoicism/Control Newsletter
**Common Themes:** Focus on what you can control, acceptance, internal strength
**Go-To Quotes:** Marcus Aurelius, Spinoza (when added)
**Tone:** Calm, philosophical, centered

### Pattern 6: Progress/Competition Newsletter
**Common Themes:** Self-improvement, internal benchmarks, personal growth
**Go-To Quotes:** Robin Sharma (run your own race), Gandhi (live/learn)
**Tone:** Encouraging, progress-focused, non-comparative

---

## Quality Checks

Before finalizing recommendations:

- [ ] All quotes verified for accuracy (correct text and attribution)
- [ ] Thematic relevance is clear and specific
- [ ] Tonal alignment makes sense (no jarring mismatches)
- [ ] TELOS philosophy alignment is genuine
- [ ] Usage history checked (not recently used)
- [ ] Context provided if quote needs background
- [ ] Placement suggestion is appropriate
- [ ] Author diversity maintained
- [ ] At least 3 recommendations provided
- [ ] Recommendations are ranked/explained clearly

---

## Edge Cases

### What if No Perfect Match?

**Option 1: Expand search to related themes**
- Look for adjacent themes (e.g., resilience → strength → adversity)
- Consider complementary rather than identical matches

**Option 2: Research new quotes**
- Use research-thinker.md workflow to find relevant quotes from key thinkers
- Add new quotes to database and recommend

**Option 3: Use philosophical principles**
- Match to higher-level TELOS themes (wisdom, rationality, flourishing)
- Recommend quotes that align philosophically even if not directly on-topic

### What if User Rejects All Recommendations?

**Clarify preferences:**
- Ask: "What didn't resonate about these options?"
- Understand: Tone issue? Author issue? Message misalignment?
- Adjust: Provide new recommendations based on feedback

**Research on demand:**
- Offer to research specific thinker or theme
- Expand beyond current database
- Find exactly what user envisions

### What if Content is Multi-Themed?

**Two approaches:**

1. **Pick dominant theme** - Recommend quote matching primary theme
2. **Find unifying quote** - Recommend quote that speaks to multiple themes

**Example:**
Newsletter about "AI safety through careful engineering"
- Themes: Safety, caution, excellence, responsibility
- Unifying quote: Feynman on scientific honesty and rigor (when added)
- OR Marcus Aurelius on control and wisdom

---

## Integration with Other Workflows

### After Recommendation is Selected

**Update database:**
1. Use add-aphorism.md to update usage history
2. Note: Newsletter date, newsletter theme, placement
3. Maintain tracking for future variety

### If Quote Not in Database

**Add new quote:**
1. User provides or requests research for specific quote
2. Use add-aphorism.md to add with full metadata
3. Then recommend for current newsletter

### If Need Expanded Collection

**Research thinkers:**
1. Use research-thinker.md to populate thinker sections
2. Focus on themes matching newsletter needs
3. Build database for future recommendations

---

## Success Criteria

**Workflow succeeds when:**
- User receives 3-5 high-quality, relevant recommendations
- Each recommendation has clear rationale
- Thematic relevance is obvious
- User can confidently select a quote
- Selected quote enhances newsletter impact

**Quality indicators:**
- User says "perfect!" or "exactly what I needed"
- Minimal back-and-forth required
- Quote scores 35+ on matching criteria
- TELOS alignment is clear
- Recommendation saves user research time

---

## Example Execution

### User Input
"I'm writing a newsletter about how major security breaches happen from ignoring basic security hygiene. Find me a good aphorism."

### Step 1: Content Analysis
```markdown
### Content Analysis
- **Core Topic**: Security fundamentals, basics matter
- **Emotional Tone**: Cautionary, frustrated, emphasizing fundamentals
- **Key Messages**:
  1. Basics matter more than advanced techniques
  2. Ignoring fundamentals leads to failure
  3. Excellence requires discipline on basics
- **TELOS Themes**: Excellence & Mastery, Discipline, Learning (back to basics)
- **Audience**: Security professionals, technical readers
```

### Step 2: Database Search
Read database, identify matches in:
- "Excellence & Mastery" theme
- "Learning & Education" theme (fundamentals)
- Quotes emphasizing discipline and basics

### Step 3: Top Matches
1. Tim Grover (hard work = results) - 38/50
2. Muhammad Ali (suffer now = champion) - 37/50
3. Confucius (learning + thinking) - 35/50

### Step 4: Recommendations

```markdown
### Recommendation #1: Focus on What Matters (Tim Grover)

**Quote:**
"You don't have to love the hard work. You just have to crave the result so intensely that the hard work becomes irrelevant."

**Why This Fits:**
- **Thematic Relevance**: Security hygiene IS hard work - tedious, unglamorous, but critical
- **Tonal Alignment**: Uncompromising, results-focused matches newsletter's emphasis on fundamentals
- **Message Support**: Reinforces "basics matter" - the "hard work" IS the basics
- **TELOS Alignment**: Excellence through discipline, results > effort

**Placement Suggestion:**
Opening quote - Sets tone that security fundamentals are non-negotiable hard work

**Score:** 38/50

### Recommendation #2: The Price of Excellence (Muhammad Ali)

**Quote:**
"I hated every minute of training, but I said, 'Don't quit. Suffer now and live the rest of your life as a champion.'"

**Why This Fits:**
- **Thematic Relevance**: Training = security hygiene practice - boring but prevents breaches
- **Tonal Alignment**: Direct, honest about difficulty, emphasizes long-term payoff
- **Message Support**: "Suffer now" (do the boring security work) = "live as champion" (avoid breaches)
- **TELOS Alignment**: Delayed gratification, discipline, mastery

**Placement Suggestion:**
Closing quote - Motivates readers to commit to security fundamentals despite tedium

**Score:** 37/50

### Recommendation #3: Balance Theory and Practice (Confucius)

**Quote:**
"He who learns but does not think, is lost! He who thinks but does not learn is in great danger."

**Why This Fits:**
- **Thematic Relevance**: Security requires BOTH knowledge and applied practice (hygiene)
- **Tonal Alignment**: Warning tone matches cautionary newsletter mood
- **Message Support**: "Does not learn" (ignores basics) = "great danger" (breaches happen)
- **TELOS Alignment**: Integration of knowledge and action, wisdom through practice

**Placement Suggestion:**
Section divider - Connects learning about security to actually implementing hygiene

**Score:** 35/50
```

### Step 5: Quick Decision
```markdown
### Quick Decision Guide
- **For maximum impact on security professionals**: #1 (Tim Grover)
- **For motivational close**: #2 (Muhammad Ali)
- **For philosophical depth**: #3 (Confucius)
```

**User selects:** Tim Grover quote

**Update tracking:** Note usage in database

---

## Related Workflows

- **add-aphorism.md** - Update usage history after selection
- **research-thinker.md** - Expand database if no good matches
- **search-aphorisms.md** - Explore database by theme before analysis

---

**Last Updated:** 2025-11-20
