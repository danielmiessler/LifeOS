# Visual Design Guide for Web Agent

**Purpose:** This guide provides typography, color, motion, and background reference for the web-agent when performing Workflow 5 (Design Creation) tasks. It implements Phase 1 improvements from the Lovable UI/UX analysis to prevent distributional convergence and create distinctive, high-quality web designs.

**Context:** This file is loaded on-demand during design creation workflows. It supplements but does not replace the core web-agent.md instruction set.

---

## Anti-Convergence Rules

Claude exhibits distributional convergence -- defaulting to "safe" patterns from training data. When creating new designs, actively combat this tendency.

### Banned Patterns (Creative Contexts)

**Fonts:** Never use Inter, Roboto, Arial, Open Sans, Lato, or system fonts for creative/brand work. These are acceptable ONLY when matching an existing design system that already uses them.

**Colors:** Never default to purple gradients on white backgrounds. Never use evenly-distributed color palettes (each color equally weighted).

**Layouts:** Never generate a predictable symmetric card grid as the default. Consider asymmetry, overlap, or unconventional composition.

**Meta-awareness:** You tend to converge on Space Grotesk, Inter, and blue-purple color schemes across generations. Actively vary choices.

### Variety Mandate

Each new design MUST differ from previous outputs in at least 2 of: font pairing, color palette, layout composition, background treatment.

### Declare Before Coding Protocol

Before writing any CSS, state:
- "Aesthetic direction: [X]"
- "Typography: [specific font pair]"
- "Dominant color: [specific HSL]"
- "Accent: [specific HSL]"
- "This is different from typical designs because: [specific differences]"

This forces intentional differentiation rather than pattern-matching.

---

## Typography Reference

### Font Recommendations by Aesthetic

| Aesthetic | Display Font | Body Font |
|-----------|-------------|-----------|
| Editorial | Playfair Display, Crimson Pro, Fraunces | Source Serif 4, Literata |
| Startup | Clash Display, Satoshi, Cabinet Grotesk | DM Sans, Plus Jakarta Sans |
| Technical | IBM Plex Sans, Source Sans 3 | IBM Plex Serif, Noto Sans |
| Distinctive | Bricolage Grotesque, Obviously, Newsreader | Outfit, General Sans |
| Code | JetBrains Mono, Fira Code | Space Grotesk, Inconsolata |
| Luxury | Cormorant, Italiana, Cinzel | Jost, Nunito Sans |

### Pairing Principles

- **High contrast = interesting:** serif + geometric sans, display + monospace
- **Use extreme weight contrast:** 200 vs 800, not 400 vs 600
- **Size jumps should be 2.5x+ between hierarchy levels,** not 1.5x
- **Pick ONE distinctive font** and use it decisively
- **Load from Google Fonts;** declare font choice before writing CSS

### Refined Position on Banned Fonts

Ban applies only to *creative contexts* (new designs, rebrandings). When working on an existing codebase, match whatever font the design system already uses, even if it is Inter. The key is intentionality: Inter chosen deliberately for a corporate design system is fine; Inter chosen because Claude defaulted to it is not.

---

## Color Palette Generation

### Dominant Colors with Sharp Accents

Choose a dominant color that covers most of the surface area. Add 1-2 accent colors at much smaller ratios. The accent should be visually surprising against the dominant -- not a neighboring shade, but a deliberate contrast.

### The 60-30-10 Rule (Safety Floor)

Use as a baseline for less experienced users:
- **60%** dominant color (backgrounds, large areas)
- **30%** secondary color (sections, cards, supporting elements)
- **10%** accent color (CTAs, highlights, interactive elements)

Dominant with sharp accent outperforms timid, equal-weight palettes.

### Token Architecture

Always use CSS custom properties for all design tokens:

```css
:root {
  --color-primary: hsl(222, 47%, 11%);
  --color-primary-foreground: hsl(210, 40%, 98%);
  --color-secondary: hsl(210, 40%, 96%);
  --color-accent: hsl(var(--accent-h), var(--accent-s), var(--accent-l));
  --color-muted: hsl(210, 40%, 96%);
  --color-destructive: hsl(0, 84%, 60%);
  --color-background: hsl(0, 0%, 100%);
  --color-foreground: hsl(222, 84%, 5%);
}
```

### Semantic Roles

Define colors by role, not by visual appearance:
- primary
- secondary
- accent
- muted
- destructive
- success
- warning
- info

**Never use raw hex/rgb in component styles** -- always reference tokens.

---

## Design Vocabulary Mapping

When the user describes a desired aesthetic, map buzzwords to parameters. Use this table as a starting reference, then adapt to context (fintech "premium" differs from restaurant "premium").

