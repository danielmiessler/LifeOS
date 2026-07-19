# Create Sales Package

**Full pipeline: Transform product documentation into sales narrative + visual asset.**

---

## 🚨 MANDATORY STEPS — EXECUTE IN ORDER

```
PRODUCT DOCUMENTATION
        ↓
[1] STORY EXPLANATION — Extract narrative arc with StoryExplanation Skill
        ↓
[2] EMOTIONAL REGISTER — Match to emotion from aesthetic vocabulary
        ↓
[3] VISUAL CONCEPT — Derive scene from narrative + emotion
        ↓
[4] GENERATE VISUAL — Create charcoal sketch with Art Skill
        ↓
[5] COMPILE OUTPUT — Narrative + visual + talking points
```

---

## Step 1: Extract Narrative with Story Explanation

**Use the StoryExplanation Skill to extract the narrative arc.**

```
Invoke StoryExplanation Skill with 24-item length for [product documentation]
```

**Focus on:**
- What's the REAL value proposition?
- Why does this MATTER to the customer?
- What problem does this SOLVE?
- What's the transformation (before → after)?

**Output:** 8-24 point story explanation capturing the value proposition.

---

## Step 2: Identify Emotional Register

**Match the product/value proposition to an emotional register.**


| Value Proposition Type | Emotional Register | Warm:Cool |
|------------------------|-------------------|-----------|
| **Solves painful problem** | HOPE / POSSIBILITY | 80:20 |
| **Prevents disaster/risk** | URGENCY / WARNING | 60:40 |
| **Enables new capabilities** | WONDER / DISCOVERY | 40:60 |
| **Saves time/effort** | DETERMINATION / EFFORT | 70:30 |
| **Deep expertise/insight** | CONTEMPLATION | 50:50 |
| **Team/collaboration** | CONNECTION | 90:10 |
| **Replaces legacy/old way** | MELANCHOLY (for old) + HOPE (for new) | 60:40 |

**Output:** Selected emotional register with specific vocabulary.

---

## Step 3: Derive Visual Concept

**Translate narrative + emotion into a specific visual scene.**

### Key Questions

1. **What are the CONCRETE SUBJECTS?**
   - Extract specific nouns from the value proposition
   - Human figure? AI/robot figure? Both?
   - What objects represent the product/outcome?

2. **What's the VISUAL METAPHOR?**
   - What scene captures the transformation?
   - What shows the value in action?
   - What would make someone "get it" instantly?

3. **What's the COMPOSITION?**
   - Minimalist with breathing space
   - Centered subjects floating in empty space
   - Few elements, each intentional

### Scene Construction Template

```
VALUE PROPOSITION: [One sentence summary of what matters]
CONCRETE SUBJECTS: [Specific nouns that MUST appear visually]
VISUAL METAPHOR: [What scene captures this value?]
EMOTIONAL REGISTER: [From Step 2]
WARM:COOL RATIO: [From emotion table]
```

**Output:** Specific visual scene that captures the value proposition.

---

## Step 4: Generate Visual Asset

**Use the Art Skill (essay-art workflow) to create the image.**

### Invoke Art Skill

```
Invoke Art Skill → essay-art workflow
```

### Prompt Template

```
Sophisticated charcoal architectural sketch. [ARTIST REFERENCE] influence.

EMOTIONAL REGISTER: [From Step 2]

SCENE:
[Visual scene from Step 3]

MINIMALIST COMPOSITION:
- Subject(s) CENTERED in the frame
- Empty/negative space around — NO filled-in backgrounds
- Clean, gallery-worthy simplicity
- Supporting objects that serve the narrative (gestural, minimal)

CONCRETE SUBJECTS:
[List specific subjects that MUST appear]

HUMAN FIGURE — GESTURAL ABSTRACTED SKETCH:
- MULTIPLE OVERLAPPING LINES suggesting the form
- Quick, confident, ENERGETIC gestural marks
- Burnt Sienna (#8B4513) WASH accent touches

[If AI/tech figure:]
ROBOT/TECH FIGURE — GESTURAL ANGULAR SKETCH:
- Angular rigid gestural marks
- Deep Purple (#4A148C) WASH accent touches

LINEWORK:
- Loose charcoal/graphite pencil strokes
- Visible hatching and gestural marks
- NOT clean vectors, NOT smooth

COLOR — CHARCOAL DOMINANT:
- CHARCOAL AND GRAY DOMINANT — 85%
- Sienna accents on human elements
- Purple accents on tech elements
- Background is EMPTY — white/cream negative space
- Transparent background

CRITICAL:
- MINIMALIST composition
- Visual captures the VALUE PROPOSITION
- Gallery-worthy gestural sketch aesthetic

Sign {DA_IDENTITY.NAME} small in charcoal bottom right.
NO other text.
```

### Generate with CLI

```bash
bun run "${LIFEOS_ROOT}/skills/art/Tools/Generate.ts" \
  --model nano-banana-pro \
  --prompt "[YOUR PROMPT]" \
  --size 2K \
  --aspect-ratio 1:1 \
  --remove-bg \
  --output /path/to/output.png
```

**Output:** Charcoal sketch visual asset with transparent background.

---

## Step 5: Compile Sales Package

**Assemble the complete output.**

### Output Format

```markdown
# Sales Package: [Product/Feature Name]

## Sales Narrative

[8-24 point story explanation from Step 1]

## Visual Asset

[Image path or embedded image]

## Key Talking Points

1. [First major value point]
2. [Second major value point]
3. [Third major value point]

## Emotional Hook

**Register:** [Emotional register used]
**Core Message:** [One sentence that captures the feeling]

## Script Snippet

"[2-3 sentence elevator pitch version of the narrative]"
```

---

## Validation Checklist

Before delivering:

- [ ] **Narrative captures VALUE** — not just features, but why it matters
- [ ] **Visual matches narrative** — someone could connect them
- [ ] **Emotional register consistent** — narrative and visual aligned
- [ ] **Talking points actionable** — sales team can use immediately
- [ ] **Script is natural** — sounds like something you'd actually say

---

## Example Execution

**Input:** Documentation for AI code review tool

**Step 1 Output (Narrative):**
1. Code review is broken — PRs get rubber-stamped
2. Junior devs miss subtle bugs, seniors don't have time
3. This tool understands your codebase like a 10-year veteran
4. It catches the issues that slip through human review
5. Not pattern matching — actual understanding of your patterns
6. Learns your specific conventions and flags deviations
7. Integrates into existing workflow — no context switching
8. Result: fewer production bugs, faster reviews, happier teams

**Step 2 Output:** WONDER / DISCOVERY (40:60 warm:cool) — "it actually understands"

**Step 3 Output:**
- VALUE: AI that understands code like a senior engineer
- SUBJECTS: Human developer + AI figure, both examining code
- METAPHOR: Two figures producing the same insight — you can't tell who caught the bug
- COMPOSITION: Minimalist, centered, code/output flowing between them

**Step 4 Output:** Charcoal sketch of human and AI both examining same code output

**Step 5 Output:** Complete sales package with narrative, visual, talking points, and script

---

**The workflow: Story Explanation → Emotion → Visual Concept → Generate → Compile**
