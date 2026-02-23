# Create Sales Visual

**Create a charcoal sketch visual asset for an existing sales narrative.**

---

## Purpose

Takes a sales narrative or value proposition and creates a matching visual asset — charcoal gestural sketch that captures the emotional core of the value proposition.

---

## Process

### Step 1: Gather Input

**Requires:**
- Sales narrative OR value proposition summary
- Target emotional response (optional — will derive if not provided)

### Step 2: Identify Emotional Register

**If not provided, derive from the narrative:**

| Value Proposition Type | Emotional Register | Warm:Cool |
|------------------------|-------------------|-----------|
| **Solves painful problem** | HOPE / POSSIBILITY | 80:20 |
| **Prevents disaster/risk** | URGENCY / WARNING | 60:40 |
| **Enables new capabilities** | WONDER / DISCOVERY | 40:60 |
| **Saves time/effort** | DETERMINATION / EFFORT | 70:30 |
| **Deep expertise/insight** | CONTEMPLATION | 50:50 |
| **Team/collaboration** | CONNECTION | 90:10 |

**Read full vocabulary:** `~/.claude/skills/PAI/Aesthetic.md`

### Step 3: Derive Visual Concept

**Key Questions:**

1. **What are the CONCRETE SUBJECTS?**
   - Human figure? AI/robot figure? Both?
   - What objects represent the product/outcome?
   - What's physically present in the scene?

2. **What's the VISUAL METAPHOR?**
   - What scene captures the transformation?
   - What would make someone "get it" instantly?
   - What's the single image that tells the story?

3. **What's the COMPOSITION?**
   - Minimalist with breathing space
   - Centered subjects floating in empty space
   - Few elements, each intentional

### Step 4: Construct Prompt

**Use the Art Skill essay-art template:**

```
Sophisticated charcoal architectural sketch. [ARTIST REFERENCE] influence.

EMOTIONAL REGISTER: [From Step 2]

SCENE:
[Visual concept from Step 3]

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

Sign {DAIDENTITY.NAME} small in charcoal bottom right.
NO other text.
```

### Step 5: Generate Image

```bash
bun run ~/.claude/skills/art/Tools/Generate.ts \
  --model nano-banana-pro \
  --prompt "[YOUR PROMPT]" \
  --size 2K \
  --aspect-ratio 1:1 \
  --remove-bg \
  --output /path/to/output.png
```

### Step 6: Validate

**Check:**
- [ ] Visual matches the narrative emotionally
- [ ] Concrete subjects are visible
- [ ] Minimalist composition with empty space
- [ ] Charcoal sketch aesthetic (not clean vectors)
- [ ] Transparent background
- [ ] Someone could connect the visual to the value proposition

**If validation fails:** Regenerate with adjusted prompt.

---

## Output

- PNG image with transparent background
- Charcoal gestural sketch aesthetic
- Captures the emotional core of the value proposition
- Ready for sales decks, presentations, collateral

---

**The goal:** A visual that makes the value proposition instantly graspable.
