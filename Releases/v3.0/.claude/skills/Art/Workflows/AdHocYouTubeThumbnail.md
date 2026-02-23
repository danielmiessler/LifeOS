# Ad-hoc YouTube Thumbnail Workflow

Generate complete YouTube thumbnails from content input with dramatic tech backgrounds and AI-generated headshots.

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the AdHocYouTubeThumbnail workflow in the Art skill to create thumbnails"}' \
  > /dev/null 2>&1 &
```

Running **AdHocYouTubeThumbnail** in **Art**...

---

## Explicit Criteria

### 1. Dynamic Headshot - FACE ONLY
- **Fresh AI-generated** each time using Nano Banana Pro with reference images
- Reference image is used for likeness, NOT the actual headshot
- **Position is dynamic**: left, center, or right (based on content/preference)
- **🚨 FACE ONLY**: Forehead to chin, ear to ear - **NO shoulders, NO neck, NO body**
- Face fills 95% of the image area (ComposeThumbnail auto-crops)
- **Transparent background**: Must run RemoveBg after generation
- **🚨 MUST VARY** between thumbnails (see Variation Requirements below)

### 2. Dramatic Tech Background
- **Style**: Futuristic, sci-fi aesthetic (hexagonal circuits, glowing edges, 3D depth)
- **Colors**: Dark with cyan/blue/purple neon accents (Tokyo Night palette)
- **No text, no people** in the background - pure abstract tech art
- **Examples**: Blade Runner, Tron, circuit board patterns with glow

### 3. Text - BILLBOARD STYLE
- **Title**: Up to 6 words, CAPITALIZED, **CYAN** by default (vibrant, not white)
- **Subtitle**: Up to 12 words, CAPITALIZED, white text
- **🚨 TEXT FILLS THE SPACE** - takes up most of available area opposite headshot
- **BOLD STROKE OUTLINE** (4px title, 3px subtitle) - visible at 320px thumbnail size
- **Visually centered** in safe zone (NEVER overlaps headshot)
- **Grouped as a unit** - title and subtitle together as text block

### 4. Colored Border
- **Tokyo Night purple** (#bb9af7) default
- **16px width** around entire thumbnail
- Creates professional framing

---

## Output Specifications

| Element | Value |
|---------|-------|
| Canvas | 1280x720 px |
| Border | **16px** #bb9af7 (Tokyo Night purple) |
| Headshot | **FACE ONLY** (~688px height), auto-cropped (no shoulders/body) |
| Title | **100pt** Helvetica-Bold, **4px** black stroke outline |
| Subtitle | **50pt** Helvetica-Bold, **3px** black stroke outline |
| Title color | **CYAN (#7dcfff) by default** - NEVER plain white |
| Subtitle color | White (#FFFFFF) for contrast |
| Text position | **FILLS** safe zone opposite headshot (NEVER overlaps) |
| Background | Dramatic futuristic tech art |
| Fresh headshot | **MANDATORY** - generate new WITH VARIATION each time |
| 320x180 test | **MANDATORY** - must be readable at YouTube grid size |

### Text Color Presets (--title-color, --subtitle-color)

| Name | Hex | Use |
|------|-----|-----|
| cyan | #7dcfff | **DEFAULT** - Tech, futuristic |
| white | #FFFFFF | High contrast (subtitle default) |
| purple | #bb9af7 | Matches border |
| blue | #7aa2f7 | Professional |
| magenta | #ff007c | Bold, attention |
| yellow | #e0af68 | Warning, highlight |
| green | #9ece6a | Success, growth |
| orange | #ff9e64 | Energy, urgency |
| red | #f7768e | Alert, danger |

---

## Step 1: Content Analysis

**Extract title and subtitle from input content.**

### Input Types
- Script or article text
- URL (fetch and analyze)
- Topic description
- Video outline

### Extraction Prompt

```
Analyze this content and extract:

1. TITLE (max 6 words): The attention-grabbing hook
2. SUBTITLE (max 12 words): The value promise or context

Guidelines:
- Use power words: "SECRET", "HIDDEN", "REAL", "TRUTH", "WHY", "HOW"
- Create curiosity gaps
- Be specific over generic
- Make a bold claim or promise

