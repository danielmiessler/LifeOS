---
name: FabricReference
description: Reference document for Fabric pattern system. For full functionality, use the Fabric skill directly.
created: 2025-12-17
updated: 2026-01-18
version: 1.1.6
---

# Fabric Pattern System Reference

> Fabric patterns are reusable moves in the LifeOS hill-climb (`LifeOs/LifeOsThesis.md`) — packaged transformations the DA applies to incoming content.

**Primary Skill:** `{{LIFEOS_ROOT}}/skills/Fabric/SKILL.md`

This document provides a quick reference. For full functionality, invoke the Fabric skill.

---

## Quick Reference

**Patterns Location:** `{{LIFEOS_ROOT}}/skills/Fabric/Patterns/` (240+ patterns)

### Invoke Fabric Skill

| User Says | Action |
|-----------|--------|
| "use fabric to [X]" | Execute pattern matching intent |
| "run fabric pattern [name]" | Execute specific pattern |
| "update fabric patterns" | Sync patterns from upstream |
| "extract wisdom from [content]" | Run extract_wisdom pattern |
| "summarize with fabric" | Run summarize pattern |

### Native Pattern Execution

LifeOS executes patterns natively (no CLI spawning):
1. Reads `Patterns/{pattern_name}/system.md`
2. Applies pattern instructions directly as prompt
3. Returns structured output
4. Extracted insights may be captured in the Knowledge Archive (`MEMORY/KNOWLEDGE/`) by the Algorithm LEARN phase or KnowledgeHarvester as People, Companies, Ideas, or Research

**Example:**
```
User: "Use fabric to extract wisdom from this article"
-> Fabric skill invoked
-> ExecutePattern workflow selected
-> Reads Patterns/extract_wisdom/system.md
-> Applies pattern to content
-> Returns IDEAS, INSIGHTS, QUOTES, etc.
```

### When to Use Fabric CLI Directly

Only use `fabric` command for:
- **`-y URL`** - YouTube transcript extraction
- **`-U`** - Update patterns (or use skill workflow)

---

## Pattern Categories

| Category | Count | Key Patterns |
|----------|-------|--------------|
| **Extraction** | 30+ | extract_wisdom, extract_insights, extract_main_idea |
| **Summarization** | 20+ | summarize, create_5_sentence_summary |
| **Analysis** | 35+ | analyze_claims, analyze_code, analyze_threat_report |
| **Creation** | 50+ | create_threat_model, create_prd, create_mermaid_visualization |
| **Improvement** | 10+ | improve_writing, improve_prompt, review_code |
| **Security** | 15 | create_stride_threat_model, create_sigma_rules |
| **Rating** | 8 | rate_content, judge_output |

---

## Updating Patterns

**Via Skill (Recommended):**
```
User: "Update fabric patterns"
-> Fabric skill > UpdatePatterns workflow
-> Runs fabric -U
-> Syncs to {{LIFEOS_ROOT}}/skills/Fabric/Patterns/
```

**Manual:**
```bash
fabric -U && rsync -av ~/.config/fabric/patterns/ "${LIFEOS_ROOT}/skills/Fabric/Patterns/"
```

---

## See Also

- **Full Skill:** `{{LIFEOS_ROOT}}/skills/Fabric/SKILL.md`
- **Pattern Execution:** `{{LIFEOS_ROOT}}/skills/Fabric/Workflows/ExecutePattern.md`
- **Pattern Updates:** `{{LIFEOS_ROOT}}/skills/Fabric/Workflows/UpdatePatterns.md`
- **All Patterns:** `{{LIFEOS_ROOT}}/skills/Fabric/Patterns/`
- **Architecture:** `{{LIFEOS_DIR}}/DOCUMENTATION/LifeosSystemArchitecture.md` — Master LifeOS architecture reference
