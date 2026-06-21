# UL Art Image Generation Workflow

**Charcoal Architectural Sketch TECHNIQUE — Applied to CONTENT-RELEVANT subjects.**

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

COMPOSITION — FULL FRAME WITH BREATHING ROOM (target band: 7–12% margin on every edge):
- 🚨 SUBJECTS MUST DOMINATE the frame, NOT be small islands in empty space
- Target margin band: each of the four edges should have **between 7% and 12% empty space** (transparent or background-color) — not zero, not 20%+
- Hard FAILS:
  - Any edge with **less than 5% margin** → subject is butting against the edge, looks visually clipped (the 2026-04-27 "flat against the side" failure)
  - Any edge with **more than 15% margin** → subject is too small, wallpaper margin (the original failure that caused FillFrame to exist)
- The prompt MUST request: "the subject fills most of the frame with a small comfortable margin around all four edges — roughly 8% breathing room on top, bottom, left, and right"
- Models routinely produce one of the two failure modes (zero margin OR wallpaper margin). The pipeline corrects both via FillFrame.ts (refills wallpaper) + a post-pad step (adds breathing room).
- MINIMALIST means few elements, NOT small elements lost in empty space.

COLOR — CHARCOAL DOMINANT, COLORS AS ACCENTS ONLY:
- CHARCOAL AND GRAY DOMINANT — 70-80% of image
- Colors INTEGRATED INTO forms — not splattered or applied on top
- Colors are the ESSENCE of elements (purple = cold capital, sienna = human warmth)
- Every bit of color belongs to a form — no random color floating in space

DO NOT include any signature text in the prompt — AI models hallucinate garbled text instead of clean signatures. The KAI signature will be added programmatically in the Optimize step using ImageMagick.
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

### 🚨 Model-Specific Prompt Construction (CONTENT-LED, BOTH MODELS)

**The two production models reason about prompts very differently. Generic visual-spec prompts waste OpenAI's reasoning capability and starve Google's compositional fidelity. Both models need the CONTENT'S LOGIC up front — not just adjectives.**

