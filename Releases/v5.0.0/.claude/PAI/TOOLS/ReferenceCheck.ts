#!/usr/bin/env bun
/**
 * ReferenceCheck.ts — Full-surface reference validator for the PAI system.
 *
 * Walks every file under ~/.claude (excluding noise dirs), extracts every
 * reference from .md/.ts/.json files, validates each against the filesystem,
 * and emits three categories: missing, stale, orphan.
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
 *   bun ReferenceCheck.ts --orphans      # include orphan findings
 *   bun ReferenceCheck.ts --help         # usage
 *
 * Exit codes:
 *   0 — no missing refs (stale/orphan do not fail)
 *   1 — missing refs found
 *   2 — scan error (unreadable root, etc)
 */

import { readFileSync, statSync, existsSync, readdirSync, realpathSync } from 'fs';
import { join, resolve, dirname, relative, extname, sep } from 'path';
import { execSync } from 'child_process';
import { getClaudeDir, getPaiDir } from '../lib/paths';

const CLAUDE_DIR = getClaudeDir();
const PAI_DIR = getPaiDir();

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
  --orphans    Include orphan findings (file exists, nothing refs it)
  --help       This message

Exit codes: 0 clean, 1 missing refs, 2 scan error`);
  process.exit(0);
}

const jsonOutput = args.includes('--json');
const quiet = args.includes('--quiet');
const changedOnly = args.includes('--changed');
const includeStale = args.includes('--stale');
const includeOrphans = args.includes('--orphans');

// ── Exclusion rules ──

const EXCLUDE_DIR_NAMES = new Set([
  'node_modules', '.git', '.next', '.turbo', '.cache', 'dist', 'build',
  'logs',
]);

// Top-level path segments (relative to CLAUDE_DIR) that are entirely ignored.
const EXCLUDE_PATH_PREFIXES = [
  'PAI/MEMORY',
  'PAI/PULSE/Observability/.next',
  'PAI/PULSE/Observability/node_modules',
  'PAI/PULSE/state',        // runtime state — not docs
  'PAI/PAI_RELEASES',
  'PAI_RELEASES',
  'PAI/USER/ACTIONS',       // user's own actions with example paths
  'PAI/USER/ARBOL',         // private worker tree
  'PAI/USER/Daemon',        // private daemon work
  'PAI/USER/SKILLCUSTOMIZATIONS',
  'PAI/USER/SHARED',
  'PAI/ARBOL',              // ACTIONS/FLOWS/PIPELINES/ARBOLSYSTEM.md consolidated here
  'MEMORY',
  'Projects',
  'projects',
  'Plans',
  'plan',
  'plans',
  'plugins',        // third-party plugin cache — not PAI system
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
// historical Algorithm version snapshots — they reference doctrine and tool
// names that have since been renamed (PrdFormat.md, prd-utils.ts, etc.) and
// those refs are intentional historical record, not live references.
// The current Algorithm version is loaded explicitly from PAI/ALGORITHM/v{N}.md
// by the ALGORITHM phase; ReferenceCheck does not need to verify archives.
function isArchivedAlgorithmVersion(relPath: string): boolean {
  // Match PAI/ALGORITHM/v{major}.{minor}.{patch}.md but not the latest.
  // Strategy: detect the highest version in the dir and exclude all others.
  const m = relPath.match(/^PAI\/ALGORITHM\/v(\d+\.\d+\.\d+)\.md$/);
  if (!m) return false;
  return m[1] !== getLatestAlgorithmVersion();
}

let _latestAlgVersionCache: string | null = null;
function getLatestAlgorithmVersion(): string {
  if (_latestAlgVersionCache !== null) return _latestAlgVersionCache;
  try {
    const algDir = join(CLAUDE_DIR, 'PAI', 'ALGORITHM');
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
];

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
  // affect the bundle that hits github.com/danielmiessler/PAI. Skipping
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

// ── File walker (iterative, visited-set by realpath to avoid symlink cycles) ──

function walk(root: string): string[] {
  const out: string[] = [];
  const stack: string[] = [root];
  const visited = new Set<string>();

  while (stack.length > 0) {
    const dir = stack.pop()!;
    let real: string;
    try {
      real = realpathSync(dir);
    } catch {
      continue;
    }
    if (visited.has(real)) continue;
    visited.add(real);
    if (isExcludedDir(dir)) continue;

    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
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
      } catch {
        continue;
      }
      if (st.isDirectory()) {
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

const REF_PATTERNS: { re: RegExp; label: string }[] = [
  // Backtick-quoted paths with top-level anchor
  { re: new RegExp('`((?:PAI|hooks|skills|agents|Pulse|USER|MEMORY|Components|Algorithm|Tools|Workflows|References)\\/[\\w/@.-]+?' + EXT + ')`', 'g'), label: 'backtick-anchored' },
  // Backtick-quoted paths starting with ~/.claude/
  { re: new RegExp('`~\\/\\.claude\\/([\\w/@.-]+?' + EXT + ')`', 'g'), label: 'backtick-home' },
  // Backtick-quoted paths with $HOME/.claude/ or ${HOME}/.claude/
  { re: new RegExp('`\\$(?:HOME|\\{HOME\\})\\/\\.claude\\/([\\w/@.-]+?' + EXT + ')`', 'g'), label: 'backtick-env-home' },
  // @-import at start of line: @PAI/USER/FILE.md
  { re: /^@(PAI\/[\w/@.-]+\.md)/gm, label: 'at-import' },
  // Markdown link target: [text](./path) or [text](path.md)
  { re: /\[[^\]]+\]\((\.?\.?\/?[\w/@.-]+?\.(?:md|ts|tsx|json|yaml|yml))\)/g, label: 'md-link' },
  // Arrow notation: → file: `path`
  { re: new RegExp('→\\s+[\\w\\s]+:\\s+`([\\w/@.-]+?' + EXT + ')`', 'g'), label: 'arrow' },
  // Table cell paths in pipes (kept narrow: must include a top-level anchor)
  { re: new RegExp('\\|\\s*`?((?:PAI|hooks|skills|agents|Pulse|USER|Components|Algorithm|Tools)\\/[\\w/@.-]+?' + EXT + ')`?\\s*\\|', 'g'), label: 'table-cell' },
  // TS/TSX relative imports with explicit relative prefix
  { re: /from\s+["'](\.\.?\/[\w/@.-]+?)["']/g, label: 'ts-import' },
  // settings.json style: "command": "... $HOME/.claude/hooks/Foo.hook.ts ..."
  { re: new RegExp('\\$\\{?HOME\\}?\\/\\.claude\\/((?:hooks|PAI|skills|agents)\\/[\\w/@.-]+?' + EXT + ')', 'g'), label: 'json-home' },
];

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
// PAI/TOOLS/ArchitectureSummaryGenerator.ts so both tools agree on what a
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

  for (const { re, label } of REF_PATTERNS) {
    if (isTs && label !== 'ts-import') continue;
    const regex = new RegExp(re.source, re.flags);
    let m: RegExpExecArray | null;
    while ((m = regex.exec(content)) !== null) {
      const raw = m[1];
      if (!raw) continue;

      // Noise filters
      if (raw.startsWith('http') || raw.startsWith('mailto:') || raw.startsWith('#')) continue;
      if (raw.startsWith('/tmp/') || raw.startsWith('/var/') || raw.startsWith('/etc/') || raw.startsWith('/bin/')) continue;
      // Skip common placeholder-ish patterns
      if (raw.includes('<') || raw.includes('>') || raw.includes('$SkillName')) continue;
      // Date/version placeholders in templates
      if (raw.includes('YYYY') || raw.includes('MM-DD') || raw.includes('vX.Y.Z') || raw.includes('{slug}')) continue;
      // Per-user template placeholder ("your-da" = the user's named DA in the
      // PAI install template; "SKILLCUSTOMIZATIONS/<skill-name>/" = optional
      // user-defined override file that may not exist by default)
      if (raw.includes('your-da')) continue;
      if (raw.includes('SKILLCUSTOMIZATIONS/')) continue;
      // Skip obvious non-path strings
      if (raw.length < 3 || raw.length > 200) continue;

      // Skip refs inside ``` code fences (usually examples, not live refs)
      if (fences && fences[m.index] === 1) continue;

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
      } else {
        // Try CLAUDE_DIR-relative, PAI_DIR-relative, referring-dir-relative.
        candidates.push(resolve(CLAUDE_DIR, raw));
        candidates.push(resolve(PAI_DIR, raw));
        candidates.push(resolve(refDir, raw));
        // Skill-internal refs: when file lives in skills/X/Workflows/ or skills/X/Tools/,
        // a ref like `Workflows/Foo.md` resolves against the skill root, not the subdir.
        const skillM = refDir.match(/^(.*\/skills\/[^/]+)(\/(?:Workflows|Tools|References))?/);
        if (skillM) candidates.push(resolve(skillM[1], raw));
        // Section-aware: if the markdown referrer is under `## ... (paths under \`X\`)`,
        // also try resolving the relative ref against that section root. This is the
        // intentional convention used by CLAUDE.md routing entries.
        if (sectionRoots) {
          const sectionRoot = getSectionRootAt(sectionRoots, m.index);
          if (sectionRoot) candidates.push(resolve(CLAUDE_DIR, sectionRoot, raw));
        }
      }
      for (const cand of candidates) {
        if (existsSync(cand)) { resolved = cand; break; }
        // TS imports often write `.js` but the source is `.ts` — Node/bun module
        // resolution substitutes. Try the TS siblings of any .js/.mjs/.cjs import.
        const jsExt = /\.(js|mjs|cjs)$/;
        if (jsExt.test(cand)) {
          const tsCand = cand.replace(jsExt, '.ts');
          if (existsSync(tsCand)) { resolved = tsCand; break; }
          const tsxCand = cand.replace(jsExt, '.tsx');
          if (existsSync(tsxCand)) { resolved = tsxCand; break; }
        }
        // Try appending common TS extensions — handles `./types.v2` → `./types.v2.ts`
        // and imports without any extension.
        let found: string | null = null;
        for (const ext of ['.ts', '.tsx', '.js', '.mjs']) {
          if (existsSync(cand + ext)) { found = cand + ext; break; }
        }
        if (found) { resolved = found; break; }
        // index.ts fallback for directory-style imports
        if (!extname(cand)) {
          const idx = join(cand, 'index.ts');
          if (existsSync(idx)) { resolved = idx; break; }
        }
      }
      if (!resolved) resolved = candidates[0] || raw;
      const exists = existsSync(resolved);

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

