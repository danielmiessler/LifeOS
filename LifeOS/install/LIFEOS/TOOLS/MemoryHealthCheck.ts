#!/usr/bin/env bun
/**
 * MemoryHealthCheck.ts — Autonomic memory subsystem health check.
 *
 * Detects regressions that would silently kill the autonomic memory loop:
 *   - hook code files missing on disk
 *   - hooks de-registered from settings.system.json (the source of truth)
 *   - hooks de-registered from settings.json (the live runtime)
 *   - last reviewer run too stale (default 7 days)
 *   - review-state.json missing or unreadable
 *   - reviewer subprocess never fired (count is 0 historically)
 *
 * Output: JSON to stdout. Exit 0 = healthy; exit 1 = at least one warning;
 * exit 2 = at least one CRITICAL (subsystem is structurally broken).
 *
 * Appends one row per invocation to MEMORY/OBSERVABILITY/memory-health.jsonl
 * so health is observable over time, not just at point-in-time.
 *
 * Used by:
 *   - hooks/MemoryHealthGate.hook.ts (Stop chain — runs on every turn end)
 *   - CLI:  bun LIFEOS/TOOLS/MemoryHealthCheck.ts
 */

import { existsSync, readFileSync, appendFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { getClaudeDir } from "./Paths";

const CLAUDE = getClaudeDir();
const HOOKS_DIR = join(CLAUDE, "hooks");
const TOOLS_DIR = join(CLAUDE, "LIFEOS/TOOLS");
const OBS_DIR = join(CLAUDE, "LIFEOS/MEMORY/OBSERVABILITY");

const SETTINGS_LIVE = join(CLAUDE, "settings.json");
const SETTINGS_SYSTEM = join(CLAUDE, "settings.system.json");
const REVIEW_STATE = join(OBS_DIR, "review-state.json");
const HEALTH_LOG = join(OBS_DIR, "memory-health.jsonl");
const REVIEWER_RUNS = join(OBS_DIR, "reviewer-runs");

const REQUIRED_HOOKS = [
  "MemoryReviewTrigger.hook.ts",
  "MemoryReviewFire.hook.ts",
  "MemoryHealthGate.hook.ts",
  // The chat-visibility surface. Its registration was silently clobbered by a
  // concurrent-session settings.json rewrite on 2026-06-06 (787f66ef7) and sat
  // dead for 5 days — change-only output made death look like healthy silence.
  // Required-hook status means a future clobber goes critical and nags in chat.
  "MemoryDeltaSurface.hook.ts",
];

const REQUIRED_TOOLS = [
  "MemorySystem.ts",
  "MemoryReviewer.ts",
  "MemoryWriter.ts",
  "MemoryRetriever.ts",
  "MemoryTypes.ts",
  "MemoryStatus.ts",
  "MemoryHealthCheck.ts",
  "MutationTier.ts",
];

const STALE_REVIEW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type Severity = "ok" | "warn" | "critical";

interface Finding {
  id: string;
  severity: Severity;
  message: string;
  detail?: any;
}

const findings: Finding[] = [];

function add(id: string, severity: Severity, message: string, detail?: any) {
  findings.push({ id, severity, message, ...(detail !== undefined ? { detail } : {}) });
}

// CHECK 1: hook code files present on disk
for (const h of REQUIRED_HOOKS) {
  const p = join(HOOKS_DIR, h);
  if (!existsSync(p)) {
    add(`hook-file-missing:${h}`, "critical", `Required hook file missing on disk: ${h}`, { path: p });
  } else {
    add(`hook-file-present:${h}`, "ok", `Hook file present: ${h}`);
  }
}

// CHECK 2: tool files present on disk
for (const t of REQUIRED_TOOLS) {
  const p = join(TOOLS_DIR, t);
  if (!existsSync(p)) {
    add(`tool-file-missing:${t}`, "critical", `Required tool file missing on disk: ${t}`, { path: p });
  } else {
    add(`tool-file-present:${t}`, "ok", `Tool file present: ${t}`);
  }
}

// CHECK 3: hooks registered in settings.system.json (source of truth)
function checkHooksInFile(filePath: string, label: string) {
  if (!existsSync(filePath)) {
    add(`settings-missing:${label}`, "critical", `${label} not found at ${filePath}`);
    return;
  }
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch (err) {
    add(`settings-unreadable:${label}`, "critical", `${label} unreadable: ${(err as Error).message}`);
    return;
  }
  for (const h of REQUIRED_HOOKS) {
    if (!raw.includes(h)) {
      add(`settings-hook-missing:${label}:${h}`, "critical",
          `${h} NOT registered in ${label}. Regression source.`,
          { file: filePath, hook: h });
    } else {
      add(`settings-hook-present:${label}:${h}`, "ok",
          `${h} registered in ${label}.`);
    }
  }
}

checkHooksInFile(SETTINGS_SYSTEM, "settings.system.json");
checkHooksInFile(SETTINGS_LIVE, "settings.json");

// CHECK 3b: delta-surface liveness — curation writing while the chat surface
// is dead is exactly the 5-day silent failure of 2026-06-06→11. The surface
// hook touches a heartbeat file on every invocation; if the newest autonomic
// memory write is >24h newer than the heartbeat, the surface isn't running.
{
  const HEARTBEAT_FILE = join(CLAUDE, "LIFEOS/MEMORY/STATE/delta-surface-heartbeat");
  const WRITES_FILE = join(OBS_DIR, "memory-writes.jsonl");
  try {
    let lastWriteTs = 0;
    if (existsSync(WRITES_FILE)) {
      const tail = readFileSync(WRITES_FILE, "utf-8").trim().split("\n").slice(-50);
      for (const l of tail) {
        try {
          const r = JSON.parse(l);
          if (r.updated_by === "MemorySystem.add" && r.ts) lastWriteTs = Math.max(lastWriteTs, Date.parse(r.ts));
        } catch { /* skip bad row */ }
      }
    }
    if (lastWriteTs > 0) {
      const hbTs = existsSync(HEARTBEAT_FILE)
        ? Date.parse(readFileSync(HEARTBEAT_FILE, "utf-8").trim())
        : 0;
      if (!hbTs || lastWriteTs - hbTs > 24 * 60 * 60 * 1000) {
        add("delta-surface-dead", "critical",
            "Curation is writing memory but MemoryDeltaSurface has not surfaced anything in >24h — chat visibility is dead (check settings registration).",
            { lastWrite: new Date(lastWriteTs).toISOString(), heartbeat: hbTs ? new Date(hbTs).toISOString() : "never" });
      } else {
        add("delta-surface-alive", "ok", "Delta surface heartbeat is current relative to memory writes.");
      }
    }
  } catch (err) {
    add("delta-surface-check-error", "warn", `Liveness check failed: ${(err as Error).message}`);
  }
}

// CHECK 4: review-state.json exists and is readable
let lastReviewAt: string | null = null;
if (!existsSync(REVIEW_STATE)) {
  add("state-missing", "warn", "review-state.json does not exist yet — reviewer never fired.");
} else {
  try {
    const state = JSON.parse(readFileSync(REVIEW_STATE, "utf-8"));
    lastReviewAt = state.last_review_at || null;
    add("state-readable", "ok", "review-state.json readable.", {
      turn_count: state.turn_count_since_last_review,
      last_review_at: state.last_review_at,
      pending_review: state.pending_review,
    });
  } catch (err) {
    add("state-corrupt", "critical", `review-state.json corrupt: ${(err as Error).message}`);
  }
}

// CHECK 5: last reviewer run not too stale
if (lastReviewAt) {
  const ageMs = Date.now() - new Date(lastReviewAt).getTime();
  if (ageMs > STALE_REVIEW_MS) {
    const ageDays = Math.round(ageMs / (24 * 60 * 60 * 1000));
    add("review-stale", "warn",
        `Last reviewer fire was ${ageDays} days ago — autonomic loop may be stuck.`,
        { last_review_at: lastReviewAt, age_days: ageDays });
  } else {
    add("review-fresh", "ok", `Last reviewer fire is recent (${lastReviewAt}).`);
  }
}

// CHECK 6: at least one historical reviewer run exists
if (existsSync(REVIEWER_RUNS)) {
  try {
    const runs = readdirSync(REVIEWER_RUNS).filter(r => statSync(join(REVIEWER_RUNS, r)).isDirectory());
    if (runs.length === 0) {
      add("no-historical-runs", "warn", "reviewer-runs/ directory exists but is empty — reviewer has never run successfully.");
    } else {
      add("historical-runs-present", "ok", `${runs.length} historical reviewer run(s) captured.`, { count: runs.length });
    }
  } catch {}
} else {
  add("no-runs-dir", "warn", "reviewer-runs/ directory does not exist yet.");
}

// CHECK 7: memory files present
const PRINCIPAL_MEM = join(CLAUDE, "LIFEOS/USER/PRINCIPAL/PRINCIPAL_MEMORY.md");
const DA_MEM = join(CLAUDE, "LIFEOS/USER/DIGITAL_ASSISTANT/DA_MEMORY.md");
if (!existsSync(PRINCIPAL_MEM)) add("principal-memory-missing", "critical", "PRINCIPAL_MEMORY.md missing.");
else add("principal-memory-present", "ok", "PRINCIPAL_MEMORY.md present.");
if (!existsSync(DA_MEM)) add("da-memory-missing", "critical", "DA_MEMORY.md missing.");
else add("da-memory-present", "ok", "DA_MEMORY.md present.");

// CHECK 8: cap-pressure — the exact failure class that sat silent for two weeks.
// A file AT cap can't accept new memory; near-cap means the next curation must
// consolidate or it jams. (Eviction now works, so this is a warning not a freeze.)
function entryCount(path: string): number {
  if (!existsSync(path)) return 0;
  const m = readFileSync(path, "utf-8").match(/<!-- BEGIN ENTRIES -->([\s\S]*?)<!-- END ENTRIES -->/);
  return m ? m[1].split("\n").map(l => l.trim()).filter(l => l.length > 0).length : 0;
}
for (const [label, path] of [["principal", PRINCIPAL_MEM], ["da", DA_MEM]] as const) {
  const n = entryCount(path);
  // Full is only a WARN now — eviction works, so the next curation consolidates.
  // The CRITICAL signal is CHECK 9 (a reviewer actually dropping a fact on EAT_CAP).
  if (n >= 46) add(`cap-pressure:${label}`, "warn", `${label} memory at ${n}/48 — next curation must consolidate to make room.`, { count: n });
  else add(`cap-ok:${label}`, "ok", `${label} memory has headroom (${n}/48).`);
}

// CHECK 9: reviewer failures — recent runs that errored or hit EAT_CAP. An
// EAT_CAP in a dispatch is the cap-jam actively dropping a real fact on the floor.
if (existsSync(REVIEWER_RUNS)) {
  try {
    const recent = readFileSync(REVIEWER_RUNS, "utf-8").trim().split("\n").slice(-5)
      .map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const failed = recent.filter((r: any) => r.ok === false || r.parse_ok === false);
    const capDrops = recent.filter((r: any) =>
      Array.isArray(r?.dispatch_summary?.failures) &&
      r.dispatch_summary.failures.some((f: any) => String(f?.error || "").includes("EAT_CAP")));
    if (capDrops.length > 0) add("reviewer-eat-cap", "critical", `${capDrops.length} of last 5 reviewer runs dropped a fact on EAT_CAP — cap-jam actively losing memory.`, { runs: capDrops.length });
    if (failed.length >= 3) add("reviewer-failing", "warn", `${failed.length} of last 5 reviewer runs failed (error/parse) — curation may be stalling.`, { failed: failed.length });
    else if (failed.length === 0 && capDrops.length === 0) add("reviewer-healthy", "ok", "Recent reviewer runs completed cleanly.");
  } catch { /* non-fatal */ }
}

// SUMMARY
const criticals = findings.filter(f => f.severity === "critical");
const warns = findings.filter(f => f.severity === "warn");
const oks = findings.filter(f => f.severity === "ok");

const overall: Severity = criticals.length > 0 ? "critical" : warns.length > 0 ? "warn" : "ok";

const report = {
  ts: new Date().toISOString(),
  overall,
  counts: { critical: criticals.length, warn: warns.length, ok: oks.length },
  findings: findings.filter(f => f.severity !== "ok"),
  ok_summary: oks.map(o => o.id),
};

// Append to observability log
try {
  if (!existsSync(OBS_DIR)) mkdirSync(OBS_DIR, { recursive: true });
  appendFileSync(HEALTH_LOG, JSON.stringify(report) + "\n");
} catch (err) {
  // non-fatal
}

console.log(JSON.stringify(report, null, 2));

if (overall === "critical") process.exit(2);
if (overall === "warn") process.exit(1);
process.exit(0);
