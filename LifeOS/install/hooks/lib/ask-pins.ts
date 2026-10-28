/**
 * ask-pins.ts — the done-check's pure core.
 *
 * The principal's request is broken into its explicit asks when the prompt arrives
 * (AskPin.hook.ts, maintainer-side and not shipped), and VerificationGate holds a done-claiming reply against
 * them at Stop. This file owns the three pure pieces: extracting the asks,
 * deciding whether a reply claims done, and the code-visible coverage checks.
 * Judgment (did the evidence actually fulfil the ask?) lives in
 * DoneCheckJudge.hook.ts (maintainer-side, not shipped) on Glance, in shadow. Whether a code-found drop is
 * really a drop is the judge veto in VerificationGate, which can only lift a block.
 *
 */
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { createHash } from "node:crypto";
import { invariant } from "../../LIFEOS/TOOLS/Invariant";
import { closerPattern } from "./identity";
import { getLifeosDir } from "./paths";

export type Ask = { id: string; kind: "item" | "constraint"; text: string; keywords: string[] };
export type PinFile = {
  session: string;
  pinnedAt: string;
  prompt: string;
  asks: Ask[];
  /** Set when a done reply covered every ask; satisfied pins are never checked again. */
  satisfied: boolean;
  /** Key of the reply that satisfied the pins, so the judge checks that reply and no later one. */
  satisfiedBy?: string;
  /** Judged misses from the last reply, shown once at the next prompt (shadow). */
  judgedMisses?: { ask: string; at: string }[];
};

const STOP = new Set(("the a an and or but to of in on for with this that these those it its is are be was were " +
  "can could should would will just also then than into from about make sure please need want lets let our your " +
  "my me we you i so as at by if all any each every some more most much very really thing things stuff like " +
  "only never dont don't must not do does did have has had get got use using one two").split(" "));

/** Imperative verbs that open an ask. A list whose items mostly open with one is a list of asks; a list of
 * error lines, options or ideas is context (acceptance, 2026-10-08: a pasted error list blocked an honest fix). */
const IMPERATIVES = new Set(("add fix write update delete remove rename move make build create change run ship deploy test " +
  "check verify review audit refactor port migrate implement wire hook register replace swap set send draft post publish " +
  "email text call book schedule cancel pull push merge commit revert clean bump install upgrade downgrade configure enable " +
  "disable turn put drop cut trim split combine convert generate render export import document log track find research " +
  "investigate look read summarize explain list show open close archive label tag sort file sync backup restore rotate " +
  "seal unseal stop start restart kill rerun retry redo redesign resize align center style polish tighten simplify shorten " +
  "expand extend cover handle support catch block allow keep give get buy order pay invoice reply respond answer ask tell " +
  "remind follow plan design sketch mock prototype record transcribe translate edit proofread rewrite fold ensure confirm " +
  "include exclude avoid limit restyle rework reorganize rearrange tweak adjust rebuild purge refresh").split(" "));
