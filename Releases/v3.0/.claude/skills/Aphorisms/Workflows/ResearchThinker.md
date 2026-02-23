# Research Thinker Quotes

**Purpose:** Deep research on specific philosopher/thinker to discover relevant aphorisms aligned with TELOS philosophy, then add to database.

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the ResearchThinker workflow in the Aphorisms skill to research quotes"}' \
  > /dev/null 2>&1 &
```

Running **ResearchThinker** in **Aphorisms**...

---

**When to Use:**
- User requests research on specific thinker (Hitchens, Deutsch, Harris, Spinoza, Feynman)
- User says "research [thinker] quotes", "find [author] aphorisms", "what did [thinker] say about [topic]"
- Need to expand database with quotes from key philosophers
- Building out thinker sections in database

**Prerequisites:**
- Aphorism database exists at `~/.claude/skills/aphorisms/Database/aphorisms.md`
- Clear understanding of which thinker to research
- Optional: specific theme/topic to focus research on

---

## Workflow Steps

### Step 1: Identify Research Target

**Required:**
- **Thinker Name** - Which philosopher/author to research
- Must be one of the five key thinkers OR user-specified author

**Optional:**
- **Theme Focus** - Specific topic area (e.g., "Hitchens on rationality", "Feynman on doubt")
- **Quote Count** - How many quotes to find (default: 10-15 best quotes)

**Key Thinkers & Their Focus Areas:**

**Christopher Hitchens (1949-2011)**
- Focus: Rationality, skepticism, intellectual honesty, evidence-based thinking
- Key Works: God Is Not Great, Hitch-22, Letters to a Young Contrarian
- TELOS Alignment: Truth-seeking, questioning authority, rational discourse

**David Deutsch (1953-present)**
- Focus: Knowledge creation, optimism, explanations, problem-solving
- Key Works: The Beginning of Infinity, The Fabric of Reality
- TELOS Alignment: Progress through knowledge, problems are solvable, explanatory frameworks

**Sam Harris (1967-present)**
- Focus: Rationality, meditation, free will, morality, science
- Key Works: The End of Faith, Waking Up, Free Will, The Moral Landscape
- TELOS Alignment: Scientific rationality applied to ethics, mindfulness, evidence-based thinking

**Baruch Spinoza (1632-1677)**
- Focus: Ethics, reason, freedom through understanding, nature
- Key Works: Ethics, Tractatus Theologico-Politicus
- TELOS Alignment: Rational ethics, freedom through knowledge, understanding reality

**Richard Feynman (1918-1988)**
- Focus: Curiosity, scientific thinking, doubt as tool, clarity, intellectual honesty
- Key Works: Surely You're Joking Mr. Feynman, The Pleasure of Finding Things Out, The Character of Physical Law
- TELOS Alignment: Curiosity-driven learning, doubt enables knowledge, clarity of thought

---

### Step 2: Comprehensive Research

**Launch Parallel Research:**

Use Research Skill with multiple researchers for comprehensive coverage:

```bash
# Launch 3-5 parallel research agents
# Each focuses on different sources/angles
research_skill.parallel_research(
  query="[Thinker Name] most impactful quotes on [theme/general]",
  agents=["ClaudeResearcher", "GeminiResearcher"],
  depth="standard"
)
```

**Research Sources to Cover:**

1. **Primary Sources**
   - Direct quotes from books, speeches, interviews
   - Verified from original works
   - Proper attribution to specific source

2. **Quote Collections**
   - Goodreads, BrainyQuote, WikiQuote
   - Verify authenticity (many misattributions exist)
   - Cross-reference multiple sources

3. **Academic & Biographical Sources**
   - Biographies and scholarly analysis
   - Context for when quotes were said
   - Understanding thinker's philosophy

4. **Interviews & Lectures**
   - YouTube transcripts (use fabric -y)
   - Podcast appearances
   - Public talks and debates

**Research Queries:**

```
"[Thinker Name] most famous quotes"
"[Thinker Name] on [theme]"
"[Thinker Name] wisdom about [TELOS topic]"
"[Thinker Name] book quotes [Work Title]"
"[Thinker Name] interview quotes"
"best [Thinker Name] aphorisms"
```

---

### Step 3: Filter & Verify Quotes

**Initial Collection:**
- Gather 30-50 potential quotes from research
- Include source attribution for each

**Filtering Criteria:**

**1. Authenticity** (CRITICAL)
- Can quote be verified in primary source?
- Is attribution correct (not misattributed)?
- Cross-reference multiple sources
- When in doubt, mark as "Disputed" or skip

**2. TELOS Alignment** (HIGH PRIORITY)
- Does quote embody wisdom, rationality, truth-seeking?
- Aligns with user's philosophy?
- Relevant to human flourishing and progress?
- Actionable or profound insight?

**3. Quotability** (HIGH PRIORITY)
- Concise and memorable?
- Stands alone without extensive context?
- Clear meaning without specialized knowledge?
- Impactful phrasing?

**4. Thematic Relevance** (MEDIUM PRIORITY)
- Fits existing theme categories?
- Relevant to newsletter topics?
- Applicable to modern life?

**5. Uniqueness** (MEDIUM PRIORITY)
- Offers insight not already well-represented?
- Different angle or perspective?
- Not redundant with existing database quotes?

**Filter down to top 10-15 quotes:**
- All must pass Authenticity check
- Most should score high on TELOS Alignment and Quotability
- Variety across themes
- Represent thinker's philosophy well

---

### Step 4: Add Context for Each Quote

**For each selected quote, provide:**

**1. Source**
- Book title, chapter, page (if available)
- Speech/lecture title and date
- Interview source and date
- Original publication

**2. Background**
- What was context when said?
- What was thinker addressing?
- Why is this significant?
- How does it represent their philosophy?

**3. Relevance**
- Why does this matter for the user's audience?
- How does it apply to modern life?
- Connection to TELOS philosophy?
- Practical wisdom it provides?

**Example:**

**Quote:** "What can be asserted without evidence can be dismissed without evidence."
**Source:** Christopher Hitchens, "God Is Not Great" (2007)
**Background:** Hitchens' formulation of the burden of proof - often called "Hitchens' Razor." Counters unfalsifiable claims by establishing that extraordinary claims require evidence. Core to his skeptical methodology.
**Relevance:** Essential for critical thinking in age of misinformation. Applies to evaluating AI claims, security threats, market hype - anything requiring evidence-based assessment.

---

### Step 5: Organize by Theme

**Group quotes by primary theme:**

- Work Ethic & Excellence
- Resilience & Strength
- Curiosity & Intelligence
- Learning & Education
- Stoicism & Control
- Risk & Action
- Wisdom & Truth-Seeking (if creating new category)
- Rationality & Evidence
- Etc.

**Within each theme:**
- Order by impact/quotability
- Or chronologically by when said
- Or by source (book order)

**Purpose:**
- Makes database more useful for find-aphorism workflow
- Shows breadth of thinker's wisdom
- Easier to discover relevant quotes

---

### Step 6: Format for Database

**Use standard format for each quote:**

```markdown
**"[Full quote text]"**
- Author: [Thinker Name]
- Theme: [Primary Theme], [Secondary Theme]
- Context: [Source and background - 1-3 sentences]
```

**Organize under thinker section:**

```markdown
### [Thinker Name]

