/**
 * Memory — Pulse module exposing the autonomic-memory subsystem state.
 *
 * Renders the live autonomic loop into the Pulse dashboard: cadence,
 * recent reviewer runs, dispatch history per type, pending proposal queue,
 * health status, and the current contents of both hot-layer _MEMORY.md
 * files.
 *
 * Routes:
 *   GET /api/memory          → full snapshot { state, lastRun, health, files, proposals, recentRuns[] }
 *   GET /api/memory/state    → just review-state.json contents
 *   GET /api/memory/health   → last memory-health.jsonl row
 *   GET /api/memory/runs     → last N reviewer runs with dispatch + items
 *
 * Failure modes:
 *   - Any missing source file returns null for that field (no errors thrown).
 *   - Returns a 200 with a partial payload rather than 5xx — the dashboard
 *     surfaces partials gracefully.
 *
 * Read-only: this module never writes to memory state, never invokes the
 * reviewer, never touches identity files. Observation only.
 */

import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import { claudeDir } from "../../TOOLS/lifeos-root";

const HOME = process.env.HOME || "";
const CLAUDE = join(claudeDir());
const OBS_DIR = join(CLAUDE, "LIFEOS/MEMORY/OBSERVABILITY");

const REVIEW_STATE = join(OBS_DIR, "review-state.json");
const HEALTH_LOG = join(OBS_DIR, "memory-health.jsonl");
const FIRES_LOG = join(OBS_DIR, "reviewer-fires.jsonl");
const PROPOSALS_LOG = join(OBS_DIR, "pending-proposals.jsonl");
const REVIEWER_RUNS = join(OBS_DIR, "reviewer-runs");
const PRINCIPAL_MEMORY = join(CLAUDE, "LIFEOS/USER/PRINCIPAL/PRINCIPAL_MEMORY.md");
const DA_MEMORY = join(CLAUDE, "LIFEOS/USER/DIGITAL_ASSISTANT/DA_MEMORY.md");
const CADENCE_CONFIG = join(CLAUDE, "LIFEOS/USER/CONFIG/memory-review.json");

interface ModuleState {
  running: boolean;
  startedAt: Date | null;
}

const state: ModuleState = {
  running: false,
  startedAt: null,
};

export async function start(): Promise<void> {
  state.running = true;
  state.startedAt = new Date();
}

export async function stop(): Promise<void> {
  state.running = false;
}

export function health(): { status: string; details?: Record<string, unknown> } {
  return {
    status: state.running ? "healthy" : "stopped",
    details: {
      uptime: state.startedAt
        ? Math.floor((Date.now() - state.startedAt.getTime()) / 1000)
        : 0,
      review_state_exists: existsSync(REVIEW_STATE),
      health_log_exists: existsSync(HEALTH_LOG),
    },
  };
}

function safeReadJson(path: string): any | null {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

function safeReadJsonLines(path: string, lastN: number = 50): any[] {
  try {
    if (!existsSync(path)) return [];
    const raw = readFileSync(path, "utf-8");
    const lines = raw
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    const tail = lines.slice(-lastN);
    return tail
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter((x) => x !== null);
  } catch {
    return [];
  }
}

function readMemoryFile(path: string): { entries: string[]; count: number; charsUsed: number } {
  if (!existsSync(path)) return { entries: [], count: 0, charsUsed: 0 };
  try {
    const raw = readFileSync(path, "utf-8");
    const start = raw.indexOf("<!-- BEGIN ENTRIES -->");
    const end = raw.indexOf("<!-- END ENTRIES -->");
    if (start === -1 || end === -1 || end < start) return { entries: [], count: 0, charsUsed: 0 };
    const block = raw.slice(start + "<!-- BEGIN ENTRIES -->".length, end).trim();
    if (!block) return { entries: [], count: 0, charsUsed: 0 };
    const entries = block.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    const charsUsed = entries.reduce((s, e) => s + e.length, 0);
    return { entries, count: entries.length, charsUsed };
  } catch {
    return { entries: [], count: 0, charsUsed: 0 };
  }
}

function recentReviewerRuns(n: number = 10): Array<{
  runId: string;
  ts: string;
  itemsTotal: number;
  itemsOk: number;
  itemsFailed: number;
  byType: Record<string, number>;
  itemPaths: Array<{ type: string; file: string }>;
}> {
  if (!existsSync(REVIEWER_RUNS)) return [];
  try {
    const dirs = readdirSync(REVIEWER_RUNS)
      .filter((r) => {
        try {
          return statSync(join(REVIEWER_RUNS, r)).isDirectory();
        } catch {
          return false;
        }
      })
      .sort()
      .reverse()
      .slice(0, n);
    return dirs.map((dir) => {
      const dispatchPath = join(REVIEWER_RUNS, dir, "dispatch.log");
      let itemsTotal = 0;
      let itemsOk = 0;
      let itemsFailed = 0;
      let byType: Record<string, number> = {};
      let itemPaths: Array<{ type: string; file: string }> = [];
      if (existsSync(dispatchPath)) {
        try {
          const txt = readFileSync(dispatchPath, "utf-8");
          const m = txt.match(/Items:\s*(\d+)\s*\(succeeded=(\d+)\s*failed=(\d+)\)/);
          if (m) {
            itemsTotal = parseInt(m[1]!, 10);
            itemsOk = parseInt(m[2]!, 10);
            itemsFailed = parseInt(m[3]!, 10);
          }
          const t = txt.match(/By type:\s*(\{[^}]+\})/);
          if (t) {
            try {
              byType = JSON.parse(t[1]!);
            } catch {}
          }
          const itemMatches = [...txt.matchAll(/\[\d+\]\s+OK\s+(\w+):\s+(\S+)/g)];
          itemPaths = itemMatches.map((im) => ({
            type: im[1]!,
            file: (im[2]!.split("/").pop() || im[2]!),
          }));
        } catch {}
      }
      // Convert runId timestamp to ISO
      const isoLike = dir.replace(
        /^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/,
        "$1-$2-$3T$4:$5:$6.$7Z",
      );
      return {
        runId: dir,
        ts: isoLike,
        itemsTotal,
        itemsOk,
        itemsFailed,
        byType,
        itemPaths,
      };
    });
  } catch {
    return [];
  }
}

