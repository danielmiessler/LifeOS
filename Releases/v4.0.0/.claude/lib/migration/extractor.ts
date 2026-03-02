/**
 * PAI Migration Extractor
 *
 * Extracts transferable content from existing PAI installations.
 */

import { existsSync, readdirSync, readFileSync, statSync, cpSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import type { InstallationInfo } from './scanner';

export interface ExtractedContent {
  settings: {
    raw: any | null;
    principal: { name?: string; timezone?: string } | null;
    daidentity: { name?: string; mainDAVoiceID?: string } | null;
    apiKeys: { elevenlabs?: string; anthropic?: string } | null;
  };
  userContent: {
    path: string;
    files: string[];
    totalSize: number;
  };
  personalSkills: Array<{
    name: string;
    path: string;
    files: string[];
  }>;
  agents: {
    path: string;
    files: string[];
  };
  memoryState: {
    path: string;
    files: string[];
  };
  plans: {
    path: string;
    files: string[];
  };
  hooks: {
    path: string;
    files: string[];
    customHooks: string[]; // Hooks that differ from default
  };
}

/**
 * Extract all transferable content from an installation
 */
export function extractContent(source: InstallationInfo): ExtractedContent {
  const result: ExtractedContent = {
    settings: {
      raw: null,
      principal: null,
      daidentity: null,
      apiKeys: null,
    },
    userContent: { path: '', files: [], totalSize: 0 },
    personalSkills: [],
    agents: { path: '', files: [] },
    memoryState: { path: '', files: [] },
    plans: { path: '', files: [] },
    hooks: { path: '', files: [], customHooks: [] },
  };

  if (!source.exists) return result;

  // Extract settings
  result.settings = extractSettings(source.path);

  // Extract USER content
  const userPath = join(source.path, 'skills', 'PAI', 'USER');
  if (existsSync(userPath)) {
    result.userContent = {
      path: userPath,
      files: listFilesRelative(userPath),
      totalSize: calculateDirSize(userPath),
    };
  }

  // Extract personal skills
  if (source.components.personalSkills.length > 0) {
    for (const skillName of source.components.personalSkills) {
      const skillPath = join(source.path, 'skills', skillName);
      if (existsSync(skillPath)) {
        result.personalSkills.push({
          name: skillName,
          path: skillPath,
          files: listFilesRelative(skillPath),
        });
      }
    }
  }

  // Extract agents
  const agentsPath = join(source.path, 'agents');
  if (existsSync(agentsPath)) {
    result.agents = {
      path: agentsPath,
      files: listFilesRelative(agentsPath),
    };
  }

  // Extract MEMORY/STATE
  const statePath = join(source.path, 'MEMORY', 'STATE');
  if (existsSync(statePath)) {
    result.memoryState = {
      path: statePath,
      files: listFilesRelative(statePath),
    };
  }

  // Extract Plans
  const plansPath = join(source.path, 'Plans');
  if (existsSync(plansPath)) {
    result.plans = {
      path: plansPath,
      files: listFilesRelative(plansPath),
    };
  }

  // Extract hooks (only custom ones)
  const hooksPath = join(source.path, 'hooks');
  if (existsSync(hooksPath)) {
    result.hooks = {
      path: hooksPath,
      files: listFilesRelative(hooksPath),
      customHooks: [], // Would need hash comparison with default hooks
    };
  }

  return result;
}

/**
 * Extract settings from an installation
 */
function extractSettings(path: string): ExtractedContent['settings'] {
  const result: ExtractedContent['settings'] = {
    raw: null,
    principal: null,
    daidentity: null,
    apiKeys: null,
  };

  const settingsPath = join(path, 'settings.json');
  if (!existsSync(settingsPath)) return result;

  try {
    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    result.raw = settings;

    // Extract principal
    if (settings.principal) {
      result.principal = {
        name: settings.principal.name,
        timezone: settings.principal.timezone,
      };
    }

    // Extract daidentity
    if (settings.daidentity) {
      result.daidentity = {
        name: settings.daidentity.name,
        mainDAVoiceID: settings.daidentity.mainDAVoiceID,
      };
    }

    // Extract API keys (check multiple possible locations)
    result.apiKeys = {
      elevenlabs: settings.apiKeys?.elevenlabs || settings.elevenLabsApiKey,
      anthropic: settings.apiKeys?.anthropic || settings.anthropicApiKey,
    };
  } catch (e) {
    // Could not parse settings
  }

  return result;
}

/**
 * List all files in a directory (relative paths)
 */
function listFilesRelative(basePath: string): string[] {
  const files: string[] = [];

  function walk(dir: string): void {
    if (!existsSync(dir)) return;

    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        // Skip certain directories
        if (entry === 'node_modules' || entry === '.git' || entry === 'bun.lock') continue;

        const fullPath = join(dir, entry);
        try {
          const stat = statSync(fullPath);
          if (stat.isDirectory()) {
            walk(fullPath);
          } else {
            // Store relative path
            files.push(fullPath.replace(basePath + '/', ''));
          }
        } catch (e) {
          // Skip inaccessible files
        }
      }
    } catch (e) {
      // Skip inaccessible directories
    }
  }

  walk(basePath);
  return files;
}

