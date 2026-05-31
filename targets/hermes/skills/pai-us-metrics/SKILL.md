---
name: pai-us-metrics
description: "Access 68 US economic indicators via FRED, EIA, Treasury, and BLS APIs. Trend analysis, correlation between indicators, and data visualization support."
version: 5.0.0
author: PAI v5.0 → Hermes Port
use_when: "You need US economic data — GDP, unemployment, inflation (CPI/PCE), interest rates, energy prices, treasury yields, or any of 68 tracked indicators — with trend analysis and cross-indicator correlation."
not_for: "Non-US economic data; real-time stock prices (use financial API); forecasting beyond simple trend projection."
tags: [economics, indicators, FRED, BLS, EIA, treasury, data, analysis]
---

# pai-us-metrics: US Economic Indicators

## Workflow Routing

| Trigger | Route |
|---------|-------|
| User asks "what's current GDP/inflation/unemployment" | Identify indicator → fetch latest → report value + trend |
| User wants a specific indicator series | Fetch series by FRED ID → return data + metadata |
| User wants trend analysis | Fetch historical data → compute trends (MoM, YoY, MA) → report |
| User wants correlation between indicators | Fetch both series → normalize dates → compute correlation → report |
| User wants sector-specific data | Identify sector → fetch relevant EIA/Treasury data → report |
| User wants a dashboard | Fetch multiple indicators → structured report with trends |

## Available Indicators (68 Total)

### Employment (BLS)
1. Unemployment Rate (UNRATE)
2. Nonfarm Payrolls (PAYEMS)
3. Labor Force Participation Rate (CIVPART)
4. Average Hourly Earnings (CES0500000003)
5. Initial Jobless Claims (ICSA)
6. Continuing Claims (CCSA)
7. Job Openings (JTSJOL)
8. Quits Rate (JTSQUR)
9. Hires Rate (JTSHIR)
10. Layoffs & Discharges (JTSLDL)

### Inflation & Prices (BLS/FRED)
11. CPI All Items (CPIAUCSL)
12. CPI Core (CPILFESL)
13. PCE Price Index (PCEPI)
14. Core PCE (PCEPILFE)
15. PPI Final Demand (PPIACO)
16. CPI Energy (CPIENGSL)
17. CPI Food (CPIFABSL)
18. CPI Shelter (CUSR0000SAH1)
19. Median CPI (MEDCPI)
20. Trimmed Mean PCE (PCETRIM)

### GDP & Output (BEA)
21. Real GDP (GDPC1)
22. GDP Growth Rate (A191RL1Q225SBEA)
23. Real Personal Consumption (PCECC96)
24. Real Business Investment (BUSLOANS)
25. Industrial Production (INDPRO)
26. Capacity Utilization (TCU)
27. Retail Sales (RSXFS)
28. Durable Goods Orders (DGORDER)
29. Housing Starts (HOUST)
30. Existing Home Sales (EXHOSLUSM495S)
31. New Home Sales (HSN1F)

### Federal Reserve / Monetary
32. Fed Funds Rate (FEDFUNDS)
33. Discount Rate (DISCONT)
34. M2 Money Supply (M2SL)
35. M1 Money Supply (M1SL)
36. Commercial Bank Reserves (TOTRESNS)
37. Consumer Credit (TOTALSL)
38. Fed Balance Sheet (WALCL)

### Treasury
39. 3-Month Yield (DGS3MO)
40. 2-Year Yield (DGS2)
41. 5-Year Yield (DGS5)
42. 10-Year Yield (DGS10)
43. 30-Year Yield (DGS30)
44. 10Y-2Y Spread (T10Y2Y)
45. 10Y-3M Spread (T10Y3M)
46. TIPS 5-Year (DFII5)
47. TIPS 10-Year (DFII10)
48. TIPS Breakeven 5Y (T5YIE)
49. TIPS Breakeven 10Y (T10YIE)

### Energy (EIA)
50. Crude Oil WTI (EIA: PET.RWTC.D)
51. Brent Crude (EIA: PET.RBRTE.D)
52. Natural Gas (EIA: NG.RNGWHHD.D)
53. Retail Gasoline (EIA: PET.EMD_EPD2D_PTE_NUS_DPG.W)
54. Diesel (EIA: PET.EMD_EPD2DXL_PTE_NUS_DPG.W)
55. Electricity Residential Price (EIA: ELEC.PRICE.US-RES.A)
56. Crude Oil Production (EIA: PET.MCRFPUS1.M)
57. Natural Gas Storage (EIA: NG.NW2_EPG0_SWO_R48_BCF.W)
58. Crude Oil Imports (EIA: PET.MCRIMUS1.M)

