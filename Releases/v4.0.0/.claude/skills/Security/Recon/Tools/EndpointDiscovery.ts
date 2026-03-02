#!/usr/bin/env bun
/**
 * EndpointDiscovery.ts - Extract endpoints from JavaScript at scale
 * Parses large volumes of JS to find API endpoints, paths, and secrets
 *
 * Usage:
 *   bun EndpointDiscovery.ts <target> [options]
 *
 * Modes:
 *   URL mode:   Crawl target and extract endpoints from JS files
 *   File mode:  Parse local JS files directly (for offline analysis)
 *   Stdin mode: Pipe JS content directly
 *
 * Examples:
 *   bun EndpointDiscovery.ts https://example.com
 *   bun EndpointDiscovery.ts https://example.com --deep
 *   bun EndpointDiscovery.ts ./js-files/ --local
 *   cat bundle.js | bun EndpointDiscovery.ts --stdin
 *   bun EndpointDiscovery.ts urls.txt --batch
 */

import { $ } from "bun";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

interface Endpoint {
  path: string;
  type: "api" | "path" | "url" | "websocket" | "graphql" | "unknown";
  source?: string;
  line?: number;
}

interface Secret {
  type: string;
  value: string;
  source?: string;
  line?: number;
}

interface EndpointDiscoveryResult {
  target: string;
  timestamp: string;
  mode: string;
  jsFilesProcessed: number;
  endpoints: Endpoint[];
  secrets: Secret[];
  stats: {
    totalEndpoints: number;
    byType: Record<string, number>;
    uniquePaths: number;
  };
  errors: string[];
}

interface EndpointDiscoveryOptions {
  deep?: boolean;        // Use jsluice for deeper analysis
  local?: boolean;       // Parse local files instead of crawling
  stdin?: boolean;       // Read from stdin
  batch?: boolean;       // Process file as list of URLs
  depth?: number;        // Crawl depth
  threads?: number;      // Concurrent threads
  timeout?: number;      // Request timeout
  headless?: boolean;    // Use headless browser
  includeSecrets?: boolean; // Also look for secrets/keys
  outputDir?: string;    // Save JS files for later analysis
  json?: boolean;
  silent?: boolean;
}

