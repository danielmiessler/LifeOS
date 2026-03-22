# Verifying DriftMon

## File Existence Checks

```bash
# Core analyzer
echo "Checking driftmon.py..."
test -f ~/.claude/hooks/driftmon.py && echo "PASS: driftmon.py exists" || echo "FAIL: driftmon.py missing"

echo "Checking driftmon.py is executable..."
test -x ~/.claude/hooks/driftmon.py && echo "PASS: driftmon.py is executable" || echo "FAIL: driftmon.py not executable"

# SessionEnd hook (optional)
echo "Checking DriftMonRun hook..."
test -f ~/.claude/hooks/DriftMonRun.hook.ts && echo "PASS: Hook exists" || echo "INFO: Hook not installed (optional)"
```

## Runtime Check

```bash
# DriftMon should run without errors (may report no data if no learning files exist yet)
python3 ~/.claude/hooks/driftmon.py 2>&1; echo "Exit code: $?"

# If no learning files exist, you'll see:
# "No Claude session data found. Check LEARNING_DIRS paths."
# This is expected — DriftMon needs accumulated learning files to analyze.
```

## Functional Test

Create a minimal test file and verify DriftMon can analyze it:

```bash
# Create a test learning file with a Full Response section
mkdir -p ~/.claude/MEMORY/LEARNING/ALGORITHM/2026-01

cat > /tmp/driftmon-test-input.md << 'TESTEOF'
---
timestamp: 2026-01-15 10:00:00 CST
---

# Test Learning

<details>
<summary>Full Response</summary>

This is a test response that contains enough words to pass the minimum threshold.
The response should be analyzed for hedging patterns and refusal patterns.
Perhaps this might contain some hedge words that could be detected.
Generally speaking, it typically includes softener language as well.
I understand your question and I would be happy to help with this analysis.
Certainly this is a great question about behavioral drift detection.
The assertion strength index measures how direct the language is versus hedged.
Because this test includes causal connectives, the reasoning depth metric should register.
Various different factors and elements contribute to the overall analysis.

</details>
TESTEOF

cp /tmp/driftmon-test-input.md ~/.claude/MEMORY/LEARNING/ALGORITHM/2026-01/test-verify.md

# Run DriftMon — should now find at least one session
python3 ~/.claude/hooks/driftmon.py 2>&1
echo "Exit code: $?"

# Run with --new to analyze a single file (requires baseline data)
python3 ~/.claude/hooks/driftmon.py --new /tmp/driftmon-test-input.md 2>&1

# Cleanup
rm -f /tmp/driftmon-test-input.md
rm -f ~/.claude/MEMORY/LEARNING/ALGORITHM/2026-01/test-verify.md
rmdir ~/.claude/MEMORY/LEARNING/ALGORITHM/2026-01 2>/dev/null
```

## Expected Results

- `driftmon.py` exists and is executable
- Running with learning files produces a report with METRIC table and OUTLIERS section
- Running with `--csv` produces a CSV file at the configured output path
- Running with `--new FILE` shows per-metric z-scores against the baseline
- Exit code is 0 in all cases (except when no learning data exists, which returns 1)
