#!/usr/bin/env bun
/**
 * @version 1.3.18
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
import { join, resolve } from "node:path";
import { getLifeosDir } from "./Paths";   // the one resolver for install roots (public issue #1665, @rogdex24)
import { homedir } from "node:os";
import { invariant } from "./Invariant";

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
  // ISO 4217 code (e.g. "JPY", "EUR"). Optional — consumers (currently just
  // Pulse's Finances tab) default to "USD" when unset, so existing TOML files
  // need no edit.
  // ported from public PR #1777, @takanorinishida
  currency?: string;
  /** [principal.voice]: the one synthesis profile for the principal's voice clone. The voice id lives in env, never here. */
  voice?: LifeosPrincipalVoice;
}

/** Every field is required once the table exists: a partial profile is exactly the per-tool drift it replaces. */
export interface LifeosPrincipalVoice {
  modelId: string;
  stability: number;
  similarityBoost: number;
  style: number;
  useSpeakerBoost: boolean;
  /** ElevenLabs `seed`: an integer in [0, 4294967295] for best-effort deterministic sampling. */
  seed: number;
  /** Candidate takes per clone read (`takes`, default 3): each on its own seed, the steadiest kept. An integer in [1, 10]. */
  takes: number;
}

export interface LifeosVoiceSettings {
  /** The profile's key (`voice_id`): callers pass it to pick this voice, and Fish resolvers match on it. It is never sent to a vendor. Optional: a profile may carry only `fish_reference_id`. */
  voiceId?: string;
  voiceName?: string;
  volume?: number;
  /** Fish Audio voice model id (`fish_reference_id`). The voice server speaks this profile on Fish Drama 3; a profile without one is silent. */
  fishReferenceId?: string;
  /** Fish prosody speed multiplier (`fish_speed`, 0.5–2.0); unset means 1.0. */
  fishSpeed?: number;
}

export interface LifeosDa {
  name: string;
  fullName?: string;
  displayName?: string;
  color?: string;
  /** Emoji that opens the DA's closing line. Unset: 🗣️ (see getCloserEmoji). */
  closer?: string;
  /** Every [da.voices.*] section, normalized. `main` is required; other profiles (presenter, …) are optional. */
  voices: { main: LifeosVoiceSettings } & Record<string, LifeosVoiceSettings | undefined>;
}

export interface LifeosIntegrations {
  google?: { credentialsFile?: string };
  cloudflare?: { accountId?: string; tokenEnvVar?: string };
  [key: string]: unknown;
}

