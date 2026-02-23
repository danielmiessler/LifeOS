#!/usr/bin/env bun
/**
 * update-substrate-metrics.ts
 *
 * Fetches current data from all sources (FRED, EIA, Treasury) and updates
 * the Substrate US-Common-Metrics dataset files.
 *
 * Usage:
 *   bun run update-substrate-metrics.ts [--dry-run]
 *
 * Environment:
 *   FRED_API_KEY - Required for most metrics
 *   EIA_API_KEY - Required for gas prices
 *
 * Output files:
 *   - ${PROJECTS_DIR}/your-data-project/Data/US-Common-Metrics/US-Common-Metrics.md (updated values)
 *   - ${PROJECTS_DIR}/your-data-project/Data/US-Common-Metrics/us-metrics-current.csv (current snapshot)
 *   - ${PROJECTS_DIR}/your-data-project/Data/US-Common-Metrics/us-metrics-historical.csv (appended)
 */

import { parseArgs } from "util";
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "fs";
import { join } from "path";

// ============================================================================
// CONFIGURATION
// ============================================================================

const SUBSTRATE_PATH = join(process.env.PROJECTS_DIR || join(process.env.HOME || "", "Projects"), "your-data-project/Data/US-Common-Metrics");
const FRED_API_KEY = process.env.FRED_API_KEY;
const EIA_API_KEY = process.env.EIA_API_KEY;

// All metrics with their configuration
interface MetricConfig {
  name: string;
  category: string;
  fredId?: string;
  source: string;
  format: "number" | "percent" | "currency" | "billions" | "trillions" | "thousands" | "millions" | "index";
  decimals?: number;
  special?: "eia-gas" | "eia-oil" | "treasury-debt" | "yoy-calc";
  baseId?: string; // For calculated metrics (YoY change)
}

