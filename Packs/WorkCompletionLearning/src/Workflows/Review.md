# Review Workflow

How to review and use the learning files that WorkCompletionLearning accumulates.

## Browse by Category

Learning files are organized into two categories:

```
MEMORY/LEARNING/
  ALGORITHM/       # Process and approach insights
    2026-03/       # Month directories
    2026-04/
  SYSTEM/          # Infrastructure and tooling insights
    2026-03/
```

**ALGORITHM learnings** tell you about how you approached work: what methods you used, what iteration patterns emerged, what you would do differently.

**SYSTEM learnings** tell you about infrastructure: what tools broke, what configurations needed adjustment, what system-level patterns recurred.

## Browse by Time

Each month directory contains all learnings for that month, sorted by date and time in the filename:

```
2026-03-20_1430_work_api-endpoint-auth.md
2026-03-21_0915_work_database-migration.md
2026-03-22_1730_work_monitoring-setup.md
```

The filename encodes: date, time (HHMM), the literal `work`, and a slug of the title.

## Search for Patterns

Use grep or your editor's search to find patterns across learnings:

```bash
# Find all sessions that used a specific tool
grep -r "Bash" ~/.claude/MEMORY/LEARNING/

# Find sessions with high ISC satisfaction
grep -r "ISC.*passing" ~/.claude/MEMORY/LEARNING/

# Find long sessions
grep -r "Duration.*[2-9]h" ~/.claude/MEMORY/LEARNING/

# Find sessions with many file changes
grep -r "Files Changed: [0-9][0-9]" ~/.claude/MEMORY/LEARNING/
```

## Monthly Review

At the end of each month, review the month's directory:

1. Count total learnings: `ls ~/.claude/MEMORY/LEARNING/ALGORITHM/2026-03/ | wc -l`
2. Read through titles to spot recurring themes
3. Note which types of work generated the most sessions
4. Identify any sessions where the approach was notably effective or ineffective

## Integration with DriftMon

If you use the DriftMon pack, it reads these learning files as input for behavioral drift analysis. The more learnings you accumulate, the stronger your behavioral baseline becomes.
