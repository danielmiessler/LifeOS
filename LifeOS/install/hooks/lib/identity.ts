/**
 * @version 1.7.22
 * Central Identity Loader — the one module hooks and tools import for DA
 * (Digital Assistant) and Principal identity.
 *
 * Read order (what the code below actually does): LIFEOS_CONFIG.toml FIRST for
 * every field it carries, then the legacy chain for everything else and for
 * installs with no config yet:
 *   - settings.json daidentity/principal runtime mirror
 *   - LIFEOS/USER/DIGITAL_ASSISTANT/DA_IDENTITY.md frontmatter
 *   - LIFEOS/USER/PRINCIPAL/PRINCIPAL_IDENTITY.md frontmatter
 *
 * The CANONICAL config source is LIFEOS/USER/CONFIG/LIFEOS_CONFIG.toml (read
 * via LIFEOS/TOOLS/LifeosConfig.ts); the settings.json mirror exists so hooks
 * resolve identity without parsing markdown on every event.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';
import {
  loadLifeosConfig,
  type LifeosDa,
  type LifeosPrincipal,
} from '../../LIFEOS/TOOLS/LifeosConfig';
import { homedir } from "node:os";
import { getClaudeDir, lifeosPath } from "./paths"; // public issue #1974 @sabo961, PR #1918 @PigLardLord

// HOME ?? USERPROFILE: Windows defines only the latter (public issue #1694, @dissembler21-png)
const HOME = process.env.HOME ?? process.env.USERPROFILE ?? homedir();
const SETTINGS_PATH = join(getClaudeDir(), 'settings.json');

// Identity-file paths derive from LifeosConfig's userDir. On fresh installs where
// LIFEOS_CONFIG.toml hasn't been created yet, fall back to the conventional
// LIFEOS/USER/ location so identity loading still bootstraps. Lazy try/catch so
// a malformed LifeosConfig never breaks identity bootstrap.
function lifeosUserDir(): string {
  try {
    return loadLifeosConfig().paths.userDir;
  } catch {
    return lifeosPath('USER');
  }
}
const DA_IDENTITY_PATH = join(lifeosUserDir(), 'DIGITAL_ASSISTANT/DA_IDENTITY.md');
const PRINCIPAL_IDENTITY_PATH = join(lifeosUserDir(), 'PRINCIPAL/PRINCIPAL_IDENTITY.md');

const DEFAULT_IDENTITY = {
  name: 'LifeOS',
  fullName: 'Personal AI',
  displayName: 'LifeOS',
  mainDAVoiceID: '',
  color: '#3B82F6',
};

const DEFAULT_PRINCIPAL = {
  name: 'User',
  pronunciation: '',
  timezone: 'UTC',
};

/**
 * The identity values the shipped scaffold config carries verbatim
 * (the shipped USER configuration template). They are
 * non-empty, so an emptiness-only guard treats them as a real answer and a
 * never-interviewed install resolves to a DA named "Aria" addressing a
 * principal named "Your Name" — with nothing failing.
 *
 * Anything in this set means "the principal has not answered yet": callers
 * treat it as absent and fall through to the legacy chain / defaults.
 *
 * public issue #1885, @MatiasBarboza
 */
export const SCAFFOLD_SENTINELS: ReadonlySet<string> = new Set([
  'Your Name',              // [principal] name
  'Aria',                   // [da] name
  '21m00Tcm4TlvDq8ikWAM',   // [da.voices.main] voice_id (the shipped scaffold's placeholder)
]);

/** True when a config value is still the shipped scaffold placeholder. */
export function isScaffoldSentinel(value: string | null | undefined): boolean {
  return typeof value === 'string' && SCAFFOLD_SENTINELS.has(value.trim());
}

export interface VoiceProsody {
  volume?: number;
}

export interface VoicePersonality {
  baseVoice: string;
  enthusiasm: number;
  energy: number;
  expressiveness: number;
  resilience: number;
  composure: number;
  optimism: number;
  warmth: number;
  formality: number;
  directness: number;
  precision: number;
  curiosity: number;
  playfulness: number;
}

export interface Identity {
  name: string;
  fullName: string;
  displayName: string;
  mainDAVoiceID: string;
  color: string;
  voice?: VoiceProsody;
  personality?: VoicePersonality;
}

export interface Principal {
  name: string;
  pronunciation: string;
  timezone: string;
}

export interface Settings {
  daidentity?: Partial<Identity>;
  principal?: Partial<Principal>;
  env?: Record<string, string>;
  [key: string]: unknown;
}

let cachedSettings: Settings | null = null;
let cachedDaFm: Record<string, any> | null = null;
let cachedPrincipalFm: Record<string, any> | null = null;

function loadFrontmatter(path: string): Record<string, any> | null {
  try {
    if (!existsSync(path)) return null;
    const content = readFileSync(path, 'utf-8');
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return null;
    return parseYaml(match[1]) || null;
  } catch {
    return null;
  }
}

function loadDaFrontmatter(): Record<string, any> {
  if (cachedDaFm) return cachedDaFm;
  cachedDaFm = loadFrontmatter(DA_IDENTITY_PATH) ?? {};
  return cachedDaFm;
}

