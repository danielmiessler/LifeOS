#!/usr/bin/env bun
/**
 * @version 3.2.2
 * TRIGGER: UserPromptSubmit (routing match, always-on) — also runs on PostToolUse via PostToolObserver and on PostToolUseFailure.
 * AlgorithmNudge — the Algorithm live nudge layer ("Events ask the rest").
 *
 * ROWS (what each one is for):
 *   depth-directive   — a plain-language depth directive in a NO-RUN turn signals the turn
 *                       IS a run; doctrine claims 10/15 only have teeth once one exists.
 *   design-class      — authority/security-boundary or architecture work points at
 *                       OPERATIONAL_RULES § Model selection: design the thing NATIVELY and
 *                       inline BEFORE building, on the top rung the main loop already runs
 *                       (settings.json pins it). Never ask which rung, never hand the design
 *                       leg to the Max agent — that is a second look, not a rung rental.
 *   exec-delegation   — a sustained stretch of build calls (Edit/Write) with zero Agent
 *                       dispatches asks the down-rung question from OPERATIONAL_RULES
 *                       § Model selection: is this stretch judgment work that earns MAX,
 *                       or an execution leg that should ride a dispatch a rung down?
 *   inherited-dispatch — an Agent dispatch carrying no `model` field inherits the MAX
 *                       session rung; one line surfaces that fact so inheriting is a
 *                       decision, not the silent default. Evidence for both rows:
 *                       subagent-events.jsonl, 10K events, zero explicit models ever
 *                       (measured 2026-08-01) — prose alone did not produce a single
 *                       rung-down in the system's life.
 *   capability        — a Bash failure exercising a Doctor-tracked capability that
 *                       capabilities.json marks broken emits its compile-time CAP_FIX
 *                       command (60-min per-capability cooldown; the manifest is state
 *                       only, never a prose source).
 *
 * Every row is an ADVISORY QUESTION. A Stop-blocking variant was adversarially killed for
 * good reason: it Goodharts into token dispatches, because it gates on procedure instead of
 * outcome. Keep rows advisory.
 *
 * TWO SCOPES:
 *   ALWAYS-ON  (any session)          → skill-routing + depth-directive
 *                                       (UserPromptSubmit),
 *                                       late-ISA (PostToolUse, no registered run),
 *                                       capability row (PostToolUseFailure)
 *   RUN-SCOPED (live Algorithm run)   → stale-isa
 *
 * Fires the right one-line question at the moment it's answerable. Deterministic,
 * zero inference calls, always exits 0, hot path target <20ms.
 *
 * A row may only fire for state the model cannot observe from its own context — an
 * unwritten ISA, a stale one, a destructive op's blast radius, a capability the manifest
 * knows is broken. Asking the model to notice something already in front of it (probe-fail,
 * agent-return, claim-close, spend) is scaffolding and does not earn a row.
 *
 * Events (dispatched by hook_event_name):
 *   UserPromptSubmit          → routing match (always-on) + depth + design-class
 *   PostToolUse               → stale-ISA | late-ISA
 *                               (reaches here via PostToolObserver's import of run())
 *   PostToolUseFailure        → capability row
 *
 * State: MEMORY/STATE/isa-nudge/{session_id}.json
 *   { toolCallsSinceISAEdit, toolCallsTotal, lateISAFired, lastNudgeAt: {type: epochMs},
 *     primaryTranscript }
 *
 * Skill index: MEMORY/STATE/skill-usewhen-index.json — trigger phrases parsed from
 * every skills/*\/SKILL.md frontmatter USE WHEN clause. NEVER scanned synchronously
 * on the hot path: a stale/missing index triggers a DETACHED rebuild
 * (`bun AlgorithmNudge.hook.ts --rebuild-index`) and this turn proceeds without it.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, appendFileSync } from 'fs';
import { join } from 'path';
import { resolveBun } from './lib/resolve-bin';
import { deriveAscent, type AscentState } from '../LIFEOS/TOOLS/ascent';
import { PULSE_PORT } from '../LIFEOS/PULSE/endpoint';
import { homedir } from "node:os";

const PAI = join(homedir(), '.claude');
// Overridable so tests can PRODUCE a state-machine edge instead of hand-writing
// its precondition, and so test runs stop appending to the production diagnostic
// log (Forge delta audit H-B, M-E — the log was 7 lines, all of them test noise).
const WORK_JSON = process.env.LIFEOS_WORK_JSON
  || join(PAI, 'LIFEOS', 'MEMORY', 'STATE', 'work.json');
const SELFHEAL_LOG = process.env.LIFEOS_SELFHEAL_LOG
  || join(PAI, 'LIFEOS', 'MEMORY', 'OBSERVABILITY', 'hook-selfheal.jsonl');
const STATE_DIR = join(PAI, 'LIFEOS', 'MEMORY', 'STATE', 'isa-nudge');
const SKILLS_DIR = join(PAI, 'skills');
const INDEX_PATH = join(PAI, 'LIFEOS', 'MEMORY', 'STATE', 'skill-usewhen-index.json');

const STALE_ISA_THRESHOLD = 15;            // tool calls with zero ISA edits (run-scoped)
const LATE_ISA_THRESHOLD = 25;             // tool calls with NO registered run (always-on, once)
const COOLDOWN_MS = 5 * 60 * 1000;         // default per-nudge-type
const ROUTE_COOLDOWN_MS = 60 * 60 * 1000;  // per-skill routing cooldown
const INDEX_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const ROUTING_LOG_CAP_BYTES = 512_000;     // telemetry stops appending past this (Forge audit)
const ROUTE_MAX_MATCHES = 6;               // more matches than this = generic prompt = noise
const ISA_PATH_RE = /(?:^|\/)(?:ISA\.md|bunker\.isa\.md)$/i;
/** Exported for the L-A coverage gap: a break here makes stale-isa fire forever. */
export const ISA_PATH_RE_FOR_TEST = ISA_PATH_RE;
/**
 * A run is LIVE when its derived ascent state is on the wall. Resolved through
 * `deriveAscent` — never a hand-listed phase set (doctrine v8.17.2 § Telemetry:
 * "Never hand-list phase names anywhere").
 *
 * The hand-listed version here held the RETIRED 8-station vocabulary
 * (observe/think/plan/build/execute/verify) while live ISAs wrote
 * marking/climbing/learn/complete, so no run resolved as active and every
 * run-scoped row went silent: last `stale-isa` fire 2026-07-23, and
 * `toolCallsSinceISAEditAbs` sat at 0 across all 392 recorded sessions
 * (measured 2026-07-30). Same class as the isa-utils fix of 2026-07-27, which
 * this file missed.
 */
