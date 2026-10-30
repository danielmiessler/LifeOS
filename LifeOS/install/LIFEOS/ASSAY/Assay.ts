#!/usr/bin/env bun
/**
 * Assay.ts — Assay's judgment layer: one front door for every fuzzy call the
 * harness makes, with Clef-omni (LIFEOS/ASSAY/Engine.ts) as the engine underneath.
 * See LIFEOS/DOCUMENTATION/Assay/AssaySystem.md § Judgment layer.
 *
 * This file owns the runtime that makes an engine answer safe to act on: the caller
 * registry loading and validation (mode, thresholds, budgets, fail-open policy),
 * decide() — the ONLY way a caller may act on an answer — the shadow ledger,
 * budget enforcement, and model-drift reverts. Reports, tuning, promotion, the
 * agreement joins, status, alerts and the CLI live in ./Report.ts, which this file
 * loads only when its CLI runs; registry shapes and the floor read live in the leaf
 * ./Registry.ts (ISA 20261010-evals-in-the-isa ISC-32). `LIFEOS/ASSAY/Engine.ts` keeps
 * only what is vendor-specific: the endpoint, the question/answer types, the key,
 * the secret-shape refusal, and the raw fetch call (`callEngine`).
 *
 * The contract a caller sees is one function: `judge(state, questions, { caller })`
 * asks the engine, writes the ledger line, and returns per question id the answer
 * plus a verdict (`act`, `mode`, `threshold`, `reason`). A shadow or unregistered
 * caller never gets `act: true`. `ask()` and `decide()` are exported too, for a
 * caller that needs the raw answer or holds one it wants a verdict on.
 *
 * EXTRACTION (ISA M8): `extract(state, fields, { caller })` and `extractMany()` ask the second
 * engine, Clairic (./Extract.ts), for typed field values through the same registry, budget, sample
 * rate, kill switch and ledger. An unregistered caller is refused. An extracted value is data, never
 * a verdict: it never passes through decide(). Doc: AssaySystem.md § Extraction.
 *
 * SHADOW LOG: every call, success or failure, appends one JSONL line to
 * MEMORY/OBSERVABILITY/assay.jsonl — caller, session, question ids,
 * answers, confidences, latency, tokens, model, request id, error, and the
 * engine fingerprint the daily canary last measured (./Fingerprint.ts). Never the
 * state, never the key, never media. An extract() line carries `tier: "extract"` and, per field,
 * only its type, p_null, confidence and whether the value was null or unverified: never a value. `report` joins it with the dispatch log so an answer
 * can be compared with what actually happened before anything enforces it.
 *
 * Usage:
 *   bun LIFEOS/ASSAY/Assay.ts status                      per-caller mode, rows, error rate, agreement
 *   bun LIFEOS/ASSAY/Assay.ts ask --state "<text>" --questions '<json map>' [--caller name]
 *   bun LIFEOS/ASSAY/Assay.ts ask-many --states <jsonl of {key,state}> --questions '<json map>' [--caller name] [--concurrency N]
 *   bun LIFEOS/ASSAY/Assay.ts report [--days N] [--caller dispatch-advisor]
 *   bun LIFEOS/ASSAY/Assay.ts alerts
 *   bun LIFEOS/ASSAY/Assay.ts drift
 *   bun LIFEOS/ASSAY/Assay.ts callers [--check-docs]
 *
 * Environment:
 *   LIFEOS_GLANCE_LOG       override the shadow-log path
 *   LIFEOS_GLANCE_CALLERS   override the caller registry
 *   LIFEOS_GLANCE_DISABLED  "1" refuses every call
 *   The LIFEOS_JEV_* names of all three (retired 2026-10-10) are still read as fallbacks.
 *
 * Exit codes: 0 ok · 1 error (missing key, API failure, bad arguments, alerts firing)
 *
 * @author LifeOS System
 * @version 1.0.0
 */

import { createHash, randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { CROSS_VENDOR } from "../TOOLS/models";
import { lifeosPath } from "../TOOLS/Paths";
import { invariant } from "../TOOLS/Invariant";
import { yesAt } from "./Cut";
import { callEngine, EngineError, resolveApiKey, type Answer, type EngineMedia, type EngineResponse, type Questions } from "./Engine";
import { callExtractor, extractModel, type ExtractAnswers, type ExtractFields, type ExtractMedia, type ExtractResponse } from "./Extract";
// Drift events go to STATVS writeEvent (migration design §2.1). The guarded optional import stays (ShadowRelease
// OPTIONAL_IMPORT_SITES): an install without LIFEOS/STATVS/ still reverts and skips the event. A refusal throws into the caller's log line.
const vigilEmitPath = join(import.meta.dir, "../STATVS/index.ts");
// Loaded on first use, not with a top-level await: the await made this module, and every module that imports it,
// async. The workflow CLI reaches Assay through engine/steps/judgment.ts, and VIGIL/Emit.ts's synchronous require of
// STATVS/lib/event then failed with "require() async module … is unsupported", so no `workflow.ts` command started.
let vigilEmitter: Record<string, unknown> | null | undefined;
const emitVigil: DriftEmitter = (event) => {
  if (vigilEmitter === undefined) vigilEmitter = existsSync(vigilEmitPath) ? (require(vigilEmitPath) as Record<string, unknown>) : null;
  if (!vigilEmitter) return undefined;
  const sent = (vigilEmitter.writeEvent as (e: VigilEvent) => { ok: boolean; refused?: string })(event);
  if (!sent.ok) throw new Error(sent.refused);
  return sent;
};
import { earnedStatus, type EarnedStatus } from "../TOOLS/lib/LabelStore.ts";
import { currentFingerprint, defaultCallersPath, enforcedQuestions, readRegistry, thresholdRows, waiverState, MAX_WAIVER_DAYS, type CallerConfig, type CallerMode, type CallerRegistry, type CallersConfig, type CallerThreshold, type GroundTruth, type RegistryDefaults } from "./Registry.ts";
type VigilEvent = { id: string; source: string; ts: string; kind: string; severity: string; title: string; summary: string; ref: string | null; url: string | null; privacy_class: string; dedup_key: string; meta?: Record<string, unknown> };

// ── Caller registry ───────────────────────────────────────────────────────────

// The registry shapes and pure row readers live in the leaf ./Registry.ts (so the label store can read floors without
// importing this file); they are re-exported here so every caller keeps importing them from Assay.ts.
export { defaultCallersPath, enforcedQuestions, thresholdRows };
export type { CallerConfig, CallerMode, CallerRegistry, CallersConfig, CallerThreshold, EnforceEvidence, GroundTruth, RegistryDefaults } from "./Registry.ts";

/** Throws InvariantViolation on a config that parses but violates a hard rule. Returns {} on a missing file or unparsable JSON (fail open — the file may not exist yet). */
export function loadCallers(path?: string): CallersConfig {
  return loadRegistry(path).callers;
}

/**
 * Load caller rows plus optional top-level registry defaults without exposing the reserved defaults row as a caller.
 * readRegistry() (the leaf) parses and checks the floors; this adds the full validateCallers pass, so every runtime read
 * and every writer refuses a row that breaks a hard rule, unearned enforce included.
 */
export function loadRegistry(path?: string): CallerRegistry {
  const { callers, defaults } = readRegistry(path);
  validateCallers(callers, { defaults });
  return { callers, defaults };
}

/** Register an uncalibrated question without changing its caller's policy. */
export function registerQuestion(caller: string, id: string, opts: { callersPath?: string } = {}): void {
  const path = opts.callersPath ?? defaultCallersPath();
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error("invalid question id");
  // Unlike runtime reads, a writer must never turn malformed JSON into an empty registry.
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const { callers, defaults } = loadRegistry(path);
  if (!Object.hasOwn(callers, caller)) throw new Error(`caller "${caller}" is not registered`);
  const cfg = callers[caller]!;
  if ([cfg.thresholds, cfg.ground_truth, cfg.corrective].some(map => Object.hasOwn(map, id))) throw new Error(`duplicate question id ${caller}.${id}`);
  if (defaults.provisional_threshold === undefined) throw new Error("registration requires defaults.provisional_threshold");
  cfg.thresholds[id] = { value: defaults.provisional_threshold, calibrated: null, model: null, samples: 0, agreement: null, balanced_accuracy: null, mode: "shadow" };
  cfg.ground_truth[id] = { source: "bunker miss/label kept cases in the claim seed", join_key: "isa path + claim id + state sha256" };
  cfg.corrective[id] = false;
  validateCallers(callers);
  raw[caller] = cfg;
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, JSON.stringify(raw, null, 2) + "\n", { flag: "wx", mode: statSync(path).mode & 0o777 });
    renameSync(temporary, path);
  } finally {
    rmSync(temporary, { force: true });
  }
}

