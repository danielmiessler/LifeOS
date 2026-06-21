# RunEval Workflow

Run evaluations for a specific use case.

---

## Prerequisites

- Use case must exist in `UseCases/<name>/`
- Test cases defined in use case
- Config.yaml with scoring criteria

## Execution

### Step 1: Validate Use Case

```bash
# Check use case exists
ls ~/.claude/skills/Evals/UseCases/<use-case>/config.yaml
```

If missing, redirect to `CreateUseCase.md` workflow.

### Step 2: Check EvalServer Status

```bash
# Check if server is running
curl -s http://localhost:5173 > /dev/null 2>&1 && echo "Running" || echo "Not running"
```

If not running, start it:
```bash
cd ~/.claude/skills/Evals/EvalServer && bun run dev &
```

### Step 3: Run Evaluation

**Option A: Web UI (Recommended)**
1. Open http://localhost:5173
2. Select use case from dropdown
3. Choose model(s) to evaluate
4. Click "Run Evaluation"
5. Watch real-time streaming results

**Option B: CLI**
```bash
bun run ~/.claude/skills/Evals/EvalServer/cli-run.ts \
  --use-case <name> \
  --model claude-3-5-sonnet-20241022
```

### Step 4: Collect Results

Results are stored in:
- `Results/<use-case>/<run-id>/results.json`
- `EvalServer/storage/evals.db` (queryable)

### Step 5: Report Summary

Use structured response format:

```markdown
📋 SUMMARY: Evaluation completed for <use-case>

📊 STATUS:
| Metric | Value |
|--------|-------|
| Pass Rate | X% |
| Mean Score | X.XX |
| Failed Tests | X |

📖 STORY EXPLANATION:
1. Ran evaluation against <N> test cases
2. Deterministic scorers completed first
3. AI judges evaluated accuracy and style
4. Calculated weighted scores
5. Compared against pass threshold
6. <Key finding 1>
7. <Key finding 2>
8. <Recommendation>

🎯 COMPLETED: Evaluation finished with X% pass rate.
```

## Error Handling

**If eval fails:**
1. Check model API key is configured
2. Verify test cases have valid inputs
3. Check scorer configurations in config.yaml
4. Review error logs in terminal

## Done

Evaluation complete. Results available in UI and files.
