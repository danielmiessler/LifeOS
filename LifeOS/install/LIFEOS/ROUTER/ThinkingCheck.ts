#!/usr/bin/env bun
/**
 * ThinkingCheck.ts — the run's written thinking plan, read, drawn, checked and judged.
 *
 * A run writes which structured thinking it ran, and why it skipped the rest, as one `Thinking:` line per
 * feature block in its ISA (ISAFormat.md § Feature blocks), beside the `Lane:` line:
 *
 *   Thinking: RedTeam·light, FirstPrinciples·full ; skipped Council=one approach, SystemsThinking=no loop
 *   Thinking: none=the approach was settled with the principal
 *
 * PAI v2.5 (January 2026) walked six thinking tools on every request and wrote INCLUDE or EXCLUDE with a reason;
 * LifeOS v8.0 cut that table as scaffolding, and nothing recorded the skips afterwards. This tool brings the
 * record back the way the route line did for dispatch: written in the ISA, drawn, checked against what ran,
 * judged by a shadow question, never enforced.
 *
 *   line <isa>                  the one line the plugin draws: `🧠 THINKING ▸ F1 RedTeam·light (skipped Council) · F2 none`
 *   check <isa> --session <id>  the written plan against the Skill calls in that session's transcript, no model call
 *   fit <isa> [--session <id>]  one Assay judgment-layer question per skipped skill (caller `thinking-fit`, shadow)
 *
 * Every subcommand exits 0: the plan is a record the DA follows by intent (Algorithm § Spend), so a miss is shown,
 * never enforced. `fit` degrades to no flag when the engine is unreachable, disabled or refuses.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { getClaudeDir } from "../TOOLS/Paths";
import { THINKING_SHAPES, THINKING_SKILLS } from "./Depth";

/** The skill words a Thinking line may name: the router's roster plus Superior (Algorithm § Spend's companion lens). */
export const THINKING_WORDS: readonly string[] = [...THINKING_SKILLS, "Superior"];
const WORD_BY_KEY = new Map(THINKING_WORDS.map((w) => [w.toLowerCase(), w]));
export const MODES = ["light", "full"] as const;
export type ThinkingMode = (typeof MODES)[number];

export interface RanSkill { skill: string; mode: ThinkingMode; known: boolean }
export interface SkippedSkill { skill: string; phrase: string; known: boolean }
export interface ThinkingPlan {
  feature: string; name: string; why: string; criteria: string;
  /** The skills the run says it ran. Empty with `none` set when the line is `Thinking: none=<phrase>`. */
  ran: RanSkill[];
  skipped: SkippedSkill[];
  /** The phrase after `none=`, when the line says no thinking skill ran. */
  none: string | null;
  /** Words that are not in the roster, named so a typo is seen, never dropped. */
  unknown: string[];
  /** A skipped skill whose phrase is the one the doctrine forbids ("too simple", "already know"). */
  lazy: string[];
}

const canon = (raw: string): { skill: string; known: boolean } => {
  const key = raw.trim().replace(/[\s_-]+/g, "").toLowerCase();
  const hit = WORD_BY_KEY.get(key);
  return hit ? { skill: hit, known: true } : { skill: raw.trim(), known: false };
};

/** The phrases the Algorithm says never justify a skip: size alone and knowing the answer. */
export const LAZY_PHRASE = /^(too simple|simple|trivial|already know(n)?( the answer)?|not needed|n\/?a|no)$/i;

