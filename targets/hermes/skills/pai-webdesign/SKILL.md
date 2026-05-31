---
name: pai-webdesign
description: "Web and UI design pipeline — create interactive prototypes, extract design systems from existing sites, and export to production-ready code (HTML/CSS/Tailwind/React)."
version: 5.0.0
author: PAI v5 Hermes Port
use_when: "You need to design a web page or UI — create a prototype, extract an existing site's design system, or convert designs to code (HTML/CSS/Tailwind/React components)."
not_for: "Graphic design tools exports (Figma/Sketch); animation-heavy motion design; photo manipulation."
tags: [web, design, UI, prototype, tailwind, react, design-system]
---

# pai-webdesign: Web & UI Design Pipeline

## Workflow Routing

| Trigger | Route |
|---------|-------|
| User wants a new page/site design | Gather requirements → wireframe → prototype → code export |
| User wants to analyze an existing site | Navigate to URL → extract design system → report |
| User wants to convert design to code | Accept description/screenshot → generate components → export |
| User wants to redesign a page | Extract current design → propose changes → generate new version |
| User wants a design system | Extract colors, typography, spacing → document → code |

## Step-by-Step Procedures

### 1. Create Prototype (New Design)
```
1. Gather design requirements:
   a. Purpose: landing page, dashboard, blog, e-commerce, etc.
   b. Brand: colors (primary/accent), fonts, logo description
   c. Pages: list of pages/sections needed
   d. Content: key copy, images, calls-to-action
   e. Target: desktop, mobile, or responsive
2. Generate wireframe (low-fidelity):
   a. Create HTML with placeholder content
   b. Grayscale layout showing hierarchy
   c. Box-model structure (header, nav, main, sidebar, footer)
   d. Focus on layout and information architecture
3. Generate high-fidelity prototype:
   a. Apply chosen color scheme and typography
   b. Use CSS Grid or Flexbox for layouts
   c. Add interactive elements (hover states, transitions)
   d. Implement responsive breakpoints
4. Present prototype with navigation flow
5. Iterate based on feedback
```

### 2. Extract Design System (From Existing Site)
```
1. Navigate to target URL:
   a. browser_navigate(url)
   b. browser_snapshot() to capture state
2. Extract color palette:
   a. Parse CSS for color declarations (hex, rgb, hsl)
   b. Identify primary, secondary, accent, neutral, surface colors
   c. Use browser_vision() to identify dominant colors visually
   d. Group by usage: backgrounds, text, borders, buttons
3. Extract typography:
   a. Identify font families (Google Fonts, system fonts, @font-face)
   b. Extract font sizes, weights, line heights
   c. Note heading hierarchy (h1-h6 sizes)
   d. Identify font pairings (heading + body)
4. Extract spacing/sizing:
   a. Parse CSS for margin, padding values
   b. Identify grid/gap values
   c. Note common border-radius values
   d. Extract shadow/box-shadow values
5. Extract component styles:
   a. Buttons: normal, hover, active, disabled states
   b. Inputs: default, focus, error states
   c. Cards/panels: padding, shadows, backgrounds
   d. Links: default, hover, visited, active
6. Compile design system document:
   - Color palette with usage examples
   - Typography scale
   - Spacing scale
   - Component library (code snippets)
   - CSS custom properties / design tokens
```

### 3. Export to Code
```
1. Choose output framework:
   a. Pure HTML + CSS (no framework)
   b. HTML + Tailwind CSS (utility-first)
   c. React components (JSX + CSS modules / styled-components)
   d. Vue components (SFC format)
2. Generate component structure:
   - Break design into reusable components
   - Create component hierarchy (pages → sections → elements)
3. For each component:
   a. Generate semantic HTML/JSX
   b. Apply styles (CSS classes, Tailwind, or CSS-in-JS)
   c. Add responsive variants
   d. Add interactive states (hover, focus, active)
4. For Tailwind export:
   a. Generate tailwind.config.js with design tokens
   b. Use @apply for repeated patterns (optional)
   c. Use responsive prefixes (sm:, md:, lg:)
5. For React export:
   a. Create component files (.tsx/.jsx)
   b. Export props interface/types
   c. Use React hooks for state/interactivity
   d. CSS modules or styled-components for styling
6. Package output:
   - src/ directory structure
   - Component files
   - Styles/tokens
   - Example page composition
```

### 4. Redesign Workflow
```
1. Extract design system from existing site (see #2)
2. Identify improvement areas:
   a. Accessibility issues (contrast, font size, focus states)
   b. Usability issues (confusing layout, missing navigation)
   c. Aesthetic improvements (dated styles, inconsistent spacing)
   d. Performance (heavy assets, excessive CSS)
3. Propose specific changes with rationale
4. Implement changes:
   a. Modify CSS/design tokens
   b. Restructure layout if needed
   c. Generate updated prototype
5. Compare before/after
6. Export updated code
```

### 5. Responsive Design Check
```
1. Generate prototype at default size (desktop)
2. Create responsive variants:
   - Desktop: >1024px (full layout)
   - Tablet: 768-1024px (2-column, collapsed sidebar)
   - Mobile: <768px (single column, hamburger menu)
   - Small mobile: <480px (compact everything)
3. For each breakpoint:
   a. Adjust grid layout
   b. Resize typography
   c. Stack elements vertically
   d. Show/hide non-essential elements
4. Generate responsive test view
```

## Gotchas

- Design system extraction only captures inline/referenced styles; dynamic CSS-in-JS may be missed
- Extracted colors include system/UI colors (scrollbars, form elements) — filter these out
- Tailwind export requires understanding of Tailwind utility classes
- Prototypes are HTML/CSS, not Figma/Sketch files
- Font extraction may miss Google Fonts if loaded dynamically
- Responsive design is not automatic — each breakpoint needs explicit handling
- Color palette from vision analysis is approximate; verify against actual CSS
- Component hierarchy decisions affect maintainability; prefer small, focused components
- Design-to-code conversion loses some visual fidelity; review and adjust
- Mobile-first approach is preferred for responsive designs

## Execution Log Pattern

```
[PAI-WEBDESIGN] Mode: Create Prototype (Landing Page)
[REQ] Gathered: brand colors (#2563eb, #f59e0b), font: Inter, 4 sections
[WIRE] Generated wireframe layout (header, hero, features, CTA, footer)
[PROTO] High-fidelity prototype with animations and hover states
[CODE] Exporting to Tailwind CSS + React
[COMP] Generated: 8 components, tailwind.config.js, 1 example page
[RESP] Responsive breakpoints: sm(640), md(768), lg(1024), xl(1280)
[COMPLETE] Design pipeline completed in 17.3s
```
