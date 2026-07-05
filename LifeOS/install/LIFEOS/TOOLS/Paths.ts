/**
 * Paths.ts — centralized config-root resolution for LIFEOS/TOOLS.
 *
 * Mirrors hooks/lib/paths.ts (the hooks' resolver) so runtime tools agree with
 * the hooks about where the Claude config root lives:
 *
 *   1. CLAUDE_PLUGIN_ROOT (plugin install) — the flattened plugin root
 *   2. CLAUDE_CONFIG_DIR — Claude Code's own config-dir override
 *      (multi-profile setups)
 *   3. ~/.claude — the default, byte-identical to prior behavior
 *
 * LIFEOS data resolves via LIFEOS_DIR when set, else <claude dir>/LIFEOS.
 */

import { homedir } from "node:os";
import { join } from "node:path";

/** Expand $HOME, ${HOME}, and ~ prefixes in a path string. */
export function expandPath(path: string): string {
  const home = homedir();

  return path
    .replace(/^\$HOME(?=\/|$)/, home)
    .replace(/^\$\{HOME\}(?=\/|$)/, home)
    .replace(/^~(?=\/|$)/, home);
}

/** Get the Claude Code config directory (see resolution order above). */
export function getClaudeDir(): string {
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;

  if (pluginRoot) {
    return expandPath(pluginRoot);
  }

  const configDir = process.env.CLAUDE_CONFIG_DIR;

  if (configDir) {
    return expandPath(configDir);
  }

  return join(homedir(), ".claude");
}

/** Get the LifeOS data directory: LIFEOS_DIR when set, else <claude dir>/LIFEOS. */
export function getLifeosDir(): string {
  if (process.env.CLAUDE_PLUGIN_ROOT) {
    return join(getClaudeDir(), "LIFEOS");
  }

  const envLifeosDir = process.env.LIFEOS_DIR;

  if (envLifeosDir) {
    return expandPath(envLifeosDir);
  }

  return join(getClaudeDir(), "LIFEOS");
}
