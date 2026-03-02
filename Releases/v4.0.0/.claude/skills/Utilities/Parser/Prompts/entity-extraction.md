# Entity Extraction Prompt (Gemini)

**Purpose:** Extract people, companies, and entities from content for structured database

**When to Use:** All content types after gathering raw content

---

## Prompt Template

```
You are analyzing content for a newsletter database. Extract ALL people and companies mentioned in the following content with high accuracy and detail.

CONTENT TO ANALYZE:
"""
{content_text}
"""

SOURCE URL: {url}
CONTENT TYPE: {type}

---

TASK 1: EXTRACT ALL PEOPLE

For each person mentioned, provide:
1. Full name (as accurately as possible)
2. Role in this content (author, subject, mentioned, quoted, expert, interviewer, interviewee)
3. Job title or description (if mentioned or inferable)
4. Company/organization affiliation (if mentioned)
5. Social media handles if mentioned (@twitter, LinkedIn URLs)
6. Email if mentioned (usually in author bylines or research papers)
7. Website if mentioned
8. Context: Why this person is mentioned and their relevance
9. Importance: primary (central to content), secondary (supporting), or minor (brief mention)

Format as JSON array:
```json
[
  {
    "name": "Full Name",
    "role": "author|subject|mentioned|quoted|expert|interviewer|interviewee",
    "title": "Job title or null",
    "company": "Company name or null",
    "social": {
      "twitter": "@handle or null",
      "linkedin": "URL or null",
      "email": "email or null",
      "website": "URL or null"
    },
    "context": "Why mentioned and relevance",
    "importance": "primary|secondary|minor"
  }
]
```

---

TASK 2: EXTRACT ALL COMPANIES/ORGANIZATIONS

For each company or organization mentioned, provide:
1. Company name (official name preferred)
2. Domain (primary website domain like "anthropic.com")
3. Industry classification (AI, security, fintech, healthcare, etc.)
4. Context: How and why mentioned in content
5. Mentioned as: subject, source, example, competitor, partner, acquisition, product, other
6. Sentiment: positive, neutral, negative, or mixed (based on how discussed)

Format as JSON array:
```json
[
  {
    "name": "Company Name",
    "domain": "domain.com or null",
    "industry": "Industry or null",
    "context": "How and why mentioned",
    "mentioned_as": "subject|source|example|competitor|partner|acquisition|product|other",
    "sentiment": "positive|neutral|negative|mixed"
  }
]
```

---

EXTRACTION GUIDELINES:

**People:**
- Include authors, subjects, quoted individuals, and anyone significantly mentioned
- Differentiate between author (creator) and subject (topic of content)
- For research papers: all authors are "author" role
- For interviews: identify interviewer vs interviewee
- Extract social handles from author bios, signatures, or text
- If uncertain about details, use null rather than guessing

**Companies:**
- Include all companies explicitly mentioned
- Include companies clearly associated with people (e.g., "CEO of X")
- Assess sentiment based on how company is portrayed
- For product mentions, determine if it's the company or just product
- Universities/research institutions count as companies

**Quality Standards:**
- Accuracy over quantity
- Use null for unknown fields rather than guessing
- Extract context that explains relevance
- Be thorough - don't miss minor but relevant mentions

---

OUTPUT:

Return ONLY valid JSON with two arrays:

```json
{
  "people": [...],
  "companies": [...]
}
```

Do not include any explanatory text outside the JSON.
```

---

## Usage Example

**Input:**
```
Content: "In a recent interview, Dario Amodei (@darioamodei), CEO of Anthropic, discussed the company's approach to AI safety with constitutional AI. He referenced work by Geoffrey Hinton on neural networks and mentioned collaborations with researchers at Stanford University."

URL: https://example.com/interview
Type: article
```

**Expected Output:**
```json
{
  "people": [
    {
      "name": "Dario Amodei",
      "role": "subject",
      "title": "CEO of Anthropic",
      "company": "Anthropic",
      "social": {
        "twitter": "@darioamodei",
        "linkedin": null,
        "email": null,
        "website": null
      },
      "context": "Subject of interview discussing AI safety and constitutional AI approach",
      "importance": "primary"
    },
    {
      "name": "Geoffrey Hinton",
      "role": "mentioned",
      "title": "Researcher",
      "company": null,
      "social": {
        "twitter": null,
        "linkedin": null,
        "email": null,
        "website": null
      },
      "context": "Referenced for foundational work on neural networks",
      "importance": "secondary"
    }
  ],
  "companies": [
    {
      "name": "Anthropic",
      "domain": "anthropic.com",
      "industry": "AI",
      "context": "Main subject of interview, discussed AI safety methodology",
      "mentioned_as": "subject",
      "sentiment": "positive"
    },
    {
      "name": "Stanford University",
      "domain": "stanford.edu",
      "industry": "Education/Research",
      "context": "Research collaboration partner mentioned",
      "mentioned_as": "partner",
      "sentiment": "neutral"
    }
  ]
}
```

---

## Validation

**Before returning results, verify:**
- JSON is valid and parseable
- All required fields present (or null)
- Enum values match allowed values (role, importance, mentioned_as, sentiment)
- No duplicate people/companies
- Context fields provide meaningful information
- Social handles use correct format (@username for Twitter)

---

**This prompt ensures comprehensive entity extraction across all content types.**
