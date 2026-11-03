/**
 * Bunker module — feeds the Pulse "Bunker" tab.
 *
 * Bunker (~/.claude/LIFEOS/PULSE/Bunker, a maintainer-private runtime location) is the source of truth. Its launchd monitor runs
 * every probe on its own clock and writes a full snapshot to the USER tree; this module
 * READS that file (never runs a scan), caches it, and serves it at /api/bunker. Pulse only
 * displays; Bunker computes. A stale or missing snapshot is served as a fault, not as pending.
 *
 * Routes (all under /api/bunker):
 *   GET  /api/bunker          → { apps[], summary, lastFetch, stale }
 *   GET  /api/bunker/status   → module health
 *   GET  /api/bunker/security-scan → cloud infra-security scan (the Workflows scanner's last report)
 *   GET  /api/bunker/codesweep → local white-box security sweep state
 *   POST /api/bunker/refresh  → re-read the snapshot file now
 */

import { join } from "path";
import { existsSync, readFileSync, readdirSync } from "fs";
import { homedir } from "node:os";
import { workflowsConfigPath } from "../../TOOLS/WorkflowsConfig"

const HOME = process.env.HOME ?? process.env.USERPROFILE ?? homedir();
const MODULE = "bunker";
// Bunker CODE folded under Pulse (data/code separation); DATA (shots) lives in
// the USER config tree, so shot images are read from there, never from BUNKER_DIR.
const BUNKER_DIR = process.env.BUNKER_DIR || join(HOME, ".claude", "LIFEOS", "PULSE", "Bunker");
const BUNKER_BIN = join(BUNKER_DIR, "bin", "bunker.ts");
const BUNKER_SHOTS_DIR = join(HOME, ".config", "LIFEOS", "USER", "PULSE", "Bunker", "shots");
const CODESWEEP_DIR = join(HOME, ".config", "LIFEOS", "USER", "PULSE", "Bunker", "codesweep");

interface State {
  running: boolean;
  startedAt: Date | null;
  cache: any | null;
  lastFetch: Date | null;
  pollHandle: ReturnType<typeof setInterval> | null;
}

const state: State = { running: false, startedAt: null, cache: null, lastFetch: null, pollHandle: null };

// Pulse never runs a scan. The launchd monitor runs every probe on its own
// clock and writes the full snapshot to SNAPSHOT_PATH; this module only reads
// the file. An in-process scan cannot outlive a request timeout, cannot
// self-probe Pulse, and never overlaps the monitor's own cycle.
const BUNKER_SNAPSHOT = join(HOME, ".config", "LIFEOS", "USER", "PULSE", "Bunker", "snapshot.json");
// launchd cadence is 900s; two missed cycles means the monitor is not running.
const STALE_AFTER_MS = 2 * 15 * 60_000;
// A sweep can outlast a cycle (34 min on 2026-10-08), so age runs from when the
// last sweep finished, and the allowance grows by that sweep's own duration.
let lastCompleted: Date | null = null;
let lastSweepMs = 0;

async function refresh(): Promise<{ ok: boolean; reason?: string }> {
  if (!existsSync(BUNKER_SNAPSHOT)) {
    return { ok: false, reason: `no snapshot at ${BUNKER_SNAPSHOT} — the launchd monitor (com.lifeos.bunkermonitor) has not completed a sweep yet` };
  }
  try {
    const snap = JSON.parse(readFileSync(BUNKER_SNAPSHOT, "utf8"));
    if (!Array.isArray(snap?.apps) || !snap?.summary) return { ok: false, reason: "snapshot is not a Bunker snapshot (no apps/summary)" };
    state.cache = snap;
    state.lastFetch = new Date(snap.generatedAt ?? Date.now());
    lastCompleted = snap.completedAt ? new Date(snap.completedAt) : null;
    lastSweepMs = lastCompleted ? Math.max(0, lastCompleted.getTime() - state.lastFetch.getTime()) : 0;
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: `snapshot unreadable: ${String(err)}` };
  }
}

function snapshotAge(): { stale: boolean; reason?: string } {
  if (!state.lastFetch) return { stale: true, reason: "no snapshot yet — first scan pending" };
  const age = Date.now() - (lastCompleted ?? state.lastFetch).getTime();
  if (age > STALE_AFTER_MS + lastSweepMs) return { stale: true, reason: `snapshot is ${Math.round(age / 60_000)} min old — monitor missed ≥2 cycles` };
  return { stale: false };
}

