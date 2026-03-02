# Add Aphorism to Database

**Purpose:** Add new aphorism to the database with proper metadata, theme tagging, and organization.

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the AddAphorism workflow in the Aphorisms skill to add quotes"}' \
  > /dev/null 2>&1 &
```

Running **AddAphorism** in **Aphorisms**...

---

**When to Use:**
- User provides a quote to add to collection
- User says "add this quote", "save this aphorism", "add to database"
- Found great quote during research that should be preserved
- After research-thinker.md discovers quotes worth adding

**Prerequisites:**
- Aphorism database exists at `~/.claude/skills/aphorisms/Database/aphorisms.md`
- Quote text and author provided (or discoverable through research)
- Database is Read first to check for duplicates

---

## Workflow Steps

### Step 1: Parse Input

**Required Information:**
- **Quote Text** - Full quote in exact wording
- **Author** - Person who said/wrote it

**Optional Information (will research if not provided):**
- **Themes** - Categories this quote fits
- **Context** - Background, source, when it was said
- **Source** - Book, speech, interview, etc.

**Example Input Formats:**

```markdown
User: "Add this quote: 'The cure for boredom is curiosity. There is no cure for curiosity.' - Dorothy Parker"

User: "Save this to the database:
Quote: Walk away from anything or anyone who takes away from your joy. Life is too short to put up with fools.
Author: Unknown"

User: "Add Feynman's quote about doubt being essential to science"
(Will need to research specific wording)
```

---

### Step 2: Verify Quote Accuracy

**If exact quote text provided:**
- Use WebSearch to verify wording and attribution
- Check for common misattributions
- Confirm author if "Unknown" or uncertain

**If paraphrased or remembered:**
- Research to find exact wording
- Verify correct source
- Get full quote if user only provided partial

**Verification Steps:**
```bash
# Search for exact quote
WebSearch("\"[quote text]\" [author name] quote")

# Verify attribution
WebSearch("[author name] quotes + [key words from quote]")

# Check common misattributions
WebSearch("misattributed quotes [author name]")
```

**Output:**
- ✅ Verified exact text
- ✅ Confirmed correct attribution
- ✅ Source identified (if available)

---

### Step 3: Check for Duplicates

**Read database:**
```bash
Read ~/.claude/skills/aphorisms/Database/aphorisms.md
```

**Check for:**
1. **Exact duplicate** - Same quote already exists
2. **Similar quote** - Same author, similar message
3. **Paraphrase** - Different wording, same meaning

**If duplicate found:**
- Notify user: "This quote is already in the database in [section]"
- Ask: "Would you like to update context or themes?"
- OR: "This is similar to [existing quote]. Add anyway?"

**If unique:**
- Proceed to Step 4

---

### Step 4: Analyze Themes

**Identify Primary Themes:**

Use the established theme categories:
- **Work Ethic & Excellence** - Craft, mastery, high standards, results
- **Resilience & Strength** - Adversity, persistence, growth through challenge
- **Fear & Mindset** - Overcoming fear, reframing, mental approach
- **Passion & Enthusiasm** - Full commitment, love for craft, intensity
- **Competition & Progress** - Self-improvement, personal growth, benchmarks
- **Curiosity & Intelligence** - Learning, questioning, intellectual drive
- **Investment & Self-Development** - Personal growth, skill building
- **Present Moment & Enjoyment** - Mindfulness, appreciation, being here now
- **Learning & Education** - Knowledge acquisition, continuous improvement
- **Stoicism & Control** - Internal locus, acceptance, discipline
- **Risk & Action** - Courage, failure acceptance, experimentation
- **Adversity** - Challenges, setbacks, overcoming difficulty

**Assign 1-3 primary themes:**
- Must be specific and accurate
- Err on side of fewer, more accurate themes vs many vague ones
- Consider what newsletter topics this would fit

**Example Analysis:**

Quote: "The cure for boredom is curiosity. There is no cure for curiosity."
**Themes:**
1. Curiosity & Intelligence (PRIMARY)
2. Passion & Enthusiasm (SECONDARY)

Quote: "Walk away from anything or anyone who takes away from your joy."
**Themes:**
1. Present Moment & Enjoyment (PRIMARY)
2. Stoicism & Control (SECONDARY - choosing what affects you)

---

### Step 5: Add Context

**Provide background for the quote:**

**Context should include:**
1. **Source** - Where did this quote come from?
   - Book title, speech, interview, letter, etc.
   - Year if known

2. **Background** - What was happening when this was said?
   - Circumstances
   - Original intended meaning
   - Why it's significant

3. **Relevance** - Why does this matter for the audience?
   - How it applies to modern life
   - Connection to TELOS philosophy
   - Practical wisdom it provides

**If context not immediately known:**
```bash
WebSearch("[author name] '[quote snippet]' context source")
WebSearch("[author name] biography + [time period/work]")
```

**Example Context:**

Quote: "You have power over your mind - not outside events."
**Context:**
- Source: Meditations by Marcus Aurelius (Book 12, written ~170 AD)
- Background: Written as personal reflections while on military campaign
- Relevance: Stoic philosophy's dichotomy of control - foundational to mental strength and resilience

---

### Step 6: Format for Database

**Standard Format:**

```markdown
**"[Full quote text]"**
- Author: [Author Name]
- Theme: [Theme 1], [Theme 2], [Theme 3]
- Context: [Source and background]
```

**Example:**

```markdown
**"The cure for boredom is curiosity. There is no cure for curiosity."**
- Author: Dorothy Parker
- Theme: Curiosity & Intelligence, Passion & Enthusiasm
- Context: American poet and wit (1893-1967). Captures the endless nature of intellectual curiosity - the more you learn, the more you want to learn.
```

---

### Step 7: Determine Placement

**Where in database does this go?**

**Option 1: Add to Theme Section**
- If matching an existing theme collection
- Place alphabetically by author within theme

**Option 2: Add to Thinker Section**
- If quote is from one of the five key thinkers (Hitchens, Deutsch, Harris, Spinoza, Feynman)
- Add to appropriate thinker's section

**Option 3: Add to Initial Collection**
- If general quote not from key thinker
- Add chronologically to main collection

**Option 4: Create New Section**
- If this starts a new category or author collection
- Propose new section to user first

---

### Step 8: Update Theme Index

**Theme Index Section:**

Add quote reference to appropriate theme(s) in Theme Index section:

```markdown
## Theme Index

