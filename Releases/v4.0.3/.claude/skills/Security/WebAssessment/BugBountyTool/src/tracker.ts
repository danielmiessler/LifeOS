// Main bug bounty tracker with two-tier detection

import { GitHubClient } from './github.js';
import { StateManager } from './state.js';
import { CONFIG } from './config.js';
import type { DiscoveryResult, ProgramMetadata, TrackerState } from './types.js';

export class BugBountyTracker {
  private github = new GitHubClient();
  private state = new StateManager();

  /**
   * Initialize the tracker (first-time setup)
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing bug bounty tracker...');

    const currentState = await this.state.loadState();

    if (currentState.initialized) {
      console.log('✅ Tracker already initialized');
      return;
    }

    // Get latest commits for all tracked files
    const domains_commit = await this.github.getLatestCommit(CONFIG.files.domains_txt);
    const hackerone_commit = await this.github.getLatestCommit(CONFIG.files.hackerone);
    const bugcrowd_commit = await this.github.getLatestCommit(CONFIG.files.bugcrowd);
    const intigriti_commit = await this.github.getLatestCommit(CONFIG.files.intigriti);
    const yeswehack_commit = await this.github.getLatestCommit(CONFIG.files.yeswehack);

    const newState: TrackerState = {
      last_check: new Date().toISOString(),
      tracked_commits: {
        domains_txt: domains_commit?.sha || '',
        hackerone: hackerone_commit?.sha || '',
        bugcrowd: bugcrowd_commit?.sha || '',
        intigriti: intigriti_commit?.sha || '',
        yeswehack: yeswehack_commit?.sha || '',
      },
      initialized: true,
    };

    await this.state.saveState(newState);

    console.log('✅ Tracker initialized successfully');
    console.log(`   Last check: ${newState.last_check}`);
    console.log(`   Tracking commits from all platforms`);
  }

  /**
   * Update bug bounty programs (main workflow)
   * Implements two-tier detection strategy
   */
  async update(): Promise<DiscoveryResult> {
    const startTime = Date.now();
    console.log('🔍 Checking for new bug bounty programs...\n');

    const currentState = await this.state.loadState();

    if (!currentState.initialized) {
      console.log('⚠️  Tracker not initialized. Run initialization first.');
      await this.initialize();
      return {
        new_programs: [],
        scope_expansions: [],
        upgraded_programs: [],
        total_checked: 0,
        check_duration_ms: Date.now() - startTime,
      };
    }

    // TIER 1: Fast detection - check if domains.txt has new commits
    console.log('📊 TIER 1: Fast change detection');
    const domainCommits = await this.github.getCommitsSince(
      CONFIG.files.domains_txt,
      currentState.last_check
    );

    if (domainCommits.length === 0) {
      console.log('✅ No changes detected - all programs up to date\n');
      return {
        new_programs: [],
        scope_expansions: [],
        upgraded_programs: [],
        total_checked: 5,
        check_duration_ms: Date.now() - startTime,
      };
    }

    console.log(`🆕 Changes detected! ${domainCommits.length} commits since last check\n`);

    // TIER 2: Detailed analysis - check each platform for changes
    console.log('🔬 TIER 2: Detailed analysis of platform changes');
    const results = await this.analyzeChanges(currentState);

    // Update state with latest commits
    const latestDomains = await this.github.getLatestCommit(CONFIG.files.domains_txt);
    if (latestDomains) {
      currentState.tracked_commits.domains_txt = latestDomains.sha;
    }
    currentState.last_check = new Date().toISOString();
    await this.state.saveState(currentState);

    // Save discoveries to recent changes
    const allChanges = [
      ...results.new_programs,
      ...results.scope_expansions,
      ...results.upgraded_programs,
    ];

    if (allChanges.length > 0) {
      const existingChanges = await this.state.loadRecentChanges();
      await this.state.saveRecentChanges([...existingChanges, ...allChanges]);

      await this.state.logDiscovery(
        new Date().toISOString(),
        `Discovered ${allChanges.length} changes`,
        results
      );
    }

    const duration = Date.now() - startTime;
    console.log(`\n⏱️  Completed in ${(duration / 1000).toFixed(1)}s`);

    return {
      ...results,
      check_duration_ms: duration,
    };
  }

