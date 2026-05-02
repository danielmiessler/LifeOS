/**
 * tab-setter.ts - Unified tab state setter.
 *
 * Single function that:
 * 1. Sets Kitty tab title and color via remote control, OR
 * 2. Sets cmux sidebar status/progress/log via CLI
 * 3. Persists per-window state for daemon recovery
 *
 * Auto-detects terminal: cmux (CMUX_WORKSPACE_ID) vs Kitty (KITTY_LISTEN_ON).
 * All hooks call setTabState() instead of directly running terminal commands.
 */

import { existsSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { TAB_COLORS, PHASE_TAB_CONFIG, ACTIVE_TAB_BG, ACTIVE_TAB_FG, INACTIVE_TAB_FG, type TabState, type AlgorithmTabPhase } from './tab-constants';

/** Detect if we're running inside cmux */
function isCmux(): boolean {
  return !!(process.env.CMUX_WORKSPACE_ID || process.env.CMUX_SOCKET_PATH);
}

/** Map TabState to cmux log level for visual differentiation */
function stateToCmuxLogLevel(state: TabState): string {
  switch (state) {
    case 'thinking':  return 'progress';
    case 'working':   return 'info';
    case 'question':  return 'warning';
    case 'completed': return 'success';
    case 'error':     return 'error';
    case 'idle':      return 'info';
    default:          return 'info';
  }
}

/** Map Algorithm phase to cmux log level */
function phaseToCmuxLogLevel(phase: string): string {
  switch (phase) {
    case 'OBSERVE':  return 'info';
    case 'THINK':    return 'progress';
    case 'PLAN':     return 'progress';
    case 'BUILD':    return 'info';
    case 'EXECUTE':  return 'warning';
    case 'VERIFY':   return 'success';
    case 'LEARN':    return 'success';
    case 'COMPLETE': return 'success';
    case 'IDLE':     return 'info';
    default:         return 'info';
  }
}

/**
 * Set cmux sidebar metadata for the current workspace.
 * Uses status pills for phase/session, log for activity, progress for ISC completion.
 */
function setCmuxState(title: string, state: TabState, phase?: string): void {
  try {
    const logLevel = phase ? phaseToCmuxLogLevel(phase) : stateToCmuxLogLevel(state);
    const config = phase ? PHASE_TAB_CONFIG[phase] : null;
    const phaseLabel = config ? `${config.symbol} ${phase}` : state.toUpperCase();

    // Status pill: shows current phase/state at a glance
    execSync(`cmux set-status phase "${phaseLabel}"`, { stdio: 'ignore', timeout: 2000 });

    // Log entry: shows what's happening with color-coded level
    const escaped = title.replace(/"/g, '\\"');
    execSync(`cmux log ${logLevel} "${escaped}"`, { stdio: 'ignore', timeout: 2000 });

    // Clear on idle/complete
    if (state === 'idle') {
      execSync(`cmux clear-status phase`, { stdio: 'ignore', timeout: 2000 });
      execSync(`cmux clear-progress`, { stdio: 'ignore', timeout: 2000 });
      execSync(`cmux clear-log`, { stdio: 'ignore', timeout: 2000 });
    }

    console.error(`[tab-setter] cmux sidebar: "${phaseLabel}" — ${escaped}`);
  } catch (err) {
    console.error(`[tab-setter] cmux error:`, err);
  }
}

// Generic phase gerunds that must never carry over between phases.
// Includes both current short gerunds AND legacy long-form ones that may persist in stale state files.
const GENERIC_PHASE_GERUNDS = new Set([
  ...Object.values(PHASE_TAB_CONFIG).map(c => c.gerund).filter(g => g.length > 0),
  'Observing the user request.', 'Analyzing the problem space.',
  'Planning the execution approach.', 'Building the solution artifacts.',
  'Executing the planned work.', 'Verifying ideal state criteria.',
  'Recording the session learnings.',
]);
import { getStateDir } from './paths';

const TAB_TITLES_DIR = join(getStateDir(), 'tab-titles');
const KITTY_SESSIONS_DIR = join(getStateDir(), 'kitty-sessions');

/**
 * Resolve the `kitten` binary path. When tab-setter runs from the Claude Code
 * process (inherits user PATH) `kitten` is on PATH. When it runs from the Pulse
 * daemon (launchd-restricted PATH) `kitten` is not on PATH and execSync fails
 * with "command not found". Fall back to the kitty.app location.
 */
let kittenBinCached: string | null = null;
function kittenBin(): string {
  if (kittenBinCached) return kittenBinCached;
  try {
    const path = execSync('command -v kitten', { encoding: 'utf-8', timeout: 1000 }).trim();
    if (path) { kittenBinCached = path; return path; }
  } catch { /* fall through */ }
  kittenBinCached = '/Applications/kitty.app/Contents/MacOS/kitten';
  return kittenBinCached;
}

/**
 * Get Kitty environment from env vars or persisted per-session file.
 *
 * Resolution order:
 * 1. Process env vars (direct terminal context — always correct)
 * 2. Per-session file: kitty-sessions/{sessionId}.json (no shared state, no races)
 * 3. Default socket at /tmp/kitty-$USER (fallback for socket-only configs)
 *
 * IMPORTANT: listenOn MUST be set for remote control to work safely.
 * Without it, kitten @ commands fall back to escape-sequence IPC which
 * leaks garbage text into the terminal output. See PR #493.
 */
function getKittyEnv(sessionId?: string): { listenOn: string | null; windowId: string | null } {
  // Try environment first (direct terminal calls)
  let listenOn = process.env.KITTY_LISTEN_ON || null;
  let windowId = process.env.KITTY_WINDOW_ID || null;
  if (listenOn && windowId) return { listenOn, windowId };

  // Per-session file lookup (preferred — no shared mutable state)
  if (sessionId) {
    try {
      const sessionPath = join(KITTY_SESSIONS_DIR, `${sessionId}.json`);
      if (existsSync(sessionPath)) {
        const entry = JSON.parse(readFileSync(sessionPath, 'utf-8'));
        listenOn = listenOn || entry.listenOn || null;
        windowId = windowId || entry.windowId || null;
        if (listenOn && windowId) return { listenOn, windowId };
      }
    } catch { /* silent */ }
  }

  // Fallback: check default socket path used by kitty's listen_on config.
  // This prevents escape-sequence IPC when KITTY_LISTEN_ON isn't propagated
  // to subprocess contexts (the root cause of terminal garbage in #493).
  if (!listenOn) {
    const defaultSocket = `/tmp/kitty-${process.env.USER}`;
    try {
      if (existsSync(defaultSocket)) {
        listenOn = `unix:${defaultSocket}`;
      }
    } catch { /* silent */ }
  }

  // Log when kitty env lookup fails with a session ID (diagnostic for compaction issues)
  if (sessionId && !listenOn && !windowId) {
    console.error(`[tab-setter] getKittyEnv: no kitty env found for session ${sessionId.slice(0, 8)} (no env vars, no session file, no default socket)`);
  }

  return { listenOn, windowId };
}

/**
 * Persist a session's Kitty environment for later hook lookups.
 * Called by KittyEnvPersist at session start.
 *
 * Each session gets its own file: kitty-sessions/{sessionId}.json
 * - No shared mutable state (concurrent session starts are safe)
 * - No unbounded growth (files cleaned up on session end)
 * - Simple atomic write (no read-modify-write cycle)
 *
 */
export function persistKittySession(sessionId: string, listenOn: string, windowId: string): void {
  try {
    if (!existsSync(KITTY_SESSIONS_DIR)) mkdirSync(KITTY_SESSIONS_DIR, { recursive: true });
    writeFileSync(
      join(KITTY_SESSIONS_DIR, `${sessionId}.json`),
      JSON.stringify({ listenOn, windowId }),
      'utf-8'
    );
  } catch { /* silent */ }
}

/**
 * Remove a session's persisted Kitty environment file.
 * Called by SessionSummary at session end.
 */
export function cleanupKittySession(sessionId: string): void {
  try {
    const sessionPath = join(KITTY_SESSIONS_DIR, `${sessionId}.json`);
    if (existsSync(sessionPath)) unlinkSync(sessionPath);
  } catch { /* silent */ }
}

interface SetTabOptions {
  title: string;
  state: TabState;
  previousTitle?: string;
  sessionId?: string;
}

/**
 * Clean up state files for kitty windows that no longer exist.
 * Runs opportunistically on each setTabState call (lightweight).
 */
function cleanupStaleStateFiles(): void {
  try {
    if (!existsSync(TAB_TITLES_DIR)) return;
    const files = readdirSync(TAB_TITLES_DIR).filter(f => f.endsWith('.json'));
    if (files.length === 0) return;

    // Get live window IDs from kitty via socket (prevents escape sequence leaks)
    const defaultSocket = `/tmp/kitty-${process.env.USER}`;
    const socketPath = process.env.KITTY_LISTEN_ON || (existsSync(defaultSocket) ? `unix:${defaultSocket}` : null);
    if (!socketPath) return; // No socket — skip cleanup to avoid escape sequence IPC
    const liveOutput = execSync(`kitten @ --to="${socketPath}" ls 2>/dev/null | jq -r ".[].tabs[].windows[].id" 2>/dev/null`, {
      encoding: 'utf-8', timeout: 2000,
    }).trim();
    if (!liveOutput) return;

    const liveIds = new Set(liveOutput.split('\n').map(id => id.trim()));

    for (const file of files) {
      const winId = file.replace('.json', '');
      if (!liveIds.has(winId)) {
        try { unlinkSync(join(TAB_TITLES_DIR, file)); } catch { /* silent */ }
      }
    }
  } catch { /* silent — cleanup is best-effort */ }
}

export function setTabState(opts: SetTabOptions): void {
  const { title, state, previousTitle, sessionId } = opts;
  const colors = TAB_COLORS[state];

  // cmux path: use sidebar metadata instead of Kitty remote control
  if (isCmux()) {
    setCmuxState(title, state);
    return;
  }

  const kittyEnv = getKittyEnv(sessionId);

  try {
    // Need either TERM=xterm-kitty OR a valid KITTY_LISTEN_ON to proceed
    const isKitty = process.env.TERM === 'xterm-kitty' || kittyEnv.listenOn;
    if (!isKitty) return;

    // CRITICAL: Always use --to flag for socket-based remote control.
    // Without it, kitten @ falls back to escape-sequence IPC which leaks
    // garbage text (e.g. "P@kitty-cmd{...}") into terminal output when
    // running in subprocess contexts. See PR #493.
    if (!kittyEnv.listenOn) {
      console.error(`[tab-setter] No kitty socket available, skipping tab update to prevent escape sequence leaks`);
      return;
    }

    const escaped = title.replace(/"/g, '\\"');
    // Set BOTH tab title AND window title. Kitty's tab_title_template uses
    // {active_window.title} (the window title). OSC escape codes from Claude Code
    // reset set-tab-title overrides, so the template falls back to window title.
    // By setting both, our title survives OSC resets.
    const toFlag = `--to="${kittyEnv.listenOn}"`;
    // When called from a process without a focused kitty window (e.g. the Pulse
    // daemon) we must target by window id — otherwise kitten defaults to the
    // currently focused window, which may belong to a different session.
    const matchFlag = kittyEnv.windowId ? `--match="id:${kittyEnv.windowId}"` : '';
    const kitten = kittenBin();
    console.error(`[tab-setter] Setting tab: "${escaped}" with toFlag: ${toFlag} matchFlag: ${matchFlag}`);
    execSync(`"${kitten}" @ ${toFlag} set-tab-title ${matchFlag} "${escaped}"`, { stdio: 'ignore', timeout: 2000 });
    execSync(`"${kitten}" @ ${toFlag} set-window-title ${matchFlag} "${escaped}"`, { stdio: 'ignore', timeout: 2000 });

    // set-tab-color targets the current tab (--self) or a matched tab. Keep --self
    // when called from the tab's own process; add --match when called externally.
    const colorTarget = matchFlag || '--self';
    if (state === 'idle') {
      execSync(
        `"${kitten}" @ ${toFlag} set-tab-color ${colorTarget} active_bg=none active_fg=none inactive_bg=none inactive_fg=none`,
        { stdio: 'ignore', timeout: 2000 }
      );
    } else {
      execSync(
        `"${kitten}" @ ${toFlag} set-tab-color ${colorTarget} active_bg=${ACTIVE_TAB_BG} active_fg=${ACTIVE_TAB_FG} inactive_bg=${colors.inactiveBg} inactive_fg=${INACTIVE_TAB_FG}`,
        { stdio: 'ignore', timeout: 2000 }
      );
    }
    console.error(`[tab-setter] Tab commands completed successfully`);
  } catch (err) {
    console.error(`[tab-setter] Error setting tab:`, err);
  }

  // Persist per-window state (or clean up on idle/session end)
  const windowId = kittyEnv.windowId;
  if (!windowId) return;

  try {
    if (state === 'idle') {
      // Session ended — remove state file so no stale data lingers
      const statePath = join(TAB_TITLES_DIR, `${windowId}.json`);
      if (existsSync(statePath)) unlinkSync(statePath);
    } else {
      if (!existsSync(TAB_TITLES_DIR)) mkdirSync(TAB_TITLES_DIR, { recursive: true });
      const stateData: Record<string, unknown> = {
        title,
        inactiveBg: colors.inactiveBg,
        state,
        timestamp: new Date().toISOString(),
      };
      if (previousTitle) stateData.previousTitle = previousTitle;
      writeFileSync(join(TAB_TITLES_DIR, `${windowId}.json`), JSON.stringify(stateData), 'utf-8');
    }
  } catch { /* silent */ }

  // Opportunistic cleanup of stale state files for dead windows
  cleanupStaleStateFiles();
}

/**
 * Read per-window state file. Returns null if not found or invalid.
 */
export function readTabState(sessionId?: string): { title: string; state: TabState; previousTitle?: string; phase?: string } | null {
  const kittyEnv = getKittyEnv(sessionId);
  const windowId = kittyEnv.windowId;
  if (!windowId) return null;
  try {
    const statePath = join(TAB_TITLES_DIR, `${windowId}.json`);
    if (!existsSync(statePath)) return null;
    const raw = JSON.parse(readFileSync(statePath, 'utf-8'));
    return {
      title: raw.title || '',
      state: raw.state || 'idle',
      previousTitle: raw.previousTitle,
      phase: raw.phase,
    };
  } catch { return null; }
}

/**
 * Strip emoji prefix from a tab title to get raw text.
 * Handles both working-state prefixes (🧠⚙️✓❓) and Algorithm phase symbols (👁️📋🔨⚡✅📚).
 */
export function stripPrefix(title: string): string {
  return title.replace(/^(?:🧠|⚙️|⚙|✓|❓|👁️|📋|🔨|⚡|✅|📚)\s*/, '').trim();
}

// Noise words to skip when extracting the session label
const SESSION_NOISE = new Set([
  'the', 'a', 'an', 'and', 'or', 'for', 'to', 'in', 'on', 'of', 'with',
  'my', 'our', 'new', 'old', 'fix', 'add', 'update', 'set', 'get',
]);

/**
 * Extract up to 4 representative words from a session name.
 * "Surface Filter Bar Redesign" → "SURFACE FILTER BAR REDESIGN"
 * "Voice Server Phase Announcements" → "VOICE SERVER PHASE ANNOUNCEMENTS"
 * Returns uppercase. Filters noise words but keeps up to 4 meaningful ones.
 */
export function getSessionOneWord(sessionId: string): string | null {
  try {
    const namesPath = join(getStateDir(), 'session-names.json');
    if (!existsSync(namesPath)) return null;
    const names = JSON.parse(readFileSync(namesPath, 'utf-8'));
    const fullName = names[sessionId];
    if (!fullName) return null;

    const words = fullName.split(/\s+/).filter((w: string) => w.length > 0);
    if (words.length === 0) return null;

    // Collect up to 4 non-noise words
    const meaningful = words.filter((w: string) => !SESSION_NOISE.has(w.toLowerCase()));
    if (meaningful.length >= 2) {
      return meaningful.slice(0, 4).join(' ').toUpperCase();
    } else if (meaningful.length === 1) {
      // One meaningful word — grab surrounding words for context
      const idx = words.indexOf(meaningful[0]);
      const nearby = words.slice(Math.max(0, idx - 1), idx + 3).filter((w: string) => w.length > 0);
      return nearby.slice(0, 4).join(' ').toUpperCase();
    }
    // All noise — take first four
    return words.slice(0, 4).join(' ').toUpperCase();
  } catch {
    return null;
  }
}

/**
 * Set tab title and color for an Algorithm phase.
 * Active format:    {SYMBOL} {ONE_WORD} | {PHASE}
 * Complete format:  {ONE_WORD} | {summary}
 *
 * Called on algorithm phase transitions.
 */
export function setPhaseTab(phase: AlgorithmTabPhase, sessionId: string, summary?: string): void {
  const config = PHASE_TAB_CONFIG[phase];
  if (!config) return;

  const oneWord = getSessionOneWord(sessionId) || 'WORKING';
  const kittyEnv = getKittyEnv(sessionId);

  // Build title based on phase
  let title: string;
  if (phase === 'COMPLETE' && summary) {
    title = `✅ ${summary}`;
  } else if (phase === 'COMPLETE') {
    // No summary extracted — use session name instead of generic "Done."
    title = `✅ ${oneWord}`;
  } else if (phase === 'IDLE') {
    title = oneWord;
  } else {
    // Preserve existing working description from UpdateTabTitle if available.
    // Only swap the emoji prefix to show current phase — keep the real task context.
    let existingDesc = '';
    const currentState = readTabState(sessionId);
    if (currentState?.title) {
      const pipeIdx = currentState.title.indexOf('|');
      if (pipeIdx !== -1) {
        existingDesc = currentState.title.slice(pipeIdx + 1).trim();
      } else {
        // No pipe — strip emoji prefix to get raw description (e.g., "🧠 Fixing auth bug." → "Fixing auth bug.")
        existingDesc = stripPrefix(currentState.title);
      }
    }
    // Never carry over generic phase gerunds — they're not real task descriptions
    if (GENERIC_PHASE_GERUNDS.has(existingDesc)) existingDesc = '';
    const desc = existingDesc || config.gerund;
    title = `${config.symbol} ${oneWord} | ${desc}`;
  }

  // cmux path: use sidebar metadata for phase display
  if (isCmux()) {
    setCmuxState(title, phase === 'COMPLETE' ? 'completed' : phase === 'IDLE' ? 'idle' : 'working', phase);
    // Also set progress based on phase number (1-7 scale)
    const phaseProgress: Record<string, number> = {
      OBSERVE: 0.14, THINK: 0.28, PLAN: 0.42, BUILD: 0.57, EXECUTE: 0.71, VERIFY: 0.85, LEARN: 1.0, COMPLETE: 1.0, IDLE: 0,
    };
    try {
      const progress = phaseProgress[phase] ?? 0;
      if (progress > 0) {
        execSync(`cmux set-progress ${progress}`, { stdio: 'ignore', timeout: 2000 });
      } else {
        execSync(`cmux clear-progress`, { stdio: 'ignore', timeout: 2000 });
      }
    } catch { /* silent */ }
    return;
  }

  try {
    const isKitty = process.env.TERM === 'xterm-kitty' || kittyEnv.listenOn;
    if (!isKitty) return;

    // CRITICAL: Require socket for remote control. See PR #493.
    if (!kittyEnv.listenOn) {
      console.error(`[tab-setter] No kitty socket available, skipping phase tab update`);
      return;
    }

    const escaped = title.replace(/"/g, '\\"');
    const toFlag = `--to="${kittyEnv.listenOn}"`;
    const matchFlag = kittyEnv.windowId ? `--match="id:${kittyEnv.windowId}"` : '';
    const colorTarget = matchFlag || '--self';
    const kitten = kittenBin();

    execSync(`"${kitten}" @ ${toFlag} set-tab-title ${matchFlag} "${escaped}"`, { stdio: 'ignore', timeout: 2000 });
    execSync(`"${kitten}" @ ${toFlag} set-window-title ${matchFlag} "${escaped}"`, { stdio: 'ignore', timeout: 2000 });

    if (phase === 'IDLE') {
      execSync(
        `"${kitten}" @ ${toFlag} set-tab-color ${colorTarget} active_bg=none active_fg=none inactive_bg=none inactive_fg=none`,
        { stdio: 'ignore', timeout: 2000 }
      );
    } else {
      execSync(
        `"${kitten}" @ ${toFlag} set-tab-color ${colorTarget} active_bg=${ACTIVE_TAB_BG} active_fg=${ACTIVE_TAB_FG} inactive_bg=${config.inactiveBg} inactive_fg=${INACTIVE_TAB_FG}`,
        { stdio: 'ignore', timeout: 2000 }
      );
    }
    console.error(`[tab-setter] Phase tab: "${escaped}" (${phase}, bg=${config.inactiveBg})`);
  } catch (err) {
    console.error(`[tab-setter] Error setting phase tab:`, err);
  }

  // Persist per-window state
  const windowId = kittyEnv.windowId;
  if (!windowId) return;

  try {
    if (!existsSync(TAB_TITLES_DIR)) mkdirSync(TAB_TITLES_DIR, { recursive: true });
    writeFileSync(join(TAB_TITLES_DIR, `${windowId}.json`), JSON.stringify({
      title,
      inactiveBg: config.inactiveBg,
      state: phase === 'COMPLETE' ? 'completed' : 'working',
      phase,
      timestamp: new Date().toISOString(),
    }), 'utf-8');
  } catch { /* silent */ }
}
