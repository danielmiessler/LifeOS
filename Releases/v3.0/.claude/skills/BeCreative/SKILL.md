---
name: BeCreative
description: Extended thinking mode. USE WHEN be creative, deep thinking, deep thinking, extended reasoning. SkillSearch('becreative') for docs.
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/skills/PAI/USER/SKILLCUSTOMIZATIONS/BeCreative/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.


## 🚨 MANDATORY: Voice Notification (REQUIRED BEFORE ANY ACTION)

**You MUST send this notification BEFORE doing anything else when this skill is invoked.**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:8888/notify \
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
