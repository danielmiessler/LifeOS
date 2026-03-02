# User Actions

Reusable automation actions that PAI can invoke. Each action is a directory containing its definition and any supporting files.

## Structure

```
ACTIONS/
├── extract/          # Content extraction actions
├── transform/        # Data transformation actions
├── format/           # Output formatting actions
├── parse/            # Input parsing actions
└── social/           # Social media actions
```

## Creating an Action

Create a directory with:
- `ACTION.md` — Action definition (trigger, inputs, outputs, steps)
- Supporting files as needed (templates, configs)

## Example

```
A_SEND_EMAIL/
├── ACTION.md         # "Send email via Gmail API with template"
└── templates/
    └── default.md    # Email template
```