const METRICS: Record<string, MetricConfig> = {
  // Economic Output & Growth
  "GDPC1": { name: "Real GDP", category: "Economic Output", fredId: "GDPC1", source: "BEA/FRED", format: "billions", decimals: 2 },
  "GDP": { name: "Nominal GDP", category: "Economic Output", fredId: "GDP", source: "BEA/FRED", format: "billions", decimals: 2 },
  "A191RL1Q225SBEA": { name: "GDP Growth Rate (QoQ)", category: "Economic Output", fredId: "A191RL1Q225SBEA", source: "BEA/FRED", format: "percent", decimals: 1 },
  "A191RO1Q156NBEA": { name: "GDP Growth Rate (YoY)", category: "Economic Output", fredId: "A191RO1Q156NBEA", source: "BEA/FRED", format: "percent", decimals: 1 },
  "INDPRO": { name: "Industrial Production", category: "Economic Output", fredId: "INDPRO", source: "Fed/FRED", format: "index", decimals: 2 },
  "TCU": { name: "Capacity Utilization", category: "Economic Output", fredId: "TCU", source: "Fed/FRED", format: "percent", decimals: 1 },
  "DGORDER": { name: "Durable Goods Orders", category: "Economic Output", fredId: "DGORDER", source: "Census/FRED", format: "millions", decimals: 0 },
  "RSAFS": { name: "Retail Sales", category: "Economic Output", fredId: "RSAFS", source: "Census/FRED", format: "billions", decimals: 1 },

  // Inflation & Prices
  "CPIAUCSL": { name: "CPI-U All Items", category: "Inflation", fredId: "CPIAUCSL", source: "BLS/FRED", format: "index", decimals: 3 },
  "CPILFESL": { name: "Core CPI", category: "Inflation", fredId: "CPILFESL", source: "BLS/FRED", format: "index", decimals: 3 },
  "PCEPI": { name: "PCE Price Index", category: "Inflation", fredId: "PCEPI", source: "BEA/FRED", format: "index", decimals: 3 },
  "PCEPILFE": { name: "Core PCE", category: "Inflation", fredId: "PCEPILFE", source: "BEA/FRED", format: "index", decimals: 3 },
  "PPIACO": { name: "Producer Price Index", category: "Inflation", fredId: "PPIACO", source: "BLS/FRED", format: "index", decimals: 2 },
  "DCOILWTICO": { name: "WTI Crude Oil", category: "Inflation", fredId: "DCOILWTICO", source: "EIA/FRED", format: "currency", decimals: 2 },
  "GAS_PRICE": { name: "Gas Price (Regular)", category: "Inflation", source: "EIA", format: "currency", decimals: 3, special: "eia-gas" },

  // Employment & Labor
  "UNRATE": { name: "Unemployment Rate (U-3)", category: "Employment", fredId: "UNRATE", source: "BLS/FRED", format: "percent", decimals: 1 },
  "U6RATE": { name: "Underemployment Rate (U-6)", category: "Employment", fredId: "U6RATE", source: "BLS/FRED", format: "percent", decimals: 1 },
  "PAYEMS": { name: "Nonfarm Payrolls", category: "Employment", fredId: "PAYEMS", source: "BLS/FRED", format: "thousands", decimals: 0 },
  "ICSA": { name: "Initial Jobless Claims", category: "Employment", fredId: "ICSA", source: "DOL/FRED", format: "thousands", decimals: 0 },
  "CCSA": { name: "Continuing Claims", category: "Employment", fredId: "CCSA", source: "DOL/FRED", format: "thousands", decimals: 0 },
  "JTSJOL": { name: "Job Openings (JOLTS)", category: "Employment", fredId: "JTSJOL", source: "BLS/FRED", format: "thousands", decimals: 0 },
  "JTSQUR": { name: "Quit Rate", category: "Employment", fredId: "JTSQUR", source: "BLS/FRED", format: "percent", decimals: 1 },
  "JTSHIR": { name: "Hire Rate", category: "Employment", fredId: "JTSHIR", source: "BLS/FRED", format: "percent", decimals: 1 },
  "CIVPART": { name: "Labor Force Participation", category: "Employment", fredId: "CIVPART", source: "BLS/FRED", format: "percent", decimals: 1 },
  "EMRATIO": { name: "Employment-Population Ratio", category: "Employment", fredId: "EMRATIO", source: "BLS/FRED", format: "percent", decimals: 1 },
  "CES0500000003": { name: "Average Hourly Earnings", category: "Employment", fredId: "CES0500000003", source: "BLS/FRED", format: "currency", decimals: 2 },
  "AWHAETP": { name: "Average Weekly Hours", category: "Employment", fredId: "AWHAETP", source: "BLS/FRED", format: "number", decimals: 1 },

  // Housing
  "MSPUS": { name: "Median Home Sales Price", category: "Housing", fredId: "MSPUS", source: "Census/FRED", format: "currency", decimals: 0 },
  "CSUSHPINSA": { name: "Case-Shiller Index", category: "Housing", fredId: "CSUSHPINSA", source: "S&P/FRED", format: "index", decimals: 2 },
  "EXHOSLUSM495S": { name: "Existing Home Sales", category: "Housing", fredId: "EXHOSLUSM495S", source: "NAR/FRED", format: "thousands", decimals: 0 },
  "HSN1F": { name: "New Home Sales", category: "Housing", fredId: "HSN1F", source: "Census/FRED", format: "thousands", decimals: 0 },
  "HOUST": { name: "Housing Starts", category: "Housing", fredId: "HOUST", source: "Census/FRED", format: "thousands", decimals: 0 },
  "PERMIT": { name: "Building Permits", category: "Housing", fredId: "PERMIT", source: "Census/FRED", format: "thousands", decimals: 0 },
  "MORTGAGE30US": { name: "30-Year Mortgage Rate", category: "Housing", fredId: "MORTGAGE30US", source: "Freddie Mac/FRED", format: "percent", decimals: 2 },
  "MORTGAGE15US": { name: "15-Year Mortgage Rate", category: "Housing", fredId: "MORTGAGE15US", source: "Freddie Mac/FRED", format: "percent", decimals: 2 },

  // Consumer & Personal Finance
  "UMCSENT": { name: "Consumer Sentiment", category: "Consumer", fredId: "UMCSENT", source: "UMich/FRED", format: "index", decimals: 1 },
  "PI": { name: "Personal Income", category: "Consumer", fredId: "PI", source: "BEA/FRED", format: "billions", decimals: 1 },
  "DSPI": { name: "Disposable Personal Income", category: "Consumer", fredId: "DSPI", source: "BEA/FRED", format: "billions", decimals: 1 },
  "PSAVERT": { name: "Personal Saving Rate", category: "Consumer", fredId: "PSAVERT", source: "BEA/FRED", format: "percent", decimals: 1 },
  "TOTALSL": { name: "Consumer Credit Outstanding", category: "Consumer", fredId: "TOTALSL", source: "Fed/FRED", format: "billions", decimals: 1 },
  "DRCCLACBS": { name: "Credit Card Delinquency", category: "Consumer", fredId: "DRCCLACBS", source: "Fed/FRED", format: "percent", decimals: 2 },
  "TDSP": { name: "Debt Service Ratio", category: "Consumer", fredId: "TDSP", source: "Fed/FRED", format: "percent", decimals: 2 },
  "TOTALSA": { name: "Auto Sales", category: "Consumer", fredId: "TOTALSA", source: "BEA/FRED", format: "millions", decimals: 2 },

  // Financial Markets
  "FEDFUNDS": { name: "Fed Funds Rate", category: "Financial", fredId: "FEDFUNDS", source: "Fed/FRED", format: "percent", decimals: 2 },
  "DFEDTARU": { name: "Fed Funds Target (Upper)", category: "Financial", fredId: "DFEDTARU", source: "Fed/FRED", format: "percent", decimals: 2 },
  "DGS10": { name: "10-Year Treasury", category: "Financial", fredId: "DGS10", source: "Treasury/FRED", format: "percent", decimals: 2 },
  "DGS2": { name: "2-Year Treasury", category: "Financial", fredId: "DGS2", source: "Treasury/FRED", format: "percent", decimals: 2 },
  "T10Y2Y": { name: "10Y-2Y Spread", category: "Financial", fredId: "T10Y2Y", source: "FRED", format: "percent", decimals: 2 },
  "DGS30": { name: "30-Year Treasury", category: "Financial", fredId: "DGS30", source: "Treasury/FRED", format: "percent", decimals: 2 },
  "DTB3": { name: "3-Month T-Bill", category: "Financial", fredId: "DTB3", source: "Treasury/FRED", format: "percent", decimals: 2 },
  "STLFSI4": { name: "Financial Stress Index", category: "Financial", fredId: "STLFSI4", source: "StL Fed/FRED", format: "index", decimals: 3 },
  "SP500": { name: "S&P 500", category: "Financial", fredId: "SP500", source: "S&P/FRED", format: "number", decimals: 2 },
  "VIXCLS": { name: "VIX", category: "Financial", fredId: "VIXCLS", source: "CBOE/FRED", format: "index", decimals: 2 },

  // Trade & International
  "BOPGSTB": { name: "Trade Balance", category: "Trade", fredId: "BOPGSTB", source: "Census/BEA/FRED", format: "billions", decimals: 1 },
  "BOPGEXP": { name: "Exports", category: "Trade", fredId: "BOPGEXP", source: "Census/FRED", format: "billions", decimals: 1 },
  "BOPGIMP": { name: "Imports", category: "Trade", fredId: "BOPGIMP", source: "Census/FRED", format: "billions", decimals: 1 },
  "DTWEXBGS": { name: "USD Index", category: "Trade", fredId: "DTWEXBGS", source: "Fed/FRED", format: "index", decimals: 2 },
  "DEXUSEU": { name: "USD/EUR", category: "Trade", fredId: "DEXUSEU", source: "Fed/FRED", format: "number", decimals: 4 },

  // Government & Fiscal
  "GFDEBTN": { name: "Federal Debt Total", category: "Fiscal", fredId: "GFDEBTN", source: "Treasury/FRED", format: "trillions", decimals: 3 },
  "GFDEGDQ188S": { name: "Debt-to-GDP Ratio", category: "Fiscal", fredId: "GFDEGDQ188S", source: "FRED", format: "percent", decimals: 1 },
  "FGRECPT": { name: "Federal Receipts", category: "Fiscal", fredId: "FGRECPT", source: "Treasury/FRED", format: "billions", decimals: 1 },
  "FGEXPND": { name: "Federal Expenditures", category: "Fiscal", fredId: "FGEXPND", source: "Treasury/FRED", format: "billions", decimals: 1 },
  "TREASURY_DEBT": { name: "Total Public Debt", category: "Fiscal", source: "Treasury", format: "trillions", decimals: 3, special: "treasury-debt" },

  // Demographics
  "POPTHM": { name: "US Population", category: "Demographics", fredId: "POPTHM", source: "Census/FRED", format: "millions", decimals: 1 },
  "SIPOVGINIUSA": { name: "GINI Index", category: "Demographics", fredId: "SIPOVGINIUSA", source: "Census/FRED", format: "number", decimals: 3 },
  "MEHOINUSA672N": { name: "Median Household Income", category: "Demographics", fredId: "MEHOINUSA672N", source: "Census/FRED", format: "currency", decimals: 0 },
};

