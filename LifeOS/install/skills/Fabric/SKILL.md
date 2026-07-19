---
name: Fabric
version: 1.1.17
description: "Execute any of 240+ specialized prompt patterns natively across Extraction, Summarization, Analysis, Creation, Improvement, Security, Rating. Common: extract_wisdom, create_threat_model, analyze_claims, improve_writing, review_code, mermaid, youtube_summary. CLI used only for YouTube transcript (-y) and URL fallback (-u). Two workflows: ExecutePattern, UpdatePatterns. USE WHEN fabric, fabric pattern, run fabric, update patterns, threat model, analyze claims, improve writing, review code, mermaid, STRIDE, sigma rules. NOT FOR multi-agent investigation (Research) or content-adaptive extraction (ExtractWisdom)."
effort: medium
---

## Customization

**Before executing, check for user customizations at:**
`$LIFEOS_DIR/USER/CUSTOMIZATIONS/SKILLS/Fabric/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

## Voice Notification

**When executing a workflow, do BOTH:**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:31337/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the WORKFLOWNAME workflow in the Fabric skill to ACTION"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running the **WorkflowName** workflow in the **Fabric** skill to ACTION...
   ```

**Full documentation:** `$LIFEOS_DIR/DOCUMENTATION/Notifications/NotificationSystem.md`

# Fabric

## What It Does

Runs any of 240+ specialized prompt patterns across extraction, summarization, analysis, creation, improvement, security, and rating. Common ones: extract_wisdom, create_threat_model, analyze_claims, improve_writing, review_code, mermaid, youtube_summary. Patterns run natively — LifeOS reads the pattern's system.md and applies it directly, no CLI round-trip. The fabric CLI is only used for YouTube transcripts (-y) and URL fallback (-u).

## The Problem

Good prompts are scattered, hard to remember, and easy to rewrite badly from scratch each time. You want a threat model, a claims analysis, or a clean summary, but reconstructing the right prompt every time is slow and inconsistent. Calling an external CLI for each one adds latency and a dependency. This skill keeps 240+ proven patterns on hand and applies them directly as prompts, so the right structured prompt is one pattern name away.

## How It Works

A prompt pattern system providing 240+ specialized patterns for content analysis, extraction, summarization, threat modeling, and transformation.

**Patterns Location:** `Patterns/`

---

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **ExecutePattern** | "use fabric", "run pattern", "apply pattern", "extract wisdom", "summarize", "analyze with fabric" | `Workflows/ExecutePattern.md` |
| **UpdatePatterns** | "update fabric", "update patterns", "sync fabric", "pull patterns" | `Workflows/UpdatePatterns.md` |

---

## Examples

**Example 1: Extract wisdom from content**
```
User: "Use fabric to extract wisdom from this article"
-> Invokes ExecutePattern workflow
-> Selects extract_wisdom pattern
-> Reads Patterns/extract_wisdom/system.md
-> Applies pattern to content
-> Returns structured IDEAS, INSIGHTS, QUOTES, etc.
```

**Example 2: Update patterns**
```
User: "Update fabric patterns"
-> Invokes UpdatePatterns workflow
-> Runs git pull from upstream fabric repository
-> Syncs patterns to local Patterns/ directory
-> Reports pattern count
```

**Example 3: Create threat model**
```
User: "Use fabric to create a threat model for this API"
-> Invokes ExecutePattern workflow
-> Selects create_threat_model pattern
-> Applies STRIDE methodology
-> Returns structured threat analysis
```

---

## Quick Reference

### Pattern Execution (Native - No CLI Required)

Instead of calling `fabric -p pattern_name`, LifeOS executes patterns natively:
1. Reads `Patterns/{pattern_name}/system.md`
2. Applies pattern instructions directly as prompt
3. Returns results without external CLI calls

### When to Use Fabric CLI Directly

Only use `fabric` command for:
- **`-y URL`** - YouTube transcript extraction
- **`-u URL`** - URL content fetching (when native fetch fails)

### Most Common Patterns

| Intent | Pattern | Description |
|--------|---------|-------------|
| Extract insights | `extract_wisdom` | IDEAS, INSIGHTS, QUOTES, HABITS |
| Summarize | `summarize` | General summary |
| 5-sentence summary | `create_5_sentence_summary` | Ultra-concise |
| Threat model | `create_threat_model` | Security threat analysis |
| Analyze claims | `analyze_claims` | Fact-check claims |
| Improve writing | `improve_writing` | Writing enhancement |
| Code review | `review_code` | Code analysis |
| Main idea | `extract_main_idea` | Core message extraction |

### Full Pattern Catalog

Browse the `Patterns/` directory for the complete list of 240+ patterns organized by category.

---

## Native Pattern Execution

**How it works:**

```
User Request → Pattern Selection → Read system.md → Apply → Return Results
```

**Pattern Structure:**
```
Patterns/
├── extract_wisdom/
│   └── system.md       # The prompt instructions
├── summarize/
│   └── system.md
├── create_threat_model/
│   └── system.md
└── ...240+ patterns
```

Each pattern's `system.md` contains the full prompt that defines:
- IDENTITY (who the AI should be)
- PURPOSE (what to accomplish)
- STEPS (how to process input)
- OUTPUT (structured format)

---

## Pattern Categories

| Category | Count | Examples |
|----------|-------|----------|
| **Extraction** | 30+ | extract_wisdom, extract_insights, extract_main_idea |
| **Summarization** | 20+ | summarize, create_5_sentence_summary, youtube_summary |
| **Analysis** | 35+ | analyze_claims, analyze_code, analyze_threat_report |
| **Creation** | 50+ | create_threat_model, create_prd, create_mermaid_visualization |
| **Improvement** | 10+ | improve_writing, improve_prompt, review_code |
| **Security** | 15 | create_stride_threat_model, create_sigma_rules, analyze_malware |
| **Rating** | 8 | rate_content, judge_output, rate_ai_response |

---

## Integration

### Feeds Into
- **Research** - Fabric patterns enhance research analysis
- **Blogging** - Content summarization and improvement
- **Security** - Threat modeling and analysis

### Uses
- **fabric CLI** - For YouTube transcripts (`-y`) and URL fetching (`-u`)
- **Native execution** - Direct pattern application (preferred)

---

## File Organization

| Path | Purpose |
|------|---------|
| `Patterns/` | Local pattern storage (240+) |
| `Workflows/` | Execution workflows |

---

## Changelog

### 2026-01-18
- Initial skill creation (extracted from LIFEOS/TOOLS/fabric)
- Native pattern execution (no CLI dependency for most patterns)
- Two workflows: ExecutePattern, UpdatePatterns
- 240+ patterns organized by category
- LifeOS Pack ready structure

## Gotchas

- **`fabric -y URL` for YouTube extraction — don't scrape YouTube pages.** fabric handles transcript extraction natively.
- **Pattern names are exact.** `extract_wisdom` not `extractwisdom`. Check `fabric --list` if unsure.
- **Long content may exceed pattern context limits.** For very long inputs, chunk the content or use a summarize pattern first.

## Execution Log

After completing any workflow, append a single JSONL entry:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"Fabric","workflow":"WORKFLOW_USED","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> $LIFEOS_DIR/MEMORY/SKILLS/execution.jsonl
```

Replace `WORKFLOW_USED` with the workflow executed, `8_WORD_SUMMARY` with a brief input description, and `SECONDS` with approximate wall-clock time. Log `status: "error"` if the workflow failed.
