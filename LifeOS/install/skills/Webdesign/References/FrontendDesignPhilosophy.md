# Frontend Design Philosophy

> **Attribution.** The aesthetic doctrine in this file is mirrored from Anthropic's open-source `frontend-design` skill, MIT-licensed.
> Source: https://github.com/anthropics/skills/tree/main/skills/frontend-design
> Authors: Prithvi Rajasekaran, Alexander Bricken (Anthropic).
> License: MIT (see Webdesign/References/FrontendDesignPhilosophy.LICENSE.txt for full terms).
> Imported: 2026-05-08. Webdesign-specific extensions appear under "LifeOS Extensions" sections, clearly marked.

This file is the load-bearing reference for the **DirectDesign** workflow. The DirectDesign workflow is short — it routes to this file for the actual aesthetic content.

---

## Core Doctrine — Read First

Build distinctive, production-grade frontend interfaces that **avoid generic "AI slop" aesthetics**. Implement real working code with exceptional attention to aesthetic details and creative choices.

The user provides frontend requirements: a component, page, application, or interface to build. They may include context about the purpose, audience, or technical constraints. Your job is to interpret that brief through a deliberate aesthetic lens and ship code that *commits* to it.

---

## Step 1 — Design Thinking (BEFORE writing any code)

Commit to a BOLD aesthetic direction. Answer these in order:

- **Purpose** — What problem does this interface solve? Who uses it?
- **Tone** — Pick an extreme. Do not pick "modern" or "clean" or "professional" — those are non-choices. Choose from a real register:
  - **Brutally minimal** — type, white space, almost no color, ruthless discipline
  - **Maximalist chaos** — layered, dense, controlled overload, magazine-spread energy
  - **Retro-futuristic** — 80s sci-fi, scanlines, CRT glow, vector-line illustrations
  - **Organic / natural** — irregular shapes, hand-feel, soft edges, paper textures
  - **Luxury / refined** — generous space, restrained palette, exquisite typography, slow motion
  - **Playful / toy-like** — saturated color, chunky type, bouncy springs, oversized shapes
  - **Editorial / magazine** — serif display, asymmetric grid, rule lines, body-text discipline
  - **Brutalist / raw** — concrete textures, monospace, exposed grids, deliberate ugliness
  - **Art deco / geometric** — symmetry, gold/black, fan motifs, axial composition
  - **Soft / pastel** — washed palette, rounded corners, gentle shadows, breathable layouts
  - **Industrial / utilitarian** — high-contrast, monospace, grid-locked, dieter-rams discipline
  - **Glassmorphic / aurora** — translucent layers, blurred backdrops, gradient washes (deploy carefully — this is the cliché trap)
  - **Swiss / international** — Helvetica family, strict grid, red accent, rationalist
  - **Y2K / chrome** — bevels, gradients, Word-Art adjacent, controlled-tasteless
  - **Solar-punk / organic-futurism** — plants + tech, warm + lush, optimistic
  - **Cyberpunk / neon** — saturated cyan/magenta, scan effects, slab type, urban
  - **Ghibli / hand-illustrated** — gentle gradients, soft suns, layered scenery, narrative warmth
  - **Memphis / 80s graphic** — squiggle, polka dot, jazz triangles, primary color
  - **Dark academia** — leather, brass, serif, oxblood, antique map textures
  - **Or design one true to the brief** — these are inspiration, not a closed list

- **Constraints** — Technical requirements (framework, performance, accessibility, mobile breakpoints, dark/light, language support).
- **Differentiation** — What makes this UNFORGETTABLE? What's the ONE thing someone will remember an hour later?

**CRITICAL:** Choose a clear conceptual direction and execute it with precision. *Bold maximalism and refined minimalism both work* — the key is intentionality, not intensity. A perfectly executed minimalist page beats a half-committed maximalist page every time.

---

## Step 2 — Implement working code

Then write working code (HTML/CSS/JS, React, Vue, Astro, whatever the brief calls for) that is:

- **Production-grade** — runs, validates, ships, no placeholder lorem ipsum unless that *is* the design joke
- **Visually striking** — memorable on first look
- **Cohesive** — every detail serves the chosen aesthetic point-of-view
- **Meticulously refined** — every spacing decision deliberate, every type ramp considered, every interaction polished

---

## Frontend Aesthetics Guidelines

### Typography

Choose fonts that are **beautiful, unique, and interesting**. Avoid generic fonts like Arial, Inter, system-ui — opt instead for distinctive choices that elevate the frontend's aesthetics. Pair a distinctive **display** font with a refined **body** font.

**Pair recipes by aesthetic register:**

