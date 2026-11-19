/**
 * Workflows V2 — the pure logic behind the Cue-style page's two new endpoints.
 *
 *   Run Now guard   which records may be started from the page, and the exact
 *                   `launchctl kickstart` argv for one (ISC-10, A-2).
 *   Live state      which com.lifeos.* labels launchd has running right now.
 *   Activity        one row per real run, read from the per-run logs the
 *                   sources already keep, falling back to each record's last
 *                   evidence; nothing is ever invented (ISC-9, A-4).
 *
 * No I/O here: the Pulse module (workflows.ts) reads files and spawns
 * processes, and passes the text in. That keeps every rule testable with
 * synthesized fixtures and lets the page import these types without Bun.
 *
 * Contract for records: LIFEOS/WORKFLOWS/types.ts.
 */

import type { Inventory, WorkflowRecord } from "../../WORKFLOWS/types.ts";

/* ── Run Now guard ─────────────────────────────────────────────────────── */

/** The only label shape the page may ever start. */
export const LABEL_RE = /^com\.lifeos\.[A-Za-z0-9._-]+$/;
const UID_RE = /^\d+$/;

export type RunEligibility =
  | { allowed: true; label: string }
  | { allowed: false; reason: string };

const REFUSED_BY_RUNTIME: Record<Exclude<WorkflowRecord["runtime"], "launchd" | "agent-job">, string> = {
  skill: "Skill intents run inside a session, not from this page.",
  systemd: "This is a systemd user timer; start it with systemctl --user start <name>.service.",
  "pulse-cron": "This runs inside the Pulse daemon's own scheduler, so there is no launchd label to start.",
  cloud: "This runs on Cloudflare. There is no safe local trigger for it.",
  "project-cron": "This is a cron in a project's Cloudflare deploy. There is no safe local trigger for it.",
  workflow: "Typed workflows run from their CLI: bun LIFEOS/WORKFLOWS/workflow.ts run <name>.",
};

/** Reason shown for any record the live endpoint does not list (skills). */
export const DEFAULT_REFUSAL = REFUSED_BY_RUNTIME.skill;

/**
 * The label an agent job's plist runs under, read from `alsoInstalledAs`
 * ("com.lifeos.job.<id> · ~/Library/LaunchAgents/…plist"). Null when absent.
 */
export function agentJobLabel(r: WorkflowRecord): string | null {
  if (!r.alsoInstalledAs) return null;
  const label = r.alsoInstalledAs.split(" · ")[0]?.trim() ?? "";
  return label.length > 0 ? label : null;
}

/** The launchd label a record runs under, when it has one. */
export function launchdLabel(r: WorkflowRecord): string | null {
  if (r.runtime === "launchd") return r.name;
  if (r.runtime === "agent-job") return agentJobLabel(r);
  return null;
}

/**
 * Whether Run Now may start this record. Allowed only for a scheduled launchd
 * record, or an agent job whose com.lifeos.job.* plist is loaded. Everything
 * else is refused with one plain sentence the page shows on the disabled button.
 */
export function runEligibility(r: WorkflowRecord): RunEligibility {
  if (r.runtime !== "launchd" && r.runtime !== "agent-job") return { allowed: false, reason: REFUSED_BY_RUNTIME[r.runtime] };
  if (r.runtime === "launchd" && r.trigger.kind === "daemon") {
    return { allowed: false, reason: "A daemon is already meant to be running. Starting it again would mean killing it first, and this page never kills a run." };
  }
  if (r.runtime === "launchd" && r.trigger.kind !== "schedule") {
    return { allowed: false, reason: "An on-demand launchd service starts when something asks for it, not from this page." };
  }
  const label = launchdLabel(r);
  if (!label) return { allowed: false, reason: "No com.lifeos.job plist schedules this agent job, so there is nothing to start." };
  if (!LABEL_RE.test(label)) return { allowed: false, reason: `"${label}" is not a com.lifeos.* launchd label.` };
  if (r.runtime === "agent-job" && label !== `com.lifeos.job.${r.name}`) {
    return { allowed: false, reason: `The plist label "${label}" does not match this job's id.` };
  }
  if (!r.enabled) return { allowed: false, reason: "This workflow is disabled." };
  if (r.installed !== "loaded") return { allowed: false, reason: `launchd does not have it loaded (${r.installed}), so there is nothing to start.` };
  return { allowed: true, label };
}

export type RunDecision =
  | { ok: true; record: WorkflowRecord; label: string }
  | { ok: false; status: 400 | 403 | 404; reason: string };

/** Resolve a request body's id against the CURRENT inventory. Never trusts a label from the client. */
export function decideRun(inv: Inventory, id: unknown): RunDecision {
  if (typeof id !== "string" || id.length === 0 || id.length > 300) return { ok: false, status: 400, reason: "The request needs a workflow id." };
  const record = inv.records.find((r) => r.id === id);
  if (!record) return { ok: false, status: 404, reason: `No workflow with id "${id}" is in the current inventory.` };
  const e = runEligibility(record);
  if (!e.allowed) return { ok: false, status: 403, reason: e.reason };
  return { ok: true, record, label: e.label };
}

