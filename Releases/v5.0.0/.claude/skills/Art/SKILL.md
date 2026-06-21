---
name: Art
description: "Generates static visual content across 20+ formats via Flux, Nano Banana Pro (Gemini 3 Pro), and GPT-Image-1. Covers blog header illustrations, editorial art, Mermaid flowcharts, technical architecture diagrams, D3.js dashboards, taxonomies, timelines, 2x2 framework matrices, comparisons, annotated screenshots, recipe cards, aphorism/quote cards, conceptual maps, stat cards, comic panels, YouTube thumbnails, PAI pack icons, and brand-logo wallpapers. Named workflows: Essay, D3Dashboards, Visualize, Mermaid, TechnicalDiagrams, Taxonomies, Timelines, Frameworks, Comparisons, AnnotatedScreenshots, RecipeCards, Aphorisms, Maps, Stats, Comics, YouTubeThumbnailChecklist, AdHocYouTubeThumbnail, CreatePAIPackIcon, LogoWallpaper, RemoveBackground. SKILLCUSTOMIZATIONS loads PREFERENCES.md, CharacterSpecs.md, and SceneConstruction.md. --remove-bg flag produces transparent-background PNG (can produce black backgrounds — verify visually). Up to 14 reference images per request (5 human, 6 object Gemini API limit). Output staged to ~/Downloads/ for preview before any project directory copy. Nano Banana Pro uses --size for resolution tier 1K/2K/4K and separate --aspect-ratio. USE WHEN: art, illustration, diagram, flowchart, infographic, header image, thumbnail, visualize, generate image, mermaid, architecture diagram, comic, icon, blog art, framework diagram, D3 chart, remove background, wallpaper. NOT FOR video or animation (use Remotion). NOT FOR the user's personal portrait/headshot (use a dedicated headshot skill)."
effort: medium
---

# Art Skill

Complete visual content system for creating illustrations, diagrams, and visual content.

## Customization

**Before executing, check for user customizations at:**
`~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/Art/`

If this directory exists, load and apply:
- `PREFERENCES.md` - Aesthetic preferences, default model, output location
- `CharacterSpecs.md` - Character design specifications
- `SceneConstruction.md` - Scene composition guidelines

These override default behavior. If the directory does not exist, proceed with skill defaults.

## 🚨🚨🚨 CONSTITUTIONAL: ALWAYS RUN A NAMED WORKFLOW. NEVER FREEFORM. 🚨🚨🚨

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  EVERY image generation MUST run through a named workflow       ⚠️
⚠️  in this skill's Workflows/ directory.                          ⚠️
⚠️  NEVER call Tools/Generate.ts with a hand-written prompt        ⚠️
⚠️  outside the workflow template — the workflows encode the       ⚠️
⚠️  quality standards (TECHNIQUE, palette, composition rules,      ⚠️
⚠️  problem-type metaphor, CSE-24 narrative arc) that the models   ⚠️
⚠️  consistently fail to honor without them.                       ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Freeform-prompting Generate.ts directly is FORBIDDEN.** It is the documented root cause of every "looks like shit" rejection in the rating history. The Essay / Frameworks / Maps / Comics / etc. workflows exist because the bare model defaults to illustrative-school cartoons; the workflow templates discipline it back to the editorial Lebbeus Woods / Paul Rudolph / charcoal-architectural register the principal actually wants.

**Routing rules — pick a workflow FIRST, before writing any prompt:**

