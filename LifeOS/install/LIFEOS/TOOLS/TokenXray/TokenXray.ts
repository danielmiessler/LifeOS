#!/usr/bin/env bun
/**
 * TokenXray — reverse-engineer local Claude Code logs into where the tokens,
 * time, and dollars actually go. TypeScript port of Coral-Bricks-AI's
 * claude-code-token-xray (Apache 2.0). Reads only `~/.claude/projects/*​/*.jsonl`;
 * nothing leaves the machine.
 *
 * Subcommands:
 *   cost       — billed token totals priced at Opus 4.7 list rates
 *   breakdown  — headline table: tokens AND wall-clock per activity
 *   split      — main thread vs sidecar subagents
 *   reread     — per-activity cumulative input (the re-read multiplier)
 *
 * Each subcommand accepts --json for structured output.
 *
 * tiktoken is OpenAI's tokenizer, not Claude's, so token PROPORTIONS are
 * reliable to ~±15%, not Claude-exact. Billed counts in `cost` come from API
 * `usage` blocks and are exact.
 */

import { readFileSync, statSync } from "fs";
import { globSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { getEncoding } from "js-tiktoken";
import { claudeDir } from "../lifeos-root";

const enc = getEncoding("cl100k_base");

// Python's json.dumps defaults: `, ` between items, `: ` between key and value,
// AND ensure_ascii=True which escapes every non-ASCII char as \uXXXX. JS's
// JSON.stringify uses no spaces and keeps Unicode literal. We mirror Python's
// defaults so token counts of dict-shaped values match the Python xray scripts.
function ensureAsciiEscape(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code > 0x7f) {
      out += "\\u" + code.toString(16).padStart(4, "0");
    } else {
      out += s[i];
    }
  }
  return out;
}

function pyJson(x: unknown): string {
  if (x === null || x === undefined) return "null";
  if (typeof x === "string") return ensureAsciiEscape(JSON.stringify(x));
  if (typeof x === "number") return Number.isFinite(x) ? String(x) : "null";
  if (typeof x === "boolean") return x ? "true" : "false";
  if (Array.isArray(x)) return "[" + x.map(pyJson).join(", ") + "]";
  if (typeof x === "object") {
    const obj = x as Record<string, unknown>;
    return (
      "{" +
      Object.keys(obj)
        .map((k) => ensureAsciiEscape(JSON.stringify(k)) + ": " + pyJson(obj[k]))
        .join(", ") +
      "}"
    );
  }
  return JSON.stringify(x);
}

function ntok(x: unknown): number {
  let s: string;
  if (Array.isArray(x)) {
    s = x.map((b) => (b && typeof b === "object" ? (b as Record<string, unknown>).text ?? "" : "")).join(" ");
  } else if (typeof x === "string") {
    s = x;
  } else {
    s = pyJson(x ?? "");
  }
  return enc.encode(s, "all", []).length;
}

function tsOf(o: Record<string, unknown>): number | null {
  const t = o.timestamp;
  if (typeof t !== "string") return null;
  const d = new Date(t.replace("Z", "+00:00"));
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms / 1000 : null;
}

function glob(pattern: string): string[] {
  return globSync(pattern) as string[];
}

function* readJsonl(path: string): IterableIterator<Record<string, unknown>> {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return;
  }
  for (const line of raw.split("\n")) {
    const s = line.trim();
    if (!s) continue;
    try {
      yield JSON.parse(s) as Record<string, unknown>;
    } catch {
      continue;
    }
  }
}

function mainLogs(): string[] {
  return glob(join(claudeDir(), "projects/*/*.jsonl"));
}

function sideLogs(): string[] {
  return glob(join(claudeDir(), "projects/*/*/subagents/*.jsonl"));
}

function fmtNum(n: number, w = 0): string {
  return n.toLocaleString("en-US").padStart(w);
}