/** One `Thinking:` line's content, parsed. Exported so the roster test and the ISA self-test share it. */
export function parseThinkingLine(text: string): Pick<ThinkingPlan, "ran" | "skipped" | "none" | "unknown" | "lazy"> {
  const out = { ran: [] as RanSkill[], skipped: [] as SkippedSkill[], none: null as string | null, unknown: [] as string[], lazy: [] as string[] };
  const line = text.trim();
  // The skipped list starts at "; skipped" (or a bare leading "skipped"); everything before it is the ran list, and a
  // phrase may hold any character but the ", Skill=" that starts the next entry, so a none= phrase keeps its semicolons.
  const cut = line.search(/(^|;)\s*skipped\s+/i);
  const ranPart = cut < 0 ? line : line.slice(0, cut).trim();
  const skippedPart = cut < 0 ? "" : line.slice(cut).replace(/^;?\s*skipped\s+/i, "");
  const noneM = ranPart.match(/^none\s*=\s*(.*)$/i);
  if (noneM) out.none = noneM[1]!.trim();
  else {
    for (const entry of ranPart.replace(/;\s*$/, "").split(/,\s*/)) {
      if (!entry.trim()) continue;
      const [rawSkill, rawMode] = entry.split(/\s*·\s*/);
      const { skill, known } = canon(rawSkill!);
      const mode = (rawMode ?? "light").trim().toLowerCase();
      out.ran.push({ skill, mode: (MODES as readonly string[]).includes(mode) ? (mode as ThinkingMode) : "light", known });
      if (!known) out.unknown.push(skill);
    }
  }
  for (const entry of skippedPart ? skippedPart.split(/,\s*(?=[A-Za-z][A-Za-z _-]*\s*=)/) : []) {
    const m = entry.match(/^([A-Za-z][A-Za-z _-]*?)\s*=\s*(.*)$/s);
    if (!m) { if (entry.trim()) out.unknown.push(entry.trim()); continue; }
    const { skill, known } = canon(m[1]!);
    const phrase = m[2]!.trim();
    out.skipped.push({ skill, phrase, known });
    if (!known) out.unknown.push(skill);
    if (LAZY_PHRASE.test(phrase)) out.lazy.push(skill);
  }
  return out;
}