### Consumer & Sentiment
59. Consumer Sentiment (UMCSENT)
60. Consumer Confidence (CONF)
61. Personal Savings Rate (PSAVERT)
62. Real Disposable Income (DPIC96)
63. Debt-to-Income Ratio (TDSP)
64. Household Net Worth (TNWBSHNO)

### Other
65. S&P 500 (SP500)
66. VIX (VIXCLS)
67. US Dollar Index (DTWEXBGS)
68. Leading Economic Index (LEI)

## Step-by-Step Procedures

### 1. Fetch an Indicator
```
1. User specifies indicator (name, code, or description)
2. Resolve to FRED series ID:
   a. If exact ID provided → use directly
   b. If name → fuzzy match against indicator list
   c. If description → semantic match → confirm with user
3. Build API request:
   - FRED: https://api.stlouisfed.org/fred/series/observations
   - Parameters: series_id, api_key, file_type=json, observation_start, observation_end
   - Sort order: desc (most recent first)
4. web_extract(url=api_url) or terminal( curl ... )
5. Parse JSON response
6. Return: series name, latest value, date, units, frequency
```

### 2. Trend Analysis
```
1. Fetch historical data (default: 5 years, configurable)
2. Compute trends:
   a. Month-over-Month (MoM) change
   b. Quarter-over-Quarter (QoQ) change
   c. Year-over-Year (YoY) change
   d. Moving averages (3-month, 12-month)
   e. Linear trend direction (rising, falling, flat)
   f. Volatility (standard deviation of changes)
3. Detect inflection points (local maxima/minima)
4. Report trend summary with key datapoints
```

### 3. Correlation Analysis
```
1. User selects two or more indicators
2. Fetch all series on same frequency (monthly or quarterly)
3. Align date ranges (intersection of available dates)
4. Compute:
   a. Pearson correlation coefficient
   b. Spearman rank correlation
   c. Lagged correlation (if one leads the other)
5. Report correlation matrix
6. Highlight strong correlations (>0.7 or <-0.7)
7. Note: correlation != causation
```

### 4. Cross-Sector Dashboard
```
1. Fetch one indicator from each major sector:
   - Employment, Inflation, GDP, Monetary, Treasury, Energy, Consumer
2. Format as dashboard:
   ┌──────────────────────────────────────┐
   │ Indicator             Latest   Trend │
   │ Unemployment         3.7%      ↓     │
   │ CPI (YoY)            3.2%      ↓     │
   │ GDP Growth           2.8%      →     │
   │ Fed Funds            5.50%     →     │
   │ 10Y Yield            4.25%     ↑     │
   │ WTI Crude           $78.50     ↑     │
   │ Consumer Sentiment   72.4      ↑     │
   └──────────────────────────────────────┘
3. Add 1-2 sentence summary of overall economic picture
```

### 5. API Key Management
```
1. Check for API keys in environment/skill config:
   - FRED_API_KEY
   - BLS_API_KEY (optional, FRED also has BLS data)
   - EIA_API_KEY
2. If keys missing, use public endpoints where available
3. Inform user of any limitations from missing keys
```

## Gotchas

- API keys are required for some endpoints; FRED key is free to obtain
- FRED API rate limit: 120 requests per minute (generous)
- EIA API requires registration; free tier available
- BLS API limited to 25 years of data per request
- Treasury data is public, no key needed (https://home.treasury.gov/data)
- Series IDs may change; verify against current FRED catalog
- Some indicators update on different schedules (daily/weekly/monthly/quarterly)
- Revision lag: initial data releases are often revised later
- Correlation does not imply causation — always flag this
- Use seasonally adjusted (SA) series where available
- Real-time vs. nominal: prefer real for GDP, nominal for CPI

## Execution Log Pattern

```
[PAI-US-METRICS] Indicator: Unemployment Rate (UNRATE)
[FETCH] FRED API → latest value: 3.7% (2026-04-01)
[TREND] YoY: -0.3pp | MoM: +0.1pp | Direction: ↓ (falling)
[DASHBOARD] Built 7-indicator cross-sector view
[SUMMARY] Labor market remains tight; inflation moderating; growth stable
[COMPLETE] Metrics fetched in 1.8s
```
