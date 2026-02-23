# Visual Aphorisms & Quote Cards Workflow

**Aphorisms as shareable visual quote cards using editorial aesthetic.**

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the Aphorisms workflow in the Art skill to create quote cards"}' \
  > /dev/null 2>&1 &
```

Running **Aphorisms** in **Art**...

---

Creates **VISUAL APHORISM CARDS** — insights and quotes as shareable square images with massive typography and minimal hand-drawn accents.

---

## Purpose

Visual aphorism cards turn memorable one-liners into shareable social media content. These are **typographic statements with personality** — the quote IS the visual, with subtle editorial accents.

**Use this workflow for:**
- Social media quote cards (LinkedIn, Instagram, X)
- Newsletter pull quotes
- Aphorisms as standalone images
- Thought leadership visuals
- "HUMANS NEED ENTROPY" style statements
- Memorable insights amplified visually

---

## Visual Aesthetic: Typography as Hero

**Think:** Giant bold typography with subtle hand-drawn accent, not full illustration

### Core Characteristics
1. **Typography dominant** — The quote IS the visual (80-90% of image)
2. **Massive Advocate** — All-caps bold lettering fills the frame
3. **Minimal illustration** — Small subtle accent element (not full scene)
4. **Square format** — 1:1 for social media
5. **High contrast** — Black text on light, or white text on dark
6. **Hand-lettered quality** — Imperfect typography, not digital font
7. **Editorial voice** — Punchy, memorable, thought-provoking

---

## Color System for Aphorisms

### Typography
```
Black #000000 — Primary text (most common)
OR
Deep Purple #4A148C — Full text in brand color (alternative)
OR
White #FFFFFF — Text on dark background (high contrast)
```

### Accent Element
```
Deep Purple #4A148C — Small accent illustration
Deep Teal #00796B — Alternative accent color
```

### Background
```
Light Cream #F5E6D3 — Warm neutral (most common)
OR
White #FFFFFF — Clean modern
OR
Black #000000 — Dark dramatic (white text)
OR
Deep Purple #4A148C — Bold brand (white text)
```

### Color Strategy
- **High contrast typography** — Text must be immediately readable
- **Minimal color** — Quote + small accent, not busy
- **Brand presence** — Purple somewhere (text OR accent OR background)

---

## 🚨 MANDATORY WORKFLOW STEPS

### Step 1: Select Aphorism

**Choose the quote:**

1. **What's the aphorism?**
   - The exact quote
   - Must be punchy and memorable
   - Ideal length: 2-8 words (fits large on card)

2. **What's the insight?**
   - What makes this quote powerful
   - Why is it shareable

3. **What tiny visual accent supports it?**
   - NOT a full illustration
   - Small simple element reinforcing the idea
   - Examples: scatter dots for entropy, em dash for typography quote

**Output:**
```
APHORISM: "[Quote in all-caps]"
LENGTH: [X words]

INSIGHT: [Why this quote resonates]

ACCENT ELEMENT: [Tiny illustration, e.g.:]
- "scatter of dots" for entropy
- "em dash symbol" for typography topic
- "lightning bolt" for insight moment
- "simple line drawing" reinforcing concept
```

---

### Step 2: Design Typography Layout

**Plan the visual:**

1. **Typography arrangement:**
   - All one line (short quote)
   - Multiple lines (longer quote)
   - Stacked words (vertical emphasis)
   - Asymmetric layout (dynamic placement)

2. **Size and weight:**
   - How large can text go while remaining readable
   - Line breaks for rhythm and emphasis
   - Word hierarchy (which words largest)

3. **Accent placement:**
   - Where does small illustration go
   - How does it complement (not compete with) text
   - Size: 5-10% of image area

**Output:**
```
TYPOGRAPHY LAYOUT:
[Describe arrangement, e.g.:]
- "HUMANS NEED" on first line
- "ENTROPY" on second line (larger)
- All-caps Advocate style, massive bold letters
- Fills 80% of image area
- Hand-lettered imperfection

