/**
 * Oura source module — OFFICIAL API v2 (OAuth2; PATs were removed by Oura Dec 2025).
 * Provenance: https://cloud.ouraring.com/v2/docs + /docs/authentication, verified 2026-06-11.
 */
import { getClaudeDir, displayPath } from "../Paths";
import type { Ctx, SourceResult, TokenStore } from "./types";
import {
  dayKeyLA,
  isoNowLA,
  loadTokens,
  saveTokens,
  timedFetch,
  writeDayFile,
} from "./store";

const BASE = "https://api.ouraring.com/v2/usercollection";
const TOKEN_URL = "https://api.ouraring.com/oauth/token";
const FETCH_TIMEOUT_MS = 15_000;
const WINDOW_DAYS = 7;
const REFRESH_SKEW_S = 120;

const ENDPOINTS = [
  "daily_sleep",
  "daily_readiness",
  "daily_activity",
  "sleep",
  "daily_stress",
  "daily_spo2",
] as const;

type Endpoint = (typeof ENDPOINTS)[number];
type OuraItem = Record<string, unknown>;

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

/** Pure: bucket endpoint items by their LA day key. Items without a resolvable day are dropped, never thrown. */
export function groupOuraByDay(items: OuraItem[]): Record<string, OuraItem[]> {
  const byDay: Record<string, OuraItem[]> = {};
  for (const item of items) {
    let day = str(item.day);
    if (day === null) {
      const ts = str(item.timestamp) ?? str(item.bedtime_end);
      const parsed = ts === null ? Number.NaN : Date.parse(ts);
      day = Number.isFinite(parsed) ? dayKeyLA(parsed) : null;
    }
    if (day === null || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      continue;
    }
    (byDay[day] ??= []).push(item);
  }
  return byDay;
}

/** Pure: flatten one day's endpoint buckets into the day-file metrics shape. */
export function summarizeOuraDay(
  byEndpoint: Partial<Record<Endpoint, OuraItem[]>>,
): Record<string, unknown> {
  const dailySleep = byEndpoint.daily_sleep?.[0];
  const readiness = byEndpoint.daily_readiness?.[0];
  const activity = byEndpoint.daily_activity?.[0];
  const spo2 = byEndpoint.daily_spo2?.[0];
  const sessions = byEndpoint.sleep ?? [];

  let durationS: number | null = null;
  let efficiency: number | null = null;
  let avgHr: number | null = null;
  let avgHrv: number | null = null;
  for (const s of sessions) {
    const d = num(s.total_sleep_duration);
    if (d !== null && (durationS === null || d > durationS)) {
      durationS = d;
      efficiency = num(s.efficiency);
      avgHr = num(s.average_heart_rate);
      avgHrv = num(s.average_hrv);
    }
  }

  const spo2Pct =
    spo2 !== undefined &&
    typeof spo2.spo2_percentage === "object" &&
    spo2.spo2_percentage !== null
      ? num((spo2.spo2_percentage as OuraItem).average)
      : null;

  return {
    oura_sleep_score: dailySleep === undefined ? null : num(dailySleep.score),
    oura_readiness_score: readiness === undefined ? null : num(readiness.score),
    oura_activity_score: activity === undefined ? null : num(activity.score),
    steps: activity === undefined ? null : num(activity.steps),
    sleep_duration_h: durationS === null ? null : Math.round((durationS / 3600) * 100) / 100,
    sleep_efficiency: efficiency,
    avg_sleep_hr: avgHr,
    avg_sleep_hrv: avgHrv,
    spo2_avg: spo2Pct,
    raw: byEndpoint,
  };
}

function unconfigured(message: string, startedAt: number): SourceResult {
  return {
    source: "oura",
    status: "unconfigured",
    records: 0,
    lastError: message,
    lastSuccess: null,
    ms: Date.now() - startedAt,
  };
}

async function refreshTokens(ctx: Ctx, tokens: TokenStore): Promise<TokenStore | null> {
  const clientId = ctx.env.OURA_CLIENT_ID;
  const clientSecret = ctx.env.OURA_CLIENT_SECRET;
  const oura = tokens.oura;
  if (clientId === undefined || clientSecret === undefined || oura === undefined) {
    return null;
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: oura.refresh_token,
    client_id: clientId,
    client_secret: clientSecret,
  });

  try {
    const response = await timedFetch(
      TOKEN_URL,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      },
      FETCH_TIMEOUT_MS,
    );
    if (!response.ok) {
      return null;
    }
    const json = (await response.json()) as OuraItem;
    const accessToken = str(json.access_token);
    const refreshToken = str(json.refresh_token) ?? oura.refresh_token;
    const expiresIn = num(json.expires_in) ?? 86_400;
    if (accessToken === null) {
      return null;
    }
    tokens.oura = {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    };
    await saveTokens(ctx, tokens);
    return tokens;
  } catch {
    return null;
  }
}

