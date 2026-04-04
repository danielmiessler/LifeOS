#!/usr/bin/env bun
/**
 * MemoryManager - Smart project memory management for PAI
 *
 * Self-contained tool. Run `setup` to deploy hooks automatically.
 *
 * Commands:
 *   setup                              - Deploy hooks and configure settings (run once)
 *   scan                               - List all project memory dirs with status
 *   status                             - Summary dashboard
 *   orphans                            - List orphaned directories
 *   worktrees                          - List worktree memory directories
 *   migrate <old-path> <new-path>      - Migrate memory between project paths
 *   adopt <encoded-dir>                - Adopt orphaned memory for current CWD
 *   cleanup [--worktrees] [--empty] [--dry-run] - Remove stale memory dirs
 *   normalize-paths <encoded-dir>      - Replace hardcoded absolute paths in memory files
 *   registry                           - Show registry contents
 *
 * Quick start:
 *   bun Tools/MemoryManager.ts setup
 *   bun Tools/MemoryManager.ts status
 */

import { existsSync, readdirSync, statSync, readFileSync, writeFileSync, cpSync, rmSync, mkdirSync, chmodSync } from 'fs';
import { homedir } from 'os';
import { join, basename } from 'path';
import { execSync } from 'child_process';

const PAI_DIR = process.env.PAI_DIR || join(homedir(), '.claude');
const PROJECTS_DIR = join(PAI_DIR, 'projects');
const REGISTRY_PATH = join(PAI_DIR, 'MEMORY', 'STATE', 'project-registry.json');

// ─── Types ──────────────────────────────────────────────────────────────

interface ProjectEntry {
  encodedDir: string;
  realPath: string;
  gitRemote: string | null;
  projectName: string;
  lastSeen: string;
  memoryFiles: number;
}

interface Registry {
  version: 1;
  projects: ProjectEntry[];
}

interface DirInfo {
  encodedDir: string;
  decodedHint: string;
  status: 'active' | 'orphaned' | 'worktree' | 'special';
  memoryFiles: number;
  diskSize: number;
  registryEntry: ProjectEntry | null;
}

// ─── Utilities ──────────────────────────────────────────────────────────

function encodePath(absolutePath: string): string {
  return absolutePath.replace(/[^a-zA-Z0-9]/g, '-');
}

function getDirSize(dirPath: string): number {
  let size = 0;
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fp = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        size += getDirSize(fp);
      } else {
        try { size += statSync(fp).size; } catch { /* skip */ }
      }
    }
  } catch { /* skip */ }
  return size;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function countMemoryFiles(encodedDir: string): number {
  const memDir = join(PROJECTS_DIR, encodedDir, 'memory');
  if (!existsSync(memDir)) return 0;
  try {
    return readdirSync(memDir, { recursive: true })
      .filter(f => String(f).endsWith('.md'))
      .length;
  } catch {
    return 0;
  }
}

function loadRegistry(): Registry {
  const empty: Registry = { version: 1, projects: [] };
  try {
    if (!existsSync(REGISTRY_PATH)) return empty;
    const data = JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8'));
    if (data.version !== 1 || !Array.isArray(data.projects)) return empty;
    return data;
  } catch {
    return empty;
  }
}

function saveRegistry(registry: Registry): void {
  const dir = join(PAI_DIR, 'MEMORY', 'STATE');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));
}

function isWorktreeDir(name: string): boolean {
  return name.includes('-claude-worktrees-');
}

function isSpecialDir(name: string): boolean {
  const homeEncoded = encodePath(homedir());
  const claudeEncoded = encodePath(join(homedir(), '.claude'));
  const specials = [homeEncoded, claudeEncoded];
  return specials.some(s => name === s) || name.startsWith('-tmp-') || name === '-tmp';
}

/**
 * Try to guess the real path from an encoded directory name.
 * This is lossy (underscores, dots, hyphens all become '-'),
 * so we check the registry first, then try common patterns.
 */
function guessRealPath(encodedDir: string): string {
  const registry = loadRegistry();
  const entry = registry.projects.find(p => p.encodedDir === encodedDir);
  if (entry) return entry.realPath;

  // Best effort: replace leading encoded home dir with actual home
  // and assume remaining dashes are path separators
  const home = homedir();
  const homeEncoded = encodePath(home);
  if (encodedDir.startsWith(homeEncoded)) {
    const rest = encodedDir.slice(homeEncoded.length + 1); // skip trailing dash
    return join(home, ...rest.split('-').filter(Boolean));
  }
  return encodedDir; // fallback: return encoded name as-is
}

