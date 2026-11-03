#!/usr/bin/env bun
/**
 * @version 1.0.10
 * Doctor — LifeOS capability prober and manifest writer.
 *
 * Probes the external tools that LifeOS doctrine depends on (cross-vendor
 * audit CLI, browser verification, Cloudflare/wrangler, voice) plus core
 * wiring, and writes an advisory capability manifest. Born from community
 * feedback (LifeOS discussion #1461): capabilities that are assumed but
 * never verified degrade silently; anything dormant at rest is invisible
 * to change-scoped checks.
 *
 * Design contract (RedTeam-derived, 2026-07-12):
 *   - The manifest is a TTL'd advisory CACHE, never truth. Readers treat it
 *     as untrusted input; doctrine-critical gates re-verify live.
 *   - Four states: live | broken | declined | stale. Declined is first-class
 *     and permanently silent — opted-out is not a defect.
 *   - No scores, no percentages. Diagnostic register only.
 *   - Never install-fatal: default run always exits 0, every probe is
 *     timeout-bounded, network probes are opt-in (--network) and only fire
 *     for capabilities the user has configured.
 *   - Tamper-evident: manifest carries a salted integrity hash (salt is a
 *     separate 0600 file). Detects casual/model edits, not a determined
 *     local attacker.
 *
 * Usage:
 *   bun Doctor.ts                  # probe (offline checks), table output
 *   bun Doctor.ts --network        # include network probes for configured caps
 *   bun Doctor.ts --json           # machine-readable
 *   bun Doctor.ts --no-network     # explicit offline (default is offline)
 *   bun Doctor.ts decline <cap>    # mark capability declined (silent forever)
 *   bun Doctor.ts enable <cap>     # undo a decline
 *   bun Doctor.ts ack              # acknowledge current broken set (statusline delta)
 *   bun Doctor.ts --statusline     # one glyph if NEW regression since ack, else empty
 *   bun Doctor.ts --verify         # integrity-check the manifest (exit 2 on tamper)
 *   bun Doctor.ts --reclaim        # merge + retire shadow-$HOME trees (public issue #1485)
 *   bun Doctor.ts --hooks          # per-hook interpreter resolution (public issue #1600)
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync, readdirSync, statSync, lstatSync, readlinkSync, realpathSync } from 'fs';
import { join, basename, delimiter } from 'path';
import { createHash, randomBytes } from 'crypto';
import { homedir } from "node:os";
import { userDataRoot } from './lib/ForeignDataCheck';
import { getClaudeDir, getLifeosDir } from './Paths'; // public issue #1968 @bytebyrobert, #1974 @sabo961

const HOME = process.env.HOME ?? process.env.USERPROFILE ?? homedir();
// Both roots come from the ONE resolver (Paths.ts), so Doctor probes exactly the
// install every hook and tool resolves to. Doctor used to re-derive them here with
// LIFEOS_DIR outranking CLAUDE_CONFIG_DIR — the reverse of the resolver — so a dev
// shell exporting LIFEOS_DIR sent a scratch-root Doctor run's manifest write into
// the real install's state file (caught by a builder's probe).
// install.sh's LIFEOS_SKILLS_DIR-only installs resolve through the same call.
// public issue #1968, @bytebyrobert
const CONFIG_ROOT = getClaudeDir();
const LIFEOS_DIR = getLifeosDir();
const STATE_DIR = join(LIFEOS_DIR, 'MEMORY', 'STATE');
const MANIFEST = join(STATE_DIR, 'capabilities.json');
const SALT_FILE = join(STATE_DIR, '.capabilities-salt');
const HEARTBEAT = join(STATE_DIR, 'doctor-heartbeat.json');
const PROBE_TIMEOUT_MS = 15_000;

// off: an optional capability with no setup on this machine. Not a fault, never nagged, and re-probed every
// run (unlike declined, which is sticky), so adding the key later turns it live with no extra step.
type CapState = 'live' | 'broken' | 'declined' | 'stale' | 'off';

interface CapResult {
  state: CapState;
  checkedAt: string;      // ISO timestamp of last real probe
  ttlHours: number;       // readers treat entries older than this as stale
  detail: string;         // one-line human diagnosis
  fixCmd: string | null;  // copy-paste remediation, null when live/declined
  probeClass: 'offline' | 'network';
}

interface Manifest {
  version: 1;
  updatedAt: string;
  note: string;
  capabilities: Record<string, CapResult>;
  ackedBroken: string[];  // broken set acknowledged via `ack` (statusline delta base)
  integrity?: string;
}

// A probe may name its own remediation when the cause it found needs a
// different fix from the CapSpec's static one (quota vs bad key, mis-rooted
// tree vs never-ran Setup). Absent → the CapSpec fixCmd applies.
// ported from public PR #2053, @hjbrandt
interface ProbeResult {
  ok: boolean;
  detail: string;
  fixCmd?: string;
}

interface CapSpec {
  id: string;
  title: string;
  powers: string;
  ttlHours: number;
  // Returns null when the capability has no local configuration at all —
  // network probing it would be pre-consent egress (never allowed).
  configured: () => boolean;
  probeOffline: () => Promise<ProbeResult>;
  probeNetwork?: () => Promise<ProbeResult>;
  fixCmd: string;
  // Set when running without this capability is a supported install: an unconfigured run records state
  // 'off' with this detail instead of 'broken'.
  offWhenUnconfigured?: string;
}

// ── helpers ──────────────────────────────────────────────────────────────────

async function run(cmd: string[], timeoutMs = PROBE_TIMEOUT_MS): Promise<{ code: number; out: string }> {
  try {
    const proc = Bun.spawn(cmd, { stdout: 'pipe', stderr: 'ignore', stdin: 'ignore' });
    // Race the read: a killed child's grandchildren can inherit the stdout pipe
    // and hold it open past the kill, so awaiting stream EOF alone can hang.
    return await Promise.race([
      (async () => {
        const out = await new Response(proc.stdout).text();
        const code = await proc.exited;
        return { code, out: out.trim() };
      })(),
      new Promise<{ code: number; out: string }>(resolve =>
        setTimeout(() => { try { proc.kill(9); } catch {} resolve({ code: 124, out: '' }); }, timeoutMs)),
    ]);
  } catch {
    return { code: 127, out: '' };
  }
}

// Native Windows (win32, Git Bash included) runs a second probe path beside the
// POSIX one: PATH separates on ';' and an executable carries a PATHEXT suffix.
// public issue #1810, @umair-a11y
const IS_WIN = process.platform === 'win32';
const WIN_PATHEXT = (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean);

function which(bin: string): boolean {
  return whichPath(bin) !== null;
}

/**
 * Like which(), but returns the resolved path instead of a boolean — callers
 * such as chromeBinary() feed the result into detail strings that split on
 * '/', so the fallback must yield a real path (public PR #1567, @vibecrypto).
 */
function whichPath(bin: string): string | null {
  // path.delimiter is ':' on macOS/Linux — same split as before — and ';' on
  // Windows. On Windows a bare `existsSync(join(p, 'codex'))` also never sees
  // `codex.exe` or `codex.cmd`, so the extensions are tried first there.
  // public issue #1810, @umair-a11y
  const paths = (process.env.PATH || '').split(delimiter);
  let names = [bin];
  if (IS_WIN && !WIN_PATHEXT.some(ext => bin.toLowerCase().endsWith(ext.toLowerCase()))) {
    names = [...WIN_PATHEXT.map(ext => bin + ext), bin];
  }
  for (const p of paths) {
    if (!p) continue;
    for (const name of names) {
      const full = join(p, name);
      if (existsSync(full)) return full;
    }
  }
  return null;
}

/**
 * Probe whether a binary on PATH actually works — runs `bin --version` (or a
 * custom versionArgs) with a 3s timeout. Returns { ok, detail } where ok is
 * true only if the binary runs and exits 0. Also detects timeout (wedged
 * binary) and date-versioned rotting (yt-dlp against YouTube). Keeps the fast
 * absence path: if which() fails, returns immediately without spawning.
 * public issue #2066, @BS-WS04
 */