const IN_FLIGHT: ReadonlySet<AscentState> = new Set<AscentState>(['marking', 'ascending', 'anchoring']);
const CAPABILITIES_PATH = process.env.LIFEOS_CAPABILITIES_PATH
  || join(PAI, 'LIFEOS', 'MEMORY', 'STATE', 'capabilities.json');
const CAP_COOLDOWN_MS = 60 * 60 * 1000;    // per-capability; moment-of-need, never nagging
const SILENCE_TRACE_THRESHOLD = 100;       // delegate events with zero primary before tracing

// Destructive-infra ops (Algorithm claim 16, v8.7.0 — deleting workers deleted the apex
// DNS record their custom domain owned; every warm-cache probe passed while the world
// went NXDOMAIN).
// Matches Bash commands that delete cloud infra resources; fires the
// ownership-enumeration + authority-re-list + baseline-parity question.
export const DESTRUCTIVE_INFRA_RE = new RegExp([
  /\bwrangler(?:@[\w.^~-]+)?\s+(?:[\w:-]+\s+)*delete\b/.source,            // wrangler delete, r2 bucket delete, d1 delete, kv namespace delete, pages project delete
  /\bcf\s+(?:zones|dns\s+records|registrar)\s+[\w-]*delete[\w-]*\b/.source, // cf CLI destructive subcommands
  /-X\s*DELETE\b[^|;&\n]*(?:workers\/(?:scripts|domains|services)|dns_records|custom_domains?|r2\/buckets|d1\/database|pages\/projects|zones\/)/i.source, // raw CF API deletes
].join('|'), 'i');
const DESTRUCTIVE_INFRA_NUDGE = 'A destructive infra op just ran (claim 16). Three questions before anything closes on it: (1) what did that resource OWN per the provider\'s authority API — DNS records, routes, domains, bindings? A dependent record "already existing" is not evidence it survives the delete. (2) Re-list from the authority post-op — a probe through a warm cache is not the authority. (3) Does the flow that resource served still run at its measured baseline? One synthetic event is not parity.';

// Doctor-manifest capabilities → the command shapes that exercise them.
// Fed by LIFEOS/TOOLS/Doctor.ts (v2 design, #1461): broken fires once with the
// fix command, declined and live are ALWAYS silent, absent manifest is silent.
const CAP_COMMAND_RES: Array<{ id: string; re: RegExp }> = [
  { id: 'codex', re: /\bcodex\b/ },
  { id: 'cloudflare', re: /\bwrangler\b/ },
  // Both hostnames: source now builds this URL from PULSE_BASE (127.0.0.1),
  // but hand-typed curls and older scripts still say localhost.
  // public issue #1618, @asdf8675309
  { id: 'voice', re: new RegExp(`(?:localhost|127\\.0\\.0\\.1):${PULSE_PORT}\\/notify`) }, // port from endpoint.ts resolver (#2392)
  { id: 'interceptor', re: /\binterceptor\b/ },
];

interface HookInput {
  session_id?: string;
  hook_event_name?: string;
  /** Present ONLY on a delegate's tool events — the discriminator (2026-07-30). */
  agent_id?: string;
  agent_type?: string;
  prompt?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  transcript_path?: string;
}

interface NudgeState {
  toolCallsSinceISAEdit: number;
  /** True calls-since-last-ISA-edit. Unlike toolCallsSinceISAEdit (which
   *  self-resets when the stale-isa nudge fires, so it can't re-nag), this
   *  resets ONLY on a genuine ISA edit. Read by ISACloseGate (Stop) to judge
   *  whether a completed piece of work left the ISA stale. */
  toolCallsSinceISAEditAbs: number;
  toolCallsTotal: number;
  lateISAFired: boolean;
  /** True while an OPEN run is bound to this session. The open→closed edge
   *  restarts the untracked-work clock (Forge audit H1). */
  runWasOpen?: boolean;
  /** Delegate-vs-primary event tallies. A session that only ever sees delegate
   *  events is one whose top-level loop is itself an SDK agent — every tool-event
   *  row is silent for it, and silence is the one failure this system never
   *  notices, so it gets a trace (Forge audit M1). */
  delegateEvents?: number;
  primaryEvents?: number;
  silenceLogged?: boolean;
  /** Consecutive build-tool calls (Edit/Write) since the last Agent dispatch.
   *  Feeds exec-delegation: the one aggregate the model can't see from inside
   *  the stretch — how long it has been executing inline on the top rung. */
  buildCallsSinceDispatch?: number;
  /** Consecutive tool calls of ANY non-dispatch kind since the last Agent
   *  dispatch. Feeds sweep-delegation: catches the token-heavy Bash/Read/Grep
   *  stretch the build counter is blind to (2026-08-02 audit: a whole
   *  release-notes session ran 100% inline on MAX and never tripped a row). */
  workCallsSinceDispatch?: number;
  lastNudgeAt: Record<string, number>;
  /** The primary conversation's transcript_path, recorded at UserPromptSubmit —
   *  the one event that never fires for subagents. Tool events whose
   *  transcript_path differs are subagent activity: stay silent (Forge audit
   *  2026-07-11: nudges were leaking into delegation fan-outs). */
  primaryTranscript?: string;
}

interface ActiveSession {
  slug: string;
  phase: string;
  /** Derived run state — the same value the tab, status line and board show. */
  ascent: AscentState;
}

interface SkillIndex {
  builtAt: number;
  entries: Array<{ skill: string; phrases: string[] }>;
}

function readJson<T>(path: string, fallback: T): T {
  try {
    if (!existsSync(path)) return fallback;
    return JSON.parse(readFileSync(path, 'utf-8')) as T;
  } catch { return fallback; }
}

