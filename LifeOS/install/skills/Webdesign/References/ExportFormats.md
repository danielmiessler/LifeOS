# Export Formats

Decision matrix for choosing the right export from Claude Design.

## Format Quick Reference

| Format | When to use | Output type | Further processing |
|--------|-------------|-------------|-------------------|
| **Internal URL** | Async review, team feedback | Shareable claude.ai URL | None — view-only |
| **Canva** | Collaborative editing, marketing | Editable Canva project | Canva UI |
| **Bundle** | Production code pipeline | Directory with PROMPT.md + assets + scaffolding | `frontend-design` plugin |
| **Standalone HTML** | One-off landing page, static hosting | Single `index.html` + assets | Minimal |
| **PDF** | Client deliverable, print | Rendered PDF | None |
| **PPTX** | Slide deck presentation | PowerPoint file | Further edit in PPT/Keynote |
| **Folder** | Local file archive | Directory of assets | Manual processing |
| **Platform handoff** | Push straight to another tool | Direct export to Vercel, Replit, Lovable, Wix, Base44, Gamma, Miro, Adobe | That platform's UI |

The June 2026 update expanded the export picker with direct destinations: **Adobe, Base44, Canva, Gamma, Lovable, Miro, Replit, Vercel, Wix** alongside PDF and PPTX. For LifeOS code work the **Bundle** export is still the right call — those platform destinations are for handing off to a non-LifeOS tool, not for landing code in your own repo.

## Decision Tree

```
Q: What's the next step after export?
│
├─ Review / feedback → Internal URL
│
├─ Non-developer will edit → Canva
│
├─ Production code in an existing app → Bundle → IntegrateIntoApp
│
├─ Production code, new standalone app → Bundle → ExportToCode → DeployDesign
│
├─ Static one-off page → Standalone HTML → DeployDesign
│
├─ Client presentation → PDF or PPTX
│
└─ Archive / keep locally → Folder
```

## Bundle Format (Most Important)

The handoff bundle is the load-bearing output when code is the destination. Structure:

```
bundle/
├── PROMPT.md                    # Structured brief for Claude Code
├── tokens.json                  # Design tokens (colors, typography, spacing)
├── preview.html                 # Static preview render
├── components/                  # Component scaffolds
│   ├── button.tsx
│   ├── card.tsx
│   └── ...
├── assets/                      # Images, fonts, icons
│   ├── logo.svg
│   ├── fonts/
│   └── images/
└── README.md                    # Bundle metadata
```

### PROMPT.md — the heart of the bundle

Contains:
- Project purpose + audience
- Aesthetic direction chosen
- Framework target and conventions
- Section-by-section breakdown
- Component inventory needed
- Explicit instructions for the `frontend-design` plugin

When you feed the bundle to Claude Code, the plugin reads PROMPT.md first. Everything else is context.

### tokens.json — machine-readable design tokens

```json
{
  "color": {
    "primary": { "50": "#...", "500": "#...", "900": "#..." },
    "neutral": { "50": "#...", ...},
    "accent": { ...}
  },
  "typography": {
    "display": { "family": "...", "scale": [...] },
    "body": { "family": "...", "scale": [...] },
    "mono": { "family": "...", "scale": [...] }
  },
  "spacing": { "unit": 4, "scale": [0,4,8,12,16,24,32,48,64,96] },
  "radius": { ... },
  "shadow": { ... }
}
```

Framework translators read this directly. Tailwind configs, Styled Components themes, CSS custom properties all derive from this.

## HTML Export Caveats

Standalone HTML export is a single file with inlined CSS and (usually) inlined JS. It's great for:
- Static hosts (Cloudflare Pages, Netlify, S3)
- Email-embedded prototypes
- One-off landing pages

It's NOT suitable for:
- Integration into a component-based framework
- Dynamic content / data-fetching
- Multi-page sites (no routing)

For anything beyond a single static page, use **Bundle** instead.

## Canva Export Caveats

Canva exports produce an editable Canva design that preserves:
- Layout structure (as Canva layers)
- Typography (mapped to Canva's font library — may need substitution)
- Color palette (as Canva color swatches)
- Imagery (as Canva-uploaded assets)

Canva is the right export when:
- A non-developer (marketer, founder, designer) needs to refine the design
- Print output is planned (Canva handles CMYK + bleed)
- The design is for social / marketing collateral, not software

Canva is NOT the right export when code is the destination — the round-trip from Canva back to code is lossy.

## PDF vs PPTX

| If you need... | Use |
|----------------|-----|
| Single-page client deliverable | PDF |
| Print-ready file | PDF |
| Linear slide deck (intro → content → CTA) | PPTX |
| Presentation that will be further edited in PowerPoint/Keynote | PPTX |
| Fidelity to the Claude Design artifact | PDF (locks appearance) |
| Editable-after-export | PPTX (modifiable slides) |

## Token-Only Export

For tight hand-offs where the user will write the code themselves, export just `tokens.json`:

```bash
bun "${LIFEOS_ROOT}/skills/Webdesign/Tools/DriveClaudeDesign.ts" export tokens path/to/out.json
```

This is useful when:
- The development team prefers to write their own components
- You only need to establish the design system, not the implementation
- Integration is token-only (see `IntegrateIntoApp.md` → mode: token-only)

## Format Combinations

Sometimes one artifact needs multiple exports:

| Stakeholders | Exports to provide |
|--------------|-------------------|
| Developer + marketer | Bundle + Canva |
| Developer + designer review | Bundle + Internal URL |
| Client + developer | PDF + Bundle |
| Internal presentation + follow-on build | PPTX + Bundle |

Run multiple export commands in sequence; Claude Design re-renders each format on demand.
