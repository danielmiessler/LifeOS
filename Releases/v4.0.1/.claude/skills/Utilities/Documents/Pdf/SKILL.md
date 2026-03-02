---
name: Pdf
description: Create, merge, split, extract text/tables from PDFs, fill forms, add watermarks, and convert to/from other formats. USE WHEN pdf, PDF file, merge PDF, extract tables, fill form, split PDF.
---

# PDF Processing Guide

## 🎯 Load Full PAI Context

**Before starting any task with this skill, load complete PAI context:**

`read ~/.claude/PAI/SKILL.md`

This provides access to:
- Complete contact list (Angela, Bunny, Saša, Greg, team members)
- Stack preferences (TypeScript>Python, bun>npm, uv>pip)
- Security rules and repository safety protocols
- Response format requirements (structured emoji format)
- Voice IDs for agent routing (ElevenLabs)
- Personal preferences and operating instructions

## When to Activate This Skill

### Direct PDF Task Triggers
- User wants to **create** a new PDF document
- User wants to **merge**, **combine**, or **concatenate** multiple PDFs
- User wants to **split** or **separate** a PDF into individual pages/sections
- User mentions "**extract text from PDF**", "**PDF text extraction**"
- User mentions "**extract tables from PDF**", "**PDF tables**"
- User wants to "**fill PDF form**", "**PDF form filling**"
- User mentions "**OCR**", "**scanned PDF**", or "**scan to text**"
- User wants to add **watermarks**, **password protection**, or **encryption**
- User wants to **extract images** from a PDF
- User wants to **rotate pages** or manipulate PDF structure

### Contextual Triggers
- User provides a **.pdf file path** for processing
- User mentions form filling automation or batch PDF processing
- User needs to process PDFs programmatically at scale

## 🔀 PDF Workflow Routing

This skill supports multiple PDF processing workflows:

### Creation Workflow
**Trigger:** "create PDF", "generate PDF", "make PDF", "PDF from data"

**Tools:** reportlab (Python)
**Documentation:** Lines 136-181 (SKILL.md)

**Use Cases:**
- Creating new PDFs from scratch
- Generating reports programmatically
- Multi-page documents with text and graphics
- PDF generation from templates or data

### Merge/Split Workflow
**Trigger:** "merge PDFs", "combine PDFs", "split PDF", "separate pages"

**Tools:** pypdf (Python), qpdf (CLI)
**Documentation:** Lines 46-68 (SKILL.md), Lines 199-211 (qpdf)

**Use Cases:**
- Combining multiple PDFs into one document
- Splitting PDFs into individual pages or ranges
- Reorganizing PDF page order
- Extracting specific page ranges

### Text Extraction Workflow
**Trigger:** "extract text", "PDF to text", "read PDF content"

**Tools:** pdfplumber (Python), pdftotext (CLI)
**Documentation:** Lines 95-103 (pdfplumber), Lines 186-196 (pdftotext)

**Use Cases:**
- Extracting text while preserving layout
- Converting PDFs to plain text
- Batch text extraction from multiple PDFs
- Metadata extraction

### Table Extraction Workflow
**Trigger:** "extract tables", "PDF tables", "table data from PDF"

**Tools:** pdfplumber + pandas (Python)
**Documentation:** Lines 106-133 (SKILL.md)

**Use Cases:**
- Extracting structured table data to Excel/CSV
- Financial data extraction from PDF reports
- Converting PDF tables to dataframes
- Multi-table extraction and combination

### Form Filling Workflow
**Trigger:** "fill PDF form", "PDF form filling", "complete PDF form"

**Tools:** pdf-lib (JavaScript) or pypdf (Python)
**Documentation:** forms.md (complete guide)

**Use Cases:**
- Programmatic form completion
- Batch form processing
- Template-based PDF generation
- Form field population from data sources

### OCR Workflow
**Trigger:** "OCR", "scanned PDF", "extract text from scan", "image to text"

**Tools:** pytesseract + pdf2image (Python)
**Documentation:** Lines 227-244 (SKILL.md)

**Use Cases:**
- Extracting text from scanned documents
- Processing image-based PDFs
- Converting scanned forms to editable text
- Legacy document digitization