function checkPathExists(encodedDir: string): boolean {
  const registry = loadRegistry();
  const entry = registry.projects.find(p => p.encodedDir === encodedDir);
  if (entry) return existsSync(entry.realPath);

  // Without registry entry, try to guess
  const guessed = guessRealPath(encodedDir);
  if (guessed !== encodedDir) return existsSync(guessed);

  return false;
}

// ─── Scanning ───────────────────────────────────────────────────────────

function scanAllDirs(): DirInfo[] {
  if (!existsSync(PROJECTS_DIR)) return [];

  const registry = loadRegistry();
  const dirs = readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  return dirs.map(encodedDir => {
    const fullPath = join(PROJECTS_DIR, encodedDir);
    const memFiles = countMemoryFiles(encodedDir);
    const diskSize = getDirSize(fullPath);
    const registryEntry = registry.projects.find(p => p.encodedDir === encodedDir) || null;

    let status: DirInfo['status'];
    if (isSpecialDir(encodedDir)) {
      status = 'special';
    } else if (isWorktreeDir(encodedDir)) {
      status = 'worktree';
    } else if (registryEntry && existsSync(registryEntry.realPath)) {
      status = 'active';
    } else if (checkPathExists(encodedDir)) {
      status = 'active';
    } else {
      status = 'orphaned';
    }

    return {
      encodedDir,
      decodedHint: registryEntry?.realPath || guessRealPath(encodedDir),
      status,
      memoryFiles: memFiles,
      diskSize,
      registryEntry,
    };
  });
}

// ─── Commands ───────────────────────────────────────────────────────────

function cmdScan(): void {
  const dirs = scanAllDirs();

  const statusIcon = { active: '✓', orphaned: '✗', worktree: '⚙', special: '◆' };
  const statusColor = { active: '\x1b[32m', orphaned: '\x1b[31m', worktree: '\x1b[33m', special: '\x1b[36m' };
  const reset = '\x1b[0m';

  console.log(`\n  Project Memory Directories (${dirs.length} total)\n`);
  console.log(`  ${'Status'.padEnd(10)} ${'Files'.padEnd(7)} ${'Size'.padEnd(10)} Project`);
  console.log(`  ${'─'.repeat(10)} ${'─'.repeat(7)} ${'─'.repeat(10)} ${'─'.repeat(50)}`);

  // Sort: active first, then orphaned with files, then rest
  dirs.sort((a, b) => {
    const order = { active: 0, orphaned: 1, worktree: 2, special: 3 };
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    return b.memoryFiles - a.memoryFiles;
  });

  for (const d of dirs) {
    const icon = statusIcon[d.status];
    const color = statusColor[d.status];
    const name = d.registryEntry?.projectName || basename(d.decodedHint);
    const files = d.memoryFiles > 0 ? String(d.memoryFiles) : '-';
    const size = formatSize(d.diskSize);

    console.log(
      `  ${color}${icon} ${d.status.padEnd(8)}${reset} ${files.padEnd(7)} ${size.padEnd(10)} ${name}`
    );
  }

  console.log();
}

