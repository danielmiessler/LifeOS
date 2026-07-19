# StyleMatchedThumbnail Workflow

Build a pro YouTube thumbnail that matches a reference's text style, places a **real** expression-matched photo of the creator on one third, sits it over a topic background, and looks hand-made — not like AI slop.

**Why this exists:** the legacy `AdHocYouTubeThumbnail` path generated a *fresh fake face* every run and composited text with broken geometry (trim-then-guess offsets, border-then-squash). On a channel whose audience knows the creator's real face, a synthesized face is the loudest slop tell. This workflow flips two things: the face is a **real photo selected by expression**, and the text is composited with a **deterministic, measured** engine (`ThumbnailText.ts`). The background is the only generated element, and it's generated to *blend dark* so the keyed real photo sits on it cleanly.

## Overlay standard — full-bleed (CURRENT STANDARD, locked 2026-06-28)

The principal's standing thumbnail style. Invoke `ThumbnailText.ts --mode overlay`. Spec, all load-bearing:

- **Background is the WHOLE frame** — a custom topic-themed art image (`--bg`, cover-fit). Generate it full-bleed, dark/premium, themed to the transcript's topic, with NO text/logos/people. The art is the canvas, not a side panel.
- **Face: a TALL SIDE figure on the FAR right, TRIM FIRST.** Trim the cutout to the subject (`-trim`) BEFORE scaling — the raw headshot has headroom + shoulder slack, so scaling without trimming leaves the head small and mid-frame (the "you didn't make my face bigger/higher" miss). Then width-cap to ~54% (`-resize $((W*0.54))x$((H*1.22))`), `-gravity SouthEast -52+0` so it's big and bleeds slightly off the right edge — big + far right, leaving the left clear. NOT centered (a centered face puts text over the face, explicitly rejected).
- **Text: LARGE, LEFT-ALIGNED, VERTICALLY CENTERED, `--text-style shadow` with a PER-LETTER shadow (LOCKED 2026-06-29).** Title stacks ONE WORD PER LINE for ≤3-word titles (each line gated only by its own word width → big; a 2-line split of a 3-word title crushed the size to the floor). Crisp white Hermes caps; the shadow is PER-LETTER — a blurred dark copy of each line's glyphs composited as a halo + slight drop, so every letter carries its own shadow background, NOT a box behind the word and NOT one block behind the stack ("each individual letter needs the background, like a shadow background, not for the word"). Only the shadow is blurred; the fill stays crisp. NO subtitle. (`boxed`=near-black per-line boxes and `accent`=brand-blue per-line boxes remain available via `--text-style` but were rejected.)
- **Font** `Hermes-Maia-6-Caps` (pass the file path `~/Library/Fonts/Hermes Maia 6 Caps Regular.otf` to be certain). **Border** thicker (~30px default), semantic color (`--variant core` blue / `sponsored` green). **Node-logo** top-right, nudged further IN from the border (`+bWidth+22 / +bWidth+20`) so it doesn't sit against the outline.
- **Validate against the brief, not just by reading your own output:** face big + far right (text never over it)? title large, one-word-per-line, left-aligned + vertically centered? per-LETTER shadow (not boxes, not blurred-muddy)? thick border + logo off the edge? `Read` the full-res before delivering.

Canonical example: `~/Downloads/rethinking-harness-engineering.png` (shadow / per-letter / one-word-per-line).

## Inputs

- `TITLE` — the headline, split into a small kicker line + a big emphasis line + an optional lower line (e.g. kicker `"A DEEP DIVE ON MY"`, title `"PERSONAL AI"`, subtitle `"INFRASTRUCTURE"`).
- `TOPIC` — the video topic/content (text, URL, or script). Drives both the background concept and the expression.
- `REFERENCE` (optional) — a thumbnail image whose text style/grade to match. Default = the creator's own house style (`YouTubeThumbnailExamples/Main*.png`).
- `N` — number of variants (default 4).
- `SENTIMENT` (optional) — overrides the auto-derived expression.

## Steps

### 1. Analyze the reference style

