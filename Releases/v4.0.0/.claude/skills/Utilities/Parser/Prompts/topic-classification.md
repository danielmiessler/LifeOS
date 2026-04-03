# Topic Classification Prompt (Gemini)

**Purpose:** Classify content by topics, categories, tags, keywords, and themes for newsletter database

**When to Use:** All content types after summarization

---

## Prompt Template

```
You are classifying content for {YOUR_BUSINESS_NAME}, a newsletter about AI, security, technology, and culture. Analyze the following content and provide comprehensive topic classification.

CONTENT TO ANALYZE:
"""
{content_text}
"""

TITLE: {title}
SUMMARY: {summary}

---

TASK: COMPREHENSIVE TOPIC CLASSIFICATION

Provide classification across multiple dimensions:

**1. PRIMARY CATEGORY (select ONE):**
Choose the single best-fit category:
- AI (artificial intelligence, machine learning, LLMs, AI safety)
- security (cybersecurity, infosec, privacy, vulnerabilities)
- technology (general tech, software, hardware, platforms)
- business (startups, funding, markets, strategy)
- science (research, academic, scientific findings)
- culture (society, philosophy, human impact)
- policy (regulation, law, government, governance)
- other (if none fit well)

**2. SECONDARY CATEGORIES (select 0-3):**
Additional relevant categories from the same list above

**3. TAGS (provide 4-10 specific tags):**
Specific, searchable tags for filtering:
- Use lowercase-with-hyphens format
- Be specific (not just "AI", but "large-language-models" or "gpt-4")
- Include technologies, companies, people, concepts mentioned
- Focus on nouns and noun phrases
- Examples: "anthropic", "constitutional-ai", "chatgpt", "prompt-injection", "zero-day"

**4. KEYWORDS (provide 5-15 keywords):**
Important terms and phrases from content:
- Mixed case preserving proper nouns (GPT-4, ChatGPT, Anthropic)
- Include technical terms and jargon
- Include company and product names
- Include acronyms if relevant
- Examples: "GPT-4", "RLHF", "scaling laws", "constitutional AI"

**5. THEMES (provide 2-5 broader themes):**
High-level conceptual themes:
- These are broader than tags/keywords
- Capture the "big ideas" or meta-points
- Should be phrases, not single words
- Examples: "AI safety vs capability tradeoffs", "Open source AI democratization", "Regulatory approaches to emerging tech"

**6. NEWSLETTER SECTIONS (select 1-3):**
Which {YOUR_BUSINESS_NAME} sections this content fits:
- Headlines (breaking news, major announcements)
- Analysis (deep dives, opinion, commentary)
- Tools (products, services, open source projects)
- AI (AI-specific content - models, research, developments)
- Security (security-specific content - vulnerabilities, attacks, defense)
- Ideas (thought-provoking concepts, philosophy, predictions)
- Culture (societal impact, human stories, trends)

---

CLASSIFICATION GUIDELINES:

**Primary Category:**
- Choose based on the MAIN focus of content
- If split between two (e.g., AI + security), choose whichever is more central
- Default to "technology" only if no better fit
- "AI" and "security" are specific enough to prefer over "technology"

**Secondary Categories:**
- Only include if genuinely relevant (not just mentioned)
- Maximum 3 (usually 1-2 is sufficient)
- Empty array if content is highly focused on one category

**Tags:**
- Aim for 6-8 tags (minimum 4, maximum 10)
- Balance specificity with searchability
- Include both broad and specific tags
- Use standard formats (lowercase-with-hyphens)
- Examples:
  - Too broad: "ai", "technology"
  - Good: "large-language-models", "gpt-4", "anthropic", "constitutional-ai"

**Keywords:**
- Aim for 8-12 keywords
- Preserve capitalization for proper nouns and acronyms
- Include variations if relevant (GPT-4, GPT-3.5)
- Focus on terms someone might search for
- Examples:
  - Technical: "RLHF", "transformer architecture", "attention mechanism"
  - Products: "ChatGPT", "Claude", "Midjourney"
  - Companies: "OpenAI", "Anthropic", "Google"
  - Concepts: "AI alignment", "prompt injection", "jailbreaking"

**Themes:**
- Capture the conceptual territory
- Think about what newsletter readers care about
- What's the "bigger story" here?
- Examples:
  - "AI capability improvements outpacing safety research"
  - "Open source vs closed AI development models"
  - "Commercial AI products reaching mainstream adoption"

**Newsletter Sections:**
- Think like the newsletter author
- "Headlines" = newsworthy, timely, important
- "Analysis" = requires explanation, has nuance, debatable
- "Tools" = actionable, readers can use
- "AI" = specific AI developments (can overlap with Headlines/Analysis)
- "Security" = specific security content (can overlap with Headlines/Analysis)
- "Ideas" = philosophical, future-focused, thought-provoking
- "Culture" = human impact, social implications, trends

---

OUTPUT FORMAT:

Return as JSON:

```json
{
  "primary_category": "category_name",
  "secondary_categories": ["category1", "category2"],
  "tags": [
    "tag-one",
    "tag-two",
    "tag-three",
    "tag-four",
    "tag-five",
    "tag-six"
  ],
  "keywords": [
    "Keyword One",
    "Keyword Two",
    "ACRONYM",
    "Product Name",
    "technical term"
  ],
  "themes": [
    "Broader theme one expressed as phrase",
    "Broader theme two",
    "Broader theme three"
  ],
  "newsletter_sections": ["Section1", "Section2"]
}
```

---

QUALITY STANDARDS:

**Comprehensive Coverage:**
- Don't be minimal - extract rich classification
- Aim for upper end of ranges (more tags/keywords better than fewer)
- Include variations and related terms

**Accuracy:**
- Primary category must be correct
- Newsletter sections should match the editorial style
- Themes should genuinely reflect content, not generic

**Consistency:**
- Use standard tag format (lowercase-with-hyphens)
- Preserve capitalization in keywords (GPT-4, not gpt-4)
- Newsletter sections use title case

**Usefulness:**
- Think about searchability
- Think about filtering and grouping
- Include terms people would actually search for

---

Do not include any explanatory text outside the JSON.
```