export async function start(): Promise<void> {
  console.log(`[${MODULE}] Starting...`);
  // health() has consulted bunkerAvailable() since 2026-07-31 (report absence
  // honestly rather than a status); start() never did. So a public install —
  // where the CLI is a containment zone and genuinely absent — still spawned a
  // 300s timer against a path that cannot exist, for the life of the daemon,
  // with nothing reporting it. Same check, one layer earlier.
  // public issue #1898, @bnkath2o — same class as #1750.
  if (!bunkerAvailable()) {
    console.log(
      `[${MODULE}] Not installed — ${BUNKER_BIN} is absent, so the module stays idle. ` +
        `The Bunker CLI is not part of the public payload; set BUNKER_DIR if yours lives elsewhere.`,
    );
    state.running = false;
    return;
  }
  state.running = true;
  state.startedAt = new Date();
  const first = await refresh();
  if (!first.ok) console.warn(`[${MODULE}] initial snapshot read failed: ${first.reason}`);
  // A file read, so a 60s re-read costs nothing; the monitor writes every 900s.
  state.pollHandle = setInterval(() => {
    refresh().then((r) => { if (!r.ok) console.warn(`[${MODULE}] snapshot read failed: ${r.reason}`); });
  }, 60_000);
  console.log(`[${MODULE}] Reading ${BUNKER_SNAPSHOT} every 60s`);
}

export async function stop(): Promise<void> {
  console.log(`[${MODULE}] Stopping...`);
  state.running = false;
  if (state.pollHandle) {
    clearInterval(state.pollHandle);
    state.pollHandle = null;
  }
}

/** Is the Bunker implementation actually present on this install?
 *
 * `LIFEOS/PULSE/Bunker/**` is a containment zone: the concept ships via
 * DOCUMENTATION, the implementation stays private. This module ships. Before
 * 2026-07-31 it reported `healthy`/`stopped` regardless, so a public install
 * rendered a Bunker tab fronting a binary that cannot exist — the same
 * boundary-crossing defect as the Hermes manifest importing into the zone,
 * one layer up. Report absence honestly instead of a status. */
export function bunkerAvailable(): boolean {
  return existsSync(BUNKER_BIN);
}

export function health(): { status: string; details?: Record<string, unknown> } {
  if (!bunkerAvailable()) {
    return {
      status: "unavailable",
      details: {
        reason: "Bunker implementation not present on this install (private component)",
        bunker_dir: BUNKER_DIR,
      },
    };
  }
  return {
    status: state.running ? "healthy" : "stopped",
    details: {
      apps: state.cache?.summary?.apps ?? 0,
      last_fetch: state.lastFetch?.toISOString() ?? null,
      bunker_dir: BUNKER_DIR,
    },
  };
}

// ── Workflows cloud infra-security (infra-security worker) ──
// The hourly cloud scanner is part of the same uptime/security stack Bunker
// fronts. This proxies its last report so the token stays server-side and the
// tab shows cloud health next to the local probe results. Worker URL is derived
// from ~/.config/workflows/config.yaml (subdomain + auth_token) — nothing
// user-specific is hardcoded here (this file ships in releases).

interface ScanCheck { target: string; category: string; check: string; status: string; evidence?: string; severity: string }
interface ScanReport { timestamp: string; summary: { pass: number; fail: number; error: number; skip: number }; checks: ScanCheck[] }

let scanCache: { at: number; report: ScanReport } | null = null;
let pentestCache: { at: number; online: boolean } | null = null;

