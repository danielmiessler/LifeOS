# Verifying FlowDetect Installation

## File Existence Checks

```bash
# Hook file exists and is executable
test -x ~/.claude/hooks/FlowDetect.hook.ts && echo "PASS: Hook installed and executable" || echo "FAIL: Hook not found or not executable"

# Analysis engine exists and is executable
test -x ~/flowdetect.py && echo "PASS: Analysis engine installed" || echo "FAIL: flowdetect.py not found"

# Settings.json contains SessionEnd hook configuration
grep -q "FlowDetect" ~/.claude/settings.json 2>/dev/null && echo "PASS: Hook configured in settings.json" || echo "FAIL: Hook not found in settings.json"

# At least one transcript directory exists and contains JSONL files
for dir in ~/.claude/projects/*/; do
  count=$(ls "$dir"*.jsonl 2>/dev/null | wc -l)
  if [ "$count" -gt 0 ]; then
    echo "PASS: Found $count transcripts in $dir"
  fi
done
```

## Runtime Checks

```bash
# Verify Python 3 can import required modules (all stdlib, no pip installs needed)
python3 -c "import re, os, sys, json, csv, statistics; print('PASS: All required modules available')"

# Run CSV analysis mode (processes all transcripts, writes results)
python3 ~/flowdetect.py --csv 2>&1 && echo "PASS: CSV analysis completed" || echo "FAIL: Analysis failed"

# Check CSV output exists and has data
test -s ~/flowdetect_results.csv && echo "PASS: CSV has data ($(wc -l < ~/flowdetect_results.csv) rows)" || echo "FAIL: CSV is empty or missing"

# Run full report mode (prints analysis to stdout)
python3 ~/flowdetect.py 2>/dev/null | head -5
# Expected: Banner with "FLOWDETECT — N SESSIONS ANALYZED"

# Verify hook can be parsed by bun
bun check ~/.claude/hooks/FlowDetect.hook.ts 2>&1 && echo "PASS: Hook parses cleanly" || echo "WARN: Parse check returned errors"
```

## Expected Behavior

When working correctly:

1. **At session end:** Hook fires automatically, runs `flowdetect.py --csv` to update the baseline CSV
2. **On manual run:** `python3 ~/flowdetect.py` prints a full report with flow scores across all sessions
3. **On live check:** `python3 ~/flowdetect.py --live SESSION_ID` prints the current session's flow state with classification

## Interpreting Results

| Score | Classification | Meaning |
|-------|---------------|---------|
| 80-100 | DEEP FLOW | Terse commands, fast typing, minimal formality — sustained deep focus |
| 65-79 | FLOW | Clear engagement, shortened messages, reduced deliberation |
| 45-64 | ENGAGED | Active work but with normal communication patterns |
| 30-44 | DELIBERATE | Planning, discussing, exploring — productive but not flow |
| 0-29 | EXPLORATORY | Casual, question-heavy, or introductory interaction |

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| "No sessions with enough user messages" | Transcript directories misconfigured | Update TRANSCRIPT_DIRS in flowdetect.py to match your project paths |
| CSV is empty | No transcripts found or all have fewer than 3 user messages | Verify transcript paths, check that JSONL files exist |
| All scores near 50 | Not enough variance in your sessions | Score 50 is the neutral baseline — scores differentiate as you accumulate more sessions |
| Hook never fires | SessionEnd not configured in settings.json | Add hook entry to settings.json hooks.SessionEnd array |
| "Session not found" on --live | Session ID does not match any transcript filename | Use the transcript file stem (filename without .jsonl extension) |
