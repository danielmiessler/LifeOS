#!/usr/bin/env bun

/**
 * Get latest tweets from any Twitter user using code-first Apify
 */

import { Apify } from '../index'

async function main() {
  const username = process.argv[2]
  const limit = parseInt(process.argv[3] || '5')

  if (!username) {
    console.error('Usage: bun get-user-tweets.ts <username> [limit]')
    console.error('Example: bun get-user-tweets.ts ThePrimeagen 5')
    process.exit(1)
  }

  console.log(`=== Getting Latest ${limit} Tweets from @${username} ===\n`)

  const apify = new Apify()

  try {
    // Use known working actor: apidojo/twitter-scraper-lite
    const TWITTER_ACTOR_ID = 'apidojo/twitter-scraper-lite'

    console.log(`1. Scraping @${username} profile...`)

    const input = {
      username,
      max_posts: limit,
      maxTweets: limit,
      maxItems: limit,
      resultsLimit: limit,
      tweetsDesired: limit,
      searchTerms: [`from:${username}`],
      startUrls: [`https://twitter.com/${username}`]
    }

    console.log(`   Fetching last ${limit} tweets...`)
    console.log('   (this may take 30-60 seconds)...')

    const run = await apify.callActor(TWITTER_ACTOR_ID, input, {
      memory: 2048,
      timeout: 120
    })

    console.log(`   Run ID: ${run.id}`)
    console.log()

    // Step 2: Wait for completion
    console.log('2. Waiting for scraper to finish...')
    await apify.waitForRun(run.id, { waitSecs: 120 })

    const finalRun = await apify.getRun(run.id)
    console.log(`   Status: ${finalRun.status}`)

    if (finalRun.status !== 'SUCCEEDED') {
      console.error('   Actor run did not succeed!')
      console.error('   Status:', finalRun.status)
      process.exit(1)
    }
    console.log()

    // Step 3: Get results
    console.log('3. Fetching results...')
    const dataset = apify.getDataset(finalRun.defaultDatasetId)
    const items = await dataset.listItems({ limit })

    console.log(`   Retrieved ${items.length} tweets`)
    console.log()

    if (items.length === 0) {
      console.log('   No tweets found.')
      return
    }

    // Step 4: Show the tweets
    console.log('4. Latest tweets:')
    console.log('   ════════════════════════════════════════')
    console.log()

    items.forEach((tweet, i) => {
      console.log(`   ${i + 1}/${items.length}:`)
      console.log(`   ${tweet.text || tweet.fullText}`)
      console.log()
      console.log(`   Posted: ${tweet.createdAt}`)
      if (tweet.url) {
        console.log(`   URL: ${tweet.url}`)
      }
      console.log('   ────────────────────────────────────────')
      console.log()
    })

    // Step 5: Show token savings
    const estimateTokens = (data: any) => {
      return Math.ceil(JSON.stringify(data).length / 4)
    }

    const totalTokens = estimateTokens(items)
    console.log('5. Token efficiency:')
    console.log(`   ${items.length} tweets: ~${totalTokens} tokens`)
    console.log(`   Filtered in code before model context`)
    console.log()

    console.log('✅ Successfully retrieved tweets using code-first Apify!')

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error)
    if (error instanceof Error && error.stack) {
      console.error('\nStack:', error.stack)
    }
    process.exit(1)
  }
}

if (import.meta.main) {
  main()
}

export { main }
