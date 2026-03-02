#!/usr/bin/env bun
/**
 * MassScan.ts - Large-scale network port scanning
 * Wraps masscan for scanning large IP ranges at high speed
 *
 * ⚠️  REQUIRES ROOT/SUDO for raw packet operations
 *
 * Usage:
 *   sudo bun MassScan.ts <target> [options]
 *
 * Examples:
 *   sudo bun MassScan.ts 10.0.0.0/8 -p 80,443
 *   sudo bun MassScan.ts 192.168.0.0/16 --rate 10000
 *   sudo bun MassScan.ts targets.txt -p 22,80,443,3389 --json
 */

import { $ } from "bun";

interface MassScanOptions {
  ports?: string;
  rate?: number;
  banners?: boolean;
  excludeFile?: string;
  includeFile?: string;
  adapter?: string;
  adapterIp?: string;
  adapterMac?: string;
  routerMac?: string;
  outputFile?: string;
  json?: boolean;
  wait?: number;
  retries?: number;
  excludePorts?: string;
}

interface MassScanResult {
  ip: string;
  port: number;
  protocol: string;
  state: string;
  reason?: string;
  ttl?: number;
  banner?: string;
  timestamp?: string;
}

interface MassScanReport {
  target: string;
  timestamp: string;
  rate: number;
  portsScanned: string;
  totalHosts: number;
  totalPorts: number;
  results: MassScanResult[];
  errors: string[];
}

async function runMassScan(
  target: string,
  options: MassScanOptions = {}
): Promise<MassScanReport> {
  const result: MassScanReport = {
    target,
    timestamp: new Date().toISOString(),
    rate: options.rate || 1000,
    portsScanned: options.ports || "80",
    totalHosts: 0,
    totalPorts: 0,
    results: [],
    errors: [],
  };

  // Check if running as root (masscan requires it)
  const uid = process.getuid?.() ?? 1000;
  if (uid !== 0) {
    result.errors.push("masscan requires root privileges. Run with sudo.");
    return result;
  }

  // Build masscan command
  const args: string[] = ["masscan"];

  // Target (can be CIDR, IP, or file)
  const isFile = await Bun.file(target).exists();
  if (isFile) {
    args.push("-iL", target);
  } else {
    args.push(target);
  }

  // Ports
  args.push("-p", options.ports || "80");

  // Rate (packets per second)
  args.push("--rate", String(options.rate || 1000));

  // Output format - JSON for parsing
  args.push("-oJ", "-");

  // Banner grabbing
  if (options.banners) {
    args.push("--banners");
  }

  // Exclusions
  if (options.excludeFile) {
    args.push("--excludefile", options.excludeFile);
  }

  // Network adapter settings
  if (options.adapter) {
    args.push("--adapter", options.adapter);
  }
  if (options.adapterIp) {
    args.push("--adapter-ip", options.adapterIp);
  }
  if (options.adapterMac) {
    args.push("--adapter-mac", options.adapterMac);
  }
  if (options.routerMac) {
    args.push("--router-mac", options.routerMac);
  }

  // Wait time after scan
  if (options.wait !== undefined) {
    args.push("--wait", String(options.wait));
  }

  // Retries
  if (options.retries) {
    args.push("--retries", String(options.retries));
  }

  try {
    const proc = Bun.spawn(args, {
      stdout: "pipe",
      stderr: "pipe",
    });

    const output = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();

    if (stderr) {
      // Filter out info messages, keep errors
      const errors = stderr.split("\n").filter(line =>
        line.toLowerCase().includes("error") ||
        line.toLowerCase().includes("fatal") ||
        line.toLowerCase().includes("failed")
      );
      result.errors.push(...errors);
    }

    // Parse JSON output (masscan outputs JSON array when using -oJ -)
    try {
      // masscan JSON output is an array with final stats object
      const data = JSON.parse(output);

      if (Array.isArray(data)) {
        const hostSet = new Set<string>();

        for (const entry of data) {
          // Skip the final statistics entry
          if (entry.finished) continue;

          if (entry.ip && entry.ports) {
            for (const port of entry.ports) {
              result.results.push({
                ip: entry.ip,
                port: port.port,
                protocol: port.proto,
                state: port.status,
                reason: port.reason,
                ttl: port.ttl,
                banner: port.service?.banner,
                timestamp: entry.timestamp,
              });
              hostSet.add(entry.ip);
            }
          }
        }

        result.totalHosts = hostSet.size;
        result.totalPorts = result.results.length;
      }
    } catch {
      // If JSON parsing fails, try line-by-line
      const lines = output.trim().split("\n").filter(Boolean);
      const hostSet = new Set<string>();

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.ip && entry.ports) {
            for (const port of entry.ports) {
              result.results.push({
                ip: entry.ip,
                port: port.port,
                protocol: port.proto,
                state: port.status,
              });
              hostSet.add(entry.ip);
            }
          }
        } catch {
          // Skip unparseable lines
        }
      }

      result.totalHosts = hostSet.size;
      result.totalPorts = result.results.length;
    }

  } catch (error) {
    result.errors.push(`masscan execution failed: ${error}`);
  }

  return result;
}

