# Illustrated Dichotomies & Comparisons Workflow

**Hand-drawn side-by-side visual comparisons using UL aesthetic.**

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the Comparisons workflow in the Art skill to create side-by-side visuals"}' \
  > /dev/null 2>&1 &
```

Running **Comparisons** in **Art**...

---

Creates **VISUAL COMPARISONS** — "X vs Y" split compositions, before/after transformations, and illustrated contrasts with editorial style.

---

## Purpose

Illustrated comparisons show two contrasting concepts, states, or approaches side-by-side. These are **visual dichotomies** that make differences immediately obvious through illustrated metaphor.

**Use this workflow for:**
- "X vs Y" comparisons
- Before/After transformations
- This/That contrasts
- Junior vs Senior behaviors
- Old way vs New way
- Opposite approaches

---

## Visual Aesthetic: Split Screen Editorial

**Think:** Magazine spread showing contrast, split composition with personality

### Core Characteristics
1. **Split composition** — Clear left/right or top/bottom division
2. **Mirror structure** — Parallel visual elements showing contrast
3. **Hand-drawn** — Both sides maintain editorial imperfect linework
4. **Color differentiation** — Purple for one side, teal for other (or both black)
5. **Immediate contrast** — Differences obvious at a glance
6. **Editorial style** — Flat colors, black linework, UL aesthetic
7. **Balanced layout** — Equal visual weight to both sides

### Character Requirements (When figures present)

**If comparison includes human or robot figures, MUST apply Planeform aesthetic:**
- Read: `~/.claude/skills/PAI/Aesthetic.md`
- Figures built from ANGULAR PLANES (no round forms)
- Adult proportions (1:7), NOT cute/stubby
- Faces are minimal geometric blocks
- Emotion through gesture/silhouette
- Constructivist/Bauhaus influence
- NOT cartoonish (sophisticated editorial)

---

## Color System for Comparisons

### Split Differentiation
```
Left/Top Side: Purple #4A148C accents
Right/Bottom Side: Teal #00796B accents
OR
Both sides: Black with strategic purple/teal highlights
```

### Structure
```
Black #000000 — Dividing line, all linework on both sides
Charcoal #2D2D2D — All text and labels
```

### Background
```
White #FFFFFF or Light Cream #F5E6D3 on both sides
OR
Left: Light Purple tint, Right: Light Teal tint (very subtle)
```

### Color Strategy
- Option 1: Purple accents left, Teal accents right (clear differentiation)
- Option 2: Both black linework, purple on "preferred" side
- Dividing line always black
- Maintain flat aesthetic, no gradients

---

## 🚨 MANDATORY WORKFLOW STEPS

### Step 1: Define Comparison

**Identify what you're contrasting:**

1. **What are the two sides?**
   - Side A: [Concept / State / Approach]
   - Side B: [Concept / State / Approach]

2. **What's the key difference?**
   - [What fundamentally distinguishes them]

3. **What visual metaphors show the contrast?**
   - Side A metaphor: [Physical object/scene]
   - Side B metaphor: [Contrasting object/scene]

4. **Is one side "better" or are they equal alternatives?**
   - Better: [Which side to highlight in purple]
   - Equal: [Use balanced color or both in black]

**Output:**
```
COMPARISON: [Side A] vs [Side B]

