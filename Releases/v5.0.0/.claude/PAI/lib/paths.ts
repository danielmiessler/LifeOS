/**
 * PAI Path Resolution — self-contained.
 *
 * Architecture (PAI/DOCUMENTATION/PAISystemArchitecture.md, "## Directory Structure"):
 * - CLAUDE_CONFIG_DIR (~/.claude)        — Claude Code: settings, hooks, skills, agents
 * - PAI_DIR           (~/.claude/PAI)    — PAI data: MEMORY, ALGORITHM, TOOLS, USER
 *
 * The two domains are orthogonal once both are resolved. PAI_DIR may live
 * outside CLAUDE_CONFIG_DIR. Cross-domain access uses absolute paths via
 * env vars — never relative filesystem paths.
 *
 * This file is the lib for code in the PAI domain. It carries the full
 * API (PAI helpers + Claude-domain helpers consumers commonly need) so
 * PAI code never has to reach across the filesystem to import Claude code.
 *
 * The Claude domain has a mirror lib at hooks/lib/paths.ts. Both files
 * implement the same env-var contract. Bug fixes apply to both.
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

// ─── Claude domain ────────────────────────────────────────────────────────

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

export function claudePath(...segments: string[]): string {
  return join(getClaudeDir(), ...segments);
}

export function getSettingsPath(): string {
  return join(getClaudeDir(), 'settings.json');
}

export function getEnvPath(): string {
  return join(getClaudeDir(), '.env');
}

// ─── PAI domain ───────────────────────────────────────────────────────────

/**
 * Resolve the PAI data directory.
 * Priority: PAI_DIR env (trimmed, must be absolute) → ${getClaudeDir()}/PAI
 *
 * Note: the fallback chain through Claude is the *default location* only.
 * Once both vars resolve, the two domains are independent.
 */
export function getPaiDir(): string {
  const env = readEnv('PAI_DIR');
  if (env !== null) {
    return assertAbsolute(expandPath(env), 'PAI_DIR');
  }
  return join(getClaudeDir(), 'PAI');
}

export function paiPath(...segments: string[]): string {
  return join(getPaiDir(), ...segments);
}

export function getMemoryDir(): string {
  return paiPath('MEMORY');
}

export function getStateDir(): string {
  return paiPath('MEMORY', 'STATE');
}

export function getLearningDir(): string {
  return paiPath('MEMORY', 'LEARNING');
}

export function getKnowledgeDir(): string {
  return paiPath('MEMORY', 'KNOWLEDGE');
}

export function getWorkDir(): string {
  return paiPath('MEMORY', 'WORK');
}

export function getObservabilityDir(): string {
  return paiPath('MEMORY', 'OBSERVABILITY');
}

export function getUserDir(): string {
  return paiPath('USER');
}

export function getAlgorithmDir(): string {
  return paiPath('ALGORITHM');
}

export function getToolsDir(): string {
  return paiPath('TOOLS');
}

export function getDocumentationDir(): string {
  return paiPath('DOCUMENTATION');
}