async function probeLive(opts: {
  bin: string;
  versionArgs?: string[];
  staleAfterDays?: number;
}): Promise<{ ok: boolean; detail: string }> {
  const { bin, versionArgs = ['--version'], staleAfterDays } = opts;
  if (!which(bin)) {
    return { ok: false, detail: `${bin} not on PATH` };
  }

  const { code, out } = await run([bin, ...versionArgs], 3000);
  if (code === 124) {
    return { ok: false, detail: `${bin} on PATH but \`${bin} ${versionArgs.join(' ')}\` timed out — the binary is wedged` };
  }
  if (code !== 0) {
    return { ok: false, detail: `${bin} on PATH but \`${bin} ${versionArgs.join(' ')}\` exited ${code} — installed and not runnable` };
  }

  const version = (out.split('\n')[0] || '').trim() || 'version unreported';
  if (staleAfterDays) {
    const m = version.match(/(\d{4})\.(\d{2})\.(\d{2})/);
    if (m) {
      const ageDays = Math.floor((Date.now() - Date.UTC(+m[1], +m[2] - 1, +m[3])) / 86400000);
      if (ageDays > staleAfterDays) {
        return { ok: false, detail: `${bin} runs but is ${ageDays} days old (${version}) — date-versioned tools rot against the services they scrape` };
      }
      return { ok: true, detail: `${bin} runs (${version}, ${ageDays}d old)` };
    }
  }
  return { ok: true, detail: `${bin} runs (${version})` };
}

function envKey(name: string): string | null {
  if (process.env[name]) return process.env[name]!;
  // .env at config root is the canonical secrets file on a LifeOS install.
  const envFile = join(CONFIG_ROOT, '.env');
  if (existsSync(envFile)) {
    const m = readFileSync(envFile, 'utf8').match(new RegExp(`^${name}=["']?([^"'\\n]+)`, 'm'));
    if (m) return m[1];
  }
  return null;
}

// ── shadow-$HOME trees (public issue #1485, @vanvonlj; class: #1404/#1451) ───
// Pre-#1451 installs interpolated the literal string "$HOME" into paths, so
// every project directory a session ran in grew a `$HOME/.claude/LIFEOS/MEMORY`
// shadow tree. #1451 stopped NEW ones; the accumulated ones persist after
// upgrade, holding real ratings/learning/observability data that is valid,
// complete, and invisible to MemoryRetriever. Nothing else ever notices.

const RECLAIM_BACKUP_DIR = join(STATE_DIR, 'reclaimed-shadow-backups');

// macOS gates these per-app behind a consent prompt. A diagnostic that walks
// $HOME crosses every one of them, so a read-only probe made the OS ask the
// user to grant the terminal access to their Photos and Desktop.
const TCC_PROTECTED = ['Desktop', 'Documents', 'Downloads', 'Movies', 'Pictures', 'Music'];

// Conventional code roots. Shadow trees are born where sessions run, which is
// inside project directories — never in the media folders above.
const CONVENTIONAL_ROOTS = ['Projects', 'LocalProjects', 'code', 'Developer', 'src'];

/**
 * `~`-rooted paths named by the principal's own project registry. Ours is the
 * PROJECTS.md markdown table (adapted from the upstream PR, which read a
 * project-registry.yaml), so the parse is over backticked path spans in the
 * Path column rather than YAML keys.
 */
