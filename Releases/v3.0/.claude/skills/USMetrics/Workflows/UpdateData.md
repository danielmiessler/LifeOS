# UpdateData Workflow

**Skill:** USMetrics
**Purpose:** Fetch current data from all sources and update the Substrate US-Common-Metrics dataset

## Overview

This workflow pulls live data from FRED, EIA, Treasury FiscalData, and other APIs, then writes the current values to the Substrate dataset files. The GetCurrentState workflow then reads from these populated files.

## Data Flow

```
APIs (FRED, EIA, Treasury)
    ↓
UpdateData workflow (this)
    ↓
Substrate files:
  - US-Common-Metrics.md (markdown with values)
  - us-metrics-current.csv (machine-readable)
  - us-metrics-historical.csv (time series)
    ↓
GetCurrentState workflow
    ↓
Analysis report
```

## Execution Steps

### Step 1: Initialize

Output the workflow status message:

```
Running **UpdateData** in **USMetrics**...
```

### Step 2: Run Update Tool

Execute the update script:

```bash
bun ~/.claude/skills/USMetrics/Tools/update-substrate-metrics.ts
```

This tool:
1. Fetches current values from all configured APIs
2. Writes to `${PROJECTS_DIR}/your-data-project/Data/US-Common-Metrics/US-Common-Metrics.md`
3. Exports to `us-metrics-current.csv`
4. Appends to `us-metrics-historical.csv` (with timestamp)
5. Logs update status

### Step 3: Verify Update

Check the update was successful:
- Verify `US-Common-Metrics.md` has current values (not placeholders)
- Verify `us-metrics-current.csv` exists and has data
- Check update log for any failed fetches

## API Sources

| Source | API | Metrics | Auth |
|--------|-----|---------|------|
| **FRED** | api.stlouisfed.org | GDP, CPI, unemployment, rates, etc. | FRED_API_KEY |
| **EIA** | api.eia.gov | Gas prices, oil prices | EIA_API_KEY |
| **Treasury** | api.fiscaldata.treasury.gov | Federal debt, budget | None |

## Environment Requirements

```bash
export FRED_API_KEY="your_key"    # Required
export EIA_API_KEY="your_key"     # Required for energy data
```

## Output Files

### US-Common-Metrics.md

The markdown file gets values populated in the metric tables:

```markdown
| Metric | Value | Period | Updated | Source |
|--------|-------|--------|---------|--------|
| Real GDP | $22.67T | Q3 2024 | 2024-11-27 | BEA/FRED |
| CPI YoY | 2.6% | Oct 2024 | 2024-11-13 | BLS/FRED |
```

### us-metrics-current.csv

```csv
metric_id,metric_name,value,unit,period,updated,source,fred_id
GDPC1,Real GDP,22670.532,Billions of Chained 2017 Dollars,2024-07-01,2024-11-27,BEA/FRED,GDPC1
CPIAUCSL,CPI All Items,315.562,Index 1982-84=100,2024-10-01,2024-11-13,BLS/FRED,CPIAUCSL
```

### us-metrics-historical.csv

Appends each update as a new row with timestamp:

```csv
fetch_timestamp,metric_id,value,period
2024-12-01T10:30:00Z,GDPC1,22670.532,2024-07-01
2024-12-01T10:30:00Z,UNRATE,4.1,2024-10-01
```

## Trigger Phrases

- "Update US metrics"
- "Refresh the metrics data"
- "Pull latest economic data"
- "Update Substrate metrics"
- "Fetch current values"

## Error Handling

- **API failure**: Log which metrics failed, continue with others
- **Missing API key**: Warn and skip that source
- **Rate limit**: Implement delays between requests
- **Partial update**: Mark which metrics are stale in output

## Update Schedule Recommendation

| Frequency | Metrics |
|-----------|---------|
| Daily | Treasury yields, oil prices, federal debt |
| Weekly | Gas prices, jobless claims, mortgage rates |
| Monthly | CPI, employment, GDP, housing data |

## Notes

- FRED is the primary aggregator - most metrics come through FRED even if original source is BLS/BEA/etc.
- Treasury FiscalData is used directly for daily debt figures
- EIA is used directly for energy prices (more current than FRED)
- Some annual metrics (population, GINI) only update once per year
