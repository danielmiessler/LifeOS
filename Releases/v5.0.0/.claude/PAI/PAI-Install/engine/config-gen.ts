/**
 * PAI Installer v5.0 — Configuration Generator
 * Generates a FALLBACK settings.json from collected user data.
 * Only used when no existing settings.json exists.
 * Produces minimal output — just fields the installer collects.
 * Hooks, permissions, and other config come from the release template.
 */

import type { PAIConfig } from "./types";
import { PAI_VERSION, ALGORITHM_VERSION } from "./types";

/**
 * Generate a minimal fallback settings.json from installer-collected data.
 * This is merged into (not replacing) the release template.
 */
export function generateSettingsJson(config: PAIConfig): Record<string, any> {
  return {
    env: {
      // PAI_DIR is the PAI subsystem directory (~/.claude/PAI) — where Memory,
      // Algorithm, USER, TOOLS, PULSE live. NOT the install root (~/.claude).
      // statusline-command.sh, hooks, and tools read PAI_DIR expecting the /PAI
      // suffix; if we write just `~/.claude` here the statusline can't find
      // ALGORITHM/LATEST and falls back to "—". The variable name `config.paiDir`
      // is misleading — it's actually the INSTALL ROOT.
      PAI_DIR: `${config.paiDir}/PAI`,
      ...(config.projectsDir ? { PROJECTS_DIR: config.projectsDir } : {}),
      PAI_CONFIG_DIR: config.configDir,
    },

    // Empty by design: the v5 release template ships the canonical contextFiles
    // (loaded via CLAUDE.md @-imports). The old `skills/PAI/*` layout does not
    // exist in v5, so listing it here would point Claude Code at nothing.
    contextFiles: [],

    daidentity: {
      name: config.aiName,
      fullName: `${config.aiName} — Personal AI`,
      displayName: config.aiName.toUpperCase(),
      color: "#3B82F6",
      startupCatchphrase: config.catchphrase,
    },

    principal: {
      name: config.principalName,
      timezone: config.timezone,
    },

    preferences: {
      temperatureUnit: config.temperatureUnit || "fahrenheit",
    },

    pai: {
      repoUrl: "https://github.com/danielmiessler/PAI",
      version: PAI_VERSION,
      algorithmVersion: ALGORITHM_VERSION,
    },
  };
}
