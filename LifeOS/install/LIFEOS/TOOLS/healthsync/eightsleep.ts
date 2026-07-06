/**
 * Eight Sleep source module.
 *
 * FRAGILE-API: reverse-engineered, NO official public API. Auth + endpoints
 * from the maintained lukas-clarke/eight_sleep Home Assistant integration
 * (pyEight constants), verified 2026-06-11. The client_id/client_secret below
 * are the Eight Sleep mobile app's public OAuth constants shipped by that
 * open-source integration — they are not personal credentials. The vendor can
 * rotate them or the endpoints at any time; on breakage, re-research the HA
 * integration first.
 */
import { getClaudeDir, displayPath } from "../Paths";
import type { Ctx, SourceResult } from "./types";
import {
  authCooldownUntil,
  dayKeyLA,
  isoNowLA,
  loadState,
  loadTokens,
  saveTokens,
  timedFetch,
  writeDayFile,
} from "./store";

const AUTH_URL = "https://auth-api.8slp.net/v1/tokens";
const CLIENT_API = "https://client-api.8slp.net/v1";
// Public mobile-app OAuth constants (not personal secrets). Overridable via
// EIGHTSLEEP_CLIENT_ID / EIGHTSLEEP_CLIENT_SECRET in .env so a vendor rotation
// is a config edit, not a code change.
const APP_CLIENT_ID = "0894c7f33bb94800a03f1f4df13a4f38";
const APP_CLIENT_SECRET = "f0954a3ed5763ba3d06834c73731a32f15f168f47d4f164751275def86db0c76";
const USER_AGENT = "okhttp/4.9.3";
const FETCH_TIMEOUT_MS = 15_000;
const WINDOW_DAYS = 7;
const REFRESH_SKEW_S = 120;

type Json = Record<string, unknown>;

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function rec(value: unknown): Json | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Json)
    : null;
}

function fahrenheitLooking(value: number): boolean {
  return value > 45;
}

/** Pure: extract the metrics we track from one trends day object (raw preserved). */
export function summarizeEightSleepDay(day: Json): Record<string, unknown> {
  const score =
    num(day.score) ??
    num(rec(day.sleepQualityScore)?.total) ??
    null;
  const durationS = num(day.sleepDuration) ?? num(day.presenceDuration);
  let bedTemp = num(day.tempBedC);
  if (bedTemp === null) {
    const sessions = Array.isArray(day.sessions) ? (day.sessions as unknown[]) : [];
    for (const session of sessions) {
      const s = rec(session);
      if (s !== null) {
        bedTemp = num(s.tempBedC) ?? num(rec(s.bedTemperature)?.average);
        if (bedTemp !== null) break;
      }
    }
  }
  if (bedTemp !== null && fahrenheitLooking(bedTemp)) {
    bedTemp = Math.round(((bedTemp - 32) * 5 / 9) * 10) / 10;
  }

  return {
    eightsleep_score: score,
    sleep_duration_h: durationS === null ? null : Math.round((durationS / 3600) * 100) / 100,
    bed_temp_c: bedTemp,
    raw: day,
  };
}

function unconfigured(message: string, startedAt: number): SourceResult {
  return {
    source: "eightsleep",
    status: "unconfigured",
    records: 0,
    lastError: message,
    lastSuccess: null,
    ms: Date.now() - startedAt,
  };
}

function failed(message: string, startedAt: number): SourceResult {
  return {
    source: "eightsleep",
    status: "failed",
    records: 0,
    lastError: message,
    lastSuccess: null,
    ms: Date.now() - startedAt,
  };
}

type AuthOutcome =
  | { ok: true; token: string; userId: string; attempted: boolean }
  | { ok: false; error: string; attempted: boolean };

