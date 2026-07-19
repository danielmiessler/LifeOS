# DirectDesign

> **One of two paths in the Webdesign skill.** This workflow is **{{DA_NAME}} writes the design directly** with Anthropic's frontend-design philosophy loaded inline. The other path, `CreatePrototype`, drives `claude.ai/design` through Interceptor. See `SKILL.md` for the routing rule.

## Voice Notification

```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running DirectDesign in Webdesign", "voice_enabled": true}' > /dev/null 2>&1 &
```

Then output:
```
Running **DirectDesign** in **Webdesign**…
```

## When to Choose This Workflow

Choose DirectDesign when:
- The brief is short, ad-hoc, exploratory, or experimental
- Output lands inside an existing codebase as code, not as a shareable visual surface
- Speed matters more than polish
- Network round-trip / claude.ai access is friction (offline, sandboxed, or just slow)
- One fast pass with clear aesthetic intent is the deliverable

Otherwise → use `CreatePrototype` (the ClaudeDesign path).

## Step 0 — Load the Aesthetic Doctrine

**Before writing anything, read the philosophy reference:**

```
Read("$LIFEOS_ROOT/skills/Webdesign/References/FrontendDesignPhilosophy.md")
```

That file is the load-bearing source. It contains:
- The aesthetic register list (brutalist / editorial / retro / maximalist / luxury / etc.)
- Forbidden defaults (Inter, Roboto, purple-on-white gradients, generic Tailwind shadows, default radii)
- Typography pair recipes per register
- Color, motion, spatial, and background guidance
- Implementation-complexity-matching rule

Do not skip this read. The doctrine is the whole point of this workflow.

## Step 1 — Declare the Aesthetic Register (BEFORE any code)

Output the register choice **explicitly** before writing markup. Pick one from the closed list in `FrontendDesignPhilosophy.md`. If the brief implies a register, name it. If it doesn't, choose deliberately and rotate across sessions — do not default to the same register every time.

Output line:
```
🎨 AESTHETIC: <register-name> — <one-sentence rationale tied to the brief>
```

The register choice constrains every downstream decision: type pair, color palette, motion vocabulary, layout posture, background treatment.

## Step 2 — Declare the Output Contract

State the deliverable shape up front. Pick one:

| Contract | When |
|----------|------|
| `single-file-html` | Portable demo, one `.html` with inline `<style>` and `<script>`. Fastest to review. |
| `react-tailwind` | A `.tsx` component using Tailwind v4 + `motion` (framer-motion). Lands in React apps. |
| `astro-component` | `.astro` for content sites and static-first pages. |
| `vue-sfc` | `.vue` single-file component. |
| `framework-matched-diff` | Patches against an existing codebase (defer to `Workflows/IntegrateIntoApp.md`). |

Output line:
```
📦 OUTPUT: <contract> — <target file or path>
```

## Step 3 — Specify the Type Pair, Palette, and Motion Vocabulary

From the chosen register, lock in:

```
🔠 TYPE: display=<font>, body=<font>, mono=<font-or-N/A>
🎨 PALETTE: bg=<color>, fg=<color>, accent=<color>, [optional]=<color>
🎬 MOTION: <one named gesture e.g. "stagger-cascade page load", "hover slow-fade", "scroll reveal">
```

These are constraints on the whole page. Reference `FrontendDesignPhilosophy.md` Type Pair Recipes table for register-appropriate combinations. Do not pick a font from a different register without a deliberate clash-as-design reason.

## Step 4 — Implement (Production-grade Code)

Write the code. Rules:

- **Real working code**, not pseudocode. No placeholder `lorem ipsum` unless that *is* the design joke.
- **Match implementation complexity to the aesthetic vision.** Maximalist registers earn elaborate code (multiple gradients, layered effects, rich animation timelines). Minimalist registers earn restraint (precision spacing, exact type ramp, almost no decoration).
- **No generic AI-default tells.** No `shadow-md` everywhere. No uniform `rounded-lg` everywhere. No `Inter` body. No purple-on-white gradient. No "centered card on flat color" as the entire layout. Refer to `FrontendDesignPhilosophy.md` Forbidden Defaults section.
- **One memorable element.** Name it in a comment at the top of the file (`// HERO: <thing someone will remember>`). Every page needs one.
- **Accessibility minimum.** Body text contrast meets WCAG AA on its surface; AAA on primary content surfaces. Interactive elements have visible focus states. Animations respect `prefers-reduced-motion`.

## Step 5 — Verify (mandatory before declaring done)

Web output gets verified through the **Interceptor skill** — real Chrome, no CDP fingerprint, accurate rendering. This is non-negotiable; "code looks right" is not verification.

```
Skill("Interceptor", "open <local URL or file> and screenshot the rendered page")
```

Then read the screenshot and confirm:
- Type pair is rendering (fonts loaded, no fallback to system-ui)
- Palette is visibly committed (one accent, restrained core)
- Motion fires on initial load / hover (not just static markup)
- Layout matches the chosen register (asymmetry / rhythm / density / restraint)
- The "memorable element" is actually memorable when seen

If any of the above fail, return to Step 4. Don't paper over by editing claims; fix the implementation.

## Step 6 — Hand Off

Output, in order:

1. **The file(s)** — written to disk at the path declared in Step 2.
2. **The aesthetic statement** — `AESTHETIC | TYPE | PALETTE | MOTION` lines from Steps 1 and 3, restated.
3. **The screenshot path** — wherever Interceptor saved the verification image.
4. **The memorable-element line** — one sentence on what makes this page stick.

That's it. Don't add narrative, don't add a "what I did" section, don't apologize for choices.

## Customization (Optional)

If `$LIFEOS_DIR/USER/CUSTOMIZATIONS/SKILLS/Webdesign/PREFERENCES.md` exists, read it after Step 0. Use it to bias (not bind) the register choice in Step 1. Without preferences, choose freshly each session and rotate registers across runs to avoid convergence on a single house style.

## Failure Modes

- **Skipping Step 0** — losing the doctrine and reverting to AI defaults. Always read the philosophy file first.
- **Skipping Step 1's explicit aesthetic declaration** — the model drifts into generic "modern clean" when the register isn't named on screen.
- **Picking the same register every session** — convergence is the AI-slop signal. Vary deliberately.
- **Saying `verified` without an Interceptor screenshot** — that is a doctrine violation in LifeOS. The screenshot is the verification.
- **Maximalism without commitment** — half-committed maximalism reads as cluttered. If you choose maximalist, *commit*: more layers, more motion, more density. Same for any register at any pole.