export interface LifeosPaths {
  userDir: string;
  // memoryDir was removed 2026-07-18 (public issue #1526, @christauff): declared
  // since inception but never consumed — the memory root is derived by
  // hooks/lib/paths.ts getMemoryDir(), and a dead config knob that LOOKS live
  // is worse than no knob.
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
const DEFAULT_CONFIG_PATH = resolve(DEFAULT_HOME, ".claude/LIFEOS/USER/CONFIG/LIFEOS_CONFIG.toml");

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
 * Used by Banner tools, hooks/lib/identity, and any other
 * system module that needs to compose paths under the user zone.
 */
export function lifeosUserDir(): string {
  try {
    return loadLifeosConfig().paths.userDir;
  } catch {
    return resolve(DEFAULT_HOME, ".claude/LIFEOS/USER");
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
  // Fish is the only voice engine. The main voice needs its profile key (voice_id) or its Fish clone (fish_reference_id).
  const mainVoice = daVoices.main;
  const hasId = (v: unknown) => typeof v === "string" && v.length > 0;
  if (!mainVoice || typeof mainVoice !== "object" ||
      !(typeof (mainVoice.voice_id ?? mainVoice.voiceId) === "string" || hasId(mainVoice.fish_reference_id ?? mainVoice.fishReferenceId))) {
    throw new Error(`LifeosConfig: [da.voices.main] requires a fish_reference_id (Fish Audio) or a voice_id (the profile key) — see ${path}`);
  }

  return {
    principal: {
      name: principal.name,
      pronunciation: principal.pronunciation,
      timezone: principal.timezone,
      hometown: principal.hometown,
      voiceCloneId: principal.voice_clone_id ?? principal.voiceCloneId,
      currency: principal.currency,
      voice: principal.voice === undefined ? undefined : normalizePrincipalVoice(principal.voice, path),
    },
    da: {
      name: da.name,
      fullName: da.full_name ?? da.fullName,
      displayName: da.display_name ?? da.displayName,
      color: da.color,
      closer: da.closer,
      voices: {
        ...Object.fromEntries(
          Object.entries(daVoices)
            .filter(([, v]) => v && typeof v === "object")
            .map(([k, v]) => [k, normalizeVoice(v)]),
        ),
        main: normalizeVoice(daVoices.main),
      },
    },
    integrations: {
      ...root.integrations,
      // Normalize snake_case TOML keys like the principal/da fields above. The
      // spread stays FIRST — spreading after would clobber the normalized shape
      // with the raw TOML object (credentials_file vs credentialsFile).
      google: root.integrations?.google
        ? {
            ...root.integrations.google,
            credentialsFile:
              root.integrations.google.credentials_file ?? root.integrations.google.credentialsFile,
          }
        : undefined,
      cloudflare: root.integrations?.cloudflare,
    },
    paths: {
      // public issue #1665, @rogdex24: respect CLAUDE_CONFIG_DIR and LIFEOS_SKILLS_DIR overrides
      // before falling back to TOML values or hardcoded defaults. This allows project-scoped installs
      // to keep their data isolated from the global ~/.claude tree.
      //
      // The derivation itself lives in ONE place: Paths.ts getLifeosDir(), which
      // already orders CLAUDE_CONFIG_DIR above LIFEOS_SKILLS_DIR above LIFEOS_DIR
      // and returns <configRoot>/LIFEOS. Re-deriving it here disagreed with that
      // resolver on both counts — it read LIFEOS_SKILLS_DIR as the USER parent
      // (<skills>/USER instead of <configRoot>/LIFEOS/USER) and preferred it over
      // CLAUDE_CONFIG_DIR — so the two halves of an isolated install pointed at
      // different USER trees.
      userDir: expandHome(
        process.env.CLAUDE_CONFIG_DIR || process.env.LIFEOS_SKILLS_DIR
          ? join(getLifeosDir(), "USER")
          : root.paths?.userDir ?? root.paths?.user_dir ?? resolve(DEFAULT_HOME, ".claude/LIFEOS/USER"),
      ),
      projectsDir: expandHome(
        root.paths?.projectsDir ?? root.paths?.projects_dir ?? resolve(DEFAULT_HOME, "Projects"),
      ),
    },
  };
}

export const PRINCIPAL_VOICE_DEFAULT_TAKES = 3;
/** Ten takes of a 10,000-character post is 100,000 characters; anything past that is a typo, not a choice. */
export const PRINCIPAL_VOICE_MAX_TAKES = 10;

/** [principal.voice] → typed profile. Fails loud on a missing or out-of-range field; the voice id is refused outright. */
export function normalizePrincipalVoice(v: unknown, path: string): LifeosPrincipalVoice {
  invariant(v !== null && typeof v === "object" && !Array.isArray(v), `[principal.voice] must be a table — see ${path}`);
  const t = v as Record<string, unknown>;
  invariant(t.voice_id === undefined && t.voiceId === undefined, `[principal.voice] must not hold a voice_id; it lives in env as ELEVENLABS_PRINCIPAL_VOICE_ID — see ${path}`);
  const unit = (key: string, camel: string): number => {
    const n = t[key] ?? t[camel];
    invariant(typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1, `[principal.voice] ${key} must be a number in [0, 1] — see ${path}`);
    return n;
  };
  const modelId = t.model_id ?? t.modelId;
  invariant(typeof modelId === "string" && modelId.trim().length > 0, `[principal.voice] requires a model_id — see ${path}`);
  const useSpeakerBoost = t.use_speaker_boost ?? t.useSpeakerBoost;
  invariant(typeof useSpeakerBoost === "boolean", `[principal.voice] use_speaker_boost must be true or false — see ${path}`);
  const seed = t.seed;
  invariant(typeof seed === "number" && Number.isInteger(seed) && seed >= 0 && seed <= 4294967295, `[principal.voice] seed must be an integer in [0, 4294967295] — see ${path}`);
  // The one optional field: how many candidate takes to buy is a cost dial, not part of the voice, so absent means the default.
  const takes = t.takes ?? PRINCIPAL_VOICE_DEFAULT_TAKES;
  invariant(typeof takes === "number" && Number.isInteger(takes) && takes >= 1 && takes <= PRINCIPAL_VOICE_MAX_TAKES, `[principal.voice] takes must be an integer in [1, ${PRINCIPAL_VOICE_MAX_TAKES}] — see ${path}`);
  return { modelId, stability: unit("stability", "stability"), similarityBoost: unit("similarity_boost", "similarityBoost"), style: unit("style", "style"), useSpeakerBoost, seed, takes };
}

function normalizeVoice(v: any): LifeosVoiceSettings {
  return {
    voiceId: v.voice_id ?? v.voiceId,
    voiceName: v.voice_name ?? v.voiceName,
    volume: v.volume,
    fishReferenceId: v.fish_reference_id ?? v.fishReferenceId,
    fishSpeed: v.fish_speed ?? v.fishSpeed,
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
