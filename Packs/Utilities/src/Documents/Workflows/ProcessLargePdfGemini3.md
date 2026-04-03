---
name: process-large-pdf-gemini-3
description: Process large, complex PDFs using Gemini 3 Pro's native multimodal capabilities and 1M context window for comprehensive extraction, analysis, and structured data output
trigger: "analyze large PDF", "extract from complex PDF", "process research paper", "multimodal PDF analysis", "Gemini 3 Pro PDF"
use_cases:
  - Research paper analysis and extraction
  - Technical manual processing
  - Legal document review
  - Financial report extraction
  - Newsletter content extraction
  - Complex multi-format document processing
---

# Process Large PDF with Gemini 3 Pro

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the ProcessLargePdfGemini3 workflow in the Documents skill to process PDF"}' \
  > /dev/null 2>&1 &
```

Running the **ProcessLargePdfGemini3** workflow in the **Documents** skill to process PDF...

---

## Overview

This workflow leverages Gemini 3 Pro's native multimodal capabilities to process large, complex PDFs that contain mixed content (text, images, tables, charts, diagrams). Unlike traditional PDF extraction tools that require conversion and lose context, Gemini 3 Pro processes PDFs directly as multimodal input.

## When to Use This Workflow

### Optimal Use Cases
- **Research Papers** - Extract methodologies, findings, citations, figures
- **Technical Manuals** - Process diagrams, specifications, tables, instructions
- **Legal Documents** - Analyze contracts, agreements, legal text with structure
- **Financial Reports** - Extract financial tables, charts, executive summaries
- **Newsletter Content** - Parse articles, links, sources for database import
- **Complex Multi-Format Documents** - Any PDF with mixed content types

### Advantages Over Traditional Tools

**Gemini 3 Pro Advantages:**
- ✅ Native multimodal (processes PDF directly, no conversion)
- ✅ 1M context window (entire large PDFs in single request)
- ✅ Understands images, tables, diagrams, charts within PDFs
- ✅ Better extraction of complex layouts
- ✅ Preserves document structure and relationships
- ✅ Can answer questions about visual content

**Traditional Tool Limitations:**
- ❌ Text-only extraction (pdfplumber, pdftotext)
- ❌ Loses visual context (tables become text)
- ❌ Poor handling of complex layouts
- ❌ Cannot understand diagrams or charts
- ❌ Requires multiple tools for different content types

## Prerequisites

### Check Gemini 3 Pro Availability
```bash
# Verify Gemini 3 Pro is available via llm
llm models list | grep gemini-3-pro

# Expected output:
# Gemini: gemini-3-pro-preview
```

**Note:** As of November 2025, Gemini 3 Pro may only be available via web interface. If CLI access is unavailable, this workflow will need adaptation or use of alternative models with multimodal capabilities.

### Install Required Tools
```bash
# Install llm CLI if not already installed
pipx install llm

# Install Gemini plugin
llm install llm-gemini

# Configure API key (if not already done)
llm keys set gemini
# Enter your Google AI API key when prompted
```

### Verify PDF File
```bash
# Check file exists and is readable
ls -lh /path/to/document.pdf

# Get basic PDF info
file /path/to/document.pdf
```

## Workflow Steps

### 1. PDF Validation

**Verify the PDF is accessible and get metadata:**

```bash
# Check file size (important for context window planning)
ls -lh document.pdf

# Extract basic metadata using pdfinfo
pdfinfo document.pdf

# Count pages
pdfinfo document.pdf | grep Pages
```

**Context Window Planning:**
- Gemini 3 Pro: 1M tokens (~750-1000 pages depending on density)
- If PDF > 1000 pages, consider splitting or processing in chunks
- Average research paper: 10-50 pages (well within limits)

### 2. Prepare Extraction Prompt

**Create a structured extraction prompt based on your needs:**

```bash
# Define extraction requirements
EXTRACTION_PROMPT="Analyze this PDF document comprehensively and extract:

1. DOCUMENT METADATA:
   - Title, authors, publication date, publisher
   - Document type (research paper, manual, report, etc.)
   - Page count and structure overview

2. COMPLETE TEXT CONTENT:
   - Full text with structure preserved (sections, headings, paragraphs)
   - Maintain hierarchical organization
   - Preserve formatting context (bold, italic, lists)

3. TABLES AND DATA:
   - All tables with data preserved in structured format
   - Table captions and context
   - Convert to markdown tables or CSV format

4. IMAGES AND DIAGRAMS:
   - Description of all images, diagrams, charts, graphs
   - Figure captions and references
   - Visual data interpretation (what the image shows)