// Every deployed worker NAME is an install-private fact and lives in the
// private config file — never in this source — so shipped code carries no
// private-infrastructure identifiers (G18). `pentest_worker` was already
// config-sourced; `security_worker` and `site_health_worker` joined it after
// Max's 7.31.5 audit found their kebab-case names hardcoded two lines below a
// comment claiming exactly this property. Defaults are generic shapes, not
// this install's names: an install with different names sets the keys.
// public PR #2112, @pai-scaffolde: A worker exists only when its key is set.
// ~/.config/workflows/config.yaml is Workflows' general config, so its presence says
// nothing about these two scanners. Defaulting their names turned a missing
// scanner into a confusing "unreachable" signal. Drop the defaults.
function cloudConfig(): { subdomain: string; token: string; pentestWorker?: string; securityWorker?: string; siteHealthWorker?: string; emailWorker?: string } | null {
  try {
    const y = readFileSync(workflowsConfigPath(HOME), "utf8");
    const subdomain = y.match(/^subdomain:\s*"?([^"\n]+)"?/m)?.[1]?.trim();
    const token = y.match(/^auth_token:\s*"?([^"\n]+)"?/m)?.[1]?.trim();
    const pentestWorker = y.match(/^pentest_worker:\s*"?([^"\n]+)"?/m)?.[1]?.trim();
    const securityWorker = y.match(/^security_worker:\s*"?([^"\n]+)"?/m)?.[1]?.trim();
    const siteHealthWorker = y.match(/^site_health_worker:\s*"?([^"\n]+)"?/m)?.[1]?.trim();
    const emailWorker = y.match(/^email_worker:\s*"?([^"\n]+)"?/m)?.[1]?.trim();
    if (!subdomain || !token) return null;
    return { subdomain, token, pentestWorker, securityWorker, siteHealthWorker, emailWorker };
  } catch { return null; }
}

// Three outcomes the panel must tell apart. Collapsing them to a single `null`
// (the old return type) made "no security system installed" and "scanner is
// down" render identically as a BLANK panel — and a blank security panel reads
// as "no findings / all clear", the most dangerous possible misread (a blank
// card is broken, not acceptable — OPERATIONAL_PREFERENCES § Deploy & verify). The
// caller now renders `unreachable` as a red/degraded card face, never empty.
type ScanFetch =
  | { state: "ok"; report: ScanReport }
  | { state: "not-configured" }
  | { state: "unreachable"; reason: string };

async function fetchScan(): Promise<ScanFetch> {
  if (scanCache && Date.now() - scanCache.at < 5 * 60_000) return { state: "ok", report: scanCache.report };
  const cfg = cloudConfig();
  if (!cfg || !cfg.securityWorker) return { state: "not-configured" };
  try {
    const r = await fetch(`https://${cfg.securityWorker}.${cfg.subdomain}.workers.dev/report`, {
      headers: { Authorization: `Bearer ${cfg.token}` },
    });
    if (!r.ok) return { state: "unreachable", reason: `scanner returned HTTP ${r.status}` };
    const report = (await r.json()) as ScanReport;
    scanCache = { at: Date.now(), report };
    return { state: "ok", report };
  } catch (e) {
    return { state: "unreachable", reason: `scanner fetch failed: ${(e as Error)?.message ?? "network error"}` };
  }
}

async function pentestOnline(): Promise<boolean | null> {
  if (pentestCache && Date.now() - pentestCache.at < 5 * 60_000) return pentestCache.online;
  const cfg = cloudConfig();
  if (!cfg?.pentestWorker) return null;
  try {
    const r = await fetch(`https://${cfg.pentestWorker}.${cfg.subdomain}.workers.dev/health`, { signal: AbortSignal.timeout(4000) });
    pentestCache = { at: Date.now(), online: r.ok };
    return r.ok;
  } catch {
    pentestCache = { at: Date.now(), online: false };
    return false;
  }
}

// Per-app security rollup: match cloud scan targets to an app by normalized
// name substring (an app usually deploys at a domain containing its name),
// aggregate that app's failing checks, and grade: red = critical/high failing,
// orange = medium/low failing, green = matched and clean. Null when no scan
// target matches the app.
export interface AppSecurity {
  status: "green" | "orange" | "red";
  lastScan: string;
  targets: string[];
  fails: number;
  errors: number;
  failing: { target: string; category: string; check: string; severity: string }[];
}

function securityForApp(appName: string, report: ScanReport): AppSecurity | null {
  const name = appName.toLowerCase().replace(/[^a-z0-9]/g, "");
  // Normalize the target exactly like the name: keeping "." on the target side
  // only meant an app named after its domain ("docs.example" → "docsexample")
  // never matched its own target. public issue #2243, @pai-scaffolde
  const checks = report.checks.filter((c) => c.target.toLowerCase().replace(/[^a-z0-9]/g, "").includes(name));
  if (checks.length === 0) return null;
  const failing = checks.filter((c) => c.status === "fail");
  const errors = checks.filter((c) => c.status === "error").length;
  const worstRed = failing.some((c) => c.severity === "critical" || c.severity === "high");
  return {
    status: failing.length === 0 ? "green" : worstRed ? "red" : "orange",
    lastScan: report.timestamp,
    targets: [...new Set(checks.map((c) => c.target))],
    fails: failing.length,
    errors,
    failing: failing.map((c) => ({ target: c.target, category: c.category, check: c.check, severity: c.severity })),
  };
}