| Register | Display | Body | Mono |
|----------|---------|------|------|
| Editorial | GT Sectra, Playfair Display, Canela, Söhne Breit | Söhne, Tiempos Text, Lyon Text | Söhne Mono |
| Brutalist | Neue Haas Grotesk, Suisse Int'l Mono, Berthold Akzidenz | IBM Plex Sans, Inter (only here, ironically), JetBrains Mono | JetBrains Mono, Berkeley Mono |
| Retro-futuristic | VT323, Major Mono, Departure Mono | Space Mono, IBM Plex Mono | IBM Plex Mono |
| Maximalist | Migra, Migra Italic, Druk, Reckless | Untitled Sans, Söhne | Berkeley Mono |
| Luxury | Canela, Söhne Breit, Editor's Note | Tiempos Text, Söhne | — |
| Playful | Migra Italic, Reckless Neue, Recoleta | DM Sans, Söhne | Mono Lisa |
| Swiss | Neue Haas Grotesk, Helvetica Now | Helvetica Now Text, Söhne | — |
| Y2K / chrome | Druk Wide, Migra, Heroic Condensed | Söhne Breit, Söhne | — |
| Cyberpunk | Druk, JetBrains Mono Bold, Departure Mono | Inter Tight, IBM Plex Sans | JetBrains Mono |
| Dark academia | EB Garamond, Cormorant, IM Fell | Cormorant, EB Garamond, Lora | — |
| Solar-punk | Reckless, Cooper, Recoleta | Söhne, DM Sans | — |
| Hand-illustrated | Caveat, Borel, Reenie Beanie | Söhne, Newsreader | — |

**Free / open-source equivalents** (when license matters): Fraunces (Editorial), Space Grotesk *use sparingly — overused*, JetBrains Mono, Newsreader, EB Garamond, Reckless, Cooper Hewitt, Public Sans. Google Fonts has all of these.

**NEVER converge on common choices.** Space Grotesk is overused — vary it. Inter on white is the AI-slop tell. Switch.

### Color & Theme

Commit to a cohesive aesthetic. Use CSS variables for consistency across components. **Dominant colors with sharp accents outperform timid, evenly-distributed palettes.**

- **One accent color** — and one only, deployed with restraint
- **Restrained core palette** — three to five hues, not twelve
- **Contrast targets** — body text WCAG AAA on a primary-content surface, AA on accent surfaces; never ship muddy gray-on-gray
- **Vary between light and dark themes across generations** — don't default to dark mode every time, don't default to light mode every time

**Cliché traps to avoid:**
- Purple gradient on white (the AI-slop signature)
- Cyan-to-pink "vaporwave" gradients on hero sections without earning them
- Black + red "tech-startup" combo with no other commitment
- Gray-on-white "professional" — this is the absence of a choice

### Motion & Animation

Use animations for effects and micro-interactions. Prioritize:

- **CSS-only solutions** when working with HTML
- **Motion library** (`framer-motion`, now `motion` package) for React when available
- **GSAP** for elaborate timeline-driven sequences

Focus on **high-impact moments**: one well-orchestrated page load with staggered reveals (`animation-delay` cascade) creates more delight than scattered micro-interactions everywhere. Use scroll-triggering and hover states that surprise.

**Timing language:**

| Use | Duration | Easing |
|-----|----------|--------|
| Hover state changes | 150-200ms | `ease-out` / `cubic-bezier(0.16, 1, 0.3, 1)` |
| Modal / sheet open | 250-400ms | `ease-out` / spring |
| Page-transition reveals | 600-1200ms | spring or custom cubic-bezier |
| Hero / decorative loops | 4-12s | linear or sinusoidal |
| Scroll-triggered reveals | 600-900ms with 80ms stagger | `ease-out` |

