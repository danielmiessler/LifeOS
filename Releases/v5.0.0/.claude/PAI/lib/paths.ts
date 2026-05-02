/**
 * PAI Domain Path Resolution
 *
 * Architecture L18-34 (PAI/DOCUMENTATION/PAISystemArchitecture.md):
 *   PAI_DIR (~/.claude/PAI) — PAI data: MEMORY, ALGORITHM, TOOLS, USER, …
 *
 * One-way dependency: this lib imports Claude-domain primitives from
 * hooks/lib/paths.ts. Claude lib never imports from here.
 *
 * Resolution chain:
 *   PAI_DIR env (trimmed, must be absolute)
 *     → ${getClaudeDir()}/PAI
 *     → ~/.claude/PAI
 *
 * The two domains are orthogonal once both resolved. PAI_DIR may live
 * outside CLAUDE_CONFIG_DIR; the chain above is only the *fallback default*.
 */

import { join } from 'path';

// One-way import from Claude-domain primitives.
import {
  assertAbsolute,
  expandPath,
  getClaudeDir,
} from '../../hooks/lib/paths';

/**
 * Read an env var, treating empty / whitespace-only as unset.
 *
 * Duplicated locally to keep this file's import surface to Claude-domain
 * primitives only. Identical semantics to the readEnv in hooks/lib/paths.ts.
 */
function readEnv(name: string): string | null {
  const raw = process.env[name];
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Resolve the PAI data directory.
 * Priority: PAI_DIR env (trimmed, must be absolute) → ${getClaudeDir()}/PAI
 */
export function getPaiDir(): string {
  const env = readEnv('PAI_DIR');
  if (env !== null) {
    return assertAbsolute(expandPath(env), 'PAI_DIR');
  }
  return join(getClaudeDir(), 'PAI');
}

/**
 * Get a path joined under getPaiDir().
 */
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

// Re-export Claude-domain primitives that PAI consumers commonly need
// (e.g., for cross-domain access to settings.json or .env). Importers can
// reach Claude paths without a second import statement.
export { getClaudeDir, getSettingsPath, getEnvPath } from '../../hooks/lib/paths';
