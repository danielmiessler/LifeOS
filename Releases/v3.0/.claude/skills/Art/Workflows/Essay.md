# UL Art Image Generation Workflow

**Charcoal Architectural Sketch TECHNIQUE — Applied to CONTENT-RELEVANT subjects.**

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the Essay workflow in the Art skill to create header images"}' \
  > /dev/null 2>&1 &
```

Running **Essay** in **Art**...

---

Uses architectural sketching STYLE (gestural lines, hatching, charcoal) to depict whatever the content is actually ABOUT — NOT defaulting to buildings.

---

## 🚨🚨🚨 ALL STEPS ARE MANDATORY — NO EXCEPTIONS 🚨🚨🚨

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  EVERY SINGLE STEP BELOW IS MANDATORY. EXECUTE ALL OF THEM.  ⚠️
⚠️  DO NOT SKIP ANY STEP. DO NOT ABBREVIATE. DO NOT SHORTCUT.   ⚠️
⚠️  IF YOU SKIP A STEP, YOU HAVE FAILED THE WORKFLOW.           ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**ALL 8 STEPS ARE MANDATORY. Execute them IN ORDER. Do NOT skip steps.**

```
INPUT CONTENT
     ↓
[1] UNDERSTAND: Deeply read and comprehend the request ← MANDATORY
     ↓
[2] CSE-24: Run Create Story Explanation Level 24 on content ← MANDATORY
     ↓
[3] EMOTION: Identify emotional register ← MANDATORY
     ↓
[4] COMPOSITION: Design what to ACTUALLY DRAW ← MANDATORY
     ↓
[5] PROMPT: Construct using charcoal sketch TECHNIQUE template ← MANDATORY
     ↓
[6] GENERATE: Execute CLI tool with --thumbnail flag ← MANDATORY
     ↓
[7] OPTIMIZE: Resize, convert to WebP, create optimized thumbnails ← MANDATORY
     ↓
