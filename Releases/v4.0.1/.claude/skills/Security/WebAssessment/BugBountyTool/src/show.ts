#!/usr/bin/env bun
// Show recent bug bounty discoveries

import { BugBountyTracker } from './tracker.js';

async function main() {
  const args = process.argv.slice(2);
  const tracker = new BugBountyTracker();

  try {
    // Parse arguments
    let hours = 24; // Default to last 24 hours
    let searchQuery = '';

    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--last' && args[i + 1]) {
        const value = args[i + 1];
        if (value.endsWith('h')) {
          hours = parseInt(value.slice(0, -1));
        } else if (value.endsWith('d')) {
          hours = parseInt(value.slice(0, -1)) * 24;
        } else {
          hours = parseInt(value);
        }
        i++;
      } else if (args[i] === '--search' && args[i + 1]) {
        searchQuery = args[i + 1];
        i++;
      } else if (args[i] === '--all') {
        hours = 24 * 365; // Show everything
      }
    }

    let programs;

    if (searchQuery) {
      console.log(`🔍 Searching for: "${searchQuery}"\n`);
      programs = await tracker.searchPrograms(searchQuery);
    } else {
      console.log(`📋 Bug bounty programs discovered in the last ${hours}h\n`);
      programs = await tracker.getRecentDiscoveries(hours);
    }

    if (programs.length === 0) {
      console.log('No programs found.');
      return;
    }

    programs.forEach((p, i) => {
      console.log(`${i + 1}. [${p.platform.toUpperCase()}] ${p.name}${p.change_type ? ` (${p.change_type.replace(/_/g, ' ')})` : ''}`);
      console.log(`   URL: ${p.url}`);
      console.log(`   Bounty: ${p.offers_bounties ? '💰 Paid' : '❌ VDP only'}`);

      if (p.max_severity) {
        const severityEmoji = {
          critical: '🔴',
          high: '🟠',
          medium: '🟡',
          low: '🟢',
        }[p.max_severity] || '⚪';
        console.log(`   Max Severity: ${severityEmoji} ${p.max_severity.toUpperCase()}`);
      }

      console.log(`   Scopes (${p.key_scopes.length}):`);
      p.key_scopes.slice(0, 5).forEach(scope => {
        console.log(`     - ${scope}`);
      });

      if (p.key_scopes.length > 5) {
        console.log(`     ... and ${p.key_scopes.length - 5} more`);
      }

      console.log(`   Discovered: ${new Date(p.discovered_at).toLocaleString()}`);
      console.log('');
    });

    console.log(`\nTotal: ${programs.length} program(s)`);

    console.log('\n💡 Tip: Use "initiate-recon <number>" to start testing a program');

  } catch (error) {
    console.error('❌ Failed to show programs:', error);
    process.exit(1);
  }
}

main();
