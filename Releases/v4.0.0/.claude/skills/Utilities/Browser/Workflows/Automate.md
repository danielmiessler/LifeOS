# Automate Workflow — Recipe Template Engine

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the Automate workflow in the Browser skill to execute a recipe template"}' \
  > /dev/null 2>&1 &
```

Running **Automate** in **Browser**...

---

Load a parameterized recipe template, resolve its parameters, and execute it through the appropriate browser tool.

## When to Use

- Running a predefined browser automation pattern with custom parameters
- Executing a reusable workflow template (summarize, screenshot compare, form fill)
- Any task that matches an existing recipe

## Trigger Words

"automate", "recipe", "template", or a specific recipe name (e.g., "SummarizePage", "FormFill")

## Input

- **Recipe name:** matches against `Recipes/*.md` filenames (case-insensitive)
- **User prompt:** injected as `{PROMPT}` in the template
- **Parameter overrides:** key=value pairs override recipe defaults

## Steps

### 1. Find Recipe

```
Glob: skills/Utilities/Browser/Recipes/*.md
```

Match the user's input against recipe filenames. If ambiguous, list available recipes and ask.

**Available recipes are discovered dynamically** — no index file. Any `.md` file in `Recipes/` (except `README.md`) is a recipe.

### 2. Load Recipe

Read the matched recipe file:
- Parse YAML frontmatter for `name`, `description`, `tool`, `defaults`
- Read body for the template content

### 3. Resolve Parameters

Apply parameter resolution in this order:

1. **User overrides** — explicit key=value pairs from the user's input
2. **Recipe defaults** — from frontmatter `defaults` section
3. **`{PROMPT}`** — always replaced with the user's natural language input
4. **`{URL}`** — from user input (commonly the first URL mentioned)

Resolution is simple string replacement: `{param}` → value.

Unresolved parameters (no default, no user input) are left as `{param}` for the executing agent to interpret or ask about.

### 4. Select Tool

From recipe frontmatter `tool` field:

| Tool Value | Execution Method |
|-----------|-----------------|
| `playwright-cli` | Execute steps as sequential `playwright-cli` Bash commands |
| `BrowserAgent` | Spawn `Task(subagent_type="BrowserAgent", prompt=resolved_template)` |
| `UIReviewer` | Spawn `Task(subagent_type="UIReviewer", prompt=resolved_template)` |

Default: `playwright-cli` if `tool` field is missing.

### 5. Execute

Run the resolved template through the selected tool:

- **playwright-cli:** Parse the numbered steps into CLI commands and execute sequentially
- **BrowserAgent/UIReviewer:** Pass the full resolved template as the agent prompt

### 6. Return Results

Report the execution results:
- For `playwright-cli`: command outputs, screenshot paths, any errors
- For agents: the agent's full response including screenshots and reports

## Design Decisions

- **Glob-based discovery.** No recipe index to maintain — just drop a `.md` file in `Recipes/`.
- **Simple string replacement.** `{param}` → value. No Handlebars, no Jinja, no templating library. Keeps recipes readable and maintainable.
- **Tool selection from frontmatter.** The recipe author decides the right tool at authoring time, not at runtime.
- **Unresolved params left in place.** BrowserAgent/UIReviewer agents can handle `{param}` in their prompt and ask or infer the value. This is graceful degradation, not an error.

## Error Handling

- No matching recipe → list all available recipes from `Recipes/` directory
- Missing required parameter (URL for most recipes) → ask the user
- Tool execution fails → report the error with context from the recipe