If a `REFERENCE` image is given, `Read` it and capture: dominant background grade (dark navy by default), accent/title color, font feel, which third holds the face (text gutter = the other third). The house palette is Tokyo Night — title cyan `#7dcfff`, white kicker/subtitle, accent words in magenta `#ff007c` / purple `#bb9af7` where the reference uses them. **Every thumbnail carries a semantic colored outline** — blue `#316AE9` for core content, green `#306F1D` for sponsored — set via `--variant` in step 4 (NOT optional; it's how his channel signals video type). If no reference, use the house defaults above.

### 2. Pick the real expression-matched face

```bash
bun $LIFEOS_ROOT/skills/Art/Tools/PickExpression.ts --topic "<TOPIC>"
# or force it: --sentiment skeptical|neutral|positive|curious|thinking|disgust|shock|surprise|casual
```

Returns the path to a real expression-labeled headshot. `Read` it to confirm the expression fits the content; pick a different one from `alternatives` if not. **Default to the real photo** — it guarantees photorealism.

*Optional `--generate-face`:* when the library has no fitting expression, generate a fresh expression FROM the real headshots as face refs (honors "a new face shot of me"):
```bash
bun $LIFEOS_ROOT/skills/Art/Tools/Generate.ts --workflow=StyleMatchedThumbnail --model nano-banana-pro \
  --size 2K --aspect-ratio 1:1 --no-signature \
  --reference-image <headshot-clean.png> --reference-image <headshot-smiling.png> \
  --prompt "Photorealistic head-and-shoulders portrait of the man in the references, <EXPRESSION>, looking at camera, plain near-black background, studio lighting, NO text." \
  --output ~/Downloads/sm-thumb/face-gen.png
```
Then `Read` it and reroll on any likeness drift or render-y skin before using it.

### 3. Background — solid navy is the real default (NOT a generated scene)

His real thumbnails are a **solid deep-navy field `#1A2744`** plus, optionally, a **real supporting visual** (a topic diagram, a terminal/code screenshot, a product logo) darkened behind the text. A generated cinematic scene reads MORE like AI, not less — don't use one by default. So there is usually nothing to generate here: `ThumbnailText.ts` fills navy itself.

- **Supporting art** (recommended when you have a relevant visual): pass `--art <image.png>` — a real diagram/screenshot/logo. The tool darkens it to ~38% and places it behind the text on the text side. This is the single biggest "designed by hand" signal.
- **Custom plate** (rare): pass `--bg <plate.png>` to override navy with any image; the contrast gate + auto-scrim then protect the title.
- **Generated plate** (only if you truly want a rendered scene): `Generate.ts --workflow=StyleMatchedThumbnail --model nano-banana-pro --no-signature` (never `--thumbnail`), then pass it as `--bg`. NBP may save JPEG — glob `*.png` AND `*.jpg`.

### 4. Compose — `ThumbnailText.ts` (the whole thumbnail in one call)

**Solo layout** (Main-style: navy + supporting art + cutout face + text top-left):
```bash
bun $LIFEOS_ROOT/skills/Art/Tools/ThumbnailText.ts \
  --face "<headshot from step 2>" --art "<diagram.png, optional>" \
  --kicker "A DEEP DIVE ON MY" --title "PERSONAL AI" --subtitle "INFRASTRUCTURE" --tag "v2 (December 2025)" \
  --variant core --face-side right \
  --output ~/Downloads/sm-thumb/final-1.png
```

**Interview layout** (Sponsored/Main7-style: centered text + two framed stills + name labels):
```bash
bun $LIFEOS_ROOT/skills/Art/Tools/ThumbnailText.ts --mode interview \
  --kicker "A CONVERSATION WITH" --title "GRANT LEE" --subtitle "ON BUILDING GAMMA" \
  --face host.png --face2 guest.png --name1 "{{PRINCIPAL_FULL_NAME}}" --name2 "Grant Lee" \
  --accent "#F5A623" --variant sponsored \
  --output ~/Downloads/sm-thumb/final-1.png
```

**The house design system, reproduced from `SPECIFICATIONS.md` + live pixel samples:**
- **Semantic border (load-bearing):** `--variant core` → blue `#316AE9`, `--variant sponsored` → green `#306F1D`. ON by default, ~22px. This signals video type on his channel — never omit it.
- **4-line type hierarchy, house colors:** `--kicker` (white) / `--title` (periwinkle `#6B8DD6` default, set `--accent` for orange `#F5A623` etc.) / `--subtitle` (white, override `--subtitle-color`) / `--tag` (purple `#C084FC`, e.g. a version/date). An accent **underline rule** is drawn under the headline.
- **Font:** `Avenir-Black` (his geometric heavy sans, ships with macOS) is the default. Helvetica-Bold was a wrong-family fallback. For an even closer match install Montserrat/Inter ExtraBold as a static face and pass `--font`.
- **Face:** rembg/floodfill cutout (auto by source bg), capped to the right ~third, bottom-anchored.
- **Logo:** the real "TI:" node-mark, extracted to `brand/ti-logo-white.png`, composited top-right inside the border. `--no-logo` to disable.

It writes the 1280×720 PNG + a 320×180 proof and prints JSON (`titlePt`, `contrastRatio`, `overflowed`). Exits non-zero on unfittable title — split a long title across kicker/title/subtitle.

Flags: `--mode solo|interview`, `--variant core|sponsored`, `--accent #hex`, `--subtitle-color #hex`, `--tag "..."`, `--art <img>`, `--bg <plate>`, `--cut auto|floodfill|rembg|none`, `--face-side left`, `--font <name>`, `--border "22,#hex"`, `--no-border`, `--no-logo`, `--no-rule`, `--no-scrim`.

### 5. Quality gates (code-backed, not visual theater)

For each final:
- `magick identify -format '%wx%h %m' final-1.png` → must be `1280x720 PNG`.
- `Read` the 320×180 proof — the title must be legible at grid size.
- `Read` full-res — confirm: title spelled exactly as input (guaranteed, it's composited), the face is a real photo with the right expression and **no seam**, text is grounded (shadow) not floating, and it matches the reference's gutter side + grade.
- Check the tool's JSON: `overflowed:false` and `contrastRatio ≥ 3.0`.

### 6. Present

Build a contact sheet and let the creator pick:
```bash
magick montage ~/Downloads/sm-thumb/final-*.png -tile 2x2 -geometry 640x360+6+6 ~/Downloads/sm-thumb/CONTACT.png
```
`Read` it, then `SendUserFile` the sheet + full-res variants, numbered, each labeled with its expression + background concept. Human pick is the finish, not a fallback — this is a brand-critical asset.

## Gotchas

- **VALIDATION = side-by-side montage against the CONTROL, element by element. Reading your own output alone is NOT validation (2026-06-28 — three "looks good" claims shipped a thumbnail that didn't match the control at all: wrong font, face too low, broken logo).** Before claiming any thumbnail is done, build `magick montage <control>.jpg <output>.png -tile 1x2 -geometry 600x338 compare.png` and `Read` it, then check EACH element against the control out loud: (1) **layout** — full-width navy title band on top? (not a left text column); (2) **font** — heavy CONDENSED display face (Anton), not a wide/round sans; (3) **face** — large, head near the band, not small and low; (4) **logo** — the complete node-graph mark, not a fragment; (5) **border** — correct semantic color; (6) **spelling** — every word. Any element that doesn't match the control is a defect, not a "close enough." The control is the spec.
- **The SOLO layout is a full-width title band + big face, NOT a left text column.** Rebuilt 2026-06-28: navy band (≈32% H) holds a WHITE condensed title (Anton) + subtitle + accent underline, full width; the face is `H*0.82` tall, bottom-anchored, head rising to just under the band; the plate/`--art` shows in the body; node-logo top-right. The prior left-column layout with an all-accent title did not match the real control and was rejected.
- **Font is `Hermes-Maia-6-Caps` — explicit principal directive (2026-06-28: "the font I want for the thumbnail text is Hermes Maia 6 caps").** File: `~/Library/Fonts/Hermes Maia 6 Caps Regular.otf` (magick name `Hermes-Maia-6-Caps`). This is the standing default; do not substitute Anton/Avenir. (Anton was the prior condensed pick before the principal specified Hermes Maia — overridden.)
- **The brand logo (`brand/ti-logo-white.png`) is the node-graph mark — verify it renders complete, not a fragment.** The shipped asset was once a broken crop (only a corner rendered → "top-right graphic is fucked up"). It's now extracted clean from the audio-thumbnail control; flatten on navy and `Read` it if you ever regenerate it.
- **Never pass `--thumbnail`** to `Generate.ts` here — that triggers blog-header sepia-thumb mode and stamps the {{DA_NAME}} signature. Use plain output + `--no-signature`.
- **Text balance is baked into the engine now, not a per-run knob (2026-06-28 principal feedback "the text isn't well balanced with the image").** Two SOLO-mode defaults in `ThumbnailText.ts`: (1) the text block is **vertically centered** in the content height (optically nudged to 0.82 above true center), not pinned to `topY` — top-pinning clustered the text in the upper-left and left the bottom-left dead against the bottom-anchored face. (2) Subtitle scale is **0.58** (was 0.82) so a long subtitle no longer caps the shared `titlePt` and crushes the headline. If a title still returns small (`titlePt` ≤ 60), the subtitle is too long — split it across kicker/subtitle or shorten it; don't let the headline shrink. Always `Read` the full-res AND the 320 proof and judge balance by eye: the diagonal "text top-left / face bottom-right with empty corners" look is the failure to catch.
- **The face must be a real photo by default.** Generating a fresh face is opt-in (`--generate-face`) for missing expressions only — a synthesized recognizable face is the #1 slop tell on a known creator's channel.
- **Plate prompt must forbid text/logos/people explicitly** — NBP will otherwise bake gibberish words into the "thumbnail-shaped" image. The text gutter must be empty; we own the text.
- **Font:** Helvetica-Bold is the installed default and matches the house style adequately. Anton/Bebas Neue/Montserrat-Black match punchier reference type but are NOT installed — install once and pass `--font`. Don't silently expect a different font.
- **NBP sometimes writes JPEG** even when you ask for `.png` — glob both extensions and check the file count after a batch; large fan-outs silently drop outputs.
- **`ComposeThumbnail.ts` is the legacy broken path** (trim-then-guess text geometry, border-then-squash). This workflow does NOT call it — use `ThumbnailText.ts`.
- **Read `YouTubeThumbnailExamples/SPECIFICATIONS.md` FIRST** — it's the documented house design system (border, navy bg, logo, 4-line type hierarchy, supporting-art layer, interview format). Then pixel-sample the real `Main*`/`Sponsored*` files to reconcile: the spec's own values can be stale (its border `#4A90D9`/6px was wrong vs the real `#316AE9`/~22px). Spec for structure, pixels for exact values.
- **His background is solid navy + a real supporting visual, NOT a generated scene.** A generated cinematic plate reads MORE like AI. Default to navy (`ThumbnailText.ts` fills it) + `--art` a real diagram/screenshot; reserve `--bg` generation for when a rendered scene is genuinely wanted.
- **Font family is a loud brand tell.** His is a geometric heavy sans (default `Avenir-Black`); the old Helvetica-Bold is neo-grotesque and reads off-brand in every glyph. Don't ship the wrong family.
- **The colored outline is SEMANTIC, not decorative** — blue `#316AE9` = core content, green `#306F1D` = sponsored. Getting it wrong (or omitting it) mislabels the video type on his channel. Always set `--variant`. Hexes were sampled directly from his real `Main*`/`Sponsored*` thumbnails; don't eyeball-substitute them.
- **The sponsored layout is genuinely different** — it's an interview frame (two faces, text top-centered, warm podcast-studio background, gold `#e0af68` accent), not just a green-bordered core layout. The current tool does the green border + solo composite; the two-face interview composite is a planned extension.

## Example

```
User: "Make me a thumbnail for my video on why AI agents are overhyped"
→ PickExpression --topic "why AI agents are overhyped" → skeptical → headshot-nah.png
→ Generate plate: dark navy, abstract agent/network motif, clean right gutter, no text
→ ThumbnailText --bg plate.png --face headshot-nah.png --kicker "THE TRUTH ABOUT" --title "AI AGENTS" --subtitle "ARE OVERHYPED" --accent "#ff007c"
→ identify 1280x720 PNG ✓, Read 320 (legible) ✓, Read full (real face, skeptical, grounded text) ✓
→ montage CONTACT.png → SendUserFile → user picks variant 2
```
