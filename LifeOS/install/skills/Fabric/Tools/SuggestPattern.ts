#!/usr/bin/env bun
/**
 * SuggestPattern.ts — the top three Fabric patterns for a plain request.
 *
 *   bun skills/Fabric/Tools/SuggestPattern.ts "<request>" [--json] [--catalog <file>] [--user-catalog <file>|--no-user]
 *
 * Reads Patterns/catalog.yaml (PatternCatalog.ts build) and merges the install's local catalog at
 * USER/CUSTOMIZATIONS/SKILLS/Fabric/catalog.yaml at read time; a shipped pattern wins a name clash, the
 * same order ExecutePattern reads system.md in. Ranking is trigger and keyword match first, then one Assay
 * judgment-layer question over the shortlist (caller `pattern-suggest`, shadow, timeout 3000 ms). Every
 * engine failure, and LIFEOS_GLANCE_DISABLED=1, leaves the trigger ranking standing: the question only
 * reorders, it never blocks. A request that names a pattern (`extract_wisdom`, a backticked name) or a
 * ported intent (`CheckAgreement`) returns that pattern with no model call.
 *
 * Prints one line per pick: `N. <name> [runs <Intent>] (<reason>)`; --json prints the full result.
 * Always exits 0.
 */

import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { readCatalog, type CatalogEntry } from "./PatternCatalog";

export const SUGGEST_CALLER = "pattern-suggest";
export const SUGGEST_TIMEOUT_MS = 3000;
export const SHORTLIST = 6;
/** The most of a request the judgment layer ever sees: the wording, never the content it is applied to. */
export const REQUEST_MAX = 500;
const SHIPPED_CATALOG = resolve(import.meta.dir, "..", "Patterns", "catalog.yaml");

export type Entry = CatalogEntry & { local?: boolean };
export interface Pick { name: string; ported_intent: string | null; purpose: string; reason: string; score: number; local?: boolean }
export interface SuggestResult { request: string; explicit: boolean; picks: Pick[]; engine: string }
export type Ask = (
  state: object,
  questions: { pick: { type: "choice"; instructions: string; criteria: Record<string, string> } },
  opts: { caller: string; timeoutMs: number },
) => Promise<{ answers: Record<string, { type: string; choice?: string; probabilities?: Record<string, number> }> }>;

// ── Catalog ──────────────────────────────────────────────────────────────────

export function loadEntries(o: { catalogPath?: string; userCatalogPath?: string | null } = {}): Entry[] {
  const shipped = o.catalogPath ?? SHIPPED_CATALOG;
  const entries: Entry[] = existsSync(shipped) ? readCatalog(shipped) : [];
  const names = new Set(entries.map((e) => e.name));
  if (o.userCatalogPath && existsSync(o.userCatalogPath)) {
    try {
      for (const e of readCatalog(o.userCatalogPath)) if (!names.has(e.name)) entries.push({ ...e, local: true });
    } catch { /* an unreadable local catalog leaves the shipped one */ }
  }
  return entries;
}

// ── Text ─────────────────────────────────────────────────────────────────────

const STOP = new Set(("a an the and or of to in on for with from by as at into this that these those it its is are be was were "
  + "you your i me my we our us they them their he she his her can could would should will do does did please just "
  + "give get want need some any all about what how which who why when where so very really here there up out "
  + "fabric pattern patterns use using run apply").split(/\s+/));
const SYNONYM: Record<string, string> = {
  make: "create", build: "create", generate: "create", produce: "create", draft: "write",
  analyse: "analyze", analysis: "analyze", analyzing: "analyze", analyses: "analyze",
  summary: "summar", summaries: "summar", summarize: "summar", summarise: "summar", summarizing: "summar", summarizes: "summar",
  tl: "tldr", flashcard: "flash", flashcards: "flash",
  better: "improve", improvement: "improve", answer: "respons", answers: "respons", reply: "respons", response: "respons", responses: "respons",
};

export function stem(w: string): string {
  const s = w.toLowerCase();
  if (SYNONYM[s]) return SYNONYM[s];
  let out = s;
  if (out.length > 5 && out.endsWith("ing")) out = out.slice(0, -3);
  else if (out.length > 4 && out.endsWith("ies")) out = out.slice(0, -3) + "y";
  else if (out.length > 4 && out.endsWith("ed")) out = out.slice(0, -2);
  else if (out.length > 3 && out.endsWith("s") && !out.endsWith("ss")) out = out.slice(0, -1);
  return SYNONYM[out] ?? out;
}

export function tokens(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter((w) => w && !STOP.has(w)).map(stem);
}