#### [Theme Category 1]

**"[Quote 1]"**
- Author: [Name]
- Theme: [Themes]
- Context: [Context]

**"[Quote 2]"**
- Author: [Name]
- Theme: [Themes]
- Context: [Context]

#### [Theme Category 2]

[More quotes...]
```

---

### Step 7: Add to Database

**Read current database:**
```bash
Read ~/.claude/skills/aphorisms/Database/aphorisms.md
```

**Locate thinker's section:**
- Find: `### [Thinker Name]`
- Section should exist with placeholder: `*Quotes to be added from research*`

**Use Edit to replace placeholder:**
```bash
Edit(
  file_path=~/.claude/skills/aphorisms/Database/aphorisms.md,
  old_string="### [Thinker Name]\n*Quotes to be added from research*",
  new_string="### [Thinker Name]\n\n[Organized quotes with themes and context]"
)
```

**Update Theme Index:**
- Add thinker's name to relevant theme categories
- Ensure index reflects new quotes

---

### Step 8: Report Findings

**Summary for User:**

```markdown
## [Thinker Name] Research Complete

**Total Quotes Added:** [N]

**Quotes by Theme:**
- [Theme 1]: [N] quotes
- [Theme 2]: [N] quotes
- [Theme 3]: [N] quotes

**Highlight: Top 3 Quotes**

1. **"[Quote 1]"**
   - Theme: [Theme]
   - Why Notable: [Reason]

2. **"[Quote 2]"**
   - Theme: [Theme]
   - Why Notable: [Reason]

3. **"[Quote 3]"**
   - Theme: [Theme]
   - Why Notable: [Reason]

**Philosophy Summary:**
[2-3 sentences capturing thinker's core philosophy as represented in quotes]

**TELOS Alignment:**
[How this thinker's wisdom aligns with user's philosophy]

**Best Use Cases:**
- Newsletter about [topic] → Quote #X
- Newsletter about [topic] → Quote #Y
- General wisdom → Quote #Z

**Database Stats:**
- Total aphorisms: [N]
- Total from [Thinker]: [N]
- Themes covered: [N]
```

