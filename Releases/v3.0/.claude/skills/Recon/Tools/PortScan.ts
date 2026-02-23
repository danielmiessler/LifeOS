#!/usr/bin/env bun
/**
 * PortScan.ts - Port scanning for hosts and networks
 * Wraps naabu for fast and reliable port enumeration
 *
 * Usage:
 *   bun PortScan.ts <target> [options]
 *
 * Examples:
 *   bun PortScan.ts example.com
 *   bun PortScan.ts example.com -p 80,443,8080
 *   bun PortScan.ts 192.168.1.0/24 --top-ports 1000
 *   bun PortScan.ts targets.txt --json
 */

import { $ } from "bun";

interface PortScanOptions {
  ports?: string;
  topPorts?: string;
  excludePorts?: string;
  rate?: number;
  threads?: number;
  timeout?: number;
  scanType?: "syn" | "connect";
  json?: boolean;
  silent?: boolean;
  nmap?: string;
  excludeCdn?: boolean;
  displayCdn?: boolean;
  scanAllIps?: boolean;
  resolver?: string;
  proxy?: string;
}

interface PortResult {
  host: string;
  ip: string;
  port: number;
  protocol: string;
  cdn?: string;
}

interface PortScanResult {
  target: string;
  timestamp: string;
  scanType: string;
  portsScanned: string;
  totalHosts: number;
  totalPorts: number;
  results: PortResult[];
  errors: string[];
}

async function runPortScan(
  target: string,
  options: PortScanOptions = {}
): Promise<PortScanResult> {
  const result: PortScanResult = {
    target,
    timestamp: new Date().toISOString(),
    scanType: options.scanType || "connect",
    portsScanned: options.ports || options.topPorts || "top 100",
    totalHosts: 0,
    totalPorts: 0,
    results: [],
    errors: [],
  };

  // Determine if target is a file or direct input
  const isFile = await Bun.file(target).exists();

  // Build naabu command
  const args: string[] = ["naabu"];

  if (isFile) {
    args.push("-list", target);
  } else {
    args.push("-host", target);
  }

  // Output format
  args.push("-json");

  // Ports configuration
  if (options.ports) {
    args.push("-p", options.ports);
  } else if (options.topPorts) {
    args.push("-top-ports", options.topPorts);
  }

  if (options.excludePorts) {
    args.push("-exclude-ports", options.excludePorts);
  }

  // Rate and threading
  if (options.rate) {
    args.push("-rate", String(options.rate));
  }
  if (options.threads) {
    args.push("-c", String(options.threads));
  }

  // Scan type (SYN requires root)
  if (options.scanType === "syn") {
    args.push("-s", "s");
  }

  // CDN handling
  if (options.excludeCdn) {
    args.push("-exclude-cdn");
  }
  if (options.displayCdn) {
    args.push("-display-cdn");
  }

  // Scan all IPs for hostname
  if (options.scanAllIps) {
    args.push("-scan-all-ips");
  }

  // Custom resolver
  if (options.resolver) {
    args.push("-r", options.resolver);
  }

  // Proxy
  if (options.proxy) {
    args.push("-proxy", options.proxy);
  }

  // Nmap integration
  if (options.nmap) {
    args.push("-nmap-cli", options.nmap);
  }

  // Silent mode
  if (options.silent) {
    args.push("-silent");
  }

  try {
    const proc = Bun.spawn(args, {
      stdout: "pipe",
      stderr: "pipe",
    });

    const output = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();

    if (stderr) {
      // Filter out info/progress messages
      const errors = stderr.split("\n").filter(line =>
        line.includes("[ERR]") || line.includes("[FATAL]")
      );
      result.errors.push(...errors);
    }

    // Parse JSON lines output
    const lines = output.trim().split("\n").filter(Boolean);
    const hostSet = new Set<string>();

    for (const line of lines) {
      try {
        const data = JSON.parse(line);

        if (data.host && data.port) {
          result.results.push({
            host: data.host,
            ip: data.ip || data.host,
            port: data.port,
            protocol: data.protocol || "tcp",
            cdn: data.cdn,
          });
          hostSet.add(data.host);
        }
      } catch {
        // Skip non-JSON lines
      }
    }

    result.totalHosts = hostSet.size;
    result.totalPorts = result.results.length;

  } catch (error) {
    result.errors.push(`naabu execution failed: ${error}`);
  }

  return result;
}