**Curiosity & Intelligence:**
- Aaron Swartz, Dorothy Parker
```

**Update format:**
- Add author to theme list (alphabetically)
- Keep index concise (just author names)
- Multiple themes = author appears multiple times

---

### Step 9: Write to Database

**Use Edit tool to add quote:**

```bash
# Find appropriate section
Read ~/.claude/skills/aphorisms/Database/aphorisms.md

# Add to correct location
Edit(
  file_path=~/.claude/skills/aphorisms/Database/aphorisms.md,
  old_string="[section where it should be inserted]",
  new_string="[section with new quote added]"
)
```

**Update multiple sections:**
1. Add formatted quote to main collection
2. Update theme index with author
3. If usage tracking enabled, initialize empty entry

---

### Step 10: Confirm Addition

**Summary for User:**

```markdown
✅ **Aphorism Added Successfully**

**Quote:** "[quote text]"
**Author:** [Author Name]
**Themes:** [Theme 1], [Theme 2]

**Added to:**
- Main Collection: [Section name]
- Theme Index: Updated [N] theme(s)

**Database Stats:**
- Total aphorisms: [N]
- Authors: [N]
- Themes covered: [N]

**Ready to use in:** Newsletter recommendations, theme searches
```

---

## Advanced Features

### Batch Addition

If user provides multiple quotes:

```markdown
User: "Add these three quotes from Feynman:
1. [Quote 1]
2. [Quote 2]
3. [Quote 3]"
```

**Process:**
1. Parse all quotes
2. Verify each (may need research)
3. Analyze themes for all
4. Add context to each
5. Add all to database in single Edit
6. Update theme index once
7. Provide batch summary

### Research-Driven Addition

If quote text not provided:

```markdown
User: "Add Spinoza's quote about freedom through understanding"
```

**Process:**
1. Research Spinoza quotes on freedom/understanding
2. Find exact quote text
3. Present options to user if multiple matches
4. User selects preferred version
5. Proceed with normal addition workflow

### Update Existing Quote

If quote exists but needs better context:

```markdown
User: "Update the Marcus Aurelius quote with more context"
```

**Process:**
1. Find quote in database
2. Research additional context
3. Edit existing entry
4. Preserve themes and attribution
5. Confirm update

---

## Quality Checks

Before finalizing addition:

- [ ] Quote text verified as accurate
- [ ] Attribution verified as correct
- [ ] No exact duplicates in database
- [ ] 1-3 appropriate themes assigned
- [ ] Context provided (source, background, relevance)
- [ ] Formatted correctly for database
- [ ] Placed in appropriate section
- [ ] Theme index updated
- [ ] Addition confirmed to user

---

## Edge Cases

### What if Author is Uncertain?

**Use "Unknown" or "Disputed":**
```markdown
**"[Quote text]"**
- Author: Unknown (often attributed to [Name 1], [Name 2])
- Theme: [Themes]
- Context: This quote is commonly attributed to [Name] but cannot be verified. [Background on why quote is valuable despite uncertain origin]
```

### What if Quote Has Multiple Versions?

**Choose canonical version or add note:**
```markdown
**"[Primary version]"**
- Author: [Author Name]
- Theme: [Themes]
- Context: [Background]. Note: This quote appears in multiple variations; this is the most commonly cited version from [Source].
```

### What if Quote is Misattributed?

**Correct attribution:**
```markdown
User: "Add Einstein quote: 'Everyone is a genius...'"
Research: Actually from Unknown author, falsely attributed to Einstein

