/**
 * Centralized Path Resolution
 *
 * Two root directories:
 * - PAI_DIR (~/.claude/PAI) — PAI data: MEMORY, Algorithm, Tools, USER
 * - Claude home (~/.claude) — Claude Code: settings, skills, hooks, commands, agents
 *
 * Usage:
 *   import { getPaiDir, getClaudeDir, paiPath } from '';
 */

import { homedir } from 'os';
import { join } from 'path';

/**
 * Expand shell variables in a path string
 * Supports: $HOME, ${HOME}, ~
 */
export function expandPath(path: string): string {
  const home = homedir();

  return path
    .replace(/^\$HOME(?=\/|$)/, home)
    .replace(/^\$\{HOME\}(?=\/|$)/, home)
    .replace(/^~(?=\/|$)/, home);
}

/**
 * Get the PAI data directory (expanded)
 * Priority: PAI_DIR env var (expanded) → ~/.claude/PAI
 */
export function getPaiDir(): string {
  const envPaiDir = process.env.PAI_DIR;

  if (envPaiDir) {
    return expandPath(envPaiDir);
  }

  return join(getClaudeDir(), 'PAI');
}

/**
 * Get the Claude Code home directory (~/.claude)
 */
export function getClaudeDir(): string {
  const envClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR;

  if (envClaudeConfigDir) {
    return expandPath(envClaudeConfigDir);
  }

  return join(homedir(), '.claude');
}

/**
 * Get the settings.json path (lives in Claude home)
 */
export function getSettingsPath(): string {
  return join(getClaudeDir(), 'settings.json');
}

/**
 * Get the authoritative .env path (~/.claude/.env).
 * All credentials live here; PAI/.env is deprecated.
 */
export function getEnvPath(): string {
  return join(getClaudeDir(), '.env');
}

/**
 * Get a path relative to PAI_DIR
 */
export function paiPath(...segments: string[]): string {
  return join(getPaiDir(), ...segments);
}

/**
 * Get the hooks directory (lives in Claude home)
 */
export function getHooksDir(): string {
  return join(getClaudeDir(), 'hooks');
}

/**
 * Get the skills directory (lives in Claude home)
 */
export function getSkillsDir(): string {
  return join(getClaudeDir(), 'skills');
}

/**
 * Get the MEMORY directory
 */
export function getMemoryDir(): string {
  return paiPath('MEMORY');
}
