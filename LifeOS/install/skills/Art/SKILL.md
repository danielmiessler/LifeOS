---
name: Art
version: 1.5.8
description: "Static visual content across 20+ formats — diagrams, mermaid, infographics, D3 dashboards, comics, icons, wallpaper — via Flux, Nano Banana Pro, and GPT-Image-2. USE WHEN art, illustration, diagram, flowchart, infographic, header image, blog social thumbnail, visualize, generate image, mermaid, architecture diagram, comic, icon, blog art, framework diagram, D3 chart, remove background, wallpaper. NOT FOR locked house-style YouTube/channel/video thumbnails (use _THUMBNAIL — it orchestrates Art's Generate/PickExpression/ThumbnailText tools), video or animation (use Remotion), or web UI design and integrated frontend layout (use Webdesign)."
effort: medium
---

# Art Skill

## Customization

**Before executing, check for user customizations at:**
`~/.claude/LIFEOS/USER/CUSTOMIZATIONS/SKILLS/Art/`

If this directory exists, load and apply:
- `PREFERENCES.md` - Aesthetic preferences, default model, output location
- `CharacterSpecs.md` - Character design specifications
- `SceneConstruction.md` - Scene composition guidelines

These override default behavior. If the directory does not exist, proceed with skill defaults.


## 🚨 MANDATORY: Voice Notification (REQUIRED BEFORE ANY ACTION)

**You MUST send this notification BEFORE doing anything else when this skill is invoked.**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:31337/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the WORKFLOWNAME workflow in the Art skill to ACTION"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running the **WorkflowName** workflow in the **Art** skill to ACTION...
   ```

**This is not optional. Execute this curl command immediately upon skill invocation.**

## What It Does

Generates static visual content across 20+ formats — blog headers, technical and architecture diagrams, frameworks, taxonomies, timelines, comparisons, stat cards, comics, icons, wallpapers, D3 charts, Mermaid diagrams — using Flux, Nano Banana Pro (Gemini 3 Pro), and GPT-Image-2. Every request routes through a named workflow that encodes the technique and palette, output stages to $LIFEOS_DOWNLOADS_DIR (default ~/Downloads/ when unset) for review first, and blog headers ship both a transparent inline version and an opaque social thumbnail.

## The Problem

The bare image model produces inconsistent, off-style output when handed a freeform prompt — one session shipped 12 rejected diagrams because the prompt skipped the workflow that holds the composition rules. Different formats need different models (text-heavy cards want GPT-Image-2; editorial headers want Nano Banana Pro), different size formats, and different transparency handling. Without a fixed routing-and-staging discipline, you get wrong sizes, opaque headers that bleed over the page background, and images pushed straight to a repo before anyone looked at them. This skill makes the workflow, the model choice, and the Downloads-first review mandatory in code, not just in markdown.

## How It Works

A complete visual content system for illustrations, diagrams, and other static visuals. Each request picks a matching workflow file first, follows its prompt template, then calls `Generate.ts` with `--workflow=<name>` plus model/size/output flags. Two layers enforce that the workflow was followed (`Generate.ts` itself and the `ArtWorkflowGuard.hook.ts` PreToolUse hook), output always lands in $LIFEOS_DOWNLOADS_DIR (default ~/Downloads/ when unset) for preview, and blog headers run with `--thumbnail` to produce both the transparent PNG and the sepia-backed social thumbnail.

## 🛑 STRUCTURAL ENFORCEMENT — `--workflow=<name>` IS REQUIRED

**This rule used to be markdown-only and was silently ignored, producing 12 rejected diagrams in one session (incident 2026-04-30, see ISA `MEMORY/WORK/20260430-180000_art-skill-freeform-enforcement`). It now lives in code.**

Two layers enforce it:

1. **`Generate.ts` itself** refuses to run unless you pass `--workflow=<name>` (or the explicit `--freeform-confirmed` opt-out). It exits non-zero with the workflow lookup table.
2. **`ArtWorkflowGuard.hook.ts`** (PreToolUse Bash) blocks any Bash command containing `Art/Tools/Generate.ts` without `--workflow=` or `--freeform-confirmed`, with exit code 2 and the same lookup table.

**The flow that works:** read the matching workflow file → follow its prompt template → invoke `Generate.ts` with `--workflow=<that-workflow-name>` plus your model/prompt/size flags. The `--workflow=<name>` flag is your explicit assertion "I read the workflow and followed it."

**The flow that's blocked:** composing a freeform prompt and shipping it directly to `Generate.ts`. Both layers above will refuse.

### Most Common Failure Mode (don't repeat it)

Reading the workflow's caps-warning, mentally noting "do the workflow," then composing a Bash command with your own prompt anyway because it feels faster. **Stop.** The workflow templates encode the technique, palette, composition rules, and validation gate the bare model fails to honor. Skipping them produced — verbatim — "absolute fucking ass" diagrams. Read the workflow file FIRST. Compose the prompt FROM the template. Pass `--workflow=<name>` so the gate can see you did it.

### Workflow → command (copy-paste)

```bash
bun ~/.claude/skills/Art/Tools/Generate.ts \
  --workflow=<WorkflowName> \
  --model nano-banana-pro \
  --prompt "..." \
  --size 2K \
  --aspect-ratio 16:9 \
  --output "${LIFEOS_DOWNLOADS_DIR:-$HOME/Downloads}"/<filename>.png
