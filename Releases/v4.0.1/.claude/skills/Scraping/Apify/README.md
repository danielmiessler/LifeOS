# Apify Code-First API

**Code-based replacement for token-heavy Apify MCP calls.**

Progressive disclosure interface for web scraping and automation via the Apify platform. Filter data in code before returning to model context for massive token savings.

## Quick Start

```typescript
import { Apify } from '~/.claude/filesystem-mcps/apify'

const apify = new Apify(process.env.APIFY_TOKEN)

// Search for actors
const actors = await apify.search("instagram scraper")

// Call an actor
const run = await apify.callActor(actors[0].id, {
  profiles: ["target"],
  resultsLimit: 100
})

// Get and filter results IN CODE (key to token savings!)
const dataset = await apify.getDataset(run.defaultDatasetId)
const items = await dataset.listItems()

// Only filtered results reach model context
const relevant = items
  .filter(item => item.likesCount > 1000)
  .filter(item => item.timestamp > Date.now() - 86400000)
  .slice(0, 10)

console.log(relevant) // Only 10 items vs 100+ unfiltered
```

## Why Code-First?

**Token Comparison:**

**MCP Approach** (~57,000 tokens):
```
1. mcp__Apify__search-actors → 1,000 tokens result
2. mcp__Apify__call-actor → 1,000 tokens result
3. mcp__Apify__get-actor-output → 50,000 tokens unfiltered dataset
```

**Code-First** (~1,000 tokens - 98.2% reduction):
```typescript
// All operations in code, filter before returning
const filtered = items.filter(...).slice(0, 10)
// Only 10 filtered items (500 tokens) reach model
```

## Core API

### Apify Class

Main client for interacting with Apify platform.

**Constructor:**
```typescript
new Apify(token?: string)
```
- `token` - Apify API token (defaults to `process.env.APIFY_TOKEN`)

**Methods:**

#### `search(query, options?)`
Search for actors by keyword.

```typescript
const actors = await apify.search("instagram scraper", {
  limit: 10,
  offset: 0
})
```

**Parameters:**
- `query` - Search keywords
- `options.limit` - Max results (default: 10)
- `options.offset` - Skip results (default: 0)

**Returns:** Array of Actor objects with id, name, title, description, stats

#### `callActor(actorId, input, options?)`
Execute an actor.

```typescript
const run = await apify.callActor("apify/instagram-scraper", {
  profiles: ["target"],
  resultsLimit: 100
}, {
  memory: 2048,
  timeout: 300
})
```

**Parameters:**
- `actorId` - Actor ID or "username/actor-name"
- `input` - Actor-specific input configuration
- `options.memory` - Memory in MB (128, 256, 512, 1024, 2048, etc.)
- `options.timeout` - Timeout in seconds
- `options.build` - Build number or tag

**Returns:** ActorRun object with run details and `defaultDatasetId`

#### `getDataset(datasetId)`
Get dataset interface for reading/filtering data.

```typescript
const dataset = await apify.getDataset(run.defaultDatasetId)
```

**Returns:** ApifyDataset instance

#### `getRun(actorId, runId)`
Get run status.

```typescript
const run = await apify.getRun(actorId, runId)
```

**Returns:** ActorRun object with current status

#### `waitForRun(actorId, runId, options?)`
Wait for run to finish.

```typescript
const finalRun = await apify.waitForRun(actorId, runId, {
  waitSecs: 120
})
```

**Returns:** Final ActorRun object when complete

### ApifyDataset Class

Interface for reading and filtering dataset results.

**Key Concept:** Filter in code BEFORE returning to model context!

**Methods:**

#### `listItems(options?)`
List dataset items with pagination.

```typescript
const items = await dataset.listItems({
  offset: 0,
  limit: 100,
  fields: ['username', 'likesCount', 'text']
})
```

**Parameters:**
- `options.offset` - Skip items
- `options.limit` - Max items
- `options.fields` - Include only these fields
- `options.omit` - Exclude these fields
- `options.clean` - Clean HTML/special chars

**Returns:** Array of dataset items

#### `getAllItems()`
Get all items (handles pagination automatically).

**Warning:** For large datasets, use `listItems()` with limit or filter in code.

```typescript
const allItems = await dataset.getAllItems()
const filtered = allItems.filter(item => item.score > 0.8)
```

**Returns:** Array of all dataset items

#### `filter(predicate)`
Helper to filter items by predicate.