/**
 * The argv that starts one launchd job. Always an array (never a shell
 * string), always without `-k`: kickstarting a job that is already running is
 * a no-op, and killing an in-flight run is exactly what this page must not do.
 */
export function kickstartArgv(uid: string, label: string): string[] {
  if (!UID_RE.test(uid)) throw new Error(`uid "${uid}" is not numeric`);
  if (!LABEL_RE.test(label)) throw new Error(`label "${label}" is not a com.lifeos.* label`);
  return ["launchctl", "kickstart", `gui/${uid}/${label}`];
}

/* ── Live state ───────────────────────────────────────────────────────── */

/** `launchctl list` → label → pid (null when loaded but not running). Header and junk lines are skipped. */
export function parseLaunchctlList(text: string): Map<string, number | null> {
  const out = new Map<string, number | null>();
  for (const line of text.split("\n")) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 3) continue;
    const [pidText, , label] = parts;
    if (!LABEL_RE.test(label)) continue;
    const pid = /^\d+$/.test(pidText) ? Number(pidText) : null;
    out.set(label, pid !== null && pid > 0 ? pid : null);
  }
  return out;
}

export interface LiveState {
  generatedAt: string;
  /** Eligibility per non-skill record id. Records not listed are refused with `defaultReason`. */
  runnable: Record<string, RunEligibility>;
  defaultReason: string;
  /** Records whose launchd label has a live process right now. */
  running: Array<{ id: string; label: string; pid: number }>;
  /** False when `launchctl list` could not be read, so `running` is not evidence of anything. */
  launchctlRead: boolean;
}

export function buildLiveState(inv: Inventory, launchctl: string | null, now: Date): LiveState {
  const runnable: Record<string, RunEligibility> = {};
  const running: LiveState["running"] = [];
  const pids = launchctl == null ? new Map<string, number | null>() : parseLaunchctlList(launchctl);
  for (const r of inv.records) {
    if (r.runtime === "skill") continue;
    runnable[r.id] = runEligibility(r);
    const label = launchdLabel(r);
    const pid = label ? pids.get(label) : undefined;
    if (label && typeof pid === "number") running.push({ id: r.id, label, pid });
  }
  return { generatedAt: now.toISOString(), runnable, defaultReason: DEFAULT_REFUSAL, running, launchctlRead: launchctl != null };
}

/* ── Activity ─────────────────────────────────────────────────────────── */

export type ActivityStatus = "ok" | "error" | "running" | "incomplete" | "skipped" | "unknown";

export interface ActivityRow {
  /** Unique, stable within one response. */
  key: string;
  recordId: string;
  /** Sort key: when the run started, or the only time the source recorded. */
  at: string;
  startedAt: string | null;
  endedAt: string | null;
  durationMs: number | null;
  status: ActivityStatus;
  /** "run-log": a per-run history line. "evidence": the record's last-run evidence, the only run the source keeps. */
  origin: "run-log" | "evidence";
  /** File the row was read from, home shown as ~. */
  source: string | null;
  /** Error text, or a note on what the source could and could not say. */
  detail: string | null;
  /** Event names logged between start and end, in order (run-log only). */
  events: string[];
  dryRun: boolean;
  /** Typed-workflow ledger run id, when the row came from the v2 ledger; the key for its step values. */
  runId?: string | null;
  /** What kind of trigger started the run: a v2 trigger type for ledger rows, the record trigger kind otherwise. */
  trigger?: string | null;
  /** True when any step of the run hit its timeout. */
  timedOut?: boolean;
  /** Per-step status and timing from the ledger, in ledger order. Never a value. */
  steps?: ActivityStep[];
  /** The run's data class; decides whether its step values were stored. */
  dataClass?: string | null;
}

export interface ActivityStep {
  id: string;
  status: string;
  attempts: number;
  startedAt: string | null;
  durationMs: number | null;
  error: string | null;
  timedOut: boolean;
}

export interface ActivityResponse {
  generatedAt: string;
  rows: ActivityRow[];
  /** Rows before the limit was applied. */
  total: number;
  truncated: boolean;
  /** Per-run history files read, and how many lines in each could not be used. */
  logs: Array<{ recordId: string; path: string; rows: number; skippedLines: number }>;
  errors: Array<{ source: string; message: string }>;
}

/** A run-log line this old with no run_end is treated as a run that died, not one still going. */
export const RUNNING_STALE_MS = 2 * 60 * 60_000;
const MAX_EVENTS = 24;

const isIso = (v: unknown): v is string => typeof v === "string" && Number.isFinite(Date.parse(v));

