#!/usr/bin/env bun
/**
 * @version 2.3.0
 * AlgorithmNudge — the Algorithm live nudge layer ("Events ask the rest").
 *
 * Unification (2026-07-11, principal-approved): IsaNudge's run-scoped nudges +
 * the skill-routing, late-ISA, and tier-free spend nudges from the dynamic-range
 * audit, in ONE runner. Formerly hooks/IsaNudge.hook.ts.
 *
 * 2.2.0 (2026-07-12, principal-approved, RedTeam-verified design): always-on
 * depth-directive row — a plain-language depth directive in a NO-RUN turn is a
 * signal the turn is a run, and doctrine claims 10/15 only have teeth once the
 * run exists. Advisory question only; a Stop-block variant was adversarially
 * killed (Goodharts into token dispatches; gates on procedure, not outcome).
 *
 * 2.3.0 (2026-07-12, install-awareness redesign #1461): always-on capability
 * row — PostToolUseFailure on a Bash command exercising a Doctor-tracked
 * capability while capabilities.json marks it broken fires ONE line with a
 * compile-time CAP_FIX command (60-min per-capability cooldown; manifest is
 * state-only, never a prose source).
 *
 * TWO SCOPES:
 *   ALWAYS-ON  (any session)          → skill-routing + depth-directive
 *                                       (UserPromptSubmit),
 *                                       late-ISA (PostToolUse, no registered run),
 *                                       capability row (PostToolUseFailure)
 *   RUN-SCOPED (live Algorithm run)   → probe-fail, principal, agent-return,
 *                                       claim-close, stale-isa, spend
 *
 * Fires the right one-line question at the moment it's answerable. Deterministic,
 * zero inference calls, always exits 0, hot path target <20ms.
 *
 * Events (dispatched by hook_event_name):
 *   UserPromptSubmit          → routing match (always-on) + mid-run principal nudge
 *   PostToolUse               → agent-return, claim-close, stale-ISA, spend | late-ISA
 *                               (reaches here via PostToolObserver's import of run())
 *   PostToolUseFailure        → probe-failed nudge
 *
 * State: MEMORY/STATE/isa-nudge/{session_id}.json
 *   { toolCallsSinceIsaEdit, toolCallsTotal, lateIsaFired, lastNudgeAt: {type: epochMs},
 *     primaryTranscript }
 *
 * Skill index: MEMORY/STATE/skill-usewhen-index.json — trigger phrases parsed from
 * every skills/*\/SKILL.md frontmatter USE WHEN clause. NEVER scanned synchronously
 * on the hot path: a stale/missing index triggers a DETACHED rebuild
 * (`bun AlgorithmNudge.hook.ts --rebuild-index`) and this turn proceeds without it.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { getClaudeDir } from "./lib/paths";

const PAI = join(getClaudeDir());
const WORK_JSON = join(PAI, 'LIFEOS', 'MEMORY', 'STATE', 'work.json');
const STATE_DIR = join(PAI, 'LIFEOS', 'MEMORY', 'STATE', 'isa-nudge');
const SKILLS_DIR = join(PAI, 'skills');
const INDEX_PATH = join(PAI, 'LIFEOS', 'MEMORY', 'STATE', 'skill-usewhen-index.json');

const STALE_ISA_THRESHOLD = 15;            // tool calls with zero ISA edits (run-scoped)
const LATE_ISA_THRESHOLD = 25;             // tool calls with NO registered run (always-on, once)
const SPEND_THRESHOLD = 75;                // tool calls in-run with claims open
const COOLDOWN_MS = 5 * 60 * 1000;         // default per-nudge-type
const SPEND_COOLDOWN_MS = 30 * 60 * 1000;  // spend re-fires on genuinely long runs
const ROUTE_COOLDOWN_MS = 60 * 60 * 1000;  // per-skill routing cooldown
const INDEX_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const ROUTING_LOG_CAP_BYTES = 512_000;     // telemetry stops appending past this (Forge audit)
const ROUTE_MAX_MATCHES = 6;               // more matches than this = generic prompt = noise
const ISA_PATH_RE = /(?:^|\/)(?:ISA\.md|bunker\.isa\.md)$/i;
const ACTIVE_PHASES = new Set(['starting', 'observe', 'think', 'plan', 'build', 'execute', 'verify']);
const CAPABILITIES_PATH = process.env.LIFEOS_CAPABILITIES_PATH
  || join(PAI, 'LIFEOS', 'MEMORY', 'STATE', 'capabilities.json');
const CAP_COOLDOWN_MS = 60 * 60 * 1000;    // per-capability; moment-of-need, never nagging

// Doctor-manifest capabilities → the command shapes that exercise them.
// Fed by LIFEOS/TOOLS/Doctor.ts (v2 design, #1461): broken fires once with the
// fix command, declined and live are ALWAYS silent, absent manifest is silent.
const CAP_COMMAND_RES: Array<{ id: string; re: RegExp }> = [
  { id: 'codex', re: /\bcodex\b/ },
  { id: 'cloudflare', re: /\bwrangler\b/ },
  { id: 'voice', re: /localhost:31337\/notify/ },
  { id: 'interceptor', re: /\binterceptor\b/ },
];

interface HookInput {
  session_id?: string;
  hook_event_name?: string;
  prompt?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  transcript_path?: string;
}

interface NudgeState {
  toolCallsSinceIsaEdit: number;
  toolCallsTotal: number;
  lateIsaFired: boolean;
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
  progressOpen: boolean;
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
    toolCallsSinceIsaEdit: s.toolCallsSinceIsaEdit ?? 0,
    toolCallsTotal: s.toolCallsTotal ?? 0,
    lateIsaFired: s.lateIsaFired ?? false,
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

/** True when ANY registered run — any phase, including complete — is bound to
 *  this harness session. Late-ISA must distinguish "no run was ever written"
 *  from "the run just closed": it fired seconds after a completion on
 *  2026-07-12, live, during its own ship run. */
