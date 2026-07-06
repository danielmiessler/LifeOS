import { createHash } from "node:crypto";
import { appendFileSync, chmodSync, mkdirSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import type {
  Ctx,
  DayFile,
  SourceName,
  SyncState,
  TokenStore,
} from "./types";
import { getClaudeDir } from "../Paths";

const ENV_PATH = join(getClaudeDir(), ".env");
const STATE_DIR = join(getClaudeDir(), "LIFEOS", "MEMORY", "STATE");
const DATA_DIR = join(getClaudeDir(), "LIFEOS", "USER", "HEALTH", "DATA");
const OBS_DIR = join(getClaudeDir(), "LIFEOS", "MEMORY", "OBSERVABILITY");
const TOKENS_PATH = join(STATE_DIR, "healthsync-tokens.json");
const STATE_PATH = join(STATE_DIR, "healthsync-state.json");

function ensureParent(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
}

function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  if (trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function dayKeyLA(epochMs: number): string {
  if (!Number.isFinite(epochMs)) {
    throw new Error("epochMs must be finite");
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(epochMs));

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  const key = `${year}-${month}-${day}`;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) {
    throw new Error("failed to build LA day key");
  }

  return key;
}

export function isoNowLA(d: Date): string {
  // Convert the LA wall-clock parts, then compare them with UTC to derive the
  // correct DST-aware offset for that instant.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const getPart = (type: string): string => {
    const value = parts.find((part) => part.type === type)?.value;
    if (value === undefined) {
      throw new Error(`missing ${type} while formatting LA timestamp`);
    }
    return value;
  };

  const year = getPart("year");
  const month = getPart("month");
  const day = getPart("day");
  const hour = getPart("hour") === "24" ? "00" : getPart("hour");
  const minute = getPart("minute");
  const second = getPart("second");
  const asUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  const offsetMinutes = Math.round((asUtc - d.getTime()) / 60_000);
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const offsetHour = String(Math.floor(abs / 60)).padStart(2, "0");
  const offsetMinute = String(abs % 60).padStart(2, "0");

  return `${year}-${month}-${day}T${hour}:${minute}:${second}${sign}${offsetHour}:${offsetMinute}`;
}

export function parseEnv(text: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) {
      continue;
    }

    const cleaned = line.startsWith("export ") ? line.slice("export ".length).trim() : line;
    const equalsAt = cleaned.indexOf("=");
    if (equalsAt <= 0) {
      continue;
    }

    const key = cleaned.slice(0, equalsAt).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      continue;
    }

    env[key] = stripQuotes(cleaned.slice(equalsAt + 1));
  }
  return env;
}

export async function readEnvFile(path: string): Promise<Record<string, string>> {
  try {
    const file = Bun.file(path);
    if (!(await file.exists())) {
      return {};
    }
    return parseEnv(await file.text());
  } catch {
    return {};
  }
}

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export async function readJsonSafe<T>(path: string, fallback: T): Promise<T> {
  try {
    const file = Bun.file(path);
    if (!(await file.exists())) {
      return fallback;
    }
    return (await file.json()) as T;
  } catch {
    return fallback;
  }
}

export async function writeJson(path: string, obj: unknown): Promise<void> {
  ensureParent(path);
  // Atomic: write-temp + rename so a crash mid-write never corrupts tokens/state.
  const tmp = `${path}.tmp-${process.pid}`;
  await Bun.write(tmp, `${JSON.stringify(obj, null, 2)}\n`);
  renameSync(tmp, path);
}

export async function writeJson0600(path: string, obj: unknown): Promise<void> {
  await writeJson(path, obj);
  chmodSync(path, 0o600);
}

export async function loadState(ctx: Ctx): Promise<SyncState> {
  return readJsonSafe<SyncState>(ctx.statePath, {});
}

export async function saveState(ctx: Ctx, s: SyncState): Promise<void> {
  await writeJson(ctx.statePath, s);
}

export async function loadTokens(ctx: Ctx): Promise<TokenStore> {
  return readJsonSafe<TokenStore>(ctx.tokensPath, {});
}

export async function saveTokens(ctx: Ctx, t: TokenStore): Promise<void> {
  await writeJson0600(ctx.tokensPath, t);
}

export async function writeDayFile(
  ctx: Ctx,
  source: SourceName,
  dayKey: string,
  metrics: Record<string, unknown>,
): Promise<void> {
  const dayFile: DayFile = {
    schema: 1,
    source,
    fetched_at: isoNowLA(ctx.now),
    metrics,
  };
  await writeJson(join(ctx.dataDir, source, `${dayKey}.json`), dayFile);
}

export async function appendJsonl(path: string, obj: unknown): Promise<void> {
  ensureParent(path);
  appendFileSync(path, `${JSON.stringify(obj)}\n`);
}

export async function buildCtx(): Promise<Ctx> {
  ensureDir(STATE_DIR);
  ensureDir(DATA_DIR);
  ensureDir(OBS_DIR);

  return {
    env: await readEnvFile(ENV_PATH),
    now: new Date(),
    stateDir: STATE_DIR,
    dataDir: DATA_DIR,
    obsDir: OBS_DIR,
    tokensPath: TOKENS_PATH,
    statePath: STATE_PATH,
  };
}

const AUTH_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const AUTH_FAILURE_THRESHOLD = 3;

/**
 * Lockout protection for unofficial vendor APIs: after 3 consecutive failed
 * logins, refuse further attempts for 6h (max ~4 login attempts/day) so the
 * hourly launchd job can never hammer an auth endpoint into flagging the
 * account. Returns the ISO time the cooldown lifts, or null if clear.
 */
export function authCooldownUntil(
  state: SyncState,
  source: SourceName,
  nowMs: number,
): string | null {
  const s = state[source];
  const failures = s?.consecutiveAuthFailures ?? 0;
  const last = s?.lastAuthAttempt ?? null;
  if (failures < AUTH_FAILURE_THRESHOLD || last === null) {
    return null;
  }
  const lastMs = Date.parse(last);
  if (!Number.isFinite(lastMs)) {
    return null;
  }
  const until = lastMs + AUTH_COOLDOWN_MS;
  return nowMs >= until ? null : new Date(until).toISOString();
}

export async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
  });

  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

export async function timedFetch(
  url: string,
  init: RequestInit | undefined,
  ms: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}
