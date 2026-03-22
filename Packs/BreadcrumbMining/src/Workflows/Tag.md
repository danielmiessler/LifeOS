# Tag Workflow

Capture a breadcrumb during a live session. Speed matters — capture before the insight fades.

## When to Trigger

- User says "eureka," "remember this," "bookmark this," "holy shit," "I just realized"
- User explicitly asks to tag something
- AI detects breakthrough language in user's message (proactive capture)

## Step 1: Capture

```bash
bun ~/.claude/skills/BreadcrumbMining/Tools/breadcrumb-tag.ts "<the insight>"
```

Or with explicit category:
```bash
bun ~/.claude/skills/BreadcrumbMining/Tools/breadcrumb-tag.ts "<the insight>" --category healing
```

## Step 2: Confirm

Show the user what was tagged:
- Tag type (auto-detected from content)
- Category (auto-detected or explicit)
- File location

Keep confirmation to one line. Don't break flow.

## Proactive Tagging

When the user's message contains breakthrough language but they didn't explicitly ask to tag, suggest it:

"That sounds like a breadcrumb. Want me to tag it?"

Do NOT auto-tag without asking. The human decides what matters.