  /**
   * Analyze changes in each platform
   */
  private async analyzeChanges(currentState: TrackerState): Promise<Omit<DiscoveryResult, 'total_checked' | 'check_duration_ms'>> {
    const newPrograms: ProgramMetadata[] = [];
    const scopeExpansions: ProgramMetadata[] = [];
    const upgradedPrograms: ProgramMetadata[] = [];

    const metadata = await this.state.loadMetadata();

    // Check each platform
    const platforms = ['hackerone', 'bugcrowd', 'intigriti', 'yeswehack'] as const;

    for (const platform of platforms) {
      console.log(`  Checking ${platform}...`);

      const fileKey = platform as keyof typeof CONFIG.files;
      const commitKey = platform as keyof TrackerState['tracked_commits'];

      const commits = await this.github.getCommitsSince(
        CONFIG.files[fileKey],
        currentState.last_check
      );

      if (commits.length === 0) {
        console.log(`    ✓ No changes`);
        continue;
      }

      console.log(`    🔄 ${commits.length} commits found`);

      // Fetch latest data to compare
      const latestData = await this.github.fetchFile(CONFIG.files[fileKey]);
      const programs = this.github.parsePrograms(latestData, platform);

      for (const program of programs) {
        const key = `${program.platform}:${program.handle}`;
        const existing = metadata.get(key);

        if (!existing) {
          // New program discovered
          const meta: ProgramMetadata = {
            name: program.name,
            platform: program.platform,
            handle: program.handle,
            url: program.url,
            offers_bounties: program.offers_bounties,
            key_scopes: program.key_scopes,
            discovered_at: new Date().toISOString(),
            max_severity: program.max_severity,
            change_type: 'new_program',
          };

          newPrograms.push(meta);
          metadata.set(key, meta);
        } else {
          // Check for upgrades or scope changes
          if (!existing.offers_bounties && program.offers_bounties) {
            const meta: ProgramMetadata = {
              ...existing,
              offers_bounties: true,
              discovered_at: new Date().toISOString(),
              change_type: 'upgraded_to_paid',
            };

            upgradedPrograms.push(meta);
            metadata.set(key, meta);
          } else if (program.key_scopes.length > existing.key_scopes.length) {
            const meta: ProgramMetadata = {
              ...existing,
              key_scopes: program.key_scopes,
              discovered_at: new Date().toISOString(),
              change_type: 'scope_expansion',
            };

            scopeExpansions.push(meta);
            metadata.set(key, meta);
          }
        }
      }

      // Update commit tracking
      const latestCommit = await this.github.getLatestCommit(CONFIG.files[fileKey]);
      if (latestCommit) {
        currentState.tracked_commits[commitKey] = latestCommit.sha;
      }
    }

    // Save updated metadata
    await this.state.saveMetadata(metadata);

    return {
      new_programs: newPrograms,
      scope_expansions: scopeExpansions,
      upgraded_programs: upgradedPrograms,
    };
  }

  /**
   * Get recent discoveries within a time window
   */
  async getRecentDiscoveries(hoursAgo: number = 24): Promise<ProgramMetadata[]> {
    const changes = await this.state.loadRecentChanges();
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hoursAgo);

    return changes.filter(p => {
      const discoveredDate = new Date(p.discovered_at);
      return discoveredDate >= cutoffDate;
    });
  }

  /**
   * Get all cached programs
   */
  async getAllPrograms(): Promise<ProgramMetadata[]> {
    const metadata = await this.state.loadMetadata();
    return Array.from(metadata.values());
  }

  /**
   * Search programs by name or platform
   */
  async searchPrograms(query: string): Promise<ProgramMetadata[]> {
    const metadata = await this.state.loadMetadata();
    const lowerQuery = query.toLowerCase();

    return Array.from(metadata.values()).filter(p =>
      p.name.toLowerCase().includes(lowerQuery) ||
      p.platform.toLowerCase().includes(lowerQuery) ||
      p.handle.toLowerCase().includes(lowerQuery)
    );
  }
}
