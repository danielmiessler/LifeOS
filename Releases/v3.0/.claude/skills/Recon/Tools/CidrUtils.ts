#!/usr/bin/env bun

/**
 * CIDR Utilities
 *
 * Parse and manipulate CIDR notation, calculate IP ranges, generate IPs.
 *
 * Usage:
 *   const cidr = parseCIDR("192.168.1.0/24");
 *   console.log(cidr.totalIPs); // 256
 *   const ips = generateIPsFromCIDR("192.168.1.0/28", 5);
 */

export interface CIDRInfo {
  cidr: string;
  network: string;
  mask: number;
  netmask: string;
  firstIP: string;
  lastIP: string;
  broadcast: string;
  totalIPs: number;
  usableIPs: number;
  wildcard: string;
}

/**
 * Parse CIDR notation into detailed information
 */
export function parseCIDR(cidr: string): CIDRInfo {
  const [networkStr, maskStr] = cidr.split("/");

  if (!networkStr || !maskStr) {
    throw new Error(`Invalid CIDR notation: ${cidr}`);
  }

  const mask = parseInt(maskStr, 10);

  if (mask < 0 || mask > 32) {
    throw new Error(`Invalid mask: ${mask}. Must be 0-32.`);
  }

  if (!isValidIP(networkStr)) {
    throw new Error(`Invalid IP address: ${networkStr}`);
  }

  // Calculate mask and wildcard
  const maskInt = ((0xffffffff << (32 - mask)) >>> 0);
  const wildcardInt = ~maskInt >>> 0;

  // Calculate network address
  const ipInt = ipToInt(networkStr);
  const networkInt = (ipInt & maskInt) >>> 0;

  // Calculate broadcast address
  const broadcastInt = (networkInt | wildcardInt) >>> 0;

  // Total and usable IPs
  const totalIPs = Math.pow(2, 32 - mask);
  const usableIPs = mask === 32 ? 1 : mask === 31 ? 2 : totalIPs - 2;

  return {
    cidr,
    network: intToIP(networkInt),
    mask,
    netmask: intToIP(maskInt),
    firstIP: mask === 32 ? intToIP(networkInt) : intToIP(networkInt + 1),
    lastIP: mask === 32 ? intToIP(networkInt) : intToIP(broadcastInt - 1),
    broadcast: intToIP(broadcastInt),
    totalIPs,
    usableIPs,
    wildcard: intToIP(wildcardInt),
  };
}

/**
 * Convert IP address to 32-bit integer
 */
export function ipToInt(ip: string): number {
  const parts = ip.split(".");

  if (parts.length !== 4) {
    throw new Error(`Invalid IP address: ${ip}`);
  }

  return (
    parts.reduce((int, octet) => {
      const num = parseInt(octet, 10);
      if (num < 0 || num > 255) {
        throw new Error(`Invalid octet: ${octet} in IP ${ip}`);
      }
      return (int << 8) + num;
    }, 0) >>> 0
  );
}

/**
 * Convert 32-bit integer to IP address
 */
export function intToIP(int: number): string {
  return [
    (int >>> 24) & 0xff,
    (int >>> 16) & 0xff,
    (int >>> 8) & 0xff,
    int & 0xff,
  ].join(".");
}

/**
 * Validate IP address format
 */
export function isValidIP(ip: string): boolean {
  const parts = ip.split(".");

  if (parts.length !== 4) {
    return false;
  }

  return parts.every((part) => {
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255 && part === num.toString();
  });
}

/**
 * Check if IP is in CIDR range
 */
export function isIPInRange(ip: string, cidr: string): boolean {
  const cidrInfo = parseCIDR(cidr);
  const ipInt = ipToInt(ip);
  const firstInt = ipToInt(cidrInfo.network);
  const lastInt = ipToInt(cidrInfo.broadcast);

  return ipInt >= firstInt && ipInt <= lastInt;
}

/**
 * Generate all IPs in CIDR range (use carefully for large ranges!)
 */
export function* generateAllIPs(cidr: string): Generator<string> {
  const info = parseCIDR(cidr);

  if (info.totalIPs > 65536) {
    throw new Error(
      `CIDR range too large (${info.totalIPs} IPs). Use generateIPsFromCIDR with limit.`
    );
  }

  const startInt = ipToInt(info.network);
  const endInt = ipToInt(info.broadcast);

  for (let i = startInt; i <= endInt; i++) {
    yield intToIP(i);
  }
}

/**
 * Generate sample IPs from CIDR range
 */
export function generateIPsFromCIDR(
  cidr: string,
  count: number,
  strategy:
    | "first"
    | "last"
    | "random"
    | "distributed" = "distributed"
): string[] {
  const info = parseCIDR(cidr);
  const ips: string[] = [];

  const firstInt = ipToInt(info.network);
  const lastInt = ipToInt(info.broadcast);
  const totalIPs = lastInt - firstInt + 1;

  if (count > totalIPs) {
    count = totalIPs;
  }

  switch (strategy) {
    case "first":
      for (let i = 0; i < count; i++) {
        ips.push(intToIP(firstInt + i));
      }
      break;

    case "last":
      for (let i = 0; i < count; i++) {
        ips.push(intToIP(lastInt - i));
      }
      break;

    case "random":
      const selected = new Set<number>();
      while (selected.size < count) {
        const randomOffset = Math.floor(Math.random() * totalIPs);
        selected.add(firstInt + randomOffset);
      }
      ips.push(...Array.from(selected).map(intToIP));
      break;

    case "distributed":
      // Distribute IPs evenly across the range
      const step = totalIPs / count;
      for (let i = 0; i < count; i++) {
        const offset = Math.floor(i * step);
        ips.push(intToIP(firstInt + offset));
      }
      break;
  }

  return ips;
}

