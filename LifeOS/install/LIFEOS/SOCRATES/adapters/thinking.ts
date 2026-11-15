/**
 * thinking adapter — the thinking record's weekly meter.
 *
 * refs: thinking-skips[:<window-days>]   default window 7
 *
 * Reads the Assay shadow ledger (MEMORY/OBSERVABILITY/assay.jsonl) for `thinking-fit` rows: one row per thinking skill
 * a run skipped, each answered `would_change` or `no_change` by the judgment layer (LIFEOS/ROUTER/ThinkingCheck.ts fit).
 * The answer is the share of skips judged would-have-changed over the window. A run is one session, or one ISA when the
 * row carries no session (the CLI without --session); rows with neither pool into one run, so ten anonymous rows never
 * read as ten runs (checker finding, 2026-11-14). Under MIN_RUNS judged runs the window has no reading and the verdict
 * is unknown, never pass. The ideal is the question's
 * `expect.lte` (percent); absent, 20. Rows with an engine error carry no answer and are not judged.
 */
import { existsSync, readFileSync } from "node:fs";
import { lifeosPath } from "../../TOOLS/Paths";
import type { Adapter } from "./types";
import type { AnswerInput } from "../Store";
import type { Question } from "../Registry";

const VERSION = "1.0.0";
export const MIN_RUNS = 10;
export const CALLER = "thinking-fit";
export const DEFAULT_IDEAL = 20;

export interface SkipStats { rows: number; judged: number; wouldChange: number; runs: number; share: number }

export function ledgerPath(env: Record<string, string | undefined> = process.env): string {
  return env.LIFEOS_GLANCE_LOG || env.LIFEOS_JEV_LOG || lifeosPath("MEMORY", "OBSERVABILITY", "assay.jsonl");
}

/** The window's thinking-fit rows folded: judged skips, how many would have changed, distinct runs. */
export function skipStats(text: string, sinceMs: number, untilMs = Number.POSITIVE_INFINITY): SkipStats {
  const runs = new Set<string>();
  let rows = 0, judged = 0, wouldChange = 0;
  for (const line of text.split("\n")) {
    if (!line.includes(`"${CALLER}"`)) continue;
    let r: any; try { r = JSON.parse(line); } catch { continue; }
    if (r?.caller !== CALLER) continue;
    const t = Date.parse(r.ts ?? "");
    if (Number.isNaN(t) || t < sinceMs || t >= untilMs) continue;
    rows++;
    const a = r.answers?.changed;
    if (!a || a.type !== "choice" || !a.choice) continue;
    judged++;
    runs.add(String(r.session ?? r.isa_key ?? "anonymous"));
    if (a.choice === "would_change") wouldChange++;
  }
  const share = judged ? Math.round((wouldChange / judged) * 1000) / 10 : 0;
  return { rows, judged, wouldChange, runs: runs.size, share };
}

export function verdictFor(s: SkipStats, ideal: number): { verdict: "pass" | "fail" | "unknown"; evidence: string } {
  if (s.runs < MIN_RUNS) return { verdict: "unknown", evidence: `too few judged runs (${s.runs}; need ${MIN_RUNS}); ${s.judged} skips judged, ${s.wouldChange} would have changed` };
  const evidence = `${s.wouldChange} of ${s.judged} skipped skills judged would-have-changed (${s.share}%) across ${s.runs} runs; ideal ≤ ${ideal}%`;
  return { verdict: s.share <= ideal ? "pass" : "fail", evidence };
}

export function windowFor(q: Question): number {
  const m = /^thinking-skips(?::(\d+))?$/.exec(q.answerer?.ref ?? "thinking-skips");
  return m?.[1] ? Number(m[1]) : 7;
}

export const thinking: Adapter = {
  name: "thinking",
  version: VERSION,
  async answers(questions: Question[]): Promise<AnswerInput[]> {
    const path = ledgerPath();
    const text = existsSync(path) ? readFileSync(path, "utf8") : "";
    return questions.map((q) => {
      const days = windowFor(q);
      const s = skipStats(text, Date.now() - days * 86_400_000);
      const ideal = q.expect?.lte ?? DEFAULT_IDEAL;
      const v = text ? verdictFor(s, ideal) : { verdict: "unknown" as const, evidence: `no Assay shadow ledger at ${path}: no thinking-fit question has run yet` };
      return {
        question_id: q.id, verdict: v.verdict, value: s.share, evidence: v.evidence,
        computed_from: { touched: [`Assay shadow ledger, caller ${CALLER}, last ${days}d`], untouched: ["runs whose ISA carries no Thinking: line (nothing to judge)", "sessions on other machines"] },
        closer_version: VERSION,
      };
    });
  },
};
