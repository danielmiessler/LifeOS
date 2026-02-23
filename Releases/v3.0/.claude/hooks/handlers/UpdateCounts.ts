/**
 * UpdateCounts.ts - Update settings.json with fresh system counts
 *
 * PURPOSE:
 * Updates the counts section of settings.json at the end of each session.
 * Banner and statusline then read from settings.json (instant, no execution).
 *
 * ARCHITECTURE:
 * Stop hook → UpdateCounts → settings.json
 * Session start → Banner reads settings.json (instant)
 * Session start → Statusline reads settings.json (instant)
 *
 * This design ensures:
 * - No spawning/execution at session start
 * - Counts are always available (no waiting)
 * - Single source of truth in settings.json
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { getPaiDir, getSettingsPath } from '../lib/paths';

interface Counts {
  skills: number;
  workflows: number;
  hooks: number;
  signals: number;
  files: number;
  work: number;
  sessions: number;
  research: number;
  ratings: number;
  updatedAt: string;
}

/**
 * Count files matching criteria recursively
 */
function countFilesRecursive(dir: string, extension?: string): number {
  let count = 0;
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        count += countFilesRecursive(fullPath, extension);
      } else if (entry.isFile()) {
        if (!extension || entry.name.endsWith(extension)) {
          count++;
        }
      }
    }
  } catch {
    // Directory doesn't exist or not readable
  }
  return count;
}

/**
 * Count .md files inside any Workflows directory
 */
function countWorkflowFiles(dir: string): number {
  let count = 0;
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.toLowerCase() === 'workflows') {
          count += countFilesRecursive(fullPath, '.md');
        } else {
          count += countWorkflowFiles(fullPath);
        }
      }
    }
  } catch {
    // Directory doesn't exist or not readable
  }
  return count;
}

/**
 * Count skills (directories with SKILL.md file)
 */
function countSkills(paiDir: string): number {
  let count = 0;
  const skillsDir = join(paiDir, 'skills');
  try {
    for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
      // Handle both real directories and symlinks to directories
      const isDir = entry.isDirectory() ||
        (entry.isSymbolicLink() && statSync(join(skillsDir, entry.name)).isDirectory());
      if (isDir) {
        const skillFile = join(skillsDir, entry.name, 'SKILL.md');
        if (existsSync(skillFile)) {
          count++;
        }
      }
    }
  } catch {
    // skills directory doesn't exist
  }
  return count;
}

/**
 * Count hooks (.ts files in hooks/ at depth 1)
 */
function countHooks(paiDir: string): number {
  let count = 0;
  const hooksDir = join(paiDir, 'hooks');
  try {
    for (const entry of readdirSync(hooksDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.ts')) {
        count++;
      }
    }
  } catch {
    // hooks directory doesn't exist
  }
  return count;
}

/**
 * Count non-empty lines in a JSONL file (signals = rating entries)
 */
function countRatingsLines(filePath: string): number {
  try {
    if (!existsSync(filePath) || !statSync(filePath).isFile()) return 0;
    return readFileSync(filePath, 'utf-8').split('\n').filter(l => l.trim()).length;
  } catch {
    return 0;
  }
}

/**
 * Count immediate subdirectories (depth 1)
 */
function countSubdirs(dir: string): number {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory()).length;
  } catch {
    return 0;
  }
}

/**
 * Get all counts
 */