function loadPrincipalFrontmatter(): Record<string, any> {
  if (cachedPrincipalFm) return cachedPrincipalFm;
  cachedPrincipalFm = loadFrontmatter(PRINCIPAL_IDENTITY_PATH) ?? {};
  return cachedPrincipalFm;
}

function loadSettings(): Settings {
  if (cachedSettings) return cachedSettings;
  try {
    if (!existsSync(SETTINGS_PATH)) {
      cachedSettings = {};
      return cachedSettings;
    }
    const content = readFileSync(SETTINGS_PATH, 'utf-8');
    cachedSettings = JSON.parse(content);
    return cachedSettings!;
  } catch {
    cachedSettings = {};
    return cachedSettings;
  }
}

function mapFrontmatterVoice(v: any): VoiceProsody | undefined {
  if (!v) return undefined;
  return { volume: v.volume };
}

function mapFrontmatterPersonality(traits: any, baseVoice: string | undefined): VoicePersonality | undefined {
  if (!traits) return undefined;
  return {
    baseVoice: baseVoice ?? '',
    enthusiasm: traits.enthusiasm ?? 0,
    energy: traits.energy ?? 0,
    expressiveness: traits.expressiveness ?? 0,
    resilience: traits.resilience ?? 0,
    composure: traits.composure ?? 0,
    optimism: traits.optimism ?? 0,
    warmth: traits.warmth ?? 0,
    formality: traits.formality ?? 0,
    directness: traits.directness ?? 0,
    precision: traits.precision ?? 0,
    curiosity: traits.curiosity ?? 0,
    playfulness: traits.playfulness ?? 0,
  };
}

/**
 * Get DA (Digital Assistant) identity.
 *
 * LIFEOS_CONFIG.toml `[da]` wins for every field it carries. It is the typed
 * loader, it is where setup tells the principal to name their DA, and
 * LifeosConfig itself refuses to load without a non-empty `[da].name` — so it
 * is the one source guaranteed to be both present and current.
 *
 * The settings.daidentity → DA_IDENTITY.md frontmatter → DEFAULT_IDENTITY chain
 * below stays the fallback: it covers the fields config does not carry
 * (personality traits, base voice), and an install that has no config yet
 * resolves exactly as it did before.
 *
 * public PR #1781, @anikinsasha
 */
export function getIdentity(): Identity {
  const base = legacyIdentity();

  let da: LifeosDa | undefined;
  try {
    da = loadLifeosConfig().da;
  } catch {
    return base; // no config yet (fresh install) — legacy chain governs
  }
  // Empty AND still-scaffold both mean unanswered (public issue #1885, @MatiasBarboza).
  if (!da?.name || isScaffoldSentinel(da.name)) return base;

  // The voice block is judged separately: a renamed DA can still be carrying the
  // scaffold's public default voice_id, which is not this DA's voice.
  const configured = da.voices?.main;
  const main = configured && !isScaffoldSentinel(configured.voiceId) ? configured : undefined;
  return {
    ...base,
    name: da.name,
    fullName: da.fullName || da.name,
    displayName: da.displayName || da.name,
    color: da.color || base.color,
    mainDAVoiceID: main?.voiceId || base.mainDAVoiceID,
    voice: main ? { volume: main.volume } : base.voice,
  };
}

/**
 * The pre-config resolution chain: settings.daidentity (runtime read point),
 * then DA_IDENTITY.md frontmatter (authoring source), then the placeholder.
 */
function legacyIdentity(): Identity {
  const settings = loadSettings();
  const daidentity = (settings.daidentity || {}) as any;
  const voices = daidentity.voices || {};
  const voiceConfig = voices.main || daidentity.voice;
  const mainVoiceId = voiceConfig?.voiceId || daidentity.voiceId || daidentity.mainDAVoiceID;

  if (daidentity.name || mainVoiceId) {
    const envDA = settings.env?.DA;
    return {
      name: daidentity.name || envDA || DEFAULT_IDENTITY.name,
      fullName: daidentity.fullName || daidentity.name || envDA || DEFAULT_IDENTITY.fullName,
      displayName: daidentity.displayName || daidentity.name || envDA || DEFAULT_IDENTITY.displayName,
      mainDAVoiceID: mainVoiceId || DEFAULT_IDENTITY.mainDAVoiceID,
      color: daidentity.color || DEFAULT_IDENTITY.color,
      voice: voiceConfig as VoiceProsody | undefined,
      personality: daidentity.personality as VoicePersonality | undefined,
    };
  }

  // Fallback: DA_IDENTITY.md frontmatter (authoring source)
  const fm = loadDaFrontmatter();
  const core = fm.core ?? {};
  const voice = fm.voice ?? {};
  const mainVoice = voice.main ?? {};
  return {
    name: core.name || DEFAULT_IDENTITY.name,
    fullName: core.full_name || core.name || DEFAULT_IDENTITY.fullName,
    displayName: core.display_name || core.name || DEFAULT_IDENTITY.displayName,
    mainDAVoiceID: mainVoice.voice_id || DEFAULT_IDENTITY.mainDAVoiceID,
    color: core.color || DEFAULT_IDENTITY.color,
    voice: mapFrontmatterVoice(mainVoice),
    personality: mapFrontmatterPersonality(fm.personality?.traits, voice.base_voice),
  };
}

