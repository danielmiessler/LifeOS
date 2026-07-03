---
name: data-analysis
description: Data processing and analysis. CSV, JSON, log parsing, metrics computation, statistical analysis, outlier detection, trend identification, visualization recommendations. USE WHEN analyze data, process CSV, parse JSON, statistics, metrics, aggregate, chart, graph, trend analysis, data cleaning, ETL.
metadata:
  author: pai
  version: 1.0.0
---

# Data Analysis — Processing & Insights

## Pipeline

1. **Ingest** — Load data (CSV, JSON, logs, DB)
2. **Validate** — Schema check, type coercion, null handling
3. **Clean** — Remove duplicates, fix formats, handle outliers
4. **Transform** — Aggregate, join, normalize, feature engineer
5. **Analyze** — Statistics, trends, correlations, distributions
6. **Report** — Summary, visualizations, recommendations

## Analysis Methods

| Method | When | Output |
|--------|------|--------|
| Descriptive | "What happened?" | Summary stats, distributions |
| Diagnostic | "Why did it happen?" | Drill-down, segmentation |
| Predictive | "What will happen?" | Trends, forecasts |
| Prescriptive | "What should we do?" | Recommendations, optimization |

## Common Operations

- **Summary**: Count, sum, mean, median, mode, std, min, max
- **Distribution**: Histogram, percentiles, box plot
- **Comparison**: A/B, before/after, grouped aggregates
- **Correlation**: Pearson, Spearman, scatter plot
- **Trend**: Moving average, linear regression, seasonality
- **Outliers**: Z-score > 3, IQR > 1.5, domain-specific thresholds

## Visualization Guidance

| Data Type | Chart Type |
|-----------|------------|
| Categories | Bar, pie |
| Time series | Line, area |
| Distribution | Histogram, box |
| Correlation | Scatter, heatmap |
| Composition | Stacked bar, treemap |
| Relationship | Network graph, Sankey |
