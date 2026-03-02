// State management for bug bounty tracker

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { CONFIG } from './config.js';
import type { TrackerState, ProgramMetadata } from './types.js';

export class StateManager {
  private statePath = CONFIG.paths.state;
  private metadataPath = `${CONFIG.paths.cache}/${CONFIG.cache.metadata_file}`;
  private recentChangesPath = `${CONFIG.paths.cache}/${CONFIG.cache.recent_changes_file}`;

  async ensureDirectories(): Promise<void> {
    if (!existsSync(CONFIG.paths.cache)) {
      await mkdir(CONFIG.paths.cache, { recursive: true });
    }
    if (!existsSync(CONFIG.paths.logs)) {
      await mkdir(CONFIG.paths.logs, { recursive: true });
    }
  }

  async loadState(): Promise<TrackerState> {
    try {
      const data = await readFile(this.statePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      // Return default state if file doesn't exist
      return {
        last_check: new Date(0).toISOString(),
        tracked_commits: {
          domains_txt: '',
          hackerone: '',
          bugcrowd: '',
          intigriti: '',
          yeswehack: '',
        },
        initialized: false,
      };
    }
  }

  async saveState(state: TrackerState): Promise<void> {
    await this.ensureDirectories();
    await writeFile(this.statePath, JSON.stringify(state, null, 2));
  }

  async loadMetadata(): Promise<Map<string, ProgramMetadata>> {
    try {
      const data = await readFile(this.metadataPath, 'utf-8');
      const programs: ProgramMetadata[] = JSON.parse(data);
      const map = new Map<string, ProgramMetadata>();

      for (const program of programs) {
        const key = `${program.platform}:${program.handle}`;
        map.set(key, program);
      }

      return map;
    } catch {
      return new Map();
    }
  }

  async saveMetadata(metadata: Map<string, ProgramMetadata>): Promise<void> {
    await this.ensureDirectories();
    const programs = Array.from(metadata.values());

    // Clean up old entries (>30 days)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - CONFIG.cache.max_age_days);

    const filtered = programs.filter(p => {
      const discoveredDate = new Date(p.discovered_at);
      return discoveredDate >= cutoffDate;
    });

    await writeFile(this.metadataPath, JSON.stringify(filtered, null, 2));
  }

  async loadRecentChanges(): Promise<ProgramMetadata[]> {
    try {
      const data = await readFile(this.recentChangesPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  async saveRecentChanges(changes: ProgramMetadata[]): Promise<void> {
    await this.ensureDirectories();

    // Keep only last 30 days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - CONFIG.cache.max_age_days);

    const filtered = changes.filter(p => {
      const discoveredDate = new Date(p.discovered_at);
      return discoveredDate >= cutoffDate;
    });

    await writeFile(this.recentChangesPath, JSON.stringify(filtered, null, 2));
  }

  async logDiscovery(timestamp: string, message: string, data?: any): Promise<void> {
    await this.ensureDirectories();
    const logPath = `${CONFIG.paths.logs}/discovery.jsonl`;
    const logEntry = {
      timestamp,
      message,
      data,
    };

    try {
      const { appendFile } = await import('fs/promises');
      await appendFile(logPath, JSON.stringify(logEntry) + '\n');
    } catch (error) {
      console.error('Failed to write log:', error);
    }
  }
}
