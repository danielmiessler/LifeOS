#!/usr/bin/env bun

/**
 * LoadSkillConfig - Shared utility for loading skill configurations with user customizations
 *
 * Skills call this to load their JSON/YAML configs, which automatically merges
 * base config with user customizations from SKILLCUSTOMIZATIONS directory.
 *
 * Usage:
 *   import { loadSkillConfig } from '~/.claude/skills/PAI/Tools/LoadSkillConfig';
 *   const config = loadSkillConfig<MyConfigType>(__dirname, 'config.json');
 *
 * Or CLI:
 *   bun ~/.claude/skills/PAI/Tools/LoadSkillConfig.ts <skill-dir> <filename>
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';
import { parse as parseYaml } from 'yaml';

// Types
interface CustomizationMetadata {
  description?: string;
  merge_strategy?: 'append' | 'override' | 'deep_merge';
}

interface ExtendManifest {
  skill: string;
  extends: string[];
  merge_strategy: 'append' | 'override' | 'deep_merge';
  enabled: boolean;
  description?: string;
}

// Constants
const HOME = homedir();
const CUSTOMIZATION_DIR = join(HOME, '.claude', 'skills', 'PAI', 'USER', 'SKILLCUSTOMIZATIONS');

/**
 * Deep merge two objects recursively
 */
function deepMerge<T extends Record<string, any>>(base: T, custom: Partial<T>): T {
  const result = { ...base };

  for (const key of Object.keys(custom) as (keyof T)[]) {
    const customValue = custom[key];
    const baseValue = base[key];

    if (customValue === undefined) continue;

    if (
      typeof customValue === 'object' &&
      customValue !== null &&
      !Array.isArray(customValue) &&
      typeof baseValue === 'object' &&
      baseValue !== null &&
      !Array.isArray(baseValue)
    ) {
      // Recursively merge objects
      result[key] = deepMerge(baseValue, customValue);
    } else if (Array.isArray(customValue) && Array.isArray(baseValue)) {
      // Concatenate arrays
      result[key] = [...baseValue, ...customValue] as T[keyof T];
    } else {
      // Override value
      result[key] = customValue as T[keyof T];
    }
  }

  return result;
}

/**
 * Merge configs based on strategy
 */
function mergeConfigs<T>(
  base: T,
  custom: T & { _customization?: CustomizationMetadata },
  strategy: 'append' | 'override' | 'deep_merge'
): T {
  // Remove metadata from custom config
  const { _customization, ...customData } = custom as any;

  // Override per-file strategy if specified
  const effectiveStrategy = _customization?.merge_strategy || strategy;

  switch (effectiveStrategy) {
    case 'override':
      return customData as T;

    case 'deep_merge':
      return deepMerge(base as Record<string, any>, customData) as T;

    case 'append':
    default:
      // For append, concatenate all arrays found at the top level
      const result = { ...base } as any;
      for (const key of Object.keys(customData)) {
        if (Array.isArray(result[key]) && Array.isArray(customData[key])) {
          result[key] = [...result[key], ...customData[key]];
        } else if (customData[key] !== undefined) {
          // For non-arrays, just add/override the key
          result[key] = customData[key];
        }
      }
      return result as T;
  }
}

/**
 * Load EXTEND.yaml manifest for a skill customization
 */
function loadExtendManifest(skillName: string): ExtendManifest | null {
  const manifestPath = join(CUSTOMIZATION_DIR, skillName, 'EXTEND.yaml');

  if (!existsSync(manifestPath)) {
    return null;
  }

  try {
    const content = readFileSync(manifestPath, 'utf-8');
    const manifest = parseYaml(content) as ExtendManifest;

    // Validate required fields
    if (!manifest.skill || !manifest.extends) {
      console.warn(`⚠️ Invalid EXTEND.yaml for ${skillName}: missing required fields`);
      return null;
    }

    // Default enabled to true if not specified
    if (manifest.enabled === undefined) {
      manifest.enabled = true;
    }

    return manifest;
  } catch (error) {
    console.warn(`⚠️ Failed to parse EXTEND.yaml for ${skillName}:`, error);
    return null;
  }
}

