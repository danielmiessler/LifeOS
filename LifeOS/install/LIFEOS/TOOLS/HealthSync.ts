#!/usr/bin/env bun
/**
 * HealthSync foundation CLI.
 *
 * Usage:
 *   bun LIFEOS/TOOLS/HealthSync.ts pull
 *   bun LIFEOS/TOOLS/HealthSync.ts pull --source oura
 *   bun LIFEOS/TOOLS/HealthSync.ts status
 *   bun LIFEOS/TOOLS/HealthSync.ts current
 *   bun LIFEOS/TOOLS/HealthSync.ts auth oura
 */
import { getClaudeDir, getLifeosDir } from "./Paths";
import { join } from "node:path";
import type {
  Ctx,
  CurrentJson,
  LastNight,
  SourceName,
  SourceResult,
  SourceState,
  SourceStatus,
  SyncState,
  TokenStore,
} from "./healthsync/types";
import {
  appendJsonl,
  buildCtx,
  dayKeyLA,
  isoNowLA,
  loadState,
  loadTokens,
  saveState,
  saveTokens,
  timedFetch,
  withTimeout,
  writeJson,
} from "./healthsync/store";

type SourcePull = (ctx: Ctx) => Promise<SourceResult>;
type SourceModule = { pull: SourcePull };
type CliCommand = "pull" | "status" | "current" | "auth";

const HOME = process.env.HOME || "";
const PREFIX = "[HealthSync]";
const SOURCE_NAMES: readonly SourceName[] = ["oura", "eightsleep", "apple", "function"];
const CURRENT_PATH = join(getClaudeDir(), "LIFEOS", "USER", "HEALTH", "current.json");
const HEALTHSYNC_LOG_PATH = join(
  getLifeosDir(),
  "MEMORY",
  "OBSERVABILITY",
  "healthsync.jsonl",
);
const FRESH_MS = 25 * 60 * 60 * 1000;
const RUN_TIMEOUT_MS = 60_000;
const FETCH_TIMEOUT_MS = 15_000;
const AUTH_PORT = 8474;
// Oura rejects the literal 127.0.0.1 form with 400 invalid_request; localhost
// is accepted (302) and resolves to the same loopback the callback server binds.
const AUTH_REDIRECT_URI = `http://localhost:${AUTH_PORT}/callback`;

function usage(): string {
  return [
    "Usage:",
    "  bun LIFEOS/TOOLS/HealthSync.ts pull [--source oura|eightsleep|apple|function]",
    "  bun LIFEOS/TOOLS/HealthSync.ts status",
    "  bun LIFEOS/TOOLS/HealthSync.ts current",
    "  bun LIFEOS/TOOLS/HealthSync.ts auth oura",
  ].join("\n");
}