CORE CONTRAST: [What's fundamentally different]

VISUAL METAPHORS:
- Side A: [Metaphor showing this approach/state]
- Side B: [Contrasting metaphor]

VALUE JUDGMENT:
- [Neutral comparison] OR [Side X is preferred]

COLOR STRATEGY:
- [Purple left / Teal right] OR [Purple on preferred, black on alternative]
```

---

### Step 2: Design Split Layout

**Plan the visual structure:**

1. **Split orientation:**
   - Vertical split (left/right) — Classic comparison
   - Horizontal split (top/bottom) — Before/after flow
   - Diagonal split — More dynamic

2. **Mirror elements:**
   - What visual elements repeat on both sides
   - How metaphors contrast (same structure, different details)
   - Balance of visual weight

3. **Dividing line:**
   - Strong black line separating sides
   - Soft visual separation
   - No line (color/metaphor creates division)

**Output:**
```
SPLIT ORIENTATION: [Vertical left/right / Horizontal top/bottom]

LAYOUT STRUCTURE:
Left/Top: [Side A]
- Metaphor: [What to illustrate]
- Key elements: [Specific visual details]
- Color: [Purple accents / Black only]

Right/Bottom: [Side B]
- Metaphor: [Contrasting illustration]
- Key elements: [Specific visual details]
- Color: [Teal accents / Black only]

DIVIDING LINE:
- [Strong black vertical/horizontal line] OR [Soft separation] OR [No line]

MIRROR ELEMENTS:
- [What appears on both sides for parallel structure]
```

---

### Step 3: Construct Prompt

### Prompt Template

```
Hand-drawn split composition comparing two contrasting concepts in editorial style.

STYLE REFERENCE: Magazine comparison spread, split-screen editorial illustration, before/after visual

BACKGROUND: [White #FFFFFF OR Light Cream #F5E6D3] — clean, flat, both sides

AESTHETIC:
- Split composition with [vertical/horizontal] division
- Hand-drawn black linework on both sides (imperfect, gestural)
- Mirror structure showing parallel concepts with visual contrast
- Editorial flat color with strategic purple/teal differentiation
- Variable stroke weight, organic lines

SPLIT ORIENTATION: [Vertical left-to-right / Horizontal top-to-bottom]

COMPOSITION STRUCTURE:
- Clear [vertical/horizontal] division creating two equal sections
- [Black dividing line] OR [Visual separation through composition]
- Left/Top: [Side A name]
- Right/Bottom: [Side B name]

TYPOGRAPHY SYSTEM (3-TIER):

TIER 1 - COMPARISON TITLE (Advocate Block Display):
- "[SIDE A] VS [SIDE B]" — Large at top
- Font: Advocate style, extra bold, hand-lettered, all-caps
- Size: 3x larger than body text
- Color: Black #000000
- Position: Top center above split
- Example: "JUNIOR ENGINEER VS SENIOR ENGINEER"

TIER 2 - SIDE LABELS (Concourse Sans):
- Left/Top: "[Side A]"
- Right/Bottom: "[Side B]"
- Font: Concourse geometric sans-serif
- Size: Medium readable
- Color: Charcoal #2D2D2D
- Position: Headers for each side

TIER 3 - ANNOTATIONS (Advocate Condensed Italic):
- Key characteristics: "*overthinks*" vs "*simplifies*"
- Font: Advocate condensed italic
- Size: 60% of Tier 2
- Color: Matches side color (Purple left, Teal right)
- Position: Within each side's visual

LEFT/TOP SIDE - [SIDE A]:
Visual metaphor: [Describe the illustration, e.g.:]
- [Metaphor showing Side A characteristic]
- Hand-drawn with [imperfect lines, gestural quality]
- Color: Purple (#4A148C) accents on [specific elements]
- Black (#000000) primary linework
- Represents: [What this side embodies]

RIGHT/BOTTOM SIDE - [SIDE B]:
Visual metaphor: [Contrasting illustration, e.g.:]
- [Metaphor showing Side B characteristic]
- Hand-drawn matching style to left side
- Color: Teal (#00796B) accents on [specific elements]
- Black (#000000) primary linework
- Represents: [What this side embodies]

[OR if one side is preferred:]
- Preferred side: Purple (#4A148C) accents
- Alternative side: Black only (or subtle Teal)

DIVIDING LINE:
- [Strong black vertical/horizontal line down center] OR
- [Soft visual separation through composition and color]

COLOR USAGE:
- Black (#000000) for all linework on both sides and dividing line
- Left side: Purple (#4A148C) accents on [elements]
- Right side: Teal (#00796B) accents on [elements]
- Charcoal (#2D2D2D) for all label text
- OR: Purple on preferred side only, black on alternative

CRITICAL REQUIREMENTS:
- Hand-drawn editorial style on BOTH sides (consistent aesthetic)
- Clear visual contrast between sides (metaphors show difference)
- Mirror structure (parallel elements contrasted)
- Strategic color differentiation (purple vs teal, or purple on better side)
- No gradients, flat colors only
- Immediate visual understanding of the difference
- Equal visual weight to both sides (balanced composition)

Optional: Sign small in bottom right corner in charcoal (#2D2D2D).
```

---

### Step 4: Determine Aspect Ratio

| Split Type | Aspect Ratio | Reasoning |
|------------|--------------|-----------|
| Vertical split (left/right) | 16:9 or 21:9 | Wide for side-by-side |
| Horizontal split (top/bottom) | 9:16 or 1:1 | Vertical or square for stacking |
| Square balanced | 1:1 | Symmetric comparison |
| Social media | 1:1 | Instagram/LinkedIn friendly |

**Default: 16:9 (horizontal)** — Classic side-by-side comparison

---

### Step 5: Execute Generation

```bash
bun run ~/.claude/skills/art/Tools/Generate.ts \
  --model nano-banana-pro \
  --prompt "[YOUR PROMPT]" \
  --size 2K \
  --aspect-ratio 16:9 \
  --output /path/to/comparison.png
```

**Model Recommendation:** nano-banana-pro or flux (both work well for split compositions)

**Immediately Open:**
```bash
open /path/to/comparison.png
```

---

### Step 6: Validation (MANDATORY)

#### Must Have
- [ ] **Clear split** — Obvious division between two sides
- [ ] **Visual contrast** — Metaphors clearly show the difference
- [ ] **Balanced composition** — Equal visual weight to both sides
- [ ] **Readable labels** — Side names and annotations legible
- [ ] **Color differentiation** — Purple/teal (or purple/black) distinguishes sides
- [ ] **Hand-drawn** — Both sides maintain editorial aesthetic
- [ ] **Immediate understanding** — Difference obvious at a glance

#### Must NOT Have
- [ ] Unbalanced sides (one dominates)
- [ ] Unclear which is which
- [ ] Corporate comparison chart look
- [ ] Gradients or photorealistic elements
- [ ] Cluttered or confusing visuals
- [ ] Missing dividing line or separation

#### If Validation Fails

| Problem | Fix |
|---------|-----|
| Sides unclear | "Strong black dividing line down center, clear LEFT: vs RIGHT: labels" |
| Not balanced | "Equal visual weight, mirror structure, parallel composition both sides" |
| Contrast weak | "Stronger metaphor contrast: [Side A metaphor] vs [Side B opposite metaphor]" |
| Too complex | Simplify each side to single clear metaphor |
| Colors confusing | "Purple accents left side only, Teal accents right side only" |
| Looks corporate | Reference "editorial split composition, hand-drawn contrast illustration" |

---

## Example Use Cases

### Example 1: "Junior Engineer vs Senior Engineer"
- **Split:** Vertical left/right
- **Left (Junior):** Complex spaghetti code (purple tangle)
- **Right (Senior):** Simple elegant solution (teal straight line)
- **Color:** Purple left, Teal right
- **Aspect:** 16:9

### Example 2: "Before AI vs After AI"
- **Split:** Horizontal top/bottom
- **Top (Before):** Manual tedious work (person with paper pile)
- **Bottom (After):** Automated flow (person directing AI)
- **Color:** Purple on "After" (preferred state)
- **Aspect:** 9:16

### Example 3: "Security Theater vs Real Security"
- **Split:** Vertical left/right
- **Left (Theater):** Fancy locks on cardboard door
- **Right (Real):** Simple but solid construction
- **Color:** Purple right (effective), black left (ineffective)
- **Aspect:** 16:9

---

## Quick Reference

**Comparison Formula:**
```
1. Define comparison (sides, contrast, metaphors)
2. Design split layout (orientation, mirror elements, colors)
3. Construct prompt with split structure
4. Choose aspect ratio for split type
5. Generate with nano-banana-pro
6. Validate for clarity and balance
```

**Color Strategy:**
- Balanced comparison: Purple left, Teal right
- Value judgment: Purple on better side, black on other
- Neutral: Both black with subtle purple/teal accents

**Key Principle:**
- Difference should be immediately obvious
- Visual metaphors do the talking, minimal text needed

---

**The workflow: Define → Design → Construct → Generate → Validate → Complete**
