# Analyze Workflow

How to run DriftMon analysis and interpret the results.

## Running Analysis

### Full Baseline Report

```bash
python3 ~/.claude/hooks/driftmon.py
```

This scans all learning files, computes per-metric baselines (mean and standard deviation), prints the metric table and outlier report, and writes CSV output.

### CSV Only

```bash
python3 ~/.claude/hooks/driftmon.py --csv
```

Writes raw data to CSV without terminal output. Useful for automated pipelines or spreadsheet analysis.

### Single File Comparison

```bash
python3 ~/.claude/hooks/driftmon.py --new /path/to/file.md
```

Analyzes one file against the established baseline. Each metric shows its value and z-score. Metrics with z-score >= 2.0 are flagged as DRIFT.

### Cross-AI Comparison

```bash
python3 ~/.claude/hooks/driftmon.py --mirror /path/to/chatgpt/markdown/
```

Analyzes a directory of ChatGPT exports, computes a separate ChatGPT baseline, and prints a comparison table showing deltas between Claude and ChatGPT behavioral patterns.

## Interpreting Results

### The Metric Table

Each row shows one behavioral metric with its mean, standard deviation, and normal range (mean +/- 2 standard deviations).

- **High hedge_count**: The AI is qualifying statements more than usual
- **High refusal_count**: The AI is declining requests more than usual
- **High politeness_density**: The AI is using more softener language
- **Low assertion_strength_index**: The AI is less direct and confident
- **High meta_commentary_ratio**: The AI is commenting on the user's state instead of helping

### The Outlier Section

Sessions listed here have at least one metric beyond 2 standard deviations from the mean. Each flagged metric shows its value and z-score.

A single outlier is normal variation. Multiple outliers in the same session suggest something changed. Multiple sessions with the same metric flagged suggest a trend.

### Refusal Summary

The report ends with a count of sessions containing any refusal patterns. A rising percentage over time indicates drift toward defensive behavior.

### Z-Scores

- **z = 0**: Exactly at the mean (normal)
- **|z| < 1**: Within normal variation
- **1 <= |z| < 2**: Slightly unusual but not flagged
- **|z| >= 2**: Flagged as outlier (occurs ~5% of the time by chance)
- **|z| >= 3**: Strongly anomalous (occurs ~0.3% of the time by chance)

## CSV Analysis

The CSV contains one row per analyzed session with all 12 metrics. Use it to:

- Plot trends over time in a spreadsheet
- Calculate rolling averages
- Compare across time periods
- Feed into other analysis tools
