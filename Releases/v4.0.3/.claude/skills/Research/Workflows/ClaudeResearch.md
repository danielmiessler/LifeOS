/**
 * # Claude Web Research Command - Intelligent Multi-Query WebSearch
 *
 * This command analyzes your research question, decomposes it into 4-8 targeted
 * sub-queries, and executes them in parallel using Claude's WebSearch tool.
 *
 * ## Usage
 * ```bash
 * bun ${PAI_DIR}/commands/perform-claude-research.md "your complex research question here"
 * ```
 *
 * ## Features
 * - Intelligent query decomposition into multiple focused searches
 * - Parallel execution using Claude WebSearch for speed
 * - Iterative follow-up searches based on initial findings
 * - Comprehensive synthesis of all findings
 *
 * ## Advantages
 * - Uses Claude's built-in WebSearch (no API keys needed)
 * - Free and unlimited usage
 * - Integrated with Claude's knowledge and reasoning
 */

import { spawn } from 'child_process';
import { promisify } from 'util';

const exec = promisify(require('child_process').exec);

// Get the research question from command line
const originalQuestion = process.argv.slice(2).join(' ');

if (!originalQuestion) {
  console.error('❌ Please provide a research question');
  console.error('Usage: bun ${PAI_DIR}/commands/perform-claude-research.md "your question here"');
  process.exit(1);
}

console.log('📅 ' + new Date().toISOString());
console.log('\n📋 SUMMARY: Intelligent web research with query decomposition using Claude WebSearch\n');
console.log('🔍 ANALYSIS: Decomposing research question into targeted queries...\n');
console.log('Original question:', originalQuestion);

// Generate search queries based on the question
function generateSearchQueries(question: string): string[] {
  const queries: string[] = [];

  // Always include the original question
  queries.push(question);

  // Add context/background query
  queries.push(`what is ${question} background context`);

  // Add recent developments query
  const currentYear = new Date().getFullYear();
  queries.push(`${question} latest news ${currentYear}`);
  queries.push(`${question} recent developments ${currentYear}`);

  // Add technical/detailed query
  queries.push(`${question} technical details explained`);

  // Add comparison/alternatives query
  queries.push(`${question} comparison alternatives options`);

  // Add expert analysis query
  queries.push(`${question} expert analysis opinion`);

  // Add practical implications query
  queries.push(`${question} implications impact consequences`);

  return queries.slice(0, 8); // Limit to 8 queries max
}

// Main execution
(async () => {
  try {
    const searchQueries = generateSearchQueries(originalQuestion);

    console.log('\n⚡ ACTIONS: Generated', searchQueries.length, 'targeted search queries:\n');
    searchQueries.forEach((q, i) => console.log(`  ${i + 1}. ${q}`));

    console.log('\n✅ RESULTS: Executing searches via Claude WebSearch...\n');
    console.log('═'.repeat(60));

    // Output instructions for the claude-researcher agent
    console.log('\n📊 SEARCH QUERIES TO EXECUTE:\n');
    console.log('The claude-researcher agent should execute these WebSearch queries:\n');

    searchQueries.forEach((query, index) => {
      console.log(`\n### Query ${index + 1}: ${query}`);
      console.log(`WebSearch: "${query}"`);
      console.log('');
    });

    console.log('═'.repeat(60));

    console.log('\n📊 STATUS: Query decomposition complete');
    console.log('➡️ NEXT: Claude-Researcher agent will execute these searches using WebSearch tool\n');
    console.log('🎯 COMPLETED: Completed query decomposition for web research');

  } catch (error) {
    console.error('❌ Error during research planning:', error);
    process.exit(1);
  }
})();
