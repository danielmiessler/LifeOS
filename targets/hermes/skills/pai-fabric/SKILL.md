---
name: pai-fabric
description: "Executes 240+ Fabric prompt patterns natively without CLI dependency. Covers extraction, summarization, analysis, creation, improvement, security, and rating categories. USE WHEN you need to apply a structured prompt pattern from the Fabric library — pattern selection via description matching, context-aware execution, and formatted output. NOT FOR raw Fabric CLI operations, prompt engineering from scratch, or non-Fabric pattern systems."
version: 5.0.0
author: PAI v5.0 → Hermes Port
license: MIT
metadata:
  hermes:
    tags: [pai]
    related_skills: []
tags: [fabric, prompts, patterns, analysis, summarization, rewriting]
---

<!-- Voice notification — fire-and-forget on invocation -->
```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the pai-fabric skill"}' \
  > /dev/null 2>&1 &
```


# pai-fabric: Fabric Prompt Pattern Execution

## Workflow Routing

| Trigger | Route |
|---------|-------|
| User names a specific pattern | Search patterns → load template → inject context → execute |
| User describes a task | Match task to best pattern → confirm → execute |
| User wants available patterns | List pattern categories → user selects → execute |
| User provides raw text + desired output | Auto-detect closest pattern → execute → refine |
| User wants custom pattern | Accept custom template → inject context → execute |

## Step-by-Step Procedures

### 1. Pattern Selection
```
1. Ask user what they want to accomplish (or detect from context)
2. Match to Fabric pattern categories:
   a. Summarization: sumarize, create_summary, extract_wisdom, etc.
   b. Analysis: analyze_claims, analyze_paper, analyze_patent, etc.
   c. Rewriting: clean_text, improve_writing, rewrite_essay, etc.
   d. Extraction: extract_algorithm, extract_questions, etc.
   e. Creative: write_micro_essay, write_note, create_idea, etc.
3. If ambiguous, show top 3-5 pattern matches with descriptions
4. User confirms pattern selection
```

### 2. Pattern Execution (Core)
```
1. Load pattern template:
   - Pattern template stored as structured object with:
     - system_prompt: str
     - user_prompt_template: str (with {{INPUT}} placeholder)
     - variables: list of required variable names
     - expected_output_format: str
2. Inject context into template:
   - Replace {{INPUT}} with user's content
   - Replace any additional {{VARIABLES}} from user
3. Execute via system-level LLM call (no CLI dependency):
   - messages = [
       {"role": "system", "content": pattern.system_prompt},
       {"role": "user", "content": filled_user_prompt}
     ]
4. Return pattern output
```

### 3. Pattern Pattern (Meta-Pattern)
```
1. Detect pattern type from user intent:
   a. "summarize this" → summarization patterns
   b. "analyze/explain this" → analysis patterns
   c. "improve/rewrite this" → rewriting patterns
   d. "extract/pull out X" → extraction patterns
2. Apply pattern detection heuristics:
   - Keyword matching against pattern names/descriptions
   - Content length heuristics (short→summarize, long→extract_wisdom)
3. Fall back to user confirmation if <80% confidence
```

### 4. Batch Processing
```
1. Accept list of inputs + single pattern name
2. For each input in inputs:
   a. Load pattern template
   b. Inject input
   c. Execute
   d. Collect result
3. Return aggregated results as array
```

### 5. Custom Pattern Creation
```
1. Accept user-provided:
   - pattern_name: str
   - system_prompt: str (role/instruction for the LLM)
   - user_prompt: str (template with {{INPUT}})
   - variables: dict of default values
2. Register pattern for current session
3. Execute as standard pattern
```

## Pattern Categories (Representative)

| Category | Patterns |
|----------|----------|
| Summarization | sumarize, create_summary, extract_wisdom, extract_article_summary |
| Analysis | analyze_claims, analyze_paper, analyze_patent, analyze_incident, analyze_cve |
| Rewriting | clean_text, improve_writing, rewrite_essay, translate, create_markmap |
| Extraction | extract_algorithm, extract_questions, extract_recommendations, extract_insights |
| Creative | write_micro_essay, write_note, create_idea, create_aphorisms, write_tweet |
| Technical | explain_code, create_git_diff_commit, improve_code, add_todos |
| Educational | explain_terms, create_quiz, teach, create_concept_map |

## Gotchas

- Pattern templates are stored in-memory; define patterns at skill load time
- No CLI dependency — all patterns execute via direct LLM calls
- Long inputs may hit token limits; use extract_wisdom incrementally for large texts
- Pattern quality varies; always review output before presenting to user
- Some patterns expect specific input formats (markdown, code blocks, etc.)
- Variables in templates use {{DOUBLE_BRACES}} syntax
- Custom patterns override built-in patterns with the same name
- Pattern auto-detection is heuristic-based and may be wrong

## Execution Log Pattern

```
[PAI-FABRIC] Pattern: extract_wisdom (Summarization)
[INPUT] 3,842 chars from user
[INFER] Detected text type: technical_article
[EXEC] System prompt: "You are a wisdom extraction expert..."
[EXEC] User prompt: "Extract surprising insights from the following..."
[OUTPUT] 847 chars — 5 insights, 3 takeaways, 2 action items
[COMPLETE] Pattern executed in 1.2s
```
