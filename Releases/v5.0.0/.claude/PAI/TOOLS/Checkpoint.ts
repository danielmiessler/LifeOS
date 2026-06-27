#!/usr/bin/env bun
/**
 * Checkpoint.ts — inspection and PREVIEW-ONLY rollback CLI for ISC checkpoints
 *
 * Subcommands:
 *   list <slug>                — show committed ISCs and their last SHAs per repo
 *   show <slug> <isc-id>       — show commit(s) for a specific ISC across allowlist repos
 *   rollback <slug> <isc-id>   — PREVIEW: print the git reset --hard <sha> command per repo
 *
 * Rollback is preview-only by design (per feedback_no_worktree_isolation_without_consent).
 * {{PRINCIPAL_NAME}} runs the destructive op himself if he wants the rollback.
 */

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { parseCriteriaList } from '../../hooks/lib/isa-utils';
import { getHarnessHome, getPaiDir } from './lib/runtime-paths';

// Allowlist path: top of the selected harness home. We only READ it (never write),
// so the ContainmentGuard write restriction does not apply. Parser must match
// the hook's parser exactly: skip blanks and '#' lines, expand tilde / $HOME
// prefixes, treat the rest as absolute repo paths.
const ALLOWLIST_PATH = join(getHarnessHome(), 'checkpoint-repos.txt');
const WORK_DIR = join(getPaiDir(import.meta.dir), 'MEMORY', 'WORK');

function expandPath(p: string): string {
  let s = p.trim();
  if (!s) return s;
  if (s.startsWith('~/')) s = join(homedir(), s.slice(2));
  else if (s === '~') s = homedir();
  s = s.replace(/^\$HOME(\/|$)/, homedir() + '$1');
  return s;
}

