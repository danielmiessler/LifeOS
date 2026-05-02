/**
 * Installer Path Resolution.
 *
 * Resolves CLAUDE_CONFIG_DIR and PAI_DIR for the installer's intake, with
 * precedence: CLI flag > env var > default. Reuses the runtime lib's
 * trim/empty/whitespace/absolute semantics from `PAI/lib/paths.ts` so the
 * installer and runtime agree on where things live.
 *
 * Architecture: PAI/DOCUMENTATION/PAISystemArchitecture.md L18-34
 */

import { homedir } from 'os';
import { join } from 'path';
import { assertAbsolute, expandPath, getClaudeDir, getPaiDir } from '../../lib/paths';

export interface ResolveOptions {
  /** From `--claude-config-dir <abs>`. Highest precedence for Claude home. */
  cliClaudeConfigDir?: string;
  /** From `--pai-dir <abs>`. Highest precedence for PAI data root. */
  cliPaiDir?: string;
}

export interface ResolvedInstallPaths {
  claudeConfigDir: string;
  paiDir: string;
}

/** Trim and treat empty/whitespace as undefined. */
function clean(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

/**
 * Resolve install locations with CLI > env > default precedence.
 *
 * For env-only resolution this delegates to the runtime lib so installer
 * and runtime cannot drift. CLI flags short-circuit ahead of env so the
 * runtime lib is never consulted when an explicit override is given.
 */
export function resolveInstallPaths(opts: ResolveOptions): ResolvedInstallPaths {
  const cliClaude = clean(opts.cliClaudeConfigDir);
  const cliPai = clean(opts.cliPaiDir);

  const claudeConfigDir = cliClaude
    ? assertAbsolute(expandPath(cliClaude), '--claude-config-dir')
    : getClaudeDir();

  let paiDir: string;
  if (cliPai) {
    paiDir = assertAbsolute(expandPath(cliPai), '--pai-dir');
  } else if (cliClaude && !process.env.PAI_DIR?.trim()) {
    // CLI gave a Claude override and no explicit PAI override → PAI defaults
    // under the CLI-supplied Claude root.
    paiDir = join(claudeConfigDir, 'PAI');
  } else {
    paiDir = getPaiDir();
  }

  return { claudeConfigDir, paiDir };
}
