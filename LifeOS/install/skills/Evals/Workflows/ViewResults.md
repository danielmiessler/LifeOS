# ViewResults Workflow

Inspect evaluation results from completed runs.

## Voice Notification

```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the ViewResults workflow in the Evals skill to display eval results"}' \
  > /dev/null 2>&1 &
```

Running the **ViewResults** workflow in the **Evals** skill to display eval results...

---

## Where Results Live

Per-run output (source of truth):

```
{{LIFEOS_DIR}}/MEMORY/STATE/Evals-Results/<use-case>/<run-id>/results.json
```

Each `results.json` contains the run summary, per-trial scores, grader outputs, and failure details. The `LIFEOS/MEMORY/STATE/Evals-Results/` directory is the canonical store — query it with standard tools (`jq`, `rg`, `cat`).

---

## Execution

### Step 1: List runs for a use case

```bash
# Show all runs for a use case (newest first)
ls -1t "${LIFEOS_DIR}/MEMORY/STATE/Evals-Results/"<use-case>/

# Or via SuiteManager
bun run "${LIFEOS_ROOT}/skills/Evals/Tools/SuiteManager.ts" list
```

### Step 2: View latest run summary

```bash
# Latest run results.json
LATEST=$(ls -1t "${LIFEOS_DIR}/MEMORY/STATE/Evals-Results/"<use-case>/ | head -1)
cat "${LIFEOS_DIR}/MEMORY/STATE/Evals-Results/"<use-case>/$LATEST/results.json | jq '.summary'

# Or for a specific run
cat "${LIFEOS_DIR}/MEMORY/STATE/Evals-Results/"<use-case>/<run-id>/results.json | jq '.summary'
```

### Step 3: Check saturation (when a suite is graduating capability → regression)

```bash
bun run "${LIFEOS_ROOT}/skills/Evals/Tools/SuiteManager.ts" check-saturation <suite-name>
```

### Step 4: View per-trial scores or failure detail

```bash
# Per-trial summary
cat .../results.json | jq '.trials[] | {trial: .trial_id, pass: .passed, score: .score}'

# Failed trials only
cat .../results.json | jq '.trials[] | select(.passed == false)'

# All grader outputs for a specific trial
cat .../results.json | jq '.trials[0].graders'
```

### Step 5: Report

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

📖 STORY EXPLANATION:
1. Retrieved evaluation run from <date>
2. <N> trials evaluated against <use-case> criteria
3. <Key finding>
4. <Recommendation>

🎯 COMPLETED: Results retrieved for <use-case>, <pass-rate>% pass rate.
```

---

## Comparison and Trend Analysis

There is no built-in CLI for trend analysis, regression detection, or cross-run comparison in the current skill — these are intended use cases that would be authored against the `results.json` files using `jq` or a small ad-hoc script when needed. If you need recurring trend analysis, consider authoring a Tools/TrendReport.ts script (not yet on disk) and wiring it into the routing table.

---

## Done

Results inspected from `LIFEOS/MEMORY/STATE/Evals-Results/<use-case>/<run-id>/results.json` and (optionally) suite saturation surfaced via `SuiteManager.ts`.