function buildSnapshot() {
  const reviewState = safeReadJson(REVIEW_STATE) || {
    turn_count_since_last_review: 0,
    last_review_at: null,
    last_message_at: null,
    pending_review: false,
  };
  const config = safeReadJson(CADENCE_CONFIG) || {
    turn_threshold: 8,
    min_minutes_between: 30,
    idle_threshold: 2,
    confidence_threshold: 0.7,
  };
  const healthRows = safeReadJsonLines(HEALTH_LOG, 1);
  const health = healthRows.length > 0 ? healthRows[0] : null;
  const firesAll = safeReadJsonLines(FIRES_LOG, 200);
  const proposals = safeReadJsonLines(PROPOSALS_LOG, 50);
  const principal = readMemoryFile(PRINCIPAL_MEMORY);
  const da = readMemoryFile(DA_MEMORY);
  const runs = recentReviewerRuns(10);

  // Compute derived state
  let derivedState = "cold";
  const turns = reviewState.turn_count_since_last_review || 0;
  const threshold = config.turn_threshold || 8;
  if (health?.overall === "critical") derivedState = "unhealthy_critical";
  else if (health?.overall === "warn") derivedState = "unhealthy_warn";
  else if (reviewState.pending_review) derivedState = "pending";
  else if (turns >= threshold) derivedState = "waiting";
  else if (turns >= threshold / 2) derivedState = "building";
  else if (reviewState.last_review_at) derivedState = "idle_warm";
  else derivedState = "cold";

  return {
    ts: new Date().toISOString(),
    derivedState,
    cadenceConfig: config,
    reviewState,
    health,
    lastFireCount: firesAll.length,
    recentFires: firesAll.slice(-5),
    pendingProposals: proposals.filter((p: any) => p.status !== "auto-applied").length,
    autoAppliedProposals: proposals.filter((p: any) => p.status === "auto-applied").length,
    proposalsRecent: proposals.slice(-5),
    principalMemory: principal,
    daMemory: da,
    recentRuns: runs,
  };
}

export async function handleRequest(req: Request, pathname: string): Promise<Response | null> {
  if (req.method !== "GET") return null;

  if (pathname === "/api/memory" || pathname === "/api/memory/") {
    const snap = buildSnapshot();
    return new Response(JSON.stringify(snap, null, 2), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  if (pathname === "/api/memory/state") {
    const reviewState = safeReadJson(REVIEW_STATE) || {};
    return new Response(JSON.stringify(reviewState, null, 2), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  if (pathname === "/api/memory/health") {
    const healthRows = safeReadJsonLines(HEALTH_LOG, 1);
    return new Response(JSON.stringify(healthRows[0] || null, null, 2), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  if (pathname === "/api/memory/runs") {
    const runs = recentReviewerRuns(20);
    return new Response(JSON.stringify(runs, null, 2), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  return null;
}
