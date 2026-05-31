---
name: pai-media
description: "Visual content generation across multiple formats: architecture diagrams, D3.js data visualizations, Mermaid charts, SVG icons, and blog/social media headers."
version: 5.0.0
author: PAI v5.0 → Hermes Port
use_when: "You need to generate visual content — diagrams, data visualizations, icons, charts, or social media graphics — in various output formats (D3.js, Mermaid, SVG, HTML/CSS)."
not_for: "Photo-realistic image generation (use dedicated image AI); video production; 3D modeling."
tags: [media, visualization, diagrams, d3, mermaid, svg, icons, design]
---

<!-- Voice notification — fire-and-forget on invocation -->
```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the pai-media skill"}' \
  > /dev/null 2>&1 &
```


# pai-media: Visual Content Generation

## Workflow Routing

| Trigger | Route |
|---------|-------|
| User wants an architecture diagram | Analyze system → Mermaid diagram → render preview |
| User wants a data chart/viz | Parse data → select chart type → D3.js/HTML → output |
| User wants an icon set | Describe icon → SVG generation → theme pack |
| User wants a blog/header image | Topic → layout → HTML/CSS → screenshot |
| User wants a flow/process chart | Describe process → Mermaid flowchart → render |
| User wants a comparison/infographic | Gather data → layout → HTML/CSS → render |

## Format-Specific Procedures

### 1. Mermaid Diagrams
```
Supported diagram types:
- flowchart: Process flows, algorithms, decision trees
- sequenceDiagram: API interactions, user flows
- classDiagram: System architecture, data models
- stateDiagram-v2: State machines, lifecycle
- gantt: Project timelines, schedules
- pie: Simple data distribution
- graph: Network diagrams, relationship maps
- mindmap: Brainstorming, topic hierarchies
- timeline: Chronological sequences
- gitgraph: Branching strategies, commit history

Procedure:
1. User describes the system/process
2. Select appropriate diagram type
3. Write Mermaid DSL in markdown code block:
   ```mermaid
   flowchart TD
     A[Start] --> B{Decision}
     B -->|Yes| C[Process]
     B -->|No| D[End]
   ```
4. Render to SVG/PNG:
   a. mmdc (Mermaid CLI) → SVG
   b. terminal: mmdc -i diagram.mmd -o diagram.png
   c. Or use Mermaid live editor URL
5. Output rendered diagram + raw Mermaid source
```

### 2. D3.js Data Visualizations
```
Supported chart types:
- Bar chart: Categorical comparisons
- Line chart: Time series, trends
- Scatter plot: Correlations, distributions
- Pie/donut: Proportions, percentages
- Heatmap: Matrix data, correlation matrices
- Tree map: Hierarchical data, nested categories
- Network graph: Relationships, connections
- Choropleth: Geographic data distribution

Procedure:
1. Parse user's data (JSON, CSV, or tabular text)
2. Select chart type based on data shape:
   - Categorical → Bar
   - Temporal → Line
   - Correlational → Scatter
   - Compositional → Pie/Donut
   - Hierarchical → Tree map
3. Generate complete HTML file with:
   - D3.js library (CDN link)
   - SVG container
   - Data binding and scales
   - Axes, labels, legend
   - Responsive sizing
   - Color scheme (configurable)
4. Save as .html file
5. Optionally open in browser or screenshot
```

### 3. SVG Icon Generation
```
Procedure:
1. User describes icon: name, style, size, color palette
2. Icon styles:
   - Solid: Filled vector shapes
   - Outline: Line-based with strokes
   - Two-tone: Primary + accent color
   - Isometric: 3D perspective
   - Minimal: Simplified shapes, single color
3. Generate inline SVG:
   - viewBox="0 0 24 24" (standard)
   - Path data for shapes
   - Proper ARIA labels
   - Stroke/fill styling
4. Create icon set variations:
   - Multiple sizes (16, 24, 32, 48, 64px)
   - Dark/light theme variants
   - Hover/active states
5. Output: SVG files or sprite sheet
```

### 4. Blog & Social Headers
```
Procedure:
1. Determine dimensions:
   - Blog header: 1200×630px (OG image standard)
   - Twitter/X: 1200×675px
   - LinkedIn: 1200×627px
   - YouTube: 1280×720px
   - Instagram: 1080×1080px
2. Content elements:
   - Title/headline (large, prominent)
   - Subtitle or description (if needed)
   - Brand elements (logo, colors)
   - Background: gradient, pattern, or abstract shape
   - Decorative elements (optional)
3. Generate HTML/CSS:
   - HTML container with exact dimensions
   - CSS styling with:
     - Web-safe fonts (system fonts or Google Fonts)
     - Gradients, shadows, borders
     - Flexbox/grid layout
     - Media query for responsive
4. Render to image:
   - puppeteer/playwright screenshot of HTML
   - Or headless browser via browser_navigate to file://
   - Or HTML to image conversion tool
5. Output: HTML source + rendered image
```

### 5. Code-to-Diagram Workflow
```
1. Accept code/configuration as input
2. Analyze code structure:
   - Extract classes, methods, relationships
   - Identify API endpoints, data flow
   - Map dependencies and connections
3. Generate appropriate diagram:
   - Class diagram for OOP code
   - Sequence diagram for API flows
   - Flowchart for algorithms
   - Architecture diagram for system design
4. Render in chosen format
5. Output alongside original code
```

## Gotchas

- Mermaid rendering requires mmdc CLI or browser with Mermaid.js loaded
- D3.js visualizations need a browser to render (HTML output)
- SVG icons should be self-contained (no external font dependencies)
- Blog headers look best with web-safe fonts (Inter, system-ui, sans-serif)
- Complex D3.js charts need explainer text alongside
- Mermaid doesn't support all diagram types (e.g., network graphs)
- For data with >100 points, D3.js is better than Mermaid
- Color scheme matters — use accessible contrast ratios (WCAG AA)
- Inline SVGs are preferred for icons (no HTTP requests)
- Screenshot rendering requires a running browser server

## Execution Log Pattern

```
[PAI-MEDIA] Format: Mermaid | Type: flowchart
[DSL] Generated 18-node flowchart for authentication flow
[RENDER] mmdc → output.svg (2.3s)
[OUTPUT] SVG + Mermaid source code
[COMPLETE] Diagram generated

[PAI-MEDIA] Format: D3.js | Type: line chart
[DATA] 24 data points (monthly revenue, 2024-2025)
[HTML] Generated chart.html with axes, labels, legend
[SCREENSHOT] Rendered to chart.png (1280×720)
[OUTPUT] HTML + PNG
[COMPLETE] Data visualization created
```