/** session_id must be a plain token — anything else (traversal, separators)
 *  is refused outright (Forge audit 2026-07-11, finding 3). */
const SESSION_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

function loadState(sessionId: string): NudgeState {
  const s = readJson<Partial<NudgeState>>(join(STATE_DIR, `${sessionId}.json`), {});
  return {
    toolCallsSinceISAEdit: s.toolCallsSinceISAEdit ?? (s as any).toolCallsSinceIsaEdit ?? 0,
    toolCallsSinceISAEditAbs: s.toolCallsSinceISAEditAbs ?? (s as any).toolCallsSinceIsaEditAbs ?? 0,
    toolCallsTotal: s.toolCallsTotal ?? 0,
    lateISAFired: s.lateISAFired ?? (s as any).lateIsaFired ?? false,
    runWasOpen: s.runWasOpen ?? false,
    delegateEvents: s.delegateEvents ?? 0,
    primaryEvents: s.primaryEvents ?? 0,
    silenceLogged: s.silenceLogged ?? false,
    buildCallsSinceDispatch: s.buildCallsSinceDispatch ?? 0,
    workCallsSinceDispatch: s.workCallsSinceDispatch ?? 0,
    lastNudgeAt: s.lastNudgeAt ?? {},
    primaryTranscript: s.primaryTranscript,
  };
}

function saveState(sessionId: string, state: NudgeState): void {
  try {
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(join(STATE_DIR, `${sessionId}.json`), JSON.stringify(state));
  } catch {}
}

/** Tracked = an ISA backs the row. The `isa` pointer is the tracked marker
 *  everywhere else in the system (isa-utils, ascent derivation), so gating on
 *  it here cannot drift independently. Replaces the retired currentMode marker,
 *  which ISASync stopped writing 2026-07-14 (agents-dashboard redesign) —
 *  gating on it silenced mid-run nudges for exactly the runs they exist for.
 *  Pure; exported for tests. */
export function isTrackedRow(s: Record<string, unknown>): boolean {
  return typeof s.isa === 'string' && s.isa.length > 0;
}

/** The row's derived run state — the same call every other surface makes. */
export function rowAscent(s: Record<string, unknown>): AscentState {
  const pm = String(s.progress ?? '').match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/);
  return deriveAscent({
    phase: String(s.phase ?? s.currentPhase ?? ''),
    tracked: true,
    active: true,
    done: pm ? Number(pm[1]) : 0,
    total: pm ? Number(pm[2]) : 0,
  });
}

/** A tracked row still on the wall. Pure; exported for tests. */
export function isInFlightRow(s: Record<string, unknown>): boolean {
  return isTrackedRow(s) && IN_FLIGHT.has(rowAscent(s));
}

/**
 * Does an ISA-backed row carry this session UUID, and is it closed?
 *
 * This is NOT a suppressor — that was the H1 blackout. It answers the only
 * question the closed case needs: "no run was ever written" and "your run closed
 * and you kept working" are different situations that were getting the SAME
 * instruction. `late-isa` told a session holding a fully populated ISA at 23/23
 * to "scaffold the ISA now" — a wrong instruction where the old code merely said
 * nothing (Forge delta audit H-A, observed live on this run's own session).
 */
function closedRunFor(sessionId: string): { progress: string } | null {
  const reg = readJson<{ sessions?: Record<string, Record<string, unknown>> }>(WORK_JSON, {});
  for (const s of Object.values(reg.sessions || {})) {
    if ((s.sessionUUID as string) !== sessionId) continue;
    if (!isTrackedRow(s)) continue;
    return { progress: String(s.progress ?? '') };
  }
  return null;
}

/**
 * Find the OPEN run bound to this harness session UUID — tracked and still on
 * the wall. `registry` is injectable so the regression tests exercise THIS
 * function rather than only the extracted predicates (Forge audit M3: deleting
 * the tracked check left all 50 tests green).
 *
 * There is deliberately no `hasRegisteredRun` companion any more. It used to
 * gate `late-isa` on "was a run EVER written", which combined with this
 * function to black out a session completely the moment its run closed: a
 * closed row is not in flight, so `stale-isa` was impossible, and it was still
 * tracked, so `late-isa` stayed suppressed — no third path, for the rest of the
 * session (Forge audit H1; 6 of 24 live UUIDs were in that state, one at 348
 * tool calls, including the run that found it). The untracked-work clock now
 * RESTARTS when a run closes, which re-arms `late-isa` for the next stretch
 * while still keeping it quiet in the moments right after a completion — the
 * 2026-07-12 misfire this originally guarded against.
 */
export function activeAlgorithmSession(
  sessionId: string,
  registry?: { sessions?: Record<string, Record<string, unknown>> },
): ActiveSession | null {
  const reg = registry ?? readJson<{ sessions?: Record<string, Record<string, unknown>> }>(WORK_JSON, {});
  const sessions = reg.sessions || {};
  for (const [slug, s] of Object.entries(sessions)) {
    if ((s.sessionUUID as string) !== sessionId) continue;
    if (!isInFlightRow(s)) continue;
    return { slug, phase: String(s.phase ?? s.currentPhase ?? ''), ascent: rowAscent(s) };
  }
  return null;
}

function cooled(state: NudgeState, type: string, now: number, ms: number = COOLDOWN_MS): boolean {
  return now - (state.lastNudgeAt[type] || 0) >= ms;
}

function fire(state: NudgeState, type: string, now: number, text: string, out: string[]): void {
  state.lastNudgeAt[type] = now;
  out.push(text);
}

// ── Skill-routing index ──────────────────────────────────────────────────────

/** Extract USE WHEN trigger phrases from a SKILL.md frontmatter description.
 *  Pure; exported for tests. */
export function parseUseWhen(description: string): string[] {
  const m = description.match(/USE WHEN\s+([\s\S]*?)(?:\.\s*NOT FOR|$)/i);
  if (!m) return [];
  return m[1]
    .split(/[,·]/)
    .map(p => p.trim().toLowerCase().replace(/\.$/, ''))
    // floor 6 matches the matchSkills floors — shorter phrases are dead index
    // weight (Forge audit 2026-07-11, finding 5)
    .filter(p => p.length >= 6 && p.length <= 60);
}

