# LifeOS Templating System

**Version:** 1.0.0
**Rollback Point:** v2.5.0

## Overview

The LifeOS templating system enables **prompts that write prompts**—dynamic composition where structure is fixed but content is parameterized. Based on Anthropic's official `{{variable}}` syntax and industry best practices.

## Directory Structure

```
Templates/
├── Primitives/       # Core template files (.hbs)
│   ├── Roster.hbs    # Agent/skill definitions
│   ├── Voice.hbs     # Personality calibration
│   ├── Structure.hbs # Workflow patterns
│   ├── Briefing.hbs  # Agent context handoff
│   └── Gate.hbs      # Validation checklists
├── Data/             # YAML data sources
│   ├── Agents.yaml   # All agent definitions
│   ├── Skills.yaml   # All skill definitions
│   ├── VoicePresets.yaml    # Voice calibration presets
│   └── ValidationGates.yaml # Standard validation gates
├── Evals/            # Eval-specific templates
│   ├── Judge.hbs     # LLM-as-Judge prompt template
│   ├── Rubric.hbs    # Evaluation rubric generator
│   ├── TestCase.hbs  # Test case definition
│   ├── Comparison.hbs # A/B comparison template
│   └── Report.hbs    # Eval results report
├── Compiled/         # Generated output (gitignored)
└── Tools/            # Rendering utilities
    ├── RenderTemplate.ts   # Core rendering engine
    └── ValidateTemplate.ts # Template syntax checker
```

## Core Syntax

LifeOS uses Handlebars notation for template variables:

| Syntax | Purpose | Example |
|--------|---------|---------|
| `{{variable}}` | Simple interpolation | `Hello {{name}}` |
| `{{object.property}}` | Nested access | `{{agent.voice_id}}` |
| `{{#each items}}...{{/each}}` | Iteration | List generation |
| `{{#if condition}}...{{/if}}` | Conditional | Optional sections |
| `{{> partial}}` | Include partial | Reusable components |

## Five Core Primitives

### 1. ROSTER — Agent & Skill Definitions

Data-driven generation of structured definitions from YAML.

**Use Cases:**
- 32 RedTeam agent personalities
- 83 skill frontmatter definitions
- Voice configuration presets

### 2. VOICE — Personality Calibration

Parameterized voice and tone settings.

**Use Cases:**
- Agent voice parameters (stability, similarity_boost)
- Speaking rate calibration
- Character archetype mapping

### 3. STRUCTURE — Workflow Patterns

Standardized multi-step execution patterns.

**Use Cases:**
- Phased analysis (RedTeam 5-phase)
- Round-based debate (Council 3-round)
- Sequential pipeline (Development gates)

### 4. BRIEFING — Agent Context Handoff

How agents receive tasks and context.

**Use Cases:**
- Research agent queries
- RedTeam analyst prompts
- Delegation context packages

### 5. GATE — Validation Checklists

Reusable quality and completion checks.

**Use Cases:**
- Art mandatory elements
- Development completion gates
- Research source verification

## Eval Templates

### JUDGE — LLM-as-Judge Prompt

Configurable judge prompts with reasoning-first pattern.

### RUBRIC — Evaluation Criteria

Structured rubrics with dimensions and scoring scales.

### TEST_CASE — Test Definition

Input/expected output pairs with metadata.

### COMPARISON — A/B Testing

Side-by-side prompt variant comparison.

### REPORT — Results Summary

Statistical reporting with confidence intervals.

## Usage

### Basic Rendering

```bash
bun run $LIFEOS_ROOT/skills/Prompting/Tools/RenderTemplate.ts \
  --template Primitives/Roster.hbs \
  --data Data/Agents.yaml \
  --output Compiled/AgentRoster.md
```

### Inline in Prompts

```handlebars
{{> briefing agent=current_agent task=current_task}}
```

## Best Practices

1. **Separation of Concerns**
   - Templates: Structure and formatting
   - Data: Content and parameters
   - Logic: Rendering and validation

2. **Keep Templates Simple**
   - Avoid complex logic in templates
   - Use helpers for transformations
   - Business logic belongs in TypeScript

3. **Version Control**
   - Templates and data in separate files
   - Track changes independently
   - Enable A/B testing of structures

4. **Validate Before Rendering**
   - Check all required variables exist
   - Validate data against schema
   - Test with edge cases

5. **DRY Principle**
   - Extract repeated patterns into partials
   - Use presets for common configurations
   - Single source of truth for definitions

## Rollback Instructions

If anything breaks, rollback to v2.5.0:

```bash
cd $LIFEOS_ROOT
git checkout v2.5.0
# Or to just undo templating:
rm -rf Templates/
git checkout v2.5.0 -- LIFEOS/Prompting.md
```

## Token Savings

