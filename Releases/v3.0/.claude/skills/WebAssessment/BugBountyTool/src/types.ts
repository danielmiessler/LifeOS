// Type definitions for bug bounty tracking system

export interface ProgramScope {
  asset_identifier: string;
  asset_type: string;
  eligible_for_bounty: boolean;
  eligible_for_submission: boolean;
  max_severity: string;
}

export interface Program {
  name: string;
  platform: 'hackerone' | 'bugcrowd' | 'intigriti' | 'yeswehack' | 'federacy';
  handle: string;
  url: string;
  website?: string;
  offers_bounties: boolean;
  offers_swag: boolean;
  submission_state: string;
  key_scopes: string[];
  discovered_at: string;
  max_severity?: string;
  managed_program?: boolean;
}

export interface ProgramMetadata {
  name: string;
  platform: string;
  handle: string;
  url: string;
  offers_bounties: boolean;
  key_scopes: string[];
  discovered_at: string;
  max_severity?: string;
  change_type?: 'new_program' | 'scope_expansion' | 'upgraded_to_paid';
}

export interface TrackerState {
  last_check: string;
  tracked_commits: {
    domains_txt: string;
    hackerone: string;
    bugcrowd: string;
    intigriti: string;
    yeswehack: string;
  };
  initialized: boolean;
}

export interface GitHubCommit {
  sha: string;
  commit: {
    author: {
      date: string;
      name: string;
    };
    message: string;
  };
}

export interface DiscoveryResult {
  new_programs: ProgramMetadata[];
  scope_expansions: ProgramMetadata[];
  upgraded_programs: ProgramMetadata[];
  total_checked: number;
  check_duration_ms: number;
}
