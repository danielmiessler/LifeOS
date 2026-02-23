# GetCurrentState Workflow

**Skill:** USMetrics
**Purpose:** Generate comprehensive U.S. economic overview with multi-timeframe trend analysis

## Overview

This workflow produces a detailed analysis document examining all 68 metrics in the US-Common-Metrics dataset across multiple time horizons (10 year, 5 year, 2 year, 1 year), identifying patterns, correlations, and research opportunities.

**IMPORTANT:** This workflow reads from the Substrate US-Common-Metrics dataset. Run `UpdateData` workflow first to ensure data is current.

## Data Flow

```
1. UpdateData workflow (run first)
   └── Fetches from FRED, EIA, Treasury APIs
   └── Writes to Substrate files:
       - US-Common-Metrics.md
       - us-metrics-current.csv
       - us-metrics-historical.csv

2. GetCurrentState workflow (this)
   └── Reads from Substrate files
   └── Calculates trends from historical data
   └── Generates analysis report
```

## Execution Steps

### Step 1: Initialize

Output the workflow status message:

```
Running **GetCurrentState** in **USMetrics**...
```

### Step 2: Load Metric Definitions

Read the master metrics document:
```
${PROJECTS_DIR}/your-data-project/Data/US-Common-Metrics/US-Common-Metrics.md
```

Extract the list of all metrics with their:
- FRED series IDs (or other API identifiers)
- Categories
- Update frequencies
- Current values (if populated)

### Step 3: Fetch Historical Data

For each metric with a FRED series ID, fetch historical data spanning 10+ years.

**Key FRED Series (Priority Fetch):**

| Category | Metric | FRED ID |
|----------|--------|---------|
| GDP | Real GDP | GDPC1 |
| GDP | GDP Growth Rate (QoQ) | A191RL1Q225SBEA |
| Inflation | CPI-U All Items | CPIAUCSL |
| Inflation | Core CPI | CPILFESL |
| Inflation | PCE Price Index | PCEPI |
| Employment | Unemployment Rate (U-3) | UNRATE |
| Employment | Nonfarm Payrolls | PAYEMS |
| Employment | Initial Jobless Claims | ICSA |
| Housing | Median Home Price | MSPUS |
| Housing | 30-Year Mortgage Rate | MORTGAGE30US |
| Consumer | Consumer Sentiment | UMCSENT |
| Consumer | Personal Saving Rate | PSAVERT |
| Markets | Fed Funds Rate | FEDFUNDS |
| Markets | 10-Year Treasury | DGS10 |
| Markets | 2-Year Treasury | DGS2 |
| Trade | Trade Balance | BOPGSTB |
| Fiscal | Federal Debt | GFDEBTN |

**Non-FRED Data (separate APIs):**
- Gas prices: EIA API (`PET.EMM_EPMR_PTE_NUS_DPG.W`)
- Oil prices: EIA API (`PET.RWTC.W`)
- Federal debt (daily): Treasury FiscalData API

### Step 4: Calculate Trend Statistics

For each metric, calculate:

**Timeframe Analysis:**
- **10-Year:** Compound annual growth rate (CAGR), total change, volatility
- **5-Year:** CAGR, total change, volatility, comparison to 10-year trend
- **2-Year:** CAGR, total change, recent acceleration/deceleration
- **1-Year:** YoY change, recent momentum, latest value vs. average

**Trend Direction:**
- Rising (↑), Falling (↓), Stable (→)
- Acceleration indicator (speeding up vs. slowing down)

**Example Output:**
```
Unemployment Rate (UNRATE)
├── Current: 4.1% (Nov 2024)
├── 10-Year: 5.8% → 4.1% (-1.7pp, ↓ trend)
├── 5-Year: 3.5% → 4.1% (+0.6pp, ↑ from pre-COVID low)
├── 2-Year: 3.7% → 4.1% (+0.4pp, gradual rise)
├── 1-Year: 3.9% → 4.1% (+0.2pp, slight increase)
└── Assessment: Gradually rising from 50-year lows, still historically low
```

### Step 5: Cross-Category Analysis

**Analyze interrelationships between categories:**

1. **Inflation ↔ Employment** (Phillips Curve dynamics)
   - CPI vs. Unemployment correlation
   - Wage growth vs. inflation relationship

2. **Monetary Policy ↔ Economy**
   - Fed Funds Rate impact on mortgage rates, housing
   - Yield curve (10Y-2Y spread) as recession indicator

