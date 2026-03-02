# Aesthetic Profiles

Configurable prose style profiles that shape how the WriteStory skill writes. Each profile defines vocabulary range, sentence patterns, descriptive density, pacing, and rhetorical figure preferences.

## How Profiles Work

1. The writer selects a base profile during Interview or BuildBible
2. Profiles can be blended (e.g., "70% Adams, 30% Tolkien")
3. Profiles affect the Prose layer but NOT the other six layers
4. Custom profiles can be defined in WriteStory SKILLCUSTOMIZATIONS

---

## Built-In Profiles

### Douglas Adams (Witty Speculative)
**Signature:** Intelligent absurdism, deadpan observation, cosmic scale made personal

**Characteristics:**
- Sentences alternate between conversational and grandly philosophical
- Frequent parenthetical asides and footnote-style tangents
- Comedy emerges from contrast between the mundane and the cosmic
- Understatement is the primary comedy engine
- Technology and bureaucracy as comedy sources

**Rhetorical figure emphasis:** Litotes, Syllepsis, Hyperbole, Parenthetical Anacoluthon
**Sentence length:** Highly variable (5-word punches alternating with 40-word digressions)
**Descriptive density:** Low for setting, high for absurd details
**Pacing:** Fast, then deliberately slow for comic effect, then fast again

**Sample register:**
> The ships hung in the sky in much the same way that bricks don't.

---

### Tolkien (Epic Literary)
**Signature:** Grand mythic weight, languages as world-building, nature as character

**Characteristics:**
- Longer, flowing sentences with subordinate clauses
- Archaic vocabulary deployed selectively (not constantly)
- Landscape descriptions carry emotional and thematic weight
- Songs, poems, and formal speech patterns woven into prose
- Deep sense of history — the past is always present

**Rhetorical figure emphasis:** Anaphora, Tricolon, Merism, Blazon, Personification
**Sentence length:** Generally long (15-35 words), with occasional short declarative sentences for impact
**Descriptive density:** Very high for landscape and architecture, moderate for character appearance
**Pacing:** Deliberate, with long passages of travel/reflection punctuated by intense action

**Sample register:**
> The world is indeed full of peril, and in it there are many dark places; but still there is much that is fair, and though in all lands love is now mingled with grief, it grows perhaps the greater.

---

### Ursula K. Le Guin (Precise Speculative)
**Signature:** Economical precision, anthropological eye, philosophical depth

**Characteristics:**
- Every word earns its place — nothing wasted
- Cultural details presented without judgment
- Questions of identity, power, and social structure
- Gender, language, and perception as story elements
- Quiet prose that builds to devastating emotional impact

**Rhetorical figure emphasis:** Antithesis, Paradox, Isocolon, Litotes
**Sentence length:** Short to medium (8-20 words), rarely ornate
**Descriptive density:** Low but precise — one perfect detail over three adequate ones
**Pacing:** Measured, patient, building imperceptibly

**Sample register:**
> The only thing that makes life possible is permanent, intolerable uncertainty; not knowing what comes next.

---

### Cormac McCarthy (Sparse American)
**Signature:** Biblical cadence without religion, violence as revelation, landscape as fate

**Characteristics:**
- No quotation marks for dialogue
- Minimal punctuation (few commas, no semicolons)
- Polysyndeton (repeated "and") creates biblical rhythm
- Violence described with clinical precision
- Long sentences of landscape that suddenly cut to short action

**Rhetorical figure emphasis:** Polysyndeton, Asyndeton, Periodic Sentence, Personification (of landscape)
**Sentence length:** Bimodal — very long descriptive sentences and very short declarative ones
**Descriptive density:** Extremely high for landscape, extremely low for character inner states
**Pacing:** Slow burns with sudden explosive events

**Sample register:**
> He walked out in the gray light and stood and he saw for a brief moment the absolute truth of the world.

---

