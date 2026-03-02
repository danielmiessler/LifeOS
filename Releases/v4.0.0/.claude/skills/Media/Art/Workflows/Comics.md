# Hand-Drawn Comics Workflow

**Comic strips in brand editorial illustration style, NOT cartoonish.**

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the Comics workflow in the Art skill to create comic strips"}' \
  > /dev/null 2>&1 &
```

Running **Comics** in **Art**...

---

Creates **EDITORIAL COMICS** — 3-4 panel storytelling with sophisticated hand-drawn aesthetic, maintaining brand flat color and black linework.

---

## Purpose

Editorial comics use sequential panels to explain concepts, tell stories, or illustrate scenarios. These are **sophisticated comics** — not cutesy or cartoonish, but thoughtful illustrated narratives with editorial style.

**Use this workflow for:**
- Explaining complex concepts through narrative
- "AGI arrives" scenario panels
- Before/during/after sequences
- Illustrated thought experiments
- Multi-step processes shown visually
- Storytelling with editorial sophistication

---

## Visual Aesthetic: Sophisticated Sequential Art

**Think:** New Yorker cartoon style, not Sunday funnies

### Core Characteristics
1. **Multi-panel** — 3-4 panels telling sequential story
2. **Editorial style** — Maintains brand flat color, black linework aesthetic
3. **Simplified figures** — Characters stylized, not realistic or cutesy
4. **Hand-drawn** — Imperfect linework, gestural quality
5. **Narrative flow** — Panels build on each other to make a point
6. **Minimal dialogue** — Text supports, doesn't dominate
7. **Sophisticated humor/insight** — Smart, not silly

---

## Color System for Comics

### Structure
```
Black #000000 — All linework, panel borders, character outlines
```

### Character/Element Accents
```
Deep Purple #4A148C — Key character or important element
Deep Teal #00796B — Secondary character or contrast element
Charcoal #2D2D2D — Dialogue text, captions
```

### Background
```
Light Cream #F5E6D3 — Panel backgrounds
OR
White #FFFFFF — Clean backgrounds
OR
Varied per panel — Different cream/light tones for panel differentiation
```

### Color Strategy
- Characters primarily black linework
- Purple accent on protagonist or key element
- Teal on secondary character if needed
- Backgrounds light and simple (no busy scenes)
- Dialogue in charcoal for readability

---

## 🚨 MANDATORY WORKFLOW STEPS

### Step 1: Define Comic Narrative

**Plan the story:**

1. **What's the concept/scenario?**
   - What are you explaining or illustrating
   - The arc or transformation to show

2. **How many panels?**
   - 3 panels (setup → action → result)
   - 4 panels (setup → complication → action → result)

3. **What happens in each panel?**
   - Panel 1: [Scene/action]
   - Panel 2: [Scene/action]
   - Panel 3: [Scene/action]
   - Panel 4: [Scene/action] (if using 4)

4. **What's the punchline/insight?**
   - Final panel delivers the point
   - What makes this memorable

**Output:**
```
COMIC CONCEPT: [What you're illustrating]
PANELS: [3 or 4]

NARRATIVE ARC:
Panel 1: [Setup - what's the initial state]
Panel 2: [Action/Complication - what changes]
Panel 3: [Escalation or Result]
Panel 4: [Punchline/Insight - the point] (if using 4)

DIALOGUE (Minimal):
Panel 1: "[Optional brief text]"
Panel 2: "[Optional brief text]"
Panel 3: "[Optional brief text]"
Panel 4: "[Punchline or insight]"

KEY CHARACTERS:
- [Character/Element 1]: [Description, purple accent]
- [Character/Element 2]: [Description, teal accent if needed]
```

---

### Step 2: Design Panel Layout

**Plan the comic structure:**

1. **Panel arrangement:**
   - Horizontal strip (3-4 panels left to right)
   - Vertical strip (3-4 panels top to bottom)
   - Grid (2x2 for 4 panels)

2. **Panel size:**
   - Equal sized panels (classic)
   - Varied sizes for emphasis
   - Final panel larger (punchline emphasis)

3. **Panel content:**
   - What's illustrated in each panel
   - Character positions and actions
   - Background elements (minimal)

**Output:**
```
PANEL LAYOUT: [Horizontal strip / Vertical strip / Grid]

PANEL STRUCTURE:
- Panel 1: [Same size / Smaller / Larger]
  * Content: [What's shown]
  * Characters: [Positions]
  * Background: [Minimal elements]

- Panel 2: [Size]
  * Content: [What's shown]
  * Characters: [Positions]
  * Background: [Elements]

- Panel 3: [Size]
  * Content: [What's shown]
  * Characters: [Positions]
  * Background: [Elements]

- Panel 4: [Size - often larger for punchline]
  * Content: [What's shown]
  * Characters: [Positions]
  * Background: [Elements]

COLOR CODING:
- Main character/element: Purple (#4A148C) accents
- Secondary: Teal (#00796B) accents (if needed)
- Backgrounds: Light cream or white, simple
```

---

### Step 3: Construct Prompt

### Prompt Template

```
Hand-drawn editorial comic strip in New Yorker style.

STYLE REFERENCE: New Yorker cartoon, editorial illustration comic, sophisticated sequential art

BACKGROUND: Light Cream (#F5E6D3) OR varied light tones per panel

AESTHETIC:
- Hand-drawn editorial style (NOT cartoonish or cute)
- Flat color, black linework, brand palette
- Simplified but sophisticated character design
- Variable stroke weight (thicker for outlines, thinner for details)
- Gestural imperfect linework
- Minimal backgrounds (not busy scenes)
- Smart humor or insight, not silly

COMIC STRUCTURE: [3-panel / 4-panel] [horizontal strip / vertical strip / grid]

PANEL LAYOUT:
- [Number] panels arranged [horizontally left-to-right / vertically / grid 2x2]
- Each panel has black border (hand-drawn, slightly wobbly)
- Panel sizes: [Equal / Varied - specify which panels larger]

TYPOGRAPHY FOR DIALOGUE (Advocate Condensed):
- Minimal text, supports visual narrative
- Font: Advocate condensed
- Size: Small readable
- Color: Charcoal (#2D2D2D)
- Style: Hand-lettered in speech bubbles or captions

COMIC NARRATIVE: "[Overall concept being illustrated]"

PANEL 1 - [SETUP]:
Scene: [Describe what's happening]
Characters: [Who's present, what they're doing]
- Main character: Simplified figure with Purple (#4A148C) accent on [element]
- Hand-drawn black linework, imperfect
Background: Light cream, minimal [optional elements]
Dialogue: "[Brief text]" OR no text
Represents: [Initial state]

PANEL 2 - [ACTION/COMPLICATION]:
Scene: [What changes or happens]
Characters: [Actions, positions]
- Main character: [Reacting or acting]
- [Optional secondary character]: Teal (#00796B) accent
Background: [Minimal elements]
Dialogue: "[Brief text]" OR no text
Represents: [The change]

PANEL 3 - [ESCALATION/RESULT]:
Scene: [Situation develops]
Characters: [New positions or states]
- Main character: [Further development]
Background: [Minimal]
Dialogue: "[Brief text]" OR no text
Represents: [Progression]

PANEL 4 - [PUNCHLINE/INSIGHT]: (if using 4 panels)
Scene: [Final state or revelation]
Characters: [Final positions]
- Main character: [Conclusion state]
- Often larger panel for emphasis
Background: [Simple or empty for focus]
Dialogue: "[Punchline or insight text]"
Represents: [The point being made]

CHARACTER DESIGN - PLANEFORM AESTHETIC (CRITICAL):
- All figures constructed from ANGULAR PLANES (like architectural paper models)
- NO round forms, NO smooth curves, NO circles on bodies
- Adult proportions (1:7 head-to-body ratio), elongated and dignified
- NO cute proportions (big heads, stubby limbs)
- Faces are MINIMAL geometric blocks — NOT detailed, NOT cute, NO big eyes
- Emotion through GESTURE and SILHOUETTE only
- Russian Constructivist influence: El Lissitzky, Oskar Schlemmer, Saul Bass
- Hand-drawn gestural quality with angular construction
- Consistent character across panels (same angular vocabulary)
- Editorial sophistication — NOT cartoonish, NOT children's book style
- If robots present: same angular planes as humans, differentiated by teal accents

VISUAL CONTINUITY:
- Same character recognizable across all panels
- Consistent hand-drawn style throughout
- Background simplicity maintained in all panels
- Color accents (purple/teal) consistent

COLOR USAGE:
- Black (#000000) for all linework, panel borders, character outlines
- Deep Purple (#4A148C) accent on main character or key element
- Deep Teal (#00796B) accent on secondary character (if present)
- Charcoal (#2D2D2D) for all dialogue and captions
- Light Cream (#F5E6D3) OR White (#FFFFFF) panel backgrounds
- Minimal flat color fills, mostly linework

CRITICAL REQUIREMENTS:
- Hand-drawn editorial style (NOT cartoonish, NOT clip-art)
- Simplified but sophisticated character design
- Clear narrative flow across panels
- Minimal dialogue (visual storytelling prioritized)
- Strategic purple/teal accents (not overwhelming color)
- No gradients, flat colors only
- Maintains brand aesthetic (black linework, flat color, imperfect)
- Smart insight or humor (sophisticated, not silly)

Optional: Sign small in bottom right corner of final panel in charcoal (#2D2D2D).
```

---

### Step 4: Determine Aspect Ratio

| Comic Layout | Aspect Ratio | Reasoning |
|--------------|--------------|-----------|
| 3-panel horizontal | 16:9 or 21:9 | Wide strip format |
| 4-panel horizontal | 21:9 | Extra wide for 4 panels |
| 3-panel vertical | 9:16 | Tall strip |
| 4-panel grid (2x2) | 1:1 | Square balanced |
| Variable | 4:3 | Flexible proportions |

**Default: 16:9 (horizontal)** — Classic comic strip format

---

### Step 5: Execute Generation

```bash
bun run ~/.claude/skills/art/Tools/Generate.ts \
  --model nano-banana-pro \
  --prompt "[YOUR PROMPT]" \
  --size 2K \
  --aspect-ratio 16:9 \
  --output /path/to/comic.png
```

**Model Recommendation:** nano-banana-pro or flux (both handle sequential panels well)

**Immediately Open:**
```bash
open /path/to/comic.png
```

---

### Step 6: Validation (MANDATORY)

#### Must Have
- [ ] **Clear panel structure** — Panels obviously sequential
- [ ] **Editorial aesthetic** — Sophisticated, not cartoonish
- [ ] **Narrative flow** — Story/concept clear across panels
- [ ] **Character consistency** — Same character recognizable in all panels
- [ ] **Hand-drawn quality** — Imperfect linework, gestural
- [ ] **Minimal backgrounds** — Simple, not busy
- [ ] **Smart insight** — Punchline or point lands effectively
- [ ] **brand aesthetic maintained** — Flat color, black linework

#### Character Validation (Planeform Aesthetic)
- [ ] **Angular construction** — Bodies built from planes, NOT round forms
- [ ] **Adult proportions** — Elongated (1:7), NOT stubby/cute (1:3)
- [ ] **Minimal faces** — Geometric blocks, NOT detailed cute faces
- [ ] **Gesture expression** — Emotion through posture, NOT facial features
- [ ] **NOT cartoonish** — Sophisticated editorial, NOT children's book style
- [ ] **Constructivist influence** — El Lissitzky, Schlemmer aesthetic visible

#### Must NOT Have
- [ ] Cartoonish or cutesy style
- [ ] Round forms or smooth curves on figures
- [ ] Big heads, stubby proportions
- [ ] Detailed facial features or big eyes
- [ ] Realistic detailed illustration
- [ ] Busy complex backgrounds
- [ ] Too much dialogue (should be visual)
- [ ] Inconsistent character design across panels
- [ ] Gradients or shadows
- [ ] Silly humor (should be sophisticated)
- [ ] Generic AI illustration style

#### If Validation Fails

| Problem | Fix |
|---------|-----|
| Too cartoonish | "Sophisticated editorial style, New Yorker cartoon aesthetic, NOT cartoonish" |
| Can't follow story | Clarify narrative arc: "Panel 1 setup → Panel 2 complication → Panel 3 result" |
| Characters inconsistent | "Same simplified character across all panels, consistent design" |
| Too complex | "Minimal backgrounds, simple scenes, focus on key action" |
| Too much text | "Visual storytelling prioritized, minimal dialogue, brief text" |
| Looks corporate | Reference "hand-drawn editorial comic, imperfect wobbly lines, gestural quality" |

**Character-Specific Failures:**

| Problem | Fix |
|---------|-----|
| **Characters too round/cute** | "Figures built from ANGULAR PLANES ONLY. NO round forms. Constructivist angular construction like El Lissitzky, Oskar Schlemmer." |
| **Cartoon proportions** | "Adult proportions (1:7 head-to-body). Elongated dignified figures. NO big heads, NO stubby limbs." |
| **Too much facial detail** | "Faces are MINIMAL geometric blocks. NO detailed features, NO big eyes. Emotion through GESTURE only." |
| **Generic AI illustration** | "Bauhaus figure studies. Russian Constructivism. Architectural magazine illustration. NOT children's book." |

---

## Example Use Cases

### Example 1: "AGI Arrives" (4 panels)
- **Panel 1:** Person at desk, normal work
- **Panel 2:** AGI announcement (computer screen glowing)
- **Panel 3:** Person staring, processing
- **Panel 4:** Person still at desk: "...so what do I do now?"
- **Layout:** Horizontal 21:9
- **Character:** Purple accent on person

### Example 2: "Security Theater vs Real Security" (3 panels)
- **Panel 1:** Fancy lock on cardboard door (theater)
- **Panel 2:** Simple lock on solid door (real)
- **Panel 3:** Thief easily bypassing fancy lock, stopped by simple door
- **Layout:** Horizontal 16:9
- **Accents:** Purple on real security, teal on theater

### Example 3: "Junior vs Senior Engineer" (4 panels grid)
- **Panel 1 (top-left):** Junior with complex spaghetti code
- **Panel 2 (top-right):** Senior with simple elegant line
- **Panel 3 (bottom-left):** Both present to boss
- **Panel 4 (bottom-right):** Boss confused by junior's complexity, nodding at senior's simplicity
- **Layout:** Grid 1:1
- **Accents:** Purple on senior, teal on junior

---

## Quick Reference

**Editorial Comic Formula:**
```
1. Define narrative (concept, panels, arc, insight)
2. Design layout (arrangement, panel sizes, content)
3. Construct prompt with sequential structure
4. Choose aspect ratio for panel layout
5. Generate with nano-banana-pro
6. Validate for flow and sophistication
```

**Color Strategy:**
- Characters: Black linework + purple/teal accents
- Backgrounds: Simple light cream/white
- Dialogue: Charcoal
- Panels: Black borders

**Key Principle:**
- **Sophisticated, not silly** — New Yorker style, editorial intelligence
- **Visual storytelling** — Minimal dialogue, panels tell the story
- **brand aesthetic** — Flat color, hand-drawn, imperfect

---

**The workflow: Define → Design → Construct → Generate → Validate → Complete**
