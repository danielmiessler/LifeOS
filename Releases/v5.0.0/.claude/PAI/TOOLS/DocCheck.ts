#!/usr/bin/env bun
/**
 * DocCheck.ts — Documentation integrity verifier
 *
 * Extracts path references from markdown docs, verifies they exist on disk,
 * and checks freshness (is the referenced file newer than the doc?).
 *
 * Replaces: DocumentationUpdate mapping table, DocCrossRefIntegrity (31KB + LLM),
 * IntegrityCheck + SystemIntegrity handlers.
 *
 * Usage:
 *   bun DocCheck.ts              # full scan of all PAI docs
 *   bun DocCheck.ts --changed    # incremental — only git-dirty files and their dependents
 *   bun DocCheck.ts --json       # machine-readable output
 *   bun DocCheck.ts --quiet      # only report issues, no OK lines
 */

import { readFileSync, statSync, existsSync, readdirSync } from 'fs';
import { join, resolve, dirname, relative } from 'path';
import { execSync } from 'child_process';

import { getPaiDir, getClaudeDir } from '../lib/paths';

const CLAUDE_DIR = getClaudeDir();
const PAI_DIR = getPaiDir();
const HOOKS_DIR = join(CLAUDE_DIR, 'hooks');

const args = process.argv.slice(2);
const changedOnly = args.includes('--changed');
const jsonOutput = args.includes('--json');
const quiet = args.includes('--quiet');

// ── Path Reference Extraction ──

const PATH_PATTERNS = [
  // Backtick-quoted paths: `PAI/DOCUMENTATION/Hooks/HookSystem.md`, `hooks/SecurityPipeline.hook.ts`
  /`((?:PAI|hooks|skills|agents|Pulse|USER|MEMORY|Components|Algorithm|Tools)\/[\w/.@-]+\.\w+)`/g,
  // Backtick-quoted paths with ~/.claude/ prefix
  /`~\/\.claude\/([\w/.@-]+\.\w+)`/g,
  // Backtick-quoted paths with $HOME/.claude/ prefix
  /`\$HOME\/\.claude\/([\w/.@-]+\.\w+)`/g,
  // @-imports: @PAI/USER/FILE.md
  /^@(PAI\/[\w/.@-]+\.md)/gm,
  // Table cell paths: | `path` | or | path |
  /\|\s*`?((?:PAI|hooks|skills|Pulse|USER)\/[\w/.@-]+\.\w+)`?\s*\|/g,
  // Arrow notation in TOPOLOGY.md: → file: `path`
  /→\s+[\w\s]+:\s+`([\w/.@-]+\.\w+)`/g,
];

interface PathRef {
  raw: string;       // matched text
  resolved: string;  // absolute path
  line: number;
}

// Parse `## ... (paths under `X`)` headings and build a sorted list of
// `[startCharPos, sectionRoot]` pairs. The default root applies before any
// heading is seen. Mirrors the section-awareness logic in
// PAI/TOOLS/ArchitectureSummaryGenerator.ts and PAI/TOOLS/ReferenceCheck.ts
// so all three tools agree on what a relative path under a routing section
// means.
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

function extractPathRefs(content: string, docPath: string): PathRef[] {
  const refs: PathRef[] = [];
  const seen = new Set<string>();
  const sectionRoots = extractSectionRoots(content);
  const refDir = dirname(docPath);

  for (const pattern of PATH_PATTERNS) {
    // Reset regex state
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      const raw = match[1];
      if (!raw || seen.has(raw)) continue;
      seen.add(raw);

      // Skip vX.Y.Z placeholder strings
      if (raw.includes('vX.Y.Z')) continue;

      // Resolve path — try ~/.claude/ first, then ~/.claude/PAI/, then
      // section-aware root from `## ... (paths under `X`)` heading hint, then
      // referrer-dir relative.
      let resolved = resolve(CLAUDE_DIR, raw);
      if (!existsSync(resolved)) {
        const paiResolved = resolve(PAI_DIR, raw);
        if (existsSync(paiResolved)) {
          resolved = paiResolved;
        } else {
          const sectionRoot = getSectionRootAt(sectionRoots, match.index);
          if (sectionRoot) {
            const sectionResolved = resolve(CLAUDE_DIR, sectionRoot, raw);
            if (existsSync(sectionResolved)) resolved = sectionResolved;
          }
          if (!existsSync(resolved)) {
            const refDirResolved = resolve(refDir, raw);
            if (existsSync(refDirResolved)) resolved = refDirResolved;
          }
        }
      }

      // Find line number
      const pos = match.index;
      const lineNum = content.substring(0, pos).split('\n').length;

      refs.push({ raw, resolved, line: lineNum });
    }
  }

  return refs;
}

// ── File Discovery ──