/**
 * One agent job's `<id>.jsonl` (written by AgentJob.ts `log()`) → one row per
 * run: each `run_start` paired with the next `run_end`, a `skipped_locked`
 * as a skipped trigger, a start with no end as incomplete (or running, when it
 * is the last line and recent). Unparseable lines are counted, never guessed.
 */
export function parseRunLog(text: string, recordId: string, source: string, now: number): { rows: ActivityRow[]; skippedLines: number } {
  const rows: ActivityRow[] = [];
  let skippedLines = 0;
  let open: { ts: string; dryRun: boolean; events: string[] } | null = null;
  const push = (row: Omit<ActivityRow, "key" | "recordId" | "origin" | "source">) =>
    rows.push({ key: `${recordId}@${row.at}#${rows.length}`, recordId, origin: "run-log", source, ...row });
  const closeIncomplete = (o: NonNullable<typeof open>, detail: string, status: ActivityStatus) =>
    push({ at: o.ts, startedAt: o.ts, endedAt: null, durationMs: null, status, detail, events: o.events, dryRun: o.dryRun });

  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let e: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(line);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) { skippedLines++; continue; }
      e = parsed as Record<string, unknown>;
    } catch {
      skippedLines++;
      continue;
    }
    if (!isIso(e.ts) || typeof e.event !== "string") { skippedLines++; continue; }
    const ts = e.ts;
    switch (e.event) {
      case "run_start":
        if (open) closeIncomplete(open, "No run_end was logged before the next run started.", "incomplete");
        open = { ts, dryRun: e.dryRun === true, events: [] };
        break;
      case "run_end": {
        const status: ActivityStatus = e.status === "ok" ? "ok" : e.status === "error" ? "error" : "unknown";
        const detail = typeof e.error === "string" && e.error.trim() ? e.error.trim().slice(0, 600) : null;
        if (open) {
          const d = Date.parse(ts) - Date.parse(open.ts);
          push({ at: open.ts, startedAt: open.ts, endedAt: ts, durationMs: d >= 0 ? d : null, status, detail, events: open.events, dryRun: open.dryRun });
          open = null;
        } else {
          push({ at: ts, startedAt: null, endedAt: ts, durationMs: null, status, detail: detail ?? "The run's start is not in the log.", events: [], dryRun: false });
        }
        break;
      }
      case "skipped_locked":
        push({ at: ts, startedAt: ts, endedAt: null, durationMs: null, status: "skipped", detail: "Skipped: the previous run still held the lock.", events: [], dryRun: false });
        break;
      default:
        if (open && open.events.length < MAX_EVENTS && open.events[open.events.length - 1] !== e.event) open.events.push(e.event);
    }
  }
  if (open) {
    const age = now - Date.parse(open.ts);
    if (age >= 0 && age < RUNNING_STALE_MS) closeIncomplete(open, "Started, and no run_end logged yet.", "running");
    else closeIncomplete(open, "Started, and no run_end was ever logged.", "incomplete");
  }
  return { rows, skippedLines };
}

const EVIDENCE_NOTE: Record<WorkflowRecord["evidence"]["kind"], string> = {
  "run-log": "Last run from the job's run record; no per-run history was readable.",
  "state-file": "Last run from Pulse's job state, which keeps only the latest run.",
  "log-mtime": "Last run inferred from when its log last changed.",
  "launchd-exit": "Last exit code from launchd, which keeps only the latest run.",
  "systemd-result": "Last trigger time and result from systemctl --user show, which keeps only the latest run.",
  none: "",
};

/** The one row a record's evidence supports, or none when it records no run time. */
export function evidenceRow(r: WorkflowRecord): ActivityRow | null {
  const ev = r.evidence;
  if (ev.kind === "none" || !isIso(ev.lastRunAt)) return null;
  return {
    key: `${r.id}@${ev.lastRunAt}#evidence`,
    recordId: r.id,
    at: ev.lastRunAt,
    startedAt: null,
    endedAt: null,
    durationMs: null,
    status: ev.lastStatus === "ok" ? "ok" : ev.lastStatus === "error" ? "error" : "unknown",
    origin: "evidence",
    source: ev.source,
    detail: EVIDENCE_NOTE[ev.kind] || null,
    events: [],
    dryRun: false,
  };
}

/** The fields of a v2 ledger record the Activity tab reads (LIFEOS/WORKFLOWS/engine/ledger.ts LedgerRecord). */
export interface LedgerRunLike {
  run_id: string;
  workflow: string;
  trigger?: string;
  data_class?: string;
  started_at?: string;
  finished_at?: string;
  status?: string;
  steps?: Record<string, { status?: string; attempts?: number; started_at?: string | null; duration_ms?: number; error?: string; timed_out?: boolean }>;
  error?: string;
}

