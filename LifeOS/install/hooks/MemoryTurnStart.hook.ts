#!/usr/bin/env bun
/**
 * @version 2.2.3
 * MemoryTurnStart.hook.ts — the ONE UserPromptSubmit memory hook.
 *
 * v2.1.0 (2026-09-03): registered
 * natively on UserPromptSubmit again (the one-evening TurnStart dispatcher is
 * reverted). `run()` returns parts; the shim below assembles them under the
 * harness inline ceiling with lib/memory-delivery.ts — the ~18 KB hot layer had
 * been persisted to a file with a 2 KB preview on every injection since
 * 2026-07-03, so it is now queued per session and delivered in k/N chunks over
 * consecutive turns, ground block first. A soft budget (SOFT_BUDGET_MS) skips
 * retrieval, with a notice, when the earlier steps already ran long. Timing goes
 * to hook-timing.jsonl (lib/hook-timing.ts; `/ic hook-latency` grades it).
 *
 *   hot      — the `<lifeos-memory>` block when the inject gate says this is an
 *              injection turn (queued and chunked by TurnStart), else null
 *   fixed    — the standing-facts / corrections blocks (queued with `hot`)
 *   required — the `<lifeos-memory-delta>` / `<lifeos-memory-health>` lines
 *   ground   — the query-specific `<lifeos-ground>` block, or the skip notice
 *              when the retriever was skipped for budget
 *
 * Sub-modules, each still the owner of its logic and runnable standalone:
 *   1. LoadMemory.run()         — hot-layer + standing facts + corrections
 *   2. MemoryDeltaSurface.run() — <lifeos-memory-health>? + <lifeos-memory-delta>
 *   3. getRelevantContext()     — <lifeos-ground> BM25 retrieval (public issue #1573)
 *
 * Text sessions (Tex ISA F17, 2026-10-09): memory is content, telemetry is not.
 * The bridge puts the hot layer, standing facts and corrections in the text
 * session's system prompt, so here a text gets only its ground block: no hot
 * queue, no delta or health line, no budget notice. Other headless sessions
 * still get nothing.
 *
 * The 0.20 retriever threshold means below-threshold prompts inject NOTHING.
 * Fail-open per sub-module; this module never blocks a prompt.
 */

import { run as loadMemory } from "./LoadMemory.hook";
import { run as deltaSurface } from "./MemoryDeltaSurface.hook";
import { getRelevantContext } from "../LIFEOS/TOOLS/MemoryRetriever";
import { textRequest } from "../LIFEOS/TOOLS/DeliveredContext";
import { clearLedger as clearSystemDelta } from "./SystemChangeSurface.hook";
import { doctrineDir, isDoctrineAsk, markAsked } from "../LIFEOS/TOOLS/DoctrineMark";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { invariant } from "../LIFEOS/TOOLS/Invariant";
import { createHash } from "node:crypto";
import { resolve as pathResolve } from "node:path";
import { isSubagentContext as isSubagent } from './lib/subagent';
import { getClaudeDir } from "./lib/paths"; // public issue #1665 @rogdex24, #1584 @ramazanpolat — aliased resolve sites missed by the 09-03 sweep
import { readStdinJson } from "./lib/hook-stdin";
import { HookTimer } from "./lib/hook-timing";
import { EMPTY_STATE, type DeliveryState, enqueue, planEmission, acknowledgeDelivery } from "./lib/memory-delivery";
import { hookDrawn, hookCovers, extractSurfaceLines, writeSurfaceLines } from "./lib/function-hooks";
import { writeEmission } from "./lib/emission-receipt";
import { unlinkSync } from "node:fs";

/**
 * The prompt waits at most this long on memory (2026-10-16 native-unblock ISC-18; was 4000). Past it before
 * retrieval starts, retrieval is skipped with a notice; otherwise retrieval runs in a worker and the hook waits
 * until the budget is spent (never less than RETRIEVAL_MIN_WAIT_MS), then injects what is ready.
 */