// Regex patterns for endpoint extraction
const ENDPOINT_PATTERNS = {
  // API paths
  apiPath: /["'`](\/api\/[^"'`\s]{1,200})["'`]/g,
  apiV: /["'`](\/v[0-9]+\/[^"'`\s]{1,200})["'`]/g,
  restPath: /["'`](\/(?:users?|admin|auth|login|logout|register|account|profile|settings|config|data|search|upload|download|export|import|webhook|callback|graphql|query|mutation)[^"'`\s]{0,150})["'`]/gi,

  // Full URLs
  fullUrl: /["'`](https?:\/\/[^"'`\s]{5,500})["'`]/g,

  // Relative paths
  relativePath: /["'`](\/[a-zA-Z0-9_\-]{1,50}(?:\/[a-zA-Z0-9_\-\.]{1,100}){0,10})["'`]/g,

  // WebSocket
  websocket: /["'`](wss?:\/\/[^"'`\s]{5,300})["'`]/g,

  // GraphQL
  graphql: /["'`](\/graphql[^"'`\s]{0,100})["'`]/gi,

  // Path assignments
  pathAssign: /(?:path|url|endpoint|uri|href|src|action|route)\s*[=:]\s*["'`]([^"'`\s]{2,300})["'`]/gi,

  // Fetch/axios calls
  fetchCall: /(?:fetch|axios|get|post|put|delete|patch)\s*\(\s*["'`]([^"'`\s]{2,300})["'`]/gi,

  // Template literals with paths
  templatePath: /`[^`]*(\$\{[^}]+\})?\/[a-zA-Z][^`]{1,200}`/g,
};

// Secret patterns
const SECRET_PATTERNS = {
  awsKey: /(?:AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}/g,
  awsSecret: /["'`]([A-Za-z0-9/+=]{40})["'`]/g,
  googleApi: /AIza[A-Za-z0-9_-]{35}/g,
  githubToken: /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}/g,
  stripeKey: /(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{24,}/g,
  jwtToken: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  privateKey: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/g,
  bearer: /["'`]Bearer\s+[A-Za-z0-9_\-.]{20,}["'`]/g,
  apiKey: /["'`](?:api[_-]?key|apikey|api[_-]?secret|access[_-]?token|auth[_-]?token)['"]*\s*[:=]\s*["'`]([^"'`\s]{10,100})["'`]/gi,
  slackToken: /xox[baprs]-[A-Za-z0-9-]{10,}/g,
  twilioKey: /SK[a-f0-9]{32}/g,
  sendgridKey: /SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/g,
};

function classifyEndpoint(path: string): Endpoint["type"] {
  const lower = path.toLowerCase();

  if (lower.includes("graphql")) return "graphql";
  if (path.startsWith("ws://") || path.startsWith("wss://")) return "websocket";
  if (path.startsWith("http://") || path.startsWith("https://")) return "url";
  if (lower.includes("/api/") || lower.match(/\/v[0-9]+\//)) return "api";
  if (path.startsWith("/")) return "path";

  return "unknown";
}

function extractEndpointsFromJS(content: string, source?: string): { endpoints: Endpoint[]; secrets: Secret[] } {
  const endpoints: Endpoint[] = [];
  const secrets: Secret[] = [];
  const seenPaths = new Set<string>();

  // Extract endpoints
  for (const [name, pattern] of Object.entries(ENDPOINT_PATTERNS)) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;

    while ((match = regex.exec(content)) !== null) {
      const path = match[1] || match[0];

      // Skip common false positives
      if (shouldSkipPath(path)) continue;

      // Deduplicate
      if (seenPaths.has(path)) continue;
      seenPaths.add(path);

      endpoints.push({
        path,
        type: classifyEndpoint(path),
        source,
      });
    }
  }

  // Extract secrets
  for (const [type, pattern] of Object.entries(SECRET_PATTERNS)) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;

    while ((match = regex.exec(content)) !== null) {
      const value = match[1] || match[0];

      // Avoid duplicates and false positives
      if (value.length < 10 || value.length > 500) continue;

      secrets.push({
        type,
        value: value.substring(0, 50) + (value.length > 50 ? "..." : ""),
        source,
      });
    }
  }

  return { endpoints, secrets };
}

function shouldSkipPath(path: string): boolean {
  const skipPatterns = [
    /^\/\*/, // Comments
    /^\/$/, // Root only
    /\.(css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map)$/i, // Static assets
    /^data:/, // Data URIs
    /^javascript:/, // JS URIs
    /^#/, // Anchors
    /^mailto:/, // Email
    /node_modules/,
    /webpack/,
    /sourcemap/,
    /^\s*$/, // Empty
    /^[0-9]+$/, // Numbers only
    /^[a-f0-9]{32,}$/i, // Hashes
  ];

  return skipPatterns.some(p => p.test(path));
}

async function crawlWithKatana(target: string, options: EndpointDiscoveryOptions): Promise<string[]> {
  const args = ["katana", "-u", target, "-jc"]; // -jc enables JS crawling

  if (options.deep) {
    args.push("-jsl"); // jsluice for deeper analysis
  }

  args.push("-d", String(options.depth || 3));
  args.push("-ct", String(options.timeout || 30) + "s");

  if (options.threads) {
    args.push("-c", String(options.threads));
  }

  if (options.headless) {
    args.push("-hl"); // headless mode
  }

  args.push("-silent");
  args.push("-nc"); // no color

  // Filter for JS files
  args.push("-f", "js");

  try {
    const proc = Bun.spawn(args, {
      stdout: "pipe",
      stderr: "pipe",
    });

    const output = await new Response(proc.stdout).text();
    return output.trim().split("\n").filter(Boolean);
  } catch (error) {
    console.error(`Katana error: ${error}`);
    return [];
  }
}

async function fetchJSContent(urls: string[]): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  // Process in batches to avoid overwhelming
  const batchSize = 10;
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);

    await Promise.all(batch.map(async (url) => {
      try {
        const response = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          },
          signal: AbortSignal.timeout(10000),
        });

        if (response.ok) {
          const content = await response.text();
          results.set(url, content);
        }
      } catch {
        // Skip failed fetches
      }
    }));
  }

  return results;
}

async function processLocalFiles(dir: string): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  async function scanDir(path: string) {
    const entries = await readdir(path, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(path, entry.name);

      if (entry.isDirectory()) {
        await scanDir(fullPath);
      } else if (entry.name.endsWith(".js") || entry.name.endsWith(".mjs") || entry.name.endsWith(".jsx")) {
        try {
          const content = await Bun.file(fullPath).text();
          results.set(fullPath, content);
        } catch {
          // Skip unreadable files
        }
      }
    }
  }

  await scanDir(dir);
  return results;
}

async function runEndpointDiscovery(
  target: string,
  options: EndpointDiscoveryOptions = {}
): Promise<EndpointDiscoveryResult> {
  const result: EndpointDiscoveryResult = {
    target,
    timestamp: new Date().toISOString(),
    mode: options.local ? "local" : options.stdin ? "stdin" : options.batch ? "batch" : "crawl",
    jsFilesProcessed: 0,
    endpoints: [],
    secrets: [],
    stats: {
      totalEndpoints: 0,
      byType: {},
      uniquePaths: 0,
    },
    errors: [],
  };

  let jsContents: Map<string, string>;

  try {
    if (options.stdin) {
      // Read from stdin
      const content = await Bun.stdin.text();
      jsContents = new Map([["stdin", content]]);
    } else if (options.local) {
      // Process local directory
      jsContents = await processLocalFiles(target);
    } else if (options.batch) {
      // Process file as list of URLs
      const urls = (await Bun.file(target).text()).trim().split("\n").filter(Boolean);
      const jsUrls = urls.filter(u => u.endsWith(".js") || u.includes(".js?"));
      jsContents = await fetchJSContent(jsUrls);
    } else {
      // Crawl mode - use Katana
      if (!options.silent) console.error(`Crawling ${target} for JS files...`);
      const jsUrls = await crawlWithKatana(target, options);

      if (!options.silent) console.error(`Found ${jsUrls.length} JS files, fetching content...`);
      jsContents = await fetchJSContent(jsUrls);
    }

    result.jsFilesProcessed = jsContents.size;

    // Process all JS content
    const allEndpoints: Endpoint[] = [];
    const allSecrets: Secret[] = [];
    const seenPaths = new Set<string>();

    for (const [source, content] of jsContents) {
      const { endpoints, secrets } = extractEndpointsFromJS(content, source);

      for (const ep of endpoints) {
        if (!seenPaths.has(ep.path)) {
          seenPaths.add(ep.path);
          allEndpoints.push(ep);
        }
      }

      if (options.includeSecrets) {
        allSecrets.push(...secrets);
      }
    }

    // Sort and deduplicate
    result.endpoints = allEndpoints.sort((a, b) => a.path.localeCompare(b.path));
    result.secrets = allSecrets;

    // Calculate stats
    result.stats.totalEndpoints = result.endpoints.length;
    result.stats.uniquePaths = seenPaths.size;

    for (const ep of result.endpoints) {
      result.stats.byType[ep.type] = (result.stats.byType[ep.type] || 0) + 1;
    }

  } catch (error) {
    result.errors.push(`Processing error: ${error}`);
  }

  return result;
}

function parseArgs(args: string[]): { target: string; options: EndpointDiscoveryOptions } {
  const options: EndpointDiscoveryOptions = {};
  let target = "";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case "--deep":
        options.deep = true;
        break;
      case "--local":
      case "-l":
        options.local = true;
        break;
      case "--stdin":
        options.stdin = true;
        break;
      case "--batch":
      case "-b":
        options.batch = true;
        break;
      case "-d":
      case "--depth":
        options.depth = parseInt(next);
        i++;
        break;
      case "-t":
      case "--threads":
        options.threads = parseInt(next);
        i++;
        break;
      case "--timeout":
        options.timeout = parseInt(next);
        i++;
        break;
      case "--headless":
      case "-hl":
        options.headless = true;
        break;
      case "--secrets":
      case "-s":
        options.includeSecrets = true;
        break;
      case "-o":
      case "--output":
        options.outputDir = next;
        i++;
        break;
      case "--json":
        options.json = true;
        break;
      case "--silent":
        options.silent = true;
        break;
      case "-h":
      case "--help":
        console.log(`
EndpointDiscovery - Extract endpoints from JavaScript at scale

Usage:
  bun EndpointDiscovery.ts <target> [options]

Arguments:
  target                  URL to crawl, directory path, or file list

Modes:
  (default)               Crawl URL and extract endpoints from JS
  --local, -l             Parse local JS files from directory
  --stdin                 Read JS content from stdin
  --batch, -b             Process file as list of JS URLs

Options:
  --deep                  Use jsluice for deeper analysis (slower, more thorough)
  -d, --depth <n>         Crawl depth (default: 3)
  -t, --threads <n>       Concurrent threads
  --timeout <seconds>     Request timeout (default: 30)
  --headless, -hl         Use headless browser for JS rendering
  -s, --secrets           Also extract potential secrets/API keys
  -o, --output <dir>      Save JS files for later analysis
  --json                  Output as JSON
  --silent                Minimal output

What It Extracts:
  - API endpoints (/api/v1/users, /graphql)
  - Full URLs (https://api.example.com/endpoint)
  - Relative paths (/admin, /dashboard)
  - WebSocket endpoints (wss://...)
  - Secrets (AWS keys, API tokens, JWTs) with --secrets

Examples:
  # Crawl site and extract endpoints
  bun EndpointDiscovery.ts https://example.com

  # Deep analysis with jsluice
  bun EndpointDiscovery.ts https://example.com --deep

  # Process downloaded JS files
  bun EndpointDiscovery.ts ./js-bundle/ --local

  # Pipe JS content
  curl -s https://example.com/bundle.js | bun EndpointDiscovery.ts --stdin

  # Process list of JS URLs
  bun EndpointDiscovery.ts js-urls.txt --batch

  # Full analysis with secrets
  bun EndpointDiscovery.ts https://example.com --deep --secrets --json

Scale Tips:
  - Use --batch with pre-collected JS URLs for large assessments
  - Use --local to analyze JS bundles offline
  - Pipe to PathDiscovery.ts for fuzzing discovered endpoints
`);
        process.exit(0);
      default:
        if (!arg.startsWith("-") && !target) {
          target = arg;
        }
    }
  }

  return { target, options };
}

// Main execution
const args = process.argv.slice(2);
const { target, options } = parseArgs(args);

if (!target && !options.stdin) {
  console.error("Error: Target required (URL, directory, or use --stdin)");
  console.error("Usage: bun EndpointDiscovery.ts <target> [options]");
  console.error("Use --help for more information");
  process.exit(1);
}

const result = await runEndpointDiscovery(target, options);

if (options.json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`\n🔍 Endpoint Discovery: ${result.target}`);
  console.log(`⏱️  ${result.timestamp}`);
  console.log(`📁 Mode: ${result.mode}`);
  console.log(`📄 JS Files Processed: ${result.jsFilesProcessed}`);
  console.log(`\n📊 Stats:`);
  console.log(`   Total Endpoints: ${result.stats.totalEndpoints}`);
  console.log(`   Unique Paths: ${result.stats.uniquePaths}`);

  for (const [type, count] of Object.entries(result.stats.byType)) {
    console.log(`   ${type}: ${count}`);
  }

  if (result.endpoints.length > 0) {
    console.log(`\n🎯 Endpoints by Type:\n`);

    // Group by type
    const byType = new Map<string, Endpoint[]>();
    for (const ep of result.endpoints) {
      const existing = byType.get(ep.type) || [];
      existing.push(ep);
      byType.set(ep.type, existing);
    }

    for (const [type, endpoints] of byType) {
      console.log(`  [${type.toUpperCase()}] (${endpoints.length})`);
      for (const ep of endpoints.slice(0, 15)) {
        console.log(`    ${ep.path}`);
      }
      if (endpoints.length > 15) {
        console.log(`    ... and ${endpoints.length - 15} more`);
      }
      console.log();
    }
  }

  if (result.secrets.length > 0) {
    console.log(`\n🔑 Potential Secrets (${result.secrets.length}):\n`);
    for (const secret of result.secrets.slice(0, 10)) {
      console.log(`  [${secret.type}] ${secret.value}`);
    }
    if (result.secrets.length > 10) {
      console.log(`  ... and ${result.secrets.length - 10} more`);
    }
  }

  if (result.errors.length > 0) {
    console.log("\n⚠️  Errors:");
    for (const err of result.errors) {
      console.log(`  ${err}`);
    }
  }

  if (result.endpoints.length > 0) {
    console.log(`\n💡 Next: Pipe to PathDiscovery for fuzzing`);
    console.log(`   bun EndpointDiscovery.ts "${target}" --json | jq -r '.endpoints[].path'`);
  }
}

export { runEndpointDiscovery, extractEndpointsFromJS, EndpointDiscoveryOptions, EndpointDiscoveryResult, Endpoint };
