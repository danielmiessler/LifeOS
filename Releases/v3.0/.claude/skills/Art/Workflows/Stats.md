# Illustrated Statistics Workflow

**Single striking statistics illustrated as visual data points using UL aesthetic.**

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the Stats workflow in the Art skill to create stat cards"}' \
  > /dev/null 2>&1 &
```

Running **Stats** in **Art**...

---

Creates **ILLUSTRATED STAT CARDS** — one number/statistic made visual with simple illustration and editorial style.

---

## Purpose

Illustrated statistics turn data points into memorable visuals. These are **single-stat cards** — one striking number with a small illustration showing what it means, designed for newsletters and social media.

**Use this workflow for:**
- Newsletter "by the numbers" sections
- Social media stat cards
- Quick visual facts
- Data highlights
- "78% of developers use AI daily" style visuals
- Attention-grabbing numbers

---

## Visual Aesthetic: Number + Tiny Context Illustration

**Think:** Bold number dominates, small illustration shows what it means

### Core Characteristics
1. **Number dominant** — The statistic is the hero (60-70% of visual)
2. **Massive typography** — Large bold number immediately visible
3. **Small illustration** — Tiny visual showing what stat represents (20-30%)
4. **Context text** — Brief description of what number means
5. **Hand-drawn** — Imperfect number rendering, editorial illustration
6. **Square or horizontal** — Social/newsletter friendly
7. **Scannable** — Number jumps out immediately

---

## Color System for Stats

### Number Typography
```
Deep Purple #4A148C — Primary number (most common)
OR
Black #000000 — Alternative bold number
```

### Illustration
```
Black #000000 — Small illustration linework
Deep Purple #4A148C — Accents on illustration
Deep Teal #00796B — Alternative accents
```

### Background
```
Light Cream #F5E6D3 — Warm neutral
OR
White #FFFFFF — Clean modern
```

### Text
```
Charcoal #2D2D2D — Context description text
```

### Color Strategy
- Number in purple (brand emphasis) or black (classic)
- Illustration primarily black with purple accents
- Background light for contrast
- Keep it simple: 2-3 colors total

---

## 🚨 MANDATORY WORKFLOW STEPS

### Step 1: Select Statistic

**Identify the data point:**

1. **What's the statistic?**
   - The exact number and metric
   - Must be striking or surprising

2. **What does it represent?**
   - Context explanation
   - Why it matters

3. **What tiny illustration shows it?**
   - Simple visual representing what stat measures
   - Not complex scene, just small icon/illustration
   - Should clarify or amplify the meaning

**Output:**
```
STATISTIC: [Number + unit, e.g., "78%", "$2.1B", "3.5X"]
METRIC: [What's being measured]

CONTEXT: [What this number represents]

ILLUSTRATION: [Small visual element, e.g.:]
- "Tiny developer at computer" for developer stat
- "Stack of coins" for money stat
- "Growing arrow" for growth stat
- Size: 20-30% of image, simple, not detailed
```

---

### Step 2: Design Stat Card Layout

**Plan the visual:**

1. **Number placement:**
   - Center dominant (number in middle)
   - Left number, right illustration
   - Top number, bottom illustration

2. **Number size:**
   - How large can it go
   - Should fill 50-60% of image height

3. **Illustration placement:**
   - Where relative to number
   - How it interacts with number (near, below, beside)

4. **Text placement:**
   - Metric description above or below number
   - Context note if needed

**Output:**
```
LAYOUT STRUCTURE:
- Number: [Placement, e.g., "Center dominant"]
- Size: [60% of image height]
- Illustration: [Placement, e.g., "Bottom right, 25% of image"]
- Metric text: [Above number]
- Context: [Below number in smaller text]

VISUAL RELATIONSHIP:
[How number and illustration interact, e.g.:]
- "78%" in massive purple
- Small illustrated developer sitting on top of "%" symbol
- Text above: "of developers"
- Text below: "use AI tools daily"

COLOR SCHEME:
- Number: Purple (#4A148C)
- Illustration: Black linework with purple accents
- Background: Light cream
- Text: Charcoal
```

---

### Step 3: Construct Prompt

### Prompt Template

```
Illustrated statistic card in editorial style.

STYLE REFERENCE: Data visualization, stat card, number + icon illustration

BACKGROUND: [Light Cream #F5E6D3 / White #FFFFFF] — flat, clean

AESTHETIC:
- Number as dominant visual element (massive typography)
- Small simple illustration providing context
- Hand-drawn imperfect number rendering (not digital font)
- Editorial flat color with strategic purple emphasis
- Scannable, immediate impact

STAT CARD STRUCTURE:

NUMBER TYPOGRAPHY (Advocate Block Display - MASSIVE):
"[STATISTIC]"

- Font: Advocate style extra bold, hand-lettered
- Size: MASSIVE — 60-70% of image area
- Color: [Deep Purple #4A148C / Black #000000]
- Style: Hand-lettered with imperfections (wobbly lines, character)
- Position: [Center / Left / Top]
- Example: "78%" in giant purple hand-lettered numbers

METRIC TEXT (Concourse Sans - Medium):
"[what the stat measures]"

- Font: Concourse geometric sans-serif
- Size: Medium readable (15-20% of number size)
- Color: Charcoal (#2D2D2D)
- Position: [Above / Below number]
- Example: "of developers" above the 78%

CONTEXT TEXT (Advocate Condensed - Small):
"[additional context]"

- Font: Advocate condensed
- Size: Small (10-15% of number size)
- Color: Charcoal (#2D2D2D)
- Position: [Below number / Bottom of card]
- Example: "use AI tools daily" below the number

ILLUSTRATION (Small, Simple):
[Describe the tiny illustration, e.g.:]
- Small hand-drawn [icon/figure]
- Hand-drawn black (#000000) linework
- Purple (#4A148C) accents on [specific elements]
- Position: [Bottom right / Next to number / etc.]
- Size: 20-30% of image area
- Style: Simple sketch, not detailed
- Represents: [What the stat is about]
- Example: "Tiny developer sitting at computer with code on screen"

VISUAL INTERACTION:
[How illustration and number relate, e.g.:]
- Illustration positioned [near/on/beside] the number
- Creates visual story: "Developer represents the 78%"
- Illustration does NOT compete with number (stays small)

COLOR USAGE:
- Number: Deep Purple (#4A148C) OR Black (#000000)
- Illustration linework: Black (#000000)
- Illustration accents: Purple (#4A148C) OR Teal (#00796B)
- Metric/context text: Charcoal (#2D2D2D)
- Background: Light Cream (#F5E6D3) OR White (#FFFFFF)

CRITICAL REQUIREMENTS:
- Number is HERO (dominates composition, 60-70%)
- Hand-lettered number quality (NOT digital font)
- Illustration SMALL and SIMPLE (supporting role, 20-30%)
- High contrast for readability
- Strategic purple emphasis (number OR illustration accents)
- No gradients, flat colors only
- Immediately scannable (number jumps out at thumbnail)
- Square 1:1 or horizontal 16:9 format

Optional: Sign small in bottom right corner in charcoal (#2D2D2D).
```

---

### Step 4: Determine Aspect Ratio

| Use Case | Aspect Ratio | Reasoning |
|----------|--------------|-----------|
| Social media post | 1:1 | Instagram/LinkedIn friendly |
| Newsletter inline | 16:9 | Horizontal fits email width |
| Vertical mobile | 9:16 | Instagram story format |
| Balanced | 1:1 | Works everywhere |

**Default: 1:1 (square)** — Most versatile for social/newsletter

---

### Step 5: Execute Generation

```bash
bun run ~/.claude/skills/art/Tools/Generate.ts \
  --model nano-banana-pro \
  --prompt "[YOUR PROMPT]" \
  --size 2K \
  --aspect-ratio 1:1 \
  --output /path/to/stat-card.png
```

**Model Recommendation:** nano-banana-pro (excellent for rendering numbers clearly)

**Immediately Open:**
```bash
open /path/to/stat-card.png
```

---

### Step 6: Validation (MANDATORY)

#### Must Have
- [ ] **Number dominant** — Statistic is 60-70% of visual, immediately visible
- [ ] **Readable number** — Clear even at thumbnail size
- [ ] **Hand-lettered** — Imperfect, gestural quality (not digital font)
- [ ] **Illustration simple** — Small supporting visual, not complex scene
- [ ] **Context clear** — Metric/context text explains what number means
- [ ] **High contrast** — Purple or black number pops from background
- [ ] **Scannable** — Number jumps out immediately

#### Must NOT Have
- [ ] Number too small (should dominate)
- [ ] Digital font rendering (should be hand-lettered)
- [ ] Complex detailed illustration (should be simple icon)
- [ ] Illustration competing with number
- [ ] Low contrast (can't read number)
- [ ] Missing context (unclear what stat represents)

#### If Validation Fails

| Problem | Fix |
|---------|-----|
| Number too small | "MASSIVE hand-lettered number filling 65% of image height" |
| Looks digital | "Hand-drawn Advocate style number, wobbly imperfect strokes" |
| Illustration too complex | "SMALL SIMPLE illustration, minimal detail, 25% of image size" |
| Can't read thumbnail | Increase number size, stronger contrast |
| Unclear meaning | Add metric text above: "of [X]", context below: "[what they do]" |
| No visual interest | "Small illustrated [icon] showing what stat represents" |

---

## Example Use Cases

### Example 1: "78% of developers use AI daily"
- **Number:** "78%" in massive purple hand-lettering
- **Metric:** "of developers" above number
- **Context:** "use AI tools daily" below
- **Illustration:** Tiny developer at computer with AI sparkles (bottom right, 25%)
- **Aspect:** 1:1

### Example 2: "$2.1B invested in AI safety"
- **Number:** "$2.1B" in giant black hand-lettering
- **Metric:** "invested in" above
- **Context:** "AI safety research" below
- **Illustration:** Small stack of coins with shield symbol (purple accents)
- **Aspect:** 1:1

### Example 3: "3.5X growth in AI adoption"
- **Number:** "3.5X" in massive purple
- **Metric:** "growth in" above
- **Context:** "enterprise AI adoption" below
- **Illustration:** Upward arrow with small building icon
- **Aspect:** 16:9 (horizontal for newsletter)

### Example 4: "92% of security breaches involve humans"
- **Number:** "92%" in black bold hand-lettering
- **Metric:** "of breaches" above
- **Context:** "involve human error" below
- **Illustration:** Tiny person with open door/lock symbol (purple accents)
- **Aspect:** 1:1

---

## Quick Reference

**Illustrated Stat Formula:**
```
1. Select statistic (number, metric, context)
2. Design layout (number dominant, illustration placement)
3. Choose simple illustration (what stat represents)
4. Construct prompt with massive number
5. Use 1:1 square aspect ratio (usually)
6. Generate with nano-banana-pro
7. Validate for dominance and readability
```

**Color Strategy:**
- Number: Purple (emphasis) or Black (classic)
- Illustration: Black linework + purple accents
- Text: Charcoal
- Background: Light cream or white

**Key Principle:**
- **Number IS the visual** — Illustration is small supporting context
- Immediate impact, scannable at thumbnail
- Context makes meaning clear

---

**The workflow: Select → Design → Construct → Generate → Validate → Complete**