---

## Usage Example

**Input:**
```
Content: [Article about GPT-4 announcement with multimodal capabilities]
Title: "OpenAI Announces GPT-4"
Summary: "OpenAI releases GPT-4, featuring multimodal capabilities..."
```

**Expected Output:**
```json
{
  "primary_category": "AI",
  "secondary_categories": ["technology", "business"],
  "tags": [
    "gpt-4",
    "openai",
    "large-language-models",
    "multimodal-ai",
    "chatgpt",
    "ai-benchmarks",
    "sam-altman"
  ],
  "keywords": [
    "GPT-4",
    "OpenAI",
    "ChatGPT",
    "multimodal AI",
    "language model",
    "reasoning capabilities",
    "bar exam",
    "benchmarks",
    "Sam Altman",
    "AI safety",
    "constitutional AI",
    "RLHF"
  ],
  "themes": [
    "AI capability improvements accelerating",
    "Multimodal AI becoming mainstream",
    "AI safety and alignment in commercial products",
    "Competition driving rapid AI advancement"
  ],
  "newsletter_sections": ["AI", "Headlines", "Analysis"]
}
```

---

## Validation

**Before returning results, verify:**
- JSON is valid and parseable
- Primary category is one of allowed values
- Secondary categories are from allowed values
- 4-10 tags provided
- 5-15 keywords provided
- 2-5 themes provided
- 1-3 newsletter sections provided
- Tags use lowercase-with-hyphens format
- Newsletter sections match allowed values

---

**This prompt ensures comprehensive topic classification for newsletter database.**
