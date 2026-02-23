# Visual Mental Models & Frameworks Workflow

**Hand-drawn frameworks, mental models, and conceptual diagrams using UL aesthetic.**

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the Frameworks workflow in the Art skill to create diagrams"}' \
  > /dev/null 2>&1 &
```

Running **Frameworks** in **Art**...

---

Creates **VISUAL FRAMEWORKS** — signature mental models illustrated as memorable diagrams with editorial hand-drawn style.

---

## Purpose

Visual frameworks illustrate mental models, thinking frameworks, and conceptual relationships. These are **signature frameworks** made visual — 2x2 matrices, Venn diagrams, conceptual maps with personality and editorial style.

**Use this workflow for:**
- 2x2 matrices and quadrant models
- Venn diagrams with editorial flair
- Conceptual relationship maps
- "The [Your Name] Framework for X"
- Mental models and thinking tools
- Decision frameworks

---

## Visual Aesthetic: Structured Concepts with Editorial Style

**Think:** Smart conceptual diagram, but hand-drawn and visually interesting

### Core Characteristics
1. **Clear structure** — Framework shape is recognizable (2x2, Venn, pyramid, etc.)
2. **Hand-drawn organic** — Imperfect lines, wobbly circles, human touch
3. **Editorial aesthetic** — Flat colors, black linework, UL palette
4. **Labels integrated** — Typography part of visual design
5. **Conceptual clarity** — Framework immediately understandable
6. **Memorable visual** — Becomes THE reference image for this framework
7. **Thoughtful color** — Strategic use of purple/teal to show relationships

---

## Color System for Frameworks

### Structure
```
Black #000000 — All framework structure (axes, circles, boxes)
```

### Concept Differentiation
```
Deep Purple #4A148C — Concept area 1 or optimal quadrant
Deep Teal #00796B — Concept area 2 or contrast quadrant
Charcoal #2D2D2D — All text and labels
```

### Background
```
White #FFFFFF or Light Cream #F5E6D3
```

### Color Strategy
- Framework lines/structure in black
- Purple for "ideal" or primary concept
- Teal for "secondary" or contrast concept
- Subtle fills or accents, not solid color blocks

---

## 🚨 MANDATORY WORKFLOW STEPS

### Step 1: Define Framework Structure

**Identify the mental model:**

1. **What framework type?**
   - 2x2 matrix (four quadrants)
   - Venn diagram (overlapping circles)
   - Pyramid/hierarchy
   - Spectrum/continuum
   - Triangle (three-way balance)
   - Other conceptual shape

2. **What are the dimensions/concepts?**
   - For 2x2: X-axis concept, Y-axis concept
   - For Venn: Circle 1 concept, Circle 2 concept, overlap meaning
   - For pyramid: Levels from bottom to top

3. **What are the quadrants/areas/zones?**
   - Name and describe each region
   - Which is "optimal" or most important?

**Output:**
```
FRAMEWORK TYPE: [2x2 Matrix / Venn Diagram / Pyramid / etc.]

FRAMEWORK NAME: "The [Your Name] Framework for [Topic]"

DIMENSIONS:
- X-axis: [Concept] (Low → High)
- Y-axis: [Concept] (Low → High)

QUADRANTS/AREAS:
1. [Name]: [Description] — [Color if highlighted]
2. [Name]: [Description] — [Color if highlighted]
3. [Name]: [Description]
4. [Name]: [Description]

OPTIMAL ZONE: [Which quadrant/area is ideal]
```

---

### Step 2: Design Framework Visual

**Plan the visual representation:**

1. **Framework geometry:**
   - How large is each element
   - Proportions and spacing
   - Symmetry or intentional asymmetry

2. **Labeling strategy:**
   - Where axis labels go
   - Where quadrant names go
   - Additional annotations

3. **Color assignment:**
   - Which quadrant gets purple (optimal)
   - Which gets teal (contrast or secondary)
   - Rest remain black/white

**Output:**
```
VISUAL STRUCTURE:
[Describe the framework shape, e.g.:]
- Two intersecting axes forming four quadrants
- X-axis labeled [left] to [right]
- Y-axis labeled [bottom] to [top]
- Each quadrant labeled with concept name