function getChangedFiles(): Set<string> {
  try {
    const diff = execSync(
      'git diff --name-only HEAD 2>/dev/null; git diff --cached --name-only 2>/dev/null',
      { cwd: CLAUDE_DIR, encoding: 'utf-8' }
    );
    return new Set(diff.split('\n').filter(Boolean).map(f => resolve(CLAUDE_DIR, f)));
  } catch {
    return new Set();
  }
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

let allFiles: string[];
try {
  allFiles = walk(CLAUDE_DIR);
} catch (e: any) {
  console.error(`ReferenceCheck: scan error — ${e?.message || e}`);
  process.exit(2);
}

const changed = changedOnly ? getChangedFiles() : null;

// First pass — extract refs from every scannable file
const fileRefs: Map<string, RefHit[]> = new Map();
for (const file of allFiles) {
  let content: string;
  try {
    content = readFileSync(file, 'utf-8');
  } catch {
    continue;
  }
  scannedFiles++;
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

// Second pass — classify findings
for (const [file, refs] of fileRefs) {
  if (filesToReport && !filesToReport.has(file)) continue;
  let refMtimeCache: number | null = null;
  const relFile = relative(CLAUDE_DIR, file);

  for (const r of refs) {
    if (!r.exists) {
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
    if (includeStale) {
      try {
        if (refMtimeCache === null) refMtimeCache = statSync(file).mtimeMs;
        const targetMtime = statSync(r.resolved).mtimeMs;
        if (targetMtime > refMtimeCache) {
          const daysStale = Math.round((targetMtime - refMtimeCache) / (1000 * 60 * 60 * 24));
          if (daysStale >= 1) {
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

// Orphan detection — narrow to top-level PAI docs only.
// Agent files under agents/ are invoked by subagent_type name, not file path,
// so they are NOT orphans even when nothing references them in prose.
// Skill SKILL.md files are auto-discovered by Claude Code harness via frontmatter.
if (includeOrphans) {
  for (const file of allFiles) {
    const rel = relative(CLAUDE_DIR, file);
    const isPaiTopMd = /^PAI\/[^/]+\.md$/.test(rel);
    if (!isPaiTopMd) continue;
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

const summary = {
  scannedFiles,
  scannedRefs,
  elapsedMs,
  findings: uniqueFindings,
  summary: {
    missing: missing.length,
    stale: stale.length,
    orphan: orphan.length,
  },
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
      `\nReferenceCheck: ${scannedFiles} files, ${scannedRefs} refs, ${missing.length} missing, ${stale.length} stale, ${orphan.length} orphan — ${elapsedMs}ms`
    );
  }
  if (uniqueFindings.length === 0 && !quiet) {
    console.error('✅ All references valid.');
  }
}

process.exit(missing.length > 0 ? 1 : 0);