/** Generic English words that are legitimate USE WHEN triggers for a human
 *  reading a skill list but pure noise as automatic single-word matchers —
 *  they fire on ordinary prose (Forge audit 2026-07-11, finding 2). Multiword
 *  phrases containing them still match. Tune from the routing telemetry. */
const ROUTE_STOPWORDS = new Set([
  'research', 'analyze', 'analysis', 'network', 'profile', 'metrics', 'revenue',
  'calendar', 'schedule', 'upgrade', 'extract', 'develop', 'improve', 'content',
  'monitor', 'opinion', 'reminder', 'comment', 'summary', 'publish', 'deploy',
  'search', 'review', 'install', 'update', 'create', 'archive', 'projects',
  'expenses', 'recordings', 'critique', 'knowledge',
]);

/** Deterministic phrase match with noise guards (D3 in the run ISA):
 *  multiword phrases ≥7 chars → substring; single words ≥6 chars → word boundary.
 *  >ROUTE_MAX_MATCHES skills matching = generic prompt = return [].
 *  Pure; exported for tests. */
export function matchSkills(prompt: string, index: SkillIndex): Array<{ skill: string; phrase: string }> {
  const p = prompt.toLowerCase();
  const hits: Array<{ skill: string; phrase: string }> = [];
  for (const { skill, phrases } of index.entries) {
    let best: string | null = null;
    for (const phrase of phrases) {
      const multiword = phrase.includes(' ');
      if (multiword) {
        if (phrase.length >= 7 && p.includes(phrase)) {
          if (!best || phrase.length > best.length) best = phrase;
        }
      } else if (phrase.length >= 6 && !ROUTE_STOPWORDS.has(phrase)) {
        try {
          // Unicode-property lookarounds instead of \b: JS \b is ASCII-only,
          // so any phrase or prompt with non-ASCII letters (accents, CJK,
          // Cyrillic) silently never matched — a mute miss in the one nudge
          // whose whole job is catching forgotten capabilities
          // (public issue #1787, @xmasyx; fix confirmed by @waveman2020-sudo).
          const esc = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          if (new RegExp(`(?<![\\p{L}\\p{N}_])${esc}(?![\\p{L}\\p{N}_])`, 'u').test(p)) {
            if (!best || phrase.length > best.length) best = phrase;
          }
        } catch { /* skip malformed */ }
      }
    }
    if (best) hits.push({ skill, phrase: best });
  }
  if (hits.length === 0 || hits.length > ROUTE_MAX_MATCHES) return [];
  return hits.sort((a, b) => b.phrase.length - a.phrase.length).slice(0, 3);
}

/** Build the index by scanning skills/*\/SKILL.md frontmatter. Slow path only —
 *  invoked via --rebuild-index (detached from the hot path). */
export function buildIndex(): SkillIndex {
  const entries: SkillIndex['entries'] = [];
  let dirs: string[] = [];
  try { dirs = readdirSync(SKILLS_DIR); } catch { /* no skills dir */ }
  for (const dir of dirs) {
    const skillMd = join(SKILLS_DIR, dir, 'SKILL.md');
    try {
      if (!existsSync(skillMd)) continue;
      const head = readFileSync(skillMd, 'utf-8').slice(0, 4096);
      const fm = head.match(/^---\n([\s\S]*?)\n---/);
      if (!fm) continue;
      const desc = fm[1].match(/description:\s*([\s\S]*?)(?:\n[a-zA-Z_-]+:|$)/);
      if (!desc) continue;
      const phrases = parseUseWhen(desc[1]);
      if (phrases.length > 0) entries.push({ skill: dir, phrases });
    } catch { /* skip unreadable skill */ }
  }
  return { builtAt: Date.now(), entries };
}

/** Routing-fire telemetry — the tuning instrument for the noise floors
 *  (Forge audit 2026-07-11, finding 2: tune from real fire-rate data). */
function logRoutingFire(sessionId: string, prompt: string, matches: Array<{ skill: string; phrase: string }>): void {
  try {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      session: sessionId.slice(0, 8),
      prompt_head: prompt.slice(0, 80),
      fired: matches.map(m => `${m.skill}:${m.phrase}`),
    });
    const path = join(PAI, 'LIFEOS', 'MEMORY', 'OBSERVABILITY', 'algo-nudge-routing.jsonl');
    // Bounded append (Forge audit 2026-07-11): tuning telemetry, not a system of
    // record — stop growing past the cap rather than accumulate prompt fragments
    // unbounded. Newest lines are lost when full; that's fine for floor-tuning.
    try { if (existsSync(path) && statSync(path).size > ROUTING_LOG_CAP_BYTES) return; } catch {}
    writeFileSync(path, line + '\n', { flag: 'a' });
  } catch {}
}

/** Newest SKILL.md mtime on disk — one readdir + N stats. Staleness measured
 *  only in TIME left a freshly created skill invisible to routing for up to
 *  6h while every other check passed (public issue #1787, @xmasyx). */
function newestSkillMtime(): number {
  let newest = 0;
  try {
    for (const dir of readdirSync(SKILLS_DIR)) {
      try {
        const t = statSync(join(SKILLS_DIR, dir, 'SKILL.md')).mtimeMs;
        if (t > newest) newest = t;
      } catch { /* not a skill dir */ }
    }
  } catch { /* no skills dir */ }
  return newest;
}

/** Load the index if fresh; kick a detached rebuild if stale/missing (never block). */
function loadIndex(): SkillIndex | null {
  const idx = readJson<SkillIndex | null>(INDEX_PATH, null);
  const stale = !idx || Date.now() - idx.builtAt > INDEX_MAX_AGE_MS
    || newestSkillMtime() > idx.builtAt;
  if (stale) {
    // Resolve bun absolutely: a detached rebuild spawned with the bare name
    // silently no-ops if bun isn't on the subprocess PATH, and the empty catch
    // that used to wrap this hid it forever — the routing index then never
    // builds and skill nudges silently stop (public issue #1508 finding #2).
    // process.execPath IS the running bun binary; fall back to which/known dirs.
    const bun = resolveBun();
    try {
      Bun.spawn([bun, import.meta.path, '--rebuild-index'],
        { stdin: 'ignore', stdout: 'ignore', stderr: 'ignore' }).unref();
    } catch (e) {
      // Never block the turn, but never swallow silently either — a failed
      // self-heal must leave a trace something can see.
      try {
        appendFileSync(
          join(homedir(), '.claude/LIFEOS/MEMORY/OBSERVABILITY/hook-selfheal.jsonl'),
          JSON.stringify({ ts: new Date().toISOString(), hook: 'AlgorithmNudge', action: 'rebuild-index', bun, error: String(e) }) + '\n',
        );
      } catch { /* observability write itself is best-effort */ }
    }
  }
  return idx; // stale index still usable this turn; missing → null → skip routing
}

