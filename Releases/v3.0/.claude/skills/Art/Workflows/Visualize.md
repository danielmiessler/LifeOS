# Adaptive Content Visualization Workflow

**Intelligent multi-modal visualization combining optimal approaches based on content analysis.**

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the Visualize workflow in the Art skill to create visualizations"}' \
  > /dev/null 2>&1 &
```

Running **Visualize** in **Art**...

---

Creates **ADAPTIVE VISUALIZATIONS** — analyzes content to select and orchestrate the best combination of visualization techniques, from pure data viz to mixed-media infographics to multi-panel compositions.

---

## Purpose

The Visualize workflow is the **intelligent visualization orchestrator**. Unlike the 12 specialized workflows (which each serve specific purposes), Visualize analyzes your content and chooses the optimal visualization strategy — which may be one approach, or a sophisticated combination of multiple techniques.

**Use this workflow when:**
- You have content but aren't sure what visualization approach to use
- The content has multiple dimensions (data + narrative + concepts)
- You want the most effective visualization, not a predetermined format
- You're asking "what's the best way to visualize this?"
- You want to leverage Nano Banana Pro's full capabilities

**This workflow DOES NOT use:**
- Predetermined templates
- One-size-fits-all approaches
- Single-mode visualizations when combinations would be better

---

## 🚨 INFOGRAPHICS: Use Excalidraw Whiteboard Style

**Infographics use the EXCALIDRAW whiteboard sketch aesthetic** — hand-drawn with wobbly boxes, sketchy lines, and imperfect organic shapes. This is the same style as mermaid.md technical diagrams but with richer graphics and narrative.

**Key principle:** Infographics = Excalidraw aesthetic + Rich graphics + Visual narrative

### Excalidraw Infographic Aesthetic

```
STYLE: Excalidraw whiteboard sketch with rich graphics
- WOBBLY BOXES — rectangles with rough, hand-drawn edges (not perfect)
- SKETCHY LINES — arrows and connections with slight wobble
- IMPERFECT SHAPES — circles slightly oval, diamonds asymmetric
- HAND-LETTERED TEXT — labels look handwritten, not typed
- WHITEBOARD FEEL — looks like someone drew this on a whiteboard
- VARIABLE LINE WEIGHT — heavier for boxes, lighter for details
- RICH GRAPHICS — icons, illustrations, visual metaphors (all sketchy)
```

### What Makes a Good Excalidraw Infographic

1. **Hand-Drawn Feel** — Everything looks sketched, not digital
2. **Wobbly Shapes** — No perfect rectangles, circles, or lines
3. **Rich Graphics** — Icons and illustrations in sketchy style
4. **Visual Narrative** — Panels flow and tell a story
5. **Strategic Color** — Purple/teal accents on key elements, mostly black

### AVOID

```
❌ Perfect geometric shapes
❌ Ruler-straight lines and arrows
❌ Digital precision
❌ Smooth polished vectors
❌ Perfect alignment
❌ Clean corporate infographic style
```

### Color Usage

```
- Black (#000000): All primary structure (boxes, arrows, icons)
- Deep Purple (#4A148C): Critical elements, key stats, title (10-20%)
- Deep Teal (#00796B): Secondary highlights (5-10%)
- Charcoal (#2D2D2D): All text labels
- Background: Light Cream #F5E6D3 or White #FFFFFF
```

### Background Rules

```
DEFAULT: Light Cream/Sepia #F5E6D3 (matches blog aesthetic)
WHITE ONLY IF: User explicitly requests "white background" in prompt
TRANSPARENT: Use Images skill to remove background for overlay use
```

**Light Cream (#F5E6D3) is the DEFAULT background.** Only use white (#FFFFFF) if the user explicitly requests it.

**For transparent background** — use the **Images skill** for background removal:

```bash
bun ~/.claude/skills/PAI/Tools/RemoveBg.ts /path/to/visualization.png
```

**See:** `~/.claude/skills/Images/Workflows/BackgroundRemoval.md` for full documentation.

### Title/Subtitle Alignment

```
ALWAYS LEFT-JUSTIFIED — Never centered
- Title: Top-left with margin
- Subtitle: Below title, aligned left
```

### Infographic Prompt Template

```
Excalidraw-style whiteboard infographic with rich hand-drawn graphics.

STYLE: Excalidraw whiteboard sketch aesthetic
- Wobbly rectangles with rough edges (not perfect boxes)
- Sketchy arrows with slight wobble (not ruler-straight)
- Imperfect shapes throughout (circles slightly oval)
- Hand-lettered text labels (natural slant, imperfect)
- Variable line weight (boxes thicker, details thinner)
- Whiteboard/sketch paper feel

BACKGROUND: Light Cream #F5E6D3 (DEFAULT) — only use White #FFFFFF if explicitly requested

TYPOGRAPHY SYSTEM (3-TIER):

TIER 1 - TITLE & SUBTITLE (Valkyrie):
Title:
- "[Title]"
- Font: Valkyrie serif ITALIC
- Position: LEFT-JUSTIFIED, top-left with margin
- Color: Purple #4A148C (or Black #000000)
- Size: Large, 3-4x body text

Subtitle:
- "[Subtitle]"
- Font: Valkyrie serif REGULAR (NOT italic)
- Position: LEFT-JUSTIFIED, below title
- Color: Charcoal #2D2D2D
- Size: Small, 1-1.5x body text

TIER 2 - PANEL HEADERS & LABELS (Concourse + Valkyrie):
Panel Headers:
- Font: Concourse geometric sans-serif, bold
- Color: Black #000000
- Style: Uppercase

Content Labels:
- Technical labels: Concourse geometric sans
- Descriptions: Valkyrie serif
- Color: Charcoal #2D2D2D

TIER 3 - ANNOTATIONS (Advocate):
- Font: Advocate condensed italic
- Color: Purple #4A148C or Teal #00796B
- Style: Smaller, insight/commentary voice

[Describe each panel with SKETCHY VISUAL ELEMENTS:]
- Hand-drawn icons and illustrations (wobbly, organic)
- Data visualized with sketchy charts/graphics
- Panels as wobbly boxes with headers
- Flow shown with sketchy arrows

COLOR USAGE:
- Black: All primary structure and most elements
- Purple: Title, key stats, critical accents
- Teal: Secondary highlights
- Charcoal: All body text

CRITICAL:
- Excalidraw hand-drawn whiteboard aesthetic throughout
- All shapes imperfect, all lines wobbly
- Title/subtitle LEFT-JUSTIFIED, not centered
- Use proper font hierarchy (Valkyrie, Concourse, Advocate)
```

**Reference:** See `mermaid.md` for complete Excalidraw aesthetic specification.

---

## Nano Banana Pro Capabilities

**Understanding what's possible:**

### Core Strengths
1. **Exceptional text rendering** — Clean typography, readable labels, multiple text tiers
2. **Data visualization** — Charts, graphs, quantitative displays
3. **Infographic composition** — Multi-element layouts, mixed media
4. **Iconic illustration** — Simple recognizable symbols and icons
5. **Multi-panel layouts** — Grids, sequences, comparative layouts
6. **Hybrid compositions** — Data + illustration + typography together
7. **Slide-quality output** — Presentation-ready visualizations

### What Nano Banana Pro Excels At
- **Text-heavy compositions** — Infographics with lots of labels
- **Data + context** — Numbers with explanatory illustrations
- **Icon systems** — Repeated simplified icons showing quantities
- **Multi-tier typography** — Clear hierarchies (titles, labels, annotations)
- **Mixed media** — Charts alongside illustrations
- **Grid layouts** — Organized multi-element compositions
- **Comparative panels** — Side-by-side or sequential comparisons

---

## 🚨 MANDATORY WORKFLOW STEPS

### Step 1: Deep Content Analysis (MANDATORY - Use deep thinking)

**🎯 CRITICAL: Use extended thinking to analyze content thoroughly before proceeding.**

Analyze the content across these dimensions:

#### A. Content Type Identification
What types of information are present?
- [ ] Quantitative data (numbers, statistics, metrics)
- [ ] Qualitative concepts (ideas, principles, arguments)
- [ ] Narrative elements (stories, sequences, transformations)
- [ ] Comparative elements (X vs Y, before/after, tradeoffs)
- [ ] Hierarchical structures (taxonomies, frameworks, levels)
- [ ] Temporal elements (timelines, evolution, progressions)
- [ ] Spatial relationships (maps, territories, domains)
- [ ] Process flows (steps, recipes, methodologies)

#### B. Communication Goal
What's the primary purpose?
- Explain a complex concept → Conceptual visualization
- Show data insights → Data visualization dominant
- Compare alternatives → Comparison/split approach
- Tell a story → Sequential/narrative visualization
- Organize information → Taxonomy/grid approach
- Guide action → Process/recipe format
- Make memorable → Metaphor + data hybrid

#### C. Audience Context
Who's this for?
- Technical audience → More data, precision, structure
- General audience → More metaphor, simplification, narrative
- Executive audience → High-level insights, clear takeaways
- Social media → Punchy, scannable, shareable
- Consulting deliverable → Professional, multi-faceted, comprehensive

#### D. Complexity Assessment
How much information needs to be conveyed?
- **Simple (1-2 key points):** Single focused visualization
- **Medium (3-5 dimensions):** Hybrid or two-element composition
- **Complex (6+ dimensions):** Multi-panel infographic or dashboard

**Output from Analysis:**
```
CONTENT TYPE: [Primary and secondary types from above]
INFORMATION DENSITY: [Simple / Medium / Complex]
COMMUNICATION GOAL: [Primary purpose]
AUDIENCE: [Who this is for]

KEY ELEMENTS TO VISUALIZE:
1. [Element type: data/concept/narrative/etc.]
2. [Element type]
3. [Element type]
...

VISUALIZATION OPPORTUNITIES:
- Data points that could be charts/graphs
- Concepts that need metaphors or icons
- Comparisons that need side-by-side
- Sequences that need panels or flow
- Hierarchies that need taxonomies or frameworks
```

---

### Step 2: Visualization Strategy Selection (MANDATORY - Use deep thinking)

**Based on Step 1 analysis, determine the optimal approach:**

#### Strategy Options

**A. SINGLE-MODE (Use one specialized workflow)**
When content clearly fits one visualization type:
- Pure data → Create data visualization
- Pure concept → Use editorial illustration or framework
- Pure comparison → Use comparison workflow
- Pure process → Use recipe card workflow

**B. HYBRID COMPOSITION (Combine 2-3 elements)**
When content has multiple dimensions:
- **Data + Metaphor:** Chart/graph with editorial illustration accent
- **Data + Process:** Numbers showing outcomes at each step
- **Concept + Structure:** Framework with illustrated metaphors in quadrants
- **Timeline + Data:** Progression with quantitative milestones
- **Comparison + Data:** Split screen with metrics on each side

**C. MULTI-PANEL INFOGRAPHIC (Dashboard approach)**
When content is complex and multifaceted:
- **Grid layout:** 4-6 panels each showing different aspect
- **Layered composition:** Top section data, middle concepts, bottom process
- **Dashboard:** Multiple charts/graphs with unified design
- **Slide series:** Sequential slides each focusing on one dimension

#### Decision Framework

```
IF content has 1 primary dimension:
  → Use specialized workflow directly

IF content has 2-3 dimensions of equal importance:
  → Design HYBRID composition

IF content has 4+ distinct dimensions:
  → Design MULTI-PANEL infographic

IF content is primarily quantitative:
  → Lead with DATA VISUALIZATION
  → Add conceptual elements as context

IF content is primarily conceptual:
  → Lead with METAPHOR/FRAMEWORK
  → Add data as supporting evidence

IF content tells a story:
  → Use SEQUENTIAL approach
  → Could be comic, timeline, or multi-step
```

**Output from Strategy Selection:**
```
VISUALIZATION STRATEGY: [Single-mode / Hybrid / Multi-panel]

CHOSEN APPROACH:
[Describe the specific visualization approach]

COMPOSITION ELEMENTS:
Primary element (60-70%): [Type and purpose]
Secondary element (20-30%): [Type and purpose]
Tertiary element (10%): [Type and purpose - optional]

LAYOUT STRUCTURE:
[Describe how elements are arranged spatially]

ASPECT RATIO: [1:1 / 16:9 / 9:16 / 4:3]
Rationale: [Why this ratio for this content]
```

---

### Step 3: Design Composition (MANDATORY - Use deep thinking)

**Plan the visual hierarchy and spatial organization:**

#### A. Spatial Layout
Design how elements occupy the canvas:

**For Single-Mode:**
- Follow the specialized workflow's layout guidelines
- Optimize for Nano Banana Pro's strengths

**For Hybrid Composition:**
```
Example: Data + Metaphor
┌─────────────────────────────────────┐
│                                     │
│    [TITLE - Advocate Block]         │
│                                     │
│  ┌───────────┐   ┌──────────────┐  │
│  │           │   │              │  │
│  │   DATA    │   │  METAPHOR    │  │
│  │   CHART   │   │ ILLUSTRATION │  │
│  │           │   │              │  │
│  └───────────┘   └──────────────┘  │
│        40%              40%         │
│                                     │
│  [Explanatory text - 20%]          │
│                                     │
└─────────────────────────────────────┘
```

**For Multi-Panel Infographic:**
```
Example: Dashboard Grid
┌─────────────────────────────────────┐
│  [OVERALL TITLE]                    │
├─────────────┬───────────────────────┤
│  Panel 1:   │   Panel 2:            │
│  Data viz   │   Concept diagram     │
├─────────────┼───────────────────────┤
│  Panel 3:   │   Panel 4:            │
│  Timeline   │   Key stat + icon     │
├─────────────┴───────────────────────┤
│  [Synthesis/Conclusion panel]       │
└─────────────────────────────────────┘
```

#### B. Visual Hierarchy
Establish information priority:
1. **Primary (Immediate attention):** 50-60% of visual weight
2. **Secondary (Supporting context):** 25-35% of visual weight
3. **Tertiary (Details/annotations):** 10-15% of visual weight

#### C. Typography System
Apply 3-tier system across all elements:
- **Tier 1 (Advocate Block):** Main title, section headers
- **Tier 2 (Concourse Sans):** Data labels, chart axes, element labels
- **Tier 3 (Advocate Condensed Italic):** Annotations, insights, editorial voice

#### D. Color Strategy
Maintain UL aesthetic while supporting information hierarchy:
- **Black #000000:** Primary structure (chart axes, borders, main elements)
- **Purple #4A148C:** Critical insights, key data points, optimal zones
- **Teal #00796B:** Secondary data, supporting elements, context
- **Charcoal #2D2D2D:** All body text and labels
- **Background:** Light Cream #F5E6D3 (DEFAULT — only use white if explicitly requested)

Strategic color use:
- Don't color everything
- Purple for "look here" moments
- Teal for supporting information
- Black for structure and clarity

**Output from Design:**
```
COMPOSITION LAYOUT:
[Detailed spatial description or ASCII diagram]

VISUAL HIERARCHY:
Primary (50-60%): [Element and placement]
Secondary (25-35%): [Element and placement]
Tertiary (10-15%): [Element and placement]

TYPOGRAPHY ASSIGNMENTS:
Tier 1: [Where used - titles, headers]
Tier 2: [Where used - labels, axes]
Tier 3: [Where used - annotations, insights]

COLOR CODING:
Purple: [Specific elements to highlight]
Teal: [Supporting elements]
Black: [Structural elements]
Text: All charcoal

ELEMENT SPECIFICATIONS:
[For each major element, specify:]
- Type (chart/icon/illustration/text)
- Size (% of canvas)
- Position (coordinates or relative placement)
- Style (data viz / editorial / typographic)
```

---

### Step 4: Construct Comprehensive Prompt (MANDATORY - Use deep thinking)

**Build the generation prompt leveraging Nano Banana Pro's capabilities:**

#### Prompt Structure Template

```
[VISUALIZATION TYPE] in editorial infographic style optimized for Nano Banana Pro.

OVERALL CONCEPT: "[What this visualization communicates]"

STYLE REFERENCE: [Professional infographic / Data journalism / Editorial slide / Mixed media visualization]

BACKGROUND: Light Cream #F5E6D3 (DEFAULT) — only use White #FFFFFF if user explicitly requests it

AESTHETIC:
- Professional infographic quality (deliverable standard)
- Hand-drawn editorial elements where appropriate
- Clean data visualization where precise
- Variable stroke weight (thicker for structure, thinner for details)
- Flat colors, no gradients or shadows
- Readable at multiple scales (works as thumbnail and full-size)

ASPECT RATIO: [1:1 / 16:9 / 9:16 / 4:3]

COMPOSITION STRUCTURE:
[Detailed description of spatial layout]

TYPOGRAPHY SYSTEM (3-TIER HIERARCHY):

TIER 1 - VISUALIZATION HEADER & SUBTITLE (Valkyrie Two-Part System):
Header (Main Title):
- "[Header Text]"
- Font: Valkyrie serif italic (elegant, sophisticated)
- Size: Large - 3-4x body text (prominent, commanding attention)
- Style: Italicized, sentence case or title case (NOT all-caps)
- Color: Black #000000 (or Purple #4A148C for emphasis)
- Position: Top-left with margin

Subtitle (Clarifying Detail):
- "[Subtitle Text]"
- Font: Valkyrie serif regular (warm, readable)
- Size: Small - 1-1.5x body text (noticeably smaller than header, supportive)
- Style: Regular (NOT italicized), sentence case (first letter capitalized, rest lowercase except proper nouns)
- Color: Black #000000 or Charcoal #2D2D2D
- Position: Small gap below header, aligned left

TIER 2 - ELEMENT LABELS (Concourse Sans):
- [List all labels: chart axes, data labels, section headers]
- Font: Concourse geometric sans-serif, clean, modern
- Size: Medium readable
- Color: Charcoal #2D2D2D
- Positions: [Specify for each]

TIER 3 - ANNOTATIONS (Advocate Condensed Italic):
- [List all annotations and insights]
- Font: Advocate condensed italic (editorial voice)
- Size: Small (60% of Tier 2)
- Color: Purple #4A148C (insights) or Teal #00796B (technical notes)
- Positions: [Near relevant elements]

[FOR EACH MAJOR ELEMENT IN COMPOSITION:]

ELEMENT 1: [TYPE - e.g., Bar Chart / Line Graph / Icon Grid]
- Purpose: [What this element communicates]
- Position: [Location in composition]
- Size: [Dimensions or % of canvas]
- Data to show: [Specific data points or values]
- Style: [Precise data viz / Hand-drawn editorial / Hybrid]
- Color: Black structure, Purple highlights on [specific], Teal on [specific]
- Labels: [Tier 2 typography for all labels]
- Details: [Any specific styling notes]

ELEMENT 2: [TYPE - e.g., Editorial Illustration / Framework Diagram]
- Purpose: [What this element communicates]
- Position: [Location in composition]
- Size: [Dimensions or % of canvas]
- Content: [What to illustrate]
- Style: [Hand-drawn / Iconic / Metaphorical]
- Color: Black linework, Purple accents on [specific]
- Integration: [How it relates to other elements]

[Continue for all elements...]

COLOR USAGE (Strategic, not overwhelming):
- Black (#000000): [All primary structure, chart elements, borders]
- Deep Purple (#4A148C): [Critical data points, key insights, optimal zones]
- Deep Teal (#00796B): [Secondary data, supporting elements]
- Charcoal (#2D2D2D): [All text labels and annotations]
- Background: Light Cream #F5E6D3 (DEFAULT — white only if explicitly requested)

CRITICAL REQUIREMENTS FOR NANO BANANA PRO:
- Exceptional text rendering required (multiple labels, clean typography)
- Data precision where needed (accurate chart rendering)
- Hand-drawn editorial quality where appropriate
- Multi-element composition with clear visual hierarchy
- Professional infographic / slide quality
- Readable at both thumbnail and full resolution
- No gradients, flat colors only
- Strategic color (not every element colored)
- All elements work together as unified composition

VALIDATION CHECKPOINTS:
- Is the primary message immediately clear?
- Can each element be read/understood independently?
- Do elements work together to tell complete story?
- Is typography hierarchy obvious?
- Are data elements accurate and precise?
- Do editorial elements enhance (not distract from) information?

Optional: Sign small in bottom right corner in charcoal (#2D2D2D).
```

---

### Step 5: Generate with Nano Banana Pro

**Execute the visualization using intent-to-flag mapping:**

#### Intent-to-Flag Mapping

**Interpret user request and select appropriate flags:**

| User Says | Flag | When to Use |
|-----------|------|-------------|
| "fast", "quick", "draft" | `--model nano-banana` | Faster iteration, slightly lower quality |
| (default), "best", "high quality" | `--model nano-banana-pro` | Best quality + text rendering (recommended) |
| "flux", "stylistic variety" | `--model flux` | Different aesthetic, stylistic variety |

| User Says | Flag | Resolution |
|-----------|------|------------|
| "draft", "preview" | `--size 1K` | Quick iterations |
| (default), "standard" | `--size 2K` | Standard output |
| "high res", "print", "large" | `--size 4K` | Maximum resolution |

| User Says | Flag | Use Case |
|-----------|------|----------|
| "square", "social" | `--aspect-ratio 1:1` | Social media, grids |
| "wide", "slide", "presentation" | `--aspect-ratio 16:9` | Slides, presentations |
| "portrait", "mobile" | `--aspect-ratio 9:16` | Mobile, vertical |
| "blog header" | `--thumbnail` | Creates transparent + thumb versions |
| "variations", "options" | `--creative-variations 3` | Multiple versions |

**Construct command based on intent:**

```bash
bun run ~/.claude/skills/art/Tools/Generate.ts \
  --model [SELECTED_MODEL] \
  --prompt "[YOUR COMPREHENSIVE PROMPT]" \
  --size [SELECTED_SIZE] \
  --aspect-ratio [chosen ratio] \
  [--thumbnail if for blog] \
  [--creative-variations N if variations requested] \
  --output /path/to/visualization.png
```

**Why Nano Banana Pro for this workflow:**
- Best text rendering among all models (critical for infographics)
- Handles complex multi-element compositions well
- Excellent at data visualization elements
- Can combine precise (charts) with expressive (editorial) styles
- Reliable for professional deliverable quality

**Immediately open for review:**
```bash
open /path/to/visualization.png
```

---

### Step 6: Comprehensive Validation (MANDATORY)

**Validate across multiple dimensions:**

#### Information Effectiveness
- [ ] **Primary message clear:** Main insight obvious within 3 seconds
- [ ] **Data accuracy:** Numbers, proportions, relationships accurate
- [ ] **Visual hierarchy works:** Eye flows from primary → secondary → tertiary
- [ ] **All elements readable:** Text legible, charts clear, icons recognizable
- [ ] **Story cohesion:** Elements work together, not competing

#### Design Quality
- [ ] **Professional deliverable:** Client/publication ready
- [ ] **UL aesthetic maintained:** Flat colors, appropriate hand-drawn vs precise
- [ ] **Typography hierarchy clear:** 3 tiers obviously distinct
- [ ] **Color strategic:** Purple/teal highlight key elements, not overwhelming
- [ ] **Composition balanced:** Visual weight distributed appropriately

#### Technical Execution
- [ ] **Text rendering clean:** No blurry or malformed letters
- [ ] **Data viz precision:** Charts/graphs accurate and clear
- [ ] **Scale works:** Readable as thumbnail AND full-size
- [ ] **No gradients/shadows:** Flat aesthetic maintained
- [ ] **Aspect ratio appropriate:** Format suits content and use case

#### Audience Appropriateness
- [ ] **Matches audience sophistication:** Not too simple or too complex
- [ ] **Serves communication goal:** Actually achieves intended purpose
- [ ] **Platform optimized:** Works for intended distribution (social/email/presentation)

#### If Validation Fails

**Common issues and fixes:**

| Problem | Diagnosis | Fix |
|---------|-----------|-----|
| **Too cluttered** | Too many elements competing | Simplify: reduce to 2-3 main elements, increase whitespace |
| **Message unclear** | No clear visual hierarchy | Strengthen primary element (make larger, add purple), reduce secondary |
| **Text unreadable** | Font too small or wrong tier | Increase label sizes, strengthen typography tier differentiation |
| **Data imprecise** | Chart rendering issues | Add specific data points in prompt, request precision explicitly |
| **Looks generic** | Missing UL aesthetic | Add hand-drawn editorial elements, strategic purple/teal, flatten any gradients |
| **Elements disconnected** | Poor composition | Redesign spatial layout, add visual connectors (arrows, borders, grouping) |
| **Color chaos** | Too much color everywhere | Limit purple to 2-3 key elements, teal to 1-2 supporting, rest black/charcoal |
| **Not professional** | Too sketchy or too rigid | Balance: data viz precise, editorial elements hand-drawn, clean typography |

**Regeneration Process:**
1. Identify specific validation failures
2. Update prompt with targeted fixes
3. Regenerate with refined prompt
4. Re-validate against all checkpoints
5. Repeat until ALL validation criteria pass

**CRITICAL: Do not declare completion until validation passes.**

---

## Visualization Pattern Library

**Common effective combinations:**

### Pattern 1: Data + Metaphor Hybrid
**When:** Data needs conceptual context
**Layout:** 50% data visualization + 40% editorial illustration + 10% explanatory text
**Example:** Growth chart with rocket ship illustration showing trajectory
**Aspect:** 16:9 or 1:1

### Pattern 2: Comparative Dashboard
**When:** Analyzing multiple dimensions of comparison
**Layout:** Split or grid with data on each side/panel
**Example:** "Before AI vs After AI" with metrics and illustrations for each state
**Aspect:** 16:9 (split) or 1:1 (grid)

### Pattern 3: Process + Outcomes
**When:** Showing methodology with results
**Layout:** Vertical or horizontal flow with data at key milestones
**Example:** 5-step recipe with success metrics at each step
**Aspect:** 9:16 (vertical) or 16:9 (horizontal)

### Pattern 4: Icon Quantification
**When:** Showing quantities through repeated visual elements
**Layout:** Grid of icons where quantity = visual count
**Example:** "78 out of 100 developers" shown as 78 purple icons + 22 gray icons
**Aspect:** 1:1 or 4:3

### Pattern 5: Annotated Data Story
**When:** Data needs narrative explanation
**Layout:** Primary chart with hand-drawn annotations explaining insights
**Example:** Timeline chart with purple arrows: "*this is when everything changed*"
**Aspect:** 16:9 or 21:9

### Pattern 6: Multi-Chart Dashboard
**When:** Multiple related datasets
**Layout:** Grid of 2-4 charts with unified design language
**Example:** 4-panel view: bar chart, line graph, pie chart, key stat
**Aspect:** 16:9 or 1:1

### Pattern 7: Framework + Data
**When:** Conceptual model with quantitative evidence
**Layout:** Framework structure (2x2, Venn, pyramid) with data in each zone
**Example:** 2x2 matrix with percentage of companies in each quadrant
**Aspect:** 1:1

### Pattern 8: Infographic Slide
**When:** Comprehensive content for presentation
**Layout:** Title + multiple small visualizations + key takeaway
**Example:** Slide with 3 mini-charts + 2 key stats + insight annotation
**Aspect:** 16:9 (slide format)

---

## Decision Tree Summary

```
START: Analyze content deeply (Step 1)
   ↓
Is content primarily ONE dimension?
   ├─ YES → Use specialized workflow directly
   │         (Editorial / Technical / Timeline / etc.)
   │
   └─ NO → Content has multiple dimensions
             ↓
       Are there 2-3 equal dimensions?
          ├─ YES → HYBRID composition
          │         Design complementary elements
          │         (Data + Metaphor, Process + Outcomes, etc.)
          │
          └─ NO → 4+ dimensions or very complex
                    ↓
                  MULTI-PANEL infographic
                  Grid or layered dashboard approach
                  Each panel addresses one dimension

For HYBRID or MULTI-PANEL:
   ↓
Design composition (Step 3)
   → Spatial layout
   → Visual hierarchy
   → Typography tiers
   → Color strategy
   ↓
Construct comprehensive prompt (Step 4)
   → Detailed element specifications
   → Leverage Nano Banana Pro strengths
   → Clear validation checkpoints
   ↓
Generate with nano-banana-pro (Step 5)
   ↓
VALIDATE comprehensively (Step 6)
   → Information effectiveness
   → Design quality
   → Technical execution
   → Audience appropriateness
   ↓
PASS? → Complete
FAIL? → Diagnose, fix, regenerate
```

---

## Quick Reference

### When to Use Visualize Workflow
- Content has multiple dimensions to visualize
- You want optimal approach, not predetermined format
- Combining data + concepts + narrative
- Creating professional infographics or slides
- Need sophisticated composition beyond single workflow

### Nano Banana Pro Advantages
- Best text rendering (critical for labels/annotations)
- Multi-element composition handling
- Data visualization capabilities
- Professional infographic quality
- Hybrid precision + expressiveness

### Core Principles
1. **Analyze first** — Deep content analysis before choosing approach
2. **Strategic combination** — Use hybrid only when it serves content
3. **Visual hierarchy** — Clear primary/secondary/tertiary structure
4. **Color discipline** — Purple/teal strategic, not everywhere
5. **Professional quality** — Deliverable to clients/publications
6. **Validate thoroughly** — Information + design + technical + audience

---

**The workflow: Analyze → Strategy → Design → Prompt → Generate → Validate → Complete**

**The meta-principle: Let content dictate form. Use the full power of Nano Banana Pro to create the most effective visualization, whether that's one approach or a sophisticated orchestration of multiple techniques.**
