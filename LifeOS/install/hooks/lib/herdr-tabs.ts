/**
 * herdr-tabs.ts - Herdr backend for the tab painter.
 *
 * Inside herdr every session shares ONE kitty window (the herdr client), and the
 * `herdr` shell wrapper hides the terminal's tab bar, so the kitty path paints a tab
 * nobody sees. Herdr's own sidebar labels a workspace after the directory it
 * opened in, which is `~` for every session launched from home. This backend
 * sends the composed title to herdr instead: the pane's herdr tab always, and
 * the workspace (the sidebar row) when the pane sits in the workspace's first tab,
 * so a second session in the same workspace never steals the sidebar name.
 *
 * Herdr sets HERDR_ENV=1 and HERDR_PANE_ID in every pane. A writer with no pane
 * env (the Pulse voice daemon) does not paint herdr.
 */

import { fitNameLines, SURFACE_WIDTHS } from './fit-name';
import { closerPattern } from './identity';
import { getClaudeDir, getLifeosDir } from './paths';
import { getNotificationChannel } from './notification-channel';
import { execFileSync, spawn } from 'child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'fs';
import { basename, join } from 'path';
import { invariant, InvariantViolation } from '../../LIFEOS/TOOLS/Invariant';
import { ASCENT } from '../../LIFEOS/TOOLS/ascent';
import { kindTokens, workKindIcon } from './work-kind';
import { stripVoiceTags } from '../../LIFEOS/TOOLS/VoiceTags';

// Herdr's ids are base-36-ish counters, not decimals: this machine has run
// workspaces wC, wD, wE and wF, whose panes a `\d+` pattern refused outright, so
// their sidebar rows never got painted (2026-09-18). Alphanumeric after each
// letter accepts every real id and still refuses '', 'w6', '--help',
// 'w6:p1; rm' and '../w6:p1'.
const PANE_ID_RE = /^w[0-9A-Za-z]+:p[0-9A-Za-z]+$/;
const WORKSPACE_ID_RE = /^w[0-9A-Za-z]+$/;
// Herdr caps the expanded sidebar at 36 columns by default; longer labels clip.
const MAX_LABEL = 60;
// The spaces row is the one surface with room for more of the session name than the
// one-line label every other surface shares: two lines (2026-09-18), each as
// wide as herdr's sidebar_width leaves for the name. Herdr rows never wrap, so line
// two rides on the `$name2` token.
export const SPACE_LINE_MAX = SURFACE_WIDTHS.sidebar.cols;
// A herdr style rule can only match the token it styles, and line two carries no glyph,
// so line two is reported under a token named for the glyph line one leads with. The
// config gives each of these tokens the fg its glyph gives line one, which keeps both
// lines of a title one colour. Mirrors the `starts_with` rules in config.toml.
// The ascent glyphs are resolved through ascent.ts, the one table of run states
// and their icons, so changing an icon there changes this map with it. The two
// non-ascent glyphs (a waiting pane, a quick one-off) have no ascent state and
// are named here.
const NAME2_TOKEN_BY_ASCENT: Partial<Record<keyof typeof ASCENT, string>> = {
  marking: 'name2_mark', ascending: 'name2_climb', anchoring: 'name2_anchor',
  camped: 'name2_camp', cairn: 'name2_cairn',
};
const NAME2_TOKEN_BY_GLYPH: Record<string, string> = {
  '⏳': 'name2_wait', '⚡': 'name2_quick',
  ...Object.fromEntries(
    Object.entries(NAME2_TOKEN_BY_ASCENT).map(([state, token]) => [ASCENT[state as keyof typeof ASCENT].icon, token]),
  ),
};
const NAME2_DEFAULT = 'name2';
// Sidebar tokens sit inside one row next to the label, so a long value pushes
// the rest of the row off screen. 40 chars is already past the clip point.
const MAX_TOKEN_VALUE = 40;
// Herdr's own token syntax: `$name` in the row template. Anything else cannot
// be placed in a config and has no business reaching the CLI.
const TOKEN_NAME_RE = /^[a-z][a-z0-9_]*$/;
// Herdr refuses a report that sets or clears more than 16 tokens (`invalid_metadata_token`,
// found 2026-10-15 when the kind symbols pushed the line-two report to 19). The builder asserts
// it, so an overflow fails a test instead of silently dropping a whole row's update.
export const HERDR_MAX_TOKENS = 16;
// One stable reporter identity, so herdr attributes every token LifeOS writes to
// the same source and a later report replaces the earlier one.
const SOURCE = 'lifeos';

/** This process's herdr pane id, or null outside herdr. */
export function herdrPaneId(): string | null {
  if (process.env.HERDR_ENV !== '1') return null;
  // A headless process has no pane of its own; HERDR_* came from whoever spawned it,
  // so any pane it named would be someone else's (Bridge.test.ts renamed a live tab).
  if (getNotificationChannel() === 'headless') return null;
  const pane = process.env.HERDR_PANE_ID || '';
  return PANE_ID_RE.test(pane) ? pane : null;
}

/** Per-pane key for the tab-titles state file. The kitty window id cannot key it
 * inside herdr: every herdr session shares the client's one kitty window. */
export function herdrStateKey(): string | null {
  const pane = herdrPaneId();
  return pane ? `herdr-${pane.replace(':', '-')}` : null;
}

/** Split `{glyph} {LABEL} | {description}` at the first pipe. No pipe → head only. */
export function splitTitle(title: string): { head: string; tail: string } {
  const at = title.indexOf(' | ');
  if (at < 0) return { head: title.trim(), tail: '' };
  return { head: title.slice(0, at).trim(), tail: title.slice(at + 3).trim() };
}

/**
 * The spaces-row name for a session: its canonical name, upper-cased like the shared
 * label, fitted over at most two sidebar lines (fitNameLines) and broken where the
 * lines come out most even. Pure.
 */
export function spaceLabelLines(name: string | null | undefined): { line1: string; line2: string } {
  // Two columns go to the kind symbol that leads line one.
  const [line1 = '', line2 = ''] = fitNameLines((name || '').toUpperCase(), SPACE_LINE_MAX - 2, 2);
  return { line1, line2 };
}

