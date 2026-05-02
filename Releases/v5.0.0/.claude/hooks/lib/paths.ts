/**
 * Centralized Path Resolution — Claude domain
 *
 * Two root directories per architecture L18-34
 * (PAI/DOCUMENTATION/PAISystemArchitecture.md):
 * - CLAUDE_CONFIG_DIR (~/.claude)        — Claude Code: settings, skills, hooks, agents
 * - PAI_DIR           (~/.claude/PAI)    — PAI data: MEMORY, ALGORITHM, TOOLS, USER
 *
 * The two domains are orthogonal once both are resolved. Cross-domain access
 * uses absolute paths via these helpers — never relative paths.
 *
 * This file owns Claude-domain primitives only: getClaudeDir, claudePath,
 * getSettingsPath, getEnvPath, getHooksDir, getSkillsDir, getAgentsDir,
 * getCommandsDir, getPluginsDir, expandPath, assertAbsolute.
 *
 * PAI-domain helpers (getPaiDir, paiPath, getMemoryDir, getStateDir, etc.)
 * live exclusively in PAI/lib/paths.ts. One-way dependency: PAI → Claude.
 */

import { homedir } from 'os';
import { isAbsolute, join } from 'path';

/**
 * Read an env var, treating empty / whitespace-only as unset.
 */
function readEnv(name: string): string | null {
  const raw = process.env[name];
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Throw if the path is not absolute. Used at lib boundary to reject
 * `CLAUDE_CONFIG_DIR=relative/path` and similar misconfigurations early.
 */
export function assertAbsolute(path: string, source: string): string {
  if (!isAbsolute(path)) {
    throw new Error(`${source} must be an absolute path, got: ${JSON.stringify(path)}`);
  }
  return path;
}

/**
 * Expand shell variables in a path string.
 * Supports leading $HOME, ${HOME}, ~ — not arbitrary $VAR substitution.
 */
export function expandPath(path: string): string {
  const home = homedir();

  return path
    .replace(/^\$HOME(?=\/|$)/, home)
    .replace(/^\$\{HOME\}(?=\/|$)/, home)
    .replace(/^~(?=\/|$)/, home);
}

/**
 * Resolve the Claude Code home directory.
 * Priority: CLAUDE_CONFIG_DIR env (trimmed, must be absolute) → ~/.claude
 */
export function getClaudeDir(): string {
  const env = readEnv('CLAUDE_CONFIG_DIR');
  if (env !== null) {
    return assertAbsolute(expandPath(env), 'CLAUDE_CONFIG_DIR');
  }
  return join(homedir(), '.claude');
}

/**
 * Get a path joined under getClaudeDir().
 */
export function claudePath(...segments: string[]): string {
  return join(getClaudeDir(), ...segments);
}

/**
 * Get the settings.json path (lives in Claude home).
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
 * Get the hooks directory (lives in Claude home).
 */
export function getHooksDir(): string {
  return join(getClaudeDir(), 'hooks');
}

/**
 * Get the skills directory (lives in Claude home).
 */
export function getSkillsDir(): string {
  return join(getClaudeDir(), 'skills');
}

/**
 * Get the agents directory (lives in Claude home).
 */
export function getAgentsDir(): string {
  return join(getClaudeDir(), 'agents');
}

/**
 * Get the commands directory (lives in Claude home).
 */
export function getCommandsDir(): string {
  return join(getClaudeDir(), 'commands');
}

/**
 * Get the plugins directory (lives in Claude home).
 */
export function getPluginsDir(): string {
  return join(getClaudeDir(), 'plugins');
}

