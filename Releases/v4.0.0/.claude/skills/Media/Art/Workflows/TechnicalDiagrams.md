# Technical Diagram Workflow

**Clean Excalidraw-style technical diagrams with custom typography aesthetic.**

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the TechnicalDiagrams workflow in the Art skill to create diagrams"}' \
  > /dev/null 2>&1 &
```

Running **TechnicalDiagrams** in **Art**...

---

## Purpose

Technical diagrams for system architectures, process flows, and board presentations.

**Use for:** Architecture diagrams, process flows, pipelines, infrastructure maps, board presentations.

---

## Visual Aesthetic

**Style:** Clean Excalidraw diagrams — professional, approachable, no grid background.

### Core Rules

1. **Excalidraw style** — Clean lines, slightly organic, professional
2. **Pure sepia #EAE9DF background** — NO grid lines, NO texture, NO decorations
3. **Custom fonts** — Specific typography hierarchy (see below)
4. **Strategic color** — Purple #4A148C for key elements, Teal #00796B for flows
5. **White primary** — 80% of elements in grey/black colors, color is accent only


# Example image
# Ignore for now
# ~/.claude/skills/Media/Art/WorkflowExamples/TechnicalDiagrams/example.png

---

## Typography System (Butterick Fonts)

**Three font families with specific visual characteristics:**

### TIER 1: Headers & Subtitles — Valkyrie Serif

**Valkyrie characteristics for AI prompt:**
- Elegant serif with wedge-shaped serifs (like Palatino but more refined)
- High stroke contrast (thick/thin variation)
- Sophisticated, warm, readable
- NOT generic serif — specifically elegant wedge serifs

**Header (Main Title):**
- Font: Elegant wedge-serif italic (Valkyrie-style)
- Size: Medium-large, 3-4x body text
- Style: Italic, title case
- Color: Black #000000
- Position: Top-left of image, left-justified

**Subtitle:**
- Font: Elegant wedge-serif regular (Valkyrie-style)
- Size: Smaller, 1.3x body text
- Style: Regular (not italic), sentence case, no period at the end
- Color: Charcoal #2D2D2D
- Position: Below header, left-justified

---

### TIER 2: Labels — Concourse T3 Geometric Sans

**Concourse T3 characteristics for AI prompt:**
- Geometric sans-serif (like Avenir/Futura but warmer)
- Clean, technical, precise
- Even stroke weight
- Professional, no-nonsense
- NOT generic sans — specifically geometric with slight warmth

**Usage:**
- Box labels, node names, technical identifiers
- Size: Medium, readable
- Color: Charcoal #2D2D2D or Black #000000
- Examples: "API Gateway", "Database", "Services"

---

### TIER 3: Insights — Advocate Condensed Italic

**Advocate characteristics for AI prompt:**
- Condensed italic sans-serif
- Sporty, editorial feel (like sports jerseys or magazine callouts)
- Narrow letter spacing, italic slant
- Voice-forward, attention-grabbing
- NOT generic italic — specifically condensed sporty italic

**Usage:**
- Key insights, commentary, callouts
- Size: Smaller, 60-70% of labels
- Color: Purple #4A148C (primary) or Teal #00796B
- Style: Always italic, always asterisks around text
- Examples: "*this is the bottleneck*", "*critical path*"

---

# Color Palette

```
Sepia #EAE9DF      - Background
Purple #4A148C     — Key components, insights (10%)
Teal #00796B       — Flows, connections (5%)
Charcoal #2D2D2D   — Text, labels (5%)
White #FFFFFF      — Primary Structure
```

---

# Composition construction

Create a consistent, styled technical diagram using ALL of the styling guidelines here.

BACKGROUND: Pure Black #000000— absolutely NO grid lines, NO texture, completely clean black.

STYLE: Architect aesthetic — like an architect artist did it on the whiteboard

TYPOGRAPHY (CRITICAL - use these exact font styles):

HEADER: Elegant wedge-serif italic font (like Palatino but more refined, with distinctive wedge-shaped serifs and high stroke contrast). Large size, black color, top-left position, title case.

SUBTITLE: Same elegant wedge-serif but regular weight (not italic). Smaller size, charcoal #2D2D2D color, directly below header, sentence case.

LABELS: Geometric sans-serif font (like Avenir or Futura but slightly warmer, clean and technical with even stroke weight). Medium size, charcoal #2D2D2D color, used for all box labels and component names. Hand drawn versions of this.

INSIGHTS: Condensed italic sans-serif font (sporty editorial style like sports jerseys or magazine callouts, narrow and slanted). Smaller size, Purple #4A148C color, used for callouts with asterisks like "*key insight*".Hand drawn versions of this.

DIAGRAM CONTENT:
Title: '[TITLE]' (Top left, left-justified)
Subtitle: '[SUBTITLE]' (left justified to the Header, slightly below)
Art and labels and such should look like Excalidraw, but hand drawn by a talented Architect Artist that mimics our fonts.

Have 1-3 insights for each image created.

# Object Styling

When you must use everyday objects to help the visual, use technically-drawn, non-cartoon-like drawing. This means:

- NOT Cartoony
- Like they're drawn by an architect / artist type

## Overall look and feel

The whole image should look like it was made on a whiteboard by an extremely talented artist with Architect training, using all the styling above. Like Excalidraw, but more Architect / Artistic.

All the art components, labels, and such should mostly look hand-drawn, similar to Excalidraw. But roughly in the style of our fonts. 

# Execution

1. Run /cse 24 on the input content
2. Think deeply about how to construct that into a technical diagram
3. Create the composition in your mind that will perfectly render that
4. Create a PROMPT that will render that composition perfectly
5. Before creating the image, make absolutely certain that the PROMPT you've created mind takes into account everything in these instructions. No exceptions. Then proceed to #6.
6. Confirm this mentally for 1 full second
7. Create the image using intent-to-flag mapping and the CLI tool

## Intent-to-Flag Mapping

**Interpret user request and select appropriate flags:**

### Model Selection

| User Says | Flag | When to Use |
|-----------|------|-------------|
| "fast", "quick", "draft" | `--model nano-banana` | Faster iteration, slightly lower quality |
| (default), "best", "high quality" | `--model nano-banana-pro` | Best quality + text rendering (recommended) |
| "flux", "stylistic variety" | `--model flux` | Different aesthetic, stylistic variety |

### Size Selection

| User Says | Flag | Resolution |
|-----------|------|------------|
| "draft", "preview" | `--size 1K` | Quick iterations |
| (default), "standard" | `--size 2K` | Standard output |
| "high res", "print", "large" | `--size 4K` | Maximum resolution |

### Aspect Ratio

| User Says | Flag | Use Case |
|-----------|------|----------|
| "wide", "slide", "presentation" | `--aspect-ratio 16:9` | Default for diagrams |
| "square" | `--aspect-ratio 1:1` | Social media, compact |
| "ultrawide", "panoramic" | `--aspect-ratio 21:9` | Wide system diagrams |

### Post-Processing

| User Says | Flag | Effect |
|-----------|------|--------|
| "blog", "website" | `--thumbnail` | Creates transparent + thumb versions |
| "transparent" | `--remove-bg` | Removes background for compositing |
| "variations", "options" | `--creative-variations 3` | Multiple versions |

### Generate Command

```bash
bun run ~/.claude/skills/art/Tools/Generate.ts \
  --model [SELECTED_MODEL] \
  --prompt "[PROMPT]" \
  --size [SELECTED_SIZE] \
  --aspect-ratio [SELECTED_RATIO] \
  [--thumbnail if for blog] \
  --output /path/to/diagram.png
```

# Validation

After rendering, ensure that you have executed properly by checking this list of musts and must-nots.

**Must have:**
- [ ] Pure sepia background #EAE9DF (NO grid or decorations)
- [ ] Elegant wedge-serif for both headers (Valkyrie-style)
- [ ] Geometric sans labels (Concourse-style)
- [ ] A title and subtitle in the top left 
- [ ] 1-3 Condensed italic insights (Advocate-style)
- [ ] Strategic color usage (for accents, 70% different shades of grey and black)
- [ ] Highly technical, stylish, Architect-style look and feel, Excalidraw with style!

**Must NOT have:**
- [ ] Grid lines or texture on background
- [ ] Generic or ugly fonts
- [ ] Cartoony or overly casual shapes or styling
- [ ] Over-coloring (everything purple/teal)

