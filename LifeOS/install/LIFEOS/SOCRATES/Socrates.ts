#!/usr/bin/env bun
/**
 * Socrates — the standing-question ledger CLI.
 *
 *   bun Socrates.ts tick                 run all due adapters, apply answers, route persisting findings, export snapshot
 *   bun Socrates.ts route [--dry-run]    run only the router (Achilles entry + work ticket + close leg)
 *   bun Socrates.ts sync <adapter>       run one adapter now (ignores cadence)
 *   bun Socrates.ts list [--status S]    questions in the registry
 *   bun Socrates.ts show <SOC-id>        question + latest answers + history
 *   bun Socrates.ts board                terminal board: per-domain pass/fail/unknown
 *   bun Socrates.ts findings             open findings
 *   bun Socrates.ts validate             load registry, run all invariants, exit 0/1
 *   bun Socrates.ts export               rewrite the redacted Pulse snapshot
 *   bun Socrates.ts rebuild              rebuild latest.json from the answer logs, reconcile findings.jsonl
 *   bun Socrates.ts seed                 copy the generic template into an empty USER dir
 *
 * Separation: engine here (publishable-clean) · questions in LIFEOS/USER/SOCRATES
 * · answers as JSONL in ~/.local/state/lifeos/socrates (outside both repos)
 * · findings journal in LIFEOS/USER/SOCRATES/findings.jsonl · Pulse reads only
 * the redacted snapshot. Store layout: Store.ts header. Design of record: the
 * maintainer's private design notes (2026-08-26); the shipped doc is
 * LIFEOS/DOCUMENTATION/Socrates/SocratesSystem.md.
 */

import { writeFileSync, renameSync } from "node:fs";
import { Store, SNAPSHOT_PATH, type AdapterRunResult, type AnswerInput, type AnswerRecord } from "./Store";
import { loadQuestions, seedIfEmpty, QUESTIONS_DIR, type Question } from "./Registry";
import { routeFindings, defaultDeps } from "./Router";
import { sendHeartbeat } from "../TOOLS/Heartbeat";
import type { Adapter } from "./adapters/types";
import { allUnknown } from "./adapters/types";
import { workflowsScanner } from "./adapters/workflows-scanner";
import { atlas } from "./adapters/atlas";
import { achilles } from "./adapters/achilles";
import { services } from "./adapters/services";
import { vigil } from "./adapters/vigil";
import { backups } from "./adapters/backups";
import { launchdPath } from "./adapters/launchd-path";
import { ownership } from "./adapters/ownership";
import { finance } from "./adapters/finance";
import { bunker } from "./adapters/bunker";
import { secrets } from "./adapters/secrets";
import { state } from "./adapters/state";
import { ulwork } from "./adapters/ulwork";
import { threatmodel } from "./adapters/threatmodel";
import { telosRisks } from "./adapters/telos-risks";
import { usage } from "./adapters/usage";
import { router } from "./adapters/router";
import { evals } from "./adapters/evals";
import { thinking } from "./adapters/thinking";

const ADAPTERS: Adapter[] = [workflowsScanner, atlas, achilles, services, launchdPath, backups, ownership, finance, bunker, secrets, state, ulwork, threatmodel, telosRisks, usage, evals, router, vigil, thinking];

const CADENCE_MS: Record<Question["cadence"], number> = {
  hourly: 3600_000,
  daily: 24 * 3600_000,
  weekly: 7 * 24 * 3600_000,
  monthly: 30 * 24 * 3600_000,
};

function assigned(questions: Question[], adapter: Adapter): Question[] {
  return questions.filter((q) => q.status === "active" && q.answerer?.adapter === adapter.name);
}

/** A question is due when its latest answer is older than its cadence (or absent). */
function dueQuestions(store: Store, qs: Question[]): Question[] {
  const latest = new Map<string, string>();
  for (const a of store.latestAnswers()) {
    const prev = latest.get(String(a.question_id));
    const ts = String(a.ts);
    if (!prev || ts > prev) latest.set(String(a.question_id), ts);
  }
  const now = Date.now();
  return qs.filter((q) => {
    const last = latest.get(q.id);
    return !last || now - Date.parse(last) >= CADENCE_MS[q.cadence] - 60_000;
  });
}

/**
 * Whole-question unknown rows, plus one per open per-instance finding of those
 * questions. A bare unknown has no instance_key, so on its own it would leave
 * each instance's finding at its last "fail" and still routable while the
 * adapter is down; an error is evidence of neither.
 */
