#!/usr/bin/env bun
/**
 * PathDiscovery.ts - Directory and file path fuzzing
 * Wraps ffuf for discovering hidden paths, directories, and files on web servers
 *
 * Usage:
 *   bun PathDiscovery.ts <url> [options]
 *
 * Examples:
 *   bun PathDiscovery.ts https://example.com
 *   bun PathDiscovery.ts https://example.com -w /path/to/wordlist.txt
 *   bun PathDiscovery.ts https://example.com --extensions php,html,js
 *   bun PathDiscovery.ts https://example.com --threads 100 --json
 */

import { $ } from "bun";

interface PathDiscoveryOptions {
  wordlist?: string;
  extensions?: string[];
  threads?: number;
  timeout?: number;
  followRedirects?: boolean;
  matchCodes?: string;
  filterCodes?: string;
  recursion?: boolean;
  recursionDepth?: number;
  headers?: string[];
  cookies?: string;
  method?: string;
  data?: string;
  proxy?: string;
  rate?: number;
  json?: boolean;
  silent?: boolean;
  autoCalibrate?: boolean;
}

interface PathResult {
  url: string;
  status: number;
  length: number;
  words: number;
  lines: number;
  contentType?: string;
  redirectLocation?: string;
}

interface PathDiscoveryResult {
  target: string;
  wordlist: string;
  timestamp: string;
  totalFound: number;
  paths: PathResult[];
  errors: string[];
}

// Default wordlists (SecLists paths)
const DEFAULT_WORDLISTS = [
  "/opt/homebrew/share/seclists/Discovery/Web-Content/raft-medium-directories.txt",
  "/usr/share/seclists/Discovery/Web-Content/raft-medium-directories.txt",
  "/opt/seclists/Discovery/Web-Content/raft-medium-directories.txt",
  `${process.env.HOME}/wordlists/raft-medium-directories.txt`,
];

async function findWordlist(customPath?: string): Promise<string | null> {
  if (customPath) {
    const file = Bun.file(customPath);
    if (await file.exists()) return customPath;
    console.error(`Wordlist not found: ${customPath}`);
    return null;
  }

  for (const path of DEFAULT_WORDLISTS) {
    const file = Bun.file(path);
    if (await file.exists()) return path;
  }

  return null;
}

async function runPathDiscovery(
  targetUrl: string,
  options: PathDiscoveryOptions = {}
): Promise<PathDiscoveryResult> {
  const result: PathDiscoveryResult = {
    target: targetUrl,
    wordlist: "",
    timestamp: new Date().toISOString(),
    totalFound: 0,
    paths: [],
    errors: [],
  };

  // Find wordlist
  const wordlist = await findWordlist(options.wordlist);
  if (!wordlist) {
    result.errors.push("No wordlist found. Install SecLists or provide a custom wordlist with -w");
    return result;
  }
  result.wordlist = wordlist;

  // Build ffuf command
  const args: string[] = [
    "ffuf",
    "-u", targetUrl.includes("FUZZ") ? targetUrl : `${targetUrl.replace(/\/$/, "")}/FUZZ`,
    "-w", wordlist,
    "-json",
    "-noninteractive",
  ];

  // Threading
  args.push("-t", String(options.threads || 40));

  // Timeout
  if (options.timeout) {
    args.push("-timeout", String(options.timeout));
  }

  // Follow redirects
  if (options.followRedirects) {
    args.push("-r");
  }

  // Auto calibrate (filter common responses)
  if (options.autoCalibrate !== false) {
    args.push("-ac");
  }

  // Match/filter status codes
  if (options.matchCodes) {
    args.push("-mc", options.matchCodes);
  }
  if (options.filterCodes) {
    args.push("-fc", options.filterCodes);
  }

  // Recursion
  if (options.recursion) {
    args.push("-recursion");
    if (options.recursionDepth) {
      args.push("-recursion-depth", String(options.recursionDepth));
    }
  }

  // Extensions
  if (options.extensions && options.extensions.length > 0) {
    args.push("-e", options.extensions.join(","));
  }

  // Headers
  if (options.headers) {
    for (const header of options.headers) {
      args.push("-H", header);
    }
  }

  // Cookies
  if (options.cookies) {
    args.push("-b", options.cookies);
  }

  // HTTP method
  if (options.method) {
    args.push("-X", options.method);
  }

  // POST data
  if (options.data) {
    args.push("-d", options.data);
  }

  // Proxy
  if (options.proxy) {
    args.push("-x", options.proxy);
  }

  // Rate limiting
  if (options.rate) {
    args.push("-rate", String(options.rate));
  }

  // Silent mode
  if (options.silent) {
    args.push("-s");
  }

  try {
    const proc = Bun.spawn(args, {
      stdout: "pipe",
      stderr: "pipe",
    });

    const output = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();

    if (stderr && !options.silent) {
      // Filter out progress messages, keep real errors
      const errors = stderr.split("\n").filter(line =>
        line.includes("error") || line.includes("Error") || line.includes("FATAL")
      );
      result.errors.push(...errors);
    }

    // Parse JSON lines output
    const lines = output.trim().split("\n").filter(Boolean);

    for (const line of lines) {
      try {
        const data = JSON.parse(line);

        // ffuf outputs a "results" array in JSON mode
        if (data.results && Array.isArray(data.results)) {
          for (const r of data.results) {
            result.paths.push({
              url: r.url,
              status: r.status,
              length: r.length,
              words: r.words,
              lines: r.lines,
              contentType: r.content_type,
              redirectLocation: r.redirectlocation,
            });
          }
        }
      } catch {
        // Skip non-JSON lines (progress output)
      }
    }

    result.totalFound = result.paths.length;

  } catch (error) {
    result.errors.push(`ffuf execution failed: ${error}`);
  }

  return result;
}