export const SOFT_BUDGET_MS = 300;
export const RETRIEVAL_MIN_WAIT_MS = 100;
const SKIP_NOTICE = `<lifeos-ground>\n(retrieval skipped this turn: the prompt hooks were already past their time budget — the machine is loaded; \`bun LIFEOS/TOOLS/MemoryRetriever.ts "<query>"\` runs it on demand)\n</lifeos-ground>\n`;

// Headless spawns never receive telemetry notes — on 2026-09-04 a model-drift warning and a memory-freshness
// line were relayed into an iMessage reply. A text session still gets memory CONTENT (Tex ISA F17); every
// other headless session gets nothing. Read at call time so a test can set the channel.
export const HEADLESS = !!(process.env.LIFEOS_TEXTING_SESSION || process.env.LIFEOS_NOTIFICATION_CHANNEL === "headless");
const textingSession = () => !!process.env.LIFEOS_TEXTING_SESSION;
const otherHeadless = () => !textingSession() && process.env.LIFEOS_NOTIFICATION_CHANNEL === "headless";
if (import.meta.main && otherHeadless()) process.exit(0);

// ── Hot-layer injection gate (2026-07-11, context-window cleanup #1) ─────────
// The <lifeos-memory> block is ~1.5K tokens; injecting it EVERY prompt duplicated
// it dozens of times per session. Policy: inject on a session's FIRST prompt,
// whenever a rendered block CHANGES. SessionStart (including Claude compact)
// and Codex PostCompact reset receipts for restoration on the next prompt.
// Corrections have their own receipt and do not depend on hot-memory edits. The 🧠 delta line and
// the cadence tick remain every-turn: the visible contract is unchanged.
const CLAUDE_ROOT = getClaudeDir();
export const STATE_DIR = pathResolve(CLAUDE_ROOT, "LIFEOS/MEMORY/STATE/memory-inject");

export function sessionStatePath(sessionId: string): string {
  return pathResolve(STATE_DIR, `${sessionId.replace(/[^A-Za-z0-9._-]/g, "_")}.json`);
}

const blockHash = (block: string) => createHash("sha256").update(block).digest("hex");
export function changedMemoryBlocks(previous: string[], current: string[]): string[] {
  return current.filter(block => !previous.includes(blockHash(block)));
}

function changedBlocks(sessionId: string, current: string[]): string[] {
  const statePath = sessionStatePath(sessionId);
  let previous: string[] = [];
  try {
    const saved = JSON.parse(readFileSync(statePath, "utf8"));
    if (Array.isArray(saved.hashes) && saved.hashes.every((b: unknown) => typeof b === "string")) previous = saved.hashes;
  } catch { /* absent/legacy state replays the full context */ }
  const changed = changedMemoryBlocks(previous, current);
  if (changed.length === 0) return [];
  invariant(current.every(block => typeof block === "string"), "Memory receipts contain text blocks");
  try {
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(statePath, JSON.stringify({ hashes: current.map(blockHash) }), { mode: 0o600 });
  } catch { /* best-effort — on state failure we fall back to injecting */ }
  return changed;
}

export interface MemoryTurnOutput {
  /** The `<lifeos-memory>` block on an injection turn, else null. */
  hot: string | null;
  /** Standing-facts / corrections blocks (only present on an injection turn). */
  fixed: string[];
  /** Every-turn lines: memory health, memory delta. */
  required: string[];
  /** Query-scoped ground block, the budget-skip notice, or null. */
  ground: string | null;
  /** Set when retrieval was deferred to the caller (compose runs it under the budget). */
  groundQuery?: string;
}

export interface MemoryTurnOptions {
  /** Evaluated right before retrieval (Max MEDIUM-4: a boolean computed earlier never saw this module's own time). True → skip, notice instead. */
  skipRetrieval?: boolean | (() => boolean);
  /** Retrieval seam for tests; defaults to the BM25 retriever. */
  retrieve?: (prompt: string) => { markdownBlock: string };
  /** Leave retrieval to the caller: `groundQuery` carries the prompt (terminal sessions; a text keeps it inline). */
  deferRetrieval?: boolean;
}

const MEMORY_BLOCK_RE = /<lifeos-memory>[\s\S]*?<\/lifeos-memory>\n?/;