/**
 * Load a skill configuration file with user customizations merged in
 *
 * @param skillDir - The skill's directory path (use __dirname)
 * @param filename - The config file to load (e.g., 'sources.json')
 * @returns The merged configuration
 */
export function loadSkillConfig<T>(skillDir: string, filename: string): T {
  const skillName = basename(skillDir);

  // 1. Load base config from skill directory
  const baseConfigPath = join(skillDir, filename);
  let baseConfig: T;

  try {
    const content = readFileSync(baseConfigPath, 'utf-8');
    baseConfig = JSON.parse(content) as T;
  } catch (error) {
    // If base doesn't exist, return empty object (customization-only case)
    if (!existsSync(baseConfigPath)) {
      baseConfig = {} as T;
    } else {
      console.error(`❌ Failed to load base config ${baseConfigPath}:`, error);
      throw error;
    }
  }

  // 2. Check for customization manifest
  const manifest = loadExtendManifest(skillName);

  if (!manifest) {
    // No customization directory or invalid manifest
    return baseConfig;
  }

  if (!manifest.enabled) {
    // Customizations disabled
    return baseConfig;
  }

  // 3. Check if this file is in the extends list
  if (!manifest.extends.includes(filename)) {
    // This file doesn't have a customization
    return baseConfig;
  }

  // 4. Load customization file
  const customConfigPath = join(CUSTOMIZATION_DIR, skillName, filename);

  if (!existsSync(customConfigPath)) {
    // Customization file doesn't exist (yet)
    return baseConfig;
  }

  try {
    const customContent = readFileSync(customConfigPath, 'utf-8');
    const customConfig = JSON.parse(customContent) as T & { _customization?: CustomizationMetadata };

    // 5. Merge and return
    return mergeConfigs(baseConfig, customConfig, manifest.merge_strategy);
  } catch (error) {
    console.warn(`⚠️ Failed to load customization ${customConfigPath}, using base config:`, error);
    return baseConfig;
  }
}

/**
 * Get the customization directory path for a skill
 */
export function getCustomizationPath(skillName: string): string {
  return join(CUSTOMIZATION_DIR, skillName);
}

/**
 * Check if a skill has customizations enabled
 */
export function hasCustomizations(skillName: string): boolean {
  const manifest = loadExtendManifest(skillName);
  return manifest !== null && manifest.enabled;
}

/**
 * List all skills with customizations
 */
export function listCustomizedSkills(): string[] {
  if (!existsSync(CUSTOMIZATION_DIR)) {
    return [];
  }

  const dirs = readdirSync(CUSTOMIZATION_DIR, { withFileTypes: true });
  return dirs
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .filter(name => hasCustomizations(name));
}

// CLI mode
if (import.meta.main) {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help') {
    console.log(`
LoadSkillConfig - Load skill configs with user customizations

Usage:
  bun LoadSkillConfig.ts <skill-dir> <filename>    Load and merge config
  bun LoadSkillConfig.ts --list                    List customized skills
  bun LoadSkillConfig.ts --check <skill-name>      Check if skill has customizations

Examples:
  bun LoadSkillConfig.ts ~/.claude/skills/PAIUpgrade sources.json
  bun LoadSkillConfig.ts --list
  bun LoadSkillConfig.ts --check PAIUpgrade
`);
    process.exit(0);
  }

  if (args[0] === '--list') {
    const skills = listCustomizedSkills();
    if (skills.length === 0) {
      console.log('No skills with customizations found.');
    } else {
      console.log('Skills with customizations:');
      skills.forEach(s => console.log(`  - ${s}`));
    }
    process.exit(0);
  }

  if (args[0] === '--check') {
    const skillName = args[1];
    if (!skillName) {
      console.error('Error: Skill name required');
      process.exit(1);
    }
    const has = hasCustomizations(skillName);
    console.log(`${skillName}: ${has ? 'Has customizations enabled' : 'No customizations'}`);
    process.exit(0);
  }

  // Load config mode
  const [skillDir, filename] = args;

  if (!skillDir || !filename) {
    console.error('Error: Both skill-dir and filename required');
    process.exit(1);
  }

  try {
    const config = loadSkillConfig(skillDir, filename);
    console.log(JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Error loading config:', error);
    process.exit(1);
  }
}