function cmdStatus(): void {
  const dirs = scanAllDirs();
  const registry = loadRegistry();

  const active = dirs.filter(d => d.status === 'active');
  const orphaned = dirs.filter(d => d.status === 'orphaned');
  const worktrees = dirs.filter(d => d.status === 'worktree');
  const special = dirs.filter(d => d.status === 'special');

  const totalSize = dirs.reduce((sum, d) => sum + d.diskSize, 0);
  const orphanedSize = orphaned.reduce((sum, d) => sum + d.diskSize, 0);
  const worktreeSize = worktrees.reduce((sum, d) => sum + d.diskSize, 0);
  const orphanedWithFiles = orphaned.filter(d => d.memoryFiles > 0);
  const totalMemFiles = dirs.reduce((sum, d) => sum + d.memoryFiles, 0);

  console.log(`
  ╔═══════════════════════════════════════════════╗
  ║         Memory Manager — Status               ║
  ╠═══════════════════════════════════════════════╣
  ║  Total Directories:    ${String(dirs.length).padEnd(23)}║
  ║    ✓ Active:           ${String(active.length).padEnd(23)}║
  ║    ✗ Orphaned:         ${String(orphaned.length).padEnd(23)}║
  ║    ⚙ Worktree:         ${String(worktrees.length).padEnd(23)}║
  ║    ◆ Special:          ${String(special.length).padEnd(23)}║
  ╠═══════════════════════════════════════════════╣
  ║  Total Memory Files:   ${String(totalMemFiles).padEnd(23)}║
  ║  Orphaned w/ Files:    ${String(orphanedWithFiles.length).padEnd(23)}║
  ╠═══════════════════════════════════════════════╣
  ║  Total Disk Usage:     ${formatSize(totalSize).padEnd(23)}║
  ║  Orphaned Disk:        ${formatSize(orphanedSize).padEnd(23)}║
  ║  Worktree Disk:        ${formatSize(worktreeSize).padEnd(23)}║
  ╠═══════════════════════════════════════════════╣
  ║  Registry Entries:     ${String(registry.projects.length).padEnd(23)}║
  ║  Registry Path:        ${existsSync(REGISTRY_PATH) ? 'OK' : 'NOT FOUND'}${' '.repeat(existsSync(REGISTRY_PATH) ? 20 : 15)}║
  ╚═══════════════════════════════════════════════╝
`);

  if (orphanedWithFiles.length > 0) {
    console.log('  ⚠  Orphaned directories with memory files:');
    for (const d of orphanedWithFiles) {
      console.log(`     ${d.registryEntry?.projectName || basename(d.decodedHint)} (${d.memoryFiles} files, ${formatSize(d.diskSize)})`);
    }
    console.log();
  }
}

function cmdOrphans(): void {
  const dirs = scanAllDirs().filter(d => d.status === 'orphaned');

  if (dirs.length === 0) {
    console.log('\n  No orphaned memory directories found.\n');
    return;
  }

  console.log(`\n  Orphaned Memory Directories (${dirs.length})\n`);

  const withFiles = dirs.filter(d => d.memoryFiles > 0);
  const empty = dirs.filter(d => d.memoryFiles === 0);

  if (withFiles.length > 0) {
    console.log('  ⚠  With memory files (recoverable):');
    for (const d of withFiles) {
      const name = d.registryEntry?.projectName || basename(d.decodedHint);
      console.log(`     ${name}: ${d.memoryFiles} files, ${formatSize(d.diskSize)}`);
      if (d.registryEntry?.gitRemote) {
        console.log(`       Remote: ${d.registryEntry.gitRemote}`);
      }
      console.log(`       Path:   ${d.decodedHint}`);
      console.log(`       Dir:    ${d.encodedDir}`);
    }
    console.log();
  }

  if (empty.length > 0) {
    console.log(`  Empty orphaned directories: ${empty.length} (${formatSize(empty.reduce((s, d) => s + d.diskSize, 0))} total)`);
    console.log(`  Run: bun Tools/MemoryManager.ts cleanup --empty --dry-run\n`);
  }
}

function cmdWorktrees(): void {
  const dirs = scanAllDirs().filter(d => d.status === 'worktree');

  if (dirs.length === 0) {
    console.log('\n  No worktree memory directories found.\n');
    return;
  }

  const totalSize = dirs.reduce((sum, d) => sum + d.diskSize, 0);
  const withFiles = dirs.filter(d => d.memoryFiles > 0);

  console.log(`\n  Worktree Memory Directories (${dirs.length}, ${formatSize(totalSize)} total)\n`);

  if (withFiles.length > 0) {
    console.log('  With memory files:');
    for (const d of withFiles) {
      console.log(`    ${basename(d.decodedHint)}: ${d.memoryFiles} files, ${formatSize(d.diskSize)}`);
    }
  }

  const emptyCount = dirs.length - withFiles.length;
  if (emptyCount > 0) {
    console.log(`\n  Empty worktree directories: ${emptyCount}`);
    console.log(`  Run: bun Tools/MemoryManager.ts cleanup --worktrees --dry-run\n`);
  }
}

