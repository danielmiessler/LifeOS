# Analyze Workflow

## Purpose

Build a historical baseline of flow scores across all sessions, identify patterns in when and how flow states occur, and provide comparative analysis.

## When To Use

- When the user wants to understand their flow patterns over time
- When building or rebuilding the baseline CSV
- When comparing a specific session against the historical distribution
- When looking for conditions that correlate with deep flow

## Process

### Step 1: Scan Transcript Directories

FlowDetect scans all configured project directories for JSONL transcript files. Each file represents one Claude Code session.

```bash
# Run full analysis
python3 flowdetect.py
```

### Step 2: Analyze Each Session

Every transcript with 3+ user messages is analyzed. The analysis extracts all 12 metrics and computes the composite flow score. Sessions with fewer than 3 user messages are skipped (too little data for meaningful analysis).

### Step 3: Build Baseline Statistics

Across all analyzed sessions, FlowDetect computes:
- **Flow score distribution:** mean, median, standard deviation, range
- **Per-metric baselines:** mean, std, min, max for each of the 12 metrics
- **Distribution brackets:** count of sessions in each classification tier

### Step 4: Generate Report

The full report includes:

1. **Header** — Session count and run timestamp
2. **Flow score statistics** — Mean, median, std, range across all sessions
3. **Metric baselines** — Table of every metric with its statistical profile
4. **Top 10 flow sessions** — Ranked by score with timestamps and key metrics
5. **Bottom 5 sessions** — Least flow-like sessions for contrast
6. **Flow distribution** — Histogram showing how many sessions fall into each tier

### Step 5: Write CSV

All session metrics are written to CSV for external analysis:

```bash
# CSV-only mode (no report, faster)
python3 flowdetect.py --csv
```

The CSV includes one row per session with all 12 metrics plus the composite flow score, session ID, filename, timestamp, and message count.

## Interpreting the Baseline

**Healthy distribution:** Most sessions cluster in ENGAGED (45-64) with occasional spikes into FLOW and DEEP FLOW. Very few sessions should be EXPLORATORY unless the user does a lot of casual or introductory interactions.

**High average (60+):** The user tends toward focused, terse interactions with their AI. This is common for experienced users who have established working patterns.

**High variance (std 15+):** The user has a wide range of session types — some deeply focused, some exploratory. This is normal and healthy.

**All scores near 50:** Either not enough sessions for differentiation, or the user has very consistent communication patterns across all session types.

## Cross-Referencing

The most valuable analysis comes from cross-referencing flow scores with:
- **Time of day** — When do deep flow sessions happen?
- **Session duration** — Do longer sessions correlate with deeper flow?
- **Project type** — Which projects produce the most flow?
- **Biometric data** — If available, correlate flow score with heart rate and HRV
- **Calendar data** — What was happening the day of the highest-scoring sessions?

The CSV output is designed to be imported into any analysis tool (spreadsheets, Python notebooks, R) for this kind of cross-referencing.