3. **Consumer Health ↔ Economic Output**
   - Sentiment vs. retail sales correlation
   - Saving rate vs. consumer spending

4. **Housing ↔ Broader Economy**
   - Home prices vs. inflation
   - Housing starts as leading indicator

5. **Energy ↔ Inflation**
   - Oil/gas prices impact on CPI
   - Energy component of consumer budgets

6. **Fiscal ↔ Financial Markets**
   - Debt growth vs. Treasury yields
   - Deficit spending impact on GDP

### Step 6: Pattern Detection

**Identify notable patterns:**

1. **Regime Changes**
   - Pre/post COVID comparison
   - Pre/post rate hike cycle
   - Historical vs. current levels

2. **Divergences**
   - Metrics moving opposite to historical correlation
   - Unusual spreads (e.g., yield curve inversion)

3. **Extremes**
   - Metrics at historical highs/lows
   - Metrics multiple standard deviations from mean

4. **Leading Indicator Signals**
   - Jobless claims trend
   - Yield curve shape
   - Consumer sentiment direction

### Step 7: Generate Research Recommendations

Based on patterns detected, suggest:

1. **Areas requiring deeper investigation**
   - Anomalies that warrant explanation
   - Divergences from historical patterns

2. **Potential risks to monitor**
   - Leading indicators suggesting concern
   - Metrics approaching critical thresholds

3. **Opportunities for analysis**
   - Correlations that may predict future moves
   - Underexplored relationships

4. **Data gaps to fill**
   - Metrics not yet tracked that would improve analysis
   - Higher-frequency data needs

### Step 8: Compile Output Document

Generate structured markdown report:

```markdown
# US Economic State Analysis

**Generated:** [YYYY-MM-DD HH:MM]
**Data Period:** [10 years through current]
**Sources:** FRED, EIA, Treasury FiscalData, BLS, Census

---

## Executive Summary

[3-5 bullet points with the most important findings]

---

## Current Snapshot

| Category | Key Metric | Value | YoY Δ | Trend |
|----------|------------|-------|-------|-------|
| Economy | Real GDP Growth | X.X% | +X.X | ↑ |
| Inflation | CPI YoY | X.X% | -X.X | ↓ |
| Employment | Unemployment | X.X% | +X.X | → |
| ... | ... | ... | ... | ... |

---

## Detailed Trend Analysis

### 1. Economic Output & Growth
[10y/5y/2y/1y analysis for GDP, industrial production, retail sales]

### 2. Inflation & Prices
[Analysis for CPI, PCE, gas prices, oil prices]

### 3. Employment & Labor
[Analysis for unemployment, payrolls, claims, participation]

[... continue for all 10 categories]

---

## Cross-Metric Analysis

### Inflation-Employment Dynamics
[Phillips curve analysis, current relationship]

### Monetary Policy Transmission
[Fed funds → mortgages → housing → economy]

### Consumer-Economy Linkage
[Sentiment → spending → GDP relationship]

[... additional cross-category analyses]

---

## Pattern Detection

### Regime Changes
- [Pattern 1]
- [Pattern 2]

### Divergences
- [Divergence 1]
- [Divergence 2]

### Historical Extremes
- [Extreme 1]
- [Extreme 2]

---

## Research Recommendations

### High Priority
1. [Investigation area 1]
2. [Investigation area 2]

### Risks to Monitor
1. [Risk 1]
2. [Risk 2]

### Data Gaps
1. [Gap 1]
2. [Gap 2]

---

## Methodology Notes

- Trend calculations use [method]
- Seasonally adjusted data used where available
- All FRED data as of [timestamp]

---

## Sources

- Federal Reserve Economic Data (FRED)
- Energy Information Administration (EIA)
- U.S. Treasury FiscalData
- Bureau of Labor Statistics (BLS)
- U.S. Census Bureau
```

## Output Location

Save generated report to:
```
~/.claude/History/research/[YYYY-MM]/[YYYY-MM-DD]_US-Economic-State-Analysis.md
```

## Error Handling

- If FRED API fails: Note which metrics couldn't be fetched, proceed with available data
- If API key missing: Prompt user to set `FRED_API_KEY` environment variable
- If metric not found: Log missing series, continue with others

## Future Enhancements

- [ ] Add visualization generation (charts, graphs)
- [ ] Implement automated scheduling (weekly/monthly reports)
- [ ] Add comparison mode (vs. previous report)
- [ ] Include international context (compare to other economies)
- [ ] Add forecasting section using leading indicators
