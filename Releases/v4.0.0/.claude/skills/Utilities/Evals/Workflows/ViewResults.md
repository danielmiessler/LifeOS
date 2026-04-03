# ViewResults Workflow

Query and display evaluation results, generate reports, and track trends.

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the ViewResults workflow in the Evals skill to display eval results"}' \
  > /dev/null 2>&1 &
```

Running the **ViewResults** workflow in the **Evals** skill to display eval results...

---

## Prerequisites

- Evaluations have been run
- Results exist in Results/ directory or SQLite database

## Execution

### Step 1: Identify Query

Ask the user:
1. Which use case?
2. What time range? (latest, last week, specific run)
3. What to show? (summary, details, comparison, trends)
4. What format? (table, report, chart)

### Step 2: Quick Status Check

**Latest Results for Use Case:**

```bash
# Show most recent run
bun run ~/.claude/skills/Utilities/Evals/EvalServer/cli.ts results \
  --use-case <name> \
  --latest
```

**All Recent Runs:**

```bash
# List last 10 runs
bun run ~/.claude/skills/Utilities/Evals/EvalServer/cli.ts results \
  --use-case <name> \
  --limit 10
```

### Step 3: View Detailed Results

**Single Run Details:**

```bash
bun run ~/.claude/skills/Utilities/Evals/EvalServer/cli.ts results \
  --run-id <run-id> \
  --verbose
```

**Per-Test-Case Breakdown:**

```bash
bun run ~/.claude/skills/Utilities/Evals/EvalServer/cli.ts results \
  --run-id <run-id> \
  --show-cases
```

### Step 4: Generate Report

**Standard Report:**

```bash
# Generate markdown report
bun run ~/.claude/skills/Utilities/Evals/EvalServer/cli.ts report \
  --run-id <run-id> \
  --output ~/.claude/skills/Utilities/Evals/Results/<use-case>/<run-id>/report.md
```

**Using Report Template:**

```bash
# Render with template
bun run ~/.claude/Templates/Tools/RenderTemplate.ts \
  -t Evals/Report.hbs \
  -d ~/.claude/skills/Utilities/Evals/Results/<use-case>/<run-id>/results.yaml \
  -o ~/.claude/skills/Utilities/Evals/Results/<use-case>/<run-id>/report.md
```

### Step 5: Query Database

**Direct SQLite Queries:**

```bash
cd ~/.claude/skills/Utilities/Evals/EvalServer

# Recent runs by use case
sqlite3 storage/evals.db "
  SELECT run_id, model, pass_rate, mean_score, created_at
  FROM eval_runs
  WHERE use_case = '<name>'
  ORDER BY created_at DESC
  LIMIT 10
"

# Failed test cases
sqlite3 storage/evals.db "
  SELECT test_id, score, failure_reason
  FROM eval_results
  WHERE run_id = '<run-id>' AND passed = 0
"

# Score trends over time
sqlite3 storage/evals.db "
  SELECT date(created_at), avg(mean_score)
  FROM eval_runs
  WHERE use_case = '<name>'
  GROUP BY date(created_at)
  ORDER BY created_at
"
```

### Step 6: Compare Runs

**Two Runs Side-by-Side:**

```bash
bun run ~/.claude/skills/Utilities/Evals/EvalServer/cli.ts compare \
  --run-a <run-id-1> \
  --run-b <run-id-2>
```

**Trend Analysis:**

```bash
bun run ~/.claude/skills/Utilities/Evals/EvalServer/cli.ts trend \
  --use-case <name> \
  --days 30
```

### Step 7: Report Summary

Use structured response format:

```markdown
📋 SUMMARY: Evaluation results for <use-case>

📊 STATUS:
| Metric | Value |
|--------|-------|
| Run ID | <run-id> |
| Date | <date> |
| Model | <model> |
| Pass Rate | X% |
| Mean Score | X.XX |
| Total Tests | N |
| Passed | N |
| Failed | N |

📖 STORY EXPLANATION:
1. Retrieved evaluation run from <date>
2. <N> test cases were evaluated
3. Deterministic scorers ran first (format, length, voice)
4. AI judges evaluated accuracy and style
5. Weighted scores calculated
6. <Pass rate>% passed the 0.75 threshold
7. <Key finding about top/bottom performers>
8. <Recommendation based on results>

