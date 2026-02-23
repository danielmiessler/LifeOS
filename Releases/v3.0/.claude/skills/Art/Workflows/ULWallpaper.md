# Create UL Wallpaper

**Generate branded wallpapers with embedded logo concepts for Kitty terminal and macOS desktop.**

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the ULWallpaper workflow in the Art skill to create wallpapers"}' \
  > /dev/null 2>&1 &
```

Running **ULWallpaper** in **Art**...

---

Creates **4K 16:9 wallpapers** that integrate brand logos as organic design elements — emblazoned, embossed, or woven into the composition.

---

## Purpose

Generate cohesive wallpapers that:
- Match the existing UL wallpaper aesthetic (dark tech, circuits, geometric patterns)
- Embed logo shapes/concepts as integral design elements (not just overlaid)
- Work for both Kitty terminal backgrounds (with 0.85 tint) and macOS desktop
- Maintain the blue/purple/teal color palette

---

## Prerequisites

**Logos Directory:** `${PROJECTS_DIR}/logos/`
Place logo files (PNG, SVG) here. The workflow will use these as reference for shape/concept integration.

**Wallpaper Output:** `${PROJECTS_DIR}/wallpaper/`
Generated wallpapers are saved here and immediately available via `k -w <name>`.

**Reference Wallpapers:** `${PROJECTS_DIR}/wallpaper/`
Existing wallpapers to match aesthetic:
- `blue-lines.png` - Abstract flowing lines
- `blue-purple-circuits.png` - Circuit board pattern
- `blue-purple-squares.png` - Geometric squares
- `circuit-board.png` - Dense circuit traces

---

## Workflow Steps

### Step 1: Gather Input

**Required from user:**
1. **Logo selection** — Which logo from `${PROJECTS_DIR}/logos/` to embed
2. **Style direction** — Circuit, geometric, abstract, flowing, etc.
3. **Integration style** — How logo appears:
   - **Emblazoned** — Logo shape as glowing focal point
   - **Embossed** — Logo as subtle raised/pressed texture
   - **Woven** — Logo dissolved into pattern (circuits flow through it)
   - **Negative space** — Logo revealed by absence of pattern
4. **Output name** — Filename for the wallpaper (kebab-case, no extension)

**If no specific direction given:**
- Default to "woven" integration (most subtle)
- Match closest existing wallpaper style
- Use primary UL logo if available

### Step 2: Analyze Logo

Read the selected logo file to understand:
- Primary shapes and forms
- Key geometric elements
- Aspect ratio and proportions

```bash
# List available logos
ls ${PROJECTS_DIR}/logos/

# View selected logo
open ${PROJECTS_DIR}/logos/<logo-name>.png
```

### Step 3: Load Reference Wallpaper

View an existing wallpaper to match the aesthetic:

```bash
open ${PROJECTS_DIR}/wallpaper/blue-purple-circuits.png
```

**Key aesthetic elements to maintain:**
- Dark background (#0a0a0f to #1a1a2e)
- Blue (#4a90d9), Purple (#8b5cf6), Teal (#06b6d4) accents
- Tech/digital feel (circuits, data streams, geometric patterns)
- Depth through blur and glow effects
- High contrast accent lines/nodes

### Step 4: Construct Prompt

**Base prompt template:**

```
Dark tech wallpaper for terminal/desktop, 16:9 4K resolution.