function unknownRows(store: Store, qs: Question[], adapter: Adapter, reason: string): AnswerInput[] {
  const rows = allUnknown(qs, adapter, reason);
  const byId = new Map(qs.map((q) => [q.id, q]));
  for (const f of store.openFindings()) {
    const q = byId.get(f.question_id);
    if (!q || !f.instance_key) continue;
    rows.push({ ...allUnknown([q], adapter, reason)[0]!, instance_key: f.instance_key });
  }
  return rows;
}

export async function runAdapter(store: Store, adapter: Adapter, qs: Question[]): Promise<number> {
  if (qs.length === 0) return 0;
  let result: AdapterRunResult;
  try {
    const answers = await adapter.answers(qs);
    // Contract: every assigned question gets at least one answer row.
    const answered = new Set(answers.map((a) => a.question_id));
    const missing = qs.filter((q) => !answered.has(q.id));
    answers.push(...unknownRows(store, missing, adapter, "adapter returned no row for this question"));
    result = { complete: missing.length === 0, answers };
  } catch (err) {
    result = { complete: false, answers: unknownRows(store, qs, adapter, String(err)), note: String(err).slice(0, 300) };
  }
  store.applyRun(adapter.name, result);
  return result.answers.length;
}

function exportSnapshot(store: Store, questions: Question[]): void {
  // Redaction: the snapshot carries question metadata, latest verdicts, values,
  // computed_from, and findings — never tokens (none are stored) and never
  // adapter internals. Pulse renders this file only.
  const snapshot = {
    generated_at: new Date().toISOString(),
    questions: questions.map((q) => ({
      id: q.id, domain: q.domain, text: q.text, ideal: q.ideal, status: q.status,
      verifier: q.verifier, cadence: q.cadence, severity: q.severity,
      node_type: q.node_type ?? null, experiential: q.experiential ?? false,
      answerer: q.answerer?.adapter ?? null, provenance: q.provenance,
      telos_ref: q.telos_ref ?? null, accounted_for: q.accounted_for ?? null,
      ruled_out: q.ruled_out ?? [],
    })),
    answers: store.latestAnswers(),
    findings: store.openFindings(),
    status: store.status(),
  };
  const tmp = SNAPSHOT_PATH + ".tmp";
  writeFileSync(tmp, JSON.stringify(snapshot, null, 2));
  renameSync(tmp, SNAPSHOT_PATH);
}

function board(store: Store, questions: Question[]): string {
  const latest = store.latestAnswers();
  const byQ = new Map<string, AnswerRecord[]>();
  for (const a of latest) {
    const k = String(a.question_id);
    if (!byQ.has(k)) byQ.set(k, []);
    byQ.get(k)!.push(a);
  }
  const lines: string[] = [];
  const domains = [...new Set(questions.map((q) => q.domain))].sort();
  for (const d of domains) {
    const qs = questions.filter((q) => q.domain === d);
    let pass = 0, fail = 0, unknown = 0, unanswerable = 0;
    for (const q of qs) {
      if (q.status === "unanswerable") { unanswerable++; continue; }
      if (q.status === "retired") continue;
      const rows = byQ.get(q.id) ?? [];
      if (rows.length === 0) { unknown++; continue; }
      if (rows.some((r) => r.verdict === "fail")) fail++;
      else if (rows.some((r) => r.verdict === "unknown")) unknown++;
      else pass++;
    }
    lines.push(`${d.padEnd(12)} pass:${pass}  fail:${fail}  unknown:${unknown}  unanswerable:${unanswerable}`);
  }
  const f = store.openFindings();
  lines.push(`\nopen findings: ${f.length}`);
  for (const x of f.slice(0, 15)) lines.push(`  ${x.question_id}${x.instance_key ? `|${x.instance_key}` : ""} since ${String(x.first_seen).slice(0, 10)} (${x.last_verdict}${x.last_value != null ? `=${x.last_value}` : ""})`);
  return lines.join("\n");
}