function cmdMigrate(oldPath: string, newPath: string): void {
  if (!existsSync(newPath)) {
    console.error(`  Error: New path does not exist: ${newPath}`);
    process.exit(1);
  }

  const oldEncoded = encodePath(oldPath);
  const newEncoded = encodePath(newPath);
  const oldMemDir = join(PROJECTS_DIR, oldEncoded, 'memory');
  const newMemDir = join(PROJECTS_DIR, newEncoded, 'memory');

  if (!existsSync(oldMemDir)) {
    console.error(`  Error: No memory directory found at old path encoding: ${oldEncoded}`);
    process.exit(1);
  }

  const fileCount = countMemoryFiles(oldEncoded);
  if (fileCount === 0) {
    console.log(`  No memory files to migrate from ${oldPath}`);
    return;
  }

  console.log(`  Migrating ${fileCount} memory files...`);
  console.log(`  From: ${oldMemDir}`);
  console.log(`  To:   ${newMemDir}`);

  if (!existsSync(newMemDir)) {
    mkdirSync(newMemDir, { recursive: true });
  }

  cpSync(oldMemDir, newMemDir, { recursive: true });

  const newCount = countMemoryFiles(newEncoded);
  console.log(`  ✓ Migrated ${newCount} files successfully.`);
  console.log(`  Note: Old memory preserved at ${oldMemDir}`);
  console.log(`  Run 'cleanup' to remove old directories when ready.\n`);
}

function cmdAdopt(encodedDir: string): void {
  const cwd = process.cwd();
  const sourceMemDir = join(PROJECTS_DIR, encodedDir, 'memory');

  if (!existsSync(sourceMemDir)) {
    console.error(`  Error: No memory directory found: ${encodedDir}`);
    process.exit(1);
  }

  const fileCount = countMemoryFiles(encodedDir);
  if (fileCount === 0) {
    console.log(`  No memory files to adopt from ${encodedDir}`);
    return;
  }

  const targetEncoded = encodePath(cwd);
  const targetMemDir = join(PROJECTS_DIR, targetEncoded, 'memory');

  console.log(`  Adopting ${fileCount} memory files for ${cwd}...`);
  console.log(`  From: ${sourceMemDir}`);
  console.log(`  To:   ${targetMemDir}`);

  if (!existsSync(targetMemDir)) {
    mkdirSync(targetMemDir, { recursive: true });
  }

  cpSync(sourceMemDir, targetMemDir, { recursive: true });

  const newCount = countMemoryFiles(targetEncoded);
  console.log(`  ✓ Adopted ${newCount} files successfully.\n`);
}

function cmdCleanup(flags: { worktrees: boolean; empty: boolean; dryRun: boolean }): void {
  const dirs = scanAllDirs();
  const toRemove: DirInfo[] = [];

  for (const d of dirs) {
    if (d.status === 'active' || d.status === 'special') continue;

    if (flags.worktrees && d.status === 'worktree' && d.memoryFiles === 0) {
      toRemove.push(d);
    }
    if (flags.empty && d.memoryFiles === 0 && d.status === 'orphaned') {
      toRemove.push(d);
    }
  }

  if (toRemove.length === 0) {
    console.log('\n  Nothing to clean up.\n');
    return;
  }

  const totalSize = toRemove.reduce((sum, d) => sum + d.diskSize, 0);

  if (flags.dryRun) {
    console.log(`\n  [DRY RUN] Would remove ${toRemove.length} directories (${formatSize(totalSize)}):\n`);
    for (const d of toRemove) {
      const name = d.registryEntry?.projectName || basename(d.decodedHint);
      console.log(`    ${d.status.padEnd(10)} ${name} (${formatSize(d.diskSize)})`);
    }
    console.log(`\n  Run without --dry-run to execute.\n`);
    return;
  }

  console.log(`\n  Removing ${toRemove.length} directories (${formatSize(totalSize)})...\n`);

  let removed = 0;
  for (const d of toRemove) {
    const fullPath = join(PROJECTS_DIR, d.encodedDir);
    try {
      rmSync(fullPath, { recursive: true, force: true });
      const name = d.registryEntry?.projectName || basename(d.decodedHint);
      console.log(`  ✓ Removed: ${name}`);
      removed++;
    } catch (err) {
      console.error(`  ✗ Failed: ${d.encodedDir}: ${err}`);
    }
  }

  // Clean up registry entries for removed dirs
  const registry = loadRegistry();
  const removedEncodings = new Set(toRemove.map(d => d.encodedDir));
  registry.projects = registry.projects.filter(p => !removedEncodings.has(p.encodedDir));
  saveRegistry(registry);

  console.log(`\n  Cleaned up ${removed}/${toRemove.length} directories.\n`);
}

