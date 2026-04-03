# Browser Stories — YAML User Story Format

Stories are declarative YAML files that define user journeys for automated validation. Each story has a URL, a sequence of steps, and assertions to verify.

## Format

```yaml
name: Story Suite Name
url: https://example.com
stories:
  - name: Individual story name
    steps:
      - action: wait|click|fill|type|press|select|hover|goto
        target: "LLM-readable element description"  # NOT CSS selectors
        value: "input value"                         # for fill/type/select
        description: "what should happen"            # for wait actions
    assertions:
      - type: snapshot_contains|url_matches|element_visible|element_absent
        text: "expected text"          # for snapshot_contains
        pattern: "regex pattern"       # for url_matches
        description: "element desc"    # for element_visible/absent
```

## Key Principles

1. **LLM-readable targets** — describe elements in natural language ("First story title link"), not CSS selectors (`.story-link:first-child`). UIReviewer agents use accessibility snapshots to find elements by description.

2. **One file per page/flow** — group related stories in a single YAML file. Each file targets one URL or closely related flow.

3. **Assertions are binary** — each assertion produces PASS or FAIL. No fuzzy matching.

## Actions

| Action | Required Fields | Description |
|--------|----------------|-------------|
| `wait` | `description` | Wait for a condition (page load, element appears) |
| `click` | `target` | Click an element matching the description |
| `fill` | `target`, `value` | Clear and fill an input field |
| `type` | `value` | Type text via keyboard (no target needed) |
| `press` | `value` | Press a key (Enter, Tab, Escape, etc.) |
| `select` | `target`, `value` | Select a dropdown option |
| `hover` | `target` | Hover over an element |
| `goto` | `value` | Navigate to a URL |

## Assertion Types

| Type | Required Fields | Description |
|------|----------------|-------------|
| `snapshot_contains` | `text` | Accessibility snapshot contains this text |
| `url_matches` | `pattern` | Current URL matches this regex pattern |
| `element_visible` | `description` | Element matching description is visible |
| `element_absent` | `description` | No element matching description is visible |

## Running Stories

Stories are executed by the **ReviewStories** workflow, which fans each story out to a parallel UIReviewer agent:

```
# Run all stories in a file
"Review stories in HackerNews.yaml"

# Run all stories across all files
"Review all browser stories"
```

## File Naming

- Use PascalCase: `HackerNews.yaml`, `ExampleApp.yaml`, `LoginFlow.yaml`
- One file per target app or page group
- Keep story count per file under 8 (UIReviewer parallelism limit)
