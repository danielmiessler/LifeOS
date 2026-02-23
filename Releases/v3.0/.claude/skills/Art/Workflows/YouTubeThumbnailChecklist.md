# YouTube Thumbnail Generation Checklists

**Two-phase validation: Before generation and after generation**

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the YouTubeThumbnailChecklist workflow in the Art skill to validate thumbnails"}' \
  > /dev/null 2>&1 &
```

Running **YouTubeThumbnailChecklist** in **Art**...

---

## PRE-GENERATION CHECKLIST

**Complete this BEFORE running any generation commands. If ANY item fails, STOP and fix it.**

### Phase 1: Reference Analysis

```
□ Opened BOTH example thumbnails AND SPECIFICATIONS.md
□ Viewing example thumbnail in Preview/Finder at 100% size
□ Identified which example thumbnail most closely matches this use case
□ Screenshot or note exact colors from example using Digital Color Meter
□ Measured text positions in example using ruler/measurement tool
□ Identified exact font weight in example (not just family)
□ Noted border thickness and color from example
□ Checked logo size and exact position in example
```

### Phase 2: Content Preparation

```
□ Determined thumbnail type (Main/Audio/Sponsored)
□ Extracted title text from content (3-7 words max)
□ Identified content mood/tone for headshot selection
□ Selected specific headshot file from your headshot references OR
□ Planned to generate NEW headshot using Headshot skill
□ Determined if background art exists OR needs generation
□ If generating art: wrote specific dark-palette prompt
```

### Phase 3: Font Verification

```
□ Ran: magick -list font | grep -i [font-name]
□ Confirmed exact font name available in ImageMagick
□ Confirmed font weights available (Bold, ExtraBold, Medium)
□ If fonts missing: installed required fonts first
□ Test rendered sample text to verify font appearance
```

### Phase 4: Specification Confirmation

**Check each specification against example:**

```
□ Canvas size: 1280x720 confirmed
□ Background color: [HEX] confirmed from example
□ Border color: [HEX] confirmed from example
□ Border thickness: [N]px confirmed from example
□ Corner radius: [N]px confirmed from example
□ Logo position: [X]px from right, [Y]px from top confirmed
□ Logo size: [W]x[H]px confirmed
□ Line 1 position: [Y]px from top confirmed
□ Line 1 size: [N]px confirmed
□ Line 1 color: [HEX] confirmed
□ Line 2 position: [Y]px from top confirmed
□ Line 2 size: [N]px confirmed
□ Line 2 color: [HEX] confirmed
□ Line 3 position: [Y]px from top confirmed
□ Line 3 size: [N]px confirmed
□ Line 3 color: [HEX] confirmed
□ Line 4 position: [Y]px from top confirmed
□ Line 4 size: [N]px confirmed
□ Line 4 color: [HEX] confirmed
□ Headshot width: ~[N]% of canvas confirmed
□ Headshot height: ~[N]% of canvas confirmed
□ Headshot position: [X]px from edge confirmed
□ Art opacity: [N]% confirmed from example
```

### Phase 5: Asset Generation Plan

**For Background Art:**
```
□ Art type determined (diagram/code/generated)
□ If generated: prompt includes "dark navy background #1A2744"
□ If generated: prompt includes "deep purple #4A148C accents"
□ If generated: prompt explicitly states "NO light backgrounds, NO beige"
□ If generated: prompt specifies "left-weighted composition"
□ Generation command ready with correct parameters
```

**For Headshot:**
```
□ If using existing: confirmed exact file path
□ If using existing: confirmed headshot matches content mood
□ If generating new: Headshot skill will be used (NOT nano-banana-pro)
□ If generating new: reference photo identified for likeness
□ If generating new: expression/mood specified in prompt
```

### Phase 6: Command Validation

**Before running ImageMagick command:**
```
□ All file paths confirmed to exist
□ All hex colors confirmed from example (not from memory)
□ All font names confirmed available in ImageMagick
□ All pixel positions confirmed from measurement
□ All sizes confirmed from measurement
□ Kerning/letter-spacing values match example
□ Layer order correct (background → art → headshot → text → border → logo)
□ Output path is ~/Downloads/
□ Output filename includes timestamp
```

---

## POST-GENERATION VALIDATION CHECKLIST

**Complete this AFTER generating thumbnail. If ANY item fails, regenerate with corrections.**

### Phase 1: File Validation

```
□ File exists at specified path
□ File size is reasonable (not corrupted)
□ File opens in Preview/Finder
□ Resolution is EXACTLY 1280x720 pixels
□ File format is PNG
```

### Phase 2: Side-by-Side Visual Comparison

**Open example thumbnail AND your generated thumbnail side-by-side in Finder**

```
□ Opened example thumbnail: [filename]
□ Opened generated thumbnail: [filename]
□ Viewing both at same zoom level (100%)
□ Can see both simultaneously
```

### Phase 3: Border & Canvas Validation

**Compare border pixel-by-pixel:**
```
□ Border color matches example EXACTLY (use Digital Color Meter)
□ Border thickness matches example EXACTLY
□ Corner radius matches example EXACTLY
□ Border is consistent on all four sides
□ No anti-aliasing artifacts or jagged edges
```

**Compare background:**
```
□ Background color matches example EXACTLY
□ No visible gradient unless example has gradient
□ Background fills entire canvas
```

### Phase 4: Logo Validation

```
□ Logo is present
□ Logo matches example style (TI: mark, not UL logo)
□ Logo size matches example (measure in pixels)
□ Logo position matches example (measure from edges)
□ Logo color correct for thumbnail type
```

### Phase 5: Typography Validation

**For each text line, validate against example:**

**Line 1:**
```
□ Font family matches example (geometric sans, not Helvetica)
□ Font weight matches example (Bold 700)
□ Font size matches example (±2px tolerance)
□ Text color matches example EXACTLY
□ Letter spacing matches example
□ Position from top matches example (±3px tolerance)
□ Position from left matches example (±3px tolerance)
□ Text transform matches (UPPERCASE vs Title Case)
```

**Line 2:**
```
□ Font family matches example
□ Font weight matches example (Extra Bold 800)
□ Font size matches example (±2px tolerance)
□ Text color matches example EXACTLY
□ Letter spacing matches example
□ Position from top matches example (±3px tolerance)
□ Position from left matches example (±3px tolerance)
□ Text transform matches
```

**Line 3:**
```
□ Font family matches example
□ Font weight matches example (Bold 700)
□ Font size matches example (±2px tolerance)
□ Text color matches example EXACTLY
□ Letter spacing matches example
□ Position from top matches example (±3px tolerance)
□ Position from left matches example (±3px tolerance)
□ Text transform matches
```

**Line 4:**
```
□ Font family matches example
□ Font weight matches example (Medium 500)
□ Font size matches example (±2px tolerance)
□ Text color matches example EXACTLY
□ Letter spacing matches example
□ Position from top matches example (±3px tolerance)
□ Position from left matches example (±3px tolerance)
□ Text transform matches
```

### Phase 6: Headshot Validation

```
□ Headshot is present
□ Headshot is NEW/CUSTOM (not reused from previous thumbnails) OR
□ Headshot is appropriate existing photo from headshot references
□ Headshot matches content mood/tone
□ Headshot size matches example proportion (~35-40% width)
□ Headshot position matches example (right side)
□ Headshot vertical alignment matches example
□ Background removed cleanly (no artifacts)
□ Lighting quality matches example
□ No blur or quality degradation
```

### Phase 7: Background Art Validation

```
□ Background art is present
□ Background art is NEW/CUSTOM (not reused) OR
□ Background art is appropriate existing asset
□ Art uses dark color palette (no light backgrounds)
□ Art opacity allows text to be readable
□ Art positioned correctly (left/center)
□ Art doesn't compete with text or headshot
□ Art blends naturally with background
□ Art coverage matches example proportion
```

### Phase 8: Composition Validation

**Overall layout check:**
```
□ Text block occupies left ~55% of frame (matches example)
□ Headshot occupies right ~40% of frame (matches example)
□ White space and breathing room matches example
□ No elements are crowded or overlapping incorrectly
□ Visual hierarchy matches example (what draws eye first)
□ Balance between text/art/headshot matches example
```

### Phase 9: Color Accuracy Validation

**Use Digital Color Meter to sample colors from both images:**

```
□ Background: Generated [HEX] vs Example [HEX] - MATCH
□ Border: Generated [HEX] vs Example [HEX] - MATCH
□ Line 1 text: Generated [HEX] vs Example [HEX] - MATCH
□ Line 2 text: Generated [HEX] vs Example [HEX] - MATCH
□ Line 3 text: Generated [HEX] vs Example [HEX] - MATCH
□ Line 4 text: Generated [HEX] vs Example [HEX] - MATCH
□ Logo: Generated [HEX] vs Example [HEX] - MATCH
```

### Phase 10: Readability Validation

**Test thumbnail at YouTube display sizes:**

```
□ Created small preview: magick [file] -resize 320x180 [preview-file]
□ Opened small preview (simulates YouTube sidebar)
□ Main title is readable at small size
□ Headshot is recognizable at small size
□ Overall composition is clear at small size
□ Colors have sufficient contrast at small size
```

### Phase 11: Professional Quality Validation

```
□ No pixelation or compression artifacts
□ Text is sharp and crisp
□ Headshot is high quality
□ Colors are vibrant but not oversaturated
□ Professional polish matches example quality
□ No amateur mistakes (wrong fonts, bad spacing, etc.)
□ Would be acceptable for public YouTube upload
```

---

## VALIDATION DECISION TREE

```
ALL POST-GENERATION CHECKS PASSED?
    ↓ YES → Thumbnail is complete
    ↓ NO  → Continue below

