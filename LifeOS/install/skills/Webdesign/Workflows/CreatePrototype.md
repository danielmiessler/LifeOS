# CreatePrototype

Brief → polished prototype via Claude Design.

## Trigger Phrases

"design a prototype", "create a prototype", "mockup", "build a design", "make a landing page design", "design a dashboard"

## Inputs

Required:
- **Brief** — one-to-three sentences describing what to build (purpose, audience, mood)

Optional (strongly recommended):
- **Reference images** — 1-5 local image paths for visual inspiration
- **Brand assets** — logo path, font files, existing color palette
- **Framework target** — "astro", "next", "vitepress", "vanilla-html" — informs the downstream handoff
- **Existing project path** — if this prototype will land inside an existing app (triggers `IntegrateIntoApp` as a follow-on)
- **Aesthetic direction** — one of: minimal, maximalist, retro-futuristic, editorial, brutalist, art-deco, luxury, playful, industrial. If omitted, Claude Design picks.

## Workflow

### 1. Preflight

Confirm all prerequisites from `SKILL.md` → Prerequisites. If any fail, halt with remediation.

```bash
# Verify Interceptor available
interceptor --version || echo "ABORT: Interceptor skill not installed"
```

### 2. Construct the Brief

Compose a single prompt for Claude Design. Include:

- **One-sentence purpose** — what the page/component does, who uses it
- **Aesthetic direction** — explicit (do not let Claude Design default to generic)
- **Constraints** — responsive breakpoints, dark mode, accessibility tier, framework
- **Differentiation hook** — the one memorable detail
- **Scope** — number of sections, key components, must-have elements

Use the prompt patterns in `References/InputFormats.md`.

### 3. Open Claude Design

```bash
bun ~/.claude/skills/Webdesign/Tools/DriveClaudeDesign.ts open
```

This opens `claude.ai/design` in the authenticated Interceptor-controlled Chrome session. First-run may require a headed login; subsequent runs are headless.

### 4. Submit the Brief

```bash
bun ~/.claude/skills/Webdesign/Tools/DriveClaudeDesign.ts prompt "$(cat /tmp/brief.md)"
```

Wait for Claude Design to produce the first version (typically 20-60 seconds).

### 5. Capture the Output

```bash
OUT="${LIFEOS_DOWNLOADS_DIR:-$HOME/Downloads}"/webdesign/$(date +%Y%m%d-%H%M%S)
mkdir -p "$OUT"
bun ~/.claude/skills/Webdesign/Tools/DriveClaudeDesign.ts screenshot "$OUT/v1.png"
```

Review the screenshot. If it matches the brief, proceed to step 6. If not, hand to `RefinePrototype.md`.

### 6. Export

Choose based on next step:

| Next step | Export format |
|-----------|--------------|
| Review / feedback | `url` (shareable internal URL) |
| Collaborative editing | `canva` |
| Local code integration | `bundle` (handoff to Claude Code) |
| Slide deck / client presentation | `pptx` or `pdf` |
| Static one-off page | `html` |

```bash
bun ~/.claude/skills/Webdesign/Tools/DriveClaudeDesign.ts export bundle "$OUT"
```

### 7. Verify

```bash
bun ~/.claude/skills/Webdesign/Tools/VerifyDesign.ts "$OUT/index.html" "$OUT/verify"
```

Produces a screenshot at the expected viewport plus an axe-core accessibility report. Fix any critical issues before declaring done.

### 8. Handoff

If this prototype feeds into larger site work:

```
Skill("Webdesign") → Workflows/IntegrateIntoApp.md
```

Pass the bundle path + target project path.

## Output

- Screenshot(s) in `$OUT/`
- Export artifact (bundle / html / canva link / pptx)
- Accessibility report
- One-line entry in `~/.claude/`

## Common Pitfalls

- **Vague brief** — "make it look nice" yields generic. Be explicit about aesthetic direction, mood, and differentiation.
- **Skipping reference images** — Claude Design with visual references produces dramatically better first drafts than text-only briefs.
- **Not specifying framework** — the handoff bundle scaffolds differently for React vs Vue vs vanilla; pick before export.
- **Exporting to HTML when you wanted bundle** — HTML export is static and does not carry tokens / components. For any code-integration workflow, always export `bundle`.

## Time Estimate

3-8 minutes for a single-iteration prototype. Add 1-3 minutes per refinement round.
