/**
 * Installer Path Resolution.
 *
 * Resolves CLAUDE_CONFIG_DIR and PAI_DIR for the installer's intake, with
 * precedence: CLI flag > env var > default. Reuses the runtime lib's
 * trim/empty/whitespace/absolute semantics from `PAI/lib/paths.ts` so the
 * installer and runtime agree on where things live.
 *
 * Architecture: PAI/DOCUMENTATION/PAISystemArchitecture.md "## Directory Structure"
 */

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

const clean = (v: string | undefined): string | undefined => v?.trim() || undefined;

/**
 * Resolve install locations with CLI > env > default precedence.
 * Env-only resolution delegates to the runtime lib so installer and
 * runtime can never drift on path semantics.
 */
export function resolveInstallPaths(opts: ResolveOptions): ResolvedInstallPaths {
  const cliClaude = clean(opts.cliClaudeConfigDir);
  const cliPai = clean(opts.cliPaiDir);
  const envPai = clean(process.env.PAI_DIR);

  const claudeConfigDir = cliClaude
    ? assertAbsolute(expandPath(cliClaude), '--claude-config-dir')
    : getClaudeDir();

  // When --claude-config-dir is given without --pai-dir and no PAI_DIR env,
  // anchor PAI under the CLI-supplied Claude root rather than letting
  // getPaiDir() resolve from a CLAUDE_CONFIG_DIR env the user didn't pass.
  const paiDir = cliPai
    ? assertAbsolute(expandPath(cliPai), '--pai-dir')
    : cliClaude && !envPai
      ? join(claudeConfigDir, 'PAI')
      : getPaiDir();

  return { claudeConfigDir, paiDir };
}
