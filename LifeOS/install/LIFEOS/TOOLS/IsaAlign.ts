#!/usr/bin/env bun
/**
 * IsaAlign.ts — when an ISA owes a Discuss round, and the one writer for Discuss rounds.
 *
 * Algorithm v8.41.0 criterion 6; ISAFormat § The alignment loop; skills/ISA/Intents/Discuss.md.
 * The ISA's own state decides whether a Discuss round is owed, not discretion.
 *
 *   status <isa> [--json]
 *     ALIGNED (exit 0) or DISCUSS (exit 1) with the entry state (discover | align | deepen), the
 *     depth (quick | full) and every reason found. Precedence when several fire: discover, align, deepen.
 *     The tool never picks `deep`; that depth is chosen for an ideal state too large for one sitting.
 *       discover: no `## Ideal State` or no L3; a project ISA (outside MEMORY/WORK) with no L1
 *                 (a legacy `## Articulation` section counts as L1)
 *       align:    the latest answered `restate` block holds no clean yes, only corrections or hedges, and no
 *                 answered `discuss` block or clean `restate` follows it; two or more open asks
 *                 blocking the same criterion or Feature
 *       deepen:   five or more items in `## Not yet specified` once work has started, with no answered
 *                 `discuss` block in `deepen` mode in the Log
 *     ALIGNED whenever the ISA is complete or frozen. A dated `## Decisions` row naming
 *     "discuss skipped" (the logged principal `proceed`) clears every reason not newer than it.
 *
 *   checkpoint <isa> --topic "<t>" --mode <discover|align|deepen> (--text "<round>" | --file <path>)
 *              [--create] [--now "YYYY-MM-DD HH:MM"]
 *     Appends one round to the log's last block when it is today's discuss block on the same topic,
 *     else opens a new block. Demotes every `#`-led line and setext underline in the round to a
 *     blockquote, refuses a round with unbalanced code fences, refuses when `## Articulation Log`
 *     is not the last section, and asserts every earlier byte of the file is unchanged. `--create`
 *     writes the minimal ISA at an absolute `.../ISA.md` path that does not exist yet.
 *
 *   stats [--since YYYY-MM-DD] [--json]
 *     Discuss, Restate and ask activity across every task, project and system ISA, and how many
 *     unfinished ISAs owe a round now.
 *
 * Exit 2 means refused or bad input.
 */
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "fs";
import { basename, dirname, isAbsolute, join, resolve } from "path";
import { invariant } from "./Invariant";
import { discover, frontmatterMap, parseLadder } from "./IsaLadder";
import { parseAsks } from "./IsaAsks";
import { phaseHasWorkStarted } from "./ascent";
import { getClaudeDir } from "./Paths";
import { getPrincipalName } from "../../hooks/lib/identity";

export type Mode = "discover" | "align" | "deepen";
export type Depth = "quick" | "full";
export const MODES: Mode[] = ["discover", "align", "deepen"];

export interface Reason { mode: Mode; text: string; date?: string }
export interface Status {
  verdict: "ALIGNED" | "DISCUSS";
  mode: Mode | null;
  depth: Depth | null;
  reasons: Reason[];
}

export interface LogBlock { date: string; time: string | null; source: string; topic: string | null; body: string; line: number }

const FOG_THRESHOLD = 5;
const ASKS_PER_TARGET = 2;

export class Refusal extends Error {}

// ── Parsing ──────────────────────────────────────────────────────────────────