// ── The nudge logic ──────────────────────────────────────────────────────────

/** Returns the joined nudge text for this event, or null. No exit, no stdout. */
/** Gate predicates — deliberately DISTINCT (Forge audit 2026-07-11, finding 1:
 *  a shared predicate silently narrowed the principal nudge, now cut). Exported for tests. */
export function routeSuppressed(p: string): boolean {
  return /^[</]/.test(p) || p.length < 15; // commands + short acks: not routing material
}

// ── Depth directive (always-on, no-run turns) ────────────────────────────────

/** Plain-language depth directives. Deliberately narrow — misses fall through
 *  to late-ISA and doctrine; fires are logged to routing telemetry for tuning.
 *  A false positive costs one advisory line, so the guards below aim at pasted
 *  content, not perfection. */
const DEPTH_PHRASES = [
  'think deeply', 'think hard', 'think harder', 'go deep', 'go heavy',
  'be thorough', 'ultrathink', 'dig deep',
  // 2026-07-16 pocock-reanalysis incident: "go do a thorough analysis … thoroughly
  // analyze this claim" fired nothing — adjective/adverb forms were missing.
  'thorough analysis', 'thoroughly analyze', 'thoroughly analyse',
  'deep analysis', 'deep dive', 'deeply look',
];
const DEPTH_HEAD_CHARS = 200;   // directives live at the top of a prompt; quoted
                                // transcripts and pasted docs match deeper down
const DEPTH_MAX_PROMPT = 1500;  // longer prompts are pasted content, not directives

/** Depth gets its own suppression: only command/tag prefixes. routeSuppressed's
 *  15-char floor would eat bare directives ("go deep", "ultrathink") — and a bare
 *  directive is the most common form of the steering this row exists to catch
 *  (post-ship audit 2026-07-12). The phrase match itself is the content floor. */
export function depthSuppressed(p: string): boolean {
  return /^[</]/.test(p);
}

/** Returns the matched phrase or null. Pure; exported for tests. */
export function matchDepthDirective(prompt: string): string | null {
  if (prompt.length > DEPTH_MAX_PROMPT || prompt.includes('```')) return null;
  const head = prompt.slice(0, DEPTH_HEAD_CHARS).toLowerCase();
  for (const phrase of DEPTH_PHRASES) {
    if (new RegExp(`\\b${phrase}\\b`).test(head)) return phrase;
  }
  return null;
}

// ── Design-class work → elect the top rung (always-on) ───────────────────────
//
// The mirror of execution-class: that row points DOWN a rung for mechanical work, this one
// points UP for the work OPERATIONAL_RULES § Model selection reserves for MAX.
//
// Why this row is allowed to exist under the "rows may only ask about state the model cannot
// observe from its own context" bound: the 2026-07-29 incident is the proof.
// Doctrine asserted MAX was the session default, so a
// full authority-model build — new platform authority, cross-tenant read boundary, two
// shipped editions — was designed and deployed a rung low without the run ever noticing.
// The rung a run is on is precisely what it cannot see: no hook receives the session model,
// and the statusline's model-cache is last-writer-wins across sessions. Prose already failed
// at this once; this row is the mechanism.
//
// Precision over recall, deliberately. A single authority noun ("role", "tenant", "secret")
// would fire on half of all prompts and be tuned out inside a day. So the trigger is a
// CONJUNCTION — a design/build verb AND an authority-or-architecture noun — plus a short list
// of phrases that are unambiguous on their own.

const DESIGN_VERBS = [
  'separate', 'redesign', 'restructure', 'rearchitect', 're-architect', 'architect',
  'rework', 'rebuild', 'from scratch', 'design', 'plan out', 'lay out', 'think through',
  'think deeply', 'build out', 'stand up', 'introduce', 'split',
];

const AUTHORITY_NOUNS = [
  'security', 'auth', 'authentication', 'authorization', 'permission', 'access control',
  'privilege', 'admin', 'rbac', 'role model', 'isolation', 'boundary', 'multi-tenant',
  'multitenant', 'tenancy', 'architecture', 'trust model', 'threat model',
  // Added 2026-07-29: "design the provisioning path and how a new tenant gets its first owner"
  // matched the verb and nothing else, so the row stayed silent on standing up a tenant and
  // minting its owner — the authority boundary the incident was about.
  'tenant', 'provisioning', 'credential',
];

// Unambiguous on their own — no verb required.
const DESIGN_CLASS_PHRASES = [
  'security standpoint', 'security boundary', 'auth boundary', 'authority model',
  'permission model', 'access control', 'threat model', 'trust boundary',
  'privilege escalation', 'security architecture', 'tenant isolation',
];

const DESIGN_MAX_PROMPT = 4000; // longer is pasted content, not a directive

/** Returns the matched signal or null. Pure; exported for tests. */
export function matchDesignClass(prompt: string): string | null {
  if (prompt.length > DESIGN_MAX_PROMPT || prompt.includes('```')) return null;
  const p = prompt.toLowerCase();
  for (const phrase of DESIGN_CLASS_PHRASES) {
    if (p.includes(phrase)) return phrase;
  }
  const verb = DESIGN_VERBS.find(v => new RegExp(`\\b${v}\\b`).test(p));
  if (!verb) return null;
  const noun = AUTHORITY_NOUNS.find(n => new RegExp(`\\b${n}\\b`).test(p));
  return noun ? `${verb} + ${noun}` : null;
}

/** Same shape as depthSuppressed: only command/tag prefixes opt out. */
export function designClassSuppressed(p: string): boolean {
  return /^[</]/.test(p);
}

