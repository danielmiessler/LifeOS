#!/usr/bin/env bun
/**
 * GenerateAnalysis.ts
 *
 * Generates the US Economic State Analysis document
 * by fetching data and producing the structured markdown report.
 *
 * Usage:
 *   bun run GenerateAnalysis.ts [--output=path]
 *
 * Environment:
 *   FRED_API_KEY - Required for FRED data
 *   EIA_API_KEY - Required for energy data
 */

import { parseArgs } from "util";

// ============================================================================
// CONFIGURATION
// ============================================================================

const FRED_API_KEY = process.env.FRED_API_KEY;
const EIA_API_KEY = process.env.EIA_API_KEY;

// Priority series for the analysis (most impactful metrics)
const PRIORITY_SERIES = {
  economic: ["GDPC1", "A191RL1Q225SBEA", "INDPRO", "RSXFS"],
  inflation: ["CPIAUCSL", "CPILFESL", "PCEPI", "PCEPILFE"],
  employment: ["UNRATE", "PAYEMS", "ICSA", "CIVPART", "CES0500000003"],
  housing: ["MSPUS", "MORTGAGE30US", "HOUST", "CSUSHPINSA"],
  consumer: ["UMCSENT", "PSAVERT", "TOTALSL", "DRCCLACBS"],
  financial: ["FEDFUNDS", "DGS10", "DGS2", "VIXCLS"],
  trade: ["BOPGSTB", "DTWEXBGS"],
  fiscal: ["GFDEBTN", "FYFSD"],
};

const SERIES_NAMES: Record<string, string> = {
  "GDPC1": "Real GDP",
  "A191RL1Q225SBEA": "GDP Growth Rate",
  "INDPRO": "Industrial Production",
  "RSXFS": "Retail Sales",
  "CPIAUCSL": "CPI All Items",
  "CPILFESL": "Core CPI",
  "PCEPI": "PCE Price Index",
  "PCEPILFE": "Core PCE",
  "UNRATE": "Unemployment Rate",
  "PAYEMS": "Nonfarm Payrolls",
  "ICSA": "Initial Jobless Claims",
  "CIVPART": "Labor Force Participation",
  "CES0500000003": "Average Hourly Earnings",
  "MSPUS": "Median Home Price",
  "MORTGAGE30US": "30-Year Mortgage Rate",
  "HOUST": "Housing Starts",
  "CSUSHPINSA": "Case-Shiller Index",
  "UMCSENT": "Consumer Sentiment",
  "PSAVERT": "Personal Saving Rate",
  "TOTALSL": "Consumer Credit",
  "DRCCLACBS": "Credit Card Delinquency",
  "FEDFUNDS": "Fed Funds Rate",
  "DGS10": "10-Year Treasury",
  "DGS2": "2-Year Treasury",
  "VIXCLS": "VIX",
  "BOPGSTB": "Trade Balance",
  "DTWEXBGS": "USD Index",
  "GFDEBTN": "Federal Debt",
  "FYFSD": "Federal Deficit",
};

// ============================================================================
// DATA FETCHING
// ============================================================================

interface Observation {
  date: string;
  value: number;
}

interface SeriesResult {
  id: string;
  name: string;
  observations: Observation[];
  latest: Observation | null;
  trends: {
    "10y": TrendStat | null;
    "5y": TrendStat | null;
    "2y": TrendStat | null;
    "1y": TrendStat | null;
  };
}

interface TrendStat {
  start: number;
  end: number;
  change: number;
  pctChange: number;
  direction: "↑" | "↓" | "→";
}