```

`<WorkflowName>` MUST match a file under `Workflows/` (without `.md`):

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
| Locked house-style YouTube / channel thumbnail | **Use the `_THUMBNAIL` skill** — it owns the locked style and orchestrates the Art tools below. Don't drive these workflows directly for channel thumbnails. |
| YouTube thumbnail (generic mechanism, orchestrated by _THUMBNAIL) | **`Workflows/StyleMatchedThumbnail.md`** — deterministic text + real-photo face |
| YouTube thumbnail (legacy / validation) | `Workflows/AdHocYouTubeThumbnail.md` or `Workflows/YouTubeThumbnailChecklist.md` |
| LifeOS pack icon | `Workflows/CreateLifeosPackIcon.md` |
| brand-logo wallpaper | `Workflows/LogoWallpaper.md` |
| Recipe card | `Workflows/RecipeCards.md` |
| Map / conceptual map | `Workflows/Maps.md` |
| Annotated screenshot | `Workflows/AnnotatedScreenshots.md` |
| Background removal only | `Workflows/RemoveBackground.md` |
| Embossed logo wallpaper | `Workflows/EmbossedLogoWallpaper.md` |
| Generic visualization (none of the above fit) | `Workflows/Visualize.md` |

**The ONLY exception:** the user explicitly says "freeform" / "skip the workflow" / "just run Generate.ts directly with this prompt: ...". In that case, pass `--freeform-confirmed` to `Generate.ts` (which logs the explicit opt-out to stderr for audit). Without that explicit instruction from the user, ALWAYS pick the matching workflow and pass `--workflow=<name>` — both `Generate.ts` and `ArtWorkflowGuard.hook.ts` will refuse the call otherwise.

If no workflow matches the request, **stop and surface to the user** before generating — propose either (a) the closest existing workflow, (b) using `Visualize.md` as the generic catch-all, or (c) creating a new workflow first via the `CreateSkill` skill. Do not improvise.

---

## 🚨🚨🚨 MANDATORY: Output to Downloads First 🚨🚨🚨

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  ALL GENERATED IMAGES GO TO $LIFEOS_DOWNLOADS_DIR (default ~/Downloads/ when unset) FIRST                   ⚠️
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
1. `file "${LIFEOS_DOWNLOADS_DIR:-$HOME/Downloads}"/[name].png` → must report `PNG image data, ... RGBA` (8-bit/color RGBA). If it says `JPEG` or `8-bit colormap` without alpha, transparency failed.
2. `file "${LIFEOS_DOWNLOADS_DIR:-$HOME/Downloads}"/[name]-thumb.png` → must report `PNG image data`. The thumb is intentionally opaque with sepia background.
3. Only after both pass: copy to the project directory and wire into the post.

**Wiring into the blog post:**
- Body inline: `[![Alt](/images/blog/[slug]/header.webp)](/images/blog/[slug]/header.webp)` — use the transparent WebP converted from the `.png`.
- Frontmatter: `thumbnail: https://example.com/images/blog/[slug]/header-thumb.png` — always the `-thumb.png` (opaque sepia).

Never reuse the opaque thumbnail for the inline slot. Never reuse the transparent file for the social thumbnail. These are two distinct outputs from one `--thumbnail` run.

**Sanctioned exception (this section is the canonical home; _BLOGGING defers here):** transparent inline is the DEFAULT for every blog header. The one exception is thin-linework/charcoal pieces where rembg strips the artwork itself (see Gotchas) — those may ship an opaque sepia `#EAE9DF` inline image, which composites seamlessly on the matching page background. Opaque inline is a documented fallback for that failure mode, never a second default.