### Terry Pratchett (Comic Fantasy)
**Signature:** Satire through fantasy, footnotes, humanist philosophy disguised as jokes

**Characteristics:**
- Observation comedy applied to fantasy tropes
- Footnotes as running commentary
- Deep empathy for characters despite comic framing
- Social criticism through mirror-world parallels
- Death as a character who SPEAKS IN CAPITALS

**Rhetorical figure emphasis:** Syllepsis, Litotes, Hyperbole, Zeugma, Bathos
**Sentence length:** Medium (12-25 words), conversational rhythm
**Descriptive density:** Moderate, with emphasis on telling details over comprehensive description
**Pacing:** Brisk, with comedic timing built into paragraph structure

**Sample register:**
> The truth may be out there, but the lies are inside your head.

---

### George R.R. Martin (Political Epic)
**Signature:** POV-driven chapters, moral ambiguity, consequence and cost

**Characteristics:**
- Each chapter filtered through a specific character's perception
- Food, clothing, and environment described in sensory detail
- No character is safe — actions have real consequences
- Political maneuvering is as important as swordplay
- Multiple parallel storylines converging

**Rhetorical figure emphasis:** Transferred Epithet, Blazon, Diacope, Periodic Sentence
**Sentence length:** Variable, matching POV character's thought patterns
**Descriptive density:** Very high for environment and sensory detail
**Pacing:** Slow political build-up, rapid violent payoff

---

### N.K. Jemisin (Innovative Speculative)
**Signature:** Second-person POV, structural innovation, systemic oppression as worldbuilding

**Characteristics:**
- Willingness to break narrative conventions (second person, present tense)
- Emotional rawness balanced with intellectual rigor
- Geology, physics, and science as poetic metaphor
- Characters defined by their relationship to power structures
- Multiple timelines woven into revelation

**Rhetorical figure emphasis:** Anaphora, Paradox, Anadiplosis, Enallage
**Sentence length:** Short to medium, direct
**Descriptive density:** Moderate, focused on sensory experience and emotional state
**Pacing:** Propulsive, with revelations timed for maximum impact

---

## Custom Profile Template

Writers can define their own aesthetic profile:

```markdown
### [Profile Name] ([Genre/Style Category])
**Signature:** [One sentence defining the voice]

**Characteristics:**
- [Sentence structure preference]
- [Vocabulary range and register]
- [Key techniques or conventions]
- [Unique structural choices]
- [Thematic emphasis]

**Rhetorical figure emphasis:** [3-6 primary figures from RhetoricalFigures.md]
**Sentence length:** [Short/Medium/Long/Variable + typical range]
**Descriptive density:** [Low/Moderate/High + what gets described most]
**Pacing:** [Fast/Moderate/Slow/Variable + pattern]

**Sample register:**
> [One representative sentence that captures the voice]
```

## Profile Blending

Profiles can be blended with weighted percentages:

```
Profile: 60% Le Guin + 40% Adams
Result: Precise and economical prose with occasional witty asides and
        philosophical observations. Deadpan rather than ornate.
        Questions of identity explored with dry humor.
```

Blending rules:
- The dominant profile (highest %) controls sentence structure
- The secondary profile adds flavor through vocabulary and figure selection
- Descriptive density averages between profiles
- Pacing follows the dominant profile

## Genre-Default Profiles

| Genre | Default Profile | Why |
|-------|----------------|-----|
| High Fantasy | Tolkien | Mythic weight, world-building density |
| Urban Fantasy | Pratchett | Modern sensibility in magical setting |
| Hard Sci-Fi | Le Guin | Precision, philosophical depth |
| Comic Sci-Fi | Adams | Absurdist observation, cosmic comedy |
| Dark Fantasy | McCarthy | Violence, landscape, biblical rhythm |
| Political Fantasy | Martin | POV chapters, moral ambiguity |
| Literary Sci-Fi | Jemisin | Innovation, emotional rawness |

These defaults can always be overridden.