/**
 * Calculate total size of a directory
 */
function calculateDirSize(path: string): number {
  let size = 0;

  function walk(dir: string): void {
    if (!existsSync(dir)) return;

    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        if (entry === 'node_modules' || entry === '.git') continue;

        const fullPath = join(dir, entry);
        try {
          const stat = statSync(fullPath);
          if (stat.isDirectory()) {
            walk(fullPath);
          } else {
            size += stat.size;
          }
        } catch (e) {
          // Skip inaccessible files
        }
      }
    } catch (e) {
      // Skip inaccessible directories
    }
  }

  walk(path);
  return size;
}

/**
 * Copy extracted content to a target directory
 */
export function copyExtractedContent(
  content: ExtractedContent,
  targetDir: string,
  options: {
    includeUserContent?: boolean;
    includePersonalSkills?: boolean;
    includeAgents?: boolean;
    includeMemoryState?: boolean;
    includePlans?: boolean;
    includeHooks?: boolean;
  } = {}
): void {
  const opts = {
    includeUserContent: true,
    includePersonalSkills: true,
    includeAgents: true,
    includeMemoryState: true,
    includePlans: true,
    includeHooks: false, // Default to not copying hooks (use new system hooks)
    ...options,
  };

  // Copy USER content
  if (opts.includeUserContent && content.userContent.files.length > 0) {
    const destPath = join(targetDir, 'skills', 'PAI', 'USER');
    mkdirSync(destPath, { recursive: true });
    cpSync(content.userContent.path, destPath, { recursive: true });
  }

  // Copy personal skills
  if (opts.includePersonalSkills) {
    for (const skill of content.personalSkills) {
      const destPath = join(targetDir, 'skills', skill.name);
      mkdirSync(dirname(destPath), { recursive: true });
      cpSync(skill.path, destPath, { recursive: true });
    }
  }

  // Copy agents
  if (opts.includeAgents && content.agents.files.length > 0) {
    const destPath = join(targetDir, 'agents');
    mkdirSync(destPath, { recursive: true });
    cpSync(content.agents.path, destPath, { recursive: true });
  }

  // Copy MEMORY/STATE
  if (opts.includeMemoryState && content.memoryState.files.length > 0) {
    const destPath = join(targetDir, 'MEMORY', 'STATE');
    mkdirSync(destPath, { recursive: true });
    cpSync(content.memoryState.path, destPath, { recursive: true });
  }

  // Copy Plans
  if (opts.includePlans && content.plans.files.length > 0) {
    const destPath = join(targetDir, 'Plans');
    mkdirSync(destPath, { recursive: true });
    cpSync(content.plans.path, destPath, { recursive: true });
  }
}

/**
 * Format extracted content for display
 */
export function formatExtractedContent(content: ExtractedContent): string {
  const lines: string[] = [];

  lines.push('Extracted Content:');

  if (content.settings.principal?.name) {
    lines.push(`  Principal: ${content.settings.principal.name}`);
  }
  if (content.settings.daidentity?.name) {
    lines.push(`  AI Identity: ${content.settings.daidentity.name}`);
  }
  if (content.settings.daidentity?.mainDAVoiceID) {
    lines.push(`  Voice ID: ${content.settings.daidentity.mainDAVoiceID.substring(0, 8)}...`);
  }
  if (content.settings.apiKeys?.elevenlabs) {
    lines.push('  ElevenLabs API: Configured');
  }

  if (content.userContent.files.length > 0) {
    lines.push(`  USER content: ${content.userContent.files.length} files (${formatBytes(content.userContent.totalSize)})`);
  }

  if (content.personalSkills.length > 0) {
    lines.push(`  Personal skills: ${content.personalSkills.map(s => s.name).join(', ')}`);
  }

  if (content.agents.files.length > 0) {
    lines.push(`  Agents: ${content.agents.files.length} configurations`);
  }

  if (content.memoryState.files.length > 0) {
    lines.push(`  MEMORY/STATE: ${content.memoryState.files.length} files`);
  }

  if (content.plans.files.length > 0) {
    lines.push(`  Plans: ${content.plans.files.length} files`);
  }

  return lines.join('\n');
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