if (import.meta.main) {
  const [cmd, ...args] = process.argv.slice(2);

  switch (cmd) {
    case "validate": {
      const qs = loadQuestions();
      const active = qs.filter((q) => q.status === "active");
      const adapterNames = new Set(ADAPTERS.map((a) => a.name));
      const dangling = active.filter((q) => !adapterNames.has(q.answerer!.adapter));
      if (dangling.length > 0) {
        console.error(`dangling answerer refs: ${dangling.map((q) => `${q.id}→${q.answerer!.adapter}`).join(", ")}`);
        process.exit(1);
      }
      console.log(JSON.stringify({ ok: true, questions: qs.length, active: active.length, unanswerable: qs.filter((q) => q.status === "unanswerable").length }));
      break;
    }
    case "seed": {
      const did = seedIfEmpty();
      console.log(JSON.stringify({ seeded: did, dir: QUESTIONS_DIR }));
      break;
    }
    case "tick": {
      const store = new Store();
      const qs = loadQuestions();
      const due = dueQuestions(store, qs.filter((q) => q.status === "active"));
      let total = 0;
      for (const adapter of ADAPTERS) total += await runAdapter(store, adapter, assigned(due, adapter));
      // Router runs after every adapter and before the export; it never throws, so a dead gh or gmail cannot cost the snapshot.
      const routed = routeFindings(store, qs, await defaultDeps());
      exportSnapshot(store, qs);
      console.log(JSON.stringify({ due: due.length, answers: total, routed: { registered: routed.registered, ticketed: routed.ticketed, emailed: routed.emailed, closed: routed.closed, held: routed.held.length, errors: routed.errors.length }, snapshot: SNAPSHOT_PATH }));
      store.close();
      // Dead-man switch: the tick completed. The cloud site-health worker pages
      // from its own machine if this hourly job goes quiet for ~2 cycles. Never throws.
      const hb = await sendHeartbeat("com.lifeos.socrates", 2 * 3600 + 600);
      if (!hb.ok) console.error(`[socrates] ${hb.reason}`);
      break;
    }
    case "sync": {
      const store = new Store();
      const qs = loadQuestions();
      const adapter = ADAPTERS.find((a) => a.name === args[0]);
      if (!adapter) { console.error(`unknown adapter ${args[0]} — one of: ${ADAPTERS.map((a) => a.name).join(", ")}`); process.exit(1); }
      const n = await runAdapter(store, adapter, assigned(qs, adapter));
      exportSnapshot(store, qs);
      console.log(JSON.stringify({ adapter: adapter.name, answers: n }));
      store.close();
      break;
    }
    case "list": {
      const qs = loadQuestions();
      const status = args.includes("--status") ? args[args.indexOf("--status") + 1] : null;
      for (const q of qs.filter((q) => !status || q.status === status)) {
        console.log(`${q.id} [${q.domain}/${q.severity}] ${q.status}${q.answerer ? ` via ${q.answerer.adapter}` : ""} — ${q.text}`);
      }
      break;
    }
    case "show": {
      const q = loadQuestions().find((x) => x.id === args[0]);
      if (!q) { console.error(`no question ${args[0]}`); process.exit(1); }
      const store = new Store(undefined, { readonly: true });
      console.log(JSON.stringify({ question: q, history: store.history(q.id) }, null, 2));
      store.close();
      break;
    }
    case "board": {
      const store = new Store(undefined, { readonly: true });
      console.log(board(store, loadQuestions()));
      store.close();
      break;
    }
    case "findings": {
      const store = new Store(undefined, { readonly: true });
      console.log(JSON.stringify(store.openFindings(), null, 2));
      store.close();
      break;
    }
    case "route": {
      const store = new Store();
      const qs = loadQuestions();
      const dryRun = args.includes("--dry-run");
      const deps = await defaultDeps((l) => console.log(`  ${l}`));
      const r = routeFindings(store, qs, deps, { dryRun });
      if (!dryRun) exportSnapshot(store, qs);
      console.log(JSON.stringify({ dry_run: dryRun, registered: r.registered, ticketed: r.ticketed, emailed: r.emailed, closed: r.closed, held: r.held.map((h) => `${h.finding.question_id}${h.finding.instance_key ? `|${h.finding.instance_key}` : ""}: ${h.why}`), errors: r.errors }, null, 2));
      break;
    }
    case "rebuild": {
      const store = new Store();
      console.log(JSON.stringify(store.rebuild()));
      exportSnapshot(store, loadQuestions());
      break;
    }
    case "export": {
      const store = new Store(undefined, { readonly: true });
      exportSnapshot(store, loadQuestions());
      console.log(JSON.stringify({ snapshot: SNAPSHOT_PATH }));
      store.close();
      break;
    }
    default:
      console.log("socrates: tick | sync <adapter> | route [--dry-run] | list | show <id> | board | findings | validate | export | rebuild | seed");
  }
}
