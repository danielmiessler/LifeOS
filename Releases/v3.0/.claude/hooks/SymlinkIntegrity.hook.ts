#!/usr/bin/env bun
/**
 * SymlinkIntegrity.hook.ts - Three-Layer Architecture Symlink Integrity Check
 *
 * PURPOSE:
 * Verifies that all required symlinks in the three-layer architecture exist and
 * resolve correctly. Automatically repairs file-type symlinks (e.g. credentials
 * replaced by Claude Code's atomic login rename). Warns for directory-type
 * problems that may need content merging before repair.
 *
 * TRIGGER: SessionStart — MUST be the FIRST hook in the SessionStart list.
 *
 * WHY FIRST:
 * Hooks and background processes write to MEMORY/ and skills/PAI/USER/ paths.
 * If a symlink is missing, those writes go to real directories in the pai-system
 * repo instead of marvin — creating orphaned data and git noise. Running first
 * means we fix or catch problems before anything else can make them worse.
 *
 * AUTO-REPAIR (files only):
 * File-type symlinks (credentials, env, settings) can be repaired automatically:
 * copy real file to canonical target → remove real file → recreate symlink.
 * This handles Claude Code's /login flow which does an atomic rename() that
 * replaces the .credentials.json symlink with a real file every time.
 *
 * WARN-ONLY (directories):
 * Directory stubs may contain new content that needs to be merged into marvin
 * before repair. Those require human judgment and the runbook.
 *
 * OUTPUT:
 * - stderr: All messages (shown in terminal to user)
 * - stdout: Warning/repair messages (injected into session context for Claude)
 * - exit(0): ALWAYS — never blocks session start
 *
 * ADDING NEW SYMLINKS:
 * Add entries to REQUIRED_SYMLINKS. Set autoRepair: true for files whose
 * real-file replacement is always safe to overwrite (e.g. credentials, tokens).
 * Leave autoRepair: false for directories or files where content must be merged.
 *
 * PERFORMANCE: ~10ms (synchronous fs calls, no network, no subprocesses)
 */