🎯 COMPLETED: Results retrieved for <use-case>, <pass-rate>% pass rate.
```

## Query Patterns

### By Time Range

```bash
# Last 24 hours
--since "24 hours ago"

# Last week
--since "7 days ago"

# Specific date range
--from "2024-01-01" --to "2024-01-15"
```

### By Score Threshold

```bash
# Only failed runs
--min-pass-rate 0 --max-pass-rate 0.74

# Only excellent runs
--min-pass-rate 0.90
```

### By Model

```bash
# Specific model
--model claude-3-5-sonnet-20241022

# Compare models
--compare-models
```

### By Test Case

```bash
# Specific test
--test-id 001-basic

# All failures
--failures-only
```

## Output Formats

### Table (Default)

```
┌──────────┬────────────────────────────┬───────────┬────────────┐
│ Run ID   │ Model                      │ Pass Rate │ Mean Score │
├──────────┼────────────────────────────┼───────────┼────────────┤
│ abc123   │ claude-3-5-sonnet-20241022 │ 92%       │ 4.3        │
│ def456   │ gpt-4o                     │ 88%       │ 4.1        │
└──────────┴────────────────────────────┴───────────┴────────────┘
```

### JSON

```bash
--format json
```

```json
{
  "run_id": "abc123",
  "use_case": "newsletter_summaries",
  "model": "claude-3-5-sonnet-20241022",
  "summary": {
    "total_cases": 12,
    "passed": 11,
    "failed": 1,
    "pass_rate": 0.917,
    "mean_score": 4.3,
    "std_dev": 0.5
  },
  "per_test_case": [...]
}
```

### Markdown Report

```bash
--format markdown
```

Uses Report.hbs template to generate full report.

### CSV Export

```bash
--format csv --output results.csv
```

For spreadsheet analysis.

## Trend Analysis

### Regression Detection

```bash
bun run ~/.claude/skills/Utilities/Evals/EvalServer/cli.ts trend \
  --use-case <name> \
  --detect-regression \
  --threshold 0.10  # Alert if >10% drop
```

### Performance Over Time

```
📈 Trend: newsletter_summaries (last 30 days)

Date       | Pass Rate | Mean Score | Change
-----------|-----------|------------|--------
2024-01-15 | 92%       | 4.3        | +5%
2024-01-10 | 87%       | 4.1        | -2%
2024-01-05 | 89%       | 4.2        | baseline

Trend: ↑ Improving
Alert: None
```

## Web UI Options

### Dashboard View

1. Open http://localhost:5173
2. Select use case from sidebar
3. View:
   - Latest run summary
   - Pass rate trend chart
   - Failing test cases
   - Model comparison

### Run Details

1. Click on specific run
2. View:
   - Per-test-case scores
   - Judge reasoning
   - Output samples
   - Diff against baseline

### Export Options

- Download JSON
- Export to CSV
- Generate PDF report

## Common Queries

### "How did the last eval go?"

```bash
bun run ~/.claude/skills/Utilities/Evals/EvalServer/cli.ts results \
  --use-case <name> \
  --latest \
  --summary
```

### "Why did test X fail?"

```bash
bun run ~/.claude/skills/Utilities/Evals/EvalServer/cli.ts results \
  --run-id <run-id> \
  --test-id <test-id> \
  --verbose
```

### "Is performance improving or declining?"

```bash
bun run ~/.claude/skills/Utilities/Evals/EvalServer/cli.ts trend \
  --use-case <name> \
  --days 14
```

### "Which model is best for this task?"

```bash
bun run ~/.claude/skills/Utilities/Evals/EvalServer/cli.ts compare \
  --use-case <name> \
  --compare-models \
  --recent
```

### "Show me all failures this week"

```bash
bun run ~/.claude/skills/Utilities/Evals/EvalServer/cli.ts results \
  --use-case <name> \
  --since "7 days ago" \
  --failures-only
```

## Done

Results retrieved and reported. Use findings to guide prompt/model decisions.
