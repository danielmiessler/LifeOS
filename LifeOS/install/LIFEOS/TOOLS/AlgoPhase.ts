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
 * Slug resolution priority (all deterministic — no guessing):
 *   1. --slug X (explicit)
 *   2. row whose sessionUUID === CLAUDE_SESSION_ID env var
 *   3. row whose sessionUUID === --uuid X
 *   (no most-recent-row fallback — an unidentified session errors instead of
 *    silently bumping an unrelated row; see resolveSlug)
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

Slug resolution priority (deterministic only):
  1. --slug X
  2. row with sessionUUID === \$CLAUDE_SESSION_ID
  3. row with sessionUUID === --uuid X
  (no most-recent-row fallback — unidentified session errors)

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

export function resolveSlug(args: Args, sessions: Record<string, Session>): string | null {
  // 1. explicit --slug
  if (args.slug) return args.slug in sessions ? args.slug : null;

  // 2. CLAUDE_SESSION_ID env
  const envUUID = process.env.CLAUDE_SESSION_ID;
  if (envUUID) {
    for (const [slug, s] of Object.entries(sessions)) {
      if (s.sessionUUID === envUUID && s.phase !== 'complete') return slug;
    }
  }

  // 3. --uuid
  if (args.uuid) {
    for (const [slug, s] of Object.entries(sessions)) {
      if (s.sessionUUID === args.uuid && s.phase !== 'complete') return slug;
    }
  }

  // No deterministic identifier resolved. Do NOT fall back to the most-recent
  // algorithm-mode row — that guess silently bumped an unrelated session's phase
  // (observed during the LifeOS v6 migration, 2026-07-06). Return null so main()
  // errors instead of writing to the wrong row. Callers must pass --slug/--uuid
  // or set CLAUDE_SESSION_ID.
  return null;
}

function main(): number {
  const args = parseArgs(process.argv.slice(2));
  if (!args) {
    printHelp();
    process.exit(args === null && process.argv[2] !== '--help' && process.argv[2] !== '-h' ? 1 : 0);
  }

  const registry = readRegistry();
  const sessions = registry.sessions as Record<string, Session>;

  const slug = resolveSlug(args, sessions);
  if (!slug) {
    process.stderr.write('ERR: no algorithm-mode session found in work.json — pass --slug or --uuid\n');
    return 1;
  }

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
