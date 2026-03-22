# Monitor Workflow

How to set up continuous behavioral monitoring with DriftMon.

## Automatic Monitoring via SessionEnd Hook

The `DriftMonRun.hook.ts` hook runs DriftMon automatically when a Claude Code session ends. It executes `driftmon.py --csv` in the background with a 30-second timeout.

### Setup

1. Install both `driftmon.py` and `DriftMonRun.hook.ts` per the INSTALL guide
2. Register the hook in your Claude Code settings
3. Sessions will automatically update the CSV baseline

### Hook Behavior

- Fires at SessionEnd (non-blocking, fire-and-forget)
- Runs `python3 driftmon.py --csv`
- Writes updated CSV to the configured output path
- Logs success or failure to stderr
- Never blocks or delays session shutdown
- 30-second timeout prevents hanging

### Ordering

If you also use WorkCompletionLearning, place DriftMonRun after it in the SessionEnd hook array. This ensures new learning files are written before DriftMon analyzes them.

```json
{
  "hooks": {
    "SessionEnd": [
      { "command": "bun run ~/.claude/hooks/WorkCompletionLearning.hook.ts", "timeout": 10000 },
      { "command": "bun run ~/.claude/hooks/DriftMonRun.hook.ts", "timeout": 30000 }
    ]
  }
}
```

## Manual Monitoring Cadence

If you prefer not to use the hook, establish a manual review cadence:

### Weekly

Run the full report once a week:

```bash
python3 ~/.claude/hooks/driftmon.py
```

Check for new outliers. Compare this week's outlier count to last week's.

### Monthly

Review the CSV in a spreadsheet. Look for:

- Metrics trending in one direction over multiple weeks
- Increasing variance (the AI is becoming less consistent)
- New patterns appearing in the refusal summary

### After Configuration Changes

Whenever you update system prompts, model versions, or tool configurations, run a comparison:

```bash
# Run a session with the new configuration
# Then compare against baseline
python3 ~/.claude/hooks/driftmon.py --new /path/to/new-session-learning.md
```

## Alert Thresholds

DriftMon does not send alerts by default. To add alerting, wrap the analysis in a script:

```bash
#!/bin/bash
# Run DriftMon and check for high-severity drift
output=$(python3 ~/.claude/hooks/driftmon.py 2>&1)
drift_count=$(echo "$output" | grep -c "DRIFT")

if [ "$drift_count" -gt 3 ]; then
  echo "HIGH DRIFT DETECTED: $drift_count signals" >> ~/.claude/MEMORY/drift-alerts.log
fi
```

## Baseline Management

The baseline recalculates from all available learning files every time DriftMon runs. There is no stored baseline state. This means:

- Adding more sessions strengthens the baseline
- Removing outlier files from LEARNING directories adjusts the baseline
- The baseline naturally evolves as you accumulate more data

If you want a fixed baseline for comparison, save a CSV at a known point in time and compare future runs against it.