// ============================================================================
// DATA FETCHING
// ============================================================================

interface FetchResult {
  id: string;
  name: string;
  value: number;
  formattedValue: string;
  period: string;
  updated: string;
  source: string;
}

async function fetchFredSeries(seriesId: string): Promise<{ value: number; date: string } | null> {
  if (!FRED_API_KEY) {
    console.error("FRED_API_KEY not set");
    return null;
  }

  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=1`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    const obs = data.observations?.[0];
    if (!obs || obs.value === ".") return null;

    return { value: parseFloat(obs.value), date: obs.date };
  } catch (e) {
    console.error(`Error fetching FRED ${seriesId}:`, e);
    return null;
  }
}

async function fetchEIAGasPrice(): Promise<{ value: number; date: string } | null> {
  if (!EIA_API_KEY) {
    console.error("EIA_API_KEY not set - skipping gas prices");
    return null;
  }

  const url = `https://api.eia.gov/v2/petroleum/pri/gnd/data/?api_key=${EIA_API_KEY}&frequency=weekly&data[0]=value&facets[product][]=EPMR&facets[duoarea][]=NUS&sort[0][column]=period&sort[0][direction]=desc&length=1`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    const item = data.response?.data?.[0];
    if (!item) return null;

    return { value: parseFloat(item.value), date: item.period };
  } catch (e) {
    console.error("Error fetching EIA gas price:", e);
    return null;
  }
}