const LEDGER_STATUS: Record<string, ActivityStatus> = { succeeded: "ok", failed: "error", abandoned: "incomplete" };

/**
 * One Activity row per v2 ledger record. Status, timing and step outcomes come
 * from the ledger; step VALUES never do (the ledger holds none, ISC-43) and are
 * read on demand from the value store. Records without a start time are skipped
 * and counted by the caller, never guessed.
 */
export function ledgerRows(records: LedgerRunLike[], source: string): { rows: ActivityRow[]; skipped: number } {
  const rows: ActivityRow[] = [];
  let skipped = 0;
  for (const r of records) {
    if (!isIso(r.started_at) || typeof r.run_id !== "string" || typeof r.workflow !== "string") { skipped++; continue; }
    const steps: ActivityStep[] = Object.entries(r.steps ?? {}).map(([id, st]) => ({
      id,
      status: typeof st?.status === "string" ? st.status : "unknown",
      attempts: typeof st?.attempts === "number" ? st.attempts : 0,
      startedAt: isIso(st?.started_at) ? st.started_at : null,
      durationMs: typeof st?.duration_ms === "number" && Number.isFinite(st.duration_ms) ? st.duration_ms : null,
      error: typeof st?.error === "string" ? st.error : null,
      timedOut: st?.timed_out === true,
    }));
    const ended = isIso(r.finished_at) ? r.finished_at : null;
    const d = ended ? Date.parse(ended) - Date.parse(r.started_at) : NaN;
    rows.push({
      key: `workflow:${r.workflow}@${r.run_id}`,
      recordId: `workflow:${r.workflow}`,
      at: r.started_at,
      startedAt: r.started_at,
      endedAt: ended,
      durationMs: Number.isFinite(d) && d >= 0 ? d : null,
      status: LEDGER_STATUS[r.status ?? ""] ?? "unknown",
      origin: "run-log",
      source,
      detail: typeof r.error === "string" && r.error.trim() ? r.error.trim().slice(0, 600) : null,
      events: [],
      dryRun: false,
      runId: r.run_id,
      trigger: typeof r.trigger === "string" ? r.trigger : null,
      timedOut: steps.some((x) => x.timedOut),
      steps,
      dataClass: typeof r.data_class === "string" ? r.data_class : null,
    });
  }
  return { rows, skipped };
}

export type RunLogReader = (r: WorkflowRecord) => { text: string; path: string } | { error: string; path: string } | null;

/**
 * Every real run the sources know about, newest first. Agent jobs contribute
 * their full per-run history when their log is readable; every other record
 * (and an agent job without a usable log) contributes at most its last
 * evidence. A record with no run evidence contributes nothing.
 */
export function buildActivity(
  inv: Inventory,
  readLog: RunLogReader,
  now: Date,
  limit: number,
  ledger: { rows: ActivityRow[]; path: string; skipped: number } | null = null,
): ActivityResponse {
  const rows: ActivityRow[] = [];
  const logs: ActivityResponse["logs"] = [];
  const errors: ActivityResponse["errors"] = [];
  // Typed workflows: the ledger is their per-run history. A ledger run whose
  // workflow has left the inventory is still a real run, so it is kept.
  const ledgerBy = new Map<string, ActivityRow[]>();
  for (const row of ledger?.rows ?? []) {
    const list = ledgerBy.get(row.recordId);
    if (list) list.push(row);
    else ledgerBy.set(row.recordId, [row]);
  }
  if (ledger) logs.push({ recordId: "workflow:*", path: ledger.path, rows: ledger.rows.length, skippedLines: ledger.skipped });
  for (const r of inv.records) {
    const fromLedger = r.runtime === "workflow" ? ledgerBy.get(r.id) : undefined;
    if (fromLedger && fromLedger.length > 0) {
      rows.push(...fromLedger);
      ledgerBy.delete(r.id);
      continue;
    }
    if (r.runtime === "agent-job") {
      const log = readLog(r);
      if (log && "error" in log) errors.push({ source: log.path, message: log.error });
      if (log && "text" in log) {
        const parsed = parseRunLog(log.text, r.id, log.path, now.getTime());
        logs.push({ recordId: r.id, path: log.path, rows: parsed.rows.length, skippedLines: parsed.skippedLines });
        if (parsed.rows.length > 0) {
          rows.push(...parsed.rows);
          continue;
        }
      }
    }
    const row = evidenceRow(r);
    if (row) rows.push(row);
  }
  for (const orphan of ledgerBy.values()) rows.push(...orphan);
  const kindById = new Map(inv.records.map((r) => [r.id, r.trigger.kind]));
  for (const row of rows) if (row.trigger == null) row.trigger = kindById.get(row.recordId) ?? null;
  rows.sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || a.key.localeCompare(b.key));
  const cap = Math.max(0, Math.floor(limit));
  return { generatedAt: now.toISOString(), rows: rows.slice(0, cap), total: rows.length, truncated: rows.length > cap, logs, errors };
}

