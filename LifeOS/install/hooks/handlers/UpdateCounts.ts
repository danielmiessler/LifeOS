/**
 * UpdateCounts.ts - Refresh Anthropic API usage cache
 *
 * PURPOSE:
 * Refreshes the OAuth /api/oauth/usage cache so the statusline doesn't
 * have to make a 700ms API call (and has to dodge aggressive 429 limits).
 * Stored at MEMORY/STATE/usage-cache.json.
 *
 * HISTORY (2026-05-06):
 * Previously this handler ALSO wrote settings.json.counts.{skills,hooks,...}
 * which the statusline + Banner read with mtime caching. That cache was
 * SessionEnd-cadence and stayed stale through every mid-session change.
 * {{PRINCIPAL_NAME}}'s call: kill the cache, read live every render. Statusline + Banner
 * now call GetCounts.ts directly. The settings.json.counts field is dead.
 *
 * What this hook still does: Anthropic OAuth usage refresh + workspace cost
 * (when ANTHROPIC_ADMIN_API_KEY is set). That's a real API rate-limit dodge,
 * not a filesystem-walk cache.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { getLifeosDir } from '../lib/paths';
import { getClaudeDir } from "../lib/paths";

/**
 * Refresh usage cache from Anthropic OAuth API.
 * Called by stop hook so status line never needs to make this 700ms API call.
 */
async function refreshUsageCache(paiDir: string): Promise<void> {
  const usageCachePath = join(paiDir, 'MEMORY/STATE/usage-cache.json');

  try {
    // Extract OAuth token — macOS Keychain or Linux credentials file
    let credJson: string;
    if (process.platform === 'darwin') {
      credJson = execSync(
        'security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null',
        { encoding: 'utf-8', timeout: 3000 }
      ).trim();
    } else {
      const credPath = join(getClaudeDir(), '.credentials.json');
      credJson = readFileSync(credPath, 'utf-8').trim();
    }

    const parsed = JSON.parse(credJson);
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
 * Handler called by UpdateCounts.hook.ts (SessionEnd).
 * Now does ONLY the OAuth usage cache refresh.
 */
export async function handleUpdateCounts(): Promise<void> {
  const paiDir = getLifeosDir();
  await refreshUsageCache(paiDir);
}

if (import.meta.main) {
  handleUpdateCounts().then(() => process.exit(0));
}
