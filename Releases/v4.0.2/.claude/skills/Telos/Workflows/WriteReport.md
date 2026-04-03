# WriteReport Workflow

**Purpose:** Generate a McKinsey-style professional consulting report from TELOS analysis content, rendered as a dark-themed web-based document with custom Practical Typography fonts and automatic light-mode print support.

---

## Workflow Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  1. ANALYZE        2. NARRATIVE       3. STRUCTURE      4. RENDER  │
│  Run TELOS         Generate story     Map to McKinsey   Output as  │
│  analysis          via CreateNarra-   report sections   web report │
│                    tivePoints                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Input Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `source` | Yes | - | TELOS directory or analysis context |
| `client_name` | Yes | - | Client/project name for the report title |
| `output_dir` | No | `{source}/report` | Where to generate the report |

---

## Artifact-Based Pipeline

**CRITICAL: This workflow consumes artifacts produced by the assessment workflow.**

### Source → Assessment → Report Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SOURCE FILES (you edit)         ARTIFACTS (generated)    REPORT (output)  │
│                                                                             │
│  {source}/                       {source}/artifacts/      {source}/report/ │
│  ├── FINDINGS.md            →    ├── findings.json   →   lib/report-data.ts│
│  ├── CRITICAL_ISSUES.md          ├── narrative.json                        │
│  ├── BLOCKERS.md                 ├── recommendations.json                  │
│  ├── VISION.md                   ├── roadmap.json                          │
│  ├── SOLUTION_NARRATIVE.md       └── methodology.json                      │
│  └── telos/*.md                                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Artifact Schema

**findings.json:**
```json
{
  "findings": [
    {
      "id": "F1",
      "title": "Finding Title",
      "description": "Description of the finding",
      "evidence": "Evidence supporting this finding",
      "source": "Role-based source (not names)",
      "severity": "critical|high|medium|low"
    }
  ]
}
```

**recommendations.json:**
```json
{
  "recommendations": [
    {
      "id": "R1",
      "title": "Recommendation Title",
      "description": "Description",
      "priority": "immediate|short-term|long-term"
    }
  ]
}
```

**roadmap.json:**
```json
{
  "phases": [
    {
      "phase": "Phase 1",
      "title": "Phase Title",
      "description": "Phase description",
      "duration": "Weeks 1-8"
    }
  ]
}
```

**methodology.json:**
```json
{
  "interviewCount": 12,
  "roles": ["CEO", "CTO", "VP Product", "Product Managers (3)"]
}
```

**narrative.json:**
```json
{
  "context": "Executive summary context",
  "clientAsk": "What the client asked for",
  "currentState": "Current state description",
  "whyNow": "Why this matters now",
  "existentialRisks": ["Risk 1", "Risk 2"],
  "competitiveThreats": ["Threat 1", "Threat 2"],
  "timelinePressures": "Timeline pressure description",
  "goodNews": "The pivot - the solution exists",
  "requirements": ["Requirement 1", "Requirement 2"],
  "targetStateDescription": "Vision description",
  "keyCapabilities": ["Capability 1", "Capability 2"],
  "successMetrics": ["Metric 1", "Metric 2"],
  "immediateSteps": ["Step 1", "Step 2"],
  "decisionPoints": ["Decision 1", "Decision 2"],
  "commitmentRequired": "What courage looks like"
}
```

### Regeneration Flow

When you edit source files and say "regenerate the report":

1. **Assessment Workflow** reads source files → produces `artifacts/*.json`
2. **Report Workflow** reads `artifacts/*.json` → generates `report/lib/report-data.ts`
3. **Dev server** hot-reloads → updated report visible

**The artifacts/ directory is the contract between assessment and report workflows.**

---

## Execution Steps

### Step 1: Verify Artifacts Exist

Check that the assessment workflow has produced artifacts:

```bash
ls {source}/artifacts/
# Should contain: findings.json, recommendations.json, roadmap.json, methodology.json, narrative.json
```

If artifacts don't exist, run the assessment workflow first (CreateNarrativePoints or AnalyzeProjectWithGemini3).

### Step 2: Copy Report Template

```bash
# Copy template to output directory (if not already done)
cp -r ~/.claude/skills/Telos/ReportTemplate/* {output_dir}/

# Install dependencies
cd {output_dir} && bun install
```

### Step 3: Generate report-data.ts from Artifacts

Read each artifact file and assemble into the ReportData structure:

```typescript
// Read artifacts
const findings = JSON.parse(fs.readFileSync('{source}/artifacts/findings.json'))
const recommendations = JSON.parse(fs.readFileSync('{source}/artifacts/recommendations.json'))
const roadmap = JSON.parse(fs.readFileSync('{source}/artifacts/roadmap.json'))
const methodology = JSON.parse(fs.readFileSync('{source}/artifacts/methodology.json'))
const narrative = JSON.parse(fs.readFileSync('{source}/artifacts/narrative.json'))

// Assemble ReportData
const reportData = {
  clientName: "{client_name}",
  reportTitle: "Strategic Assessment & Transformation Roadmap",
  reportDate: "December 2025",
  classification: "CONFIDENTIAL",
  executiveSummary: {
    context: narrative.context,
    methodology: methodology,
    keyFindings: narrative.keyFindings || findings.findings.slice(0,5).map(f => f.title),
    primaryRecommendation: recommendations.recommendations[0]?.description || "",
    expectedOutcomes: narrative.expectedOutcomes || []
  },
  situationAssessment: {
    currentState: narrative.currentState,
    clientAsk: narrative.clientAsk,
    whyNow: narrative.whyNow
  },
  findings: findings.findings,
  riskAnalysis: {
    existentialRisks: narrative.existentialRisks,
    competitiveThreats: narrative.competitiveThreats,
    timelinePressures: narrative.timelinePressures
  },
  strategicOpportunity: {
    goodNews: narrative.goodNews,
    requirements: narrative.requirements
  },
  recommendations: recommendations.recommendations,
  targetState: {
    description: narrative.targetStateDescription,
    keyCapabilities: narrative.keyCapabilities,
    successMetrics: narrative.successMetrics
  },
  roadmap: roadmap.phases,
  callToAction: {
    immediateSteps: narrative.immediateSteps,
    decisionPoints: narrative.decisionPoints,
    commitmentRequired: narrative.commitmentRequired
  }
}
```

Write the assembled data to `{output_dir}/lib/report-data.ts`.

### Step 4: Start Dev Server

```bash
cd {output_dir} && bun dev
```

The report will hot-reload as you regenerate.

### Regeneration Shortcut

When {PRINCIPAL.NAME} edits source files and says "regenerate the report":

1. Run assessment workflow to update artifacts
2. Re-run Step 3 to regenerate report-data.ts
3. Dev server hot-reloads automatically

---

## Report Structure

### 1. Cover Page
- Confidential classification at top (Heliotrope Caps, red)
- **Centered content block:**
  - **{YOUR_LOGO}** (125x125, left-justified with -ml-4) - `/your-logo.png`
  - **"TELOS Assessment"** label (Heliotrope Caps, primary blue, tracking-[0.25em])
  - Report title (Advocate Wide font)
  - "Prepared for {Client Name}" - **CUSTOMIZE per engagement**
- Footer: Date + "{YOUR_BUSINESS_NAME} Consulting"

### 2. Executive Summary (1 page)
- **Methodology exhibit** - Interview count and roles interviewed (by role, not by name)
- Situation overview
- Key findings (3-5 bullets)
- Primary recommendation
- Expected outcomes

### 3. Situation Assessment
- Current state analysis
- Context and background
- What the client asked for
- Why this matters now

### 4. Key Findings
- Each finding as a distinct section
- Evidence supporting each finding
- Severity/impact indicator
- Source attribution (see Board-Ready Reports section below)

### 5. Risk Analysis
- Existential risks identified
- Probability and impact matrix
- Competitive threats
- Timeline pressures

### 6. Strategic Recommendations
- Primary recommendation
- Supporting recommendations
- Required organizational changes
- Resource requirements

### 7. Target State Vision
- Future state description
- Architecture/approach overview
- Key capabilities enabled
- Success metrics

### 8. Implementation Roadmap
- Phased approach
- Quick wins vs long-term initiatives
- Dependencies
- Milestones

### 9. Call to Action
- Immediate next steps
- Decision points required
- Success criteria
- Commitment required

---

## Design Specifications

### Typography (Practical Typography Fonts)

**CRITICAL: Use Matthew Butterick's Practical Typography fonts from `${PROJECTS_DIR}/YourSite/public/fonts/`**

The report-template includes these fonts in `public/fonts/`. The font stack is:

```css
/* Font Families */
--font-display: 'Advocate Wide', 'Advocate', sans-serif;
--font-heading: 'Concourse Medium', 'Concourse', sans-serif;
--font-body: 'Valkyrie', Georgia, serif;
--font-accent: 'Heliotrope Caps', 'Heliotrope', sans-serif;
--font-sans: 'Concourse', system-ui, sans-serif;
```

**Font Usage:**

| Element | Font | Weight | Example |
|---------|------|--------|---------|
| Cover title | Advocate Wide | 400 | Report title on cover page |
| Section headings | Concourse Medium | 600 | "Executive Summary", "Key Findings" |
| Body text | Valkyrie | 400 | Paragraphs, descriptions, evidence |
| Labels/badges | Heliotrope Caps | 400 | "EXHIBIT 1", "KEY TAKEAWAY", "CRITICAL" |
| UI elements | Concourse | 400/700 | Dates, metadata, badges |

**Branding Assets Required:**

```
public/
├── your-logo.png                  # Your brand logo
```

**Font Files Required:**

```
public/fonts/
├── advocate_34_narr_reg.woff2      # Advocate (narrow)
├── advocate_54_wide_reg.woff2      # Advocate Wide (display)
├── concourse_3_regular.woff2       # Concourse (sans)
├── concourse_3_bold.woff2          # Concourse Bold
├── concourse_4_regular.woff2       # Concourse Medium
├── concourse_4_bold.woff2          # Concourse Medium Bold
├── valkyrie_a_regular.woff2        # Valkyrie (serif body)
├── valkyrie_a_bold.woff2           # Valkyrie Bold
├── valkyrie_a_italic.woff2         # Valkyrie Italic
├── heliotrope_3_regular.woff2      # Heliotrope
└── heliotrope_3_caps_regular.woff2 # Heliotrope Caps (labels)
```

### Color Palette (Dark Theme)

The report uses a professional super-dark blue background with brightened accent colors for optimal contrast:

```css
/* Dark Theme - Super Dark Blue Background */
--background: #0B0D14;           /* Primary background - deep navy */
--background-secondary: #12141D;  /* Section backgrounds */
--background-tertiary: #191C26;   /* Elevated elements */
--background-elevated: #20232E;   /* Cards, modals */

