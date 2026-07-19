# Handoff Bundle Specification

Reference for the structure and semantics of a Claude Design → Claude Code handoff bundle.

## Bundle Layout

```
<bundle-root>/
├── PROMPT.md                    # REQUIRED. Structured brief for the frontend-design plugin.
├── tokens.json                  # REQUIRED. Design tokens in JSON.
├── preview.html                 # REQUIRED. Static preview render.
├── README.md                    # RECOMMENDED. Bundle metadata.
├── manifest.json                # RECOMMENDED. Framework + version metadata.
├── components/                  # OPTIONAL. Component scaffolds.
│   └── <component>.{tsx,jsx,vue,astro,html}
├── pages/                       # OPTIONAL. Page scaffolds (multi-page bundles).
│   └── <route>.{tsx,jsx,vue,astro,html}
├── assets/                      # OPTIONAL. Binary assets.
│   ├── images/
│   ├── fonts/
│   ├── icons/
│   └── logos/
└── integration/                 # OPTIONAL. Framework-specific config.
    ├── tailwind.config.ts
    ├── astro.config.mjs
    └── ...
```

## File Semantics

### PROMPT.md

Frontmatter + structured markdown body. This is the primary contract between Claude Design and the code consumer.

```markdown
---
generated_by: claude-design
generated_at: 2026-04-18T20:00:00Z
claude_design_session: <uuid>
framework: astro
design_system: <name-or-default>
handoff_type: full | partial | token-only
---

# Project Purpose

One paragraph describing what this interface is for.

# Audience

Who uses this, primary jobs-to-be-done.

# Aesthetic Direction

The chosen aesthetic (brutalist, editorial, retro-futuristic, etc.) with rationale.

# Framework Target

The target framework and any version constraints. Existing project path if integrating.

# Sections

For a page:
- Section 1: purpose + key elements
- Section 2: purpose + key elements
- ...

For a component:
- Purpose
- Props / variants
- States (default / hover / focus / active / disabled)

# Component Inventory

List of components this bundle scaffolds or references.

# Integration Notes

Specific instructions for the code consumer. Token overrides, expected imports, responsive breakpoints, a11y requirements, dark-mode behavior.

# Must-Preserve

Any copy, structure, or elements that MUST land verbatim in the final code.

# Must-NOT

Anti-requirements. Patterns or elements explicitly forbidden.
```

### tokens.json

Design tokens in a framework-agnostic JSON schema. Consumers translate to their format.

```json
{
  "$schema": "https://claude.ai/design/tokens.schema.json",
  "version": "1",
  "metadata": {
    "name": "<design-system-name>",
    "source": "claude-design",
    "generated_at": "ISO8601"
  },
  "color": {
    "primary": { "50": "#f0f9ff", "500": "#0ea5e9", "900": "#0c4a6e" },
    "neutral": { "0": "#ffffff", "50": "#fafafa", "100": "#f5f5f5", "900": "#111111", "1000": "#000000" },
    "accent": { "500": "#f59e0b" },
    "semantic": {
      "success": "#10b981",
      "warning": "#f59e0b",
      "error": "#ef4444",
      "info": "#3b82f6"
    }
  },
  "typography": {
    "display": {
      "family": "Fraunces",
      "weights": [400, 600, 800],
      "scale": { "sm": 24, "md": 32, "lg": 48, "xl": 64, "2xl": 96 }
    },
    "body": {
      "family": "Inter Tight",
      "weights": [400, 500, 700],
      "scale": { "xs": 12, "sm": 14, "md": 16, "lg": 18, "xl": 20 },
      "lineHeight": { "tight": 1.2, "normal": 1.5, "loose": 1.75 }
    },
    "mono": {
      "family": "JetBrains Mono",
      "weights": [400, 500],
      "scale": { "sm": 12, "md": 14, "lg": 16 }
    }
  },
  "spacing": {
    "unit": 4,
    "scale": [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128]
  },
  "radius": { "none": 0, "sm": 2, "md": 6, "lg": 12, "xl": 24, "full": 9999 },
  "shadow": {
    "sm": "0 1px 2px rgba(0,0,0,0.05)",
    "md": "0 4px 8px rgba(0,0,0,0.08)",
    "lg": "0 12px 24px rgba(0,0,0,0.12)"
  },
  "motion": {
    "duration": { "fast": 150, "normal": 250, "slow": 400 },
    "easing": {
      "standard": "cubic-bezier(0.4, 0, 0.2, 1)",
      "enter": "cubic-bezier(0, 0, 0.2, 1)",
      "exit": "cubic-bezier(0.4, 0, 1, 1)"
    }
  }
}
```

### preview.html

A single-file static render that approximates the final design. Useful for:
- Visual diff against generated code
- Fallback when framework translation fails
- Email attachment for stakeholder review

NOT suitable as production code — it is not responsive beyond what Claude Design could inline, and it has no framework integration.

### manifest.json

```json
{
  "$schema": "https://claude.ai/design/manifest.schema.json",
  "version": "1",
  "framework": {
    "name": "astro",
    "version_constraint": ">=4.0.0"
  },
  "required_packages": {
    "tailwindcss": ">=3.4.0",
    "@tailwindcss/typography": ">=0.5.0"
  },
  "components_count": 7,
  "pages_count": 1,
  "assets_total_bytes": 2485732,
  "design_system_ref": "<name-or-inline>",
  "claude_design_url": "https://claude.ai/design/<session-id>"
}
```

## Framework-Specific Scaffolds

Claude Design emits framework-specific files depending on the `framework` field:

| Framework | Primary files | Config |
|-----------|--------------|--------|
| **astro** | `pages/*.astro`, `components/*.astro`, `layouts/*.astro` | `astro.config.mjs`, `tailwind.config.ts` |
| **next** | `app/*/page.tsx`, `components/*.tsx` | `next.config.js`, `tailwind.config.ts` |
| **react-vite** | `src/components/*.tsx`, `src/App.tsx` | `vite.config.ts`, `tailwind.config.ts` |
| **vue** | `src/components/*.vue`, `src/App.vue` | `vite.config.ts`, `tailwind.config.ts` |
| **vitepress** | `.vitepress/theme/components/*.vue`, `.vitepress/theme/index.ts` | `.vitepress/config.ts` |
| **vanilla** | `index.html`, `styles.css`, `script.js` | none |

## Bundle Validation

Before feeding a bundle to Claude Code, validate structure:

```bash
bun "${LIFEOS_ROOT}/skills/Webdesign/Tools/ProcessHandoffBundle.ts" <bundle-dir>
```

The tool checks:
- `PROMPT.md` exists and has required frontmatter
- `tokens.json` parses and matches schema
- `preview.html` exists
- Framework-claimed files exist (if manifest.json present)
- Assets referenced in components exist in `assets/`
- No secrets or API keys in any text file

## Consuming a Bundle

Two paths:

### Path A — Full code generation (ExportToCode workflow)

Feed the bundle to Claude Code. The `frontend-design` plugin auto-activates, reads PROMPT.md, applies tokens.json, and produces production code.

### Path B — Integration into existing app (IntegrateIntoApp workflow)

Translate the bundle against the target app's conventions. Produces a diff instead of new files. Reuses existing tokens where possible, flags conflicts explicitly.

## Versioning

The bundle schema is versioned. The current version is `1`. Future versions will be backward-compatible or gated by the `version` field in `manifest.json` and `tokens.json`.
