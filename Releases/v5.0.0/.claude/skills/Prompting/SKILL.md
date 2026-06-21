---
name: Prompting
description: "Meta-prompting standard library — the PAI system for generating, optimizing, and composing prompts programmatically. Owns three pillars: Standards (Anthropic Claude 4.x best practices, context engineering principles, 1,500+ paper synthesis, Fabric pattern system, markdown-first / no-XML-tags); Templates (Handlebars-based — Briefing.hbs, Structure.hbs, Gate.hbs, DynamicAgent.hbs, and eval-specific templates Judge.hbs, Rubric.hbs, TestCase.hbs, Comparison.hbs, Report.hbs used by Agents and Evals skills); and Tools (RenderTemplate.ts for CLI/TypeScript rendering with data-content separation). Philosophy: prompts that write prompts — structure is code, content is data. Delivered 65% token reduction across PAI (53K → 18K tokens) via template extraction. Output is always a prompt to be used elsewhere, not final content. Reference files: Standards.md (complete prompt engineering guide), Tools/RenderTemplate.ts (rendering implementation). NOT FOR generating final content or answers — this skill produces prompts only (for content, use the appropriate domain skill). USE WHEN meta-prompting, template generation, prompt optimization, prompt engineering, write a prompt for, generate an agent prompt, create system prompt, programmatic prompt, Handlebars template, optimize this prompt, prompt hygiene, context engineering, eval prompt, judge prompt, agent briefing."
effort: medium
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/Prompting/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# Prompting - Meta-Prompting & Template System

**Invoke when:** meta-prompting, template generation, prompt optimization, programmatic prompt composition, creating dynamic agents, generating structured prompts from data.

## Overview

The Prompting skill owns ALL prompt engineering concerns:
- **Standards** - Anthropic best practices, Claude 4.x patterns, empirical research
- **Templates** - Handlebars-based system for programmatic prompt generation
- **Tools** - Template rendering, validation, and composition utilities
- **Patterns** - Reusable prompt primitives and structures

This is the "standard library" for prompt engineering - other skills reference these resources when they need to generate or optimize prompts.

## Core Components

### 1. Standards.md
Complete prompt engineering documentation based on:
- Anthropic's Claude 4.x Best Practices (November 2025)
- Context engineering principles
- The Fabric prompt pattern system
- 1,500+ academic papers on prompt optimization

**Key Topics:**
- Markdown-first design (NO XML tags)

## Usage Examples

### Example 1: Using Briefing Template (Agent Skill)

```typescript
// skills/Agents/Tools/ComposeAgent.ts
import { renderTemplate } from '${CLAUDE_SKILL_DIR}/Tools/RenderTemplate.ts';

const prompt = renderTemplate('Primitives/Briefing.hbs', {
  briefing: { type: 'research' },
  agent: { id: 'EN-1', name: 'Skeptical Thinker', personality: {...} },
  task: { description: 'Analyze security architecture', questions: [...] },
  output_format: { type: 'markdown' }
});
```

### Example 2: Using Structure Template (Workflow)

```yaml
# Data: phased-analysis.yaml
phases:
  - name: Discovery
    purpose: Identify attack surface
    steps:
      - action: Map entry points
        instructions: List all external interfaces...
  - name: Analysis
    purpose: Assess vulnerabilities
    steps:
      - action: Test boundaries
        instructions: Probe each entry point...
```

```bash
bun run RenderTemplate.ts \
  --template Primitives/Structure.hbs \
  --data phased-analysis.yaml
```

### Example 3: Custom Agent with Voice Mapping

```typescript
// Generate specialized agent with appropriate voice
const agent = composeAgent(['security', 'skeptical', 'thorough'], task, traits);
// Returns: { name, traits, voice: 'default', voiceId: 'VOICE_ID...' }
```

## Integration with Other Skills

### Agents Skill
- Uses `Templates/Primitives/Briefing.hbs` for agent context handoff
- Uses `RenderTemplate.ts` to compose dynamic agents
- Maintains agent-specific template: `Agents/Templates/DynamicAgent.hbs`

### Evals Skill
- Uses eval-specific templates: Judge, Rubric, TestCase, Comparison, Report
- Leverages `RenderTemplate.ts` for eval prompt generation
- Eval templates may be stored in `Evals/Templates/` but use Prompting's engine

### Development Skill
- References `Standards.md` for prompt best practices
- Uses `Structure.hbs` for workflow patterns
- Applies `Gate.hbs` for validation checklists

## Token Efficiency

The templating system eliminated **~35,000 tokens (65% reduction)** across PAI:

| Area | Before | After | Savings |
|------|--------|-------|---------|
| SKILL.md Frontmatter | 20,750 | 8,300 | 60% |
| Agent Briefings | 6,400 | 1,900 | 70% |
| Voice Notifications | 6,225 | 725 | 88% |
| Workflow Steps | 7,500 | 3,000 | 60% |
| **TOTAL** | ~53,000 | ~18,000 | **65%** |

## Best Practices

### 1. Separation of Concerns
- **Templates**: Structure and formatting only
- **Data**: Content and parameters (YAML/JSON)
- **Logic**: Rendering and validation (TypeScript)

### 2. Keep Templates Simple
- Avoid complex logic in templates
- Use Handlebars helpers for transformations
- Business logic belongs in TypeScript, not templates

### 3. DRY Principle
- Extract repeated patterns into partials
- Use presets for common configurations
- Single source of truth for definitions

### 4. Version Control
- Templates and data in separate files
- Track changes independently
- Enable A/B testing of structures

## References

**Primary Documentation:**
- `Standards.md` - Complete prompt engineering guide
- `Templates/README.md` - Template system overview (if preserved)
- `Tools/RenderTemplate.ts` - Implementation details

**Research Foundation:**
- Anthropic: "Claude 4.x Best Practices" (November 2025)
- Anthropic: "Effective Context Engineering for AI Agents"
- Anthropic: "Prompt Templates and Variables"
- The Fabric System (January 2024)
- "The Prompt Report" - arXiv:2406.06608
- "The Prompt Canvas" - arXiv:2412.05127

**Related Skills:**
- Agents - Dynamic agent composition
- Evals - LLM-as-Judge prompting
- Development - Spec-driven development patterns

---

**Philosophy:** Prompts that write prompts. Structure is code, content is data. Meta-prompting enables dynamic composition where the same template with different data generates specialized agents, workflows, and evaluation frameworks. This is core PAI DNA - programmatic prompt generation at scale.

## Gotchas

- **Meta-prompting generates PROMPTS, not content.** The output is a prompt that gets used elsewhere — not the final deliverable.
- **Templates should be model-agnostic.** Don't write prompts that depend on specific model quirks.
- **Test generated prompts before declaring them ready.** A prompt that looks good may perform poorly.

## Execution Log

After completing any workflow, append a single JSONL entry:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"Prompting","workflow":"WORKFLOW_USED","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> ~/.claude/PAI/MEMORY/SKILLS/execution.jsonl
```

Replace `WORKFLOW_USED` with the workflow executed, `8_WORD_SUMMARY` with a brief input description, and `SECONDS` with approximate wall-clock time. Log `status: "error"` if the workflow failed.
