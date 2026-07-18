/**
 * lifeos-root — the single source of truth for "where does LifeOS live" at runtime.
 *
 * Every LifeOS runtime tool/module MUST resolve the Claude home and the LIFEOS
 * data dir through this module instead of hardcoding `join(homedir(), ".claude")`.
 * That inline pattern silently breaks a custom LifeOS home (LIFEOS_HOME install,
 * e.g. a project-scoped `~/Project/.claude`): the tool reads/writes `~/.claude`
 * while the install lives elsewhere.
 *
 * Resolution order (claudeDir):
 *   1. CLAUDE_PLUGIN_ROOT   — packed-plugin install; the flattened root plays the
 *                             `~/.claude` role. Must win: bin/pai exports LIFEOS_DIR
 *                             == CLAUDE_PLUGIN_ROOT, where dirname() would escape it.
 *   2. LIFEOS_DIR           — set in settings.json env + service plists for every
 *                             harness-spawned context; `<configRoot>/LIFEOS`, so the
 *                             config root is its parent. This is the normal path.
 *   3. self-location        — belt-and-suspenders for a bare `bun Tool.ts` with no
 *                             env: walk up from this module to the config root (the
 *                             ancestor that contains a `LIFEOS/` child). This module
 *                             ships to `<configRoot>/LIFEOS/TOOLS/`, so the walk finds
 *                             the real custom root even without LIFEOS_DIR.
 *   4. ~/.claude            — plain-install default; byte-identical to the old
 *                             hardcoded behavior.
 *
 * Mirrors hooks/lib/paths.ts (the hooks-tree resolver) — kept self-contained rather
 * than cross-importing so it survives the plugin packer's tree flattening.
 */
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Expand a leading $HOME / ${HOME} / ~ in a path string. */
export function expandPath(path: string): string {
  const home = homedir();
  return path
    .replace(/^\$HOME(?=\/|$)/, home)
    .replace(/^\$\{HOME\}(?=\/|$)/, home)
    .replace(/^~(?=\/|$)/, home);
}

/**
 * Walk up from this module's own location to the config root — the ancestor
 * directory that has a `LIFEOS/` child (installed tree: `<configRoot>/LIFEOS`;
 * dev/payload tree: `install/LIFEOS`). Returns null if nothing matches (e.g. a
 * standalone-packed skill without the LIFEOS tree beside it) so the caller can
 * fall through to the default. Never throws.
 */
function selfConfigRoot(): string | null {
  try {
    let dir = dirname(fileURLToPath(import.meta.url)); // <configRoot>/LIFEOS/TOOLS
    for (let i = 0; i < 8; i++) {
      if (existsSync(join(dir, "LIFEOS"))) return dir;
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
    /* fileURLToPath / fs can fail in exotic runtimes — fall through */
  }
  return null;
}

/** The Claude Code home directory (holds settings.json, skills/, hooks/, .env, LIFEOS/). */
export function claudeDir(): string {
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
  if (pluginRoot) return expandPath(pluginRoot);

  const envLifeosDir = process.env.LIFEOS_DIR;
  if (envLifeosDir) return dirname(expandPath(envLifeosDir));

  return selfConfigRoot() ?? join(homedir(), ".claude");
}

/** The LifeOS data directory (`<claudeDir>/LIFEOS`: MEMORY, ALGORITHM, TOOLS, PULSE, USER). */
export function lifeosDir(): string {
  if (process.env.CLAUDE_PLUGIN_ROOT) return join(claudeDir(), "LIFEOS");

  const envLifeosDir = process.env.LIFEOS_DIR;
  if (envLifeosDir) return expandPath(envLifeosDir);

  return join(claudeDir(), "LIFEOS");
}

/** A path under the Claude home. */
export function claudePath(...segments: string[]): string {
  return join(claudeDir(), ...segments);
}

/** A path under the LIFEOS data dir. */
export function lifeosPath(...segments: string[]): string {
  return join(lifeosDir(), ...segments);
}

/** settings.json (in the Claude home). */
export function settingsPath(): string {
  return join(claudeDir(), "settings.json");
}

/** The authoritative .env (in the Claude home). */
export function envPath(): string {
  return join(claudeDir(), ".env");
}