// ── Cloud site-health (site-health worker) ──
// The hourly-cron cloud uptime checker over every deployed site. Its data used
// to be a public no-auth dashboard; it's now authenticated and read here
// server-side so the roster and uptime history stay private and live in Pulse.

interface SiteHealthApp { name: string; type: string; url: string; state: string; pass: number; fail: number; updated_at: string | null; since: string | null; history?: { state: string }[] }

let siteHealthCache: { at: number; body: unknown } | null = null;

async function siteHealthReport(): Promise<Response> {
  if (siteHealthCache && Date.now() - siteHealthCache.at < 60_000) return Response.json(siteHealthCache.body);
  const cfg = cloudConfig();
  if (!cfg || !cfg.siteHealthWorker) return Response.json({ error: "site-health worker not configured" }, { status: 503 });
  try {
    const r = await fetch(`https://${cfg.siteHealthWorker}.${cfg.subdomain}.workers.dev/status`, {
      headers: { Authorization: `Bearer ${cfg.token}` },
    });
    if (!r.ok) return Response.json({ error: `site-health worker HTTP ${r.status}` }, { status: 502 });
    const data = (await r.json()) as { apps: SiteHealthApp[]; total: number; red: number; degraded: number; updatedAt: string };
    // Compact per-app: state, last check, last-24h spark (state per tick).
    const apps = (data.apps ?? []).map((a) => ({
      name: a.name,
      url: a.url,
      state: a.state,
      lastCheck: a.updated_at,
      since: a.since,
      spark: (a.history ?? []).map((h) => (h.state === "green" ? 2 : h.state === "degraded" ? 1 : 0)),
    }));
    const body = { total: data.total, red: data.red, degraded: data.degraded, updatedAt: data.updatedAt, apps };
    siteHealthCache = { at: Date.now(), body };
    return Response.json(body);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 502 });
  }
}

// ── Monitoring cost (Cloudflare Workers) ──
// Real request counts from the Cloudflare GraphQL Analytics API for the workers
// that run the uptime + security monitoring, projected to a monthly figure and
// priced against the Workers Paid plan. Token/account read server-side from the
// canonical env; nothing sensitive reaches the browser.

// The optional pentest and alert-email workers (private names, from config)
// join the cost rollup when configured; worker names are [a-z0-9-] so direct
// interpolation into the regex is safe.
export function monitorWorkersRe(): RegExp {
  // Built from the SAME config-sourced names the report fetchers use, so an
  // install whose workers are named differently still gets them costed. The
  // hardcoded pair here survived the 7.31.5 config refactor two functions
  // above and would have silently omitted both workers from the cost card on
  // every non-default install (Max audit, 7.31.6). The email worker's name was
  // still a literal here until the 8.621.0 audit; it is `email_worker` now.
  const cfg = cloudConfig();
  const names = [cfg?.securityWorker, cfg?.siteHealthWorker, cfg?.emailWorker, cfg?.pentestWorker]
    .filter((n): n is string => Boolean(n));
  // An empty alternation would match every worker on the account; none configured costs none.
  return names.length ? new RegExp(names.join("|")) : /(?!)/;
}
// Workers Paid: $5/mo flat includes 10M requests; $0.30 per additional million.
const CF_INCLUDED_REQUESTS = 10_000_000;
const CF_OVERAGE_PER_MILLION = 0.30;

let costCache: { at: number; body: unknown } | null = null;

