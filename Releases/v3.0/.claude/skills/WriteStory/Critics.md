# Critic Profiles for Multi-Pass Review

The WriteChapter workflow's Step 8 runs the completed chapter through multiple critic passes. Each critic examines the prose from a single focused angle and produces specific, actionable suggestions to tighten the draft.

## Rules for All Critics

1. **Suggestions, not rewrites.** Each critic suggests changes; the author decides whether to apply them. Preserve the author's voice.
2. **Specific and locatable.** Every suggestion references a specific paragraph, line, or passage. "The dialogue in scene 2 lacks subtext" is acceptable. "The prose could be better" is not.
3. **2-5 suggestions per pass.** This prevents both laziness and over-criticism. If a critic finds more than 5 issues, they prioritize the 5 most impactful.
4. **Confidence rating (1-5).** Each critic rates how well the chapter serves their dimension:
   - 5: Exceptional. No changes needed.
   - 4: Strong. Minor polish suggestions.
   - 3: Adequate. A few meaningful improvements possible.
   - 2: Weak. Significant gaps in this dimension.
   - 1: Failed. This dimension needs substantial rework.
5. **Do not duplicate.** If a previous critic already flagged an issue, the next critic should not repeat it. Build on each other.
6. **Preserve voice.** No suggestion should flatten the author's chosen Aesthetic Profile. A McCarthy-style chapter should not be criticized for sparse punctuation. An Adams-style chapter should not be criticized for parenthetical asides.

## Output Format (per critic)

```
[CRITIC NAME] — Rating: [N]/5
- [Suggestion 1]: [specific location] → [what to change and why]
- [Suggestion 2]: [specific location] → [what to change and why]
...
```

---

## Mandatory Critics (run on every chapter)

### 1. The Layer Auditor

**Focus:** Seven-layer completeness and interaction
**Personality:** Methodical, structural thinker. Sees the architecture beneath the prose.

**Asks:**
- Does every scene advance at least 2 layers?
- Is any layer completely absent from the chapter?
- Are layers interacting (e.g., a world detail that pressures the sacred flaw) or merely present in isolation?
- Does the chapter's layer balance match what the Story Bible prescribed for these beats?
- Is the theme emerging through action, or is it being stated?

**Red flags:**
- A scene that only advances plot
- A chapter with no mystery movement
- Theme stated through exposition rather than action
- A layer present in the Layer Articulation Map (Step 3) but absent from the actual prose

---

### 2. The Rhetoric Examiner

**Focus:** Rhetorical figure deployment and prose musicality
**Personality:** The ear. Hears rhythm, notices patterns, feels cadence.

**Asks:**
- Were rhetorical figures deployed at the planned impact moments from Step 2?
- Are figures present in BOTH dialogue and narrative prose?
- Is there figure variety, or did the writer lean on the same 2-3 figures throughout?
- Do the deployed figures match the Aesthetic Profile's emphasis?
- Are memorable lines actually memorable — would a reader quote them?
- Does sentence rhythm vary deliberately for pacing, or has it fallen into monotony?
- Are there passages that would benefit from a figure but have none?

**Red flags:**
- A chapter with zero identifiable figures in narrative prose
- Over-deployment that makes the prose feel performative or purple
- Rhythm monotony — all sentences of similar length
- A climactic moment that lacks any rhetorical engineering

---

### 3. The Freshness Inspector

**Focus:** Cliche detection, originality, concrete specificity
**Personality:** Allergic to the generic. Demands the unexpected.

**Asks:**
- Did anything from the `AntiCliche.md` banned lists survive the Step 7 sweep?
- Are there dead metaphors or familiar phrasings that passed the first filter?
- Is every description filtered through the POV character's specific perception, or are there "default camera" descriptions that any character would notice?
- Could any abstract noun be replaced with a concrete image?
- Are emotions shown through behavior or stated directly?
- Is there at least one genuinely surprising detail per scene?
- Are there any AI-specific prose patterns (tapestry of, weight of, symphony of, dance of, echoes of)?

**Red flags:**
- "Her heart raced" or any variant of stated physiological emotion
- A description that any character in any story could notice
- An emotion named rather than shown through action
- A simile that has appeared in more than 100 published books
- Any sentence that starts with "And so it was that..."

---

### 4. The Reader Surrogate

**Focus:** Engagement, clarity, emotional impact, information flow
**Personality:** The gut. Reads for pleasure and engagement, not craft.

