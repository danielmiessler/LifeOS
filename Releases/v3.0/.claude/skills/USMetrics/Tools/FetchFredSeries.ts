#!/usr/bin/env bun
/**
 * fetch-fred-series.ts
 *
 * Fetches historical data from FRED (Federal Reserve Economic Data) API
 * for use in US Metrics analysis.
 *
 * Usage:
 *   bun run fetch-fred-series.ts <series_id> [--years=10]
 *   bun run fetch-fred-series.ts UNRATE --years=10
 *   bun run fetch-fred-series.ts --all --years=10
 *
 * Environment:
 *   FRED_API_KEY - Required API key from https://fred.stlouisfed.org/docs/api/api_key.html
 */

import { parseArgs } from "util";

// Core economic series for US-Common-Metrics
const CORE_SERIES: Record<string, { name: string; category: string; unit: string }> = {
  // Economic Output & Growth
  "GDPC1": { name: "Real GDP", category: "Economic Output", unit: "Billions of Chained 2017 Dollars" },
  "A191RL1Q225SBEA": { name: "Real GDP Growth Rate", category: "Economic Output", unit: "Percent Change" },
  "INDPRO": { name: "Industrial Production Index", category: "Economic Output", unit: "Index 2017=100" },
  "RSXFS": { name: "Retail Sales", category: "Economic Output", unit: "Millions of Dollars" },

  // Inflation & Prices
  "CPIAUCSL": { name: "CPI-U All Items", category: "Inflation", unit: "Index 1982-84=100" },
  "CPILFESL": { name: "Core CPI (ex Food/Energy)", category: "Inflation", unit: "Index 1982-84=100" },
  "PCEPI": { name: "PCE Price Index", category: "Inflation", unit: "Index 2017=100" },
  "PCEPILFE": { name: "Core PCE", category: "Inflation", unit: "Index 2017=100" },
  "DCOILWTICO": { name: "WTI Crude Oil", category: "Inflation", unit: "Dollars per Barrel" },

  // Employment & Labor
  "UNRATE": { name: "Unemployment Rate (U-3)", category: "Employment", unit: "Percent" },
  "U6RATE": { name: "Underemployment Rate (U-6)", category: "Employment", unit: "Percent" },
  "PAYEMS": { name: "Nonfarm Payrolls", category: "Employment", unit: "Thousands of Persons" },
  "ICSA": { name: "Initial Jobless Claims", category: "Employment", unit: "Number" },
  "CCSA": { name: "Continuing Claims", category: "Employment", unit: "Number" },
  "JTSJOL": { name: "Job Openings", category: "Employment", unit: "Level in Thousands" },
  "JTSQUR": { name: "Quit Rate", category: "Employment", unit: "Percent" },
  "CIVPART": { name: "Labor Force Participation", category: "Employment", unit: "Percent" },
  "CES0500000003": { name: "Average Hourly Earnings", category: "Employment", unit: "Dollars per Hour" },

  // Housing
  "MSPUS": { name: "Median Sales Price of Houses", category: "Housing", unit: "Dollars" },
  "EXHOSLUSM495S": { name: "Existing Home Sales", category: "Housing", unit: "Number of Units" },
  "HSN1F": { name: "New Home Sales", category: "Housing", unit: "Thousands" },
  "HOUST": { name: "Housing Starts", category: "Housing", unit: "Thousands of Units" },
  "PERMIT": { name: "Building Permits", category: "Housing", unit: "Thousands of Units" },
  "RHORUSQ156N": { name: "Homeownership Rate", category: "Housing", unit: "Percent" },
  "MORTGAGE30US": { name: "30-Year Mortgage Rate", category: "Housing", unit: "Percent" },
  "CSUSHPINSA": { name: "Case-Shiller Home Price Index", category: "Housing", unit: "Index Jan 2000=100" },

  // Consumer & Personal Finance
  "UMCSENT": { name: "Consumer Sentiment (UMich)", category: "Consumer", unit: "Index 1966:Q1=100" },
  "PI": { name: "Personal Income", category: "Consumer", unit: "Billions of Dollars" },
  "DSPI": { name: "Disposable Personal Income", category: "Consumer", unit: "Billions of Dollars" },
  "PSAVERT": { name: "Personal Saving Rate", category: "Consumer", unit: "Percent" },
  "TOTALSL": { name: "Consumer Credit Outstanding", category: "Consumer", unit: "Billions of Dollars" },
  "DRCCLACBS": { name: "Credit Card Delinquency Rate", category: "Consumer", unit: "Percent" },
  "TDSP": { name: "Debt Service Ratio", category: "Consumer", unit: "Percent" },

  // Financial Markets
  "DGS10": { name: "10-Year Treasury Yield", category: "Financial", unit: "Percent" },
  "DGS2": { name: "2-Year Treasury Yield", category: "Financial", unit: "Percent" },
  "FEDFUNDS": { name: "Fed Funds Rate", category: "Financial", unit: "Percent" },
  "VIXCLS": { name: "VIX Volatility Index", category: "Financial", unit: "Index" },
  "STLFSI4": { name: "Financial Stress Index", category: "Financial", unit: "Index" },

  // Trade & International
  "BOPGSTB": { name: "Trade Balance", category: "Trade", unit: "Millions of Dollars" },
  "BOPGEXP": { name: "Exports", category: "Trade", unit: "Millions of Dollars" },
  "BOPGIMP": { name: "Imports", category: "Trade", unit: "Millions of Dollars" },
  "DTWEXBGS": { name: "Trade Weighted U.S. Dollar Index", category: "Trade", unit: "Index Jan 2006=100" },

  // Government & Fiscal
  "GFDEBTN": { name: "Federal Debt Total", category: "Fiscal", unit: "Millions of Dollars" },
  "FYFSD": { name: "Federal Surplus/Deficit", category: "Fiscal", unit: "Millions of Dollars" },
  "FGEXPND": { name: "Federal Spending", category: "Fiscal", unit: "Millions of Dollars" },
  "FGRECPT": { name: "Federal Receipts", category: "Fiscal", unit: "Millions of Dollars" },

  // Demographics (Annual)
  "POPTHM": { name: "U.S. Population", category: "Demographics", unit: "Thousands" },
  "SIPOVGINIUSA": { name: "GINI Index", category: "Demographics", unit: "Index" },
};