| Request shape | Required workflow |
|---------------|-------------------|
| Blog header / editorial essay illustration | **`Workflows/Essay.md`** — Steps 1–8 in order, no skipping |
| Mermaid diagram | `Workflows/Mermaid.md` |
| Technical / architecture diagram | `Workflows/TechnicalDiagrams.md` |
| Framework / 2x2 / matrix | `Workflows/Frameworks.md` |
| D3 dashboard / chart | `Workflows/D3Dashboards.md` |
| Taxonomy / hierarchy | `Workflows/Taxonomies.md` |
| Timeline | `Workflows/Timelines.md` |
| Comparison | `Workflows/Comparisons.md` |
| Stat card | `Workflows/Stats.md` |
| Aphorism / quote card | `Workflows/Aphorisms.md` |
| Comic panel | `Workflows/Comics.md` |
| YouTube thumbnail | `Workflows/AdHocYouTubeThumbnail.md` or `Workflows/YouTubeThumbnailChecklist.md` |
| PAI pack icon | `Workflows/CreatePAIPackIcon.md` |
| brand-logo wallpaper | `Workflows/LogoWallpaper.md` |
| Recipe card | `Workflows/RecipeCards.md` |
| Map / conceptual map | `Workflows/Maps.md` |
| Annotated screenshot | `Workflows/AnnotatedScreenshots.md` |
| Background removal only | `Workflows/RemoveBackground.md` |
| Embossed logo wallpaper | `Workflows/EmbossedLogoWallpaper.md` |
| Generic visualization (none of the above fit) | `Workflows/Visualize.md` |

**The ONLY exception:** the user explicitly says "freeform" / "skip the workflow" / "just run Generate.ts directly with this prompt: ...". Without that explicit instruction, ALWAYS pick the matching workflow and execute its mandatory steps in order — including the prompt template, the technique block, the palette, the composition rules, and the validation gate.

If no workflow matches the request, **stop and surface to the user** before generating — propose either (a) the closest existing workflow, (b) using `Visualize.md` as the generic catch-all, or (c) creating a new workflow first via the `CreateSkill` skill. Do not improvise.

---

## 🚨🚨🚨 MANDATORY: Output to Downloads First 🚨🚨🚨

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  ALL GENERATED IMAGES GO TO ~/Downloads/ FIRST                   ⚠️
⚠️  NEVER output directly to project directories                    ⚠️
⚠️  User MUST preview in Finder/Preview before use                  ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**This applies to ALL workflows in this skill.**

## 🚨🚨🚨 MANDATORY: Transparency Rules for Blog Headers 🚨🚨🚨

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  INLINE (body) image → TRANSPARENT (PNG with alpha)           ⚠️
⚠️  SOCIAL THUMBNAIL (frontmatter) → SEPIA #EAE9DF (opaque)       ⚠️
⚠️  EVERY blog header MUST use --thumbnail (produces both)        ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

The blog page background is sepia #EAE9DF. Inline images MUST be transparent PNG so they composite cleanly over the page. Social platforms (X, LinkedIn, RSS readers) do NOT honor transparency — they show white/black bleed-through — so the `thumbnail:` frontmatter MUST point to the sepia-backed version.

