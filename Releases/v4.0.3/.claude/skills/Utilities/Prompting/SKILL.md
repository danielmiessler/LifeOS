---
name: prompting
description: Meta-prompting system that generates optimized prompts using templates, standards, and patterns. Produces structured prompts with role, context, and output format. USE WHEN meta-prompting, template generation, prompt optimization, programmatic prompt composition, render template, validate template, prompt engineering.
---

## Customization

Check for user customizations at `~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/Prompting/` — if present, load and apply overrides before proceeding.

## Notification

```bash
curl -s -X POST http://localhost:8888/notify -H "Content-Type: application/json" -d '{"message": "Running the WORKFLOWNAME workflow in the Prompting skill to ACTION"}' > /dev/null 2>&1 &
```

# Prompting - Meta-Prompting & Template System

Standard library for prompt engineering — owns standards, templates, tools, and reusable patterns. Other skills reference these resources for prompt generation and optimization.

## Core Components

### 1. Standards.md
Complete prompt engineering guide — Markdown-first design (no XML tags), context engineering, and structured output patterns. Reference: `Standards.md`

### 2. Templates
Handlebars templates for prompt generation — primitives (Briefing, Structure, Gate), eval templates (Judge, Rubric, Report), and agent templates. Reference: `Templates/README.md`

### 3. RenderTemplate.ts
TypeScript tool that renders Handlebars templates with YAML/JSON data. Reference: `Tools/RenderTemplate.ts`

## Workflow

1. **Select template** — Choose from `Templates/` based on use case (briefing, structure, gate, eval)
2. **Prepare data** — Create YAML/JSON with required template variables
3. **Render** — Run `bun run Tools/RenderTemplate.ts --template <template> --data <data>`
4. **Validate** — Check output has role, context, and output format sections; verify no unresolved `{{placeholders}}`

## Usage Examples

### Example 1: Using Briefing Template (Agent Skill)

```typescript
// skills/Agents/Tools/ComposeAgent.ts
import { renderTemplate } from '~/.claude/skills/Utilities/Prompting/Tools/RenderTemplate.ts';

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

## References

- `Standards.md` — Complete prompt engineering guide
- `Templates/README.md` — Template system overview
- `Tools/RenderTemplate.ts` — Rendering implementation

**Related Skills:** Agents (dynamic agent composition), Evals (LLM-as-Judge prompting)

