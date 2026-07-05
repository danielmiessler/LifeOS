#!/usr/bin/env bun
/**
 * LifeosConfig.ts — typed user-config loader.
 *
 * The INTERFACE between SYSTEM code (this file ships in every LifeOS release) and
 * USER data (the actual values, sourced from LIFEOS/USER/CONFIG/LIFEOS_CONFIG.toml).
 *
 * Doctrine: system code reads identity, voice IDs, integration credentials,
 * and path roots through `loadLifeosConfig()`. No system file directly opens
 * any file under LIFEOS/USER/ for these values — the path-rooting happens here.
 *
 * Format decision (ISC-56.1): TOML.
 *   - Zero new dependencies (Bun 1.3+ native TOML via require()).
 *   - Human-editable with sections, comments, multi-line strings.
 *   - PULSE.user.toml already in user-config dir as precedent.
 *
 * See: LIFEOS/DOCUMENTATION/SystemUserBoundary.md § "The four allowed access patterns".
 */

import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { getClaudeDir } from "./Paths";

// Expand leading `~` (and `~/`) to the user's home directory. node:fs APIs do
// not expand tildes, so any path returned from this loader must be absolute.
function expandHome(p: string): string {
  if (!p) return p;
  if (p === "~") return DEFAULT_HOME;
  if (p.startsWith("~/")) return resolve(DEFAULT_HOME, p.slice(2));
  return p;
}

// ─────────── Types ───────────

export interface LifeosPrincipal {
  name: string;
  pronunciation?: string;
  timezone: string;
  hometown?: string;
  voiceCloneId?: string;
}

export interface LifeosVoiceSettings {
  voiceId: string;
  voiceName?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  speed?: number;
  useSpeakerBoost?: boolean;
  volume?: number;
}

export interface LifeosDa {
  name: string;
  fullName?: string;
  displayName?: string;
  color?: string;
  voices: {
    main: LifeosVoiceSettings;
    algorithm?: LifeosVoiceSettings;
  };
}

export interface LifeosIntegrations {
  google?: { credentialsFile?: string };
  cloudflare?: { accountId?: string; tokenEnvVar?: string };
  telegram?: { allowlist?: number[] };
  [key: string]: unknown;
}

export interface LifeosPaths {
  userDir: string;
  memoryDir: string;
  projectsDir: string;
}

export interface LifeosConfig {
  principal: LifeosPrincipal;
  da: LifeosDa;
  integrations: LifeosIntegrations;
  paths: LifeosPaths;
}

// ─────────── Resolution ───────────

const DEFAULT_HOME = process.env.HOME || homedir();
const DEFAULT_CONFIG_PATH = resolve(getClaudeDir(), "LIFEOS/USER/CONFIG/LIFEOS_CONFIG.toml");

let cache: { config: LifeosConfig; mtime: number; path: string } | null = null;

export function loadLifeosConfig(opts: { path?: string; force?: boolean } = {}): LifeosConfig {
  const path = opts.path ?? process.env.LIFEOS_CONFIG_PATH ?? DEFAULT_CONFIG_PATH;

  if (!existsSync(path)) {
    throw new Error(
      `LifeosConfig: config file not found at ${path}. ` +
        `Create it (see LIFEOS/USER/CONFIG/README.md) or set LIFEOS_CONFIG_PATH.`,
    );
  }

  const mtime = statSync(path).mtimeMs;
  if (!opts.force && cache && cache.path === path && cache.mtime === mtime) {
    return cache.config;
  }

  // Invalidate Bun's require cache so re-reads pick up mtime changes.
  try {
    const resolved = require.resolve(path);
    delete require.cache[resolved];
  } catch {
    // require.resolve can throw on first read; safe to ignore.
  }

  // Bun 1.3+ parses TOML via require() at any path ending in .toml.
  const raw = require(path) as unknown;
  const validated = validateAndNormalize(raw, path);
  cache = { config: validated, mtime, path };
  return validated;
}

export function clearLifeosConfigCache(): void {
  cache = null;
}

/**
 * Convenience helper for the most common consumer pattern: "give me the user
 * directory, fall back to the conventional location on fresh installs."
 * Used by Banner tools, HealthSnapshot, hooks/lib/identity, and any other
 * system module that needs to compose paths under the user zone.
 */
export function paiUserDir(): string {
  try {
    return loadLifeosConfig().paths.userDir;
  } catch {
    return resolve(getClaudeDir(), "LIFEOS/USER");
  }
}

// ─────────── Validation ───────────

function validateAndNormalize(raw: unknown, path: string): LifeosConfig {
  if (!raw || typeof raw !== "object") {
    throw new Error(`LifeosConfig: ${path} did not parse to an object`);
  }
  const root = raw as Record<string, any>;

  const principal = root.principal ?? {};
  if (typeof principal.name !== "string" || !principal.name) {
    throw new Error(`LifeosConfig: [principal] requires a non-empty name — see ${path}`);
  }
  if (typeof principal.timezone !== "string" || !principal.timezone) {
    throw new Error(`LifeosConfig: [principal] requires a non-empty timezone — see ${path}`);
  }

  const da = root.da ?? {};
  if (typeof da.name !== "string" || !da.name) {
    throw new Error(`LifeosConfig: [da] requires a non-empty name — see ${path}`);
  }
  const daVoices = da.voices ?? {};
  if (!daVoices.main || typeof (daVoices.main.voice_id ?? daVoices.main.voiceId) !== "string") {
    throw new Error(`LifeosConfig: [da.voices.main] requires a voice_id — see ${path}`);
  }

  return {
    principal: {
      name: principal.name,
      pronunciation: principal.pronunciation,
      timezone: principal.timezone,
      hometown: principal.hometown,
      voiceCloneId: principal.voice_clone_id ?? principal.voiceCloneId,
    },
    da: {
      name: da.name,
      fullName: da.full_name ?? da.fullName,
      displayName: da.display_name ?? da.displayName,
      color: da.color,
      voices: {
        main: normalizeVoice(daVoices.main),
        algorithm: daVoices.algorithm ? normalizeVoice(daVoices.algorithm) : undefined,
      },
    },
    integrations: {
      google: root.integrations?.google,
      cloudflare: root.integrations?.cloudflare,
      telegram: root.integrations?.telegram,
      ...root.integrations,
    },
    paths: {
      userDir: expandHome(
        root.paths?.userDir ?? root.paths?.user_dir ?? resolve(getClaudeDir(), "LIFEOS/USER"),
      ),
      memoryDir: expandHome(
        root.paths?.memoryDir ?? root.paths?.memory_dir ?? resolve(getClaudeDir(), "LIFEOS/MEMORY"),
      ),
      projectsDir: expandHome(
        root.paths?.projectsDir ?? root.paths?.projects_dir ?? resolve(DEFAULT_HOME, "Projects"),
      ),
    },
  };
}

function normalizeVoice(v: any): LifeosVoiceSettings {
  return {
    voiceId: v.voice_id ?? v.voiceId,
    voiceName: v.voice_name ?? v.voiceName,
    stability: v.stability,
    similarityBoost: v.similarity_boost ?? v.similarityBoost,
    style: v.style,
    speed: v.speed,
    useSpeakerBoost: v.use_speaker_boost ?? v.useSpeakerBoost,
    volume: v.volume,
  };
}

// ─────────── CLI entry ───────────

if (import.meta.main) {
  try {
    const cfg = loadLifeosConfig();
    console.log(JSON.stringify(cfg, null, 2));
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}
