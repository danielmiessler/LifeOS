---
name: pai-arxiv
description: "Academic paper search via the arXiv API. Search by topic, category, author, or ID. Supports boolean operators, pagination, and structured result parsing. USE WHEN you need to search for academic papers on arXiv — find papers by topic, category, author, or retrieve specific paper details with metadata. NOT FOR non-academic web search, PDF content extraction, or papers behind paywalls."
version: 5.0.0
author: PAI v5.0 → Hermes Port
license: MIT
metadata:
  hermes:
    tags: [pai]
    related_skills: []
tags: [arxiv, academic, papers, research, API, search]
---

<!-- Voice notification — fire-and-forget on invocation -->
```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the pai-arxiv skill"}' \
  > /dev/null 2>&1 &
```


# pai-arxiv: Academic Paper Search

## Workflow Routing

| Trigger | Route |
|---------|-------|
| User searches by topic/keywords | Build query → GET arXiv API → parse results → present |
| User searches by author name | Build author query → GET → parse → group by author |
| User searches by category | Category search → GET → parse → filter + sort |
| User provides arXiv ID(s) | Fetch by ID → parse single/multiple results |
| User wants paginated results | First page → show results + page nav → next/prev |
| User uses boolean operators | Parse boolean expression → build API query → execute |

## Step-by-Step Procedures

### 1. Topic Search
```
1. Accept search query from user
2. Construct arXiv API URL:
   - Base: http://export.arxiv.org/api/query?search_query=
   - Encode: all:+text:query OR ti:"title words" OR au:author_name
   - Parameters: max_results=N, start=M
3. web_extract(url=api_url) or terminal( curl ... )
4. Parse Atom XML response:
   - Extract: title, authors, abstract, published date, link, categories, pdf_url
5. Remove duplicate results
6. Present as structured list with:
   - Title (linked to abstract page)
   - First 3 authors + "et al."
   - Year + category
   - 1-2 sentence summary (truncated abstract)
7. Offer pagination controls
```

### 2. Advanced Query Construction
```
1. Parse user's boolean query operators:
   - AND → +AND+
   - OR → +OR+
   - ANDNOT → +ANDNOT+
   - Prefixes: ti: (title), au: (author), abs: (abstract), co: (comment), cat: (category)
   - Phrase: "quoted terms" for exact phrases
2. Build search_query parameter:
   - Example: all:quantum+AND+ti:neural+AND+cat:cs.AI
3. Set max_results (default 10, max 100 per request)
4. Set start (for pagination)
5. Execute GET request
```

### 3. ID Lookup
```
1. Accept one or more arXiv IDs (e.g., "2301.12345", "2301.12345v2")
2. Construct: http://export.arxiv.org/api/query?id_list=2301.12345,2301.67890
3. Parse results (same format as topic search)
4. Return full metadata for each paper
5. If single ID, provide extended details:
   - Full abstract
   - All authors
   - All categories
   - DOI if available
   - Journal reference if available
   - PDF download link
```

### 4. Category Browser
```
1. Show available arXiv categories (cs.AI, cs.LG, math.ST, physics, etc.)
2. User selects category
3. Search: cat:cs.AI
4. Sort by: submittedDate (default) or relevance
5. Paginate results
6. Allow sub-category filtering
```

### 5. Pagination Workflow
```
1. On initial search, show page 1 results + total results count if available
2. Provide "next page" / "page N" commands
3. On pagination:
   a. Increment start parameter by max_results
   b. Re-execute query
   c. Show new page
4. Track current_page and total_pages state
```

### 6. Export Results
```
1. Collect selected or all results
2. Format as:
   a. Markdown list (default)
   b. BibTeX entries
   c. Simple text list
   d. JSON structured data
3. Return formatted output
```

## API Endpoints Reference

| Endpoint | Usage |
|----------|-------|
| `http://export.arxiv.org/api/query?search_query=...` | Topic/author search |
| `http://export.arxiv.org/api/query?id_list=...` | ID lookup |
| `http://arxiv.org/abs/{id}` | Paper abstract page |
| `http://arxiv.org/pdf/{id}` | PDF download |

## Query Prefix Reference

| Prefix | Field |
|--------|-------|
| `ti:` | Title |
| `au:` | Author |
| `abs:` | Abstract |
| `co:` | Comment |
| `jr:` | Journal Reference |
| `cat:` | Category |
| `rn:` | Report Number |
| `all:` | All fields |

## Gotchas

- arXiv API returns Atom XML; parse with XML parser, not regex
- Maximum 100 results per request; use pagination for more
- Rate limit: ~1 request per 3 seconds (be respectful)
- API can be slow (2-10s) for complex queries; set appropriate timeout
- Abstracts are truncated at ~500 chars in some fields
- Some older papers may have non-standard ID formats
- Category taxonomy changes over time; verify valid categories
- Boolean operators must be uppercase: +AND+, +OR+, +ANDNOT+
- Search is case-insensitive
- Results are sorted by relevance (keyword) or date (category browse)

## Execution Log Pattern

```
[PAI-ARXIV] Search: all:reinforcement learning +AND+ cat:cs.AI
[API] GET http://export.arxiv.org/api/query?search_query=...&max_results=10
[PARSE] 8 results found (page 1 of 3)
[RESULT] #1: "Deep Reinforcement Learning..." - Mnih et al. (2015) - cs.AI
[RESULT] #2: "Proximal Policy Optimization..." - Schulman et al. (2017) - cs.LG
[PAGE] Showing 1-8 of ~22 total results. Next page available.
[COMPLETE] arXiv search completed in 3.4s
```
