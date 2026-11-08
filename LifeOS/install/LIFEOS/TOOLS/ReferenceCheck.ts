#!/usr/bin/env bun
/**
 * @version 1.8.0
 * ReferenceCheck.ts — Full-surface reference validator for the LifeOS system.
 *
 * Walks every file under ~/.claude (excluding noise dirs), extracts every
 * reference from .md/.ts/.json files, validates each against the filesystem,
 * and emits three categories: missing, stale, orphan.
 *
 * A file whose own leading frontmatter declares `references: historical` is
 * skipped (a generated record quoting paths as they stood); the marker is per
 * file, never per directory, and every skip is listed in --json historicalSkipped.
 *
 * A skill-internal ref (`Tools/`, `References/`, `Intents/`, `Workflows/`) in a
 * markdown doc also resolves against any skill the same line names by path
 * (`skills/X/...`); absent there, it is still missing.
 *
 * Superset of DocCheck.ts. DocCheck stays for the narrow doc-specific use
 * consumed by DocIntegrity.hook.ts; this tool covers the full release surface.
 *
 * Usage:
 *   bun ReferenceCheck.ts                # default: missing only
 *   bun ReferenceCheck.ts --json         # structured output
 *   bun ReferenceCheck.ts --quiet        # issues only
 *   bun ReferenceCheck.ts --changed      # git-dirty files + dependents
 *   bun ReferenceCheck.ts --stale        # include stale findings
 *   bun ReferenceCheck.ts --content      # also check `path:line` — `snippet` citations by content (lib/CitationCheck.ts)
 *   bun ReferenceCheck.ts --orphans      # include orphan findings
 *   bun ReferenceCheck.ts --root <dir>   # scan an install root other than ~/.claude (a staged release)
 *   bun ReferenceCheck.ts --shipped-paths # also resolve quoted install paths + spawn/dynamic-import specifiers
 *   bun ReferenceCheck.ts --help         # usage
 *
 * Exit codes:
 *   0 — no missing refs (stale/orphan do not fail)
 *   1 — missing refs found (with --content, also rotten citations)
 *   2 — scan error (unreadable root, etc)
 */

import { readFileSync, statSync, lstatSync, existsSync, readdirSync, realpathSync } from 'fs';
import { join, resolve, dirname, relative, extname, sep, basename } from 'path';
import { execFileSync } from 'child_process';
import { getClaudeDir } from './Paths';
import { checkCitation, findCitations, isRotten, type CitationState } from './lib/CitationCheck';

// ── Arg parsing (manual, zero deps) ──

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`ReferenceCheck — validate every reference across ~/.claude

Usage: bun ReferenceCheck.ts [flags]

Flags:
  --json       Structured JSON output
  --quiet      Suppress OK lines; issues only
  --changed    Only scan git-dirty files + their dependents
  --stale      Include stale findings (ref mtime > referrer mtime)
  --content    Also check "path:line" — "snippet" citations in .md files by content:
               ok, moved, ambiguous, changed, gone, dir, outside. Pointers with no
               snippet are counted, not checked. Not narrowed by --changed.
  --orphans    Include orphan findings (file exists, nothing refs it)
  --root <dir> Scan <dir> as the install root instead of ~/.claude (a staged release tree)
  --shipped-paths
               Also resolve quoted/backticked install paths (LIFEOS/TOOLS, LIFEOS/PULSE,
               hooks, commands, workflows), join("LIFEOS","TOOLS",...) segment lists and
               dynamic import() specifiers — in code files too. The staged G7 lane.
  --help       This message

Exit codes: 0 clean, 1 missing refs (or rotten citations under --content), 2 scan error`);
  process.exit(0);
}

const jsonOutput = args.includes('--json');
const quiet = args.includes('--quiet');
const changedOnly = args.includes('--changed');
const includeStale = args.includes('--stale');
// --content: the opt-in content check of `path:line` — `snippet` citations. public issue #2221, @drpaulobernardy
const contentMode = args.includes('--content');
const includeOrphans = args.includes('--orphans');
// --shipped-paths / --root: the staged-install lane. G7 used to run only against
// the live tree, so a shipped file naming a path that the release scrub removes
// (a private skill, Bunker, a zoned tool) passed every gate and 404'd on every
// install. public issue #1955, @pybe
const shippedPaths = args.includes('--shipped-paths');
const rootArg = args.indexOf('--root') >= 0 ? args[args.indexOf('--root') + 1] : undefined;
if (args.includes('--root') && !rootArg) {
  console.error('ReferenceCheck: --root needs a directory');
  process.exit(2);
}
const CLAUDE_DIR = rootArg ? resolve(rootArg) : getClaudeDir();   // resolver, not a literal (B2 config-root sweep)
if (rootArg && !existsSync(CLAUDE_DIR)) {
  console.error(`ReferenceCheck: --root ${CLAUDE_DIR} does not exist`);
  process.exit(2);
}
// A root that is not a readable directory scans nothing, and a scan of nothing
// finds no missing reference: the check would pass on an install it never read.
try {
  if (!statSync(CLAUDE_DIR).isDirectory()) throw new Error('not a directory');
  readdirSync(CLAUDE_DIR);
} catch (e: any) {
  console.error(`ReferenceCheck: scan root ${CLAUDE_DIR} is not a readable directory — ${e?.message || e}`);
  process.exit(2);
}
const LIFEOS_DIR = join(CLAUDE_DIR, 'LIFEOS');
// Under --root the question is "does this ship", so a reference counts only when its
// target resolves (symlinks dereferenced) INSIDE the canonical staging root. A `../`
// that climbs out, or a staged symlink pointing at a host file, used to satisfy the
// check from the build machine and 404 on every install.
const STAGING_ROOT_REAL: string | null = rootArg ? realpathSync(CLAUDE_DIR) : null;
function present(p: string): boolean {
  if (!existsSync(p)) return false;
  if (STAGING_ROOT_REAL === null) return true;
  let real: string;
  try { real = realpathSync(p); } catch { return false; }
  return real === STAGING_ROOT_REAL || real.startsWith(STAGING_ROOT_REAL + sep);
}

// ── Exclusion rules ──

const EXCLUDE_DIR_NAMES = new Set([
  'node_modules', '.git', '.next', '.turbo', '.cache', 'dist', 'build',
  'logs',
  'Archive', 'Backups',  // frozen historical snapshots — broken refs are expected
  'SYSTEMUPDATES',     // historical system-update records reference long-renamed files (added 2026-05-24)
  'WORK',                 // per-session work archives — refs to files renamed/deleted after the session
]);