function parseArgs(args: string[]): { target: string; options: PortScanOptions } {
  const options: PortScanOptions = {};
  let target = "";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case "-p":
      case "--ports":
        options.ports = next;
        i++;
        break;
      case "-tp":
      case "--top-ports":
        options.topPorts = next;
        i++;
        break;
      case "-ep":
      case "--exclude-ports":
        options.excludePorts = next;
        i++;
        break;
      case "--rate":
        options.rate = parseInt(next);
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
      case "-s":
      case "--scan-type":
        options.scanType = next as "syn" | "connect";
        i++;
        break;
      case "--json":
        options.json = true;
        break;
      case "--silent":
        options.silent = true;
        break;
      case "--nmap":
        options.nmap = next;
        i++;
        break;
      case "--exclude-cdn":
        options.excludeCdn = true;
        break;
      case "--display-cdn":
        options.displayCdn = true;
        break;
      case "--scan-all-ips":
        options.scanAllIps = true;
        break;
      case "-r":
      case "--resolver":
        options.resolver = next;
        i++;
        break;
      case "--proxy":
        options.proxy = next;
        i++;
        break;
      case "-h":
      case "--help":
        console.log(`
PortScan - Fast port scanning

Usage:
  bun PortScan.ts <target> [options]

Arguments:
  target                  Host, IP, CIDR, or file containing targets

Options:
  -p, --ports <ports>     Ports to scan (80,443 or 1-1000)
  -tp, --top-ports <n>    Top ports to scan: 100, 1000, or full
  -ep, --exclude-ports    Ports to exclude
  --rate <n>              Packets per second (default: 1000)
  -t, --threads <n>       Worker threads (default: 25)
  -s, --scan-type <type>  Scan type: syn or connect (syn requires root)
  --exclude-cdn           Skip CDN/WAF hosts (scan only 80,443)
  --display-cdn           Show CDN provider in results
  --scan-all-ips          Scan all IPs for hostname (not just first)
  -r, --resolver <dns>    Custom DNS resolver
  --proxy <url>           SOCKS5 proxy
  --nmap <cmd>            Run nmap command on results
  --json                  Output as JSON
  --silent                Minimal output

Examples:
  bun PortScan.ts example.com
  bun PortScan.ts example.com -p 22,80,443,8080
  bun PortScan.ts 192.168.1.0/24 --top-ports 1000
  bun PortScan.ts targets.txt --json > open-ports.json
  bun PortScan.ts example.com --nmap "nmap -sV -sC"
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

if (!target) {
  console.error("Error: Target required (host, IP, CIDR, or file)");
  console.error("Usage: bun PortScan.ts <target> [options]");
  console.error("Use --help for more information");
  process.exit(1);
}

const result = await runPortScan(target, options);

if (options.json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`\n🔍 Port Scan: ${result.target}`);
  console.log(`⏱️  Timestamp: ${result.timestamp}`);
  console.log(`📡 Scan Type: ${result.scanType}`);
  console.log(`🎯 Ports: ${result.portsScanned}`);
  console.log(`\n📊 Found ${result.totalPorts} open ports on ${result.totalHosts} hosts:\n`);

  if (result.results.length === 0) {
    console.log("  No open ports found");
  } else {
    // Group by host
    const byHost = new Map<string, PortResult[]>();
    for (const r of result.results) {
      const key = r.host;
      const existing = byHost.get(key) || [];
      existing.push(r);
      byHost.set(key, existing);
    }

    for (const [host, ports] of byHost.entries()) {
      const portList = ports.map(p => p.port).sort((a, b) => a - b).join(", ");
      const cdn = ports[0].cdn ? ` (CDN: ${ports[0].cdn})` : "";
      console.log(`  ${host}${cdn}`);
      console.log(`    Open: ${portList}`);
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

export { runPortScan, PortScanOptions, PortScanResult, PortResult };