| Area | Before | After | Savings |
|------|--------|-------|---------|
| SKILL.md Frontmatter | 20,750 | 8,300 | 60% |
| Agent Personalities | 3,000 | 1,200 | 60% |
| Workflow Steps | 7,500 | 3,000 | 60% |
| Agent Briefings | 6,400 | 1,900 | 70% |
| Voice Notifications | 6,225 | 725 | 88% |
| **TOTAL** | ~53,000 | ~18,000 | **65%** |

## Available Helpers

The RenderTemplate.ts engine provides these custom Handlebars helpers:

### String Helpers
| Helper | Example | Output |
|--------|---------|--------|
| `uppercase` | `{{uppercase "hello"}}` | `HELLO` |
| `lowercase` | `{{lowercase "HELLO"}}` | `hello` |
| `titlecase` | `{{titlecase "hello world"}}` | `Hello World` |
| `truncate` | `{{truncate text 50}}` | First 50 chars... |

### Formatting Helpers
| Helper | Example | Output |
|--------|---------|--------|
| `indent` | `{{indent text 2}}` | Indented by 2 spaces |
| `join` | `{{join items ", "}}` | `a, b, c` |
| `json` | `{{json object}}` | JSON string |
| `codeblock` | `{{codeblock code "ts"}}` | Fenced code block |

### Logic Helpers
| Helper | Example | Purpose |
|--------|---------|---------|
| `eq` | `{{#if (eq a b)}}` | Equality check |
| `gt` | `{{#if (gt a b)}}` | Greater than |
| `lt` | `{{#if (lt a b)}}` | Less than |
| `includes` | `{{#if (includes arr item)}}` | Array contains |

### Number Helpers
| Helper | Example | Output |
|--------|---------|--------|
| `formatNumber` | `{{formatNumber 1234567}}` | `1,234,567` |
| `percent` | `{{percent 0.85 1}}` | `85.0` |

### Utility Helpers
| Helper | Example | Output |
|--------|---------|--------|
| `now` | `{{now "YYYY-MM-DD"}}` | `2025-12-09` |
| `pluralize` | `{{pluralize count "item"}}` | `items` or `item` |
| `default` | `{{default value "fallback"}}` | Value or fallback |
| `repeat` | `{{repeat 3 "="}}` | `===` |

## CLI Usage

### Render a Template

```bash
bun run $LIFEOS_ROOT/skills/Prompting/Tools/RenderTemplate.ts \
  --template Primitives/Roster.hbs \
  --data Data/Agents.yaml \
  --output Compiled/AgentRoster.md
```

### Preview Without Writing

```bash
bun run $LIFEOS_ROOT/skills/Prompting/Tools/RenderTemplate.ts \
  --template Evals/Judge.hbs \
  --data path/to/judge-config.yaml \
  --preview
```

### Validate Template Syntax

```bash
bun run $LIFEOS_ROOT/skills/Prompting/Tools/ValidateTemplate.ts \
  --template Primitives/Briefing.hbs \
  --data Data/sample-briefing.yaml
```

## Quick Reference

### Template Selection Guide

| I want to... | Use Template | With Data |
|--------------|--------------|-----------|
| Generate agent roster | `Roster.hbs` | `Agents.yaml` |
| Configure voice settings | `Voice.hbs` | `VoicePresets.yaml` |
| Create workflow structure | `Structure.hbs` | Custom YAML |
| Brief an agent | `Briefing.hbs` | Task context |
| Create validation checklist | `Gate.hbs` | `ValidationGates.yaml` |
| Create LLM judge prompt | `Judge.hbs` | Judge config |
| Define evaluation rubric | `Rubric.hbs` | Rubric config |
| Set up A/B test | `Comparison.hbs` | Comparison config |
| Generate results report | `Report.hbs` | Results data |

### Common Patterns

**Iterate over agents:**
```handlebars
{{#each agents}}
- **{{name}}**: {{description}}
{{/each}}
```

**Conditional sections:**
```handlebars
{{#if reasoning_required}}
Provide your reasoning BEFORE giving a score.
{{/if}}
```

**Include partial:**
```handlebars
{{> validation-gate gate=art_validation}}
```

**Nested property access:**
```handlebars
{{agent.voice.settings.stability}}
```

## Research Foundation

This system is based on research from:
- **Anthropic**: `{{handlebars}}` syntax, context engineering patterns
- **OpenAI**: Structured Outputs, meta-prompting
- **LangChain**: LCEL composition, prompt templates
- **Academic**: The Prompt Report (58 techniques), DSPy

## Related Documentation

- `$LIFEOS_DIR/Prompting.md` (Templating section)
- `$LIFEOS_ROOT/History/research/2025-12/2025-12-09-templating-system-research.md`
- `$LIFEOS_ROOT/History/learnings/2025-12/2025-12-09-021700_LEARNING_complete-templating-system-and-evals-integration.md`
- `$LIFEOS_ROOT/skills/Evals/SKILL.md`