export const DESIGN_CLASS_NUDGE =
  'This reads as design-class work (authority/security boundary or system architecture, '
  + 'OPERATIONAL_RULES § Model selection). You are ALREADY on the top rung — settings.json pins '
  + 'the main loop there — so do not ask which model to use and do not rent a rung by dispatching '
  + 'the design leg to Max. Design it NATIVELY and inline, before building, then downshift by '
  + 'dispatch for the execution leg. Max is for an independent SECOND look, scaled to blast '
  + 'radius, never a substitute for thinking.';

// ── Execution-delegation → downshift by dispatch (always-on) ─────────────────
//
// The down-rung mirror of design-class, with the same justification pattern: doctrine
// ("execution drops a rung") existed the whole time and produced nothing — subagent-events.jsonl
// held 10K dispatch events with zero explicit models when measured 2026-08-01, and most
// execution never dispatched at all. Two facts the model cannot observe from inside the work:
// how long the current inline-build stretch has run (an aggregate across turns), and that a
// model-less dispatch inherits the session rung (the harness applies it silently). Both rows
// are QUESTIONS — no classifier decides what counts as execution; that judgment stays with
// the model, which is what keeps this on the right side of BPE.

const EXEC_DELEGATION_THRESHOLD = 10;  // consecutive build calls with zero dispatches
const BUILD_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const DISPATCH_TOOLS = new Set(['Agent', 'Task']);  // harness renamed Task→Agent; accept both

export const EXEC_DELEGATION_NUDGE =
  `${EXEC_DELEGATION_THRESHOLD}+ consecutive build calls, zero delegated dispatches — this is all `
  + 'running inline on the top rung (settings.json pins the main loop to MAX). Is this stretch '
  + 'judgment work that earns MAX, or an execution leg that should ride a dispatch a rung down '
  + '(OPERATIONAL_RULES § Model selection)? Either answer is fine — make it a decision, not a default.';

export const INHERITED_DISPATCH_NUDGE =
  'That dispatch carried no `model` field, so it inherits the MAX session rung. If it was an '
  + 'execution leg, pass the rung alias explicitly (OPERATIONAL_RULES § Model selection); if the '
  + 'task genuinely needed MAX, inheriting was the right call.';

// The build counter above is blind to the other heavy-token shape: long Bash/Read/Grep
// evidence sweeps. Measured 2026-08-02: an entire release-notes session ran ~25 inline calls
// on MAX with zero dispatches and no row fired. Same BPE bound as exec-delegation — this is
// a QUESTION about an aggregate the model can't see, not a classifier deciding what counts.
const SWEEP_DELEGATION_THRESHOLD = 20;  // consecutive non-dispatch tool calls of any kind

export const SWEEP_DELEGATION_NUDGE =
  `${SWEEP_DELEGATION_THRESHOLD}+ consecutive inline tool calls, zero dispatches — the whole `
  + 'stretch is riding the MAX rung. If a chunk of it is token-heavy mechanical work (bulk '
  + 'reads, sweeps, migrations, reformatting), ship that leg a rung down with the escalation '
  + 'contract in the brief (OPERATIONAL_RULES § Model selection) so the delegate can hand hard '
  + 'judgment back up instead of grinding. If the stretch genuinely needs top-rung thinking, '
  + 'carry on — make it a decision, not a default.';

interface CapManifest {
  capabilities: Record<string, { state?: string }>;
}

// Static fix commands, keyed by capability id — MIRRORS the CAPS registry in
// LIFEOS/TOOLS/Doctor.ts (like the Pulse module's CAP_TITLES mirror). Sourced
// here as compile-time constants so the nudge NEVER pulls a runnable command
// string out of the on-disk manifest. Forge audit 2026-07-12: the manifest is
// a file, this text lands in the model's context, so a poisoned manifest must
// be able to flip a *state* at most — never inject prose the model might run.
const CAP_FIX: Record<string, string> = {
  codex: 'bun install -g @openai/codex && codex login',
  cloudflare: 'add CLOUDFLARE_API_TOKEN to <configRoot>/.env, then: bun LIFEOS/TOOLS/Doctor.ts --network',
  voice: 'set ELEVENLABS_VOICE_ID to an API-permitted voice in <configRoot>/.env',
  interceptor: 'install Google Chrome (or Brave), then re-run: bun LIFEOS/TOOLS/Doctor.ts',
};

/** Pure: which capability nudge (if any) does this failed command earn?
 *  broken → one line with the STATIC fix; declined/live/stale/absent → null.
 *  Reads ONLY `state` from the manifest — no manifest string reaches the model. */
export function capabilityNudgeFor(command: string, manifest: CapManifest): { id: string; text: string } | null {
  if (!command) return null;
  for (const { id, re } of CAP_COMMAND_RES) {
    if (!re.test(command)) continue;
    const entry = manifest.capabilities?.[id];
    if (!entry || entry.state !== 'broken') return null;
    const fix = CAP_FIX[id] ? ` Fix: ${CAP_FIX[id]}` : '';
    return {
      id,
      text: `That failure touched the "${id}" capability, which Doctor has as BROKEN.${fix} Or opt out for good: bun LIFEOS/TOOLS/Doctor.ts decline ${id}.`,
    };
  }
  return null;
}

