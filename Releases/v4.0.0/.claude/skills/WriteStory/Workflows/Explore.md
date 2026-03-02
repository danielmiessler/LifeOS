# Explore Workflow

Creative divergence engine for generating fresh, original story ideas. Uses multiple agents and the BeCreative skill for wide exploration.

## Purpose

When the writer needs ideas — for characters, plot twists, world details, mystery structures, or any story element — this workflow generates multiple creative options through parallel exploration.

## When to Use

- Writer says "I'm stuck" or "I need ideas for..."
- A layer in the Story Bible is sparse/empty
- Writer wants to explore "what if" scenarios
- Need fresh alternatives to avoid cliché territory
- Want to combine known-great elements in new ways

## Procedure

### Step 1: Define the Exploration Target

Identify what needs creative exploration:
- Which layer? (Character, Plot, Mystery, World, Relationships, Meaning, Prose)
- What constraints exist? (Must fit existing story, must match genre, etc.)
- How wild should it get? (Conservative variations vs. radically different approaches)

### Step 2: Gather Context

Read relevant Story Bible sections (if they exist) to understand:
- What's already decided (constraints)
- What tone/genre the story operates in
- Which characters and plot points are fixed
- The sacred flaw and thematic direction

### Step 3: Launch Creative Exploration

Deploy multiple approaches in parallel using Task tool agents:

**Approach A: Combinatorial Exploration**
Spawn 2-4 agents, each combining different known-great story elements:
```
Agent prompt: "Given these story constraints: [constraints]
Combine elements from [2-3 reference stories] in a fresh way.
Generate 3 ideas for [target layer].
Each idea must: be original, serve the sacred flaw, avoid the cliché list.
SLA: Return in 90 seconds."
```

**Approach B: Constraint Reversal**
Spawn 1-2 agents that deliberately invert expectations:
```
Agent prompt: "Given these story constraints: [constraints]
What would the OPPOSITE of the expected [layer element] be?
What if the most obvious choice is wrong?
Generate 3 contrarian ideas that still serve the story.
SLA: Return in 60 seconds."
```

**Approach C: BeCreative Deep Dive**
Use the BeCreative skill for extended thinking on the most promising angle:
```
"Apply extended creative thinking to: [specific creative problem]
Consider: what hasn't been done before in [genre]?
What would make a reader say 'I've never seen that before'?
Use the full thinking budget."
```

**Approach D: Cross-Genre Pollination**
Spawn agents that borrow from other genres/media:
```
Agent prompt: "This is a [genre] story about [premise].
What would a [different genre] storyteller bring to this?
How would a mystery writer handle the character arc?
How would a romance writer handle the political plot?
Generate 2 cross-pollinated ideas.
SLA: Return in 60 seconds."
```

### Step 4: Anti-Cliché Filter

Read `AntiCliche.md` and apply the freshness checks to all generated ideas:
- Does this feel like the first thing anyone would think of?
- Has this been done in major fiction in the last 20 years?
- Could you describe this idea using only genre tropes?

If YES to any → flag it and push for fresher alternatives.

### Step 5: Present Options

Present the best ideas to the writer in this format:

```
## Creative Exploration Results: [Target]

### Option 1: [Evocative Name]
**The idea:** [2-3 sentence description]
**Why it works:** [How it serves the story/theme/character]
**Risk:** [What could go wrong with this approach]
**Freshness:** [What makes this NOT the obvious choice]

### Option 2: [Evocative Name]
[same format]

### Option 3: [Evocative Name]
[same format]

### Wild Card: [The Unexpected One]
**The idea:** [The most daring/unconventional option]
**Why it might be genius:** [The upside]
**Why it might fail:** [The risk]
```

### Step 6: Iterate or Integrate

Based on writer's response:
- **"I love option 2"** → Integrate into Story Bible, update relevant layer
- **"I like parts of 1 and 3"** → Combine elements, present synthesis
- **"None of these work, but they made me think of..."** → The exploration did its job — capture what it triggered and integrate
- **"Go deeper on option 1"** → Spawn more agents to develop that direction in detail

### Step 7: Update Story Bible

After a direction is chosen:
1. Update the relevant layer in the Story Bible PRD
2. Create/update ISC criteria for the new elements
3. Check for ripple effects on other layers (new character detail may affect plot, mystery, etc.)
4. Flag any new gaps created by the change

## Exploration Templates by Layer

### Character Exploration
- "What if the sacred flaw was [X] instead of [Y]?"
- "What if the origin wound happened differently?"
- "What if this character's arc was negative instead of positive?"

### Plot Exploration
- "What if the catalyst was [X] instead of [Y]?"
- "What if the midpoint was a false defeat instead of false victory?"
- "What if the ending was bittersweet instead of triumphant?"

### Mystery Exploration
- "What if the reader thinks [X] but it's actually [Y]?"
- "What if the biggest mystery is about [character] rather than [plot event]?"
- "What are five things the reader could be wrong about?"

### World Exploration
- "What unique rule/constraint would create the most interesting conflicts?"
- "What if this world's history had one key difference from the obvious?"
- "What cultural detail would most pressure the sacred flaw?"

### Relationship Exploration
- "What if these two characters had [unexpected dynamic] instead of [obvious one]?"
- "Who is the unlikely ally? The surprising antagonist?"
- "What relationship would most challenge the protagonist's sacred flaw?"
