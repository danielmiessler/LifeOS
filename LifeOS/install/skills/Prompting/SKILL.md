---
name: Prompting
version: 1.1.21
description: "Meta-prompting standard library for generating, optimizing, and composing prompts programmatically via Standards, Handlebars Templates, and Tools; output is always a prompt to use elsewhere, not final content. USE WHEN meta-prompting, template generation, prompt optimization, prompt engineering, write a prompt, create system prompt, Handlebars template, eval prompt, judge prompt. NOT FOR generating final content (use the appropriate domain skill)."
effort: medium
---

## Customization

**Before executing, check for user customizations at:**
`$LIFEOS_DIR/USER/CUSTOMIZATIONS/SKILLS/Prompting/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.


## 🚨 MANDATORY: Voice Notification (REQUIRED BEFORE ANY ACTION)

**You MUST send this notification BEFORE doing anything else when this skill is invoked.**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:31337/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the WORKFLOWNAME workflow in the Prompting skill to ACTION"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running the **WorkflowName** workflow in the **Prompting** skill to ACTION...
   ```

**This is not optional. Execute this curl command immediately upon skill invocation.**

# Prompting - Meta-Prompting & Template System

## What It Does

Generates, optimizes, and composes prompts programmatically. It's the standard library for prompt engineering — other skills call it when they need to build or improve a prompt. The output is always a prompt to be used elsewhere, never the final content itself.

**Invoke when:** meta-prompting, template generation, prompt optimization, programmatic prompt composition, creating dynamic agents, generating structured prompts from data.

## The Problem

Prompt engineering tends to get copy-pasted and rewritten by hand across every skill that needs it, so the same patterns drift apart and best practices live in one person's head. When you want to compose a prompt from data — spin up a custom agent, build an eval judge, generate a phased workflow — there's no clean way to separate the structure from the content. This skill makes structure code and content data: one Handlebars template plus different data renders specialized agents, workflows, and eval frameworks, and the engineering standards live in one place every skill can reference.

## Ideal-State Prompting — the Default Standard

**Every prompt this library generates or optimizes articulates the ideal state, not the procedure.** Say WHAT done looks like (as testable outcomes), the CONSTRAINTS, and the high-quality TOOLS available — then trust the model to find HOW. Reasoning choreography ("first analyze, then consider, then decide") is BPE-violating scaffolding: it caps a capable model and rots as models improve. Ideal-state prompting is *more* precise, not vaguer — the specificity moves to the outcome.

Four keep-classes are legitimate HOW and survive the cut: **safety-gate**, **verified-gotcha**, **tool-contract**, **output-format-contract**. Deterministic tools (`*.ts`) are exempt. The test for any procedural line: *would a smarter model make this rule unnecessary?* Yes → cut; No → it's a keep-class. Full standard: `Standards.md` § Ideal-State Prompting.

## How It Works

Three pillars carry the work:

- **Standards** - Anthropic best practices, Claude 4.x patterns, empirical research (markdown-first design, context engineering, the Fabric pattern system, 1,500+ academic papers on prompt optimization). Full guide in `Standards.md`.
- **Templates** - Handlebars-based system for programmatic prompt generation: Primitives (Briefing, Structure, Gate, Roster, Voice) plus eval templates (Judge, Rubric, TestCase, Comparison, Report). The agent-specific `DynamicAgent.hbs` lives in the Agents skill (`Agents/Templates/DynamicAgent.hbs`), not here.
- **Tools** - Template rendering (`RenderTemplate.ts`), validation, and data-content separation.

## Workflow Routing

Library skill — no `Workflows/` directory. Requests route to the rendering tools and reference docs:

| Trigger | Workflow | File |
|---------|----------|------|
| Render a template / compose a prompt from data / Handlebars template | RenderTemplate (tool) | `Tools/RenderTemplate.ts` |
| Validate a template | ValidateTemplate (tool) | `Tools/ValidateTemplate.ts` |
| Prompt engineering standards / best practices / prompt optimization | Standards (reference) | `Standards.md` |

## Examples

### Example 1: Using Briefing Template (compose an agent brief)

```typescript
// Render a structured agent brief from data before launching general-purpose
import { renderTemplate } from '${LIFEOS_SKILL_DIR}/Tools/RenderTemplate.ts';

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

### Example 3: Render an Agent Brief from Data

```typescript
// Render a structured agent brief, then launch general-purpose with it
const brief = renderTemplate('Primitives/Briefing.hbs', {
  agent: { name: 'Skeptical Security Reviewer', role: 'auth bypass and input validation' },
  task: { description: 'Review the auth flow', questions: [...] },
});
// Pass `brief` as the prompt to Agent(subagent_type="general-purpose")
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

The templating system eliminated **~35,000 tokens (65% reduction)** across LifeOS:

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

### 2. DRY Principle
- Extract repeated patterns into partials
- Use presets for common configurations
- Single source of truth for definitions

### 3. Version Control
- Templates and data in separate files
- Track changes independently
- Enable A/B testing of structures

## References

**Primary Documentation:**
- `Standards.md` - Complete prompt engineering guide
- `Templates/README.md` - Template system overview
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

**Philosophy:** Prompts that write prompts. Structure is code, content is data. Meta-prompting enables dynamic composition where the same template with different data generates specialized agents, workflows, and evaluation frameworks. This is core LifeOS DNA - programmatic prompt generation at scale.

## Gotchas

- **Meta-prompting generates PROMPTS, not content.** The output is a prompt that gets used elsewhere — not the final deliverable.
- **Templates should be model-agnostic.** Don't write prompts that depend on specific model quirks.
- **Test generated prompts before declaring them ready.** A prompt that looks good may perform poorly.

## Execution Log

After completing any workflow, append a single JSONL entry:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"Prompting","workflow":"WORKFLOW_USED","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> $LIFEOS_DIR/MEMORY/SKILLS/execution.jsonl
```

Replace `WORKFLOW_USED` with the workflow executed, `8_WORD_SUMMARY` with a brief input description, and `SECONDS` with approximate wall-clock time. Log `status: "error"` if the workflow failed.
