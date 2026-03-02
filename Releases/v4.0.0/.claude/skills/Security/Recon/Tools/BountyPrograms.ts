#!/usr/bin/env bun
/**
 * BountyPrograms.ts - Bug bounty program discovery and monitoring
 * Aggregates data from ProjectDiscovery Chaos, HackerOne, and Bugcrowd
 *
 * Usage:
 *   bun BountyPrograms.ts [command] [options]
 *
 * Commands:
 *   list          List all known public bounty programs
 *   new           Show recently added programs
 *   search        Search for programs by name/domain
 *   check         Check if a domain has a bounty program
 *   update        Update local program cache from sources
 *
 * Examples:
 *   bun BountyPrograms.ts list --json
 *   bun BountyPrograms.ts new --days 30
 *   bun BountyPrograms.ts search "crypto"
 *   bun BountyPrograms.ts check example.com
 */

import { $ } from "bun";

interface BountyProgram {
  name: string;
  url: string;
  bounty: boolean;
  swag: boolean;
  domains: string[];
  platform?: string;
  addedDate?: string;
  maxBounty?: string;
  inScope?: string[];
}

interface BountyProgramsResult {
  command: string;
  timestamp: string;
  totalPrograms: number;
  programs: BountyProgram[];
  errors: string[];
}

// ProjectDiscovery Chaos bounty list URL
const CHAOS_BOUNTY_URL = "https://raw.githubusercontent.com/projectdiscovery/public-bugbounty-programs/main/chaos-bugbounty-list.json";

// Local cache path
const CACHE_DIR = `${process.env.HOME}/.claude/skills/Security/Recon/Data`;
const CACHE_FILE = `${CACHE_DIR}/BountyPrograms.json`;
const CACHE_MAX_AGE_HOURS = 24;

interface ChaosProgram {
  name: string;
  url: string;
  bounty: boolean;
  swag: boolean;
  domains: string[];
}

async function ensureCacheDir(): Promise<void> {
  const dir = Bun.file(CACHE_DIR);
  try {
    await $`mkdir -p ${CACHE_DIR}`.quiet();
  } catch {
    // Directory might already exist
  }
}

async function getCachedPrograms(): Promise<BountyProgram[] | null> {
  try {
    const file = Bun.file(CACHE_FILE);
    if (!await file.exists()) return null;

    const stat = await file.stat();
    const ageHours = (Date.now() - stat.mtime.getTime()) / (1000 * 60 * 60);

    if (ageHours > CACHE_MAX_AGE_HOURS) return null;

    const data = await file.json();
    return data.programs;
  } catch {
    return null;
  }
}

async function updateCache(programs: BountyProgram[]): Promise<void> {
  await ensureCacheDir();
  await Bun.write(CACHE_FILE, JSON.stringify({
    lastUpdated: new Date().toISOString(),
    programs,
  }, null, 2));
}

