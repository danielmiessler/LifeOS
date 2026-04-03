---
name: USMetrics
pack-id: danielmiessler-usmetrics-v1.0.0
version: 1.0.0
author: danielmiessler
description: 68 US economic indicators from FRED, EIA, Treasury, BLS, Census APIs with trend analysis and cross-metric correlation
type: skill
purpose-type: [data-analysis, economics, research, metrics]
platform: claude-code
dependencies: []
keywords: [economics, GDP, inflation, unemployment, FRED, EIA, Treasury, BLS, Census, metrics, trend-analysis, US-economy, indicators]
---

# USMetrics

> 68 US economic indicators from federal APIs -- trend analysis, cross-metric correlation, and structured economic overviews on demand.

---

## The Problem

Understanding the US economy requires pulling data from half a dozen federal APIs (FRED, EIA, Treasury FiscalData, BLS, Census, CDC, EPA), each with different formats, authentication, and endpoints. When you want a quick economic overview, you end up:

- **Manually fetching data** -- bouncing between FRED, EIA, Treasury, and BLS websites to assemble a picture
- **Missing context** -- seeing one metric (unemployment) without understanding its relationship to others (GDP, inflation, labor force participation)
- **No trend perspective** -- getting the current value but not the 1-year, 2-year, 5-year, or 10-year trajectory
- **Stale data** -- relying on cached or outdated numbers because refreshing is tedious

The fundamental issue: economic analysis requires current data across many categories, correlated intelligently, with multi-timeframe trend context -- and there is no simple way to get all of that at once.

---

## The Solution

USMetrics provides two workflows that handle the full pipeline from data fetching to analysis:

**UpdateData workflow:**
1. Fetches live data from FRED, EIA, and Treasury APIs for all 68 metrics
2. Updates the Substrate US-Common-Metrics dataset files
3. Produces both human-readable markdown and machine-readable CSV outputs
4. Appends to historical time series for trend tracking

**GetCurrentState workflow:**
1. Reads the current and historical data for all 68 metrics across 10 categories
2. Calculates 10-year, 5-year, 2-year, and 1-year trends
3. Analyzes cross-metric correlations and leading indicators
4. Detects anomalies, regime changes, and emerging patterns
5. Generates research recommendations
6. Outputs a comprehensive structured markdown report

The 10 categories covered: Economic Output and Growth, Inflation and Prices, Employment and Labor, Housing, Consumer and Personal Finance, Financial Markets, Trade and International, Government and Fiscal, Demographics and Social, Health and Crisis.

---

## Installation

This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using `INSTALL.md`.