function parseArgs(args: string[]): { target: string; options: MassScanOptions } {
  const options: MassScanOptions = {};
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
      case "--rate":
        options.rate = parseInt(next);
        i++;
        break;
      case "--banners":
        options.banners = true;
        break;
      case "--excludefile":
        options.excludeFile = next;
        i++;
        break;
      case "-iL":
      case "--include-file":
        options.includeFile = next;
        i++;
        break;
      case "--adapter":
        options.adapter = next;
        i++;
        break;
      case "--adapter-ip":
        options.adapterIp = next;
        i++;
        break;
      case "--adapter-mac":
        options.adapterMac = next;
        i++;
        break;
      case "--router-mac":
        options.routerMac = next;
        i++;
        break;
      case "-o":
      case "--output":
        options.outputFile = next;
        i++;
        break;
      case "--json":
        options.json = true;
        break;
      case "--wait":
        options.wait = parseInt(next);
        i++;
        break;
      case "--retries":
        options.retries = parseInt(next);
        i++;
        break;
      case "-h":
      case "--help":
        console.log(`
MassScan - Large-scale network port scanning

⚠️  REQUIRES ROOT/SUDO for raw packet operations

Usage:
  sudo bun MassScan.ts <target> [options]

Arguments:
  target                  CIDR range, IP, or file containing targets

Options:
  -p, --ports <ports>     Ports to scan (80,443 or 0-65535)
  --rate <n>              Packets per second (default: 1000)
  --banners               Grab service banners
  --excludefile <file>    File with IPs/ranges to exclude
  --adapter <name>        Network interface to use
  --adapter-ip <ip>       Source IP address
  --adapter-mac <mac>     Source MAC address
  --router-mac <mac>      Gateway MAC address
  --wait <seconds>        Wait time for responses after scan
  --retries <n>           Number of retries per port
  -o, --output <file>     Save results to file
  --json                  Output as JSON

Rate Guidelines:
  - Home network: 1000-10000 pps
  - Corporate: 10000-100000 pps
  - Data center: 100000+ pps
  - Internet-wide: 1000000+ pps (be careful!)

Examples:
  sudo bun MassScan.ts 192.168.1.0/24 -p 80,443
  sudo bun MassScan.ts 10.0.0.0/8 -p 22 --rate 50000
  sudo bun MassScan.ts 0.0.0.0/0 -p 443 --rate 1000000 --banners
  sudo bun MassScan.ts targets.txt -p 1-1000 --json > results.json
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

if (!target && !options.includeFile) {
  console.error("Error: Target required (CIDR, IP, or file)");
  console.error("Usage: sudo bun MassScan.ts <target> [options]");
  console.error("Use --help for more information");
  process.exit(1);
}

const result = await runMassScan(target || options.includeFile!, options);

if (options.json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`\n🚀 MassScan: ${result.target}`);
  console.log(`⏱️  Timestamp: ${result.timestamp}`);
  console.log(`📡 Rate: ${result.rate} packets/second`);
  console.log(`🎯 Ports: ${result.portsScanned}`);

  if (result.errors.length > 0 && result.errors.some(e => e.includes("root"))) {
    console.log("\n⚠️  Run with sudo for raw packet scanning");
  } else {
    console.log(`\n📊 Found ${result.totalPorts} open ports on ${result.totalHosts} hosts:\n`);

    if (result.results.length === 0) {
      console.log("  No open ports found");
    } else {
      // Group by IP
      const byIp = new Map<string, MassScanResult[]>();
      for (const r of result.results) {
        const existing = byIp.get(r.ip) || [];
        existing.push(r);
        byIp.set(r.ip, existing);
      }

      // Sort IPs numerically
      const sortedIps = [...byIp.keys()].sort((a, b) => {
        const aParts = a.split(".").map(Number);
        const bParts = b.split(".").map(Number);
        for (let i = 0; i < 4; i++) {
          if (aParts[i] !== bParts[i]) return aParts[i] - bParts[i];
        }
        return 0;
      });

      for (const ip of sortedIps.slice(0, 50)) {
        const ports = byIp.get(ip)!;
        const portList = ports.map(p => p.port).sort((a, b) => a - b).join(", ");
        console.log(`  ${ip}`);
        console.log(`    Open: ${portList}`);
        if (ports.some(p => p.banner)) {
          for (const p of ports.filter(p => p.banner)) {
            console.log(`    ${p.port}: ${p.banner}`);
          }
        }
        console.log();
      }

      if (sortedIps.length > 50) {
        console.log(`  ... and ${sortedIps.length - 50} more hosts`);
      }
    }
  }

  if (result.errors.length > 0) {
    console.log("\n⚠️  Errors:");
    for (const err of result.errors) {
      console.log(`  ${err}`);
    }
  }
}

// Save to file if requested
if (options.outputFile) {
  await Bun.write(options.outputFile, JSON.stringify(result, null, 2));
  console.log(`\n💾 Results saved to: ${options.outputFile}`);
}

export { runMassScan, MassScanOptions, MassScanReport, MassScanResult };