// Top-level path segments (relative to CLAUDE_DIR) that are entirely ignored.
const EXCLUDE_PATH_PREFIXES = [
  'LIFEOS/MEMORY',
  'LIFEOS/USER/MEMORY',        // post-Phase-G symlink target — MEMORY moved into the user's private USER-data repo (2026-05-22→23)
  'LIFEOS/PULSE/Observability/.next',
  'LIFEOS/PULSE/Observability/node_modules',
  'LIFEOS/PULSE/state',        // runtime state — not docs
  'LIFEOS/LIFEOS_RELEASES',
  'LIFEOS_RELEASES',
  'LIFEOS/USER/CUSTOMIZATIONS/WORKFLOWS',     // private fleet tree; any symlink to it is excluded too (walk checks real paths)
  'LIFEOS/USER/DAEMON',        // private daemon work
  'LIFEOS/USER/CACHE',         // regenerable run artifacts (cortex-replay transcripts etc.) — they quote file paths as they stood mid-session, so a later rename makes a cache entry 'broken' when nothing live is (2026-08-19)
  'LIFEOS/USER/CUSTOMIZATIONS/SKILLS',
  'skills/LifeOS/install',     // redistribution payload — template sources staged for release, not the live system; their refs resolve on the INSTALLED tree, not here (public issues #1853, @DRAZY; #1732, @umair-a11y)
  'jobs',                      // background-job scratch (harness-owned; holds scratch copies of docs). public PR #2124, @pai-scaffolde
  'LIFEOS/WORKFLOWS/v1',       // the v1 cloud fleet's docs (actions/flows/pipelines) consolidated here
  'MEMORY',
  'Projects',
  'projects',
  'Plans',
  'plan',
  'plans',
  'plugins',        // third-party plugin cache — not LifeOS system
  'Plugins',        // plugin marketplaces cache (external plugins reference their own repo-relative paths) — not LifeOS system
  'cache',          // Claude Code internal cache
  'tasks',          // Claude Code internal task state
  'teams',          // Claude Code internal team state
  'sessions',
  'session-env',
  'shell-snapshots',
  'statsig',
  'todos',
  'ide',
  'telemetry',
  'usage-data',
  'test-results',
  'downloads',
  'backups',
  'paste-cache',
  'file-history',
  'History',
  'commands',
  '.prd',
  '.venv',
  '.vscode',
  '.wrangler',
  '.next',
  '.claude',        // nested .claude (from shadow releases)
];

// Specific files matched by exact relative path. Currently used to exclude
// historical Algorithm version snapshots (older than LATEST) AND pre-release
// version drafts (newer than LATEST — forward-doctrine drafts that legitimately
// reference planned-but-not-yet-shipped infrastructure). They reference doctrine
// and tool names that have either since been renamed (historical) or do not yet
// exist (pre-release) — those refs are intentional, not live references.
// The current Algorithm version is loaded explicitly from LIFEOS/ALGORITHM/v{N}.md
// by the ALGORITHM phase; ReferenceCheck does not need to verify archives or drafts.
// Algorithm changelog is also treated as historical — entries reference renamed
// or deleted files at the time of writing.
function isArchivedAlgorithmVersion(relPath: string): boolean {
  if (relPath === 'LIFEOS/ALGORITHM/changelog.md') return true;
  // Match LIFEOS/ALGORITHM/v{major}.{minor}.{patch}.md but not the latest.
  // Anything except the current LATEST is excluded — covers historical AND
  // pre-release drafts (e.g., v6.10.0.md when LATEST is 6.9.0).
  const m = relPath.match(/^LIFEOS\/ALGORITHM\/v(\d+\.\d+\.\d+)\.md$/);
  if (!m) return false;
  return m[1] !== getLatestAlgorithmVersion();
}

let _latestAlgVersionCache: string | null = null;
function getLatestAlgorithmVersion(): string {
  if (_latestAlgVersionCache !== null) return _latestAlgVersionCache;
  // Source of truth: LIFEOS/ALGORITHM/LATEST file (a single-line version string).
  // The previous implementation inferred LATEST from the highest filename in the
  // dir, but that classifies forward-doctrine drafts (e.g. v6.10.0.md while
  // LATEST=6.9.0) as "the latest" and exposes their planned-but-not-yet-shipped
  // refs to G7. Reading the LATEST file directly fixes that.
  try {
    const latestPath = join(CLAUDE_DIR, 'LIFEOS', 'ALGORITHM', 'LATEST');
    const content = readFileSync(latestPath, 'utf-8').trim();
    if (/^\d+\.\d+\.\d+$/.test(content)) {
      _latestAlgVersionCache = content;
      return _latestAlgVersionCache;
    }
  } catch { /* fall through to filesystem inference */ }
  // Fallback if LATEST is missing or malformed: highest version on disk.
  try {
    const algDir = join(CLAUDE_DIR, 'LIFEOS', 'ALGORITHM');
    const versions = readdirSync(algDir)
      .map(f => f.match(/^v(\d+\.\d+\.\d+)\.md$/)?.[1])
      .filter((v): v is string => !!v)
      .sort((a, b) => {
        const pa = a.split('.').map(Number);
        const pb = b.split('.').map(Number);
        for (let i = 0; i < 3; i++) {
          const d = (pa[i] || 0) - (pb[i] || 0);
          if (d !== 0) return d;
        }
        return 0;
      });
    _latestAlgVersionCache = versions[versions.length - 1] || '';
  } catch {
    _latestAlgVersionCache = '';
  }
  return _latestAlgVersionCache;
}

// Substring exclusions — if any path segment matches these, skip. Handles
// Fabric pattern prompts that contain example path literals (not real refs)
// and historical migration docs that intentionally reference old paths.
const EXCLUDE_SUBSTRINGS = [
  '/Patterns/',              // Fabric LLM prompt files
  '/MigrationNotes.md',      // historical migration docs
  '/Templates/',             // public-release templates w/ placeholders
  '/test/regression/fixtures/', // replay-corpus fixture DATA — synthetic path literals, not refs
];

// Per-file historical marker. A generated record (an Errata triage report, say)
// quotes paths as they stood the day it was written, so a later rename is not rot
// in it. Such a file opts out by declaring `references: historical` in its own
// leading YAML frontmatter. The marker is per file and never per directory: an
// unmarked file sitting beside marked ones is still scanned, so a hand-written
// note dropped into a generated folder cannot hide a dead path. Every skipped
// file is listed in the JSON output (`historicalSkipped`), so a skip is never silent.
const HISTORICAL_MARKER_RE = /^references:\s*(["']?)historical\1\s*(?:#.*)?$/;

/** True only when the file opens with a frontmatter block that declares `references: historical`. */
function declaresHistoricalReferences(content: string): boolean {
  const body = content.startsWith('﻿') ? content.slice(1) : content;
  if (!/^---\r?\n/.test(body)) return false;
  const lines = body.split(/\r?\n/);
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === '---' || line === '...') return false;   // frontmatter closed without the marker
    if (HISTORICAL_MARKER_RE.test(line)) {
      // Only a top-level key counts, and only inside a block that actually closes.
      for (let j = i + 1; j < lines.length; j++) if (lines[j] === '---' || lines[j] === '...') return true;
      return false;
    }
  }
  return false;   // never closed: not frontmatter
}

