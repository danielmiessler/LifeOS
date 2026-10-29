/**
 * @version 1.5.0
 * transcript-evidence.ts — ground-truth evidence extraction for VerificationGate.
 *
 * The message is a CLAIM; the transcript is the EVIDENCE. This module parses the
 * current turn's tool_use/tool_result entries from a Claude Code transcript JSONL
 * into an ordered event index, then answers "did the required verification
 * actually run, after the last mutation, and succeed?" — so a message that SAYS
 * "interceptor-verified" but whose transcript shows only a render capture cannot
 * pass, and a terse message that cites nothing but whose transcript shows a real
 * round-trip does.
 *
 * Design: Fable + Forge synthesis (2026-07-08). Fail-OPEN on every ambiguity —
 * this module must never be the reason a Stop is blocked.
 *
 * 1.2.0 (2026-10-15, LOSIntegrity S045/S046): two ambiguities no longer read as
 * evidence. A tool_use with no paired tool_result (an interrupted call, a cut
 * tail) is marked hasResult:false and is never credited as a pass, probe, view
 * or interaction (isAnswered is exported so every crediting consumer asks the same
 * question; spawnedAgent asks it too). An unreadable transcript is unknown, not
 * empty: callers that must fail closed pass { strict: true } and get a
 * TranscriptUnreadableError instead of an empty list that reads as "nothing
 * happened". Strict mode also refuses a current turn holding a line that is not a
 * JSON object, so a fail-closed gate needs no transcript reader of its own.
 *
 * 1.3.0 (2026-10-15, S046 review round 2): strict mode reads back past the 8 MiB
 * tail when the tail holds no turn opener, so a huge tool result can no longer
 * hide the turn's deploy; and "no opener found" is no longer the same answer as
 * "the first entry opens the turn", so corruption before a valid opener does not
 * reject the turn.
 *
 * 1.4.0 (2026-10-15, final review round): a tool_result answers a call only when a user-role entry
 * carries it after the call (an assistant-authored or earlier result block is not an answer); strict
 * mode reads back past the tail in the session window too, and refuses a current-turn tool_use whose
 * name or input is not well formed; MultiEdit is an edit like Edit and Write.
 *
 * 1.5.0: browser evidence owners. An install can register browsers besides Interceptor in
 * LIFEOS/USER/CONFIG/browser-evidence-owners.json (see loadBrowserEvidenceOwners). Their
 * events reuse the interceptor-* kinds and carry `owner`; probedAfterDeploy ignores them
 * unless the entry sets deployProof. No file, no change.
 */

import { readFileSync, existsSync, statSync } from "fs";
import { lifeosPath } from "./paths";

export type EventKind =
  | "edit"              // Edit/MultiEdit/Write/NotebookEdit
  | "deploy"            // wrangler/cf/pages deploy, CfEnv.ts deploy, bun run deploy
  | "probe"             // curl/http/WebFetch to a URL
  | "interceptor-nav"   // interceptor open|navigate|goto
  | "interceptor-interact" // interceptor click|type|fill|act|eval|submit
  | "interceptor-capture"  // interceptor screenshot|capture|scrub
  | "test-run"          // bun test / pytest / go test / vitest / npm test
  | "command"           // any other Bash command (fallback — carries its result/error)
  | "read-image"        // Read of a .png/.webp/.jpg (the model actually views it)
  | "agent-result"      // Agent/Task result text
  | "user-text";        // a user message (for userConfirmed / turn boundary)