### Manipulation Workflow
**Trigger:** "watermark", "password protect", "encrypt PDF", "rotate pages", "extract images"

**Tools:** pypdf (Python), pdfimages (CLI)
**Documentation:** Lines 246-288 (SKILL.md)

**Use Cases:**
- Adding watermarks to PDFs
- Password protection and encryption
- Page rotation and transformation
- Image extraction from PDFs

## Overview

This guide covers essential PDF processing operations using Python libraries and command-line tools. For advanced features, JavaScript libraries, and detailed examples, see reference.md. If you need to fill out a PDF form, read forms.md and follow its instructions.

## Quick Start

```python
from pypdf import PdfReader, PdfWriter

# Read a PDF
reader = PdfReader("document.pdf")
print(f"Pages: {len(reader.pages)}")

# Extract text
text = ""
for page in reader.pages:
    text += page.extract_text()
```

## Python Libraries

### pypdf - Basic Operations

#### Merge PDFs
```python
from pypdf import PdfWriter, PdfReader

writer = PdfWriter()
for pdf_file in ["doc1.pdf", "doc2.pdf", "doc3.pdf"]:
    reader = PdfReader(pdf_file)
    for page in reader.pages:
        writer.add_page(page)

with open("merged.pdf", "wb") as output:
    writer.write(output)
```

#### Split PDF
```python
reader = PdfReader("input.pdf")
for i, page in enumerate(reader.pages):
    writer = PdfWriter()
    writer.add_page(page)
    with open(f"page_{i+1}.pdf", "wb") as output:
        writer.write(output)
```

#### Extract Metadata
```python
reader = PdfReader("document.pdf")
meta = reader.metadata
print(f"Title: {meta.title}")
print(f"Author: {meta.author}")
print(f"Subject: {meta.subject}")
print(f"Creator: {meta.creator}")
```

#### Rotate Pages
```python
reader = PdfReader("input.pdf")
writer = PdfWriter()

page = reader.pages[0]
page.rotate(90)  # Rotate 90 degrees clockwise
writer.add_page(page)

with open("rotated.pdf", "wb") as output:
    writer.write(output)
```

### pdfplumber - Text and Table Extraction

#### Extract Text with Layout
```python
import pdfplumber

with pdfplumber.open("document.pdf") as pdf:
    for page in pdf.pages:
        text = page.extract_text()
        print(text)
```

#### Extract Tables
```python
with pdfplumber.open("document.pdf") as pdf:
    for i, page in enumerate(pdf.pages):
        tables = page.extract_tables()
        for j, table in enumerate(tables):
            print(f"Table {j+1} on page {i+1}:")
            for row in table:
                print(row)
```

#### Advanced Table Extraction
```python
import pandas as pd

with pdfplumber.open("document.pdf") as pdf:
    all_tables = []
    for page in pdf.pages:
        tables = page.extract_tables()
        for table in tables:
            if table:  # Check if table is not empty
                df = pd.DataFrame(table[1:], columns=table[0])
                all_tables.append(df)

# Combine all tables
if all_tables:
    combined_df = pd.concat(all_tables, ignore_index=True)
    combined_df.to_excel("extracted_tables.xlsx", index=False)
```

### reportlab - Create PDFs

#### Basic PDF Creation
```python
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

c = canvas.Canvas("hello.pdf", pagesize=letter)
width, height = letter

# Add text
c.drawString(100, height - 100, "Hello World!")
c.drawString(100, height - 120, "This is a PDF created with reportlab")

# Add a line
c.line(100, height - 140, 400, height - 140)

# Save
c.save()
```

#### Create PDF with Multiple Pages
```python
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet

doc = SimpleDocTemplate("report.pdf", pagesize=letter)
styles = getSampleStyleSheet()
story = []

# Add content
title = Paragraph("Report Title", styles['Title'])
story.append(title)
story.append(Spacer(1, 12))

body = Paragraph("This is the body of the report. " * 20, styles['Normal'])
story.append(body)
story.append(PageBreak())

# Page 2
story.append(Paragraph("Page 2", styles['Heading1']))
story.append(Paragraph("Content for page 2", styles['Normal']))

# Build PDF
doc.build(story)
```