/** Remove one question from the Glance system, preserving caller policy. */
export function unregisterQuestion(caller: string, id: string, opts: { callersPath?: string } = {}): void {
  const path = opts.callersPath ?? defaultCallersPath();
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const { callers } = loadRegistry(path);
  if (!Object.hasOwn(callers, caller)) throw new Error(`caller "${caller}" is not registered`);
  const cfg = callers[caller]!;
  for (const map of [cfg.thresholds, cfg.ground_truth, cfg.corrective]) delete map[id];
  validateCallers(callers);
  raw[caller] = cfg;
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, JSON.stringify(raw, null, 2) + "\n", { flag: "wx", mode: statSync(path).mode & 0o777 });
    renameSync(temporary, path);
  } finally { rmSync(temporary, { force: true }); }
}

/**
 * The one writer of calibrated threshold rows, beside registerQuestion: parse the raw file (malformed JSON throws and never
 * becomes an empty registry), validate through loadRegistry, replace only the named rows of this caller (and, when given,
 * the ground truth of the same questions), validate again, then write a temp file and rename it over. Only registered
 * questions can be written. A caller that must not change policy while it is calibrated passes requireShadow.
 */
export function writeThresholdRows(
  caller: string,
  rows: Record<string, CallerThreshold>,
  opts: { callersPath?: string; groundTruth?: Record<string, GroundTruth | null>; requireShadow?: boolean } = {},
): void {
  const path = opts.callersPath ?? defaultCallersPath();
  const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  const { callers } = loadRegistry(path);
  const cfg = callers[caller];
  invariant(cfg, `${caller} is not registered`);
  if (opts.requireShadow) invariant(cfg.mode === "shadow", `${caller} must stay shadow`);
  const truth = opts.groundTruth ?? {};
  for (const id of new Set([...Object.keys(rows), ...Object.keys(truth)])) invariant(Object.hasOwn(cfg.thresholds, id), `${caller}.${id} is not registered`);
  for (const [id, row] of Object.entries(rows)) {
    invariant(Number.isFinite(row.value) && row.value >= 0 && row.value <= 1, `${caller}.${id}: cut out of range`);
    cfg.thresholds[id] = row;
  }
  for (const [id, gt] of Object.entries(truth)) cfg.ground_truth[id] = gt;
  validateCallers(callers);
  if (opts.requireShadow) invariant(callers[caller]!.mode === "shadow", `${caller} left shadow during the write`);
  raw[caller] = cfg;
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, JSON.stringify(raw, null, 2) + "\n", { flag: "wx", mode: statSync(path).mode & 0o777 });
    renameSync(temporary, path);
  } finally { rmSync(temporary, { force: true }); }
}


/**
 * Throws InvariantViolation on a registry row that breaks a hard rule. Enforce must be earned (ISC-14): a caller in enforce
 * needs every question it would enforce (a threshold row not marked shadow) to read earned in the label store, and a
 * question marked enforce needs the same, whatever enforce_evidence says. Hand-typed evidence earns nothing. The earned
 * read uses the registry being validated (its defaults and floors), so it never re-enters loadRegistry.
 */