import { lstatSync, statSync, copyFileSync, unlinkSync, symlinkSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';

const HOME = process.env.HOME ?? '/home/andy';
const PAI_DIR = process.env.PAI_DIR ?? `${HOME}/.claude`;

/**
 * REQUIRED_SYMLINKS — canonical list of three-layer architecture symlinks.
 *
 * path:           Relative to PAI_DIR (i.e. relative to ~/.claude)
 * expectedTarget: Absolute path where the symlink should point.
 * description:    Human-readable label for output messages.
 * autoRepair:     If true and path is a real FILE (not dir), automatically
 *                 copy → remove → symlink. Safe for credentials and tokens
 *                 where the real file always contains fresher data than the
 *                 canonical target (e.g. after /login atomic rename).
 *                 Never auto-repair directories — content may need merging.
 */
const REQUIRED_SYMLINKS = [
  {
    path: 'skills/PAI/USER',
    expectedTarget: `${HOME}/github/marvin/USER`,
    description: 'Personal data (ABOUTME, CONTACTS, identity)',
    autoRepair: false, // directory — may contain content needing merge
  },
  {
    path: 'MEMORY/LEARNING',
    expectedTarget: `${HOME}/github/marvin/MEMORY/LEARNING`,
    description: 'Algorithm learning reflections',
    autoRepair: false,
  },
  {
    path: 'MEMORY/RELATIONSHIP',
    expectedTarget: `${HOME}/github/marvin/MEMORY/RELATIONSHIP`,
    description: 'Relationship notes (written by RelationshipMemory hook)',
    autoRepair: false,
  },
  {
    path: 'MEMORY/SECURITY',
    expectedTarget: `${HOME}/github/marvin/MEMORY/SECURITY`,
    description: 'Security event logs (written by SecurityValidator hook)',
    autoRepair: false,
  },
  {
    path: 'MEMORY/WORK',
    expectedTarget: `${HOME}/github/marvin/MEMORY/WORK`,
    description: 'Work session logs',
    autoRepair: false,
  },
  {
    path: 'MEMORY/VOICE',
    expectedTarget: `${HOME}/github/marvin/MEMORY/VOICE`,
    description: 'Voice event logs',
    autoRepair: false,
  },
  {
    path: 'MEMORY/STATE',
    expectedTarget: `${HOME}/.config/pai/STATE`,
    description: 'Runtime state cache (ephemeral, ~/.config/pai/)',
    autoRepair: false,
  },
  {
    path: 'settings.json',
    expectedTarget: `${HOME}/github/marvin/settings.json`,
    description: 'Personal configuration (identity, hook wiring)',
    autoRepair: false, // settings is complex — changes should be intentional
  },
  {
    path: '.env',
    expectedTarget: `${HOME}/.config/pai/.env`,
    description: 'API keys and secrets',
    autoRepair: true, // file — safe to copy fresh version to canonical location
  },
  {
    path: '.credentials.json',
    expectedTarget: `${HOME}/.config/pai/.credentials.json`,
    description: 'OAuth credentials (replaced by /login atomic rename)',
    autoRepair: true, // file — /login always produces fresh credentials here
  },
  {
    path: 'plans',
    expectedTarget: `${HOME}/github/marvin/plans`,
    description: 'PAI plan files',
    autoRepair: false,
  },
  {
    path: '.claude',
    expectedTarget: `${HOME}/github/marvin/.claude`,
    description: 'Settings overrides (settings.local.json)',
    autoRepair: false,
  },
  // Personal skills — symlinked from marvin (config repo)
  {
    path: 'skills/Analyse',
    expectedTarget: `${HOME}/github/marvin/skills/Analyse`,
    description: 'Personal skill: Analyse',
    autoRepair: false,
  },
  {
    path: 'skills/EngineerAgent',
    expectedTarget: `${HOME}/github/marvin/skills/EngineerAgent`,
    description: 'Personal skill: EngineerAgent (Bea context)',
    autoRepair: false,
  },
  {
    path: 'skills/IdeasCapture',
    expectedTarget: `${HOME}/github/marvin/skills/IdeasCapture`,
    description: 'Personal skill: IdeasCapture',
    autoRepair: false,
  },
  {
    path: 'skills/OperationsAdvisor',
    expectedTarget: `${HOME}/github/marvin/skills/OperationsAdvisor`,
    description: 'Personal skill: OperationsAdvisor (Oscar context)',
    autoRepair: false,
  },
  {
    path: 'skills/PAIMigrate',
    expectedTarget: `${HOME}/github/marvin/skills/PAIMigrate`,
    description: 'Personal skill: PAIMigrate',
    autoRepair: false,
  },
  {
    path: 'skills/ProductManager',
    expectedTarget: `${HOME}/github/marvin/skills/ProductManager`,
    description: 'Personal skill: ProductManager (Pippa context)',
    autoRepair: false,
  },
  {
    path: 'skills/RailAdvisor',
    expectedTarget: `${HOME}/github/marvin/skills/RailAdvisor`,
    description: 'Personal skill: RailAdvisor',
    autoRepair: false,
  },
  {
    path: 'skills/SecurityAdvisor',
    expectedTarget: `${HOME}/github/marvin/skills/SecurityAdvisor`,
    description: 'Personal skill: SecurityAdvisor (Serena context)',
    autoRepair: false,
  },
  {
    path: 'skills/SolutionShaper',
    expectedTarget: `${HOME}/github/marvin/skills/SolutionShaper`,
    description: 'Personal skill: SolutionShaper (Sam context)',
    autoRepair: false,
  },
  {
    path: 'skills/StoryCrafter',
    expectedTarget: `${HOME}/github/marvin/skills/StoryCrafter`,
    description: 'Personal skill: StoryCrafter (Suki context)',
    autoRepair: false,
  },
  {
    path: 'skills/TechnicalDesigner',
    expectedTarget: `${HOME}/github/marvin/skills/TechnicalDesigner`,
    description: 'Personal skill: TechnicalDesigner (Dylan context)',
    autoRepair: false,
  },
  {
    path: 'skills/VoiceServer',
    expectedTarget: `${HOME}/github/marvin/skills/VoiceServer`,
    description: 'Personal skill: VoiceServer customisation',
    autoRepair: false,
  },
  {
    path: 'commands',
    expectedTarget: `${HOME}/github/marvin/commands`,
    description: 'Personal slash commands',
    autoRepair: false,
  },
  {
    path: 'mcp-servers',
    expectedTarget: `${HOME}/github/marvin/mcp-servers`,
    description: 'MCP server installs (cloned from individual repos)',
    autoRepair: false, // directory — may need bun install per server
  },
  {
    path: '../.mcp.json',
    expectedTarget: `${HOME}/github/marvin/.mcp.json`,
    description: 'Global MCP server configuration (~/.mcp.json)',
    autoRepair: false,
  },
] as const;

type SymlinkStatus = 'ok' | 'missing' | 'not_symlink' | 'broken' | 'repaired';

interface CheckResult {
  path: string;
  description: string;
  expectedTarget: string;
  autoRepair: boolean;
  status: SymlinkStatus;
  detail?: string;
}

function checkSymlink(entry: (typeof REQUIRED_SYMLINKS)[number]): CheckResult {
  const fullPath = resolve(PAI_DIR, entry.path);

  let lstat: ReturnType<typeof lstatSync> | null = null;
  try {
    lstat = lstatSync(fullPath);
  } catch {
    return { ...entry, status: 'missing', detail: 'path does not exist' };
  }

  if (!lstat.isSymbolicLink()) {
    // It's a real file or directory — attempt auto-repair if eligible
    if (entry.autoRepair && lstat.isFile()) {
      return attemptFileRepair(entry, fullPath);
    }
    const kind = lstat.isDirectory() ? 'real directory (stub)' : 'real file';
    return {
      ...entry,
      status: 'not_symlink',
      detail: `${kind} — should be symlink → ${entry.expectedTarget}`,
    };
  }

  // It's a symlink — verify it resolves
  try {
    statSync(fullPath);
    return { ...entry, status: 'ok' };
  } catch {
    return {
      ...entry,
      status: 'broken',
      detail: `symlink exists but target is missing → ${entry.expectedTarget}`,
    };
  }
}

function attemptFileRepair(
  entry: (typeof REQUIRED_SYMLINKS)[number],
  fullPath: string
): CheckResult {
  try {
    // Ensure canonical target directory exists
    mkdirSync(dirname(entry.expectedTarget), { recursive: true });

    // Copy real file to canonical location (overwrites — real file is always fresher)
    copyFileSync(fullPath, entry.expectedTarget);

    // Remove the real file that replaced the symlink
    unlinkSync(fullPath);

    // Recreate the symlink
    symlinkSync(entry.expectedTarget, fullPath);

    return {
      ...entry,
      status: 'repaired',
      detail: `auto-repaired: copied to ${entry.expectedTarget} and re-symlinked`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ...entry,
      status: 'not_symlink',
      detail: `auto-repair failed (${message}) — manual fix required`,
    };
  }
}

function buildOutput(repaired: CheckResult[], problems: CheckResult[]): string | null {
  if (repaired.length === 0 && problems.length === 0) return null;

  const lines: string[] = [''];

  if (repaired.length > 0) {
    lines.push('✅ THREE-LAYER ARCHITECTURE — AUTO-REPAIRED SYMLINKS');
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    for (const r of repaired) {
      lines.push(`  🔧 FIXED: ${r.path}`);
      lines.push(`           ${r.description}`);
      if (r.detail) lines.push(`           ${r.detail}`);
      lines.push('');
    }
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push('');
  }

  if (problems.length > 0) {
    lines.push('⚠️  THREE-LAYER ARCHITECTURE — SYMLINK INTEGRITY WARNING');
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push(`${problems.length} symlink(s) need manual repair (directories may contain new content).`);
    lines.push('');
    for (const p of problems) {
      const icon =
        p.status === 'not_symlink' ? '🔴 REAL DIR' :
        p.status === 'missing'     ? '🟡 MISSING ' :
                                     '🟠 BROKEN  ';
      lines.push(`  ${icon}: ${p.path}`);
      lines.push(`             ${p.description}`);
      if (p.detail) lines.push(`             ${p.detail}`);
      lines.push('');
    }
    lines.push('Runbook: ~/github/mccullonas-kb/Marvin/Research/PAI-SYMLINK-REPAIR-RUNBOOK.md');
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push('');
  }

  return lines.join('\n');
}

async function main(): Promise<void> {
  // Skip for subagents — they don't need this check
  const claudeProjectDir = process.env.CLAUDE_PROJECT_DIR ?? '';
  const isSubagent =
    claudeProjectDir.includes('/.claude/Agents/') ||
    process.env.CLAUDE_AGENT_TYPE !== undefined;

  if (isSubagent) process.exit(0);

  const results = REQUIRED_SYMLINKS.map(checkSymlink);

  const repaired  = results.filter(r => r.status === 'repaired');
  const problems  = results.filter(r => r.status !== 'ok' && r.status !== 'repaired');

  const output = buildOutput(repaired, problems);

  if (output) {
    process.stderr.write(output); // terminal
    process.stdout.write(output); // session context (Claude sees it)
  }

  process.exit(0); // never block
}

main().catch(() => process.exit(0));
