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
 * Enforce that a resolved directory is absolute.
 *
 * settings.json `env` values are stored literally — Claude Code does not
 * shell-expand them. A path-like env var such as `${HOME}/.claude/PAI` that is
 * never expanded is non-absolute, and `path.join` silently rebases it onto
 * `process.cwd()`, scattering writes into whatever directory the session was
 * launched from. Fail loudly here instead of misrouting silently.
 */
function assertAbsolute(dir: string, source: string): string {
  if (!dir.startsWith('/')) {
    throw new Error(
      `[paths] ${source} resolved to a non-absolute path: "${dir}" ` +
        `(env value likely unexpanded). cwd=${process.cwd()}`,
    );
  }
  return dir;
}

/**
 * Get the Claude Code home directory.
 * Priority: CLAUDE_CONFIG_DIR env var (expanded) → ~/.claude
 *
 * `CLAUDE_CONFIG_DIR` is the official Claude Code override for the config
 * directory (settings, credentials, session history, plugins) — e.g. for
 * running multiple accounts side by side. Honor it; fall back to ~/.claude.
 */
export function getClaudeDir(): string {
  const override = process.env.CLAUDE_CONFIG_DIR;
  const dir = override ? expandPath(override) : join(homedir(), '.claude');
  return assertAbsolute(dir, 'getClaudeDir');
}

/**
 * Get the PAI data directory.
 *
 * PAI_DIR is, by definition, a SUBPATH relative to the Claude home directory —
 * never an absolute path. getPaiDir() ≡ join(getClaudeDir(), PAI_DIR ?? 'PAI').
 *
 * This makes "PAI data lives inside Claude home" a structural invariant rather
 * than a coincidence of an env value, so a CLAUDE_CONFIG_DIR override
 * propagates to PAI data automatically. The env var remains usable for
 * swapping PAI dirs (e.g. PAI_DIR='experiments/PAI-v2'), always rooted in
 * Claude home.
 *
 * NOTE: an absolute or ${HOME}-style PAI_DIR is NOT supported by design. Such a
 * value joins as a literal subpath and the absolute backstop below will catch
 * a non-absolute result only if getClaudeDir() itself is broken; a stray
 * absolute-looking PAI_DIR instead yields an obviously-wrong visible path
 * (not a silent cwd rebase). settings.json must set PAI_DIR='PAI' (or omit it).
 */
export function getPaiDir(): string {
  // Treat empty/unset PAI_DIR as "use default" — `??` alone would let
  // PAI_DIR='' collapse PAI data into Claude home.
  const sub = process.env.PAI_DIR?.trim() || 'PAI';
  const dir = join(getClaudeDir(), sub);
  return assertAbsolute(dir, 'getPaiDir');
}

/**
 * Get the user's projects directory (expanded)
 * Priority: PROJECTS_DIR env var (expanded) → ~/Projects
 *
 * Companion to getPaiDir(): same literal-env hazard, same resolution contract.
 */
export function getProjectsDir(): string {
  const env = process.env.PROJECTS_DIR;
  const dir = env ? expandPath(env) : join(homedir(), 'Projects');
  return assertAbsolute(dir, 'getProjectsDir');
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