export function validateCallers(raw: CallersConfig, opts: { defaults?: RegistryDefaults; labelPath?: string } = {}): void {
  // No injectable "earned" answer: the label store is the only thing that can say earned.
  const earned = (q: { caller: string; question: string }): EarnedStatus => earnedStatus(q, { path: opts.labelPath, registry: { callers: raw, defaults: opts.defaults ?? {} } });
  for (const [name, cfg] of Object.entries(raw)) {
    if (name === "defaults") continue; // reserved registry-defaults row, never a caller (loadCallers strips it; raw-file validators reach here)
    invariant(cfg && (cfg.mode === "shadow" || cfg.mode === "enforce"), `assay-callers.json: "${name}".mode must be "shadow" or "enforce"`);
    if (cfg.mode === "enforce") {
      invariant(
        !!cfg.enforce_evidence && typeof cfg.enforce_evidence.agreement === "number" && typeof cfg.enforce_evidence.date === "string" && typeof cfg.enforce_evidence.model === "string",
        `assay-callers.json: "${name}" is mode=enforce without enforce_evidence.agreement, .date and .model`,
      );
    }
    if (cfg.waiver !== undefined) {
      const w = cfg.waiver, start = Date.parse(w?.date ?? ""), end = Date.parse(w?.expires ?? "");
      invariant(w?.by === "principal" && typeof w.reason === "string" && w.reason.length > 0 && Number.isFinite(start) && Number.isFinite(end) && end > start && end - start <= MAX_WAIVER_DAYS * 86_400_000,
        `assay-callers.json: "${name}".waiver needs by=principal, a reason, and expires within ${MAX_WAIVER_DAYS} days of date`);
    }
    // A principal waiver stands in for earned labels while it lasts; decide() refuses to act once it expires unearned.
    for (const id of cfg.waiver ? [] : enforcedQuestions(cfg)) {
      const e = earned({ caller: name, question: id });
      invariant(
        e.earned,
        `assay-callers.json: "${name}.${id}" is enforce but has not earned it: ${e.n} principal right/wrong labels at agreement ${e.agreement === null ? "none" : e.agreement.toFixed(2)}, needs ${e.min_labels} at ${e.bar}${e.reason ? ` (${e.reason})` : ""}. enforce_evidence alone does not earn (ISC-14).`,
      );
    }
    if (cfg.sample_rate !== undefined) invariant(typeof cfg.sample_rate === "number" && Number.isFinite(cfg.sample_rate) && cfg.sample_rate > 0 && cfg.sample_rate <= 1, `assay-callers.json: "${name}".sample_rate must be a number in (0, 1]`);
    invariant(cfg.ground_truth && typeof cfg.ground_truth === "object" && !Array.isArray(cfg.ground_truth), `${name}: ground_truth must be per-question`);
    invariant(cfg.corrective && typeof cfg.corrective === "object" && !Array.isArray(cfg.corrective), `${name}: corrective must be per-question`);
    for (const id of new Set([...Object.keys(cfg.thresholds), ...Object.keys(cfg.corrective), ...Object.keys(cfg.ground_truth)])) {
      invariant(typeof cfg.corrective[id] === "boolean" && Object.hasOwn(cfg.ground_truth, id), `${name}.${id}: ground_truth and corrective entries required`);
      const truth = cfg.ground_truth[id];
      invariant(truth === null || (typeof truth?.source === "string" && typeof truth?.join_key === "string"), `${name}.${id}: invalid ground truth`);
      const threshold = cfg.thresholds[id];
      if (threshold) invariant(Number.isFinite(threshold.value) && threshold.value >= 0 && threshold.value <= 1, `${name}.${id}: invalid threshold`);
      if (threshold?.mode !== undefined) invariant(threshold.mode === "shadow" || threshold.mode === "enforce", `${name}.${id}: invalid question mode`);
      if (threshold?.min_positives !== undefined) invariant(Number.isInteger(threshold.min_positives) && threshold.min_positives >= 1, `${name}.${id}: invalid positive label floor`);
      if (threshold?.min_labels !== undefined) invariant(Number.isInteger(threshold.min_labels) && threshold.min_labels >= 1, `${name}.${id}: invalid label floor`);
      if (!cfg.corrective[id] || !truth) continue;
      invariant(
        !/subagent-events\.jsonl|dispatch[\s-]?log|carrier(?:'s)?\s+(?:own\s+)?action/i.test(truth.source),
        `assay-callers.json: "${name}.${id}" is corrective with a carrier-action ground_truth.source — ISC-41 requires a human or independent-lane label`,
      );
    }
  }
}

/** Fail-open wrapper for runtime call sites (ask(), decide()): never throws, never blocks a turn. Logs an invariant error once per call and returns null. */
export function safeCallerConfig(caller: string, path?: string): CallerConfig | null {
  try {
    const all = loadCallers(path);
    return all[caller] ?? null;
  } catch (e) {
    console.error(`[Assay] caller registry error for "${caller}", failing open: ${(e as Error)?.message ?? e}`);
    return null;
  }
}


export type EffectiveMode = CallerMode | "unregistered";
export type Decision = {
  /** The only licence to act: true only when the effective mode is enforce and the answer clears the registered threshold. */
  act: boolean;
  /**
   * What enforce would decide for this answer against the registered threshold, whatever the mode is today; null when
   * the question has no registered threshold, the caller is unregistered, or the answer cannot be scored. A shadow
   * consumer may RECORD it (a flag, a label candidate) and must never act on it: that is what `act` is for (ISC-7).
   */
  wouldAct: boolean | null;
  /**
   * The raw reading: the answer's probability of "yes" is at or above the registered cut (yesAt). Unlike wouldAct, which
   * is a confidence model (max(p, 1-p) >= cut, used by Proof's flag rule), yes is identical to the pre-S1b `p >= cut` for
   * every cut, including cuts below 0.5. null when the question has no registry row, the caller is unregistered, or the
   * answer has no scorable probability (an invalid noul, or a choice/score answer with no probability or confidence).
   */
  yes: boolean | null;
  mode: CallerMode | "unregistered";
  /** The lower of the caller's and the question's mode; "unregistered" when the caller or the question has no registry row. */
  effectiveMode: EffectiveMode;
  threshold: number | null;
  reason: string;
  verdict?: "yes" | "no";
  confidence?: number;
};

export function noulValue(p: number): { verdict: "yes" | "no"; confidence: number } {
  if (!Number.isFinite(p) || p < 0 || p > 1) throw new EngineError("Invalid noul probability", "shape");
  return { verdict: p >= 1 - p ? "yes" : "no", confidence: Math.max(p, 1 - p) };
}

export { yesAt };

/**
 * The source-level rule ThresholdReaders.test.ts and the /ic glance-gates check share, so the two cannot disagree: outside
 * LIFEOS/ASSAY no code indexes a caller's thresholds map, and no code puts a comparison operator on a noul answer's
 * probability or on a choice answer's probabilities[...]. Comparisons to a literal 0 or 1 are range checks (is this a
 * probability at all), never a cut. Comment lines are not code. A cut is applied by decide() or yesAt() and nowhere else.
 */
export const THRESHOLD_INDEX_RE = /\bthresholds\s*(?:\?\.)?\s*\[/;
const CMP = String.raw`(?:>=|<=|(?<![=-])>(?!=)|<(?![=<]))`;
const NOT_RANGE_BOUND = String.raw`(?!\s*(?:0|1)(?![.\d]))`;
const PROBABILITY_CMP_RES: RegExp[] = [
  new RegExp(String.raw`\.noul\b!?\s*` + CMP + NOT_RANGE_BOUND),
  new RegExp(CMP + String.raw`\s*[\w$.!?\[\]]*\.noul\b`),
  new RegExp(String.raw`\bprobabilities\s*\??\.?\[[^\]]*\]!?\s*` + CMP + NOT_RANGE_BOUND),
  new RegExp(CMP + String.raw`\s*[\w$.!?]*probabilities\s*\??\.?\[[^\]]*\]`),
  /\bp\s*>=\s*1\s*-\s*p\b/,
];
/** True when one source line reads a registry cut itself: indexes a thresholds map or compares an answer's probability. */
export function readsCutOutsideGlance(line: string): boolean {
  if (/^\s*(?:\/\/|\*|\/\*)/.test(line)) return false;
  return THRESHOLD_INDEX_RE.test(line) || PROBABILITY_CMP_RES.some((re) => re.test(line));
}

function answerValue(a: Answer): number | null {
  if (a.type === "noul") return noulValue(a.noul).confidence;
  if (a.type === "choice") return a.probabilities?.[a.choice] ?? a.confidence ?? null;
  if (a.type === "score") return a.confidence ?? null;
  return null;
}

/** The lower of a caller's mode and one question's mode. A question with no registry row is "unregistered": nothing can enforce it. */
export function effectiveMode(cfg: CallerConfig | null, questionId: string): EffectiveMode {
  const t = cfg?.thresholds[questionId];
  if (!cfg || !t) return "unregistered";
  return cfg.mode === "enforce" && t.mode !== "shadow" ? "enforce" : "shadow";
}

/**
 * The ONLY way a caller may act on an engine answer, and the only place an engine probability meets a threshold. Never a code
 * literal — thresholds always come from the registry. `act` is the decision; `wouldAct` is what enforce would say,
 * returned in every mode so a shadow consumer can raise a flag without reading a threshold itself.
 */
export function decide(callerName: string, questionId: string, answer: Answer, callersPath?: string): Decision {
  let resolved: Partial<Decision> = {};
  try { if (answer.type === "noul") resolved = noulValue(answer.noul); }
  catch { return { act: false, wouldAct: null, yes: null, mode: "unregistered", effectiveMode: "unregistered", threshold: null, reason: "invalid noul probability" }; }
  const cfg = safeCallerConfig(callerName, callersPath);
  if (!cfg) return { ...resolved, act: false, wouldAct: null, yes: null, mode: "unregistered", effectiveMode: "unregistered", threshold: null, reason: `caller "${callerName}" is not registered` };
  const t = cfg.thresholds[questionId];
  const value = answerValue(answer);
  const shared = { ...resolved, wouldAct: t && value !== null ? value >= t.value : null, yes: t ? yesAt(answer, t.value) : null, effectiveMode: effectiveMode(cfg, questionId) };
  if (cfg.mode !== "enforce") return { ...shared, act: false, mode: cfg.mode, threshold: null, reason: `caller is ${cfg.mode}` };
  if (!t) return { ...shared, act: false, mode: cfg.mode, threshold: null, reason: `no threshold registered for question "${questionId}"` };
  if (t.mode === "shadow") return { ...shared, act: false, mode: "shadow", threshold: t.value, reason: "question is shadow" };
  // A waiver stands in for earned labels only while it is in force: from its date, before its expiry, within the cap.
  const waiver = cfg.waiver ? waiverState(cfg.waiver) : null;
  if (waiver && waiver !== "active" && !earnedStatus({ caller: callerName, question: questionId }, { callersPath }).earned) {
    const why = waiver === "pending" ? "has not started yet" : waiver === "expired" ? "expired" : "is malformed";
    return { ...shared, act: false, mode: cfg.mode, threshold: t.value, reason: `principal waiver ${why} and the labels have not earned it` };
  }
  const clears = shared.wouldAct === true;
  return { ...shared, act: clears, mode: cfg.mode, threshold: t.value, reason: clears ? "cleared threshold" : "below threshold" };
}

// ── Shadow log ────────────────────────────────────────────────────────────────

export function defaultLogPath(): string {
  return process.env.LIFEOS_GLANCE_LOG || process.env.LIFEOS_JEV_LOG || lifeosPath("MEMORY", "OBSERVABILITY", "assay.jsonl");
}

function defaultLogPaths(): string[] {
  if (process.env.LIFEOS_GLANCE_LOG || process.env.LIFEOS_JEV_LOG) return [defaultLogPath()];
  return [defaultLogPath(), lifeosPath("MEMORY", "OBSERVABILITY", "jev-decisions.jsonl")];
}

export type ShadowLine = {
  isa_key?: string;
  claim?: string;
  state_sha256?: Record<string, string>;
  /** Additional assertion rows from the same request do not consume another call. */
  call_count?: number;
  ts: string;
  caller: string;
  session: string | null;
  turn?: string;
  model: string | null;
  request_id: string | null;
  latency_ms: number;
  input_tokens: number | null;
  output_tokens: number | null;
  questions: string[];
  answers: Record<string, { type: string; choice?: string; score?: number; noul?: number; confidence?: number; probabilities?: Record<string, number> }> | null;
  error: string | null;
  error_kind: string | null;
  model_versioned: string | null;
  /**
   * The engine canary's fingerprint (Fingerprint.ts) current when this row was written, or null when the canary has not
   * fingerprinted the engine asked. A separate field: `model_versioned` stays the model id threshold stamps compare with.
   * ask() writes it on every row; rows from before 2026-10-10 lack it.
   */
  engine_fingerprint?: string | null;
  /** "extract" on a Clairic call (extract()); absent on a Clef-omni call. */
  tier?: "extract";
  /**
   * Per extract field: its type, p_null, confidence, and whether the value came back null or failed the span check.
   * Never the value: an extracted value is state text or computed from it. Present on a successful extract() line only.
   */
  fields?: Record<string, { type: string; p_null: number | null; confidence: number | null; null: boolean; unverified?: true }>;
  /** True when the extractor cut the state to fit (extract() lines only). */
  truncated?: boolean;
};

function writeShadow(line: ShadowLine, logPath: string): void {
  try {
    const dir = dirname(logPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    appendFileSync(logPath, JSON.stringify(line) + "\n", "utf8");
    if (logPath === defaultLogPath()) bumpUsage(line);
  } catch {
    // the log must never affect the answer
  }
}

/**
 * The day's per-caller usage as a small counter file beside the ledger, so the budget check
 * stops parsing the whole shadow history (30 MB+, ~190 ms) on every call (router review,
 * 2026-09-25). The first write of a UTC day seeds it from the history once; every later write
 * adds its own call and tokens. Two processes writing in the same instant can drop one
 * increment: the budget is a soft cap and fails open, so an undercount by one is the accepted cost.
 */
export function usageCounterPath(day = new Date().toISOString().slice(0, 10)): string {
  return join(dirname(defaultLogPath()), "assay-usage", `${day}.json`);
}
type UsageCounter = Record<string, { calls: number; tokens: number }>;
/**
 * A row written without an engine call: the budget gate skipped it, or Glance was disabled or had no key. It is a ledger
 * line, never a billed call, so it adds nothing to the usage counter (before 2026-10-10 a budget-skip row counted as a
 * call, inflating the day's calls far past the cap on capped callers). Older rows carry only `error`.
 */
export const isUnbilled = (s: Pick<ShadowLine, "error" | "error_kind">): boolean => ["budget", "disabled", "no-key"].includes((s.error_kind ?? s.error) as string);
/** The billed calls one row stands for: zero for an unbilled row, else its call_count (additional pooled rows carry 0). */
const billedCalls = (s: Pick<ShadowLine, "error" | "error_kind" | "call_count">): number => isUnbilled(s) ? 0 : s.call_count ?? 1;
function readCounter(path: string): UsageCounter | null {
  try { const v = JSON.parse(readFileSync(path, "utf8")); return v && typeof v === "object" && !Array.isArray(v) ? v as UsageCounter : null; } catch { return null; }
}
function seedCounter(day: string): UsageCounter {
  const out: UsageCounter = {};
  for (const o of readShadowHistory()) {
    if (!o.caller || !o.ts || !o.ts.startsWith(day)) continue;
    const c = out[o.caller] ??= { calls: 0, tokens: 0 };
    c.calls += billedCalls(o); c.tokens += (o.input_tokens ?? 0) + (o.output_tokens ?? 0);
  }
  return out;
}
function writeCounter(path: string, counter: UsageCounter): void {
  invariant(Object.values(counter).every(c => Number.isFinite(c.calls) && c.calls >= 0 && Number.isFinite(c.tokens) && c.tokens >= 0), "glance usage counter: calls and tokens are non-negative numbers");
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(counter));
  renameSync(tmp, path);
}
function bumpUsage(line: ShadowLine): void {
  const day = line.ts.slice(0, 10), path = usageCounterPath(day);
  const existing = readCounter(path);
  // A missing counter is seeded from the history, which already holds the line just appended.
  if (!existing) { writeCounter(path, seedCounter(day)); return; }
  if (isUnbilled(line)) return; // no engine call, nothing billed: the counter stays as it is
  const c = existing[line.caller] ??= { calls: 0, tokens: 0 };
  c.calls += billedCalls(line); c.tokens += (line.input_tokens ?? 0) + (line.output_tokens ?? 0);
  writeCounter(path, existing);
}

function summarize(answers: Record<string, Answer>): ShadowLine["answers"] {
  const out: NonNullable<ShadowLine["answers"]> = {};
  for (const [id, a] of Object.entries(answers)) {
    if (a.type === "noul") out[id] = { type: "noul", noul: a.noul, confidence: noulValue(a.noul).confidence };
    else if (a.type === "choice") out[id] = { type: "choice", choice: a.choice, confidence: a.confidence, probabilities: a.probabilities };
    else out[id] = { type: "score", score: a.score, confidence: a.confidence, probabilities: a.probabilities };
  }
  return out;
}

/** Today's billed call/token usage for one caller, from the shadow log, UTC calendar day (unbilled rows count zero). Never throws — an unreadable log means zero usage (fail open). */
export function todayUsage(caller: string, logPath: string = defaultLogPath()): { calls: number; tokens: number } {
  const todayPrefix = new Date().toISOString().slice(0, 10);
  let calls = 0, tokens = 0;
  try {
    if (logPath === defaultLogPath()) {
      const counter = readCounter(usageCounterPath(todayPrefix));
      if (counter) return { calls: counter[caller]?.calls ?? 0, tokens: counter[caller]?.tokens ?? 0 };
    }
    const rows = logPath === defaultLogPath() ? readShadowHistory() : readJsonl<ShadowLine>(logPath);
    for (const o of rows) {
      if (o.caller !== caller || !o.ts || !o.ts.startsWith(todayPrefix)) continue;
      calls += billedCalls(o);
      tokens += (o.input_tokens ?? 0) + (o.output_tokens ?? 0);
    }
  } catch { return { calls: 0, tokens: 0 }; }
  return { calls, tokens };
}

// ── Sampling ─────────────────────────────────────────────────────────────────

/**
 * Where one state falls in [0, 1) for one caller: the first 52 bits of sha256(caller NUL state) as a fraction. The same
 * state always lands in the same place, so a re-asked state is sampled the same way every time, and two callers sample
 * independently. An object state is hashed as its JSON.
 */
export function sampleUnit(caller: string, state: string | object): number {
  const text = typeof state === "string" ? state : JSON.stringify(state);
  const hex = createHash("sha256").update(`${caller}\u0000${text}`).digest("hex").slice(0, 13);
  return parseInt(hex, 16) / 2 ** 52;
}

/** Whether this call reaches the engine under the caller's sample_rate. Always true without a rate, and for a caller that enforces any question: sampling is a shadow-only spend control and never drops a call whose answer acts. */
export function sampledIn(caller: string, state: string | object, cfg: Pick<CallerConfig, "mode" | "thresholds" | "sample_rate">): boolean {
  if (cfg.sample_rate === undefined || cfg.mode !== "shadow" || enforcedQuestions(cfg).length > 0) return true;
  return sampleUnit(caller, state) < cfg.sample_rate;
}

/**
 * A call the caller's sample_rate left out. It carries kind "budget" because sampling is the budget spread over the day,
 * so every existing EngineError handler treats it as a spend skip (fail open, no retry); `instanceof GlanceSampleSkip` tells
 * the two apart. It writes no ledger line: sampling exists to cut volume, and the rows that are written are the sample.
 */
export class GlanceSampleSkip extends EngineError {
  constructor(caller: string, rate: number) {
    super(`Glance sampled out this call for caller "${caller}" (sample_rate ${rate})`, "budget");
    this.name = "GlanceSampleSkip";
  }
}

// ── ask() and judge() ────────────────────────────────────────────────────────

export type AskOptions = {
  /** Local ledger identity; never sent to the engine. */
  extra?: Pick<ShadowLine, "isa_key" | "claim" | "state_sha256">;
  /** Map pooled wire IDs to registered questions and the existing ledger join fields. */
  questionJoins?: Record<string, { question: string; turn: string }>;
  /** Who is asking — the shadow log's join key. Required. */
  caller: string;
  /** Session id for the shadow log, when known. */
  session?: string;
  /** Local correlation only; never included in the vendor request. */
  turn?: string;
  model?: string;
  timeoutMs?: number;
  /** Images, audio or video for the engine to read beside the state (Clef-omni). Sent to the engine only; never written to the ledger. */
  media?: EngineMedia;
  /** Test seam: replaces global fetch. */
  fetchImpl?: typeof fetch;
  /** Test seam: replaces the shadow-log path. */
  logPath?: string;
  /** Test seam: replaces key resolution. */
  apiKey?: string;
  callersPath?: string;
  env?: NodeJS.ProcessEnv;
};

/**
 * One System One call, with the caller registry, budget enforcement and the shadow
 * ledger wrapped around the engine's raw call. Throws EngineError on a disabled engine,
 * a missing key, an exhausted budget, a call its sample_rate leaves out (GlanceSampleSkip),
 * or any failure `callEngine` reports. Writes one shadow line, except for a sampled-out call.
 */
export async function ask(state: string | object, questions: Questions, opts: AskOptions): Promise<EngineResponse> {
  invariant(typeof opts?.caller === "string" && opts.caller.length > 0, "Assay.ask: caller is required (shadow-log join key)");
  invariant(questions && Object.keys(questions).length > 0, "Assay.ask: at least one question");
  const logPath = opts.logPath ?? defaultLogPath();
  const model = opts.model ?? CROSS_VENDOR.assayEngine;
  const ids = Object.keys(questions);
  const t0 = performance.now();
  // The fingerprint names the live engine's weights, so a call to any other model records none.
  const engine_fingerprint = model === CROSS_VENDOR.assayEngine ? currentFingerprint() : null;
  const base = { ...opts.extra, ts: new Date().toISOString(), caller: opts.caller, session: opts.session ?? null, ...(opts.turn ? { turn: opts.turn } : {}), questions: ids, engine_fingerprint };

  const env = opts.env ?? process.env;
  if (env.LIFEOS_INFERENCE_DISABLED) throw new EngineError(`inference disabled: ${env.LIFEOS_INFERENCE_DISABLED}`, "disabled");
  if (env.LIFEOS_GLANCE_DISABLED === "1" || env.LIFEOS_JEV_DISABLED === "1") {
    writeShadow({ ...base, model: null, model_versioned: null, request_id: null, latency_ms: 0, input_tokens: null, output_tokens: null, answers: null, error: "disabled", error_kind: "disabled" }, logPath);
    throw new EngineError("judgment layer disabled by LIFEOS_GLANCE_DISABLED (or its legacy name, retired 2026-10-10)", "disabled");
  }

  const key = opts.apiKey ?? resolveApiKey();
  if (!key) {
    writeShadow({ ...base, model: null, model_versioned: null, request_id: null, latency_ms: 0, input_tokens: null, output_tokens: null, answers: null, error: "no-key", error_kind: "no-key" }, logPath);
    throw new EngineError("CLOUDFLARE_ACCOUNT_ID or the Cloudflare API token is not set (env or .env)", "no-key");
  }

  const cfg = safeCallerConfig(opts.caller, opts.callersPath);
  if (cfg && !sampledIn(opts.caller, state, cfg)) throw new GlanceSampleSkip(opts.caller, cfg.sample_rate!);
  if (cfg) {
    const usage = todayUsage(opts.caller, logPath);
    if (usage.calls >= cfg.budget.calls_per_day || usage.tokens >= cfg.budget.tokens_per_day) {
      writeShadow({ ...base, model: null, model_versioned: null, request_id: null, latency_ms: 0, input_tokens: null, output_tokens: null, answers: null, error: "budget", error_kind: "budget" }, logPath);
      throw new EngineError("engine budget exceeded for caller \"" + opts.caller + "\"", "budget");
    }
  }

  const outcome = await callEngine(state, questions, { model, apiKey: key, timeoutMs: opts.timeoutMs, fetchImpl: opts.fetchImpl, ...(opts.media ? { media: opts.media } : {}) }, t0);

  if (!outcome.ok) {
    const errKey = outcome.kind === "http" ? `http-${outcome.status}` : outcome.kind;
    writeShadow({ ...base, model: outcome.model, model_versioned: null, request_id: outcome.requestId, latency_ms: outcome.latencyMs, input_tokens: null, output_tokens: null, answers: null, error: errKey, error_kind: errKey }, logPath);
    throw new EngineError(outcome.message, outcome.kind, outcome.status);
  }

  const r = outcome.response;
  for (const answer of Object.values(r.answers)) {
    if (answer.type === "noul") Object.assign(answer, noulValue(answer.noul));
  }
  const line: ShadowLine = {
    ...base, model: r.model, request_id: r.request_id ?? null, latency_ms: r.latency_ms,
    input_tokens: r.usage?.input_tokens ?? null, output_tokens: r.usage?.output_tokens ?? null,
    answers: summarize(r.answers), error: null, error_kind: cfg ? null : "unregistered", model_versioned: r.model,
  };
  if (opts.questionJoins) {
    Object.entries(r.answers).forEach(([id, answer], index) => {
      const join = opts.questionJoins![id];
      const question = join?.question ?? id;
      writeShadow({ ...line, questions: [question], turn: join?.turn ?? line.turn,
        answers: summarize({ [question]: answer }), call_count: index === 0 ? 1 : 0,
        input_tokens: index === 0 ? line.input_tokens : 0, output_tokens: index === 0 ? line.output_tokens : 0,
      }, logPath);
    });
  } else writeShadow(line, logPath);
  return r;
}

export type JudgeResult = Record<string, { answer: Answer; verdict: Decision; model?: string; request_id?: string }>;

/**
 * Ask the engine, write the ledger line (via ask()), and return per question id the
 * answer plus a verdict computed with decide(). A shadow or unregistered caller never
 * gets `act: true` — decide() is the only place that can say so.
 */
export async function judge(state: string | object, questions: Questions, opts: AskOptions): Promise<JudgeResult> {
  return verdicts(await ask(state, questions, opts), opts);
}

/** One verdict per answer through decide(): the step judge() and judgeMany() share. */
function verdicts(r: EngineResponse, opts: AskOptions): JudgeResult {
  const out: JudgeResult = {};
  for (const [id, answer] of Object.entries(r.answers)) {
    out[id] = { answer, verdict: decide(opts.caller, opts.questionJoins?.[id]?.question ?? id, answer, opts.callersPath), model: r.model, request_id: r.request_id ?? undefined };
  }
  return out;
}

// ── Batches ───────────────────────────────────────────────────────────────────

/** One batch item. `media` (images, audio, video) goes to the engine with this item only, replacing any batch-wide opts.media; never to the ledger. */
export type ManyItem = { key: string; state: string | object; questions?: Questions; questionJoins?: AskOptions["questionJoins"]; media?: EngineMedia };
/** `latency_ms` and `usage` are the answering call's, as ask() measured them; absent on an item that failed. */
export type ManyResult = { key: string; result: JudgeResult | null; error: string | null; latency_ms?: number; usage?: EngineResponse["usage"] };
export type ManyOptions = AskOptions & { concurrency?: number; retries?: number };

/** A judgment is about a tenth of a second and independent of every other one, so a batch is a pool, never a loop. */
export const DEFAULT_CONCURRENCY = 32;

/**
 * Questions over many states, run as a bounded parallel pool; an item may override the shared map. This is the
 * ONLY way to ask about more than one item: a `for` loop awaiting judge() makes
 * N items cost N round trips in a row. Results come back in input order. Each
 * item's key is written as its ledger `turn` unless opts sets one, so a batch stays joinable.
 * One item's failure never fails the batch — it comes back as `error` after `retries`
 * further attempts (default 1), and every attempt writes its own ledger line.
 * The per-call budget check in ask() can overshoot by at most `concurrency` calls.
 */
export async function judgeMany(items: ManyItem[], questions: Questions, opts: ManyOptions): Promise<ManyResult[]> {
  const concurrency = opts.concurrency ?? DEFAULT_CONCURRENCY;
  const retries = opts.retries ?? 1;
  invariant(Number.isInteger(concurrency) && concurrency >= 1, "Assay.judgeMany: concurrency must be a positive integer");
  invariant(new Set(items.map((i) => i.key)).size === items.length, "Assay.judgeMany: item keys must be unique");
  const out: ManyResult[] = new Array(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const i = next++;
      const item = items[i]!;
      let error: string | null = null;
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          // The item key becomes the turn, so every row in the batch is traceable back to the
          // item that produced it. Without it a batch writes N rows that no ground-truth join
          // can match, since every join in this system keys on session + turn.
          const media = item.media ?? opts.media;
          const itemOpts: AskOptions = { ...opts, questionJoins: item.questionJoins ?? opts.questionJoins, turn: opts.turn ?? item.key, media };
          const r = await ask(item.state, item.questions ?? questions, itemOpts);
          out[i] = { key: item.key, result: verdicts(r, itemOpts), error: null, latency_ms: r.latency_ms, ...(r.usage ? { usage: r.usage } : {}) };
          error = null;
          break;
        } catch (e) {
          error = (e as Error)?.message ?? String(e);
          // A disabled engine, a missing key or a spent budget will not change on a second try.
          if (e instanceof EngineError && ["disabled", "no-key", "budget"].includes(e.kind)) break;
        }
      }
      if (error !== null) out[i] = { key: item.key, result: null, error };
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return out;
}
// ── Extraction (Clairic, ./Extract.ts) ───────────────────────────────────────

export type ExtractOptions = Omit<AskOptions, "questionJoins" | "media" | "extra"> & {
  /** Images for the extractor to read before the state. Sent to Clairic only; never written to the ledger. */
  media?: ExtractMedia;
  /** Test seam: the Workers AI account id (default: resolveCredentials()). */
  accountId?: string;
};

/** The ledger summary of one extract call: per field its type and certainty, never its value. */
function summarizeFields(answers: ExtractAnswers): NonNullable<ShadowLine["fields"]> {
  const out: NonNullable<ShadowLine["fields"]> = {};
  for (const [id, a] of Object.entries(answers)) out[id] = { type: a.type, p_null: a.p_null, confidence: a.confidence, null: a.value === null, ...(a.unverified ? { unverified: true as const } : {}) };
  return out;
}

/**
 * One Clairic call with the same door as ask(): the kill switch, the caller registry (an unregistered caller is
 * refused, unlike ask()), the sample rate, the daily budget, and one ledger line marked `tier: "extract"` whether the
 * call worked or failed (a sampled-out call writes none, as in ask()). Throws EngineError on every refusal and failure.
 * The line's `model_versioned` and `engine_fingerprint` stay null: they describe the Clef-omni engine that thresholds
 * were cut on, and a Clairic row must never look like that engine changed (checkModelDrift reads both).
 */
export async function extractResponse(state: string | object, fields: ExtractFields, opts: ExtractOptions): Promise<ExtractResponse> {
  invariant(typeof opts?.caller === "string" && opts.caller.length > 0, "Assay.extract: caller is required (shadow-log join key)");
  invariant(fields && typeof fields === "object" && Object.keys(fields).length > 0, "Assay.extract: at least one field");
  const logPath = opts.logPath ?? defaultLogPath();
  const model = opts.model ?? extractModel();
  const ids = Object.keys(fields);
  const t0 = performance.now();
  const base = { ts: new Date().toISOString(), caller: opts.caller, session: opts.session ?? null, ...(opts.turn ? { turn: opts.turn } : {}), questions: ids, tier: "extract" as const, engine_fingerprint: null, model_versioned: null, answers: null };
  const refused = (error: string): ShadowLine => ({ ...base, model: null, request_id: null, latency_ms: 0, input_tokens: null, output_tokens: null, error, error_kind: error });

  const env = opts.env ?? process.env;
  if (env.LIFEOS_INFERENCE_DISABLED) throw new EngineError(`inference disabled: ${env.LIFEOS_INFERENCE_DISABLED}`, "disabled");
  if (env.LIFEOS_GLANCE_DISABLED === "1" || env.LIFEOS_JEV_DISABLED === "1") {
    writeShadow(refused("disabled"), logPath);
    throw new EngineError("judgment layer disabled by LIFEOS_GLANCE_DISABLED (or its legacy name, retired 2026-10-10)", "disabled");
  }
  const cfg = safeCallerConfig(opts.caller, opts.callersPath);
  if (!cfg) {
    writeShadow(refused("unregistered"), logPath);
    throw new EngineError(`extract refused: caller "${opts.caller}" is not registered in assay-callers.json (or the registry is unreadable)`, "unregistered");
  }
  const key = opts.apiKey ?? resolveApiKey(env);
  if (!key) {
    writeShadow(refused("no-key"), logPath);
    throw new EngineError("CLOUDFLARE_ACCOUNT_ID or the Cloudflare API token is not set (env or .env)", "no-key");
  }
  if (!sampledIn(opts.caller, state, cfg)) throw new GlanceSampleSkip(opts.caller, cfg.sample_rate!);
  const usage = todayUsage(opts.caller, logPath);
  if (usage.calls >= cfg.budget.calls_per_day || usage.tokens >= cfg.budget.tokens_per_day) {
    writeShadow(refused("budget"), logPath);
    throw new EngineError(`engine budget exceeded for caller "${opts.caller}"`, "budget");
  }

  const outcome = await callExtractor(state, fields, { model, apiKey: key, timeoutMs: opts.timeoutMs, fetchImpl: opts.fetchImpl, ...(opts.accountId ? { accountId: opts.accountId } : {}), ...(opts.media ? { media: opts.media } : {}) }, t0);
  if (!outcome.ok) {
    const errKey = outcome.kind === "http" ? `http-${outcome.status}` : outcome.kind;
    writeShadow({ ...base, model: outcome.model, request_id: outcome.requestId, latency_ms: outcome.latencyMs, input_tokens: null, output_tokens: null, error: errKey, error_kind: errKey }, logPath);
    throw new EngineError(outcome.message, outcome.kind, outcome.status);
  }
  const r = outcome.response;
  writeShadow({
    ...base, model: r.model, request_id: r.request_id, latency_ms: r.latency_ms,
    input_tokens: r.usage?.input_tokens ?? null, output_tokens: r.usage?.output_tokens ?? null,
    fields: summarizeFields(r.answers), truncated: r.truncated, error: null, error_kind: null,
  }, logPath);
  return r;
}

/**
 * Typed field values from one state: per field the Clairic answer (value, p_null, confidence, spans, and the rest
 * Clairic returned), a copied text value already checked against its span. Through Assay's door; see extractResponse().
 * The value is data: what code does with it is the caller's policy, and it never reaches decide().
 */
export async function extract(state: string | object, fields: ExtractFields, opts: ExtractOptions): Promise<ExtractAnswers> {
  return (await extractResponse(state, fields, opts)).answers;
}

/** One batch item. `fields` replaces the shared map for this item; `media` replaces opts.media for it. */
export type ExtractManyItem = { key: string; state: string | object; fields?: ExtractFields; media?: ExtractMedia };
/** `latency_ms`, `usage` and `model` are the answering call's; absent on an item that failed. */
export type ExtractManyResult = { key: string; result: ExtractAnswers | null; error: string | null; latency_ms?: number; usage?: ExtractResponse["usage"]; model?: string };
export type ExtractManyOptions = ExtractOptions & { concurrency?: number; retries?: number };

/** Refusals a second try cannot change, so extractMany never retries them. */
const FINAL_EXTRACT_KINDS = ["disabled", "no-key", "budget", "unregistered", "not-public", "media", "shape"];

/**
 * Field values from many states as one bounded parallel pool, the batch form of extract() exactly as judgeMany() is of
 * judge(): results in input order, each item's key written as its ledger `turn` unless opts sets one, one failed item
 * never fails the batch (it is retried `retries` times, default 1, unless the failure is a refusal a retry cannot
 * change, then returned with `error` set), and every attempt writes its own ledger line.
 */
export async function extractMany(items: ExtractManyItem[], fields: ExtractFields, opts: ExtractManyOptions): Promise<ExtractManyResult[]> {
  const concurrency = opts.concurrency ?? DEFAULT_CONCURRENCY;
  const retries = opts.retries ?? 1;
  invariant(Number.isInteger(concurrency) && concurrency >= 1, "Assay.extractMany: concurrency must be a positive integer");
  invariant(Number.isInteger(retries) && retries >= 0, "Assay.extractMany: retries must be a non-negative integer");
  invariant(new Set(items.map((i) => i.key)).size === items.length, "Assay.extractMany: item keys must be unique");
  const out: ExtractManyResult[] = new Array(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const i = next++;
      const item = items[i]!;
      let error: string | null = null;
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const r = await extractResponse(item.state, item.fields ?? fields, { ...opts, turn: opts.turn ?? item.key, media: item.media ?? opts.media });
          out[i] = { key: item.key, result: r.answers, error: null, latency_ms: r.latency_ms, model: r.model, ...(r.usage ? { usage: r.usage } : {}) };
          error = null;
          break;
        } catch (e) {
          error = (e as Error)?.message ?? String(e);
          if (e instanceof EngineError && FINAL_EXTRACT_KINDS.includes(e.kind)) break;
        }
      }
      if (error !== null) out[i] = { key: item.key, result: null, error };
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return out;
}