function getCounts(paiDir: string): Counts {
  const ratingsPath = join(paiDir, 'MEMORY/LEARNING/SIGNALS/ratings.jsonl');
  return {
    skills: countSkills(paiDir),
    workflows: countWorkflowFiles(join(paiDir, 'skills')),
    hooks: countHooks(paiDir),
    signals: countFilesRecursive(join(paiDir, 'MEMORY/LEARNING'), '.md'),
    files: countFilesRecursive(join(paiDir, 'skills/PAI/USER')),
    work: countSubdirs(join(paiDir, 'MEMORY/WORK')),
    sessions: countFilesRecursive(join(paiDir, 'MEMORY'), '.jsonl'),
    research: countFilesRecursive(join(paiDir, 'MEMORY/RESEARCH'), '.md') +
              countFilesRecursive(join(paiDir, 'MEMORY/RESEARCH'), '.json'),
    ratings: countRatingsLines(ratingsPath),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Refresh usage cache from Anthropic OAuth API.
 * Called by stop hook so status line never needs to make this 700ms API call.
 */
async function refreshUsageCache(paiDir: string): Promise<void> {
  const usageCachePath = join(paiDir, 'MEMORY/STATE/usage-cache.json');

  try {
    // Extract OAuth token from macOS Keychain
    const keychainData = execSync(
      'security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null',
      { encoding: 'utf-8', timeout: 3000 }
    ).trim();

    const parsed = JSON.parse(keychainData);
    const token = parsed?.claudeAiOauth?.accessToken;
    if (!token) return;

    const resp = await fetch('https://api.anthropic.com/api/oauth/usage', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'anthropic-beta': 'oauth-2025-04-20',
      },
      signal: AbortSignal.timeout(3000),
    });

    if (!resp.ok) return;
    const data = await resp.json() as Record<string, unknown>;
    if (!data?.five_hour) return;

    // Fetch API workspace cost if admin key is available
    const adminKey = process.env.ANTHROPIC_ADMIN_API_KEY;
    if (adminKey) {
      try {
        const now = new Date();
        const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01T00:00:00Z`;
        const costResp = await fetch(
          `https://api.anthropic.com/v1/organizations/cost_report?starting_at=${startOfMonth}`,
          {
            headers: {
              'x-api-key': adminKey,
              'anthropic-version': '2023-06-01',
            },
            signal: AbortSignal.timeout(5000),
          }
        );
        if (costResp.ok) {
          const costData = await costResp.json() as any;
          // Sum all daily cost entries (amount is cents as decimal string)
          let totalCostCents = 0;
          if (Array.isArray(costData?.data)) {
            for (const day of costData.data) {
              if (Array.isArray(day?.results)) {
                for (const entry of day.results) {
                  totalCostCents += parseFloat(entry.amount || '0');
                }
              }
            }
          }
          (data as any).workspace_cost = {
            month_used_cents: Math.round(totalCostCents),
            updated_at: new Date().toISOString(),
          };
          console.error(`[UpdateCounts] Workspace cost: $${(totalCostCents / 100).toFixed(2)} this month`);
        }
      } catch {
        // Non-fatal — admin API unavailable
      }
    }

    writeFileSync(usageCachePath, JSON.stringify(data, null, 2) + '\n');
    console.error(`[UpdateCounts] Usage cache refreshed: 5H=${(data.five_hour as any)?.utilization}% 7D=${(data.seven_day as any)?.utilization}%`);
  } catch {
    // Non-fatal — status line falls back to stale cache
  }
}

/**
 * Handler called by StopOrchestrator
 */
export async function handleUpdateCounts(): Promise<void> {
  const paiDir = getPaiDir();
  const settingsPath = getSettingsPath();

  try {
    // Run counts + usage refresh in parallel
    const [counts] = await Promise.all([
      Promise.resolve(getCounts(paiDir)),
      refreshUsageCache(paiDir),
    ]);

    // Read current settings
    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));

    // Update counts section
    settings.counts = counts;

    // Write back
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');

    console.error(`[UpdateCounts] Updated: SK:${counts.skills} WF:${counts.workflows} HK:${counts.hooks} SIG:${counts.signals} F:${counts.files} W:${counts.work} SESS:${counts.sessions} RES:${counts.research} RAT:${counts.ratings}`);
  } catch (error) {
    console.error('[UpdateCounts] Failed to update counts:', error);
    // Non-fatal - don't throw, let other handlers continue
  }
}

// Allow running standalone to seed initial counts
if (import.meta.main) {
  handleUpdateCounts().then(() => process.exit(0));
}
