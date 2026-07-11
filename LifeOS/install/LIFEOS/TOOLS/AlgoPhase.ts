#!/usr/bin/env bun
/**
 * AlgoPhase.ts — atomic Algorithm phase emitter
 *
 * Called by the Algorithm at every phase transition, BEFORE printing the
 * phase header in chat. Writes the named phase to the current session's row
 * in work.json so the Pulse Agents dashboard reflects reality in <100ms,
 * independent of any subsequent ISA.md edit.
 *
 * Usage:
 *   bun ~/.claude/LIFEOS/TOOLS/AlgoPhase.ts <phase> [--slug X] [--uuid X] [--iteration N]
 *
 * Phases (case-insensitive):
 *   observe | think | plan | build | execute | verify | learn | complete | starting
 *
 * Slug resolution priority (deterministic, fail-closed):
 *   1. --slug X (explicit; unknown slug is an error; complete rows allowed —
 *      resume-after-complete is a sanctioned flow)
 *   2. --uuid X (explicit flags outrank ambient env; no live match is an error)
 *   3. row whose sessionUUID === CLAUDE_SESSION_ID env var (set-but-unmatched
 *      is an error, never a fall-through to a guess)
 *   4. the SINGLE fresh live algorithm-mode row in work.json (updated within
 *      the last 60 minutes) — if zero or more than one qualify, the tool
 *      refuses to guess: it errors out listing the candidates and performs
 *      NO write. (Previously it warned and wrote to the most-recent row,
 *      which could flip the OTHER session's phase.)
 *
 * Output:
 *   On success — prints `OK: <slug> <prev>→<phase>` to stdout, exits 0.
 *   On failure — prints `ERR: <reason>` to stderr, exits 1.
 *
 * Side effect: writes work.json atomically (tmp + rename via writeRegistry).
 * Read & write together stay under 100ms p95 on a 50-row work.json.
 */

import { readRegistry, writeRegistry } from '../../hooks/lib/isa-utils';
import { setPhaseTab } from '../../hooks/lib/tab-setter';
import { effortToCanonicalELevel } from '../../hooks/lib/effort';
import type { AlgorithmTabPhase } from '../../hooks/lib/tab-constants';

const VALID_PHASES = new Set([
  'observe', 'think', 'plan', 'build', 'execute', 'verify', 'learn', 'complete', 'starting',
]);

interface Args {
  phase: string;
  slug?: string;
  uuid?: string;
  iteration?: number;
}

function parseArgs(argv: string[]): Args | null {
  if (argv.length === 0) return null;
  if (argv[0] === '--help' || argv[0] === '-h') return null;

  const phase = argv[0].toLowerCase();
  if (!VALID_PHASES.has(phase)) return null;

  let slug: string | undefined;
  let uuid: string | undefined;
  let iteration: number | undefined;

  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--slug' && i + 1 < argv.length) { slug = argv[++i]; continue; }
    if (a === '--uuid' && i + 1 < argv.length) { uuid = argv[++i]; continue; }
    if (a === '--iteration' && i + 1 < argv.length) {
      const n = parseInt(argv[++i], 10);
      if (Number.isFinite(n) && n >= 1) iteration = n;
      continue;
    }
  }

  return { phase, slug, uuid, iteration };
}

function printHelp(): void {
  console.log(`AlgoPhase — atomic Algorithm phase emitter

Usage:
  bun ~/.claude/LIFEOS/TOOLS/AlgoPhase.ts <phase> [--slug X] [--uuid X] [--iteration N]

Phases: observe | think | plan | build | execute | verify | learn | complete | starting

Slug resolution priority (deterministic, fail-closed):
  1. --slug X (unknown slug errors; complete rows allowed for resume)
  2. row with sessionUUID === --uuid X (explicit flag outranks env; no live match errors)
  3. row with sessionUUID === \$CLAUDE_SESSION_ID (set-but-unmatched errors)
  4. the SINGLE live algorithm-mode row updated in the last 60 minutes —
     zero or multiple candidates error out (listed, nothing written)
     instead of guessing

Examples:
  bun ~/.claude/LIFEOS/TOOLS/AlgoPhase.ts think
  bun ~/.claude/LIFEOS/TOOLS/AlgoPhase.ts build --slug 20260524-072107_pulse-agents
  bun ~/.claude/LIFEOS/TOOLS/AlgoPhase.ts verify --uuid 49348c25-a71f-47f1-b038-0f26192f24bf
`);
}

interface Session {
  phase?: string;
  mode?: string;
  currentMode?: string;
  effort?: string;
  sessionUUID?: string;
  updatedAt?: string;
  started?: string;
  lastToolActivity?: string;
  iteration?: number;
  modeHistory?: Array<{ mode: string; startedAt: number; endedAt?: number }>;
}