Response: "This quote is commonly misattributed to Einstein but has no verified source. Would you like to:
1. Add it as 'Unknown' with note about misattribution
2. Skip adding this quote
3. Research similar authentic Einstein quotes"
```

### What if Themes Don't Fit Existing Categories?

**Propose new category:**
```markdown
"This quote about [topic] doesn't fit our existing themes well. Options:
1. Add to closest theme: [Theme X]
2. Create new theme category: [Proposed Theme]
3. Add to general collection without specific theme

Which would you prefer?"
```

---

## Integration with Other Workflows

### After Addition

**Available for:**
- **find-aphorism.md** - Immediately searchable for newsletter matching
- **search-aphorisms.md** - Discoverable via theme/keyword search

### Bulk Import

If adding many quotes from research:
1. Use research-thinker.md to gather quotes
2. Then batch add via this workflow
3. Maintain quality checks for each

### Usage Tracking

When quote is used in newsletter:
```markdown
## Newsletter Usage History

**"[Quote text]" - [Author]**
- Used in: 2025-11-20 Newsletter "Overcoming Setbacks"
- Placement: Opening quote
```

---

## Success Criteria

**Addition succeeds when:**
- Quote accurately captured with correct attribution
- Appropriate themes assigned
- Context provides value for future selection
- Database organization maintained
- Theme index updated
- No duplicates created
- User receives confirmation

**Quality indicators:**
- Quote is immediately useful for find-aphorism workflow
- Future search will surface this quote for relevant themes
- Context helps understand when/how to use it
- Attribution is verifiable

---

## Example Execution

### User Input
"Add this quote: 'The important thing is not to stop questioning. Curiosity has its own reason for existing.' - Einstein"

### Step 1: Parse
- Quote: "The important thing is not to stop questioning. Curiosity has its own reason for existing."
- Author: Albert Einstein

### Step 2: Verify
```bash
WebSearch("\"The important thing is not to stop questioning\" Einstein")
```
**Result:** Verified - from 1955 interview

### Step 3: Check Duplicates
Read database - NOT FOUND, unique quote

### Step 4: Analyze Themes
**Primary Themes:**
1. Curiosity & Intelligence (PRIMARY - directly about questioning/curiosity)
2. Learning & Education (SECONDARY - implies lifelong learning)

### Step 5: Add Context
**Context:** From Einstein's 1955 interview "Old Man's Advice to Youth." Emphasizes intrinsic value of curiosity beyond practical applications.

### Step 6: Format
```markdown
**"The important thing is not to stop questioning. Curiosity has its own reason for existing."**
- Author: Albert Einstein
- Theme: Curiosity & Intelligence, Learning & Education
- Context: From 1955 interview "Old Man's Advice to Youth." Emphasizes intrinsic value of curiosity beyond practical applications.
```

### Step 7: Determine Placement
- Add to Initial Collection (Einstein not one of five key thinkers)
- Add chronologically

### Step 8: Update Theme Index
```markdown
**Curiosity & Intelligence:**
- Aaron Swartz, Dorothy Parker, Albert Einstein
```

### Step 9: Write to Database
Use Edit tool to insert in appropriate section

### Step 10: Confirm
```markdown
✅ **Aphorism Added Successfully**

**Quote:** "The important thing is not to stop questioning. Curiosity has its own reason for existing."
**Author:** Albert Einstein
**Themes:** Curiosity & Intelligence, Learning & Education

**Added to:**
- Main Collection: Initial Collection (Curiosity & Intelligence section)
- Theme Index: Updated 2 themes

**Database Stats:**
- Total aphorisms: 16
- Authors: 14
- Themes covered: 12

**Ready to use in:** Newsletter recommendations, theme searches
```

---

## Related Workflows

- **find-aphorism.md** - Use newly added quotes in recommendations
- **search-aphorisms.md** - Search will now find this quote
- **research-thinker.md** - Often feeds into this workflow

---

**Last Updated:** 2025-11-20