/** Every feature block's Thinking line, in ISA order. Features without one carry no plan and are left out. */
export function parseThinking(isa: string): ThinkingPlan[] {
  const out: ThinkingPlan[] = [];
  for (const b of isa.split(/\n(?=### F\d+ · )/).slice(1)) {
    const head = b.match(/^### (F\d+) · (.+)/);
    if (!head) continue;
    const body = b.split(/\n## /)[0]!;
    const line = body.match(/^Thinking:\s*(.+)$/m);
    if (!line) continue;
    out.push({
      feature: head[1]!, name: head[2]!.trim(),
      why: body.match(/^Why:\s*(.+)$/m)?.[1]?.trim() ?? "",
      criteria: body.split("\n").filter((l) => /^- \[[ x]\] /.test(l)).join("\n").slice(0, 1500),
      ...parseThinkingLine(line[1]!),
    });
  }
  return out;
}

/** The drawn line; empty when no feature carries a plan. */
export function thinkingLine(plans: ThinkingPlan[]): string {
  if (!plans.length) return "";
  const seg = plans.map((p) => {
    const ran = p.ran.length ? p.ran.map((r) => `${r.skill}·${r.mode}`).join(", ") : "none";
    const skipped = p.skipped.length ? ` (skipped ${p.skipped.map((s) => s.skill).join(", ")})` : "";
    const unknown = p.unknown.length ? ` (unknown skill ${p.unknown.join(", ")})` : "";
    const lazy = p.lazy.length ? ` (no reason given for ${p.lazy.join(", ")})` : "";
    return `${p.feature} ${ran}${skipped}${unknown}${lazy}`;
  });
  return `🧠 THINKING ▸ ${seg.join(" · ")}`;
}

// ── check: the plan against the Skill calls the session made ────────────────

export function projectsDir(env: Record<string, string | undefined> = process.env): string {
  return env.LIFEOS_PROJECTS_DIR || join(getClaudeDir(), "projects");
}

/** The session's transcript files: the main transcript plus every subagent sidechain under `<session>/subagents/`
 *  (a skill a delegate ran counts as run; RedTeam pass 2026-11-14, finding 3). Empty when the id is odd or unknown. */
export function sessionTranscripts(session: string, dir = projectsDir()): string[] {
  const main = sessionTranscript(session, dir);
  if (!main) return [];
  const out = [main];
  const sub = join(main.slice(0, -".jsonl".length), "subagents");
  if (existsSync(sub)) {
    const walk = (d: string): void => {
      for (const e of readdirSync(d)) {
        const f = join(d, e);
        let st; try { st = statSync(f); } catch { continue; }
        if (st.isDirectory()) walk(f); else if (e.endsWith(".jsonl")) out.push(f);
      }
    };
    walk(sub);
  }
  return out;
}

/** The transcript file of one session id under the harness's projects dir, newest first when several match. */
export function sessionTranscript(session: string, dir = projectsDir()): string | null {
  if (!existsSync(dir) || !/^[A-Za-z0-9_-]+$/.test(session)) return null;
  const hits: Array<{ file: string; mtime: number }> = [];
  for (const p of readdirSync(dir)) {
    const pd = join(dir, p);
    let st; try { st = statSync(pd); } catch { continue; }
    if (!st.isDirectory()) continue;
    const f = join(pd, `${session}.jsonl`);
    if (existsSync(f)) hits.push({ file: f, mtime: statSync(f).mtimeMs });
  }
  hits.sort((a, b) => b.mtime - a.mtime);
  return hits[0]?.file ?? null;
}

/** The thinking skills a transcript invoked through the Skill tool, in order, roster words only. */
export function skillCalls(transcriptText: string): string[] {
  const out: string[] = [];
  for (const line of transcriptText.split("\n")) {
    if (!line.includes('"Skill"')) continue;
    let j: any; try { j = JSON.parse(line); } catch { continue; }
    if (j?.type !== "assistant") continue;
    for (const c of Array.isArray(j.message?.content) ? j.message.content : []) {
      if (c?.type !== "tool_use" || c.name !== "Skill") continue;
      const raw = String(c.input?.skill ?? "").split(":").pop() ?? "";
      const { skill, known } = canon(raw);
      if (known) out.push(skill);
    }
  }
  return out;
}

export interface CheckResult { feature: string; written: string[]; ran: string[]; unwritten: string[]; missing: string[] }

/** Each planned feature against the skills the session invoked. Skills are session-wide, so a skill written on one
 *  feature and run anywhere in the session counts as run; an invoked roster skill no feature wrote is `unwritten`. */
export function checkThinking(plans: ThinkingPlan[], invoked: string[]): CheckResult[] {
  const ranSet = new Set(invoked);
  const writtenAll = new Set(plans.flatMap((p) => p.ran.map((r) => r.skill)));
  const unwritten = [...ranSet].filter((s) => !writtenAll.has(s));
  return plans.map((p) => {
    const written = p.ran.map((r) => r.skill);
    return { feature: p.feature, written, ran: written.filter((s) => ranSet.has(s)), unwritten, missing: written.filter((s) => !ranSet.has(s)) };
  });
}

export function checkLines(results: CheckResult[]): string[] {
  if (!results.length) return [];
  const written = results.reduce((n, r) => n + r.written.length, 0);
  const ran = results.reduce((n, r) => n + r.ran.length, 0);
  const lines = [`🧠 Thinking check ▸ ${ran} of ${written} written skills ran`];
  for (const r of results) if (r.ran.length) lines.push(`✓ ${r.feature}: ${r.ran.join(", ")} ran`);
  for (const r of results) for (const s of r.missing) lines.push(`⚠️ ${r.feature}: ${s} written, never ran`);
  const unwritten = results[0]?.unwritten ?? [];
  if (unwritten.length) lines.push(`ℹ️ ran but not written: ${unwritten.join(", ")}`);
  return lines;
}

// ── fit: would a skipped skill have changed the answer? ─────────────────────

export const FIT_CALLER = "thinking-fit";
export const FIT_TIMEOUT_MS = 3000;
/** A flag needs a clear case: the engine's probability for "would change" at least this, and this far over "no change". */
export const FIT_FLAG_P = 0.6;
export const FIT_FLAG_MARGIN = 0.2;

export const FIT_QUESTION = {
  changed: {
    type: "choice" as const,
    instructions: "A software run wrote down which structured thinking skills it skipped for one feature, with a one-phrase reason each. Given the feature and the skill's shape, would running that skill most likely have changed the result? Judge the work, not the stakes: a skill changes the result when the feature has the shape it exists for and the reason given does not cover that shape.",
    criteria: {
      no_change: "The feature does not have the shape this skill exists for, or the reason given covers it; running it would have added nothing.",
      would_change: "The feature has the shape this skill exists for and the reason does not cover it; running it would most likely have changed the result.",
    },
  },
};

export interface FitFlag { feature: string; skill: string; confidence: number }
export type Ask = (state: object, questions: typeof FIT_QUESTION, opts: { caller: string; session?: string; timeoutMs: number; extra?: { isa_key?: string } }) => Promise<{ answers: Record<string, { type: string; choice?: string; probabilities?: Record<string, number> }> }>;

/** The judged skips. Every engine failure becomes no flag: this question only ever adds a hint. */
export async function fitFlags(plans: ThinkingPlan[], ask: Ask, session?: string, env: Record<string, string | undefined> = process.env, isaKey?: string): Promise<{ flags: FitFlag[]; skipped: string[] }> {
  const flags: FitFlag[] = [], skipped: string[] = [];
  if (env.LIFEOS_GLANCE_DISABLED === "1" || env.LIFEOS_JEV_DISABLED === "1") return { flags, skipped: ["engine disabled"] };
  const asks = plans.flatMap((p) => p.skipped.filter((s) => s.known).map((s) => ({ p, s })));
  await Promise.all(asks.map(async ({ p, s }) => {
    try {
      const shape = (THINKING_SHAPES as Record<string, string>)[s.skill] ?? (s.skill === "Superior" ? "how a far smarter, fully informed mind would do it" : s.skill);
      const res = await ask({ feature: `${p.feature} · ${p.name}`, why: p.why, criteria: p.criteria, skipped_skill: s.skill, skill_shape: shape, reason_given: s.phrase }, FIT_QUESTION, { caller: FIT_CALLER, session, timeoutMs: FIT_TIMEOUT_MS, ...(isaKey ? { extra: { isa_key: isaKey } } : {}) });
      const a = res.answers.changed;
      const prob = a?.probabilities ?? {};
      if (a?.type === "choice" && a.choice === "would_change") {
        const pm = prob.would_change ?? 0;
        if (pm >= FIT_FLAG_P && pm - (prob.no_change ?? 0) >= FIT_FLAG_MARGIN) flags.push({ feature: p.feature, skill: s.skill, confidence: pm });
      }
    } catch (e) {
      skipped.push(`${p.feature} ${s.skill}: ${e instanceof Error ? e.message.slice(0, 80) : "engine error"}`);
    }
  }));
  flags.sort((a, b) => a.feature.localeCompare(b.feature, undefined, { numeric: true }) || a.skill.localeCompare(b.skill));
  return { flags, skipped };
}

export function fitLines(flags: FitFlag[], skipped: string[] = []): string[] {
  const lines = flags.map((f) => `⚠️ Thinking fit ${f.feature}: ${f.skill} was skipped and would likely have changed the result (${Math.round(f.confidence * 100)}%)`);
  // Every ask failed and none was judged: say so once, so an unjudged skip never reads as a clean one.
  if (!flags.length && skipped.length && skipped[0] !== "engine disabled") {
    const why = skipped[0]!.replace(/^F\d+ \w+: /, "").replace(/:.*$/, "").slice(0, 60);
    lines.push(`ℹ️ Thinking fit unjudged: ${skipped.length} skip${skipped.length === 1 ? "" : "s"} not judged (${why})`);
  }
  return lines;
}

// ── CLI ───────────────────────────────────────────────────────────────────

function arg(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

export async function main(argv: string[], ask?: Ask, env: Record<string, string | undefined> = process.env): Promise<number> {
  const [cmd, isaPath] = argv;
  const json = argv.includes("--json");
  if (!cmd || !isaPath || !["line", "check", "fit"].includes(cmd)) {
    console.error("usage: ThinkingCheck.ts line|check|fit <isa> [--session <id>] [--json]");
    return 0;
  }
  if (!existsSync(isaPath)) { console.error(`ThinkingCheck: no file at ${isaPath}`); return 0; }
  const plans = parseThinking(readFileSync(isaPath, "utf8"));
  const session = arg(argv, "--session");
  if (cmd === "line") {
    if (json) console.log(JSON.stringify(plans.map(({ why, criteria, ...p }) => p)));
    else if (plans.length) console.log(thinkingLine(plans));
    return 0;
  }
  if (cmd === "check") {
    if (!session) { console.error("ThinkingCheck check: --session <id> is required"); return 0; }
    const files = sessionTranscripts(session, projectsDir(env));
    if (!files.length) { console.error(`ThinkingCheck check: no transcript for session ${session}`); return 0; }
    const results = checkThinking(plans, files.flatMap((f) => skillCalls(readFileSync(f, "utf8"))));
    if (json) console.log(JSON.stringify(results));
    else for (const l of checkLines(results)) console.log(l);
    return 0;
  }
  const engine = ask ?? ((await import("../ASSAY/Assay")).ask as unknown as Ask);
  const { flags, skipped } = await fitFlags(plans, engine, session, env, isaPath);
  if (json) console.log(JSON.stringify({ flags, skipped }));
  else for (const l of fitLines(flags, skipped)) console.log(l);
  return 0;
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)));