WHICH PHASE FAILED?
    ↓
    ├─ Phase 3 (Border/Canvas) → Fix border/background, regenerate
    ├─ Phase 4 (Logo) → Fix logo size/position/style, regenerate
    ├─ Phase 5 (Typography) → Fix fonts/sizes/positions, regenerate
    ├─ Phase 6 (Headshot) → Generate new headshot, recompose
    ├─ Phase 7 (Background Art) → Generate new art, recompose
    ├─ Phase 8 (Composition) → Adjust layout, regenerate
    ├─ Phase 9 (Colors) → Fix hex values, regenerate
    └─ Phase 10 (Readability) → Increase font size, simplify, regenerate

AFTER FIX → RERUN ENTIRE POST-GENERATION CHECKLIST
```

---

## CRITICAL FAILURE MODES TO AVOID

**These are the most common ways thumbnails fail. Check these TWICE:**

1. **Wrong Font Family**
   - ❌ Using Helvetica instead of Inter/Montserrat
   - ❌ Using system serif instead of Playfair Display (Audio)
   - ✅ Confirm font name with: `magick -list font | grep [name]`

2. **Wrong Font Weight**
   - ❌ Using Bold (700) when should be Extra Bold (800)
   - ❌ Using Regular when should be Bold
   - ✅ Check example closely for weight

3. **Wrong Border Color**
   - ❌ Using #3b82f6 (too bright) instead of #4A90D9
   - ❌ Using #00FF00 at 100% (neon) instead of subtle green
   - ✅ Use Digital Color Meter to sample exact hex from example

4. **Wrong Canvas Size**
   - ❌ Using 1920x1080 instead of 1280x720
   - ✅ Confirm with: `magick identify [file]`

5. **Reused Headshot**
   - ❌ Using same headshot from previous thumbnail
   - ❌ Not generating custom headshot for this specific thumbnail
   - ✅ Generate NEW headshot OR select appropriate existing photo

6. **Reused Background Art**
   - ❌ Using same art from previous thumbnail
   - ❌ Generic art that doesn't match topic
   - ✅ Generate NEW art specific to this thumbnail's topic

7. **Light Background Art**
   - ❌ Art with beige/cream/light colors
   - ❌ Art that doesn't blend with dark navy background
   - ✅ Explicitly specify dark palette in generation prompt

8. **Wrong Text Positioning**
   - ❌ Text too high (not enough top padding)
   - ❌ Text too cramped (insufficient line spacing)
   - ✅ Measure exact Y positions from example

9. **Wrong Logo**
   - ❌ Using UL logo instead of TI: mark
   - ❌ Wrong logo size or position
   - ✅ Check example for exact logo style and placement

10. **Insufficient Validation**
    - ❌ Calling thumbnail "done" without side-by-side comparison
    - ❌ Not checking at small size
    - ✅ Complete ENTIRE post-generation checklist

---

## MANDATORY WORKFLOW

```
BEFORE GENERATION:
    Complete Pre-Generation Checklist → All boxes checked → Proceed

DURING GENERATION:
    Generate Background Art (if needed) → Validate art before continuing
    Generate Headshot (if needed) → Validate headshot before continuing
    Compose Thumbnail → Use exact specifications

AFTER GENERATION:
    Complete Post-Generation Checklist → All boxes checked → Done
    If any checks fail → Identify issue → Fix → Regenerate → Revalidate
```

---

**NO THUMBNAIL IS COMPLETE UNTIL EVERY CHECKLIST ITEM PASSES.**