const FENCE_RE = /^\s{0,3}(```+|~~~+)/;

/** Lines with fenced code blanked, so headings inside fences are never read as structure. */
function maskedLines(text: string): string[] {
  let fence: string | null = null;
  return text.split("\n").map((l) => {
    const m = l.match(FENCE_RE);
    if (fence) { if (m && m[1]![0] === fence[0] && m[1]!.length >= fence.length) fence = null; return ""; }
    if (m) { fence = m[1]!; return ""; }
    return l;
  });
}

/** True when every code fence the text opens is closed again. */
export function fencesBalanced(text: string): boolean {
  let fence: string | null = null;
  for (const l of text.split("\n")) {
    const m = l.match(FENCE_RE);
    if (!m) continue;
    if (!fence) fence = m[1]!;
    else if (m[1]![0] === fence[0] && m[1]!.length >= fence.length) fence = null;
  }
  return fence === null;
}

/** Line index of the last `## Articulation Log` heading outside fences, or -1. */
function logIndex(masked: string[]): number {
  for (let i = masked.length - 1; i >= 0; i--) if (/^##\s+Articulation Log\s*$/.test(masked[i]!)) return i;
  return -1;
}

function logIsLast(masked: string[], idx: number): boolean {
  return !masked.slice(idx + 1).some((l) => /^##\s/.test(l));
}

// `### 2026-10-03 · restate`, `### 2026-10-03 10:00 · restate (AskUserQuestion, terminal)`, `### … · discuss — topic`
const BLOCK_RE = /^###\s+(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2}))?\s+·\s+([A-Za-z-]+)(?:\s*\([^)]*\))?(?:\s+—\s+(.*))?\s*$/;

export function logBlocks(text: string): LogBlock[] {
  const lines = text.split("\n");
  const masked = maskedLines(text);
  const idx = logIndex(masked);
  if (idx < 0) return [];
  const heads: { i: number; m: RegExpMatchArray }[] = [];
  for (let i = idx + 1; i < lines.length; i++) {
    if (/^##\s/.test(masked[i]!)) break;
    const m = masked[i]!.match(BLOCK_RE);
    if (m) heads.push({ i, m });
  }
  return heads.map((h, k) => ({
    date: h.m[1]!, time: h.m[2] ?? null, source: h.m[3]!.toLowerCase(), topic: h.m[4]?.trim() ?? null,
    body: lines.slice(h.i + 1, k + 1 < heads.length ? heads[k + 1]!.i : lines.length).join("\n"),
    line: h.i + 1,
  }));
}

/** A restate answer that is a plain yes: the principal confirmed the ladder and nothing else. */
const CLEAN_YES = /^(?:y|yes|yep|yeah|yup|ok|okay|sure|correct|right|that'?s (?:it|right)|exactly|looks good|sounds good|lgtm|perfect|confirmed|go|do it|ship it|proceed|build (?:it|this)|yes,? (?:do it|build (?:it|this)|go|ship it))[\s.!]*$/i;

/**
 * This install's own approval phrases, for principals who answer in another language (public issue
 * #2595): one phrase per line in USER/CONFIG/approval-phrases.txt, `#` starts a comment. No file, no
 * extra phrases, so an install without one behaves exactly as CLEAN_YES alone.
 */
export const approvalPhrasesPath = (): string => join(getClaudeDir(), "LIFEOS", "USER", "CONFIG", "approval-phrases.txt");

/** Case, accents (NFD, marks dropped), quotes and commas do not matter; spaces collapse. */
export function foldApproval(s: string): string {
  return s.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase().replace(/[,"“”]/g, " ").replace(/\s+/g, " ").trim();
}

let approvalCache: Set<string> | null = null;
export function approvalPhrases(path = approvalPhrasesPath()): Set<string> {
  if (approvalCache && path === approvalPhrasesPath()) return approvalCache;
  // A missing file is the default (no extra phrases); any other read error is thrown, never read as empty.
  const set = new Set(existsSync(path)
    ? readFileSync(path, "utf8").split("\n").map((l) => foldApproval(l.replace(/#.*$/, ""))).filter(Boolean)
    : []);
  if (path === approvalPhrasesPath()) approvalCache = set;
  return set;
}

/**
 * True when every sentence of the answer is one of the listed phrases: "sim. aceito." passes when both
 * are listed, and "sim, mas o L2..." stays unclean because "sim mas o l2" is not a phrase. A question
 * mark is kept, so "sim?" never matches "sim".
 */
export function isListedApproval(answer: string, phrases: Set<string>): boolean {
  if (!phrases.size) return false;
  const sentences = answer.split(/[.;!]+/).map(foldApproval).filter(Boolean);
  return sentences.length > 0 && sentences.every((s) => phrases.has(s));
}
/**
 * Answer lines are labelled "Principal", "A", or the configured principal's name (full or first).
 * The name comes from identity at first use, never from a literal in source: the release sanitizer
 * rewrites identity literals, which would leave a placeholder no public install's log ever matches.
 */
let answerRe: RegExp | null = null;
function answerRegex(): RegExp {
  if (answerRe) return answerRe;
  const name = getPrincipalName().trim();
  const names = name ? [...new Set([name, name.split(/\s+/)[0]!])] : [];
  const labels = ["Principal", ...names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "A"].join("|");
  answerRe = new RegExp(`^(?:\\s*[-*]\\s*)?(?:${labels})\\b[^:\\n]{0,40}:\\s*(.+)$|^\\s*(?:[-*]\\s*)?→\\s*A:\\s*(.+)$`, "gm");
  return answerRe;
}

/** The principal's words in an answer line: the first quoted span when there is one, else the line. */
function answerWords(line: string): string {
  const q = line.match(/["“]([^"”]*)["”]/);
  return (q ? q[1]! : line).trim();
}

/**
 * true: clean yes · false: correction or hedge · null: unanswered or no answer line.
 * A clean yes anywhere in the block settles it: Restate re-shows a corrected ladder and records the
 * second answer in the same block, and some blocks carry unrelated follow-up lines after the yes.
 * A correction made after a yes belongs in a new `restate` block.
 */
export function restateIsClean(body: string, phrases: Set<string> = approvalPhrases()): boolean | null {
  if (/\bpending\b/i.test(body)) return null;
  const answers = [...body.matchAll(answerRegex())].map((m) => answerWords(m[1] ?? m[2] ?? ""));
  if (!answers.length) return null;
  return answers.some((a) => CLEAN_YES.test(a) || isListedApproval(a, phrases));
}

/** A discuss block that actually held a conversation: rounds or answers, and nothing left pending. */
export function discussAnswered(body: string): boolean {
  if (/\bpending\b/i.test(body)) return false;
  if (/^\*\*Round \d+\*\*/m.test(body)) return true;
  return body.split("\n").filter((l) => l.trim() && !/^Mode:\s/.test(l.trim())).length >= 3;
}

function blockMode(body: string): string | null {
  return body.match(/^Mode:\s*(\w+)/m)?.[1]?.toLowerCase() ?? null;
}

function sectionLines(text: string, title: RegExp): string[] {
  const lines = text.split("\n");
  const masked = maskedLines(text);
  const start = masked.findIndex((l) => /^##\s/.test(l) && title.test(l.replace(/^##\s+/, "").trim()));
  if (start < 0) return [];
  const out: string[] = [];
  for (let i = start + 1; i < lines.length && !/^##\s/.test(masked[i]!); i++) if (masked[i]!.trim()) out.push(lines[i]!);
  return out;
}

/** The newest dated `discuss skipped` row in `## Decisions`: the logged principal `proceed`. */
export function latestSkip(text: string): string | null {
  let latest: string | null = null;
  for (const l of sectionLines(text, /^Decisions\b/i)) {
    if (!/discuss skipped/i.test(l)) continue;
    const d = l.match(/(\d{4}-\d{2}-\d{2})/)?.[1];
    if (d && (!latest || d > latest)) latest = d;
  }
  return latest;
}

function isTaskIsa(path: string): boolean {
  const work = join(getClaudeDir(), "LIFEOS", "MEMORY", "WORK");
  let real = work;
  try { real = realpathSync(work); } catch { /* absent on a fresh install */ }
  const p = resolve(path);
  return p.includes("/MEMORY/WORK/") || p.startsWith(real + "/") || /\/skills\/[^/]+\/Examples\//.test(p);
}

// ── Status ───────────────────────────────────────────────────────────────────

export function alignmentStatus(text: string, path: string): Status {
  const aligned: Status = { verdict: "ALIGNED", mode: null, depth: null, reasons: [] };
  const fm = frontmatterMap(text);
  if (/^complete\b/i.test(fm.phase ?? "") || /^true$/i.test(fm.frozen ?? "")) return aligned;
  const reasons: Reason[] = [];
  const ladder = parseLadder(text);
  const legacyArticulation = /^##\s+Articulation\s*$/m.test(maskedLines(text).join("\n"));

  if (!ladder.present || !ladder.l3) {
    if (!legacyArticulation) reasons.push({ mode: "discover", text: "no Ideal State ladder with an L3 yet" });
  } else if (!ladder.l1 && !legacyArticulation && !isTaskIsa(path) && basename(path) === "ISA.md") {
    reasons.push({ mode: "discover", text: "project ISA with no L1: its full articulation was never drawn out" });
  }

  const blocks = logBlocks(text);
  let lastRestate = -1;
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (blocks[i]!.source === "restate" && restateIsClean(blocks[i]!.body) !== null) { lastRestate = i; break; }
  }
  if (lastRestate >= 0 && restateIsClean(blocks[lastRestate]!.body) === false) {
    const resolved = blocks.slice(lastRestate + 1).some((b) =>
      (b.source === "discuss" && discussAnswered(b.body)) || (b.source === "restate" && restateIsClean(b.body) === true));
    if (!resolved) {
      const b = blocks[lastRestate]!;
      reasons.push({ mode: "align", date: b.date, text: `restate on ${b.date}${b.time ? ` ${b.time}` : ""} drew a correction or hedge that no Discuss round has re-aligned` });
    }
  }

  const byTarget = new Map<string, number>();
  for (const a of parseAsks(text)) {
    if (a.status !== "open") continue;
    for (const c of new Set(a.blocks)) byTarget.set(c, (byTarget.get(c) ?? 0) + 1);
  }
  for (const [c, n] of byTarget) if (n >= ASKS_PER_TARGET) reasons.push({ mode: "align", text: `${n} open asks block ${c}: they belong in one conversation` });

  const fog = sectionLines(text, /^Not yet specified\b/i).filter((l) => /^\s{0,1}[-*]\s+\S/.test(l));
  const deepened = blocks.some((b) => b.source === "discuss" && blockMode(b.body) === "deepen" && discussAnswered(b.body));
  if (fog.length >= FOG_THRESHOLD && phaseHasWorkStarted(fm.phase) && !deepened) {
    reasons.push({ mode: "deepen", text: `${fog.length} items still in Not yet specified while ${fm.phase}` });
  }

  const skip = latestSkip(text);
  const live = skip ? reasons.filter((r) => r.date && r.date > skip) : reasons;
  if (!live.length) return aligned;
  const mode = MODES.find((m) => live.some((r) => r.mode === m))!;
  return { verdict: "DISCUSS", mode, depth: mode === "align" ? "quick" : "full", reasons: live };
}

export function statusFile(path: string): Status {
  let text: string;
  try { text = readFileSync(path, "utf8"); } catch (e) { throw new Refusal(`cannot read ${path}: ${(e as Error).message}`); }
  return alignmentStatus(text, path);
}

// ── Checkpoint ───────────────────────────────────────────────────────────────

/** Every `#`-led line, and every setext underline under text, becomes a blockquote, so no round forges a heading. */
export function demote(round: string): string {
  const lines = round.split("\n");
  return lines.map((l, i) => {
    if (/^\s{0,3}#/.test(l)) return `> ${l.trimStart()}`;
    if (/^\s{0,3}(?:=+|-+)\s*$/.test(l) && i > 0 && lines[i - 1]!.trim() && !/^>/.test(lines[i - 1]!.trim())) return `> ${l.trim()}`;
    return l;
  }).join("\n");
}

function localStamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export interface CheckpointOptions { topic: string; mode: Mode; round: string; now?: string; create?: boolean }
export interface CheckpointResult { path: string; created: boolean; newBlock: boolean; round: number }

export function minimalIsa(path: string, topic: string, stamp: string): string {
  const iso = stamp.replace(" ", "T") + ":00";
  return `---\ntask: ${JSON.stringify(topic)}\nslug: ${basename(dirname(resolve(path)))}\nphase: marking\nprogress: 0/0\nstarted: ${iso}\nupdated: ${iso}\n---\n\n# ${topic}\n\n## Articulation Log\n`;
}

export function checkpointText(text: string, opts: CheckpointOptions): { text: string; newBlock: boolean; round: number } {
  const topic = opts.topic.replace(/\s+/g, " ").trim();
  if (!topic) throw new Refusal("--topic is empty");
  if (!MODES.includes(opts.mode)) throw new Refusal(`unknown mode "${opts.mode}"; use ${MODES.join(", ")}`);
  if (!fencesBalanced(opts.round)) throw new Refusal("the round opens a code fence it never closes; close it so later Log blocks stay readable");
  const round = demote(opts.round.replace(/\s+$/, ""));
  if (!round.trim()) throw new Refusal("the round is empty");
  const stamp = opts.now ?? localStamp();
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(stamp)) throw new Refusal(`--now must be "YYYY-MM-DD HH:MM", got "${stamp}"`);
  const [date, time] = stamp.split(" ") as [string, string];

  let base = text.replace(/\s+$/, "");
  if (!fencesBalanced(base)) throw new Refusal("the ISA ends inside an unclosed code fence; close it before checkpointing");
  const masked = maskedLines(base);
  const idx = logIndex(masked);
  if (idx >= 0 && !logIsLast(masked, idx)) throw new Refusal("## Articulation Log is not the last section; fix the ISA before checkpointing");
  if (idx < 0) base += "\n\n## Articulation Log";

  const blocks = logBlocks(base + "\n");
  const last = blocks[blocks.length - 1];
  const continues = !!last && last.source === "discuss" && last.date === date && last.topic === topic;
  const n = continues ? (last!.body.match(/^\*\*Round \d+\*\*/gm)?.length ?? 0) + 1 : 1;
  const roundText = `**Round ${n}** (${time})\n\n${round}`;
  const addition = continues
    ? `\n\n${roundText}\n`
    : `\n\n### ${date} ${time} · discuss — ${topic}\n\nMode: ${opts.mode}\n\n${roundText}\n`;
  const out = base + addition;

  // Invariants: earlier bytes untouched, the log still last, and no forged heading inside the new text.
  invariant(out.startsWith(text.replace(/\s+$/, "")), "checkpoint must leave every earlier byte of the ISA unchanged");
  const om = maskedLines(out);
  const oi = logIndex(om);
  invariant(oi >= 0 && logIsLast(om, oi), "the Articulation Log must be the last section after a checkpoint");
  invariant(maskedLines(addition).filter((l) => /^\s{0,3}#/.test(l)).every((l) => BLOCK_RE.test(l)), "no line inside a discuss round may start with #");
  return { text: out, newBlock: !continues, round: n };
}

export function checkpoint(path: string, opts: CheckpointOptions): CheckpointResult {
  const p = resolve(path);
  let created = false;
  let text: string;
  if (!existsSync(p)) {
    if (!opts.create) throw new Refusal(`${p} does not exist; pass --create to start a minimal ISA there`);
    if (!isAbsolute(path) || basename(p) !== "ISA.md") throw new Refusal("--create needs an absolute path ending in ISA.md (a new ISA lives at ~/.claude/LIFEOS/MEMORY/WORK/<slug>/ISA.md)");
    mkdirSync(dirname(p), { recursive: true });
    text = minimalIsa(p, opts.topic, opts.now ?? localStamp());
    created = true;
  } else {
    text = readFileSync(p, "utf8");
  }
  const r = checkpointText(text, opts);
  writeFileSync(p, r.text);
  return { path: p, created, newBlock: r.newBlock, round: r.round };
}

// ── Stats ────────────────────────────────────────────────────────────────────

export interface Stats {
  total: number;
  since: string | null;
  withDiscuss: number;
  discussBlocks: number;
  withRestate: number;
  restateBlocks: number;
  withAsks: number;
  owing: { discover: number; align: number; deepen: number; total: number };
  owingPaths: { path: string; mode: Mode; reasons: string[] }[];
  unreadable: number;
}

export function stats(paths: string[], since: string | null = null): Stats {
  const s: Stats = { total: 0, since, withDiscuss: 0, discussBlocks: 0, withRestate: 0, restateBlocks: 0, withAsks: 0, owing: { discover: 0, align: 0, deepen: 0, total: 0 }, owingPaths: [], unreadable: 0 };
  for (const p of paths) {
    let text: string;
    try { text = readFileSync(p, "utf8"); } catch { s.unreadable++; continue; }
    s.total++;
    const blocks = logBlocks(text).filter((b) => !since || b.date >= since);
    const d = blocks.filter((b) => b.source === "discuss").length;
    const r = blocks.filter((b) => b.source === "restate").length;
    s.discussBlocks += d; if (d) s.withDiscuss++;
    s.restateBlocks += r; if (r) s.withRestate++;
    if (parseAsks(text).length) s.withAsks++;
    const st = alignmentStatus(text, p);
    if (st.verdict === "DISCUSS" && st.mode) {
      s.owing[st.mode]++; s.owing.total++;
      s.owingPaths.push({ path: p, mode: st.mode, reasons: st.reasons.map((x) => x.text) });
    }
  }
  return s;
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function flag(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

export function main(argv: string[]): number {
  const [cmd, ...rest] = argv;
  const json = rest.includes("--json");
  try {
    if (cmd === "status") {
      const isa = rest.find((a) => !a.startsWith("--"));
      if (!isa) throw new Refusal("usage: status <isa> [--json]");
      const st = statusFile(isa);
      if (json) console.log(JSON.stringify({ path: resolve(isa), ...st }));
      else if (st.verdict === "ALIGNED") console.log("ALIGNED");
      else {
        console.log(`DISCUSS · ${st.mode} · ${st.depth}`);
        for (const r of st.reasons) console.log(`  - [${r.mode}] ${r.text}`);
        console.log(`  → Skill("ISA", "discuss ${resolve(isa)} ${st.mode} ${st.depth}")`);
      }
      return st.verdict === "ALIGNED" ? 0 : 1;
    }
    if (cmd === "checkpoint") {
      const isa = rest[0] && !rest[0].startsWith("--") ? rest[0] : undefined;
      if (!isa) throw new Refusal("usage: checkpoint <isa> --topic <t> --mode <m> (--text <round> | --file <path>)");
      const file = flag(rest, "--file");
      const round = file ? readFileSync(file, "utf8") : flag(rest, "--text");
      if (round === undefined) throw new Refusal("pass --text or --file");
      const r = checkpoint(isa, { topic: flag(rest, "--topic") ?? "", mode: (flag(rest, "--mode") ?? "") as Mode, round, now: flag(rest, "--now"), create: rest.includes("--create") });
      console.log(json ? JSON.stringify(r) : `${r.created ? "created, " : ""}${r.newBlock ? "new block" : "appended"}, round ${r.round}: ${r.path}`);
      return 0;
    }
    if (cmd === "stats") {
      const since = flag(rest, "--since") ?? null;
      if (since && !/^\d{4}-\d{2}-\d{2}$/.test(since)) throw new Refusal("--since must be YYYY-MM-DD");
      const unreadable: string[] = [];
      const paths = [...new Set((["task", "project", "system"] as const).flatMap((sc) => discover(sc, unreadable)))];
      const s = stats(paths, since);
      s.unreadable += unreadable.length;
      if (json) { console.log(JSON.stringify(s)); return 0; }
      console.log(`ISAs read: ${s.total}${since ? ` (log blocks since ${since})` : ""}`);
      console.log(`Discuss:  ${s.withDiscuss} ISAs, ${s.discussBlocks} blocks`);
      console.log(`Restate:  ${s.withRestate} ISAs, ${s.restateBlocks} blocks`);
      console.log(`Asks:     ${s.withAsks} ISAs carry ask fences`);
      console.log(`Owing a Discuss round now: ${s.owing.total} (discover ${s.owing.discover}, align ${s.owing.align}, deepen ${s.owing.deepen})`);
      if (s.unreadable) console.log(`Unreadable: ${s.unreadable}`);
      return 0;
    }
    console.error("usage: IsaAlign.ts status <isa> [--json] | checkpoint <isa> --topic <t> --mode <m> (--text <round> | --file <path>) [--create] [--now <stamp>] | stats [--since YYYY-MM-DD] [--json]");
    return 2;
  } catch (e) {
    if (e instanceof Refusal) { console.error(`refused: ${e.message}`); return 2; }
    throw e;
  }
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