/**
 * Line one of the spaces row: the kind-of-work symbol, then the session name's first line
 * (ISA 20261015-herdr-sidebar-status F4, F7). One token on purpose: herdr puts ` · ` between
 * any two text tokens on a row and has no setting to drop it, so a symbol on its own token
 * cost three columns of dot (principal directive, 2026-10-16). Herdr's own state icon already leads the
 * row, so the run-state glyph the head carries is dropped. With no session name yet, the
 * head's words stand in for the name. Pure.
 */
export function spaceRowName(sessionName: string | null | undefined, head: string): string {
  const { line1 } = spaceLabelLines(sessionName);
  const words = head.trim().split(/\s+/);
  const text = line1 || (words[0] && !/[A-Za-z0-9]/.test(words[0]) ? words.slice(1) : words).join(' ') || head;
  return `${workKindIcon(sessionName || text)} ${text}`;
}

/** Every line-two token, with `line2` on the one that matches the glyph and the rest
 * cleared, so a state change never leaves the old colour's line behind. Pure. */
export function lineTwoTokens(glyph: string, line2: string): Record<string, string> {
  const chosen = NAME2_TOKEN_BY_GLYPH[glyph] ?? NAME2_DEFAULT;
  const out: Record<string, string> = {};
  for (const name of [NAME2_DEFAULT, ...Object.values(NAME2_TOKEN_BY_GLYPH)]) out[name] = name === chosen ? line2 : '';
  return out;
}

/** The spaces row shows the WORK; its project token says which codebase that work is in.
 * Sessions launched from LifeOS or home have no distinct codebase, so they give the row back. */
export function workspaceProject(cwd = process.cwd(), home = process.env.HOME || '', installDir = getClaudeDir()): string {
  return cwd !== home && cwd !== installDir ? basename(cwd) : '';
}

let herdrBinCached: string | null = null;
function herdrBin(): string {
  if (herdrBinCached) return herdrBinCached;
  const local = join(process.env.HOME || '', '.local', 'bin', 'herdr');
  herdrBinCached = existsSync(local) ? local : 'herdr';
  return herdrBinCached;
}

