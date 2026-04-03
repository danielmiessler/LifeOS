# D3.js Interactive Dashboards Workflow

**Interactive data visualizations and dashboards using D3.js.**

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the D3Dashboards workflow in the Art skill to create visualizations"}' \
  > /dev/null 2>&1 &
```

Running **D3Dashboards** in **Art**...

---

## Purpose

Creates sophisticated, interactive data visualizations using D3.js for dashboards, reports, and data analysis.

**Use for:**
- TELOS consulting dashboards (project dependencies, constraint analysis)
- Blog post data visualizations (statistics, trends, relationships)
- Network diagrams (system architecture, organizational relationships)
- Interactive reports and presentations

**This is NOT for:**
- Static diagrams → Use TechnicalDiagrams or Mermaid workflows
- Editorial illustrations → Use Essay workflow
- Simple infographics → Use other visualization workflows

---

## Supported Visualization Types

### Charts & Graphs
- **Bar Charts** - Comparisons, rankings, distributions
- **Line Charts** - Trends over time, performance metrics
- **Scatter Plots** - Correlations, clusters, outliers
- **Area Charts** - Cumulative values, stacked comparisons
- **Pie/Donut Charts** - Proportions, percentages

### Network & Relationships
- **Force-Directed Graphs** - Project dependencies, team relationships
- **Tree Diagrams** - Hierarchies, organizational structures
- **Chord Diagrams** - Entity relationships, data flow
- **Sankey Diagrams** - Flow visualization, process mapping

### Advanced
- **Heatmaps** - Intensity, density, correlation matrices
- **Geographic Maps** - Location data, regional analysis
- **Timeline Visualizations** - Project milestones, historical data
- **Custom Dashboards** - Multi-chart compositions

---

## Color Palette (PAI Standard)

**Primary Colors:**
```
Deep Purple: #4A148C   - Brand accent
Deep Teal:   #00796B   - Secondary accent
Charcoal:    #2D2D2D   - Text and lines
```

**Data Visualization Colors:**
- Sequential scales for continuous data: `d3.interpolateViridis`, `d3.interpolatePlasma`
- Categorical scales for discrete data: `d3.schemeCategory10`, `d3.schemeSet3`
- Maintain accessibility with sufficient contrast

**Typography:**
- System fonts: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto`
- Label sizes: 12px for axes, 14px for titles
- Consistent spacing and alignment

---

## Implementation Approach

### Standard Workflow

```javascript
function createVisualization(data, config) {
  // 1. Setup SVG container
  const svg = d3.select('#chart');
  svg.selectAll("*").remove(); // Clear previous render

  // 2. Define dimensions with margins
  const width = 800, height = 400;
  const margin = { top: 20, right: 30, bottom: 40, left: 50 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // 3. Create scales
  const xScale = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.value)])
    .range([0, innerWidth]);

  // 4. Create axes
  const xAxis = d3.axisBottom(xScale);

  // 5. Bind data and create elements
  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // 6. Add interactive features
  g.selectAll('circle')
    .data(data)
    .join('circle')
    .attr('cx', d => xScale(d.value))
    .attr('cy', height / 2)
    .attr('r', 5)
    .on('mouseover', showTooltip)
    .on('mouseout', hideTooltip);
}
```

### Integration Patterns

**Direct DOM Manipulation (Recommended):**
- D3 selects and imperatively manipulates DOM elements
- Works in any JavaScript context
- Full control over rendering

**Declarative Rendering:**
- D3 calculates scales and layouts
- Framework renders via templating
- Suitable for simpler visualizations

---

## Interactive Features

### Tooltips

```javascript
const tooltip = d3.select('body').append('div')
  .attr('class', 'tooltip')
  .style('opacity', 0);

function showTooltip(event, d) {
  tooltip.transition()
    .duration(200)
    .style('opacity', .9);
  tooltip.html(`Value: ${d.value}`)
    .style('left', (event.pageX + 10) + 'px')
    .style('top', (event.pageY - 28) + 'px');
}
```

### Zoom & Pan

```javascript
const zoom = d3.zoom()
  .scaleExtent([0.5, 5])
  .on('zoom', (event) => {
    g.attr('transform', event.transform);
  });

svg.call(zoom);
```

### Transitions & Animations

```javascript
circles.transition()
  .duration(750)
  .delay((d, i) => i * 50)
  .attr('r', d => radiusScale(d.value))
  .style('fill', d => colorScale(d.category))
  .ease(d3.easeBounceOut);
```

### Responsive Design

```javascript
// Handle container resizing
const resizeObserver = new ResizeObserver(entries => {
  const { width, height } = entries[0].contentRect;
  redrawVisualization(width, height);
});

resizeObserver.observe(document.querySelector('#chart-container'));
```

---

## TELOS Dashboard Patterns

### Project Dependency Network