// ── Ledger reads ─────────────────────────────────────────────────────────────

/** Read a JSONL ledger, skipping blank and unparsable lines; a missing file reads as empty. */
export function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  const out: T[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line) as T); } catch { /* skip */ }
  }
  return out;
}

export function readShadowHistory(path?: string): ShadowLine[] {
  const paths = path ? [path] : defaultLogPaths();
  return paths.flatMap((p) => readJsonl<ShadowLine>(p)).sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
}

// `jev_value` is the stored field name in the comparison ledgers on disk, named for the engine retired 2026-10-10.
export type ComparisonLine = {
  timestamp: string; caller: string; session: string; turn: string; question: string;
  model: string; jev_value: number; keyword_verdict: boolean;
};

/** One reverted question. `kind` is "fingerprint" when the engine canary's fingerprint moved; absent means the model id moved. */
export type DriftRevert = { caller: string; question: string; from: string; to: string; date: string; kind?: "fingerprint" };
export type DriftEmitter = (event: VigilEvent) => unknown;

/**
 * Revert enforce rows whose evidence no longer describes the engine answering. Two keys, one path:
 *   model        the ledger's last `model_versioned` for the caller differs from the row's model (or enforce_evidence.model)
 *   fingerprint  the engine canary's current fingerprint (Fingerprint.ts state, else the caller's last ledger
 *                `engine_fingerprint`) differs from the fingerprint the row was promoted under; a row with no recorded
 *                fingerprint differs from any known one, so a change of weights under the same model id reverts every enforce row
 * Fail open on unreadable inputs: no registry, no ledger and no fingerprint leave modes unchanged. The append-only log's last
 * model wins. `opts.fingerprint` replaces the state read (null means none known).
 *
 * Persist first, announce after: the rewritten registry is written before any Vigil event is emitted or any revert returned. A
 * write failure throws (the rows are still enforce on disk, and nothing claims otherwise); an emitter failure after the write is
 * logged and does not undo the revert.
 */
