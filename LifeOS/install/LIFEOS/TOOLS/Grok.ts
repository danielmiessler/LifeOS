#!/usr/bin/env bun
/**
 * Grok.ts - xAI Grok search client (Agent Tools API)
 *
 * Full Grok search: by default searches BOTH the live web AND X (Twitter) with
 * citations, the same agentic search Grok runs natively. Web search covers
 * news/articles/general; X search adds real-time social sentiment Claude can't
 * reach. Optional code_execution lets Grok compute/analyze mid-search.
 *
 * Uses the /v1/responses Agent Tools API (the old Live Search via
 * search_parameters is deprecated by xAI as of 2026). Valid server-side tools:
 * web_search, x_search, code_execution (also collections_search, file_search,
 * mcp, shell — not wired here).
 *
 * Usage:
 *   bun ~/.claude/LIFEOS/TOOLS/Grok.ts "<query>"                 # web + X (default)
 *   bun ~/.claude/LIFEOS/TOOLS/Grok.ts --web-only "<query>"       # web only
 *   bun ~/.claude/LIFEOS/TOOLS/Grok.ts --x-only "<query>"         # X only
 *   bun ~/.claude/LIFEOS/TOOLS/Grok.ts --code "<query>"           # + code execution
 *   bun ~/.claude/LIFEOS/TOOLS/Grok.ts --json "<query>"
 *   bun ~/.claude/LIFEOS/TOOLS/Grok.ts --model grok-4.3 "<query>"
 *
 * Options:
 *   --web-only        Only search the web, no X
 *   --x-only          Only search X (Twitter), no web
 *   --code            Also enable code_execution (compute/analyze mid-search)
 *   --model <id>      Model id (default: grok-4.3)
 *   --max-tokens <n>  Cap output tokens (default: model default)
 *   --json            Emit raw {content, citations, usage} JSON
 *
 * Environment:
 *   GROK_API_KEY (or XAI_API_KEY)   xAI API key (required)
 *
 * Exit codes: 0 ok, 1 error (missing key, API failure, no output)
 *
 * @author LifeOS System
 * @version 1.0.0
 */

import { readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

// Normalize env path vars that Claude Code injects without shell expansion (LifeOS#1404)
for (const k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const v = process.env[k];
  if (v && /^\$\{?HOME\}?(\/|$)/.test(v)) process.env[k] = v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}


const colors = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m',
}

// Load environment — mirrors LIFEOS/TOOLS/YouTubeApi.ts convention
function loadEnv(): Record<string, string> {
  const envPath = process.env.LIFEOS_CONFIG_DIR
    ? join(process.env.LIFEOS_CONFIG_DIR, '.env')
    : join(homedir(), '.claude', '.env')
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
const API_KEY = process.env.GROK_API_KEY || process.env.XAI_API_KEY || env.GROK_API_KEY || env.XAI_API_KEY
const API_URL = 'https://api.x.ai/v1/responses'

interface Parsed { content: string; citations: string[]; usage: any }

function parseArgs(argv: string[]) {
  const opts = { model: 'grok-4.3', xOnly: false, webOnly: false, code: false, json: false, maxTokens: 0 }
  const rest: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--x-only') opts.xOnly = true
    else if (a === '--web-only') opts.webOnly = true
    else if (a === '--code') opts.code = true
    else if (a === '--json') opts.json = true
    else if (a === '--model') opts.model = argv[++i]
    else if (a === '--max-tokens') opts.maxTokens = parseInt(argv[++i], 10) || 0
    else rest.push(a)
  }
  return { opts, query: rest.join(' ').trim() }
}

async function grok(query: string, opts: ReturnType<typeof parseArgs>['opts']): Promise<Parsed> {
  const tools: Array<{ type: string }> = []
  if (!opts.xOnly) tools.push({ type: 'web_search' })
  if (!opts.webOnly) tools.push({ type: 'x_search' })
  if (opts.code) tools.push({ type: 'code_execution' })

  const body: Record<string, unknown> = { model: opts.model, input: query, tools }
  if (opts.maxTokens > 0) body.max_output_tokens = opts.maxTokens

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = await res.json() as any
  if (!res.ok || data.error) {
    throw new Error(typeof data.error === 'string' ? data.error : (data.error?.message || `HTTP ${res.status}`))
  }

  let content = ''
  const citations = new Set<string>()
  for (const o of data.output ?? []) {
    if (o.type !== 'message') continue
    for (const c of o.content ?? []) {
      if (c.text) content += c.text
      for (const ann of c.annotations ?? []) if (ann.url) citations.add(ann.url)
    }
  }
  return { content: content.trim(), citations: Array.from(citations), usage: data.usage ?? {} }
}

async function main() {
  const { opts, query } = parseArgs(process.argv.slice(2))

  if (!API_KEY) {
    console.error(`${colors.red}Error: GROK_API_KEY (or XAI_API_KEY) not set in ~/.claude/.env${colors.reset}`)
    process.exit(1)
  }
  if (!query) {
    console.error(`${colors.red}Error: no query provided${colors.reset}`)
    console.error(`Usage: bun ~/.claude/LIFEOS/TOOLS/Grok.ts [--x-only|--web-only] [--model <id>] [--json] "<query>"`)
    process.exit(1)
  }

  let result: Parsed
  try {
    result = await grok(query, opts)
  } catch (e: any) {
    console.error(`${colors.red}xAI API error: ${e.message}${colors.reset}`)
    process.exit(1)
  }

  if (!result.content) {
    console.error(`${colors.red}Error: empty response from Grok${colors.reset}`)
    process.exit(1)
  }

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2))
    return
  }

  console.log(result.content)
  if (result.citations.length) {
    console.log(`\n${colors.dim}Sources:${colors.reset}`)
    result.citations.forEach((u, i) => console.log(`${colors.dim}[${i + 1}]${colors.reset} ${u}`))
  }
  const u = result.usage
  if (u?.server_side_tool_usage_details) {
    const d = u.server_side_tool_usage_details
    console.error(`${colors.dim}(web_search: ${d.web_search_calls || 0}, x_search: ${d.x_search_calls || 0}, code: ${d.code_execution_calls || 0}, ${u.total_tokens || '?'} tokens)${colors.reset}`)
  }
}

main()