/* ── Step values (ISC-23) ─────────────────────────────────────────────── */

/** Longest value text sent to the page per input or output; the rest is cut and said so. */
export const MAX_VALUE_CHARS = 20_000;

export type StepValueView =
  | { id: string; stored: true; input: string; output: string; truncated: boolean }
  | { id: string; stored: false; reason: string };

export interface RunValues {
  runId: string;
  workflow: string;
  dataClass: string | null;
  steps: StepValueView[];
}

/** Reads one step's stored values; null when the store has no file for it. May throw on an unreadable file. */
export type StepValueReader = (runId: string, stepId: string) => { input?: unknown; output?: unknown } | null;

function valueText(v: unknown): { text: string; cut: boolean } {
  let text: string;
  try {
    text = v === undefined ? "null" : JSON.stringify(v, null, 2) ?? "null";
  } catch {
    text = String(v);
  }
  return text.length > MAX_VALUE_CHARS
    ? { text: `${text.slice(0, MAX_VALUE_CHARS)}\n… cut at ${MAX_VALUE_CHARS.toLocaleString("en-US")} characters`, cut: true }
    : { text, cut: false };
}

/**
 * What the Activity tab shows for one run's steps: the stored input and output
 * when the value store has them, otherwise "not stored" with the reason. The
 * reasons are the store's own rules (engine/store.ts): only `public` and
 * `internal` runs are stored, skipped steps produce nothing, and run
 * directories are pruned after the retention window.
 */
export function describeRunValues(run: LedgerRunLike, storable: (dataClass: string) => boolean, read: StepValueReader, retentionDays: number): RunValues {
  const dataClass = typeof run.data_class === "string" ? run.data_class : null;
  const steps: StepValueView[] = [];
  for (const [id, st] of Object.entries(run.steps ?? {})) {
    if (!dataClass) { steps.push({ id, stored: false, reason: "The ledger line has no data class, so no values were stored." }); continue; }
    if (!storable(dataClass)) { steps.push({ id, stored: false, reason: `This run is ${dataClass}. Step values are never stored for that data class.` }); continue; }
    if (st?.status === "skipped") { steps.push({ id, stored: false, reason: "The step was skipped, so it has no values." }); continue; }
    let got: { input?: unknown; output?: unknown } | null;
    try {
      got = read(run.run_id, id);
    } catch (e) {
      steps.push({ id, stored: false, reason: `The stored file could not be read (${String(e).slice(0, 200)}).` });
      continue;
    }
    if (!got) {
      steps.push({ id, stored: false, reason: `Nothing is in the value store for this step. Runs are pruned after ${retentionDays} days, and a step that failed before returning stores nothing.` });
      continue;
    }
    const i = valueText(got.input);
    const o = valueText(got.output);
    steps.push({ id, stored: true, input: i.text, output: o.text, truncated: i.cut || o.cut });
  }
  return { runId: run.run_id, workflow: run.workflow, dataClass, steps };
}

/* ── Page writes (ISC-22, ISC-92, ISC-105, ISC-106, ISC-129, ISC-153, ISC-154) ── */

/**
 * Every page action, the CLI command that does the same thing, and the engine
 * module both call. The parity test reads this table against the CLI's
 * `help --json` catalog, so a page action without a CLI twin fails the test.
 */
export const PAGE_ACTIONS = [
  { action: "run", route: "/api/workflows/run", cli: "run", module: "engine/runner.ts runDefinition" },
  { action: "link", route: "/api/workflows/link", cli: "link", module: "engine/definitions.ts editDefinition + definition-edits.ts addAfterLink" },
  { action: "pause", route: "/api/workflows/pause", cli: "pause", module: "engine/definitions.ts editDefinition + definition-edits.ts setEnabled" },
  { action: "resume", route: "/api/workflows/resume", cli: "resume", module: "engine/definitions.ts editDefinition + definition-edits.ts setEnabled" },
  { action: "schedule", route: "/api/workflows/schedule", cli: "schedule", module: "engine/definitions.ts editDefinition + definition-edits.ts changeSchedule" },
  { action: "set runs_on", route: "/api/workflows/runs-on", cli: "set", module: "engine/definitions.ts editDefinition + definition-edits.ts setRunsOn" },
  { action: "stop", route: "/api/workflows/stop", cli: "stop", module: "engine/workflow-ops.ts stopRun" },
  // F17: the canvas editor (ISC-155 to ISC-164, ISC-175).
  { action: "connect", route: "/api/workflows/step", cli: "step", module: "engine/definitions.ts editDefinition + definition-edits.ts connectSteps" },
  { action: "disconnect", route: "/api/workflows/step", cli: "step", module: "engine/definitions.ts editDefinition + definition-edits.ts disconnectSteps" },
  { action: "step add", route: "/api/workflows/step", cli: "step", module: "engine/definitions.ts editDefinition + definition-edits.ts addStep" },
  { action: "step set", route: "/api/workflows/step", cli: "step", module: "engine/definitions.ts editDefinition + definition-edits.ts setStepFields" },
  { action: "step remove", route: "/api/workflows/step", cli: "step", module: "engine/definitions.ts editDefinition + definition-edits.ts removeStep" },
  { action: "put", route: "/api/workflows/definition", cli: "put", module: "engine/definitions.ts replaceDefinition" },
  { action: "new", route: "/api/workflows/new", cli: "new", module: "engine/templates.ts renderTemplate + engine/definitions.ts createDefinition" },
  { action: "remove", route: "/api/workflows/remove", cli: "remove", module: "engine/definitions.ts removeWorkflow" },
] as const;