export interface TxEvent {
  seq: number;
  command?: string;
  kind: EventKind;
  tool: string;
  /** File path, URL host, or command excerpt — kind-specific. */
  target: string;
  /** Raw text of the paired tool_result (or the user text). */
  resultText: string;
  /** True when the tool_result was an error or the result text signals failure. */
  isError: boolean;
  /** The tool_result's RAW `is_error` flag, with no text heuristic mixed in.
   * Ground truth for "the tool actually failed": a read-only command whose OUTPUT
   * quotes failure words (`rg -n "exit 1"`) sets `isError` but never this.
   * (ported from public PR #1738, @elhoim) */
  isToolError: boolean;
  /** Doc-only edits (.md / MEMORY / ISA) don't count as code mutations. */
  isCode: boolean;
  /** A paired tool_result exists. parseTurnEvents always sets it; a call with no
   * result is not evidence that anything ran, passed or was seen. Absent only on
   * events built by hand, which read as answered. */
  hasResult?: boolean;
  /** Set on browser events from a registered (non-built-in) owner; absent for Interceptor. */
  owner?: { id: string; deployProof: boolean };
}

/**
 * Thrown by parseTurnEvents({ strict: true }) when the current turn cannot be known: the
 * transcript is missing, unreadable or not a regular file, or a line from the turn's opening
 * message onward is not a valid transcript entry (a torn write, a corrupted tool_use).
 */
export class TranscriptUnreadableError extends Error {
  constructor(readonly path: string, readonly reason = "the transcript could not be read") {
    super(`transcript unreadable: ${path}: ${reason}`);
    this.name = "TranscriptUnreadableError";
  }
}

/**
 * The call was answered by a tool_result (or the event was built by hand). Every
 * consumer that CREDITS an event (a pass, a probe, a view, a delegation, an ISA
 * write) asks this; a consumer that counts an OBLIGATION (a deploy, a code edit)
 * does not, since an unanswered mutation may still have run.
 */
export function isAnswered(e: Pick<TxEvent, "hasResult">): boolean {
  return e.hasResult !== false;
}
const answered = isAnswered;

const CAP_BYTES = 8 * 1024 * 1024;

/** A view of the transcript: its text, and whether the first line is a cut-off fragment of a longer file. */
interface TranscriptView { text: string; cut: boolean }

/** The transcript bytes, or null when it is missing, unreadable or not a regular file. */
function readTranscriptBytes(path: string): Buffer | null {
  try {
    if (!existsSync(path) || !statSync(path).isFile()) return null;
    return readFileSync(path);
  } catch {
    return null;
  }
}

/** The whole transcript, or only its tail when huge: recent events are what matter. */
function viewOf(buf: Buffer, whole = false): TranscriptView {
  if (!whole && buf.length > CAP_BYTES) return { text: buf.subarray(buf.length - CAP_BYTES).toString("utf-8"), cut: true };
  return { text: buf.toString("utf-8"), cut: false };
}

function safeRead(path: string): string | null {
  const buf = readTranscriptBytes(path);
  return buf === null ? null : viewOf(buf).text;
}