## Command-Line Tools

### pdftotext (poppler-utils)
```bash
# Extract text
pdftotext input.pdf output.txt

# Extract text preserving layout
pdftotext -layout input.pdf output.txt

# Extract specific pages
pdftotext -f 1 -l 5 input.pdf output.txt  # Pages 1-5
```

### qpdf
```bash
# Merge PDFs
qpdf --empty --pages file1.pdf file2.pdf -- merged.pdf

# Split pages
qpdf input.pdf --pages . 1-5 -- pages1-5.pdf
qpdf input.pdf --pages . 6-10 -- pages6-10.pdf

# Rotate pages
qpdf input.pdf output.pdf --rotate=+90:1  # Rotate page 1 by 90 degrees

# Remove password
qpdf --password=mypassword --decrypt encrypted.pdf decrypted.pdf
```

### pdftk (if available)
```bash
# Merge
pdftk file1.pdf file2.pdf cat output merged.pdf

# Split
pdftk input.pdf burst

# Rotate
pdftk input.pdf rotate 1east output rotated.pdf
```

## Common Tasks

### Extract Text from Scanned PDFs
```python
# Requires: pip install pytesseract pdf2image
import pytesseract
from pdf2image import convert_from_path

# Convert PDF to images
images = convert_from_path('scanned.pdf')

# OCR each page
text = ""
for i, image in enumerate(images):
    text += f"Page {i+1}:\n"
    text += pytesseract.image_to_string(image)
    text += "\n\n"

print(text)
```

### Add Watermark
```python
from pypdf import PdfReader, PdfWriter

# Create watermark (or load existing)
watermark = PdfReader("watermark.pdf").pages[0]

# Apply to all pages
reader = PdfReader("document.pdf")
writer = PdfWriter()

for page in reader.pages:
    page.merge_page(watermark)
    writer.add_page(page)

with open("watermarked.pdf", "wb") as output:
    writer.write(output)
```

### Extract Images
```bash
# Using pdfimages (poppler-utils)
pdfimages -j input.pdf output_prefix

# This extracts all images as output_prefix-000.jpg, output_prefix-001.jpg, etc.
```

### Password Protection
```python
from pypdf import PdfReader, PdfWriter

reader = PdfReader("input.pdf")
writer = PdfWriter()

for page in reader.pages:
    writer.add_page(page)

# Add password
writer.encrypt("userpassword", "ownerpassword")

with open("encrypted.pdf", "wb") as output:
    writer.write(output)
```

## Quick Reference

| Task | Best Tool | Command/Code |
|------|-----------|--------------|
| Merge PDFs | pypdf | `writer.add_page(page)` |
| Split PDFs | pypdf | One page per file |
| Extract text | pdfplumber | `page.extract_text()` |
| Extract tables | pdfplumber | `page.extract_tables()` |
| Create PDFs | reportlab | Canvas or Platypus |
| Command line merge | qpdf | `qpdf --empty --pages ...` |
| OCR scanned PDFs | pytesseract | Convert to image first |
| Fill PDF forms | pdf-lib or pypdf (see forms.md) | See forms.md |

## Examples

**Example 1: Extract tables from PDF report**
```
User: "Pull the tables out of this quarterly report PDF"
→ Opens PDF with pdfplumber
→ Extracts tables, converts to pandas DataFrame
→ Exports to Excel file with clean formatting
```

**Example 2: Merge multiple PDFs**
```
User: "Combine these three contracts into one PDF"
→ Uses pypdf to read all input files
→ Adds pages sequentially to new writer
→ Saves merged document to output path
```

**Example 3: Fill out a PDF form**
```
User: "Fill in this tax form with my info"
→ Reads forms.md for form-filling workflow
→ Uses pdf-lib to populate form fields
→ Saves completed PDF with flattened form data
```

## Next Steps

- For advanced pypdfium2 usage, see reference.md
- For JavaScript libraries (pdf-lib), see reference.md
- If you need to fill out a PDF form, follow the instructions in forms.md
- For troubleshooting guides, see reference.md
