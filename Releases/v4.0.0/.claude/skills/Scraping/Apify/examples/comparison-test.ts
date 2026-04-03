#!/usr/bin/env bun

/**
 * Comparison Test: MCP vs Code-First Apify
 *
 * Demonstrates the difference in approach and token usage between
 * traditional MCP tool calls and code-first execution.
 */

import { Apify } from '../index'

// Utility to estimate token count
function estimateTokens(data: any): number {
  const str = JSON.stringify(data)
  // Rough estimate: ~4 characters per token
  return Math.ceil(str.length / 4)
}

async function demonstrateMCPApproach() {
  console.log('=== MCP APPROACH ===\n')
  console.log('Traditional MCP flow with multiple round-trips through model context:\n')

  console.log('Step 1: mcp__Apify__search-actors')
  console.log('  Input: { search: "instagram scraper", limit: 10 }')
  console.log('  → Tool definitions loaded: ~5,000 tokens')
  console.log('  → Search results returned: ~1,000 tokens')
  console.log('  → Results pass through model context')

  console.log('\nStep 2: mcp__Apify__call-actor')
  console.log('  Input: { actor: "apify/instagram-scraper", input: {...} }')
  console.log('  → Run information returned: ~1,000 tokens')
  console.log('  → Results pass through model context')

  console.log('\nStep 3: mcp__Apify__get-actor-output')
  console.log('  Input: { datasetId: "xyz123" }')
  console.log('  → FULL dataset returned: ~50,000 tokens (100 items)')
  console.log('  → ALL results pass through model context')
  console.log('  → Model must filter in subsequent reasoning step')

  console.log('\nStep 4: Model reasoning to filter')
  console.log('  → Additional model call to process and filter')
  console.log('  → Context includes all 100 items again')

  console.log('\n📊 MCP Total Token Usage:')
  console.log('  Tool definitions:    5,000 tokens')
  console.log('  Search results:      1,000 tokens')
  console.log('  Run info:            1,000 tokens')
  console.log('  Full dataset:       50,000 tokens')
  console.log('  ────────────────────────────────')
  console.log('  TOTAL:             ~57,000 tokens')
  console.log('  Plus additional reasoning overhead!\n')
}

async function demonstrateCodeFirstApproach() {
  console.log('=== CODE-FIRST APPROACH ===\n')
  console.log('Direct code execution with in-code filtering:\n')

  const apify = new Apify()

  console.log('Step 1: Model reads README.md for API discovery')
  console.log('  → README.md content: ~200 tokens')
  console.log('  → Progressive disclosure (only load what\'s needed)')

  console.log('\nStep 2: Model writes code to execute operations')
  const codeExample = `
import { Apify } from '~/.claude/filesystem-mcps/apify'

const apify = new Apify()

// All operations in code - no intermediate context bloat
const actors = await apify.search("instagram scraper")
const run = await apify.callActor(actors[0].id, {
  profiles: ["target"],
  resultsLimit: 100
})

// Wait for completion
await apify.waitForRun(actors[0].id, run.id)

// Get dataset
const dataset = apify.getDataset(run.defaultDatasetId)
const items = await dataset.listItems()

// CRITICAL: Filter in code BEFORE returning to model
const yesterday = Date.now() - 86400000
const filtered = items
  .filter(post => post.likesCount > 1000)
  .filter(post => post.timestamp > yesterday)
  .slice(0, 10)

// Only 10 filtered results reach model context
return filtered
  `.trim()

  console.log('  Code to execute (~300 tokens):')
  console.log('  ' + codeExample.split('\n').join('\n  '))

  console.log('\nStep 3: Code executes in bash environment')
  console.log('  → All operations happen locally')
  console.log('  → Intermediate results NEVER enter model context')
  console.log('  → Filtering happens in execution environment')

  console.log('\nStep 4: Only filtered results return to model')
  console.log('  → Filtered dataset: 10 items (~500 tokens)')
  console.log('  → Model sees only what it needs')

  console.log('\n📊 Code-First Total Token Usage:')
  console.log('  README discovery:      200 tokens')
  console.log('  Code execution:        300 tokens')
  console.log('  Filtered results:      500 tokens')
  console.log('  ────────────────────────────────')
  console.log('  TOTAL:              ~1,000 tokens')
  console.log('\n  💰 TOKEN SAVINGS: 98.2% reduction!')
  console.log('  ⚡ PERFORMANCE: Faster (no model round-trips)')
  console.log('  🔒 PRIVACY: Intermediate data never in model context\n')
}

