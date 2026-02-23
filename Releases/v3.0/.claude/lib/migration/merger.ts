/**
 * PAI Migration Merger
 *
 * Merges extracted content from old installations with new PAI system.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, cpSync } from 'fs';
import { join, dirname } from 'path';
import type { ExtractedContent } from './extractor';

export interface MergeOptions {
  // Settings merge strategy
  settingsStrategy: 'keep-old' | 'keep-new' | 'merge';

  // What to migrate
  migrateUserContent: boolean;
  migratePersonalSkills: boolean;
  migrateAgents: boolean;
  migrateMemoryState: boolean;
  migratePlans: boolean;

  // Conflict resolution
  onConflict: 'skip' | 'overwrite' | 'backup';
}

export interface MergeResult {
  success: boolean;
  merged: string[];
  skipped: string[];
  conflicts: string[];
  errors: string[];
}

const DEFAULT_OPTIONS: MergeOptions = {
  settingsStrategy: 'merge',
  migrateUserContent: true,
  migratePersonalSkills: true,
  migrateAgents: true,
  migrateMemoryState: true,
  migratePlans: true,
  onConflict: 'backup',
};

/**
 * Merge extracted content into a target PAI installation
 */
export function mergeContent(
  content: ExtractedContent,
  targetDir: string,
  options: Partial<MergeOptions> = {}
): MergeResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const result: MergeResult = {
    success: true,
    merged: [],
    skipped: [],
    conflicts: [],
    errors: [],
  };

  try {
    // Merge settings
    if (content.settings.raw) {
      const settingsResult = mergeSettings(content.settings, targetDir, opts.settingsStrategy);
      if (settingsResult.merged) {
        result.merged.push('settings.json');
      } else if (settingsResult.error) {
        result.errors.push(`settings.json: ${settingsResult.error}`);
        result.success = false;
      }
    }

    // Merge USER content
    if (opts.migrateUserContent && content.userContent.files.length > 0) {
      const userResult = mergeDirectory(
        content.userContent.path,
        join(targetDir, 'skills', 'PAI', 'USER'),
        opts.onConflict
      );
      result.merged.push(...userResult.merged.map(f => `USER/${f}`));
      result.conflicts.push(...userResult.conflicts.map(f => `USER/${f}`));
      result.skipped.push(...userResult.skipped.map(f => `USER/${f}`));
    }

    // Merge personal skills
    if (opts.migratePersonalSkills) {
      for (const skill of content.personalSkills) {
        const skillResult = mergeDirectory(
          skill.path,
          join(targetDir, 'skills', skill.name),
          opts.onConflict
        );
        result.merged.push(...skillResult.merged.map(f => `skills/${skill.name}/${f}`));
        result.conflicts.push(...skillResult.conflicts.map(f => `skills/${skill.name}/${f}`));
      }
    }

    // Merge agents
    if (opts.migrateAgents && content.agents.files.length > 0) {
      const agentsResult = mergeDirectory(
        content.agents.path,
        join(targetDir, 'agents'),
        opts.onConflict
      );
      result.merged.push(...agentsResult.merged.map(f => `agents/${f}`));
      result.conflicts.push(...agentsResult.conflicts.map(f => `agents/${f}`));
    }

    // Merge MEMORY/STATE
    if (opts.migrateMemoryState && content.memoryState.files.length > 0) {
      const memoryResult = mergeDirectory(
        content.memoryState.path,
        join(targetDir, 'MEMORY', 'STATE'),
        opts.onConflict
      );
      result.merged.push(...memoryResult.merged.map(f => `MEMORY/STATE/${f}`));
      result.conflicts.push(...memoryResult.conflicts.map(f => `MEMORY/STATE/${f}`));
    }

    // Merge Plans
    if (opts.migratePlans && content.plans.files.length > 0) {
      const plansResult = mergeDirectory(
        content.plans.path,
        join(targetDir, 'Plans'),
        opts.onConflict
      );
      result.merged.push(...plansResult.merged.map(f => `Plans/${f}`));
      result.conflicts.push(...plansResult.conflicts.map(f => `Plans/${f}`));
    }
  } catch (error) {
    result.success = false;
    result.errors.push(`Merge failed: ${error}`);
  }

  return result;
}

/**
 * Merge settings.json files
 */