function cmdNormalizePaths(encodedDir: string): void {
  const memDir = join(PROJECTS_DIR, encodedDir, 'memory');

  if (!existsSync(memDir)) {
    console.error(`  Error: No memory directory found: ${encodedDir}`);
    process.exit(1);
  }

  const home = homedir();
  const files = readdirSync(memDir, { recursive: true })
    .filter(f => String(f).endsWith('.md'))
    .map(f => join(memDir, String(f)));

  let totalReplacements = 0;

  for (const filePath of files) {
    try {
      let content = readFileSync(filePath, 'utf-8');
      const original = content;

      // Replace absolute home paths with ~
      const homePattern = new RegExp(home.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      content = content.replace(homePattern, '~');

      if (content !== original) {
        const count = (original.match(homePattern) || []).length;
        writeFileSync(filePath, content);
        console.log(`  ${basename(filePath)}: ${count} path(s) normalized`);
        totalReplacements += count;
      }
    } catch (err) {
      console.error(`  Error processing ${basename(filePath)}: ${err}`);
    }
  }

  if (totalReplacements === 0) {
    console.log(`  No hardcoded paths found in ${encodedDir}/memory/`);
  } else {
    console.log(`\n  ✓ Normalized ${totalReplacements} path reference(s).\n`);
  }
}

function cmdRegistry(): void {
  const registry = loadRegistry();

  if (registry.projects.length === 0) {
    console.log('\n  Registry is empty. Open projects to populate it.\n');
    return;
  }

  console.log(`\n  Project Registry (${registry.projects.length} entries)\n`);
  console.log(`  ${'Project'.padEnd(25)} ${'Files'.padEnd(7)} ${'Last Seen'.padEnd(22)} Remote`);
  console.log(`  ${'─'.repeat(25)} ${'─'.repeat(7)} ${'─'.repeat(22)} ${'─'.repeat(40)}`);

  const sorted = [...registry.projects].sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
  for (const p of sorted) {
    const date = new Date(p.lastSeen).toLocaleString();
    const remote = p.gitRemote || '-';
    console.log(
      `  ${p.projectName.padEnd(25)} ${String(p.memoryFiles).padEnd(7)} ${date.padEnd(22)} ${remote}`
    );
  }
  console.log();
}

// ─── Setup: Generate hook source files programmatically ─────────────────

function generateRegistrySrc(): string {
  const lines = [
    '/**',
    ' * Memory Registry - Shared library for project memory management',
    ' *',
    ' * Provides fingerprinting (git remote URL), registry CRUD, and path encoding',
    ' * that mirrors Claude Code\'s internal sanitizePath().',
    ' */',
    '',
    "import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';",
    "import { join, basename, dirname } from 'path';",
    "import { execSync } from 'child_process';",
    "import { getProjectsDir, getRegistryPath } from './paths';",
    '',
    'export interface ProjectEntry {',
    '  encodedDir: string;',
    '  realPath: string;',
    '  gitRemote: string | null;',
    '  projectName: string;',
    '  lastSeen: string;',
    '  memoryFiles: number;',
    '}',
    '',
    'export interface Registry {',
    '  version: 1;',
    '  projects: ProjectEntry[];',
    '}',
    '',
    'export function encodePath(absolutePath: string): string {',
    '  return absolutePath.replace(/[^a-zA-Z0-9]/g, \'-\');',
    '}',
    '',
    'export function getGitRemote(projectPath: string): string | null {',
    '  try {',
    '    const url = execSync(`git -C "${projectPath}" remote get-url origin 2>/dev/null`, {',
    "      encoding: 'utf-8',",
    '      timeout: 3000,',
    '    }).trim();',
    '    return url || null;',
    '  } catch {',
    '    return null;',
    '  }',
    '}',
    '',
    'export function normalizeGitUrl(url: string): string {',
    '  let normalized = url.trim();',
    '  const httpsMatch = normalized.match(/^https?:\\/\\/(?:[^@]+@)?(.+)$/);',
    '  if (httpsMatch) {',
    '    normalized = httpsMatch[1];',
    '  } else {',
    '    const sshMatch = normalized.match(/^(?:ssh:\\/\\/)?[^@]+@([^:\\/]+)[:\\/](.+)$/);',
    '    if (sshMatch) {',
    '      normalized = `${sshMatch[1]}/${sshMatch[2]}`;',
    '    }',
    '  }',
    "  normalized = normalized.replace(/\\.git$/, '');",
    "  normalized = normalized.replace(/\\/$/, '');",
    '  return normalized.toLowerCase();',
    '}',
    '',
    'export function loadRegistry(): Registry {',
    '  const empty: Registry = { version: 1, projects: [] };',
    '  try {',
    '    const path = getRegistryPath();',
    '    if (!existsSync(path)) return empty;',
    "    const data = JSON.parse(readFileSync(path, 'utf-8'));",
    '    if (data.version !== 1 || !Array.isArray(data.projects)) return empty;',
    '    return data;',
    '  } catch {',
    '    return empty;',
    '  }',
    '}',
    '',
    'export function saveRegistry(registry: Registry): void {',
    '  const path = getRegistryPath();',
    '  const dir = dirname(path);',
    '  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });',
    '  writeFileSync(path, JSON.stringify(registry, null, 2));',
    '}',
    '',
    'export function getMemoryPath(encodedDir: string): string {',
    "  return join(getProjectsDir(), encodedDir, 'memory');",
    '}',
    '',
    'export function countMemoryFiles(encodedDir: string): number {',
    '  const memDir = getMemoryPath(encodedDir);',
    '  if (!existsSync(memDir)) return 0;',
    '  try {',
    '    return readdirSync(memDir, { recursive: true })',
    "      .filter(f => String(f).endsWith('.md'))",
    '      .length;',
    '  } catch {',
    '    return 0;',
    '  }',
    '}',
    '',
    'export function registerProject(realPath: string): ProjectEntry {',
    '  const registry = loadRegistry();',
    '  const encodedDir = encodePath(realPath);',
    '  const gitRemoteRaw = getGitRemote(realPath);',
    '  const gitRemote = gitRemoteRaw ? normalizeGitUrl(gitRemoteRaw) : null;',
    '  const projectName = basename(realPath);',
    '  const memoryFiles = countMemoryFiles(encodedDir);',
    '  const entry: ProjectEntry = {',
    '    encodedDir, realPath, gitRemote, projectName,',
    '    lastSeen: new Date().toISOString(), memoryFiles,',
    '  };',
    '  const idx = registry.projects.findIndex(p => p.encodedDir === encodedDir);',
    '  if (idx >= 0) registry.projects[idx] = entry;',
    '  else registry.projects.push(entry);',
    '  saveRegistry(registry);',
    '  return entry;',
    '}',
    '',
    'export function findByGitRemote(normalizedUrl: string): ProjectEntry[] {',
    '  const registry = loadRegistry();',
    '  return registry.projects',
    '    .filter(p => p.gitRemote === normalizedUrl && p.memoryFiles > 0)',
    '    .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));',
    '}',
    '',
    'export function findByName(name: string): ProjectEntry[] {',
    '  const registry = loadRegistry();',
    '  return registry.projects',
    '    .filter(p => p.projectName === name && p.memoryFiles > 0)',
    '    .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));',
    '}',
  ];
  return lines.join('\n') + '\n';
}

function generateHookSrc(): string {
  const lines = [
    '#!/usr/bin/env bun',
    '/**',
    ' * MemoryDetect.hook.ts - Auto-detect and migrate orphaned project memory',
    ' * TRIGGER: SessionStart (before LoadContext)',
    ' */',
    '',
    "import { existsSync, cpSync, mkdirSync } from 'fs';",
    'import {',
    '  encodePath, getGitRemote, normalizeGitUrl, registerProject,',
    '  findByGitRemote, findByName, getMemoryPath, countMemoryFiles,',
    "} from './lib/memory-registry';",
    '',
    'function isSubagent(): boolean {',
    "  if ((process.env.CLAUDE_PROJECT_DIR || '').includes('/.claude/Agents/')) return true;",
    '  if (process.env.CLAUDE_AGENT_TYPE) return true;',
    '  return false;',
    '}',
    '',
    'function main(): void {',
    '  if (isSubagent()) return;',
    '  const cwd = process.cwd();',
    '  const encodedDir = encodePath(cwd);',
    '  const memDir = getMemoryPath(encodedDir);',
    '',
    '  if (existsSync(memDir) && countMemoryFiles(encodedDir) > 0) {',
    '    registerProject(cwd);',
    '    return;',
    '  }',
    '',
    '  const gitRemoteRaw = getGitRemote(cwd);',
    '  if (gitRemoteRaw) {',
    '    const normalizedUrl = normalizeGitUrl(gitRemoteRaw);',
    '    const candidates = findByGitRemote(normalizedUrl).filter(m => m.encodedDir !== encodedDir);',
    '    if (candidates.length > 0) {',
    '      const best = candidates[0];',
    '      const oldMemDir = getMemoryPath(best.encodedDir);',
    '      if (existsSync(oldMemDir)) {',
    '        if (!existsSync(memDir)) mkdirSync(memDir, { recursive: true });',
    '        try {',
    '          cpSync(oldMemDir, memDir, { recursive: true });',
    '          const copied = countMemoryFiles(encodedDir);',
    '          process.stderr.write(',
    "            '[MemoryDetect] Migrated ' + copied + ' memory files from previous location\\n' +",
    "            '  Old: ' + best.realPath + '\\n  New: ' + cwd + '\\n'",
    '          );',
    '        } catch (err) {',
    "          process.stderr.write('[MemoryDetect] Migration failed: ' + err + '\\n');",
    '        }',
    '      }',
    '    }',
    '  }',
    '',
    '  if (countMemoryFiles(encodedDir) === 0) {',
    "    const projectName = cwd.split('/').pop() || '';",
    '    if (projectName) {',
    '      const nameMatches = findByName(projectName).filter(m => m.encodedDir !== encodedDir);',
    '      if (nameMatches.length === 1) {',
    '        const match = nameMatches[0];',
    '        process.stderr.write(',
    "          '[MemoryDetect] Found possible orphaned memory for \"' + projectName + '\" at:\\n' +",
    "          '  ' + match.realPath + ' (' + match.memoryFiles + ' files)\\n' +",
    "          '  Run: bun Tools/MemoryManager.ts adopt ' + match.encodedDir + '\\n'",
    '        );',
    '      }',
    '    }',
    '  }',
    '',
    '  registerProject(cwd);',
    '}',
    '',
    'main();',
  ];
  return lines.join('\n') + '\n';
}

const PATHS_ADDITIONS = [
  '',
  '/**',
  ' * Get the projects directory (~/.claude/projects/)',
  ' */',
  'export function getProjectsDir(): string {',
  "  return paiPath('projects');",
  '}',
  '',
  '/**',
  ' * Get the project registry path',
  ' */',
  'export function getRegistryPath(): string {',
  "  return paiPath('MEMORY', 'STATE', 'project-registry.json');",
  '}',
].join('\n') + '\n';

function cmdSetup(): void {
  const hooksDir = join(PAI_DIR, 'hooks');
  const hooksLibDir = join(hooksDir, 'lib');
  const settingsPath = join(PAI_DIR, 'settings.json');

  console.log('\n  MemoryManager Setup\n');

  // 1. Ensure directories exist
  if (!existsSync(hooksLibDir)) {
    mkdirSync(hooksLibDir, { recursive: true });
    console.log('  + Created hooks/lib directory');
  }

  // 2. Deploy memory-registry.ts
  const registryLibPath = join(hooksLibDir, 'memory-registry.ts');
  const registryExists = existsSync(registryLibPath);
  writeFileSync(registryLibPath, generateRegistrySrc());
  console.log('  + ' + (registryExists ? 'Updated' : 'Created') + ' hooks/lib/memory-registry.ts');

  // 3. Deploy MemoryDetect.hook.ts
  const hookPath = join(hooksDir, 'MemoryDetect.hook.ts');
  const hookExists = existsSync(hookPath);
  writeFileSync(hookPath, generateHookSrc());
  chmodSync(hookPath, 0o755);
  console.log('  + ' + (hookExists ? 'Updated' : 'Created') + ' hooks/MemoryDetect.hook.ts');

  // 4. Update paths.ts if needed
  const pathsFile = join(hooksLibDir, 'paths.ts');
  if (existsSync(pathsFile)) {
    const pathsContent = readFileSync(pathsFile, 'utf-8');
    if (!pathsContent.includes('getProjectsDir')) {
      writeFileSync(pathsFile, pathsContent + PATHS_ADDITIONS);
      console.log('  + Added getProjectsDir/getRegistryPath to paths.ts');
    } else {
      console.log('  . paths.ts already has required functions');
    }
  } else {
    console.log('  ! hooks/lib/paths.ts not found — skipping (install PAI first)');
  }

  // 5. Update settings.json if needed
  if (existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
      const hookCommand = '${PAI_DIR}/hooks/MemoryDetect.hook.ts';
      const sessionStart = settings.hooks?.SessionStart;

      if (sessionStart && Array.isArray(sessionStart)) {
        const hookGroup = sessionStart[0];
        if (hookGroup?.hooks && Array.isArray(hookGroup.hooks)) {
          const alreadyAdded = hookGroup.hooks.some(
            (h: any) => h.command?.includes('MemoryDetect')
          );
          if (!alreadyAdded) {
            hookGroup.hooks.unshift({ type: 'command', command: hookCommand });
            writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
            console.log('  + Added MemoryDetect hook to settings.json SessionStart');
          } else {
            console.log('  . MemoryDetect hook already in settings.json');
          }
        }
      } else {
        console.log('  ! No SessionStart hooks in settings.json — add manually');
      }
    } catch (err) {
      console.log('  ! Could not update settings.json: ' + err);
    }
  } else {
    console.log('  ! settings.json not found — hook needs manual configuration');
  }

  // 6. Ensure MEMORY/STATE directory exists
  const stateDir = join(PAI_DIR, 'MEMORY', 'STATE');
  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true });
    console.log('  + Created MEMORY/STATE directory');
  }

  console.log('\n  Setup complete! The MemoryDetect hook will now:');
  console.log('  - Register every project you open (with git remote fingerprint)');
  console.log('  - Auto-migrate memory when you open a moved/renamed project');
  console.log('\n  Try: bun Tools/MemoryManager.ts status\n');
}