function hasRegisteredRun(sessionId: string): boolean {
  const reg = readJson<{ sessions?: Record<string, Record<string, unknown>> }>(WORK_JSON, {});
  for (const s of Object.values(reg.sessions || {})) {
    if ((s.sessionUUID as string) === sessionId) return true;
  }
  return false;
}

/** Find the ALGORITHM session bound to this harness session UUID, if it's mid-run. */
function activeAlgorithmSession(sessionId: string): ActiveSession | null {
  const reg = readJson<{ sessions?: Record<string, Record<string, unknown>> }>(WORK_JSON, {});
  const sessions = reg.sessions || {};
  for (const [slug, s] of Object.entries(sessions)) {
    if ((s.sessionUUID as string) !== sessionId) continue;
    if ((s.currentMode as string) !== 'algorithm') continue;
    const phase = String(s.phase ?? s.currentPhase ?? '');
    if (!ACTIVE_PHASES.has(phase)) continue;
    const progress = String(s.progress ?? '');
    const pm = progress.match(/^(\d+)\/(\d+)$/);
    const progressOpen = pm ? Number(pm[1]) < Number(pm[2]) : true;
    return { slug, phase, progressOpen };
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
          if (new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(p)) {
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

/** Load the index if fresh; kick a detached rebuild if stale/missing (never block). */
function loadIndex(): SkillIndex | null {
  const idx = readJson<SkillIndex | null>(INDEX_PATH, null);
  const stale = !idx || Date.now() - idx.builtAt > INDEX_MAX_AGE_MS;
  if (stale) {
    try {
      Bun.spawn(['bun', import.meta.path, '--rebuild-index'],
        { stdin: 'ignore', stdout: 'ignore', stderr: 'ignore' }).unref();
    } catch {}
  }
  return idx; // stale index still usable this turn; missing → null → skip routing
}

// ── The nudge logic ──────────────────────────────────────────────────────────

/** Returns the joined nudge text for this event, or null. No exit, no stdout. */
/** Gate predicates — deliberately DISTINCT (Forge audit 2026-07-11, finding 1:
 *  a shared predicate silently narrowed the principal nudge). Exported for tests. */
export function routeSuppressed(p: string): boolean {
  return /^[</]/.test(p) || p.length < 15; // commands + short acks: not routing material
}
export function principalSuppressed(p: string): boolean {
  return /^</.test(p) || p.length < 3; // byte-equivalent to the original IsaNudge gate —
  // "use Redis", "skip that", "/model opus" are mid-run revisions and MUST nudge
}

// ── Depth directive (always-on, no-run turns) ────────────────────────────────

/** Plain-language depth directives. Deliberately narrow — misses fall through
 *  to late-ISA and doctrine; fires are logged to routing telemetry for tuning.
 *  A false positive costs one advisory line, so the guards below aim at pasted
 *  content, not perfection. */
const DEPTH_PHRASES = [
  'think deeply', 'think hard', 'think harder', 'go deep', 'go heavy',
  'be thorough', 'ultrathink', 'dig deep',
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
      // is getting the run to exist. Mid-run, the principal nudge below covers it.
      if (!active && !depthSuppressed(p) && cooled(state, 'depth', now)) {
        const phrase = matchDepthDirective(p);
        if (phrase) {
          logRoutingFire(sessionId, p, [{ skill: 'DEPTH', phrase }]);
          fire(state, 'depth', now, `He directed depth ("${phrase}"). His call outranks your judgment (claim 15): likely a run, not a chat turn — write done down, and name what the task earns (thinking skills, agents, research, verification) or state why inline is enough.`, out);
        }
      }

      // RUN-SCOPED: principal mid-run message (its OWN gate — looser by design;
      // short revisions like "use Redis" must nudge).
      if (active && !principalSuppressed(p) && cooled(state, 'principal', now)) {
        fire(state, 'principal', now, 'His message just landed mid-run. Does it revise the goal, kill a claim, or add one? Fold it into the ISA before continuing.', out);
      }
    }

    // Primary-only gate for tool events: subagents share the session_id but
    // carry their own transcript_path. Mismatch → subagent → silent.
    const isSubagentEvent = event !== 'UserPromptSubmit'
      && !!state.primaryTranscript
      && !!input.transcript_path
      && input.transcript_path !== state.primaryTranscript;
    if (isSubagentEvent) { saveState(sessionId, state); return null; }

    if (event === 'PostToolUseFailure' && active) {
      // Probe-shaped failures matter at execute/verify; build-phase failures
      // are usually iteration noise, not claim falsifications (Forge audit).
      if ((active.phase === 'execute' || active.phase === 'verify') && cooled(state, 'probe-fail', now)) {
        fire(state, 'probe-fail', now, 'That failure — was it a claim probe? If so: claim wrong or code wrong? A wrong claim means update the ISA; that is the climb.', out);
      }
    }

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
      const isIsaEdit = (tool === 'Write' || tool === 'Edit' || tool === 'MultiEdit') && ISA_PATH_RE.test(filePath);

      if (active) {
        // stale-ISA counter
        state.toolCallsSinceIsaEdit = isIsaEdit ? 0 : state.toolCallsSinceIsaEdit + 1;
        if (state.toolCallsSinceIsaEdit >= STALE_ISA_THRESHOLD && cooled(state, 'stale-isa', now)) {
          state.toolCallsSinceIsaEdit = 0;
          fire(state, 'stale-isa', now, `${STALE_ISA_THRESHOLD}+ tool calls with zero ISA edits. Is the ISA still the true shape of done, or has the work learned something it hasn't?`, out);
        }

        // agent / research return
        if ((tool === 'Agent' || tool === 'Task' || tool === 'WebSearch' || tool === 'WebFetch') && cooled(state, 'agent-return', now)) {
          fire(state, 'agent-return', now, 'Results just came back. Anything here the ISA doesn\'t know yet — a new claim, a constraint, an unknown made known?', out);
        }

        // claim close — Edit only: a full-file Write has no old_string, so the
        // delta would count every historical [x] as "new" (Forge audit).
        if (isIsaEdit && tool === 'Edit') {
          const inp = input.tool_input as Record<string, unknown>;
          if (typeof inp?.old_string === 'string') {
            const newText = String(inp?.new_string ?? '');
            const oldText = String(inp.old_string);
            const closes = (newText.match(/- \[x\]/gi) || []).length - (oldText.match(/- \[x\]/gi) || []).length;
            if (closes > 0 && cooled(state, 'claim-close', now)) {
              fire(state, 'claim-close', now, 'A claim just closed. Did closing it reveal a neighbor, a class to sweep, or a claim that should exist?', out);
            }
          }
        }

        // spend — tier-free replacement for the retired budget-half nudge
        // (dynamic-range audit fix #1, principal-approved 2026-07-11). Trips on
        // tool-call volume, not time budgets; re-fires on long runs via its own
        // cooldown. Claim 15 stays the check; this is its runtime tooth.
        if (state.toolCallsTotal >= SPEND_THRESHOLD && active.progressOpen
          && cooled(state, 'spend', now, SPEND_COOLDOWN_MS)) {
          fire(state, 'spend', now, `~${state.toolCallsTotal} tool calls in with claims still open. Spend check: is the remaining work worth the remaining spend — escalate, descope, or surface? His explicit call outranks.`, out);
        }
      } else if (!state.lateIsaFired && state.toolCallsTotal >= LATE_ISA_THRESHOLD && !hasRegisteredRun(sessionId)) {
        // ALWAYS-ON: late-ISA. A session this deep with no registered run is
        // either genuinely trivial-iterative or an unwritten climb
        // (dynamic-range audit: 2h of substantive work before the ISA appeared).
        state.lateIsaFired = true;
        fire(state, 'late-isa', now, `${LATE_ISA_THRESHOLD}+ tool calls and no ISA registered. Still trivial, or does done need writing down? If this is a real climb, scaffold the ISA now — nudge coverage starts when it exists.`, out);
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