function parseArgs(args: string[]): { url: string; options: PathDiscoveryOptions } {
  const options: PathDiscoveryOptions = {};
  let url = "";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case "-w":
      case "--wordlist":
        options.wordlist = next;
        i++;
        break;
      case "-e":
      case "--extensions":
        options.extensions = next.split(",");
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
      case "-r":
      case "--follow-redirects":
        options.followRedirects = true;
        break;
      case "-mc":
      case "--match-codes":
        options.matchCodes = next;
        i++;
        break;
      case "-fc":
      case "--filter-codes":
        options.filterCodes = next;
        i++;
        break;
      case "--recursion":
        options.recursion = true;
        break;
      case "--recursion-depth":
        options.recursionDepth = parseInt(next);
        i++;
        break;
      case "-H":
      case "--header":
        options.headers = options.headers || [];
        options.headers.push(next);
        i++;
        break;
      case "-b":
      case "--cookies":
        options.cookies = next;
        i++;
        break;
      case "-X":
      case "--method":
        options.method = next;
        i++;
        break;
      case "-d":
      case "--data":
        options.data = next;
        i++;
        break;
      case "--proxy":
        options.proxy = next;
        i++;
        break;
      case "--rate":
        options.rate = parseInt(next);
        i++;
        break;
      case "--json":
        options.json = true;
        break;
      case "-s":
      case "--silent":
        options.silent = true;
        break;
      case "--no-auto-calibrate":
        options.autoCalibrate = false;
        break;
      case "-h":
      case "--help":
        console.log(`
PathDiscovery - Directory and file path fuzzing

Usage:
  bun PathDiscovery.ts <url> [options]

Arguments:
  url                     Target URL (FUZZ keyword optional, defaults to URL/FUZZ)

Options:
  -w, --wordlist <path>   Custom wordlist path (default: SecLists raft-medium-directories)
  -e, --extensions <ext>  Extensions to append (comma-separated: php,html,js)
  -t, --threads <n>       Concurrent threads (default: 40)
  --timeout <seconds>     HTTP request timeout
  -r, --follow-redirects  Follow HTTP redirects
  -mc, --match-codes      Match status codes (default: 200-299,301,302,307,401,403,405,500)
  -fc, --filter-codes     Filter out status codes
  --recursion             Enable recursive scanning
  --recursion-depth <n>   Maximum recursion depth
  -H, --header <header>   Custom header (can use multiple times)
  -b, --cookies <cookies> Cookie string
  -X, --method <method>   HTTP method (default: GET)
  -d, --data <data>       POST data
  --proxy <url>           Proxy URL (HTTP or SOCKS5)
  --rate <n>              Requests per second
  --json                  Output as JSON
  -s, --silent            Silent mode (minimal output)
  --no-auto-calibrate     Disable auto-calibration

Examples:
  bun PathDiscovery.ts https://example.com
  bun PathDiscovery.ts https://example.com -e php,html -t 100
  bun PathDiscovery.ts https://example.com/api/FUZZ -mc 200,201
  bun PathDiscovery.ts https://example.com --json > results.json
`);
        process.exit(0);
      default:
        if (!arg.startsWith("-") && !url) {
          url = arg;
        }
    }
  }

  return { url, options };
}

// Main execution
const args = process.argv.slice(2);
const { url, options } = parseArgs(args);

if (!url) {
  console.error("Error: Target URL required");
  console.error("Usage: bun PathDiscovery.ts <url> [options]");
  console.error("Use --help for more information");
  process.exit(1);
}

const result = await runPathDiscovery(url, options);

if (options.json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`\n🔍 Path Discovery: ${result.target}`);
  console.log(`📚 Wordlist: ${result.wordlist}`);
  console.log(`⏱️  Timestamp: ${result.timestamp}`);
  console.log(`\n📁 Found ${result.totalFound} paths:\n`);

  if (result.paths.length === 0) {
    console.log("  No paths discovered");
  } else {
    // Group by status code
    const byStatus = new Map<number, PathResult[]>();
    for (const path of result.paths) {
      const existing = byStatus.get(path.status) || [];
      existing.push(path);
      byStatus.set(path.status, existing);
    }

    for (const [status, paths] of [...byStatus.entries()].sort((a, b) => a[0] - b[0])) {
      console.log(`  [${status}] ${paths.length} paths:`);
      for (const p of paths.slice(0, 20)) {
        console.log(`    ${p.url} (${p.length} bytes)`);
      }
      if (paths.length > 20) {
        console.log(`    ... and ${paths.length - 20} more`);
      }
      console.log();
    }
  }

  if (result.errors.length > 0) {
    console.log("\n⚠️  Errors:");
    for (const err of result.errors) {
      console.log(`  ${err}`);
    }
  }
}

export { runPathDiscovery, PathDiscoveryOptions, PathDiscoveryResult, PathResult };