---

## Advanced Research Techniques

### Cross-Reference Analysis

Compare thinker's quotes to existing database:
- Find complementary quotes (different perspectives on same theme)
- Identify gaps in theme coverage
- Discover unique angles thinker provides

### Chronological Analysis

Research thinker's evolution:
- Early career quotes vs late career
- How philosophy developed over time
- Most impactful periods

### Debate & Discussion Mining

Find quotes from debates/discussions:
- Thinker responding to criticism
- Defending or explaining positions
- Spontaneous wisdom (not just prepared writing)

---

## Special Considerations by Thinker

### Christopher Hitchens
**Research Tips:**
- Prolific writer - focus on most famous works
- Excellent debater - YouTube debates are goldmines
- Clear, quotable style - many shareable quotes
- Watch for: Skepticism, rational inquiry, intellectual honesty

**Priority Sources:**
1. God Is Not Great
2. Letters to a Young Contrarian
3. Debates (vs D'Souza, Craig, Blair, etc.)

### David Deutsch
**Research Tips:**
- Complex ideas - may need context for quotes to land
- Focus on optimism, problem-solving, knowledge creation
- Less traditionally "quotable" - focus on explanatory power
- Watch for: Epistemology, progress, infinite potential

**Priority Sources:**
1. The Beginning of Infinity
2. The Fabric of Reality
3. Interviews and lectures

### Sam Harris
**Research Tips:**
- Multiple domains - rationality, meditation, ethics, politics
- Podcast gold - "Making Sense" episodes
- Balance scientific rationality with contemplative wisdom
- Watch for: Evidence-based thinking, mindfulness, moral clarity

**Priority Sources:**
1. The End of Faith
2. Waking Up
3. Making Sense podcast quotes
4. Debates and talks

### Baruch Spinoza
**Research Tips:**
- Historical - language may need modernization
- Dense philosophy - extract clearest statements
- Focus on ethics, freedom, reason
- Watch for: Understanding = freedom, rational ethics

**Priority Sources:**
1. Ethics (primary work)
2. Tractatus Theologico-Politicus
3. Secondary sources explaining Spinoza
4. Scholarly interpretations

### Richard Feynman
**Research Tips:**
- Extremely quotable - focus on best of best
- Scientific thinking applicable beyond physics
- Humor and humanity alongside rigor
- Watch for: Curiosity, doubt, clarity, honesty

**Priority Sources:**
1. Surely You're Joking, Mr. Feynman
2. The Pleasure of Finding Things Out
3. The Character of Physical Law
4. Caltech lectures and interviews

---

## Quality Checks

Before finalizing research:

- [ ] All quotes verified from primary or reliable sources
- [ ] Attributions confirmed (no misattributions)
- [ ] 10-15 high-quality quotes selected
- [ ] Each quote has context (source, background, relevance)
- [ ] Themes assigned appropriately
- [ ] TELOS alignment clear for all quotes
- [ ] Quotes organized by theme
- [ ] Formatted correctly for database
- [ ] Database updated with quotes
- [ ] Theme index updated
- [ ] Report provided to user with highlights

---

## Edge Cases

### What if Research Yields No Good Quotes?

**Reasons:**
1. Thinker doesn't align with TELOS philosophy
2. Thinker's style isn't quotable (dense academic prose)
3. Works not readily accessible

**Solutions:**
1. Focus on interviews/speeches (more quotable than books)
2. Extract core ideas and find clearest statements
3. Recommend different thinker better aligned

### What if Too Many Great Quotes?

**Prioritize:**
1. Most impactful and memorable
2. Best TELOS alignment
3. Variety across themes
4. Can add more in phases

**Consider:**
- Add top 10-15 now
- Keep research notes for future additions
- Phase 2: Add next 10 quotes later

### What if Quotes Need Heavy Context?

**Two approaches:**
1. **Include minimal context** - Let quote stand alone with brief source note
2. **Add extended context** - If understanding requires background

**Example:**
Spinoza's philosophical language might need more context than Feynman's accessible style.

---

## Integration with Other Workflows

### After Research Complete

**Immediately available for:**
- **find-aphorism.md** - New quotes searchable for newsletter matching
- **search-aphorisms.md** - Discoverable via theme/author search

### Ongoing Research

**Track research progress:**
- Hitchens: ✅ Complete (15 quotes added)
- Feynman: ✅ Complete (12 quotes added)
- Harris: 🔄 In progress
- Deutsch: ⏳ Planned
- Spinoza: ⏳ Planned

### Iterative Enhancement

**Phase 1:** Core quotes from each thinker (10-15)
**Phase 2:** Expand with more quotes (10+ more)
**Phase 3:** Add new thinkers based on newsletter needs

---

## Success Criteria

**Research succeeds when:**
- 10-15 verified, high-quality quotes added
- All quotes have proper context and themes
- TELOS alignment clear for each
- Thinker's philosophy well-represented
- Quotes immediately useful for newsletter selection
- User understands thinker's contribution

**Quality indicators:**
- Quotes feel authentic and impactful
- Context helps understand when/how to use
- Theme diversity shows thinker's breadth
- find-aphorism workflow can leverage new quotes effectively

---

## Example Execution

### User Input
"Research Richard Feynman quotes about curiosity and scientific thinking"

### Step 1: Identify Target
- **Thinker:** Richard Feynman
- **Focus:** Curiosity, scientific thinking, doubt, learning
- **Target:** 10-15 best quotes

### Step 2: Research
Launch parallel researchers:
- Search: "Feynman quotes on curiosity"
- Search: "Feynman scientific method quotes"
- Search: "Feynman The Pleasure of Finding Things Out"
- Search: "Feynman doubt and uncertainty"

Sources:
- Surely You're Joking, Mr. Feynman
- The Pleasure of Finding Things Out (book and speech)
- Caltech lectures
- Interviews

### Step 3: Filter
Initial: 45 potential quotes
Verified: 28 authentic
TELOS-aligned: 22
Most quotable: 15 selected

### Step 4: Add Context
Example:
**"I would rather have questions that can't be answered than answers that can't be questioned."**
- Source: Attributed to Feynman, though exact source debated; consistent with his philosophy
- Background: Feynman's core epistemology - doubt enables knowledge
- Relevance: Essential for scientific thinking, questioning AI hype, avoiding dogma

### Step 5: Organize by Theme
- Curiosity & Intelligence: 5 quotes
- Learning & Education: 4 quotes
- Wisdom & Truth-Seeking: 3 quotes
- Risk & Action (experimenting): 3 quotes

### Step 6: Format
```markdown
### Richard Feynman

#### Curiosity & Intelligence

**"I would rather have questions that can't be answered than answers that can't be questioned."**
- Author: Richard Feynman
- Theme: Curiosity & Intelligence, Wisdom & Truth-Seeking
- Context: Feynman's epistemology - doubt enables knowledge growth. Essential for scientific thinking and avoiding dogma.

[14 more quotes...]
```

### Step 7: Add to Database
Use Edit to replace placeholder in Feynman section

### Step 8: Report
```markdown
## Richard Feynman Research Complete

**Total Quotes Added:** 15

**Quotes by Theme:**
- Curiosity & Intelligence: 5 quotes
- Learning & Education: 4 quotes
- Wisdom & Truth-Seeking: 3 quotes
- Risk & Action: 3 quotes

**Highlight: Top 3 Quotes**

1. **"I would rather have questions that can't be answered than answers that can't be questioned."**
   - Theme: Curiosity & Truth-Seeking
   - Why Notable: Captures scientific method essence and intellectual honesty

[2 more highlights...]

**Philosophy Summary:**
Feynman embodied curiosity-driven learning combined with radical intellectual honesty. His emphasis on doubt as a tool, pleasure in discovery, and clarity of explanation makes him perfect for TELOS philosophy.

**TELOS Alignment:**
Perfect alignment with truth-seeking, rationality, and continuous learning. His quotes inspire curiosity while maintaining rigorous standards for evidence and explanation.

**Best Use Cases:**
- Newsletter about learning → Multiple options
- Newsletter about questioning AI claims → "Questions vs answers" quote
- Newsletter about scientific thinking → Any Feynman quote
```

---

## Related Workflows

- **add-aphorism.md** - Individual quote addition (research feeds into this)
- **find-aphorism.md** - Use researched quotes for newsletter recommendations
- **search-aphorisms.md** - Search new quotes by theme

---

**Last Updated:** 2025-11-20