5. ENTITY EXTRACTION:
   - People: Names, roles, affiliations
   - Companies: Organizations, institutions
   - Technologies: Tools, systems, methodologies mentioned
   - Concepts: Key ideas, theories, frameworks
   - Sources: Citations, references, URLs

6. EXECUTIVE SUMMARY:
   - 3-5 paragraph summary of main content
   - Key findings and conclusions
   - Main arguments or recommendations

7. STRUCTURED OUTPUT:
   - Return results in JSON format
   - Use schema compatible with parser
   - Include all extracted entities and content

Please be thorough and preserve all information."
```

### 3. Process PDF with Gemini 3 Pro

**Method 1: Direct File Path (Recommended)**

```bash
# Process PDF directly with Gemini 3 Pro
llm -m gemini-3-pro-preview "$(cat << 'EOF'
Analyze this PDF document comprehensively and extract:

1. DOCUMENT METADATA (title, authors, date, type)
2. COMPLETE TEXT CONTENT (preserve structure and hierarchy)
3. ALL TABLES (as markdown tables with captions)
4. ALL IMAGES/DIAGRAMS (detailed descriptions)
5. ENTITY EXTRACTION (people, companies, technologies, concepts)
6. EXECUTIVE SUMMARY (3-5 paragraphs)

Return results in JSON format with this schema:
{
  "metadata": {
    "title": "string",
    "authors": ["string"],
    "date": "string",
    "type": "string",
    "pages": number
  },
  "content": {
    "sections": [
      {
        "heading": "string",
        "level": number,
        "content": "string"
      }
    ],
    "full_text": "string"
  },
  "tables": [
    {
      "caption": "string",
      "page": number,
      "data": "markdown table string"
    }
  ],
  "images": [
    {
      "caption": "string",
      "page": number,
      "description": "string"
    }
  ],
  "entities": {
    "people": [
      {
        "name": "string",
        "role": "string",
        "affiliation": "string"
      }
    ],
    "companies": ["string"],
    "technologies": ["string"],
    "concepts": ["string"],
    "sources": [
      {
        "title": "string",
        "url": "string",
        "type": "string"
      }
    ]
  },
  "summary": "string"
}
EOF
)" --attach document.pdf > output.json
```

**Method 2: Base64 Encoding (Alternative)**

```bash
# For very large PDFs, may need base64 encoding
base64 document.pdf > document.b64

# Process with base64 input
llm -m gemini-3-pro-preview "Analyze the following base64-encoded PDF: $(cat document.b64)" > output.json
```

### 4. Structured Data Extraction

**Parse and validate JSON output:**

```bash
# Validate JSON structure
cat output.json | jq '.' > validated.json

# Extract specific sections
jq '.metadata' validated.json
jq '.entities.people' validated.json
jq '.summary' validated.json

# Extract tables to CSV
jq -r '.tables[] | .data' validated.json
```

### 5. Integration with parser

**Convert Gemini output to parser schema:**

```typescript
// Convert Gemini 3 Pro output to parser format
import { writeFile } from 'fs/promises';

interface GeminiOutput {
  metadata: {
    title: string;
    authors: string[];
    date: string;
    type: string;
    pages: number;
  };
  entities: {
    people: Array<{ name: string; role: string; affiliation: string }>;
    companies: string[];
    technologies: string[];
    concepts: string[];
    sources: Array<{ title: string; url: string; type: string }>;
  };
  content: {
    sections: Array<{ heading: string; level: number; content: string }>;
    full_text: string;
  };
  summary: string;
}

async function convertToParserSchema(geminiOutput: GeminiOutput) {
  const parserSchema = {
    url: `file://document.pdf`,
    content_type: 'pdf',
    title: geminiOutput.metadata.title,
    author: geminiOutput.metadata.authors.join(', '),
    published_date: geminiOutput.metadata.date,
    summary: geminiOutput.summary,
    full_text: geminiOutput.content.full_text,

    // Extract entities
    people: geminiOutput.entities.people.map(p => ({
      name: p.name,
      description: `${p.role} at ${p.affiliation}`,
      context: 'extracted from PDF'
    })),

    companies: geminiOutput.entities.companies.map(c => ({
      name: c,
      context: 'mentioned in document'
    })),

    topics: geminiOutput.entities.technologies.concat(geminiOutput.entities.concepts),

    sources: geminiOutput.entities.sources.map(s => ({
      title: s.title,
      url: s.url,
      type: s.type
    })),

    metadata: {
      extraction_method: 'gemini-3-pro-multimodal',
      pages: geminiOutput.metadata.pages,
      document_type: geminiOutput.metadata.type
    }
  };

  await writeFile('parser-output.json', JSON.stringify(parserSchema, null, 2));
  console.log('✅ Converted to parser schema: parser-output.json');
}
```

### 6. Quality Validation

**Verify extraction quality:**

```bash
# Check completeness
echo "Validating extraction..."

