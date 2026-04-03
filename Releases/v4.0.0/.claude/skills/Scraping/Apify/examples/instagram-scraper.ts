#!/usr/bin/env bun

/**
 * Example: Instagram Scraper with Code-First Apify
 *
 * Demonstrates token savings through in-code filtering:
 * - MCP approach: ~57,000 tokens
 * - Code-first: ~1,000 tokens (98.2% reduction)
 */

import { Apify } from '../index'

async function main() {
  console.log('=== Apify Code-First Example: Instagram Scraper ===\n')

  // Initialize client (uses APIFY_TOKEN from environment)
  const apify = new Apify()

  try {
    // Step 1: Search for Instagram scraper actors
    console.log('1. Searching for Instagram scraper actors...')
    const actors = await apify.search('instagram scraper', { limit: 5 })

    console.log(`   Found ${actors.length} actors:`)
    actors.forEach((actor, i) => {
      console.log(`   ${i + 1}. ${actor.username}/${actor.name}`)
      console.log(`      ${actor.title}`)
      console.log(`      Stats: ${actor.stats.runs.total} runs, ${actor.stats.users.total} users\n`)
    })

    // Select the most popular actor
    const selectedActor = actors[0]
    console.log(`   Selected: ${selectedActor.username}/${selectedActor.name}\n`)

    // Step 2: Call the actor (execute scraping)
    console.log('2. Calling actor to scrape Instagram profiles...')
    console.log('   (This is a dry run - modify input for real scraping)')

    // Example input - modify for actual use
    const input = {
      // Instagram profile usernames to scrape
      profiles: ['example'],

      // Limit results to avoid excessive runtime/costs
      resultsLimit: 50,

      // Other common options
      // searchLimit: 10,
      // proxy: { useApifyProxy: true }
    }

    console.log('   Input:', JSON.stringify(input, null, 2))
    console.log('   Note: Using dry run mode (not actually executing)\n')

    // Uncomment to actually run:
    // const run = await apify.callActor(selectedActor.id, input, {
    //   memory: 2048,
    //   timeout: 300
    // })
    //
    // console.log(`   Run started: ${run.id}`)
    // console.log(`   Status: ${run.status}`)
    // console.log(`   Container URL: ${run.containerUrl}\n`)
    //
    // // Step 3: Wait for completion
    // console.log('3. Waiting for actor run to complete...')
    // await apify.waitForRun(selectedActor.id, run.id, { waitSecs: 300 })
    //
    // const finalRun = await apify.getRun(selectedActor.id, run.id)
    // console.log(`   Final status: ${finalRun.status}`)
    //
    // if (finalRun.status !== 'SUCCEEDED') {
    //   console.error('   Actor run failed!')
    //   process.exit(1)
    // }
    //
    // // Step 4: Get dataset and filter results IN CODE
    // console.log('\n4. Fetching and filtering results...')
    // const dataset = apify.getDataset(finalRun.defaultDatasetId)
    //
    // // Get all items
    // const allItems = await dataset.listItems({ limit: 100 })
    // console.log(`   Total items retrieved: ${allItems.length}`)
    //
    // // KEY: Filter in code BEFORE returning to model context
    // const yesterday = Date.now() - 86400000 // 24 hours ago
    // const filtered = allItems
    //   .filter(post => post.likesCount > 1000) // High engagement
    //   .filter(post => post.timestamp > yesterday) // Recent
    //   .sort((a, b) => b.likesCount - a.likesCount) // Top first
    //   .slice(0, 10) // Top 10
    //
    // console.log(`   Filtered to top ${filtered.length} high-engagement recent posts\n`)
    //
    // // Step 5: Show token savings
    // const estimateTokens = (data: any) => {
    //   return Math.ceil(JSON.stringify(data).length / 4)
    // }
    //
    // const mcpTokens = estimateTokens(allItems)
    // const codeTokens = estimateTokens(filtered)
    // const savings = ((mcpTokens - codeTokens) / mcpTokens * 100).toFixed(1)
    //
    // console.log('=== Token Savings ===')
    // console.log(`MCP approach (all items): ~${mcpTokens} tokens`)
    // console.log(`Code-first (filtered):    ~${codeTokens} tokens`)
    // console.log(`Savings:                  ${savings}%`)
    //
    // // Return filtered results (only these reach model context)
    // return filtered

    console.log('3. Dry run complete!')
    console.log('   Uncomment the code above to actually execute the scraper.')
    console.log('   Make sure to:')
    console.log('   - Set valid Instagram profile usernames')
    console.log('   - Have sufficient Apify credits')
    console.log('   - Review actor documentation for input schema\n')

  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

// Run if executed directly
if (import.meta.main) {
  main()
}

export { main }