async function fetchFredSeries(seriesId: string, years: number = 10): Promise<SeriesResult | null> {
  if (!FRED_API_KEY) {
    console.error("FRED_API_KEY not set");
    return null;
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - years);

  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&observation_start=${startDate.toISOString().split('T')[0]}&observation_end=${endDate.toISOString().split('T')[0]}`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.observations?.length) return null;

    const observations: Observation[] = data.observations
      .filter((o: any) => o.value !== ".")
      .map((o: any) => ({ date: o.date, value: parseFloat(o.value) }));

    const latest = observations[observations.length - 1] || null;

    // Calculate trends
    const trends = {
      "10y": calculateTrend(observations, 10),
      "5y": calculateTrend(observations, 5),
      "2y": calculateTrend(observations, 2),
      "1y": calculateTrend(observations, 1),
    };

    return {
      id: seriesId,
      name: SERIES_NAMES[seriesId] || seriesId,
      observations,
      latest,
      trends,
    };
  } catch (e) {
    console.error(`Error fetching ${seriesId}:`, e);
    return null;
  }
}

function calculateTrend(observations: Observation[], years: number): TrendStat | null {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - years);

  const filtered = observations.filter(o => new Date(o.date) >= cutoff);
  if (filtered.length < 2) return null;

  const start = filtered[0].value;
  const end = filtered[filtered.length - 1].value;
  const change = end - start;
  const pctChange = (change / Math.abs(start)) * 100;

  let direction: "↑" | "↓" | "→";
  if (Math.abs(pctChange) < 2) direction = "→";
  else if (pctChange > 0) direction = "↑";
  else direction = "↓";

  return { start, end, change, pctChange, direction };
}

async function fetchEIAGasPrice(): Promise<{ value: number; date: string } | null> {
  if (!EIA_API_KEY) return null;

  const url = `https://api.eia.gov/v2/petroleum/pri/gnd/data/?api_key=${EIA_API_KEY}&frequency=weekly&data[0]=value&facets[product][]=EPMR&facets[duession][]=Y&sort[0][column]=period&sort[0][direction]=desc&length=1`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    const item = data.response?.data?.[0];
    if (!item) return null;

    return { value: parseFloat(item.value), date: item.period };
  } catch (e) {
    return null;
  }
}

// ============================================================================
// ANALYSIS GENERATION
// ============================================================================

function formatValue(value: number, seriesId: string): string {
  // Format based on series type
  if (["UNRATE", "CIVPART", "PSAVERT", "MORTGAGE30US", "FEDFUNDS", "DGS10", "DGS2", "DRCCLACBS"].includes(seriesId)) {
    return `${value.toFixed(1)}%`;
  }
  if (["GDPC1", "GFDEBTN", "BOPGSTB", "TOTALSL"].includes(seriesId)) {
    return value >= 1000000 ? `$${(value / 1000000).toFixed(2)}T` : `$${(value / 1000).toFixed(1)}B`;
  }
  if (["MSPUS"].includes(seriesId)) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  if (["PAYEMS", "ICSA"].includes(seriesId)) {
    return value >= 1000 ? `${(value / 1000).toFixed(1)}M` : `${value.toFixed(0)}K`;
  }
  return value.toFixed(2);
}