async function fetchTreasuryDebt(): Promise<{ value: number; date: string } | null> {
  const url = "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?sort=-record_date&page[size]=1";

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    const item = data.data?.[0];
    if (!item) return null;

    // Value is in dollars, convert to trillions
    const valueInTrillions = parseFloat(item.tot_pub_debt_out_amt) / 1e12;
    return { value: valueInTrillions, date: item.record_date };
  } catch (e) {
    console.error("Error fetching Treasury debt:", e);
    return null;
  }
}

function formatValue(value: number, config: MetricConfig): string {
  const decimals = config.decimals ?? 2;

  switch (config.format) {
    case "percent":
      return `${value.toFixed(decimals)}%`;
    case "currency":
      return `$${value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
    case "billions":
      return `$${value.toFixed(decimals)}B`;
    case "trillions":
      return `$${value.toFixed(decimals)}T`;
    case "thousands":
      return `${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}K`;
    case "millions":
      return `${value.toFixed(decimals)}M`;
    case "index":
      return value.toFixed(decimals);
    case "number":
    default:
      return value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }
}

async function fetchAllMetrics(): Promise<Map<string, FetchResult>> {
  const results = new Map<string, FetchResult>();
  const errors: string[] = [];

  console.log("Fetching metrics from APIs...\n");

  for (const [id, config] of Object.entries(METRICS)) {
    let data: { value: number; date: string } | null = null;

    // Handle special fetches
    if (config.special === "eia-gas") {
      console.log(`  [EIA] ${config.name}...`);
      data = await fetchEIAGasPrice();
    } else if (config.special === "treasury-debt") {
      console.log(`  [Treasury] ${config.name}...`);
      data = await fetchTreasuryDebt();
    } else if (config.fredId) {
      console.log(`  [FRED] ${config.name} (${config.fredId})...`);
      data = await fetchFredSeries(config.fredId);
    }

    if (data) {
      results.set(id, {
        id,
        name: config.name,
        value: data.value,
        formattedValue: formatValue(data.value, config),
        period: data.date,
        updated: new Date().toISOString().split("T")[0],
        source: config.source,
      });
      console.log(`    ✓ ${formatValue(data.value, config)} (${data.date})`);
    } else {
      errors.push(id);
      console.log(`    ✗ Failed`);
    }

    // Small delay to be nice to APIs
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`\nFetched ${results.size}/${Object.keys(METRICS).length} metrics`);
  if (errors.length > 0) {
    console.log(`Failed: ${errors.join(", ")}`);
  }

  return results;
}

// ============================================================================
// FILE UPDATES
// ============================================================================

function updateMarkdownFile(results: Map<string, FetchResult>): string {
  const mdPath = join(SUBSTRATE_PATH, "US-Common-Metrics.md");
  let content = readFileSync(mdPath, "utf-8");

  // Update the "Last Updated" timestamp
  const now = new Date().toISOString().split("T")[0];
  content = content.replace(
    /\*\*Last Updated:\*\* .*/,
    `**Last Updated:** ${now}`
  );

  // Update Quick Reference Dashboard
  const dashboardUpdates: Record<string, { key: string; value: string; trend: string }> = {
    "Economy": { key: "A191RL1Q225SBEA", value: "--", trend: "--" },
    "Inflation": { key: "CPIAUCSL", value: "--", trend: "--" },
    "Employment": { key: "UNRATE", value: "--", trend: "--" },
    "Housing": { key: "MORTGAGE30US", value: "--", trend: "--" },
    "Markets": { key: "FEDFUNDS", value: "--", trend: "--" },
    "Consumer": { key: "UMCSENT", value: "--", trend: "--" },
    "Fiscal": { key: "TREASURY_DEBT", value: "--", trend: "--" },
    "Energy": { key: "GAS_PRICE", value: "--", trend: "--" },
  };

  for (const [cat, info] of Object.entries(dashboardUpdates)) {
    const result = results.get(info.key);
    if (result) {
      info.value = result.formattedValue;
      info.trend = "→"; // Would need historical data to calculate actual trend
    }
  }

  // Build updated dashboard
  const dashboardRegex = /(\| Category \| Key Metric \| Value \| Updated \| Trend \|\n\|[^\n]+\n)([\s\S]*?)(\n\*Values updated)/;
  const dashboardMatch = content.match(dashboardRegex);

  if (dashboardMatch) {
    let newDashboard = "";
    for (const [cat, info] of Object.entries(dashboardUpdates)) {
      const result = results.get(info.key);
      const metricName = result?.name || METRICS[info.key]?.name || info.key;
      const value = result?.formattedValue || "--";
      const updated = result?.updated || "--";
      newDashboard += `| ${cat} | ${metricName} | ${value} | ${updated} | ${info.trend} |\n`;
    }
    content = content.replace(dashboardRegex, `$1${newDashboard}$3`);
  }

  // Update individual metric tables
  // Match pattern: | MetricName | -- | Period | -- | Source | ID |
  // and update the Value and Updated columns

  for (const [id, result] of results) {
    const config = METRICS[id];
    if (!config?.fredId && !config?.special) continue;

    // Try to find and update the row in the markdown
    // Pattern matches: | Metric Name | value | period | updated | source | FRED_ID |
    const escapedName = config.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const fredIdPattern = config.fredId || id;

    // Match the full table row
    const rowRegex = new RegExp(
      `(\\| ${escapedName}[^|]*\\| )--( \\|[^|]+\\| )--( \\|[^|]+\\| )(${fredIdPattern}[^|]* \\|)`,
      "g"
    );

    const replacement = `$1${result.formattedValue}$2${result.updated}$3$4`;
    content = content.replace(rowRegex, replacement);

    // Also try simpler pattern for metrics without exact name match
    const simpleRegex = new RegExp(
      `(\\|[^|]+\\| )--( \\|[^|]+\\| )--( \\|[^|]+\\| ${fredIdPattern} \\|)`,
      "g"
    );
    content = content.replace(simpleRegex, `$1${result.formattedValue}$2${result.updated}$3`);
  }

  return content;
}

function generateCurrentCSV(results: Map<string, FetchResult>): string {
  const lines = ["metric_id,metric_name,value,formatted_value,period,updated,source"];

  for (const [id, result] of results) {
    const line = [
      id,
      `"${result.name}"`,
      result.value,
      `"${result.formattedValue}"`,
      result.period,
      result.updated,
      `"${result.source}"`,
    ].join(",");
    lines.push(line);
  }

  return lines.join("\n") + "\n";
}

function generateHistoricalCSV(results: Map<string, FetchResult>): string {
  const timestamp = new Date().toISOString();
  const lines: string[] = [];

  for (const [id, result] of results) {
    lines.push(`${timestamp},${id},${result.value},${result.period}`);
  }

  return lines.join("\n") + "\n";
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      "dry-run": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(`
update-substrate-metrics.ts - Update Substrate US-Common-Metrics dataset

Usage:
  bun run update-substrate-metrics.ts [--dry-run]

Options:
  --dry-run    Fetch data but don't write files
  -h, --help   Show this help

Environment:
  FRED_API_KEY   Required for most metrics
  EIA_API_KEY    Required for gas prices

Output:
  ${PROJECTS_DIR}/your-data-project/Data/US-Common-Metrics/
    - US-Common-Metrics.md (updated)
    - us-metrics-current.csv (current snapshot)
    - us-metrics-historical.csv (appended)
`);
    process.exit(0);
  }

  // Check API keys
  if (!FRED_API_KEY) {
    console.error("Error: FRED_API_KEY environment variable not set");
    console.error("Get your free key at: https://fred.stlouisfed.org/docs/api/api_key.html");
    process.exit(1);
  }

  // Verify Substrate path exists
  if (!existsSync(SUBSTRATE_PATH)) {
    console.error(`Error: Substrate path not found: ${SUBSTRATE_PATH}`);
    process.exit(1);
  }

  console.log("=".repeat(60));
  console.log("US-Common-Metrics Update");
  console.log("=".repeat(60));
  console.log(`Substrate path: ${SUBSTRATE_PATH}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log("");

  // Fetch all metrics
  const results = await fetchAllMetrics();

  if (results.size === 0) {
    console.error("No metrics fetched successfully. Aborting.");
    process.exit(1);
  }

  // Generate updates
  console.log("\nGenerating file updates...");
  const updatedMd = updateMarkdownFile(results);
  const currentCsv = generateCurrentCSV(results);
  const historicalCsv = generateHistoricalCSV(results);

  if (values["dry-run"]) {
    console.log("\n[DRY RUN] Would write:");
    console.log(`  - US-Common-Metrics.md (${updatedMd.length} bytes)`);
    console.log(`  - us-metrics-current.csv (${currentCsv.length} bytes)`);
    console.log(`  - us-metrics-historical.csv (append ${historicalCsv.length} bytes)`);
    console.log("\nSample CSV output:");
    console.log(currentCsv.split("\n").slice(0, 5).join("\n"));
    process.exit(0);
  }

  // Write files
  const mdPath = join(SUBSTRATE_PATH, "US-Common-Metrics.md");
  const currentCsvPath = join(SUBSTRATE_PATH, "us-metrics-current.csv");
  const historicalCsvPath = join(SUBSTRATE_PATH, "us-metrics-historical.csv");

  console.log("\nWriting files...");

  writeFileSync(mdPath, updatedMd);
  console.log(`  ✓ ${mdPath}`);

  writeFileSync(currentCsvPath, currentCsv);
  console.log(`  ✓ ${currentCsvPath}`);

  // Append to historical (create header if new file)
  if (!existsSync(historicalCsvPath)) {
    writeFileSync(historicalCsvPath, "fetch_timestamp,metric_id,value,period\n");
  }
  appendFileSync(historicalCsvPath, historicalCsv);
  console.log(`  ✓ ${historicalCsvPath} (appended)`);

  console.log("\n" + "=".repeat(60));
  console.log(`Update complete. ${results.size} metrics updated.`);
  console.log("=".repeat(60));
}

main();
