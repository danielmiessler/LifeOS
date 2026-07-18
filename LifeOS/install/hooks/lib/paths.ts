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

import { existsSync } from 'fs';
import { homedir } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

/**
 * Walk up from this module's own location to the config root — the ancestor dir
 * that has a `LIFEOS/` child (this file ships to `<configRoot>/hooks/lib/paths.ts`).
 * Belt-and-suspenders for a hook/tool spawned WITHOUT `LIFEOS_DIR` in its env: without
 * this, getClaudeDir() falls back to ~/.claude and a custom-home install leaks hook
 * state (MEMORY/STATE/...) into the real ~/.claude. Returns null if nothing matches.
 * Never throws.
 */
function selfConfigRoot(): string | null {
  try {
    let dir = dirname(fileURLToPath(import.meta.url)); // <configRoot>/hooks/lib
    for (let i = 0; i < 8; i++) {
      if (existsSync(join(dir, 'LIFEOS'))) return dir;
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
    /* fileURLToPath / fs can fail in exotic runtimes — fall through */
  }
  return null;
}

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
 *   3. ~/.claude/LIFEOS  (live default — byte-identical to pre-plugin behavior)
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

  const self = selfConfigRoot();
  if (self) return join(self, 'LIFEOS');

  return join(homedir(), '.claude', 'LIFEOS');
}

/**
 * Get the Claude Code home directory.
 *
 * Plugin install: CLAUDE_PLUGIN_ROOT is the flattened plugin root that plays the
 * live ~/.claude role (skills/ and hooks/ sit directly under it, matching live
 * .claude/skills and .claude/hooks).
 *
 * Custom LifeOS home (LIFEOS_HOME install): LIFEOS_DIR is `<configRoot>/LIFEOS`,
 * so the config root is its parent — deriving it here keeps every consumer
 * (settings, skills, hooks, .env) inside the custom home instead of silently
 * falling back to ~/.claude. Must stay BELOW the plugin guard: bin/pai exports
 * LIFEOS_DIR equal to CLAUDE_PLUGIN_ROOT, where dirname() would escape the root.
 *
 * Live default: ~/.claude — byte-identical to pre-plugin behavior, since
 * CLAUDE_PLUGIN_ROOT and LIFEOS_DIR are unset on a plain install and LIFEOS_DIR
 * is ~/.claude/LIFEOS (same parent) on a default one.
 */
export function getClaudeDir(): string {
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;

  if (pluginRoot) {
    return expandPath(pluginRoot);
  }

  const envLifeosDir = process.env.LIFEOS_DIR;

  if (envLifeosDir) {
    return dirname(expandPath(envLifeosDir));
  }

  const self = selfConfigRoot();
  if (self) return self;

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