**Enforcement when calling `Generate.ts`:**
- `--thumbnail` is the ONLY correct flag for blog headers — it implicitly enables `--remove-bg` and produces BOTH `output.png` (transparent) AND `output-thumb.png` (#EAE9DF background).
- Background removal runs locally via `rembg` (no external API). If the model returns JPEG (Nano Banana Pro often does), `Generate.ts` automatically renames the output from `.jpg` → `.png` after rembg processing so the final transparent file is a real PNG with a real alpha channel. If you ever see a `.jpg` labeled "transparent", that is NOT transparent.
- If `rembg` isn't installed at `~/.local/bin/rembg`, the tool fails loudly with install instructions rather than silently producing an opaque image. Install: `pipx install rembg` (or set `REMBG_BIN` env var to override the path).

**Verification step before declaring an image done (REQUIRED):**
1. `file ~/Downloads/[name].png` → must report `PNG image data, ... RGBA` (8-bit/color RGBA). If it says `JPEG` or `8-bit colormap` without alpha, transparency failed.
2. `file ~/Downloads/[name]-thumb.png` → must report `PNG image data`. The thumb is intentionally opaque with sepia background.
3. Only after both pass: copy to the project directory and wire into the post.

**Wiring into the blog post:**
- Body inline: `[![Alt](/images/blog/[slug]/header.webp)](/images/blog/[slug]/header.webp)` — use the transparent WebP converted from the `.png`.
- Frontmatter: `thumbnail: https://example.com/images/blog/[slug]/header-thumb.png` — always the `-thumb.png` (opaque sepia).

Never reuse the opaque thumbnail for the inline slot. Never reuse the transparent file for the social thumbnail. These are two distinct outputs from one `--thumbnail` run.

## Workflow Routing

Route to the appropriate workflow based on the request.

  - Remove background from image → `Workflows/RemoveBackground.md`
  - brand-logo wallpaper with logo integration → `Workflows/LogoWallpaper.md`
  - YouTube thumbnail checklist → `Workflows/YouTubeThumbnailChecklist.md`
  - Blog header or editorial illustration → `Workflows/Essay.md`
  - D3.js interactive chart or dashboard → `Workflows/D3Dashboards.md`
  - Visualization or unsure which format → `Workflows/Visualize.md`
  - Mermaid flowchart or sequence diagram → `Workflows/Mermaid.md`
  - Technical or architecture diagram → `Workflows/TechnicalDiagrams.md`
  - Taxonomy or classification grid → `Workflows/Taxonomies.md`
  - Timeline or chronological progression → `Workflows/Timelines.md`
  - Framework or 2x2 matrix → `Workflows/Frameworks.md`
  - Comparison or X vs Y → `Workflows/Comparisons.md`
  - Annotated screenshot → `Workflows/AnnotatedScreenshots.md`
  - Recipe card or step-by-step → `Workflows/RecipeCards.md`
  - Aphorism or quote card → `Workflows/Aphorisms.md`
  - Conceptual map or territory → `Workflows/Maps.md`
  - Stat card or big number visual → `Workflows/Stats.md`
  - Comic or sequential panels → `Workflows/Comics.md`
  - YouTube thumbnail (with existing assets) → `Workflows/YouTubeThumbnailChecklist.md`
  - Ad-hoc YouTube thumbnail (generate from content) → `Workflows/AdHocYouTubeThumbnail.md`
  - PAI pack icon → `Workflows/CreatePAIPackIcon.md`

---

## Core Aesthetic

**Default:** Production-quality concept art style appropriate for editorial and technical content.

**User customization** defines specific aesthetic preferences including:
- Visual style and influences
- Line treatment and rendering approach
- Color palette and wash technique
- Character design specifications
- Scene composition rules

**Load from:** `~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/Art/PREFERENCES.md`

---

## Reference Images

**User customization** may include reference images for consistent style.

Check `~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/Art/PREFERENCES.md` for:
- Reference image locations
- Style examples by use case
- Character and scene reference guidance

**Usage:** Before generating images, load relevant user-provided references to match their preferred style.

---

## Image Generation

**Default model:** Check user customization at `SKILLCUSTOMIZATIONS/Art/PREFERENCES.md`
**Fallback:** nano-banana-pro (Gemini 3 Pro)

### Model-Specific Size Requirements

Each model accepts different `--size` formats. Using the wrong format causes validation errors.

| Model | `--size` format | Valid values | Default |
|-------|----------------|--------------|---------|
| `flux` | Aspect ratio | `1:1`, `16:9`, `3:2`, `2:3`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `21:9` | `16:9` |
| `nano-banana` | Aspect ratio | `1:1`, `16:9`, `3:2`, `2:3`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `21:9` | `16:9` |
| `nano-banana-pro` | Resolution tier | `1K`, `2K`, `4K` (also accepts `--aspect-ratio` separately) | `2K` |
| `gpt-image-2` (current) / `gpt-image-1.5` (fallback) | Pixel dimensions | `1024x1024`, `1536x1024`, `1024x1536`, `2048x2048`, `auto` | NOTE: `gpt-image-1` is **deprecated** per OpenAI docs — do not use. | `1024x1024` |

**Note:** `nano-banana-pro` uses `--size` for resolution quality and a separate `--aspect-ratio` flag for aspect ratio (defaults to `16:9`).

### 🚨 CRITICAL: Always Output to Downloads First

**ALL generated images MUST go to `~/Downloads/` first for preview and selection.**

Never output directly to a project's `public/images/` directory. User needs to review images in Preview before they're used.

**Workflow:**
1. Generate to `~/Downloads/[descriptive-name].png`
2. User reviews in Preview
3. If approved, THEN copy to final destination (e.g., `cms/public/images/`)
4. Create WebP and thumbnail versions at final destination

```bash
# CORRECT - Output to Downloads for preview
bun run ${CLAUDE_SKILL_DIR}/Tools/Generate.ts \
  --model nano-banana-pro \
  --prompt "[PROMPT]" \
  --size 2K \
  --aspect-ratio 1:1 \
  --thumbnail \
  --output ~/Downloads/blog-header-concept.png

# After approval, copy to final location
cp ~/Downloads/blog-header-concept.png ~/LocalProjects/Website/cms/public/images/
cp ~/Downloads/blog-header-concept-thumb.png ~/LocalProjects/Website/cms/public/images/
```

### Multiple Reference Images (Character/Style Consistency)

For improved character or style consistency, use multiple `--reference-image` flags:

```bash
# Multiple reference images for better likeness
bun run ${CLAUDE_SKILL_DIR}/Tools/Generate.ts \
  --model nano-banana-pro \
  --prompt "Person from references at a party..." \
  --reference-image face1.jpg \
  --reference-image face2.jpg \
  --reference-image face3.jpg \
  --size 2K \
  --aspect-ratio 16:9 \
  --output ~/Downloads/character-scene.png
```

**API Limits (Gemini):**
- Up to 5 human reference images
- Up to 6 object reference images
- Maximum 14 total reference images per request

**API keys in:** `${PAI_DIR}/.env`

## Examples

**Example 1: Blog header image**
```
User: "create a header for my AI agents post"
→ Invokes ESSAY workflow
→ Generates charcoal sketch prompt
→ Creates image with architectural aesthetic
→ Saves to ~/Downloads/ for preview
→ After approval, copies to public/images/
```

**Example 2: Technical architecture diagram**
```
User: "make a diagram showing the SPQA pattern"
→ Invokes TECHNICALDIAGRAMS workflow
→ Creates structured architecture visual
→ Outputs PNG with consistent styling
```

**Example 3: Comparison visualization**
```
User: "visualize humans vs AI decision-making"
→ Invokes COMPARISONS workflow
→ Creates side-by-side visual
→ Charcoal sketch with labeled elements
```

**Example 4: PAI pack icon**
```
User: "create icon for the skill system pack"
→ Invokes CREATEPAIPACKICON workflow
→ Reads workflow from Workflows/CreatePAIPackIcon.md
→ Generates 1K image with --remove-bg for transparency
→ Resizes to 256x256 RGBA PNG
→ Outputs to ~/Downloads/ for preview
→ After approval, copies to ${PROJECTS_DIR}/PAI/Packs/icons/
```

## Gotchas

- **Always output to ~/Downloads/ first — NEVER directly to project directories.** User must preview before use. Multiple past failures from pushing wrong images directly to repos.
- **Verify image dimensions match target use case before claiming done.** Social media previews, blog headers, and thumbnails have different size requirements. A header that works on the blog may break OG/social previews.
- **nano-banana-pro uses `--size` for resolution (1K/2K/4K) and SEPARATE `--aspect-ratio` flag.** Don't pass aspect ratio values to `--size`.
- **Reference images: max 5 human, 6 object, 14 total per request** (Gemini API limit).
- **After generating, use Read tool to visually confirm the image before reporting success.** "Generated successfully" means nothing if you haven't looked at it.
- **When asked to use a specific image URL or file, use EXACTLY that asset.** Don't substitute similar images. Past rating-1 failures from using wrong image assets.
- **`--remove-bg` may produce black backgrounds instead of transparency.** Always verify transparent PNG output visually before deploying.

## Execution Log

After completing any workflow, append a single JSONL entry:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"Art","workflow":"WORKFLOW_USED","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> ~/.claude/PAI/MEMORY/SKILLS/execution.jsonl
```

Replace `WORKFLOW_USED` with the workflow executed, `8_WORD_SUMMARY` with a brief input description, and `SECONDS` with approximate wall-clock time. Log `status: "error"` if the workflow failed.
