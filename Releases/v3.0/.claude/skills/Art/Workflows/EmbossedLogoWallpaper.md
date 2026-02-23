# Embossed Logo Wallpaper

**Generate sophisticated wallpapers with logo physically embossed into the design.**

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the EmbossedLogoWallpaper workflow in the Art skill to create wallpapers"}' \
  > /dev/null 2>&1 &
```

Running **EmbossedLogoWallpaper** in **Art**...

---

Creates wallpapers where the UL logo is integrated as an embossed texture within the visual content — not overlaid, not floating in empty space.

---

## Purpose

Generate wallpapers that:
- Integrate the logo as a physical embossed element within the design
- Use the UL color palette (blue/purple/cyan only)
- Match sophisticated reference wallpapers in quality
- Position logo small in bottom left, surrounded by visual content

---

## Prerequisites

**Logo Source:** `${PROJECTS_DIR}/logos/ul-blue.png`
**Style References:** `${PROJECTS_DIR}/wallpaper/` (blue-purple-circuits.png, circuit-board.png)
**Output Directory:** `${PROJECTS_DIR}/wallpaper/`

---

## Critical Lessons Learned (Validation Checklist)

### ❌ COMMON FAILURES TO AVOID

**1. Wrong Logo Treatment**
- ❌ Literal text "brand name" instead of the logo shape
- ❌ Logo overlaid/floating instead of embossed into surface
- ❌ Logo placed in empty/blank area instead of integrated into design
- ❌ Logo too large and prominent
- ❌ Logo glowing or different color than surroundings
- ✅ CORRECT: Logo shape from reference image, embossed as texture, small, within visual content

**2. Wrong Colors**
- ❌ Matrix green (#00ff41)
- ❌ Pink/magenta neon
- ❌ Bright saturated neons
- ❌ Any colors outside the UL palette
- ✅ CORRECT: Blue (#4a90d9 or muted #3a6a9a), Purple (#8b5cf6 or muted #6b4c96), Cyan (#06b6d4 or muted #4a9a9a)

**3. Wrong Style**
- ❌ Simple, cartoony, flat vector art
- ❌ Too bright, loud, gaudy
- ❌ Clean lines without texture or depth
- ✅ CORRECT: Sophisticated, photorealistic or stylized with depth, muted/subdued, dense detail

**4. Wrong Composition**
- ❌ Logo in empty/blank corner
- ❌ Visual content clustered in center with empty edges
- ❌ Logo too prominent/centered
- ✅ CORRECT: Visual content fills entire canvas, logo small in bottom left WITHIN the design

**5. Missing Reference Images**
- ❌ Not using ul-blue.png as reference for logo shape
- ❌ Not checking existing wallpapers for quality benchmark
- ✅ CORRECT: Always use --reference-image with the logo file

---

## Workflow Steps

### Step 1: Gather Requirements

Ask about:
1. **Style direction** — Photorealistic circuit, cyberpunk/hacker, abstract, etc.
2. **Tone** — Bright and energetic OR muted and subdued
3. **Output name** — Filename (kebab-case)

### Step 2: Load References

```bash
# Verify logo exists
ls ${PROJECTS_DIR}/logos/ul-blue.png

# View style reference wallpapers
open ${PROJECTS_DIR}/wallpaper/circuit-board.png
open ${PROJECTS_DIR}/wallpaper/blue-purple-circuits.png
```

**Study reference wallpapers for:**
- Level of visual sophistication and detail
- Color palette application
- Depth and atmospheric effects
- Texture and material quality

### Step 3: Construct Prompt

**Required prompt sections:**

```
1. AESTHETIC - Define the visual style (cyberpunk, circuit, etc.)

2. VISUAL COMPLEXITY - Specify density, layers, detail level

3. TONE - Muted/subdued OR bright (usually muted is better)