function herdrJson(args: string[]): any {
  const raw = execFileSync(herdrBin(), args, { encoding: 'utf-8', timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'] });
  return JSON.parse(raw).result;
}

/** Where a pane sits: its tab, its workspace, and whether it owns the workspace
 * (the pane is in the workspace's FIRST tab), so a second session in the same
 * workspace never steals the sidebar row. Null when herdr cannot place it. */
export function herdrPlacement(pane: string): { tabId: string; workspaceId: string; ownsWorkspace: boolean } | null {
  const info = herdrJson(['pane', 'get', pane])?.pane;
  const tabId: string | undefined = info?.tab_id;
  const workspaceId: string | undefined = info?.workspace_id;
  if (!tabId || !workspaceId) return null;

  const tabs: Array<{ tab_id: string; workspace_id: string; number: number }> = herdrJson(['tab', 'list'])?.tabs ?? [];
  const first = tabs.filter(t => t.workspace_id === workspaceId).sort((a, b) => a.number - b.number)[0];
  return { tabId, workspaceId, ownsWorkspace: !first || first.tab_id === tabId };
}

/** Cut at a word boundary to at most `max` characters. */
function capAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return (cut.replace(/\s+\S*$/, '') || cut).trim();
}

/** What the herdr tab shows, and the head the workspace row is built from. Pure.
 * The title is split at the pipe FIRST and each part is capped on its own: capping
 * the composed string first let a long label eat the description (2026-10-09: "APPROV"). */
export function herdrTabLabels(title: string, ownsWorkspace: boolean): { head: string; tabLabel: string } {
  const { head, tail } = splitTitle(title.trim());
  const cappedHead = capAtWord(head, MAX_LABEL);
  if (!ownsWorkspace) return { head: cappedHead, tabLabel: capAtWord(title.trim(), MAX_LABEL) };
  return { head: cappedHead, tabLabel: capAtWord(tail || head, MAX_LABEL) };
}

/**
 * Paint the composed title onto herdr. Returns true when this process is inside
 * herdr (the caller then skips the kitty path), false otherwise.
 */
export function writeHerdrTab(title: string, sessionName?: string | null): boolean {
  const pane = herdrPaneId();
  if (!pane) return false;
  const label = title.trim();
  if (!label) return true;
  try {
    const placement = herdrPlacement(pane);
    if (!placement) return true;
    const { tabId, workspaceId, ownsWorkspace } = placement;

    // Herdr's agents list renders `{workspace} · {tab}`, so the same string on both
    // reads twice. The owning pane splits the title at the pipe: the workspace takes
    // `{glyph} {SESSION LABEL}`, the tab takes the description. A pane that does not
    // own the workspace keeps the whole title on its tab.
    const { head, tabLabel } = herdrTabLabels(label, ownsWorkspace);
    execFileSync(herdrBin(), ['tab', 'rename', tabId, tabLabel], { stdio: 'ignore', timeout: 2000 });
    if (ownsWorkspace) {
      // The space row gets the longer name when the session has one, led by the kind of
      // work rather than the run-state glyph (herdr's state icon already says the state).
      const { line1, line2 } = spaceLabelLines(sessionName);
      execFileSync(herdrBin(), ['workspace', 'rename', workspaceId, spaceRowName(sessionName, head)], { stdio: 'ignore', timeout: 2000 });
      // The spaces row shows the WORK, and which codebase it is in is the one fact that
      // differs between sessions once the git branch is gone. Line two rides plain `$name2`;
      // lineTwoTokens still clears the per-state variants older rows were painted with.
      const lineTwo = herdrReportArgs('workspace', workspaceId, {
        ...lineTwoTokens('', line1 ? line2 : ''), project: workspaceProject(),
      });
      if (lineTwo) execFileSync(herdrBin(), lineTwo, { stdio: 'ignore', timeout: 2000 });
      // The kind symbol now leads the label itself; clear the `$kind_*` tokens older rows
      // carry. Its own report: with line two it would pass herdr's 16-token cap.
      const kind = herdrReportArgs('workspace', workspaceId, Object.fromEntries(Object.keys(kindTokens('')).map((k) => [k, null])));
      if (kind) execFileSync(herdrBin(), kind, { stdio: 'ignore', timeout: 2000 });
    }
    // The agents row carries no session name: the space row above it already does. A second
    // session sharing a workspace has no space row of its own, so its name rides on `$session`.
    reportHerdrMetadata('pane', { session: ownsWorkspace ? '' : head });
    console.error(`[herdr-tabs] ${pane}: "${label}"`);
  } catch (err) {
    console.error(`[herdr-tabs] Error painting herdr:`, err);
  }
  return true;
}

/** `pane` reports to this process's own pane (herdr's agents rows), `workspace`
 * to the workspace the pane owns (herdr's spaces rows). */
export type HerdrScope = 'pane' | 'workspace';

/** Token values by herdr token name (the `$name` in the sidebar row template).
 * `undefined` means "not mine to say" and is skipped; empty or null clears. */
export type HerdrTokens = Record<string, string | number | null | undefined>;

/** Strip control characters and newlines, collapse the rest, cap the length.
 * A token value crosses a CLI boundary into a one-line sidebar row: a newline
 * would break the row and a long value would push the row off screen. A cut value
 * ends on a whole word plus an ellipsis; a hard cut read as a typo ("and hint ta",
 * 2026-10-13). */
function cleanTokenValue(value: string | number): string {
  const flat = String(value)
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (flat.length <= MAX_TOKEN_VALUE) return flat;
  return `${capAtWord(flat, MAX_TOKEN_VALUE - 1).replace(/[\s,.;:—–-]+$/, '')}…`;
}

/**
 * Build the argv for one `herdr {pane,workspace} report-metadata` call, or null
 * when there is nothing to report. Pure and exported so the argv contract is
 * testable without a herdr binary; an argv array is also the only safe way to
 * carry a value we did not author (no shell string, ever).
 */
export function herdrReportArgs(
  scope: HerdrScope,
  targetId: string,
  tokens: HerdrTokens,
  opts: { ttlMs?: number; displayAgent?: string } = {},
): string[] | null {
  const idOk = scope === 'pane' ? PANE_ID_RE.test(targetId) : WORKSPACE_ID_RE.test(targetId);
  if (!idOk) return null;

  const tail: string[] = [];
  // --display-agent renames the agent shown on the row (herdr's own guess is the
  // binary name, "claude"). Panes have that row; workspaces do not.
  if (scope === 'pane' && opts.displayAgent !== undefined) {
    const agent = cleanTokenValue(opts.displayAgent);
    if (agent) tail.push('--display-agent', agent);
  }
  for (const [name, raw] of Object.entries(tokens)) {
    if (raw === undefined) continue;
    if (!TOKEN_NAME_RE.test(name)) continue;
    const value = raw === null ? '' : cleanTokenValue(raw);
    if (value) tail.push('--token', `${name}=${value}`);
    else tail.push('--clear-token', name);
  }
  if (!tail.length) return null;
  const touched = tail.filter((a) => a === '--token' || a === '--clear-token').length;
  invariant(touched <= HERDR_MAX_TOKENS, `a herdr report may touch at most ${HERDR_MAX_TOKENS} tokens, this one touches ${touched}`);
  if (opts.ttlMs !== undefined && Number.isFinite(opts.ttlMs) && opts.ttlMs > 0) {
    tail.push('--ttl-ms', String(Math.floor(opts.ttlMs)));
  }
  return [scope, 'report-metadata', targetId, '--source', SOURCE, ...tail];
}

/**
 * Report display-only tokens to herdr for this process's pane, or for the
 * workspace this pane owns. Returns true only when a report was actually sent:
 * outside herdr nothing is spawned, and a pane that does not own its workspace
 * never writes the sidebar row a peer session owns.
 *
 * herdr being down, absent or slow is an expected failure — logged to stderr,
 * never thrown at the hook or status line that called us.
 */
export function reportHerdrMetadata(
  scope: HerdrScope,
  tokens: HerdrTokens,
  opts: { ttlMs?: number; displayAgent?: string } = {},
): boolean {
  const pane = herdrPaneId();
  if (!pane) return false;
  try {
    let targetId = pane;
    if (scope === 'workspace') {
      const placement = herdrPlacement(pane);
      if (!placement || !placement.ownsWorkspace) return false;
      targetId = placement.workspaceId;
    }
    const args = herdrReportArgs(scope, targetId, tokens, opts);
    if (!args) return false;
    // Doctrine § Code invariants: assert before the write. This state is
    // unreachable from any input — the builder returns null instead — so a
    // violation is a bug in the builder, and per doctrine it stays loud
    // (rethrown below) rather than being folded into the expected-failure path.
    invariant(
      args.length > 5 && args.every(a => typeof a === 'string' && a.length > 0),
      `herdr report argv is malformed for ${scope} ${targetId}`,
    );
    execFileSync(herdrBin(), args, { stdio: 'ignore', timeout: 2000 });
    return true;
  } catch (err) {
    if (err instanceof InvariantViolation) throw err;
    console.error(`[herdr-tabs] ${scope} report failed:`, err);
    return false;
  }
}

/**
 * How many numbered items sit under the response's final `❓ OPEN:` field. Pure.
 * The field ends at the next format field (the closer at the latest), so a numbered
 * list elsewhere in the answer never counts.
 */
export function countOpenItems(message: string): number {
  const at = message.lastIndexOf('❓ OPEN');
  if (at < 0) return 0;
  const lines = message.slice(at).split('\n').slice(1);
  let count = 0;
  for (const line of lines) {
    if (new RegExp(`^\\s*(?:${closerPattern()}|🔧|✅|⚙️|🧠|🩺|🔀)`, 'u').test(line)) break;
    if (/^\s*\d+[.)]\s+\S/.test(line)) count++;
  }
  return count;
}

