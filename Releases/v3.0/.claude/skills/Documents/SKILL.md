---
name: Documents
description: Document processing. USE WHEN document, process file. SkillSearch('documents') for docs.
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/skills/PAI/USER/SKILLCUSTOMIZATIONS/Documents/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.


## 🚨 MANDATORY: Voice Notification (REQUIRED BEFORE ANY ACTION)

**You MUST send this notification BEFORE doing anything else when this skill is invoked.**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:8888/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the WORKFLOWNAME workflow in the Documents skill to ACTION"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running the **WorkflowName** workflow in the **Documents** skill to ACTION...
   ```

**This is not optional. Execute this curl command immediately upon skill invocation.**

# Documents Skill

## 🎯 Load Full PAI Context

**Before starting any task with this skill, load complete PAI context:**

`read ~/.claude/skills/PAI/SKILL.md`


## When to Activate This Skill

### Word Documents (DOCX)
- User wants to create, edit, or analyze Word documents
- User mentions "tracked changes", "redlining", "document review"
- User needs to convert documents to other formats
- User wants to work with document structure, comments, or formatting

### PDF Files
- User wants to create, merge, split, or manipulate PDFs
- User mentions "extract text from PDF", "PDF tables", "fill PDF form"
- User needs to convert PDFs to/from other formats
- User wants to add watermarks, passwords, or extract images

### PowerPoint Presentations (PPTX)
- User wants to create or edit presentations
- User mentions "slides", "presentation template", "speaker notes"
- User needs to convert presentations to other formats
- User wants to work with slide layouts or design elements

### Excel Spreadsheets (XLSX)
- User wants to create or edit spreadsheets
- User mentions "formulas", "financial model", "data analysis"
- User needs to work with Excel tables, charts, or pivot tables
- User wants to convert spreadsheets to/from other formats

## 🔀 Document Type Routing

This skill organizes document processing across 4 document types plus specialized workflows:

### Consulting Reports (HTML + Playwright PDF)

**Reference Documentation:**
- `Workflows/ConsultingReport.md` - Complete consulting report generation workflow

**Routing Logic:**
- "Create consulting report", "generate report PDF" → ConsultingReport workflow
- "Build assessment report", "strategic assessment" → ConsultingReport workflow
- "McKinsey-style report", "professional report PDF" → ConsultingReport workflow

**Pipeline:** Report Artifacts → Structured HTML → Playwright PDF

**Key Capabilities:**
- Parse report directories with mixed content (markdown, TypeScript data, images)
- Professional CSS typography (Georgia serif body, Inter sans headings)
- Color-coded callout boxes (red/amber/green) and severity badges
- Auto-generated linked Table of Contents
- Cover page with classification marking
- Headers/footers with CONFIDENTIAL and page numbers
- Image compression pipeline (PNG → JPEG, max 1200px)
- A4 format with Playwright for pixel-perfect PDF output

**Reference Implementation:** `{PROJECTS_DIR}/your-project/generate-pdf.mjs`


### Word Documents (DOCX)

**Reference Documentation:**
- `docx/SKILL.md` - Complete DOCX processing guide
- `docx/docx-js.md` - Creating new documents with JavaScript
- `docx/ooxml.md` - Editing existing documents with OOXML

**Routing Logic:**
- "Create Word document", "new docx" → Create workflow (docx-js)
- "Edit Word document", "tracked changes", "redlining" → Edit workflow (OOXML)
- "Read Word document", "extract text from docx" → Read workflow (pandoc)
- "Document review", "track changes" → Redlining workflow

**Supporting Resources:**
- Scripts: `~/.claude/skills/Documents/Docx/Scripts/`
- OOXML tools: `~/.claude/skills/Documents/Docx/ooxml/`
- License: `~/.claude/skills/Documents/Docx/LICENSE.txt`

**Key Capabilities:**
- Create professional documents with docx-js
- Edit with tracked changes (redlining workflow)
- Extract text/comments with pandoc
- Convert to images for visual inspection
- Work with raw OOXML for advanced features

### PDF Processing

**Reference Documentation:**
- `pdf/SKILL.md` - Complete PDF processing guide
- `pdf/forms.md` - Filling PDF forms
- `pdf/reference.md` - Advanced features and troubleshooting

**Routing Logic:**
- "Create PDF" → Creation workflow (reportlab)
- "Merge PDFs", "split PDF" → Manipulation workflow (pypdf)
- "Extract text from PDF" → Extraction workflow (pdfplumber)
- "Fill PDF form" → Forms workflow (pdf-lib or pypdf)
- "Extract tables from PDF" → Table extraction (pdfplumber + pandas)

**Supporting Resources:**
- Scripts: `~/.claude/skills/Documents/Pdf/Scripts/`
- License: `~/.claude/skills/Documents/Pdf/LICENSE.txt`

**Key Capabilities:**
- Create PDFs with reportlab
- Extract text/tables with pdfplumber
- Merge/split with pypdf or qpdf
- Fill forms programmatically
- Add watermarks and password protection
- Extract images from PDFs

### PowerPoint Presentations (PPTX)

**Reference Documentation:**
- `pptx/SKILL.md` - Complete PPTX processing guide
- `pptx/html2pptx.md` - Creating presentations from HTML
- `pptx/ooxml.md` - Editing existing presentations

**Routing Logic:**
- "Create presentation", "new slides" → Creation workflow (html2pptx)
- "Edit presentation", "modify slides" → Edit workflow (OOXML)
- "Use presentation template" → Template workflow
- "Extract slide text" → Read workflow (markitdown)
- "Create thumbnail grid" → Thumbnail workflow

**Supporting Resources:**
- Scripts: `~/.claude/skills/Documents/Pptx/Scripts/`
- OOXML tools: `~/.claude/skills/Documents/Pptx/ooxml/`
- License: `~/.claude/skills/Documents/Pptx/LICENSE.txt`

**Key Capabilities:**
- Create presentations with html2pptx (HTML → PPTX)
- Professional design with color palettes and layouts
- Edit with OOXML for advanced features
- Work with templates (rearrange, inventory, replace)
- Generate thumbnail grids for visual analysis
- Convert to images for inspection

### Excel Spreadsheets (XLSX)

**Reference Documentation:**
- `xlsx/SKILL.md` - Complete XLSX processing guide
- `xlsx/recalc.py` - Formula recalculation script

**Routing Logic:**
- "Create spreadsheet", "new Excel file" → Creation workflow (openpyxl)
- "Edit spreadsheet", "modify Excel" → Edit workflow (openpyxl)
- "Analyze data", "read Excel" → Analysis workflow (pandas)
- "Financial model", "formulas" → Financial modeling workflow
- "Recalculate formulas" → Recalculation workflow (recalc.py)

**Supporting Resources:**
- Recalc script: `~/.claude/skills/Documents/Xlsx/recalc.py`
- License: `~/.claude/skills/Documents/Xlsx/LICENSE.txt`

**Key Capabilities:**
- Create spreadsheets with formulas (openpyxl)
- Data analysis with pandas
- Financial modeling with color coding standards
- Formula recalculation with LibreOffice
- Error detection and validation
- Preserve formatting and formulas when editing

## 📋 Document Processing Principles

### DOCX Best Practices
1. **Tracked Changes** - Use redlining workflow for professional document review
2. **Minimal Edits** - Only mark text that actually changes, preserve original RSIDs
3. **Batch Changes** - Group related edits (3-10 changes) for efficient processing
4. **Verification** - Always convert to markdown to verify changes applied correctly

### PDF Best Practices
1. **Library Selection** - pypdf for basic ops, pdfplumber for text/tables, reportlab for creation
2. **OCR for Scanned** - Use pytesseract + pdf2image for scanned documents
3. **Form Filling** - Follow forms.md for programmatic form completion
4. **Command Line** - Use qpdf/pdftotext for simple operations

### PPTX Best Practices
1. **Design First** - Analyze content and choose appropriate colors/layouts before coding
2. **Web-Safe Fonts** - Only use web-safe fonts (Arial, Helvetica, Times, etc.)
3. **Visual Verification** - Always generate thumbnails to inspect layout issues
4. **Template Analysis** - Create inventory before using templates to understand structure

### XLSX Best Practices
1. **Use Formulas** - ALWAYS use Excel formulas, NEVER hardcode calculated values
2. **Zero Errors** - Deliver with zero formula errors (#REF!, #DIV/0!, etc.)
3. **Recalculate** - Run recalc.py after creating/editing to update formula values
4. **Financial Standards** - Follow color coding (blue inputs, black formulas, green links)

## Examples

**Example 1: Create proposal with tracked changes**
```
User: "Create a consulting proposal doc with redlining"
→ Routes to DOCX workflows
→ Creates document with docx-js
→ Enables tracked changes for review workflow
→ Outputs professional .docx with revision marks
```

**Example 2: Fill a PDF form programmatically**
```
User: "Fill out this NDA PDF with my info"
→ Routes to PDF workflows
→ Reads form fields from PDF
→ Fills fields programmatically with pdf-lib
→ Outputs completed, flattened PDF
```

**Example 3: Build financial model spreadsheet**
```
User: "Create a revenue projection spreadsheet"
→ Routes to XLSX workflows
→ Creates workbook with openpyxl
→ Adds formulas (never hardcoded values)
→ Runs recalc.py to update calculations
```

**Example 4: Generate professional consulting report PDF**
```
User: "Create a consulting report from the assessment data"
→ Routes to ConsultingReport workflow
→ Parses report directory for data files, markdown, diagrams
→ Compresses images (PNG→JPEG, max 1200px)
→ Generates styled HTML with professional typography
→ Converts to PDF via Playwright with headers/footers
→ Outputs McKinsey-quality A4 PDF with TOC, diagrams, color boxes
```

## 🔗 Integration with Other Skills

### Feeds Into:
- **writing** skill - Creating documents for blog posts and newsletters
- **business** skill - Creating consulting proposals and financial models
- **research** skill - Extracting data from research documents

### Uses:
- **media** skill - Creating images for document illustrations
- **development** skill - Building document processing automation
- **system** skill - Command-line tools and scripting

## 🎯 Key Principles

### Document Creation
1. **Quality First** - Professional formatting and structure from the start
2. **Template Reuse** - Leverage existing templates when available
3. **Validation** - Always verify output (visual inspection, error checking)
4. **Automation** - Use scripts for repetitive tasks

### Document Editing
1. **Preserve Intent** - Maintain original formatting and structure
2. **Track Changes** - Use proper workflows for document review
3. **Batch Processing** - Group related operations for efficiency
4. **Error Prevention** - Validate before finalizing

### Document Analysis
1. **Right Tool** - Choose appropriate library/tool for the task
2. **Data Integrity** - Preserve original data when extracting/converting
3. **Format Awareness** - Understand document structure (OOXML, PDF structure, etc.)
4. **Performance** - Use efficient methods for large documents

## 📚 Full Reference Documentation

**Word Documents (DOCX):**
- Main Guide: `~/.claude/skills/Documents/Docx/SKILL.md`
- Creation Reference: `~/.claude/skills/Documents/Docx/docx-js.md`
- Editing Reference: `~/.claude/skills/Documents/Docx/ooxml.md`

**PDF Processing:**
- Main Guide: `~/.claude/skills/Documents/Pdf/SKILL.md`
- Forms Guide: `~/.claude/skills/Documents/Pdf/forms.md`
- Advanced Reference: `~/.claude/skills/Documents/Pdf/reference.md`

**PowerPoint Presentations (PPTX):**
- Main Guide: `~/.claude/skills/Documents/Pptx/SKILL.md`
- Creation Reference: `~/.claude/skills/Documents/Pptx/html2pptx.md`
- Editing Reference: `~/.claude/skills/Documents/Pptx/ooxml.md`

**Excel Spreadsheets (XLSX):**
- Main Guide: `~/.claude/skills/Documents/Xlsx/SKILL.md`
- Recalc Script: `~/.claude/skills/Documents/Xlsx/recalc.py`

---

## Summary

**The documents skill provides comprehensive document processing:**

- **DOCX** - Create, edit, analyze Word documents with tracked changes support
- **PDF** - Create, manipulate, extract from PDFs with form filling capabilities
- **PPTX** - Create, edit presentations with professional design and templates
- **XLSX** - Create, edit spreadsheets with formulas and financial modeling

**Reference-based organization** - Each document type has complete guides and tooling

**Routing is automatic** - Analyzes user intent and activates appropriate document type workflow

**Professional quality** - Standards and best practices for production-ready documents
