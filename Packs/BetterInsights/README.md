# BetterInsights

**`/insights` told me I send 66 messages a day. The real number is 844.**

A `/better-insights` command that fixes the undercounting in Claude Code's built-in `/insights`:

- **Separates human messages from tool results** (the API sends tool results as "user" messages, inflating counts ~7x)
- **Scans all sessions** including those moved to nested paths after Claude Code upgrades
- **Classifies sessions** as interactive (you), automated (agents/heartbeats), or subagent
- **Reports token usage** with input/output/cache breakdown and per-model counts
- **Generates a split-view HTML report** showing original `/insights` vs corrected data side-by-side

## What It Fixes

| Issue | /insights | /better-insights |
|---|---|---|
| Message counting | Counts tool results as yours (~7x) | Human messages only |
| Session coverage | Analyzes ~12 sessions | Scans all |
| Data migrations | Misses sessions in nested path | Scans both paths |
| Agent awareness | None | Interactive vs automated vs subagent |
| Token usage | Not reported | Full breakdown |
| Models | Not reported | Per-model response counts |

## Requirements

- Python 3.6+ (no additional dependencies)
- Claude Code with session history in `~/.claude/projects/`

## Standalone Repo

Also available outside PAI: [github.com/sawasawasawa/better-insights-claude-code](https://github.com/sawasawasawa/better-insights-claude-code)