## Workflow Routing

Route to the appropriate workflow based on the request.

| Workflow | Trigger | File |
|----------|---------|------|
| Essay | Blog header or editorial illustration | `Workflows/Essay.md` |
| RemoveBackground | Remove background from image | `Workflows/RemoveBackground.md` |
| LogoWallpaper | brand-logo wallpaper with logo integration | `Workflows/LogoWallpaper.md` |
| EmbossedLogoWallpaper | Embossed logo wallpaper | `Workflows/EmbossedLogoWallpaper.md` |
| D3Dashboards | D3.js interactive chart or dashboard | `Workflows/D3Dashboards.md` |
| Visualize | Visualization or unsure which format | `Workflows/Visualize.md` |
| Mermaid | Mermaid flowchart or sequence diagram | `Workflows/Mermaid.md` |
| TechnicalDiagrams | Technical or architecture diagram | `Workflows/TechnicalDiagrams.md` |
| Taxonomies | Taxonomy or classification grid | `Workflows/Taxonomies.md` |
| Timelines | Timeline or chronological progression | `Workflows/Timelines.md` |
| Frameworks | Framework or 2x2 matrix | `Workflows/Frameworks.md` |
| Comparisons | Comparison or X vs Y | `Workflows/Comparisons.md` |
| AnnotatedScreenshots | Annotated screenshot | `Workflows/AnnotatedScreenshots.md` |
| RecipeCards | Recipe card or step-by-step | `Workflows/RecipeCards.md` |
| Aphorisms | Aphorism or quote card | `Workflows/Aphorisms.md` |
| Maps | Conceptual map or territory | `Workflows/Maps.md` |
| Stats | Stat card or big number visual | `Workflows/Stats.md` |
| Comics | Comic or sequential panels | `Workflows/Comics.md` |
| YouTubeThumbnailChecklist | YouTube thumbnail checklist; YouTube thumbnail (with existing assets) | `Workflows/YouTubeThumbnailChecklist.md` |
| AdHocYouTubeThumbnail | Ad-hoc YouTube thumbnail (generate from content) | `Workflows/AdHocYouTubeThumbnail.md` |
| CreateLifeosPackIcon | LifeOS pack icon | `Workflows/CreateLifeosPackIcon.md` |

---

## Core Aesthetic

**Default:** Production-quality concept art style appropriate for editorial and technical content.

**User customization** defines specific aesthetic preferences including:
- Visual style and influences
- Line treatment and rendering approach
- Color palette and wash technique
- Character design specifications
- Scene composition rules

**Load from:** `~/.claude/LIFEOS/USER/CUSTOMIZATIONS/SKILLS/Art/PREFERENCES.md`

---

## Reference Images

**User customization** may include reference images for consistent style.

Check `~/.claude/LIFEOS/USER/CUSTOMIZATIONS/SKILLS/Art/PREFERENCES.md` for:
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
| `gpt-image-2` | Pixel dimensions | `1024x1024`, `1536x1024`, `1024x1536`, `2048x2048`, `auto` (also accepts `--quality` low/medium/high/auto) | `1024x1024` |

**`gpt-image-1` is DEPRECATED** per OpenAI docs and is rejected by `Generate.ts` with a clear error message. There is no `gpt-image-1.5` or `gpt-image-2.5` — earlier versions of this skill referenced those as fallbacks; they do not exist. The OpenAI image lineup as of 2026-05-04 is exactly: `gpt-image-2` (current) and `gpt-image-1` (deprecated).

### Model Selection — when to pick which

Three first-class models are wired into `Generate.ts`. PREFERENCES.md (if present) pins the user's default; in absence of a pin, pick by job:

| Job | Recommended model | Why |
|-----|-------------------|-----|
| Editorial illustration / blog header (default) | `nano-banana-pro` | Best composition fidelity for the user's editorial aesthetic; PREFERENCES.md typically pins it. |
| Text-heavy work — stat cards, framework diagrams, taxonomies, timelines, aphorism cards | `gpt-image-2` | Currently #1 across all Image Arena leaderboards (Arena.ai, 2026-05-04) — text-to-image margin +242 Elo, single-image edit +125, multi-image edit +90. Strongest text rendering on the market right now. |
| Editorial / blog / essay header (the DEFAULT — competing head-to-head) | `compare` (runs both `gpt-image-2` + `nano-banana-pro` in parallel on the same brief) | The two flagship models compete to make the best image; pick the winner. This is the default for any editorial header — the models have orthogonal strengths, so generating from only one leaves half the option space unexplored. See `Workflows/Essay.md`. |
| Stylistic variety / non-photoreal / iteration speed | `flux` or `nano-banana` | Different aesthetic register; `flux` is crisper for technical illustration. |

