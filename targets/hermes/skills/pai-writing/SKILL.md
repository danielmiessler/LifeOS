---
name: pai-writing
description: "Fiction and content writing engine with 7 narrative layers, an anti-cliche detection system, and configurable aesthetics. Produces prose that's genuinely engaging, not formulaic."
version: 5.0.0
author: PAI v5.0 → Hermes Port
use_when: "You need to write creative fiction, narrative content, or engaging prose — stories, scenes, character work, world-building, or any creative text that should avoid cliches and feel fresh."
not_for: "Technical documentation (use direct LLM prompting); academic papers (use pai-arxiv + pai-extract-wisdom); SEO blog content generation."
tags: [writing, fiction, creative, narrative, prose, anti-cliche]
---

# pai-writing: Fiction & Content Writing

## Workflow Routing

| Trigger | Route |
|---------|-------|
| User wants a story/scene | Gather premise → depth selection → apply layers → generate → anti-cliche pass |
| User wants character writing | Character profile → voice config → generate dialogue/narration |
| User wants world-building | Establish rules → sensory details → consistency check → output |
| User wants to improve existing text | Read text → anti-cliche scan → aesthetic config → rewrite |
| User wants a specific aesthetic | Set aesthetics → enforce style rules → generate → validate |

## 7 Narrative Layers

### Layer 1: Surface (Plot & Action)
```
What happens. The events, the sequence, the external conflict.
Instructions:
- Establish clear cause-and-effect
- Each scene has a purpose (advance plot, reveal character, establish stakes)
- Show, don't tell — but don't overdo it
- One unexpected turn per 500 words minimum
- Avoid: "suddenly", "without warning", "little did they know"
```

### Layer 2: Subsurface (Subtext & Tension)
```
What's really happening beneath the surface.
Instructions:
- Every scene has at least one thing characters are NOT saying
- Dialogue has 2+ layers of meaning
- Internal tension between what character wants vs. what they need
- Create dramatic irony (reader knows something characters don't)
- Use silence, pauses, and what's NOT described
```

### Layer 3: Sensory (Immersion)
```
The felt experience of the world.
Instructions:
- Engage all 5+ senses per scene (sight, sound, smell, touch, taste + proprioception)
- Avoid generic sensory descriptors: "warm breeze" → "air thick with jasmine and diesel"
- Weather/environment reflects or contrasts with emotional tone
- Physical sensations ground abstract emotions
- One standout sensory detail per paragraph
```

### Layer 4: Temporal (Pacing & Rhythm)
```
The flow of time in prose.
Instructions:
- Vary sentence length: short for action/tension, long for reflection/description
- Use paragraph breaks as breath points
- Time skips need a clear transition (line break, scene break, chapter break)
- Flashbacks/flash-forwards must serve the present scene
- Slow down for emotional peaks, speed up for action
- Avoid: "Meanwhile", "At the same time" (find better transitions)
```

### Layer 5: Linguistic (Voice & Diction)
```
The texture of the language itself.
Instructions:
- Word choice reflects POV character's background and state of mind
- Avoid filter words: "saw", "noticed", "realized", "felt", "thought"
- Use concrete nouns over abstract ones
- Metaphors should be fresh (no "heart of gold", "cold as ice")
- Dialogue tags: "said" is invisible — use it. Avoid elaborate tags
- Dialect/register is consistent and purposeful
```

### Layer 6: Structural (Architecture)
```
The shape of the narrative.
Instructions:
- Identify: inciting incident, rising action, crisis, climax, resolution
- Each act has a midpoint turn
- Scenes alternate between tension and release
- Subplots mirror or contrast the main plot
- Setup and payoff: every introduced element resolves or is deliberately left dangling
- Avoid: deus ex machina, convenient coincidences
```

### Layer 7: Thematic (Meaning)
```
What the story is actually about.
Instructions:
- Theme emerges from story, not stated outright
- Every character embodies a perspective on the theme
- The ending doesn't answer the theme — it crystallizes the question
- Avoid: characters explicitly stating the theme
- Subvert genre expectations when they contradict the theme
- The best themes are uncomfortable and unresolved
```

## Anti-Cliche System