async function authenticate(ctx: Ctx): Promise<AuthOutcome> {
  const email = str(ctx.env.EIGHTSLEEP_EMAIL);
  const password = str(ctx.env.EIGHTSLEEP_PASSWORD);
  if (email === null || password === null) {
    return { ok: false, error: `EIGHTSLEEP_EMAIL / EIGHTSLEEP_PASSWORD not set in ${displayPath(getClaudeDir())}/.env`, attempted: false };
  }

  const tokens = await loadTokens(ctx);
  const cached = tokens.eightsleep;
  if (cached !== undefined && cached.expires_at > Math.floor(Date.now() / 1000) + REFRESH_SKEW_S) {
    return { ok: true, token: cached.access_token, userId: cached.userId, attempted: false };
  }

  const cooldownUntil = authCooldownUntil(await loadState(ctx), "eightsleep", ctx.now.getTime());
  if (cooldownUntil !== null) {
    return {
      ok: false,
      error: `auth-cooldown until ${cooldownUntil} after repeated login failures — check EIGHTSLEEP_* creds (SSO/2FA accounts cannot use password login)`,
      attempted: false,
    };
  }

  let response: Response;
  try {
    response = await timedFetch(
      AUTH_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": USER_AGENT,
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: str(ctx.env.EIGHTSLEEP_CLIENT_ID) ?? APP_CLIENT_ID,
          client_secret: str(ctx.env.EIGHTSLEEP_CLIENT_SECRET) ?? APP_CLIENT_SECRET,
          grant_type: "password",
          username: email,
          password,
        }),
      },
      FETCH_TIMEOUT_MS,
    );
  } catch (error) {
    return { ok: false, error: `Eight Sleep auth request failed: ${error instanceof Error ? error.message : String(error)}`, attempted: true };
  }

  if (!response.ok) {
    return { ok: false, error: `Eight Sleep auth HTTP ${response.status} (credential or rotated-client issue)`, attempted: true };
  }

  let json: Json;
  try {
    json = (await response.json()) as Json;
  } catch {
    return { ok: false, error: "Eight Sleep auth returned non-JSON", attempted: true };
  }

  const accessToken = str(json.access_token);
  const userId = str(json.userId) ?? str(json.main_id) ?? str(rec(json.user)?.userId);
  const expiresIn = num(json.expires_in) ?? num(json.expiry_duration) ?? 3600;
  if (accessToken === null || userId === null) {
    return { ok: false, error: "Eight Sleep auth response missing access_token/userId (API may have changed shape)", attempted: true };
  }

  tokens.eightsleep = {
    access_token: accessToken,
    userId,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
  };
  await saveTokens(ctx, tokens);
  return { ok: true, token: accessToken, userId, attempted: true };
}

export async function pull(ctx: Ctx): Promise<SourceResult> {
  const startedAt = Date.now();
  const auth = await authenticate(ctx);
  if (!auth.ok) {
    const base = auth.error.includes("not set")
      ? unconfigured(auth.error, startedAt)
      : failed(auth.error, startedAt);
    return { ...base, authAttempted: auth.attempted, authFailed: auth.attempted };
  }

  const to = dayKeyLA(ctx.now.getTime());
  const from = dayKeyLA(ctx.now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const url =
    `${CLIENT_API}/users/${auth.userId}/trends` +
    `?tz=America/Los_Angeles&from=${from}&to=${to}` +
    `&include-main=false&include-all-sessions=true&model-version=v2`;

  let response: Response;
  try {
    response = await timedFetch(
      url,
      {
        headers: {
          Authorization: `Bearer ${auth.token}`,
          "User-Agent": USER_AGENT,
          Accept: "application/json",
        },
      },
      FETCH_TIMEOUT_MS,
    );
  } catch (error) {
    return failed(
      `Eight Sleep trends request failed: ${error instanceof Error ? error.message : String(error)}`,
      startedAt,
    );
  }

  if (!response.ok) {
    return failed(`Eight Sleep trends HTTP ${response.status}`, startedAt);
  }

  let json: Json;
  try {
    json = (await response.json()) as Json;
  } catch {
    return failed("Eight Sleep trends returned non-JSON", startedAt);
  }

  const days = Array.isArray(json.days)
    ? (json.days as unknown[])
    : Array.isArray(rec(json.result)?.days)
      ? (rec(json.result)?.days as unknown[])
      : [];

  let records = 0;
  for (const rawDay of days) {
    const day = rec(rawDay);
    if (day === null) continue;
    const dayKey = str(day.day) ?? str(day.date);
    if (dayKey === null || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) continue;
    await writeDayFile(ctx, "eightsleep", dayKey, summarizeEightSleepDay(day));
    records += 1;
  }

  return {
    source: "eightsleep",
    status: "ok",
    records,
    lastError: null,
    lastSuccess: isoNowLA(ctx.now),
    ms: Date.now() - startedAt,
    authAttempted: auth.attempted,
    authFailed: false,
  };
}