/** Split LoadMemory's single string into the hot block and its trailing fixed blocks. */
export function splitLoadMemory(out: string): { hot: string | null; fixed: string[] } {
  const m = MEMORY_BLOCK_RE.exec(out);
  if (!m) return { hot: null, fixed: [...out.matchAll(/<(lifeos-[a-z-]+)>[\s\S]*?<\/\1>\n?/g)].map(x => x[0]) };
  const rest = (out.slice(0, m.index) + out.slice(m.index + m[0].length)).trim();
  const fixed = rest ? [...rest.matchAll(/<(lifeos-[a-z-]+)>[\s\S]*?<\/\1>\n?/g)].map((x) => x[0]) : [];
  return { hot: m[0], fixed };
}

export function run(input: Record<string, unknown> | null, opts: MemoryTurnOptions = {}): MemoryTurnOutput {
  const empty: MemoryTurnOutput = { hot: null, fixed: [], required: [], ground: null };
  if (otherHeadless()) return empty;
  const texting = textingSession();
  // The skip lives here, after stdin, because a fork is only distinguishable by
  // the agent stamp on the payload — its env is its parent's (see lib/subagent.ts).
  // public PR #1958, @theNetworkChuck
  if (isSubagent(input)) return empty;

  const j = input ?? {};
  const sessionId = (typeof j.session_id === "string" && j.session_id) || "unknown";
  const raw = typeof j.prompt === "string" ? j.prompt : "";
  // A text's prompt carries the thread view or the delivered history before the request; retrieval searches the
  // request only, through the one shared reader (Tex ISA F19, ISC-233/234). An unframed prompt is returned whole.
  const prompt = textRequest(raw);

  // Turn boundary for the ⚙️ SYSTEM surface. It lives here because this is the
  // ONE UserPromptSubmit composer's memory leg, so it needs no new settings.json
  // entry — and a fresh registration is the fragile part (see MemoryDeltaSurface's
  // header: one was clobbered by a concurrent write and sat dead five days).
  // Per-session by construction; a concurrent session's turn must not clear this one's.
  if (!texting) try { clearSystemDelta(sessionId); } catch {}
  // "From now on X" is a doctrine change (principal directive, 2026-10-25): open the statusline's doctrine mark for this turn
  // (ISA 20261025-doctrine-mark). Same boundary, same reason it lives here.
  if (!texting) try { if (isDoctrineAsk(prompt)) markAsked(doctrineDir(pathResolve(getClaudeDir(), "LIFEOS")), sessionId); } catch {}

  const out: MemoryTurnOutput = { hot: null, fixed: [], required: [], ground: null };

  if (!texting) try {
      const memory = loadMemory();
      if (memory) {
        const blocks = [...memory.matchAll(/<(lifeos-[a-z-]+)>[\s\S]*?<\/\1>\n?/g)].map(m => m[0]);
        const split = splitLoadMemory(changedBlocks(sessionId, blocks).join("\n"));
        out.hot = split.hot;
        out.fixed = split.fixed;
      }
  } catch (e) {
      process.stderr.write(`MemoryTurnStart load error: ${(e as Error)?.message || String(e)}\n`);
  }
  if (!texting) try {
    const delta = deltaSurface();
    if (delta) out.required.push(delta);
  } catch (e) {
    process.stderr.write(`MemoryTurnStart delta error: ${(e as Error)?.message || String(e)}\n`);
  }

  // Task-scoped retrieval (public issue #1573, @christauff) — CLI parity with
  // the remote-channel ln() path. Empty markdownBlock (below threshold, empty
  // corpus, or trivial prompt) injects nothing.
  if (prompt.trim().length > 0) {
    const skip = typeof opts.skipRetrieval === "function" ? opts.skipRetrieval() : !!opts.skipRetrieval;
    if (skip) {
      if (!texting) out.ground = SKIP_NOTICE;
    } else if (opts.deferRetrieval && !texting) {
      out.groundQuery = prompt;
    } else {
      try {
        // allowStaleIndex: the prompt never waits on a freshness walk or a rebuild; the async
        // Stop hook MemoryIndexRefresh refreshes the index after the turn.
        const ground = opts.retrieve ? opts.retrieve(prompt) : getRelevantContext(prompt, { topK: 5, threshold: 0.20, allowStaleIndex: true });
        if (ground.markdownBlock) out.ground = `<lifeos-ground>\n${ground.markdownBlock}\n</lifeos-ground>\n`;
      } catch (e) {
        process.stderr.write(`MemoryTurnStart ground error: ${(e as Error)?.message || String(e)}\n`);
      }
    }
  }
  return out;
}