BACKGROUND: Deep dark blue-black gradient (#0a0a0f to #1a1a2e)

INTEGRATION: [LOGO_NAME] logo shape [INTEGRATION_STYLE]:
- [Describe how logo integrates with the pattern]
- [Logo should feel organic to the design, not overlaid]
- [Shape emerges from or defines the pattern flow]

PATTERN STYLE: [STYLE_DIRECTION]
- [Specific pattern elements matching style]
- [How pattern interacts with logo shape]

COLOR PALETTE:
- Primary: Electric blue (#4a90d9) — main circuit lines/elements
- Secondary: Deep purple (#8b5cf6) — accent glows, key nodes
- Tertiary: Cyan/teal (#06b6d4) — highlights, energy points
- Background: Near-black with subtle blue undertone

EFFECTS:
- Subtle depth of field (sharper center, soft edges)
- Glow effects on key nodes and accent points
- Fine detail in circuit traces/patterns
- Atmospheric haze in corners

CRITICAL:
- Logo shape is INTEGRAL to design, not overlaid
- Must work as terminal background with 85% dark tint overlay
- No text, no watermarks
- High contrast details for visibility through tint
- Professional, sophisticated tech aesthetic
```

### Step 5: Generate Wallpaper

```bash
bun run ~/.claude/skills/Art/Tools/Generate.ts \
  --model nano-banana-pro \
  --prompt "[CONSTRUCTED_PROMPT]" \
  --size 4K \
  --aspect-ratio 16:9 \
  --reference-image ${PROJECTS_DIR}/logos/<selected-logo>.png \
  --output ${PROJECTS_DIR}/wallpaper/<output-name>.png
```

**Parameters:**
- `--size 4K` — Maximum resolution
- `--aspect-ratio 16:9` — Standard widescreen
- `--reference-image` — Logo file for shape guidance

### Step 6: Preview and Validate

**Open the generated wallpaper:**
```bash
open ${PROJECTS_DIR}/wallpaper/<output-name>.png
```

**Validation checklist:**
- [ ] Logo shape is recognizable but integrated (not pasted on)
- [ ] Color palette matches UL aesthetic (blue/purple/teal on dark)
- [ ] Pattern has enough contrast to show through Kitty tint
- [ ] No artifacts, text, or watermarks
- [ ] Professional quality suitable for desktop/terminal

**If validation fails:**
- Adjust prompt specificity for logo integration
- Try different integration style
- Regenerate with refined prompt

### Step 7: Apply Wallpaper

Once validated, apply immediately:

```bash
k -w <output-name>
```

This sets both Kitty terminal and macOS desktop backgrounds.

---

## Integration Styles Reference

### Emblazoned
Logo as the **glowing focal point** — circuits/patterns radiate outward from it.
```
Logo shape as central glowing element, circuit traces emanating outward from its edges,
energy nodes at key logo vertices, pattern density increases near logo
```

### Embossed
Logo as **subtle texture** — raised or pressed into the pattern layer.
```
Logo shape visible as subtle raised/depressed region in the pattern,
same color palette but slightly different luminosity, discoverable not obvious
```

### Woven
Logo shape **defines pattern flow** — elements flow through/around it.
```
Circuit traces and geometric elements flow through and around logo shape,
logo boundary influences pattern direction, shape emerges from negative space
```

### Negative Space
Logo **revealed by absence** — pattern stops at logo boundaries.
```
Dense pattern everywhere except logo shape, logo appears as void/window,
subtle glow at logo edges where pattern meets empty space
```

---

## Style Directions Reference

### Circuit
Dense circuit board traces, nodes, and connection points.
```
PCB-style traces with right-angle turns, solder points as nodes,
varying trace widths, layer depth with traces at different z-levels
```

### Geometric
Abstract geometric shapes, grids, and mathematical patterns.
```
Interlocking geometric shapes, hexagonal grids, triangular tessellation,
isometric depth, clean edges with subtle glow
```

### Flowing
Organic flowing lines, data streams, particle flows.
```
Smooth curved lines suggesting data flow, particle streams,
gradient intensity along flow direction, organic movement feel
```

### Abstract
Non-representational artistic interpretation.
```
Abstract color fields, gradient washes, subtle texture,
artistic interpretation of tech aesthetic, minimal but sophisticated
```

---

## Example Prompts

### Example 1: UL Logo Woven into Circuits
```
Dark tech wallpaper for terminal/desktop, 16:9 4K resolution.

BACKGROUND: Deep dark blue-black gradient (#0a0a0f to #1a1a2e)

INTEGRATION: brand logo shape woven into circuit pattern:
- Circuit traces flow through and around the logo silhouette
- Logo boundary subtly influences trace direction
- Shape emerges naturally from the pattern density changes
- Not overlaid — the pattern DEFINES the logo through flow

PATTERN STYLE: Dense circuit board
- Fine PCB-style traces with right-angle routing
- Glowing nodes at trace intersections
- Multiple depth layers (foreground sharp, background soft)
- Trace density varies to create visual interest

COLOR PALETTE:
- Primary: Electric blue (#4a90d9) — main traces
- Secondary: Deep purple (#8b5cf6) — key nodes, logo edge glow
- Tertiary: Cyan (#06b6d4) — energy highlights
- Background: Near-black (#0a0a0f)

EFFECTS:
- Depth of field blur at edges
- Subtle purple glow where logo shape meets pattern
- Fine detail in traces (visible at 4K)
- Atmospheric corner vignette

CRITICAL: Logo integrated into design, not overlaid. Must show through 85% dark tint.
```

### Example 2: Logo Emblazoned in Geometric Field
```
Dark tech wallpaper for terminal/desktop, 16:9 4K resolution.

BACKGROUND: Deep space gradient (#0a0a0f to #1a1a2e)

INTEGRATION: UL logo as central emblazoned element:
- Logo shape glows at center with purple (#8b5cf6) core
- Geometric patterns radiate outward from logo edges
- Energy lines connect logo vertices to outer pattern
- Logo is the source/origin of all pattern elements

PATTERN STYLE: Geometric hexagonal grid
- Hexagonal tessellation extending from logo
- Grid density increases toward edges
- Subtle isometric depth
- Clean geometric precision

COLOR PALETTE:
- Primary: Electric blue (#4a90d9) — grid lines
- Secondary: Deep purple (#8b5cf6) — logo glow, accent nodes
- Tertiary: Cyan (#06b6d4) — energy connections
- Background: Near-black with blue undertone

EFFECTS:
- Central glow around logo
- Sharp center, soft edges
- Subtle particle effects
- Corner vignette

CRITICAL: Logo as design origin point, not pasted overlay. High contrast for tint visibility.
```

---

## Quick Reference

| Parameter | Value |
|-----------|-------|
| Model | nano-banana-pro |
| Size | 4K |
| Aspect Ratio | 16:9 |
| Output Directory | ${PROJECTS_DIR}/wallpaper/ |
| Logo Source | ${PROJECTS_DIR}/logos/ |
| Apply Command | `k -w <name>` |

**Color Palette:**
- Background: #0a0a0f to #1a1a2e
- Blue: #4a90d9
- Purple: #8b5cf6
- Teal/Cyan: #06b6d4

**Integration Styles:** Emblazoned, Embossed, Woven, Negative Space

**Pattern Styles:** Circuit, Geometric, Flowing, Abstract