/* Text - Light on Dark */
--foreground: #F5F5F7;           /* Primary text */
--muted: #A1A1A6;                /* Secondary text */
--muted-dark: #6B6B70;           /* Tertiary text */

/* Borders */
--border: rgba(255, 255, 255, 0.12);
--border-subtle: rgba(255, 255, 255, 0.08);
--border-emphasis: rgba(255, 255, 255, 0.2);

/* Accents - Brightened for dark mode */
--primary: #4A9EF7;              /* Headers, key metrics, links */
--primary-glow: rgba(74, 158, 247, 0.3);
--accent: #B47AFF;               /* Highlights, callouts */
--accent-glow: rgba(180, 122, 255, 0.3);
--success: #4ADE80;              /* Positive indicators */
--warning: #FBBF24;              /* Caution indicators */
--destructive: #F87171;          /* Risk/critical indicators */

/* Section backgrounds */
--section-bg: #12141D;           /* Section backgrounds */
--callout-bg: rgba(74, 158, 247, 0.1);  /* Blue tinted callouts */
```

**Print Mode:** When printed (Cmd+P), the report automatically switches to a light theme for better paper output:
- White background (#ffffff)
- Dark text (#1a1b26)
- Standard accent colors for ink efficiency

### McKinsey Visual Elements

1. **Exhibit Boxes** - Numbered figures with Heliotrope Caps labels and sources
2. **Key Takeaway Callouts** - Blue-accented boxes with Heliotrope Caps headers
3. **Severity Indicators** - Color-coded tags (Critical/High/Medium/Low) in Concourse
4. **Progress Bars** - For metrics and completion percentages
5. **Timeline Graphics** - For roadmaps and phases with Heliotrope Caps phase labels
6. **Quote Blocks** - For interview evidence with Valkyrie italic

### Layout Principles

- **White space**: Generous margins, breathing room between sections
- **Hierarchy**: Clear visual hierarchy through typography and spacing
- **Consistency**: Same patterns repeated throughout
- **Professional**: Clean, corporate, trustworthy aesthetic
- **Printable**: Optimized for both screen and print (PDF-ready)

---

## Output Files

The workflow generates a complete Next.js app:

```
{output_dir}/
├── public/
│   └── fonts/              # Practical Typography fonts (11 woff2 files)
├── app/
│   ├── layout.tsx          # Report shell with print styles
│   ├── page.tsx            # Full report content
│   └── globals.css         # Font-face declarations + McKinsey styling
├── components/
│   ├── cover-page.tsx      # Report cover (Advocate Wide title)
│   ├── section.tsx         # Reusable section component
│   ├── finding-card.tsx    # Individual finding display
│   ├── exhibit.tsx         # Numbered figure/exhibit
│   ├── callout.tsx         # Key takeaway box
│   ├── severity-badge.tsx  # Risk/severity indicator
│   ├── timeline.tsx        # Roadmap visualization
│   ├── quote-block.tsx     # Interview quote display
│   └── recommendation-card.tsx  # Priority-coded recommendations
├── lib/
│   ├── report-data.ts      # Generated report content (CUSTOMIZE THIS)
│   └── utils.ts            # Utility functions
├── package.json
├── tailwind.config.ts      # Font family definitions
├── tsconfig.json
└── postcss.config.js
```

---

## Example Command Flow

```bash
# User: "Create a TELOS report for Acme Corp"