/** Local wall clock as HH:mm (24-hour, OPERATIONAL_PREFERENCES § Time display). */
function clock(now: Date): string {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/**
 * State labels: the text herdr's `state_text` token shows for each agent state. Herdr
 * picks the label for the state it detects, so the row's word always matches the real
 * state. The `$since` token they replace said "idle since 21:18" on a pane that was
 * working, because a turn resumed by a background-task notification never runs the
 * prompt hook (2026-10-13, two of six live agents).
 *
 * They go out under their own source: herdr keeps one title, display agent and label set
 * per source, so a report from `lifeos` (the status line's display-agent beat) would wipe
 * them every two seconds. A report replaces the whole set, so callers always send it all.
 */
export type HerdrStatus = 'idle' | 'working' | 'blocked' | 'done' | 'unknown';
const STATUSES: readonly HerdrStatus[] = ['idle', 'working', 'blocked', 'done', 'unknown'];
const STATE_SOURCE = 'lifeos-state';

/** The argv for one state-label report, or null for a bad pane id. Empty labels clear. Pure. */
export function herdrStateLabelArgs(paneId: string, labels: Partial<Record<HerdrStatus, string>>): string[] | null {
  if (!PANE_ID_RE.test(paneId)) return null;
  const tail: string[] = [];
  for (const status of STATUSES) {
    const text = labels[status] ? cleanTokenValue(labels[status]!) : '';
    if (text) tail.push('--state-label', `${status}=${text}`);
  }
  if (!tail.length) tail.push('--clear-state-labels');
  return ['pane', 'report-metadata', paneId, '--source', STATE_SOURCE, ...tail];
}

/** Send the label set for this process's pane. `detach` is for the per-tool-call path,
 * which must never wait on herdr. */
function sendStateLabels(labels: Partial<Record<HerdrStatus, string>>, detach = false): boolean {
  const pane = herdrPaneId();
  if (!pane) return false;
  const args = herdrStateLabelArgs(pane, labels);
  if (!args) return false;
  try {
    if (detach) {
      const child = spawn(herdrBin(), args, { detached: true, stdio: 'ignore' });
      child.on('error', () => { /* herdr absent */ });
      child.unref();
    } else {
      execFileSync(herdrBin(), args, { stdio: 'ignore', timeout: 2000 });
    }
    return true;
  } catch (err) {
    console.error(`[herdr-tabs] state label report failed:`, err);
    return false;
  }
}

/** When this pane's current turn began, so the per-tool-call path can tell whether the
 * row still says idle and a blocked report can keep the working label. One small file
 * per pane; a missing file means no turn has been stamped yet. */
const TURN_DIR = join(getLifeosDir(), 'MEMORY', 'STATE', 'herdr-turn');
/** A turn mark also carries a wait on the principal (2026-10-15, ISA 20261015-herdr-sidebar-status):
 * when it began, why, and the workspace whose row shows it. `waitShown` is the label last
 * reported, so the minute refresher only reports a label that changed. */
export type WaitReason = 'blocked' | 'question' | 'open' | 'go-ahead';
/** How a finished turn left things (2026-10-16, ISA F6): needs the principal, done, still
 * running in the background, or stopped on an error. */
export type TurnState = 'needs' | 'done' | 'background' | 'failed';
export type TurnMark = {
  phase: 'working' | 'idle';
  since: string;
  /** For an idle mark with no wait: what the state line says. */
  end?: Exclude<TurnState, 'needs'>;
  waitAt?: number;
  waitReason?: WaitReason;
  waitOpen?: number;
  ws?: string;
  waitShown?: string;
  /** For a working mark: when the turn began (epoch ms), so the state line can say how long. */
  startedAt?: number;
  /** The working label last reported, so the minute refresher only reports a change. */
  lineShown?: string;
};

function readTurn(paneKey: string, dir = TURN_DIR): TurnMark | null {
  try { return JSON.parse(readFileSync(join(dir, `${paneKey}.json`), 'utf-8')) as TurnMark; } catch { return null; }
}

function writeTurn(paneKey: string, mark: TurnMark, dir = TURN_DIR): void {
  invariant(/^herdr-w[0-9A-Za-z]+-p[0-9A-Za-z]+$/.test(paneKey) && /^\d\d:\d\d$/.test(mark.since), `herdr turn mark is malformed: ${paneKey}/${mark.since}`);
  invariant(mark.waitAt === undefined || (Number.isFinite(mark.waitAt) && !!mark.waitReason), `herdr wait needs a finite start and a reason: ${paneKey}`);
  invariant(mark.ws === undefined || WORKSPACE_ID_RE.test(mark.ws), `herdr wait workspace id is malformed: ${mark.ws}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${paneKey}.json`), JSON.stringify(mark));
}

// ── Wait line (2026-10-15) ───────────────────────────────────────────────────
// The space row says how long a session has waited on the principal: blocked on an
// approval, asking a question, or finished with open items. A plainly finished turn is
// not a wait. The hooks start and clear it; the statusline refresher, once a minute,
// moves the minutes and the colour, since a herdr row only changes when someone reports.

const MINUTE = 60_000;
/** A wait this old belongs to a session nobody came back to; the refresher drops it. */
const WAIT_MAX_AGE_MS = 24 * 60 * MINUTE;
export type WaitTier = 'wait_new' | 'wait' | 'wait_late';
const WAIT_TIERS: readonly WaitTier[] = ['wait_new', 'wait', 'wait_late'];

/** Quiet under 5 minutes, amber to 15, red after. Pure. */
export function waitTier(ageMs: number): WaitTier {
  if (ageMs < 5 * MINUTE) return 'wait_new';
  if (ageMs < 15 * MINUTE) return 'wait';
  return 'wait_late';
}