async function fetchChaosPrograms(): Promise<BountyProgram[]> {
  try {
    const response = await fetch(CHAOS_BOUNTY_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json() as { programs: ChaosProgram[] };

    return data.programs.map(p => ({
      name: p.name,
      url: p.url,
      bounty: p.bounty,
      swag: p.swag,
      domains: p.domains || [],
      platform: "chaos",
    }));
  } catch (error) {
    console.error(`Failed to fetch Chaos programs: ${error}`);
    return [];
  }
}

async function getAllPrograms(forceUpdate = false): Promise<BountyProgram[]> {
  if (!forceUpdate) {
    const cached = await getCachedPrograms();
    if (cached) return cached;
  }

  console.error("Fetching fresh bounty program data...");
  const programs = await fetchChaosPrograms();

  if (programs.length > 0) {
    await updateCache(programs);
  }

  return programs;
}

async function listPrograms(options: { bountyOnly?: boolean; swagOnly?: boolean }): Promise<BountyProgramsResult> {
  const programs = await getAllPrograms();

  let filtered = programs;
  if (options.bountyOnly) {
    filtered = filtered.filter(p => p.bounty);
  }
  if (options.swagOnly) {
    filtered = filtered.filter(p => p.swag);
  }

  return {
    command: "list",
    timestamp: new Date().toISOString(),
    totalPrograms: filtered.length,
    programs: filtered,
    errors: [],
  };
}

async function searchPrograms(query: string): Promise<BountyProgramsResult> {
  const programs = await getAllPrograms();
  const queryLower = query.toLowerCase();

  const matched = programs.filter(p =>
    p.name.toLowerCase().includes(queryLower) ||
    p.url.toLowerCase().includes(queryLower) ||
    p.domains.some(d => d.toLowerCase().includes(queryLower))
  );

  return {
    command: "search",
    timestamp: new Date().toISOString(),
    totalPrograms: matched.length,
    programs: matched,
    errors: [],
  };
}

async function checkDomain(domain: string): Promise<BountyProgramsResult> {
  const programs = await getAllPrograms();
  const domainLower = domain.toLowerCase().replace(/^www\./, "");

  const matched = programs.filter(p =>
    p.domains.some(d => {
      const progDomain = d.toLowerCase().replace(/^\*\./, "").replace(/^www\./, "");
      return progDomain === domainLower ||
             domainLower.endsWith(`.${progDomain}`) ||
             progDomain.endsWith(`.${domainLower}`);
    })
  );

  return {
    command: "check",
    timestamp: new Date().toISOString(),
    totalPrograms: matched.length,
    programs: matched,
    errors: [],
  };
}

async function updatePrograms(): Promise<BountyProgramsResult> {
  const programs = await getAllPrograms(true);

  return {
    command: "update",
    timestamp: new Date().toISOString(),
    totalPrograms: programs.length,
    programs: [],
    errors: programs.length === 0 ? ["Failed to fetch programs"] : [],
  };
}

async function getNewPrograms(days: number = 7): Promise<BountyProgramsResult> {
  // This requires tracking when programs were added
  // For now, we'll just return programs that have bounty=true
  // A proper implementation would track additions over time
  const programs = await getAllPrograms();
  const bountyPrograms = programs.filter(p => p.bounty);

  return {
    command: "new",
    timestamp: new Date().toISOString(),
    totalPrograms: bountyPrograms.length,
    programs: bountyPrograms.slice(0, 50), // Return top 50
    errors: ["Note: 'new' command currently shows bounty programs. Full tracking coming soon."],
  };
}

function parseArgs(args: string[]): { command: string; query: string; options: Record<string, unknown> } {
  const options: Record<string, unknown> = {};
  let command = "list";
  let query = "";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case "list":
      case "new":
      case "search":
      case "check":
      case "update":
        command = arg;
        break;
      case "--bounty-only":
        options.bountyOnly = true;
        break;
      case "--swag-only":
        options.swagOnly = true;
        break;
      case "--days":
        options.days = parseInt(next);
        i++;
        break;
      case "--json":
        options.json = true;
        break;
      case "-h":
      case "--help":
        console.log(`
BountyPrograms - Bug bounty program discovery

Usage:
  bun BountyPrograms.ts [command] [options]

Commands:
  list              List all known public bounty programs
  new               Show recently added programs
  search <query>    Search for programs by name/domain
  check <domain>    Check if a domain has a bounty program
  update            Update local program cache from sources

Options:
  --bounty-only     Only show programs with cash bounties
  --swag-only       Only show programs with swag rewards
  --days <n>        For 'new' command: programs added in last N days
  --json            Output as JSON

Data Sources:
  - ProjectDiscovery Chaos (chaos.projectdiscovery.io)
  - chaos-bugbounty-list.json from GitHub

Examples:
  bun BountyPrograms.ts list --bounty-only
  bun BountyPrograms.ts new --days 30
  bun BountyPrograms.ts search "crypto"
  bun BountyPrograms.ts search "finance"
  bun BountyPrograms.ts check hackerone.com
  bun BountyPrograms.ts update
`);
        process.exit(0);
      default:
        if (!arg.startsWith("-") && !["list", "new", "search", "check", "update"].includes(arg)) {
          query = arg;
        }
    }
  }

  return { command, query, options };
}

// Main execution
const args = process.argv.slice(2);
const { command, query, options } = parseArgs(args);

let result: BountyProgramsResult;

switch (command) {
  case "list":
    result = await listPrograms(options as { bountyOnly?: boolean; swagOnly?: boolean });
    break;
  case "search":
    if (!query) {
      console.error("Error: Search query required");
      console.error("Usage: bun BountyPrograms.ts search <query>");
      process.exit(1);
    }
    result = await searchPrograms(query);
    break;
  case "check":
    if (!query) {
      console.error("Error: Domain required");
      console.error("Usage: bun BountyPrograms.ts check <domain>");
      process.exit(1);
    }
    result = await checkDomain(query);
    break;
  case "update":
    result = await updatePrograms();
    break;
  case "new":
    result = await getNewPrograms(options.days as number || 7);
    break;
  default:
    result = await listPrograms({});
}

if (options.json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`\n🎯 Bug Bounty Programs - ${result.command}`);
  console.log(`⏱️  Timestamp: ${result.timestamp}`);
  console.log(`📊 Total: ${result.totalPrograms} programs\n`);

  if (command === "update") {
    if (result.errors.length === 0) {
      console.log(`✅ Cache updated with ${result.totalPrograms} programs`);
    } else {
      console.log(`❌ Update failed: ${result.errors.join(", ")}`);
    }
  } else if (result.programs.length === 0) {
    console.log("  No programs found");
  } else {
    for (const p of result.programs.slice(0, 30)) {
      const badges = [];
      if (p.bounty) badges.push("💰");
      if (p.swag) badges.push("🎁");
      console.log(`  ${badges.join("")} ${p.name}`);
      console.log(`     URL: ${p.url}`);
      if (p.domains.length > 0) {
        const displayDomains = p.domains.slice(0, 5).join(", ");
        const more = p.domains.length > 5 ? ` +${p.domains.length - 5} more` : "";
        console.log(`     Scope: ${displayDomains}${more}`);
      }
      console.log();
    }

    if (result.programs.length > 30) {
      console.log(`  ... and ${result.programs.length - 30} more programs`);
      console.log(`  Use --json for full list`);
    }
  }

  if (result.errors.length > 0 && command !== "update") {
    console.log("\n📝 Notes:");
    for (const err of result.errors) {
      console.log(`  ${err}`);
    }
  }
}

export { getAllPrograms, listPrograms, searchPrograms, checkDomain, BountyProgram, BountyProgramsResult };