export type PageAction = (typeof PAGE_ACTIONS)[number]["action"];

/** Definition names the engine accepts (engine/paths.ts NAME_RE); checked before any engine call. */
export const DEF_NAME_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const RUN_ID_BODY_RE = /^[A-Za-z0-9-]{8,128}$/;
const STEP_ID_BODY_RE = /^[A-Za-z_$][A-Za-z0-9_$-]{0,127}$/;
const MAX_NOTE_CHARS = 2000;

export type BodyCheck<T> = { ok: true; value: T } | { ok: false; reason: string };

const obj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const nameField = (b: Record<string, unknown>, key: string, what: string): BodyCheck<string> =>
  typeof b[key] === "string" && DEF_NAME_RE.test(b[key] as string) ? { ok: true, value: b[key] as string } : { ok: false, reason: `The request needs ${what} (lowercase letters, digits and dashes).` };

export type LinkStatus = "succeeded" | "failed" | "completed";
export function parseLinkBody(b: unknown): BodyCheck<{ upstream: string; downstream: string; status: LinkStatus }> {
  if (!obj(b)) return { ok: false, reason: "The request body must be a JSON object." };
  const up = nameField(b, "upstream", "an upstream workflow name");
  if (!up.ok) return up;
  const down = nameField(b, "downstream", "a downstream workflow name");
  if (!down.ok) return down;
  if (up.value === down.value) return { ok: false, reason: "A workflow cannot run after itself." };
  const status = b.status ?? "succeeded";
  if (status !== "succeeded" && status !== "failed" && status !== "completed") return { ok: false, reason: `status must be succeeded, failed or completed, not "${String(status)}".` };
  return { ok: true, value: { upstream: up.value, downstream: down.value, status } };
}

/* ── F17 bodies: step edits, the definition editor, New and Undo of New ── */

export const HASH_BODY_RE = /^sha256:[0-9a-f]{64}$/;
/** Step ids as the engine's editor accepts them (engine/definition-edits.ts STEP_ID_RE). */
export const STEP_ID_EDIT_RE = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
/** A definition's text; the write body cap is the real limit. */
const MAX_DEFINITION_CHARS = 60 * 1024;

export type StepEdit =
  | { op: "add"; id: string; kind: string; fields: Record<string, unknown>; needs: string[] }
  | { op: "set"; id: string; fields: Record<string, unknown> }
  | { op: "remove"; id: string }
  | { op: "connect" | "disconnect"; from: string; to: string };

const stepId = (b: Record<string, unknown>, key: string): BodyCheck<string> =>
  typeof b[key] === "string" && STEP_ID_EDIT_RE.test(b[key] as string) ? { ok: true, value: b[key] as string } : { ok: false, reason: `The request needs a step id in "${key}" (a letter, then letters, digits, _ or -).` };

const baseHashOf = (b: Record<string, unknown>): BodyCheck<string | undefined> => {
  if (b.base_hash === undefined) return { ok: true, value: undefined };
  return typeof b.base_hash === "string" && HASH_BODY_RE.test(b.base_hash) ? { ok: true, value: b.base_hash } : { ok: false, reason: "base_hash must be the sha256: hash the page read." };
};

