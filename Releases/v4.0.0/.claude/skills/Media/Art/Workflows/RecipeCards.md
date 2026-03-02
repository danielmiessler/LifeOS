# Process Recipe Cards Workflow

**Step-by-step visual recipes for processes and methodologies using brand aesthetic.**

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the RecipeCards workflow in the Art skill to create recipe cards"}' \
  > /dev/null 2>&1 &
```

Running **RecipeCards** in **Art**...

---

Creates **PROCESS RECIPE CARDS** — numbered steps with small illustrations for each action, combining procedural clarity with editorial style.

---

## Purpose

Process recipe cards present methodologies, workflows, and step-by-step processes as visual recipes. These **illustrated how-to guides** make complex processes scannable and memorable.

**Use this workflow for:**
- "The 5-Step TELOS Analysis Recipe"
- Consulting methodology playbooks
- How-to guides and processes
- Workflow documentation
- Best practice checklists
- Strategic frameworks with steps

---

## Visual Aesthetic: Recipe Card with Personality

**Think:** Cooking recipe card, but for business processes, with editorial hand-drawn style

### Core Characteristics
1. **Numbered steps** — Clear 1, 2, 3 progression
2. **Small illustration per step** — Icon or simple visual for each action
3. **Scannable format** — Easy to reference and follow
4. **Recipe card layout** — Compact, organized, referenceable
5. **Hand-drawn icons** — Imperfect, editorial style illustrations
6. **Typography hierarchy** — 3-tier system for title, steps, details
7. **Deliverable quality** — Professional enough for client handoff

---

## Color System for Recipe Cards

### Structure
```
Black #000000 — Step numbers, dividing lines, icon outlines
```

### Step Differentiation
```
Deep Purple #4A148C — Critical steps or outcomes
Deep Teal #00796B — Supporting steps or inputs
Charcoal #2D2D2D — All body text and descriptions
```

### Background
```
Light Cream #F5E6D3 — Recipe card warmth
OR
White #FFFFFF — Clean modern
```

### Color Strategy
- Step numbers in black (or purple for critical steps)
- Icons primarily black linework with strategic purple/teal accents
- Text in charcoal for readability
- Outcome/result step in purple (final step)

---

## 🚨 MANDATORY WORKFLOW STEPS

### Step 1: Define Process

**Identify the recipe:**

1. **What process are you documenting?**
   - Process name
   - Overall goal/outcome

2. **How many steps?**
   - Ideal: 3-7 steps (recipe card format)
   - Too many steps → break into multiple recipes

3. **What are the steps?**
   - List each action in sequence
   - What happens at each step
   - What's the outcome

**Output:**
```
PROCESS NAME: [The X Recipe / X-Step Y Method]
OUTCOME: [What this process achieves]

STEPS:
1. [Step name] — [Action description] — [Icon metaphor]
2. [Step name] — [Action description] — [Icon metaphor]
3. [Step name] — [Action description] — [Icon metaphor]
4. [Step name] — [Action description] — [Icon metaphor]
5. [Step name] — [Action description] — [Icon metaphor]

CRITICAL STEPS (Purple):
- [Which step(s) are most important]
```

---

### Step 2: Design Recipe Card Layout

**Plan the visual structure:**

1. **Layout style:**
   - Vertical list (top to bottom)
   - Grid (2x3 for 6 steps)
   - Linear horizontal flow
   - Circular flow (process loops)

2. **Step representation:**
   - Number badge (circled number)
   - Small icon illustration for step
   - Brief text description
   - Arrow to next step

3. **Visual flow:**
   - How steps connect
   - Progressive visual cues
   - Final outcome emphasis

**Output:**
```
LAYOUT: [Vertical list / Grid / Horizontal flow / Circular]

CARD STRUCTURE:
- Title at top (Tier 1 typography)
- [X] steps arranged [vertically/in grid]
- Each step contains:
  * Numbered badge (e.g., "1" in circle)
  * Small hand-drawn icon/illustration
  * Step name (Tier 2)
  * Brief description (Tier 3)
- Arrows or lines connecting steps
- Final outcome emphasized