**Asks:**
- Where did my attention wander? (These are pacing problems.)
- Where was I confused? (These are clarity problems.)
- Where was I most emotionally engaged? (Protect these moments.)
- Where was I least emotionally engaged? (These need work.)
- Did the chapter ending make me want to read the next chapter?
- Was the information flow clear — did I know what I needed to know when I needed to know it?
- Did any scene feel like it was marking time rather than advancing something?

**Red flags:**
- A scene where nothing changes
- An ending that resolves everything with no forward momentum
- A passage where the reader must re-read to understand what happened
- Emotional peaks that don't land because the setup was insufficient

---

## Optional Critics (for high-stakes chapters: opening, midpoint, climax, finale)

### 5. The Subtext Analyst

**Focus:** What is unsaid, implied, and layered beneath the surface
**Personality:** Reads between every line. Obsessed with gaps and silence.

**Asks:**
- In emotionally charged dialogue, are characters talking about one thing while meaning another?
- Are there moments where behavioral emotion (action, gesture, silence) replaces stated emotion?
- Could any scene gain power by REMOVING explicit information and letting the reader infer?
- Are there missed opportunities for dramatic irony (reader knows something the character does not)?
- Does the sacred flaw manifest through behavior and choices, or is it explained?

**Red flags:**
- Characters who say exactly what they mean in emotional moments
- Narration that explains the subtext ("She said X, but what she really meant was Y")
- Themes stated rather than embodied through action
- A climactic scene where the realization is narrated instead of shown

---

### 6. The Continuity Editor

**Focus:** Internal consistency and Story Bible compliance
**Personality:** The memory. Remembers every detail from every chapter.

**Asks:**
- Does the timeline add up? (Days, seasons, travel time)
- Does each character know only what they should know based on scenes they have been in?
- Are physical descriptions consistent with previous chapters?
- Do world rules hold? (Magic systems, technology, social norms)
- Does the chapter deliver what the Story Bible's beat map prescribed?
- Are any character behaviors contradicting their established sacred flaw or arc stage?

**Red flags:**
- A character referencing information from a scene they were not in
- A journey that takes one day when established geography says three
- A magic or technology use that violates established limitations
- A character whose behavior contradicts where they should be in their arc

---

### 7. The Pacing Surgeon

**Focus:** Rhythm, timing, and proportionality
**Personality:** Feels the pulse of the prose. Knows when to speed up and when to let the reader breathe.

**Asks:**
- Does sentence length vary deliberately, or has it fallen into a monotonous pattern?
- Are action scenes using short, sharp sentences?
- Are emotional and contemplative scenes using longer, flowing sentences?
- Is any scene disproportionately long or short for its narrative importance?
- Where does prose bloat? (Unnecessary description, over-explained action, redundant dialogue)
- Where does prose rush? (Emotional beats that deserve more space, transitions that skip too fast)
- Are paragraph breaks and section breaks used to control rhythm?

**Red flags:**
- Three consecutive paragraphs with the same sentence length pattern
- An action scene with complex subordinate clauses
- An emotional peak compressed into a single sentence when it deserves a full paragraph
- A transitional scene that runs longer than the climactic scene

---

### 8. The Voice Enforcer

**Focus:** Character voice distinctiveness and narrator consistency
**Personality:** The mimic. Can hear every character speak distinctly.

**Asks:**
- If you removed all dialogue attribution, could you tell who is speaking from voice alone?
- Does each character's vocabulary range match their background and education?
- Does each character's sentence structure match their personality?
- Does the narrator's voice match the configured Aesthetic Profile throughout?
- Are there voice breaks where the prose slips into a different register (e.g., suddenly formal in an informal section)?
- Do action beats in dialogue reveal character-specific behavior?

**Red flags:**
- Two characters with identical speech patterns
- The narrator using Tolkien-esque phrasing in a McCarthy-profile story
- A character's vocabulary suddenly shifting register without narrative reason
- Dialogue attribution that relies on adverbs instead of voice differentiation

---

## Pass Ordering

Run critics in this order — structural issues before polish, craft before gut-check:

1. **Layer Auditor** first (fix structural gaps before refining prose)
2. **Rhetoric Examiner** second (craft-level improvements)
3. **Freshness Inspector** third (catches cliches the first two may have introduced)
4. **Reader Surrogate** last of the mandatory four (final engagement gut-check)
5-8. **Optional critics** after the mandatory four, in any order

## Efficiency

Each critic pass produces 2-5 brief, actionable notes. This is a tightening pass, NOT a second draft. The total overhead of the 4 mandatory passes should be a focused review cycle producing 8-20 specific suggestions, not a rewriting process.
