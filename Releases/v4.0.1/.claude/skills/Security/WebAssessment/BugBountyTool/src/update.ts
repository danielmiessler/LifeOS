#!/usr/bin/env bun
// Update bug bounty programs

import { BugBountyTracker } from './tracker.js';

async function main() {
  const tracker = new BugBountyTracker();

  try {
    const results = await tracker.update();

    console.log('\n' + '='.repeat(60));
    console.log('📊 UPDATE SUMMARY');
    console.log('='.repeat(60));
    console.log(`🆕 New programs:        ${results.new_programs.length}`);
    console.log(`📈 Scope expansions:    ${results.scope_expansions.length}`);
    console.log(`💰 Upgraded to paid:    ${results.upgraded_programs.length}`);
    console.log(`✅ Platforms checked:   ${results.total_checked}`);
    console.log(`⏱️  Duration:            ${(results.check_duration_ms / 1000).toFixed(1)}s`);
    console.log('='.repeat(60));

    if (results.new_programs.length > 0) {
      console.log('\n🆕 NEW PROGRAMS:');
      results.new_programs.forEach((p, i) => {
        console.log(`\n${i + 1}. [${p.platform.toUpperCase()}] ${p.name}`);
        console.log(`   URL: ${p.url}`);
        console.log(`   Bounty: ${p.offers_bounties ? '💰 Yes' : '❌ No (VDP only)'}`);
        console.log(`   Max Severity: ${p.max_severity || 'Unknown'}`);
        console.log(`   Scopes: ${p.key_scopes.slice(0, 3).join(', ')}${p.key_scopes.length > 3 ? '...' : ''}`);
      });
    }

    if (results.upgraded_programs.length > 0) {
      console.log('\n💰 UPGRADED TO PAID:');
      results.upgraded_programs.forEach((p, i) => {
        console.log(`${i + 1}. [${p.platform.toUpperCase()}] ${p.name} - ${p.url}`);
      });
    }

    if (results.scope_expansions.length > 0) {
      console.log('\n📈 SCOPE EXPANSIONS:');
      results.scope_expansions.forEach((p, i) => {
        console.log(`${i + 1}. [${p.platform.toUpperCase()}] ${p.name} - ${p.key_scopes.length} scopes`);
      });
    }

  } catch (error) {
    console.error('❌ Update failed:', error);
    process.exit(1);
  }
}

main();