const EXCLUDE_FILE_SUFFIXES = [
  '.backup', '.old', '.retired', '.bak', '.orig',
  '.log', '.jsonl', '.lock',
];

const EXCLUDE_FILE_NAMES = new Set([
  'package-lock.json', 'bun.lockb', 'bun.lock', 'yarn.lock', 'pnpm-lock.yaml',
]);

function isExcludedDir(absPath: string): boolean {
  const base = absPath.split(sep).pop() || '';
  if (EXCLUDE_DIR_NAMES.has(base)) return true;
  const rel = relative(CLAUDE_DIR, absPath);
  if (rel.startsWith('..')) return true;
  for (const pref of EXCLUDE_PATH_PREFIXES) {
    if (rel === pref || rel.startsWith(pref + sep)) return true;
  }
  // Private (underscore-prefixed) skills are deleted from the staging tree
  // before release — their internal references are not a public-release
  // concern. ShadowRelease.ts's G1 + skill-deletion sweep guarantees they
  // never ship, so a broken ref inside _SOMESKILL/Tools/foo.ts does not
  // affect the bundle that reaches the public LifeOS repo. Skipping
  // them here keeps a half-built private skill from gating release.
  if (rel.startsWith(`skills${sep}_`)) return true;
  return false;
}

function isScannableFile(absPath: string): boolean {
  const base = absPath.split(sep).pop() || '';
  if (EXCLUDE_FILE_NAMES.has(base)) return false;
  for (const suf of EXCLUDE_FILE_SUFFIXES) {
    if (base.endsWith(suf)) return false;
  }
  if (base.includes('.backup-')) return false;
  for (const sub of EXCLUDE_SUBSTRINGS) {
    if (absPath.includes(sub)) return false;
  }
  const rel = relative(CLAUDE_DIR, absPath);
  if (isArchivedAlgorithmVersion(rel)) return false;
  const ext = extname(absPath);
  return ext === '.md' || ext === '.ts' || ext === '.tsx' || ext === '.json';
}

// A skill directory that is a symlink to somewhere outside ~/.claude is vendor-owned
// (Interceptor installs its four skills as root-owned symlinks into
// /Library/Application Support). Their relative links point into the vendor's own
// repo layout — the same class as plugin caches, and not ours to fix.
// public PR #2124, @pai-scaffolde
const CLAUDE_DIR_REAL = (() => { try { return realpathSync(CLAUDE_DIR); } catch { return CLAUDE_DIR; } })();
function isForeignSkillLink(absPath: string): boolean {
  const rel = relative(CLAUDE_DIR, absPath);
  if (!rel.startsWith(`skills${sep}`)) return false;
  try {
    if (!lstatSync(absPath).isSymbolicLink()) return false;
    const real = realpathSync(absPath);
    return real !== CLAUDE_DIR_REAL && !real.startsWith(CLAUDE_DIR_REAL + sep);
  } catch { return false; }
}

// ── File walker (iterative, visited-set by realpath to avoid symlink cycles) ──

// Input the scan could not read. A file or directory that cannot be read has
// not been checked, so the run cannot report that every reference is valid;
// any entry here makes the whole check exit 2 instead of 0. A
// dangling symlink or a path that vanished between listing and reading is not
// unreadable input, it is absence, and stays silent.
const scanErrors: string[] = [];
const isAbsent = (e: any): boolean => e?.code === 'ENOENT' || e?.code === 'ENOTDIR' || e?.code === 'ELOOP';
function scanFailed(what: string, path: string, e: any): void {
  scanErrors.push(`${what} ${relative(CLAUDE_DIR, path) || path}: ${e?.code || e?.message || e}`);
}

// An excluded tree stays excluded when reached through a symlink under another name.
const EXCLUDED_REAL_DIRS = new Set(EXCLUDE_PATH_PREFIXES.flatMap((p) => { try { return [realpathSync(join(CLAUDE_DIR, p))]; } catch { return []; } }));

function walk(root: string): string[] {
  const out: string[] = [];
  const stack: string[] = [root];
  const visited = new Set<string>();

  while (stack.length > 0) {
    const dir = stack.pop()!;
    let real: string;
    try {
      real = realpathSync(dir);
    } catch (e) {
      if (!isAbsent(e)) scanFailed('cannot resolve directory', dir, e);
      continue;
    }
    if (visited.has(real)) continue;
    visited.add(real);
    if (isExcludedDir(dir) || EXCLUDED_REAL_DIRS.has(real)) continue;

    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch (e) {
      scanFailed('cannot list directory', dir, e);
      continue;
    }

    for (const entry of entries) {
      if (entry.startsWith('.') && entry !== '.claude') {
        // allow .claude top-level but skip hidden files/dirs like .git, .DS_Store
        if (entry === '.git' || entry === '.DS_Store' || entry === '.cache' ||
            entry === '.next' || entry === '.turbo' || entry === '.venv') continue;
      }
      const full = join(dir, entry);
      let st: ReturnType<typeof statSync>;
      try {
        st = statSync(full);
      } catch (e) {
        if (!isAbsent(e)) scanFailed('cannot stat', full, e);
        continue;
      }
      if (st.isDirectory()) {
        if (isForeignSkillLink(full)) continue;
        if (!isExcludedDir(full)) stack.push(full);
      } else if (st.isFile()) {
        if (isScannableFile(full)) out.push(full);
      }
    }
  }
  return out;
}

// ── Reference extraction ──

// Match path-like tokens. We capture the raw ref (group 1) and later resolve.
// These patterns are tuned to minimize false positives on code literals.
// Multi-dot extension suffix: matches `.md`, `.hook.ts`, `.min.js`, etc.
// Engineered to land on the LAST `.\w+` boundary so `foo.hook.ts` captures whole name.
const EXT = '\\.\\w+(?:\\.\\w+)*';