function findDocs(): string[] {
  const docs: string[] = [];

  // PAI system docs (PAI_SYSTEM_PROMPT.md still lives at PAI root)
  try {
    for (const f of readdirSync(PAI_DIR)) {
      if (f.endsWith('.md')) docs.push(join(PAI_DIR, f));
    }
  } catch { /* */ }

  // PAI documentation subsystem docs (relocated from PAI root in v5)
  const docsDir = join(PAI_DIR, 'DOCUMENTATION');
  try {
    for (const f of readdirSync(docsDir)) {
      if (f.endsWith('.md')) docs.push(join(docsDir, f));
    }
  } catch { /* */ }

  // Security docs
  const secDir = join(PAI_DIR, 'USER', 'PAISECURITYSYSTEM');
  try {
    for (const f of readdirSync(secDir)) {
      if (f.endsWith('.md') || f.endsWith('.yaml')) docs.push(join(secDir, f));
    }
  } catch { /* */ }

  // hooks README
  const hooksReadme = join(HOOKS_DIR, 'README.md');
  if (existsSync(hooksReadme)) docs.push(hooksReadme);

  // CLAUDE.md
  const claudeMd = join(CLAUDE_DIR, 'CLAUDE.md');
  if (existsSync(claudeMd)) docs.push(claudeMd);

  return docs;
}

function getChangedFiles(): Set<string> {
  try {
    const diff = execSync('git diff --name-only HEAD 2>/dev/null; git diff --cached --name-only 2>/dev/null', {
      cwd: CLAUDE_DIR, encoding: 'utf-8',
    });
    return new Set(diff.split('\n').filter(Boolean).map(f => resolve(CLAUDE_DIR, f)));
  } catch {
    return new Set();
  }
}

// ── Main ──

interface Finding {
  doc: string;
  ref: string;
  line: number;
  type: 'missing' | 'stale';
  detail?: string;
}

const findings: Finding[] = [];
let docsChecked = 0;
let refsChecked = 0;

const changedFiles = changedOnly ? getChangedFiles() : null;
const allDocs = findDocs();

// If --changed, filter to docs that changed OR docs whose dependencies changed
const docsToCheck = changedFiles
  ? allDocs.filter(doc => {
      if (changedFiles.has(doc)) return true;
      // Also check docs whose referenced files changed
      try {
        const content = readFileSync(doc, 'utf-8');
        const refs = extractPathRefs(content, doc);
        return refs.some(r => changedFiles.has(r.resolved));
      } catch { return false; }
    })
  : allDocs;

for (const docPath of docsToCheck) {
  docsChecked++;
  let content: string;
  try {
    content = readFileSync(docPath, 'utf-8');
  } catch { continue; }

  const refs = extractPathRefs(content, docPath);
  let docMtime: number;
  try {
    docMtime = statSync(docPath).mtimeMs;
  } catch { continue; }

  for (const ref of refs) {
    refsChecked++;

    // Check existence
    if (!existsSync(ref.resolved)) {
      findings.push({
        doc: relative(CLAUDE_DIR, docPath),
        ref: ref.raw,
        line: ref.line,
        type: 'missing',
      });
      continue;
    }

    // Check freshness — is the referenced file newer than the doc?
    try {
      const refMtime = statSync(ref.resolved).mtimeMs;
      if (refMtime > docMtime) {
        const daysStale = Math.round((refMtime - docMtime) / (1000 * 60 * 60 * 24));
        findings.push({
          doc: relative(CLAUDE_DIR, docPath),
          ref: ref.raw,
          line: ref.line,
          type: 'stale',
          detail: `ref modified ${daysStale}d after doc`,
        });
      }
    } catch { /* stat failed, skip freshness check */ }
  }
}

// ── Output ──

if (jsonOutput) {
  console.log(JSON.stringify({ docsChecked, refsChecked, findings }, null, 2));
} else {
  const missing = findings.filter(f => f.type === 'missing');
  const stale = findings.filter(f => f.type === 'stale');

  if (missing.length > 0) {
    console.error(`\n❌ MISSING REFERENCES (${missing.length}):`);
    for (const f of missing) {
      console.error(`  ${f.doc}:${f.line} → ${f.ref}`);
    }
  }

  if (stale.length > 0) {
    console.error(`\n⚠️  STALE DOCS (${stale.length}):`);
    for (const f of stale) {
      console.error(`  ${f.doc}:${f.line} → ${f.ref} (${f.detail})`);
    }
  }

  if (!quiet || findings.length > 0) {
    console.error(`\nDocCheck: ${docsChecked} docs, ${refsChecked} refs, ${missing.length} missing, ${stale.length} stale`);
  }

  if (findings.length === 0 && !quiet) {
    console.error('✅ All references valid and fresh.');
  }
}

process.exit(findings.filter(f => f.type === 'missing').length > 0 ? 1 : 0);
