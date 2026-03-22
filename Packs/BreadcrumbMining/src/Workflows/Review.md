# Review Workflow

Show recent breadcrumbs for reflection or session start.

## Step 1: Run Review

```bash
bun ~/.claude/skills/BreadcrumbMining/Tools/breadcrumb-tag.ts --review
```

Or for a specific window:
```bash
bun ~/.claude/skills/BreadcrumbMining/Tools/breadcrumb-tag.ts --review --last 7
```

## Step 2: Surface at Session Start (Optional)

If configured as a session start check, show the most recent 3-5 breadcrumbs before beginning work. This reconnects the user with their recent insights and provides continuity across sessions.

## Intent-to-Flag Mapping

| User Says | Flag | Effect |
|-----------|------|--------|
| "show breadcrumbs" | --review | Last 30 days |
| "this week's breadcrumbs" | --review --last 7 | Last 7 days |
| "today's breadcrumbs" | --review --last 1 | Today only |