// ── Delivery queue (per session): the hot layer + standing blocks drain in chunks ──
function queuePath(sessionId: string): string {
  return sessionStatePath(sessionId).replace(/\.json$/, ".queue.json");
}
export function readQueue(sessionId: string): DeliveryState {
  try {
    const p = queuePath(sessionId);
    if (!existsSync(p)) return { ...EMPTY_STATE };
    const q = JSON.parse(readFileSync(p, "utf8")) as DeliveryState;
    return Array.isArray(q.pending) ? q : { ...EMPTY_STATE };
  } catch { return { ...EMPTY_STATE }; }
}
export function writeQueue(sessionId: string, state: DeliveryState): void {
  invariant(state.pending.every(part => typeof part === "string"), "Memory queue contains text");
  try {
    const p = queuePath(sessionId);
    if (state.pending.length === 0) { if (existsSync(p)) unlinkSync(p); return; }
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(p, JSON.stringify(state), "utf8");
  } catch {
    // A failed delivery write must not leave a receipt claiming it was queued.
    try { unlinkSync(sessionStatePath(sessionId)); } catch { /* storage unavailable */ }
  }
}

/**
 * Acknowledge that memory chunks emitted with a given emissionId were successfully
 * delivered to an accepted turn. This marks those chunks as consumed and removes them
 * from the pending queue. Idempotent: duplicate acknowledgments are no-ops.
 *
 * ISC-14: Called from the acceptance boundary (after the plugin's next() returns)
 * to ensure chunks are only marked consumed when delivery is verified.
 */
export function acknowledgeEmission(sessionId: string, emissionId: string): void {
  const queue = readQueue(sessionId);
  if (!emissionId || !queue.emissionId) return; // Nothing to acknowledge
  const updated = acknowledgeDelivery(queue, emissionId);
  writeQueue(sessionId, updated);
}

/** `transcriptPath`: read by the worker only when the opt-in embedding leg is on (#2207). */
export type AsyncRetrieve = (prompt: string, waitMs: number, transcriptPath?: string) => Promise<{ markdownBlock: string } | null>;

/** The retriever in a worker; resolves null and terminates the worker once `waitMs` passes. */
export const retrieveInWorker: AsyncRetrieve = (prompt, waitMs, transcriptPath) => new Promise((resolve) => {
  // An absolute deadline, set before the worker boots: the embedding leg (opt-in, #2207) gives its query
  // embed only what is left, keeping room to post the reply back.
  const deadline = Date.now() + waitMs - 25;
  let w: Worker;
  try { w = new Worker(new URL("./lib/retrieval-worker.ts", import.meta.url).href); }
  catch (e) { process.stderr.write(`MemoryTurnStart ground error: worker did not start (${(e as Error)?.message ?? e})\n`); resolve({ markdownBlock: "" }); return; }
  let settled = false;
  const done = (v: { markdownBlock: string } | null) => {
    if (settled) return; settled = true;
    clearTimeout(t);
    try { w.terminate(); } catch { /* already gone */ }
    resolve(v);
  };
  const t = setTimeout(() => done(null), waitMs);
  // A retriever error injects nothing (an empty block), so only a real timeout reads as "skipped for budget".
  const failed = (why: string) => { process.stderr.write(`MemoryTurnStart ground error: ${why}\n`); done({ markdownBlock: "" }); };
  w.onmessage = (e: MessageEvent) => typeof e.data?.markdownBlock === "string" ? done({ markdownBlock: e.data.markdownBlock }) : failed(String(e.data?.error ?? "no block"));
  w.onerror = (e: ErrorEvent) => failed(e?.message || "worker error");
  w.postMessage({ query: prompt, deadline, transcriptPath });
});