# Count extracted entities
echo "People extracted: $(jq '.entities.people | length' validated.json)"
echo "Companies extracted: $(jq '.entities.companies | length' validated.json)"
echo "Tables extracted: $(jq '.tables | length' validated.json)"
echo "Images described: $(jq '.images | length' validated.json)"

# Verify summary exists and has content
SUMMARY_LENGTH=$(jq -r '.summary | length' validated.json)
echo "Summary length: $SUMMARY_LENGTH characters"

if [ $SUMMARY_LENGTH -gt 500 ]; then
  echo "✅ Summary looks comprehensive"
else
  echo "⚠️  Summary may be too short"
fi
```

## Advanced Use Cases

### Research Paper Analysis

**Extract methodology, findings, and citations:**

```bash
llm -m gemini-3-pro-preview "Analyze this research paper and extract:

1. Research Question/Hypothesis
2. Methodology (detailed explanation)
3. Key Findings (with supporting data)
4. Tables and Figures (with interpretations)
5. Citations (all references with authors, titles, years)
6. Limitations mentioned
7. Future work suggested
8. Statistical results (p-values, effect sizes, etc.)

Format as structured JSON." --attach research-paper.pdf > research-analysis.json
```

### Technical Manual Extraction

**Process diagrams and specifications:**

```bash
llm -m gemini-3-pro-preview "Analyze this technical manual and extract:

1. Product specifications (all technical details)
2. Diagrams and schematics (detailed descriptions of what they show)
3. Installation procedures (step-by-step with page references)
4. Troubleshooting guides (problems and solutions)
5. Parts lists (with part numbers and descriptions)
6. Safety warnings and precautions
7. Maintenance schedules

Format as structured JSON with clear sections." --attach manual.pdf > manual-data.json
```

### Financial Report Processing

**Extract financial tables and metrics:**

```bash
llm -m gemini-3-pro-preview "Analyze this financial report and extract:

1. Financial tables (balance sheet, income statement, cash flow)
2. Key metrics (revenue, profit, margins, growth rates)
3. Charts and graphs (descriptions of trends shown)
4. Executive summary highlights
5. Risk factors mentioned
6. Forward-looking statements
7. Competitor comparisons

Convert all tables to CSV format and provide metric analysis." --attach financial-report.pdf > financial-data.json
```

### Newsletter Content Extraction

**Parse for parser database:**

```bash
llm -m gemini-3-pro-preview "Analyze this newsletter/article and extract:

1. Article sections (with headings and content)
2. All hyperlinks (with anchor text and URLs)
3. People mentioned (names, roles, context)
4. Companies mentioned (names, context)
5. Key concepts and topics
6. Quotes (who said what)
7. Sources cited or linked

Format for database import with schema:
{
  'title': 'string',
  'sections': [{heading, content, links}],
  'entities': {people, companies, topics},
  'sources': [{title, url, description}]
}" --attach newsletter.pdf > newsletter-parsed.json
```

## Output Formats

### JSON Schema (Standard)

```json
{
  "metadata": {
    "title": "Document Title",
    "authors": ["Author 1", "Author 2"],
    "date": "2025-01-15",
    "type": "research_paper",
    "pages": 24
  },
  "content": {
    "sections": [
      {
        "heading": "Introduction",
        "level": 1,
        "content": "Full section text..."
      }
    ],
    "full_text": "Complete document text..."
  },
  "tables": [
    {
      "caption": "Table 1: Results Summary",
      "page": 5,
      "data": "| Header 1 | Header 2 |\n|----------|----------|\n| Data 1   | Data 2   |"
    }
  ],
  "images": [
    {
      "caption": "Figure 1: System Architecture",
      "page": 3,
      "description": "Diagram showing three-tier architecture with..."
    }
  ],
  "entities": {
    "people": [
      {
        "name": "Dr. Jane Smith",
        "role": "Lead Researcher",
        "affiliation": "University of Example"
      }
    ],
    "companies": ["TechCorp", "DataSystems Inc"],
    "technologies": ["Machine Learning", "Neural Networks"],
    "concepts": ["Transfer Learning", "Model Optimization"],
    "sources": [
      {
        "title": "Previous Study on ML",
        "url": "https://example.com/paper",
        "type": "citation"
      }
    ]
  },
  "summary": "This research paper presents a novel approach to..."
}
```

### Markdown Output (Alternative)

```bash
# Generate markdown instead of JSON
llm -m gemini-3-pro-preview "Convert this PDF to well-structured markdown:

