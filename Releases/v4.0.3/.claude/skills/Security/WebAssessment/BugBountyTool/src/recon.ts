#!/usr/bin/env bun
// Initiate reconnaissance on a bug bounty program

import { BugBountyTracker } from './tracker.js';
import { writeFile } from 'fs/promises';
import { CONFIG } from './config.js';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: bun run recon.ts <program_number>');
    console.error('Example: bun run recon.ts 1');
    process.exit(1);
  }

  const programIndex = parseInt(args[0]) - 1;

  if (isNaN(programIndex) || programIndex < 0) {
    console.error('Invalid program number');
    process.exit(1);
  }

  const tracker = new BugBountyTracker();

  try {
    // Get recent programs
    const programs = await tracker.getRecentDiscoveries(24 * 7); // Last 7 days

    if (programIndex >= programs.length) {
      console.error(`Program #${programIndex + 1} not found. Only ${programs.length} programs available.`);
      process.exit(1);
    }

    const program = programs[programIndex];

    console.log('🎯 INITIATING RECONNAISSANCE\n');
    console.log(`Target: ${program.name}`);
    console.log(`Platform: ${program.platform.toUpperCase()}`);
    console.log(`URL: ${program.url}`);
    console.log(`Bounty: ${program.offers_bounties ? '💰 Paid' : '❌ VDP only'}`);
    console.log(`Scopes: ${program.key_scopes.length} domains\n`);

    // Create recon configuration file
    const reconConfig = {
      program: {
        name: program.name,
        platform: program.platform,
        url: program.url,
        offers_bounties: program.offers_bounties,
      },
      scopes: program.key_scopes,
      max_severity: program.max_severity,
      discovered_at: program.discovered_at,
      recon_started_at: new Date().toISOString(),
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const configPath = `${CONFIG.paths.logs}/recon-${program.handle}-${timestamp}.json`;

    await writeFile(configPath, JSON.stringify(reconConfig, null, 2));

    console.log(`📝 Recon configuration saved to:`);
    console.log(`   ${configPath}\n`);

    // Generate pentester agent prompt
    console.log('🤖 PENTESTER AGENT INSTRUCTIONS:\n');
    console.log('Use this information to launch the pentester agent:\n');

    console.log('```typescript');
    console.log(`// Target: ${program.name}`);
    console.log(`// Platform: ${program.platform}`);
    console.log(`// Program URL: ${program.url}`);
    console.log(`// Bounty Type: ${program.offers_bounties ? 'Paid Bounty' : 'VDP Only'}`);
    console.log('');
    console.log('const scopes = [');
    program.key_scopes.slice(0, 10).forEach(scope => {
      console.log(`  "${scope}",`);
    });
    if (program.key_scopes.length > 10) {
      console.log(`  // ... and ${program.key_scopes.length - 10} more scopes`);
    }
    console.log('];');
    console.log('```\n');

    console.log('📋 RECOMMENDED RECONNAISSANCE WORKFLOW:\n');
    console.log('Phase 1: Asset Discovery');
    console.log('  - Subdomain enumeration (Amass, Subfinder)');
    console.log('  - Live host validation (httpx)');
    console.log('  - Port scanning (nmap)');
    console.log('  - Technology detection (Wappalyzer, whatweb)');
    console.log('');
    console.log('Phase 2: Content Discovery');
    console.log('  - Directory/file fuzzing (ffuf, dirsearch)');
    console.log('  - JavaScript analysis (LinkFinder, JSFinder)');
    console.log('  - API endpoint discovery (Kiterunner)');
    console.log('');
    console.log('Phase 3: Vulnerability Scanning');
    console.log('  - Nuclei templates');
    console.log('  - Custom security checks');
    console.log('  - Manual testing of interesting findings');
    console.log('');

    console.log('💡 NEXT STEPS:\n');
    console.log('1. Review program rules and guidelines:');
    console.log(`   ${program.url}`);
    console.log('');
    console.log('2. Launch pentester agent with scopes:');
    console.log(`   Task: "Do recon on ${program.name} bug bounty program"`);
    console.log(`   Scopes: ${program.key_scopes.slice(0, 3).join(', ')}...`);
    console.log('');
    console.log('3. Document findings and submit reports');
    console.log('');

    console.log('⚠️  IMPORTANT REMINDERS:\n');
    console.log('  - Only test in-scope assets');
    console.log('  - Follow responsible disclosure guidelines');
    console.log('  - Check for rate limiting requirements');
    console.log('  - Do not perform DoS attacks');
    console.log('  - Respect program rules and boundaries');
    console.log('');

  } catch (error) {
    console.error('❌ Failed to initiate reconnaissance:', error);
    process.exit(1);
  }
}

main();
