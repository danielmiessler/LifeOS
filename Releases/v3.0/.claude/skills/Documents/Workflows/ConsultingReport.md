# Consulting Report Generation Workflow

**Trigger:** "create consulting report", "generate report PDF", "build assessment report", "consulting report"

## Overview

Professional consulting report generation using HTML + Playwright PDF pipeline. This is the standard approach for creating McKinsey-quality assessment reports, strategic analyses, and consulting deliverables.

**Pipeline:** Report Artifacts Directory → Structured Data → Styled HTML → PDF (via Playwright)

## Architecture

```
report-directory/
├── content/                    # Report content (markdown, data files)
│   ├── report-data.ts          # Structured report data (TypeScript)
│   ├── *.md                    # Narrative sections, conclusions
│   └── *.json                  # Supporting data
├── diagrams/                   # Visual assets
│   ├── *.png / *.jpg           # Diagrams, charts, figures
│   └── (compressed to <200KB each, max 1200px width)
├── generate-pdf.mjs            # PDF generation script
├── report-print.html           # Generated intermediate HTML
└── OUTPUT.pdf                  # Final PDF output
```

## Step 1: Parse Report Directory

Scan the report directory for all artifacts:

1. **Data files** (`.ts`, `.json`): Structured report data with sections, findings, recommendations
2. **Markdown files** (`.md`): Narrative content, conclusions, personal voice sections
3. **Images** (`diagrams/`): Architecture diagrams, charts, figures
4. **Custom content**: Client-specific narrative, assessor notes

### Data Structure Pattern

Reports follow this general structure:

```typescript
interface ConsultingReport {
  // Cover
  clientName: string
  reportTitle: string
  reportDate: string
  classification: string  // e.g., "CONFIDENTIAL"
  version: string

  // Content Sections (varies by report type)
  sections: {
    id: string
    title: string
    content: string | object  // Markdown or structured data
    subsections?: Section[]
  }[]

  // Findings (for assessments)
  findings?: Finding[]

  // Recommendations
  recommendations?: Recommendation[]

  // Closing / Conclusion
  conclusion?: {
    assessorNote: string
    contextNote: string
    closingRemarks: string
  }

  // Appendix
  supportingEvidence?: Record<string, string[]>
}
```

## Step 2: Compress Images

Before generating the PDF, compress all diagram images:

```bash
# Compress PNGs to JPEGs at 70% quality, max 1200px width
mkdir -p diagrams-compressed
for f in diagrams/*.png; do
  base=$(basename "$f" .png)
  sips -s format jpeg -s formatOptions 70 --resampleWidth 1200 "$f" --out "diagrams-compressed/${base}.jpg" 2>/dev/null
done
```

Target: Each image under 200KB, total images under 2MB.

## Step 3: Generate HTML

Build a complete, self-contained HTML document with inline CSS. Key design principles:

### Typography System

```css
/* Body: Serif for readability */
body {
  font-family: 'Georgia', 'Garamond', 'Times New Roman', serif;
  font-size: 10.5pt;
  line-height: 1.55;
  color: #1a1a2e;
}

/* Headings: Sans-serif for contrast */
h1, h2, h3, h4 {
  font-family: 'Inter', 'Helvetica Neue', sans-serif;
}

/* H1: 22pt navy with bottom border */
h1 { font-size: 22pt; color: #1B2A4A; border-bottom: 2px solid #1B2A4A; }

/* H2: 15pt blue */
h2 { font-size: 15pt; color: #2E5090; }

/* H3: 12pt navy */
h3 { font-size: 12pt; color: #1B2A4A; }
```

### Color System

| Element | Color | Hex | Usage |
|---------|-------|-----|-------|
| Navy | Dark blue | #1B2A4A | H1, table headers, primary text |
| Blue | Medium blue | #2E5090 | H2, links, blockquote borders |
| Red | Alert red | #DC2626 | Critical findings, CONFIDENTIAL |
| Amber | Warning amber | #D97706 | Short-term priority items |
| Green | Success green | #059669 | Positive findings, long-term items |

### Callout Boxes

```css
.box { padding: 0.7rem 1rem; border-radius: 4px; border-left: 4px solid; }
.box-red { border-color: #DC2626; background: #fef2f2; color: #7f1d1d; }
.box-green { border-color: #059669; background: #f0fdf4; color: #14532d; }
.box-amber { border-color: #D97706; background: #fffbeb; color: #78350f; }
.box-blue { border-color: #2E5090; background: #f0f4fa; color: #1B2A4A; }
```

### Badges

```css
.badge { display: inline-block; padding: 1px 8px; border-radius: 3px; font-size: 8.5pt; font-weight: 700; text-transform: uppercase; }
.badge-critical { background: #DC2626; color: #fff; }
.badge-immediate { background: #DC2626; color: #fff; }
.badge-short-term { background: #D97706; color: #fff; }
.badge-long-term { background: #059669; color: #fff; }
```

### Tables

```css
thead th { background: #1B2A4A; color: #fff; font-size: 9pt; padding: 8px 10px; }
tbody td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; }
tbody tr:nth-child(even) { background: #f8fafc; }
```