COLOR CODING:
- Top-right quadrant (optimal): Purple #4A148C accent
- Bottom-left quadrant (contrast): Teal #00796B accent
- Other quadrants: Black structure only

TYPOGRAPHY PLACEMENT:
- Title (Tier 1): Top center
- Axis labels (Tier 2): Along axes
- Quadrant labels (Tier 2): Inside each quadrant
- Annotations (Tier 3): Strategic notes on key quadrants
```

---

### Step 3: Construct Prompt

### Prompt Template

```
Hand-drawn conceptual framework diagram in editorial style.

STYLE REFERENCE: Mental model illustration, conceptual diagram with personality, smart person's framework sketch

BACKGROUND: [White #FFFFFF OR Light Cream #F5E6D3] — clean, flat

AESTHETIC:
- Hand-drawn framework structure (wobbly lines, organic shapes)
- Variable stroke weight (axes thicker, details thinner)
- Imperfect but intentional geometry (circles not perfect, axes slightly wavy)
- Editorial flat color with strategic purple/teal accents
- Clear conceptual structure with human touch

FRAMEWORK TYPE: [2x2 Matrix / Venn Diagram / Pyramid / Spectrum / etc.]

FRAMEWORK STRUCTURE:
[Describe the specific framework geometry, e.g.:]
- Two hand-drawn perpendicular axes (black) forming cross
- X-axis: [Low concept] on left → [High concept] on right
- Y-axis: [Low concept] on bottom → [High concept] on top
- Four quadrants created by intersection

TYPOGRAPHY SYSTEM (3-TIER):

TIER 1 - FRAMEWORK TITLE (Advocate Block Display):
- "[FRAMEWORK NAME IN ALL-CAPS]"
- Font: Advocate style, extra bold, hand-lettered, all-caps
- Size: 3x larger than body text
- Color: Black #000000
- Position: Top center
- Example: "THE SECURITY VS CONVENIENCE FRAMEWORK"

TIER 2 - LABELS & CONCEPTS (Concourse Sans):
- Axis labels: "[X-axis concept]", "[Y-axis concept]"
- Quadrant names: "[Quadrant 1]", "[Quadrant 2]", etc.
- Font: Concourse geometric sans-serif
- Size: Medium readable
- Color: Charcoal #2D2D2D
- Position: Along axes and inside quadrants

TIER 3 - ANNOTATIONS (Advocate Condensed Italic):
- Insight notes: "*optimal zone*", "*avoid this quadrant*"
- Font: Advocate condensed italic
- Size: 60% of Tier 2
- Color: Purple #4A148C or Teal #00796B for emphasis
- Position: Near relevant quadrants/areas

QUADRANTS/AREAS TO SHOW:
[List each region with description, e.g.:]

TOP-RIGHT QUADRANT:
- Label: "[Name]"
- Description: [What this represents]
- Color: Purple (#4A148C) subtle accent/highlight — OPTIMAL ZONE
- Annotation: "*ideal state*" in purple italic

TOP-LEFT QUADRANT:
- Label: "[Name]"
- Description: [What this represents]
- Color: Black structure only

BOTTOM-RIGHT QUADRANT:
- Label: "[Name]"
- Description: [What this represents]
- Color: Teal (#00796B) subtle accent — CONTRAST ZONE

BOTTOM-LEFT QUADRANT:
- Label: "[Name]"
- Description: [What this represents]
- Color: Black structure only

[Adjust based on framework type - Venn would describe circles, pyramid would describe levels, etc.]

COLOR USAGE:
- Black (#000000) for all framework structure (axes, circles, lines)
- Deep Purple (#4A148C) for [optimal zone] — subtle fill or accent
- Deep Teal (#00796B) for [contrast zone] — subtle accent
- Charcoal (#2D2D2D) for all text except emphasized annotations

CRITICAL REQUIREMENTS:
- Hand-drawn imperfect geometry (NOT digital precision)
- Framework structure immediately recognizable
- Clear labels in 3-tier typography hierarchy
- Strategic color on 1-2 key zones only (subtle, not solid fills)
- No gradients, flat colors only
- Editorial illustration aesthetic maintained
- Conceptually clear and memorable

Optional: Sign small in bottom right corner in charcoal (#2D2D2D).
```

---

### Step 4: Determine Aspect Ratio

| Framework Type | Aspect Ratio | Reasoning |
|----------------|--------------|-----------|
| 2x2 Matrix | 1:1 | Square for balanced quadrants |
| Venn Diagram | 1:1 | Square for circular symmetry |
| Pyramid | 1:1 or 4:3 | Vertical emphasis |
| Horizontal spectrum | 16:9 | Wide for left-right continuum |
| Triangle | 1:1 | Balanced for three concepts |

**Default: 1:1 (square)** — Works for most framework types

---

### Step 5: Execute Generation

```bash
bun run ~/.claude/skills/art/Tools/Generate.ts \
  --model nano-banana-pro \
  --prompt "[YOUR PROMPT]" \
  --size 2K \
  --aspect-ratio 1:1 \
  --output /path/to/framework.png
```

**Model Recommendation:** nano-banana-pro (best text rendering for labels)

**Immediately Open:**
```bash
open /path/to/framework.png
```

---

### Step 6: Validation (MANDATORY)

#### Must Have
- [ ] **Framework structure clear** — 2x2 / Venn / Pyramid immediately recognizable
- [ ] **Readable labels** — All text legible in 3-tier hierarchy
- [ ] **Hand-drawn aesthetic** — Imperfect lines, organic shapes, human quality
- [ ] **Strategic color** — Purple on optimal zone, teal on contrast, not everywhere
- [ ] **Conceptually memorable** — This becomes THE reference image for framework
- [ ] **Editorial style** — Maintains UL flat color, black linework aesthetic

#### Must NOT Have
- [ ] Perfect digital geometry (too clean)
- [ ] Illegible or cluttered text
- [ ] Color overload (solid fills everywhere)
- [ ] Confusing structure (can't identify framework type)
- [ ] Corporate/boring diagram look
- [ ] Gradients or shadows

#### If Validation Fails

| Problem | Fix |
|---------|-----|
| Too precise/digital | "Hand-drawn wobbly axes, organic imperfect circles, human sketch quality" |
| Text unreadable | Increase label sizes, simplify annotations |
| Over-colored | "Subtle purple accent on optimal zone only, rest black structure" |
| Confusing structure | Simplify framework, stronger geometry cues |
| Looks corporate | Reference "editorial conceptual illustration, Saul Steinberg style" |
| Not memorable | Add strategic annotation showing the insight: "*this is the sweet spot*" |

---

## Example Use Cases

### Example 1: "Security vs Convenience Framework"
- **Type:** 2x2 matrix
- **Axes:** Security (low → high), Convenience (low → high)
- **Quadrants:** Vulnerable, Fortress, Balanced (purple), Abandoned
- **Color:** Purple on "Balanced" optimal quadrant
- **Aspect:** 1:1

### Example 2: "Human 3.0 Capability Venn"
- **Type:** Venn diagram (3 circles)
- **Circles:** Human abilities, AI capabilities, Tools
- **Overlap:** Where magic happens (purple)
- **Color:** Purple on center overlap
- **Aspect:** 1:1

### Example 3: "Threat Modeling Pyramid"
- **Type:** Pyramid (4 levels)
- **Levels:** Assets (bottom) → Threats → Vulnerabilities → Mitigations (top)
- **Color:** Purple on top level (actions), teal on bottom (foundation)
- **Aspect:** 4:3

---

## Quick Reference

**Framework Formula:**
```
1. Define framework structure (type, dimensions, quadrants)
2. Design visual (geometry, labeling, color assignment)
3. Construct prompt with clear structure
4. Choose square aspect ratio (usually 1:1)
5. Generate with nano-banana-pro
6. Validate for clarity and memorability
```

**Color Strategy:**
- Framework structure: Black
- Optimal zone: Purple (subtle accent)
- Contrast zone: Teal (subtle accent)
- Text: Charcoal (except emphasized annotations)

**Key Principle:**
- This becomes THE reference image people remember for this framework
- Must be conceptually clear AND visually distinctive

---

**The workflow: Define → Design → Construct → Generate → Validate → Complete**
