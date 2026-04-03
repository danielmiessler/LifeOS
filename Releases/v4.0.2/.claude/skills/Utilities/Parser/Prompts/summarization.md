# Summarization Prompt (Gemini)

**Purpose:** Generate multi-level summaries and extract key excerpts from content

**When to Use:** All content types after gathering raw content

---

## Prompt Template

```
You are creating summaries for a newsletter database. Generate three levels of summaries and extract key excerpts from the following content.

CONTENT TO ANALYZE:
"""
{content_text}
"""

CONTENT TYPE: {type}
TITLE: {title}

---

TASK 1: MULTI-LEVEL SUMMARIES

Generate three summaries at different lengths:

**SHORT SUMMARY (1-2 sentences, ~280 characters max - Twitter length):**
- Concise, punchy summary of the main point
- Should work as a standalone tweet or headline extension
- Focus on the "what" and "why it matters"

**MEDIUM SUMMARY (Single paragraph, 100-150 words):**
- Newsletter-preview length
- Cover main points and key takeaways
- Include context that makes reader want to read more
- Mention notable people, companies, or findings

**LONG SUMMARY (2-4 paragraphs, 300-500 words):**
- Comprehensive summary covering all major points
- Include methodology, findings, implications
- Notable quotes or statistics
- Context and background
- Future implications or next steps

---

TASK 2: KEY EXCERPTS

Extract 3-5 key excerpts that are:
- Notable quotes from people
- Surprising or significant statistics
- Core arguments or findings
- Memorable insights or predictions
- Technical details worth highlighting

Each excerpt should be:
- A direct quote or specific fact (with context if needed)
- Self-contained and meaningful on its own
- Representative of important content

---

SUMMARIZATION GUIDELINES:

**Writing Style:**
- Clear, direct, informative
- Avoid hyperbole unless present in source
- Focus on facts and insights, not fluff
- Use active voice
- Be specific, not vague

**Content Coverage:**
- Capture the main thesis or announcement
- Include key supporting evidence
- Mention primary people and companies
- Note any controversy or debate
- Highlight novel or surprising elements

**For Different Content Types:**

**Articles:**
- Lead with the main news or finding
- Include author's main argument
- Note any data or studies cited
- Mention implications or predictions

**Videos/Podcasts:**
- Summarize main discussion points
- Note who is speaking and their expertise
- Highlight memorable moments or quotes
- Capture progression of conversation

**Research Papers:**
- State research question and methodology
- Summarize findings and conclusions
- Note implications for field
- Mention limitations if significant

**Newsletters:**
- Aggregate main items/stories
- Note overall theme or focus
- Highlight most significant items
- Capture author's editorial voice

**Twitter Threads:**
- Summarize main argument or thesis
- Note progression of reasoning
- Include key evidence or examples
- Capture author's key insights

---

OUTPUT FORMAT:

Return as JSON:

```json
{
  "short": "1-2 sentence summary here",
  "medium": "Paragraph summary here (100-150 words)",
  "long": "Multi-paragraph comprehensive summary here (300-500 words)",
  "excerpts": [
    "First key excerpt or quote",
    "Second key excerpt or statistic",
    "Third key excerpt or insight",
    "Fourth key excerpt (if applicable)",
    "Fifth key excerpt (if applicable)"
  ]
}
```

---

QUALITY STANDARDS:

**Short Summary:**
- Fits in a tweet (280 chars max)
- Captures core value proposition
- Makes reader want to learn more
- No unnecessary words

**Medium Summary:**
- Perfect for email preview or newsletter snippet
- Balances detail with brevity
- Includes most important elements
- Flows naturally

**Long Summary:**
- Comprehensive enough that reader gets main value without reading full content
- Organized logically (not just linear recap)
- Includes nuance and context
- Preserves important details

**Excerpts:**
- Directly quotable (with attribution)
- Highlight most impactful content
- Diverse (don't all make the same point)
- Include specific numbers/facts when relevant

---

Do not include any explanatory text outside the JSON.
```

---

## Usage Example

**Input:**
```
Content: [Long article about GPT-4 announcement]
Type: article
Title: "OpenAI Announces GPT-4"
```

**Expected Output:**
```json
{
  "short": "OpenAI releases GPT-4, a multimodal AI model with significantly improved reasoning capabilities, scoring 90th percentile on the bar exam vs GPT-3.5's 10th percentile.",

  "medium": "OpenAI has released GPT-4, its most advanced AI model yet, featuring multimodal capabilities (text and image input) and substantial reasoning improvements. The model achieves 90th percentile performance on the bar exam, up from GPT-3.5's 10th percentile, and shows enhanced performance across numerous benchmarks. GPT-4 also demonstrates reduced hallucinations and better adherence to safety guidelines through constitutional AI techniques. The model is being rolled out to ChatGPT Plus subscribers, with API access coming to developers pending waitlist approval. OpenAI CEO Sam Altman described it as 'our most capable and aligned model yet.'",

  "long": "OpenAI has unveiled GPT-4, marking a significant advancement in large language model capabilities. Unlike its predecessors, GPT-4 is multimodal, accepting both text and image inputs while generating text outputs. This architectural enhancement enables new use cases including visual analysis, chart interpretation, and document understanding.\n\nThe model demonstrates substantial improvements in reasoning and problem-solving. On standardized tests, GPT-4 achieves 90th percentile on the bar exam (vs GPT-3.5's 10th percentile), 99th percentile on GRE Verbal, and high scores across numerous academic benchmarks. OpenAI attributes these gains to improved training methodologies and architectural refinements developed over six months of iterative improvement.\n\nSafety and alignment received major focus in GPT-4's development. The model shows 82% reduction in responding to disallowed content requests and 40% improvement in producing factual responses compared to GPT-3.5. OpenAI employed constitutional AI techniques and extensive red-teaming with domain experts to identify and mitigate potential harms before public release.\n\nAvailability begins immediately for ChatGPT Plus subscribers and gradually expands to API customers through a waitlist system. OpenAI plans to refine the model based on real-world usage and feedback while continuing research on even more capable systems.",

  "excerpts": [
    "\"GPT-4 is our most capable and aligned model yet\" - Sam Altman, OpenAI CEO",
    "GPT-4 achieves 90th percentile on the bar exam, compared to GPT-3.5's 10th percentile performance",
    "The model shows 82% reduction in responding to disallowed content requests",
    "Multimodal capabilities enable processing both text and images as input for the first time",
    "OpenAI spent six months on safety improvements before public release, including extensive red-teaming"
  ]
}
```

---

## Validation

**Before returning results, verify:**
- JSON is valid and parseable
- Short summary ≤ 280 characters
- Medium summary 100-150 words (some flex okay)
- Long summary 300-500 words
- 3-5 excerpts provided
- All summaries make sense independently
- Excerpts are meaningful and diverse

---

**This prompt ensures high-quality multi-level summaries for all content types.**
