# PDF Document Extraction Workflow

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the ExtractPdf workflow in the Parser skill to parse PDFs"}' \
  > /dev/null 2>&1 &
```

Running the **ExtractPdf** workflow in the **Parser** skill to parse PDFs...

**Purpose:** Extract text, metadata, and entities from PDF documents (research papers, reports, ebooks)

**When to Use:** Content type detected as "pdf" from URL extension or Content-Type header

---

## Extraction Steps

### 1. PDF Download and Text Extraction

**Download PDF:**
```bash
curl -L -o temp.pdf "[PDF_URL]"
```

**Extract text using pdftotext or similar:**
```bash
pdftotext temp.pdf output.txt
# or
python -c "import PyPDF2; ..."
```

**Extract:**
- Full text content
- Preserve structure (sections, paragraphs)
- Extract tables if possible
- Get page count
- Calculate word count

**Handle encryption/protection:**
- If password-protected, log warning and skip
- If copy-protected, attempt extraction anyway
- Log any extraction issues in warnings

---

### 2. PDF Metadata Extraction

**Extract PDF metadata:**
```bash
pdfinfo temp.pdf
```

**Metadata fields:**
- Title
- Author(s)
- Subject/description
- Keywords
- Creation date
- Modification date
- Producer (PDF creator software)
- Page count

**Example:**
```
Title: Attention Is All You Need
Author: Vaswani, Ashish; Shazeer, Noam; et al.
Subject: Transformer architecture for sequence modeling
Keywords: neural networks, attention mechanism, transformers
CreationDate: 2017-06-12
Pages: 15
```

---

### 3. Research Paper Detection

**Detect if PDF is research paper:**

**Indicators:**
- ArXiv URL pattern
- Abstract section present
- References/bibliography section
- DOI present
- Academic author affiliations
- Published in conference/journal

**If research paper:**
- Extract abstract separately
- Extract bibliography/citations
- Identify authors and affiliations
- Extract publication venue
- Get DOI if available

---

### 4. Gemini Analysis

**Send full text to Gemini for entity extraction:**

**Prompt:** Use `prompts/entity-extraction.md`

**Extract:**
- Authors (all listed authors)
- Organizations/institutions (author affiliations)
- Companies mentioned in paper
- People cited in references
- Technical concepts and terminology

**Example:**
```json
// Author
{
  "name": "Ashish Vaswani",
  "role": "author",
  "title": "Research Scientist",
  "company": "Google Brain",
  "social": {
    "twitter": null,
    "linkedin": null,
    "email": null, // often in papers
    "website": null
  },
  "context": "Lead author of transformer architecture paper",
  "importance": "primary"
}
```

---

### 5. Summarization

**Use Gemini for summaries:**

**Short (1-2 sentences):**
```
Introduces the Transformer architecture based solely on attention mechanisms, eliminating recurrence and convolutions for sequence modeling tasks.
```

**Medium (paragraph):**
```
Presents the Transformer, a novel neural network architecture that relies entirely on self-attention mechanisms rather than recurrent or convolutional layers. The model achieves state-of-the-art results on machine translation tasks while being more parallelizable and requiring less training time than previous architectures. Key innovation is the multi-head attention mechanism that allows the model to attend to information from different representation subspaces.
```

**Long (comprehensive):**
```
[Full summary including: motivation, methodology, results, key innovations, comparisons to prior work, implications, future directions]
```

**Key excerpts:**
- Abstract (full text)
- Key findings from results section
- Notable quotes or claims
- Important equations or algorithms (described)

---

### 6. Citation Extraction

**Extract references/bibliography:**

**Parse references section:**
- Each cited work
- Authors of cited works
- Publication details
- DOIs if available

**Add to sources array:**
```json
{
  "publication": "Neural Information Processing Systems (NeurIPS)",
  "author": "Sutskever et al.",
  "url": "https://arxiv.org/abs/1409.3215",
  "published_date": "2014-09-02T00:00:00Z",
  "source_type": "research_paper"
}
```

---

### 7. Topic Classification

**For research papers:**
- Primary category: Extract from ArXiv category if available
- Tags: Technical terms, methods, applications
- Keywords: From PDF metadata + extracted concepts
- Themes: Main contributions and innovations

**For reports/ebooks:**
- Analyze table of contents
- Extract chapter titles
- Identify main topics covered

**Example (research paper):**
```json
{
  "primary_category": "AI",
  "secondary_categories": ["research", "machine-learning"],
  "tags": [
    "transformers",
    "attention-mechanism",
    "neural-networks",
    "sequence-modeling",
    "nlp"
  ],
  "keywords": [
    "attention",
    "transformer",
    "self-attention",
    "multi-head attention",
    "encoder-decoder"
  ],
  "themes": [
    "Attention-only architecture",
    "Parallelizable sequence modeling",
    "State-of-the-art machine translation"
  ],
  "newsletter_sections": ["AI", "Research"]
}
```

---

### 8. Content Analysis

**Research papers:**
- Importance: Based on citation count, venue, novelty
- Novelty: Groundbreaking (9-10), incremental (4-6), survey (1-3)
- Controversy: Assess if methods/claims are debated

**Reports/ebooks:**
- Importance: Based on author authority, publisher, topic relevance
- Novelty: Original research vs compilation
- Controversy: Assess if conclusions are disputed

**Relevance to audience:**
- AI researchers
- Security professionals
- Technologists
- Executives

---

### 9. Schema Population

**Populate content section:**
```json
{
  "content": {
    "id": "uuid-generated",
    "type": "pdf",
    "title": "Attention Is All You Need",
    "summary": {
      "short": "...",
      "medium": "...",
      "long": "..."
    },
    "content": {
      "full_text": "[Full PDF text extracted]",
      "transcript": null,
      "excerpts": [
        "Abstract: [full abstract]",
        "\"The Transformer is the first transduction model relying entirely on self-attention\"",
        "Key finding: BLEU score of 28.4 on WMT 2014 English-to-German"
      ]
    },
    "metadata": {
      "source_url": "https://arxiv.org/pdf/1706.03762.pdf",
      "canonical_url": "https://arxiv.org/abs/1706.03762",
      "published_date": "2017-06-12T00:00:00Z",
      "accessed_date": "2024-01-16T15:00:00Z",
      "language": "en",
      "word_count": 7500,
      "read_time_minutes": 30,
      "author_platform": "arxiv"
    }
  }
}
```

**Set confidence score:**
- Full text extracted, good metadata: 0.8-0.9
- Partial extraction: 0.5-0.7
- Metadata only (encrypted PDF): 0.2-0.4

---

## Error Handling

**Password-protected PDF:**
```
⚠️ PDF is password-protected
→ Extract metadata only
→ Confidence: 0.2
→ Warning: "Cannot extract text - PDF is encrypted"
```

**Scanned PDF (images, no text):**
```
⚠️ PDF contains scanned images
→ Attempt OCR if available
→ If OCR fails, extract metadata only
→ Lower confidence score
→ Warning: "PDF appears to be scanned images, text extraction limited"
```

**Corrupted PDF:**
```
❌ PDF file is corrupted
→ Cannot extract content
→ Log error
→ Return minimal metadata from URL/filename
```

---

## Output Example

**Successful extraction (research paper):**
```
✅ Extracted PDF (research paper)
📄 Title: Attention Is All You Need
✍️ Authors: Vaswani et al. (8 authors)
📅 Published: 2017-06-12
📝 Content: 7,500 words (15 pages)
👥 People: 8 authors
🏢 Companies: 2 (Google Brain, Google Research)
📚 Citations: 42 references
🎯 Confidence: 0.88
```

**Partial extraction (encrypted PDF):**
```
⚠️ Extracted PDF metadata only (encrypted)
📄 Title: Proprietary Research Report
📝 Content: Text extraction failed (password-protected)
🎯 Confidence: 0.25
⚠️ Warning: PDF is encrypted, cannot extract full text
```

---

**This workflow handles PDF extraction including research papers, reports, and documents.**
