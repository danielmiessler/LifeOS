# Interview Workflow

Extract the writer's vision, ideas, and preferences into structured input for the Story Bible.

## Purpose

This is the entry point for writers who have ideas — ranging from a single character concept to years of accumulated notes — but need help structuring them into a layered narrative plan.

## Procedure

### Step 1: Consume Available Input

If the writer has provided content (text, notes, outlines, character descriptions, world details), read ALL of it first.

Extract and categorize everything into the seven layers:
- **Meaning signals:** What themes, lessons, or philosophical questions are present?
- **Character signals:** Who are the characters? What flaws, desires, fears?
- **Plot signals:** What events, conflicts, sequences are described?
- **Mystery signals:** What questions does the story raise? What's hidden?
- **World signals:** Setting details, rules, politics, geography?
- **Relationship signals:** Key bonds, rivalries, romances, mentorships?
- **Prose signals:** What voice/style does the writer seem to favor?

### Step 2: Assess Completeness

For each layer, rate completeness on a scale:
- **Rich** (60%+ fleshed out) — Writer has clear vision here
- **Partial** (20-60%) — Some ideas but gaps remain
- **Sparse** (< 20%) — Nearly empty, needs significant development
- **Empty** — No signal at all

### Step 3: Interview for Missing Layers

Use AskUserQuestion to fill gaps. Interview in this priority order:

**Priority 1: Character Change (if not rich)**
```
Questions to ask:
- "Who is your main character, and what is their deepest flaw —
   the thing they believe about themselves or the world that holds them back?"
- "How do you want them to be different by the end?"
- "What's the worst thing that could happen to them? (This often reveals the crisis point)"
```

**Priority 2: Meaning (if not rich)**
```
Questions to ask:
- "What do you want the reader to FEEL when they finish this story?"
- "If someone asked 'what is this story about?' and you couldn't mention the plot, what would you say?"
- "What stories have made you feel the way you want your readers to feel?"
```

**Priority 3: Plot (if not rich)**
```
Questions to ask:
- "What's the first big thing that happens to disrupt the main character's life?"
- "What's the climactic moment you see most clearly?"
- "How does the story end? (Even a rough sense: triumph? bittersweet? tragic?)"
```

**Priority 4: Mystery (if not rich)**
```
Questions to ask:
- "What's the big question that should keep the reader turning pages?"
- "Are there secrets that characters are keeping from each other?"
- "What reveal are you most excited about?"
```

**Priority 5: World (if sparse/empty)**
```
Questions to ask:
- "What kind of world is this? (Time period, technology level, magic?)"
- "What are the key power structures? (Who's in charge? Who's oppressed?)"
- "What makes this world different from every other fantasy/sci-fi world?"
```

**Priority 6: Relationships (if sparse/empty)**
```
Questions to ask:
- "Who is the most important relationship for your main character?"
- "Is there a character who challenges the protagonist's worldview?"
- "Any key friendships, romances, rivalries, or mentorships?"
```

**Priority 7: Prose/Aesthetic (if sparse/empty)**
```
Questions to ask:
- "What writers do you love? Whose style would you want this to feel like?"
- "Should this be funny, dark, lyrical, sparse, epic?"
- "How long do you envision this? (Short story, novel, series?)"
```

### Step 4: Favorite Stories Analysis

Ask the writer:
```
"What are your 3-5 favorite stories (books, films, shows, games)?
For each: what specifically did you love about them?"
```

Analyze their answers to extract:
- Aesthetic preferences (what kind of prose/pacing they respond to)
- Thematic interests (what themes recur in their favorites)
- Structural patterns (do they like mysteries? epic journeys? character studies?)
- Emotional targets (do they love tragedy? triumph? bittersweet?)

### Step 5: Ideal Reader Experience

Ask directly:
```
"Imagine someone finishes reading your story. What do you want them to feel?
Would they cry? Be blown away by a twist? Feel hope? Question everything?
Describe the IDEAL emotional reaction."
```

This answer becomes a critical ISC criterion.

### Step 6: Scope Assessment

Based on everything gathered, assess scope:

| Scope | Length | ISC Scale | Layers Detail |
|-------|--------|-----------|--------------|
| **Short Story** | 2,000-15,000 words | 50-200 criteria | Focused — 2-3 layers primary |
| **Novella** | 15,000-50,000 words | 200-500 criteria | 4-5 layers active |
| **Novel** | 50,000-120,000 words | 500-2,000 criteria | All 7 layers active |
| **Epic Novel** | 120,000-250,000 words | 2,000-5,000 criteria | All 7 layers deep |
| **Series** | 250,000+ words total | 5,000-100,000 criteria | All 7 layers + cross-book arcs |

Use AskUserQuestion to confirm scope with the writer.

### Step 7: Compile Structured Output

Create a structured summary organized by layer:

```markdown
# Story Concept: [Working Title]

## Scope: [Short Story / Novella / Novel / Series]
## Aesthetic: [Primary profile + any blending]

## Layer 1: Meaning
[Everything extracted about theme]

## Layer 2: Character Change
### Main Character
- Name: [if known]
- Sacred Flaw: [the misbelief]
- External Want: [what they pursue]
- Internal Need: [what they actually need]
- Origin Wound: [what created the flaw]
- Arc Direction: [positive/negative/flat]

### [Other major characters with same structure]

## Layer 3: Plot
[Known events, conflicts, sequences, ending]

## Layer 4: Mystery
[Known questions, secrets, reveals]

## Layer 5: World
[Setting, rules, politics, geography]

## Layer 6: Relationships
[Key bonds and their dynamics]

## Layer 7: Prose
[Style preferences, aesthetic profile, voice]

## Ideal Reader Experience
[What the reader should feel at the end]

## Favorite Stories Analysis
[What the writer's favorites tell us about their taste]
```

### Step 8: Handoff

Output the structured summary and recommend next step:
- If enough detail exists for major beats → recommend **BuildBible** workflow
- If the writer wants to explore ideas further → recommend **Explore** workflow
- If they want to start writing immediately from what exists → recommend **WriteChapter** workflow

Store the structured output as the foundation for the Story Bible PRD.
