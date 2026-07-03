# PAI Research Workflow

> Research skill for structured investigation across 4 depth modes. Default entry point for any information-gathering task.

---

## Mode Selection

| Mode | Time Budget | When | ISCs Required |
|------|-------------|------|---------------|
| **Quick** | <5min | Fast fact-check, simple lookup, single-source answer | 1-3 |
| **Standard** | <30min | Cross-checked answer, multiple sources, balanced view | 4-8 |
| **Extensive** | <2h | Deep topic exploration, multi-LLM cross-check, literature review | 8-16 |
| **Deep Investigation** | Multi-day | Original research, multiple methodologies, expert interviews | 16+ |

---

## Phase 0: Define Research ISA

Before any research work begins, scaffold a mini-ISA:

- **Problem:** What specific question(s) are we answering?
- **Goal:** What does a successful research outcome look like?
- **Criteria (ISCs):**
  - ISC-1: Sources are identified and accessed
  - ISC-2: Information is extracted and synthesized
  - ISC-3: Findings are cross-checked for accuracy
  - ISC-4: Output is formatted and delivered

---

## Phase 1: Identify Sources

For any research mode, identify the appropriate sources:

### Quick Mode
- General knowledge (model's training data)
- Single authoritative source

### Standard Mode
- 3-5 diverse sources covering different angles
- At least one source from each relevant perspective
- Cross-reference primary claims

### Extensive Mode
- 8-15 sources across categories:
  - Academic / peer-reviewed
  - Industry / practitioner
  - News / current events
  - Primary sources (documents, data, interviews)
  - Expert commentary / analysis
- Multi-LLM cross-check: run the same query through 2-3 different models and compare results

### Deep Investigation
- 20+ sources with systematic coverage
- Primary research: interviews, original data analysis, experiments
- Literature review: search for papers, books, authoritative works
- Expert consultation: invoke Advisor thinking capability
- Cross-vendor audit: second AI from different provider reviews methodology

---

## Phase 2: Extract and Analyze

### Source Analysis Template

For each source, capture:

```
Source: [URL, citation, or reference]
Type: [academic/news/primary/expert/industry]
Date: [publication date]
Relevance: [how this source informs the research question]
Key Findings:
- Finding 1
- Finding 2
Limitations:
- Limitation 1
Bias Assessment:
[Any identifiable bias, sponsorship, or perspective]
```

### Synthesis

After extracting from all sources:

1. **Identify convergence:** Where do sources agree?
2. **Identify divergence:** Where do sources disagree? Why?
3. **Identify gaps:** What's missing? What's not addressed?
4. **Assess confidence:** How reliable is each finding? Rate H/M/L
5. **Build narrative:** How do findings connect into a coherent story?

---

## Phase 3: Cross-Check and Verify

### Cross-Check Rules
- Every factual claim must be traceable to at least one source
- Claims found in only one source → flag as "single-source"
- Contradictory claims → investigate and explain the disagreement
- Statistical claims → verify against original data where possible

### Verification Methods
- **Source triangulation:** Do multiple independent sources agree?
- **Primary source verification:** Can we find the original source?
- **Recency check:** Is the information still current and relevant?
- **Context check:** Is the source quoted accurately and in context?

---

## Phase 4: Output Format

### Quick / Standard Output

```
## Research Summary

**Question:** [The original research question]

**Answer:** [Direct answer, 2-3 paragraphs]

**Key Sources:**
1. [Source 1 — claim supported]
2. [Source 2 — claim supported]
3. [Source 3 — counterpoint or alternative view]

**Confidence:** [H/M/L — with rationale]
```

### Extensive / Deep Output

```
## Research Report

### Executive Summary
[2-3 paragraph synthesis of findings]

### Key Findings
1. **[Finding 1]**
   - Supporting sources: [sources]
   - Confidence: [H/M/L]
   - Nuance: [any caveats or limitations]

2. **[Finding 2]**
   - ...

### Points of Divergence
- **Topic:** Sources disagree on X
- **Source A position:** [position]
- **Source B position:** [position]
- **Assessment:** [which is more credible and why]

### Knowledge Gaps
- **Gap 1:** [what's unknown and why it matters]
- **Gap 2:** [what's unknown and why it matters]

### Methodology
- Sources consulted: [count]
- Research mode: [Quick/Standard/Extensive/Deep]
- Cross-checks performed: [methods used]
- Limitations: [any constraints on the research]

### Recommendations
- [Actionable next steps based on findings]
- [Suggestions for further research if applicable]
```

---

## Cross-Referencing to KNOWLEDGE

After completing research, if findings are durable enough to keep:

1. Create or update entity pages in `MEMORY/KNOWLEDGE/`
   - New people → `MEMORY/KNOWLEDGE/People/`
   - New companies → `MEMORY/KNOWLEDGE/Companies/`
   - New ideas → `MEMORY/KNOWLEDGE/Ideas/`
   - New research → `MEMORY/KNOWLEDGE/Research/`
2. Add wikilinks between related entities using `[[Page Name]]`
3. Add `related` frontmatter for explicit relationships
4. Backlink verification: ensure all wikilinks resolve

---

## Research Ethics

1. **Cite sources.** Every claim should be traceable.
2. **Flag uncertainty.** Don't present speculation as fact.
3. **Acknowledge bias.** Assess and disclose source bias.
4. **Respect privacy.** Don't research individuals without consent.
5. **Don't fabricate.** If sources don't exist, say so — never invent citations.