/**
 * Get sample IPs for reconnaissance (common gateway/server IPs)
 */
export function getSampleReconIPs(cidr: string): string[] {
  const info = parseCIDR(cidr);
  const samples: string[] = [];

  // Get base octets
  const base = info.network.split(".").slice(0, 3).join(".");

  // Common infrastructure IPs
  const commonOffsets = [
    1, // Gateway
    2, // Secondary gateway
    10, // Common server
    50, // Common server
    100, // Common server
    254, // Alternate gateway
  ];

  for (const offset of commonOffsets) {
    const ip = `${base}.${offset}`;
    if (isIPInRange(ip, cidr)) {
      samples.push(ip);
    }
  }

  // Add boundaries
  samples.push(info.firstIP);
  samples.push(info.lastIP);

  // Add middle
  const firstInt = ipToInt(info.firstIP);
  const lastInt = ipToInt(info.lastIP);
  const midInt = Math.floor((firstInt + lastInt) / 2);
  samples.push(intToIP(midInt));

  // Remove duplicates
  return [...new Set(samples)];
}

/**
 * Find common netblock for multiple IPs
 */
export function findCommonNetblock(ips: string[]): string | null {
  if (ips.length === 0) {
    return null;
  }

  if (ips.length === 1) {
    return `${ips[0]}/32`;
  }

  // Convert all IPs to integers
  const ipInts = ips.map(ipToInt);

  // Start with /32 and work backwards to find common prefix
  for (let mask = 32; mask >= 0; mask--) {
    const maskInt = ((0xffffffff << (32 - mask)) >>> 0);

    // Check if all IPs have same network address with this mask
    const networks = ipInts.map((ip) => (ip & maskInt) >>> 0);
    const uniqueNetworks = new Set(networks);

    if (uniqueNetworks.size === 1) {
      const networkInt = networks[0];
      return `${intToIP(networkInt)}/${mask}`;
    }
  }

  return null; // Should never reach here
}

/**
 * Split CIDR into smaller subnets
 */
export function splitCIDR(cidr: string, newMask: number): string[] {
  const info = parseCIDR(cidr);

  if (newMask <= info.mask) {
    throw new Error(
      `New mask (${newMask}) must be larger than current mask (${info.mask})`
    );
  }

  const subnets: string[] = [];
  const subnetCount = Math.pow(2, newMask - info.mask);

  const firstInt = ipToInt(info.network);
  const subnetSize = Math.pow(2, 32 - newMask);

  for (let i = 0; i < subnetCount; i++) {
    const subnetInt = firstInt + i * subnetSize;
    subnets.push(`${intToIP(subnetInt)}/${newMask}`);
  }

  return subnets;
}

/**
 * Summarize multiple CIDRs into larger blocks (aggregate)
 */
export function aggregateCIDRs(cidrs: string[]): string[] {
  // Sort CIDRs by network address
  const sorted = cidrs
    .map(parseCIDR)
    .sort((a, b) => ipToInt(a.network) - ipToInt(b.network));

  const aggregated: CIDRInfo[] = [];

  for (const current of sorted) {
    if (aggregated.length === 0) {
      aggregated.push(current);
      continue;
    }

    const last = aggregated[aggregated.length - 1];

    // Check if current can be merged with last
    const lastEnd = ipToInt(last.broadcast);
    const currentStart = ipToInt(current.network);

    if (currentStart === lastEnd + 1 && last.mask === current.mask) {
      // Adjacent and same size, try to aggregate
      const combined = `${last.network}/${last.mask - 1}`;
      try {
        const combinedInfo = parseCIDR(combined);
        aggregated[aggregated.length - 1] = combinedInfo;
      } catch {
        aggregated.push(current);
      }
    } else {
      aggregated.push(current);
    }
  }

  return aggregated.map((info) => info.cidr);
}

/**
 * CLI usage
 */
if (import.meta.main) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("Usage:");
    console.log("  cidr-utils.ts <cidr>                  - Parse CIDR");
    console.log(
      "  cidr-utils.ts <cidr> sample <count>   - Generate sample IPs"
    );
    console.log("  cidr-utils.ts <cidr> split <mask>     - Split into subnets");
    process.exit(1);
  }

  const cidr = args[0];
  const command = args[1];

  if (!command) {
    // Parse CIDR
    const info = parseCIDR(cidr);
    console.log(JSON.stringify(info, null, 2));
  } else if (command === "sample") {
    const count = parseInt(args[2] || "10", 10);
    const ips = generateIPsFromCIDR(cidr, count);
    ips.forEach((ip) => console.log(ip));
  } else if (command === "split") {
    const newMask = parseInt(args[2], 10);
    const subnets = splitCIDR(cidr, newMask);
    subnets.forEach((subnet) => console.log(subnet));
  } else if (command === "recon") {
    const samples = getSampleReconIPs(cidr);
    samples.forEach((ip) => console.log(ip));
  }
}