4. COLOR PALETTE (STRICT):
   - Deep black base (#0a0a0f)
   - Blue (#4a90d9 or muted #3a6a9a)
   - Purple (#8b5cf6 or muted #6b4c96)
   - Cyan (#06b6d4 or muted #4a9a9a)
   - NO GREEN, NO PINK, NO OTHER COLORS

5. LOGO INTEGRATION (CRITICAL):
   - Connected-nodes logo from reference
   - EMBOSSED into surface (raised/pressed texture)
   - Position: bottom left WITHIN the visual content
   - Size: 3-5% of image width (SMALL)
   - Same materials/colors as surroundings
   - Slight luminosity difference only
   - NOT overlaid, NOT floating, NOT glowing
   - Must be surrounded by design elements

6. COMPOSITION:
   - Visual content fills ENTIRE canvas
   - NO empty corners or blank areas
   - Logo area has visual content WITH logo embossed into it

7. CRITICAL reminders:
   - Logo integrated INTO design
   - Logo SMALL and SUBTLE
   - Entire image has visual content
   - Correct color palette only
```

### Step 4: Generate

```bash
bun run ~/.claude/skills/Art/Tools/Generate.ts \
  --model nano-banana-pro \
  --prompt "[CONSTRUCTED_PROMPT]" \
  --size 4K \
  --aspect-ratio 16:9 \
  --reference-image ${PROJECTS_DIR}/logos/ul-blue.png \
  --output ${PROJECTS_DIR}/wallpaper/<output-name>.png
```

### Step 5: Validate (CRITICAL)

Open the generated image and check EVERY item:

```bash
open -a "Dia" ${PROJECTS_DIR}/wallpaper/<output-name>.png
```

**Validation Checklist:**

| Check | Pass/Fail |
|-------|-----------|
| Logo is the correct shape (connected nodes), not text | |
| Logo is EMBOSSED (texture), not overlaid or floating | |
| Logo is in bottom left corner | |
| Logo is SMALL (3-5% width) | |
| Logo is WITHIN visual content, not in empty space | |
| Logo is same color palette as surroundings | |
| Colors are ONLY blue/purple/cyan (no green, pink, etc.) | |
| Style is sophisticated, not cartoony or simple | |
| Tone matches request (muted if requested) | |
| Visual content fills entire canvas (no blank areas) | |
| Quality matches reference wallpapers | |
| Image dimensions are 4K+ (5504×3072 or similar) | |

**If ANY check fails → regenerate with adjusted prompt**

### Step 6: Iterate if Needed

Common fixes:
- Logo in wrong place → Emphasize "WITHIN the visual content" and "NO empty corners"
- Logo too big → Specify exact percentage "3-5% of image width"
- Wrong colors → List exact hex codes and explicitly say "NO GREEN, NO PINK"
- Too bright → Add "MUTED, SUBDUED, desaturated"
- Too simple → Describe sophistication level, reference existing wallpapers

### Step 7: Save and Apply

```bash
# Verify saved
ls -la ${PROJECTS_DIR}/wallpaper/<output-name>.png

# Apply to Kitty + macOS
k -w <output-name>
```

---

## Example Prompt (Muted Cyberpunk)

```
Cyberpunk hacker wallpaper, 16:9 4K resolution. SUBDUED AND MUTED.

AESTHETIC:
- Dense layers of data streams and neural network architecture
- Sophisticated cyberpunk atmosphere - Ghost in the Shell / Lain
- Japanese anime styling - mature, serious, detailed

VISUAL COMPLEXITY:
- Thousands of tiny particles and data points
- Overlapping translucent layers of circuit geometry
- Dense but organized chaos throughout THE ENTIRE IMAGE
- Visual content should extend to ALL edges including bottom left
- NO empty or blank areas anywhere

TONE (SUBDUED AND HUMBLE):
- MUTED colors - desaturated, not neon bright
- DARK overall - near-black dominates
- Subtle glows instead of bright neon
- Quiet sophistication, not loud
- Moody and atmospheric

COLOR PALETTE (MUTED UL BRAND):
- Deep black void dominates (#0a0a0f)
- Desaturated blue (#3a6a9a) - muted
- Muted purple (#6b4c96) - subtle
- Soft cyan (#4a9a9a) - hints only

LOGO INTEGRATION (CRITICAL):
- The connected-nodes logo (from reference) must be EMBOSSED INTO the visual content
- Position: bottom left, but WITHIN the circuit/data design, not in empty space
- The logo should be part of the circuit architecture - traces flow through it
- SMALL - about 3-5% of image width
- Same visual treatment as surrounding elements - muted, subtle
- Embossed texture - slight depth/luminosity difference only
- Should look like it was manufactured into the circuit board
- NOT floating in empty space - surrounded by and integrated with the design

COMPOSITION:
- Visual activity and detail must cover the ENTIRE canvas
- Bottom left corner has circuit detail WITH the logo embossed into it
- No blank corners or empty zones
- Uniform density of visual interest

CRITICAL:
- Logo MUST be integrated INTO the design, not placed in empty space
- Logo must be SMALL and SUBTLE
- Entire image should have visual content - no blank areas
- Subdued, muted, sophisticated
```

---

## Quick Reference

| Parameter | Value |
|-----------|-------|
| Model | nano-banana-pro |
| Size | 4K |
| Aspect Ratio | 16:9 |
| Logo Reference | ${PROJECTS_DIR}/logos/ul-blue.png |
| Output Directory | ${PROJECTS_DIR}/wallpaper/ |
| Logo Size | 3-5% of image width |
| Logo Position | Bottom left, WITHIN design |

**Color Palette (Muted):**
- Black: #0a0a0f
- Blue: #3a6a9a
- Purple: #6b4c96
- Cyan: #4a9a9a

**Color Palette (Bright):**
- Black: #0a0a0f
- Blue: #4a90d9
- Purple: #8b5cf6
- Cyan: #06b6d4