function cfCreds(): { acct: string; token: string } | null {
  let acct = process.env.CLOUDFLARE_ACCOUNT_ID;
  let token = process.env.CLOUDFLARE_API_TOKEN;
  if (!acct || !token) {
    try {
      const env = readFileSync(join(HOME, ".claude", ".env"), "utf8");
      acct ||= env.match(/^CLOUDFLARE_ACCOUNT_ID=["']?([^"'\n]+)/m)?.[1];
      token ||= env.match(/^CLOUDFLARE_API_TOKEN=["']?([^"'\n]+)/m)?.[1];
    } catch { /* no env file */ }
  }
  return acct && token ? { acct, token } : null;
}

async function costReport(): Promise<Response> {
  if (costCache && Date.now() - costCache.at < 60 * 60_000) return Response.json(costCache.body);
  const creds = cfCreds();
  if (!creds) return Response.json({ error: "cloudflare credentials not found in env" }, { status: 503 });
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const query = `query($acct:String!,$since:Time!){viewer{accounts(filter:{accountTag:$acct}){workersInvocationsAdaptive(limit:200,filter:{datetime_geq:$since}){sum{requests} dimensions{scriptName}}}}}`;
  try {
    const r = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${creds.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { acct: creds.acct, since } }),
    });
    const j = await r.json();
    const rows = j?.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive ?? [];
    const workers = rows
      .filter((x: any) => monitorWorkersRe().test(x.dimensions.scriptName))
      .map((x: any) => ({ name: x.dimensions.scriptName, reqPerDay: x.sum.requests, reqPerMonth: Math.round(x.sum.requests * 30.4) }))
      .sort((a: any, b: any) => b.reqPerMonth - a.reqPerMonth);
    const totalMonth = workers.reduce((n: number, w: any) => n + w.reqPerMonth, 0);
    const pctOfIncluded = (totalMonth / CF_INCLUDED_REQUESTS) * 100;
    // Marginal cost: these workers sit inside the flat plan's included quota, so
    // the true marginal cost is $0; the standalone figure shows what they'd cost
    // if billed purely per-request.
    const standaloneMonthly = (totalMonth / 1_000_000) * CF_OVERAGE_PER_MILLION;
    const body = {
      updatedAt: new Date().toISOString(),
      totalReqPerMonth: totalMonth,
      includedRequests: CF_INCLUDED_REQUESTS,
      pctOfIncluded,
      marginalMonthly: 0,
      standaloneMonthly,
      plan: "Workers Paid ($5/mo flat, 10M requests included)",
      workers,
    };
    costCache = { at: Date.now(), body };
    return Response.json(body);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 502 });
  }
}

async function securityScanReport(): Promise<Response> {
  const res = await fetchScan();
  if (res.state !== "ok") {
    return Response.json(
      { error: res.state === "unreachable" ? `security scanner unreachable: ${res.reason}` : "security scanner not configured (~/.config/workflows/config.yaml)" },
      { status: res.state === "unreachable" ? 502 : 503 },
    );
  }
  const report = res.report;
  const failing = report.checks.filter((c) => c.status === "fail");
  const bySeverity: Record<string, number> = {};
  for (const c of failing) bySeverity[c.severity] = (bySeverity[c.severity] ?? 0) + 1;
  return Response.json({
    timestamp: report.timestamp,
    summary: report.summary,
    targets: new Set(report.checks.map((c) => c.target)).size,
    bySeverity,
    pentest: await pentestOnline(),
    failing: failing
      .sort((a, b) => ["critical", "high", "medium", "low"].indexOf(a.severity) - ["critical", "high", "medium", "low"].indexOf(b.severity))
      .map((c) => ({ target: c.target, category: c.category, check: c.check, severity: c.severity })),
  });
}

interface CodeSweepState {
  app: string;
  version: number;
  running?: { pid: number; started_at: string; head: string };
  completed_at?: string;
  mode?: "full" | "incremental";
  head?: string;
  wall_ms?: number;
  prompt_bytes?: number;
  files_in_scope?: string[];
  snapshot_at?: string;
  findings?: { raw: number; corroborated: number; dropped: number; registered: string[]; existing: string[] };
  error?: string;
  error_at?: string;
}

