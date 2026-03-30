---
name: better-insights
description: Comprehensive Claude Code usage stats. Separates interactive from automated sessions, human messages from tool results. Fixes /insights undercounting.
user_invocable: true
---

# Better Insights

```bash
python3 ~/.claude/skills/BetterInsights/full_insights.py "$@"
```

Arguments: `--days=N` (default 7), `--all`, `--no-open`, `--json`
