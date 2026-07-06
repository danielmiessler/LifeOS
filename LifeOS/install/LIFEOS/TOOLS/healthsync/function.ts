/**
 * Function Health source module.
 *
 * FRAGILE-API: reverse-engineered, NO official public API. Endpoints from
 * daveremy/function-health-mcp docs/api-reference.md, verified 2026-06-11.
 * Firebase-backed member API; the `fe-app-version` header matters. Labs change
 * ~2x/year so this pulls at most once per 24h. On breakage, fall back to
 * manual export ingest and re-research.
 */
import { join } from "node:path";
import type { Biomarker, Ctx, LabsFile, SourceResult } from "./types";
import { authCooldownUntil, dayKeyLA, isoNowLA, loadState, timedFetch, writeJson } from "./store";
import { displayPath, getClaudeDir } from "../Paths";

const BASE = "https://production-member-app-mid-lhuqotpy2a-ue.a.run.app/api/v1";
const FETCH_TIMEOUT_MS = 15_000;
const MIN_PULL_INTERVAL_MS = 24 * 60 * 60 * 1000;

const DATA_HEADERS_STATIC = {
  "fe-app-version": "0.84.0",
  "x-backend-skip-cache": "true",
  "Content-Type": "application/json",
} as const;

type Json = Record<string, unknown>;

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function rec(value: unknown): Json | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Json)
    : null;
}

function firstArray(json: Json): unknown[] {
  for (const key of ["results", "data", "biomarkerResults", "report"]) {
    if (Array.isArray(json[key])) return json[key] as unknown[];
  }
  return [];
}

/** Pure: normalize one results-report item into a Biomarker (defensive across shapes). */
export function normalizeBiomarker(item: Json): Biomarker | null {
  const name =
    str(item.biomarkerName) ??
    str(item.name) ??
    str(rec(item.biomarker)?.name);
  if (name === null) return null;

  const current = rec(item.currentResult) ?? item;
  const value =
    num(current.calculatedResult) ??
    num(current.displayResult) ??
    str(current.displayResult);
  const inRange = typeof current.inRange === "boolean" ? current.inRange : null;

  return {
    name,
    value: value ?? null,
    unit: str(current.units) ?? str(item.units),
    in_range: inRange,
    ref_low: num(item.questRefRangeLow) ?? num(rec(item.biomarker)?.questRefRangeLow),
    ref_high: num(item.questRefRangeHigh) ?? num(rec(item.biomarker)?.questRefRangeHigh),
    collected_at: str(current.dateOfService) ?? str(item.dateOfService),
  };
}

function unconfigured(message: string, startedAt: number): SourceResult {
  return {
    source: "function",
    status: "unconfigured",
    records: 0,
    lastError: message,
    lastSuccess: null,
    ms: Date.now() - startedAt,
  };
}

function failed(message: string, startedAt: number): SourceResult {
  return {
    source: "function",
    status: "failed",
    records: 0,
    lastError: message,
    lastSuccess: null,
    ms: Date.now() - startedAt,
  };
}

export async function pull(ctx: Ctx): Promise<SourceResult> {
  const startedAt = Date.now();
  const email = str(ctx.env.FUNCTION_HEALTH_EMAIL);
  const password = str(ctx.env.FUNCTION_HEALTH_PASSWORD);
  if (email === null || password === null) {
    return unconfigured(`FUNCTION_HEALTH_EMAIL / FUNCTION_HEALTH_PASSWORD not set in ${displayPath(getClaudeDir())}/.env`, startedAt);
  }

  const state = await loadState(ctx);
  const prior = state.function ?? { lastSuccess: null, lastError: null, lastHash: null };
  if (prior.lastSuccess !== null) {
    const lastMs = Date.parse(prior.lastSuccess);
    if (Number.isFinite(lastMs) && ctx.now.getTime() - lastMs < MIN_PULL_INTERVAL_MS) {
      return {
        source: "function",
        status: "ok",
        records: 0,
        lastError: null,
        lastSuccess: prior.lastSuccess,
        ms: Date.now() - startedAt,
        note: "skipped-fresh (labs pulled within 24h)",
      };
    }
  }

  const cooldownUntil = authCooldownUntil(state, "function", ctx.now.getTime());
  if (cooldownUntil !== null) {
    return failed(
      `auth-cooldown until ${cooldownUntil} after repeated login failures — check FUNCTION_HEALTH_* creds (SSO/2FA accounts cannot use password login)`,
      startedAt,
    );
  }

  let login: Response;
  try {
    login = await timedFetch(
      `${BASE}/login`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      },
      FETCH_TIMEOUT_MS,
    );
  } catch (error) {
    return { ...failed(`Function login request failed: ${error instanceof Error ? error.message : String(error)}`, startedAt), authAttempted: true, authFailed: true };
  }

  if (!login.ok) {
    return {
      ...failed(`Function login HTTP ${login.status} (bad creds, rotated endpoint, or Firebase reCAPTCHA challenge on non-app clients)`, startedAt),
      authAttempted: true,
      authFailed: true,
    };
  }

  let loginJson: Json;
  try {
    loginJson = (await login.json()) as Json;
  } catch {
    return { ...failed("Function login returned non-JSON", startedAt), authAttempted: true, authFailed: true };
  }

  const idToken = str(loginJson.idToken);
  if (idToken === null) {
    return { ...failed("Function login response missing idToken (API may have changed shape)", startedAt), authAttempted: true, authFailed: true };
  }

  let report: Response;
  try {
    report = await timedFetch(
      `${BASE}/results-report`,
      {
        headers: {
          Authorization: `Bearer ${idToken}`,
          ...DATA_HEADERS_STATIC,
        },
      },
      FETCH_TIMEOUT_MS,
    );
  } catch (error) {
    return failed(`Function results request failed: ${error instanceof Error ? error.message : String(error)}`, startedAt);
  }

  if (!report.ok) {
    return failed(`Function results-report HTTP ${report.status}`, startedAt);
  }

  let reportJson: Json;
  try {
    reportJson = (await report.json()) as Json;
  } catch {
    return failed("Function results-report returned non-JSON", startedAt);
  }

  const biomarkers: Biomarker[] = [];
  for (const item of firstArray(reportJson)) {
    const itemRec = rec(item);
    if (itemRec === null) continue;
    const normalized = normalizeBiomarker(itemRec);
    if (normalized !== null) biomarkers.push(normalized);
  }

  if (biomarkers.length === 0) {
    return failed("Function results-report parsed but yielded zero biomarkers (shape drift?)", startedAt);
  }

  const labs: LabsFile = {
    fetched_at: isoNowLA(ctx.now),
    biomarkers,
  };
  await writeJson(join(ctx.dataDir, "function", "labs.json"), labs);
  await writeJson(join(ctx.dataDir, "function", "labs-raw.json"), reportJson);
  // Append-only history: panels that later drop out of /results-report are never lost.
  await writeJson(join(ctx.dataDir, "function", `labs-${dayKeyLA(ctx.now.getTime())}.json`), labs);

  return {
    source: "function",
    status: "ok",
    records: biomarkers.length,
    lastError: null,
    lastSuccess: isoNowLA(ctx.now),
    ms: Date.now() - startedAt,
    authAttempted: true,
    authFailed: false,
  };
}