/** One turn's stdout under the ceiling. Exported for tests. */
export async function compose(input: Record<string, unknown> | null, opts: { elapsed?: () => number; retrieve?: AsyncRetrieve } = {}): Promise<{ stdout: string; emissionId: string; timer: HookTimer }> {
  const timer = new HookTimer("UserPromptSubmit", input as never);
  const sessionId = (typeof input?.session_id === "string" && input.session_id) || "unknown";
  const elapsed = opts.elapsed ?? (() => timer.elapsed());
  const mem = await timer.timed("MemoryTurnStart", async () => {
    const m = run(input, { skipRetrieval: () => elapsed() > SOFT_BUDGET_MS, deferRetrieval: true });
    if (m.groundQuery) {
      // Retrieval never holds the prompt past the budget: whatever is ready by then is injected (ISC-18).
      const waitMs = Math.max(RETRIEVAL_MIN_WAIT_MS, SOFT_BUDGET_MS - elapsed());
      const late = new Promise<null>((r) => setTimeout(() => r(null), waitMs));
      let g: { markdownBlock: string } | null = null;
      const transcriptPath = typeof input?.transcript_path === "string" ? input.transcript_path : undefined;
      try { g = await Promise.race([(opts.retrieve ?? retrieveInWorker)(m.groundQuery, waitMs, transcriptPath), late]); }
      catch (e) { process.stderr.write(`MemoryTurnStart ground error: ${(e as Error)?.message ?? e}\n`); g = { markdownBlock: "" }; }
      if (g === null) m.ground = SKIP_NOTICE;
      else if (g.markdownBlock) m.ground = `<lifeos-ground>\n${g.markdownBlock}\n</lifeos-ground>\n`;
      delete m.groundQuery;
    }
    return m;
  });
  if (!mem) return { stdout: "", emissionId: "", timer };
  // Function-hook era (2026-09-05): when the LifeOSHooks plugin stamped this
  // session, IT draws the 🧠 / 🩺 lines beneath the answer, so the lines are
  // handed to it through a per-session file and never asked of the model. No
  // stamp → the echo blocks go out exactly as before (the fallback path).
  if (hookDrawn(sessionId)) {
    writeSurfaceLines(sessionId, extractSurfaceLines(mem.required));
    mem.required = [];
  }
  let queue = readQueue(sessionId);
  if (mem.hot || mem.fixed.length) {
    // Preserve unfinished delivery. A newer replacement follows the older
    // snapshot, so the last complete block remains authoritative.
    const added = enqueue([...(mem.hot ? [mem.hot] : []), ...mem.fixed]);
    // ISC-14: Reset sent when new blocks arrive (indicates fresh emission context).
    // This prevents stale sent counts from persisting across turn boundaries.
    queue = { pending: [...queue.pending, ...added.pending], total: queue.total + added.total, sent: 0, emissionId: "" };
  }
  const plan = planEmission(mem.required, queue, mem.ground ? [mem.ground] : []);
  writeQueue(sessionId, plan.state);
  return { stdout: plan.stdout, emissionId: plan.emissionId, timer };
}

if (import.meta.main) {
  const input = await readStdinJson(1500);
  // Armed session (2026-09-05): the LifeOSHooks plugin runs compose() through
  // HookBridge prompt-context; a second run here would inject the block twice.
  if (hookCovers(typeof input?.session_id === "string" ? input.session_id : "", "prompt-context")) process.exit(0);
  try {
    const { stdout, emissionId, timer } = await compose(input);
    if (stdout) process.stdout.write(stdout);
    if (emissionId) {
      const sessionId = (typeof input?.session_id === "string" && input.session_id) || "unknown";
      writeEmission(sessionId, CLAUDE_ROOT, { emissionId, createdAt: new Date().toISOString() });
    }
    timer.flush();
  } catch (e) {
    process.stderr.write(`MemoryTurnStart error: ${(e as Error)?.message || String(e)}\n`);
  }
  process.exit(0);
}