ICON METAPHORS:
Step 1: [Simple icon, e.g., "magnifying glass" for discover]
Step 2: [Icon, e.g., "lightbulb" for ideate]
Step 3: [Icon, e.g., "hammer" for build]
...

COLOR CODING:
- Step [X] (critical): Purple badge and icon accents
- Step [Y] (outcome): Purple emphasis
- Other steps: Black badges, minimal color
```

---

### Step 3: Construct Prompt

### Prompt Template

```
Hand-drawn process recipe card in editorial style.

STYLE REFERENCE: Recipe card, visual playbook, illustrated step-by-step guide

BACKGROUND: [Light Cream #F5E6D3 OR White #FFFFFF] — clean, card-like

AESTHETIC:
- Recipe card layout (organized, scannable)
- Hand-drawn step icons (simple, imperfect, editorial style)
- Numbered steps with clear progression
- Variable stroke weight (icons and dividing lines)
- Professional but human quality (deliverable to clients)

LAYOUT TYPE: [Vertical list / Grid / Horizontal flow]

CARD STRUCTURE:
[Describe the overall layout, e.g.:]
- Title at top
- 5 steps arranged vertically down the card
- Each step has: numbered badge → icon → name → description
- Arrows connecting steps showing flow
- Final step emphasized with purple accent

TYPOGRAPHY SYSTEM (3-TIER):

TIER 1 - RECIPE TITLE (Advocate Block Display):
- "[PROCESS NAME]" — Large at top
- Font: Advocate style, extra bold, hand-lettered, all-caps
- Size: 3x larger than body text
- Color: Black #000000
- Example: "THE 5-STEP TELOS ANALYSIS RECIPE"

TIER 2 - STEP NAMES (Concourse Sans):
- "Step 1: [Name]", "Step 2: [Name]", etc.
- Font: Concourse geometric sans-serif
- Size: Medium readable
- Color: Charcoal #2D2D2D (or Purple for critical step)
- Position: Next to each step icon

TIER 3 - STEP DESCRIPTIONS (Advocate Condensed):
- Brief action description for each step
- Font: Advocate condensed (smaller)
- Size: 60% of Tier 2
- Color: Charcoal #2D2D2D
- Position: Below step name

PROCESS STEPS TO ILLUSTRATE:
[List each step in detail, e.g.:]

STEP 1: [Step Name]
- Number badge: "1" in black circle
- Icon: [Hand-drawn simple icon, e.g., "magnifying glass examining document"]
- Description: "[Brief action description]"
- Color: Black linework
- Arrows: Black arrow pointing to Step 2

STEP 2: [Step Name]
- Number badge: "2" in black circle
- Icon: [Hand-drawn icon, e.g., "hands sorting cards"]
- Description: "[Action description]"
- Color: Black linework
- Arrows: Black arrow pointing to Step 3

STEP 3: [Critical Step Name]
- Number badge: "3" in Purple (#4A148C) circle — CRITICAL STEP
- Icon: [Hand-drawn icon with purple accents]
- Description: "[Action description]"
- Color: Purple (#4A148C) accents on icon and badge
- Arrows: Purple arrow pointing to Step 4

[Continue for all steps...]

FINAL STEP [X]: [Outcome]
- Number badge: "[X]" in Purple (#4A148C) circle — OUTCOME
- Icon: [Success/completion icon, e.g., "trophy", "checkmark", "rocket"]
- Description: "[Outcome achieved]"
- Color: Purple (#4A148C) emphasis
- Represents: Final result of process

CONNECTING ELEMENTS:
- Hand-drawn arrows between steps (wobbly, imperfect)
- Dotted or dashed lines for optional paths
- All arrows in Black (#000000) except critical path (Purple)

COLOR USAGE:
- Black (#000000) for most step badges, icons, arrows
- Deep Purple (#4A148C) for critical step(s) and final outcome
- Deep Teal (#00796B) optional for input/supporting steps
- Charcoal (#2D2D2D) for all text

CRITICAL REQUIREMENTS:
- Hand-drawn recipe card aesthetic (not polished diagram)
- Simple scannable icons for each step (not detailed illustrations)
- Clear numbered progression (1 → 2 → 3 → outcome)
- 3-tier typography hierarchy
- Strategic purple emphasis on critical/outcome steps
- No gradients, flat colors only
- Professional deliverable quality (client-ready)
- Recipe card proportions (vertical card layout)

Optional: Sign small in bottom right corner in charcoal (#2D2D2D).
```

---

### Step 4: Determine Aspect Ratio

| Recipe Type | Aspect Ratio | Reasoning |
|-------------|--------------|-----------|
| Vertical list (3-7 steps) | 9:16 or 4:3 | Tall card format |
| Grid layout (6-9 steps) | 1:1 | Square balanced grid |
| Horizontal flow | 16:9 | Wide linear progression |
| Circular process | 1:1 | Square for circular symmetry |

**Default: 9:16 (vertical)** — Classic recipe card orientation

---

### Step 5: Execute Generation

```bash
bun run ~/.claude/skills/art/Tools/Generate.ts \
  --model nano-banana-pro \
  --prompt "[YOUR PROMPT]" \
  --size 2K \
  --aspect-ratio 9:16 \
  --output /path/to/recipe-card.png
```

**Model Recommendation:** nano-banana-pro (best text rendering for steps)

**Immediately Open:**
```bash
open /path/to/recipe-card.png
```

---

### Step 6: Validation (MANDATORY)

#### Must Have
- [ ] **Clear progression** — Steps obviously flow 1 → 2 → 3
- [ ] **Scannable layout** — Easy to reference quickly
- [ ] **Simple icons** — Each step has recognizable illustration
- [ ] **Readable text** — All step names and descriptions legible
- [ ] **Strategic color** — Purple on critical/outcome steps
- [ ] **Hand-drawn quality** — Recipe card has editorial aesthetic
- [ ] **Professional deliverable** — Client-ready quality

#### Must NOT Have
- [ ] Complex detailed illustrations (should be simple icons)
- [ ] Cluttered layout (too much information)
- [ ] Illegible small text
- [ ] Missing step numbers
- [ ] Unclear flow or progression
- [ ] Corporate process diagram look

#### If Validation Fails

| Problem | Fix |
|---------|-----|
| Icons too complex | "Simple hand-drawn icons, minimal detail, recognizable at glance" |
| Can't follow flow | "Clear numbered badges 1→2→3, black arrows connecting steps" |
| Too cluttered | Reduce description text, simplify layout |
| Looks corporate | Reference "recipe card aesthetic, hand-drawn playbook, editorial style" |
| Text unreadable | Increase Tier 2/3 text sizes, more spacing |
| Missing emphasis | "Purple (#4A148C) on Step [X] critical and final outcome step" |

---

## Example Use Cases

### Example 1: "5-Step TELOS Analysis Recipe"
- **Steps:** Context → Questions → Blockers → Constraints → Solutions
- **Icons:** Magnifying glass, question marks, roadblock, fence, lightbulb
- **Color:** Purple on final "Solutions" step
- **Layout:** Vertical 9:16
- **Use:** Consulting deliverable

### Example 2: "The Security Assessment Method"
- **Steps:** Assets → Threats → Vulnerabilities → Mitigations → Validation
- **Icons:** Treasure, storm, crack, shield, checkmark
- **Color:** Purple on "Mitigations" (critical) and "Validation" (outcome)
- **Layout:** Vertical 9:16

### Example 3: "3-Step Content Creation Recipe"
- **Steps:** Research → Create → Distribute
- **Icons:** Books, pencil, megaphone
- **Color:** Purple on final "Distribute" outcome
- **Layout:** Horizontal 16:9 (simpler process)

---

## Quick Reference

**Recipe Card Formula:**
```
1. Define process (name, steps, outcome)
2. Design layout (vertical/grid, icons, flow)
3. Construct prompt with numbered progression
4. Choose aspect ratio for layout type
5. Generate with nano-banana-pro
6. Validate for scannability and professionalism
```

**Color Strategy:**
- Most steps: Black badges and icons
- Critical step: Purple badge and accents
- Final outcome: Purple emphasis
- Text: Charcoal

**Icon Design:**
- Simple, recognizable, hand-drawn
- Not detailed illustrations
- Represents the action of that step

---

**The workflow: Define → Design → Construct → Generate → Validate → Complete**
