/**
 * Central Identity Loader
 * Single source of truth for DA (Digital Assistant) and Principal identity
 *
 * Reads from frontmatter in:
 *   - LIFEOS/USER/DIGITAL_ASSISTANT/DA_IDENTITY.md (canonical DA identity)
 *   - LIFEOS/USER/PRINCIPAL/PRINCIPAL_IDENTITY.md  (canonical Principal identity)
 *
 * Falls back to settings.json daidentity/principal blocks for transition safety.
 * All hooks and tools should import from here.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';
import { loadLifeosConfig } from '../../LIFEOS/TOOLS/LifeosConfig';
import { getSettingsPath, paiPath } from './paths';

const SETTINGS_PATH = getSettingsPath();

// Identity-file paths derive from LifeosConfig's userDir. On fresh installs where
// LIFEOS_CONFIG.toml hasn't been created yet, fall back to the conventional
// LIFEOS/USER/ location so identity loading still bootstraps. Lazy try/catch so
// a malformed LifeosConfig never breaks identity bootstrap.
function paiUserDir(): string {
  try {
    return loadLifeosConfig().paths.userDir;
  } catch {
    return paiPath('USER');
  }
}
const DA_IDENTITY_PATH = join(paiUserDir(), 'DIGITAL_ASSISTANT/DA_IDENTITY.md');
const PRINCIPAL_IDENTITY_PATH = join(paiUserDir(), 'PRINCIPAL/PRINCIPAL_IDENTITY.md');

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

export interface VoiceProsody {
  stability: number;
  similarityBoost: number;
  style: number;
  speed: number;
  useSpeakerBoost: boolean;
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
  return {
    stability: v.stability ?? 0,
    similarityBoost: v.similarity_boost ?? v.similarityBoost ?? 0,
    style: v.style ?? 0,
    speed: v.speed ?? 1,
    useSpeakerBoost: v.use_speaker_boost ?? v.useSpeakerBoost ?? false,
    volume: v.volume,
  };
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
 * Reads settings.daidentity first (canonical runtime read point),
 * falls back to DA_IDENTITY.md frontmatter (authoring source).
 */
export function getIdentity(): Identity {
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
 * Reads frontmatter from PRINCIPAL_IDENTITY.md first, falls back to settings.principal.
 */
export function getPrincipal(): Principal {
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

/**
 * Algorithm voice — reads settings.daidentity.voices.algorithm first (canonical),
 * falls back to DA_IDENTITY.md frontmatter voice.algorithm (authoring source).
 */
export function getAlgorithmVoice(): { voiceId: string; voiceName: string; stability: number; similarityBoost: number; style: number; speed: number; useSpeakerBoost: boolean; volume?: number } | null {
  const settings = loadSettings();
  const settingsAlgo = (settings.daidentity as any)?.voices?.algorithm;
  if (settingsAlgo?.voiceId) {
    return {
      voiceId: settingsAlgo.voiceId,
      voiceName: settingsAlgo.voiceName || 'Algorithm Voice',
      stability: settingsAlgo.stability ?? 0.3,
      similarityBoost: settingsAlgo.similarityBoost ?? 0.75,
      style: settingsAlgo.style ?? 0.8,
      speed: settingsAlgo.speed ?? 1.2,
      useSpeakerBoost: settingsAlgo.useSpeakerBoost ?? true,
      volume: settingsAlgo.volume,
    };
  }

  // Fallback: DA_IDENTITY.md frontmatter (authoring source)
  const fm = loadDaFrontmatter();
  const algo = fm.voice?.algorithm;
  if (!algo?.voice_id) return null;
  return {
    voiceId: algo.voice_id,
    voiceName: algo.voice_name || 'Algorithm Voice',
    stability: algo.stability ?? 0.3,
    similarityBoost: algo.similarity_boost ?? 0.75,
    style: algo.style ?? 0.8,
    speed: algo.speed ?? 1.2,
    useSpeakerBoost: algo.use_speaker_boost ?? true,
    volume: algo.volume,
  };
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