```javascript
// Force-directed graph for project dependencies
const simulation = d3.forceSimulation(nodes)
  .force('link', d3.forceLink(links).id(d => d.id))
  .force('charge', d3.forceManyBody().strength(-100))
  .force('center', d3.forceCenter(width / 2, height / 2));

// Visualize blockers as red nodes
nodes.forEach(node => {
  node.color = node.isBlocker ? '#D32F2F' : '#4A148C';
});
```

### Constraint Theory Visualization

```javascript
// Bottleneck analysis with bar chart
const constraints = [
  { name: 'Resource A', impact: 85, isBottleneck: true },
  { name: 'Resource B', impact: 45, isBottleneck: false },
  // ...
];

// Highlight bottlenecks in contrasting color
bars.attr('fill', d => d.isBottleneck ? '#D32F2F' : '#00796B');
```

### Progress Dashboard

```javascript
// Multi-metric dashboard
const metrics = {
  currentCustomers: 243,
  targetCustomers: 2000,
  growthRate: 0.15,
  blockers: 3
};

// Create gauge chart for progress
const progress = (metrics.currentCustomers / metrics.targetCustomers) * 100;
createGaugeChart(progress);
```

---

## Best Practices

### Data Validation
```javascript
// Always validate and clean data first
const cleanData = data.filter(d =>
  d.value !== null &&
  d.value !== undefined &&
  !isNaN(d.value)
);
```

### Performance Optimization
- **<1000 elements**: Use SVG (optimal)
- **1000-10,000 elements**: Consider canvas rendering
- **>10,000 elements**: Implement virtual scrolling or aggregation

### Accessibility
```javascript
// Add ARIA labels and semantic markup
svg.attr('role', 'img')
   .attr('aria-label', 'Bar chart showing project metrics');

// Add keyboard navigation
circles.attr('tabindex', 0)
       .on('keypress', handleKeyPress);
```

### Error Handling
```javascript
// Graceful error handling
try {
  const svg = d3.select('#chart');
  if (svg.empty()) {
    throw new Error('Chart container not found');
  }

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Invalid or empty data');
  }

  renderVisualization(data);
} catch (error) {
  console.error('Visualization error:', error);
  showErrorMessage('Unable to render chart. Please check your data.');
}
```

---

## Output Formats

### HTML Artifact
- Complete standalone HTML file
- Embedded D3.js library (CDN or inline)
- Responsive container
- Interactive controls

### Code Snippet
- Reusable JavaScript function
- Configurable parameters
- Documentation comments

### Dashboard Page
- Multi-chart layout
- Coordinated interactions
- Shared data filtering
- Export/download functionality

---

## Quick Start Examples

### Bar Chart
```javascript
// Simple bar chart
const data = [12, 5, 6, 6, 9, 10];

d3.select('#chart')
  .selectAll('div')
  .data(data)
  .join('div')
  .style('width', d => `${d * 10}px`)
  .style('height', '20px')
  .style('background', '#4A148C')
  .text(d => d);
```

### Network Diagram
```javascript
// Project dependency network
const nodes = [
  { id: 'A', label: 'API' },
  { id: 'B', label: 'Database' },
  { id: 'C', label: 'Frontend' }
];

const links = [
  { source: 'A', target: 'B' },
  { source: 'C', target: 'A' }
];

createForceDirectedGraph(nodes, links);
```

---

## D3.js Resources

**Core Concepts:**
- Selections: `d3.select()`, `d3.selectAll()`
- Data binding: `.data()`, `.join()`
- Scales: `d3.scaleLinear()`, `d3.scaleBand()`, `d3.scaleOrdinal()`
- Axes: `d3.axisBottom()`, `d3.axisLeft()`
- Shapes: `d3.line()`, `d3.arc()`, `d3.area()`

**Layout Algorithms:**
- Force simulation: `d3.forceSimulation()`
- Hierarchies: `d3.hierarchy()`, `d3.tree()`
- Chord: `d3.chord()`
- Sankey: `d3.sankey()`

**Official Documentation:**
- https://d3js.org/
- https://observablehq.com/@d3/gallery

---

## Execution

1. Gather data requirements and determine visualization type
2. Choose appropriate chart/graph pattern
3. Set up HTML structure with D3.js
4. Implement visualization with standard color palette
5. Add interactivity (tooltips, zoom, transitions)
6. Validate accessibility and responsiveness
7. Output as HTML artifact or code snippet

---

## Validation

**Must have:**
- [ ] Clean, professional appearance
- [ ] Standard color palette applied
- [ ] Interactive features working
- [ ] Responsive to container size
- [ ] Accessible (ARIA labels, keyboard nav)
- [ ] Data validation in place
- [ ] Error handling for edge cases

**Must NOT have:**
- [ ] Generic color schemes
- [ ] Static-only presentation when interactivity makes sense
- [ ] Missing axis labels or legends
- [ ] Overflow or cropped elements