/**
 * Get Principal (human owner) identity.
 *
 * Same contract as getIdentity(): LIFEOS_CONFIG.toml `[principal]` wins, and
 * LifeosConfig requires a non-empty name and timezone there. The
 * PRINCIPAL_IDENTITY.md frontmatter → settings.principal chain is the fallback.
 *
 * public PR #1781, @anikinsasha
 */
export function getPrincipal(): Principal {
  const base = legacyPrincipal();

  let p: LifeosPrincipal | undefined;
  try {
    p = loadLifeosConfig().principal;
  } catch {
    return base; // no config yet (fresh install) — legacy chain governs
  }
  // Same contract as getIdentity(): the scaffold's "Your Name" is not a name
  // the principal gave us (public issue #1885, @MatiasBarboza).
  if (!p?.name || isScaffoldSentinel(p.name)) return base;

  return {
    name: p.name,
    pronunciation: p.pronunciation || base.pronunciation,
    timezone: p.timezone || base.timezone,
  };
}

/** The pre-config chain: PRINCIPAL_IDENTITY.md frontmatter, then settings. */
function legacyPrincipal(): Principal {
  const fm = loadPrincipalFrontmatter();
  const core = fm.core ?? {};

  if (core.name) {
    return {
      name: core.name,
      pronunciation: core.pronunciation || DEFAULT_PRINCIPAL.pronunciation,
      timezone: core.timezone || DEFAULT_PRINCIPAL.timezone,
    };
  }

  // Fallback
  const settings = loadSettings();
  const principal = settings.principal || {};
  const envPrincipal = settings.env?.PRINCIPAL;
  return {
    name: principal.name || envPrincipal || DEFAULT_PRINCIPAL.name,
    pronunciation: principal.pronunciation || DEFAULT_PRINCIPAL.pronunciation,
    timezone: principal.timezone || DEFAULT_PRINCIPAL.timezone,
  };
}

/**
 * Clear cache (useful for testing or when source files change)
 */
export function clearCache(): void {
  cachedSettings = null;
  cachedDaFm = null;
  cachedPrincipalFm = null;
}

export function getDAName(): string {
  return getIdentity().name;
}

/** The default closer emoji: the 🗣️ line every LifeOS response ends with. */
export const DEFAULT_CLOSER = '🗣️';

/**
 * The closer emoji for this DA: LIFEOS_CONFIG.toml `[da] closer`, else 🗣️.
 * Lets each DA carry its own mark (an owl for an assistant named Wise).
 */
export function getCloserEmoji(): string {
  try {
    const c = loadLifeosConfig().da?.closer?.trim();
    if (c) return c;
  } catch {
    // no config yet (fresh install): the default governs
  }
  return DEFAULT_CLOSER;
}

/**
 * Regex source that matches the closer mark: the configured emoji OR the
 * default 🗣️, so transcripts written before a change, and quoted content,
 * still parse. A non-capturing group; embed it with `new RegExp(...)`.
 */
export function closerPattern(): string {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const marks = [...new Set([getCloserEmoji(), DEFAULT_CLOSER])];
  return `(?:${marks.map(esc).join('|')})`;
}

/**
 * Startup catchphrase. Reads settings.daidentity.startupCatchphrase first (canonical),
 * falls back to DA_IDENTITY.md frontmatter core.startup_catchphrase (authoring source).
 * Substitutes `{name}` with the DA name.
 */
export function getStartupCatchphrase(): string {
  const settings = loadSettings();
  const fromSettings = (settings.daidentity as any)?.startupCatchphrase as string | undefined;
  const fm = loadDaFrontmatter();
  const fromFm = fm.core?.startup_catchphrase as string | undefined;
  const name = getDAName();
  const template = (fromSettings && fromSettings.trim()) || (fromFm && fromFm.trim()) || '{name} here, ready to go.';
  return template.replace(/\{name\}/gi, name);
}

export function getPrincipalName(): string {
  return getPrincipal().name;
}

export function getVoiceId(): string {
  return getIdentity().mainDAVoiceID;
}

export function getSettings(): Settings {
  return loadSettings();
}

export function getDefaultIdentity(): Identity {
  return { ...DEFAULT_IDENTITY };
}

export function getDefaultPrincipal(): Principal {
  return { ...DEFAULT_PRINCIPAL };
}

export function getVoiceProsody(): VoiceProsody | undefined {
  return getIdentity().voice;
}

export function getVoicePersonality(): VoicePersonality | undefined {
  return getIdentity().personality;
}

/**
 * Read principal preferences (e.g. temperature_unit) from frontmatter.
 */
export function getPrincipalPreferences(): Record<string, any> {
  return loadPrincipalFrontmatter().preferences ?? {};
}

/**
 * Read principal tech_stack from frontmatter.
 */
export function getTechStack(): Record<string, any> {
  return loadPrincipalFrontmatter().tech_stack ?? {};
}