### Cliche Detection
Scan generated text for these patterns:

| Category | Examples |
|----------|----------|
| Physical | "heart raced", "blood ran cold", "butterflies in stomach", "lump in throat" |
| Dialogue | "We're not so different", "It's quiet... too quiet", "I've got a bad feeling" |
| Plot | "It was all a dream", "The real treasure was the friends we made" |
| Character | "Mysterious stranger", "chosen one", "reluctant hero", "damsel in distress" |
| Description | "Tears streamed down her face", "piercing eyes", "clenched his jaw" |
| Opening | "It was a dark and stormy night", waking up, looking in mirror |
| Transition | "Little did they know", "Meanwhile", "Back at the ranch" |

### Remediation Steps
1. Flag cliche with category + suggested replacement
2. Generate 3 alternatives
3. Rewrite the sentence/clause without the cliche
4. Verify new version doesn't introduce new cliches

### Anti-Cliche Configuration
```
Levels:
- None: No cliche checking (fast generation)
- Light: Flag top-10 most common cliches
- Standard: Flag 100+ known cliches + suggest alternatives
- Aggressive: Flag all cliches + any remotely common metaphor
- Paranoia: Rewrite any phrase found in >100 published works (slow)
```

## Configurable Aesthetics

### Presets

| Aesthetic | Characteristics |
|-----------|-----------------|
| Minimalist | Short sentences, sparse description, white space, understated emotion |
| Lush | Rich sensory detail, elaborate metaphors, flowing sentences |
| Gritty | Sharp, visceral language. Urban, raw. Short words, blunt observations |
| Lyrical | Rhythmic prose, assonance/alliteration, poetic devices, musical |
| Clinical | Precise, detached, technical. Like a surgeon's report. Cold clarity |
| Warm | Inviting tone, familiar references, gentle humor, comforting rhythms |
| Baroque | Ornate, elaborate, maximalist. Long sentences, digressions, wordplay |
| Noir | Hardboiled, cynical, terse. Metaphors drawn from urban decay |
| Academic | Formal register, qualifying clauses, citations in narrative voice |

### Custom Aesthetic Configuration
```
{
  "sentence_length": "short" | "medium" | "long" | "varied",
  "vocabulary": "simple" | "standard" | "rich" | "esoteric",
  "sensory_density": 1-5,
  "metaphor_frequency": "rare" | "occasional" | "frequent" | "constant",
  "dialect_words": "none" | "light" | "moderate" | "heavy",
  "formal_level": 1-5 (1=slang, 5=archaic formal),
  "emotional_explicitness": "subtle" | "balanced" | "direct" | "melodramatic",
  "pacing": "slow" | "moderate" | "fast" | "variable"
}
```

## Gotchas

- All 7 layers must be present in every piece (the combination makes it good)
- Anti-cliche system should run AFTER generation, not constrain it during
- Aesthetic presets override base style but not narrative layers
- Layer 7 (thematic) is the hardest and most important — don't skip it
- Cliche detection is heuristic; some cliches are appropriate in character voice
- "Show don't tell" is overused advice; sometimes telling is better
- Dialogue should sound like speech, not writing (use contractions, fragments, interruptions)
- Avoid authorial intrusion — don't comment on the story from outside
- Second-person is hard to do well; avoid unless specifically requested
- Present tense vs past tense — pick one and be consistent
- Reading aloud catches rhythm issues that silent reading misses
- The anti-cliche pass may introduce awkward phrasing; balance freshness with naturalness

## Execution Log Pattern

```
[PAI-WRITING] Mode: Short Story | Aesthetic: Lush | Anti-Cliche: Standard
[LAYERS] Applied all 7 narrative layers
[PLOT] Scene: detective discovers clue in rain-soaked alley
[CLICHE] Flagged "heart raced" (Physical) → replaced with "pulse thrumming against rain-cold skin"
[CLICHE] Flagged "piercing eyes" (Description) → replaced with "eyes the color of stained concrete"
[THEME] Emergent theme: truth is never cleaner than the method of finding it
[WORD COUNT] 847 words | Flesch: 72 | Sentence var: 0.38 | Unique metaphors: 6
[COMPLETE] Writing generated in 3.1s
```
