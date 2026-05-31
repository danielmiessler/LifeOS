---
name: pai-prompting
description: "Meta-prompting standard library — the PAI system for generating, optimizing, and composing prompts programmatically. Owns three pillars: Standards (Anthropic Claude 4.x best practices, context engineering principles, 1,500+ paper synthesis, Fabric pattern system, markdown-first / no-XML-tags); Templates (Handlebars-based — Briefing.hbs, Structure.hbs, Gate.hbs, DynamicAgent.hbs, and eval-specific templates Judge.hbs, Rubric.hbs, TestCase.hbs, Comparison.hbs, Report.hbs); and Tools (RenderTemplate.ts for CLI/TypeScript rendering with data-content separation). Philosophy: prompts that write prompts — structure is code, content is data. Delivered 65% token reduction across PAI (53K to 18K tokens) via template extraction. Output is always a prompt to be used elsewhere, not final content. Reference files: Standards.md (complete prompt engineering guide), Tools/RenderTemplate.ts (rendering implementation). USE WHEN designing, optimizing, or composing prompts. NOT FOR simple Q&A or prompt execution."
version: 5.0.0
author: PAI v5.0 → Hermes Port
license: MIT
metadata:
  hermes_tags: [pai, prompting, meta-prompting, templates, handlebars, anthropic, standards]
  related_skills: [pai-evals, pai-isa, pai-delegation]
---

<!-- Voice notification — fire-and-forget on invocation -->
```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the pai-prompting skill"}' \
  > /dev/null 2>&1 &
```


# pai-prompting — Meta-Prompting & Template System

## Overview

The Prompting skill owns ALL prompt engineering concerns — generating,
optimizing, and composing prompts programmatically. It is the "standard
library" for prompt engineering across PAI.

**Philosophy:** Prompts that write prompts. Structure is code, content is data.
Meta-prompting enables dynamic composition where the same template with
different data generates specialized agents, workflows, and evaluation frameworks.

**Token Efficiency:** Delivered 65% reduction (53K to 18K tokens) across PAI:

| Area | Before | After | Savings |
|------|--------|-------|---------|
| SKILL.md Frontmatter | 20,750 | 8,300 | 60% |
| Agent Briefings | 6,400 | 1,900 | 70% |
| Voice Notifications | 6,225 | 725 | 88% |
| Workflow Steps | 7,500 | 3,000 | 60% |
| **TOTAL** | ~53,000 | ~18,000 | **65%** |

## Core Components

### 1. Standards — Prompt Engineering Standards

Complete prompt engineering guide based on:
- Anthropic's Claude 4.x Best Practices (November 2025)
- Context engineering principles
- The Fabric prompt pattern system
- 1,500+ academic papers on prompt optimization

**Key topics:**
- **Markdown-first design** — NO XML tags. Use `## Headers` not `<tags>`.
- **Be explicit with instructions** — Claude 4.x requires clear, specific direction
- **Add context and motivation** — Explain *why* behavior matters, not just *what*
- **Tell instead of forbid** — Positive framing gives a clear target rather than a void to avoid
- **Context is a finite resource** — Optimize for signal-to-noise ratio; every token depletes attention budget
- **Match prompt style to output style** — Prompt formatting influences output formatting
- **Multi-context window workflows** — Patterns for long-horizon tasks spanning multiple context windows
- **Subagent orchestration** — Minimal, task-specific context with clear success criteria
- **Action bias patterns** — Default-to-action (implementation-focused) vs conservative (research-focused)
- **Empirical validation** — Performance range of 10-90% based on structure choices; few-shot examples +25% to +90%

Reference: `Standards.md` in the skill directory.

### 2. Templates — Handlebars Template System

Programmatic prompt generation via Handlebars templates with data-content separation.

**Primitive Templates:**

| Template | Purpose | Used By |
|----------|---------|---------|
| `Briefing.hbs` | Agent context handoff — briefing, agent personality, task, output format | Agents, delegation workflows |
| `Structure.hbs` | Workflow structure — phased steps, instructions, success criteria | Workflow definitions |
| `Gate.hbs` | Validation checklists — pre-flight checks, quality gates | Development workflows |
| `Voice.hbs` | Voice mapping — tone, persona, communication style | Agent personality injection |
| `Roster.hbs` | Agent role definitions — team composition | Multi-agent orchestration |