### Page Structure

1. **Cover Page**: Centered flex layout with classification, client name, divider, report title, date, version
2. **Table of Contents**: Auto-generated from heading anchors with clickable links
3. **Content Sections**: Each H1 forces a page break; H2/H3 use `page-break-after: avoid`
4. **Diagrams**: Centered with caption, `page-break-inside: avoid`

### Cover Page Template (REQUIRED Branding)

The cover page MUST include your branding and company name.

```html
<div class="cover">
  <div class="classification">CONFIDENTIAL</div>
  <img class="logo" src="file:///path/to/ul-icon.png" alt="Your Company" />
  <div class="brand-label">TELOS Assessment</div>
  <div class="report-title">Report Title</div>
  <div class="prepared-for">Prepared for Client Name</div>
  <div class="divider"></div>
  <div class="meta">Date · Version X.X</div>
  <div class="company-name">UNSUPERVISED LEARNING CONSULTING</div>
  <div class="footer-note">CONFIDENTIAL — For Authorized Recipients Only</div>
</div>
```

**Logo source:** The UL icon is at `report/public/ul-icon.png` (500x400 blue node-link icon). Use `file://` protocol for Playwright rendering.

**Footer branding:** The Playwright `footerTemplate` must include your company name centered between CONFIDENTIAL (left) and page number (right).

## Step 4: Convert to PDF with Playwright

```javascript
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`file://${HTML_FILE}`, { waitUntil: 'networkidle' });

// Wait for images
await page.evaluate(async () => {
  const imgs = document.querySelectorAll('img');
  await Promise.all(Array.from(imgs).map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise(resolve => {
      img.onload = resolve;
      img.onerror = resolve;
      setTimeout(resolve, 5000);
    });
  }));
});

await page.waitForTimeout(500);

await page.pdf({
  path: OUTPUT,
  format: 'A4',
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: `
    <div style="width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 0 0.9in 4px 0.9in; font-size: 7.5pt; font-family: 'Helvetica Neue', Arial, sans-serif; border-bottom: 0.5px solid #d0d5dd;">
      <span style="font-weight: 700; color: #1B2A4A; letter-spacing: 0.05em;">CLIENT NAME</span>
      <span style="color: #94a3b8; letter-spacing: 0.03em;">Report Title</span>
    </div>
  `,
  footerTemplate: `
    <div style="width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 4px 0.9in 0 0.9in; font-size: 7.5pt; font-family: 'Helvetica Neue', Arial, sans-serif; border-top: 0.5px solid #d0d5dd;">
      <span style="color: #DC2626; font-weight: 600; letter-spacing: 0.05em;">CONFIDENTIAL</span>
      <span style="color: #1B2A4A;">Page <span class="pageNumber"></span></span>
    </div>
  `,
  margin: {
    top: '0.8in',
    bottom: '0.7in',
    left: '0.9in',
    right: '0.9in',
  },
  preferCSSPageSize: false,
});

await browser.close();
```

### Critical Playwright Notes

- **DO NOT** use CSS `@page` margin-box content rules AND `displayHeaderFooter` together — they duplicate
- **DO NOT** use named pages (`page: cover;`) — causes rendering issues
- Headers/footers are ONLY controlled via the `headerTemplate` and `footerTemplate` options
- Set `preferCSSPageSize: false` to let Playwright control page size
- Use `printBackground: true` to render background colors and gradients

## Step 5: Verify Output

After generation, always verify:

1. **Page count**: Should be reasonable for content volume (30-50 pages typical)
2. **File size**: Target 1-2MB. Over 3MB indicates uncompressed images
3. **Cover page**: Centered, professional, classification visible
4. **TOC**: All entries present with clickable links
5. **Headers/Footers**: No duplication, correct content
6. **Images**: All diagrams rendered, properly sized
7. **Color boxes**: Red for critical, green for positive, amber for warnings
8. **Tables**: Navy headers, alternating row stripes
9. **Page breaks**: H1 sections start on new pages

## Reference Implementation

The reference implementation (`{PROJECTS_DIR}/your-project/generate-pdf.mjs`) demonstrates this workflow. Key stats:

- 38 pages, 1.66MB
- 10 architecture diagrams
- 8 critical findings with colored callout boxes
- 7 recommendations with priority badges
- Professional typography: Georgia body, Inter headings
- Cover page, linked TOC, headers/footers with CONFIDENTIAL marking

## Dependencies

- **Node.js 18+** or **Bun**: For running the generation script
- **Playwright**: `npm install playwright` — for HTML-to-PDF conversion
- **sips** (macOS): For image compression (or ImageMagick on Linux)

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Double headers/footers | CSS @page + Playwright displayHeaderFooter | Remove CSS @page margin-box rules |
| Huge file size | Uncompressed PNG images | Compress to JPEG, max 1200px width |
| Blank cover page | Playwright margin overlapping cover content | Use `height: 100vh` on cover div |
| TOC links don't work | Missing anchor IDs on headings | Ensure `id` attributes on all `<hN>` tags |
| Page breaks in wrong places | Missing `page-break-inside: avoid` | Add to tables, boxes, and diagrams |
