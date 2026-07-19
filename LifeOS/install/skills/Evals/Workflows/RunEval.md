# RunEval Workflow

Run evaluations for a specific use case.

## Voice Notification

```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the RunEval workflow in the Evals skill to execute evaluation"}' \
  > /dev/null 2>&1 &
```

Running the **RunEval** workflow in the **Evals** skill to execute evaluation...

---

## Prerequisites

- Use case must exist in `UseCases/<name>/`
- Test cases defined in use case
- Config.yaml with scoring criteria

## Execution

### Step 1: Validate Use Case

```bash
# Check use case exists
ls $LIFEOS_ROOT/skills/Evals/UseCases/<use-case>/config.yaml
```

If missing, redirect to `CreateUseCase.md` workflow.

### Step 2: Run Evaluation

```bash
# Run an eval suite via AlgorithmBridge (the canonical entry point)
bun run $LIFEOS_ROOT/skills/Evals/Tools/AlgorithmBridge.ts -s <use-case>

# With ISC row binding (auto-updates the Algorithm ISC row with result):
bun run $LIFEOS_ROOT/skills/Evals/Tools/AlgorithmBridge.ts -s <use-case> -r <isc-row> -u

# To see saturation status alongside the run:
bun run $LIFEOS_ROOT/skills/Evals/Tools/AlgorithmBridge.ts -s <use-case> --show-saturation
```

### Step 3: Collect Results

Results are stored in:
- `LIFEOS/MEMORY/STATE/Evals-Results/<use-case>/<run-id>/results.json` (per-run output)
- Use case directory: `UseCases/<use-case>/` (source of truth)

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
