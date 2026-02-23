# Conceptual Timelines & Progressions Workflow

**Hand-drawn timelines showing evolution, trends, and transformations using UL aesthetic.**

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the Timelines workflow in the Art skill to create timelines"}' \
  > /dev/null 2>&1 &
```

Running **Timelines** in **Art**...

---

Creates **ILLUSTRATED TIMELINES** — chronological progressions with visual metaphors for each stage, combining narrative arc with temporal information.

---

## Purpose

Conceptual timelines show change over time through illustrated progression. Unlike simple date lists, these timelines use **visual metaphors at each stage** to show transformation, evolution, or historical development.

**Use this workflow for:**
- "The Evolution of X"
- Trend analysis over time
- Historical perspectives
- Before → During → After progressions
- Transformation journeys
- Era comparisons

---

## Visual Aesthetic: Illustrated Progression

**Think:** Hand-drawn timeline with small illustrations at each milestone

### Core Characteristics
1. **Temporal flow** — Clear left-to-right or top-to-bottom progression
2. **Illustrated milestones** — Small visual metaphor at each point
3. **Hand-drawn timeline** — Organic line connecting events (not ruler-straight)
4. **Typography hierarchy** — 3-tier system for dates, labels, annotations
5. **Narrative arc** — Shows transformation, not just chronology
6. **Editorial style** — Maintains UL flat color, black linework aesthetic
7. **Scannable progression** — Easy to follow the flow of time

---

## Color System for Timelines

### Structure
```
Black #000000 — Timeline spine/line, all primary structure
```

### Emphasis & Progression
```
Deep Purple #4A148C — Key turning points, critical milestones
Deep Teal #00796B — Secondary events, supporting milestones
Charcoal #2D2D2D — All text (dates, labels, annotations)
```

### Background
```
White #FFFFFF or Light Cream #F5E6D3
```

### Color Strategy
- Timeline line in black
- 1-2 most important milestones in purple
- Supporting milestones in teal
- Most events remain black with charcoal text

---

## 🚨 MANDATORY WORKFLOW STEPS

### Step 1: Define Timeline Structure

**Identify what you're showing:**

1. **What's evolving?** (e.g., AI development, security paradigms, organizational thinking)
2. **Time span?** (e.g., 1990-2025, past 5 years, projected future)
3. **Key milestones?** (List 4-8 major points - too many becomes cluttered)
4. **What's the narrative arc?** (e.g., collapse → crisis → renewal, winter → spring → summer)

**Output:**
```
SUBJECT: [What's changing over time]
TIME SPAN: [Start year] → [End year]

NARRATIVE ARC: [The transformation story, e.g., "From hype to disillusionment to practical value"]

KEY MILESTONES:
1. [Year/Period]: [Event] — [Metaphor for this stage]
2. [Year/Period]: [Event] — [Metaphor for this stage]
3. [Year/Period]: [Event] — [Metaphor for this stage]
4. [Year/Period]: [Event] — [Metaphor for this stage]
...

TURNING POINTS (Purple highlights):
- [Which 1-2 milestones are most critical]
```

---

### Step 2: Design Timeline Layout

**Plan the visual flow:**

1. **Orientation:**
   - Horizontal (left-to-right): Traditional, good for desktop/wide
   - Vertical (top-to-bottom): Mobile-friendly, scrollable
   - Curved/organic: More artistic, less rigid

2. **Milestone representation:**
   - What small illustration represents each stage
   - How milestones connect to timeline (above/below, branching)
   - Size variation (bigger for more important events)

3. **Spacing:**
   - Even spacing (visual balance)
   - Proportional spacing (matches actual time)
   - Clustered spacing (groups related events)

**Output:**
```
ORIENTATION: [Horizontal / Vertical / Curved]

TIMELINE STRUCTURE:
- Main line: [Black hand-drawn line, slightly wobbly]
- Milestones: [Small illustrated circles/nodes along line]
- Labels: [Above or below timeline]

MILESTONE ILLUSTRATIONS:
1. [Year]: [Small icon/metaphor] — [e.g., "seedling" for beginning]
2. [Year]: [Small icon/metaphor] — [e.g., "storm" for crisis]
3. [Year]: [Small icon/metaphor] — [e.g., "sunrise" for renewal]
...

SPACING: [Even / Proportional / Clustered]

COLOR HIGHLIGHTS:
- Purple: [Critical milestone(s)]
- Teal: [Supporting milestone(s)]
- Black: [Standard milestones]
```

---

### Step 3: Construct Prompt

### Prompt Template

```
Hand-drawn conceptual timeline in editorial illustration style.

STYLE REFERENCE: Illustrated history timeline, hand-drawn progress chart, editorial time progression

BACKGROUND: [White #FFFFFF OR Light Cream #F5E6D3] — clean, flat

AESTHETIC:
- Hand-drawn timeline (organic line, slightly wobbly, not ruler-straight)
- Small illustrated metaphors at each milestone
- Variable stroke weight (timeline thicker, details thinner)
- Editorial flat color with strategic purple/teal accents
- Imperfect but intentional placement

ORIENTATION: [Horizontal left-to-right / Vertical top-to-bottom]

TIMELINE STRUCTURE:
- Black (#000000) timeline spine running [horizontally/vertically]
- [Number] milestone points along timeline
- Each milestone has: small circle/node + illustration + label
- Hand-drawn connecting line with slight organic waviness

TYPOGRAPHY SYSTEM (3-TIER):

TIER 1 - TIMELINE TITLE (Advocate Block Display):
- "[TIMELINE TITLE IN ALL-CAPS]"
- Font: Advocate style, extra bold, hand-lettered, all-caps
- Size: 3x larger than body text
- Color: Black #000000
- Position: Top or left side
- Example: "THE EVOLUTION OF ARTIFICIAL INTELLIGENCE"

TIER 2 - DATES/PERIODS (Concourse Sans):
- "[1990]", "[2000]", "[2010]", etc.
- Font: Concourse geometric sans-serif
- Size: Medium readable
- Color: Charcoal #2D2D2D
- Position: Along timeline at each milestone

TIER 3 - MILESTONE DESCRIPTIONS (Advocate Condensed Italic):
- "*symbolic AI era*", "*deep learning breakthrough*", etc.
- Font: Advocate condensed italic
- Size: 60% of Tier 2
- Color: Charcoal #2D2D2D (or Purple/Teal for highlighted events)
- Position: Near each milestone node

MILESTONES TO ILLUSTRATE:
[List each point chronologically, e.g.:]

1. [Year]: [Event name]
   - Illustration: [Small hand-drawn icon/metaphor, e.g., "tiny seed sprouting"]
   - Color: Black node with charcoal text
   - Position: [Along timeline at this point]

2. [Year]: [Critical event]
   - Illustration: [Metaphor, e.g., "lightning bolt"]
   - Color: Purple (#4A148C) node and illustration — KEY TURNING POINT
   - Position: [Emphasized size, highlighted]

3. [Year]: [Event name]
   - Illustration: [Metaphor]
   - Color: Teal (#00796B) node
   - Position: [Along timeline]

[etc. for all milestones]

VISUAL METAPHORS:
- Each milestone illustrated with small simple icon
- Metaphors show the nature/feeling of that era
- Hand-drawn sketch quality, not detailed illustrations
- Examples: seedling, storm cloud, rising sun, mountain peak, valley, crossroads

COLOR USAGE:
- Black (#000000) for timeline spine and most milestone nodes
- Deep Purple (#4A148C) for [1-2 critical turning points] — nodes and illustrations
- Deep Teal (#00796B) for [supporting important events]
- Charcoal (#2D2D2D) for all text

CRITICAL REQUIREMENTS:
- Hand-drawn timeline (NOT straight digital line)
- Clear temporal progression [left-to-right / top-to-bottom]
- Small illustrated metaphors at each point (simple, sketchy)
- 3-tier typography hierarchy
- Strategic color on key milestones only
- No gradients, flat colors only
- Maintains editorial illustration aesthetic
- Easy to scan and follow progression

Optional: Sign small in bottom right corner in charcoal (#2D2D2D).
```

---

### Step 4: Determine Aspect Ratio

| Timeline Type | Aspect Ratio | Reasoning |
|---------------|--------------|-----------|
| Horizontal timeline | 21:9 or 16:9 | Wide format for left-to-right flow |
| Vertical timeline | 9:16 | Tall format for top-to-bottom progression |
| Balanced/compact | 1:1 | Square for shorter timelines |
| Long historical | 21:9 | Maximum width for many events |

**Default: 16:9 (horizontal)** — Classic timeline orientation

---

### Step 5: Execute Generation

```bash
bun run ~/.claude/skills/art/Tools/Generate.ts \
  --model nano-banana-pro \
  --prompt "[YOUR PROMPT]" \
  --size 2K \
  --aspect-ratio 16:9 \
  --output /path/to/timeline.png
```

**Model Recommendation:** nano-banana-pro (best for dates/text rendering)

**Immediately Open:**
```bash
open /path/to/timeline.png
```

---

### Step 6: Validation (MANDATORY)

#### Must Have
- [ ] **Clear temporal flow** — Obviously progresses through time
- [ ] **Readable dates/labels** — All text legible in hierarchy
- [ ] **Illustrated milestones** — Visual metaphors at each point
- [ ] **Hand-drawn timeline** — Organic line, not digital/straight
- [ ] **Narrative arc visible** — Shows transformation, not just dates
- [ ] **Strategic color** — Purple on critical moments, not everywhere
- [ ] **Scannable** — Easy to follow progression at a glance

#### Must NOT Have
- [ ] Perfectly straight timeline
- [ ] Generic boring milestone markers (just dots)
- [ ] Illegible dates or cluttered text
- [ ] Too many milestones (overwhelming)
- [ ] Color chaos (everything highlighted)
- [ ] Looks like Gantt chart or business timeline

#### If Validation Fails

| Problem | Fix |
|---------|-----|
| Timeline too straight | "Organic hand-drawn line, slight waviness, imperfect curve" |
| No visual interest | "Small illustrated metaphors at each milestone showing the era's character" |
| Text unreadable | Increase spacing, strengthen typography tier sizes |
| Too cluttered | Reduce milestones to 4-6 key points, simplify |
| Looks corporate | Reference "editorial illustration style, hand-drawn sketch aesthetic" |
| Missing narrative | Emphasize metaphors that show transformation: "seedling → storm → sunrise" |

---

## Example Use Cases

### Example 1: "AI Winter → Spring → Summer"
- **Timeline:** 1970s → 2025 → Future
- **Milestones:** Winter (snowflake), Thaw (ice melting), Spring (bud), Summer (sun)
- **Color:** Purple on "Deep Learning Breakthrough" (2012)
- **Orientation:** Horizontal 16:9

### Example 2: "Security Thinking Evolution"
- **Timeline:** 2000 → Present
- **Milestones:** Each era with metaphor (fortress → ecosystem → adaptive)
- **Color:** Purple on paradigm shifts
- **Orientation:** Vertical 9:16

### Example 3: "Startup Journey: Idea to Scale"
- **Timeline:** Year 0 → Year 5
- **Milestones:** Seedling → Sprout → Tree → Forest
- **Color:** Teal on funding rounds, purple on profitability
- **Orientation:** Horizontal 21:9

---

## Quick Reference

**Timeline Formula:**
```
1. Define timeline structure (subject, span, milestones, narrative)
2. Design layout (orientation, metaphors, spacing)
3. Construct prompt with illustrated progression
4. Choose aspect ratio for orientation
5. Generate with nano-banana-pro
6. Validate for clarity and visual narrative
```

**Color Strategy:**
- Timeline spine: Black
- 1-2 critical moments: Purple
- Supporting events: Teal
- Text: Charcoal

**Metaphor Selection:**
- Choose simple, recognizable icons for each era
- Icons should show the FEELING/CHARACTER of that period
- Progression should tell a visual story

---

**The workflow: Define → Design → Construct → Generate → Validate → Complete**