export function checkModelDrift(callersPath?: string, logPath?: string, emitter: DriftEmitter = emitVigil, opts: { fingerprint?: string | null } = {}): DriftRevert[] {
  const p = callersPath ?? defaultCallersPath();
  let callers: CallersConfig;
  let shadow: ShadowLine[];
  try {
    callers = loadCallers(p);
    if (Object.keys(callers).length === 0) return [];
    shadow = readShadowHistory(logPath);
  } catch { return []; } // Unavailable registry/log intentionally leaves modes unchanged.
  const latestModelByCaller = new Map<string, string>();
  const latestFingerprintByCaller = new Map<string, string>();
  for (const line of shadow) {
    if (line && typeof line.model_versioned === "string" && line.model_versioned) latestModelByCaller.set(line.caller, line.model_versioned);
    if (line && typeof line.engine_fingerprint === "string" && line.engine_fingerprint) latestFingerprintByCaller.set(line.caller, line.engine_fingerprint);
  }
  const stateFingerprint = opts.fingerprint !== undefined ? opts.fingerprint : currentFingerprint();
  const reverts: DriftRevert[] = [];
  const events: VigilEvent[] = [];
  for (const [name, cfg] of Object.entries(callers)) {
    const latest = latestModelByCaller.get(name) ?? null;
    const fp = stateFingerprint ?? latestFingerprintByCaller.get(name) ?? null;
    if (!latest && !fp) continue;
    const evidence = cfg.mode === "enforce" ? cfg.enforce_evidence : null;
    const callerModelDrift = !!latest && !!evidence && latest !== evidence.model;
    const callerFpDrift = !!fp && !!evidence && evidence.fingerprint !== fp;
    const callerDrift = callerModelDrift || callerFpDrift;
    const modelStale = (t: CallerThreshold): boolean => !!latest && t.model !== latest;
    const fpStale = (t: CallerThreshold): boolean => !!fp && t.fingerprint !== fp;
    const questionDrift = Object.values(cfg.thresholds).some((t) => t.mode === "enforce" && (modelStale(t) || fpStale(t)));
    if (!callerDrift && !questionDrift) continue;
    const firstStale = Object.values(cfg.thresholds).find((t) => t.mode === "enforce" && (modelStale(t) || fpStale(t)));
    // Model drift keeps its reason and ids exactly as before; fingerprint drift is the second key.
    const byModel = callerModelDrift || (!callerDrift && !!firstStale && modelStale(firstStale));
    const reason = byModel ? "model changed" : "engine fingerprint changed";
    const from = byModel
      ? (callerModelDrift ? evidence!.model : firstStale!.model ?? "unrecorded")
      : (callerFpDrift ? evidence!.fingerprint ?? "unrecorded" : firstStale!.fingerprint ?? "unrecorded");
    const to = byModel ? latest! : fp!;
    const date = new Date().toISOString();
    const thresholds = Object.fromEntries(Object.entries(cfg.thresholds).map(([question, threshold]) => {
      const enforced = threshold.mode === "enforce" || (callerDrift && threshold.mode !== "shadow");
      const qModel = modelStale(threshold), qFp = fpStale(threshold);
      if (!enforced || (!qModel && !qFp)) return [question, threshold];
      if (qModel) {
        const questionFrom = threshold.model || from;
        events.push({ id: randomUUID(), source: "glance", ts: date, kind: "ai", severity: "high",
          title: `Glance model drift reverted ${name}.${question}`,
          summary: `Enforcement reverted to shadow because the engine model changed from ${questionFrom} to ${latest}.`,
          ref: `${name}.${question}`, url: null, privacy_class: "public",
          dedup_key: `glance:model-drift:${name}:${question}:${questionFrom}:${latest}`,
          meta: { caller: name, question, old_model: questionFrom, new_model: latest },
        });
        reverts.push({ caller: name, question, from: questionFrom, to: latest!, date });
      } else {
        const questionFrom = threshold.fingerprint ?? "unrecorded";
        events.push({ id: randomUUID(), source: "glance", ts: date, kind: "ai", severity: "high",
          title: `Assay engine fingerprint drift reverted ${name}.${question}`,
          summary: `Enforcement reverted to shadow because the engine canary's fingerprint changed from ${questionFrom} to ${fp} under model ${latest ?? "unknown"}.`,
          ref: `${name}.${question}`, url: null, privacy_class: "public",
          dedup_key: `glance:fingerprint-drift:${name}:${question}:${questionFrom}:${fp}`,
          meta: { caller: name, question, old_fingerprint: questionFrom, new_fingerprint: fp },
        });
        reverts.push({ caller: name, question, from: questionFrom, to: fp!, date, kind: "fingerprint" });
      }
      return [question, { ...threshold, mode: "shadow" as const }];
    }));
    callers[name] = { ...cfg, mode: callerDrift ? "shadow" : cfg.mode, thresholds, reverted: { reason, from, to, date } };
  }
  if (reverts.length > 0) {
    invariant(Object.values(callers).every((c) => c.mode === "shadow" || c.mode === "enforce"), "checkModelDrift: rewritten registry must keep every row's mode valid before writing");
    invariant(reverts.every((r) => callers[r.caller]?.thresholds[r.question]?.mode === "shadow"), "checkModelDrift: every reverted question must be shadow before writing");
    invariant(events.length === reverts.length, "checkModelDrift: one Vigil event per reverted question");
    validateCallers(callers);
    try {
      // Rewrite only the caller rows: the top-level defaults row and any other key in the file are kept as they are.
      const raw = JSON.parse(readFileSync(p, "utf8")) as Record<string, unknown>;
      for (const [name, cfg] of Object.entries(callers)) raw[name] = cfg;
      const temporary = `${p}.${randomUUID()}.tmp`;
      try { writeFileSync(temporary, JSON.stringify(raw, null, 2) + "\n", "utf8"); renameSync(temporary, p); }
      finally { rmSync(temporary, { force: true }); }
    } catch (e) {
      // Nothing was announced and nothing is returned as reverted: the rows are still enforce on disk.
      throw new Error(`[Assay] drift revert NOT persisted: ${reverts.length} question(s) (${reverts.map((r) => `${r.caller}.${r.question}`).join(", ")}) should be shadow but ${p} could not be written, so they are still enforce: ${(e as Error)?.message ?? e}`, { cause: e });
    }
    for (const event of events) {
      try { emitter(event); } catch (e) { console.error(`[Assay] drift revert persisted, but its Vigil event failed for ${event.ref}: ${(e as Error)?.message ?? e}`); }
    }
  }
  return reverts;
}

// ── CLI ───────────────────────────────────────────────────────────────────────
//
// The CLI verbs (status, report, tune, promote-noul, alerts, drift, callers, ask, ask-many) live in ./Report.ts with the
// rest of the reporting code. It is loaded only when the CLI runs, so a hook importing this runtime never pays for it.

export async function main(argv: string[]): Promise<number> {
  const report = await import("./Report.ts");
  return report.main(argv);
}

if (import.meta.main) {
  main(process.argv.slice(2)).then((code) => process.exit(code)).catch((e) => {
    console.error(e instanceof EngineError ? `${e.name} (${e.kind}): ${e.message}` : String(e));
    process.exit(1);
  });
}