function registryRoots(): string[] {
  const registry = join(CONFIG_ROOT, 'LIFEOS', 'USER', 'PROJECTS.md');
  if (!existsSync(registry)) return [];
  let text = '';
  try { text = readFileSync(registry, 'utf8'); } catch { return []; }
  const out: string[] = [];
  for (const m of text.matchAll(/`(~\/[^`]+)`/g)) {
    const expanded = join(HOME, m[1].slice(2)).replace(/\/+$/, '');
    // Registry cells also name files and non-existent planned paths; only real
    // directories are searchable, and only ones actually under $HOME.
    if (!expanded.startsWith(HOME + '/')) continue;
    try { if (statSync(expanded).isDirectory()) out.push(expanded); } catch {}
  }
  return out;
}

/**
 * The bounded search set: config root + conventional code dirs + registry
 * paths, minus anything sitting under a TCC-protected folder.
 *
 * ported from public PR #1884, @abseg (adapted: registry source is PROJECTS.md)
 */
function shadowSearchRoots(): { roots: string[]; skipped: string[] } {
  const candidates = [
    CONFIG_ROOT,
    ...CONVENTIONAL_ROOTS.map(d => join(HOME, d)),
    ...registryRoots(),
  ];
  const roots: string[] = [];
  const skipped: string[] = [];
  for (const c of candidates) {
    const path = c.replace(/\/+$/, '');
    const rel = path === HOME ? '' : path.startsWith(HOME + '/') ? path.slice(HOME.length + 1) : path;
    if (TCC_PROTECTED.includes(rel.split('/')[0])) { if (!skipped.includes(path)) skipped.push(path); continue; }
    if (!existsSync(path)) continue;
    // Drop exact duplicates and any root already covered by an ancestor root.
    if (roots.some(r => path === r || path.startsWith(r + '/'))) continue;
    // A new root may itself be the ancestor of ones already collected.
    for (let i = roots.length - 1; i >= 0; i--) if (roots[i].startsWith(path + '/')) roots.splice(i, 1);
    roots.push(path);
  }
  return { roots, skipped };
}

let reportedSkippedRoots = false;

async function findShadowHomeDirs(): Promise<string[]> {
  return (await searchShadowHomeDirs()).found;
}

/** Search result that says whether the scan finished; incomplete is unknown, never "none found". */
async function searchShadowHomeDirs(): Promise<{ found: string[]; incomplete: string[] }> {
  // `find` for guaranteed availability; prune heavy/irrelevant dirs and our
  // own reclaim backups (which contain moved '$HOME' dirs by construction —
  // without the prune every past reclaim would re-trigger detection forever).
  // Scoped to the roots above rather than $HOME: the old $HOME-wide walk tripped
  // macOS TCC consent prompts on Desktop/Movies/Pictures for a read-only probe.
  // ported from public PR #1884, @abseg (adapted: registry source is PROJECTS.md)
  const { roots, skipped } = shadowSearchRoots();
  if (skipped.length && !reportedSkippedRoots) {
    reportedSkippedRoots = true;
    console.error(
      `doctor: skipped ${skipped.length} search root(s) under macOS-protected folders (${skipped.join(', ')}) — ` +
      `scanning them would prompt for privacy access. To check them yourself:\n` +
      `  find ${skipped.map(s => `"${s}"`).join(' ')} -maxdepth 6 -type d -name '$HOME' -print`,
    );
  }
  const found = new Set<string>();
  const incomplete: string[] = [];
  for (const root of roots) {
    const r = await run([
      'find', root, '-maxdepth', '6',
      '(', '-name', 'node_modules', '-o', '-name', '.git', '-o', '-name', 'Library', '-o', '-path', RECLAIM_BACKUP_DIR, ')', '-prune',
      '-o', '-type', 'd', '-name', '$HOME', '-print',
    ], 60_000);
    // Any unsuccessful exit (124 timed out, 127 could not spawn, 1 unreadable
    // subtree, 2 bad invocation, a signal) means the root was not fully searched,
    // so it is unknown, never "none found".
    if (r.code !== 0) incomplete.push(root);
    for (const line of r.out.split('\n')) if (line) found.add(line);
  }
  return { found: [...found], incomplete };
}

// Disposable state — never worth merging (issue #1485's cache list).
function isDisposable(rel: string): boolean {
  const base = rel.split('/').pop() || '';
  return /-cache\./.test(base) || base === 'instruction-hashes.json' || base === 'last-response.txt' || rel.includes('/CACHE/');
}

function* walkFiles(dir: string, prefix = ''): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) yield* walkFiles(join(dir, entry.name), rel);
    else if (entry.isFile()) yield rel;
  }
}

function countShadowMemoryFiles(shadows: string[]): number {
  let n = 0;
  for (const s of shadows) {
    const mem = join(s, '.claude', 'LIFEOS', 'MEMORY');
    if (!existsSync(mem)) continue;
    for (const rel of walkFiles(mem)) if (!isDisposable(rel)) n++;
  }
  return n;
}

function mergeJsonl(destPath: string, shadowPath: string): { added: number } {
  const destLines = existsSync(destPath)
    ? readFileSync(destPath, 'utf8').split('\n').filter(Boolean) : [];
  const seen = new Set(destLines);
  const fresh = readFileSync(shadowPath, 'utf8').split('\n').filter(Boolean)
    .filter(l => !seen.has(l));
  if (!fresh.length) return { added: 0 };
  const merged = [...destLines, ...fresh];
  // Sort by timestamp only when EVERY line parses with one — otherwise keep
  // append order (jsonl here is append-only; a half-sorted file lies).
  const ts = (l: string): number | null => {
    try { const o = JSON.parse(l); const t = o.timestamp ?? o.ts; const n = Date.parse(t); return Number.isFinite(n) ? n : null; }
    catch { return null; }
  };
  const stamps = merged.map(ts);
  if (stamps.every(s => s !== null)) {
    merged.sort((a, b) => (ts(a) as number) - (ts(b) as number));
  }
  mkdirSync(join(destPath, '..'), { recursive: true });
  writeFileSync(destPath, merged.join('\n') + '\n');
  return { added: fresh.length };
}

async function reclaimShadows(): Promise<void> {
  const shadows = await findShadowHomeDirs();
  if (!shadows.length) { console.log('no shadow-$HOME trees found — nothing to reclaim.'); return; }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  let mergedLines = 0, copiedFiles = 0, skippedDisposable = 0;
  const { renameSync, cpSync } = await import('fs');
  for (let i = 0; i < shadows.length; i++) {
    const shadow = shadows[i];
    const mem = join(shadow, '.claude', 'LIFEOS', 'MEMORY');
    if (existsSync(mem)) {
      for (const rel of walkFiles(mem)) {
        if (isDisposable(rel)) { skippedDisposable++; continue; }
        const src = join(mem, rel);
        const dest = join(LIFEOS_DIR, 'MEMORY', rel);
        if (rel.endsWith('.jsonl')) {
          mergedLines += mergeJsonl(dest, src).added;
        } else if (!existsSync(dest)) {
          mkdirSync(join(dest, '..'), { recursive: true });
          cpSync(src, dest);
          copiedFiles++;
        }
        // non-jsonl with an existing destination: destination wins, shadow copy
        // survives in the backup below.
      }
    }
    // Backup IS the removal: move the whole shadow tree out of the live
    // filesystem into a timestamped backup under STATE (pruned from future
    // scans). Nothing is deleted.
    const backupTarget = join(RECLAIM_BACKUP_DIR, stamp, String(i));
    mkdirSync(backupTarget, { recursive: true });
    try {
      renameSync(shadow, join(backupTarget, '$HOME'));
    } catch {
      cpSync(shadow, join(backupTarget, '$HOME'), { recursive: true });
      const { rmSync } = await import('fs');
      rmSync(shadow, { recursive: true, force: true });
    }
    console.log(`reclaimed: ${shadow} → ${backupTarget}`);
  }
  console.log(`done: ${shadows.length} shadow tree(s) retired · ${mergedLines} jsonl line(s) merged · ${copiedFiles} artefact(s) copied · ${skippedDisposable} disposable file(s) dropped. Backup: ${join(RECLAIM_BACKUP_DIR, stamp)}`);
}

function chromeBinary(): string | null {
  // Windows gets its own candidate list (public issue #1810, @umair-a11y): none
  // of the macOS/Linux paths can exist there, and Chrome/Brave install under
  // Program Files or LOCALAPPDATA rather than /Applications or /usr/bin.
  const winRoots = IS_WIN
    ? [
        process.env.PROGRAMFILES || 'C:\\Program Files',
        process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)',
        process.env.LOCALAPPDATA || join(HOME, 'AppData', 'Local'),
      ]
    : [];
  const candidates = IS_WIN
    ? winRoots.flatMap(root => [
        join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        join(root, 'Chromium', 'Application', 'chrome.exe'),
        join(root, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
      ])
    : [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
        '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
        // Google's .deb/.rpm install the stable channel as google-chrome-stable
        // and keep the real binary under /opt; a Chrome-only Linux box with no
        // google-chrome alias got a false "no browser found".
        // public issue #1969, @bytebyrobert
        '/usr/bin/google-chrome-stable', '/opt/google/chrome/chrome',
        // Linux Brave (public issue #1496, @waveman2020-sudo): a Brave-only Linux
        // box previously got a false "no browser found".
        '/usr/bin/brave-browser', '/usr/bin/brave-browser-stable',
        // Declarative installs (public PR #1567, @vibecrypto): nix-darwin /
        // Home Manager place GUI apps under /Applications/Nix Apps/.
        '/Applications/Nix Apps/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Nix Apps/Brave Browser.app/Contents/MacOS/Brave Browser',
        // macOS Chromium (public issue #1970, @bytebyrobert): the failure line
        // promised "Chrome/Brave/Chromium" while the list never had Chromium.app;
        // VerifyViewport.ts already probes this path.
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
      ];
  const found = candidates.find(existsSync);
  if (found) return found;
  // PATH fallback (public PR #1567, @vibecrypto): Nix profiles expose the
  // binary only on PATH (e.g. /run/current-system/sw/bin/google-chrome), and
  // it also covers any distro not matched by the hardcoded candidates.
  // Windows ships the same browsers under different binary names (public issue
  // #1810, @umair-a11y); whichPath() supplies the .exe suffix there.
  // google-chrome-stable / chromium-browser are the distro-packaged names
  // (public issue #1969, @bytebyrobert).
  for (const bin of IS_WIN
    ? ['chrome', 'chromium', 'brave']
    : ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'brave', 'brave-browser']) {
    const p = whichPath(bin);
    if (p) return p;
  }
  return null;
}

/**
 * Names the resolved identity is still carrying from the shipped scaffold.
 * Resolution-time, not file-time: it asks the same loader every hook asks, so
 * it sees whatever the DA is actually called right now, wherever that came
 * from. Empty when identity.ts is absent or unreadable — this probe never
 * turns a missing module into a defect.
 *
 * public issue #1885, @MatiasBarboza
 */
async function activeScaffoldIdentity(): Promise<string[]> {
  try {
    const idPath = join(CONFIG_ROOT, 'hooks', 'lib', 'identity.ts');
    if (!existsSync(idPath)) return [];
    const { getDAName, getPrincipal, isScaffoldSentinel, unansweredIdentityNames } = await import(idPath);
    // Honours `confirmed = true` (a real name that equals a scaffold default); older identity.ts lacks it.
    if (typeof unansweredIdentityNames === 'function') return unansweredIdentityNames();
    if (typeof isScaffoldSentinel !== 'function') return [];
    const hits: string[] = [];
    const da = getDAName();
    if (isScaffoldSentinel(da)) hits.push(`DA name is still "${da}"`);
    const principal = getPrincipal()?.name;
    if (isScaffoldSentinel(principal)) hits.push(`principal name is still "${principal}"`);
    return hits;
  } catch {
    return [];
  }
}

// ── capability registry ──────────────────────────────────────────────────────

const CAPS: CapSpec[] = [
  {
    // Identity substitution runs through skills/LifeOS/Tools/RenderIdentity.ts
    // (InstallAll, then the Interview hand-off with --strict), but a
    // skipped step ships a system addressing its owner by a raw
    // PRINCIPAL_NAME-style token with nothing failing. This probe makes that
    // state permanently detectable post-install (public issues #1813, @tzioup;
    // #1817, @catchingknives — G23 covers the release side, this covers the
    // install side). Scope is the MODEL-FACING runtime surfaces only:
    // transcripts (projects/), release staging, and install templates all
    // carry tokens legitimately and must not be scanned.
    id: 'identity-placeholders',
    title: 'Identity placeholders rendered',
    powers: 'the DA knowing who you are — every prompt surface and hook that names you',
    ttlHours: 24 * 7,
    configured: () => true, // every install must have run substitution
    probeOffline: async () => {
      // Sibling defect, same root cause: substitution can be complete while the
      // Interview never ran, leaving the scaffold's own values ("Aria", "Your
      // Name") as the ACTIVE resolved identity. No token survives for the scan
      // below to find, and the system addresses its owner by a placeholder name.
      // public issue #1885, @MatiasBarboza
      const scaffold = await activeScaffoldIdentity();
      const enginePath = join(CONFIG_ROOT, 'skills', 'LifeOS', 'Tools', 'InstallEngine.ts');
      try {
        const { checkSurvivingPlaceholders } = await import(enginePath);
        const roots = [
          join(CONFIG_ROOT, 'hooks'), join(CONFIG_ROOT, 'commands'), join(CONFIG_ROOT, 'agents'),
          join(LIFEOS_DIR, 'ALGORITHM'), join(LIFEOS_DIR, 'LIFEOS_SYSTEM_PROMPT.md'),
          join(CONFIG_ROOT, 'CLAUDE.md'), join(CONFIG_ROOT, 'settings.json'),
        ];
        let total = 0;
        const sites: Array<{ file: string; placeholder: string }> = [];
        for (const root of roots) {
          const r = checkSurvivingPlaceholders(root);
          total += r.total;
          sites.push(...r.files);
        }
        if (total === 0) {
          return scaffold.length
            ? { ok: false, detail: `never-interviewed scaffold identity active — ${scaffold.join(', ')}; placeholders are rendered but the Interview never replaced the shipped defaults` }
            : { ok: true, detail: 'no surviving identity placeholders on model-facing surfaces' };
        }
        const sample = sites.slice(0, 3).map((f) => `${f.placeholder} in ${f.file}`).join('; ');
        const scaffoldNote = scaffold.length ? ` Also: never-interviewed scaffold identity active — ${scaffold.join(', ')}.` : '';
        return { ok: false, detail: `${total} unrendered identity placeholder(s) across ${sites.length} site(s) — substitution never ran or was mis-rooted. E.g. ${sample}.${scaffoldNote}` };
      } catch (e) {
        // A probe that could not run is not a pass. This branch returned
        // ok:true "check unavailable", so a Doctor probing the wrong tree (a
        // mis-rooted CLAUDE_CONFIG_DIR, #1974) reported the identity surface
        // green without ever scanning it. Name the resolved path so the
        // mis-root is diagnosable from the detail line alone.
        // public issue #2026, @ebrett
        const why = existsSync(enginePath)
          ? `InstallEngine present at ${enginePath} but the scan threw: ${String(e).split('\n')[0]}`
          : `InstallEngine not found at ${enginePath}`;
        const scaffoldNote = scaffold.length ? ` Also: never-interviewed scaffold identity active — ${scaffold.join(', ')}.` : '';
        return {
          ok: false,
          detail: `placeholder scan could not run — ${why}. Doctor is probing config root ${CONFIG_ROOT}; if that is not your install, the root is mis-resolved.${scaffoldNote}`,
          fixCmd: 'check that CLAUDE_CONFIG_DIR (or LIFEOS_SKILLS_DIR) points at the real install root, then re-run Setup (skills/LifeOS/Intents/Setup.md) so skills/LifeOS/Tools/InstallEngine.ts lands; then: bun LIFEOS/TOOLS/Doctor.ts',
        };
      }
    },
    // The remediation is the one identity renderer. A hand-built substituteTree over the config root
    // once rewrote the installer with this machine's identity (public issue #1852, @DRAZY);
    // RenderIdentity skips skills/LifeOS/{install,Tools,Intents} and gates on these same roots.
    fixCmd: 'bun <configRoot>/skills/LifeOS/Tools/RenderIdentity.ts --apply --strict',
  },
  {
    id: 'shadow-home',
    title: 'Orphaned memory (shadow-$HOME trees)',
    powers: 'the learning loop, satisfaction ratings, failure capture',
    ttlHours: 24 * 7,
    configured: () => true, // every upgraded install could carry them
    probeOffline: async () => {
      const { found: shadows, incomplete } = await searchShadowHomeDirs();
      // Fail closed: an unfinished search cannot claim "none on disk".
      if (incomplete.length) {
        return { ok: false, detail: `shadow-$HOME search incomplete (timed out or could not run) under ${incomplete.join(', ')}; status unknown${shadows.length ? `; ${shadows.length} found so far` : ''}` };
      }
      if (!shadows.length) return { ok: true, detail: 'no shadow-$HOME trees on disk' };
      const files = countShadowMemoryFiles(shadows);
      return {
        ok: false,
        detail: `${shadows.length} shadow tree(s) holding ${files} orphaned memory file(s) — written by a pre-#1451 install and invisible to MemoryRetriever`,
      };
    },
    fixCmd: 'bun <configRoot>/LIFEOS/TOOLS/Doctor.ts --reclaim',
  },
  {
    // The installer once created the USER link and never MEMORY, so the first
    // recursive mkdir turned LIFEOS/MEMORY into a real directory inside the
    // system tree: writes landed there, the real archive sat unreachable, and
    // every layer stayed green. Link creation is fixed (0ab4d399d); this is the
    // detector for installs born before it. Adapted from the reporter's patch.
    // public issue #1972, @willhern829 (migrate-form fixCmd: @spazbg)
    id: 'userdata-mounts',
    title: 'USER-data mounts (USER + MEMORY symlinks)',
    powers: 'every read and write of identity, TELOS, knowledge, work history and observability',
    ttlHours: 24 * 7,
    configured: () => true, // both mounts are structural; absence is broken, not unconfigured
    probeOffline: async () => {
      const real = (p: string): string | null => { try { return realpathSync(p); } catch { return null; } };
      // userDataRoot() honors LIFEOS_CONFIG_DIR. When that override resolves back
      // INSIDE the harness tree, "expected" equals the live path and the compare
      // below is a tautology that passes on a broken mount — the same self-link
      // LinkUser.ts refuses. Ignore the override and check the conventional root.
      let dataRoot = userDataRoot();
      const lifeosReal = real(LIFEOS_DIR) ?? LIFEOS_DIR;
      const rootReal = real(dataRoot) ?? dataRoot;
      // Both the resolved and the lexical tree root: a not-yet-created target
      // under a symlinked prefix (/var on macOS) only matches the lexical form.
      const selfLink = [lifeosReal, LIFEOS_DIR].some(root => rootReal === root || rootReal.startsWith(root + '/'));
      if (selfLink) dataRoot = join(HOME, '.config', 'LIFEOS', 'USER');
      const broken: string[] = [];
      const fixes: string[] = [];
      for (const name of ['USER', 'MEMORY']) {
        const live = join(LIFEOS_DIR, name);
        const expected = name === 'USER' ? dataRoot : join(dataRoot, 'MEMORY');
        let st: ReturnType<typeof lstatSync>;
        try { st = lstatSync(live); } catch { broken.push(`${name}: missing (expected a symlink → ${expected})`); continue; }
        if (!st.isSymbolicLink()) {
          let stranded = 0;
          try { for (const _ of walkFiles(live)) stranded++; } catch {}
          const targetExists = existsSync(expected);
          broken.push(`${name}: real directory, not a symlink — ${stranded} file(s) stranded in the system tree while ${expected} ${targetExists ? 'sits unreachable' : 'was never created'}`);
          // A born-broken install holds the ONLY copy in the real directory:
          // moving it aside and linking to a never-created target leaves a
          // dangling link, so the target-absent population gets the migrating
          // form. Both are one compound command — a hook write landing between
          // the mv and the ln recreates the directory and ln fails EEXIST.
          fixes.push(targetExists
            ? `mv ${live} ${live}.misplaced-$(date +%Y%m%d) && ln -s ${expected} ${live}   # then diff the .misplaced copy against ${expected} before discarding`
            : `mv ${live} ${expected} && ln -s ${expected} ${live}`);
          continue;
        }
        const actual = real(live);
        if (!actual) { broken.push(`${name}: dangling symlink → ${readlinkSync(live)}`); continue; }
        const canonical = real(expected);
        if (!canonical) { broken.push(`${name}: link target ${expected} does not exist`); continue; }
        if (actual !== canonical) broken.push(`${name}: resolves to ${actual}, expected ${canonical}`);
      }
      if (!broken.length) return { ok: true, detail: `USER → ${dataRoot}, MEMORY → ${join(dataRoot, 'MEMORY')}` };
      return {
        ok: false,
        detail: broken.join('; ') + (selfLink ? ' (LIFEOS_CONFIG_DIR resolves inside the harness tree — ignored)' : ''),
        fixCmd: fixes.length ? `stop the LifeOS launch agents first, then: ${fixes.join(' ; ')}` : undefined,
      };
    },
    // Move or relink, never delete: whatever landed in a real directory is real
    // runtime state, and the operator should diff it before discarding it.
    fixCmd: 'stop the LifeOS launch agents, then relink: ln -sfn <configDir>/USER <configRoot>/LIFEOS/USER && ln -sfn <configDir>/USER/MEMORY <configRoot>/LIFEOS/MEMORY (default configDir: ~/.config/LIFEOS)',
  },
  {
    id: 'codex',
    title: 'Cross-vendor audit (codex CLI)',
    powers: 'independent second-vendor review on high-impact work',
    ttlHours: 24 * 7,
    configured: () => which('codex') || existsSync(join(HOME, '.codex')),
    probeOffline: async () => {
      if (!which('codex')) return { ok: false, detail: 'codex binary not on PATH' };
      const authed = existsSync(join(HOME, '.codex', 'auth.json'));
      return authed
        ? { ok: true, detail: 'binary present, auth file present' }
        : { ok: false, detail: 'binary present but not logged in (~/.codex/auth.json missing)' };
    },
    fixCmd: 'bun install -g @openai/codex && codex login',
  },
  {
    id: 'interceptor',
    title: 'Browser verification (Interceptor)',
    powers: 'real-browser verification of all web/UI claims',
    ttlHours: 24 * 7,
    configured: () => true, // ships with LifeOS; a missing browser is broken, not unconfigured
    probeOffline: async () => {
      const skill = existsSync(join(CONFIG_ROOT, 'skills', 'Interceptor', 'SKILL.md'));
      if (!skill) return { ok: false, detail: 'Interceptor skill not installed' };
      const browser = chromeBinary();
      if (!browser) return { ok: false, detail: 'no Chrome/Brave/Chromium binary found' };
      // Skill files + a browser binary are necessary, not sufficient (public
      // issue #1499, @waveman2020-sudo): the skill's own PreflightIsolation gate
      // also needs the interceptor CLI/daemon and a pinned test-profile context.
      // Report "live" only when the runtime setup exists; otherwise say exactly
      // what one-time setup is missing instead of a false green.
      const cli = which('interceptor') || existsSync(join(HOME, 'Projects', 'interceptor'));
      // The seam copy under LIFEOS/USER is what every real consumer sources (the
      // skill Intents and Tools/EnsureTestProfile.sh); the skill-dir copy is a
      // fallback for installs that never moved it. Match `export FOO=` and quoted
      // values too — the canonical seam file writes `export FOO="<uuid>"`, which
      // the old anchored regex missed, reporting red on a working setup.
      // public issue #1775, @bnkath2o
      const prefsCandidates = [
        join(CONFIG_ROOT, 'LIFEOS', 'USER', 'CUSTOMIZATIONS', 'SKILLS', 'Interceptor', 'preferences.env'),
        join(CONFIG_ROOT, 'skills', 'Interceptor', 'preferences.env'),
      ];
      const prefsPath = prefsCandidates.find((p) => existsSync(p));
      const hasContext = !!prefsPath &&
        /^\s*(?:export\s+)?INTERCEPTOR_TEST_CONTEXT_ID=["']?\S/m.test(readFileSync(prefsPath, 'utf8'));
      if (!cli || !hasContext) {
        const missing = [
          !cli ? 'interceptor CLI/daemon (repo not cloned, binary not on PATH)' : null,
          !hasContext ? 'pinned test-profile context (INTERCEPTOR_TEST_CONTEXT_ID in preferences.env)' : null,
        ].filter(Boolean).join('; ');
        return { ok: false, detail: `skill + browser present, but runtime setup incomplete: ${missing}` };
      }
      // Windows paths separate on '\' (public issue #1810, @umair-a11y) — a
      // '/' split there would print the whole path instead of the binary name.
      const browserName = IS_WIN ? browser.split('\\').pop() : browser.split('/').pop();
      return { ok: true, detail: `skill, browser (${browserName}), CLI, and test-profile context all present` };
    },
    fixCmd: 'run the Interceptor skill setup (clone repo, install extension, pin INTERCEPTOR_TEST_CONTEXT_ID), then re-run: bun LIFEOS/TOOLS/Doctor.ts',
  },
  {
    id: 'cloudflare',
    title: 'Scheduled cloud flows (Cloudflare/cf)',
    powers: 'Workflows scheduled flows and Worker deploys',
    ttlHours: 24,
    configured: () => !!envKey('CLOUDFLARE_API_TOKEN') || existsSync(join(HOME, '.wrangler')) || which('cf') || which('wrangler'),
    probeOffline: async () => {
      const hasToken = !!envKey('CLOUDFLARE_API_TOKEN');
      const hasCf = which('cf') || which('wrangler') || which('bunx');
      if (!hasCf) return { ok: false, detail: 'cf not available (install the cf CLI)' };
      return hasToken
        ? { ok: true, detail: 'CLOUDFLARE_API_TOKEN set, cf reachable' }
        : { ok: false, detail: 'no CLOUDFLARE_API_TOKEN in env or .env' };
    },
    probeNetwork: async () => {
      const r = which('cf') ? await run(['cf', 'auth', 'whoami']) : await run(['bunx', 'wrangler', 'whoami']);
      return r.code === 0
        ? { ok: true, detail: 'cf auth OK' }
        : { ok: false, detail: 'cf auth check failed (token invalid or expired)' };
    },
    fixCmd: 'add CLOUDFLARE_API_TOKEN to <configRoot>/.env, then: bun LIFEOS/TOOLS/Doctor.ts --network',
  },
  {
    id: 'voice',
    title: 'Voice notifications (Fish Audio)',
    powers: 'spoken notifications via the Pulse voice server',
    ttlHours: 24,
    configured: () => !!envKey('FISH_API_KEY'),
    // No voice key is a supported install: notifications stay silent and nothing errors (ISA 20261014-lifeos-installer ISC-21).
    offWhenUnconfigured: 'off — no FISH_API_KEY, so notifications are silent. To turn voice on: bun LIFEOS/TOOLS/Secrets.ts set FISH_API_KEY, and set fish_reference_id under [da.voices.main] in LIFEOS_CONFIG.toml',
    probeOffline: async () => {
      if (!envKey('FISH_API_KEY')) return { ok: false, detail: 'FISH_API_KEY is not set (env or .env)' };
      return { ok: true, detail: 'FISH_API_KEY configured' };
    },
    probeNetwork: async () => {
      const key = envKey('FISH_API_KEY');
      if (!key) return { ok: false, detail: 'FISH_API_KEY is not set (env or .env)' };
      // Probe the TTS endpoint itself, the exact path notifications use: a
      // one-word synthesis in the DA's main voice. Cost is negligible, and only
      // opted-in configured installs run it.
      try {
        const { fishSpeak } = await import('./FishTTS');
        const audio = await fishSpeak('ok', { voice: 'main', apiKey: key, timeoutMs: PROBE_TIMEOUT_MS });
        return { ok: true, detail: `TTS round-trip OK (${audio.byteLength} bytes of audio on the notification path)` };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('fish_reference_id')) {
          return { ok: false, detail: `key set but no Fish voice configured — ${msg}`, fixCmd: 'set fish_reference_id under [da.voices.main] in LIFEOS_CONFIG.toml, then: bun LIFEOS/TOOLS/Doctor.ts --network' };
        }
        const status = msg.match(/Fish API error: (\d{3})/)?.[1];
        if (status === '401' || status === '403') return { ok: false, detail: `Fish rejected the key (${status}) — FISH_API_KEY is invalid or revoked` };
        if (status === '402') return { ok: false, detail: 'Fish credit exhausted (402) — top up at fish.audio, key and voice are fine' };
        if (status) return { ok: false, detail: `TTS failed (${status}): ${msg.slice(0, 120)}` };
        return { ok: false, detail: `Fish unreachable (offline or timeout): ${msg.slice(0, 120)}` };
      }
    },
    fixCmd: 'set FISH_API_KEY in <configRoot>/.env',
  },

  // ── external binaries shipped code shells out to ───────────────────────────
  // Each of these is spawned directly by shipped code, so absence is "broken",
  // not "unconfigured" — hence configured: () => true. They stay honest about
  // what absence actually costs: `gh` fails outright, the rest degrade.
  // public PR #1660 and #1661, @elhoim
  {
    id: 'ripgrep',
    title: 'Fast filesystem search (ripgrep)',
    powers: 'ContextSearch queries, work sweeps, and the model-drift scan',
    ttlHours: 24 * 7,
    configured: () => true, // shipped code shells out to `rg`; absence is broken, not unconfigured
    probeOffline: async () => probeLive({ bin: 'rg' }),
    fixCmd: 'brew install ripgrep  (Linux: sudo apt-get install ripgrep)',
  },
  {
    id: 'imagemagick',
    title: 'Image inspection (ImageMagick)',
    powers: "Interceptor's blank-frame guard, measured zoom, and Art composition",
    ttlHours: 24 * 7,
    configured: () => true, // the capture guard and Art both shell out to `magick`
    probeOffline: async () => probeLive({ bin: 'magick' }),
    fixCmd: 'brew install imagemagick  (Linux: sudo apt-get install imagemagick)',
  },
  {
    id: 'gh',
    title: 'Work system of record (GitHub CLI)',
    powers: 'work capture, sweeps, commitments, and the Pulse Work tab',
    ttlHours: 24 * 7,
    configured: () => true, // WorkSweep/CommitmentSweep/Pulse spawn `gh` with no fallback
    probeOffline: async () => probeLive({ bin: 'gh' }),
    fixCmd: 'brew install gh && gh auth login  (Linux: see cli.github.com)',
  },
  {
    id: 'ffmpeg',
    title: 'Audio/video processing (ffmpeg)',
    powers: 'AudioEditor, transcript splitting, Conveyor renders, Interceptor zoom fallback',
    ttlHours: 24 * 7,
    configured: () => true, // SplitAndTranscribe and AudioEditor spawn `ffmpeg` directly; ffmpeg needs single-dash -version
    probeOffline: async () => probeLive({ bin: 'ffmpeg', versionArgs: ['-version'] }),
    fixCmd: 'brew install ffmpeg  (Linux: sudo apt-get install ffmpeg)',
  },
  {
    id: 'ytdlp',
    title: 'YouTube ingestion (yt-dlp)',
    powers: "the Feed YouTube source and the Upgrade skill's channel scan",
    ttlHours: 24 * 7,
    configured: () => true,
    // public issue #2066, @BS-WS04: yt-dlp is date-versioned and rots against YouTube; detect staleness > 180 days
    probeOffline: async () => probeLive({ bin: 'yt-dlp', staleAfterDays: 180 }),
    fixCmd: 'brew install yt-dlp  (Linux: sudo apt-get install yt-dlp)',
  },
  {
    id: 'fabric',
    title: 'Prompt patterns (fabric)',
    powers: "YouTube transcript fetch (fabric -y) and URL fallback (-u); Fabric patterns run natively without it",
    ttlHours: 24 * 7,
    configured: () => true,
    // public PR #2153 (issue #2152), @NAmorim: Homebrew installs this project as
    // `fabric-ai` (the `fabric` formula is an unrelated Python SSH tool). Callers
    // exec `fabric` (GetTranscript.ts, HookBridge.ts), so fabric-ai alone is still
    // broken for them: say how to fix it rather than report live.
    probeOffline: async () =>
      !which('fabric') && which('fabric-ai')
        ? { ok: false, detail: 'fabric-ai on PATH but callers run `fabric` — link it: ln -s "$(command -v fabric-ai)" ~/.local/bin/fabric' }
        : probeLive({ bin: 'fabric' }),
    fixCmd: 'brew install fabric-ai, then link it as `fabric` (not `brew install fabric`, an unrelated Python SSH tool)',
  },
  {
    id: 'jq',
    title: 'JSON in shell hooks (jq)',
    powers: 'hook-side JSON parsing, including the command-compression rewrite',
    ttlHours: 24 * 7,
    configured: () => true,
    probeOffline: async () => probeLive({ bin: 'jq' }),
    fixCmd: 'brew install jq  (Linux: sudo apt-get install jq)',
  },
  {
    id: 'hook-interpreters',
    title: 'Hook interpreter resolution',
    powers: 'every hook registered in settings.json — enforcement, injection, gates',
    ttlHours: 24 * 7,
    configured: () => existsSync(join(CONFIG_ROOT, 'settings.json')),
    probeOffline: async () => {
      // A hook whose interpreter can't be resolved fails as `env: bun: No such
      // file or directory` on stderr and is otherwise INVISIBLE — the gate just
      // stops gating (public issue #1600, @cristbc). Writing a resolved PATH into
      // settings.json was rejected: that PATH would then apply to every session
      // Bash call. Reporting it is the fix.
      const problems = hookInterpreterProblems();
      if (!problems.length) return { ok: true, detail: 'every registered hook resolves its interpreter' };
      return { ok: false, detail: problems.join('; ') };
    },
    fixCmd: 'bun <configRoot>/LIFEOS/TOOLS/Doctor.ts --hooks   # per-hook detail and remediation',
  },
];

