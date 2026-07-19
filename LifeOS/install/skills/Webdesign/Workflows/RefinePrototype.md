# RefinePrototype

Iterate on an existing Claude Design prototype via inline comments, direct text edits, and adjustment knobs.

## Trigger Phrases

"iterate on this", "refine the prototype", "adjust spacing", "change the color", "make it more minimal", "smaller hero", "different typography"

## Inputs

Required:
- **Active Claude Design session** — a prototype must already exist in the current claude.ai/design workspace (produced by `CreatePrototype` or `WebsiteToRedesign`)
- **Refinement request** — free-form text describing the change

## Workflow

### 1. Verify Session

```bash
bun $LIFEOS_ROOT/skills/Webdesign/Tools/DriveClaudeDesign.ts screenshot /tmp/current.png
```

Confirm a live prototype is visible. If not, the session expired or was closed — restart with `CreatePrototype`.

### 2. Pick the Refinement Mode

Claude Design supports three refinement modes:

| Mode | When to use | How it lands |
|------|-------------|--------------|
| **Inline comment** | Specific element, surgical change | Click element → comment box → type intent |
| **Direct edit** | Text content changes, copy tweaks | Click text → edit in place |
| **Adjustment knob** | Spacing, color, layout, typography scale | Side panel sliders — live, non-destructive |
| **Conversational prompt** | Structural changes, new sections, different aesthetic | Main chat input |

Use adjustment knobs first (they're fastest and reversible). Fall back to conversational prompts only for structural changes.

### 3. Apply the Refinement

**Adjustment knob (most refinements fit here):**
```bash
bun $LIFEOS_ROOT/skills/Webdesign/Tools/DriveClaudeDesign.ts adjust --property "spacing" --delta "+20%"
bun $LIFEOS_ROOT/skills/Webdesign/Tools/DriveClaudeDesign.ts adjust --property "primary-color" --value "#2D5A3F"
```

**Inline comment:**
```bash
bun $LIFEOS_ROOT/skills/Webdesign/Tools/DriveClaudeDesign.ts comment --selector "hero-section" --text "Make this 30% shorter and shift the CTA left-aligned"
```

**Conversational prompt:**
```bash
bun $LIFEOS_ROOT/skills/Webdesign/Tools/DriveClaudeDesign.ts prompt "Remove the testimonial section. Add a pricing comparison table above the footer. Keep the current aesthetic."
```

### 4. Wait for Regeneration

10-45 seconds depending on change scope. Adjustment knobs apply live (<2s); conversational prompts trigger full regeneration.

### 5. Screenshot and Compare

```bash
bun $LIFEOS_ROOT/skills/Webdesign/Tools/DriveClaudeDesign.ts screenshot "$OUT/v${N}.png"
```

Use `compare` flag for before/after:
```bash
bun $LIFEOS_ROOT/skills/Webdesign/Tools/DriveClaudeDesign.ts compare /tmp/current.png "$OUT/v${N}.png"
```

### 6. Loop or Export

If more refinements needed, repeat from step 2. When satisfied, hand back to `CreatePrototype` step 6 (Export) or direct to `ExportToCode` / `IntegrateIntoApp`.

## Refinement Request Patterns

Effective refinement prompts are specific and bounded:

| Good | Bad |
|------|-----|
| "Reduce hero padding by 30%" | "Make it tighter" |
| "Use Playfair Display for headings, keep body font" | "Better typography" |
| "Move the CTA button from center to top-right of the hero" | "Fix the CTA" |
| "Shift the palette 20° warmer, keep the same saturation" | "Warmer colors" |
| "Remove the testimonial section entirely" | "Clean it up" |

## Common Pitfalls

- **Vague refinements** — "make it better" produces drift, not improvement. Be specific.
- **Too many simultaneous changes** — multiple requests in one prompt compound errors. One change at a time for precision.
- **Switching aesthetic mid-iteration** — see feedback `stay_in_named_workflow.md` in the canonical LifeOS memory: if you chose brutalist, "make it better" means better-within-brutalist, not switch to minimalist. Be explicit if switching aesthetic.
- **Refining past the point of return** — if 5+ refinement rounds haven't converged, the original brief was wrong. Restart from `CreatePrototype` with a sharper brief.

## Time Estimate

30 seconds per adjustment-knob change. 1-2 minutes per conversational refinement. A typical refinement session is 3-7 rounds.