// Candidate-freshness horizon for the no-flag fallback. Crashed or abandoned
// sessions leave non-complete rows behind (the registry's stale sweep only
// prunes them after ~7 days, and SessionCleanup fires only on a clean
// SessionEnd), so "not complete" alone is far too weak a liveness signal —
// fail-closed against week-old ghosts would hard-fail every bare call. A
// session actively running the Algorithm touches its row on every phase emit
// and tool-activity hook, so an hour of silence means the row is not driving
// anything right now. Stale rows are only excluded from GUESSING — they stay
// addressable explicitly via --slug or --uuid.
const CANDIDATE_FRESH_MS = 60 * 60 * 1000;

/** Millisecond timestamp of a row's last update (0 when unparseable). */
function rowUpdatedMs(s: Session): number {
  const t = new Date(s.updatedAt || s.started || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

/** Fresh live algorithm-mode rows, most recently updated first. */
function listAlgorithmModeRows(sessions: Record<string, Session>, nowMs: number): string[] {
  const rows: Array<{ slug: string; t: number }> = [];
  for (const [slug, s] of Object.entries(sessions)) {
    if (slug === '__pulse_strip') continue;
    if (s.phase === 'complete') continue;
    const isAlgo = s.currentMode === 'algorithm'
      || s.mode === 'starting'
      || (s.mode === 'interactive' && s.phase && s.phase !== 'native');
    if (!isAlgo) continue;
    const t = rowUpdatedMs(s);
    if (nowMs - t > CANDIDATE_FRESH_MS) continue;
    rows.push({ slug, t });
  }
  rows.sort((a, b) => b.t - a.t);
  return rows.map((r) => r.slug);
}

/** Most recently updated live (non-complete) row matching a session UUID. */
function findLiveByUUID(sessions: Record<string, Session>, uuid: string): string | null {
  let best: { slug: string; t: number } | null = null;
  for (const [slug, s] of Object.entries(sessions)) {
    if (slug === '__pulse_strip') continue;
    if (s.sessionUUID !== uuid || s.phase === 'complete') continue;
    const t = rowUpdatedMs(s);
    if (!best || t > best.t) best = { slug, t };
  }
  return best ? best.slug : null;
}

type SlugResolution = { ok: true; slug: string } | { ok: false; reason: string };

function resolveSlug(args: Args, sessions: Record<string, Session>): SlugResolution {
  // 1. explicit --slug — trusted verbatim, INCLUDING phase:complete rows:
  // resume-after-complete is a sanctioned flow, and an explicit slug is the
  // caller stating exactly which row it owns. Object.hasOwn (not `in`) so
  // prototype keys like "constructor" can't false-match; the __pulse_strip
  // metadata row is never addressable from any path.
  if (args.slug) {
    if (args.slug === '__pulse_strip' || !Object.hasOwn(sessions, args.slug)) {
      return { ok: false, reason: `slug "${args.slug}" not found in work.json` };
    }
    if (args.uuid && sessions[args.slug].sessionUUID !== args.uuid) {
      return {
        ok: false,
        reason: `--slug "${args.slug}" and --uuid "${args.uuid}" disagree — ` +
          `that row has sessionUUID "${sessions[args.slug].sessionUUID ?? 'none'}"`,
      };
    }
    return { ok: true, slug: args.slug };
  }

  // 2. explicit --uuid — outranks ambient CLAUDE_SESSION_ID (an explicit flag
  // must never be silently overridden by environment state); unmatched is an
  // error, never a fall-through guess.
  if (args.uuid) {
    const slug = findLiveByUUID(sessions, args.uuid);
    return slug
      ? { ok: true, slug }
      : { ok: false, reason: `no live session with sessionUUID "${args.uuid}" in work.json` };
  }

  // 3. CLAUDE_SESSION_ID env — forward-looking defense-in-depth (Claude Code
  // does not export it to tool subprocesses today) and local-trust only, NOT
  // an auth boundary. Set-but-unmatched is a hard error: falling through to
  // a guess would reintroduce the ambiguity this resolver exists to close.
  const envUUID = process.env.CLAUDE_SESSION_ID;
  if (envUUID) {
    const slug = findLiveByUUID(sessions, envUUID);
    return slug
      ? { ok: true, slug }
      : { ok: false, reason: `CLAUDE_SESSION_ID "${envUUID}" matches no live session in work.json — pass --slug` };
  }

  // 4. Fail-closed disambiguation. The old behavior warned and then WROTE to
  // the most-recent algorithm-mode row anyway — with two Algorithm sessions
  // alive, a bare `AlgoPhase think` from one session could flip the OTHER
  // session's phase. Exactly one fresh live row is unambiguous and stays the
  // convenience path; anything else refuses and performs no write.
  const candidates = listAlgorithmModeRows(sessions, Date.now());
  if (candidates.length === 1) {
    process.stderr.write(
      `NOTE: AlgoPhase resolved the single live algorithm-mode row "${candidates[0]}" (no --slug/--uuid/CLAUDE_SESSION_ID given).\n`
    );
    return { ok: true, slug: candidates[0] };
  }
  if (candidates.length === 0) {
    return { ok: false, reason: 'no live algorithm-mode session found in work.json (rows idle >60min are not guessable) — pass --slug or --uuid' };
  }
  return {
    ok: false,
    reason: `${candidates.length} live algorithm-mode sessions are ambiguous — refusing to guess (no write performed). ` +
      `Candidates: ${candidates.join(', ')}. Pass --slug or --uuid (or set CLAUDE_SESSION_ID).`,
  };
}

function main(): number {
  const args = parseArgs(process.argv.slice(2));
  if (!args) {
    printHelp();
    process.exit(args === null && process.argv[2] !== '--help' && process.argv[2] !== '-h' ? 1 : 0);
  }

  const registry = readRegistry();
  const sessions = registry.sessions as Record<string, Session>;

  const resolved = resolveSlug(args, sessions);
  if (!resolved.ok) {
    process.stderr.write(`ERR: ${resolved.reason}\n`);
    return 1;
  }
  const slug = resolved.slug;

  const session = sessions[slug];
  if (!session) {
    process.stderr.write(`ERR: slug "${slug}" not found in work.json\n`);
    return 1;
  }

  const prev = session.phase || 'unknown';
  const now = new Date().toISOString();

  // 2026-05-24 (realtime-phase-tracking): If session is currently a 'native'
  // placeholder for an algorithm session (created by PromptProcessing before
  // TheRouter pre-emit landed), upgrade it in place. Otherwise just set
  // the phase.
  if ((session.mode === 'native' || session.mode === 'starting') && args.phase !== 'starting') {
    session.mode = 'interactive';
  }
  session.phase = args.phase;
  session.updatedAt = now;
  session.lastToolActivity = now;

  // Track mode-history: if we're entering an algorithm phase from non-algorithm,
  // push a transition. Idempotent: same mode → no push.
  const modeHistory = session.modeHistory || [];
  const lastMode = modeHistory.length > 0 ? modeHistory[modeHistory.length - 1] : null;
  if (!lastMode || lastMode.mode !== 'algorithm') {
    if (lastMode && !lastMode.endedAt) lastMode.endedAt = Date.now();
    modeHistory.push({ mode: 'algorithm', startedAt: Date.now() });
    session.modeHistory = modeHistory;
  }
  session.currentMode = 'algorithm';

  if (args.iteration !== undefined) {
    session.iteration = args.iteration;
  }

  writeRegistry(registry);

  // 2026-07-01: stamp the kitty tab from the SAME operational write that updated
  // work.json, so the tab and the Pulse Agents/Lattice page stay congruent at every
  // phase transition. Previously the tab moved ONLY on ISA edits (ISASync); a phase
  // advanced via AlgoPhase left the tab stale. Idempotent with ISASync (both produce
  // E{tier} + phase icon). Resolves the window via the row's sessionUUID and the tier
  // via the row's effort. stderr/kitten-only — never pollutes this tool's stdout.
  try {
    const tabPhase = args.phase.toUpperCase();
    const VALID_TAB_PHASES = new Set(['OBSERVE', 'THINK', 'PLAN', 'BUILD', 'EXECUTE', 'VERIFY', 'LEARN', 'COMPLETE']);
    if (VALID_TAB_PHASES.has(tabPhase) && session.sessionUUID) {
      const eLevel = /^E[1-5]$/.test(session.effort || '')
        ? session.effort
        : (effortToCanonicalELevel(session.effort) || undefined);
      setPhaseTab(tabPhase as AlgorithmTabPhase, session.sessionUUID, undefined, eLevel);
    }
  } catch (err) {
    process.stderr.write(`WARN: AlgoPhase tab stamp failed: ${err instanceof Error ? err.message : String(err)}\n`);
  }

  process.stdout.write(`OK: ${slug} ${prev}→${args.phase}\n`);
  return 0;
}

// Honor --help / -h cleanly
if (process.argv[2] === '--help' || process.argv[2] === '-h') {
  printHelp();
  process.exit(0);
}

try {
  process.exit(main());
} catch (err) {
  process.stderr.write(`ERR: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
}
