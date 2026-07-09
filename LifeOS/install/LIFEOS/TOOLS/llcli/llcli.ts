#!/usr/bin/env bun

/**
 * llcli - Limitless.ai API Command-Line Interface
 *
 * A clean, documented CLI for accessing Limitless.ai pendant recordings
 *
 * @author {{PRINCIPAL_FULL_NAME}}
 * @version 1.0.0
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Normalize env path vars that Claude Code injects without shell expansion (LifeOS#1404)
for (const k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const v = process.env[k];
  if (v && /^\$\{?HOME\}?(\/|$)/.test(v)) process.env[k] = v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}


// ============================================================================
// Types
// ============================================================================

interface LifelogResponse {
  data: {
    lifelogs: Lifelog[];
  };
}

interface Lifelog {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  markdown: string;
  isStarred: boolean;
  updatedAt: string;
}

interface Config {
  apiKey: string;
  timezone: string;
  baseUrl: string;
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULTS = {
  timezone: 'America/Los_Angeles',
  baseUrl: 'https://api.limitless.ai/v1',
  limit: 20,
};

/**
 * Load configuration from environment
 */
function loadConfig(): Config {
  const envPath = process.env.LIFEOS_CONFIG_DIR ? join(process.env.LIFEOS_CONFIG_DIR, '.env') : join(homedir(), '.claude', '.env');

  try {
    const envContent = readFileSync(envPath, 'utf-8');
    const apiKey = envContent
      .split('\n')
      .find(line => line.startsWith('LIMITLESS_API_KEY='))
      ?.split('=')[1]
      ?.trim();

    if (!apiKey) {
      console.error('Error: LIMITLESS_API_KEY not found in ~/.claude/.env');
      process.exit(1);
    }

    return {
      apiKey,
      timezone: DEFAULTS.timezone,
      baseUrl: DEFAULTS.baseUrl,
    };
  } catch (error) {
    console.error(`Error: Cannot read ~/.claude/.env file`);
    console.error('Make sure LIMITLESS_API_KEY is set in ~/.claude/.env');
    process.exit(1);
  }
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch lifelogs from Limitless.ai API
 */
async function fetchLifelogs(
  config: Config,
  params: Record<string, string>
): Promise<LifelogResponse> {
  const queryParams = new URLSearchParams(params);
  const url = `${config.baseUrl}/lifelogs?${queryParams}`;

  try {
    const response = await fetch(url, {
      headers: {
        'X-API-Key': config.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching lifelogs:', error);
    process.exit(1);
  }
}

// ============================================================================
// CLI Commands
// ============================================================================

/**
 * Fetch today's recordings
 */
async function fetchToday(limit: number = DEFAULTS.limit): Promise<void> {
  const config = loadConfig();
  const today = new Date().toISOString().split('T')[0];

  const params = {
    date: today,
    timezone: config.timezone,
    limit: limit.toString(),
  };

  const data = await fetchLifelogs(config, params);
  console.log(JSON.stringify(data, null, 2));
}

/**
 * Fetch recordings for a specific date
 */
async function fetchDate(date: string, limit: number = DEFAULTS.limit): Promise<void> {
  const config = loadConfig();

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    console.error('Error: Date must be in YYYY-MM-DD format');
    process.exit(1);
  }

  const params = {
    date,
    timezone: config.timezone,
    limit: limit.toString(),
  };

  const data = await fetchLifelogs(config, params);
  console.log(JSON.stringify(data, null, 2));
}

/**
 * Search recordings by keyword
 */
async function fetchSearch(keyword: string, limit: number = DEFAULTS.limit): Promise<void> {
  const config = loadConfig();

  if (!keyword || keyword.trim() === '') {
    console.error('Error: Search keyword cannot be empty');
    process.exit(1);
  }

  const params = {
    search: keyword,
    timezone: config.timezone,
    limit: limit.toString(),
  };

  const data = await fetchLifelogs(config, params);
  console.log(JSON.stringify(data, null, 2));
}

// ============================================================================
// Help Documentation
// ============================================================================

function showHelp(): void {
  console.log(`
llcli - Limitless.ai API Command-Line Interface
================================================

A clean, deterministic CLI for accessing Limitless pendant recordings.

USAGE:
  llcli <command> [options]

COMMANDS:
  today [--limit N]              Fetch today's recordings (default: 20)
  date <YYYY-MM-DD> [--limit N]  Fetch recordings for specific date
  search <keyword> [--limit N]   Search recordings by keyword
  help, --help, -h               Show this help message
  version, --version, -v         Show version information

OPTIONS:
  --limit N                      Maximum number of results (default: 20)

EXAMPLES:
  # Fetch today's recordings
  llcli today

  # Fetch today's recordings with custom limit
  llcli today --limit 50

  # Fetch recordings for a specific date
  llcli date 2025-11-17

  # Search for recordings containing "AI"
  llcli search "AI agents"

  # Search with custom limit
  llcli search "consulting" --limit 100

OUTPUT:
  All commands return JSON to stdout
  Errors and messages go to stderr
  Exit code 0 on success, 1 on error

CONFIGURATION:
  API Key:   ~/.claude/.env (LIMITLESS_API_KEY=your_key)
  Timezone:  America/Los_Angeles (Pacific Time)
  Base URL:  https://api.limitless.ai/v1

RESPONSE FORMAT:
  {
    "data": {
      "lifelogs": [
        {
          "id": "string",
          "title": "string",
          "startTime": "ISO 8601 timestamp",
          "endTime": "ISO 8601 timestamp",
          "markdown": "full transcript",
          "isStarred": boolean,
          "updatedAt": "ISO 8601 timestamp"
        }
      ]
    }
  }

PHILOSOPHY:
  llcli follows LifeOS's CLI-First Architecture:
  - Deterministic: Same input → Same output
  - Clean: Single responsibility (API calls only)
  - Composable: JSON output pipes to jq, grep, etc.
  - Documented: Full help and examples
  - Testable: Predictable behavior

For more information, see ~/.claude/LIFEOS/TOOLS/llcli/README.md

Version: 1.0.0
Author: {{PRINCIPAL_FULL_NAME}}
`);
}

function showVersion(): void {
  console.log('llcli version 1.0.0');
}

// ============================================================================
// Main CLI Entry Point
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
    showHelp();
    return;
  }

  if (args[0] === 'version' || args[0] === '--version' || args[0] === '-v') {
    showVersion();
    return;
  }

  const command = args[0];

  // Parse --limit option
  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex !== -1 && args[limitIndex + 1]
    ? parseInt(args[limitIndex + 1], 10)
    : DEFAULTS.limit;

  if (limitIndex !== -1 && (isNaN(limit) || limit <= 0)) {
    console.error('Error: --limit must be a positive number');
    process.exit(1);
  }

  switch (command) {
    case 'today':
      await fetchToday(limit);
      break;

    case 'date':
      if (!args[1] || args[1].startsWith('--')) {
        console.error('Error: date command requires a date argument (YYYY-MM-DD)');
        process.exit(1);
      }
      await fetchDate(args[1], limit);
      break;

    case 'search':
      if (!args[1] || args[1].startsWith('--')) {
        console.error('Error: search command requires a keyword argument');
        process.exit(1);
      }
      await fetchSearch(args[1], limit);
      break;

    default:
      console.error(`Error: Unknown command '${command}'`);
      console.error('Run "llcli --help" for usage information');
      process.exit(1);
  }
}

// Run CLI
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
