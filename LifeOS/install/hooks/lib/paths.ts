/**
 * Centralized Path Resolution
 *
 * Two root directories:
 * - LIFEOS_DIR (~/.claude/LIFEOS) — LifeOS data: MEMORY, Algorithm, Tools, USER
 * - Claude home (~/.claude) — Claude Code: settings, skills, hooks, commands, agents
 *
 * Usage:
 *   import { getLifeosDir, getClaudeDir, paiPath } from '';
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
 * Get the LifeOS data directory (expanded).
 *
 * Priority:
 *   1. CLAUDE_PLUGIN_ROOT (plugin install) → <root>/PAI
 *   2. LIFEOS_DIR env var (expanded)
 *   3. <claude home>/LIFEOS (getClaudeDir() — honors CLAUDE_CONFIG_DIR, defaults ~/.claude/LIFEOS)
 *
 * The CLAUDE_PLUGIN_ROOT guard MUST precede the LIFEOS_DIR check: in a packed
 * plugin, bin/pai exports LIFEOS_DIR equal to CLAUDE_PLUGIN_ROOT (the flattened
 * claude-home root), so trusting LIFEOS_DIR first would drop the trailing /PAI
 * segment and mis-resolve paiPath() to ROOT/MEMORY instead of ROOT/LIFEOS/MEMORY.
 * Resolving via getClaudeDir() + 'LifeOS' keeps the live ~/.claude/LIFEOS →
 * plugin ${ROOT}/PAI mapping that the packer's ~/.claude/ → ${LIFEOS_DIR} rewrite assumes.
 */
export function getLifeosDir(): string {
  if (process.env.CLAUDE_PLUGIN_ROOT) {
    return join(getClaudeDir(), 'LIFEOS');
  }

  const envLifeosDir = process.env.LIFEOS_DIR;

  if (envLifeosDir) {
    return expandPath(envLifeosDir);
  }

  return join(getClaudeDir(), 'LIFEOS');
}

/**
 * Get the Claude Code home directory.
 *
 * Plugin install: CLAUDE_PLUGIN_ROOT is the flattened plugin root that plays the
 * live ~/.claude role (skills/ and hooks/ sit directly under it, matching live
 * .claude/skills and .claude/hooks).
 *
 * Live install: CLAUDE_CONFIG_DIR is Claude Code's own override for its config
 * directory (multi-profile setups). When the harness runs from a non-default
 * config dir, hooks inherit that env var, so honoring it keeps every LifeOS
 * path inside the profile that actually loaded the hooks. Default: ~/.claude —
 * byte-identical to prior behavior when neither env var is set.
 */
export function getClaudeDir(): string {
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;

  if (pluginRoot) {
    return expandPath(pluginRoot);
  }

  const configDir = process.env.CLAUDE_CONFIG_DIR;

  if (configDir) {
    return expandPath(configDir);
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
 * Get a path relative to LIFEOS_DIR
 */
export function paiPath(...segments: string[]): string {
  return join(getLifeosDir(), ...segments);
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
