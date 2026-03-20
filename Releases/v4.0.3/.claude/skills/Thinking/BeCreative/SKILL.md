---
name: be-creative
description: "Divergent ideation via Verbalized Sampling + extended thinking (1.6-2.1x diversity, 25.7% quality improvement). USE WHEN be creative, deep thinking, brainstorm, divergent ideas, creative solutions, maximum creativity, tree of thoughts, idea generation, domain specific creativity, technical creativity, standard creativity."
---

## Customization

Check for user customizations at `~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/BeCreative/` — load and apply if present, otherwise use defaults.

## Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the WORKFLOWNAME workflow in the BeCreative skill to ACTION"}' \
  > /dev/null 2>&1 &
```

Output: `Running the **WorkflowName** workflow in the **BeCreative** skill to ACTION...`

# BeCreative Skill

Deep thinking + Verbalized Sampling (Zhang et al., 2024) for enhanced creativity. **Core technique:** Generate 5 diverse options (p<0.10 each) internally, output single best response.

## Workflow Routing

| Workflow | Triggers | Description |
|----------|----------|-------------|
| `Workflows/StandardCreativity.md` | "be creative", "think creatively", default | Deep thinking + VS for quality creative work |
| `Workflows/MaximumCreativity.md` | "maximum creativity", "radically different" | Push boundaries, avoid cliches, unconventional |
| `Workflows/IdeaGeneration.md` | "brainstorm", "ideas for", "solve this problem" | Problem-solving and innovation focus |
| `Workflows/TreeOfThoughts.md` | "complex problem", "multi-factor", "explore paths" | Branching exploration for complex challenges |
| `Workflows/DomainSpecific.md` | "artistic", "business innovation" | Domain-tailored creativity templates |
| `Workflows/TechnicalCreativityGemini3.md` | "technical creativity", "algorithm", "architecture" | Engineering creativity via Gemini 3 Pro |

**Default:** StandardCreativity. **Technical problems:** TechnicalCreativityGemini3. **Artistic/narrative:** Apply workflow directly.

## Resources

| Resource | Description |
|----------|-------------|
| `ResearchFoundation.md` | Research backing and activation triggers |
| `Principles.md` | Core philosophy and best practices |
| `Templates.md` | Quick reference templates for all modes |
| `Examples.md` | Practical examples with expected outputs |
| `Assets/creative-writing-template.md` | Creative writing template |
| `Assets/idea-generation-template.md` | Brainstorming template |

## Examples

```
"think outside the box for this AI ethics post"
→ StandardCreativity → 5 diverse angles internally (p<0.10 each) → most innovative framing

"be creative - need names for this security tool"
→ MaximumCreativity → unusual metaphors, domains, wordplay → best option with reasoning

"deep thinking this architecture problem"
→ TechnicalCreativityGemini3 → Gemini 3 Pro for algorithmic creativity → novel solution
```

## Integration

Works well with: **XPost/LinkedInPost** (creative social content), **Blogging** (narrative approaches), **Development** (technical solutions), **Art** (image prompt ideas), **Research** (creative angles).