**🚨 GPT-IMAGE-1 IS DEPRECATED** (per OpenAI docs) — DO NOT USE. The current OpenAI image model is `gpt-image-2` (released Apr 21, 2026 — currently #1 on Artificial Analysis Image Arena, Elo 1331). Fallback to `gpt-image-2.5` (Dec 16, 2025) only if `gpt-image-2` is unavailable. Always pass `--model gpt-image-2`.

OpenAI's `gpt-image-2` is an autoregressive multimodal model with native "thinking mode" reasoning. Image tokens flow through the same transformer as text tokens, which is what gives it instruction-following depth. **But it has documented quirks** that the prompt must address explicitly:
- **Warm-color bias** — over-weights amber/sienna, under-delivers purple/cool tones unless explicitly constrained
- **Photoreal/digital-clean default** — needs explicit "no photorealism, no digital cleanness, hand-drawn" suppression to get editorial sketch register
- **Avoids named artists in canonical examples** — Lebbeus Woods / Paul Rudolph references work less reliably than on Google; lean on **descriptive structural language** ("dense gestural overlapping charcoal strokes, hatched cross-section, architectural concept-sketch quality") as primary, named-artist as secondary
- **No negative-prompt parameter** — encode all "do not"s as inline constraints
- Prefers structured-but-flexible prompts in the order: **background/scene → subject → key details → constraints → intended use**
- Optimal length: under ~500 words, hard ceiling 32k chars
- Supports `background: transparent` natively via API (`--transparent` flag)
- Supports `--quality low|medium|high` (default high)

Google's `nano-banana-pro` (Gemini 3 Pro Image) is more visually-anchored — it executes composition and style with high fidelity, but it produces stronger results when the composition is grounded in WHY the scene exists, not just WHAT objects to draw. Lead with composition, but include the thesis as context so the model treats the elements as load-bearing instead of decorative.

**Both prompts MUST include three blocks, in this order:**

1. **Thesis brief** — 2–4 sentences distilling the essay: the argument, the tension, what the reader should feel, and what a stranger should intuit from the image alone.
2. **Visual brief** — the composition / subject / palette / style. Strict edge-to-edge composition rules from `Step 4: Design Composition`.
3. **Anti-pattern list** — what to avoid (literal corporate clichés if it's a workplace essay, digital-vector look, text/logos/watermarks, blank margins).

**Two prompt shapes — pick by model:**

#### OpenAI gpt-image-2 — REASONING-LED (thesis is the spine)

```
You are illustrating the header for an editorial essay titled "[TITLE]".
[2–4 sentence thesis brief: argument, tension, emotional register, what the
reader-as-stranger should intuit from the image alone.]

Render as a single hand-drawn editorial illustration filling the entire
square frame edge-to-edge with NO blank margins. [Style notes: charcoal,
warm sepia, painterly gestural texture, New Yorker / Atlantic polish.]
[Composition: dominant subject, supporting elements, what touches which
edge.] The visual must carry the thesis — anyone seeing this image without
reading the essay should intuit the argument.

Avoid: [literal cliché list — e.g. laptops, suits, office buildings if it's
a workplace essay], digital vector look, text, labels, signatures,
watermarks. Palette: warm sepia + charcoal with single accent of soft
amber light. Background: warm sepia paper that blends seamlessly into a
cream blog page.
```

#### Google nano-banana-pro — COMPOSITION-LED (thesis is the load-bearing context)

```
Editorial illustration filling the entire square frame edge-to-edge,
NO blank margins. The image illustrates a New Yorker-style essay about
[topic in one phrase]: [2–3 sentence thesis brief — what the essay argues,
what the reader should feel].

Composition: [dominant subject described concretely with placement, scale,
linework]. [Supporting elements with placement and edge-coverage].
Strict composition: [what occupies what % of canvas, what touches which
edges, ZERO blank space]. Style: bold charcoal and warm sepia ink,
hand-drawn gestural strokes with hatching for depth, painterly New Yorker
editorial polish. NOT digital, NOT vector. Palette: charcoal, warm sepia,
single soft amber accent.

No text, no labels, no signatures, no watermarks, no borders. Background:
seamless warm sepia paper that blends into a cream blog page.
```

### 🚨 DEFAULT FOR BLOG HEADERS: MULTI-CANDIDATE FROM BOTH MODELS, AUTO-SELECT

**Single-generation is NOT the default for blog header essays.** Single-shot generation is acceptable for low-stakes diagrams, schematics, or technical illustrations where the visual answer is mechanical. Editorial essay headers are not those — they are creative judgment calls where one model's interpretation routinely beats the other and you cannot predict which in advance.

**Default protocol for any blog header (Essay workflow): generate N candidates from BOTH models in parallel, then auto-select via the Concept Fidelity Gate (Step 8).**

- **N defaults to 4 total** (2 OpenAI gpt-image-2 + 2 Google nano-banana-pro), each with a distinct compositional angle on the same thesis brief.
- **Bump to 6 (3+3) or 8 (4+4)** when the thesis is multi-part, the metaphor is non-obvious, or the previous round failed the gate.
- **Spawn all candidates as parallel background jobs** (`run_in_background: true`) — the wall-clock cost of 4 parallel is roughly the same as 1 sequential.
- **All outputs go to `~/Downloads/`** with descriptive suffixes (`{slug}-candidate-{n}-{model}-{angle}.png`).
- **Then run the Concept Fidelity Gate (Step 8)** on each. Score every candidate against the thesis brief. Auto-select the highest-fidelity winner.
- **The winner moves through optimize → mv → git add. Losers stay in `~/Downloads/` as disposable.**

**Why this is the default, not an option:**

- The two models have orthogonal strengths and orthogonal failure modes. Generating from only one model leaves 50%+ of the option space unexplored on every run.
- Concept fidelity scoring against a written thesis is fast (you Read each image and check 4 questions). It costs less than re-spending an entire turn after the principal rejects a single image.
- the principal has explicitly directed this pattern: *"I want you to change the workflow so that it makes n number of options with both Nano Banana and OpenAI and selects the best."* This is not negotiable for blog headers.

**When to break the default and generate single-model:**

- the principal explicitly names a model (e.g. *"use Nano Banana Pro for this one"*) — honor the directive.
- The previous round selected a clear leader and the principal is asking for a tight variation on it.
- The image type is not editorial (diagram, schematic, dashboard, technical illustration).
- Total candidate count from prior rounds in this same task already exceeds 8 — you're approaching the 4-turn cap; don't burn more compute, surface to the principal instead.

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

### 🚨 CRITICAL: Always Output to Downloads First — `~/Downloads/` IS THE WORKING DIRECTORY

**`~/Downloads/` is the canonical working directory for ALL Art-skill image generation. EVERY `--output` path MUST start with `~/Downloads/`. ZERO exceptions.**

This applies to:
- Single-shot generations (`--output ~/Downloads/{name}.png`)
- Multi-candidate comparisons across models (`--output ~/Downloads/{name}-candidate-{n}-{model}.png`)
- Thumbnail generation (`--thumbnail` flag — both `.png` and `-thumb.png` land in `~/Downloads/`)
- Background-removal intermediates
- Optimization intermediates (`cwebp` / `magick` outputs while iterating)

**NEVER point `--output` directly at `~/LocalProjects/Website/cms/public/images/`, the public/ tree of any project, or any git-tracked path.** Doing so bypasses the visual inspection gate and risks staging a bad image into git before any human or AI has actually seen it.

The strict pipeline:

```bash
# 1. GENERATE → ALWAYS to ~/Downloads/
bun run ~/.claude/skills/Art/Tools/Generate.ts \
  --model nano-banana-pro \
  --prompt "[YOUR PROMPT]" \
  --size 2K \
  --aspect-ratio 1:1 \
  --thumbnail \
  --output ~/Downloads/[descriptive-name].png

# 2. INSPECT → MANDATORY visual gate via the Read tool
#    (see Step 8 — you literally cannot validate the image without this)
#    Read("~/Downloads/[descriptive-name].png")
#    nano-banana-pro often returns JPEG even for --output .png:
#    Read("~/Downloads/[descriptive-name].jpg")

# 3. OPTIMIZE → still in ~/Downloads/
cwebp -q 78 ~/Downloads/[name].png -o ~/Downloads/[name].webp
magick ~/Downloads/[name].png -resize 512x512 -colors 128 ~/Downloads/[name]-thumb.png

# 4. MOVE → only after visual gate passes, only the chosen winner
mv ~/Downloads/[name].{png,webp,thumb.png} ~/LocalProjects/Website/cms/public/images/

# 5. STAGE → git add the moved files
cd ~/LocalProjects/Website && git add cms/public/images/[name].*
```

**If you generate multiple candidates for comparison, all of them stay in `~/Downloads/`. Only the winner moves through steps 4–5. The losers stay in `~/Downloads/` (they're disposable; the principal's Downloads folder is the staging area, not a permanent archive).**

### Construct Command Based on Intent

Based on user's request and the mapping tables above, construct the CLI command:

```bash
bun run ~/.claude/skills/Art/Tools/Generate.ts \
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
# Example: Generates both my-header.png AND my-header-thumb.png in ~/Downloads/
# 🚨 --output MUST point to ~/Downloads/ — NEVER directly into cms/public/images/
bun run ~/.claude/skills/Art/Tools/Generate.ts \
  --model nano-banana-pro \
  --prompt "[YOUR PROMPT]" \
  --size 2K \
  --aspect-ratio 1:1 \
  --thumbnail \
  --output ~/Downloads/my-header.png

# After visual inspection passes (Step 8), move into the website tree:
mv ~/Downloads/my-header.png ~/Downloads/my-header-thumb.png \
   ~/LocalProjects/Website/cms/public/images/
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
bun ~/.claude/PAI/TOOLS/RemoveBg.ts /path/to/output.png

# Or batch process multiple images
bun ~/.claude/PAI/TOOLS/RemoveBg.ts image1.png image2.png image3.png
```

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
| **gpt-image-2** | `--model gpt-image-2 --size 1024x1024 --remove-bg` | Different interpretation |

### Immediately Open

```bash
open /path/to/output.png
```

---

## Step 7: Optimize Images (MANDATORY)

**🚨 CRITICAL: This step happens AFTER generation and background removal, BEFORE validation.**

### 🚨🚨🚨 STEP 7.0 — MANDATORY FILLFRAME + PADDING PASS (deterministic margin enforcement)

**Before any other optimization, EVERY image generated by this workflow MUST pass through this two-stage margin pipeline.** Models produce one of two failure modes — wallpaper margin (subject lost in empty space) OR zero margin (subject butting against the edges and looking visually clipped). The pipeline corrects both:

```bash
# Stage A — FillFrame.ts: detect subject bbox, crop to it, refill the canvas so subject dominates.
# Eliminates wallpaper-margin failures.
bun ~/.claude/skills/Art/Tools/FillFrame.ts \
  ~/Downloads/[name].png \
  ~/Downloads/[name]-filled.png \
  --target-size 1024 \
  --bg-color auto \
  --max-margin 5

# Stage B — Add deterministic 8% breathing margin so subject doesn't butt against the canvas
# edges. This is the critical fix for the 2026-04-27 "flat against the side" failure.
# 8% padding on a 1024 canvas = 82px breathing room each side, then resized back to 1024.
magick ~/Downloads/[name]-filled.png -bordercolor none -border 8%x8% \
  -resize 1024x1024 \
  ~/Downloads/[name]-padded.png

# Verify final visible margin band (should be 7–12% on each edge)
bun ~/.claude/skills/Art/Tools/FillFrame.ts \
  ~/Downloads/[name]-padded.png \
  ~/Downloads/[name]-padded.png \
  --report-only \
  --max-margin 12 \
  --bg-color auto

# If Stage A exit code is non-zero (margins still > 5% after refill), REGENERATE with a
# stronger composition prompt — do NOT ship a wallpaper-margin image.
# If Stage B verify reports any edge margin < 5% or > 12%, adjust the --border percentage.

mv ~/Downloads/[name]-padded.png ~/Downloads/[name].png
```

**Skip conditions: NONE.** Both stages run on every Essay-workflow image, every time. Stage A cost ~200ms, Stage B ~100ms. The cost of skipping is shipping either wallpaper-margin garbage (Stage A skip) or edge-clipped subject (Stage B skip). Both have happened in production; both are documented failures.

### Why This Step Matters

Generated images at 2K resolution (2048x2048) are 6-8MB each - far too large for web use. Optimization reduces file sizes by 90-95% while maintaining visual quality, ensuring fast page loads and better user experience.

### Optimization Process

**For ALL blog header images, automatically execute these commands:**

```bash
# 0. 🚨 MANDATORY: Stamp KAI signature programmatically
# AI models CANNOT reliably render text — they hallucinate garbled signatures.
# This step is NOT optional. Every image MUST be signed "KAI".
magick "~/Downloads/[name].jpg" -gravity SouthEast -font "Bradley-Hand-Bold" -pointsize 50 -fill "rgba(200,200,200,0.5)" -annotate +35+25 "" "~/Downloads/[name].jpg"
# Also stamp the thumbnail version (use darker text for sepia bg)
magick "~/Downloads/[name]-thumb.png" -gravity SouthEast -font "Bradley-Hand-Bold" -pointsize 50 -fill "rgba(80,60,40,0.5)" -annotate +35+25 "" "~/Downloads/[name]-thumb.png"

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

**🚨🚨🚨 AI INSPECTION GATE — MANDATORY 🚨🚨🚨**

`open` launches the macOS Preview app on the principal's machine. **You cannot see what `open` shows.** That is a verification for the principal, not for you. To verify the image yourself you MUST load it into your own context with the Read tool:

```
Read("/path/to/generated-image.png")
# OR for the JPEG fallback when nano-banana-pro returns JPEG:
Read("/path/to/generated-image.jpg")
```

The Read tool renders the image inline and gives you actual vision of the pixels. Without this, the rest of this checklist is theatre — you will rubber-stamp a broken image because you literally cannot see it.

**Hard rule: if you have not called `Read` on the image file in this turn, you have not inspected the image. Do not proceed to the checklist. Do not write the post. Do not say "looks good." Call Read first.**

Optionally also run `open` for the principal:

```bash
open /path/to/generated-image.png
```

### 🚨🚨🚨 CONCEPT FIDELITY GATE (MANDATORY — RUN BEFORE THE CHECKLIST) 🚨🚨🚨

**The image must carry the CONTENT'S argument, not just look pretty. Reading the image alone, a stranger should be able to intuit what the essay is about. If they can't, the image fails — regardless of how editorial or polished it looks.**

This is the gate that catches "beautiful but wrong" images — where every visual checkbox passes but the picture doesn't actually argue the essay. It runs BEFORE the technical checklist and BEFORE the composition checklist.

**Procedure:**

1. **Re-read the thesis brief** you used in Step 5 (the 2–4 sentences you fed both models). Hold it in mind.
2. **Read the image** with the Read tool — actually load the pixels into your context, not just `open` it.
3. **Answer 4 questions in writing** for each candidate (and for the chosen winner before shipping):

| # | Question | Pass criterion |
|---|----------|----------------|
| 1 | What argument does this image make? | The argument should match the essay's thesis. If the image argues something else (or nothing), FAIL. |
| 2 | What would a stranger who hasn't read the essay intuit from this image alone? | The intuition should be in the same direction as the thesis. "I have no idea" or "the opposite" = FAIL. |
| 3 | Which specific concepts from the thesis brief appear in the image? Which are missing? | Score concept-by-concept. If a load-bearing concept is missing (e.g., the corporate agent in a layoff piece, the augmentation in a productivity piece), FAIL — even if other concepts are present. |
| 4 | Is the emotional register in the image the register the essay needs? | Doomy when the essay is empowering = FAIL. Triumphant when the essay is diagnostic = FAIL. The image's mood and the essay's mood must align. |

4. **If candidates A/B/C/D all fail** → do not ship the best of a bad lot. Regenerate with sharpened prompts that name the missing concept explicitly (e.g., "the visual MUST include a faded representation of the corporate agent doing the shedding"). The most common failure is the prompt not naming the load-bearing concept; the second most common is the model latching onto a visually pretty but argument-irrelevant element (a flame, a mountain, a brain).

**🚨 4-TURN ITERATION CAP — HARD STOP**

If 4 generation rounds (≈4 candidates × 4 rounds = up to 16 images) still haven't produced a candidate that clears the Concept Fidelity Gate, **STOP**. Do not keep grinding. Surface the situation to the principal:

- What thesis brief you've been using
- The 4 prompts you tried, with the failure mode of each round
- Which concepts kept failing to land
- A proposed pivot: different thesis brief? different model? different metaphor entirely? skip the image and use the UL sepia logo default?

The cap exists because compute spent on 16+ failed generations is compute that should have been a 5-minute conversation about whether the visual brief is actually achievable. After 4 rounds of failure, the prompt isn't the problem — the brief is.

---

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
- [ ] **FULL FRAME** — verified by FillFrame.ts exit-code-0 in Step 7.0 (NOT a manual eyeball check)
- [ ] **SUBJECTS LARGE** — dominant, filling the available space
- [ ] **NO BACKGROUND FILL** — floats in empty/transparent space (but subjects are LARGE)
- [ ] **KAI SIGNATURE** — small cursive charcoal in BOTTOM RIGHT CORNER
- [ ] **MARGIN CHECK** — FillFrame.ts hard-gate in Step 7.0 must have passed (max-margin ≤ 5%). If it failed, you should have already regenerated, not reached this checklist.

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
3. EMOTION → Match to register in ~/.claude/PAI/aesthetic.md
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
