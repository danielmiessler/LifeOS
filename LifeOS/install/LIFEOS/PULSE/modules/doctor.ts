/**
 * Doctor Pulse module — read-only "System Health" surface over the advisory
 * caches written by LIFEOS/TOOLS/Doctor.ts. Holds ZERO truth of its own: it
 * reads the capability manifest + heartbeat and shells the hook reconciler,
 * then serves whatever they say. The dashboard renders the result.
 *
 * Diagnostic register only — no scores, no percentages, no meters. The manifest
 * is a TTL'd cache, so past-TTL live entries are flagged stale; a dead checker
 * (heartbeat > 7d) is surfaced loudly for the UI to render in red.
 *
 * Route: GET /api/doctor → { manifest, heartbeat, reconcile }
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { claudeDir } from "../../TOOLS/lifeos-root";

const MODULE_NAME = "doctor";
const CONFIG_ROOT = process.env.CLAUDE_CONFIG_DIR || join(claudeDir());
const LIFEOS_DIR = join(CONFIG_ROOT, "LIFEOS");
const STATE_DIR = join(LIFEOS_DIR, "MEMORY", "STATE");
const MANIFEST_PATH = join(STATE_DIR, "capabilities.json");
const HEARTBEAT_PATH = join(STATE_DIR, "doctor-heartbeat.json");
const DOCTOR_TS = join(LIFEOS_DIR, "TOOLS", "Doctor.ts");
const SEVEN_DAYS_MS = 7 * 24 * 3_600_000;
const RECONCILE_TIMEOUT_MS = 10_000;
const RECONCILE_CACHE_MS = 30_000;

const state = { running: false };

// Display titles for known capabilities. Mirrors the CAPS registry in Doctor.ts
// (display-only; the manifest itself stores just id + state). Unknown ids fall
// back to a title-cased id so a newly-added capability still renders.
const CAP_TITLES: Record<string, string> = {
  codex: "Cross-vendor audit",
  interceptor: "Browser verification",
  cloudflare: "Scheduled cloud flows",
  voice: "Voice notifications",
};

interface CapResult {
  state: "live" | "broken" | "declined" | "stale";
  checkedAt: string;
  ttlHours: number;
  detail: string;
  fixCmd: string | null;
  probeClass?: "offline" | "network";
}

function titleFor(id: string): string {
  return CAP_TITLES[id] || id.replace(/(^|[-_])(\w)/g, (_, __, c) => " " + c.toUpperCase()).trim();
}

function readManifest() {
  if (!existsSync(MANIFEST_PATH)) {
    return {
      present: false as const,
      hint: `no doctor run yet — bun ${DOCTOR_TS}`,
      capabilities: [] as unknown[],
    };
  }
  try {
    const raw = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as {
      updatedAt?: string;
      capabilities?: Record<string, CapResult>;
    };
    const now = Date.now();
    const capabilities = Object.entries(raw.capabilities || {}).map(([id, r]) => {
      // Stale = a live entry whose last probe is older than its TTL. Declined is
      // never stale (it's a permanent opt-out), broken stays broken.
      const stale =
        r.state === "live" && now - Date.parse(r.checkedAt) > r.ttlHours * 3_600_000;
      return {
        id,
        title: titleFor(id),
        state: r.state,
        detail: r.detail,
        fixCmd: r.fixCmd ?? null,
        checkedAt: r.checkedAt,
        ttlHours: r.ttlHours,
        probeClass: r.probeClass ?? "offline",
        stale,
      };
    });
    return { present: true as const, updatedAt: raw.updatedAt ?? null, capabilities };
  } catch {
    return {
      present: false as const,
      hint: `capabilities manifest unreadable — re-run: bun ${DOCTOR_TS}`,
      capabilities: [] as unknown[],
    };
  }
}

function readHeartbeat() {
  if (!existsSync(HEARTBEAT_PATH)) {
    return { present: false as const, hint: `no doctor run yet — bun ${DOCTOR_TS}` };
  }
  try {
    const raw = JSON.parse(readFileSync(HEARTBEAT_PATH, "utf8")) as {
      ranAt?: string;
      network?: boolean;
    };
    const ranAtMs = raw.ranAt ? Date.parse(raw.ranAt) : NaN;
    const ageMs = Number.isFinite(ranAtMs) ? Date.now() - ranAtMs : null;
    return {
      present: true as const,
      ranAt: raw.ranAt ?? null,
      network: !!raw.network,
      ageMs,
      // A dead checker must be loud: > 7 days without a run is a red condition.
      stale7d: ageMs != null && ageMs > SEVEN_DAYS_MS,
    };
  } catch {
    return { present: false as const, hint: `heartbeat unreadable — re-run: bun ${DOCTOR_TS}` };
  }
}

interface Reconcile {
  unwired: string[];
  missing: string[];
  note: string;
}
let reconcileCache: { at: number; value: Reconcile } | null = null;

function readReconcile(): Reconcile {
  if (reconcileCache && Date.now() - reconcileCache.at < RECONCILE_CACHE_MS) {
    return reconcileCache.value;
  }
  const fallback: Reconcile = {
    unwired: [],
    missing: [],
    note: "reconcile unavailable (Doctor.ts not runnable on this install)",
  };
  try {
    const proc = Bun.spawnSync(["bun", DOCTOR_TS, "--reconcile"], {
      stdout: "pipe",
      stderr: "ignore",
      timeout: RECONCILE_TIMEOUT_MS,
    });
    const out = new TextDecoder().decode(proc.stdout).trim();
    const value = JSON.parse(out) as Reconcile;
    reconcileCache = { at: Date.now(), value };
    return value;
  } catch {
    return fallback;
  }
}

function read() {
  return {
    manifest: readManifest(),
    heartbeat: readHeartbeat(),
    reconcile: readReconcile(),
  };
}

export async function start(): Promise<void> {
  state.running = true;
  console.log(`[${MODULE_NAME}] started`);
}
export async function stop(): Promise<void> {
  state.running = false;
}
export function health(): { status: string; details?: Record<string, unknown> } {
  const hb = readHeartbeat();
  return {
    status: state.running ? "healthy" : "stopped",
    details: { heartbeat: hb.present ? (hb.stale7d ? "stale" : "fresh") : "never" },
  };
}
export async function handleRequest(_req: Request, pathname: string): Promise<Response | null> {
  const sub = pathname.replace(/^\/api\/doctor/, "") || "/";
  if (sub === "/" || sub === "/state") return Response.json(read());
  if (sub === "/status" || sub === "/health") return Response.json(health());
  return null;
}