Arena leaderboard sweeps measure aesthetic preference at scale, not editorial style fit. They are a strong quality signal, not a default-override; respect PREFERENCES.md when it exists.

**Note:** `nano-banana-pro` uses `--size` for resolution quality and a separate `--aspect-ratio` flag for aspect ratio (defaults to `16:9`).

### 🚨 CRITICAL: Always Output to Downloads First

**ALL generated images MUST go to `$LIFEOS_DOWNLOADS_DIR` (default `~/Downloads/` when unset) first for preview and selection.**

Never output directly to a project's `public/images/` directory. User needs to review images in Preview before they're used.

**Workflow:**
1. Generate to `$LIFEOS_DOWNLOADS_DIR/[descriptive-name].png`
2. User reviews in Preview
3. If approved, THEN copy to final destination (e.g., `cms/public/images/`)
4. Create WebP and thumbnail versions at final destination

```bash
# CORRECT - Output to Downloads for preview
bun run ${LIFEOS_SKILL_DIR}/Tools/Generate.ts \
  --model nano-banana-pro \
  --prompt "[PROMPT]" \
  --size 2K \
  --aspect-ratio 1:1 \
  --thumbnail \
  --output "${LIFEOS_DOWNLOADS_DIR:-$HOME/Downloads}"/blog-header-concept.png

# After approval, copy to final location (substitute your blog/site path)
cp "${LIFEOS_DOWNLOADS_DIR:-$HOME/Downloads}"/blog-header-concept.png ~/your-site/public/images/
cp "${LIFEOS_DOWNLOADS_DIR:-$HOME/Downloads}"/blog-header-concept-thumb.png ~/your-site/public/images/
```

### Multiple Reference Images (Character/Style Consistency)

For improved character or style consistency, use multiple `--reference-image` flags:

```bash
# Multiple reference images for better likeness
bun run ${LIFEOS_SKILL_DIR}/Tools/Generate.ts \
  --model nano-banana-pro \
  --prompt "Person from references at a party..." \
  --reference-image face1.jpg \
  --reference-image face2.jpg \
  --reference-image face3.jpg \
  --size 2K \
  --aspect-ratio 16:9 \
  --output "${LIFEOS_DOWNLOADS_DIR:-$HOME/Downloads}"/character-scene.png
```

**API Limits (Gemini):**
- Up to 5 human reference images
- Up to 6 object reference images
- Maximum 14 total reference images per request

**API keys in:** `${LIFEOS_DIR}/.env`

## Examples