// ── Explicit names ───────────────────────────────────────────────────────────

/** A named pattern (underscore or hyphen name, or any name in backticks) or a ported intent name. */
export function explicitPick(request: string, entries: Entry[]): Entry | null {
  const byName = new Map(entries.map((e) => [e.name, e]));
  for (const m of request.matchAll(/`([^`]+)`/g)) {
    const n = m[1].trim();
    if (byName.has(n)) return byName.get(n)!;
    const viaIntent = entries.find((e) => e.ported_intent === n);
    if (viaIntent) return viaIntent;
  }
  for (const raw of request.split(/[\s,;:()"'!?]+/)) {
    const w = raw.replace(/[.]+$/, "");
    if (/[_-]/.test(w) && byName.has(w)) return byName.get(w)!;
    if (/^[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]*)+$/.test(w)) {
      const viaIntent = entries.find((e) => e.ported_intent === w);
      if (viaIntent) return viaIntent;
    }
  }
  return null;
}

// ── Trigger ranking ──────────────────────────────────────────────────────────

interface Indexed { e: Entry; name: string[]; triggers: Array<{ text: string; toks: string[] }>; purpose: Set<string> }
const indexCache = new WeakMap<Entry[], { items: Indexed[]; idf: Map<string, number> }>();

function index(entries: Entry[]) {
  const hit = indexCache.get(entries);
  if (hit) return hit;
  const items: Indexed[] = entries.map((e) => ({
    e,
    name: tokens(e.name.replace(/[_-]+/g, " ")),
    triggers: e.triggers.map((t) => ({ text: t, toks: tokens(t) })).filter((t) => t.toks.length),
    purpose: new Set(tokens(e.purpose)),
  }));
  const df = new Map<string, number>();
  for (const it of items) {
    for (const t of new Set([...it.name, ...it.purpose, ...it.triggers.flatMap((x) => x.toks)])) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const n = Math.max(1, items.length);
  const idf = new Map([...df].map(([t, c]) => [t, Math.log(1 + n / c)]));
  const built = { items, idf };
  indexCache.set(entries, built);
  return built;
}

/** Trigger phrase match first (every word of a trigger in the request), then name and purpose keywords, IDF-weighted. */
export function rank(request: string, entries: Entry[], n = 3): Pick[] {
  const { items, idf } = index(entries);
  const req = new Set(tokens(request));
  const w = (t: string) => idf.get(t) ?? Math.log(1 + items.length);
  const scored = items.map((it) => {
    let best = 0;
    let bestText = "";
    for (const t of it.triggers) {
      if (!t.toks.every((x) => req.has(x))) continue;
      const s = t.toks.reduce((a, x) => a + w(x), 0) * (1 + 0.5 * (t.toks.length - 1));
      if (s > best) { best = s; bestText = t.text; }
    }
    const nameToks = [...new Set(it.name)];
    const nameHits = nameToks.filter((t) => req.has(t));
    const purposeHits = [...it.purpose].filter((t) => req.has(t) && !nameHits.includes(t));
    let score = 2 * best + 1.2 * nameHits.reduce((a, t) => a + w(t), 0) + 0.6 * purposeHits.reduce((a, t) => a + w(t), 0);
    // A partial name match is a weak signal: the name words the request never said count against it, so
    // chinese_contract_review does not outrank check_agreement on "contract" (checker finding 2, 2026-11-14).
    if (nameHits.length && nameHits.length < nameToks.length) score -= 0.4 * nameToks.filter((t) => !req.has(t)).reduce((a, t) => a + w(t), 0);
    // A ported pattern beat its upstream prompt head to head (SKILL.md § Ported patterns), so on a comparable match it ranks first.
    if (score > 0 && it.e.ported_intent) score *= 1.5;
    score = Math.max(0, score);
    const words = [...nameHits, ...purposeHits].slice(0, 4);
    const reason = best > 0 ? `trigger "${bestText}"` : words.length ? `keywords: ${words.join(", ")}` : "no match; closest by name";
    return { it, score, reason };
  });
  scored.sort((a, b) => b.score - a.score || Number(!!a.it.e.local) - Number(!!b.it.e.local) || a.it.e.name.localeCompare(b.it.e.name));
  return scored.slice(0, n).map(({ it, score, reason }) => toPick(it.e, reason, score));
}

const toPick = (e: Entry, reason: string, score: number): Pick => ({
  name: e.name, ported_intent: e.ported_intent, purpose: e.purpose, reason, score: Math.round(score * 100) / 100, ...(e.local ? { local: true } : {}),
});

// ── Judgment ─────────────────────────────────────────────────────────────────

export const PICK_INSTRUCTIONS = "A user typed a request and needs one prompt pattern to run on it. Each option is a pattern with what it does. "
  + "Pick the pattern whose purpose best fits what the user is asking for.";

export async function suggest(request: string, o: { entries: Entry[]; ask?: Ask; env?: NodeJS.ProcessEnv }): Promise<SuggestResult> {
  const env = o.env ?? process.env;
  const named = explicitPick(request, o.entries);
  if (named) {
    const reason = named.ported_intent ? `named explicitly; runs the ${named.ported_intent} intent` : "named explicitly";
    return { request, explicit: true, picks: [toPick(named, reason, 0)], engine: "not asked (explicit name)" };
  }
  const shortlist = rank(request, o.entries, SHORTLIST);
  let engine = "skipped: no engine";
  let ordered = shortlist;
  if (env.LIFEOS_GLANCE_DISABLED === "1" || env.LIFEOS_INFERENCE_DISABLED) engine = "skipped: disabled";
  else if (shortlist.some((p) => p.local)) engine = "skipped: a local pattern is shortlisted (its text never leaves this machine)";
  else if (shortlist.length > 1) {
    try {
      const ask = o.ask ?? ((await import("../../../LIFEOS/ASSAY/Assay")).ask as unknown as Ask);
      const criteria = Object.fromEntries(shortlist.map((p) => [p.name, p.purpose]));
      const res = await ask({ request: request.slice(0, REQUEST_MAX) }, { pick: { type: "choice", instructions: PICK_INSTRUCTIONS, criteria } }, { caller: SUGGEST_CALLER, timeoutMs: SUGGEST_TIMEOUT_MS });
      const a = res.answers?.pick;
      const probs = a?.type === "choice" && a.probabilities ? a.probabilities : null;
      if (!probs) throw new Error("engine answer has no probabilities");
      ordered = shortlist
        .map((p, i) => ({ p, i, pr: typeof probs[p.name] === "number" ? probs[p.name] : 0 }))
        .sort((x, y) => y.pr - x.pr || x.i - y.i)
        .map(({ p, pr }) => ({ ...p, reason: `${p.reason}; judged fit ${Math.round(pr * 100)}%` }));
      engine = "used";
    } catch (e) {
      engine = `skipped: ${e instanceof Error ? e.message.slice(0, 80) : "engine error"}`;
      ordered = shortlist;
    }
  }
  return { request, explicit: false, picks: ordered.slice(0, 3), engine };
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function flag(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

async function defaultUserCatalog(): Promise<string | null> {
  try {
    const { lifeosPath } = await import("../../../LIFEOS/TOOLS/Paths");
    return join(lifeosPath("USER", "CUSTOMIZATIONS", "SKILLS", "Fabric"), "catalog.yaml");
  } catch {
    return null;
  }
}

export function pickLines(r: SuggestResult): string[] {
  return r.picks.map((p, i) => `${i + 1}. ${p.name}${p.ported_intent ? ` [runs ${p.ported_intent}]` : ""}${p.local ? " [local]" : ""} (${p.reason})`);
}

export async function main(argv: string[], deps: { ask?: Ask; env?: NodeJS.ProcessEnv; entries?: Entry[] } = {}): Promise<number> {
  const valueFlags = new Set(["--catalog", "--user-catalog"]);
  const words = argv.filter((a, i) => !a.startsWith("--") && !valueFlags.has(argv[i - 1] ?? ""));
  const request = words.join(" ").trim();
  if (!request) {
    console.error('usage: SuggestPattern.ts "<request>" [--json] [--catalog <file>] [--user-catalog <file>|--no-user]');
    return 0;
  }
  try {
    const userCatalogPath = argv.includes("--no-user") ? null : flag(argv, "--user-catalog") ?? (await defaultUserCatalog());
    const entries = deps.entries ?? loadEntries({ catalogPath: flag(argv, "--catalog"), userCatalogPath });
    if (!entries.length) {
      console.log("No pattern catalog: run bun skills/Fabric/Tools/PatternCatalog.ts build");
      return 0;
    }
    const r = await suggest(request, { entries, ask: deps.ask, env: deps.env });
    if (argv.includes("--json")) console.log(JSON.stringify(r, null, 2));
    else {
      for (const l of pickLines(r)) console.log(l);
      console.error(`judgment: ${r.engine}`);
    }
  } catch (e) {
    console.log(`SuggestPattern: ${e instanceof Error ? e.message : String(e)}`);
  }
  return 0;
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)));
