---
name: BeCreative
version: 1.1.18
description: "Divergent ideation and corpus expansion via Verbalized Sampling plus extended thinking — single-shot generates several internally diverse candidates and surfaces the strongest, or expands a seed corpus into a diverse dataset for evals and test sets. USE WHEN be creative, brainstorm, divergent ideas, creative solutions, maximum creativity, tree of thoughts, radically different, name this, creative angle, expand this corpus, synthetic data, generate diverse examples, create test set. NOT FOR multi-cycle evolutionary ideation with Lamarckian meta-learning (use Ideate)."
effort: medium
---

## Customization

**Before executing, check for user customizations at:**
`{{LIFEOS_DIR}}/USER/CUSTOMIZATIONS/SKILLS/BeCreative/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.


## 🚨 MANDATORY: Voice Notification (REQUIRED BEFORE ANY ACTION)

**You MUST send this notification BEFORE doing anything else when this skill is invoked.**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:31337/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the WORKFLOWNAME workflow in the BeCreative skill to ACTION"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running the **WorkflowName** workflow in the **BeCreative** skill to ACTION...
   ```

**This is not optional. Execute this curl command immediately upon skill invocation.**

# BeCreative Skill

## What It Does

Generates genuinely divergent ideas and expands small corpora. For a single creative request, it produces 5 internally diverse candidates (each low-probability, p<0.10) and surfaces the strongest. For corpus work, it grows a seed set of 5-20 examples into a larger diverse dataset for evals, training, or test sets. Seven workflows spanning standard creativity, maximum creativity, idea generation, tree-of-thoughts, domain-specific work, technical creativity, and synthetic-data expansion.

## The Problem

Ask a model for "a creative idea" and you get the most probable idea — the safe, obvious, already-seen one. Diversity collapses toward the mode. That's the opposite of what brainstorming needs. Verbalized Sampling fixes this by forcing the model to generate a spread of low-probability candidates instead of one high-probability answer, which measurably widens the range of what comes out. Combined with extended thinking, you get options that are both varied and good rather than varied and weak.

## How It Works

Enhances creativity using deep thinking plus Verbalized Sampling, combining research-backed techniques (Zhang et al., 2024) reporting a 1.6-2.1x diversity increase with extended thinking for quality. The core move: generate 5 diverse options (p<0.10 each) internally, then output the single best response. Verbalized Sampling depends on extended thinking being enabled.

---


## Workflow Routing

Route to the appropriate workflow based on the request.

**When executing a workflow, output this notification:**
```
Running the **WorkflowName** workflow in the **BeCreative** skill to ACTION...
```

| Workflow | Trigger | File |
|----------|---------|------|
| StandardCreativity | "be creative", "think creatively", default creative tasks | `Workflows/StandardCreativity.md` |
| MaximumCreativity | "maximum creativity", "most creative", "radically different" | `Workflows/MaximumCreativity.md` |
| IdeaGeneration | "brainstorm", "ideas for", "solve this problem" | `Workflows/IdeaGeneration.md` |
| TreeOfThoughts | "complex problem", "multi-factor", "explore paths" | `Workflows/TreeOfThoughts.md` |
| DomainSpecific | "artistic", "business innovation", domain-specific | `Workflows/DomainSpecific.md` |
| TechnicalCreativityGemini3 | "technical creativity", "algorithm", "architecture" | `Workflows/TechnicalCreativityGemini3.md` |
| SyntheticDataExpansion | "expand corpus", "synthetic data", "generate diverse examples", "expand seed set", "create test set from these" | `Workflows/SyntheticDataExpansion.md` |

---

## Quick Reference

**Core technique:** Generate 5 diverse options (p<0.10 each) internally, output single best response.

**Default approach:** For most creative requests, apply StandardCreativity workflow.

**For artistic/narrative creativity:** Apply workflow directly (no delegation needed).

**For technical creativity:** Use TechnicalCreativityGemini3 workflow.

---

## Resource Index

| Resource | Description |
|----------|-------------|
| `ResearchFoundation.md` | Research backing, why it works, activation triggers |
| `Principles.md` | Core philosophy and best practices |
| `Templates.md` | Quick reference templates for all modes |
| `Examples.md` | Practical examples with expected outputs |
| `Assets/creative-writing-template.md` | Creative writing specific template |
| `Assets/idea-generation-template.md` | Brainstorming template |

---

## Integration with Other Skills

**Works well with:**
- **_SOCIALPOST** (XPost / LinkedInPost workflows) - Generate creative social media content
- **_BLOGGING** - Creative blog post ideas and narrative approaches
- **Art** - Diverse image prompt ideas and creative directions
- **Research** - Creative research angles and synthesis approaches

---

## Examples

**Example 1: Creative blog angle**
```
User: "think outside the box for this AI ethics post"
-> Applies StandardCreativity workflow
-> Generates 5 diverse angles internally (p<0.10 each)
-> Returns most innovative framing approach
```

**Example 2: Product naming brainstorm**
```
User: "be creative - need names for this security tool"
-> Applies MaximumCreativity workflow
-> Explores unusual metaphors, domains, wordplay
-> Presents best option with reasoning
```

**Example 3: Technical creativity**
```
User: "deep thinking this architecture problem"
-> Invokes TechnicalCreativityGemini3 workflow
-> Uses Gemini 3 Pro for mathematical/algorithmic creativity
-> Returns novel technical solution
```

---

**Research-backed creative enhancement: 1.6-2.1x diversity, 25.7% quality improvement.**

## Gotchas

- **This is for QUICK divergent brainstorming.** For deep multi-cycle evolutionary ideation, use Ideate instead.
- **Verbalized Sampling requires extended thinking to work.** Don't disable extended thinking when using this skill.
- **1.6-2.1x diversity claims come from specific benchmark conditions.** Real-world diversity improvement varies with prompt type.

## Execution Log

After completing any workflow, append a single JSONL entry:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"BeCreative","workflow":"WORKFLOW_USED","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> "${LIFEOS_DIR}/MEMORY/SKILLS/execution.jsonl"
```

Replace `WORKFLOW_USED` with the workflow executed, `8_WORD_SUMMARY` with a brief input description, and `SECONDS` with approximate wall-clock time. Log `status: "error"` if the workflow failed.