**Example 1: Blog header image**
```
User: "create a header for my AI agents post"
→ Invokes ESSAY workflow
→ Generates charcoal sketch prompt
→ Creates image with architectural aesthetic
→ Saves to $LIFEOS_DOWNLOADS_DIR/ for preview
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

**Example 4: LifeOS pack icon**
```
User: "create icon for the skill system pack"
→ Invokes CREATEPAIPACKICON workflow
→ Reads workflow from Workflows/CreateLifeosPackIcon.md
→ Generates 1K image with --remove-bg for transparency
→ Resizes to 256x256 RGBA PNG
→ Outputs to $LIFEOS_DOWNLOADS_DIR/ for preview
→ After approval, copies to ${PROJECTS_DIR}/LIFEOS/Packs/icons/
```

## Gotchas

- **Always output to $LIFEOS_DOWNLOADS_DIR (default ~/Downloads/ when unset) first — NEVER directly to project directories.** User must preview before use. Multiple past failures from pushing wrong images directly to repos.
- **Verify image dimensions match target use case before claiming done.** Social media previews, blog headers, and thumbnails have different size requirements. A header that works on the blog may break OG/social previews.
- **nano-banana-pro uses `--size` for resolution (1K/2K/4K) and SEPARATE `--aspect-ratio` flag.** Don't pass aspect ratio values to `--size`.
- **Reference images: max 5 human, 6 object, 14 total per request** (Gemini API limit).
- **After generating, use Read tool to visually confirm the image before reporting success.** "Generated successfully" means nothing if you haven't looked at it.
- **When asked to use a specific image URL or file, use EXACTLY that asset.** Don't substitute similar images. Past rating-1 failures from using wrong image assets.
- **`--remove-bg` may produce black backgrounds instead of transparency.** Always verify transparent PNG output visually before deploying.
- **`--remove-bg` is unsafe for thin-linework technical diagrams.** rembg classifies thin black ink on a light field as "background" and strips it, leaving a near-empty ghost. Documented 2026-05-11 on the free-will flowchart. Mitigations: (a) prompt for *thick* saturated linework first so rembg has a strong signal, or (b) skip `--remove-bg` entirely when the destination background matches the image's background (blog page is sepia #EAE9DF — opaque sepia diagram on sepia page composites with zero visible seam, no alpha needed).
- **Logo fidelity breaks in 3D/perspective scenes even with a reference image.** Documented 2026-06-11 on the UL wallpaper set: straight-on and macro scenes held the glyph topology in 7/7 rolls, but the isometric 3D scene closed the open mark into a loop and dropped its isolated dot. For any perspective/3D composition with a logo, add topology-locked negative language to the prompt ("do not close the shape into a loop", "do not omit the isolated dot", name every stroke and terminal) on top of `--reference-image`, and vision-verify the topology specifically.
- **nano-banana-pro "4K 16:9" is actually 5504×3072 (43:24, ~0.8% wider than 16:9), saved as .jpg even when `--output` says .png.** Disclose the native ratio when the spec says 16:9, and probe the real filename before Read/delivery.
- **White-box-on-cream bug (2026-06-20): flattening an OPAQUE jpeg on `#EAE9DF` is a no-op.** nano-banana-pro returns an opaque JPEG; `magick -background "#EAE9DF" -flatten` only fills *alpha*, so the model's baked near-white ground survives and paints a white rectangle on the cream blog page ("it has a fucking white background"). For inline blog headers, cut true alpha FIRST (`bun ~/.claude/LIFEOS/TOOLS/RemoveBg.ts`), then derive the WebP, and verify `identify -format "%[channels]" inline.webp` == `srgba`. Opaque-sepia inline is valid ONLY on an image that already has alpha. See Essay.md Step 7.0.5.
- **Essay headers: run the Step 5A Best-Image Deliberation before prompting (2026-07-09 principal directive).** Subject-list prompts produce rejected flat tableaus; a composition reasoned deeply from the essay's specific argument — scene concepts compared, every element given a narrative role, connected structure — produces accepted images. The deliberation is the mandatory step; devices like cutaways are possible outcomes, not rules. See Essay.md Step 5A.
- **Interior-white ban (2026-07-09, "giant white space" incident):** prompt large flat surfaces (desks, panels, windows, paper) as "warm cream paper tone", never bright white or unstated — baked-white interiors survive rembg intact and render as giant white rectangles on the cream page. Inside-the-subject sibling of the 2026-06-20 white-box bug. Also trim white padding off any external screenshot before embedding (`magick -fuzz 4% -trim` + sepia border).
- **Reference-image edits: negative text loses to the reference (2026-07-09 studio-background session).** When nano-banana-pro keeps reproducing an unwanted object that exists in the reference photo (e.g. a second floor lamp), "do NOT add/duplicate" prompt language fails ~7/8 rolls — the model preserves what it sees over what you forbid. Fix: roll until ONE output has the corrected composition, then use THAT output as the new `--reference-image` for the remaining variations; compliance jumped to 7/7. Editing the reference beats describing the edit.
- **Essay/blog headers MUST be signed "{{DA_NAME}}" (2026-06-20 + 2026-07-09 principal directives) — cursive signature hand, small, integrated.** Programmatic stamp in Generate.ts/Essay.md Step 7.1 (`SignPainter-HouseScript`, ~3% of image width, semi-transparent charcoal, slight rotation, tucked into the composition's bottom-right); never prompt the signature into the model (it garbles). Formal calligraphy faces (Snell-Roundhand / Apple-Chancery / Savoye) remain rejected; oversized print-letter Bradley Hand was replaced 2026-07-09 ("more cursive looking and smaller, more part of the image").

## Execution Log

After completing any workflow, append a single JSONL entry:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"Art","workflow":"WORKFLOW_USED","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> ~/.claude/LIFEOS/MEMORY/SKILLS/execution.jsonl
```

Replace `WORKFLOW_USED` with the workflow executed, `8_WORD_SUMMARY` with a brief input description, and `SECONDS` with approximate wall-clock time. Log `status: "error"` if the workflow failed.