function waitAge(ageMs: number): string {
  const total = Math.floor(Math.max(0, ageMs) / MINUTE);
  if (total < 1) return 'now';
  if (total < 60) return `${total}m`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** `⏳ needs you 6m`, `⏳ question now`, `⏳ 2 open 1h 5m`. Pure. */
export function waitLabel(reason: WaitReason, ageMs: number, open = 0): string {
  const why = reason === 'blocked' ? 'needs you' : reason === 'question' ? 'question' : reason === 'go-ahead' ? 'your call' : `${open} open`;
  return `⏳ ${why} ${waitAge(ageMs)}`;
}

/** One wait token set under its tier's name (the config gives each its colour), the others cleared. Pure. */
export function waitTokens(shown: { label: string; tier: WaitTier } | null): HerdrTokens {
  const out: HerdrTokens = {};
  for (const tier of WAIT_TIERS) out[tier] = shown && shown.tier === tier ? shown.label : null;
  return out;
}

function shownFor(mark: TurnMark, now: number): { label: string; tier: WaitTier } | null {
  if (mark.waitAt === undefined || !mark.waitReason) return null;
  const age = now - mark.waitAt;
  return { label: waitLabel(mark.waitReason, age, mark.waitOpen ?? 0), tier: waitTier(age) };
}

/** The mark for a new prompt: working, no wait. The workspace rides along so a later tool
 * call can repaint the row without asking herdr where it is. Pure. */
export function turnAfterStart(since: string, ws?: string | null, startedAt?: number): TurnMark {
  const mark: TurnMark = ws ? { phase: 'working', since, ws } : { phase: 'working', since };
  if (startedAt !== undefined) mark.startedAt = startedAt;
  return mark;
}

/** How long a turn has run, in days, hours and minutes: `12m`, `1h 5m`, `2d 3h`. Pure. */
export function elapsedLabel(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / MINUTE);
  const d = Math.floor(total / 1440);
  const h = Math.floor((total % 1440) / 60);
  const m = total % 60;
  if (d) return h ? `${d}d ${h}h` : `${d}d`;
  if (h) return m ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

/** The mark for a finished turn: a wait when the answer left items open or asked for a
 * go-ahead, otherwise how it ended. Pure. */
export function turnAfterEnd(_prev: TurnMark | null, open: number, at: string, now: number, ws: string | null, state: TurnState = 'done'): TurnMark {
  const mark: TurnMark = { phase: 'idle', since: at, ...(ws ? { ws } : {}) };
  if (open > 0) Object.assign(mark, { waitAt: now, waitReason: 'open' as const, waitOpen: open });
  else if (state === 'needs') Object.assign(mark, { waitAt: now, waitReason: 'go-ahead' as const });
  else mark.end = state;
  return mark;
}

// ── Work-state line (2026-10-16, ISA F6) ─────────────────────────────────────
// Every space row says, in words and colour, whether the session is working, waiting on the
// principal, or done. Herdr's own state icon is a few pixels, and its done/idle split means
// seen or unseen, never finished or waiting. Exactly one of these tokens is set at a time;
// the wait tiers are the "needs you" state, so the colour still warms with the wait.

export type StateKind = 'st_working' | 'st_bg' | 'st_done' | 'st_failed' | WaitTier;
export const STATE_TOKENS: readonly StateKind[] = ['st_working', 'st_bg', 'st_done', 'st_failed', ...WAIT_TIERS];
export type StateLine = { kind: StateKind; label: string } | null;

/** One state token set, the other six cleared; null clears all seven. Pure. */
export function stateTokens(line: StateLine): HerdrTokens {
  const out: HerdrTokens = {};
  for (const kind of STATE_TOKENS) out[kind] = line && line.kind === kind ? line.label : null;
  return out;
}

/** The state line a turn mark stands for. Pure. */
export function stateLineFor(mark: TurnMark, now: number): StateLine {
  const shown = shownFor(mark, now);
  if (shown) return { kind: shown.tier, label: shown.label };
  if (mark.phase === 'working') {
    const ran = mark.startedAt !== undefined && now >= mark.startedAt ? ` (${elapsedLabel(now - mark.startedAt)})` : '';
    return { kind: 'st_working', label: `● Working: ${mark.since}${ran}` };
  }
  if (mark.end === 'background') return { kind: 'st_bg', label: `◐ Still running ${mark.since}` };
  if (mark.end === 'failed') return { kind: 'st_failed', label: `✗ Stopped ${mark.since}` };
  return { kind: 'st_done', label: `✓ Done ${mark.since}` };
}

/** A closer that hands the next move to the principal: a y, a recommendation, a question. */
const GO_AHEAD_RE = /\b(say y|y to|your call|your go-?ahead|want me to|shall I|should I|I'd|I would|ok to|okay to)\b|\?\s*$/i;
/** A closer that names work still coming, with nothing asked. */
const BACKGROUND_RE = /\b(comes? back|still running|is running|are running|in the background|in (about |roughly )?(a few|a couple of|\d+|one|two|five|ten|fifteen|twenty|thirty) (min|minutes?|hours?)|when (it|they) (finish|finishes|land|lands)|once (it|they) (finish|finishes|land|lands))\b/i;

/** How a finished turn left things, from its open items and its spoken closer. Pure. */
export function turnState(lastMessage: string, open: number, failed = false): TurnState {
  if (failed) return 'failed';
  if (open > 0) return 'needs';
  const lines = [...(lastMessage || '').matchAll(new RegExp(`^(?:${closerPattern()}|🗣)\\s*[^:\\n]{1,20}:\\s*(.+)$`, 'gmu'))];
  const spoken = stripVoiceTags(lines.at(-1)?.[1] ?? '').trim();
  if (!spoken) return 'done';
  if (GO_AHEAD_RE.test(spoken)) return 'needs';
  if (nextLines(lastMessage).next === '✓ Done') return 'done';
  return BACKGROUND_RE.test(spoken) ? 'background' : 'done';
}

/** The space-row tokens for a turn end: the state line, and the next step unless the state
 * line already says done. Pure. */
export function turnEndTokens(lastMessage: string, line: StateLine): HerdrTokens {
  const next = line?.kind === 'st_done' || line?.kind === 'st_failed' ? { next: null, next2: null } : nextLines(lastMessage || '');
  return { open: null, landed: null, ...next, ...stateTokens(line) };
}

/** After a tool ran: the new mark and the line to paint, or null when the row already says
 * working. A turn resumed by a background notification never runs the prompt hook, so its
 * mark still reads idle; an answered approval or question leaves a wait to clear. Pure. */
export function turnAfterTool(turn: TurnMark, at: string, now?: number): { mark: TurnMark; line: StateLine } | null {
  const waiting = turn.waitAt !== undefined && turn.waitReason !== 'open' && turn.waitReason !== 'go-ahead';
  if (turn.phase === 'working' && !waiting) return null;
  const { waitAt: _a, waitReason: _r, waitOpen: _o, waitShown: _s, end: _e, ...rest } = turn;
  const mark: TurnMark = turn.phase === 'idle' ? { ...rest, phase: 'working', since: at, ...(now !== undefined ? { startedAt: now } : {}) } : rest;
  return { mark, line: stateLineFor(mark, now ?? 0) };
}

/** The workspace this pane owns, or null for a second session sharing one. */
function ownedWorkspace(pane: string | null): string | null {
  if (!pane) return null;
  const placement = herdrPlacement(pane);
  return placement?.ownsWorkspace ? placement.workspaceId : null;
}

/** Start (or keep) a blocked or question wait on this pane and paint it now. */
function startWait(reason: 'blocked' | 'question'): void {
  const paneKey = herdrStateKey();
  const pane = herdrPaneId();
  if (!paneKey || !pane) return;
  const now = Date.now();
  const prev = readTurn(paneKey) ?? { phase: 'working' as const, since: clock(new Date(now)) };
  const ws = prev.ws ?? ownedWorkspace(pane) ?? undefined;
  const mark: TurnMark = { ...prev, waitAt: prev.waitReason === reason && prev.waitAt ? prev.waitAt : now, waitReason: reason, waitOpen: undefined, ws };
  const shown = shownFor(mark, now);
  if (ws && shown) {
    const args = herdrReportArgs('workspace', ws, stateTokens({ kind: shown.tier, label: shown.label }));
    if (args) {
      try { execFileSync(herdrBin(), args, { stdio: 'ignore', timeout: 2000 }); mark.waitShown = shown.label; }
      catch (err) { console.error('[herdr-tabs] wait report failed:', err); }
    }
  }
  try { writeTurn(paneKey, mark); } catch (err) { if (err instanceof InvariantViolation) throw err; }
}

/** After a tool ran: an approval or a question has been answered, so its wait ends. Never waits on herdr. */
/** It also flips a row that still reads idle back to working (ISA F6). Sends nothing in a turn already working. */
export function clearHerdrWait(): boolean {
  const paneKey = herdrStateKey();
  if (!paneKey) return false;
  const turn = readTurn(paneKey);
  const at = new Date();
  const next = turn ? turnAfterTool(turn, clock(at), at.getTime()) : null;
  if (!next) return false;
  if (next.mark.ws && next.line) next.mark.lineShown = next.line.label;
  try { writeTurn(paneKey, next.mark); } catch (err) { if (err instanceof InvariantViolation) throw err; return false; }
  // A resumed turn's old next step belonged to the answer before it.
  const stale = turn?.phase === 'idle' ? { next: null, next2: null } : {};
  if (next.mark.ws) detachedReport(herdrReportArgs('workspace', next.mark.ws, { ...stale, ...stateTokens(next.line) }));
  return true;
}

function detachedReport(args: string[] | null): void {
  if (!args) return;
  const child = spawn(herdrBin(), args, { detached: true, stdio: 'ignore' });
  child.on('error', () => { /* herdr absent */ });
  child.unref();
}

/**
 * The minute refresher's half: for every pane with a wait, report the label when it changed
 * since the last report (the minutes or the colour moved). A wait older than a day is dropped.
 * `report` returns true when herdr took it. Returns how many reports went out.
 */
export function refreshHerdrWaits(
  now = Date.now(),
  dir = TURN_DIR,
  report: (ws: string, tokens: HerdrTokens) => boolean = defaultWaitReport,
): number {
  let files: string[];
  try { files = readdirSync(dir).filter((f) => /^herdr-w[0-9A-Za-z]+-p[0-9A-Za-z]+\.json$/.test(f)); } catch { return 0; }
  let sent = 0;
  for (const file of files) {
    const paneKey = file.slice(0, -5);
    const turn = readTurn(paneKey, dir);
    if (turn?.phase === 'working' && turn.startedAt !== undefined && turn.ws && turn.waitAt === undefined) {
      if (now - turn.startedAt >= WAIT_MAX_AGE_MS) continue;
      const line = stateLineFor(turn, now);
      if (!line || line.label === turn.lineShown || !report(turn.ws, stateTokens(line))) continue;
      try { writeTurn(paneKey, { ...turn, lineShown: line.label }, dir); } catch (err) { if (err instanceof InvariantViolation) throw err; }
      sent++;
      continue;
    }
    if (!turn?.waitAt || !turn.ws) continue;
    if (now - turn.waitAt >= WAIT_MAX_AGE_MS) {
      const { waitAt: _a, waitReason: _r, waitOpen: _o, waitShown: _s, ...rest } = turn;
      try { writeTurn(paneKey, rest, dir); } catch (err) { if (err instanceof InvariantViolation) throw err; }
      report(turn.ws, waitTokens(null));
      continue;
    }
    const shown = shownFor(turn, now);
    if (!shown || shown.label === turn.waitShown) continue;
    if (!report(turn.ws, waitTokens(shown))) continue;
    try { writeTurn(paneKey, { ...turn, waitShown: shown.label }, dir); } catch (err) { if (err instanceof InvariantViolation) throw err; }
    sent++;
  }
  return sent;
}

/** Whether any pane in `dir` has a wait to keep current, so the refresher plans no job when none does. */
export function hasHerdrWaits(dir = TURN_DIR): boolean {
  let files: string[];
  try { files = readdirSync(dir).filter((f) => /^herdr-w[0-9A-Za-z]+-p[0-9A-Za-z]+\.json$/.test(f)); } catch { return false; }
  return files.some((f) => { const t = readTurn(f.slice(0, -5), dir); return !!((t?.waitAt || (t?.phase === 'working' && t.startedAt !== undefined)) && t?.ws); });
}

/** The turn-mark directory under an install's LIFEOS root. */
export function herdrTurnDir(lifeosRoot: string): string {
  return join(lifeosRoot, 'MEMORY', 'STATE', 'herdr-turn');
}

function defaultWaitReport(ws: string, tokens: HerdrTokens): boolean {
  const args = herdrReportArgs('workspace', ws, tokens);
  if (!args) return false;
  try { execFileSync(herdrBin(), args, { stdio: 'ignore', timeout: 2000 }); return true; } catch { return false; }
}

// ── Progress bar (2026-10-15) ────────────────────────────────────────────────

const BAR_CELLS = 8;

/** `▰▰▰▰▰▰▱▱` for 6/8. Nearly done never draws as done, and any progress shows a cell. Pure. */
export function progressBar(done: number, total: number, cells = BAR_CELLS): string {
  if (!(total > 0)) return '';
  let filled = Math.round((Math.min(done, total) / total) * cells);
  if (done < total) filled = Math.min(filled, cells - 1);
  if (done > 0) filled = Math.max(filled, 1);
  return '▰'.repeat(filled) + '▱'.repeat(cells - filled);
}

/** The space row's `$isa` value: `▰▰▰▰▰▰▰▱ 133/144`, or `✓ ▰▰▰▰▰▰▰▰ 11/11` once finished. Pure. */
export function isaProgressLabel(done: number, total: number): string {
  if (!(total > 0)) return '';
  return `${done === total ? '✓ ' : ''}${progressBar(done, total)} ${done}/${total}`;
}

/** Labels for a working turn that began at `since`. Pure. */
export function workingLabels(since: string): Partial<Record<HerdrStatus, string>> {
  return { working: `working since ${since}` };
}

/** Labels for a finished turn at `at`. Pure. */
export function idleLabels(at: string): Partial<Record<HerdrStatus, string>> {
  return { idle: `idle since ${at}`, done: `done at ${at}` };
}

/**
 * Turn boundaries for the agents row. Herdr has no elapsed-time token and a row only
 * changes when someone reports, so the labels carry the clock time the state began
 * rather than a duration that would go stale. At turn end the row also says how many
 * items the response left open for the principal; the next prompt clears it.
 */
export function reportHerdrTurnStart(now: Date = new Date()): boolean {
  const paneKey = herdrStateKey();
  if (!paneKey) return false;
  const since = clock(now);
  const mark = turnAfterStart(since, ownedWorkspace(herdrPaneId()), now.getTime());
  const line = stateLineFor(mark, now.getTime());
  if (mark.ws && line) mark.lineShown = line.label;
  try { writeTurn(paneKey, mark); } catch (err) { if (err instanceof InvariantViolation) throw err; }
  sendStateLabels(workingLabels(since));
  // The space row's wait belongs to the last answer; a new prompt answers or drops it, and
  // the state line says working (ISA F6). `open` is cleared for rows painted before the wait
  // line replaced it. The next step belonged to the last answer too.
  if (mark.ws) defaultWaitReport(mark.ws, { open: null, next: null, next2: null, ...stateTokens(line) });
  // `since` is cleared for rows painted before the labels replaced it.
  return reportHerdrMetadata('pane', { open: '', since: null });
}

export function reportHerdrTurnEnd(lastMessage: string, now: Date = new Date(), failed = false): boolean {
  const paneKey = herdrStateKey();
  if (!paneKey) return false;
  const open = countOpenItems(lastMessage || '');
  const at = clock(now);
  const prev = readTurn(paneKey);
  const ws = prev?.ws ?? ownedWorkspace(herdrPaneId());
  const mark = turnAfterEnd(prev, open, at, now.getTime(), ws, turnState(lastMessage, open, failed));
  const line = stateLineFor(mark, now.getTime());
  // The spaces panel is where the principal looks for which work to go back to: the state
  // line says working, waiting on him, or done (ISA F6), and a wait carries its age.
  if (ws && defaultWaitReport(ws, turnEndTokens(lastMessage, line)) && mark.waitAt !== undefined && line) mark.waitShown = line.label;
  try { writeTurn(paneKey, mark); } catch (err) { if (err instanceof InvariantViolation) throw err; }
  sendStateLabels(idleLabels(at));
  // `$doing` is cleared here rather than left to its ttl: an idle row naming a tool read
  // as a live action (2026-10-13).
  return reportHerdrMetadata('pane', {
    open: open > 0 ? `${open} open for you` : '',
    since: null,
    doing: null,
  });
}

/**
 * The space row's next-step lines (`$next`, `$next2`), from the closer of the answer that
 * just ended (2026-10-15, {{PRINCIPAL_NAME}}: the commit line meant nothing to him; the system commits).
 * The closer already carries my read plus the one next action, or says the work is done, so
 * this reuses it rather than asking me to write anything new: its spoken words, last sentence,
 * fitted over two sidebar lines. A closer that opens on done with no action reads `✓ Done`.
 * No closer gives empty lines, which clears the rows. Pure.
 */
export function nextLines(lastMessage: string, cols = SURFACE_WIDTHS.sidebar.cols): { next: string; next2: string } {
  const lines = [...(lastMessage || '').matchAll(new RegExp(`^(?:${closerPattern()}|🗣)\\s*[^:\\n]{1,20}:\\s*(.+)$`, 'gmu'))];
  const spoken = stripVoiceTags(lines.at(-1)?.[1] ?? '');
  if (!spoken) return { next: '', next2: '' };
  const sentences = spoken.split(/(?<=[.!?])\s+/).filter((x) => /[A-Za-z0-9]/.test(x));
  const first = sentences[0] ?? '';
  if (/^(all\s+)?(done|fixed|finished)\b/i.test(first) && !/\b(I'd|I'll|I will|say y|next)\b/i.test(spoken)) {
    return { next: '✓ Done', next2: '' };
  }
  const [l1 = '', l2 = ''] = fitNameLines(sentences.at(-1) ?? spoken, cols - 2, 2);
  return { next: l1 ? `→ ${l1}` : '', next2: l2 };
}

/** The `$due` line for a prompt that carried a time suffix; a prompt without one clears it,
 * since the deadline belonged to that request. */
export function reportHerdrDue(dueMs: number | null): boolean {
  return reportHerdrMetadata('workspace', { due: dueMs === null ? null : `Due ${clock(new Date(dueMs))}` });
}

/**
 * Why the agent is blocked, for herdr's blocked label: the tool waiting on approval, named
 * the way `$doing` names it (a Bash call by its description, never its command text).
 */
export function reportHerdrBlocked(toolName: string, toolInput: Record<string, unknown> | undefined): boolean {
  const paneKey = herdrStateKey();
  if (!paneKey) return false;
  const turn = readTurn(paneKey);
  try { startWait('blocked'); } catch (err) { if (err instanceof InvariantViolation) throw err; }
  return sendStateLabels({
    ...(turn?.phase === 'working' ? workingLabels(turn.since) : {}),
    blocked: `needs you · ${doingLabel(toolName || 'tool', toolInput)}`,
  });
}

/**
 * The `$agents` line for the agents row: the delegates this session has running right now,
 * in spawn order, a repeat counted rather than listed twice (`→ Sol ×2 · Haiku`). Pure.
 * Herdr gives a pane one row, and a delegate runs inside the session's own process, never
 * in a pane of its own, so this line is the only place herdr can show one. Empty clears.
 */
export function agentsLabel(names: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const raw of names) {
    const name = cleanTokenValue(raw);
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  if (!counts.size) return '';
  return '→ ' + [...counts].map(([n, c]) => (c > 1 ? `${n} ×${c}` : n)).join(' · ');
}

/** Report the running delegates to this pane's agents row; an empty list clears the line.
 * No ttl: the LifeOSHooks poller reports again on every change, a stop included. */
export function reportHerdrAgents(names: readonly string[]): boolean {
  return reportHerdrMetadata('pane', { agents: agentsLabel(names) });
}

/**
 * The `$workers` line: codex legs sent down with Worker.ts. They run as background shell
 * processes, so the plugin's roster (which only sees Agent-tool delegates) never lists them,
 * and the row kept naming the carrier while Astra or Sol did the work (2026-09-21).
 * Each running leg is one file named for the helper's pid under the pane's directory; the
 * label is composed from the files whose pid is still alive, so a crashed leg drops off at
 * the next report instead of sticking. One file per pid means two legs never race on a write.
 */
const WORKERS_DIR = join(getLifeosDir(), 'MEMORY', 'STATE', 'herdr-workers');

function pidAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch (err) { return (err as NodeJS.ErrnoException).code === 'EPERM'; }
}

/** Names of the legs still running in a pane, oldest first; dead entries are removed. */
export function liveWorkers(paneKey: string, dir = WORKERS_DIR): string[] {
  const paneDir = join(dir, paneKey);
  if (!existsSync(paneDir)) return [];
  const rows: Array<{ name: string; at: number }> = [];
  for (const file of readdirSync(paneDir)) {
    const pid = Number(file);
    const path = join(paneDir, file);
    if (!Number.isInteger(pid) || pid <= 0 || !pidAlive(pid)) { try { unlinkSync(path); } catch { /* a peer removed it */ } continue; }
    try { rows.push({ name: readFileSync(path, 'utf-8'), at: statSync(path).mtimeMs }); } catch { /* removed mid-read */ }
  }
  return rows.sort((a, b) => a.at - b.at).map((r) => r.name);
}

/** Add (`name` given) or remove (`name` null) this process's leg, then report the pane's line.
 * Returns true when a report went to herdr. Outside herdr it does nothing. */
export function reportHerdrWorker(name: string | null, pid = process.pid, dir = WORKERS_DIR): boolean {
  const paneKey = herdrStateKey();
  if (!paneKey) return false;
  try {
    invariant(/^herdr-w[0-9A-Za-z]+-p[0-9A-Za-z]+$/.test(paneKey) && Number.isInteger(pid) && pid > 0, `herdr worker roster key is malformed: ${paneKey}/${pid}`);
    const paneDir = join(dir, paneKey);
    const file = join(paneDir, String(pid));
    const label = name === null ? '' : cleanTokenValue(name);
    if (label) { mkdirSync(paneDir, { recursive: true }); writeFileSync(file, label); }
    else { try { unlinkSync(file); } catch { /* never joined */ } }
    return reportHerdrMetadata('pane', { workers: agentsLabel(liveWorkers(paneKey, dir)) });
  } catch (err) {
    if (err instanceof InvariantViolation) throw err;
    console.error(`[herdr-tabs] worker report failed:`, err);
    return false;
  }
}

/**
 * Bring a pane's `$workers` line back in step with the legs actually alive, and return the
 * line. A killed helper never clears its own name, so the status line calls this on its own
 * two-second beat: `shown` is the token herdr holds now, and herdr is written only when the
 * live roster disagrees with it.
 */
export function syncHerdrWorkers(paneId: string, shown: string, dir = WORKERS_DIR): string {
  if (!PANE_ID_RE.test(paneId)) return shown;
  try {
    const live = agentsLabel(liveWorkers(`herdr-${paneId.replace(':', '-')}`, dir));
    if (live === shown.trim()) return live;
    const args = herdrReportArgs('pane', paneId, { workers: live });
    if (args) execFileSync(herdrBin(), args, { stdio: 'ignore', timeout: 2000 });
    return live;
  } catch (err) {
    console.error(`[herdr-tabs] worker sync failed:`, err);
    return shown;
  }
}

/** How long a `$doing` value lives. A tool call never reports its own end (the agent went
 * idle, the session died), so a stale action has to expire by itself. */
const DOING_TTL_MS = 120_000;

/**
 * One short line for what a tool call is doing, for the agents row. Pure. Bash uses the
 * call's own description, never the command text: a command can carry a token or a path
 * the sidebar has no business showing. File tools show the file name, never the path.
 */
export function doingLabel(toolName: string, toolInput: Record<string, unknown> | undefined): string {
  const input = toolInput ?? {};
  const str = (k: string): string => (typeof input[k] === 'string' ? (input[k] as string) : '');
  switch (toolName) {
    case 'Bash':
      return str('description') || 'Bash';
    case 'Read': case 'Edit': case 'Write': case 'MultiEdit': case 'NotebookEdit': {
      const file = str('file_path') || str('notebook_path');
      return file ? `${toolName} ${basename(file)}` : toolName;
    }
    case 'Agent': case 'Task': {
      const who = str('subagent_type') || 'agent';
      const what = str('description');
      return what ? `→ ${who}: ${what}` : `→ ${who}`;
    }
    case 'Skill':
      return str('skill') ? `Skill ${str('skill')}` : 'Skill';
    default:
      return toolName;
  }
}

/**
 * Report the live action to this pane's agents row. Called on every tool call, so it never
 * waits: the herdr child is detached and unreferenced, and the caller may exit at once.
 * Returns true when a child was spawned. Filtering out subagent calls is the caller's job.
 */
export function reportHerdrDoing(toolName: string, toolInput: Record<string, unknown> | undefined): boolean {
  const pane = herdrPaneId();
  if (!pane || !toolName) return false;
  try {
    const args = herdrReportArgs('pane', pane, { doing: doingLabel(toolName, toolInput) }, { ttlMs: DOING_TTL_MS });
    if (!args) return false;
    const child = spawn(herdrBin(), args, { detached: true, stdio: 'ignore' });
    child.on('error', () => { /* herdr absent: the row simply shows no action */ });
    child.unref();
    // A turn resumed by a background-task notification never ran the prompt hook, so the
    // row would still carry the last turn's idle time. The first tool call re-stamps it.
    const paneKey = herdrStateKey();
    const turn = paneKey ? readTurn(paneKey) : null;
    if (paneKey && turn?.phase !== 'working') {
      const since = clock(new Date());
      writeTurn(paneKey, turnAfterStart(since, turn?.ws, Date.now()));
      sendStateLabels(workingLabels(since), true);
      // Working again, so an open-items wait from the last answer is over.
      if (turn?.ws && turn.waitAt) detachedReport(herdrReportArgs('workspace', turn.ws, waitTokens(null)));
    }
    // A question for the principal is a wait like an approval is.
    if (toolName === 'AskUserQuestion') startWait('question');
    return true;
  } catch (err) {
    if (err instanceof InvariantViolation) throw err;
    console.error(`[herdr-tabs] doing report failed:`, err);
    return false;
  }
}