// ─── Main ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'setup':
    cmdSetup();
    break;
  case 'scan':
    cmdScan();
    break;
  case 'status':
    cmdStatus();
    break;
  case 'orphans':
    cmdOrphans();
    break;
  case 'worktrees':
    cmdWorktrees();
    break;
  case 'migrate': {
    const oldPath = args[1];
    const newPath = args[2];
    if (!oldPath || !newPath) {
      console.error('  Usage: bun Tools/MemoryManager.ts migrate <old-path> <new-path>');
      process.exit(1);
    }
    cmdMigrate(oldPath, newPath);
    break;
  }
  case 'adopt': {
    const encodedDir = args[1];
    if (!encodedDir) {
      console.error('  Usage: bun Tools/MemoryManager.ts adopt <encoded-dir>');
      process.exit(1);
    }
    cmdAdopt(encodedDir);
    break;
  }
  case 'cleanup': {
    const flags = {
      worktrees: args.includes('--worktrees'),
      empty: args.includes('--empty'),
      dryRun: args.includes('--dry-run'),
    };
    if (!flags.worktrees && !flags.empty) {
      console.error('  Usage: bun Tools/MemoryManager.ts cleanup [--worktrees] [--empty] [--dry-run]');
      console.error('  Specify at least one of --worktrees or --empty');
      process.exit(1);
    }
    cmdCleanup(flags);
    break;
  }
  case 'normalize-paths': {
    const encodedDir = args[1];
    if (!encodedDir) {
      console.error('  Usage: bun Tools/MemoryManager.ts normalize-paths <encoded-dir>');
      process.exit(1);
    }
    cmdNormalizePaths(encodedDir);
    break;
  }
  case 'registry':
    cmdRegistry();
    break;
  default:
    console.log(`
  MemoryManager — Smart project memory management for PAI

  Quick start:
    bun Tools/MemoryManager.ts setup     Deploy hooks (run once after install)
    bun Tools/MemoryManager.ts status    See current state

  Commands:
    setup                               Deploy hooks and configure settings
    scan                                List all project memory dirs with status
    status                              Summary dashboard
    orphans                             List orphaned directories
    worktrees                           List worktree memory directories
    migrate <old-path> <new-path>       Migrate memory between project paths
    adopt <encoded-dir>                 Adopt orphaned memory for current CWD
    cleanup [--worktrees] [--empty]     Remove stale memory dirs
            [--dry-run]
    normalize-paths <encoded-dir>       Replace hardcoded absolute paths
    registry                            Show registry contents

  Examples:
    bun Tools/MemoryManager.ts setup
    bun Tools/MemoryManager.ts scan
    bun Tools/MemoryManager.ts status
    bun Tools/MemoryManager.ts cleanup --worktrees --dry-run
    bun Tools/MemoryManager.ts cleanup --worktrees --empty
    bun Tools/MemoryManager.ts migrate /old/path/project /new/path/project
`);
    break;
}