/**
 * Resolve the interpreter of every hook command registered in settings.json.
 *
 * Two registration shapes, two failure modes:
 *   - explicit  (`bun /path/x.hook.ts`) → the named interpreter must be on PATH
 *   - bare      (`/path/x.hook.ts`)     → exec needs BOTH the execute bit and a
 *                                         `#!` line, and the shebang's own
 *                                         interpreter must resolve
 * Returns one short string per broken hook; empty array means all resolve.
 */
/** Expand `~`, `$VAR` and `${VAR}` the way the shell running a hook would. */
function expandPath(p: string): string {
  return p
    .replace(/^~(?=\/|$)/, HOME)
    .replace(/\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?/g, (m, name: string) => {
      // Claude Code supplies these at hook time; Doctor's own env may not have
      // them, and both point at the install root here.
      if (name === 'CLAUDE_PROJECT_DIR' || name === 'CLAUDE_CONFIG_DIR') {
        return process.env[name] || CONFIG_ROOT;
      }
      return process.env[name] ?? m;
    });
}

function hookInterpreterProblems(): string[] {
  const settingsPath = join(CONFIG_ROOT, 'settings.json');
  let hooksBlob: any;
  // Fail closed: an unreadable or malformed settings.json, or one with no hooks
  // block, means NO hook can be proven to resolve. That is a blocking unknown,
  // never "every hook resolves".
  try { hooksBlob = JSON.parse(readFileSync(settingsPath, 'utf8')).hooks; }
  catch (e) { return [`settings.json unreadable or malformed (${(e as Error).message}); hook interpreters unknown`]; }
  if (!hooksBlob || typeof hooksBlob !== 'object') return ['settings.json has no hooks block; hook interpreters unknown'];

  const commands: string[] = [];
  const walk = (node: any): void => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === 'object') {
      if (typeof node.command === 'string') commands.push(node.command);
      return Object.values(node).forEach(walk);
    }
  };
  walk(hooksBlob);

  // A hooks block that registers no command proves nothing resolves: it is the
  // same blocking unknown as no hooks block at all.
  if (commands.length === 0) return ['settings.json registers no hook commands; hook interpreters unknown'];

  const problems: string[] = [];
  const seen = new Set<string>();
  for (const raw of commands) {
    // First token wins: `bun x.ts` → bun; `/path/x.hook.ts` → the script itself.
    const tokens = raw.trim().split(/\s+/);
    const first = tokens[0]?.replace(/^["']|["']$/g, '') ?? '';
    if (!first || seen.has(first)) continue;
    seen.add(first);
    const resolved = expandPath(first);
    // An unexpandable $VAR means Doctor's env differs from the hook's, so it
    // cannot judge that path. That is an unknown, reported as a blocking problem,
    // never silently skipped into a clean result.
    if (resolved.includes('$')) { problems.push(`${first}: interpreter path has an unresolved variable; cannot verify it resolves (unknown)`); continue; }

    if (!/[/\\]/.test(first)) {
      // Bare interpreter name (bun, node, sh, jq…) — must be on PATH.
      if (!which(first)) problems.push(`${first}: not on PATH`);
      continue;
    }
    // A PATH-ful first token followed by more tokens is an interpreter invoking
    // a script (`/usr/bin/python3 x.py`), not a script run bare. Its shebang is
    // irrelevant and usually absent — a compiled interpreter has none — so
    // reading one reported "no #! shebang" against a perfectly working hook.
    // Existence and the exec bit are the only real requirements here.
    // public issue #1856, @Yang642514
    if (tokens.length > 1) {
      const name = basename(resolved);
      if (!existsSync(resolved)) { problems.push(`${name}: file not found`); continue; }
      // The Unix exec bit has no meaning on NTFS — checking it there reports
      // every working hook as unexecutable (public issue #1810, @umair-a11y).
      if (IS_WIN) continue;
      let mode = 0;
      try { mode = statSync(resolved).mode; } catch {}
      if (!(mode & 0o111)) problems.push(`${name}: not executable (chmod +x)`);
      continue;
    }
    // A bare script path. exec() needs mode + shebang.
    if (!existsSync(resolved)) { problems.push(`${basename(resolved)}: file not found`); continue; }
    const name = basename(resolved);
    if (!IS_WIN) {
      let mode = 0;
      try { mode = statSync(resolved).mode; } catch {}
      if (!(mode & 0o111)) { problems.push(`${name}: not executable (chmod +x)`); continue; }
    }
    // A native executable (Mach-O / ELF, e.g. iTerm2's compiled cc-status
    // status-line helper) needs no shebang; exec() runs it directly. Only
    // scripts do, so check the magic bytes before demanding a `#!` line.
    // public PR #2119, @Rubix-BNL
    let magic = Buffer.alloc(0);
    try { magic = readFileSync(resolved).subarray(0, 4); } catch {}
    if (isNativeBinary(magic)) continue;

    let head = '';
    try { head = readFileSync(resolved, 'utf8').slice(0, 200).split('\n')[0]; } catch {}
    if (!head.startsWith('#!')) {
      // Windows has no shebang mechanism — the file association or the harness
      // picks the interpreter — so a missing `#!` is not a defect there.
      // public issue #1810, @umair-a11y
      if (IS_WIN) continue;
      problems.push(`${name}: no #! shebang`); continue;
    }
    // `#!/usr/bin/env bun` → the interpreter env will look up is the 2nd word.
    const shebang = head.slice(2).trim().split(/\s+/);
    const interp = shebang[0].endsWith('/env') ? shebang[1] : shebang[0];
    if (!interp) continue;
    if (interp.includes('/')) {
      // A POSIX absolute interpreter path never exists on Windows, so judge the
      // basename against PATH instead of calling every hook broken.
      // public issue #1810, @umair-a11y
      if (IS_WIN) {
        const interpName = basename(interp);
        if (!which(interpName)) problems.push(`${name}: shebang needs '${interpName}', not on PATH`);
      } else if (!existsSync(interp)) {
        problems.push(`${name}: shebang interpreter ${interp} missing`);
      }
    } else if (!which(interp)) {
      problems.push(`${name}: shebang needs '${interp}', not on PATH`);
    }
  }
  return problems;
}

/**
 * True when the first four bytes are an ELF, Mach-O (32/64, either byte order)
 * or fat/universal header. Native binaries need no shebang.
 */
function isNativeBinary(magic: Buffer): boolean {
  if (magic.length < 4) return false;
  const be = magic.readUInt32BE(0);
  return be === 0x7f454c46 || // ELF
    be === 0xfeedface || // Mach-O 32-bit BE
    be === 0xfeedfacf || // Mach-O 64-bit BE
    be === 0xcefaedfe || // Mach-O 32-bit LE
    be === 0xcffaedfe || // Mach-O 64-bit LE
    be === 0xcafebabe || // Fat/universal BE
    be === 0xbebafeca;   // Fat/universal LE
}

// ── manifest io ──────────────────────────────────────────────────────────────

function loadManifest(): Manifest {
  if (existsSync(MANIFEST)) {
    try { return JSON.parse(readFileSync(MANIFEST, 'utf8')); } catch {}
  }
  return {
    version: 1, updatedAt: new Date().toISOString(),
    note: 'Advisory cache, not truth. Written only by LIFEOS/TOOLS/Doctor.ts. Readers must treat entries past ttlHours as stale and re-verify doctrine-critical capabilities live.',
    capabilities: {}, ackedBroken: [],
  };
}

function salt(): string {
  if (!existsSync(SALT_FILE)) {
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(SALT_FILE, randomBytes(32).toString('hex'));
    try { chmodSync(SALT_FILE, 0o600); } catch {}
  }
  return readFileSync(SALT_FILE, 'utf8').trim();
}

function computeIntegrity(m: Manifest): string {
  const { integrity: _drop, ...body } = m;
  return createHash('sha256').update(salt() + JSON.stringify(body)).digest('hex');
}

function saveManifest(m: Manifest): void {
  m.updatedAt = new Date().toISOString();
  m.integrity = computeIntegrity(m);
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(MANIFEST, JSON.stringify(m, null, 2));
  // Display sidecar for the statusline: precomputed here so the shell script
  // renders with a bare `cat` — no bun spawn, no hash math, per refresh tick.
  const broken = Object.entries(m.capabilities)
    .filter(([, r]) => r.state === 'broken').map(([id]) => id);
  const fresh = broken.filter(id => !(m.ackedBroken || []).includes(id));
  writeFileSync(join(STATE_DIR, 'capabilities-statusline.txt'),
    fresh.length ? `⚠ ${fresh.length} capability regression — lifeos doctor` : '');
}

function isStale(r: CapResult): boolean {
  return Date.now() - Date.parse(r.checkedAt) > r.ttlHours * 3_600_000;
}

// ── commands ─────────────────────────────────────────────────────────────────

async function probeAll(network: boolean): Promise<Manifest> {
  const m = loadManifest();
  for (const cap of CAPS) {
    const prev = m.capabilities[cap.id];
    if (prev?.state === 'declined') continue; // declined is silent and sticky

    if (!cap.configured()) {
      m.capabilities[cap.id] = cap.offWhenUnconfigured
        ? { state: 'off', checkedAt: new Date().toISOString(), ttlHours: cap.ttlHours, detail: cap.offWhenUnconfigured, fixCmd: null, probeClass: 'offline' }
        : { state: 'broken', checkedAt: new Date().toISOString(), ttlHours: cap.ttlHours, detail: 'not set up on this machine', fixCmd: cap.fixCmd, probeClass: 'offline' };
      continue;
    }
    let res = await cap.probeOffline();
    let probeClass: 'offline' | 'network' = 'offline';
    if (res.ok && network && cap.probeNetwork) {
      res = await cap.probeNetwork();
      probeClass = 'network';
    }
    // public issue #2135, @hjbrandt: downgrade-only guard — offline pass cannot
    // clear a network failure that is still fresh. offline failure still lands immediately.
    if (
      probeClass === 'offline' && res.ok &&
      prev?.state === 'broken' && prev.probeClass === 'network' && !isStale(prev)
    ) {
      m.capabilities[cap.id] = { ...prev, detail: `${prev.detail} [network verdict kept]` };
      continue;
    }
    m.capabilities[cap.id] = {
      state: res.ok ? 'live' : 'broken',
      checkedAt: new Date().toISOString(), ttlHours: cap.ttlHours,
      // A probe that diagnosed a specific cause names its own fix; the CapSpec's
      // static one is the fallback. ported from public PR #2053, @hjbrandt
      detail: res.detail, fixCmd: res.ok ? null : (res.fixCmd ?? cap.fixCmd), probeClass,
    };
  }
  saveManifest(m);
  writeFileSync(HEARTBEAT, JSON.stringify({ ranAt: new Date().toISOString(), network }, null, 2));
  return m;
}

function renderTable(m: Manifest): string {
  const lines: string[] = ['', 'LifeOS Doctor — capability check', ''];
  for (const cap of CAPS) {
    const r = m.capabilities[cap.id];
    if (!r) continue;
    const stale = r.state !== 'declined' && r.state !== 'off' && isStale(r);
    const icon = r.state === 'live' ? (stale ? '◌' : '✅')
      : r.state === 'declined' || r.state === 'off' ? '⏸'
      : r.state === 'broken' ? '❌' : '◌';
    const label = r.state === 'declined' ? 'off (declined)' : r.state === 'off' ? 'off' : stale ? `${r.state} (stale — re-run doctor)` : r.state;
    lines.push(`${icon} ${cap.title} — ${label}`);
    lines.push(`   powers: ${cap.powers}`);
    if (r.state !== 'declined') lines.push(`   ${r.detail}`);
    if (r.state === 'broken' && r.fixCmd) lines.push(`   fix: ${r.fixCmd}`);
    lines.push('');
  }
  lines.push('Re-run any time: bun <configRoot>/LIFEOS/TOOLS/Doctor.ts  (add --network for live auth checks)');
  lines.push('Opt out of a capability forever: bun ... Doctor.ts decline <name>  — declined is silent, never nagged.');
  return lines.join('\n');
}

function statuslineGlyph(): string {
  if (!existsSync(MANIFEST)) return '';
  let m: Manifest;
  try { m = JSON.parse(readFileSync(MANIFEST, 'utf8')); } catch { return '⚠ doctor: manifest unreadable'; }
  // Fail closed: a manifest with no integrity field, or the wrong shape, is
  // treated as tampered. Deleting the field must not skip the check.
  if (!m || typeof m !== 'object' || !m.capabilities || typeof m.capabilities !== 'object') return '⚠ doctor: manifest tampered';
  if (typeof m.integrity !== 'string' || !m.integrity || m.integrity !== computeIntegrity(m)) return '⚠ doctor: manifest tampered';
  const broken = Object.entries(m.capabilities)
    .filter(([, r]) => r.state === 'broken').map(([id]) => id);
  const fresh = broken.filter(id => !(m.ackedBroken || []).includes(id));
  return fresh.length ? `⚠ ${fresh.length} capability regression — lifeos doctor` : '';
}

// ── main ─────────────────────────────────────────────────────────────────────

// ── reconciler: declared (hooks on disk) vs registered (settings.json) ──────
// v1 scope: hooks only, two inventories. "Observed" (fire evidence from
// observability logs) is deferred — noted in the output so absence is loud.
function reconcileHooks(): { unwired: string[]; missing: string[]; note: string } {
  const hooksDir = join(CONFIG_ROOT, 'hooks');
  const settingsPath = join(CONFIG_ROOT, 'settings.json');
  const declared = existsSync(hooksDir)
    ? readdirSync(hooksDir).filter(f => f.endsWith('.hook.ts') || f.endsWith('.hook.sh'))
    : [];
  let registeredBlob = '';
  try {
    const s = JSON.parse(readFileSync(settingsPath, 'utf8'));
    registeredBlob = JSON.stringify(s.hooks || {});
  } catch {}
  // Direct registration by filename, then expand through dispatcher imports:
  // registered hooks that import sibling hook files wire them indirectly
  // (e.g. a PreToolUse dispatcher invoking per-domain guards). Without this
  // expansion the reconciler cries wolf on every dispatched hook.
  const registered = new Set(declared.filter(f => registeredBlob.includes(f)));
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of [...registered]) {
      let src = '';
      try { src = readFileSync(join(hooksDir, f), 'utf8'); } catch { continue; }
      for (const g of declared) {
        if (registered.has(g)) continue;
        const base = g.replace(/\.hook\.(ts|sh)$/, '');
        // Real import/require statements only — a comment mention is not wiring.
        if (new RegExp(`(?:from\\s+['"]\\./${base}\\.hook['"]|require\\(['"]\\./${base}\\.hook['"]\\)|import\\(['"]\\./${base}\\.hook['"]\\))`).test(src)) {
          registered.add(g); grew = true;
        }
      }
    }
  }
  const unwired = declared.filter(f => !registered.has(f));
  // wired-but-missing: registered commands referencing hook files not on disk
  const missing = [...registeredBlob.matchAll(/([A-Za-z0-9_-]+\.hook\.(?:ts|sh))/g)]
    .map(m => m[1]).filter((f, i, a) => a.indexOf(f) === i)
    .filter(f => !declared.includes(f));
  return { unwired, missing, note: 'v1 reconciles declared (hooks/ dir) vs registered (settings.json); observed-fire evidence deferred' };
}

