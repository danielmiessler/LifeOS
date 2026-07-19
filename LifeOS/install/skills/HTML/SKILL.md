---
name: HTML
version: 1.0.0
description: Renders the current session's output (analysis, research, red team, report, plan) as an extremely well-designed, self-contained HTML artifact via a deterministic renderer — the model distills content into typed JSON, the tool owns all layout/typography/color. USE WHEN /HTML, HTML artifact, render this as HTML, make this an HTML page, artifact of this analysis, designed HTML output. NOT FOR deployed websites or web apps (build the project directly), web UI design systems (use Webdesign), static images or diagrams (use Art), or writing the underlying analysis itself (run the analysis first, then /HTML renders it).
---

# HTML

Turns whatever the session just produced into one self-contained, designed HTML file and publishes it as an Artifact. Deterministic split: the model's only job is distilling the session output into a typed content JSON and picking a design register; `Tools/Render.ts` owns every layout, typography, and color decision.

## Voice Notification

**When executing a workflow, do BOTH:**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:31337/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the Render workflow in the HTML skill to build a designed HTML artifact"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running **Render** in **HTML**...
   ```

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Render** | `/HTML`, "HTML artifact", "render this as HTML" | `Workflows/Render.md` |

## Quick Reference

- Renderer: `bun $LIFEOS_ROOT/skills/HTML/Tools/Render.ts --json content.json --register dossier --out artifact.html`
- `--schema` prints the content JSON shape with an example; `--registers` lists registers.
- Registers: `dossier` (dark ink-green / orange, condensed display + typewriter — evidence files, red teams, investigations) and `ledger` (dark navy / gold, old-style serif — reports, finance, plans, comparisons). Alternate between them so consecutive outputs don't converge; add new registers to Render.ts rather than hand-styling one-offs.
- Output is Artifact-CSP safe: inline CSS, fonts embedded as data URIs from local font files, zero external requests.

## Gotchas

- **DOM-render screenshot pipelines drop CSS pseudo-element generated content** (counters, `::before` labels render in the browser but vanish from DOM-render captures, and they're invisible to text extraction). Render.ts therefore emits all numbering and labels as real DOM text. Never add CSS counters to a register. (Discovered 2026-07-11.)
- **Artifacts block all external requests** — a Google Fonts `<link>` fails silently and you get the fallback stack. Embed via data-URI `@font-face` (Render.ts does this when the register's font file exists locally) or design on system stacks.
- **The artifact viewer wraps your file in its own document skeleton** — emit `<title>` + `<style>` + body content only; no `<!doctype>`/`<html>`/`<head>`/`<body>` tags.
- **A published artifact is private to its owner's claude.ai account** — verifying it in a browser signed into a different account/org 404s. Verify the render by serving the HTML file locally and capturing that; verify publication via the Artifact tool's `list` action.
- **Numbered section markers must mean something.** Render.ts numbers sections (document order — legitimate). Don't number list items unless the content is a true sequence; use `list` blocks with bold lead-ins instead.

## Examples

**Example 1: After a research or red-team session**
```
User: "/HTML"
→ Render workflow: distill the session's findings into content JSON
→ bun Tools/Render.ts --json content.json --register dossier --out artifact.html
→ Publish via Artifact tool (load artifact-design skill first), pixel-verify, hand over URL
```

**Example 2: Different subject, different register**
```
User: "render the quarterly cost analysis as HTML"
→ Same flow with --register ledger (tables, callouts)
→ Alternates the look from the last artifact so outputs don't converge
```