# Step 1: {DAIDENTITY.NAME} runs TELOS analysis on source directory
# Step 2: {DAIDENTITY.NAME} executes CreateNarrativePoints workflow
# Step 3: {DAIDENTITY.NAME} copies report-template to output directory
# Step 4: {DAIDENTITY.NAME} generates report-data.ts with content
# Step 5: {DAIDENTITY.NAME} runs bun install && bun dev

# To view:
cd {output_dir} && bun dev
# Opens at http://localhost:3000

# To print:
# Use browser print (Cmd+P) - print styles are included
```

---

## Template Location

**CRITICAL: The report template lives at:**

```
~/.claude/skills/Telos/ReportTemplate/
```

This template includes:
- All 11 Practical Typography font files
- Pre-configured globals.css with @font-face declarations
- Tailwind config with font family definitions
- All McKinsey-style components
- Placeholder report-data.ts

When generating a report:
1. Copy the entire template to the output directory
2. Generate `lib/report-data.ts` with client-specific content:
   - `clientName`: The customer name (e.g., "Quorum Cyber", "Acme Corp")
   - `reportTitle`: The engagement title
   - `reportDate`: Current month/year
   - All findings, recommendations, roadmap from TELOS analysis
3. Update `app/layout.tsx` metadata with client name

---

## Integration Notes

**Prerequisite Workflow:**
- CreateNarrativePoints MUST run first to generate narrative content

**Font Source:**
- Fonts originally from `${PROJECTS_DIR}/YourSite/public/fonts/`
- Already included in report-template for convenience

**Works with:**
- InterviewExtraction output (provides evidence quotes)
- AnalyzeProjectWithGemini3 output (provides deep analysis)
- Direct TELOS directory analysis

**Output designed for:**
- Board presentations
- Executive briefings
- Client deliverables
- Strategic planning sessions
- Investment reviews

---

## Quality Checklist

Before finalizing the report:

- [ ] Logo displays correctly (125x125, left-justified)
- [ ] "TELOS Assessment" label visible above title
- [ ] Cover page has correct client name and date
- [ ] Cover title uses Advocate Wide font
- [ ] Section headings use Concourse Medium font
- [ ] Body text uses Valkyrie font (readable, elegant)
- [ ] Labels use Heliotrope Caps font
- [ ] Executive summary fits on one page
- [ ] Methodology exhibit shows interview count and roles
- [ ] All findings have evidence/sources (role-based, not names)
- [ ] Recommendations are specific and actionable
- [ ] Vision section is compelling and concrete
- [ ] Roadmap has realistic phases
- [ ] Call to action is clear
- [ ] All exhibits are numbered and titled
- [ ] Color usage is subtle and professional
- [ ] Report is printable (PDF-ready)
- [ ] No sensitive data exposed inappropriately
- [ ] Confidentiality notice included

---

## Voice & Tone

**This is McKinsey-style professional consulting:**

- Direct, confident assertions
- Evidence-backed claims
- Strategic framing
- Executive-appropriate language
- No hedging or waffling
- Clear recommendations
- Actionable insights

**Avoid:**
- Casual language
- Technical jargon (unless client-appropriate)
- Vague statements
- Unsubstantiated claims
- Overly academic tone

---

## Board-Ready Reports

**When the report will be presented to a board or executive audience:**

### Source Anonymization

**CRITICAL: Remove all individual names from source attributions.**

Sources should reference roles, not people:
- ❌ "John Smith interview"
- ❌ "Feedback from Sarah Jones"
- ✅ "Executive interviews"
- ✅ "Product team interviews (2)"
- ✅ "Engineering leadership feedback"
- ✅ "Customer success team assessment"

**Why:** Boards should evaluate findings on merit, not attribute blame or credit to individuals. Role-based sourcing maintains credibility while protecting interviewees.

### Methodology Section

The Executive Summary MUST include:
- **Interview count** - Total number of interviews conducted
- **Roles interviewed** - List by role category, not by name

Example:
```
Interviews Conducted: 12
Roles Interviewed:
- Chief Executive Officer
- Chief Technology Officer
- VP of Product
- Product Managers (3)
- Engineering Leadership (2)
- Customer Success Leadership
- SOC Leadership
- Sales Leadership
```

### Content Review Checklist

Before board presentation:
- [ ] All individual names removed from sources
- [ ] Sources reference roles/teams only
- [ ] Methodology section shows interview count and roles
- [ ] No internal references to "board" in the content (they ARE the board)
- [ ] Findings are evidence-backed, not opinion
- [ ] Recommendations are actionable and measurable

---

## Maintenance

**To update fonts:**
```bash
# Copy your custom fonts to this directory
# Copy your custom fonts to the report template fonts directory
```

**To update template components:**
Edit files in `~/.claude/skills/Telos/ReportTemplate/components/`

**To change color scheme:**
Edit CSS custom properties in `~/.claude/skills/Telos/ReportTemplate/app/globals.css`