const args = process.argv.slice(2);
const flag = (f: string) => args.includes(f);

if (flag('--statusline')) {
  console.log(statuslineGlyph());
  process.exit(0);
}

if (flag('--reconcile')) {
  const r = reconcileHooks();
  console.log(JSON.stringify(r, null, 2));
  process.exit(0);
}

if (flag('--hooks')) {
  const problems = hookInterpreterProblems();
  if (!problems.length) {
    console.log('hook interpreters: every registered hook resolves ✅');
  } else {
    console.log(`hook interpreters: ${problems.length} hook(s) cannot start —\n`);
    for (const p of problems) console.log(`  ✗ ${p}`);
    console.log('\nA hook that cannot start fails silently: no gate, no enforcement, just');
    console.log('`env: <interp>: No such file or directory` on a stderr nobody reads. Fix by');
    console.log('installing the interpreter, or `chmod +x` / restoring the `#!` line on the hook.');
    console.log('Do NOT hardcode a resolved PATH into settings.json — that PATH would then');
    console.log('apply to every session Bash call (public issue #1600, @cristbc).');
  }
  process.exit(0);
}

if (flag('--reclaim')) {
  await reclaimShadows();
  process.exit(0);
}

if (flag('--verify')) {
  // No manifest, or one that cannot be read or parsed, cannot be verified: that is
  // a blocking failure, never a pass.
  if (!existsSync(MANIFEST)) { console.log('INTEGRITY UNKNOWN — no manifest to verify; run Doctor first'); process.exit(2); }
  let m: Manifest;
  try { m = JSON.parse(readFileSync(MANIFEST, 'utf8')); }
  catch (e) { console.log(`INTEGRITY UNKNOWN — manifest unreadable or malformed (${(e as Error).message}). Re-run Doctor to regenerate.`); process.exit(2); }
  const ok = !!m && typeof m === 'object' && !!m.integrity && m.integrity === computeIntegrity(m);
  console.log(ok ? 'integrity OK' : 'INTEGRITY FAILURE — manifest was edited outside Doctor. Re-run Doctor to regenerate.');
  process.exit(ok ? 0 : 2);
}