export function run(input: HookInput): string | null {
  try {
    const sessionId = input.session_id || '';
    const event = input.hook_event_name || '';
    if (!sessionId || !SESSION_ID_RE.test(sessionId)) return null;

    const now = Date.now();
    const state = loadState(sessionId);
    const active = activeAlgorithmSession(sessionId);
    const out: string[] = [];

    if (event === 'UserPromptSubmit') {
      // Only the primary conversation receives UserPromptSubmit — record its
      // transcript so tool events can be primary-gated below.
      if (input.transcript_path) state.primaryTranscript = input.transcript_path;
      const p = (input.prompt || '').trim();

      // ALWAYS-ON: skill-routing. The dominant routing failure is under-use
      // (dynamic-range audit 2026-07-11: 4 handroll instances vs 1 over-invocation).
      if (!routeSuppressed(p)) {
        const idx = loadIndex();
        if (idx) {
          const matches = matchSkills(p, idx)
            .filter(m => cooled(state, `route:${m.skill}`, now, ROUTE_COOLDOWN_MS));
          if (matches.length > 0) {
            for (const m of matches) state.lastNudgeAt[`route:${m.skill}`] = now;
            logRoutingFire(sessionId, p, matches);
            out.push(`This prompt matches USE WHEN of: ${matches.map(m => m.skill).join(', ')} — if the work lands there, invoke the skill rather than handrolling.`);
          }
        }
      }

      // ALWAYS-ON: depth directive with no registered run. Doctrine claims 10/15
      // (ask-fidelity, spend) only have teeth inside a run — this row's whole job
      // is getting the run to exist. (The mid-run principal row that used to follow was cut 2026-07-30.)
      if (!active && !depthSuppressed(p) && cooled(state, 'depth', now)) {
        const phrase = matchDepthDirective(p);
        if (phrase) {
          logRoutingFire(sessionId, p, [{ skill: 'DEPTH', phrase }]);
          fire(state, 'depth', now, `He directed depth ("${phrase}"). His call outranks your judgment (claim 15): likely a run, not a chat turn — write done down, and name what the task earns (thinking skills, agents, research, verification) or state why inline is enough.`, out);
        }
      }

      // ALWAYS-ON: design-class work → elect the top rung BEFORE building.
      // Not run-gated: the whole point is to fire at the moment the work is described,
      // which is before any ISA exists. Fires regardless of whether a run is active,
      // because the planning leg is exactly what happens at run start.
      if (!designClassSuppressed(p) && cooled(state, 'design-class', now)) {
        const signal = matchDesignClass(p);
        if (signal) {
          logRoutingFire(sessionId, p, [{ skill: 'DESIGN-CLASS', phrase: signal }]);
          fire(state, 'design-class', now, DESIGN_CLASS_NUDGE, out);
        }
      }

      // The `principal` row was CUT here (2026-07-30). Its trigger was "the
      // principal sent a message mid-run", and that message is in my context at
      // the moment the row fires — precisely what this file's own bounding rule
      // forbids: a row may only ask about state the model CANNOT observe from
      // its own context. It survived every prior review because it was DEAD
      // (same `active` gate as stale-isa), so nobody re-read it against the rule.
      // Folding his message into the ISA remains required — that is doctrine
      // claim 14, carried by the ISA and its close gates, not by a reminder.
    }

    // Primary-only gate for tool events: subagents share the session_id but
    // carry their own transcript_path. Mismatch → subagent → silent.
    // A delegate's tool events arrive on the PARENT's session_id AND the parent's
    // transcript_path — byte-identical, probed 2026-07-30 — so the transcript
    // comparison alone can never discriminate, and every run-scoped row leaked
    // into every subagent (watched fire twice inside a review agent's context,
    // which also inflated this session's counters with the delegate's calls).
    // The harness stamps delegate tool events with `agent_id`/`agent_type` and
    // omits `effort`; the primary's carry `effort` and no `agent_id`. That flag
    // is the discriminator, verified absent on the primary for BOTH tool event
    // types (PostToolUse and PostToolUseFailure — the capability row's path).
    // The transcript compare stays as a fallback for any harness build that
    // doesn't send `agent_id`; on such a build the behaviour is exactly the old
    // one, so this can only ever tighten, never silence the primary.
    const isSubagentEvent = event !== 'UserPromptSubmit'
      && (
        !!input.agent_id
        || (!!state.primaryTranscript
          && !!input.transcript_path
          && input.transcript_path !== state.primaryTranscript)
      );
    if (event !== 'UserPromptSubmit') {
      if (isSubagentEvent) state.delegateEvents = (state.delegateEvents ?? 0) + 1;
      else state.primaryEvents = (state.primaryEvents ?? 0) + 1;
      // A session whose EVERY tool event reads as a delegate has no tool-event
      // coverage at all — every row is silent for it. That is the system's
      // signature failure (nothing breaks when a nudge doesn't fire), so it
      // leaves a trace exactly once instead of vanishing (Forge audit M1).
      // Sustained window, not the late-isa floor: PostToolUse fires when a tool
      // RETURNS, so a session whose first act is a delegation sees the delegate's
      // events while its own Agent call is still open — `primaryEvents` is
      // legitimately 0 for a while (Forge delta audit M-F).
      if (!state.silenceLogged
        && (state.delegateEvents ?? 0) >= SILENCE_TRACE_THRESHOLD
        && (state.primaryEvents ?? 0) === 0) {
        state.silenceLogged = true;
        try {
          appendFileSync(
            SELFHEAL_LOG,
            JSON.stringify({
              ts: new Date().toISOString(),
              hook: 'AlgorithmNudge',
              kind: 'all-events-classified-delegate',
              session_id: sessionId,
              delegateEvents: state.delegateEvents,
              note: 'every tool event carried agent_id — all tool-event nudge rows are silent for this session',
            }) + '\n',
          );
        } catch {}
      }
    }
    if (isSubagentEvent) { saveState(sessionId, state); return null; }

    // ALWAYS-ON: capability moment-of-need. A failed command that exercises a
    // Doctor-tracked capability, while the manifest says BROKEN, gets ONE line
    // with the fix command — at the exact moment the user paid for the gap.
    if (event === 'PostToolUseFailure' && input.tool_name === 'Bash') {
      const cmd = String((input.tool_input as Record<string, unknown>)?.command || '');
      const capNudge = capabilityNudgeFor(cmd, readJson<CapManifest>(CAPABILITIES_PATH, { capabilities: {} }));
      if (capNudge && cooled(state, `capability:${capNudge.id}`, now, CAP_COOLDOWN_MS)) {
        fire(state, `capability:${capNudge.id}`, now, capNudge.text, out);
      }
    }

    if (event === 'PostToolUse') {
      state.toolCallsTotal += 1;
      const tool = input.tool_name || '';
      const filePath = String((input.tool_input as Record<string, unknown>)?.file_path || '');

      // ALWAYS-ON: destructive infra op (claim 16, v8.7.0). Fires on success —
      // the questions are about what must be verified AFTER the op, so run-gating
      // would miss exactly the "run already declared done" case that burned us.
      if (tool === 'Bash' && cooled(state, 'destructive-infra', now)) {
        const cmd = String((input.tool_input as Record<string, unknown>)?.command || '');
        if (DESTRUCTIVE_INFRA_RE.test(cmd)) {
          fire(state, 'destructive-infra', now, DESTRUCTIVE_INFRA_NUDGE, out);
        }
      }
      // ALWAYS-ON: execution-delegation (down-rung mirror of design-class).
      // A dispatch resets the inline-build counter; a model-less dispatch also
      // gets the inherited-rung fact surfaced once per cooldown.
      if (DISPATCH_TOOLS.has(tool)) {
        state.buildCallsSinceDispatch = 0;
        state.workCallsSinceDispatch = 0;
        const hasModel = typeof (input.tool_input as Record<string, unknown>)?.model === 'string';
        if (!hasModel && cooled(state, 'inherited-dispatch', now)) {
          fire(state, 'inherited-dispatch', now, INHERITED_DISPATCH_NUDGE, out);
        }
      } else {
        state.workCallsSinceDispatch = (state.workCallsSinceDispatch ?? 0) + 1;
        if (BUILD_TOOLS.has(tool)) {
          state.buildCallsSinceDispatch = (state.buildCallsSinceDispatch ?? 0) + 1;
          if (state.buildCallsSinceDispatch >= EXEC_DELEGATION_THRESHOLD
            && cooled(state, 'exec-delegation', now)) {
            state.buildCallsSinceDispatch = 0;
            state.workCallsSinceDispatch = 0;  // one question per stretch, not two
            fire(state, 'exec-delegation', now, EXEC_DELEGATION_NUDGE, out);
          }
        }
        if (state.workCallsSinceDispatch >= SWEEP_DELEGATION_THRESHOLD
          && cooled(state, 'sweep-delegation', now)) {
          state.workCallsSinceDispatch = 0;
          fire(state, 'sweep-delegation', now, SWEEP_DELEGATION_NUDGE, out);
        }
      }

      const isISAEdit = (tool === 'Write' || tool === 'Edit' || tool === 'MultiEdit') && ISA_PATH_RE.test(filePath);

      if (active) {
        state.runWasOpen = true;
        // stale-ISA counter
        state.toolCallsSinceISAEdit = isISAEdit ? 0 : state.toolCallsSinceISAEdit + 1;
        state.toolCallsSinceISAEditAbs = isISAEdit ? 0 : state.toolCallsSinceISAEditAbs + 1;
        if (state.toolCallsSinceISAEdit >= STALE_ISA_THRESHOLD && cooled(state, 'stale-isa', now)) {
          state.toolCallsSinceISAEdit = 0;
          fire(state, 'stale-isa', now, `${STALE_ISA_THRESHOLD}+ tool calls with zero ISA edits. Is the ISA still the true shape of done, or has the work learned something it hasn't?`, out);
        }

      } else {
        // No OPEN run. If one was open a moment ago, it just closed: restart the
        // untracked-work clock so the next stretch is covered again, and stay
        // quiet in the calls immediately after a completion (the 2026-07-12
        // misfire). Without this edge, a session went permanently dark the
        // moment its run closed — 6 of 24 live UUIDs were in that state, one at
        // 348 tool calls (Forge audit H1).
        if (state.runWasOpen) {
          state.runWasOpen = false;
          state.toolCallsTotal = 0;
          state.lateISAFired = false;
        }
        // The cooldown is what makes the 2026-07-12 misfire actually impossible
        // rather than merely expensive: the clock restart is counted in TOOL
        // CALLS, and 25 of those elapse in under a minute on parallel blocks. It
        // also bounds the row when a run's progress oscillates around N/N, which
        // reopens and recloses it repeatedly (Forge delta audit M-A, M-B).
        if (!state.lateISAFired
          && state.toolCallsTotal >= LATE_ISA_THRESHOLD
          && cooled(state, 'late-isa', now)) {
          // ALWAYS-ON: late-ISA. This deep with no open run is either genuinely
          // trivial-iterative or an unwritten climb (dynamic-range audit: 2h of
          // substantive work before the ISA appeared) — or a run that closed and
          // kept going, which needs the opposite instruction.
          state.lateISAFired = true;
          const closed = closedRunFor(sessionId);
          const text = closed
            ? `${LATE_ISA_THRESHOLD}+ tool calls since your run closed at ${closed.progress || 'its last claim'}. The work didn't stop when the ISA did — reopen it with the claims this stretch is actually proving, or scaffold a new one.`
            : `${LATE_ISA_THRESHOLD}+ tool calls and no run registered. Still trivial, or does done need writing down? If this is a real climb, scaffold the ISA now — nudge coverage starts when it exists.`;
          fire(state, 'late-isa', now, text, out);
        }
      }
    }

    saveState(sessionId, state);
    if (out.length === 0) return null;
    return out.map(n => `🧭 ALGO-NUDGE: ${n}`).join('\n');
  } catch {
    // never block the session
    return null;
  }
}

if (import.meta.main) {
  if (process.argv.includes('--rebuild-index')) {
    try {
      const idx = buildIndex();
      mkdirSync(join(PAI, 'LIFEOS', 'MEMORY', 'STATE'), { recursive: true });
      writeFileSync(INDEX_PATH, JSON.stringify(idx));
      console.log(`index: ${idx.entries.length} skills, ${idx.entries.reduce((n, e) => n + e.phrases.length, 0)} phrases`);
    } catch (e) {
      console.error(String(e));
    }
    process.exit(0);
  }
  (async () => {
    const killer = setTimeout(() => process.exit(0), 4000);
    let raw = '';
    const timer = new Promise<void>(r => setTimeout(r, 1500));
    const reader = (async () => { for await (const chunk of Bun.stdin.stream()) raw += Buffer.from(chunk).toString(); })();
    await Promise.race([reader, timer]);
    if (raw) {
      try {
        const input: HookInput = JSON.parse(raw);
        const text = run(input);
        if (text) {
          console.log(JSON.stringify({
            hookSpecificOutput: { hookEventName: input.hook_event_name || 'PostToolUse', additionalContext: text },
          }));
        }
      } catch { /* never block */ }
    }
    clearTimeout(killer);
    process.exit(0);
  })();
}
