# Browser Recipes — Parameterized Workflow Templates

Recipes are Markdown templates with parameter placeholders that encode reusable browser task patterns. They're the composable building blocks for browser automation.

## Format

Each recipe is a Markdown file with YAML frontmatter:

```markdown
---
name: Recipe Name
description: What this recipe does
tool: playwright-cli | BrowserAgent | UIReviewer
defaults:
  param1: default_value
  param2: default_value
---

# Recipe Name

1. Step one using {param1}
2. Step two using {param2}

{PROMPT}
```

## Parameters

- **`{PROMPT}`** — injected from the user's input. Always included as the final section.
- **`{URL}`** — target URL, commonly provided by the user.
- **`{param}`** — any custom parameter defined in `defaults`. User can override at invocation.

Parameters are resolved by simple string replacement. Unresolved parameters (no default and no user input) are left as-is for the executing agent to interpret.

## Frontmatter Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Human-readable recipe name |
| `description` | Yes | What the recipe does (one sentence) |
| `tool` | Yes | Which tool executes: `playwright-cli`, `BrowserAgent`, or `UIReviewer` |
| `defaults` | No | Default values for template parameters |

## Tool Selection

| Tool | When to Use |
|------|------------|
| `playwright-cli` | Deterministic steps, no AI reasoning needed |
| `BrowserAgent` | Needs AI to decide what to do based on page content |
| `UIReviewer` | Structured validation with assertions |

## Running Recipes

Recipes are executed by the **Automate** workflow:

```
# Run a recipe by name
"Automate SummarizePage for https://example.com"

# Run with parameter overrides
"Automate FormFill with URL=http://localhost:3000/signup and name=John"
```

## File Naming

- Use PascalCase: `SummarizePage.md`, `FormFill.md`
- One recipe per file
- Name should clearly describe the action