```typescript
const relevant = await dataset.filter(item =>
  item.likesCount > 1000 &&
  item.timestamp > Date.now() - 86400000
)
```

**Parameters:**
- `predicate` - Filter function `(item) => boolean`

**Returns:** Filtered items array

#### `top(sortFn, limit)`
Helper to get top N items by sort function.

```typescript
const topPosts = await dataset.top(
  (a, b) => b.likesCount - a.likesCount,
  10
)
```

**Parameters:**
- `sortFn` - Sort comparison function
- `limit` - Number of items to return

**Returns:** Top N sorted items

## Common Patterns

### Pattern 1: Search → Call → Filter Results

```typescript
// Find actor
const actors = await apify.search("web scraper")
const actor = actors[0]

// Execute actor
const run = await apify.callActor(actor.id, {
  startUrls: ["https://example.com"],
  maxPages: 50
})

// Wait for completion
await apify.waitForRun(actor.id, run.id)

// Get and filter results
const dataset = apify.getDataset(run.defaultDatasetId)
const items = await dataset.listItems({ limit: 100 })

// Filter in code - only relevant items reach model
const relevant = items
  .filter(item => item.price < 100)
  .filter(item => item.inStock)
  .slice(0, 10)
```

### Pattern 2: Process Large Dataset in Chunks

```typescript
const dataset = apify.getDataset(datasetId)

// Process in batches to avoid memory issues
let offset = 0
const limit = 1000
const results = []

while (true) {
  const batch = await dataset.listItems({ offset, limit })
  if (batch.length === 0) break

  // Filter each batch
  const filtered = batch.filter(item => item.relevant === true)
  results.push(...filtered)

  offset += limit
}

// Only filtered results go to model context
console.log(results)
```

### Pattern 3: Get Top Performers

```typescript
const dataset = apify.getDataset(datasetId)

// Get top 10 posts by engagement
const topPosts = await dataset.top(
  (a, b) => b.likesCount - a.likesCount,
  10
)

// Only top 10 items (not entire dataset) reach model
console.log(topPosts)
```

## Environment Variables

```bash
# Required
APIFY_TOKEN=apify_api_xxxxx...

# Optional (uses defaults if not set)
APIFY_API_BASE_URL=https://api.apify.com/v2
```

Get your token from: https://console.apify.com/account/integrations

## TypeScript Types

All types are exported from the main module:

```typescript
import { Actor, ActorRun, DatasetOptions } from '~/.claude/filesystem-mcps/apify'
```

## Error Handling

```typescript
try {
  const run = await apify.callActor(actorId, input)
  await apify.waitForRun(actorId, run.id)

  const finalRun = await apify.getRun(actorId, run.id)

  if (finalRun.status !== 'SUCCEEDED') {
    console.error('Actor run failed:', finalRun.status)
    return
  }

  // Process results...
} catch (error) {
  console.error('Apify error:', error.message)
}
```

## Running Examples

```bash
# Run the Instagram scraper example
cd ~/.claude/filesystem-mcps/apify
bun run examples/instagram-scraper.ts

# Or use bun directly
bun examples/instagram-scraper.ts
```

## Token Savings Calculator

Estimate your token savings:

```typescript
function estimateTokens(data: any): number {
  const str = JSON.stringify(data)
  return Math.ceil(str.length / 4) // ~4 chars per token
}

// Before (MCP)
const allItems = await dataset.getAllItems() // 10,000 items
console.log('MCP tokens:', estimateTokens(allItems)) // ~50,000

// After (Code-First)
const filtered = allItems.filter(...).slice(0, 10) // 10 items
console.log('Code tokens:', estimateTokens(filtered)) // ~500

// Savings: 99% token reduction!
```

## When to Use Code-First vs MCP

**Use Code-First (this API):**
- ✅ Need to filter/transform large datasets
- ✅ Processing 100+ results and want top 10
- ✅ Multiple operations in sequence (search → call → filter)
- ✅ Control flow (loops, conditionals)
- ✅ Privacy-sensitive data that shouldn't enter model context

**Use MCP:**
- ❌ Simple single operations with small results
- ❌ Need to expose to non-code-capable models
- ❌ Provider-specific features not in this wrapper

## Links

- Apify Platform: https://apify.com
- Apify Console: https://console.apify.com
- Actor Store: https://apify.com/store
- API Docs: https://docs.apify.com/api/v2
- Parent README: `~/.claude/filesystem-mcps/README.md`
