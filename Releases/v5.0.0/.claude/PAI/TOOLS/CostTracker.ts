#!/usr/bin/env bun
/**
 * CostTracker — Anthropic cost observability for PAI
 *
 * Why this exists:
 *   April 2026 Anthropic invoice was $498.45, dominated by PAI-local processes
 *   that billed API instead of subscription (Pulse telegram SDK, spawnClaude
 *   `--bare`, .env auto-load of ANTHROPIC_API_KEY). The leak went undetected
 *   until the monthly invoice arrived. This tool closes that feedback loop.
 *
 * What it tracks:
 *   1. Subscription usage (5h/7d window %, read from UpdateCounts cache)
 *   2. API spend (from ANTHROPIC_ADMIN_API_KEY cost_report, if available)
 *   3. Call-site inventory (static rg scan for SDK imports + `--bare` + ANTHROPIC_API_KEY refs)
 *      — This is the real leak detector: catches regressions BEFORE they bill
 *
 * Outputs:
 *   MEMORY/OBSERVABILITY/anthropic-cost.jsonl   — append-only ledger
 *   MEMORY/OBSERVABILITY/anthropic-call-sites.json — current call-site snapshot
 *
 * CLI:
 *   bun CostTracker.ts status              — human-readable snapshot
 *   bun CostTracker.ts scan                — static scan, prints call sites
 *   bun CostTracker.ts log                 — append JSONL entry (for cron)
 *   bun CostTracker.ts alert-check         — threshold check, voice-alert if exceeded
 *   bun CostTracker.ts baseline            — snapshot current call sites as "known good"
 *
 * Designed to be called hourly by Pulse cron. Zero AI cost — pure data aggregation.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { execSync } from "child_process";
import { getPaiDir, getClaudeDir } from '../lib/paths';

const PAI_DIR = getPaiDir();
const CLAUDE_DIR = getClaudeDir();
const OBS_DIR = join(PAI_DIR, "MEMORY", "OBSERVABILITY");
const LEDGER_PATH = join(OBS_DIR, "anthropic-cost.jsonl");
const CALL_SITES_PATH = join(OBS_DIR, "anthropic-call-sites.json");
const USAGE_CACHE_PATH = join(PAI_DIR, "MEMORY", "STATE", "usage-cache.json");

// Alert thresholds — tunable
const API_SPEND_MONTHLY_ALERT_USD = 5.0;    // even Arbol should stay under $5/mo
const SUB_USAGE_ALERT_PCT = 95;             // subscription near-capacity warning

interface CostSnapshot {
  ts: string;
  subscription: {
    five_hour_pct: number | null;
    seven_day_pct: number | null;
  };
  api_spend: {
    month_used_usd: number | null;
    source: "admin_key" | "unavailable";
  };
  call_sites: {
    total: number;
    bypass: number;    // should NOT bill API but do
    legit: number;     // CF Workers, opt-in Evals
    new_since_baseline: string[];
  };
  alerts: string[];
}

interface CallSite {
  file: string;
  line: number;
  match: string;
  classification: "bypass" | "legit" | "unknown";
  reason: string;
}

// ──────────────────────────────────────────────────────────────────────────
// Subscription usage (OAuth, cached by UpdateCounts.hook.ts)
// ──────────────────────────────────────────────────────────────────────────

function readSubscriptionUsage(): { five_hour_pct: number | null; seven_day_pct: number | null } {
  try {
    const raw = readFileSync(USAGE_CACHE_PATH, "utf-8");
    const data = JSON.parse(raw);
    return {
      five_hour_pct: data?.five_hour?.utilization ?? null,
      seven_day_pct: data?.seven_day?.utilization ?? null,
    };
  } catch {
    return { five_hour_pct: null, seven_day_pct: null };
  }
}

// ──────────────────────────────────────────────────────────────────────────
// API spend (requires ANTHROPIC_ADMIN_API_KEY)
// ──────────────────────────────────────────────────────────────────────────

async function fetchApiSpend(): Promise<{ month_used_usd: number | null; source: "admin_key" | "unavailable" }> {
  const adminKey = process.env.ANTHROPIC_ADMIN_API_KEY;
  if (!adminKey) return { month_used_usd: null, source: "unavailable" };

  try {
    const now = new Date();
    const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01T00:00:00Z`;
    const resp = await fetch(
      `https://api.anthropic.com/v1/organizations/cost_report?starting_at=${startOfMonth}`,
      {
        headers: { "x-api-key": adminKey, "anthropic-version": "2023-06-01" },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!resp.ok) return { month_used_usd: null, source: "unavailable" };
    const data = await resp.json() as any;
    let totalCents = 0;
    if (Array.isArray(data?.data)) {
      for (const day of data.data) {
        if (Array.isArray(day?.results)) {
          for (const entry of day.results) {
            totalCents += parseFloat(entry.amount || "0");
          }
        }
      }
    }
    return { month_used_usd: totalCents / 100, source: "admin_key" };
  } catch {
    return { month_used_usd: null, source: "unavailable" };
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Static call-site scan — the real leak detector
// ──────────────────────────────────────────────────────────────────────────

// Paths we scan (source-of-truth for PAI-local billing risk)
const SCAN_ROOTS = [
  join(PAI_DIR, "PULSE"),
  join(PAI_DIR, "TOOLS"),
  join(PAI_DIR, "USER"),
  join(CLAUDE_DIR, "skills"),
  join(CLAUDE_DIR, "hooks"),
];

// Paths to exclude from scan
const SCAN_EXCLUDES = [
  "node_modules",
  ".git",
  "PAI_RELEASES",
  "ARBOL/Workers",       // CF Workers — legit API users
  "ARBOL/Shared",        // CF Workers — legit API users
  "ARBOL/summarize",     // CF Workers — legit API users
  "worktrees",
  "ARBOL/.claude",
  "MEMORY/OBSERVABILITY",
  "CostTracker.ts",      // don't flag ourselves
];

// Patterns that indicate API billing risk
const RISK_PATTERNS = [
  { pattern: "@anthropic-ai/claude-agent-sdk", reason: "Claude Agent SDK — bills API unless ANTHROPIC_API_KEY is stripped from env" },
  { pattern: "@anthropic-ai/sdk", reason: "Raw Anthropic SDK — bills API directly" },
  { pattern: "@ai-sdk/anthropic", reason: "Vercel AI SDK Anthropic provider — bills API directly" },
  { pattern: "claude.*--bare", reason: "`claude --bare` flag forces ANTHROPIC_API_KEY auth, skips OAuth/keychain" },
  { pattern: "x-api-key.*anthropic\\|x-api-key.*sk-ant", reason: "Raw HTTP to Anthropic API with x-api-key header" },
  { pattern: "api\\.anthropic\\.com/v1/messages", reason: "Direct HTTP POST to Anthropic messages endpoint" },
];

// Known-legit classifications (file path substrings)
const LEGIT_HINTS: Record<string, string> = {
  "CostTracker.ts": "this tool — scans itself for patterns",
  "hooks/handlers/UpdateCounts.ts": "OAuth usage cache (not billing inference)",
  "Daemon/Tools/SecurityFilter.ts": "content redaction filter — regex only, no API call",
  "skills/Evals/": "opt-in API billing, gated by EVALS_ALLOW_API_BILLING=1",
  "PAI/TOOLS/Inference.ts": "canonical inference tool — deletes ANTHROPIC_API_KEY before spawn",
  "PAI/PULSE/setup.ts": "provisioning script — placeholder comment only",
};

// Cache per-file guard check so repeated classify calls don't re-read
const guardCache: Map<string, boolean> = new Map();
function fileHasGuard(filePath: string): boolean {
  if (guardCache.has(filePath)) return guardCache.get(filePath)!;
  try {
    const abs = filePath.startsWith("~") ? filePath.replace("~", HOME) : filePath;
    const content = readFileSync(abs, "utf-8");
    const guarded = content.includes("delete process.env.ANTHROPIC_API_KEY") ||
                    content.includes("delete env.ANTHROPIC_API_KEY");
    guardCache.set(filePath, guarded);
    return guarded;
  } catch {
    return false;
  }
}

function classifyCallSite(file: string, reason: string): { classification: "bypass" | "legit" | "unknown"; note: string } {
  // Documentation files (.md) never execute — just mention SDK/API in prose or examples
  if (file.endsWith(".md")) {
    return { classification: "legit", note: "markdown (docs/template) — no runtime billing risk" };
  }
  for (const [hint, note] of Object.entries(LEGIT_HINTS)) {
    if (file.includes(hint)) return { classification: "legit", note };
  }
  // File has the ANTHROPIC_API_KEY-delete guard → its SDK/API-risk usage is neutralized
  if (fileHasGuard(file)) {
    return { classification: "legit", note: "file has `delete process.env.ANTHROPIC_API_KEY` guard — SDK/CLI uses OAuth subscription" };
  }
  if (reason.includes("--bare")) {
    return { classification: "bypass", note: "`--bare` flag — remove it, use Inference.ts flag pattern, and strip ANTHROPIC_API_KEY from env" };
  }
  if (reason.includes("SDK")) {
    return { classification: "bypass", note: "SDK call without ANTHROPIC_API_KEY-delete guard — will bill API if key present in env" };
  }
  return { classification: "unknown", note: reason };
}

function scanCallSites(): CallSite[] {
  const hits: CallSite[] = [];
  const excludeArgs = SCAN_EXCLUDES.map((e) => `-g '!${e}/**'`).join(" ");

  for (const root of SCAN_ROOTS) {
    if (!existsSync(root)) continue;
    for (const { pattern, reason } of RISK_PATTERNS) {
      try {
        const cmd = `rg --line-number --no-heading ${excludeArgs} -e '${pattern}' '${root}' 2>/dev/null`;
        const output = execSync(cmd, { encoding: "utf-8", maxBuffer: 4 * 1024 * 1024 }).trim();
        if (!output) continue;
        for (const line of output.split("\n")) {
          const match = line.match(/^([^:]+):(\d+):(.*)$/);
          if (!match) continue;
          const [, file, lineNumStr, matched] = match;
          const lineNum = parseInt(lineNumStr, 10);
          const { classification, note } = classifyCallSite(file, reason);
          hits.push({
            file: file.replace(homedir(), "~"),
            line: lineNum,
            match: matched.trim().slice(0, 120),
            classification,
            reason: note,
          });
        }
      } catch {
        // rg returns non-zero when no matches — ignore
      }
    }
  }

  // Dedup by file+line+pattern
  const seen = new Set<string>();
  return hits.filter((h) => {
    const key = `${h.file}:${h.line}:${h.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Baseline diff — detect new call sites since last scan
// ──────────────────────────────────────────────────────────────────────────

function readBaseline(): Set<string> {
  try {
    const raw = readFileSync(CALL_SITES_PATH, "utf-8");
    const data = JSON.parse(raw) as { sites: CallSite[] };
    return new Set(data.sites.map((s) => `${s.file}:${s.line}:${s.reason}`));
  } catch {
    return new Set();
  }
}

function writeBaseline(sites: CallSite[]): void {
  mkdirSync(OBS_DIR, { recursive: true });
  writeFileSync(CALL_SITES_PATH, JSON.stringify({ updated: new Date().toISOString(), sites }, null, 2));
}

// ──────────────────────────────────────────────────────────────────────────
// Snapshot assembly
// ──────────────────────────────────────────────────────────────────────────

async function takeSnapshot(): Promise<{ snapshot: CostSnapshot; sites: CallSite[] }> {
  const subscription = readSubscriptionUsage();
  const api_spend = await fetchApiSpend();
  const sites = scanCallSites();
  const baseline = readBaseline();

  const bypass = sites.filter((s) => s.classification === "bypass").length;
  const legit = sites.filter((s) => s.classification === "legit").length;
  const newSites = sites
    .filter((s) => !baseline.has(`${s.file}:${s.line}:${s.reason}`))
    .map((s) => `${s.file}:${s.line} (${s.classification}) — ${s.reason}`);

  const alerts: string[] = [];
  if (api_spend.month_used_usd !== null && api_spend.month_used_usd > API_SPEND_MONTHLY_ALERT_USD) {
    alerts.push(`API spend this month: $${api_spend.month_used_usd.toFixed(2)} (threshold $${API_SPEND_MONTHLY_ALERT_USD})`);
  }
  if (newSites.length > 0) {
    alerts.push(`${newSites.length} NEW API-risk call site(s) since baseline`);
  }
  if (bypass > 0) {
    alerts.push(`${bypass} call site(s) classified as BYPASS — review and patch`);
  }
  if (subscription.five_hour_pct !== null && subscription.five_hour_pct > SUB_USAGE_ALERT_PCT) {
    alerts.push(`Subscription 5h window at ${subscription.five_hour_pct}% (threshold ${SUB_USAGE_ALERT_PCT}%)`);
  }

  return {
    snapshot: {
      ts: new Date().toISOString(),
      subscription,
      api_spend,
      call_sites: { total: sites.length, bypass, legit, new_since_baseline: newSites },
      alerts,
    },
    sites,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Voice alert via Pulse
// ──────────────────────────────────────────────────────────────────────────

async function voiceAlert(message: string): Promise<void> {
  try {
    await fetch("http://localhost:31337/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, voice_enabled: true }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Pulse may be down — log to stderr instead
    console.error(`[CostTracker] alert (voice unavailable): ${message}`);
  }
}

// ──────────────────────────────────────────────────────────────────────────
// CLI
// ──────────────────────────────────────────────────────────────────────────

function formatStatus(snap: CostSnapshot): string {
  const lines: string[] = [];
  lines.push(`═══ PAI Anthropic Cost — ${snap.ts} ═══`);
  lines.push(``);
  lines.push(`Subscription (OAuth):`);
  lines.push(`  5h window:   ${snap.subscription.five_hour_pct ?? "unknown"}%`);
  lines.push(`  7d window:   ${snap.subscription.seven_day_pct ?? "unknown"}%`);
  lines.push(``);
  lines.push(`API Spend (month to date):`);
  if (snap.api_spend.month_used_usd !== null) {
    lines.push(`  $${snap.api_spend.month_used_usd.toFixed(2)}  (from ${snap.api_spend.source})`);
  } else {
    lines.push(`  unknown  (ANTHROPIC_ADMIN_API_KEY not set)`);
  }
  lines.push(``);
  lines.push(`Call Sites (PAI-local risk surface):`);
  lines.push(`  total:   ${snap.call_sites.total}`);
  lines.push(`  bypass:  ${snap.call_sites.bypass}   ← should NOT bill API`);
  lines.push(`  legit:   ${snap.call_sites.legit}   ← CF Workers / opt-in`);
  if (snap.call_sites.new_since_baseline.length > 0) {
    lines.push(``);
    lines.push(`NEW since baseline:`);
    for (const s of snap.call_sites.new_since_baseline) lines.push(`  + ${s}`);
  }
  lines.push(``);
  if (snap.alerts.length === 0) {
    lines.push(`✅ No alerts`);
  } else {
    lines.push(`🚨 Alerts:`);
    for (const a of snap.alerts) lines.push(`  ! ${a}`);
  }
  return lines.join("\n");
}

async function main(): Promise<void> {
  const cmd = process.argv[2] ?? "status";
  mkdirSync(OBS_DIR, { recursive: true });

  switch (cmd) {
    case "status": {
      const { snapshot } = await takeSnapshot();
      console.log(formatStatus(snapshot));
      break;
    }
    case "scan": {
      const sites = scanCallSites();
      console.log(`Found ${sites.length} potential API-billing call site(s):`);
      console.log(``);
      for (const s of sites) {
        const icon = s.classification === "bypass" ? "🔴" : s.classification === "legit" ? "✅" : "❓";
        console.log(`${icon} ${s.file}:${s.line}`);
        console.log(`   ${s.reason}`);
      }
      break;
    }
    case "log": {
      const { snapshot } = await takeSnapshot();
      appendFileSync(LEDGER_PATH, JSON.stringify(snapshot) + "\n");
      console.log(`Logged snapshot to ${LEDGER_PATH.replace(homedir(), "~")}`);
      if (snapshot.alerts.length > 0) {
        for (const a of snapshot.alerts) console.log(`  🚨 ${a}`);
      }
      break;
    }
    case "alert-check": {
      const { snapshot } = await takeSnapshot();
      if (snapshot.alerts.length === 0) {
        console.log("No alerts.");
        return;
      }
      const message = `PAI cost alert: ${snapshot.alerts.join("; ")}`;
      await voiceAlert(message);
      console.log(message);
      break;
    }
    case "baseline": {
      const sites = scanCallSites();
      writeBaseline(sites);
      console.log(`Baseline written: ${sites.length} call site(s) at ${CALL_SITES_PATH.replace(homedir(), "~")}`);
      console.log(`  bypass: ${sites.filter((s) => s.classification === "bypass").length}`);
      console.log(`  legit:  ${sites.filter((s) => s.classification === "legit").length}`);
      console.log(`  unknown:${sites.filter((s) => s.classification === "unknown").length}`);
      break;
    }
    default:
      console.error(`Usage: bun CostTracker.ts <status|scan|log|alert-check|baseline>`);
      process.exit(1);
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(`[CostTracker] fatal: ${(err as Error).message}`);
    process.exit(1);
  });
}
