---
name: prompting
description: Meta-prompting and prompt optimization techniques. Prompt structuring, chain-of-thought, persona injection, constraint framing, output formatting, few-shot examples, and iterative prompt refinement. USE WHEN prompt, prompt engineering, meta-prompt, optimize prompt, chain of thought, few shot, prompting technique.
metadata:
  author: pai
  version: 1.0.0
---

# Prompting — Meta & Optimization

## Prompt Structure

```
## Context
[Background the model needs]

## Task
[Clear statement of what to do]

## Constraints
[Rules, boundaries, limitations]

## Output Format
[Expected structure, template, or schema]

## Examples (optional)
[Input → Output pairs for few-shot]
```

## Techniques

| Technique | When | How |
|-----------|------|-----|
| Chain-of-Thought | Complex reasoning | "Think step by step" |
| Persona | Role-specific output | "You are a senior security engineer" |
| Constraint framing | Guardrails | "Never include PII" |
| Output formatting | Structured results | "Return JSON with keys: name, value" |
| Few-shot | New patterns | "Here are 3 examples..." |
| Negative prompt | Exclude patterns | "Do not use jargon" |
| Iterative refinement | Polish | "Now make it more concise" |

## Optimization Loop

1. **Write** initial prompt with clear task
2. **Test** with representative input
3. **Evaluate** output against criteria
4. **Identify** gaps (wrong format, missing info, errors)
5. **Refine** — Add constraint, adjust format, add example
6. **Repeat** until quality threshold met

## Rules

- Be specific: "Write a haiku" vs "Write a poem"
- One task per prompt when possible
- Prefer examples over abstract descriptions
- Test edge cases, not just happy path
