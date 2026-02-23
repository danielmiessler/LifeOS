/**
 * PAI Migration Scanner
 *
 * Detects existing PAI installations and analyzes their content for migration.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';

export interface InstallationInfo {
  path: string;
  exists: boolean;
  version?: string;
  isComplete: boolean;
  components: {
    settings: boolean;
    skills: boolean;
    coreSkill: boolean;
    userContent: boolean;
    personalSkills: string[];
    agents: boolean;
    agentCount: number;
    memory: boolean;
    hooks: boolean;
    hookCount: number;
  };
  stats: {
    totalFiles: number;
    totalSize: number;
    skillCount: number;
  };
}

const HOME = homedir();

/**
 * Standard locations to check for PAI installations
 */
export const STANDARD_LOCATIONS = [
  join(HOME, '.claude'),
  join(HOME, '.claude-BACKUP'),
  join(HOME, '.claude-old'),
];

/**
 * Scan a directory to determine if it's a PAI installation
 */
export function scanInstallation(path: string): InstallationInfo {
  const info: InstallationInfo = {
    path,
    exists: existsSync(path),
    isComplete: false,
    components: {
      settings: false,
      skills: false,
      coreSkill: false,
      userContent: false,
      personalSkills: [],
      agents: false,
      agentCount: 0,
      memory: false,
      hooks: false,
      hookCount: 0,
    },
    stats: {
      totalFiles: 0,
      totalSize: 0,
      skillCount: 0,
    },
  };

  if (!info.exists) return info;

  // Check settings.json
  const settingsPath = join(path, 'settings.json');
  if (existsSync(settingsPath)) {
    info.components.settings = true;
    try {
      const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
      info.version = settings.paiVersion || settings.version;
    } catch (e) {
      // Could not parse settings
    }
  }

  // Check skills directory
  const skillsDir = join(path, 'skills');
  if (existsSync(skillsDir)) {
    info.components.skills = true;
    try {
      const skills = readdirSync(skillsDir);
      info.stats.skillCount = skills.length;

      // Check for personal skills (_ALLCAPS)
      info.components.personalSkills = skills.filter(
        s => s.startsWith('_') && s === s.toUpperCase()
      );

      // Check for PAI skill
      info.components.coreSkill = existsSync(join(skillsDir, 'PAI', 'SKILL.md'));

      // Check for USER content
      info.components.userContent = existsSync(join(skillsDir, 'PAI', 'USER'));
    } catch (e) {
      // Could not read skills directory
    }
  }

  // Check agents
  const agentsDir = join(path, 'agents');
  if (existsSync(agentsDir)) {
    info.components.agents = true;
    try {
      info.components.agentCount = readdirSync(agentsDir).length;
    } catch (e) {
      // Could not count agents
    }
  }

  // Check memory
  info.components.memory = existsSync(join(path, 'MEMORY'));

  // Check hooks
  const hooksDir = join(path, 'hooks');
  if (existsSync(hooksDir)) {
    info.components.hooks = true;
    try {
      info.components.hookCount = readdirSync(hooksDir).filter(f => f.endsWith('.ts')).length;
    } catch (e) {
      // Could not count hooks
    }
  }

  // Calculate stats
  info.stats = calculateStats(path);

  // Determine if installation is complete
  info.isComplete = info.components.settings &&
    info.components.coreSkill &&
    info.components.skills;

  return info;
}

/**
 * Calculate file statistics for an installation
 */
function calculateStats(path: string): { totalFiles: number; totalSize: number; skillCount: number } {
  let totalFiles = 0;
  let totalSize = 0;
  let skillCount = 0;

  function walk(dir: string): void {
    if (!existsSync(dir)) return;

    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        // Skip node_modules, .git, etc.
        if (entry === 'node_modules' || entry === '.git' || entry === 'bun.lock') continue;

        const fullPath = join(dir, entry);
        try {
          const stat = statSync(fullPath);
          if (stat.isDirectory()) {
            walk(fullPath);
          } else {
            totalFiles++;
            totalSize += stat.size;
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

  // Count skills specifically
  const skillsDir = join(path, 'skills');
  if (existsSync(skillsDir)) {
    try {
      skillCount = readdirSync(skillsDir).filter(s => {
        const skillPath = join(skillsDir, s);
        return statSync(skillPath).isDirectory();
      }).length;
    } catch (e) {
      // Could not count skills
    }
  }

  return { totalFiles, totalSize, skillCount };
}

/**
 * Find all PAI installations in standard locations
 */
export function findInstallations(): InstallationInfo[] {
  return STANDARD_LOCATIONS
    .map(scanInstallation)
    .filter(info => info.exists);
}

/**
 * Find the best migration source
 * Prioritizes: most complete installation with USER content
 */
export function findBestMigrationSource(): InstallationInfo | null {
  const installations = findInstallations();

  if (installations.length === 0) return null;

  // Sort by priority:
  // 1. Has USER content
  // 2. Has personal skills
  // 3. Is complete
  // 4. Most recent version
  installations.sort((a, b) => {
    // USER content is most important
    if (a.components.userContent && !b.components.userContent) return -1;
    if (!a.components.userContent && b.components.userContent) return 1;

    // Personal skills next
    if (a.components.personalSkills.length > 0 && b.components.personalSkills.length === 0) return -1;
    if (a.components.personalSkills.length === 0 && b.components.personalSkills.length > 0) return 1;

    // Completeness
    if (a.isComplete && !b.isComplete) return -1;
    if (!a.isComplete && b.isComplete) return 1;

    // File count (more = more content)
    return b.stats.totalFiles - a.stats.totalFiles;
  });

  return installations[0];
}

/**
 * Format installation info for display
 */
export function formatInstallationInfo(info: InstallationInfo): string {
  const lines: string[] = [];

  lines.push(`Installation: ${info.path}`);
  lines.push(`  Version: ${info.version || 'Unknown'}`);
  lines.push(`  Complete: ${info.isComplete ? 'Yes' : 'No'}`);
  lines.push('  Components:');
  lines.push(`    - settings.json: ${info.components.settings ? 'Yes' : 'No'}`);
  lines.push(`    - PAI skill: ${info.components.coreSkill ? 'Yes' : 'No'}`);
  lines.push(`    - USER content: ${info.components.userContent ? 'Yes' : 'No'}`);
  lines.push(`    - Skills: ${info.stats.skillCount}`);
  if (info.components.personalSkills.length > 0) {
    lines.push(`    - Personal skills: ${info.components.personalSkills.join(', ')}`);
  }
  lines.push(`    - Agents: ${info.components.agentCount}`);
  lines.push(`    - Hooks: ${info.components.hookCount}`);
  lines.push(`  Stats: ${info.stats.totalFiles} files, ${formatBytes(info.stats.totalSize)}`);

  return lines.join('\n');
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
