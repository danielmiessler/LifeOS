// GitHub API client for bug bounty tracking

import { CONFIG } from './config.js';
import type { GitHubCommit, Program } from './types.js';

export class GitHubClient {
  private baseUrl = CONFIG.api.base;
  private repoPath = `repos/${CONFIG.repo.owner}/${CONFIG.repo.name}`;

  /**
   * TIER 1: Fast check - Get commits for a specific file
   * This is lightweight and tells us if there are ANY changes
   */
  async getCommitsSince(filePath: string, since: string): Promise<GitHubCommit[]> {
    const url = `${this.baseUrl}/${this.repoPath}/commits?path=${filePath}&since=${since}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to fetch commits:', error);
      return [];
    }
  }

  /**
   * Get the latest commit for a file
   */
  async getLatestCommit(filePath: string): Promise<GitHubCommit | null> {
    const url = `${this.baseUrl}/${this.repoPath}/commits?path=${filePath}&per_page=1`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        return null;
      }

      const commits = await response.json();
      return commits[0] || null;
    } catch {
      return null;
    }
  }

  /**
   * TIER 2: Detailed analysis - Get the diff between two commits
   * This shows us EXACTLY what changed without downloading full files
   */
  async getCompareDiff(baseCommit: string, headCommit: string): Promise<string> {
    const url = `${this.baseUrl}/${this.repoPath}/compare/${baseCommit}...${headCommit}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const data = await response.json();
      return JSON.stringify(data, null, 2);
    } catch (error) {
      console.error('Failed to fetch diff:', error);
      return '';
    }
  }

  /**
   * Fetch a specific file from the repository
   * Used for initial bootstrap or when we need full data
   */
  async fetchFile(filePath: string, commit?: string): Promise<string> {
    const branch = commit || 'main';
    const url = `${CONFIG.api.raw_base}/${CONFIG.repo.owner}/${CONFIG.repo.name}/${branch}/${filePath}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status}`);
      }

      return await response.text();
    } catch (error) {
      console.error('Failed to fetch file:', error);
      return '';
    }
  }

  /**
   * Parse program data from JSON
   */
  parsePrograms(jsonData: string, platform: Program['platform']): Program[] {
    try {
      const data = JSON.parse(jsonData);

      if (!Array.isArray(data)) {
        return [];
      }

      return data.map(item => this.normalizeProgram(item, platform));
    } catch (error) {
      console.error('Failed to parse programs:', error);
      return [];
    }
  }

  /**
   * Normalize program data from different platforms
   */
  private normalizeProgram(data: any, platform: Program['platform']): Program {
    return {
      name: data.name || 'Unknown',
      platform,
      handle: data.handle || data.id || 'unknown',
      url: data.url || '',
      website: data.website,
      offers_bounties: data.offers_bounties || data.bounty || false,
      offers_swag: data.offers_swag || data.swag || false,
      submission_state: data.submission_state || 'unknown',
      key_scopes: this.extractScopes(data),
      discovered_at: new Date().toISOString(),
      max_severity: this.extractMaxSeverity(data),
      managed_program: data.managed_program,
    };
  }

  /**
   * Extract scope domains from program data
   */
  private extractScopes(data: any): string[] {
    if (data.domains && Array.isArray(data.domains)) {
      return data.domains;
    }

    if (data.targets?.in_scope && Array.isArray(data.targets.in_scope)) {
      return data.targets.in_scope
        .map((t: any) => t.asset_identifier)
        .filter(Boolean)
        .slice(0, 10); // Limit to first 10 scopes
    }

    return [];
  }

  /**
   * Extract maximum severity from program data
   */
  private extractMaxSeverity(data: any): string | undefined {
    if (data.targets?.in_scope && Array.isArray(data.targets.in_scope)) {
      const severities = data.targets.in_scope
        .map((t: any) => t.max_severity)
        .filter(Boolean);

      if (severities.includes('critical')) return 'critical';
      if (severities.includes('high')) return 'high';
      if (severities.includes('medium')) return 'medium';
      if (severities.includes('low')) return 'low';
    }

    return undefined;
  }
}
