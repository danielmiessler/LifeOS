/**
 * Apify Code-First Interface
 *
 * Replaces token-heavy MCP calls with direct code execution.
 * Enables in-code filtering and control flow for massive token savings.
 */

import { ApifyClient } from 'apify-client'

export interface Actor {
  id: string
  name: string
  username: string
  title: string
  description?: string
  createdAt?: string
  modifiedAt?: string
  stats?: {
    totalRuns?: number
    lastRunStartedAt?: string
  }
}

export interface ActorRun {
  id: string
  actorId: string
  status: 'READY' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'TIMED-OUT' | 'ABORTED'
  startedAt: string
  finishedAt?: string
  defaultDatasetId: string
  defaultKeyValueStoreId: string
  buildNumber?: string
  exitCode?: number
  containerUrl?: string
  output?: any
}

export interface DatasetOptions {
  offset?: number
  limit?: number
  fields?: string[]
  omit?: string[]
  clean?: boolean
}

/**
 * Main Apify client for code-first operations
 */
export class Apify {
  private client: ApifyClient

  constructor(token?: string) {
    this.client = new ApifyClient({
      token: token || process.env.APIFY_TOKEN || process.env.APIFY_API_KEY
    })
  }

  /**
   * Search for actors by keyword
   *
   * Fetches actors and filters client-side by query (name, title, description).
   * For better performance with many actors, consider listing all and caching.
   *
   * @param query - Search query (actor name, description, etc.)
   * @param options - Search options
   * @returns Array of matching actors
   */
  async search(query: string, options?: {
    limit?: number
    offset?: number
  }): Promise<Actor[]> {
    // Fetch more actors than needed to ensure we get enough matches
    const fetchLimit = Math.max((options?.limit ?? 10) * 3, 30)

    const { items } = await this.client.actors().list({
      limit: fetchLimit,
      offset: options?.offset ?? 0
    })

    // Filter client-side by query
    // Match if ANY word in query appears in actor fields
    const queryWords = query.toLowerCase().split(/\s+/)
    const filtered = items.filter((actor: any) => {
      const name = (actor.name || '').toLowerCase()
      const title = (actor.title || '').toLowerCase()
      const description = (actor.description || '').toLowerCase()
      const username = (actor.username || '').toLowerCase()
      const searchText = `${name} ${title} ${description} ${username}`

      // Match if any query word is found
      return queryWords.some(word => searchText.includes(word))
    })

    // Return requested number of matches
    return filtered.slice(0, options?.limit ?? 10) as Actor[]
  }

  /**
   * Call (execute) an actor
   *
   * @param actorId - Actor ID or "username/actor-name"
   * @param input - Actor input configuration
   * @param options - Runtime options (memory, timeout)
   * @returns Actor run information
   */
  async callActor(
    actorId: string,
    input: any,
    options?: {
      memory?: number    // Memory in MB (128, 256, 512, 1024, etc.)
      timeout?: number   // Timeout in seconds
      build?: string     // Build number or tag
    }
  ): Promise<ActorRun> {
    const run = await this.client.actor(actorId).call(input, {
      memory: options?.memory,
      timeout: options?.timeout,
      build: options?.build
    })

    return run as ActorRun
  }

  /**
   * Get dataset interface for reading and filtering data
   *
   * @param datasetId - Dataset ID from actor run
   * @returns ApifyDataset instance
   */
  getDataset(datasetId: string): ApifyDataset {
    return new ApifyDataset(this.client, datasetId)
  }

  /**
   * Get actor run status
   *
   * @param runId - Run ID
   * @returns Run information
   */
  async getRun(runId: string): Promise<ActorRun> {
    const run = await this.client.run(runId).get()
    return run as ActorRun
  }

  /**
   * Wait for actor run to finish
   *
   * @param runId - Run ID
   * @param options - Wait options
   * @returns Final run information
   */
  async waitForRun(
    runId: string,
    options?: {
      waitSecs?: number
    }
  ): Promise<ActorRun> {
    const run = await this.client.run(runId).waitForFinish({
      waitSecs: options?.waitSecs
    })
    return run as ActorRun
  }
}

/**
 * Dataset interface for reading and filtering data
 *
 * KEY FEATURE: Filter data in code BEFORE returning to model context
 * This is where the massive token savings happen!
 */
export class ApifyDataset {
  constructor(
    private client: ApifyClient,
    private datasetId: string
  ) {}

  /**
   * List dataset items
   *
   * @param options - List options (pagination, fields)
   * @returns Array of dataset items
   */
  async listItems(options?: DatasetOptions): Promise<any[]> {
    const { items } = await this.client.dataset(this.datasetId).listItems({
      offset: options?.offset,
      limit: options?.limit,
      fields: options?.fields,
      omit: options?.omit,
      clean: options?.clean
    })

    return items
  }

  /**
   * Get all dataset items (handles pagination automatically)
   *
   * WARNING: For large datasets, use listItems with limit
   * or filter in code to avoid excessive tokens
   *
   * @returns Array of all items
   */
  async getAllItems(): Promise<any[]> {
    const allItems: any[] = []
    let offset = 0
    const limit = 1000

    while (true) {
      const { items, count, total } = await this.client.dataset(this.datasetId).listItems({
        offset,
        limit
      })

      allItems.push(...items)

      if (offset + count >= total) break
      offset += limit
    }

    return allItems
  }

  /**
   * Helper: Filter items by predicate function
   *
   * This is a convenience method - you can also filter
   * using standard array methods after listItems()
   *
   * @param predicate - Filter function
   * @returns Filtered items
   */
  async filter(predicate: (item: any) => boolean): Promise<any[]> {
    const items = await this.getAllItems()
    return items.filter(predicate)
  }

  /**
   * Helper: Get top N items by sort function
   *
   * @param sortFn - Sort comparison function
   * @param limit - Number of items to return
   * @returns Top N sorted items
   */
  async top(sortFn: (a: any, b: any) => number, limit: number): Promise<any[]> {
    const items = await this.getAllItems()
    return items.sort(sortFn).slice(0, limit)
  }
}

// Re-export for convenience
export { ApifyClient }
