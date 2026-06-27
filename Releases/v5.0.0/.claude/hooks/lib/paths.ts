/**
 * Centralized Path Resolution
 *
 * Two root directories:
 * - PAI_DIR — PAI data: MEMORY, Algorithm, Tools, USER
 * - Harness home — agent app files: settings/config, skills, hooks, commands, agents
 *
 * Usage:
 *   import { getPaiDir, getClaudeDir, paiPath } from '';
 */

import { existsSync, realpathSync } from 'fs';
import { homedir } from 'os';
import { dirname, join } from 'path';

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

function resolveExisting(path: string): string {
  return existsSync(path) ? realpathSync(path) : path;
}

/**
 * Get the PAI data directory (expanded)
 * Priority: PAI_DIR env var (expanded) → selected harness compatibility link
 * resolved to its canonical target → ~/.pai fallback.
 */
export function getPaiDir(): string {
  const envPaiDir = process.env.PAI_DIR;

  if (envPaiDir) {
    return resolveExisting(expandPath(envPaiDir));
  }

  const compatibilityLink = join(getHarnessDir(), 'PAI');
  if (existsSync(compatibilityLink)) return resolveExisting(compatibilityLink);

  return join(homedir(), '.pai');
}

/**
 * Get the selected harness home directory.
 *
 * The hook library is installed at <harness-home>/hooks/lib. Deriving the
 * harness home from import.meta.dir keeps Claude installs on ~/.claude and
 * Codex installs on ~/.codex without requiring every hook caller to export
 * environment variables.
 */
export function getHarnessDir(): string {
  return dirname(dirname(import.meta.dir));
}

/**
 * Get the selected harness home directory.
 *
 * Legacy name kept for existing hooks; it may be ~/.claude or ~/.codex.
 */
export function getClaudeDir(): string {
  return getHarnessDir();
}

/**
 * Get the selected harness settings path.
 *
 * Claude Code uses settings.json natively; Codex uses config.toml/hooks.json.
 */
export function getHarnessSettingsPath(): string {
  return join(getClaudeDir(), 'settings.json');
}

/**
 * Get the PAI runtime settings path.
 *
 * Codex runtime settings live in PAI_DIR/settings.json. Claude installs keep
 * the historical harness settings.json as a fallback because Claude itself
 * reads that file natively.
 */
export function getSettingsPath(): string {
  const paiSettingsPath = join(getPaiDir(), 'settings.json');
  return existsSync(paiSettingsPath) ? paiSettingsPath : getHarnessSettingsPath();
}

/**
 * Get the authoritative PAI .env path.
 * The selected harness .env is a compatibility link when present.
 */
export function getEnvPath(): string {
  return paiPath('.env');
}

/**
 * Get a path relative to PAI_DIR
 */
export function paiPath(...segments: string[]): string {
  return join(getPaiDir(), ...segments);
}

/**
 * Get the hooks directory (lives in the selected harness home)
 */
export function getHooksDir(): string {
  return join(getClaudeDir(), 'hooks');
}

/**
 * Get the skills directory (lives in the selected harness home)
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
