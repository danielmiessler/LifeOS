---
name: documents
description: Read, write, convert, and analyze documents — routes to PDF, DOCX, XLSX, PPTX sub-skills for creation, editing, extraction, and format conversion. USE WHEN document, process file, create document, convert format, extract text, PDF, DOCX, XLSX, PPTX, Word, Excel, spreadsheet, PowerPoint, presentation, slides, consulting report, large PDF, merge PDF, fill form, tracked changes, redlining.
---

## Customization

Check for user customizations at `~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/Documents/` — if present, load and apply overrides before proceeding.

## Notification

```bash
curl -s -X POST http://localhost:8888/notify -H "Content-Type: application/json" -d '{"message": "Running the WORKFLOWNAME workflow in the Documents skill to ACTION"}' > /dev/null 2>&1 &
```

# Documents Skill

**Before starting any task, load PAI context:** `read ~/.claude/PAI/SKILL.md`

## Workflow Routing

| Request Pattern | Route To |
|---|---|
| Consulting report, McKinsey report, assessment report, professional PDF | `Workflows/ConsultingReport.md` |
| Large PDF, process big PDF, Gemini PDF | `Workflows/ProcessLargePdfGemini3.md` |
| Word document, DOCX, create docx, edit docx, tracked changes, redlining | `Docx/SKILL.md` |
| PDF, create PDF, merge PDF, split PDF, extract text from PDF, fill form | `Pdf/SKILL.md` |
| Presentation, PPTX, slides, PowerPoint, speaker notes | `Pptx/SKILL.md` |
| Spreadsheet, XLSX, Excel, formulas, financial model, data analysis | `Xlsx/SKILL.md` |

## Examples

```
User: "Create a consulting proposal doc with redlining"
→ Routes to Docx/SKILL.md → creates with docx-js → enables tracked changes
```

```
User: "Fill out this NDA PDF with my info"
→ Routes to Pdf/SKILL.md → reads form fields → fills with pdf-lib → outputs flattened PDF
```

```
User: "Create a revenue projection spreadsheet"
→ Routes to Xlsx/SKILL.md → creates with openpyxl → adds formulas → runs recalc.py
```

```
User: "Create a consulting report from the assessment data"
→ Routes to Workflows/ConsultingReport.md → HTML generation → Playwright PDF output
```