/** Read-only presentation data. Bunker owns these files and Pulse never invokes a sweep. */
export function codeSweepReport(codesweepDir = CODESWEEP_DIR): { apps: { app: string; state: CodeSweepState | null }[] } {
  if (!existsSync(codesweepDir)) return { apps: [] };
  let apps: string[];
  try { apps = readdirSync(codesweepDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort(); } catch { return { apps: [] }; }
  return { apps: apps.map((app) => {
    const path = join(codesweepDir, app, "state.json");
    let state: CodeSweepState | null = null;
    if (existsSync(path)) {
      try { state = JSON.parse(readFileSync(path, "utf8")) as CodeSweepState; } catch { /* unreadable state is represented as absent */ }
    }
    return { app, state };
  }) };
}

export async function handleRequest(req: Request, pathname: string): Promise<Response | null> {
  if (!pathname.startsWith("/api/bunker")) return null;
  const sub = pathname.replace(/^\/api\/bunker/, "") || "/";

  if (sub === "/status") return Response.json(health());
  if (req.method === "GET" && sub === "/security-scan") return securityScanReport();
  if (req.method === "GET" && sub === "/codesweep") return Response.json(codeSweepReport());
  if (req.method === "GET" && sub === "/sitehealth") return siteHealthReport();
  if (req.method === "GET" && sub === "/cost") return costReport();

  if (req.method === "POST" && sub === "/refresh") {
    const r = await refresh();
    return Response.json({ ok: r.ok, reason: r.reason ?? null, lastFetch: state.lastFetch?.toISOString() ?? null });
  }

  // Serve an app's visual: live screenshot (bunker shots), social image, or favicon.
  if (req.method === "GET" && sub.startsWith("/asset")) {
    const u = new URL(req.url);
    const appName = u.searchParams.get("app");
    const kindParam = u.searchParams.get("kind");
    const found = state.cache?.apps?.find((a: any) => a.name === appName);
    if (!found) return Response.json({ error: "unknown app" }, { status: 404 });
    // Screenshots live centrally in the USER data tree (never in an app's deploy payload, never in the code tree).
    // Brand assets are served from the repo-relative path the registry FOUND (stacks
    // disagree on where og/favicon live), re-validated here against a closed shape so
    // a poisoned cache still cannot traverse: no "..", no absolute path, fixed basename.
    const rel = kindParam === "favicon" ? found.faviconPath : found.ogPath;
    const SAFE_ASSET = /^(?:public|static|assets)?\/?(?:img\/|images\/|assets\/)?(?:og|favicon)\.(?:png|jpe?g|webp|svg|ico)$/;
    if (kindParam !== "shot" && (typeof rel !== "string" || !SAFE_ASSET.test(rel))) {
      return Response.json({ error: "no asset" }, { status: 404 });
    }
    const path = kindParam === "shot"
      ? join(BUNKER_SHOTS_DIR, `${found.name}.png`)
      : join(found.dir, rel as string); // dir from trusted registry; rel shape-validated above
    if (!existsSync(path)) return Response.json({ error: "no asset" }, { status: 404 });
    return new Response(Bun.file(path), { headers: { "Cache-Control": "public, max-age=300" } });
  }

  if (req.method === "GET" && (sub === "/" || sub === "")) {
    if (!state.cache) {
      // "Never deployed" and "first sweep still pending" both produce an empty
      // snapshot; only the former never resolves, so name it on the wire.
      // (public issue #2018, @0bsolescence)
      const available = bunkerAvailable();
      return Response.json({
        apps: [],
        summary: { apps: 0, green: 0, probesPass: 0, probesTotal: 0, manual: 0 },
        lastFetch: null,
        stale: true,
        available,
        stale_reason: available
          ? "no snapshot yet — the monitor (com.lifeos.bunkermonitor) has not completed a sweep"
          : "Bunker harness not deployed on this install",
      });
    }
    // Fold the cloud security grade into each app so every bay carries
    // "when was the last security check, and is it green/orange/red".
    const scan = await fetchScan();
    const report = scan.state === "ok" ? scan.report : null;
    const apps = (state.cache.apps ?? []).map((a: any) => ({
      ...a,
      security: report ? securityForApp(a.name, report) : null,
    }));
    // Panel-level security-source state so the card face can render a red/degraded
    // "scanner unreachable" indicator instead of a blank panel that reads as
    // all-clear. `not-configured` stays silent (no security system installed).
    const security_source =
      scan.state === "ok" ? { state: "ok" as const, timestamp: scan.report.timestamp }
      : scan.state === "unreachable" ? { state: "unreachable" as const, reason: scan.reason }
      : { state: "not-configured" as const };
    const age = snapshotAge();
    return Response.json({
      ...state.cache,
      apps,
      security_source,
      lastFetch: state.lastFetch?.toISOString() ?? null,
      stale: age.stale,
      ...(age.reason ? { stale_reason: age.reason } : {}),
    });
  }

  return Response.json({ error: "Not found" }, { status: 404 });
}