/** POST /api/workflows/step: one step edit. The engine checks the fields' meaning; this checks shape only. */
export function parseStepBody(b: unknown): BodyCheck<{ name: string; baseHash: string | undefined; edit: StepEdit }> {
  const n = parseNameBody(b);
  if (!n.ok) return n;
  const body = b as Record<string, unknown>;
  const h = baseHashOf(body);
  if (!h.ok) return h;
  const fields = body.fields === undefined ? {} : body.fields;
  const fieldsOk = typeof fields === "object" && fields !== null && !Array.isArray(fields);
  let edit: StepEdit;
  switch (body.op) {
    case "add": {
      const id = stepId(body, "id");
      if (!id.ok) return id;
      if (typeof body.kind !== "string" || !body.kind) return { ok: false, reason: "A new step needs a kind." };
      if (!fieldsOk) return { ok: false, reason: "fields must be an object." };
      const needs = body.needs === undefined ? [] : body.needs;
      if (!Array.isArray(needs) || !needs.every((x) => typeof x === "string" && STEP_ID_EDIT_RE.test(x))) return { ok: false, reason: "needs must be a list of step ids." };
      edit = { op: "add", id: id.value, kind: body.kind, fields: fields as Record<string, unknown>, needs: needs as string[] };
      break;
    }
    case "set": {
      const id = stepId(body, "id");
      if (!id.ok) return id;
      if (!fieldsOk || Object.keys(fields as object).length === 0) return { ok: false, reason: "A step edit needs at least one field." };
      edit = { op: "set", id: id.value, fields: fields as Record<string, unknown> };
      break;
    }
    case "remove": {
      const id = stepId(body, "id");
      if (!id.ok) return id;
      edit = { op: "remove", id: id.value };
      break;
    }
    case "connect":
    case "disconnect": {
      const from = stepId(body, "from");
      if (!from.ok) return from;
      const to = stepId(body, "to");
      if (!to.ok) return to;
      edit = { op: body.op, from: from.value, to: to.value };
      break;
    }
    default:
      return { ok: false, reason: `op must be add, set, remove, connect or disconnect, not "${String(body.op)}".` };
  }
  return { ok: true, value: { name: n.value.name, baseHash: h.value, edit } };
}

/** POST /api/workflows/definition: the whole text (the editor's Save, and every Undo). dry_run validates without writing. */
export function parseDefinitionBody(b: unknown): BodyCheck<{ name: string; text: string; baseHash: string | undefined; dryRun: boolean }> {
  const n = parseNameBody(b);
  if (!n.ok) return n;
  const body = b as Record<string, unknown>;
  const h = baseHashOf(body);
  if (!h.ok) return h;
  if (typeof body.text !== "string" || body.text.trim().length === 0) return { ok: false, reason: "The request needs the definition text." };
  if (body.text.length > MAX_DEFINITION_CHARS) return { ok: false, reason: "The definition text is too long." };
  const dryRun = body.dry_run === true;
  if (!dryRun && h.value === undefined) return { ok: false, reason: "A save needs the base_hash of the text it replaces." };
  return { ok: true, value: { name: n.value.name, text: body.text, baseHash: h.value, dryRun } };
}

/** POST /api/workflows/new: a catalog template (engine/templates.ts). */
export function parseNewBody(b: unknown, templates: readonly string[]): BodyCheck<{ name: string; template: string; after: string | undefined }> {
  const n = parseNameBody(b);
  if (!n.ok) return n;
  const body = b as Record<string, unknown>;
  if (typeof body.template !== "string" || !templates.includes(body.template)) return { ok: false, reason: `template must be one of ${templates.join(", ")}.` };
  let after: string | undefined;
  if (body.template === "after-chain") {
    const up = nameField(body, "after", "the upstream workflow for after-chain");
    if (!up.ok) return up;
    after = up.value;
  }
  return { ok: true, value: { name: n.value.name, template: body.template, after } };
}

/** POST /api/workflows/remove: the page removes only what it just created (Undo of New), so the hash is required. */
export function parseRemoveBody(b: unknown): BodyCheck<{ name: string; baseHash: string }> {
  const n = parseNameBody(b);
  if (!n.ok) return n;
  const h = baseHashOf(b as Record<string, unknown>);
  if (!h.ok) return h;
  if (h.value === undefined) return { ok: false, reason: "A remove needs the base_hash of the text it removes." };
  return { ok: true, value: { name: n.value.name, baseHash: h.value } };
}

export function parseNameBody(b: unknown): BodyCheck<{ name: string }> {
  if (!obj(b)) return { ok: false, reason: "The request body must be a JSON object." };
  const n = nameField(b, "name", "a workflow name");
  return n.ok ? { ok: true, value: { name: n.value } } : n;
}

export function parseRunsOnBody(b: unknown): BodyCheck<{ name: string; runsOn: "local" | "cloud" }> {
  const n = parseNameBody(b);
  if (!n.ok) return n;
  const target = (b as Record<string, unknown>).runs_on;
  if (target !== "local" && target !== "cloud") return { ok: false, reason: `runs_on must be local or cloud, not "${String(target)}".` };
  return { ok: true, value: { name: n.value.name, runsOn: target } };
}

/** The schedule form's body; mapped to the same change the CLI's flags build (workflow.ts scheduleCommand). */
export type ScheduleBody =
  | { action: "cron"; cron: string; timezone: string }
  | { action: "every"; every: string }
  | { action: "at"; at: string }
  | { action: "in"; in: string }
  | { action: "remove"; target: string };