const LEAD_FILLER = /^(?:please|also|and|then|now|first|next|finally|go|so|oh|um|okay|ok|(?:can|could|would|will)\s+you|let'?s|you\s+should|i(?:'?d|\s+would)?\s+(?:want|need|like)\s+you\s+to)\s+/i;
/** A polite request phrased as a question ("Could you add retries?") is an ask, not a question (acceptance round 4). */
const POLITE_REQUEST = /^(?:please\s+)?(?:can|could|would|will)\s+you\b/i;
/** A real question: it ends in "?" and is not a polite request, or opens with a question word. */
export function isQuestion(text: string): boolean {
  const t = text.trim();
  return (/\?\s*$/.test(t) && !POLITE_REQUEST.test(t)) || /^(?:what'?s?|how|why|where|when|which|who|is|are|was|were|does|did|has|have)\b/i.test(t);
}

/** True when an item opens with an imperative verb, after filler like "please" or "also". */
export function isImperative(item: string): boolean {
  let t = item.trim().replace(/^[*_`"']+/, "");
  for (let i = 0; i < 3 && LEAD_FILLER.test(t); i++) t = t.replace(LEAD_FILLER, "");
  return IMPERATIVES.has((t.match(/^[A-Za-z]+/)?.[0] ?? "").toLowerCase());
}

/** Content words of a text: lowercase, 3+ chars, not stopwords, deduped, compared by 5-char stem. Imperative verbs
 * are kept by default, because an honest reply often names an ask by its verb ("the rename"); `verbs: false` drops
 * them where only the object identifies the thing. */
export function keywords(text: string, opts: { verbs?: boolean } = {}): string[] {
  const words = text.toLowerCase().replace(/[`*_~]/g, "").match(/[a-z0-9][a-z0-9.\-/]*[a-z0-9]/g) ?? [];
  const out: string[] = [];
  for (const w of words) {
    if (w.length < 3 || STOP.has(w) || (opts.verbs === false && IMPERATIVES.has(w))) continue;
    const stem = normalize(w).slice(0, 5);
    if (!out.includes(stem)) out.push(stem);
  }
  return out;
}

/** Strips common English endings so word forms meet: logging/logs, caching/caches, retries/retry. */
function normalize(w: string): string {
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  for (const suf of ["ations", "ation", "ings", "ing", "ers", "er", "ed", "es", "s"]) {
    if (w.endsWith(suf) && w.length - suf.length >= 3) return w.slice(0, -suf.length);
  }
  return w;
}

/** Two stems name the same word when one is a prefix of the other (log/logg, cach/cache). */
export function stemsMeet(a: string, b: string): boolean {
  return a === b || (Math.min(a.length, b.length) >= 3 && (a.startsWith(b) || b.startsWith(a)));
}

/** The text the asks come from: what the principal typed, or the paste when the paste is the whole prompt (dictation). */
export function askSource(prompt: string): string {
  const outside = prompt.replace(/<pasted_content\b[^>]*>[\s\S]*?<\/pasted_content>/gi, " ").trim();
  const base = outside.length >= 20 ? outside : prompt.replace(/<\/?pasted_content\b[^>]*>/gi, " ");
  return base.replace(/```[\s\S]*?```/g, " ").replace(/\[Image(?: #\d+|: [^\]]*)\]/g, " ");
}

const LIST_ITEM = /^\s*(?:\d{1,2}[.)]|[-*•])\s+(.{6,})$/;
const CONSTRAINT = /\b(only|never|don'?t|do\s+not|must(?:\s+not)?|nothing\s+but)\b/i;
/** Clause joins inside one dictated sentence: "fix X and also update Y, then rename Z". */
const CLAUSE_JOIN = /,?\s+(?:and\s+(?:also\s+)?|also\s+|then\s+|plus\s+)|;\s*|,\s+(?=[a-z]+\s)/i;

/** Clauses that ask for an answer, not for work ("look at these and tell me what you think"). A done reply is never
 * checked against them, so they are not pinned from prose; a numbered list of them is still pinned. */
const CONVERSATIONAL = /^(?:(?:please|also|and|then|now|can\s+you|could\s+you)\s+)*(?:look|tell|explain|show|read|summarize|answer|ask|find|research|investigate|review|list|check)\b/i;

/** A line that introduces a list of asks: "do these:", "please:", "the following". */
const REQUEST_CUE = /\b(?:do\s+(?:these|this|all|the\s+following)|please|the\s+following|tasks?|todo|to-?dos|need\s+you\s+to)\b/i;
/** "no other languages", "don't use anything else": the named language is the only one. */
const OTHER_LANGS = /\b(?:no\s+other\s+languages?|(?:don'?t|do\s+not)\s+use\s+anything\s+else|nothing\s+else\s+for\s+the\s+code)\b/i;
const QUALITY = /^(?:(?:please|also|and|then|just)\s+)*(?:make\s+sure|ensure|keep|preserve|maintain)\b/i;
/** A list item that is an error or log line, not an ask. */
const ERROR_LINE = /\b(?:error|warning|exception|failed|failure|traceback|TS\d{4}|E\d{3,4})\b|:\d+:\d+/i;

/** A dictated one-line list ("1. fix x 2. add y 3. rename z") becomes one item per line. */
function unfoldInlineLists(src: string): string {
  return src.split("\n").map((l) => ((l.match(/(?:^|\s)\d{1,2}[.)]\s+\S/g) ?? []).length >= 2 ? l.replace(/\s+(?=\d{1,2}[.)]\s+\S)/g, "\n") : l)).join("\n");
}

/** Every explicit ask: each item of a list of two or more whose items mostly open with an imperative verb, each
 * imperative clause of a prose sentence that chains two or more of them, and each sentence carrying a constraint word. */
export function extractAsks(prompt: string): Ask[] {
  const src = unfoldInlineLists(askSource(prompt));
  const asks: Ask[] = [];
  const push = (kind: Ask["kind"], t: string) => asks.push({ id: `${kind}-${asks.length + 1}`, kind, text: t.slice(0, 200), keywords: keywords(t) });
  const items = src.split("\n").map((l) => l.match(LIST_ITEM)?.[1]?.trim()).filter((x): x is string => !!x);
  const lines = src.split("\n");
  const firstItem = lines.findIndex((l) => LIST_ITEM.test(l));
  const intro = firstItem > 0 ? lines.slice(0, firstItem).filter((l) => l.trim()).at(-1) ?? "" : "";
  const errorLike = items.filter((t) => ERROR_LINE.test(t)).length * 2 > items.length;
  const imperativeShare = items.filter(isImperative).length / Math.max(items.length, 1);
  if (items.length >= 2 && !errorLike && (imperativeShare >= 0.5 || (REQUEST_CUE.test(intro) && !CONVERSATIONAL.test(intro.trim())))) items.forEach((t) => push("item", t));
  // Prose: every imperative clause across the request counts once there are two or more of them, whether they are
  // chained in one sentence or dictated as separate sentences ("Fix the login bug. Update the readme.").
  const prose = lines.filter((l) => !LIST_ITEM.test(l)).join(" ");
  const clauses: string[] = [];
  for (const s of prose.split(/(?<=[.!?])\s+/)) {
    const t = s.trim();
    if (t.length < 8 || isQuestion(t)) continue;
    // A sentence that sets a rule is pinned whole as a constraint, and its other clauses still count as asks:
    // "restyle the buttons, and also fix the tax rounding, oh and don't change the cart logic" (round 6, 2026-10-08).
    const rule = CONSTRAINT.test(t) || !!languageRule(t);
    if (rule) push("constraint", t);
    for (const c of t.replace(/[.!?]+$/, "").split(CLAUSE_JOIN).map((c) => c.trim())) {
      if (c.length < 5 || (rule && CONSTRAINT.test(c))) continue;
      // "make sure it works", "keep the API stable", "ensure five fingers": a bar the work must meet, judged, never a
      // separate deliverable a reply has to name (acceptance round 5, 2026-10-08).
      if (QUALITY.test(c)) push("constraint", c);
      else if (isImperative(c) && !CONVERSATIONAL.test(c)) clauses.push(c);
    }
  }
  // "I want a Java project. No other languages." sets a rule across two sentences.
  const named = Object.keys(LANGS).filter((l) => new RegExp(`\\b${l.replace("#", "\\#")}\\b`, "i").test(src));
  if (OTHER_LANGS.test(src) && named.length === 1 && !asks.some((a) => languageRule(a.text))) push("constraint", `${named[0]} only (${src.match(OTHER_LANGS)![0]})`);
  if (clauses.length >= 2) clauses.forEach((c) => push("item", c));
  return asks;
}

const CONTINUATION = /^\s*(?:\/?(?:y|c|si)|yes|yeah|yep|yup|sure|ok(?:ay)?|continue|proceed|go(?:\s+ahead)?|do\s+it)\b[\s,.!]*/i;
/** A prompt that opens with a go-ahead ("y", "yes please", "ok y", "y and also make it blue") keeps the previous
 * request's open asks; whatever follows the go-ahead adds to them. */
export function continuationRest(prompt: string): string | null {
  let t = askSource(prompt).trim();
  if (!CONTINUATION.test(t)) return null;
  while (CONTINUATION.test(t) && t.length) { const n = t.replace(CONTINUATION, ""); if (n === t) break; t = n; }
  return t.replace(/^(?:please|and(?:\s+also)?|also)\b[\s,]*/i, "").trim();
}
export function isContinuation(prompt: string): boolean {
  const rest = continuationRest(prompt);
  // "yes, do the first one only" narrows the request: the principal changed the scope, so the old asks no longer stand.
  // "ok what's the status of the docs one?" is a new question, not a go-ahead (acceptance round 4, 2026-10-08).
  return rest !== null && rest.split(/\s+/).filter(Boolean).length <= 12 && !isQuestion(rest) && !/\b(?:only|just|skip|instead|except|don'?t|never|not)\b/i.test(rest);
}

const DONE_PROSE = /(?:^|[\s(])(?:all\s+done|(?:it'?s|that'?s|everything'?s|everything\s+is|all\s+(?:three|four|five|of\s+(?:it|them)))\s+(?:done|in|finished|complete)|done\s*[.!—-]|finished\s*[.!]|all\s+set\b)/i;
/** A CHANGE section that reports no change: "none", "no edits made", "read-only analysis; nothing modified". */
const NO_CHANGE_TEXT = /^(?:[-*•\s]*)(?:none|nothing|n\/a|no\s+(?:changes?|edits?|files?)|read[\s-]?only)\b/i;

/** Phrases that only ever mean "some of the work is not finished", or an OPEN section. A reply carrying one is not a
 * done claim, so its pins stay open for the next "y". Any other honest wording ("two done, one remains") reaches the
 * judge veto in VerificationGate instead of growing this list (BLE pass after acceptance round 6, 2026-10-08). */
const NOT_DONE = /\b(?:not\s+(?:yet|done|finished|started)|still\s+working|in\s+progress|haven'?t\s+(?:finished|done|started)|did\s*n[o']t\s+(?:do|get\s+to|finish|start)|could\s*n[o']t|ran\s+out\s+of|out\s+of\s+time|held\s+(?:back|off)|still\s+to\s+do|left\s+for\s+later|needs?\s+your\s+(?:call|decision|input|approval|go-?ahead))\b|❓\s*OPEN:|^\s*(?:open|remaining|not\s+done)\s*:/im;

/** A reply claims done when it reports work (a CHANGE section that is not "none"), or says so in prose in a turn that
 * did work, and it does not say the work is partial. A prose "done" in a turn that changed nothing is a plan or an
 * answer ("Plan is done. Want me to start?"), never a done claim (acceptance round 5, 2026-10-08). */
export function claimsDone(reply: string, _asks: Ask[] = [], opts: { didWork?: boolean } = {}): boolean {
  const change = reply.match(new RegExp(`🔧\\s*CHANGE:([\\s\\S]*?)(?=✅|❓|${closerPattern()}|$)`))?.[1]?.trim();
  const reportsWork = change !== undefined && change.length > 0 && !NO_CHANGE_TEXT.test(change);
  if (!reportsWork && !(DONE_PROSE.test(reply) && opts.didWork !== false)) return false;
  return !NOT_DONE.test(reply);
}

const fieldLabel = (): RegExp => new RegExp(`(?:🔧|✅|❓|🎯|💡|⚠️|🎙️|${closerPattern()})\\s*(?:CHANGE|VERIFY|OPEN|SPOKEN|[A-Z][a-z]+)?\\s*:?|^\\s*(?:CHANGE|VERIFY|OPEN)\\s*:`, "gm");

/** Pinned list items the reply never mentions. Each item is matched on its distinctive stems, the ones no other pinned
 * item shares, so "add retries to the uploader" and "add logging to the uploader" are told apart by retries and logging.
 * One distinctive stem is enough: honest replies name asks briefly ("the rename"). Whether a mentioned ask was really
 * done is the judged check's question. Constraints are judged, not checked here. */
export function unmentionedItems(asks: Ask[], reply: string): Ask[] {
  const items = asks.filter((a) => a.kind === "item" && a.keywords.length > 0);
  // The reply's own field labels ("🔧 CHANGE:", "✅ VERIFY:") are not mentions of a "change" or "verify" ask.
  const replyStems = new Set(keywords(reply.replace(fieldLabel(), " ")));
  return items.filter((a) => {
    // A stem shared with another item, in any word form (caching/cache), does not tell this item apart.
    const others = items.filter((o) => o !== a).flatMap((o) => o.keywords);
    const distinct = a.keywords.filter((k) => !others.some((o) => stemsMeet(k, o)));
    return !(distinct.length ? distinct : a.keywords).some((k) => replyStems.has(k) || [...replyStems].some((r) => stemsMeet(k, r)));
  });
}

const LANGS: Record<string, string[]> = {
  java: [".java"], kotlin: [".kt"], typescript: [".ts", ".tsx"], javascript: [".js", ".jsx", ".mjs"],
  rust: [".rs"], python: [".py"], go: [".go"], swift: [".swift"], ruby: [".rb"], "c#": [".cs"],
};
// Shell is glue, and build or config scripts follow the toolchain, not the language choice: a "Java only" project
// still has build.gradle.kts, a "TypeScript only" tool may ship run.sh.
const SOURCE_EXTS = new Set(Object.values(LANGS).flat().concat([".c", ".cc", ".cpp", ".h", ".php", ".pl"]));
const NOT_LANGUAGE_CHOICE = /\.gradle\.kts$|(?:^|\/)(?:build|settings)\.\w+$|\.(?:config|setup)\.\w+$|\.d\.ts$|\.test\.|\/tests?\/|(?:^|\/)(?:dist|build|out|node_modules|vendor|target)\//;
/** A constraint that names its own exception ("Rust only, but fix convert.py") is not a blanket language rule. */
const EXCEPTION = /\b(?:but|except|apart\s+from|other\s+than|besides|unless)\b|\b[\w.-]+\.(?:py|ts|tsx|js|rs|go|java|rb|kt|swift|cs|php)\b/i;

/** File paths a Bash command writes: redirect, tee, cp/mv destination, sed -i, curl -o, writeFileSync or Bun.write. */
export function bashWrittenPaths(command: string): string[] {
  const out: string[] = [];
  const P = String.raw`['"]?([^\s'"|;&<>()]+\.[A-Za-z]+)['"]?`;
  for (const re of [
    new RegExp(String.raw`(?:>>?|\btee\s+(?:-a\s+)?)\s*${P}`, "g"),
    new RegExp(String.raw`\b(?:cp|mv)\s+(?:-\w+\s+)*\S+\s+${P}`, "g"),
    // sed -i: the edited files are the path-like arguments after the expression, quoted or not.
    new RegExp(String.raw`\bsed\b[^|;&\n]*?\s-i\b[^|;&\n]*?\s${P}(?=\s*(?:$|[|;&\n]))`, "g"),
    new RegExp(String.raw`\bcurl\b[^|;&]*\s-o\s+${P}`, "g"),
    new RegExp(String.raw`(?:writeFileSync|Bun\.write|appendFileSync)\(\s*${P}`, "g"),
    new RegExp(String.raw`\bopen\(\s*${P}\s*,\s*['"][wa]`, "g"),
  ]) for (const m of command.matchAll(re)) out.push(m[1]!);
  return out.filter((p) => !p.startsWith("/dev/"));
}

/** "only": every source file written must be in the language. "never": none may be. "new": the thing being built is in
 * the language ("write the converter in Python"), so a new file in another language breaks it but editing existing
 * glue does not (acceptance round 5, 2026-10-08). */
export type LanguageRule = { lang: string; mode: "only" | "never" | "new" };

/** The language rule a sentence sets: "Java only", "only in Rust", "must be in Java", "write it in Go please" (only), or
 * "never use Python", "don't write any Python", "no Python" (never). Null when the rule is scoped ("TypeScript only for
 * the frontend"), describes a habit ("I only use Python for notebooks"), or names its own exception. */
export function languageRule(text: string): LanguageRule | null {
  const t = text.toLowerCase();
  if (EXCEPTION.test(text) || /\b(?:i|we|they)\s+(?:\w+\s+)?(?:only|never|don'?t|do\s+not|usually|always)\b/.test(t)) return null;
  for (const l of Object.keys(LANGS)) {
    const L = l.replace("#", "\\#");
    const never = t.match(new RegExp(`\\b(?:never|don'?t|do\\s+not|no)\\s+(?:use\\s+|write\\s+|add\\s+|touch\\s+)?(?:any\\s+)?${L}\\b`));
    const only = t.match(new RegExp(`\\bonly\\s+(?:in\\s+|use\\s+)?${L}\\b|\\b${L}[\\s-]+only\\b|\\bmust\\s+be\\s+(?:written\\s+|built\\s+)?(?:in\\s+)?${L}\\b|\\b(?:everything|all(?:\\s+(?:of\\s+)?(?:it|the\\s+code))?|it\\s+all)\\s+(?:must|should|has\\s+to)\\s+be\\s+(?:written\\s+)?(?:in\\s+)?${L}\\b|\\ball\\s+in\\s+${L}\\b|\\bstick\\s+(?:to|with)\\s+${L}\\b|^\\s*in\\s+${L}\\b`));
    const built = t.match(new RegExp(`\\b(?:write|build|implement|port|code|do|rewrite)\\s+(?:[\\w-]+\\s+){0,3}in\\s+${L}\\b|\\buse\\s+${L}\\s+for\\s+(?:this|it|the\\s+\\w+)\\b|\\bmake\\s+it\\s+(?:a|an)\\s+${L}\\b`));
    const m = only ?? never ?? built;
    if (!m) continue;
    const after = t.slice((m.index ?? 0) + m[0].length);
    // "for the frontend" scopes the rule; "for everything", "for all of it", "for this" do not.
    const unscoped = /^\s*for\s+(?:everything|all|this|it)\b/.test(after);
    if (!unscoped && (/^\s*(?:only\s+)?(?:for|on|inside|within)\s+(?:the\s+)?[a-z]/.test(after) || /^\s*in\s+the\s+[a-z]/.test(after))) return null;
    return { lang: l, mode: only || OTHER_LANGS.test(t) ? "only" : never ? "never" : "new" };
  }
  return null;
}

/** A language constraint and the source files written this turn that break it. `createdPaths` are files written whole
 * (Write, a shell write); only those can break a "new" rule. */
export function languageViolations(asks: Ask[], editedPaths: string[], createdPaths: string[] = editedPaths): { ask: Ask; paths: string[] }[] {
  const out: { ask: Ask; paths: string[] }[] = [];
  for (const a of asks) {
    if (a.kind !== "constraint") continue;
    const rule = languageRule(a.text);
    if (!rule) continue;
    const exts = LANGS[rule.lang]!;
    const bad = [...new Set(rule.mode === "new" ? createdPaths : editedPaths)].filter((p) => {
      const ext = extname(p).toLowerCase();
      if (!SOURCE_EXTS.has(ext) || NOT_LANGUAGE_CHOICE.test(p)) return false;
      return rule.mode === "never" ? exts.includes(ext) : !exts.includes(ext);
    });
    if (bad.length) out.push({ ask: a, paths: bad });
  }
  return out;
}

/** A short stable key for one reply. */
export function replyKey(reply: string): string {
  return createHash("sha256").update(reply).digest("hex").slice(0, 16);
}

// ── Pin store ────────────────────────────────────────────────────────────────

export function pinDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.DONECHECK_DIR ?? join(getLifeosDir(), "MEMORY", "STATE", "done-check");
}

/**
 * A session id is a bare token before it becomes a file name (hooks audit aa #3,
 * 2026-10-13). The old replace() kept traversal out but let two ids collide on
 * one file; an id that fails this pins and reads nothing.
 */
export const SESSION_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

export function pinPath(dir: string, session: string): string {
  invariant(SESSION_ID_RE.test(session), "ask-pins: session id must match ^[A-Za-z0-9_-]{1,128}$");
  return join(dir, `${session}.json`);
}

export function readPins(dir: string, session: string): PinFile | null {
  try {
    const p = pinPath(dir, session);
    return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as PinFile) : null;
  } catch { return null; }
}

const PIN_DIR_MODE = 0o700;
const PIN_FILE_MODE = 0o600;

/**
 * Pins hold up to 4000 chars of the principal's prompt, so the store is private:
 * directory 0700, files 0600. Tightens a looser directory and every looser pin
 * file already in it. Idempotent; never reads a pin's content. Returns the
 * paths whose mode it changed.
 */
export function repairPinModes(dir: string): string[] {
  const changed: string[] = [];
  if (!existsSync(dir)) return changed;
  if ((statSync(dir).mode & 0o077) !== 0) { chmodSync(dir, PIN_DIR_MODE); changed.push(dir); }
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".json")) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isFile() && (st.mode & 0o077) !== 0) { chmodSync(p, PIN_FILE_MODE); changed.push(p); }
  }
  return changed;
}

/** Repair once per process: the pin directory holds hundreds of files. */
const repairedDirs = new Set<string>();

export function writePins(dir: string, pins: PinFile): void {
  invariant(typeof pins.session === "string" && pins.session.length > 0, "ask-pins: session required");
  invariant(Array.isArray(pins.asks) && pins.asks.every((a) => a.id && (a.kind === "item" || a.kind === "constraint") && typeof a.text === "string"), "ask-pins: malformed ask");
  const p = pinPath(dir, pins.session);
  if (!existsSync(dirname(p))) mkdirSync(dirname(p), { recursive: true, mode: PIN_DIR_MODE });
  if (!repairedDirs.has(dirname(p))) { repairPinModes(dirname(p)); repairedDirs.add(dirname(p)); }
  const tmp = `${p}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(pins), { mode: PIN_FILE_MODE });
  chmodSync(tmp, PIN_FILE_MODE);
  renameSync(tmp, p);
}
