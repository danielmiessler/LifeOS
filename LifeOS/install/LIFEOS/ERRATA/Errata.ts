#!/usr/bin/env bun
/**
 * @version 1.0.0
 * Errata.ts — CLI front door to the Errata ledger.
 *
 *   bun LIFEOS/ERRATA/Errata.ts add|list|show|stats|enrich|triage|daily|weekly|report|backfill|rotate|validate|audit|by-model
 *   bun LIFEOS/ERRATA/Errata.ts exchanges | v4 detect|diagnose|report | eval sample|brief|agreement|score   (v4, ISA F6)
 *   bun LIFEOS/ERRATA/Errata.ts v4 rules|cover|cluster|recommend|act [--file]                                (v4 M7b, Act.ts)
 *
 * All paths come from Store.ts (ERRATA_DIR / ERRATA_STATE_DIR, both
 * env-overridable) — nothing here is hardcoded.
 */
import { ErrataStore } from "./Store";
import { validateErratum, validatePatch, isPatch, type Erratum, type Channel, type Kind, type NewErratum, type ReporterRole, type Source, type System, type Target } from "./Schema";
import { enrichPending, type EnrichResult } from "./Enrich";
import { triage } from "./Triage";
import { backfill } from "./Backfill";
import { mine } from "./Mine";
import { label, main as auditMain, propose, report, type LabelOptions } from "./Audit";
import { main as exchangesMain } from "./Exchanges";
import { main as triage4Main } from "./Triage4";
import { main as evalMain } from "./Eval";
import { act, dailyV4 } from "./Act";
import { formatLanded, landedImpacts } from "./Landed";
import { errataReport, summarize } from "./Report";
import { isV4Outage } from "./V4Outage";
import { complaintRows, falsePasses, fileAssayMissUpgrades, formatImpact, formatMisses, impact, loadSources, retireCandidates, skillRows, skillRowsMarkdown } from "./OutputJoin";

type DailyDependencies = {
  mine?: (store: ErrataStore, opts: { limitFiles?: number }) => ReturnType<typeof mine>;
  enrich?: (store: ErrataStore) => Promise<EnrichResult>;
  label?: (store: ErrataStore, opts: LabelOptions) => ReturnType<typeof label>;
  triage?: typeof triage;
  /** Errata v4 detection over new exchanges (ISC-51); shadow, so single errors are non-fatal, but engine outages (>50% errors) or thrown exceptions fail the stage (#2789). */
  v4?: () => Promise<unknown>;
  /** Errata's daily state: roll-up event, landed-fix check, state file (Report.ts). */
  report?: (store: ErrataStore) => unknown;
};

type WeeklyDependencies = {
  propose?: typeof propose;
  report?: typeof report;
  /** Errata v4 M7b: rules, coverage, clusters, recommendations (never filed here) and the v4 report. */
  v4?: () => Promise<unknown>;
};

