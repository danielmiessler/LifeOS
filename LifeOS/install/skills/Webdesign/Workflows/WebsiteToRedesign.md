# WebsiteToRedesign

Live URL → capture → critique → modernized rebuild via Claude Design.

## Trigger Phrases

"redesign this site", "rebuild this page", "modernize this URL", "new look for", "give this site a facelift"

## Inputs

Required:
- **URL** — the live page to capture
- **Direction** — what should change (aesthetic shift, different audience, new brand, keep-the-bones-fix-the-look)

Optional:
- **Preserve list** — elements/sections to keep verbatim (copy, structure, specific components)
- **Reference sites** — 1-3 URLs of sites whose look/feel should inform the rebuild
- **Framework target** — where the rebuild will land

## Workflow

### 1. Capture the Existing Site

```bash
OUT=~/Downloads/webdesign/redesign/$(date +%Y%m%d-%H%M%S)
mkdir -p "$OUT"

# Full-page screenshot — Interceptor has no Tools/ dir; use the skill API instead.
# Skill("Interceptor", "open $URL and capture full-page screenshot to $OUT/original.png")

# HTML snapshot
curl -sL "$URL" > "$OUT/original.html"

# Extract tokens from the live site
bun $LIFEOS_ROOT/skills/Webdesign/Tools/VerifyDesign.ts "$URL" "$OUT/original-verify"
```

### 2. Critique Pass

Before regenerating, do a brief critique. Feed the screenshot + HTML into a quick analysis:

> What works on this page? What reads as dated or generic? What is the one thing someone remembers after they leave? What should the rebuild preserve vs rethink?

Write the critique to `$OUT/critique.md` — Claude Design reads this during the rebuild brief.

### 3. Compose the Rebuild Brief

Build a brief for Claude Design that references the original:

```
TASK: Redesign the page currently at $URL.

ORIGINAL SCREENSHOT: (attached) $OUT/original.png

WHAT TO PRESERVE:
$PRESERVE_LIST

AESTHETIC DIRECTION:
$DIRECTION

REFERENCE FEEL (not copy — just mood):
$REFERENCE_SITES

CONSTRAINTS:
- Framework: $FRAMEWORK
- Responsive: mobile-first, breakpoints at 640/768/1024/1280
- Accessibility: WCAG 2.1 AA minimum
- Dark mode: $DARK_MODE_YN

DIFFERENTIATION:
The one memorable element: $DIFFERENTIATOR
```

### 4. Submit to Claude Design

```bash
bun $LIFEOS_ROOT/skills/Webdesign/Tools/DriveClaudeDesign.ts open
bun $LIFEOS_ROOT/skills/Webdesign/Tools/DriveClaudeDesign.ts upload "$OUT/original.png"
bun $LIFEOS_ROOT/skills/Webdesign/Tools/DriveClaudeDesign.ts prompt "$(cat $OUT/brief.md)"
```

### 5. Iterate

Use `RefinePrototype.md` workflow for refinements. Common redesign iterations:

- "Keep the headline copy verbatim — only restyle"
- "The hero felt too wide — constrain to max-w-6xl"
- "Bring the testimonial section closer to the features"
- "The CTA color isn't working — try warmer"

### 6. Side-by-Side Comparison

Before export, capture the new design and compare:

```bash
bun $LIFEOS_ROOT/skills/Webdesign/Tools/DriveClaudeDesign.ts screenshot "$OUT/redesigned.png"
bun $LIFEOS_ROOT/skills/Webdesign/Tools/VerifyDesign.ts --compare "$OUT/original.png" "$OUT/redesigned.png" "$OUT/compare"
```

### 7. Export + Integrate

Based on deployment target:
- Replacing an existing site → `IntegrateIntoApp.md`
- Greenfield rebuild → `ExportToCode.md` then `DeployDesign.md`

## Output

- `$OUT/original.png`, `$OUT/original.html` — captured state
- `$OUT/critique.md` — pre-rebuild analysis
- `$OUT/brief.md` — Claude Design input
- `$OUT/redesigned.png` — final prototype
- `$OUT/compare/` — side-by-side
- Export artifact (bundle / html / url)

## Common Pitfalls

- **Skipping the critique** — jumping straight to "rebuild this" without analysis produces change without intentionality. The critique makes the rebuild purposeful.
- **Preserving too much** — if everything is in the preserve list, it's a paint job, not a redesign. Pick 2-4 elements max.
- **Using screenshots alone** — feeding HTML along with the screenshot gives Claude Design structural context it wouldn't infer from pixels.
- **Reference-copying** — reference sites inform mood, not content. If the redesign looks like the reference, it failed.

## Time Estimate

10-25 minutes end-to-end for a single page. Larger multi-page redesigns: decompose into one session per page.
