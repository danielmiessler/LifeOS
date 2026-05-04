#!/usr/bin/env bun
/**
 * ============================================================================
 * PERPLEXITY SEARCH — Sonar API web research with inline citations
 * ============================================================================
 *
 * USAGE:
 *   bun PerplexitySearch.ts "query"
 *   bun PerplexitySearch.ts "query" --model sonar-pro
 *   bun PerplexitySearch.ts "query" --model sonar-reasoning
 *   bun PerplexitySearch.ts "query" --recency day
 *   bun PerplexitySearch.ts "query" --json
 *   bun PerplexitySearch.ts "query" --system "You are a ..."
 *
 * MODELS:
 *   sonar            Fast, grounded, real-time web (default)
 *   sonar-pro        Higher quality, deeper synthesis
 *   sonar-reasoning  Chain-of-thought reasoning + citations
 *
 * RECENCY:
 *   hour | day | week | month | year  (default: none)
 *
 * ENV:
 *   PERPLEXITY_API_KEY   Required
 *
 * OUTPUT (default): plain text response + numbered citation list
 * OUTPUT (--json):  raw API JSON
 * ============================================================================
 */

const API_URL = "https://api.perplexity.ai/chat/completions"
const DEFAULT_MODEL = "sonar"

// ─── Args ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)

function flag(name: string): string | undefined {
  const i = args.indexOf(`--${name}`)
  return i !== -1 ? args[i + 1] : undefined
}
function has(name: string): boolean {
  return args.includes(`--${name}`)
}

const query = args.find(a => !a.startsWith("--") && args[args.indexOf(a) - 1]?.startsWith("--") === false || (!a.startsWith("--") && args.indexOf(a) === 0))
  ?? args.filter(a => !a.startsWith("--") && args[args.indexOf(a) - 1]?.startsWith("--") !== true)[0]

if (!query) {
  console.error("Usage: bun PerplexitySearch.ts \"query\" [--model sonar-pro] [--recency day] [--json]")
  process.exit(1)
}

const model    = flag("model")   ?? DEFAULT_MODEL
const recency  = flag("recency")
const system   = flag("system")  ?? "Be precise and concise. Include inline citations."
const jsonMode = has("json")

// ─── Key ──────────────────────────────────────────────────────────────────────

const apiKey = process.env.PERPLEXITY_API_KEY
if (!apiKey) {
  console.error("Missing environment variable: PERPLEXITY_API_KEY")
  process.exit(1)
}

// ─── Request ──────────────────────────────────────────────────────────────────

const body: Record<string, unknown> = {
  model,
  messages: [
    { role: "system", content: system },
    { role: "user",   content: query },
  ],
  max_tokens: 2048,
  temperature: 0.2,
  return_citations: true,
  return_images: false,
}

if (recency) body.search_recency_filter = recency

const res = await fetch(API_URL, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
  },
  body: JSON.stringify(body),
})

if (!res.ok) {
  const text = await res.text()
  console.error(`Perplexity API error ${res.status}: ${text}`)
  process.exit(1)
}

const data = await res.json() as {
  choices: Array<{ message: { content: string } }>
  citations?: string[]
}

// ─── Output ───────────────────────────────────────────────────────────────────

if (jsonMode) {
  console.log(JSON.stringify(data, null, 2))
  process.exit(0)
}

const content   = data.choices[0]?.message?.content ?? ""
const citations = data.citations ?? []

console.log(content)

if (citations.length > 0) {
  console.log("\n── Citations ──")
  citations.forEach((url, i) => console.log(`[${i + 1}] ${url}`))
}