function stageError(stage: string, error: unknown): { error: string } {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[${stage}] ${message}`);
  return { error: message };
}

/** Where a scheduled run's stage results go: one JSON line per stage on a terminal, or one JSON value at the end for a workflow step, whose stdout must be exactly one value. */
export type RunOutput = { json?: boolean };

function stageSink(o: RunOutput): { say: (stage: string, value: unknown) => void; done: (failed: string[]) => void } {
  const stages: Record<string, unknown> = {};
  return {
    say: (stage, value) => { stages[stage] = value; if (!o.json) console.log(JSON.stringify({ [stage]: value })); },
    done: (failed) => { if (o.json) console.log(JSON.stringify({ ok: failed.length === 0, failed, stages })); },
  };
}

/** Scheduled work is deliberately fault-isolated: later stages always get a turn. */
export async function daily(
  store: ErrataStore,
  limit = 400,
  deps: DailyDependencies = {},
  /** Changed transcripts swept per run; 0 skips the stage (`--skip-mine`). */
  mineLimit = 2000,
  out: RunOutput = {},
): Promise<number> {
  let failures = 0;
  // The scheduled job keeps only stderr, so the failing stage is named there; stdout carries the full results.
  const failed: string[] = [];
  const { say, done } = stageSink(out);
  // Mining runs first so a failure the principal never complained about is in the
  // ledger before the label stage reads it. Regex only, no model calls: an
  // incremental sweep measured 2 s over 331 changed transcripts (2026-09-20).
  if (mineLimit > 0) {
    try {
      const result = await (deps.mine ?? mine)(store, { limitFiles: mineLimit });
      say("mine", result);
    } catch (error) {
      // Never fatal: the ledger's other stages matter more than one sweep.
      say("mine", stageError("daily mine", error));
    }
  }
  try {
    const result = await (deps.enrich ?? ((target) => enrichPending(target, {
      serviceTier: "flex", limit: 150, budgetMs: 10 * 60_000,
    })))(store);
    say("enrich", result);
  } catch (error) {
    failures++; failed.push(`enrich threw: ${String((error as Error)?.message ?? error).slice(0, 160)}`);
    say("enrich", stageError("daily enrich", error));
  }
  try {
    // A 400-item judgeMany pool has at most 13 shards; reserve three equal slices
    // for the model retry phase so the complete label stage stays under 10 min.
    const timeoutMs = Math.floor((10 * 60_000) / (Math.ceil(limit / 32) + 3));
    const result = await (deps.label ?? label)(store, {
      limit, timeoutMs, budgetMs: 10 * 60_000, serviceTier: "flex",
    });
    say("label", result);
    if (result.errors) { failures++; failed.push(`label: ${result.errors} errors of ${result.candidates}`); }
  } catch (error) {
    failures++; failed.push(`label threw: ${String((error as Error)?.message ?? error).slice(0, 160)}`);
    say("label", stageError("daily label", error));
  }
  try {
    const result = (deps.triage ?? triage)(store, { includeBackfill: false, file: false });
    say("triage", result);
  } catch (error) {
    failures++; failed.push(`triage threw: ${String((error as Error)?.message ?? error).slice(0, 160)}`);
    say("triage", stageError("daily triage", error));
  }
  // Errata's own state, after triage has moved today's entries: one roll-up to Vigil, the landed-fix check, and the
  // state file the Current State region reads (current-ideal-delta F5). Counts only; its failure is a failed stage.
  try {
    const result = (deps.report ?? ((target) => summarize(errataReport(target))))(store);
    say("report", result);
  } catch (error) {
    failures++; failed.push(`report threw: ${String((error as Error)?.message ?? error).slice(0, 160)}`);
    say("report", stageError("daily report", error));
  }
  // v4 runs last and in shadow: single errors are non-fatal, but a thrown error or an engine outage
  // (>= 50% errors on detect or diagnose candidates) fails the stage so Vigil raises an alert (public issue #2789).
  try {
    const result = await (deps.v4 ?? (() => dailyV4()))();
    say("v4", result);
    const outage = isV4Outage(result);
    if (outage.failed) {
      failures++;
      failed.push(`v4: ${outage.reason}`);
    }
  } catch (error) {
    failures++;
    failed.push(`v4 threw: ${String((error as Error)?.message ?? error).slice(0, 160)}`);
    say("v4", stageError("daily v4", error));
  }
  if (failed.length) console.error(`[errata daily] failed stages: ${failed.join("; ")}`);
  done(failed);
  return failures ? 1 : 0;
}

export async function weekly(store: ErrataStore, deps: WeeklyDependencies = {}, out: RunOutput = {}): Promise<number> {
  let failures = 0;
  // The scheduled job keeps only stderr, so the failing stage is named there; stdout carries the full results.
  const failed: string[] = [];
  const { say, done } = stageSink(out);
  try {
    const result = await (deps.propose ?? propose)(store, { top: 15, serviceTier: "flex" });
    say("propose", { clusters: result.length, errors: result.filter((row) => "error" in row).length });
    if (result.some((row) => "error" in row)) { failures++; failed.push(`propose: ${result.filter((row) => "error" in row).length} cluster errors`); }
  } catch (error) {
    failures++; failed.push(`propose threw: ${String((error as Error)?.message ?? error).slice(0, 160)}`);
    say("propose", stageError("weekly propose", error));
  }
  try {
    say("report", { path: (deps.report ?? report)(store) });
  } catch (error) {
    failures++; failed.push(`report threw: ${String((error as Error)?.message ?? error).slice(0, 160)}`);
    say("report", stageError("weekly report", error));
  }
  // Same isolation as daily: v4 is shadow and never files to Upgrades from the schedule.
  try {
    const result = await (deps.v4 ?? (() => act({ file: false })))();
    say("v4", result);
    const outage = isV4Outage(result);
    if (outage.failed) {
      failures++;
      failed.push(`v4: ${outage.reason}`);
    }
  } catch (error) {
    failures++;
    failed.push(`v4 threw: ${String((error as Error)?.message ?? error).slice(0, 160)}`);
    say("v4", stageError("weekly v4", error));
  }
  if (failed.length) console.error(`[errata weekly] failed stages: ${failed.join("; ")}`);
  done(failed);
  return failures ? 1 : 0;
}

/** Kinds that count as a complaint in the by-model report; praise is its own column, questions and feature requests count only as rows. */
const NEGATIVE_KINDS: ReadonlySet<string> = new Set(["complaint", "correction", "bug", "incident"]);
/** Group label for a dispatch whose model could not be resolved (ISA A2: recorded as unknown, never as the carrier). */
export const UNKNOWN_MODEL = "(unknown)";
/** Agent label for the main loop (context.model) in the per-agent view. */
export const MAIN_LOOP = "(main loop)";

export interface AttributionRow {
  model: string;
  /** Present on the per-agent view only. */
  agent?: string;
  rows: number;
  praise: number;
  complaint: number;
  /** Mean of the ratings the principal actually gave; null when no row in the group carries one. */
  mean_rating: number | null;
}

export interface Attribution {
  by_model: AttributionRow[];
  by_agent: AttributionRow[];
  /** Rows with no carrier model and no dispatch (mined, backfilled, app rows): counted, never guessed. */
  unattributed: number;
  total: number;
}

/** Strip the context-window suffix; "<synthetic>" (a harness-made message on older rows) is no model at all. */
function normalizeModel(m: unknown): string | null {
  if (typeof m !== "string") return null;
  const t = m.trim().replace(/\[1m\]$/i, "");
  return t && t !== "<synthetic>" ? t : null;
}

/** Attribute every erratum to the set {context.model} ∪ {dispatch models}, and each (agent, model) pair in it. Pure. */
export function attribute(all: Erratum[]): Attribution {
  // Rows the evidence projector inferred (source detected) are its own output, never a complaint count (EVIDENCE ISC-21).
  const rows = all.filter((e) => e.source !== "detected");
  type Acc = { model: string; agent?: string; rows: number; praise: number; complaint: number; sum: number; n: number };
  const byModel = new Map<string, Acc>();
  const byAgent = new Map<string, Acc>();
  const bump = (map: Map<string, Acc>, key: string, seed: { model: string; agent?: string }, e: Erratum) => {
    const a = map.get(key) ?? { ...seed, rows: 0, praise: 0, complaint: 0, sum: 0, n: 0 };
    a.rows++;
    if (e.kind === "praise") a.praise++;
    if (NEGATIVE_KINDS.has(e.kind)) a.complaint++;
    if (typeof e.rating === "number") { a.sum += e.rating; a.n++; }
    map.set(key, a);
  };
  let unattributed = 0;
  for (const e of rows) {
    const pairs = new Map<string, { agent: string; model: string }>();
    const carrier = normalizeModel(e.context?.model);
    if (carrier) pairs.set(`${MAIN_LOOP}\u0000${carrier}`, { agent: MAIN_LOOP, model: carrier });
    for (const d of e.context?.dispatches ?? []) {
      const m = normalizeModel(d?.model) ?? UNKNOWN_MODEL;
      const agent = typeof d?.agent === "string" && d.agent ? d.agent : UNKNOWN_MODEL;
      pairs.set(`${agent}\u0000${m}`, { agent, model: m });
    }
    if (pairs.size === 0) { unattributed++; continue; }
    // A row counts once per model and once per (agent, model), however many times that pair was dispatched.
    for (const m of new Set([...pairs.values()].map((p) => p.model))) bump(byModel, m, { model: m }, e);
    for (const [key, p] of pairs) bump(byAgent, key, { agent: p.agent, model: p.model }, e);
  }
  const finish = (a: Acc): AttributionRow => ({
    ...(a.agent !== undefined ? { agent: a.agent } : {}),
    model: a.model, rows: a.rows, praise: a.praise, complaint: a.complaint,
    mean_rating: a.n ? Math.round((a.sum / a.n) * 100) / 100 : null,
  });
  const order = (x: AttributionRow, y: AttributionRow) => y.rows - x.rows || (x.agent ?? "").localeCompare(y.agent ?? "") || x.model.localeCompare(y.model);
  return {
    by_model: [...byModel.values()].map(finish).sort(order),
    by_agent: [...byAgent.values()].map(finish).sort(order),
    unattributed,
    total: rows.length,
  };
}

/** Plain-text table for the by-model report. */
export function formatAttribution(a: Attribution): string {
  const table = (head: string[], body: string[][]): string[] => {
    const w = head.map((h, i) => Math.max(h.length, ...body.map((r) => r[i].length)));
    const line = (r: string[]) => r.map((c, i) => (i === 0 || (head[0] === "agent" && i === 1) ? c.padEnd(w[i]) : c.padStart(w[i]))).join("  ").trimEnd();
    return [line(head), w.map((n) => "-".repeat(n)).join("  "), ...body.map(line)];
  };
  const cells = (r: AttributionRow) => [String(r.rows), String(r.praise), String(r.complaint), r.mean_rating === null ? "-" : r.mean_rating.toFixed(2)];
  return [
    ...table(["model", "rows", "praise", "complaint", "mean rating"], a.by_model.map((r) => [r.model, ...cells(r)])),
    "",
    ...table(["agent", "model", "rows", "praise", "complaint", "mean rating"], a.by_agent.map((r) => [r.agent ?? "", r.model, ...cells(r)])),
    "",
    `${a.total} rows; ${a.unattributed} carry no model (mined, backfilled, or app rows). A row counts under every model that worked on its turn.`,
  ].join("\n");
}

function argVal(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

function argAll(args: string[], flag: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) if (args[i] === flag && args[i + 1] !== undefined) out.push(args[i + 1]);
  return out;
}

function usage(): never {
  console.error("usage: Errata.ts add|list|show|stats|enrich|triage [--include-backfill]|daily [--limit N] [--mine-limit N] [--skip-mine] [--json]|weekly [--json]|report [--json] [--dry-run]|backfill|mine [--root DIR] [--limit-files N] [--dry-run]|rotate --before YYYY-MM|validate [--json]|by-model [--since YYYY-MM-DD] [--json]|skills [--since YYYY-MM-DD] [--json]|misses [--json] [--file-upgrades]|impact --skill <Name> --since YYYY-MM-DD [--days N] [--json]|impact --landed [--days N] [--json]|audit label|human [--count N]|propose|report|calibrate-labels|calibrate|status [--top N --exemplars K --sample N --seed N --ids-file FILE --limit N --dry-run --check-gate --level low|medium|high|max (calibrate-labels/propose default: max)]|exchanges [--root DIR] [--full] [--dry-run]|v4 detect|diagnose [--limit N] [--chunk N] [--dry-run]|v4 report|v4 rules build|show|search|v4 cover|cluster [--dry-run]|v4 recommend|act [--top N] [--file]|eval sample|brief|agreement|score [--check] [--offline]");
  process.exit(2);
}

export async function main(): Promise<void> {
  const [cmd, ...args] = process.argv.slice(2);
  const json = args.includes("--json");
  const store = new ErrataStore();

  switch (cmd) {
    case "add": {
      const complaint = argVal(args, "--complaint");
      const system = argVal(args, "--system") as System | undefined;
      const source = argVal(args, "--source") as Source | undefined;
      const channel = argVal(args, "--channel") as Channel | undefined;
      const kind = argVal(args, "--kind") as Kind | undefined;
      const reporterId = argVal(args, "--reporter-id");
      const reporterRole = argVal(args, "--reporter-role") as ReporterRole | undefined;
      if (!complaint || !system || !source || !channel || !kind || !reporterId || !reporterRole) {
        console.error("add requires --system --source --channel --kind --complaint --reporter-id --reporter-role");
        process.exit(2);
      }
      const target = argVal(args, "--target") as Target | undefined;
      const ratingArg = argVal(args, "--rating");
      const input: NewErratum = {
        system,
        source,
        channel,
        kind,
        complaint,
        reporter: { id: reporterId, role: reporterRole },
        context: {
          requested: argVal(args, "--requested") ?? null,
          component: argVal(args, "--component") ?? null,
        },
        tags: argAll(args, "--tag"),
        ...(target ? { target } : {}),
        ...(ratingArg ? { rating: Number(ratingArg) } : {}),
      };
      const e = store.append(input);
      if (!e) {
        console.error("duplicate dedupe_key; not appended");
        process.exit(1);
      }
      console.log(json ? JSON.stringify(e) : e.id);
      process.exit(0);
    }
    case "list": {
      const rows = store.list({
        system: argVal(args, "--system"),
        kind: argVal(args, "--kind"),
        status: argVal(args, "--status"),
        source: argVal(args, "--source"),
        since: argVal(args, "--since"),
        limit: argVal(args, "--limit") ? Number(argVal(args, "--limit")) : undefined,
        enriched: args.includes("--unenriched") ? false : undefined,
      });
      if (json) {
        console.log(JSON.stringify(rows));
      } else {
        for (const r of rows) {
          console.log(`${r.id}  ${r.status.padEnd(13)} ${r.system.padEnd(8)} ${r.kind.padEnd(16)} ${r.complaint.slice(0, 60)}`);
        }
      }
      process.exit(0);
    }
    case "show": {
      const e = store.get(args[0] ?? "");
      if (!e) {
        console.error("not found");
        process.exit(1);
      }
      if (json) {
        console.log(JSON.stringify(e));
      } else {
        console.log(`id: ${e.id}`);
        console.log(`ts: ${e.ts}`);
        console.log(`system: ${e.system}  kind: ${e.kind}  status: ${e.status}`);
        console.log(`source: ${e.source}  channel: ${e.channel}  rating: ${e.rating ?? "null"}  frustration: ${e.frustration ?? "null"}`);
        console.log(`reporter: ${e.reporter.role}:${e.reporter.id}`);
        console.log(`complaint: ${e.complaint}`);
        if (e.enrichment) console.log(`enrichment.class: ${e.enrichment.class}  how_upset: ${e.enrichment.how_upset}`);
        if (e.links.upgrade_id) console.log(`links.upgrade_id: ${e.links.upgrade_id}`);
      }
      process.exit(0);
    }
    case "stats": {
      console.log(JSON.stringify(store.stats(), null, json ? 2 : undefined));
      process.exit(0);
    }
    case "enrich": {
      try {
        const r = await enrichPending(store);
        console.log(JSON.stringify(r));
        process.exit(0);
      } catch (e) {
        console.error(e instanceof Error ? e.message : String(e));
        process.exit(1);
      }
    }
    case "triage": {
      const r = triage(store, { includeBackfill: args.includes("--include-backfill") });
      console.log(JSON.stringify(r));
      process.exit(0);
    }
    case "daily": {
      const rawLimit = argVal(args, "--limit");
      const limit = rawLimit === undefined ? 400 : Number(rawLimit);
      if (!Number.isInteger(limit) || limit < 0) {
        console.error("daily --limit must be a nonnegative integer");
        process.exit(2);
      }
      const rawMine = argVal(args, "--mine-limit");
      const mineLimit = args.includes("--skip-mine") ? 0 : rawMine === undefined ? 2000 : Number(rawMine);
      if (!Number.isInteger(mineLimit) || mineLimit < 0) {
        console.error("daily --mine-limit must be a nonnegative integer");
        process.exit(2);
      }
      process.exit(await daily(store, limit, {}, mineLimit, { json }));
    }
    case "weekly":
      process.exit(await weekly(store, {}, { json }));
    case "report": {
      // --dry-run computes the state and the events it would emit, and writes and emits nothing.
      const r = errataReport(store, { dryRun: args.includes("--dry-run") });
      console.log(json ? JSON.stringify({ ...summarize(r), state: r.state, events: r.events.map((e) => ({ ref: e.ref, severity: e.severity, title: e.title })) }, null, 2) : [`${r.state.total} entries in ${r.state.window_days} days; ${r.state.stuck} stuck; landed fixes that raised complaints: ${r.state.landed_rose.join(", ") || "none"}`, `${r.written ? "wrote" : "would write"} ${r.path}`, ...r.events.map((e) => `${r.written ? "emitted" : "would emit"} ${e.severity} ${e.title}`)].join("\n"));
      process.exit(0);
    }
    case "backfill": {
      const r = backfill(store);
      console.log(JSON.stringify(r));
      process.exit(0);
    }
    case "rotate": {
      const before = argVal(args, "--before");
      if (!before) {
        console.error("rotate requires --before YYYY-MM");
        process.exit(2);
      }
      const r = store.rotate(before);
      console.log(JSON.stringify(r));
      process.exit(0);
    }
    case "validate": {
      const { lines, skipped } = store.rawLines();
      let bad = 0;
      for (const l of lines) {
        const errs = isPatch(l) ? validatePatch(l) : validateErratum(l);
        if (errs.length > 0) {
          bad++;
          console.error(`${(l as { id?: string }).id ?? "(no id)"}: ${errs.join("; ")}`);
        }
      }
      console.log(JSON.stringify({ total: lines.length, bad, skipped_lines: skipped }));
      process.exit(bad > 0 || skipped > 0 ? 1 : 0);
    }
    case "mine": {
      try {
        const root = argVal(args, "--root");
        const limitFilesArg = argVal(args, "--limit-files");
        const dryRun = args.includes("--dry-run");
        const r = await mine(store, {
          root,
          limitFiles: limitFilesArg ? Number(limitFilesArg) : undefined,
          dryRun,
        });
        console.log(JSON.stringify(r));
        process.exit(0);
      } catch (e) {
        console.error(e instanceof Error ? e.message : String(e));
        process.exit(1);
      }
    }
    case "by-model": {
      const since = argVal(args, "--since");
      if (since !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(since)) {
        console.error("by-model --since must be YYYY-MM-DD");
        process.exit(2);
      }
      const a = attribute(store.list({ since }));
      console.log(json ? JSON.stringify(a, null, 2) : formatAttribution(a));
      process.exit(0);
    }
    case "skills": {
      const since = argVal(args, "--since");
      if (since !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(since)) { console.error("skills --since must be YYYY-MM-DD"); process.exit(2); }
      const rows = skillRows(complaintRows(store), loadSources(), since ? { since: new Date(`${since}T00:00:00Z`) } : {});
      console.log(json ? JSON.stringify(rows, null, 2) : skillRowsMarkdown(rows) || "no outputs in the output ledger");
      process.exit(0);
    }
    case "misses": {
      const src = loadSources();
      const rows = complaintRows(store);
      const fp = falsePasses(rows, src);
      const retire = retireCandidates(rows, src);
      // --file-upgrades: one Upgrades item (source "assay-miss") per false pass, deduped by output id. Without it nothing is written.
      const filed = args.includes("--file-upgrades") ? fileAssayMissUpgrades(fp) : null;
      console.log(json ? JSON.stringify({ false_passes: fp, retire_candidates: retire, ...(filed ? { upgrades: filed } : {}) }, null, 2) : formatMisses(fp, retire) + (filed ? `\nupgrades filed: ${filed.filed} new, ${filed.duplicates} already filed, ${filed.refused} refused` : ""));
      process.exit(0);
    }
    case "impact": {
      // --landed: the weekly read for every assay-miss upgrade that has landed (applied or verified); no --skill/--since needed.
      if (args.includes("--landed")) {
        const d = argVal(args, "--days") === undefined ? 14 : Number(argVal(args, "--days"));
        if (!Number.isInteger(d) || d < 1) { console.error("impact --landed [--days N]"); process.exit(2); }
        const lr = landedImpacts(store, loadSources(), { days: d });
        console.log(json ? JSON.stringify(lr, null, 2) : formatLanded(lr));
        process.exit(0);
      }
      const skill = argVal(args, "--skill");
      const since = argVal(args, "--since");
      const days = argVal(args, "--days") === undefined ? 14 : Number(argVal(args, "--days"));
      if (!skill || !since || !/^\d{4}-\d{2}-\d{2}$/.test(since) || !Number.isInteger(days) || days < 1) {
        console.error("impact requires --skill <Name> --since YYYY-MM-DD [--days N]");
        process.exit(2);
      }
      const r = impact(complaintRows(store), loadSources(), skill, new Date(`${since}T00:00:00Z`), days);
      console.log(json ? JSON.stringify(r, null, 2) : formatImpact(r));
      process.exit(0);
    }
    case "audit": {
      const exitCode = await auditMain(args);
      process.exit(exitCode);
    }
    case "exchanges":
      process.exit(await exchangesMain(args));
    case "v4":
      process.exit(await triage4Main(args));
    case "eval":
      process.exit(await evalMain(args));
    default:
      usage();
  }
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
}