| Buzzword | Typography | Colors | Spacing | Shadows | Motion |
|----------|-----------|--------|---------|---------|--------|
| **Premium** | Serif headings, light weights | Muted, earth-toned | Generous (48-80px sections) | Subtle, multi-layer | Slow, refined (400ms+) |
| **Cinematic** | Bold sans-serif, dramatic scale | Dark base, neon accents | Dramatic, full-bleed | Deep, dramatic | Parallax, motion blur |
| **Playful** | Rounded sans, variable weights | Saturated, warm | Medium, bouncy | Soft, rounded | Spring, bounce easing |
| **Minimal** | Thin sans-serif, monospace accent | Monochrome + one accent | Extreme whitespace | Nearly none | Subtle fade only |
| **Brutalist** | Oversized mono, raw | Black/white + one spot color | Tight, grid-locked | None | None or jarring |
| **Editorial** | Serif display, careful spacing | Rich but restrained | Generous leading | Paper-like subtle | Smooth scroll |
| **Developer** | Mono + geometric sans | Dark, code-themed | Precise, grid-aligned | Elevated cards | Code-typing, cursor blink |

### Prompt-to-Visual Translation Protocol

When a user says "make it feel [X]":

1. **Identify the closest persona** from the five core personas (see below) or blend two
2. **Declare the chosen direction** before writing any CSS
3. **Select specific fonts, colors, and spacing** from the persona parameters
4. **Apply consistently** across all generated elements
5. **Self-critique:** Does this feel [X]? Is the aesthetic coherent? Am I defaulting to generic patterns?

---

## Five Core Design Personas

### Persona 1: Expressive & Fun

**Trigger phrases:** lively, cheerful, vibrant, energetic, playful, colorful, bouncy

- **Typography:** Rounded sans-serif (Nunito, Quicksand), variable weights, large display sizes
- **Colors:** Saturated warm palette, multiple accent colors, gradient CTAs
- **Spacing:** Medium density, generous padding on interactive elements
- **Shadows:** Soft, colored shadows (not gray), elevated cards
- **Motion:** Spring easing, bounce effects, playful hover transforms
- **Backgrounds:** Subtle color washes, confetti-like geometric accents

### Persona 2: Premium & Sleek

**Trigger phrases:** refined, elegant, luxury, premium, sophisticated, elevated, polished

- **Typography:** Serif headings (Cormorant, Crimson Pro), light body weights, generous letter-spacing
- **Colors:** Muted earth tones, champagne/gold accents, deep navy or charcoal
- **Spacing:** Generous whitespace (64-96px sections), deliberate emptiness
- **Shadows:** Multi-layer subtle shadows, glass-morphism panels
- **Motion:** Slow, refined transitions (400ms+), parallax scrolling
- **Backgrounds:** Frosted glass, translucent overlays, grain texture

### Persona 3: Futuristic & Cinematic

**Trigger phrases:** futuristic, sci-fi, cinematic, dark UI, neon, cosmic, dramatic