function log(message: string): void {
  console.log(`${PREFIX} ${message}`);
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function parseSource(value: string): SourceName {
  if ((SOURCE_NAMES as readonly string[]).includes(value)) {
    return value as SourceName;
  }
  throw new Error(`invalid source: ${value}`);
}

function selectedSources(args: string[]): SourceName[] {
  const sourceAt = args.indexOf("--source");
  if (sourceAt === -1) {
    return [...SOURCE_NAMES];
  }

  const value = args[sourceAt + 1];
  if (value === undefined) {
    throw new Error("--source requires a value");
  }
  return [parseSource(value)];
}

function emptyResult(source: SourceName, status: SourceStatus, lastError: string | null): SourceResult {
  return {
    source,
    status,
    records: 0,
    lastError,
    lastSuccess: null,
    ms: 0,
  };
}

async function modulePull(
  source: SourceName,
  loader: () => Promise<SourceModule>,
  ctx: Ctx,
): Promise<SourceResult> {
  const startedAt = Date.now();
  try {
    const mod = await loader();
    // True per-source bound (Cato finding): per-fetch 15s timeouts don't cap a
    // module doing sequential login + data calls (or a hung brctl).
    const result = await withTimeout(mod.pull(ctx), 25_000, `${source} pull`);
    return {
      ...result,
      ms: result.ms || Date.now() - startedAt,
    };
  } catch (error) {
    const message = errorMessage(error);
    const isMissingModule =
      message.includes("Cannot find module") ||
      message.includes("Module not found") ||
      message.includes("ENOENT") ||
      message.includes("ResolveMessage");

    if (isMissingModule) {
      return {
        ...emptyResult(source, "unconfigured", "module not yet built"),
        ms: Date.now() - startedAt,
      };
    }

    return {
      ...emptyResult(source, "failed", message),
      ms: Date.now() - startedAt,
    };
  }
}

async function loadSourceModule(source: SourceName): Promise<SourceModule> {
  const modulePath = `./healthsync/${source}.ts`;
  return (await import(modulePath)) as SourceModule;
}

const SOURCES: Record<SourceName, SourcePull> = {
  oura: (ctx: Ctx) => modulePull("oura", () => loadSourceModule("oura"), ctx),
  eightsleep: (ctx: Ctx) => modulePull("eightsleep", () => loadSourceModule("eightsleep"), ctx),
  apple: (ctx: Ctx) => modulePull("apple", () => loadSourceModule("apple"), ctx),
  function: (ctx: Ctx) => modulePull("function", () => loadSourceModule("function"), ctx),
};

async function isolatedPull(source: SourceName, ctx: Ctx): Promise<SourceResult> {
  const startedAt = Date.now();
  try {
    return await SOURCES[source](ctx);
  } catch (error) {
    return {
      source,
      status: "failed",
      records: 0,
      lastError: errorMessage(error),
      lastSuccess: null,
      ms: Date.now() - startedAt,
    };
  }
}

function mergeState(prev: SyncState, results: SourceResult[]): SyncState {
  const next: SyncState = { ...prev };
  for (const result of results) {
    const oldState: SourceState = next[result.source] ?? {
      lastSuccess: null,
      lastError: null,
      lastHash: null,
    };
    next[result.source] = {
      lastSuccess: result.status === "ok" ? result.lastSuccess : oldState.lastSuccess,
      lastError: result.lastError,
      lastHash: result.lastHash === undefined ? oldState.lastHash : result.lastHash,
      // Lockout protection for unofficial APIs: count consecutive failed logins.
      consecutiveAuthFailures: result.authAttempted === true
        ? (result.authFailed === true ? (oldState.consecutiveAuthFailures ?? 0) + 1 : 0)
        : oldState.consecutiveAuthFailures ?? 0,
      lastAuthAttempt: result.authAttempted === true
        ? new Date().toISOString()
        : oldState.lastAuthAttempt ?? null,
    };
  }
  return next;
}

function blankLastNight(): LastNight {
  return {
    sleep_duration_h: null,
    sleep_efficiency: null,
    oura_sleep_score: null,
    oura_readiness_score: null,
    eightsleep_score: null,
    bed_temp_c: null,
  };
}

async function guardedJson(path: string): Promise<Record<string, unknown> | null> {
  try {
    const file = Bun.file(path);
    if (!(await file.exists())) {
      return null;
    }
    const parsed = await file.json();
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nestedRecord(obj: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const value = obj[key];
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

/** Read a source's metrics for the most recent day (within `lookback`) that has a non-null sleep signal. */
async function mostRecentSleepMetrics(
  ctx: Ctx,
  source: SourceName,
  day: string,
  sleepKey: string,
  lookback: number,
): Promise<Record<string, unknown> | null> {
  const baseMs = Date.parse(`${day}T12:00:00Z`);
  for (let i = 0; i <= lookback; i++) {
    const probe = Number.isFinite(baseMs)
      ? dayKeyLA(baseMs - i * 24 * 60 * 60 * 1000)
      : day;
    const file = await guardedJson(join(ctx.dataDir, source, `${probe}.json`));
    const metrics = file === null ? null : nestedRecord(file, "metrics");
    if (metrics !== null && numberOrNull(metrics[sleepKey]) !== null) {
      return metrics;
    }
  }
  return null;
}

async function buildLastNight(ctx: Ctx, day: string): Promise<LastNight> {
  const lastNight = blankLastNight();
  // Today's sleep often hasn't synced from the device yet; fall back to the most
  // recent night that actually has a sleep score (up to 3 days back).
  const ouraMetrics = await mostRecentSleepMetrics(ctx, "oura", day, "oura_sleep_score", 3);
  const eightMetrics = await mostRecentSleepMetrics(ctx, "eightsleep", day, "eightsleep_score", 3);

  if (ouraMetrics !== null) {
    lastNight.sleep_duration_h = numberOrNull(ouraMetrics.sleep_duration_h);
    lastNight.sleep_efficiency = numberOrNull(ouraMetrics.sleep_efficiency);
    lastNight.oura_sleep_score = numberOrNull(ouraMetrics.oura_sleep_score);
    lastNight.oura_readiness_score = numberOrNull(ouraMetrics.oura_readiness_score);
  }

  if (eightMetrics !== null) {
    lastNight.eightsleep_score = numberOrNull(eightMetrics.eightsleep_score);
    lastNight.bed_temp_c = numberOrNull(eightMetrics.bed_temp_c);
  }

  return lastNight;
}

function resultRecord(
  results: SourceResult[],
  priorSources: Record<string, unknown> | null,
): Record<SourceName, SourceResult> {
  const bySource = Object.fromEntries(
    SOURCE_NAMES.map((source) => [source, emptyResult(source, "unconfigured", null)]),
  ) as Record<SourceName, SourceResult>;
  // Single-source pulls must not clobber the other sources' last real status
  // (Cato finding 2026-06-11): seed from the prior snapshot before overlaying.
  if (priorSources !== null) {
    for (const source of SOURCE_NAMES) {
      const prior = priorSources[source];
      if (typeof prior === "object" && prior !== null && !Array.isArray(prior)) {
        bySource[source] = prior as SourceResult;
      }
    }
  }
  for (const result of results) {
    bySource[result.source] = result;
  }
  return bySource;
}

async function writeCurrent(ctx: Ctx, results: SourceResult[]): Promise<CurrentJson> {
  const day = dayKeyLA(ctx.now.getTime());
  const prior = await guardedJson(CURRENT_PATH);
  const current: CurrentJson = {
    generated_at: isoNowLA(ctx.now),
    day,
    last_night: await buildLastNight(ctx, day),
    sources: resultRecord(results, prior === null ? null : nestedRecord(prior, "sources")),
  };
  await writeJson(CURRENT_PATH, current);
  return current;
}

async function runPull(args: string[]): Promise<number> {
  const ctx = await buildCtx();
  const sources = selectedSources(args);
  const state = await loadState(ctx);
  const run = async (): Promise<SourceResult[]> => {
    const settled = await Promise.allSettled(sources.map((source) => isolatedPull(source, ctx)));
    return settled.map((item, index) => {
      if (item.status === "fulfilled") {
        return item.value;
      }
      return {
        source: sources[index],
        status: "failed",
        records: 0,
        lastError: errorMessage(item.reason),
        lastSuccess: null,
        ms: 0,
      };
    });
  };
  const results = await withTimeout(run(), RUN_TIMEOUT_MS, "health sync run");
  const nextState = mergeState(state, results);

  await writeCurrent(ctx, results);
  await saveState(ctx, nextState);
  await appendJsonl(HEALTHSYNC_LOG_PATH, {
    at: isoNowLA(ctx.now),
    command: "pull",
    sources,
    results,
  });

  for (const result of results) {
    log(
      `${result.source}: ${result.status}; records=${result.records}; ms=${result.ms}; error=${result.lastError ?? "none"}`,
    );
  }

  return 0;
}

function isFresh(result: SourceResult, nowMs: number): boolean {
  if (result.status !== "ok" || result.lastSuccess === null) {
    return false;
  }
  const lastSuccessMs = Date.parse(result.lastSuccess);
  return Number.isFinite(lastSuccessMs) && nowMs - lastSuccessMs < FRESH_MS;
}

async function runStatus(): Promise<number> {
  const ctx = await buildCtx();
  const current = await guardedJson(CURRENT_PATH);
  if (current === null) {
    log("current.json missing");
    return 1;
  }

  const rawSources = nestedRecord(current, "sources");
  if (rawSources === null) {
    log("current.json has no sources object");
    return 1;
  }

  let allFresh = true;
  for (const source of SOURCE_NAMES) {
    const rawResult = rawSources[source];
    if (typeof rawResult !== "object" || rawResult === null || Array.isArray(rawResult)) {
      log(`${source}: missing`);
      allFresh = false;
      continue;
    }

    const result = rawResult as SourceResult;
    const notConfigured = result.status === "unconfigured" || result.status === "awaiting-first-export";
    if (notConfigured) {
      log(`${source}: ${result.status}; fresh=n/a (not set up — see LIFEOS/USER/HEALTH/SHORTCUT_SETUP.md)`);
      continue;
    }
    const fresh = isFresh(result, ctx.now.getTime());
    log(`${source}: ${result.status}; fresh=${fresh ? "yes" : "no"}`);
    allFresh = allFresh && fresh;
  }

  return allFresh ? 0 : 1;
}

async function runCurrent(): Promise<number> {
  const current = await guardedJson(CURRENT_PATH);
  if (current === null) {
    log("current.json missing");
    return 1;
  }
  console.log(JSON.stringify(current, null, 2));
  return 0;
}

function requiredEnv(ctx: Ctx, name: string): string {
  const value = ctx.env[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(`missing required env var: ${name}`);
  }
  return value;
}

async function openBrowser(url: string): Promise<void> {
  const proc = Bun.spawn(["open", url], {
    stdout: "ignore",
    stderr: "ignore",
  });
  await proc.exited;
}

async function parseJsonResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as unknown;
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    throw new Error(`OAuth server returned invalid JSON with status ${response.status}`);
  }
  throw new Error(`OAuth server returned non-object JSON with status ${response.status}`);
}

function tokenString(obj: Record<string, unknown>, key: string): string {
  const value = obj[key];
  if (typeof value !== "string" || value === "") {
    throw new Error(`OAuth response missing ${key}`);
  }
  return value;
}

function tokenNumber(obj: Record<string, unknown>, key: string): number | null {
  const value = obj[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function exchangeOuraCode(ctx: Ctx, code: string): Promise<TokenStore> {
  const clientId = requiredEnv(ctx, "OURA_CLIENT_ID");
  const clientSecret = requiredEnv(ctx, "OURA_CLIENT_SECRET");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: AUTH_REDIRECT_URI,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const response = await timedFetch(
    "https://api.ouraring.com/oauth/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
    FETCH_TIMEOUT_MS,
  );

  if (!response.ok) {
    throw new Error(`Oura OAuth exchange failed with HTTP ${response.status}`);
  }

  const json = await parseJsonResponse(response);
  const expiresIn = tokenNumber(json, "expires_in") ?? 86_400;
  const tokens = await loadTokens(ctx);
  tokens.oura = {
    access_token: tokenString(json, "access_token"),
    refresh_token: tokenString(json, "refresh_token"),
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
  };
  return tokens;
}

async function waitForOuraCode(): Promise<string> {
  let server: ReturnType<typeof Bun.serve> | undefined;
  let resolveCode: (code: string) => void;
  let rejectCode: (error: Error) => void;
  const codePromise = new Promise<string>((resolve, reject) => {
    resolveCode = resolve;
    rejectCode = reject;
  });

  server = Bun.serve({
    hostname: "127.0.0.1",
    port: AUTH_PORT,
    fetch(req: Request): Response {
      const url = new URL(req.url);
      if (url.pathname !== "/callback") {
        return new Response("Not found", { status: 404 });
      }

      const error = url.searchParams.get("error");
      if (error !== null) {
        rejectCode(new Error(`Oura OAuth failed: ${error}`));
        return new Response("Authentication failed. Return to the terminal.", {
          status: 400,
          headers: { "Content-Type": "text/plain" },
        });
      }

      const code = url.searchParams.get("code");
      if (code === null || code === "") {
        rejectCode(new Error("Oura OAuth callback did not include a code"));
        return new Response("Missing code. Return to the terminal.", {
          status: 400,
          headers: { "Content-Type": "text/plain" },
        });
      }

      resolveCode(code);
      return new Response("HealthSync Oura auth complete. Return to the terminal.", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    },
  });

  try {
    // 5 min: a cold Oura web login (email → password/magic-link → consent) can
    // run well past 2 min, especially when the operator must sign in first.
    return await withTimeout(codePromise, 300_000, "Oura OAuth");
  } finally {
    server.stop(true);
  }
}

async function runAuth(args: string[]): Promise<number> {
  const source = args[0];
  if (source !== "oura") {
    throw new Error("only `auth oura` is implemented");
  }

  const ctx = await buildCtx();
  const clientId = requiredEnv(ctx, "OURA_CLIENT_ID");
  const authUrl = new URL("https://cloud.ouraring.com/oauth/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", AUTH_REDIRECT_URI);
  // Valid v2 scopes only — "sleep" is not a scope; daily covers daily_* endpoints,
  // session covers sleep sessions, spo2 covers daily_spo2.
  authUrl.searchParams.set("scope", "email personal daily heartrate workout tag session spo2");

  log("opening Oura authorization page; credential values will not be printed");
  await openBrowser(authUrl.toString());
  const code = await waitForOuraCode();
  const tokens = await exchangeOuraCode(ctx, code);
  await saveTokens(ctx, tokens);
  log("Oura tokens saved");
  return 0;
}

async function main(): Promise<number> {
  const [rawCommand, ...args] = Bun.argv.slice(2);
  const command = rawCommand as CliCommand | undefined;

  if (command === "pull") {
    return runPull(args);
  }
  if (command === "status") {
    return runStatus();
  }
  if (command === "current") {
    return runCurrent();
  }
  if (command === "auth") {
    return runAuth(args);
  }

  console.log(usage());
  return command === undefined ? 0 : 1;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(`${PREFIX} ${errorMessage(error)}`);
    process.exitCode = 1;
  });