**What is PAI?** See the [PAI Project Overview](https://github.com/danielmiessler/Personal_AI_Infrastructure#what-is-pai).

---

## What's Included

| Component | Path | Purpose |
|-----------|------|---------|
| Skill definition | `src/SKILL.md` | Skill routing, workflow descriptions, metric categories, API configuration |
| UpdateData workflow | `src/Workflows/UpdateData.md` | Instructions for fetching live data from federal APIs |
| GetCurrentState workflow | `src/Workflows/GetCurrentState.md` | Instructions for generating comprehensive economic analysis |
| UpdateSubstrateMetrics tool | `src/Tools/UpdateSubstrateMetrics.ts` | TypeScript tool -- fetches all 68 metrics and updates Substrate dataset files |
| FetchFredSeries tool | `src/Tools/FetchFredSeries.ts` | TypeScript tool -- fetches historical data series from the FRED API |
| GenerateAnalysis tool | `src/Tools/GenerateAnalysis.ts` | TypeScript tool -- generates analysis report from Substrate data |

**Summary:**
- **Directories:** 2 (Workflows/, Tools/)
- **Workflow files:** 2
- **Tool files:** 3
- **Dependencies:** `bun` runtime, `FRED_API_KEY`, `EIA_API_KEY` environment variables

---

## What Makes This Different

This sounds similar to checking FRED's website or running a quick GDP search. What makes this approach different?

USMetrics fetches 68 metrics across 10 categories from seven federal data sources in a single operation. It does not just give you a number -- it calculates multi-timeframe trends (10y/5y/2y/1y), correlates metrics across categories (e.g., how unemployment relates to consumer sentiment and housing starts), detects anomalies and regime changes, and produces a structured report with research recommendations. A manual FRED lookup gives you one data point. USMetrics gives you the full economic picture with context.

- Covers 68 metrics across 10 categories from 7 federal APIs
- Multi-timeframe trend analysis (1-year through 10-year)
- Cross-metric correlation and pattern detection
- Structured output format ready for AI analysis and human consumption
- Updates a persistent Substrate dataset for historical tracking

---

## Invocation Scenarios

| Trigger | What Happens |
|---------|--------------|
| "Update the US metrics" | Runs UpdateData -- fetches live data from all APIs, updates Substrate dataset |
| "Refresh economic data" | Same as above -- triggers UpdateData workflow |
| "How is the US economy doing?" | Runs GetCurrentState -- produces comprehensive analysis with trends |
| "Give me an economic overview" | Same as above -- generates full economic state report |
| "What's happening with inflation?" | Runs GetCurrentState -- focuses on Inflation and Prices category |
| "Update Substrate dataset" | Runs UpdateData -- updates the underlying data files |

The skill auto-routes based on whether you want data refresh (UpdateData) or analysis (GetCurrentState).

---

## Example Usage

### Updating Metrics Data

```
User: "Update the US metrics"

AI responds:
Running the UpdateData workflow in the USMetrics skill to fetch live data...

[Executes UpdateSubstrateMetrics.ts]

Updated 68 metrics across 10 categories:
- Economic Output & Growth: 6 metrics updated
- Inflation & Prices: 8 metrics updated
- Employment & Labor: 9 metrics updated
...

Files updated:
- US-Common-Metrics.md (human-readable)
- us-metrics-current.csv (machine-readable snapshot)
- us-metrics-historical.csv (appended time series)
```

### Getting Economic Overview

```
User: "How is the US economy doing?"

AI responds:
Running the GetCurrentState workflow in the USMetrics skill to analyze trends...

# US Economic State Analysis
Generated: 2026-03-15
Data Sources: FRED, EIA, Treasury, BLS, Census

## Executive Summary
- GDP growth at 2.3% (10y avg: 2.1%) -- slightly above trend
- CPI inflation at 2.8% (trending down from 3.4% one year ago)
- Unemployment at 4.1% (stable, within historical norms)
- Housing starts declining 12% year-over-year
- Consumer sentiment recovering from 2-year low

## Trend Analysis by Category
### Economic Output
[10y/5y/2y/1y trends with analysis]
...

## Cross-Metric Analysis
[Correlations, leading indicators, divergences]

## Pattern Detection
[Anomalies, regime changes, emerging trends]

## Research Recommendations
[Suggested areas for deeper investigation]
```

---

## Configuration

### Required: API Keys

The UpdateData workflow requires two API keys set as environment variables:

| Key | Source | Purpose |
|-----|--------|---------|
| `FRED_API_KEY` | [FRED API](https://fred.stlouisfed.org/docs/api/api_key.html) | Federal Reserve Economic Data |
| `EIA_API_KEY` | [EIA API](https://www.eia.gov/opendata/register.php) | Energy Information Administration |

### Required: Runtime

The TypeScript tools require `bun` to be installed and available in PATH.

### Data Directory

Metrics data is stored in the Substrate US-Common-Metrics dataset directory. The path is configured in the skill and tools.

---

## Customization

### Recommended Customization

Create a customization directory at `~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/USMetrics/` with a `PREFERENCES.md` file to override default behavior (e.g., focus categories, output format preferences, custom data paths).

### Optional Customization

| Customization | File | Impact |
|--------------|------|--------|
| Add or remove tracked metrics | `Tools/UpdateSubstrateMetrics.ts` | Changes which metrics are fetched and tracked |
| Change data directory path | `SKILL.md`, tools | Points to a different Substrate dataset location |
| Modify analysis format | `Workflows/GetCurrentState.md` | Changes the output structure of economic reports |
| Add new API sources | `Tools/UpdateSubstrateMetrics.ts` | Extends data coverage to additional federal APIs |

---

## Credits

- **Original concept:** Daniel Miessler -- developed as part of the [PAI](https://github.com/danielmiessler/Personal_AI_Infrastructure) system
- **Data sources:** FRED (Federal Reserve), EIA (Energy Information Administration), Treasury FiscalData, BLS (Bureau of Labor Statistics), Census Bureau, CDC, EPA

---

## Related Work

- **PAI Substrate** -- The dataset infrastructure that stores the metrics this skill fetches and analyzes
- **PAI Algorithm** -- The structured workflow system that can use economic data in research and analysis tasks

---

## Works Well With

- **PAI Core Install** -- Provides the infrastructure and data directories USMetrics operates on
- **Utilities Pack (Parser)** -- Can parse and extract additional data sources to supplement economic analysis

---

## Changelog

### 1.0.0 - 2026-03-15
- Initial release
- Two workflows: UpdateData and GetCurrentState
- Three TypeScript tools for data fetching and analysis
- 68 metrics across 10 categories from 7 federal APIs
- Multi-timeframe trend analysis (1y/2y/5y/10y)
- Cross-metric correlation and pattern detection
