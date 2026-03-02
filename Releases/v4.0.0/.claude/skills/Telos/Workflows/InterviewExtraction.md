# Interview Extraction Workflow

Extract standardized insights from interviews and notes into categorized output files.

## Trigger Phrases

- "extract content"
- "extract telos content"
- "extract interviews"
- "analyze interviews"
- Running TELOS skill on a directory containing interviews

## Input Requirements

- **Target Directory**: A directory containing interview notes, transcripts, or meeting notes
- **Supported Formats**: Markdown (.md), text (.txt), or similar text-based files
- **Structure**: Files may be organized in subdirectories (e.g., per interview, per date, per person)

## Extraction Categories (13 Total)

| Category | Description | Output File |
|----------|-------------|-------------|
| Differentiators | What makes this entity unique, competitive advantages, special capabilities | `DIFFERENTIATORS.md` |
| Findings | General discoveries, observations, and insights | `FINDINGS.md` |
| Complaints | Issues people are unhappy about, frustrations, pain points | `COMPLAINTS.md` |
| Gaps | Things that are missing, unmet needs, absent capabilities | `GAPS.md` |
| Critical Issues | Urgent problems requiring immediate attention | `CRITICAL_ISSUES.md` |
| Blockers | Theory of Constraints friction points preventing progress | `BLOCKERS.md` |
| Ideas | Suggestions, potential solutions, creative proposals | `IDEAS.md` |
| Recommendations | Actionable advice, specific guidance given | `RECOMMENDATIONS.md` |
| Architecture | System structure, organizational design, how pieces fit together | `ARCHITECTURE.md` |
| Vision | What the entity should/wants to become, aspirational state | `VISION.md` |
| Tech Stack | Technologies, tools, platforms, and systems mentioned | `TECH_STACK.md` |
| Metrics | Quantitative measures, KPIs, numbers, statistics | `METRICS.md` |
| Goals | Objectives, targets, desired outcomes | `GOALS.md` |

## Execution Workflow

### Phase 1: Discovery

1. **Scan Target Directory**
   - Recursively find all text-based files (`.md`, `.txt`, etc.)
   - Build inventory of files to process
   - Identify any naming patterns that indicate speaker/source

2. **Report File Inventory**
   ```
   Found X interview files across Y directories:
   - [list files with paths]
   ```

### Phase 2: Deep Analysis (Ultrathink)

**MANDATORY: Activate Ultrathink (be-creative skill) for extraction quality**

For each file:

1. **Read Complete Content**
   - Load full file contents
   - Note filename and path for attribution

2. **Identify Speakers/Sources**
   - Look for speaker indicators (names, roles, titles)
   - Extract attribution metadata where possible

3. **Extract to Categories**
   Apply deep reasoning to classify content into the 13 categories:

   **Differentiators** — Look for:
   - "What makes us different..."
   - "Unlike competitors..."
   - "Our unique approach..."
   - Competitive advantages mentioned

   **Findings** — Look for:
   - Discoveries and observations
   - "I noticed that..."
   - "We found that..."
   - General insights

   **Complaints** — Look for:
   - Frustrations expressed
   - "The problem is..."
   - "I'm frustrated by..."
   - Pain points and annoyances

   **Gaps** — Look for:
   - "We're missing..."
   - "We don't have..."
   - "There's no..."
   - Unmet needs

   **Critical Issues** — Look for:
   - Urgent language ("must", "critical", "urgent")
   - Time-sensitive problems
   - High-impact blockers
   - Risk indicators

   **Blockers** — Look for:
   - "We can't because..."
   - "What's stopping us..."
   - Constraints and limitations
   - Theory of Constraints friction

   **Ideas** — Look for:
   - "What if we..."
   - "We could..."
   - Suggestions and proposals
   - Creative solutions

   **Recommendations** — Look for:
   - "You should..."
   - "I recommend..."
   - Explicit advice given
   - Action items suggested

   **Architecture** — Look for:
   - System descriptions
   - How components connect
   - Organizational structure
   - Process flows

   **Vision** — Look for:
   - Future state descriptions
   - "We want to become..."
   - Aspirational statements
   - Long-term direction

   **Tech Stack** — Look for:
   - Tool names
   - Platform mentions
   - Technology references
   - Software/hardware mentioned

   **Metrics** — Look for:
   - Numbers and statistics
   - KPIs mentioned
   - Measurements and benchmarks
   - Quantitative data

   **Goals** — Look for:
   - Explicit objectives
   - Targets and milestones
   - "Our goal is..."
   - Desired outcomes