ACCENT ELEMENT:
- Small scatter of dots (entropy visual)
- Purple (#4A148C) colored
- Position: Bottom right corner
- Size: ~8% of image
- Does NOT compete with text

COLOR SCHEME:
- Text: [Black / Purple / White]
- Background: [Cream / White / Black / Purple]
- Accent: [Purple / Teal]
- Signature: Charcoal (optional)
```

---

### Step 3: Construct Prompt

### Prompt Template

```
Typographic quote card in editorial hand-lettered style.

STYLE REFERENCE: Bold typography poster, quote card, hand-lettered aphorism

BACKGROUND: [Light Cream #F5E6D3 / White #FFFFFF / Black #000000 / Purple #4A148C] — flat, solid

AESTHETIC:
- Typography as the primary visual (dominates composition)
- Hand-lettered Advocate style (imperfect, gestural, bold)
- Massive scale lettering (fills 80-90% of frame)
- Minimal accent illustration (subtle, not competing)
- High contrast for readability
- Square 1:1 format

QUOTE CARD STRUCTURE:

TYPOGRAPHY (Advocate Block Display - MASSIVE):
"[APHORISM TEXT IN ALL-CAPS]"

- Font: Advocate style extra bold, hand-lettered, all-caps
- Size: MASSIVE — fills most of image area
- Layout: [Single line / Multi-line / Stacked words]
- Line breaks: [Where breaks occur for rhythm]
  Line 1: "[FIRST PART]"
  Line 2: "[SECOND PART]" (optionally larger)
- Color: [Black #000000 / Purple #4A148C / White #FFFFFF]
- Style: Hand-lettered with imperfections (not perfect digital font)
- Variable letter sizing for emphasis
- Letters should have character and personality

ACCENT ILLUSTRATION (Minimal):
- [Small simple element, e.g., "scattered dots", "small em dash", "lightning bolt"]
- Hand-drawn, simple, editorial style
- Position: [Bottom right / Top left / etc. — does NOT interfere with text]
- Size: 5-10% of image area
- Color: [Purple #4A148C / Teal #00796B]
- Style: Imperfect sketch quality, matches text aesthetic
- Purpose: Subtle visual reinforcement, NOT competing focal point

COLOR USAGE:
- Background: [Color choice] — flat solid fill
- Typography: [Color choice] — high contrast with background
- Accent element: [Purple or Teal]
- Signature: Charcoal (#2D2D2D) small in corner (optional)

CRITICAL REQUIREMENTS:
- Typography is HERO (quote fills 80-90% of frame)
- Hand-lettered quality (wobbly lines, imperfect character shapes)
- NOT a digital font — should feel hand-drawn
- Accent illustration MINIMAL (does not distract from quote)
- High contrast readability (text must pop from background)
- Square 1:1 aspect ratio
- No gradients, flat colors only
- Shareable social media quality

Optional: Sign small in bottom right corner in charcoal (#2D2D2D).
```

---

### Step 4: Determine Aspect Ratio

**Always 1:1 (square)** — Optimized for social media (Instagram, LinkedIn, X)

---

### Step 5: Execute Generation

```bash
bun run ~/.claude/skills/art/Tools/Generate.ts \
  --model nano-banana-pro \
  --prompt "[YOUR PROMPT]" \
  --size 2K \
  --aspect-ratio 1:1 \
  --output /path/to/aphorism.png
```

**Model Recommendation:** nano-banana-pro (best text rendering) or flux (stylistic variety)

**Immediately Open:**
```bash
open /path/to/aphorism.png
```

---

### Step 6: Validation (MANDATORY)

#### Must Have
- [ ] **Quote readable** — Instantly legible even at thumbnail size
- [ ] **Typography dominant** — Quote is 80-90% of visual
- [ ] **Hand-lettered** — Imperfect, gestural quality (not digital font)
- [ ] **High contrast** — Text pops from background
- [ ] **Minimal accent** — Small element supports, doesn't compete
- [ ] **Shareable** — Works as social media post
- [ ] **Brand presence** — Purple visible somewhere (text/accent/background)

#### Must NOT Have
- [ ] Perfect digital font (should be hand-lettered)
- [ ] Busy background or complex illustration
- [ ] Low contrast (can't read text easily)
- [ ] Accent element competing with quote
- [ ] Tiny text (must be readable at thumbnail)
- [ ] Gradients or shadows

#### If Validation Fails

| Problem | Fix |
|---------|-----|
| Text too small | "MASSIVE hand-lettered typography filling 85% of frame" |
| Looks like digital font | "Hand-drawn Advocate letters, imperfect wobbly strokes, gestural quality" |
| Accent too busy | "MINIMAL accent: small simple [element], 8% of image, subtle" |
| Can't read thumbnail | Increase text size, stronger contrast, simplify layout |
| No brand presence | "Purple (#4A148C) on [accent element / text / background]" |
| Too complex | "Typography IS the visual — quote dominant, minimal everything else" |

---

## Example Use Cases

### Example 1: "HUMANS NEED ENTROPY"
- **Typography:** Two lines, "ENTROPY" larger
- **Accent:** Small scatter of purple dots (bottom right)
- **Background:** Light cream
- **Text:** Black
- **Use:** LinkedIn post, newsletter pull quote

### Example 2: "THE EM DASH IS PERFECT"
- **Typography:** Stacked words, "EM DASH" emphasized
- **Accent:** Small purple em dash symbol
- **Background:** White
- **Text:** Black
- **Use:** X post about typography

### Example 3: "AI COPIES HUMAN CREATIVITY"
- **Typography:** Three lines, "AI" and "CREATIVITY" larger
- **Accent:** Tiny robot hand + human hand (purple, minimal)
- **Background:** Black
- **Text:** White (high contrast)
- **Use:** Instagram thought leadership post

### Example 4: "SECURITY IS A FEELING"
- **Typography:** Two lines
- **Accent:** Small purple shield with heart
- **Background:** Purple #4A148C
- **Text:** White
- **Use:** Bold brand statement

---

## Quick Reference

**Aphorism Card Formula:**
```
1. Select aphorism (punchy quote, 2-8 words ideal)
2. Design typography layout (arrangement, emphasis, size)
3. Choose minimal accent element (5-10% of image)
4. Construct prompt with massive typography
5. Always use 1:1 square aspect ratio
6. Generate with nano-banana-pro
7. Validate for readability and shareability
```

**Color Strategy:**
- High contrast: Black text on cream, or white text on black/purple
- Brand presence: Purple somewhere in composition
- Minimal palette: Quote + accent + background = 3 colors max

**Key Principle:**
- **Typography IS the visual** — Everything else is subtle support
- Shareable, memorable, instantly readable
- Your voice amplified visually

---

**The workflow: Select → Design → Construct → Generate → Validate → Complete**