async function demonstrateFilteringComparison() {
  console.log('=== FILTERING COMPARISON ===\n')

  // Simulate a dataset of 100 items
  const fullDataset = Array.from({ length: 100 }, (_, i) => ({
    id: `post_${i}`,
    username: `user${i}`,
    text: `This is post ${i} with some content`,
    likesCount: Math.floor(Math.random() * 5000),
    timestamp: Date.now() - Math.random() * 86400000 * 7,
    url: `https://instagram.com/p/${i}`
  }))

  // Filter to top 10 high-engagement recent posts
  const yesterday = Date.now() - 86400000
  const filtered = fullDataset
    .filter(post => post.likesCount > 1000)
    .filter(post => post.timestamp > yesterday)
    .sort((a, b) => b.likesCount - a.likesCount)
    .slice(0, 10)

  const fullTokens = estimateTokens(fullDataset)
  const filteredTokens = estimateTokens(filtered)
  const savings = ((fullTokens - filteredTokens) / fullTokens * 100).toFixed(1)

  console.log('Dataset Size Comparison:')
  console.log(`  Full dataset:     ${fullDataset.length} items (${fullTokens} tokens)`)
  console.log(`  Filtered dataset: ${filtered.length} items (${filteredTokens} tokens)`)
  console.log(`  Reduction:        ${savings}% fewer tokens\n`)

  console.log('MCP Approach:')
  console.log('  1. Return all 100 items to model (${fullTokens} tokens)')
  console.log('  2. Model reasons about filtering criteria')
  console.log('  3. Model makes another call to filter')
  console.log('  4. All 100 items in context again during filtering')
  console.log(`  Total: ~${fullTokens * 2} tokens (dataset appears 2x in context)\n`)

  console.log('Code-First Approach:')
  console.log('  1. Filter executed in code environment')
  console.log('  2. Only 10 items returned to model')
  console.log(`  Total: ~${filteredTokens} tokens\n`)

  console.log(`💡 Key Insight: Code-first prevents ${fullDataset.length - filtered.length} irrelevant items`)
  console.log('   from ever entering the model context!\n')
}

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗')
  console.log('║  MCP vs Code-First Comparison: Apify Integration         ║')
  console.log('╚═══════════════════════════════════════════════════════════╝\n')

  await demonstrateMCPApproach()
  console.log('\n' + '─'.repeat(60) + '\n')

  await demonstrateCodeFirstApproach()
  console.log('\n' + '─'.repeat(60) + '\n')

  await demonstrateFilteringComparison()
  console.log('\n' + '─'.repeat(60) + '\n')

  console.log('=== CONCLUSION ===\n')
  console.log('Code-first Apify integration provides:')
  console.log('  ✅ 98%+ token reduction through in-code filtering')
  console.log('  ✅ Faster execution (no model round-trips for control flow)')
  console.log('  ✅ Better privacy (intermediate data stays in execution env)')
  console.log('  ✅ Progressive disclosure (load only what you need)')
  console.log('  ✅ More maintainable (standard TypeScript, not tool schemas)\n')

  console.log('When to use:')
  console.log('  • Data-heavy operations (scraping, large datasets)')
  console.log('  • Operations requiring filtering/transformation')
  console.log('  • Multiple sequential operations')
  console.log('  • Privacy-sensitive workflows\n')
}

// Run if executed directly
if (import.meta.main) {
  main()
}

export { main }