// `fenceSafe` opts a pattern out of the blanket fenced-block skip below. Prose
// fences are usually examples, so the default (skip) is right — but a runnable
// command block is the one place where a fenced path IS a live reference: it's
// what a reader will actually paste into a shell. public issue #1679, @christauff
// `shipped` patterns run only under --shipped-paths (the staged G7 lane) and, unlike
// the rest, also run on .ts/.tsx files (`code: true`). They are anchored to the
// install dirs a shipped file may legitimately spawn or import, so a code-literal
// example string that happens to look like a path is not picked up unless it
// names one of those dirs. public issue #1955, @pybe
const SHIPPED_ANCHOR = '(?:LIFEOS\\/(?:TOOLS|PULSE)|hooks|commands|workflows)';
const REF_PATTERNS: { re: RegExp; label: string; fenceSafe?: true; shipped?: true; code?: true }[] = [
  // Backtick-quoted paths with top-level anchor
  { re: new RegExp('`((?:LifeOS|hooks|skills|agents|Pulse|USER|MEMORY|Components|Algorithm|Tools|Workflows|Intents|References)\\/[\\w/@.-]+?' + EXT + ')`', 'g'), label: 'backtick-anchored' },
  // Backtick-quoted paths starting with ~/.claude/
  { re: new RegExp('`~\\/\\.claude\\/([\\w/@.-]+?' + EXT + ')`', 'g'), label: 'backtick-home' },
  // Backtick-quoted paths with $HOME/.claude/ or ${HOME}/.claude/
  { re: new RegExp('`\\$(?:HOME|\\{HOME\\})\\/\\.claude\\/([\\w/@.-]+?' + EXT + ')`', 'g'), label: 'backtick-env-home' },
  // @-import at start of line: @LIFEOS/USER/FILE.md
  { re: /^@(LifeOS\/[\w/@.-]+\.md)/gm, label: 'at-import' },
  // Markdown link target: [text](./path) or [text](path.md)
  { re: /\[[^\]]+\]\((\.?\.?\/?[\w/@.-]+?\.(?:md|ts|tsx|json|yaml|yml))\)/g, label: 'md-link' },
  // Arrow notation: → file: `path`
  { re: new RegExp('→\\s+[\\w\\s]+:\\s+`([\\w/@.-]+?' + EXT + ')`', 'g'), label: 'arrow' },
  // Table cell paths in pipes (kept narrow: must include a top-level anchor)
  { re: new RegExp('\\|\\s*`?((?:LifeOS|hooks|skills|agents|Pulse|USER|Components|Algorithm|Tools)\\/[\\w/@.-]+?' + EXT + ')`?\\s*\\|', 'g'), label: 'table-cell' },
  // TS/TSX relative imports with explicit relative prefix
  { re: /from\s+["'](\.\.?\/[\w/@.-]+?)["']/g, label: 'ts-import' },
  // settings.json style: "command": "... $HOME/.claude/hooks/Foo.hook.ts ..." (illustrative path; not shipped)
  { re: new RegExp('\\$\\{?HOME\\}?\\/\\.claude\\/((?:hooks|LifeOS|skills|agents)\\/[\\w/@.-]+?' + EXT + ')', 'g'), label: 'json-home' },
  // Bare command invocations: `bun ~/.claude/LIFEOS/TOOLS/Foo.ts --flag` (illustrative path; not shipped).
  // Every other tilde pattern above is backtick-anchored (backtick-home needs the
  // backtick immediately before `~`), and json-home only matches the $HOME form —
  // so an inline or fenced command naming a tool path matched nothing at all, and
  // a renamed tool could rot in every runbook without the checker noticing.
  // public issue #1679, @christauff
  {
    re: new RegExp('\\b(?:bun|bunx|node|tsx)\\s+(?:run\\s+)?(?:~|\\$\\{?HOME\\}?)\\/\\.claude\\/([\\w/@.-]+?' + EXT + ')', 'g'),
    label: 'fenced-command',
    fenceSafe: true,
  },
  // Quoted, backticked, template-joined (`${X}/hooks/Foo.ts`) or ~/.claude-prefixed
  // install path, in prose or code.
  {
    re: new RegExp('(?:["\'`]|\\}\\/|\\.claude\\/)(' + SHIPPED_ANCHOR + '\\/[\\w/@.-]+?' + EXT + ')(?=["\'`\\s)\\]]|$)', 'gm'),
    label: 'shipped-path',
    shipped: true,
    code: true,
  },
  // join(CLAUDE_DIR, "LIFEOS", "TOOLS", "Foo.ts") — the dominant spawn style in this
  // tree. Anchored to a same-line join()/resolve() whose first quoted segment is
  // the install dir (an optional ".claude" segment before it is tolerated), so a
  // plain string array that happens to start with "hooks" is not a path. Group 1
  // is the segment list; extractRefs joins it into a path.
  {
    re: /(?:join|resolve)\([^"'\n]*?(?:["']\.claude["']\s*,\s*)?(["'](?:LIFEOS|hooks|commands|workflows)["'](?:\s*,\s*["'][\w@.-]+["'])+)/g,
    label: 'join-segments',
    shipped: true,
    code: true,
  },
  // Dynamic import("./x") / import("../y.ts") — a static `from` import is already
  // covered by ts-import; the dynamic form was invisible (ISAGate's Bunker parser).
  {
    re: /import\(\s*["'](\.\.?\/[\w/@.-]+?)["']\s*\)/g,
    label: 'dynamic-import',
    shipped: true,
    code: true,
  },
];

// Illustrative stand-in names used by the authoring guides. Deliberately
// narrow: `SkillName`/`ToolName` are the exact tokens the skill-authoring
// template uses, and `my-*` is the hook guide's convention for "your hook
// goes here". public issue #1679, @christauff
const PLACEHOLDER_NAME_RE = /(?:^|\/)(?:SkillName|ToolName|my-[\w-]+)(?:\/|\.\w)/;

interface RefHit {
  raw: string;
  label: string;
  line: number;
  referringFile: string;
  resolved: string;
  exists: boolean;
}

// Parse `## ... (paths under `X`)` headings out of a markdown file and
// build a sorted list of `[startCharPos, sectionRoot]` pairs. The default root
// applies before any heading is seen. Mirrors the section-awareness logic in
// LIFEOS/TOOLS/ArchitectureSummaryGenerator.ts so both tools agree on what a
// relative path under a routing section means.
function extractSectionRoots(content: string): Array<{ pos: number; root: string }> {
  const out: Array<{ pos: number; root: string }> = [{ pos: 0, root: '' }];
  const headingPathHint = /paths under\s+`?([A-Za-z_/.0-9-]+?)`?(?:\s|\)|$)/;
  const lines = content.split('\n');
  let pos = 0;
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      const hint = h2[1].match(headingPathHint);
      if (hint) {
        let root = hint[1];
        if (!root.endsWith('/')) root += '/';
        out.push({ pos, root });
      } else {
        out.push({ pos, root: '' });
      }
    }
    pos += line.length + 1;
  }
  return out;
}

function getSectionRootAt(roots: Array<{ pos: number; root: string }>, charPos: number): string {
  let active = '';
  for (const r of roots) {
    if (r.pos <= charPos) active = r.root;
    else break;
  }
  return active;
}

// Build a bitmap of character positions that live inside a ```fenced``` block.
// Refs inside code fences are usually illustrative (examples of good/bad layout,
// sample code output), not real references to files.
function fenceMap(content: string): Uint8Array {
  const inFence = new Uint8Array(content.length);
  const lines = content.split('\n');
  let inside = false;
  let pos = 0;
  for (const line of lines) {
    const trimmed = line.trimStart();
    if (trimmed.startsWith('```')) {
      inside = !inside;
      // The fence line itself is safe to include (no refs on the fence line usually)
    } else if (inside) {
      for (let i = 0; i < line.length; i++) inFence[pos + i] = 1;
    }
    pos += line.length + 1; // +1 for \n
  }
  return inFence;
}

const ABSENCE_RE = /no longer exists|\bis gone\b|\|\|\s*echo gone|\b(?:retired|deleted|removed)\b/gi;
/** A negator in the few words before an absence word turns it into a requirement or denial ("must never be removed", "was not deleted"). */
const NEGATED_BEFORE = /(?:\b(?:not|never|cannot|nor|without)\b|n['’]t\b)(?:\W+\w+){0,4}\W*$/i;

/** True when the clause affirms a file is gone. "must never be removed" names a file that must exist, so it is no absence. */
function statesAbsence(clause: string): boolean {
  for (const m of clause.matchAll(ABSENCE_RE)) {
    if (!NEGATED_BEFORE.test(clause.slice(0, m.index))) return true;
  }
  return false;
}

/** Clause breaks inside one line: `;`, `&&`, a comma, a spaced dash, a joining word, or a lone table bar (`||` stays inside its clause, so `test -f x || echo gone` is one). */
const CLAUSE_SEP = /;|&&|,|\s[—–]\s|\b(?:and|but|while|whereas|then)\b|(?<!\|)\|(?!\|)/gi;
/** A clause holding nothing but paths and filler (`` `b.ts` `` in "removed `a.ts`, `b.ts` and `c.ts`"): one more item of the list a neighbouring clause is about. */
const bareClause = (clause: string): boolean => !/\p{L}/u.test(clause.replace(/^\s*[-*]\s*(?:\[[ xX]\]\s*)?(?:[A-Z][A-Z0-9-]*\d+[a-z]?:)?/, ' ').replace(/`[^`]*`/g, ' ').replace(/\S*[/.]\S*/g, ' ').replace(/\b(?:the|a|an|or|also|both|either|old)\b/gi, ' '));

/**
 * True when the clause holding `pos` states an absence, or is a bare list item whose nearest non-bare neighbour does.
 * Scoped to the clause, never the line: "`A.ts` exists and `B.ts` does not" exempts `B.ts` only, so a
 * missing replacement on the same line is still reported.
 */
function clauseStatesAbsence(line: string, offset: number): boolean {
  const bounds = [0];
  for (const m of line.matchAll(CLAUSE_SEP)) bounds.push(m.index!, m.index! + m[0].length);
  bounds.push(line.length);
  const clauses: string[] = [];
  for (let i = 0; i < bounds.length; i += 2) clauses.push(line.slice(bounds[i], bounds[i + 1]));
  let at = clauses.length - 1;
  for (let i = 0; i < clauses.length; i++) if (offset < bounds[2 * i + 1]!) { at = i; break; }
  if (statesAbsence(clauses[at]!)) return true;
  if (!bareClause(clauses[at]!)) return false;
  for (const step of [-1, 1]) {
    for (let j = at + step; j >= 0 && j < clauses.length; j += step) {
      if (bareClause(clauses[j]!)) continue;
      if (statesAbsence(clauses[j]!)) return true;
      break;
    }
  }
  return false;
}

/** In an ISA: true for a position inside `## Decisions` or in a clause that states a file's absence or retirement. */
function isaAbsenceSpans(content: string): (pos: number) => boolean {
  const decisions: Array<[number, number]> = [];
  const re = /^## Decisions\b.*$/gm;
  let d: RegExpExecArray | null;
  while ((d = re.exec(content)) !== null) {
    const next = content.slice(d.index + d[0].length).search(/^## /m);
    decisions.push([d.index, next < 0 ? content.length : d.index + d[0].length + next]);
  }
  return (pos: number) => {
    if (decisions.some(([a, z]) => pos >= a && pos < z)) return true;
    const start = content.lastIndexOf('\n', pos) + 1;
    const end = content.indexOf('\n', pos);
    return clauseStatesAbsence(content.slice(start, end < 0 ? content.length : end), pos - start);
  };
}

function extractRefs(content: string, referringFile: string): RefHit[] {
  const refs: RefHit[] = [];
  const seen = new Set<string>();
  const refDir = dirname(referringFile);

  // Only skip fence content for .md files — .ts/.json don't have prose fences.
  const skipFences = referringFile.endsWith('.md');
  const fences = skipFences ? fenceMap(content) : null;
  // Section-aware path resolution: track `## ... (paths under \`X\`)` hints in markdown.
  const sectionRoots = skipFences ? extractSectionRoots(content) : null;

  // For .ts/.tsx files, only extract `from "..."` imports — skip backtick/table/arrow
  // patterns because .ts files frequently contain example string literals inside
  // regex patterns, test fixtures, and docstrings that are NOT real path references.
  const isTs = referringFile.endsWith('.ts') || referringFile.endsWith('.tsx');

  // Test files name paths as fixtures ("hooks/evil.hook.ts" asserting a BLOCK);
  // those are arguments, never references — same reasoning as G8's fixture rows.
  const isTestFile = /\.test\.tsx?$/.test(referringFile);

  // An ISA names files it retired: a falsifier that a file is gone, a criterion about its removal,
  // and the dated `## Decisions` history. Those lines describe absence, so they are never references
  // (2026-10-11: seven such lines in the ROUTER, FUNCTIONHOOKS and PENTEST ISAs blocked /ic and /ud).
  const isaAbsence = basename(referringFile) === 'ISA.md' ? isaAbsenceSpans(content) : null;

  for (const { re, label, fenceSafe, shipped, code } of REF_PATTERNS) {
    if (shipped && (!shippedPaths || isTestFile)) continue;
    if (isTs && label !== 'ts-import' && !code) continue;
    const regex = new RegExp(re.source, re.flags);
    let m: RegExpExecArray | null;
    while ((m = regex.exec(content)) !== null) {
      let raw = m[1];
      if (!raw) continue;
      if (isaAbsence && isaAbsence(m.index)) continue;
      if (isTs && label === 'ts-import') {
        // A relative-path import written in a docblock example or inside a template-literal test
        // fixture is source-as-data, not a module the file loads (2026-09-03:
        // Bunker codesweep parses Hono entry files and carries one as a fixture).
        const lead = content.slice(content.lastIndexOf('\n', m.index) + 1, m.index);
        const t = lead.trimStart();
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue;
        if (isTestFile && lead.includes('`')) continue;
        // An import whose line holds an unclosed quote before it sits inside a string literal
        // (fixture source written to disk by a test or a tool), not in the module itself.
        if (["'", "\"", "`"].some((q) => lead.split(q).length % 2 === 0)) continue;
      }
      if (shipped && isTs) {
        // A comment-leading line in code is prose (a docblock example, a regex
        // explanation), not a spawn or import — G8 exempts the same lines.
        const lead = content.slice(content.lastIndexOf('\n', m.index) + 1, m.index).trimStart();
        if (lead.startsWith('//') || lead.startsWith('*') || lead.startsWith('/*')) continue;
      }
      if (label === 'join-segments') {
        // "LIFEOS", "TOOLS", "Foo.ts", "--json" → LIFEOS/TOOLS/Foo.ts: the path ends
        // at the first segment carrying an extension (a dot-leading segment like
        // ".prd" is a hidden dir, not a file); a segment list with no such segment
        // is a directory, not a file reference.
        const segs = [...raw.matchAll(/["']([\w@.-]+)["']/g)].map(s => s[1]);
        const fileAt = segs.findIndex(s => /^[^.].*\.\w+$/.test(s));
        if (fileAt < 0) continue;
        raw = segs.slice(0, fileAt + 1).join('/');
      }

      // Noise filters
      if (raw.startsWith('http') || raw.startsWith('mailto:') || raw.startsWith('#')) continue;
      if (raw.startsWith('/tmp/') || raw.startsWith('/var/') || raw.startsWith('/etc/') || raw.startsWith('/bin/')) continue;
      // Skip common placeholder-ish patterns
      if (raw.includes('<') || raw.includes('>') || raw.includes('$SkillName')) continue;
      // Date/version placeholders in templates
      if (raw.includes('YYYY') || raw.includes('MM-DD') || raw.includes('vX.Y.Z') || raw.includes('{slug}')) continue;
      // Per-user template placeholder ("your-da" = the user's named DA in the
      // LifeOS install template; "CUSTOMIZATIONS/SKILLS/<skill-name>/" = optional
      // user-defined override file that may not exist by default)
      if (raw.includes('your-da')) continue;
      if (raw.includes('CUSTOMIZATIONS/SKILLS/')) continue;
      // Stand-in names in authoring docs. The angle-bracket forms above cover
      // `<name>`, but the how-to-write-a-hook and how-to-write-a-skill guides
      // use bare illustrative names in runnable-looking command blocks —
      // `bun ~/.claude/hooks/my-hook.ts`, `skills/SkillName/Tools/ToolName.ts`.
      // Nothing should exist at those paths; flagging them trains the reader to
      // ignore the checker. public issue #1679, @christauff
      if (PLACEHOLDER_NAME_RE.test(raw)) continue;
      // The pre-7.x `PAI/` tree is retired and deliberately absent. Migration
      // prose names its old paths so an installer can find and remove stale
      // aliases — those mentions are historical, never live references.
      if (raw.startsWith('PAI/')) continue;
      // Skip obvious non-path strings
      if (raw.length < 3 || raw.length > 200) continue;

      // Skip refs inside ``` code fences (usually examples, not live refs).
      // fenceSafe patterns opt out — a runnable command block is exactly where a
      // live path reference belongs. public issue #1679, @christauff
      if (!fenceSafe && fences && fences[m.index] === 1) continue;

      const key = `${referringFile}\u0000${raw}\u0000${m.index}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // Resolve
      let resolved: string | null = null;
      const candidates: string[] = [];
      if (raw.startsWith('/')) {
        candidates.push(raw);
      } else if (raw.startsWith('./') || raw.startsWith('../')) {
        candidates.push(resolve(refDir, raw));
        // A command in a markdown doc (an ISA Test Strategy row, a runbook) runs from the
        // install root, so `./LIFEOS/...` there is root-relative.
        if (skipFences && raw.startsWith('./')) candidates.push(resolve(CLAUDE_DIR, raw));
      } else {
        // Try CLAUDE_DIR-relative, LIFEOS_DIR-relative, referring-dir-relative.
        candidates.push(resolve(CLAUDE_DIR, raw));
        candidates.push(resolve(LIFEOS_DIR, raw));
        candidates.push(resolve(refDir, raw));
        // Skill-internal refs: when file lives in skills/X/Intents/ or skills/X/Tools/,
        // a ref like `Intents/Foo.md` resolves against the skill root, not the subdir.
        const skillM = refDir.match(/^(.*\/skills\/[^/]+)(\/(?:Intents|Tools|References))?/);
        if (skillM) candidates.push(resolve(skillM[1], raw));
        // Same-line skill anchor: a doc outside a skill that names the skill on the
        // line (`skills/HillClimb/SKILL.md` ... `Tools/Population.ts`) means that
        // skill's subdir. Only skill-internal shapes (Tools/, References/, Intents/,
        // Workflows/) and only skills the same line names by path; a ref absent
        // there is still missing.
        if (skipFences && /^(?:Tools|References|Intents|Workflows)\//.test(raw)) {
          const lineStart = content.lastIndexOf('\n', m.index) + 1;
          const lineEndAt = content.indexOf('\n', m.index);
          const line = content.slice(lineStart, lineEndAt < 0 ? content.length : lineEndAt);
          for (const sm of line.matchAll(/(?:^|[^\w/]|\.claude\/)skills\/([\w.-]+)\//g)) {
            candidates.push(resolve(CLAUDE_DIR, 'skills', sm[1], raw));
          }
        }
        // Section-aware: if the markdown referrer is under `## ... (paths under \`X\`)`,
        // also try resolving the relative ref against that section root. This is the
        // intentional convention used by CLAUDE.md routing entries.
        if (sectionRoots) {
          const sectionRoot = getSectionRootAt(sectionRoots, m.index);
          if (sectionRoot) candidates.push(resolve(CLAUDE_DIR, sectionRoot, raw));
        }
      }
      for (const cand of candidates) {
        if (present(cand)) { resolved = cand; break; }
        // TS imports often write `.js` but the source is `.ts` — Node/bun module
        // resolution substitutes. Try the TS siblings of any .js/.mjs/.cjs import.
        const jsExt = /\.(js|mjs|cjs)$/;
        if (jsExt.test(cand)) {
          const tsCand = cand.replace(jsExt, '.ts');
          if (present(tsCand)) { resolved = tsCand; break; }
          const tsxCand = cand.replace(jsExt, '.tsx');
          if (present(tsxCand)) { resolved = tsxCand; break; }
        }
        // Try appending common TS extensions — handles `./types.v2` → `./types.v2.ts`
        // and imports without any extension.
        let found: string | null = null;
        for (const ext of ['.ts', '.tsx', '.js', '.mjs']) {
          if (present(cand + ext)) { found = cand + ext; break; }
        }
        if (found) { resolved = found; break; }
        // index.ts fallback for directory-style imports
        if (!extname(cand)) {
          const idx = join(cand, 'index.ts');
          if (present(idx)) { resolved = idx; break; }
        }
      }
      if (!resolved) resolved = candidates[0] || raw;
      const exists = present(resolved);

      // Line number
      const lineNum = content.substring(0, m.index).split('\n').length;

      refs.push({
        raw,
        label,
        line: lineNum,
        referringFile,
        resolved,
        exists,
      });
    }
  }
  return refs;
}

// ── Git changed files ──

// Two git calls with no shell: the old `cmd; cmd` string hid a failure of the
// first behind the exit status of the second, and a failed discovery came back
// as an empty set, which --changed reads as "nothing changed, nothing to check".
// Either call failing throws, and the caller exits 2.
function getChangedFiles(): Set<string> {
  const names = (gitArgs: string[]): string[] =>
    execFileSync('git', gitArgs, { cwd: CLAUDE_DIR, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).split('\n').filter(Boolean);
  const changed = [...names(['diff', '--name-only', 'HEAD']), ...names(['diff', '--cached', '--name-only'])];
  return new Set(changed.map(f => resolve(CLAUDE_DIR, f)));
}

// ── Main ──

interface Finding {
  type: 'missing' | 'stale' | 'orphan';
  file: string;   // relative to CLAUDE_DIR
  line: number | null;
  ref: string | null;
  resolved: string;
  detail?: string;
  label?: string;
}

const startedAt = Date.now();
const findings: Finding[] = [];
const referenced = new Set<string>();  // absolute paths of files that are referenced
let scannedFiles = 0;
let scannedRefs = 0;
const historicalSkipped: string[] = [];
const citationResults: { file: string; line: number; cited: string; snippet: string; state: CitationState; foundAt?: number[] }[] = [];
let citationsWithoutSnippet = 0;   // files whose own frontmatter says `references: historical`

let allFiles: string[];
try {
  allFiles = walk(CLAUDE_DIR);
} catch (e: any) {
  console.error(`ReferenceCheck: scan error — ${e?.message || e}`);
  process.exit(2);
}

let changed: Set<string> | null = null;
if (changedOnly) {
  try {
    changed = getChangedFiles();
  } catch (e: any) {
    console.error(`ReferenceCheck: --changed could not discover changed files — ${String(e?.stderr || e?.message || e).trim()}`);
    process.exit(2);
  }
}

// First pass — extract refs from every scannable file
const fileRefs: Map<string, RefHit[]> = new Map();
for (const file of allFiles) {
  let content: string;
  try {
    content = readFileSync(file, 'utf-8');
  } catch (e) {
    if (!isAbsent(e)) scanFailed('cannot read file', file, e);
    continue;
  }
  scannedFiles++;
  if (declaresHistoricalReferences(content)) {
    historicalSkipped.push(relative(CLAUDE_DIR, file));
    continue;
  }
  if (contentMode && file.endsWith('.md')) {
    const found = findCitations(content);
    citationsWithoutSnippet += found.withoutSnippet;
    for (const c of found.citations) {
      try {
        citationResults.push({ file: relative(CLAUDE_DIR, file), line: c.line, cited: `${c.path}:${c.citedLine}`, snippet: c.snippet, ...checkCitation(CLAUDE_DIR, c.path, c.citedLine, c.snippet) });
      } catch (e) {
        scanFailed(`cannot check citation ${c.path}:${c.citedLine}`, file, e);
      }
    }
  }
  const refs = extractRefs(content, file);
  if (refs.length > 0) fileRefs.set(file, refs);
  for (const r of refs) {
    scannedRefs++;
    if (r.exists) referenced.add(r.resolved);
  }
}

// Filter for --changed: keep only refs from changed files OR refs whose target changed
const filesToReport = changed
  ? new Set(
      [...fileRefs.keys()].filter(f => {
        if (changed.has(f)) return true;
        const refs = fileRefs.get(f) || [];
        return refs.some(r => changed.has(r.resolved));
      })
    )
  : null;

// Runtime-generated targets — data-plane / state / observability files written
// at runtime, not static docs. A doc referencing one is not a broken ref even
// before the first write creates it (e.g. a documented JSONL stream that has
// not fired yet). Mirrors the LIFEOS/PULSE/state source exclusion, target-side.
// Widened 2026-09-14 to every `MEMORY/` path plus every `.jsonl` (public PR #2124,
// @pai-scaffolde), then narrowed back: a whole-subtree exemption also hid genuinely
// missing files. `MEMORY/KNOWLEDGE/_schema.md` that the generator never wrote, and a
// code import of a module under MEMORY, both vanished as "runtime". The exemption now
// names the generated DATA subtrees only — everything else under MEMORY is authored
// content whose absence is a real finding.
const RUNTIME_TARGET_SUBSTRINGS = [
  'MEMORY/PULSE_DATA/',
  'MEMORY/OBSERVABILITY/',
  'MEMORY/STATE/',
  'MEMORY/DATA/',
  '/state/',
];

/** Referrers whose references are imports, not descriptions — never stale-checked. */
const CODE_REFERRER = /\.(ts|tsx|js|jsx|mjs|cjs|json)$/;

/**
 * Is this missing target a runtime-generated data file, i.e. legitimately absent
 * until something writes it? Never true for a code referrer: an `import` that
 * resolves to nothing is a broken build, not a stream awaiting its first write,
 * and directory-level exemptions must not swallow it.
 */
const isRuntimeTarget = (relResolved: string, relReferrer: string): boolean => {
  if (CODE_REFERRER.test(relReferrer)) return false;
  return RUNTIME_TARGET_SUBSTRINGS.some(s => relResolved.includes(s)) || relResolved.endsWith('.jsonl');
};

/**
 * Targets that change as a matter of course: generated data and the principal's own
 * living files. A workflow pointing at TELOS.md is not rot because TELOS.md was edited —
 * that is the file doing its job. Staleness only means something for targets whose
 * change implies the describing doc fell behind.
 */
const LIVING_TARGET_SUBSTRINGS = ['MEMORY/DATA/', 'MEMORY/PULSE_DATA/', 'USER/TELOS/', 'USER/PRINCIPAL/', 'USER/PROJECTS.md', 'USER/CONFIG/', 'USER/WORK/'];

/**
 * How far a target may drift ahead of the doc describing it before that doc is
 * suspect. `--stale-days N` overrides.
 */
const STALE_DAYS = (() => {
  const i = args.indexOf('--stale-days');
  const n = i >= 0 ? Number(args[i + 1]) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 30;
})();

// Second pass — classify findings
for (const [file, refs] of fileRefs) {
  if (filesToReport && !filesToReport.has(file)) continue;
  let refMtimeCache: number | null = null;
  const relFile = relative(CLAUDE_DIR, file);

  for (const r of refs) {
    if (!r.exists) {
      // Skip runtime-generated targets — they're written at runtime, so a doc
      // referencing one is not a broken reference.
      const relResolved = relative(CLAUDE_DIR, r.resolved);
      if (isRuntimeTarget(relResolved, relFile)) continue;
      findings.push({
        type: 'missing',
        file: relFile,
        line: r.line,
        ref: r.raw,
        resolved: r.resolved,
        label: r.label,
      });
      continue;
    }
    // Staleness is a PROSE heuristic: "this description may no longer match what it
    // describes." It is meaningless for a code import — a module changing is the normal
    // life of a dependency, not rot in the file that imports it. Applying it to code
    // produced 201 of 418 findings, which is most of why nobody read the other 217.
    if (includeStale && !CODE_REFERRER.test(relFile)
        && !LIVING_TARGET_SUBSTRINGS.some(s => relative(CLAUDE_DIR, r.resolved).includes(s))) {
      try {
        if (refMtimeCache === null) refMtimeCache = statSync(file).mtimeMs;
        const targetMtime = statSync(r.resolved).mtimeMs;
        if (targetMtime > refMtimeCache) {
          const daysStale = Math.round((targetMtime - refMtimeCache) / (1000 * 60 * 60 * 24));
          if (daysStale >= STALE_DAYS) {
            findings.push({
              type: 'stale',
              file: relFile,
              line: r.line,
              ref: r.raw,
              resolved: r.resolved,
              detail: `ref modified ${daysStale}d after doc`,
              label: r.label,
            });
          }
        }
      } catch {
        // skip freshness if stat fails
      }
    }
  }
}

// Orphan detection — narrow to top-level LifeOS docs only.
// Agent files under agents/ are invoked by subagent_type name, not file path,
// so they are NOT orphans even when nothing references them in prose.
// Skill SKILL.md files are auto-discovered by Claude Code harness via frontmatter.
if (includeOrphans) {
  for (const file of allFiles) {
    const rel = relative(CLAUDE_DIR, file);
    // Case matters (public issue #1541, @tzioup): the dir is LIFEOS/, and the
    // old LifeOS/-cased regex never matched anything — orphan detection was
    // structurally dead. Scope (top-level LIFEOS/*.md only) is a known
    // limitation; widening it is a separate design decision.
    const isLifeosTopMd = /^LIFEOS\/[^/]+\.md$/.test(rel);
    if (!isLifeosTopMd) continue;
    if (!referenced.has(file)) {
      findings.push({
        type: 'orphan',
        file: rel,
        line: null,
        ref: null,
        resolved: file,
      });
    }
  }
}

// Dedup (file, line, ref)
const dedupKey = (f: Finding) => `${f.type}|${f.file}|${f.line}|${f.ref}`;
const uniq = new Map<string, Finding>();
for (const f of findings) if (!uniq.has(dedupKey(f))) uniq.set(dedupKey(f), f);
const uniqueFindings = [...uniq.values()];

const elapsedMs = Date.now() - startedAt;
const missing = uniqueFindings.filter(f => f.type === 'missing');
const stale = uniqueFindings.filter(f => f.type === 'stale');
const orphan = uniqueFindings.filter(f => f.type === 'orphan');
const movedCitations = citationResults.filter(c => c.state === 'moved');
const rottenCitations = citationResults.filter(c => isRotten(c.state));
const content = contentMode ? {
  citations: citationResults.length,
  ok: citationResults.filter(c => c.state === 'ok').length,
  moved: movedCitations,
  rotten: rottenCitations,
  withoutSnippet: citationsWithoutSnippet,
} : null;

const summary = {
  scannedFiles,
  scannedRefs,
  elapsedMs,
  historicalSkipped: [...historicalSkipped].sort(),
  scanErrors: [...scanErrors],
  findings: uniqueFindings,
  summary: {
    missing: missing.length,
    stale: stale.length,
    orphan: orphan.length,
  },
  ...(content ? { content } : {}),
};

if (jsonOutput) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  if (missing.length > 0) {
    console.error(`\n❌ MISSING REFERENCES (${missing.length}):`);
    for (const f of missing) {
      console.error(`  ${f.file}:${f.line} → ${f.ref}`);
    }
  }
  if (stale.length > 0) {
    console.error(`\n⚠️  STALE (${stale.length}):`);
    for (const f of stale) {
      console.error(`  ${f.file}:${f.line} → ${f.ref}  (${f.detail})`);
    }
  }
  if (orphan.length > 0) {
    console.error(`\n📦 ORPHANS (${orphan.length}):`);
    for (const f of orphan) {
      console.error(`  ${f.file}`);
    }
  }
  if (!quiet || uniqueFindings.length > 0) {
    console.error(
      `\nReferenceCheck: ${scannedFiles} files, ${scannedRefs} refs, ${missing.length} missing, ${stale.length} stale, ${orphan.length} orphan, ${historicalSkipped.length} historical (skipped by their own frontmatter) — ${elapsedMs}ms`
    );
  }
  if (content && movedCitations.length > 0) {
    console.error(`\n📍 MOVED CITATIONS (${movedCitations.length}) — the claim holds, the line number is old:`);
    for (const c of movedCitations) console.error(`  ${c.file}:${c.line} → ${c.cited} now at line ${c.foundAt![0]}`);
  }
  if (content && rottenCitations.length > 0) {
    console.error(`\n❌ ROTTEN CITATIONS (${rottenCitations.length}) — re-read the cited code:`);
    for (const c of rottenCitations) console.error(`  ${c.file}:${c.line} → ${c.cited} (${c.state}${c.foundAt ? ` at lines ${c.foundAt.join(', ')}` : ''})`);
  }
  if (content && (!quiet || movedCitations.length + rottenCitations.length > 0)) {
    console.error(`Citations: ${content.citations} checked, ${content.ok} ok, ${movedCitations.length} moved, ${rottenCitations.length} rotten; ${content.withoutSnippet} path:line without a snippet (not checked)`);
  }
  if (uniqueFindings.length === 0 && rottenCitations.length === 0 && !quiet) {
    console.error('✅ All references valid.');
  }
}

if (scanErrors.length > 0) {
  // A clean-looking report over input that was not read is the failure this exit code exists for.
  console.error(`\n❌ SCAN ERRORS (${scanErrors.length}) — the check could not read everything it was meant to, so its result is not trustworthy:`);
  for (const e of scanErrors.slice(0, 20)) console.error(`  ${e}`);
  if (scanErrors.length > 20) console.error(`  … and ${scanErrors.length - 20} more`);
  process.exit(2);
}
process.exit(missing.length > 0 || rottenCitations.length > 0 ? 1 : 0);