async function fetchEndpoint(
  endpoint: Endpoint,
  token: string,
  startDate: string,
  endDate: string,
): Promise<{ items: OuraItem[]; status: number }> {
  const url = `${BASE}/${endpoint}?start_date=${startDate}&end_date=${endDate}`;
  const response = await timedFetch(
    url,
    { headers: { Authorization: `Bearer ${token}` } },
    FETCH_TIMEOUT_MS,
  );
  if (!response.ok) {
    return { items: [], status: response.status };
  }
  const json = (await response.json()) as OuraItem;
  const data = Array.isArray(json.data) ? (json.data as OuraItem[]) : [];
  return { items: data, status: response.status };
}

export async function pull(ctx: Ctx): Promise<SourceResult> {
  const startedAt = Date.now();
  if (
    str(ctx.env.OURA_CLIENT_ID) === null ||
    str(ctx.env.OURA_CLIENT_SECRET) === null
  ) {
    return unconfigured(`OURA_CLIENT_ID / OURA_CLIENT_SECRET not set in ${displayPath(getClaudeDir())}/.env`, startedAt);
  }

  let tokens = await loadTokens(ctx);
  if (tokens.oura === undefined) {
    return unconfigured("no Oura tokens — run: bun LIFEOS/TOOLS/HealthSync.ts auth oura", startedAt);
  }

  let oura = tokens.oura;
  if (oura.expires_at <= Math.floor(Date.now() / 1000) + REFRESH_SKEW_S) {
    const refreshed = await refreshTokens(ctx, tokens);
    if (refreshed === null || refreshed.oura === undefined) {
      return unconfigured("Oura token refresh failed — re-run: bun LIFEOS/TOOLS/HealthSync.ts auth oura", startedAt);
    }
    tokens = refreshed;
    oura = refreshed.oura;
  }

  const endDate = dayKeyLA(ctx.now.getTime());
  const startDate = dayKeyLA(ctx.now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  let token = oura.access_token;
  let results = await Promise.all(
    ENDPOINTS.map((endpoint) => fetchEndpoint(endpoint, token, startDate, endDate)),
  );

  if (results.some((r) => r.status === 401)) {
    const refreshed = await refreshTokens(ctx, tokens);
    if (refreshed === null || refreshed.oura === undefined) {
      return unconfigured("Oura rejected the token (401) and refresh failed — re-run auth oura", startedAt);
    }
    token = refreshed.oura.access_token;
    results = await Promise.all(
      ENDPOINTS.map((endpoint) => fetchEndpoint(endpoint, token, startDate, endDate)),
    );
  }

  // Auth/scope failures on ANY endpoint fail the whole source before any write
  // (Cato finding: a missing scope returning 403 on one endpoint must surface
  // as misconfiguration, not silently pass as ok with partial data).
  const authFailures = ENDPOINTS.filter(
    (_endpoint, i) => results[i].status === 401 || results[i].status === 403,
  );
  if (authFailures.length > 0) {
    return {
      source: "oura",
      status: "failed",
      records: 0,
      lastError: `Oura auth/scope rejection (401/403) on: ${authFailures.join(", ")} — check app scopes, re-run auth oura`,
      lastSuccess: null,
      ms: Date.now() - startedAt,
    };
  }

  const transientFailures = ENDPOINTS.filter(
    (_endpoint, i) => results[i].status !== 200 && results[i].status !== 0,
  );
  if (results.every((r) => r.items.length === 0) && transientFailures.length > 0) {
    return {
      source: "oura",
      status: "failed",
      records: 0,
      lastError: `Oura API HTTP failures on: ${transientFailures.join(", ")}`,
      lastSuccess: null,
      ms: Date.now() - startedAt,
    };
  }

  const dayBuckets: Record<string, Partial<Record<Endpoint, OuraItem[]>>> = {};
  let records = 0;
  ENDPOINTS.forEach((endpoint, index) => {
    const grouped = groupOuraByDay(results[index].items);
    for (const [day, items] of Object.entries(grouped)) {
      (dayBuckets[day] ??= {})[endpoint] = items;
      records += items.length;
    }
  });

  for (const [day, byEndpoint] of Object.entries(dayBuckets)) {
    await writeDayFile(ctx, "oura", day, summarizeOuraDay(byEndpoint));
  }

  return {
    source: "oura",
    status: "ok",
    records,
    lastError: null,
    lastSuccess: isoNowLA(ctx.now),
    ms: Date.now() - startedAt,
    note: transientFailures.length > 0 ? `partial: transient failures on ${transientFailures.join(", ")}` : undefined,
  };
}