[8] VALIDATE: Subject matches content? Signature? Gallery-worthy? ← MANDATORY
```

**MANDATORY ELEMENTS IN EVERY IMAGE:**
- Signature (small, charcoal, bottom right corner)
- Charcoal sketch technique
- Content-relevant subject matter
- **BURNT SIENNA (#8B4513)** — human warmth, humanity (MANDATORY)
- **DEEP PURPLE (#4A148C)** — technology, AI, capital, cold power (MANDATORY)
- --thumbnail flag for blog headers

**🚨 BOTH SIENNA AND PURPLE MUST BE PRESENT IN EVERY IMAGE.**
- Sienna on human/warm elements
- Purple on tech/capital/cold elements
- The ratio of Sienna:Purple tells the emotional story
- If an image is missing either color, it's INCOMPLETE

**🚨 FORBIDDEN — NEVER INCLUDE:**
- ❌ Borders or frames around the image
- ❌ Background shading or gradients
- ❌ Filled backgrounds of any kind
- ❌ Decorative elements that aren't part of the subject
- The composition should float in empty space — MINIMALIST

**🚨 LOGICAL/PHILOSOPHICAL CONSISTENCY:**
- The visual MUST make logical sense with the concept
- If "X is winning" — X should be in the dominant/winning position visually
- If "X is heavy/powerful" — X weighs DOWN, not up
- If using a balance scale: the winning/heavy side pushes DOWN
- THINK about what the metaphor actually means before drawing it

**⚠️ KNOWN ISSUE: Background removal may remove the signature.**
If the signature is missing after generation, you must add it manually or regenerate with the signature more integrated into the composition (not isolated in corner with empty space).

---

## Step 1: Deeply Understand the Request — MANDATORY

**Before doing ANYTHING, deeply read and understand:**

1. **What is the content?** Read the full blog post, essay, or input material
2. **What is it ABOUT?** Not surface-level — the actual core concept/argument
3. **What are the key concrete elements?** Nouns, metaphors, imagery FROM the content
4. **What should NOT be drawn?** Architecture, buildings, vast spaces — UNLESS the content is about those
5. **Did the user provide GUIDANCE?** If the user gave direction about what to focus on, what the image should convey, or what angle to take — THIS TAKES PRIORITY over your own interpretation

**🚨 USER GUIDANCE TAKES PRIORITY:**
If the user provides specific direction like:
- "Focus on the tension between X and Y"
- "The image should show Z losing"
- "Emphasize the human impact"
- Any other compositional or thematic guidance

**USE THAT GUIDANCE** as the primary input for composition design. The CSE-24 supports the user's direction — it doesn't override it.

**Output:** Clear understanding of the content's core subject matter + any user-provided guidance.

---

## Step 2: Run Create Story Explanation Level 24 — MANDATORY

**Extract the FULL narrative arc to understand the emotional core.**

**🚨 ACTUALLY EXECUTE THIS COMMAND — DO NOT SKIP:**

```
Invoke the StoryExplanation Skill with: "Create a 24-item story explanation for this content"
```

Or use the slash command:
```
/cse [paste the content or URL]
```

**What CSE-24 gives you:**
- The complete narrative arc: setup, tension, transformation, resolution
- Key metaphors and imagery from the piece
- The emotional journey
- What the piece is REALLY about
- The "wow" factor and significance

**DO NOT PROCEED TO STEP 3 UNTIL YOU HAVE:**
1. Actually run the CSE command
2. Read and understood the 24-item output
3. Identified the key metaphors and emotional beats

**Output:** 24-item story explanation revealing the emotional and conceptual core.

---

## Step 3: Identify Emotional Register — MANDATORY

**Read the aesthetic file and select the appropriate emotional vocabulary.**

```bash
Read ~/.claude/skills/Art/SKILL.md
```

**Match the contVent to one of these emotional registers:**

| Register | When to Use |
|----------|-------------|
| **DREAD / FEAR** | AI takeover, existential risk, loss of control |
| **HOPE / POSSIBILITY** | Human potential, growth, positive futures |
| **CONTEMPLATION** | Philosophy, meaning, deep questions |
| **URGENCY / WARNING** | Security threats, calls to action |
| **WONDER / DISCOVERY** | Breakthroughs, encountering the vast |
| **DETERMINATION / EFFORT** | Overcoming obstacles, "gym" work |
| **MELANCHOLY / LOSS** | Endings, what's lost to progress |
| **CONNECTION / KINDNESS** | Human bonds, community |

**Output:** Selected emotional register with specific vocabulary from the aesthetic file.

These are just examples. It can be really anything which you will get from the Create Story Explanation Run. 

---

## Step 4: Design Composition — MANDATORY

**🚨 CRITICAL: Design what to ACTUALLY DRAW based on the CONTENT — NOT defaulting to architecture.**

### The Core Question

**What is this content ABOUT, and what visual would represent THAT?**

**🚨 IF USER PROVIDED GUIDANCE — START THERE:**
If the user gave direction in Step 1 (e.g., "focus on the tension between labor and capital", "show labor losing"), use that as your PRIMARY composition direction. The CSE-24 output SUPPORTS this direction — it doesn't replace it.

Use the content from the create-story-explanation run to compose this.

- Architecture is the TECHNIQUE (how to draw), NOT the required subject
- Only draw buildings/spaces if the content is about those things
- Draw what the content is actually about using architectural sketch style
- **User guidance shapes WHAT to draw; CSE-24 helps you understand the emotional core**

### Composition Design Questions

**🚨 STEP 4A: IDENTIFY THE PROBLEM (MOST CRITICAL)**

Before designing anything, extract from the CSE-24 output:

1. **What is the PROBLEM the essay addresses?**
   - What's WRONG with the current state?
   - What unfairness, mistake, or confusion exists?
   - What are people doing wrong that this essay corrects?
   - **The art should SHOW THIS PROBLEM visually**

2. **What TYPE of problem is it?**

   Identify the problem archetype from the CSE output:

   | Problem Type | Description | Visual Metaphor |
   |--------------|-------------|-----------------|
   | **SORTING/CLASSIFICATION** | Need to categorize things into the right buckets | Scattered items + empty labeled bins |
   | **COMMUNICATION** | Can't express ideas clearly, talking past each other | Tangled speech, broken telephone |
   | **DOUBLE STANDARD** | Same thing judged differently based on source | Tilted scales, unfair judges |
   | **MISDIRECTION** | Focusing on wrong thing, missing the real issue | Looking left while danger is right |
   | **OVERWHELM** | Too much to process, can't see clearly | Flood of items, buried figure |
   | **MISSING FRAMEWORK** | No structure to organize thinking | Chaos vs. empty scaffolding |
   | **FALSE DICHOTOMY** | Forced choice that ignores better options | Two doors, hidden third path |
   | **COMPLEXITY** | Simple thing made unnecessarily complicated | Tangled vs. straight path |
   | **BLINDSPOT** | Can't see obvious thing right in front | Figure ignoring elephant |

   **🚨 THE PROBLEM TYPE SHAPES THE VISUAL METAPHOR.**
   - SORTING problem → show the sorting challenge (scattered items, categories)
   - COMMUNICATION problem → show the breakdown (garbled speech, confusion)
   - DOUBLE STANDARD → show the unfairness (tilted scales, biased judge)

   **Examples with problem types:**
   - ATHI framework → Problem TYPE: SORTING — "When you have a threat, which category does it belong to?"
   - AI judgment essay → Problem TYPE: DOUBLE STANDARD — "Same output judged differently based on source"
   - Security theater → Problem TYPE: MISDIRECTION — "Focus on visible but ineffective measures"
   - Meaning essay → Problem TYPE: MISDIRECTION — "Chasing status instead of purpose"

   **THE ART SHOULD MAKE THE PROBLEM TYPE VISIBLE AT A GLANCE.**
   Someone seeing the image should immediately understand WHAT KIND of problem this is.

3. **What are the CONCRETE SUBJECTS in the content?**
   - Extract specific nouns, metaphors, imagery FROM the content
   - "Bowling pins" → draw bowling pins
   - "Hands juggling" → draw hands juggling
   - "Balance between capital and labor" → draw a balance/scale metaphor
   - **The visual should match the content's core concept**

4. **What VISUAL METAPHOR represents the PROBLEM?**
   - What image would make someone say "Oh, I see what's wrong"?
   - If the piece uses a metaphor USE THAT
   - If no metaphor, what scene captures the problematic situation?
   - **Show the unfairness, the mistake, the confusion**

5. **Should there be FIGURES showing the problem?**
   - Judges applying double standards
   - People ignoring obvious issues
   - Actors making the mistake the essay critiques
   - The dynamic that needs to change

6. **What is the EMOTIONAL treatment?**
   - The emotion should match the PROBLEM being shown
   - Unfairness → show the contrast, the tipped scale
   - Confusion → show the misdirection, the wrong focus
   - Loss → show what's fading, being ignored

7. **What is the COMPOSITION?**
   - Centered, minimalist, breathing space
   - Arrange to make the PROBLEM OBVIOUS
   - The viewer should "get it" immediately
   - NOT busy, NOT cluttered

### Composition Design Template

```
THE PROBLEM (from CSE-24 — MOST CRITICAL):
[What's WRONG with the current state that this essay addresses?]
[The unfairness, mistake, or confusion the essay critiques]
[This is what the art should SHOW]

SUBJECT (WHAT TO DRAW — showing the problem):
[The actual visual subject that makes the PROBLEM visible]
[Key elements from the content's metaphors/imagery]

VISUAL METAPHOR:
[The core image that represents the PROBLEM]
[What would make someone say "Oh, I see what's wrong"?]

FIGURE TREATMENT (if applicable):
[Type of figures, their roles in showing the problem]
[Who is judging unfairly? Who is being judged? Who is making the mistake?]

EMOTIONAL REGISTER:
[From Step 3]

COMPOSITION:
[Arrangement that makes the PROBLEM OBVIOUS]
[The viewer should "get it" immediately]

COLOR APPROACH:
[Warm:Cool ratio, which colors where]
```

**Output:** A specific composition design that makes the essay's PROBLEM VISIBLE at a glance.

---

## Step 5: Construct the Prompt — MANDATORY

**Use deep thinking to construct the final prompt using the charcoal sketch TECHNIQUE template.**

### Prompt Template

```
Sophisticated charcoal sketch using architectural rendering TECHNIQUE.

THE PROBLEM THIS ESSAY ADDRESSES (from Step 4 — drives the entire composition):
[What's WRONG with the current state that this essay critiques?]
[The art should make this problem VISIBLE AT A GLANCE]

SUBJECT (WHAT TO DRAW — showing the problem):
[The actual visual subject that makes the PROBLEM visible]
[NOT defaulting to architecture — draw what makes the problem clear]

EMOTIONAL REGISTER: [From Step 3]

TECHNIQUE — GESTURAL ARCHITECTURAL SKETCH STYLE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 Architecture is the TECHNIQUE, not the required subject 🚨
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- GESTURAL — quick, confident, energetic marks
- OVERLAPPING LINES — multiple strokes suggesting form
- HATCHING — cross-hatching creates depth and tone
- Loose charcoal/graphite pencil strokes throughout
- Variable line weight, some lines trailing off
- NOT clean vectors, NOT smooth
- Like Paul Rudolph, Lebbeus Woods sketches

LINEWORK (applies to ALL subjects):
- [Specific line quality from emotional vocabulary]
- Visible hatching and gestural marks
- UNIFIED sketch quality across all elements

HUMAN FIGURES (if present) — GESTURAL ABSTRACTED:
- MULTIPLE OVERLAPPING LINES suggesting the form
- Quick, confident, ENERGETIC gestural marks
- HATCHING and cross-hatching to create tone/depth
- 20-40 overlapping strokes creating the form
- Form EMERGES from accumulated linework
- Abstracted but with PRESENCE and WEIGHT
- FACES via simple charcoal marks (dark strokes for eyes, line for mouth)
- Burnt Sienna (#8B4513) WASH accent

HANDS (if present) — GESTURAL:
- Same overlapping line technique
- Form suggested through accumulated marks
- Sienna wash accent for human warmth

OBJECTS (if present) — GESTURAL SUGGESTED FORMS:
- Objects implied through hatching and gestural strokes
- Same energetic sketch quality
- Recognizable forms through accumulated lines
- NOT flat symbols — sketched with depth

COMPOSITION — FULL FRAME IS MANDATORY:
- 🚨 SUBJECTS MUST FILL THE ENTIRE FRAME — edge to edge horizontally and vertically
- Subjects should nearly TOUCH the edges of the image
- NO large empty margins on any side
- If there's 20%+ empty space on any edge, the composition is WRONG
- MINIMALIST means few elements, NOT small elements with lots of empty space
- Subjects LARGE and DOMINANT — filling the available space

COLOR — CHARCOAL DOMINANT, COLORS AS ACCENTS ONLY:
- CHARCOAL AND GRAY DOMINANT — 70-80% of image
- Colors INTEGRATED INTO forms — not splattered or applied on top
- Colors are the ESSENCE of elements (purple = cold capital, sienna = human warmth)
- Every bit of color belongs to a form — no random color floating in space

Optional: Sign small in bottom right corner in charcoal.
NO other text.
```

### Prompt Quality Check

Before generating, verify:
- [ ] **PROBLEM IS VISIBLE** — someone could understand what's wrong just from the image
- [ ] **Concrete subjects present** — nouns from title/content appear visually (not abstracted)
- [ ] Emotional register explicitly stated
- [ ] Figure treatment shows the problematic dynamic (if applicable)
- [ ] Light source and meaning specified
- [ ] Warm:cool ratio matches emotion
- [ ] "Charcoal sketch", "gestural", "hatching" explicitly stated
- [ ] Artist reference appropriate to emotion
- [ ] SPECIFIC to this content (couldn't be about something else)
- [ ] **Title test** — could someone guess the title from the image alone?

**Output:** A complete prompt ready for generation.

---

## Step 6: Execute the Generation — MANDATORY

### Intent-to-Flag Mapping

**Interpret user request and select appropriate flags:**

#### Model Selection

| User Says | Flag | When to Use |
|-----------|------|-------------|
| "fast", "quick", "draft" | `--model nano-banana` | Faster iteration, slightly lower quality |
| (default), "best", "high quality" | `--model nano-banana-pro` | Best quality + text rendering (recommended) |
| "flux", "stylistic variety" | `--model flux` | Different aesthetic, stylistic variety |

#### Size Selection

| User Says | Flag | Resolution |
|-----------|------|------------|
| "thumbnail", "small" | `--size 1K` | Quick previews |
| (default), "standard" | `--size 2K` | Standard blog headers |
| "high res", "large", "print" | `--size 4K` | Maximum resolution |

#### Aspect Ratio

| User Says | Flag | Use Case |
|-----------|------|----------|
| "square" | `--aspect-ratio 1:1` | Default for blog headers |
| "wide", "landscape", "banner" | `--aspect-ratio 16:9` | Wide banners |
| "portrait", "vertical" | `--aspect-ratio 9:16` | Vertical content |
| "ultrawide" | `--aspect-ratio 21:9` | Cinematic banners |

#### Post-Processing

| User Says | Flag | Effect |
|-----------|------|--------|
| "blog header" (default) | `--thumbnail` | Creates transparent + thumb versions |
| "transparent only" | `--remove-bg` | Just removes background |
| "with reference", "style like" | `--reference-image <path>` | Uses reference for style guidance |
| "variations", "options" | `--creative-variations 3` | Generates multiple versions |

### Default Model: nano-banana-pro

### 🚨 CRITICAL: Always Output to Downloads First

**ALL images go to `~/Downloads/` for preview before final placement.**

```bash
# ALWAYS output to Downloads first for user to review in Preview
bun run ~/.claude/skills/art/Tools/Generate.ts \
  --model nano-banana-pro \
  --prompt "[YOUR PROMPT]" \
  --size 2K \
  --aspect-ratio 1:1 \
  --thumbnail \
  --output ~/Downloads/[descriptive-name].png

# After user approves, THEN copy to final destination:
cp ~/Downloads/[name].png ${PROJECTS_DIR}/your-site/cms/public/images/
cp ~/Downloads/[name]-thumb.png ${PROJECTS_DIR}/your-site/cms/public/images/
```

### Construct Command Based on Intent

Based on user's request and the mapping tables above, construct the CLI command:

```bash
bun run ~/.claude/skills/art/Tools/Generate.ts \
  --model [SELECTED_MODEL from table] \
  --prompt "[PROMPT from Step 5]" \
  --size [SELECTED_SIZE] \
  --aspect-ratio [SELECTED_RATIO] \
  [--thumbnail if blog header] \
  [--reference-image PATH if style reference provided] \
  [--creative-variations N if variations requested] \
  --output [OUTPUT_PATH]
```

### 🚨 MANDATORY: Blog Header Images → Use `--thumbnail`

**ALL blog header images MUST use the `--thumbnail` flag.**

The `--thumbnail` flag generates TWO versions:
1. `output.png` — Transparent background (for compositing over website backgrounds)
2. `output-thumb.png` — With `#EAE9DF` background (for thumbnails, social previews, OpenGraph)

```bash
# Example: Generates both header.png AND header-thumb.png
bun run ~/.claude/skills/art/Tools/Generate.ts \
  --model nano-banana-pro \
  --prompt "[YOUR PROMPT]" \
  --size 2K \
  --aspect-ratio 1:1 \
  --thumbnail \
  --output ~/Website/cms/public/images/my-header.png
```

**Why two versions?**
- **Transparent (`output.png`):** For the blog post inline image — composites beautifully over website background
- **Thumbnail (`output-thumb.png`):** For `thumbnail:` frontmatter field — visible in social previews, RSS readers, and anywhere that doesn't composite transparency

### 🚨 CRITICAL: Blog Post Frontmatter Must Use `-thumb` Version

**ALWAYS reference the `-thumb` file in the blog post's `thumbnail:` frontmatter field:**

```yaml
# ✅ CORRECT - Use the -thumb version with sepia background
thumbnail: https://example.com/images/my-header-thumb.png

# ❌ WRONG - Transparent version shows white background on social media
thumbnail: https://example.com/images/my-header.png
```

**The inline image in the post body uses the transparent version:**
```markdown
[![Description](/images/my-header.png)](/images/my-header.png) <!-- width="1024" height="1024" -->
```

**Summary:**
| File | Background | Use For |
|------|------------|---------|
| `output.png` | Transparent | Inline blog image (composites over page background) |
| `output-thumb.png` | Sepia #EAE9DF | `thumbnail:` frontmatter, social previews, OpenGraph |

### Alternative: Standalone Background Removal

For non-blog images that only need transparency, or to remove backgrounds after generation:

```bash
# Use the Images Skill for background removal
bun ~/.claude/skills/PAI/Tools/RemoveBg.ts /path/to/output.png

# Or batch process multiple images
bun ~/.claude/skills/PAI/Tools/RemoveBg.ts image1.png image2.png image3.png
```

**See:** `~/.claude/skills/Images/Workflows/BackgroundRemoval.md` for full documentation.

### 🚨 COMPOSITION: USE FULL FRAME, MINIMALIST, NO BACKGROUNDS

**SUBJECTS FILL THE FRAME. FEW ELEMENTS. NO FILLED BACKGROUNDS.**

**ALWAYS include in prompt:**
- "USE FULL FRAME — subjects fill horizontal and vertical space"
- "Subjects LARGE and DOMINANT in the composition"
- "MINIMALIST — few elements, each intentional"
- "NO filled-in backgrounds — composition floats in empty space"
- "Clean, uncluttered — gallery-worthy simplicity"

**Common failures:**
- ❌ WRONG: Subjects too small, too much empty space around them
- ❌ WRONG: Busy backgrounds with lots of detail
- ❌ WRONG: Filled-in architectural environments surrounding subject
- ❌ WRONG: Cluttered compositions with competing elements

**The fix:**
- ✅ RIGHT: Subjects LARGE, filling the frame
- ✅ RIGHT: Few elements, each intentional — gallery aesthetic
- ✅ RIGHT: No background fill — subjects float in white/transparent space
- ✅ RIGHT: Full use of horizontal and vertical dimensions

### Alternative Models

| Model | Command | When to Use |
|-------|---------|-------------|
| **flux** | `--model flux --size 1:1 --remove-bg` | Maximum quality, more detail |
| **gpt-image-1** | `--model gpt-image-1 --size 1024x1024 --remove-bg` | Different interpretation |

### Immediately Open

```bash
open /path/to/output.png
```

---

## Step 7: Optimize Images (MANDATORY)

**🚨 CRITICAL: This step happens AFTER generation and background removal, BEFORE validation.**

### Why This Step Matters

Generated images at 2K resolution (2048x2048) are 6-8MB each - far too large for web use. Optimization reduces file sizes by 90-95% while maintaining visual quality, ensuring fast page loads and better user experience.

### Optimization Process

**For ALL blog header images, automatically execute these commands:**

```bash
# 1. Resize main image from 2K (2048x2048) to 1K (1024x1024) for web display
magick "~/Downloads/[name].png" -resize 1024x1024 "~/Downloads/[name]-1024.png"

# 2. Convert resized image to WebP format (main display version)
cwebp -q 75 "~/Downloads/[name]-1024.png" -o "~/Downloads/[name].webp"

# 3. Create optimized PNG thumbnail for social media (512x512)
magick "~/Downloads/[name]-thumb.png" -resize 512x512 -quality 80 "~/Downloads/[name]-thumb-optimized.png"

# 4. Clean up temporary resized PNG
rm "~/Downloads/[name]-1024.png"

# 5. Check final file sizes
ls -lh ~/Downloads/[name].webp ~/Downloads/[name]-thumb-optimized.png
```

**Expected Results:**
- Main WebP image: ~150-500KB (from ~7.5MB PNG)
- Optimized thumbnail: ~300-600KB (from ~6.8MB PNG)
- 90-95% total file size reduction

### File Usage Matrix

After optimization, you'll have these files:

| File | Format | Size | Use For |
|------|--------|------|---------|
| `[name].png` | PNG | ~7.5MB | Archive/backup (original with transparency) |
| `[name].webp` | WebP | ~400KB | **Inline blog display** (reference this in post body) |
| `[name]-thumb.png` | PNG | ~6.8MB | Archive/backup (original with sepia background) |
| `[name]-thumb-optimized.png` | PNG | ~500KB | **Social media thumbnails** (reference this in `thumbnail:` frontmatter) |

### Blog Post References

**After optimization, update the blog post to use optimized versions:**

```markdown
---
thumbnail: https://example.com/images/[name]-thumb-optimized.png
---

[![Alt text](/images/[name].webp)](/images/[name].webp) <!-- width="1024" height="1024" -->
```

**🚨 CRITICAL: Use `.webp` for inline images and `-thumb-optimized.png` for thumbnails.**

### Quality Settings Explained

- **WebP quality 75**: Aggressive compression with minimal visible quality loss. Perfect for web display of charcoal sketches where slight compression artifacts are invisible.
- **Thumbnail quality 80**: Standard optimization for PNG social previews. Balances file size with quality for platforms that don't support WebP.
- **Resize to 1024x1024**: Optimal for web display. Higher resolutions provide no visual benefit on typical displays but significantly increase file sizes.

### Error Handling

**If WebP is over 500KB:**
```bash
# Lower quality further
cwebp -q 65 "~/Downloads/[name]-1024.png" -o "~/Downloads/[name].webp"
```

**If thumbnail is over 600KB:**
```bash
# Resize smaller or lower quality
magick "[name]-thumb.png" -resize 400x400 -quality 75 "[name]-thumb-optimized.png"
```

**If magick command not found:**
```bash
# Install ImageMagick
brew install imagemagick
```

**If cwebp command not found:**
```bash
# Install WebP tools
brew install webp
```

### Integration Notes

- **This step is AUTOMATIC** - do not ask the user if optimization should be done
- **Happens in ~/Downloads/** before files are copied to final destination
- **Original high-res files are preserved** as archives
- **Validation (Step 8) checks the optimized files**, not the originals

---

## Step 8: Validation (MANDATORY)

**🚨 CRITICAL: This step is MANDATORY. Regenerate if validation fails.**

### 🚨🚨🚨 ACTUALLY LOOK AT THE IMAGE AND THINK 🚨🚨🚨

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  DO NOT JUST CHECK BOXES. ACTUALLY ANALYZE THE IMAGE.           ⚠️
⚠️  LOOK AT IT. THINK ABOUT IT. ASK: DOES THIS MAKE SENSE?         ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Open and Inspect

```bash
open /path/to/generated-image.png
```

### 🧠 CRITICAL ANALYSIS (DO THIS FIRST — BEFORE THE CHECKLIST)

**STOP. Look at the image. Answer these questions honestly:**

**0. SIGNATURE CHECK:**
- Is signature present in the BOTTOM RIGHT CORNER of the image? (if included)
- Not bottom center. Not near the subject. BOTTOM RIGHT CORNER.
- Is the signature correctly rendered? (no literal prompt text)
- If missing, wrong location, or wrong text → REGENERATE

**0.5. PROMPT LITERAL INTERPRETATION CHECK:**
- Did the model take prompt instructions literally? (e.g., writing literal prompt text instead of a signature)
- Are there any instruction words visible in the image that shouldn't be?
- Did labels come out as intended? (e.g., "A T H I" not "Actor Technique Harm Impact" spelled out)
- If prompt instructions appear as text in image → REGENERATE with clearer wording

**1. PHYSICAL REALITY CHECK:**
- Do objects obey physics? (heavy things fall DOWN, scales tip toward heavy side)
- If there's a scale: TRACE THE BEAM WITH YOUR EYES
  - Find the fulcrum (center pivot)
  - Which end of the beam is LOWER? That's the heavy side.
  - The heavy/winning side's end of the beam points DOWN toward the ground
  - The light/losing side's end of the beam points UP toward the sky
- If there's gravity: do things fall in the right direction?
- Are proportions reasonable?
- Would this scene make physical sense in the real world?

**2. LOGICAL CONSISTENCY CHECK:**
- Does the visual metaphor match the concept?
- If "X is winning" — is X visually dominant/powerful?
- If "X is losing" — is X diminished/fading/rising (on a scale)?
- Does cause match effect in the image?

**3. PHILOSOPHICAL ALIGNMENT CHECK:**
- Does the image represent the MEANING of the content?
- Would the user look at this and say "yes, that captures it"?
- Is the emotional register correct?
- Does the image argue the same point as the content?

**🚨 IF ANY OF THESE FAIL — STOP AND REGENERATE. DO NOT PROCEED.**

**Example failures:**
- ❌ Signature missing or not in bottom right corner (if signature was requested)
- ❌ Scale shows heavy side's beam going UP (physically impossible — heavy pulls DOWN)
- ❌ "Capital winning" but capital looks small/weak
- ❌ "Labor losing" but labor looks strong/dominant
- ❌ Objects floating when they should fall
- ❌ Visual contradicts the conceptual argument

### Validation Checklist

**🚨 MANDATORY ELEMENTS (if ANY are missing, REGENERATE):**
- [ ] **SIGNATURE PRESENT** — signed small in charcoal, bottom right corner (if requested)
- [ ] **PROBLEM TYPE VISIBLE** — the problem type (sorting, double standard, etc.) is immediately obvious
- [ ] **Subject matches CONTENT** — drew what the piece is ABOUT, not defaulted to architecture
- [ ] **Concrete subjects visible** — key nouns/metaphors from content actually appear
- [ ] **Title test passes** — someone could guess the topic from the image alone
- [ ] **Labels readable** — if there are labels (like A, T, H, I), they are clearly visible and correct
- [ ] **NOT defaulting to buildings/spaces** — unless content is actually about architecture
- [ ] **CSE-24 insights captured** — the visual represents the narrative arc discovered in Step 2
- [ ] **User guidance incorporated** — if the user gave direction, it's reflected in the image
- [ ] **Background removed** — transparent background, or re-run background removal if it failed

**TECHNIQUE (all required):**
- [ ] Charcoal sketch quality — visible strokes, hatching, gestural marks
- [ ] NOT clean vectors or cartoony
- [ ] Gestural overlapping lines suggesting form
- [ ] Gallery-worthy sophistication

**FIGURE STYLE (if figures present):**
- [ ] **GESTURAL ABSTRACTION** — multiple overlapping lines suggesting form
- [ ] **ENERGETIC LINEWORK** — quick, confident, scratchy strokes
- [ ] **HATCHING creates depth** — cross-hatching for tone and shadow
- [ ] **20-40 overlapping strokes** per figure — form emerges from accumulated marks
- [ ] **Figures have PRESENCE** — abstracted but with weight and dimension
- [ ] **Faces have EMOTION** — via charcoal marks (dark strokes for eyes, line for mouth, head tilt)
- [ ] Human = organic flowing gestural marks + sienna wash
- [ ] Robot = angular rigid gestural marks + purple wash
- [ ] Looks like Paul Rudolph / Lebbeus Woods architectural sketches

**COLOR (all required — BOTH SIENNA AND PURPLE MANDATORY):**
- [ ] **CHARCOAL/GRAY DOMINANT** — 70-85% of image
- [ ] **BURNT SIENNA (#8B4513) PRESENT** — on human/warm elements (MANDATORY)
- [ ] **DEEP PURPLE (#4A148C) PRESENT** — on tech/capital/cold elements (MANDATORY)
- [ ] Colors as washes/accents, not solid fills
- [ ] Sienna:Purple ratio matches emotional story

**EMOTION (all required):**
- [ ] Emotional register clear — matches Step 2 selection
- [ ] Architecture reinforces the feeling
- [ ] Figure treatment (if present) supports the mood
- [ ] Light placement serves the narrative
- [ ] Overall atmosphere matches intended emotion

**COMPOSITION (all required):**
- [ ] **FULL FRAME** — subjects nearly touch all edges, NO large empty margins
- [ ] **SUBJECTS LARGE** — dominant, filling the available space
- [ ] **NO BACKGROUND FILL** — floats in empty/transparent space (but subjects are LARGE)
- [ ] **KAI SIGNATURE** — small cursive charcoal in BOTTOM RIGHT CORNER
- [ ] **MARGIN CHECK** — is there more than 20% empty space on any edge? If yes, REGENERATE

**QUALITY (all required):**
- [ ] Could hang in a gallery next to Piranesi
- [ ] Could be concept art for a Villeneuve film
- [ ] Distinctive — NOT generic AI illustration
- [ ] Sophisticated — rewards closer looking
- [ ] **Transparent background** — used `--remove-bg` flag

### If Validation Fails

**Common failures and fixes:**

| Problem | Fix |
|---------|-----|
| **Subjects too SMALL** | 🚨 Add "LARGE SUBJECTS that FILL THE FRAME", "minimal empty space around subjects" |
| **Too much empty space** | 🚨 Add "minimal empty space around subjects", "subjects FILL THE FRAME" |
| **Background dominates** | 🚨 Add "subjects are DOMINANT focus", "subjects LARGE" |
| **Setting not recognizable** | Add "SETTING: [location]" with "2-3 KEY OBJECTS that establish location" — gym needs weights/bench visible |
| **Figures look like CARTOONS** | 🚨 Add "GESTURAL ABSTRACTION", "like Paul Rudolph sketches", "Lebbeus Woods figure studies", "OVERLAPPING LINES" |
| **Lines are SINGLE/CLEAN** | 🚨 Add "MULTIPLE OVERLAPPING LINES", "20-40 strokes per figure", "hatching for depth", "energetic gestural marks" |
| **Figures are FLAT** | 🚨 Add "HATCHING creates depth", "figures have PRESENCE and WEIGHT", "form emerges from accumulated marks" |
| **No emotion on faces** | Add "dark charcoal strokes for eyes area", "line for mouth angle", "head TILT conveys emotion", "SUGGESTED expression" |
| **Too illustrated/rendered** | Add "GESTURAL SKETCH quality", "quick energetic marks", "like architectural concept sketches" |
| **Objects too detailed** | Add "objects implied through hatching", "same sketch quality as figures", "suggested forms" |
| Wrong emotion | Adjust POSTURE and LINE QUALITY — leaning = relaxed, rigid = tense, dense hatching = weight |
| Colors too solid | Emphasize "atmospheric washes", "tints over charcoal", "not solid fills" |
| Generic AI look | Add "Paul Rudolph", "Lebbeus Woods", "architectural concept sketches" references |

**Regeneration Process:**
1. Identify failed criteria
2. Update prompt with specific fixes
3. Regenerate
4. Re-validate
5. Repeat until ALL criteria pass

---

## Quick Reference

### The Workflow in Brief

```
1. UNDERSTAND → Deeply read and comprehend the content
2. CSE-24 → Run Create Story Explanation (24 items) to extract narrative arc
3. EMOTION → Match to register in ~/.claude/skills/PAI/aesthetic.md
4. COMPOSITION → Design what to DRAW (content-relevant, NOT defaulting to architecture)
5. PROMPT → Build using charcoal sketch TECHNIQUE template
6. GENERATE → Execute with nano-banana-pro + --thumbnail flag
7. OPTIMIZE → Resize to 1024, convert to WebP, create optimized thumbnails
8. VALIDATE → Subject matches content? Technique correct? Gallery-worthy?
```

### Emotional Quick-Select

| Content About... | Register | Warm:Cool | Visual Treatment |
|------------------|----------|-----------|------------------|
| AI danger | Dread | 20:80 | Heavy, dense, oppressive linework |
| Human potential | Hope | 80:20 | Light, ascending, open |
| Philosophy | Contemplation | 50:50 | Balanced, still, thoughtful |
| Security threats | Urgency | 60:40 | Fractured, dynamic, tense |
| Discoveries | Wonder | 40:60 | Revelatory, light breaking through |
| Building skills | Determination | 70:30 | Strong, grounded, effort-showing |
| What's lost | Melancholy | 40:60 | Fading, dissolving, trailing off |
| Community | Connection | 90:10 | Warm, intimate, multiple figures |

### The UL Look Checklist

Before submitting any image:
- ✅ **Subject matches CONTENT** — drew what the piece is ABOUT (not defaulting to architecture)
- ✅ **CSE-24 was run** — actually executed the story explanation command
- ✅ **Concrete subjects visible** — key nouns/metaphors from content appear
- ✅ Charcoal sketch TECHNIQUE — gestural, atmospheric, hatching
- ✅ Emotional register — clear and intentional
- ✅ Color washes — warm/cool ratio tells the story
- ✅ Gallery-worthy — sophisticated, not generic AI
- ✅ **--thumbnail flag used** — both transparent and sepia versions generated
- ✅ **OPTIMIZATION COMPLETED** — resized to 1024, converted to WebP, optimized thumbnails created
- ✅ Signature — small charcoal bottom right (optional)

---

**The workflow: UNDERSTAND → CSE-24 → EMOTION → COMPOSITION → PROMPT → GENERATE (--thumbnail) → OPTIMIZE → VALIDATE → Complete**