function fmtMoney(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function bigNum(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  return n.toLocaleString("en-US");
}

function hms(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

// ────────────────────────────────────────────────────────────────────
// cost — port of cost.py
// ────────────────────────────────────────────────────────────────────

interface CostTotals {
  rows: { key: string; label: string; tokens: number; cost: number }[];
  total: number;
  grand: number;
  no_caching: number;
}

function computeCostTotals(): CostTotals {
  const T: Record<string, number> = {
    cache_read: 0,
    uncached: 0,
    output: 0,
    write_1h: 0,
    write_5m: 0,
  };
  for (const f of mainLogs()) {
    for (const o of readJsonl(f)) {
      const m = o.message as Record<string, unknown> | undefined;
      if (!m || typeof m !== "object" || m.role !== "assistant") continue;
      const u = (m.usage as Record<string, unknown>) ?? {};
      T.cache_read += Number(u.cache_read_input_tokens ?? 0);
      T.uncached += Number(u.input_tokens ?? 0);
      T.output += Number(u.output_tokens ?? 0);
      const cc = (u.cache_creation as Record<string, unknown>) ?? {};
      T.write_1h += Number(cc.ephemeral_1h_input_tokens ?? 0);
      T.write_5m += Number(cc.ephemeral_5m_input_tokens ?? 0);
    }
  }

  const M = 1_000_000;
  const rates: Record<string, number> = {
    uncached: 5.0,
    cache_read: 0.5,
    write_5m: 6.25,
    write_1h: 10.0,
    output: 25.0,
  };
  const labels: Record<string, string> = {
    cache_read: "cache reads",
    write_1h: "cache writes (1h)",
    write_5m: "cache writes (5m)",
    uncached: "fresh (uncached) input",
    output: "output (incl. reasoning)",
  };

  const order = ["cache_read", "write_1h", "write_5m", "uncached", "output"];
  let total = 0;
  const rows: CostTotals["rows"] = [];
  for (const k of order) {
    const c = (T[k] / M) * rates[k];
    total += c;
    rows.push({ key: k, label: labels[k], tokens: T[k], cost: c });
  }
  const grand = Object.values(T).reduce((a, b) => a + b, 0);
  const inp = T.cache_read + T.write_1h + T.write_5m + T.uncached;
  const no_caching = (inp / M) * 5 + (T.output / M) * 25;
  return { rows, total, grand, no_caching };
}

function runCost(jsonOut: boolean): void {
  const { rows, total, grand, no_caching } = computeCostTotals();

  if (jsonOut) {
    console.log(
      JSON.stringify(
        { rows, total, grand_total_tokens: grand, no_caching_counterfactual: no_caching },
        null,
        2,
      ),
    );
    return;
  }

  for (const r of rows) {
    console.log(`${r.label.padEnd(26)} ${fmtNum(r.tokens, 14)} tok  $${fmtMoney(r.cost).padStart(9)}`);
  }
  console.log(`${"TOTAL".padEnd(26)} ${fmtNum(grand, 14)} tok  $${fmtMoney(total).padStart(9)}`);
  console.log("");
  console.log(`if there were NO caching (all input at full $5/M): $${fmtMoney(no_caching)}`);
}

// ────────────────────────────────────────────────────────────────────
// actual — subscription (counterfactual) vs API (real from observability)
// ────────────────────────────────────────────────────────────────────

interface ApiCostSnapshot {
  ts: string;
  subscription: { five_hour_pct?: number; seven_day_pct?: number };
  api_spend: { month_used_usd: number; source: string };
}

function loadLatestApiCostSnapshot(): ApiCostSnapshot | null {
  const path = join(claudeDir(), "LIFEOS/MEMORY/OBSERVABILITY/anthropic-cost.jsonl");
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return null;
  }
  const lines = raw.split("\n").filter((l) => l.trim());
  if (!lines.length) return null;
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const o = JSON.parse(lines[i]) as Partial<ApiCostSnapshot>;
      if (o && typeof o === "object" && o.api_spend && typeof o.api_spend.month_used_usd === "number") {
        return o as ApiCostSnapshot;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function runActual(jsonOut: boolean): void {
  const ct = computeCostTotals();
  const snap = loadLatestApiCostSnapshot();

  if (jsonOut) {
    console.log(
      JSON.stringify(
        {
          subscription_oauth: {
            counterfactual_list_rate_usd: ct.total,
            actual_marginal_usd: 0,
            note: "OAuth-billed via Claude Max — marginal cost is zero (subscription fee is separate)",
            five_hour_pct: snap?.subscription?.five_hour_pct ?? null,
            seven_day_pct: snap?.subscription?.seven_day_pct ?? null,
          },
          api_keyed: snap
            ? {
                month_used_usd: snap.api_spend.month_used_usd,
                source: snap.api_spend.source,
                snapshot_ts: snap.ts,
              }
            : { error: "anthropic-cost.jsonl missing or empty" },
          counterfactual_no_subscription_usd: ct.total + (snap?.api_spend?.month_used_usd ?? 0),
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log("SUBSCRIPTION (~/.claude/projects/, OAuth-billed via Claude Max)");
  console.log(`  counterfactual list-rate cost:  $${fmtMoney(ct.total)}`);
  console.log(`  actual marginal:                $0.00   (covered by Max subscription fee)`);
  if (snap?.subscription) {
    const fh = snap.subscription.five_hour_pct;
    const sd = snap.subscription.seven_day_pct;
    if (typeof fh === "number") console.log(`  five-hour quota used:           ${fh}%`);
    if (typeof sd === "number") console.log(`  seven-day quota used:           ${sd}%`);
  }
  console.log("");
  console.log("API (separate channels — Inference.ts, bridge bots, admin tools)");
  if (snap) {
    console.log(`  month-to-date actual:           $${fmtMoney(snap.api_spend.month_used_usd)}`);
    console.log(`  source:                         ${snap.api_spend.source}`);
    console.log(`  snapshot:                       ${snap.ts}`);
  } else {
    console.log(`  (no data — anthropic-cost.jsonl missing at LIFEOS/MEMORY/OBSERVABILITY/)`);
  }
  console.log("");
  console.log("COUNTERFACTUAL (if you had no Max subscription)");
  const counterfactual = ct.total + (snap?.api_spend?.month_used_usd ?? 0);
  console.log(`  would have paid:                $${fmtMoney(counterfactual)}`);
  console.log(`  subscription delta:             $${fmtMoney(ct.total)} saved`);
}

// ────────────────────────────────────────────────────────────────────
// breakdown — port of token_time_breakdown.py
// ────────────────────────────────────────────────────────────────────

const READ_TOOLS = new Set(["Read", "Grep", "Glob", "WebSearch", "WebFetch"]);
const SUB_TOOLS = new Set(["Agent", "TaskOutput"]);
const EDIT_TOOLS = new Set(["Edit", "Write", "NotebookEdit"]);
const KNOWN_TOOLS = new Set([...READ_TOOLS, ...SUB_TOOLS, ...EDIT_TOOLS, "Bash", "bash", "AskUserQuestion"]);
const CAP = 600.0;

function runBreakdown(jsonOut: boolean): void {
  let out_total = 0;
  let tok_call = 0;
  let tok_summary = 0;
  let tok_prompt = 0;
  let scaffold = 0;
  let attach = 0;
  let reminders = 0;
  const tr = new Map<string, number>();
  const toolt = new Map<string, number>();
  let gen = 0;

  const addMap = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v);

  for (const f of mainLogs()) {
    type Ev = [number, "A" | "H" | "T"];
    const evs: Ev[] = [];
    const pend = new Map<string, [string, number | null]>();
    let first = true;

    for (const o of readJsonl(f)) {
      if (o.type === "attachment") {
        const att = (o.attachment ?? o.content) ?? {};
        attach += ntok(att);
        continue;
      }
      if (o.isMeta === true || o.type === "system") {
        const mm = (o.message as Record<string, unknown>) ?? {};
        const content = typeof mm.content !== "undefined" ? mm.content : (o.content as unknown);
        reminders += ntok(content ?? "");
      }
      const t = tsOf(o);
      const m = o.message as Record<string, unknown> | undefined;
      if (!m || typeof m !== "object") continue;
      const role = m.role as string | undefined;
      const c = m.content;
      const u = (m.usage as Record<string, unknown>) ?? {};
      let kind: "A" | "H" | "T" | null = null;

      if (role === "assistant") {
        kind = "A";
        out_total += Number(u.output_tokens ?? 0);
        if (first) {
          scaffold += Number(u.cache_creation_input_tokens ?? 0);
          first = false;
        }
        if (Array.isArray(c)) {
          for (const b of c) {
            if (!b || typeof b !== "object") continue;
            const bb = b as Record<string, unknown>;
            if (bb.type === "tool_use") {
              tok_call += ntok(bb.input ?? {});
              pend.set(String(bb.id), [String(bb.name ?? ""), t]);
            } else if (bb.type === "text") {
              tok_summary += ntok(bb.text ?? "");
            }
          }
        }
      } else if (role === "user") {
        const isStr = typeof c === "string";
        const arr = Array.isArray(c) ? (c as unknown[]) : [];
        const hasText =
          isStr ||
          arr.some((b) => b && typeof b === "object" && (b as Record<string, unknown>).type === "text");
        const isTr = arr.some(
          (b) => b && typeof b === "object" && (b as Record<string, unknown>).type === "tool_result",
        );
        kind = hasText && !isTr ? "H" : isTr ? "T" : "H";

        if (isStr) {
          tok_prompt += ntok(c);
        } else if (Array.isArray(c)) {
          for (const b of c) {
            if (!b || typeof b !== "object") continue;
            const bb = b as Record<string, unknown>;
            if (bb.type === "text") {
              tok_prompt += ntok(bb.text ?? "");
            } else if (bb.type === "tool_result") {
              const tid = String(bb.tool_use_id ?? "");
              const matched = pend.get(tid);
              if (matched) {
                pend.delete(tid);
                const [nm, t0] = matched;
                addMap(tr, nm, ntok(bb.content ?? ""));
                if (t !== null && t0 !== null && t - t0 >= 0) addMap(toolt, nm, Math.min(t - t0, CAP));
              } else {
                addMap(tr, "(unmatched)", ntok(bb.content ?? ""));
              }
            }
          }
        }
      }

      if (t !== null && kind) evs.push([t, kind]);
    }

    evs.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < evs.length - 1; i++) {
      const [t0, k0] = evs[i];
      const [t1, k1] = evs[i + 1];
      const g = t1 - t0;
      if (g >= 0 && k1 === "A" && (k0 === "T" || k0 === "H" || k0 === "A")) {
        gen += Math.min(g, CAP);
      }
    }
  }

  const reasoning = out_total - tok_call - tok_summary;
  const sumOf = (m: Map<string, number>, keys: Set<string>): number => {
    let n = 0;
    for (const k of keys) n += m.get(k) ?? 0;
    return n;
  };
  const sumUnknown = (m: Map<string, number>): number => {
    let n = 0;
    for (const [k, v] of m) if (!KNOWN_TOOLS.has(k)) n += v;
    return n;
  };

  const bash_d = (tr.get("Bash") ?? 0) + (tr.get("bash") ?? 0);
  const sub_d = sumOf(tr, SUB_TOOLS);
  const edit_d = sumOf(tr, EDIT_TOOLS);
  const read_d = sumOf(tr, READ_TOOLS) + sumUnknown(tr);
  const bash_t = (toolt.get("Bash") ?? 0) + (toolt.get("bash") ?? 0);
  const sub_t = sumOf(toolt, SUB_TOOLS);
  const edit_t = sumOf(toolt, EDIT_TOOLS);
  const read_t = sumOf(toolt, READ_TOOLS) + sumUnknown(toolt);

  const sr = out_total ? reasoning / out_total : 0;
  const sc = out_total ? tok_call / out_total : 0;
  const ss = out_total ? tok_summary / out_total : 0;

  const rows: [string, "input" | "output", number, number | null][] = [
    ["Reasoning (hidden thinking)", "output", reasoning, gen * sr],
    ["Running commands (Bash)", "input", bash_d, bash_t],
    ["Writing tool calls", "output", tok_call, gen * sc],
    ["Subagents & background jobs", "input", sub_d, sub_t],
    ["Writing summaries", "output", tok_summary, gen * ss],
    ["Reading / searching / web", "input", read_d, read_t],
    ["Editing files", "input", edit_d, edit_t],
    ["System prompt + tools + config", "input", scaffold, null],
    ["Pasted attachments", "input", attach, null],
    ["The instruction I typed", "input", tok_prompt, null],
    ["Injected reminders", "input", reminders, null],
  ];

  const TT = rows.reduce((a, r) => a + r[2], 0);
  const TM = rows.reduce((a, r) => a + (r[3] ?? 0), 0);

  if (jsonOut) {
    console.log(
      JSON.stringify(
        {
          total_tokens: TT,
          total_time_s: TM,
          rows: rows.map(([n, io, tk, tm]) => ({ name: n, io, tokens: tk, time_s: tm })),
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`TOKEN TOTAL=${fmtNum(TT)}   TIME TOTAL=${hms(TM)}`);
  console.log("");
  for (const [n, io, tk, tm] of rows) {
    const tms = tm !== null ? `${hms(tm)} (${TM ? ((100 * tm) / TM).toFixed(0) : 0}%)` : "—";
    const tkPct = TT ? ((100 * tk) / TT).toFixed(1) : "0.0";
    console.log(`${n.padEnd(32)} ${io.padEnd(7)} ${fmtNum(tk, 11)} (${tkPct.padStart(4)}%)  ${tms.padStart(13)}`);
  }
}

// ────────────────────────────────────────────────────────────────────
// split — port of main_vs_sidecar.py
// ────────────────────────────────────────────────────────────────────

interface SplitResult {
  files: number;
  calls: number;
  billed: Record<string, number>;
  content: Record<string, number>;
  model_out: Map<string, number>;
  model_calls: Map<string, number>;
  per_call_prompt: number[];
  per_call_out: number[];
  per_session: number[];
}

function analyze(files: string[]): SplitResult {
  const R: SplitResult = {
    files: files.length,
    calls: 0,
    billed: { cache_read: 0, cache_write: 0, uncached: 0, output: 0 },
    content: { user_prompt: 0, assistant_text: 0, tool_calls: 0, tool_results: 0 },
    model_out: new Map(),
    model_calls: new Map(),
    per_call_prompt: [],
    per_call_out: [],
    per_session: [],
  };
  const bump = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v);
  for (const f of files) {
    let fc = 0;
    for (const o of readJsonl(f)) {
      const m = o.message as Record<string, unknown> | undefined;
      if (!m || typeof m !== "object") continue;
      const role = m.role as string | undefined;
      const u = m.usage as Record<string, unknown> | undefined;
      if (u && typeof u === "object" && role === "assistant") {
        R.calls += 1;
        fc += 1;
        const ui = Number(u.input_tokens ?? 0);
        const cr = Number(u.cache_read_input_tokens ?? 0);
        const cw = Number(u.cache_creation_input_tokens ?? 0);
        const ot = Number(u.output_tokens ?? 0);
        R.billed.uncached += ui;
        R.billed.cache_read += cr;
        R.billed.cache_write += cw;
        R.billed.output += ot;
        const model = String(m.model ?? "?");
        bump(R.model_out, model, ot);
        bump(R.model_calls, model, 1);
        R.per_call_prompt.push(ui + cr + cw);
        R.per_call_out.push(ot);
      }
      const c = m.content;
      if (typeof c === "string") {
        if (role === "user") R.content.user_prompt += ntok(c);
        continue;
      }
      if (!Array.isArray(c)) continue;
      for (const b of c) {
        if (!b || typeof b !== "object") continue;
        const bb = b as Record<string, unknown>;
        const t = bb.type;
        if (t === "text") {
          R.content[role === "assistant" ? "assistant_text" : "user_prompt"] += ntok(bb.text ?? "");
        } else if (t === "tool_use") {
          R.content.tool_calls += ntok(bb.input ?? {});
        } else if (t === "tool_result") {
          R.content.tool_results += ntok(bb.content ?? "");
        }
      }
    }
    R.per_session.push(fc);
  }
  return R;
}

function rateCost(b: Record<string, number>): number {
  return (
    (b.cache_read / 1e6) * 0.5 +
    (b.cache_write / 1e6) * 10 +
    (b.uncached / 1e6) * 5 +
    (b.output / 1e6) * 25
  );
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function reportSplit(name: string, R: SplitResult): void {
  const b = R.billed;
  const inp = b.cache_read + b.cache_write + b.uncached;
  console.log("");
  console.log(`############ ${name} ############`);
  console.log(`files=${fmtNum(R.files)}  assistant_calls=${fmtNum(R.calls)}`);
  console.log(
    `  billed: read=${fmtNum(b.cache_read)}  write=${fmtNum(b.cache_write)}  uncached=${fmtNum(b.uncached)}  output=${fmtNum(b.output)}`,
  );
  console.log(
    `  input:output = ${(inp / Math.max(1, b.output)).toFixed(0)}:1   cache_hit=${((100 * b.cache_read) / Math.max(1, inp)).toFixed(1)}%`,
  );
  if (R.per_call_out.length) {
    console.log(
      `  per-call: prompt mean=${mean(R.per_call_prompt).toFixed(0)} median=${median(R.per_call_prompt).toFixed(0)}  | output mean=${mean(R.per_call_out).toFixed(0)} median=${median(R.per_call_out).toFixed(0)}`,
    );
  }
  if (R.per_session.length) {
    console.log(
      `  turns/session: mean=${mean(R.per_session).toFixed(0)} median=${median(R.per_session).toFixed(0)}  (over ${R.files} session files; max=${Math.max(...R.per_session)})`,
    );
  }
  const vis = R.content.assistant_text + R.content.tool_calls;
  const reason = b.output - vis;
  console.log(
    `  output decomp(est): reasoning~${fmtNum(reason)} (${((100 * reason) / Math.max(1, b.output)).toFixed(0)}%)  tool_calls=${fmtNum(R.content.tool_calls)}  text=${fmtNum(R.content.assistant_text)}`,
  );
  console.log(
    `  content(unique,tiktoken): tool_results=${fmtNum(R.content.tool_results)}  tool_calls=${fmtNum(R.content.tool_calls)}  asst_text=${fmtNum(R.content.assistant_text)}  user=${fmtNum(R.content.user_prompt)}`,
  );
  const msplit = [...R.model_out.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => {
      const tail = k.includes("-") ? k.split("-").pop() : k;
      return `${tail}=${fmtNum(v)}`;
    })
    .join(", ");
  console.log(`  model output split: ${msplit}`);
  console.log(`  >> Opus-4.7-rate cost = $${fmtMoney(rateCost(b))}`);
}

function runSplit(jsonOut: boolean): void {
  const M = analyze(mainLogs());
  const S = analyze(sideLogs());
  const C: SplitResult = {
    files: M.files + S.files,
    calls: M.calls + S.calls,
    billed: { cache_read: 0, cache_write: 0, uncached: 0, output: 0 },
    content: { user_prompt: 0, assistant_text: 0, tool_calls: 0, tool_results: 0 },
    model_out: new Map(),
    model_calls: new Map(),
    per_call_prompt: [...M.per_call_prompt, ...S.per_call_prompt],
    per_call_out: [...M.per_call_out, ...S.per_call_out],
    per_session: [],
  };
  for (const k of Object.keys(M.billed)) C.billed[k] = M.billed[k] + S.billed[k];
  for (const k of Object.keys(M.content)) C.content[k] = M.content[k] + S.content[k];
  for (const [k, v] of M.model_out) C.model_out.set(k, (C.model_out.get(k) ?? 0) + v);
  for (const [k, v] of S.model_out) C.model_out.set(k, (C.model_out.get(k) ?? 0) + v);

  if (jsonOut) {
    const serialize = (R: SplitResult) => ({
      files: R.files,
      calls: R.calls,
      billed: R.billed,
      content: R.content,
      model_out: Object.fromEntries(R.model_out),
      cost_usd: rateCost(R.billed),
    });
    console.log(
      JSON.stringify(
        {
          main: serialize(M),
          sidecar: serialize(S),
          combined: serialize(C),
          turns_per_agent: {
            main: M.files ? M.calls / M.files : 0,
            sidecar: S.files ? S.calls / S.files : 0,
          },
          sidecar_share: {
            calls: C.calls ? (100 * S.calls) / C.calls : 0,
            billed_tokens:
              Object.values(C.billed).reduce((a, b) => a + b, 0) > 0
                ? (100 * Object.values(S.billed).reduce((a, b) => a + b, 0)) /
                  Object.values(C.billed).reduce((a, b) => a + b, 0)
                : 0,
            cost: rateCost(C.billed) > 0 ? (100 * rateCost(S.billed)) / rateCost(C.billed) : 0,
          },
        },
        null,
        2,
      ),
    );
    return;
  }

  reportSplit("MAIN THREAD", M);
  reportSplit("SIDECAR (subagents)", S);
  reportSplit("COMBINED", C);
  console.log("");
  console.log(
    `turns per agent: main=${(M.calls / Math.max(1, M.files)).toFixed(0)} (per session, ${fmtNum(M.calls)}/${M.files})  ` +
      `subagent=${(S.calls / Math.max(1, S.files)).toFixed(0)} (per subagent, ${fmtNum(S.calls)}/${S.files})`,
  );
  const billedAllS = Object.values(S.billed).reduce((a, b) => a + b, 0);
  const billedAllC = Object.values(C.billed).reduce((a, b) => a + b, 0);
  console.log(
    `sidecar share of: calls=${((100 * S.calls) / Math.max(1, C.calls)).toFixed(1)}%  ` +
      `billed-tokens=${((100 * billedAllS) / Math.max(1, billedAllC)).toFixed(1)}%  ` +
      `cost=${((100 * rateCost(S.billed)) / Math.max(1, rateCost(C.billed))).toFixed(1)}%`,
  );
}

// ────────────────────────────────────────────────────────────────────
// reread — port of reread_breakdown.py
// ────────────────────────────────────────────────────────────────────

function toolCat(nm: string | undefined): string {
  if (!nm) return "reading";
  if (nm === "Bash" || nm === "bash") return "bash";
  if (SUB_TOOLS.has(nm)) return "subagents";
  if (EDIT_TOOLS.has(nm)) return "editing";
  return "reading";
}

function runReread(jsonOut: boolean): void {
  const uniq = new Map<string, number>();
  const cumu = new Map<string, number>();
  let measured = 0;
  const bump = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v);

  for (const f of mainLogs()) {
    const ctx = new Map<string, number>();
    const pend = new Map<string, string>();
    let first = true;
    for (const o of readJsonl(f)) {
      if (o.type === "attachment") {
        const s = ntok(o.attachment ?? o.content ?? {});
        bump(uniq, "attachments", s);
        bump(ctx, "attachments", s);
        continue;
      }
      if (o.isMeta === true || o.type === "system") {
        const mm = (o.message as Record<string, unknown>) ?? {};
        const content = typeof mm.content !== "undefined" ? mm.content : (o.content as unknown);
        const s = ntok(content ?? "");
        bump(uniq, "reminders", s);
        bump(ctx, "reminders", s);
      }
      const m = o.message as Record<string, unknown> | undefined;
      if (!m || typeof m !== "object") continue;
      const role = m.role as string | undefined;
      const c = m.content;
      const u = (m.usage as Record<string, unknown>) ?? {};
      if (role === "assistant") {
        if (first) {
          const sp = Number(u.cache_creation_input_tokens ?? 0);
          bump(uniq, "system", sp);
          bump(ctx, "system", sp);
          first = false;
        }
        measured +=
          Number(u.cache_read_input_tokens ?? 0) +
          Number(u.cache_creation_input_tokens ?? 0) +
          Number(u.input_tokens ?? 0);
        for (const [k, v] of ctx) bump(cumu, k, v);
        const ot = Number(u.output_tokens ?? 0);
        let tc = 0;
        let sm = 0;
        if (Array.isArray(c)) {
          for (const b of c) {
            if (!b || typeof b !== "object") continue;
            const bb = b as Record<string, unknown>;
            if (bb.type === "tool_use") {
              tc += ntok(bb.input ?? {});
              pend.set(String(bb.id), String(bb.name ?? ""));
            } else if (bb.type === "text") {
              sm += ntok(bb.text ?? "");
            }
          }
        }
        const rn = Math.max(0, ot - tc - sm);
        bump(uniq, "reasoning", rn);
        bump(ctx, "reasoning", rn);
        bump(uniq, "tool_calls", tc);
        bump(ctx, "tool_calls", tc);
        bump(uniq, "summaries", sm);
        bump(ctx, "summaries", sm);
      } else if (role === "user") {
        if (typeof c === "string") {
          const s = ntok(c);
          bump(uniq, "instruction", s);
          bump(ctx, "instruction", s);
        } else if (Array.isArray(c)) {
          for (const b of c) {
            if (!b || typeof b !== "object") continue;
            const bb = b as Record<string, unknown>;
            if (bb.type === "text") {
              const s = ntok(bb.text ?? "");
              bump(uniq, "instruction", s);
              bump(ctx, "instruction", s);
            } else if (bb.type === "tool_result") {
              const cat = toolCat(pend.get(String(bb.tool_use_id ?? "")));
              pend.delete(String(bb.tool_use_id ?? ""));
              const s = ntok(bb.content ?? "");
              bump(uniq, cat, s);
              bump(ctx, cat, s);
            }
          }
        }
      }
    }
  }

  const REPLAY = [...cumu.values()].reduce((a, b) => a + b, 0);
  const scale = REPLAY ? measured / REPLAY : 1.0;

  const LABEL: Record<string, string> = {
    reasoning: "reasoning",
    reading: "reading/web",
    bash: "bash",
    system: "system+tools",
    tool_calls: "tool calls",
    attachments: "attachments",
    summaries: "summaries",
    instruction: "my prompt",
    reminders: "reminders",
    subagents: "subagents",
    editing: "editing",
  };

  const ordered = [...cumu.entries()].sort((a, b) => b[1] - a[1]);

  if (jsonOut) {
    console.log(
      JSON.stringify(
        {
          unique_total: [...uniq.values()].reduce((a, b) => a + b, 0),
          billed_input_measured: measured,
          replay_cumulative_raw: REPLAY,
          scale,
          rows: ordered.map(([k, v]) => ({
            activity: LABEL[k] ?? k,
            unique: uniq.get(k) ?? 0,
            reread_scaled: v * scale,
            share_pct: REPLAY ? (100 * v) / REPLAY : 0,
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`unique total      = ${fmtNum([...uniq.values()].reduce((a, b) => a + b, 0))}`);
  console.log(`billed input      = ${fmtNum(measured)}  (measured, exact)`);
  console.log(`replay cumulative = ${fmtNum(REPLAY)}  (scaled by ${scale.toFixed(2)} to match billed)`);
  console.log("");
  console.log(`${"activity".padEnd(16)} ${"unique".padStart(10)} ${"re-read".padStart(10)}  share`);
  for (const [k, v] of ordered) {
    const label = (LABEL[k] ?? k).padEnd(16);
    const u = bigNum(uniq.get(k) ?? 0).padStart(10);
    const r = bigNum(v * scale).padStart(10);
    const pct = REPLAY ? ((100 * v) / REPLAY).toFixed(1) : "0.0";
    console.log(`${label} ${u} ${r}  ${pct.padStart(4)}%`);
  }
}

// ────────────────────────────────────────────────────────────────────
// router
// ────────────────────────────────────────────────────────────────────

function help(): void {
  console.log(`TokenXray — local Claude Code token / time / cost analysis

USAGE
  bun TokenXray.ts <subcommand> [--json]

SUBCOMMANDS
  cost        Billed token totals at Opus 4.7 rates (exact, from API usage blocks)
  breakdown   Tokens AND wall-clock per activity (tiktoken-sized, ±15%)
  split       Main thread vs sidecar subagents
  reread      Per-activity cumulative input (the re-read multiplier)
  actual      Subscription counterfactual vs real API spend (from LifeOS observability)

FLAGS
  --json      Emit structured JSON instead of human tables
  --help, -h  Show this help

Reads only ~/.claude/projects/*​/*.jsonl and LIFEOS/MEMORY/OBSERVABILITY/anthropic-cost.jsonl.
Nothing leaves the machine.
`);
}

function main(): void {
  const args = process.argv.slice(2);
  const jsonOut = args.includes("--json");
  const cmd = args.find((a) => !a.startsWith("-"));

  if (!cmd || cmd === "help" || args.includes("--help") || args.includes("-h")) {
    help();
    process.exit(cmd ? 0 : 0);
  }

  switch (cmd) {
    case "cost":
      runCost(jsonOut);
      break;
    case "breakdown":
      runBreakdown(jsonOut);
      break;
    case "split":
      runSplit(jsonOut);
      break;
    case "reread":
      runReread(jsonOut);
      break;
    case "actual":
      runActual(jsonOut);
      break;
    default:
      console.error(`Unknown subcommand: ${cmd}\n`);
      help();
      process.exit(2);
  }
}

main();

// silence unused-import linters for statSync (kept available for future probes)
void statSync;