function mergeSettings(
  extracted: ExtractedContent['settings'],
  targetDir: string,
  strategy: MergeOptions['settingsStrategy']
): { merged: boolean; error?: string } {
  const targetPath = join(targetDir, 'settings.json');
  const targetExists = existsSync(targetPath);

  try {
    let targetSettings: any = {};

    if (targetExists) {
      targetSettings = JSON.parse(readFileSync(targetPath, 'utf-8'));
    }

    let finalSettings: any;

    switch (strategy) {
      case 'keep-old':
        // Use old settings entirely
        finalSettings = extracted.raw;
        break;

      case 'keep-new':
        // Keep new settings, but copy over critical user data
        finalSettings = {
          ...targetSettings,
          principal: extracted.principal || targetSettings.principal,
          daidentity: {
            ...targetSettings.daidentity,
            ...extracted.daidentity,
          },
        };
        // Preserve API keys from old
        if (extracted.apiKeys?.elevenlabs || extracted.apiKeys?.anthropic) {
          finalSettings.apiKeys = {
            ...targetSettings.apiKeys,
            ...extracted.apiKeys,
          };
        }
        break;

      case 'merge':
      default:
        // Deep merge, preferring old values for user-specific fields
        finalSettings = deepMerge(targetSettings, {
          principal: extracted.principal,
          daidentity: extracted.daidentity,
          apiKeys: extracted.apiKeys,
        });
        break;
    }

    // Ensure version is set
    finalSettings.paiVersion = finalSettings.paiVersion || '3.0';

    writeFileSync(targetPath, JSON.stringify(finalSettings, null, 2));
    return { merged: true };
  } catch (error) {
    return { merged: false, error: String(error) };
  }
}

/**
 * Deep merge two objects
 */
function deepMerge(target: any, source: any): any {
  const result = { ...target };

  for (const key in source) {
    if (source[key] === null || source[key] === undefined) {
      continue;
    }

    if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

/**
 * Merge a directory with conflict handling
 */
function mergeDirectory(
  sourcePath: string,
  targetPath: string,
  onConflict: MergeOptions['onConflict']
): { merged: string[]; skipped: string[]; conflicts: string[] } {
  const result = {
    merged: [] as string[],
    skipped: [] as string[],
    conflicts: [] as string[],
  };

  if (!existsSync(sourcePath)) {
    return result;
  }

  // Ensure target directory exists
  mkdirSync(targetPath, { recursive: true });

  // Copy entire directory
  try {
    cpSync(sourcePath, targetPath, {
      recursive: true,
      force: onConflict === 'overwrite',
      errorOnExist: onConflict === 'skip',
    });

    // Track what was merged
    const files = listFilesRecursive(sourcePath, sourcePath);
    result.merged = files;
  } catch (error) {
    // If errorOnExist, track conflicts
    if (onConflict === 'skip') {
      const files = listFilesRecursive(sourcePath, sourcePath);
      for (const file of files) {
        const targetFile = join(targetPath, file);
        if (existsSync(targetFile)) {
          result.conflicts.push(file);
        } else {
          result.merged.push(file);
        }
      }
    }
  }

  return result;
}

/**
 * List files recursively (relative paths)
 */
function listFilesRecursive(dir: string, basePath: string): string[] {
  const files: string[] = [];
  const { readdirSync, statSync } = require('fs');

  function walk(currentDir: string): void {
    try {
      const entries = readdirSync(currentDir);
      for (const entry of entries) {
        if (entry === 'node_modules' || entry === '.git') continue;

        const fullPath = join(currentDir, entry);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          walk(fullPath);
        } else {
          files.push(fullPath.replace(basePath + '/', ''));
        }
      }
    } catch (e) {
      // Skip inaccessible
    }
  }

  walk(dir);
  return files;
}

/**
 * Format merge result for display
 */
export function formatMergeResult(result: MergeResult): string {
  const lines: string[] = [];

  lines.push(`Merge ${result.success ? 'Successful' : 'Failed'}`);
  lines.push('');

  if (result.merged.length > 0) {
    lines.push(`Merged (${result.merged.length}):`);
    for (const file of result.merged.slice(0, 10)) {
      lines.push(`  + ${file}`);
    }
    if (result.merged.length > 10) {
      lines.push(`  ... and ${result.merged.length - 10} more`);
    }
  }

  if (result.conflicts.length > 0) {
    lines.push('');
    lines.push(`Conflicts (${result.conflicts.length}):`);
    for (const file of result.conflicts) {
      lines.push(`  ! ${file}`);
    }
  }

  if (result.skipped.length > 0) {
    lines.push('');
    lines.push(`Skipped (${result.skipped.length}):`);
    for (const file of result.skipped.slice(0, 5)) {
      lines.push(`  - ${file}`);
    }
    if (result.skipped.length > 5) {
      lines.push(`  ... and ${result.skipped.length - 5} more`);
    }
  }

  if (result.errors.length > 0) {
    lines.push('');
    lines.push('Errors:');
    for (const error of result.errors) {
      lines.push(`  ! ${error}`);
    }
  }

  return lines.join('\n');
}