function eTLD1(host: string): string {
  const parts = host.replace(/^https?:\/\//, "").split("/")[0]!.split(":")[0]!.split(".");
  return parts.length <= 2 ? parts.join(".") : parts.slice(-2).join(".");
}

function extractHost(cmd: string): string {
  const m = cmd.match(/https?:\/\/([^\s"'/]+)/i);
  return m ? eTLD1(m[1]!) : "";
}

// cf CLI (replaced Wrangler 2026-09-29): `cf deploy` bare/bunx/pinned or through CfEnv.ts, plus the
// cf shapes that move production traffic (triggers deploy, deployments create). `pages deploy` is
// already covered for either CLI; `cf builds deploy-hooks` and `deployments list` are reads.
const DEPLOY_RE = /\b(wrangler(@\S+)?\s+(pages\s+)?deploy|bun\s+run\s+deploy|pages\s+deploy)\b|(?:(?<![\w.-])cf(?:@\S+)?|\bCfEnv\.ts)\s+(?:cf\s+)?(?:workers\s+triggers\s+)?deploy\b(?!-)|(?:(?<![\w.-])cf(?:@\S+)?|\bCfEnv\.ts)\s+(?:cf\s+)?workers\s+deployments\s+create\b/i;
// 2026-08-17 (T4 promotion, Max second-look): typecheck/syntax verifiers count as
// test-runs — this stack's own doctrine verifies with `tsc --noEmit`, `bash -n`,
// and `bun build --no-bundle` daily, and T4 blocking without them would punish
// exactly the verified claims it exists to protect.
const TEST_RE = /\b(bun\s+test|pytest|go\s+test|cargo\s+test|vitest|npm\s+(run\s+)?test|jest|deno\s+test|tsc\b|--noEmit|typecheck|bash\s+-n|bun\s+build)\b/i;
const INTERCEPTOR_RE = /\binterceptor\b|Capture\.sh|Interceptor\/Tools/i;
const NAV_RE = /\b(open|navigate|goto)\b/i;
const INTERACT_RE = /\b(click|type|fill|submit|act\b|keys)\b/i; // NOT eval — eval is a read, not an interaction (FN-A)
const CAPTURE_RE = /\b(screenshot|capture|scrub)\b/i;
const PROBE_RE = /\bcurl\b|\bhttpie\b/i; // not bare "http" — dodges `http.server` etc.
const IMG_RE = /\.(png|jpe?g|webp)\b/i;

/**
 * Browser evidence owners beyond the built-in Interceptor. An install registers them in
 * LIFEOS/USER/CONFIG/browser-evidence-owners.json instead of patching this file, e.g.
 *   [{ "id": "gstack", "command": "^(\\S+[/])?browse\\s",
 *      "interact": "\\b(click|fill|type|press|select|hover)\\b" }]
 * `command` is tested against each shell segment (split on && || ; | and newlines; quotes
 * are not parsed), so anchor it with ^. `capture`, `interact` and `nav` optionally replace
 * the default verb patterns. Events keep the existing kinds, so every gate reads them
 * unchanged; only probedAfterDeploy ignores them unless `deployProof` is true, which keeps
 * Interceptor (or a curl probe) as the default proof that a deploy is live.
 * Interceptor matching is untouched. A missing file, or an invalid entry, adds nothing.
 */
export interface BrowserEvidenceOwner {
  id: string;
  command: RegExp;
  capture: RegExp;
  interact: RegExp;
  nav: RegExp;
  deployProof: boolean;
}

export function loadBrowserEvidenceOwners(
  path: string = lifeosPath("USER", "CONFIG", "browser-evidence-owners.json"),
): BrowserEvidenceOwner[] {
  let raw: unknown;
  try {
    if (!existsSync(path)) return [];
    raw = JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const re = (s: unknown, fallback: RegExp) => (typeof s === "string" ? new RegExp(s, "i") : fallback);
  return raw.flatMap((o) => {
    if (!o || typeof o.id !== "string" || !o.id || o.id === "interceptor" || typeof o.command !== "string") return [];
    try {
      return [{
        id: o.id,
        command: new RegExp(o.command, "i"),
        capture: re(o.capture, CAPTURE_RE),
        interact: re(o.interact, INTERACT_RE),
        nav: re(o.nav, NAV_RE),
        deployProof: o.deployProof === true,
      }];
    } catch {
      return []; // invalid regex: skip this entry only
    }
  });
}

let registeredOwners: BrowserEvidenceOwner[] | undefined;

function matchRegisteredOwner(cmd: string): { owner: BrowserEvidenceOwner; segment: string } | null {
  registeredOwners ??= loadBrowserEvidenceOwners();
  if (registeredOwners.length === 0) return null;
  const segments = cmd.split(/&&|\|\||[;|\n]/).map((s) => s.trim()).filter(Boolean);
  for (const owner of registeredOwners) {
    const segment = segments.find((s) => owner.command.test(s));
    if (segment) return { owner, segment };
  }
  return null;
}
// Narrow: an HTTP 4xx/5xx STATUS LINE, or explicit failure words — NOT a bare
// "500" (which matches "500.42 KiB" in normal wrangler output → FP-A) and not
// a bare "error"/"failed" (common in success/deprecation text).
const ERROR_MARKERS = /\bHTTP[/ ]?\d(\.\d)?\s+[45]\d\d\b|\b(internal server error|traceback|connection refused|timed out|command not found|permission denied)\b|"?is_error"?\s*[:=]\s*true|\bexit\s+(code\s+)?[1-9]\d*\b/i;
// A real HTTP success (2xx/3xx) status line or session marker — not a bare
// number like "250 records" (FN-C).
const HTTP_SUCCESS = /\bHTTP[/ ]?\d(\.\d)?\s+[23]\d\d\b|set-cookie|location:\s*\//i;

/** True when result text signals a test actually passed (n>0 pass, 0 fail / exit 0). */
export function testResultPassed(text: string): boolean {
  if (/\b(\d+)\s+fail(ed|ing|ures?)?\b/i.test(text)) {
    const f = text.match(/\b(\d+)\s+fail/i);
    if (f && Number(f[1]) > 0) return false;
  }
  if (/\b0\s+pass\b/i.test(text)) return false;
  return /\b([1-9]\d*)\s+pass\b/i.test(text) || /\bexit(\s+code)?\s+0\b/i.test(text) || /\ball\s+(tests?\s+)?(pass|green)/i.test(text);
}

interface RawEntry { type?: string; role?: string; message?: any; content?: any; toolUseResult?: any; timestamp?: string; }

/**
 * Turn boundary: the LAST user/human message that is not purely a tool_result
 * carrier. One rule, one implementation — parseTurnEvents scopes its event list
 * with it and turnStartMs reads that same entry's clock, so the two can never
 * disagree about where the turn began. -1 when no entry opens a turn; callers that read that as
 * "from the start" say so themselves, so "the first entry opens the turn" (0) and "no opener"
 * can never be confused (review round 2).
 */
function findTurnStartIndex(parsed: { i: number; entry: RawEntry }[]): number {
  for (let k = parsed.length - 1; k >= 0; k--) {
    const e = parsed[k]!.entry;
    const role = e.role ?? e.message?.role ?? e.type;
    if (role === "user" || role === "human") {
      const content = e.message?.content ?? e.content;
      const isToolResultOnly = Array.isArray(content) && content.every((b: any) => b?.type === "tool_result");
      const hasText = typeof content === "string" ? content.trim().length > 0
        : Array.isArray(content) && content.some((b: any) => b?.type === "text" && b.text?.trim());
      if (!isToolResultOnly && hasText) return k;
    }
  }
  return -1;
}

/**
 * Epoch-ms of the current turn's opening user message, or null when the
 * transcript is unreadable or that entry carries no usable timestamp.
 * Lets a gate compare a file's mtime against "did this change during the turn"
 * without caring which tool did the writing (public issue #1871, @lockyer-tech).
 */
export function turnStartMs(transcriptPath: string): number | null {
  const raw = safeRead(transcriptPath);
  if (!raw) return null;
  const parsed: { i: number; entry: RawEntry }[] = [];
  const lines = raw.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line || (!line.includes("tool_use") && !line.includes("tool_result") && !line.includes('"user"') && !line.includes('"human"'))) continue;
    try { parsed.push({ i, entry: JSON.parse(line) as RawEntry }); } catch { continue; }
  }
  if (parsed.length === 0) return null;
  const ts = parsed[Math.max(0, findTurnStartIndex(parsed))]?.entry.timestamp;
  if (!ts) return null;
  const ms = Date.parse(ts);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * True when every role the entry states is user/human (and it states one): the only carrier of a
 * tool_result. The envelope `type` states a role, except the API's neutral `"message"` envelope
 * (`{"type":"message","role":"user",…}`), which names the object kind and leaves the role to `role`
 * (final review round 2: that shape lost a genuine user-role result HEAD accepted). Any other `type`
 * still counts, so a conflicting one keeps the entry from carrying results.
 */
function userCarried(e: RawEntry): boolean {
  const roles = [e.type === "message" ? undefined : e.type, e.role, e.message?.role].filter((r) => r !== undefined && r !== null);
  return roles.length > 0 && roles.every((r) => r === "user" || r === "human");
}

interface Scan {
  parsed: { i: number; entry: RawEntry }[];
  /**
   * tool_use_id -> {text, isError, line} from tool_result blocks. Only user-role entries carry
   * results (final review: an assistant-authored block answered a call); `line` lets the reader
   * require the result to come after its call.
   */
  results: Map<string, { text: string; isError: boolean; line: number }>;
  /** Line indexes that are not a JSON object (strict mode reads every line, not just the prefiltered ones). */
  malformed: number[];
}

/** Every transcript entry in a view, with the tool results by id and (strict) the lines that are not entries. */
function scanLines(read: TranscriptView, strict: boolean): Scan {
  const lines = read.text.split("\n");
  const results = new Map<string, { text: string; isError: boolean; line: number }>();
  const parsed: { i: number; entry: RawEntry }[] = [];
  const malformed: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;
    const relevant = line.includes("tool_use") || line.includes("tool_result") || line.includes('"user"') || line.includes('"human"');
    if (!relevant && !strict) continue;
    let entry: RawEntry;
    try {
      const v: unknown = JSON.parse(line);
      if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("not an object");
      entry = v as RawEntry;
    } catch {
      if (strict && !(i === 0 && read.cut)) malformed.push(i);
      continue;
    }
    if (!relevant) continue;
    parsed.push({ i, entry });
    const content = entry.message?.content ?? entry.content;
    if (Array.isArray(content) && userCarried(entry)) {
      for (const b of content) {
        if (b?.type === "tool_result" && b.tool_use_id) {
          const text = typeof b.content === "string" ? b.content
            : Array.isArray(b.content) ? b.content.map((c: any) => c?.text ?? "").join(" ") : "";
          results.set(b.tool_use_id, { text: String(text).slice(0, 4000), isError: b.is_error === true, line: i });
        }
      }
    }
  }
  return { parsed, results, malformed };
}

/**
 * Parse the CURRENT TURN (everything after the last user/human message) into an
 * ordered event list. Returns [] when the transcript cannot be read and skips a
 * line it cannot parse (the caller fails open), unless `strict` is set: then the
 * turn must be knowable, and a missing, unreadable or non-file transcript, or a
 * line from the current turn's opening message onward that is not a JSON object
 * (a torn write, a corrupted tool_use), throws TranscriptUnreadableError. A gate
 * that must fail closed reads the turn through this one call, never a reader of
 * its own. A malformed line in an earlier turn, or the cut-off first line of a
 * tail read, does not count. An empty but readable file is still []. When the
 * 8 MiB tail holds no turn opener, strict mode reads the whole transcript so the
 * turn is never cut short; the default mode keeps the tail.
 */
export function parseTurnEvents(
  transcriptPath: string,
  opts?: { sessionWindow?: boolean; strict?: boolean },
): TxEvent[] {
  const strict = opts?.strict === true;
  const buf = readTranscriptBytes(transcriptPath);
  if (buf === null) {
    if (strict) throw new TranscriptUnreadableError(String(transcriptPath));
    return [];
  }
  if (buf.length === 0) return [];

  let read = viewOf(buf);
  let { parsed, results, malformed } = scanLines(read, strict);
  // Turn boundary: last user/human message that is NOT purely a tool_result carrier.
  // `sessionWindow` keeps turnStart at 0 so the whole transcript counts as evidence.
  // Needed by VerificationGate's T5: a probe of the public repo three turns ago is
  // real evidence for a publicity claim now, and turn-scoping it would block honest
  // multi-turn work. The 8MB tail cap already bounds the scan.
  if (strict && read.cut && findTurnStartIndex(parsed) < 0) {
    // The tail holds no opener, so the current turn began before it and part of the turn would be
    // lost (review round 2: a deploy followed by an 8 MiB tool result read as []). Strict mode reads
    // the whole transcript back to the opener instead, in the session window too (final review: the
    // window began at the tail and dropped the turn's deploy); the default mode keeps its tail.
    read = viewOf(buf, true);
    ({ parsed, results, malformed } = scanLines(read, strict));
  }
  const opener = opts?.sessionWindow ? -1 : findTurnStartIndex(parsed);
  const turnStart = Math.max(0, opener);
  if (strict && malformed.length) {
    // The turn opens at its user message's line. With no opener anywhere (or the session window),
    // every line counts: the stricter reading. A malformed line before the opener is an earlier
    // turn's and leaves this one knowable.
    const fromLine = opener < 0 ? 0 : parsed[opener]!.i;
    const bad = malformed.find((i) => i >= fromLine);
    if (bad !== undefined) {
      throw new TranscriptUnreadableError(String(transcriptPath), `a line of the current turn is not a valid transcript entry (line ${bad + 1})`);
    }
  }

  const events: TxEvent[] = [];
  let seq = 0;
  for (let k = turnStart; k < parsed.length; k++) {
    const e = parsed[k]!.entry;
    const content = e.message?.content ?? e.content;
    if (!Array.isArray(content)) continue;
    for (const b of content) {
      if (b?.type !== "tool_use") continue;
      if (strict && (typeof b.name !== "string" || !b.input || typeof b.input !== "object" || Array.isArray(b.input))) {
        // A call whose tool or input cannot be read could be any mutation (final review, Sol 17).
        throw new TranscriptUnreadableError(String(transcriptPath), `a tool_use of the current turn is not well formed (line ${parsed[k]!.i + 1})`);
      }
      const name = String(b.name ?? "");
      const input = b.input ?? {};
      const paired = b.id ? results.get(b.id) : undefined;
      // A result answers the call only when it comes after the call (final review).
      const res = paired && paired.line > parsed[k]!.i ? paired : undefined;
      const resultText = res?.text ?? "";
      const isErrorFlag = res?.isError === true || (resultText ? ERROR_MARKERS.test(resultText) : false);
      const push = (kind: EventKind, target: string, isCode = false) =>
        events.push({ seq: seq++, kind, tool: name, target, resultText, isError: isErrorFlag, isToolError: res?.isError === true, isCode, hasResult: res !== undefined, ...(name === "Bash" ? { command: String(input.command ?? "") } : {}) });

      if (name === "Edit" || name === "MultiEdit" || name === "Write" || name === "NotebookEdit") {
        const p = String(input.file_path ?? input.notebook_path ?? "");
        const isCode = !!p && !/\.(md|markdown|txt)$|\/MEMORY\/|\/ISA\.md$|ISA\.md$/i.test(p);
        push("edit", p, isCode);
      } else if (name === "Bash") {
        const cmd = String(input.command ?? "");
        let owned: ReturnType<typeof matchRegisteredOwner>;
        if (DEPLOY_RE.test(cmd)) push("deploy", extractHost(cmd));
        else if (INTERCEPTOR_RE.test(cmd)) {
          // Capture-first: a `screenshot --type full` must read as a capture, not
          // an interaction; a capture saved to `navigate.png` must not read as nav.
          if (CAPTURE_RE.test(cmd)) push("interceptor-capture", extractHost(cmd));
          else if (INTERACT_RE.test(cmd)) push("interceptor-interact", extractHost(cmd));
          else if (NAV_RE.test(cmd)) push("interceptor-nav", extractHost(cmd));
          else push("interceptor-nav", extractHost(cmd));
        } else if ((owned = matchRegisteredOwner(cmd))) {
          const { owner, segment } = owned;
          // Same capture-first order as Interceptor.
          const kind: EventKind = owner.capture.test(segment) ? "interceptor-capture"
            : owner.interact.test(segment) ? "interceptor-interact"
            : "interceptor-nav";
          push(kind, extractHost(segment));
          events[events.length - 1]!.owner = { id: owner.id, deployProof: owner.deployProof };
        } else if (TEST_RE.test(cmd) && !/--dry-run/.test(cmd)) push("test-run", cmd.slice(0, 120));
        else if (PROBE_RE.test(cmd)) push("probe", extractHost(cmd));
        // Fallback: a plain command's failure must still be visible evidence.
        // Kept long because ISAFoldGate matches PROD_MUTATION_RES against this
        // text — at 120 chars a real `cd … && wrangler d1 execute … --remote
        // --command "INSERT …"` was cut before its write verb and read as benign.
        // (ported from public PR #1738, @elhoim)
        else push("command", cmd.slice(0, 2000));
      } else if (name === "WebFetch") {
        push("probe", eTLD1(String(input.url ?? "")));
      } else if (name === "Read") {
        const p = String(input.file_path ?? "");
        if (IMG_RE.test(p)) push("read-image", p);
      } else if (name === "Agent" || name === "Task") {
        push("agent-result", String(input.description ?? name));
      }
    }
  }
  return events;
}

// ── Query API — everything the hook needs, all fail-open (absent ⇒ "no evidence"
// which only ever contributes to a PASS via the act-then-claim precondition). ──

export function lastCodeMutationSeq(ev: TxEvent[]): number {
  let s = -1;
  for (const e of ev) if ((e.kind === "edit" && e.isCode) || e.kind === "deploy") s = Math.max(s, e.seq);
  return s;
}
export function hadDeploy(ev: TxEvent[]): boolean { return ev.some((e) => e.kind === "deploy"); }
export function hadCodeEdit(ev: TxEvent[]): boolean { return ev.some((e) => e.kind === "edit" && e.isCode); }
export function hadFrontendEdit(ev: TxEvent[]): boolean {
  return ev.some((e) => e.kind === "edit" && /\.(tsx|jsx|vue|svelte|css|html|astro|png|svg|webp)$/i.test(e.target));
}
/** An Agent/Task call that came back. An unanswered dispatch delegated nothing (S045). */
export function spawnedAgent(ev: TxEvent[]): boolean { return ev.some((e) => e.kind === "agent-result" && answered(e)); }
/** Edits to auth/flow-adjacent files — lets a terse "verified" claim be typed as
 * a flow claim (T2) from what the session actually TOUCHED, not just its wording. */
export function hadFlowEdit(ev: TxEvent[]): boolean {
  return ev.some((e) => e.kind === "edit" && e.isCode && /(auth|login|oauth|sign[\s-]?in|callback|session|checkout|payment)/i.test(e.target));
}

/** A post-deploy probe (curl 2xx/3xx OR interceptor nav) of the claimed host. */
export function probedAfterDeploy(ev: TxEvent[], host?: string): boolean {
  // Anchor on the deploy's EXISTENCE (its stdout may carry error-ish text); the
  // probe's success is what matters. Use the LAST deploy (Math.max) so a
  // re-deploy after a probe isn't credited by the earlier probe (FN-D).
  const dep = ev.filter((e) => e.kind === "deploy").map((e) => e.seq);
  if (dep.length === 0) return false;
  const after = Math.max(...dep);
  return ev.some(
    (e) => e.seq > after && !e.isError && answered(e) &&
      (e.kind === "probe" || e.kind === "interceptor-nav" || e.kind === "interceptor-capture") &&
      (!e.owner || e.owner.deployProof) &&
      (!host || !e.target || eTLD1(host) === e.target),
  );
}

/**
 * The flow was EXERCISED (not just rendered). Requires, after the last mutation:
 *  (a) an interceptor interaction (click/type/eval/submit) with a nav or capture, OR
 *  (b) a probe/round-trip whose result shows a success marker (2xx/3xx, Set-Cookie,
 *      redirect to an app path) and is NOT an error.
 * A lone capture is a render, never flow evidence — this is the Apple-500 catch.
 */
export function flowExercised(ev: TxEvent[]): boolean {
  const after = lastCodeMutationSeq(ev);
  const post = ev.filter((e) => e.seq > after);
  const interacted = post.some((e) => e.kind === "interceptor-interact" && !e.isError && answered(e));
  const navved = post.some((e) => (e.kind === "interceptor-nav" || e.kind === "interceptor-capture") && !e.isError && answered(e));
  if (interacted && navved) return true;
  // A round-trip needs a real HTTP 2xx/3xx status line or a session marker —
  // not a bare number like "250 records" (FN-C).
  const roundTrip = post.some(
    (e) => (e.kind === "probe" || e.kind === "interceptor-nav") && !e.isError && answered(e) && HTTP_SUCCESS.test(e.resultText),
  );
  return roundTrip;
}

/** A pixel image was captured AND read (viewed) after the last frontend mutation. */
export function pixelViewed(ev: TxEvent[]): boolean {
  const after = lastCodeMutationSeq(ev);
  const captured = ev.some((e) => e.seq > after && e.kind === "interceptor-capture" && !e.isError && answered(e));
  const read = ev.some((e) => e.seq > after && e.kind === "read-image" && answered(e));
  return captured && read;
}

/** A test ran after the last code edit and its result shows a pass. */
// Verifiers whose SUCCESS is silence: a clean `tsc --noEmit`/`bash -n` prints
// nothing and exits 0, so pass-text matching can never see them (2026-08-17,
// found by live probe during the T4 promotion — the block fired on a
// tsc-verified claim). Empty output + no error flag = pass, for these only.
const SILENT_OK_RE = /\btsc\b|--noEmit|typecheck|bash\s+-n\b|bun\s+build\b/i;

export function testPassedAfterEdit(ev: TxEvent[]): boolean {
  const after = lastCodeMutationSeq(ev);
  return ev.some(
    (e) =>
      e.seq > after &&
      e.kind === "test-run" &&
      !e.isError &&
      answered(e) &&
      (testResultPassed(e.resultText) ||
        (SILENT_OK_RE.test(e.target) && !e.isToolError && e.resultText.trim() === "")),
  );
}

/** Evidence lives only inside a spawned agent's result text (pass-but-log). */
/** Scan an agent-result's TEXT for type-scoped evidence markers.
 *
 * DISPOSITION (2026-07-31): exported, zero call sites, deliberately retained.
 * This is the middle path for VerificationGate's sub-agent bypass — today any
 * spawned agent passes a claim unconditionally; wiring this would instead demand
 * the delegate at least REPORT evidence. Not wired yet because agent prose is
 * weaker than tool output (a hallucinating delegate writes "200 OK" having run
 * nothing), so the tighten/leave call waits on the `wouldBlock` counterfactual
 * the bypass now logs. Delete this if that corpus says the hole never bites.
 */
export function evidenceViaAgent(ev: TxEvent[], patt: RegExp): boolean {
  return ev.some((e) => e.kind === "agent-result" && answered(e) && patt.test(e.resultText));
}

/**
 * Media-modality evidence (improvement pass #4, 2026-08-20).
 *
 * A claim about a VIDEO or AUDIO artifact closes on evidence of that artifact,
 * not of its text shadow. The burned instance: a reported framing defect in a
 * clip was answered by verifying the transcript, and the video shipped with the
 * defect. A transcript read, a caption check, or an editor-state read are all
 * the wrong modality for "the video looks right".
 *
 * Two things count: a frame image that was Read (the pixel path T3 already
 * models), or a direct probe of the media file itself (ffprobe/ffmpeg/exiftool,
 * or a media-duration/dimension read).
 */
const MEDIA_PROBE = /\b(ffprobe|ffmpeg\s+-i|exiftool|mediainfo)\b/i;

export function mediaInspected(ev: TxEvent[]): boolean {
  const framed = ev.some((e) => e.kind === "read-image" && !e.isError && answered(e));
  const probed = ev.some((e) => MEDIA_PROBE.test(e.target) && !e.isError && answered(e));
  return framed || probed;
}
