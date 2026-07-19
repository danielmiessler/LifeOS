#!/usr/bin/env bun
/**
 * PerplexitySearch.ts - Perplexity Sonar API web research client
 *
 * Real-time, grounded web research with inline citations via Perplexity's Sonar
 * models. Returns a synthesized answer plus a numbered citation list. Used by the
 * Research skill / PerplexityResearcher agent as the primary web-research tool.
 *
 * Usage:
 *   bun ~/.claude/LIFEOS/TOOLS/PerplexitySearch.ts "<query>"
 *   bun ~/.claude/LIFEOS/TOOLS/PerplexitySearch.ts --model sonar-pro "<query>"
 *   bun ~/.claude/LIFEOS/TOOLS/PerplexitySearch.ts --model sonar-reasoning "<query>"
 *   bun ~/.claude/LIFEOS/TOOLS/PerplexitySearch.ts --recency week "<query>"
 *   bun ~/.claude/LIFEOS/TOOLS/PerplexitySearch.ts --system "You are a ..." "<query>"
 *   bun ~/.claude/LIFEOS/TOOLS/PerplexitySearch.ts --json "<query>"
 *
 * Models:
 *   sonar            Fast, grounded, real-time web (default)
 *   sonar-pro        Higher quality, deeper synthesis
 *   sonar-reasoning  Chain-of-thought reasoning + citations
 *
 * Options:
 *   --model <id>       Sonar model id (default: sonar)
 *   --recency <span>   Freshness filter: hour | day | week | month | year
 *   --system <prompt>  Override the system prompt
 *   --max-tokens <n>   Cap output tokens (default: 2048)
 *   --json             Emit raw API JSON
 *
 * Environment:
 *   PERPLEXITY_API_KEY   Perplexity API key (required)
 *
 * Exit codes: 0 ok, 1 error (missing key, API failure, empty response)
 *
 * @author LifeOS System
 * @version 1.0.0
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { claudeDir, shellQuote } from "./lifeos-root";

const colors = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m',
}

// Load environment — mirrors LIFEOS/TOOLS/Grok.ts convention
function loadEnv(): Record<string, string> {
  const envPath = join(claudeDir(), '.env')
  const env: Record<string, string> = {}
  try {
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
      const match = line.match(/^([^#=]+)=(.*)$/)
      if (match) env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    // ignore — fall back to process.env
  }
  return env
}

const env = loadEnv()
const API_KEY = process.env.PERPLEXITY_API_KEY || env.PERPLEXITY_API_KEY
const API_URL = 'https://api.perplexity.ai/chat/completions'
const DEFAULT_MODEL = 'sonar'

interface Parsed { content: string; citations: string[]; usage: any }

function parseArgs(argv: string[]) {
  const opts = {
    model: DEFAULT_MODEL,
    recency: '',
    system: 'Be precise and concise. Include inline citations.',
    maxTokens: 2048,
    json: false,
  }
  const rest: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--json') opts.json = true
    else if (a === '--model') opts.model = argv[++i]
    else if (a === '--recency') opts.recency = argv[++i]
    else if (a === '--system') opts.system = argv[++i]
    else if (a === '--max-tokens') opts.maxTokens = parseInt(argv[++i], 10) || opts.maxTokens
    else rest.push(a)
  }
  return { opts, query: rest.join(' ').trim() }
}

async function perplexity(query: string, opts: ReturnType<typeof parseArgs>['opts']): Promise<Parsed> {
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: query },
    ],
    max_tokens: opts.maxTokens,
    temperature: 0.2,
    return_citations: true,
    return_images: false,
  }
  if (opts.recency) body.search_recency_filter = opts.recency

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })

  const data = await res.json() as any
  if (!res.ok || data.error) {
    throw new Error(typeof data.error === 'string' ? data.error : (data.error?.message || `HTTP ${res.status}`))
  }

  const content = data.choices?.[0]?.message?.content ?? ''
  const citations = Array.isArray(data.citations) ? data.citations : []
  return { content: content.trim(), citations, usage: data.usage ?? {} }
}

async function main() {
  const { opts, query } = parseArgs(process.argv.slice(2))

  if (!API_KEY) {
    console.error(`${colors.red}Error: PERPLEXITY_API_KEY not set in ${join(claudeDir(), '.env')}${colors.reset}`)
    process.exit(1)
  }
  if (!query) {
    console.error(`${colors.red}Error: no query provided${colors.reset}`)
    console.error(`Usage: bun ${shellQuote(join(claudeDir(), 'LIFEOS', 'TOOLS', 'PerplexitySearch.ts'))} [--model sonar-pro] [--recency day] [--json] "<query>"`)
    process.exit(1)
  }

  let result: Parsed
  try {
    result = await perplexity(query, opts)
  } catch (e: any) {
    console.error(`${colors.red}Perplexity API error: ${e.message}${colors.reset}`)
    process.exit(1)
  }

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2))
    return
  }

  if (!result.content) {
    console.error(`${colors.red}Error: empty response from Perplexity${colors.reset}`)
    process.exit(1)
  }

  console.log(result.content)
  if (result.citations.length) {
    console.log(`\n${colors.dim}Sources:${colors.reset}`)
    result.citations.forEach((u, i) => console.log(`${colors.dim}[${i + 1}]${colors.reset} ${u}`))
  }
}

main()