interface FredObservation {
  date: string;
  value: string;
}

interface FredResponse {
  observations: FredObservation[];
  seriess?: Array<{ title: string; units: string; frequency: string }>;
}

interface SeriesData {
  series_id: string;
  name: string;
  category: string;
  unit: string;
  observations: Array<{ date: string; value: number | null }>;
  latest: { date: string; value: number | null } | null;
  stats: {
    min: number;
    max: number;
    mean: number;
    count: number;
  } | null;
}

async function fetchFredSeries(
  seriesId: string,
  years: number = 10
): Promise<SeriesData | null> {
  const apiKey = process.env.FRED_API_KEY;

  if (!apiKey) {
    console.error("Error: FRED_API_KEY environment variable not set");
    console.error("Get your free API key at: https://fred.stlouisfed.org/docs/api/api_key.html");
    process.exit(1);
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - years);

  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&observation_start=${startStr}&observation_end=${endStr}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Error fetching ${seriesId}: HTTP ${response.status}`);
      return null;
    }

    const data: FredResponse = await response.json();

    if (!data.observations || data.observations.length === 0) {
      console.error(`No data found for ${seriesId}`);
      return null;
    }

    const seriesInfo = CORE_SERIES[seriesId] || {
      name: seriesId,
      category: "Unknown",
      unit: "Unknown"
    };

    const observations = data.observations
      .map(obs => ({
        date: obs.date,
        value: obs.value === "." ? null : parseFloat(obs.value)
      }))
      .filter(obs => obs.value !== null);

    const values = observations.map(o => o.value).filter((v): v is number => v !== null);

    const stats = values.length > 0 ? {
      min: Math.min(...values),
      max: Math.max(...values),
      mean: values.reduce((a, b) => a + b, 0) / values.length,
      count: values.length
    } : null;

    const latest = observations.length > 0
      ? observations[observations.length - 1]
      : null;

    return {
      series_id: seriesId,
      name: seriesInfo.name,
      category: seriesInfo.category,
      unit: seriesInfo.unit,
      observations,
      latest,
      stats
    };

  } catch (error) {
    console.error(`Error fetching ${seriesId}:`, error);
    return null;
  }
}

function calculateTrendStats(data: SeriesData, periodYears: number): {
  startValue: number | null;
  endValue: number | null;
  absoluteChange: number | null;
  percentChange: number | null;
  cagr: number | null;
  direction: "↑" | "↓" | "→";
} | null {
  if (!data.observations || data.observations.length === 0) return null;

  const cutoffDate = new Date();
  cutoffDate.setFullYear(cutoffDate.getFullYear() - periodYears);

  const periodData = data.observations.filter(
    obs => new Date(obs.date) >= cutoffDate && obs.value !== null
  );

  if (periodData.length < 2) return null;

  const startValue = periodData[0].value;
  const endValue = periodData[periodData.length - 1].value;

  if (startValue === null || endValue === null) return null;

  const absoluteChange = endValue - startValue;
  const percentChange = ((endValue - startValue) / Math.abs(startValue)) * 100;

  // CAGR calculation
  const years = periodYears;
  const cagr = startValue !== 0
    ? (Math.pow(endValue / startValue, 1 / years) - 1) * 100
    : null;

  // Direction determination
  let direction: "↑" | "↓" | "→";
  if (Math.abs(percentChange) < 2) {
    direction = "→";
  } else if (percentChange > 0) {
    direction = "↑";
  } else {
    direction = "↓";
  }

  return {
    startValue,
    endValue,
    absoluteChange,
    percentChange,
    cagr,
    direction
  };
}

async function main() {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      years: { type: "string", default: "10" },
      all: { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      trends: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(`
fetch-fred-series.ts - Fetch economic data from FRED API

Usage:
  bun run fetch-fred-series.ts <series_id> [options]
  bun run fetch-fred-series.ts --all [options]

Options:
  --years=N     Number of years of history (default: 10)
  --all         Fetch all core series
  --json        Output as JSON
  --trends      Include trend calculations
  -h, --help    Show this help

Examples:
  bun run fetch-fred-series.ts UNRATE
  bun run fetch-fred-series.ts GDPC1 --years=20 --trends
  bun run fetch-fred-series.ts --all --json > data.json

Environment:
  FRED_API_KEY  Your FRED API key (required)
`);
    process.exit(0);
  }

  const years = parseInt(values.years || "10");
  const seriesIds = values.all ? Object.keys(CORE_SERIES) : positionals;

  if (seriesIds.length === 0) {
    console.error("Error: Specify a series ID or use --all");
    console.error("Run with --help for usage information");
    process.exit(1);
  }

  const results: SeriesData[] = [];

  for (const seriesId of seriesIds) {
    console.error(`Fetching ${seriesId}...`);
    const data = await fetchFredSeries(seriesId, years);

    if (data) {
      if (values.trends) {
        const trends = {
          "10y": calculateTrendStats(data, 10),
          "5y": calculateTrendStats(data, 5),
          "2y": calculateTrendStats(data, 2),
          "1y": calculateTrendStats(data, 1),
        };
        (data as any).trends = trends;
      }
      results.push(data);
    }
  }

  if (values.json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    for (const result of results) {
      console.log(`\n${"=".repeat(60)}`);
      console.log(`${result.name} (${result.series_id})`);
      console.log(`Category: ${result.category}`);
      console.log(`Unit: ${result.unit}`);

      if (result.latest) {
        console.log(`Latest: ${result.latest.value} (${result.latest.date})`);
      }

      if (result.stats) {
        console.log(`Range: ${result.stats.min.toFixed(2)} - ${result.stats.max.toFixed(2)}`);
        console.log(`Mean: ${result.stats.mean.toFixed(2)}`);
        console.log(`Observations: ${result.stats.count}`);
      }

      if ((result as any).trends) {
        console.log(`\nTrend Analysis:`);
        const trends = (result as any).trends;
        for (const [period, trend] of Object.entries(trends)) {
          if (trend) {
            const t = trend as any;
            console.log(`  ${period}: ${t.startValue?.toFixed(2)} → ${t.endValue?.toFixed(2)} (${t.percentChange?.toFixed(1)}% ${t.direction})`);
          }
        }
      }
    }
  }
}

main();