function loadAllowlist(): string[] {
  if (!existsSync(ALLOWLIST_PATH)) return [];
  return readFileSync(ALLOWLIST_PATH, 'utf-8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('#'))
    .map(expandPath);
}

function gitRun(repo: string, args: string[]): string {
  return execFileSync('git', ['-C', repo, ...args], {
    encoding: 'utf-8',
    timeout: 5000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function findCommit(repo: string, slug: string, iscId: string): { sha: string; date: string; subject: string } | null {
  try {
    const grepPattern = `${iscId} (${slug}):`;
    const out = gitRun(repo, ['log', '--all', '-F', '--grep', grepPattern, '--pretty=format:%H\t%ci\t%s', '-n', '1']);
    const line = out.split('\n')[0]?.trim();
    if (!line) return null;
    const [sha, date, ...rest] = line.split('\t');
    return { sha, date, subject: rest.join('\t') };
  } catch {
    return null;
  }
}

function slugPaths(slug: string): { slugDir: string; isaPath: string; statePath: string } {
  const slugDir = join(WORK_DIR, slug);
  return {
    slugDir,
    isaPath: join(slugDir, 'ISA.md'),
    statePath: join(slugDir, '.checkpoint-state.json'),
  };
}

// ISA-derived ISC descriptions are best-effort: `list` needs them only as a
// human label and the spec explicitly requires `list` to keep working when the
// ISA is gone (the sidecar state remains authoritative for what was committed).
function loadIscDescriptions(isaPath: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!existsSync(isaPath)) return map;
  try {
    const content = readFileSync(isaPath, 'utf-8');
    for (const c of parseCriteriaList(content)) map.set(c.id, c.description);
  } catch {
    // Unreadable / unparseable ISA — descriptions just won't render.
  }
  return map;
}

function loadState(statePath: string): { committed_iscs: string[]; last_commit_sha: Record<string, string> } | null {
  if (!existsSync(statePath)) return null;
  try {
    const parsed = JSON.parse(readFileSync(statePath, 'utf-8'));
    return {
      committed_iscs: Array.isArray(parsed.committed_iscs) ? parsed.committed_iscs : [],
      last_commit_sha: parsed.last_commit_sha && typeof parsed.last_commit_sha === 'object' ? parsed.last_commit_sha : {},
    };
  } catch {
    return null;
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function cmdList(slug: string) {
  const { isaPath, statePath } = slugPaths(slug);
  if (!existsSync(statePath)) {
    console.log(`no checkpoints recorded for ${slug}`);
    return;
  }
  const state = loadState(statePath);
  if (!state) {
    console.error(`error: malformed state at ${statePath}`);
    process.exit(1);
  }
  if (state.committed_iscs.length === 0) {
    console.log(`no checkpoints recorded for ${slug}`);
    return;
  }
  const descriptions = loadIscDescriptions(isaPath);

  console.log(`Checkpoints for ${slug}`);
  console.log('─'.repeat(80));
  for (const id of state.committed_iscs) {
    const desc = descriptions.get(id) || '(description not in ISA.md)';
    console.log(`${id.padEnd(12)}  ${truncate(desc, 60)}`);
  }
  console.log('');
  console.log('Last committed SHA per repo:');
  const repos = Object.keys(state.last_commit_sha);
  if (repos.length === 0) {
    console.log('  (none)');
  } else {
    for (const repo of repos) console.log(`  ${repo}: ${state.last_commit_sha[repo]}`);
  }
}

function cmdShow(slug: string, iscId: string) {
  const allowlist = loadAllowlist();
  if (allowlist.length === 0) {
    console.error(`no allowlist at ${ALLOWLIST_PATH}`);
    process.exit(1);
  }
  // Spec output format: one line per matching repo, "<repo>: <sha> <date> <subject>".
  let any = false;
  for (const repo of allowlist) {
    if (!existsSync(repo)) continue;
    const hit = findCommit(repo, slug, iscId);
    if (!hit) continue;
    any = true;
    console.log(`${repo}: ${hit.sha} ${hit.date} ${hit.subject}`);
  }
  if (!any) console.log(`no commit found for ${iscId} in ${slug}`);
}

function cmdRollback(slug: string, iscId: string) {
  const allowlist = loadAllowlist();
  if (allowlist.length === 0) {
    console.error(`no allowlist at ${ALLOWLIST_PATH}`);
    process.exit(1);
  }
  // PREVIEW ONLY. Every git verb on the next lines is a printed STRING — there
  // is no execFile call to any destructive subcommand anywhere in this function.
  let any = false;
  for (const repo of allowlist) {
    if (!existsSync(repo)) continue;
    const hit = findCommit(repo, slug, iscId);
    if (!hit) continue;
    any = true;
    console.log(`REPO: ${repo}`);
    console.log(`TARGET: ${hit.sha} (${hit.subject})`);
    console.log('');
    console.log('To roll back to this checkpoint, run:');
    console.log(`  git -C ${repo} ${'reset'} --hard ${hit.sha}`);
    console.log('');
    console.log(`WARNING: this discards all commits and uncommitted changes after ${hit.sha}.`);
    console.log(`Review with: git -C ${repo} log --oneline ${hit.sha}..HEAD`);
    console.log('');
  }
  if (!any) {
    console.log(`no commit found for ${iscId} in ${slug}`);
    return;
  }
  console.log('(no destructive operation performed — review and run the commands above manually)');
}

function usage() {
  console.log(`Usage:
  bun ${PAI_DIR}/TOOLS/Checkpoint.ts list <slug>
  bun ${PAI_DIR}/TOOLS/Checkpoint.ts show <slug> <isc-id>
  bun ${PAI_DIR}/TOOLS/Checkpoint.ts rollback <slug> <isc-id>

Allowlist: ${ALLOWLIST_PATH}
Work dir:  ${WORK_DIR}

Rollback is PREVIEW ONLY — prints the suggested git reset command per repo
and exits. No destructive git operation is ever executed by this CLI.`);
}

const [, , sub, slug, iscId] = process.argv;
if (!sub) {
  usage();
  process.exit(0);
}
switch (sub) {
  case 'list':
    if (!slug) { usage(); process.exit(1); }
    cmdList(slug);
    break;
  case 'show':
    if (!slug || !iscId) { usage(); process.exit(1); }
    cmdShow(slug, iscId);
    break;
  case 'rollback':
    if (!slug || !iscId) { usage(); process.exit(1); }
    cmdRollback(slug, iscId);
    break;
  default:
    usage();
    process.exit(1);
}
