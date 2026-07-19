# ExtractDesignSystem

> **Prefer Path 2 first.** `/design-sync` (pull direction) is the native, first-party way to import a codebase's real design system into Claude Design — use `Workflows/NativeDesignSync.md` when the command is available. This Interceptor-driven extraction (Path 3) is the fallback for working from the web canvas and is unproven (the `interceptor-test` profile isn't logged into claude.ai). See SKILL.md → Prerequisites.

Codebase / brand assets → design tokens Claude Design uses on every subsequent generation.

## Trigger Phrases

"extract design system", "pull tokens from this repo", "learn this brand", "teach Claude Design our colors", "onboard design system"

## Why This Runs First

Claude Design's onboarding step reads your codebase and existing design files to build a team design system. Every prototype it generates afterward uses YOUR colors, typography, and components automatically. Run this BEFORE `CreatePrototype` for any branded work — otherwise Claude Design uses generic defaults and the prototypes drift from your brand.

## Inputs

Required — one or more of (native-first; prefer the repo link):
- **GitHub repo link** — the strongest path. Claude Design reads your real components and tokens directly from code, so the extracted system tracks what actually ships. Use this whenever the design system lives in a repo.
- **Codebase path** — a local project directory with CSS/Tailwind/component files (same idea as the repo link, for code not yet pushed).
- **Component folder** — a curated directory of UI components + token files (CSS variables, `tokens.json`, `tailwind.config.*`) uploaded directly.
- **Brand folder** — logos, fonts, color swatches, style references.
- **Brand guide doc** — PDF or PPTX style guide (fine — not a Figma coupling).

Do NOT import via `.fig` exports. Code and tokens in the repo are the source of truth; we don't couple the system to Figma (see SKILL.md native-first gotcha).

Optional:
- **System name** — if you maintain multiple design systems (e.g., "marketing" vs "dashboard")
- **Scope hints** — tell Claude Design what to extract first ("focus on color palette and typography, ignore component code")

## Workflow

### 1. Preflight

```bash
interceptor --version || echo "ABORT: Interceptor not installed"
ls "$INPUT_PATH" || echo "ABORT: input path not readable"
```

### 2. Prepare Input Package

Depending on input type:

**GitHub repo link (preferred):** No local packaging needed. Pass the repo URL straight to Claude Design's onboarding and let it read components and tokens from code. For a private repo, ensure the authenticated claude.ai session has access, or fall back to the local codebase path below.

**Codebase:**
```bash
# Collect design-relevant files into a tempdir for upload
TMP=$(mktemp -d)
cp -r "$REPO/tailwind.config.*" "$TMP/" 2>/dev/null
cp -r "$REPO/src/styles" "$TMP/" 2>/dev/null
cp -r "$REPO/src/components/ui" "$TMP/" 2>/dev/null
cp "$REPO/package.json" "$TMP/" 2>/dev/null
```

**Brand folder:**
```bash
# Just point Claude Design at the folder — it reads images, fonts, and docs directly
TMP="$BRAND_FOLDER"
```

### 3. Open Claude Design Onboarding

```bash
bun "${LIFEOS_ROOT}/skills/Webdesign/Tools/DriveClaudeDesign.ts" open
```

Then navigate to the design system section. The skill sends a prompt like:

> "Build a design system from the files I'm about to upload. Extract colors, typography, spacing, and component patterns. Name the system '$NAME'. Flag any conflicts or ambiguities."

### 4. Upload Files

```bash
bun "${LIFEOS_ROOT}/skills/Webdesign/Tools/DriveClaudeDesign.ts" upload "$TMP"
```

### 5. Wait for System Extraction

Claude Design takes 30s-3min depending on codebase size. Output appears in the design system panel with:
- Color palette (primary, neutrals, accents)
- Typography scale (display, body, mono)
- Spacing grid
- Component inventory (buttons, cards, navs, inputs)
- Flagged conflicts / ambiguities

### 6. Review and Refine

Screenshot the extracted system:
```bash
bun "${LIFEOS_ROOT}/skills/Webdesign/Tools/DriveClaudeDesign.ts" screenshot "$OUT/extracted-system.png"
```

If Claude Design flagged conflicts (e.g., "three different button styles in codebase — pick canonical"), resolve in the conversational UI. The adjustment-knob UX lets you tweak tokens live.

### 7. Save System

Claude Design persists the system server-side on your account. It will be auto-applied to every subsequent prototype generated in this workspace. You can also export the tokens as JSON:

```bash
bun "${LIFEOS_ROOT}/skills/Webdesign/Tools/DriveClaudeDesign.ts" export tokens "$OUT/tokens.json"
```

## Output

- `$OUT/extracted-system.png` — visual snapshot of the extracted system
- `$OUT/tokens.json` — machine-readable token export (colors, typography, spacing)
- `$OUT/system-notes.md` — flagged conflicts and resolutions
- Claude Design workspace primed for `CreatePrototype`

## Common Pitfalls

- **Feeding a full repo** — Claude Design gets overwhelmed by 10K+ files. Curate a focused bundle (~20-50 files max).
- **Uploading generated output** — If your codebase has `dist/` or `build/`, exclude them. Upload source only.
- **Skipping conflict resolution** — unresolved conflicts lead to inconsistent prototypes downstream. Resolve at extraction time, not generation time.
- **One-shot expecting perfection** — extraction is iterative. Plan for 1-2 refinement rounds before the system is solid.

## Time Estimate

5-15 minutes depending on codebase complexity and conflict count.