### Phase 3: Consolidation

1. **Aggregate All Extractions**
   - Combine items from all files per category
   - Preserve all attribution

2. **Deduplicate and Merge**
   - Identify semantically similar items
   - Consolidate duplicates while preserving all source attributions
   - Keep the most complete/clear version of duplicate items

3. **Order by Significance**
   - Items mentioned multiple times ranked higher
   - Items with stronger language ranked higher
   - Critical/urgent items prioritized

### Phase 4: Output Generation

Generate 13 output files at the **top level** of the target directory.

**Output File Template:**

```markdown
# [CATEGORY NAME]

*Extracted from interviews and notes. Each item includes source attribution.*

---

## Items

- [Extracted item - preserve original phrasing where possible] — *Source: [filename.md], [Speaker Name if known]*

- [Another extracted item] — *Source: [filename.md]*

- [Item mentioned by multiple sources] — *Sources: [file1.md] (Speaker A), [file2.md] (Speaker B)*

---

*Generated: [timestamp]*
*Files processed: [count]*
```

### Phase 5: Summary Report

After generating all files, output a summary:

```markdown
## Extraction Complete

**Files Processed:** X
**Output Location:** [target directory]

### Category Counts
| Category | Items Extracted |
|----------|-----------------|
| Differentiators | X |
| Findings | X |
| Complaints | X |
| Gaps | X |
| Critical Issues | X |
| Blockers | X |
| Ideas | X |
| Recommendations | X |
| Architecture | X |
| Vision | X |
| Tech Stack | X |
| Metrics | X |
| Goals | X |

### Notable Patterns
- [Any cross-cutting themes observed]
- [Frequently mentioned items]
- [High-priority items requiring attention]
```

## Quality Requirements

1. **Attribution is Mandatory**
   - Every extracted item MUST have source file attribution
   - Include speaker name when identifiable
   - For duplicates, list ALL sources

2. **Preserve Original Voice**
   - Keep original phrasing where meaningful
   - Don't over-summarize or lose nuance
   - Maintain context where critical

3. **No Sensitive Data in Workflow**
   - This workflow file contains NO customer data
   - All extraction happens at runtime
   - Output files contain extracted content only

4. **Completeness**
   - Process ALL files in directory tree
   - Don't skip files or truncate content
   - Capture edge cases and subtle mentions

## Example Usage

```
User: "Extract content from /path/to/interviews"

{DAIDENTITY.NAME}:
1. Scans directory, finds 15 interview files
2. Activates Ultrathink for deep analysis
3. Processes each file, extracting to 13 categories
4. Consolidates and deduplicates
5. Generates 13 output files at /path/to/interviews/
6. Reports summary with counts and patterns
```

## Error Handling

- **Empty Directory**: Report "No interview files found" and exit
- **Unreadable Files**: Skip with warning, continue processing others
- **No Extractions for Category**: Create file with "No items extracted for this category"
- **Large Files**: Process in chunks if needed, maintain context

## Integration with TELOS

This workflow is a component of the TELOS skill and can be:
- Invoked directly via trigger phrases
- Called as part of broader TELOS analysis
- Combined with other TELOS workflows for comprehensive assessment

The extracted categories align with TELOS methodology for organizational analysis, particularly:
- **Blockers** → Theory of Constraints analysis
- **Vision + Goals** → Strategic direction
- **Architecture** → System understanding
- **Metrics** → Measurement framework