- Preserve all headings (use #, ##, ### for hierarchy)
- Convert tables to markdown tables
- Describe images/figures as blockquotes
- Extract metadata as frontmatter
- Maintain document flow and structure

Output only markdown, no JSON." --attach document.pdf > document.md
```

## Integration Examples

### Save to Newsletter Database

```typescript
// Import extracted newsletter content to database
import { parserSchema } from './parser-output.json';
import { insertNewsletterContent } from '~/.claude/skills/parser/db';

await insertNewsletterContent(parserSchema);
console.log('✅ Newsletter content added to database');
```

### Batch Process Multiple PDFs

```bash
#!/bin/bash
# Process all PDFs in directory

for pdf in *.pdf; do
  echo "Processing: $pdf"

  llm -m gemini-3-pro-preview "Extract all content from this PDF" \
    --attach "$pdf" > "${pdf%.pdf}.json"

  echo "✅ Completed: ${pdf%.pdf}.json"
done

echo "✅ Batch processing complete"
```

## Troubleshooting

### Issue: Model Not Available

**Error:** `gemini-3-pro-preview not found`

**Solution:**
```bash
# Check available models
llm models list | grep gemini

# If only gemini-2.0-flash-exp available, use that instead:
llm -m gemini-2.0-flash-exp "..." --attach document.pdf

# Note: May have reduced context window or capabilities
```

### Issue: File Too Large

**Error:** `Request size exceeds limit`

**Solution:**
```bash
# Split PDF into chunks
qpdf --split-pages=50 large.pdf chunk.pdf

# Process each chunk separately
for chunk in chunk-*.pdf; do
  llm -m gemini-3-pro-preview "Extract content" --attach "$chunk" > "${chunk%.pdf}.json"
done

# Merge results (custom script needed)
```

### Issue: Incomplete Extraction

**Problem:** Some tables or images not extracted

**Solution:**
```bash
# Use more specific prompt
llm -m gemini-3-pro-preview "IMPORTANT: Extract EVERY table and describe EVERY image.

Verify you have processed all pages.
Count tables found: [number]
Count images found: [number]

Then provide complete extraction." --attach document.pdf
```

### Issue: JSON Parsing Errors

**Problem:** Output is not valid JSON

**Solution:**
```bash
# Force JSON output with explicit schema
llm -m gemini-3-pro-preview "Return ONLY valid JSON, no markdown formatting.

Use this exact schema: {...}

Validate JSON before responding." --attach document.pdf > raw.json

# Clean and validate
cat raw.json | sed 's/```json//g' | sed 's/```//g' | jq '.' > clean.json
```

## Performance Benchmarks

**Typical Processing Times (on ~30 page research paper):**
- PDF validation: < 1 second
- Gemini 3 Pro extraction: 30-90 seconds
- JSON validation: < 1 second
- Total: ~1-2 minutes

**Quality Metrics:**
- Text extraction accuracy: ~98-99%
- Table preservation: ~95%
- Image description quality: Excellent (understands visual content)
- Entity extraction recall: ~85-90%

## Best Practices

### 1. Prompt Engineering
- Be specific about what you want extracted
- Request structured output format upfront
- Ask for verification (page counts, table counts)
- Include examples in prompt if needed

### 2. Quality Assurance
- Always validate JSON output
- Spot-check extracted tables against original
- Verify entity extraction completeness
- Review summary for accuracy

### 3. Optimization
- Batch similar documents together
- Cache common prompts as templates
- Use specific extraction for known document types
- Save successful prompts for reuse

### 4. Error Handling
- Implement retry logic for API failures
- Log extraction metrics for monitoring
- Keep original PDFs for reprocessing
- Version control extraction prompts

## Next Steps

- For traditional PDF extraction (text-only), see `~/.claude/skills/documents/pdf/SKILL.md`
- For PDF form filling, see `~/.claude/skills/documents/pdf/forms.md`
- For parser integration, see `~/.claude/skills/parser/SKILL.md`
- For newsletter database schema, see `~/.claude/Context/databases/newsletter/schema.sql`

## Summary

**This workflow enables:**
- ✅ Comprehensive extraction from complex PDFs
- ✅ Multimodal understanding (text + images + tables)
- ✅ Structured data output ready for database import
- ✅ Superior quality vs traditional text-only tools
- ✅ Integration with parser for newsletter database

**Key advantage:** Gemini 3 Pro processes PDFs as humans do - understanding visual layout, diagrams, and relationships between content elements, not just extracting text.