export function parseScheduleBody(b: unknown): BodyCheck<{ name: string; change: ScheduleBody }> {
  const n = parseNameBody(b);
  if (!n.ok) return n;
  const body = b as Record<string, unknown>;
  const str = (k: string): string | null => (typeof body[k] === "string" && (body[k] as string).trim().length > 0 && (body[k] as string).length <= 200 ? (body[k] as string).trim() : null);
  const name = n.value.name;
  switch (body.action) {
    case "cron": {
      const cron = str("cron");
      const tz = str("timezone");
      if (!cron) return { ok: false, reason: "A cron schedule needs a five-field cron expression." };
      if (!tz) return { ok: false, reason: "A cron schedule needs an IANA time zone such as Europe/London; there is no silent UTC default." };
      return { ok: true, value: { name, change: { action: "cron", cron, timezone: tz } } };
    }
    case "every": { const v = str("every"); return v ? { ok: true, value: { name, change: { action: "every", every: v } } } : { ok: false, reason: "An interval needs a number of minutes (or 90m, 2h, 1d)." }; }
    case "at": { const v = str("at"); return v ? { ok: true, value: { name, change: { action: "at", at: v } } } : { ok: false, reason: "A one-time run needs an ISO time." }; }
    case "in": { const v = str("in"); return v ? { ok: true, value: { name, change: { action: "in", in: v } } } : { ok: false, reason: "A one-time run needs a duration (20m, 2h, 1d)." }; }
    case "remove": { const v = str("target"); return v ? { ok: true, value: { name, change: { action: "remove", target: v } } } : { ok: false, reason: "Removing a trigger needs its type or position." }; }
    default: return { ok: false, reason: "action must be cron, every, at, in or remove." };
  }
}

export function parseStopBody(b: unknown): BodyCheck<{ runId: string }> {
  if (!obj(b) || typeof b.runId !== "string" || !RUN_ID_BODY_RE.test(b.runId)) return { ok: false, reason: "The request needs a run id." };
  return { ok: true, value: { runId: b.runId } };
}

export function parseAnswerBody(b: unknown): BodyCheck<{ runId: string; stepId: string; approved: boolean; note?: string }> {
  if (!obj(b)) return { ok: false, reason: "The request body must be a JSON object." };
  if (typeof b.runId !== "string" || !RUN_ID_BODY_RE.test(b.runId)) return { ok: false, reason: "The request needs a run id." };
  if (typeof b.stepId !== "string" || !STEP_ID_BODY_RE.test(b.stepId)) return { ok: false, reason: "The request needs a step id." };
  if (typeof b.approved !== "boolean") return { ok: false, reason: "approved must be true or false." };
  if (b.note !== undefined && (typeof b.note !== "string" || b.note.length > MAX_NOTE_CHARS)) return { ok: false, reason: `note must be text under ${MAX_NOTE_CHARS} characters.` };
  return { ok: true, value: { runId: b.runId, stepId: b.stepId, approved: b.approved, ...(typeof b.note === "string" && b.note.trim() ? { note: b.note.trim() } : {}) } };
}

/** A v2 Run Now body is `{workflow, input}`; null means the legacy `{id}` body, which stays on the launchd path. */
export function parseV2RunBody(b: unknown): BodyCheck<{ workflow: string; input: unknown }> | null {
  if (!obj(b) || b.workflow === undefined) return null;
  const n = nameField(b, "workflow", "a workflow name");
  if (!n.ok) return n;
  return { ok: true, value: { workflow: n.value, input: b.input === undefined ? {} : b.input } };
}

/** What a runs_on switch tells the page about deploying: moving to cloud never deploys; it waits for the principal's "y". */
export function deployState(runsOn: string, changed: boolean): { state: "none" | "awaiting-approval"; message: string } {
  if (runsOn !== "cloud") return { state: "none", message: "Runs locally; nothing to deploy." };
  return {
    state: "awaiting-approval",
    message: changed ? 'Moved to cloud. The deploy is waiting for your "y"; nothing was deployed.' : 'Already on cloud. Any deploy still waits for your "y".',
  };
}

/** After an F17 edit of a cloud workflow (ISC-165): the file changed, nothing deployed, the deploy waits for "y". */
export function editDeployState(runsOn: string, changed: boolean): { state: "none" | "awaiting-approval"; message: string } {
  if (runsOn !== "cloud") return { state: "none", message: "Runs locally; nothing to deploy." };
  return changed
    ? { state: "awaiting-approval", message: 'Saved. This workflow runs on Cloudflare, so the change goes live only after a deploy, which waits for your "y". Nothing was deployed.' }
    : { state: "none", message: "Nothing changed, so nothing waits to deploy." };
}

/**
 * Same-origin gate for the page's writes, in front of Pulse's own cross-site
 * guard. A browser write must come from this origin; a request with neither
 * Origin nor Sec-Fetch-Site (a local CLI) passes.
 */
export function sameOrigin(req: Request): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(req.url).host;
  } catch {
    return false;
  }
}
