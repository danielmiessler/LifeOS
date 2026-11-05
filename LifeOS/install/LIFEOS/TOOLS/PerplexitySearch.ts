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
 *   bun ~/.claude/LIFEOS/TOOLS/PerplexitySearch.ts --model perplexityPro "<query>"
 *   bun ~/.claude/LIFEOS/TOOLS/PerplexitySearch.ts --model perplexityReasoning "<query>"
 *   bun ~/.claude/LIFEOS/TOOLS/PerplexitySearch.ts --recency week "<query>"
 *   bun ~/.claude/LIFEOS/TOOLS/PerplexitySearch.ts --system "You are a ..." "<query>"
 *   bun ~/.claude/LIFEOS/TOOLS/PerplexitySearch.ts --json "<query>"
 *
 * Models (lanes in models.ts CROSS_VENDOR; ids move there, never here):
 *   perplexity           Fast, grounded, real-time web (default)
 *   perplexityPro        Higher quality, deeper synthesis
 *   perplexityReasoning  Chain-of-thought reasoning + citations
 *
 * Options:
 *   --model <lane|id>  a models.ts lane (perplexity, perplexityPro, perplexityReasoning) or a raw Sonar id (default: perplexity)
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
 * @version 1.0.3
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { CROSS_VENDOR } from './models';
import { getClaudeDir } from './Paths'; // public issue #1974 @sabo961, PR #1918 @PigLardLord

const colors = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m',
}

// Load environment — mirrors the cross-vendor search-tool env convention
function loadEnv(): Record<string, string> {
  // Canonical .env is ~/.claude/.env — never $LIFEOS_CONFIG_DIR/.env, which
  // resolves to the dead ~/.claude/LIFEOS/.env path (public issue #1490).
  const envPath = join(getClaudeDir(), '.env')
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
// Sonar Chat Completions ended; the API now answers
// "Sonar is now the Agent API". Per docs.perplexity.ai/docs/agent-api/migrate-from-sonar/how-to:
// POST /v1/agent; sonar ids map to an `effort` level; system → `instructions`;
// max_tokens → `max_output_tokens`; recency lives in the web_search tool's `filters`;
// answer is `output_text`, sources are the `search_results` output item's `results`.
const API_URL = process.env.PERPLEXITY_API_URL || 'https://api.perplexity.ai/v1/agent'
const SONAR_TO_EFFORT: Record<string, string> = {
  'sonar': 'fast', 'sonar-pro': 'fast', 'sonar-reasoning': 'low',
  'sonar-reasoning-pro': 'low', 'sonar-deep-research': 'high',
}
const DEFAULT_MODEL = CROSS_VENDOR.perplexity

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
    else if (a === '--model') { const v = argv[++i]; opts.model = CROSS_VENDOR[v] ?? v }
    else if (a === '--recency') opts.recency = argv[++i]
    else if (a === '--system') opts.system = argv[++i]
    else if (a === '--max-tokens') opts.maxTokens = parseInt(argv[++i], 10) || opts.maxTokens
    else rest.push(a)
  }
  return { opts, query: rest.join(' ').trim() }
}

async function perplexity(query: string, opts: ReturnType<typeof parseArgs>['opts']): Promise<Parsed> {
  const body: Record<string, unknown> = {
    instructions: opts.system,
    input: query,
    max_output_tokens: opts.maxTokens,
  }
  // A provider/model id (e.g. openai/gpt-6-luna) is sent as `model` with web_search
  // switched on; a legacy sonar id or an effort word is sent as `effort`, whose
  // levels already include web_search and inline citations.
  const effort = SONAR_TO_EFFORT[opts.model] ?? (['fast', 'low', 'medium', 'high', 'xhigh'].includes(opts.model) ? opts.model : '')
  const search: Record<string, unknown> = { type: 'web_search' }
  if (opts.recency) search.filters = { search_recency_filter: opts.recency }
  if (effort) {
    body.effort = effort
    if (opts.recency) body.tools = [search]
  } else {
    body.model = opts.model
    body.tools = [search]
  }

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  })

  const data = await res.json() as any
  if (!res.ok || data.error) {
    throw new Error(typeof data.error === 'string' ? data.error : (data.error?.message || `HTTP ${res.status}`))
  }

  // Agent API shape: answer in output_text, or in message items' output_text parts;
  // sources in the search_results item, each with an id matching the [n] markers.
  const out: any[] = Array.isArray(data.output) ? data.output : []
  const fromItems = out.filter(o => o.type === 'message').flatMap(o => o.content ?? [])
    .filter((c: any) => c.type === 'output_text' || typeof c.text === 'string').map((c: any) => c.text ?? '').join('')
  // Some Agent models leak internal citation tokens (e.g. "citeturn0search0",
  // wrapped in private-use characters); the [n]/link citations stay.
  const content: string = (data.output_text || fromItems || '')
    .replace(/[\uE000-\uF8FF]*cite(?:[\uE000-\uF8FF]*turn\d+[a-z]+\d+)+[\uE000-\uF8FF]*/g, '').replace(/ +\./g, '.').replace(/ +$/gm, '')
  const results: any[] = out.filter(o => o.type === 'search_results').flatMap(o => o.results ?? [])
  results.sort((a, b) => Number(a.id) - Number(b.id))
  const citations: string[] = results.map(r => r.url).filter(Boolean)
  return { content: content.trim(), citations, usage: data.usage ?? {} }
}

const USAGE = `Usage: bun ~/.claude/LIFEOS/TOOLS/PerplexitySearch.ts [options] "<query>"

Options:
  --model <name>     perplexity | perplexityPro | perplexityReasoning (models.ts lanes; default: perplexity)
  --recency <span>   hour | day | week | month | year      (bias toward fresh sources)
  --json             machine-readable output
  -h, --help         this message — costs nothing, sends no request`

async function main() {
  const argv = process.argv.slice(2)

  // --help must NEVER reach the API. Without this guard, `--help` was parsed as a
  // QUERY and billed as a live Perplexity call (found 2026-07-27 when an audit
  // probed the tool's own documented health check and got charged an essay about
  // the help flag). A usage probe has to be free, or nobody will run it.
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    console.log(USAGE)
    process.exit(argv.length === 0 ? 1 : 0)
  }

  const { opts, query } = parseArgs(argv)

  if (!API_KEY) {
    console.error(`${colors.red}Error: PERPLEXITY_API_KEY not set in ~/.claude/.env${colors.reset}`)
    process.exit(1)
  }
  if (!query) {
    console.error(`${colors.red}Error: no query provided${colors.reset}`)
    console.error(USAGE)
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