function generateMarkdown(results: Map<string, SeriesResult>, gasPrice: { value: number; date: string } | null): string {
  const now = new Date().toISOString().replace('T', ' ').split('.')[0];

  let md = `# US Economic State Analysis

**Generated:** ${now}
**Data Period:** 10 years through present
**Sources:** Federal Reserve Economic Data (FRED), Energy Information Administration (EIA)

---

## Executive Summary

`;

  // Build summary based on key metrics
  const unrate = results.get("UNRATE");
  const cpi = results.get("CPIAUCSL");
  const gdp = results.get("GDPC1");
  const fedfunds = results.get("FEDFUNDS");

  if (unrate?.latest) {
    md += `- **Unemployment** at ${formatValue(unrate.latest.value, "UNRATE")} (${unrate.trends["1y"]?.direction || "→"} YoY)\n`;
  }
  if (cpi?.trends["1y"]) {
    md += `- **Inflation (CPI)** running ${cpi.trends["1y"].pctChange.toFixed(1)}% YoY\n`;
  }
  if (gdp?.trends["1y"]) {
    md += `- **Real GDP** ${gdp.trends["1y"].direction} ${Math.abs(gdp.trends["1y"].pctChange).toFixed(1)}% over past year\n`;
  }
  if (fedfunds?.latest) {
    md += `- **Fed Funds Rate** at ${formatValue(fedfunds.latest.value, "FEDFUNDS")}\n`;
  }
  if (gasPrice) {
    md += `- **Gas Prices** at $${gasPrice.value.toFixed(2)}/gallon (as of ${gasPrice.date})\n`;
  }

  md += `
---

## Current Snapshot

| Category | Metric | Current | 1Y Change | Trend |
|----------|--------|---------|-----------|-------|
`;

  // Snapshot table
  const categories = [
    { name: "Economy", ids: ["GDPC1", "A191RL1Q225SBEA"] },
    { name: "Inflation", ids: ["CPIAUCSL", "PCEPILFE"] },
    { name: "Employment", ids: ["UNRATE", "PAYEMS"] },
    { name: "Housing", ids: ["MSPUS", "MORTGAGE30US"] },
    { name: "Consumer", ids: ["UMCSENT", "PSAVERT"] },
    { name: "Markets", ids: ["FEDFUNDS", "DGS10"] },
  ];

  for (const cat of categories) {
    for (const id of cat.ids) {
      const r = results.get(id);
      if (r?.latest && r.trends["1y"]) {
        const changeStr = r.trends["1y"].pctChange >= 0
          ? `+${r.trends["1y"].pctChange.toFixed(1)}%`
          : `${r.trends["1y"].pctChange.toFixed(1)}%`;
        md += `| ${cat.name} | ${r.name} | ${formatValue(r.latest.value, id)} | ${changeStr} | ${r.trends["1y"].direction} |\n`;
      }
    }
  }

  md += `
---

## Detailed Trend Analysis

`;

  // Detailed analysis by category
  const categoryDetails = [
    { title: "Economic Output & Growth", ids: PRIORITY_SERIES.economic },
    { title: "Inflation & Prices", ids: PRIORITY_SERIES.inflation },
    { title: "Employment & Labor", ids: PRIORITY_SERIES.employment },
    { title: "Housing", ids: PRIORITY_SERIES.housing },
    { title: "Consumer & Personal Finance", ids: PRIORITY_SERIES.consumer },
    { title: "Financial Markets", ids: PRIORITY_SERIES.financial },
    { title: "Trade & International", ids: PRIORITY_SERIES.trade },
    { title: "Government & Fiscal", ids: PRIORITY_SERIES.fiscal },
  ];

  for (const cat of categoryDetails) {
    md += `### ${cat.title}\n\n`;
    md += `| Metric | Current | 10Y | 5Y | 2Y | 1Y |\n`;
    md += `|--------|---------|-----|----|----|----|\n`;

    for (const id of cat.ids) {
      const r = results.get(id);
      if (r?.latest) {
        const t10 = r.trends["10y"] ? `${r.trends["10y"].pctChange >= 0 ? "+" : ""}${r.trends["10y"].pctChange.toFixed(1)}%` : "—";
        const t5 = r.trends["5y"] ? `${r.trends["5y"].pctChange >= 0 ? "+" : ""}${r.trends["5y"].pctChange.toFixed(1)}%` : "—";
        const t2 = r.trends["2y"] ? `${r.trends["2y"].pctChange >= 0 ? "+" : ""}${r.trends["2y"].pctChange.toFixed(1)}%` : "—";
        const t1 = r.trends["1y"] ? `${r.trends["1y"].pctChange >= 0 ? "+" : ""}${r.trends["1y"].pctChange.toFixed(1)}%` : "—";
        md += `| ${r.name} | ${formatValue(r.latest.value, id)} | ${t10} | ${t5} | ${t2} | ${t1} |\n`;
      }
    }
    md += `\n`;
  }

  md += `---

## Cross-Metric Analysis

### Inflation-Employment Dynamics

`;

  if (unrate?.latest && cpi?.trends["1y"]) {
    md += `Current unemployment (${formatValue(unrate.latest.value, "UNRATE")}) with CPI change of ${cpi.trends["1y"].pctChange.toFixed(1)}% YoY suggests `;
    if (unrate.latest.value < 4.5 && cpi.trends["1y"].pctChange > 3) {
      md += `a tight labor market with persistent inflationary pressure.\n`;
    } else if (unrate.latest.value < 4.5 && cpi.trends["1y"].pctChange < 3) {
      md += `the economy is approaching a "soft landing" scenario.\n`;
    } else {
      md += `moderate labor market conditions.\n`;
    }
  }

  md += `
### Yield Curve Status

`;

  const dgs10 = results.get("DGS10");
  const dgs2 = results.get("DGS2");
  if (dgs10?.latest && dgs2?.latest) {
    const spread = dgs10.latest.value - dgs2.latest.value;
    md += `- 10Y Treasury: ${formatValue(dgs10.latest.value, "DGS10")}\n`;
    md += `- 2Y Treasury: ${formatValue(dgs2.latest.value, "DGS2")}\n`;
    md += `- Spread: ${spread.toFixed(2)}pp (${spread < 0 ? "INVERTED - recessionary signal" : "Normal"})\n`;
  }

  md += `
### Housing Affordability

`;

  const homePrice = results.get("MSPUS");
  const mortgage = results.get("MORTGAGE30US");
  if (homePrice?.latest && mortgage?.latest) {
    md += `With median home price at ${formatValue(homePrice.latest.value, "MSPUS")} and mortgage rates at ${formatValue(mortgage.latest.value, "MORTGAGE30US")}, `;
    if (homePrice.latest.value > 400000 && mortgage.latest.value > 6) {
      md += `housing affordability remains severely stressed.\n`;
    } else {
      md += `housing affordability is challenging but stabilizing.\n`;
    }
  }

  md += `
---

## Pattern Detection

### Historical Extremes

`;

  // Check for extremes
  const extremes: string[] = [];
  for (const [id, r] of results) {
    if (r.trends["10y"]) {
      if (Math.abs(r.trends["10y"].pctChange) > 50) {
        extremes.push(`- **${r.name}**: ${r.trends["10y"].pctChange > 0 ? "+" : ""}${r.trends["10y"].pctChange.toFixed(0)}% over 10 years (significant move)`);
      }
    }
  }

  if (extremes.length > 0) {
    md += extremes.join("\n") + "\n";
  } else {
    md += "No extreme outliers detected in current data.\n";
  }

  md += `
### Recent Momentum Shifts

`;

  // Look for acceleration/deceleration
  const shifts: string[] = [];
  for (const [id, r] of results) {
    if (r.trends["5y"] && r.trends["1y"]) {
      const fiveYrAnnual = r.trends["5y"].pctChange / 5;
      const oneYr = r.trends["1y"].pctChange;
      if (Math.abs(oneYr) > Math.abs(fiveYrAnnual) * 2 && Math.abs(oneYr) > 5) {
        shifts.push(`- **${r.name}**: Accelerating (1Y: ${oneYr.toFixed(1)}% vs 5Y avg: ${fiveYrAnnual.toFixed(1)}%/yr)`);
      } else if (Math.abs(oneYr) < Math.abs(fiveYrAnnual) / 2 && Math.abs(fiveYrAnnual) > 5) {
        shifts.push(`- **${r.name}**: Decelerating (1Y: ${oneYr.toFixed(1)}% vs 5Y avg: ${fiveYrAnnual.toFixed(1)}%/yr)`);
      }
    }
  }

  if (shifts.length > 0) {
    md += shifts.join("\n") + "\n";
  } else {
    md += "No significant momentum shifts detected.\n";
  }

  md += `
---

## Research Recommendations

### High Priority Investigations

1. **Labor Market Dynamics**: Examine the relationship between job openings, quit rate, and wage growth
2. **Inflation Persistence**: Analyze components of CPI to identify sticky inflation drivers
3. **Housing Market**: Investigate regional variations in home prices vs. mortgage rate sensitivity

### Risks to Monitor

1. **Credit Conditions**: Watch credit card delinquency and consumer credit growth rates
2. **Yield Curve**: Monitor 10Y-2Y spread for recession signals
3. **Consumer Sentiment**: Track sentiment vs. actual spending divergence

### Data Gaps

1. Add regional breakdowns for key metrics
2. Include leading economic indicators (LEI)
3. Add wage growth by sector data

---

## Sources

- **FRED (Federal Reserve Economic Data)**: Primary source for most indicators
- **EIA (Energy Information Administration)**: Gas and oil prices
- **Treasury FiscalData**: Federal debt and deficit data
- **BLS (Bureau of Labor Statistics)**: Employment statistics
- **Census Bureau**: Housing data

---

*Analysis generated by US-Metrics skill using Substrate US-Common-Metrics dataset*
`;

  return md;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      output: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(`
GenerateAnalysis.ts - Generate US Economic State Analysis

Usage:
  bun run GenerateAnalysis.ts [--output=path]

Options:
  --output=PATH  Save to file instead of stdout
  -h, --help     Show this help

Environment:
  FRED_API_KEY   Required for FRED data
  EIA_API_KEY    Optional for gas prices
`);
    process.exit(0);
  }

  console.error("Fetching data from FRED API...");

  const results = new Map<string, SeriesResult>();

  // Fetch all priority series
  const allSeries = Object.values(PRIORITY_SERIES).flat();
  for (const id of allSeries) {
    console.error(`  Fetching ${id}...`);
    const result = await fetchFredSeries(id, 10);
    if (result) {
      results.set(id, result);
    }
    // Small delay to be nice to the API
    await new Promise(r => setTimeout(r, 100));
  }

  console.error("Fetching gas prices from EIA...");
  const gasPrice = await fetchEIAGasPrice();

  console.error("Generating analysis...");
  const markdown = generateMarkdown(results, gasPrice);

  if (values.output) {
    await Bun.write(values.output, markdown);
    console.error(`Analysis saved to ${values.output}`);
  } else {
    console.log(markdown);
  }
}

main();
