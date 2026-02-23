#!/usr/bin/env bun

/**
 * Domain Recon Aggregator
 *
 * Aggregates subdomain enumeration from multiple sources:
 * - Subfinder (passive sources)
 * - Chaos (ProjectDiscovery database)
 * - Certificate Transparency (crt.sh)
 * - DNS enumeration (dnsx)
 *
 * Usage:
 *   bun run DomainRecon.ts example.com
 *   bun run DomainRecon.ts example.com --json
 *   bun run DomainRecon.ts example.com --resolve
 */

import { $ } from "bun";

interface ReconResult {
  domain: string;
  subdomains: string[];
  sources: Record<string, string[]>;
  resolved?: Record<string, string[]>;
  stats: {
    total: number;
    unique: number;
    bySource: Record<string, number>;
    duration: number;
  };
}

async function runSubfinder(domain: string): Promise<string[]> {
  try {
    const result = await $`subfinder -d ${domain} -silent -all`.text();
    return result.trim().split("\n").filter(Boolean);
  } catch {
    console.error("[subfinder] Failed");
    return [];
  }
}

async function runChaos(domain: string): Promise<string[]> {
  const key = process.env.PDCP_API_KEY;
  if (!key) {
    console.error("[chaos] No PDCP_API_KEY set");
    return [];
  }
  try {
    const result = await $`chaos -key ${key} -d ${domain} -silent`.text();
    return result.trim().split("\n").filter(Boolean);
  } catch {
    console.error("[chaos] Failed");
    return [];
  }
}

async function runCrtsh(domain: string): Promise<string[]> {
  try {
    const response = await fetch(
      `https://crt.sh/?q=%.${domain}&output=json`
    );
    if (!response.ok) return [];
    const data = await response.json() as Array<{ name_value: string }>;
    const names = new Set<string>();
    for (const cert of data) {
      for (const name of cert.name_value.split("\n")) {
        if (name.endsWith(domain) && !name.startsWith("*")) {
          names.add(name.toLowerCase());
        }
      }
    }
    return Array.from(names);
  } catch {
    console.error("[crt.sh] Failed");
    return [];
  }
}

async function resolveSubdomains(
  subdomains: string[]
): Promise<Record<string, string[]>> {
  const resolved: Record<string, string[]> = {};
  try {
    const input = subdomains.join("\n");
    const result = await $`echo ${input} | dnsx -silent -a -resp`.text();
    for (const line of result.trim().split("\n")) {
      const match = line.match(/^(\S+)\s+\[(.+)\]$/);
      if (match) {
        resolved[match[1]] = match[2].split(",").map((s) => s.trim());
      }
    }
  } catch {
    console.error("[dnsx] Resolution failed");
  }
  return resolved;
}

async function main() {
  const args = process.argv.slice(2);
  const domain = args.find((a) => !a.startsWith("-"));
  const jsonOutput = args.includes("--json");
  const resolve = args.includes("--resolve");

  if (!domain) {
    console.log("Usage: DomainRecon.ts <domain> [--json] [--resolve]");
    process.exit(1);
  }

  const startTime = Date.now();
  console.error(`[*] Starting recon for ${domain}`);

  // Run sources in parallel
  const [subfinderResults, chaosResults, crtshResults] = await Promise.all([
    runSubfinder(domain),
    runChaos(domain),
    runCrtsh(domain),
  ]);

  // Deduplicate
  const allSubdomains = new Set<string>();
  const sources: Record<string, string[]> = {
    subfinder: subfinderResults,
    chaos: chaosResults,
    crtsh: crtshResults,
  };

  for (const results of Object.values(sources)) {
    for (const sub of results) {
      allSubdomains.add(sub.toLowerCase());
    }
  }

  const uniqueSubdomains = Array.from(allSubdomains).sort();

  // Optionally resolve
  let resolved: Record<string, string[]> | undefined;
  if (resolve) {
    console.error(`[*] Resolving ${uniqueSubdomains.length} subdomains...`);
    resolved = await resolveSubdomains(uniqueSubdomains);
  }

  const duration = Date.now() - startTime;

  const result: ReconResult = {
    domain,
    subdomains: uniqueSubdomains,
    sources,
    resolved,
    stats: {
      total: subfinderResults.length + chaosResults.length + crtshResults.length,
      unique: uniqueSubdomains.length,
      bySource: {
        subfinder: subfinderResults.length,
        chaos: chaosResults.length,
        crtsh: crtshResults.length,
      },
      duration,
    },
  };

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`\n=== Domain Recon: ${domain} ===\n`);
    console.log(`Subdomains (${uniqueSubdomains.length} unique):`);
    for (const sub of uniqueSubdomains) {
      if (resolved && resolved[sub]) {
        console.log(`  ${sub} → ${resolved[sub].join(", ")}`);
      } else {
        console.log(`  ${sub}`);
      }
    }
    console.log(`\nSources:`);
    console.log(`  subfinder: ${subfinderResults.length}`);
    console.log(`  chaos: ${chaosResults.length}`);
    console.log(`  crt.sh: ${crtshResults.length}`);
    console.log(`\nCompleted in ${(duration / 1000).toFixed(1)}s`);
  }
}

main();