- **Typography:** Geometric sans-serif (Outfit, Space Grotesk), extreme weight contrasts, all-caps headings
- **Colors:** Dark base (#0a0a0f), neon accents (cyan, magenta), electric gradients
- **Spacing:** Full-bleed hero, dramatic scale contrasts between sections
- **Shadows:** Glow effects (colored box-shadows), neon outlines
- **Motion:** Glitch effects, typing animations, particle-like accents
- **Backgrounds:** Deep-space gradients, star fields, grid overlays, scan lines

### Persona 4: Minimal & Focused

**Trigger phrases:** minimal, clean, simple, quiet, frictionless, zen, distraction-free

- **Typography:** Thin sans-serif (Jost, Inter Light), monospace accents, extreme whitespace around text
- **Colors:** Near-monochrome, one muted accent color, gray scale hierarchy
- **Spacing:** Extreme whitespace, single-column content, generous line-height (1.8+)
- **Shadows:** Nearly none -- borders or hairlines only
- **Motion:** Subtle opacity fades only, no transforms
- **Backgrounds:** Pure white or near-white, no textures or gradients

### Persona 5: Bold & Disruptive

**Trigger phrases:** bold, disruptive, brutalist, raw, impactful, aggressive, striking

- **Typography:** Oversized headings (120px+), monospace body, extreme weight contrasts
- **Colors:** Black and white with one spot color, no gradients
- **Spacing:** Tight grid, dense information, minimal margins
- **Shadows:** None -- hard edges, solid borders
- **Motion:** None, or intentionally jarring (instant show/hide)
- **Backgrounds:** Solid blocks of color, halftone patterns, raw texture

---

## Motion & Animation Guide

### Core Principle

**Choreograph, do not scatter.** One well-orchestrated page load with staggered reveals creates more delight than scattered micro-interactions.

Design ONE animation sequence for the page, not individual element animations. The sequence should have a clear order:
1. Hero content appears first
2. Supporting content reveals in sequence (100ms delays)
3. Interactive elements become active

Every animation should serve the narrative of the page.

### Page Load Pattern (CSS-only)

```css
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-in {
  animation: fadeInUp 0.6s ease-out both;
}
.animate-in:nth-child(1) { animation-delay: 0.1s; }
.animate-in:nth-child(2) { animation-delay: 0.2s; }
.animate-in:nth-child(3) { animation-delay: 0.3s; }
```

### Hover State Design

- **Buttons:** scale(1.02) + shadow elevation + color shift (150ms ease)
- **Cards:** translateY(-4px) + shadow expansion (200ms ease-out)
- **Links:** underline animation or color transition (120ms)
- **Images:** subtle scale(1.05) with overflow hidden (300ms ease)

### Timing Reference

| Element | Duration | Easing | Notes |
|---------|----------|--------|-------|
| Button press | 100-150ms | ease | Immediate feedback |
| Hover state | 150-200ms | ease-out | Quick but noticeable |
| Modal open | 200-300ms | ease-out | Smooth entry |
| Page transition | 300-500ms | ease-in-out | Deliberate |
| Loading skeleton | 1.5-2s loop | ease-in-out | Continuous pulse |

### Always Include Reduced Motion Support

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Background & Atmosphere Guide

### Core Principle

Create atmosphere and depth rather than defaulting to solid colors.

### Atmospheric Usage Strategy

**Reserve atmospheric backgrounds for:**
- Hero sections
- Full-bleed dividers

**Use clean, solid backgrounds for:**
- Content-heavy sections (feature lists, pricing, FAQ)
- Areas requiring high readability

**Rule:** Atmosphere at entry points, clarity at content points.

### Techniques (CSS-only, no dependencies)

1. **Gradient mesh:** Multiple radial-gradients layered
2. **Noise texture:** SVG filter or CSS grain overlay
3. **Geometric pattern:** Repeating CSS gradients as patterns
4. **Layered transparency:** Overlapping semi-transparent shapes
5. **Subtle grid:** Faint grid lines via repeating-linear-gradient

### Example: Atmospheric Hero Background

```css
.hero {
  background:
    radial-gradient(ellipse at 20% 80%, hsla(220,60%,50%,0.12) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 20%, hsla(340,60%,50%,0.08) 0%, transparent 50%),
    linear-gradient(to bottom, hsl(0,0%,98%), hsl(0,0%,96%));
}
```

### When NOT to Add Atmosphere

- When matching an existing minimal design system
- When the aesthetic direction is explicitly "flat" or "brutalist"
- When performance is critical (prefer solid colors for above-fold LCP)

---

## Spatial Composition (Graduated Scale)

### Level 1 (Default -- Always Safe)

- Consistent grid
- Rhythmic spacing
- Symmetric layouts

Use this as the default approach.

### Level 2 (When Aesthetic Direction Calls for It)

Introduce **one asymmetric element per section:**
- An offset image
- An angled divider
- An overlapping card

### Level 3 (Editorial/Brutalist Personas Only)

Full asymmetric composition with:
- Overlapping layers
- Broken grid
- Diagonal flows
- Controlled density vs. generous negative space

Only escalate to Level 3 when the chosen aesthetic persona demands it.

---

## Integration Notes

### When to Load This Guide

The web-agent should load this guide ONLY during:
- **Workflow 5: Design Creation** tasks
- When the user explicitly requests design work using mood/feel descriptions
- When creating new pages or components from scratch

### When NOT to Load This Guide

Do NOT load for:
- **Workflow 1: Full Audit** (auditing existing designs)
- **Workflow 3: Content Modification** (changing text/sections)
- **Workflow 4: Layout & Spacing Fix** (fixing alignment issues)
- **Workflow 6: Privacy & Anti-Spam** (adding CAPTCHA, hiding emails)
- **Workflow 7: Validation** (checking accessibility, HTML validity)

### Relationship to Core web-agent.md

This guide supplements the core web-agent instructions. It does NOT replace:
- The workflow router
- Safety rules
- Accessibility requirements
- Privacy defaults
- Validation protocols

When conflicts arise, defer to core web-agent.md for process and safety rules. Use this guide for visual design decisions only.

---

## Self-Critique Checklist for Design Creation

Before delivering any design, verify:

- [ ] Have I declared the aesthetic direction before writing CSS?
- [ ] Have I avoided banned fonts (unless matching existing system)?
- [ ] Does the color palette have a dominant color with sharp accents?
- [ ] Have I chosen fonts that are distinctive and appropriate for the aesthetic?
- [ ] Is the motion choreographed as a page sequence, not scattered effects?
- [ ] Are atmospheric backgrounds used only at entry points, not content-heavy areas?
- [ ] Does this design differ from typical AI-generated outputs in at least 2 dimensions?
- [ ] Have I referenced design tokens (CSS custom properties) instead of raw hex values?
- [ ] Is `prefers-reduced-motion` included if any animations exist?
- [ ] Have I applied the chosen aesthetic persona consistently across all elements?

---

**End of Visual Design Guide**

This guide represents Phase 1 improvements from the Lovable UI/UX analysis (2026-03-30). It provides the web-agent with typography, color, motion, and background reference to create distinctive, high-quality designs while preventing distributional convergence to generic patterns.