**What NOT to animate:**
- Body text (never — it shouldn't move while being read)
- Form labels / inputs (snap, don't fade)
- Anything that delays user action by >300ms without payoff
- Random elements "to be nice" — every animation must have intent

### Spatial Composition

Unexpected layouts. Asymmetry. Overlap. Diagonal flow. Grid-breaking elements. Generous negative space OR controlled density.

Predictable centered-column layouts read as "AI default." Break the grid intentionally — anchor type to a baseline, then let one element violate it dramatically.

### Backgrounds & Visual Details

Create atmosphere and depth rather than defaulting to solid colors. Add contextual effects and textures that match the overall aesthetic. Apply creative forms like:

- **Gradient meshes** (CSS conic-gradient, radial-gradient layers)
- **Noise textures** (SVG turbulence, repeating PNGs at low opacity)
- **Geometric patterns** (CSS-drawn or SVG)
- **Layered transparencies** (background-blend-mode magic)
- **Dramatic shadows** (multi-layer box-shadow, not the default `0 2px 4px rgba(0,0,0,0.1)` AI-tell)
- **Decorative borders** (thick, colored, asymmetric)
- **Custom cursors** (when the aesthetic earns it)
- **Grain overlays** (SVG noise at 8-15% opacity)

### Forbidden Defaults (the AI-slop list)

Generic AI-generated aesthetics — refuse them unless the chosen aesthetic *explicitly* calls for them:

- **Fonts:** Inter, Roboto, Arial, Helvetica (default), system-ui, sans-serif
- **Colors:** Purple gradient on white, indigo-to-pink, default Tailwind gray-100/gray-900 only
- **Layouts:** Centered card on flat color, hero + 3-column features + CTA, default Tailwind UI templates
- **Components:** shadcn defaults shipped without aesthetic customization, lucide-react icons used without scale/stroke variation
- **Shadows:** `shadow-md` and `shadow-lg` Tailwind defaults
- **Border radius:** Uniform `rounded-lg` everywhere
- **Spacing:** Default Tailwind `space-y-4` rhythm without intent

Refuse to converge on common choices across generations. Vary between light and dark themes, different fonts, different aesthetics. Each design should feel genuinely designed for *this* context — not interchangeable with the last one.

---

## Implementation Complexity Match

**Match implementation complexity to the aesthetic vision.**

- **Maximalist designs** need elaborate code: extensive animations, layered effects, multiple gradients, scroll-jacking, custom cursors, audio-visual pairings
- **Minimalist or refined designs** need restraint: precision spacing, careful typography ramp, subtle hover states, and disciplined absence of decoration

**Elegance comes from executing the vision well, not from defaulting to "clean."**

---

## What "Done" Looks Like

A page is done when:

1. The aesthetic register is **immediately legible** — a designer could name it within 3 seconds of seeing the page
2. **Typography is intentional** — display + body + mono pair is named, not default
3. **Color is committed** — palette stated, contrast verified, accent restrained
4. **Motion is purposeful** — every animation can be defended with a one-sentence reason
5. **Spatial composition has a point of view** — the layout is not a generic stack
6. **Backgrounds have texture or depth** — solid white/black is a *choice*, not a default
7. **Code is production-grade** — runs without errors, passes basic a11y, no lorem placeholders
8. **Differentiation is named** — there is one memorable element you can point at

---

## LifeOS Extensions

These extensions are LifeOS-specific (not in the upstream Anthropic source). They handle integration into the wider LifeOS workflow.

### Output Contract — declared up front

Before writing code, name the deliverable shape so the consumer knows what they get:

- `single-file-html` — one `.html` with `<style>` and `<script>` inline (most portable, fastest review)
- `react-tailwind` — `.tsx` component(s) using Tailwind v4 + framer-motion / motion
- `astro-component` — `.astro` for content sites
- `vue-sfc` — `.vue` single-file component
- `framework-matched-diff` — patches against an existing app (uses IntegrateIntoApp pattern)

The deliverable shape is chosen *before* coding, not after. Mismatch between deliverable and consumer breaks integration silently.

### Verification — Interceptor screenshot

Web output gets verified via the **Interceptor skill** before declaring done. This is non-negotiable: real Chrome catches the rendering issues that "code looks right" misses. `Skill("Interceptor")` → screenshot the rendered output → confirm visual fidelity.

### Customization layer

LifeOS users may set personal aesthetic defaults at `$LIFEOS_DIR/USER/CUSTOMIZATIONS/SKILLS/Webdesign/PREFERENCES.md`. If that file exists and DirectDesign is invoked, Step 1's aesthetic-tone choice is biased toward (not bound to) the user's stated preference. Without preferences, choose freshly each time and rotate registers across sessions.

### When to choose DirectDesign vs ClaudeDesign

| Choose **DirectDesign** when… | Choose **ClaudeDesign** when… |
|------------------------------|-------------------------------|
| Speed matters more than polish | Polish matters more than speed |
| Output lands inside an existing codebase as code | Output is a shareable prototype with stakeholders |
| The brief is short, ad-hoc, exploratory | The brief is multi-page, multi-state, productionable |
| Network round-trip is a friction (offline, sandboxed) | Network and claude.ai access are available |
| You want one fast pass with clear aesthetic intent | You want iterative refinement against a visual surface |
| Result will be reviewed in code | Result will be reviewed visually first |

Both paths share this file's aesthetic doctrine. They differ in *who renders the design* — DirectDesign is {{DA_NAME}} writing code with this doctrine loaded; ClaudeDesign is Anthropic's claude.ai/design surface, which we drive live at whatever version is current.