**Eval-Specific Templates:**

| Template | Purpose |
|----------|---------|
| `Judge.hbs` | LLM-as-Judge evaluation prompt |
| `Rubric.hbs` | Scoring rubric definition prompt |
| `TestCase.hbs` | Test case generation prompt |
| `Comparison.hbs` | Side-by-side comparison prompt |
| `Report.hbs` | Evaluation report generation prompt |

**Data Files:**
- `Data/Agents.yaml` — Agent personality presets
- `Data/ValidationGates.yaml` — Reusable validation gate definitions
- `Data/VoicePresets.yaml` — Voice configuration presets

### 3. Tools — Rendering & Validation

**RenderTemplate.ts** — CLI/TypeScript rendering with data-content separation:

```typescript
// JavaScript/TypeScript API
import { renderTemplate } from './Tools/RenderTemplate.ts';

const prompt = renderTemplate('Primitives/Briefing.hbs', {
  briefing: { type: 'research' },
  agent: { id: 'EN-1', name: 'Skeptical Thinker', personality: {} },
  task: { description: 'Analyze security architecture', questions: [] },
  output_format: { type: 'markdown' }
});
```

```bash
# CLI usage
bun run RenderTemplate.ts \
  --template Primitives/Structure.hbs \
  --data phased-analysis.yaml
```

**ValidateTemplate.ts** — Template validation, variable resolution checking.

### 4. Patterns — Reusable Prompt Primitives

- **Safe Defaults** — Minimal viable prompt structure
- **Conservation** — Maximum signal per token
- **Action Bias** — Default to implementation over suggestion
- **Multi-Context** — Cross-session state management
- **Subagent Handoff** — Minimal task-specific context delegation

## Workflow Routing

| Request Pattern | Action |
|-----------------|--------|
| "generate a prompt for X" | Compose a prompt using appropriate templates and standards |
| "optimize this prompt" | Analyze existing prompt against Standards.md, suggest improvements |
| "create a system prompt for..." | Generate system prompt using Briefing.hbs + data |
| "template for [workflow/eval]" | Select and render the appropriate template |
| "prompt hygiene review" | Audit prompt against markdown-first, tell-don't-forbid, signal-to-noise principles |
| "render template with data" | Run RenderTemplate.ts with specified template and data file |

## Integration Points

**Agents Skill:**
- Uses `Templates/Primitives/Briefing.hbs` for agent context handoff
- Uses `RenderTemplate.ts` to compose dynamic agents
- Maintains agent-specific template: DynamicAgent.hbs

**Evals Skill:**
- Uses eval-specific templates: Judge, Rubric, TestCase, Comparison, Report
- Leverages `RenderTemplate.ts` for eval prompt generation

**Development Skill:**
- References `Standards.md` for prompt best practices
- Uses `Structure.hbs` for workflow patterns
- Applies `Gate.hbs` for validation checklists

## Best Practices

### 1. Separation of Concerns
- **Templates:** Structure and formatting only
- **Data:** Content and parameters (YAML/JSON)
- **Logic:** Rendering and validation (TypeScript)

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

## Gotchas

- **Meta-prompting generates PROMPTS, not content.** The output is a prompt that gets used elsewhere — not the final deliverable.
- **Templates should be model-agnostic.** Don't write prompts that depend on specific model quirks.
- **Test generated prompts before declaring them ready.** A prompt that looks good may perform poorly in practice.
- **Markdown only.** Never use XML tags in prompts — markdown headers are the standard.
- **Signal-to-noise is critical.** Every token depletes attention budget; optimize ruthlessly.
- **Prompt format influences output format.** If you use markdown headers in the prompt, expect markdown in the response.

## Research Foundation

- Anthropic: "Claude 4.x Best Practices" (November 2025)
- Anthropic: "Effective Context Engineering for AI Agents"
- Anthropic: "Prompt Templates and Variables"
- The Fabric System (January 2024)
- "The Prompt Report" — arXiv:2406.06608
- "The Prompt Canvas" — arXiv:2412.05127

## Execution Log Pattern

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"pai-prompting","workflow":"WORKFLOW","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> ~/.hermes/pai/MEMORY/SKILLS/execution.jsonl
```