if (args[0] === 'decline' || args[0] === 'enable') {
  const id = args[1];
  const cap = CAPS.find(c => c.id === id);
  if (!cap) { console.log(`unknown capability "${id}" — known: ${CAPS.map(c => c.id).join(', ')}`); process.exit(0); }
  const m = loadManifest();
  if (args[0] === 'decline') {
    m.capabilities[id] = {
      state: 'declined', checkedAt: new Date().toISOString(), ttlHours: 24 * 365,
      detail: 'declined by user — permanently silent', fixCmd: null, probeClass: 'offline',
    };
    m.ackedBroken = (m.ackedBroken || []).filter(x => x !== id);
    console.log(`${cap.title}: off (declined). It will never warn or nag. Re-enable: bun ... Doctor.ts enable ${id}`);
  } else {
    delete m.capabilities[id];
    console.log(`${cap.title}: re-enabled — run Doctor to probe it.`);
  }
  saveManifest(m);
  process.exit(0);
}

if (args[0] === 'ack') {
  const m = loadManifest();
  m.ackedBroken = Object.entries(m.capabilities)
    .filter(([, r]) => r.state === 'broken').map(([id]) => id);
  saveManifest(m);
  console.log(`acknowledged ${m.ackedBroken.length} broken capabilit${m.ackedBroken.length === 1 ? 'y' : 'ies'} — statusline stays quiet until something NEW regresses.`);
  process.exit(0);
}

const network = flag('--network') && !flag('--no-network');
const m = await probeAll(network);
if (flag('--json')) {
  console.log(JSON.stringify(m, null, 2));
} else {
  console.log(renderTable(m));
}
process.exit(0);
