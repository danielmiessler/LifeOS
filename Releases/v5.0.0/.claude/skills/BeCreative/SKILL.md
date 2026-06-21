---
name: BeCreative
description: "Divergent ideation and corpus expansion using Verbalized Sampling + extended thinking. Single-shot mode generates 5 internally diverse candidates (p<0.10 each) and surfaces the strongest. Multi-turn mode expands a small seed corpus (5-20 examples) into a diverse N-example dataset for evals, training, or test sets. Research-backed: Zhang et al. 2025 (arXiv:2510.01171) — 1.6-2.1x diversity increase on creative writing, 25.7% quality improvement, and synthetic-data downstream accuracy lift 30.6% → 37.5% on math benchmarks. Seven workflows: StandardCreativity, MaximumCreativity, IdeaGeneration, TreeOfThoughts, DomainSpecific, TechnicalCreativityGemini3 for algorithmic/architecture work, and SyntheticDataExpansion for VS-Multi corpus growth. Single-shot output is one best response, not a ranked list; SyntheticDataExpansion writes a JSONL corpus to MEMORY/WORK/{slug}/synthetic-data/. Integrates with XPost, LinkedInPost, Blogging (creative angles), Art (diverse image prompt ideas), Business (offer frameworks), Research (creative synthesis), Evals and _PROMPTINJECTION (consume expanded corpora). Reference files: ResearchFoundation.md (why it works, activation triggers), Principles.md (core philosophy), Templates.md (quick reference for all modes), Examples.md. NOT FOR multi-cycle evolutionary ideation with Lamarckian meta-learning (use Ideate for that). NOT FOR factually-constrained tasks with one right answer — paper §3.2 shows VS provides no lift there. USE WHEN be creative, think outside the box, brainstorm, divergent ideas, creative solutions, maximum creativity, tree of thoughts, radically different, most creative option, creative angle on, unconventional approach, name this, creative framing, narrative angle, artistic direction, expand this corpus, synthetic data, generate diverse examples, expand seed set, create test set from these examples."
effort: medium
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/BeCreative/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# BeCreative Skill

Enhance AI creativity using deep thinking + Verbalized Sampling. Combines research-backed techniques (Zhang et al., 2024) for 1.6-2.1x diversity increase and extended thinking for quality.

---

## Workflow Routing

Route to the appropriate workflow based on the request.

**When executing a workflow, output this notification:**
```
Running the **WorkflowName** workflow in the **BeCreative** skill to ACTION...
```

| Workflow | Triggers | Description |
|----------|----------|-------------|
| `Workflows/StandardCreativity.md` | "be creative", "think creatively", default creative tasks | Standard deep thinking + VS for quality creative work |
| `Workflows/MaximumCreativity.md` | "maximum creativity", "most creative", "radically different" | Push boundaries, avoid all cliches, unconventional |
| `Workflows/IdeaGeneration.md` | "brainstorm", "ideas for", "solve this problem" | Problem-solving and innovation focus |
| `Workflows/TreeOfThoughts.md` | "complex problem", "multi-factor", "explore paths" | Branching exploration for complex challenges |
| `Workflows/DomainSpecific.md` | "artistic", "business innovation", domain-specific | Domain-tailored creativity templates |
| `Workflows/TechnicalCreativityGemini3.md` | "technical creativity", "algorithm", "architecture" | Engineering creativity via Gemini 3 Pro |
| `Workflows/SyntheticDataExpansion.md` | "expand corpus", "synthetic data", "generate diverse examples", "expand seed set", "create test set from these" | Multi-turn VS to grow a small seed corpus into a diverse N-example dataset |

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
- **XPost** / **LinkedInPost** - Generate creative social media content
- **Blogging** - Creative blog post ideas and narrative approaches
- **Development** - Creative technical solutions
- **Art** - Diverse image prompt ideas and creative directions
- **Business** - Creative offer frameworks and business models
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
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"BeCreative","workflow":"WORKFLOW_USED","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> ~/.claude/PAI/MEMORY/SKILLS/execution.jsonl
```

Replace `WORKFLOW_USED` with the workflow executed, `8_WORD_SUMMARY` with a brief input description, and `SECONDS` with approximate wall-clock time. Log `status: "error"` if the workflow failed.