Content: [INPUT]
```

---

## Step 2: Background Generation

**Generate dramatic futuristic tech background.**

### Background Prompt Template

```
Dramatic futuristic technology background. Dark hexagonal circuit board pattern
with glowing cyan/blue neon edge lighting. 3D depth perspective. Metallic dark
grey hexagons with embedded circuit patterns. Glowing cyan (#7dcfff) and purple
(#bb9af7) edge highlights. Deep shadows, high contrast. Sci-fi aesthetic like
Blade Runner or Tron. Abstract technology, no text, no people. Dark moody
atmosphere with electric blue glow accents.

Topic context: [EXTRACTED TOPIC]
```

### Generate Command

```bash
bun run ~/.claude/skills/Art/Tools/Generate.ts \
  --model nano-banana-pro \
  --prompt "[BACKGROUND PROMPT]" \
  --size 2K \
  --aspect-ratio 16:9 \
  --output ~/Downloads/yt-bg-$(date +%Y%m%d-%H%M%S).png
```

---

## Step 3: Headshot Generation

**🚨 MANDATORY: Generate a FRESH, VARIED, FACE-ONLY headshot EVERY time.**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  FACE ONLY: Forehead to chin, ear to ear                        ⚠️
⚠️  NO shoulders, NO neck, NO body visible                         ⚠️
⚠️  If shoulders/body visible → REGENERATE IMMEDIATELY             ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Headshot Variation Requirements

**For each thumbnail, RANDOMLY select ONE from each category:**

**Angle:**
- Straight-on, looking directly at camera
- Slight 3/4 turn, face angled 15 degrees to the right
- Head tilted slightly to the right

**Expression:**
- Confident, authoritative
- Contemplative, thoughtful intensity
- Focused, direct engagement

**Lighting:**
- Soft diffused key light
- Dramatic side lighting with shadow
- Rembrandt lighting pattern

### Base Headshot Requirements (always include)
- **🚨 FACE ONLY** - forehead to chin, ear to ear
- **NO shoulders, NO neck, NO body** - face fills entire frame
- Pure black background (for easy removal)
- Full beard along jawline, NO mustache (clean-shaven upper lip)
- Face fills 95% of image area

### Example FACE-ONLY Prompts

**Variation A (confident, straight-on):**
```
Extreme close-up of the subject's FACE ONLY. Frame shows forehead to chin, ear to ear.
Absolutely NO shoulders, NO neck, NO body visible. Face fills entire image.
Confident, authoritative expression - NOT smiling. Looking directly at camera.
Pure black background. Full beard along jawline with clean-shaven upper lip.
Soft diffused key lighting. Ultra-tight crop on face only.
```

**Variation B (contemplative, 3/4 angle):**
```
Extreme close-up of the subject's FACE ONLY. Frame shows forehead to chin, ear to ear.
Absolutely NO shoulders, NO neck, NO body visible. Face fills entire image.
Contemplative, thoughtful expression with subtle intensity - NOT smiling.
Face turned 15 degrees to the right, slight 3/4 angle.
Pure black background. Full beard along jawline with clean-shaven upper lip.
Dramatic side lighting creating depth. Ultra-tight crop on face only.
```

**Variation C (focused, head tilt):**
```
Extreme close-up of the subject's FACE ONLY. Frame shows forehead to chin, ear to ear.
Absolutely NO shoulders, NO neck, NO body visible. Face fills entire image.
Focused, direct engagement expression - NOT smiling. Head tilted slightly.
Pure black background. Full beard along jawline with clean-shaven upper lip.
Rembrandt lighting pattern. Looking at camera. Ultra-tight crop on face only.
```

### Generate Command

```bash
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

bun ~/.claude/skills/Headshot/Tools/Headshot.ts \
  --prompt "[FACE-ONLY HEADSHOT PROMPT]" \
  --reference ~/.claude/skills/Headshot/Examples/reference.png \
  --reference ~/.claude/skills/Headshot/Examples/studio-glasses-style.png \
  --reference ~/.claude/skills/Headshot/Examples/clean-smile.png \
  --size 2K \
  --aspect-ratio 1:1 \
  --output ~/Downloads/yt-headshot-${TIMESTAMP}.png
```

**Note:** Using 1:1 aspect ratio forces tighter face crop. ComposeThumbnail will also auto-crop to remove any remaining body.

### Remove Background

```bash
bun ~/.claude/skills/PAI/Tools/RemoveBg.ts ~/Downloads/yt-headshot-${TIMESTAMP}.png
```

---

## Step 4: Composition

**Composite all elements using ComposeThumbnail tool.**

### Compose Command

```bash
bun ~/.claude/skills/Art/Tools/ComposeThumbnail.ts \
  --background ~/Downloads/yt-bg-${TIMESTAMP}.png \
  --headshot ~/Downloads/yt-headshot-${TIMESTAMP}.png \
  --title "[TITLE]" \
  --subtitle "[SUBTITLE]" \
  --title-color [cyan|purple|magenta|white|etc] \
  --position [left|center|right] \
  --output ~/Downloads/yt-thumbnail-${TIMESTAMP}.png
```

### Position Logic
- **left**: Headshot on left, text centered on right half
- **center**: Headshot centered, title at top, subtitle at bottom
- **right**: Headshot on right, text centered on left half

### Text Positioning (automatic)
- For left/right: Text block (title + subtitle) centered vertically in opposite half
- For center: Title at top edge, subtitle at bottom edge
- Text uses black stroke outline for readability (no black boxes)

---

## Step 5: Quality Validation

**🚨 MANDATORY: ALL checks must pass before presenting to the user.**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  THE 320x180 TEST IS MANDATORY                                  ⚠️
⚠️  If text isn't readable at thumbnail size → FAIL                ⚠️
⚠️  If it looks like ass at any size → FAIL                        ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Quality Gates (ALL MUST PASS)

| # | Check | Pass Criteria |
|---|-------|---------------|
| 1 | Dimensions | Exactly 1280x720 |
| 2 | **FACE-ONLY headshot** | NO shoulders, NO neck, NO body visible |
| 3 | Face fills frame | Face is 90%+ of headshot area |
| 4 | Text fills space | Title is large, bold, FILLS the text zone |
| 5 | Text color | **CYAN or vibrant** - NOT plain white |
| 6 | Stroke visible | 4px title / 3px subtitle - visible at 320px |
| 7 | No overlap | Text entirely in its safe zone |
| 8 | Variation | Visibly different from previous generation |
| 9 | **320x180 readability** | **Text readable at YouTube grid size** |
| 10 | Overall | Professional, billboard-quality appearance |

### Validation Commands

```bash
# 1. Verify dimensions
magick identify -format "%wx%h" ~/Downloads/yt-thumbnail-${TIMESTAMP}.png
# Expected: 1280x720

# 2. Open for visual inspection at full size
open ~/Downloads/yt-thumbnail-${TIMESTAMP}.png
# Confirm: Face only (no body), text fills space, cyan color visible

# 3. 🚨 MANDATORY: Test at YouTube thumbnail size
magick ~/Downloads/yt-thumbnail-${TIMESTAMP}.png -resize 320x180 /tmp/yt-preview.png
open /tmp/yt-preview.png
# Confirm: Title READABLE, face RECOGNIZABLE, colors POP
# If you can't read the title at 320x180 → FAIL
```

### Failure Response

**If ANY check fails:**
1. **DO NOT present to the user**
2. Identify the specific failure
3. Fix the issue:
   - Body visible → Regenerate headshot with FACE-ONLY prompt
   - Text too small → Already fixed (100pt/50pt)
   - Text not visible at 320x180 → Check color/stroke
   - Text overlapping → Check positioning
4. Re-run composition
5. Re-verify ALL checks including 320x180 test
6. **Only present when ALL checks pass**

### Quality Standards
- **Thumbnail is a BILLBOARD** - text must dominate, face must dominate
- **DO NOT present output that looks broken, garbled, or unprofessional**
- **Iterate until it matches ALL criteria**
- **If it looks like ass, fix it before showing the user**
- **The 320x180 test is the ultimate validation** - that's what YouTube shows

---

## Quick Reference

### Tokyo Night Colors
```
Purple (border):  #bb9af7
Cyan (accents):   #7dcfff
Blue (accents):   #7aa2f7
Dark base:        #1a1b26
```

### Workflow Summary
```
1. ANALYZE content → Extract TITLE + SUBTITLE
2. GENERATE background → Dramatic tech art (Nano Banana Pro)
3. GENERATE headshot → FACE-ONLY (1:1 aspect), WITH VARIATION + RemoveBg
4. COMPOSE → ComposeThumbnail.ts (auto-crops body, cyan text, 100pt title)
5. VALIDATE → ALL gates including 320x180 readability test
```

### Philosophy
**The thumbnail is a BILLBOARD, not a document.**
- FACE dominates one side
- TEXT FILLS the other side
- Must be readable at 320x180
- Every generation is visibly different

### Output Location
All outputs: `~/Downloads/yt-thumbnail-{timestamp}.png`
