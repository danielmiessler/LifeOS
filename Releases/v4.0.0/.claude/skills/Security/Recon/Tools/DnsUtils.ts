#!/usr/bin/env bun

/**
 * DNS Utilities
 *
 * DNS enumeration, lookups, and analysis using dig/system DNS.
 *
 * Usage:
 *   const records = await getAllRecords("example.com");
 *   const subdomains = await enumerateSubdomains("example.com");
 */

import { $ } from "bun";

export interface DNSRecord {
  type: string;
  value: string;
  ttl?: number;
}

export interface EmailSecurityInfo {
  spf: {
    configured: boolean;
    record?: string;
    mechanism?: string; // ~all, -all, +all
  };
  dmarc: {
    configured: boolean;
    record?: string;
    policy?: string; // none, quarantine, reject
  };
  dkim: {
    configured: boolean;
    selectors: string[];
  };
}

/**
 * Query DNS records using dig
 */
export async function digQuery(
  domain: string,
  recordType: string = "A"
): Promise<string[]> {
  try {
    const result = await $`dig ${domain} ${recordType} +short`.text();
    return result
      .trim()
      .split("\n")
      .filter((line) => line.length > 0);
  } catch (error) {
    console.error(`dig query failed for ${domain} ${recordType}:`, error);
    return [];
  }
}

/**
 * Get A records (IPv4)
 */
export async function getARecords(domain: string): Promise<string[]> {
  return digQuery(domain, "A");
}

/**
 * Get AAAA records (IPv6)
 */
export async function getAAAARecords(domain: string): Promise<string[]> {
  return digQuery(domain, "AAAA");
}

/**
 * Get MX records (mail servers)
 */
export async function getMXRecords(
  domain: string
): Promise<Array<{ priority: number; hostname: string }>> {
  const records = await digQuery(domain, "MX");

  return records
    .map((record) => {
      const [priority, hostname] = record.split(" ");
      return {
        priority: parseInt(priority, 10),
        hostname: hostname.replace(/\.$/, ""), // Remove trailing dot
      };
    })
    .sort((a, b) => a.priority - b.priority);
}

/**
 * Get NS records (name servers)
 */
export async function getNSRecords(domain: string): Promise<string[]> {
  const records = await digQuery(domain, "NS");
  return records.map((ns) => ns.replace(/\.$/, ""));
}

/**
 * Get TXT records
 */
export async function getTXTRecords(domain: string): Promise<string[]> {
  const records = await digQuery(domain, "TXT");
  // Remove quotes from TXT records
  return records.map((txt) => txt.replace(/^"|"$/g, ""));
}

/**
 * Get CNAME record
 */
export async function getCNAME(domain: string): Promise<string | null> {
  const records = await digQuery(domain, "CNAME");
  return records.length > 0 ? records[0].replace(/\.$/, "") : null;
}

/**
 * Get SOA record
 */
export async function getSOA(domain: string): Promise<{
  mname: string;
  rname: string;
  serial: number;
  refresh: number;
  retry: number;
  expire: number;
  minimum: number;
} | null> {
  const records = await digQuery(domain, "SOA");

  if (records.length === 0) {
    return null;
  }

  const parts = records[0].split(" ");

  if (parts.length < 7) {
    return null;
  }

  return {
    mname: parts[0],
    rname: parts[1],
    serial: parseInt(parts[2], 10),
    refresh: parseInt(parts[3], 10),
    retry: parseInt(parts[4], 10),
    expire: parseInt(parts[5], 10),
    minimum: parseInt(parts[6], 10),
  };
}

/**
 * Reverse DNS lookup
 */
export async function reverseDNS(ip: string): Promise<string | null> {
  try {
    const result = await $`dig -x ${ip} +short`.text();
    const hostname = result.trim();
    return hostname.length > 0 ? hostname.replace(/\.$/, "") : null;
  } catch {
    return null;
  }
}

/**
 * Get all DNS records for a domain
 */
export async function getAllRecords(domain: string): Promise<{
  A: string[];
  AAAA: string[];
  MX: Array<{ priority: number; hostname: string }>;
  NS: string[];
  TXT: string[];
  CNAME: string | null;
  SOA: any;
}> {
  const [A, AAAA, MX, NS, TXT, CNAME, SOA] = await Promise.all([
    getARecords(domain),
    getAAAARecords(domain),
    getMXRecords(domain),
    getNSRecords(domain),
    getTXTRecords(domain),
    getCNAME(domain),
    getSOA(domain),
  ]);

  return { A, AAAA, MX, NS, TXT, CNAME, SOA };
}

/**
 * Analyze email security configuration
 */
export async function analyzeEmailSecurity(
  domain: string
): Promise<EmailSecurityInfo> {
  // SPF
  const txtRecords = await getTXTRecords(domain);
  const spfRecord = txtRecords.find((txt) => txt.startsWith("v=spf1"));

  const spfInfo: EmailSecurityInfo["spf"] = {
    configured: !!spfRecord,
  };

  if (spfRecord) {
    spfInfo.record = spfRecord;

    // Extract mechanism (~all, -all, +all, ?all)
    const mechanismMatch = spfRecord.match(/[~\-+?]all/);
    if (mechanismMatch) {
      spfInfo.mechanism = mechanismMatch[0];
    }
  }

  // DMARC
  const dmarcRecords = await getTXTRecords(`_dmarc.${domain}`);
  const dmarcRecord = dmarcRecords.find((txt) => txt.startsWith("v=DMARC1"));

  const dmarcInfo: EmailSecurityInfo["dmarc"] = {
    configured: !!dmarcRecord,
  };

  if (dmarcRecord) {
    dmarcInfo.record = dmarcRecord;

    // Extract policy
    const policyMatch = dmarcRecord.match(/p=(none|quarantine|reject)/);
    if (policyMatch) {
      dmarcInfo.policy = policyMatch[1];
    }
  }

  // DKIM (check common selectors)
  const commonSelectors = [
    "default",
    "google",
    "k1",
    "k2",
    "selector1",
    "selector2",
    "dkim",
    "mail",
  ];

  const dkimSelectors: string[] = [];

  for (const selector of commonSelectors) {
    const dkimRecords = await getTXTRecords(`${selector}._domainkey.${domain}`);
    if (dkimRecords.length > 0 && dkimRecords[0].includes("v=DKIM1")) {
      dkimSelectors.push(selector);
    }
  }

  return {
    spf: spfInfo,
    dmarc: dmarcInfo,
    dkim: {
      configured: dkimSelectors.length > 0,
      selectors: dkimSelectors,
    },
  };
}

/**
 * Enumerate subdomains via certificate transparency
 */
export async function enumerateSubdomainsViaCert(
  domain: string
): Promise<string[]> {
  try {
    const url = `https://crt.sh/?q=%.${domain}&output=json`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`crt.sh query failed: ${response.status}`);
    }

    const data = (await response.json()) as Array<{ name_value: string }>;

    // Extract unique subdomains
    const subdomains = new Set<string>();

    for (const cert of data) {
      const names = cert.name_value.split("\n");
      for (let name of names) {
        // Remove wildcard prefix
        name = name.replace(/^\*\./, "");

        // Ensure it's a subdomain of our target
        if (name.endsWith(domain) || name === domain) {
          subdomains.add(name.toLowerCase());
        }
      }
    }

    return Array.from(subdomains).sort();
  } catch (error) {
    console.error("Certificate transparency query failed:", error);
    return [];
  }
}

/**
 * Enumerate subdomains using common names
 */
export async function enumerateCommonSubdomains(
  domain: string
): Promise<string[]> {
  const commonPrefixes = [
    "www",
    "mail",
    "ftp",
    "localhost",
    "webmail",
    "smtp",
    "pop",
    "ns1",
    "ns2",
    "webdisk",
    "ns",
    "cpanel",
    "whm",
    "autodiscover",
    "autoconfig",
    "m",
    "imap",
    "test",
    "mx",
    "blog",
    "dev",
    "www2",
    "admin",
    "forum",
    "news",
    "vpn",
    "ns3",
    "mail2",
    "new",
    "mysql",
    "old",
    "lists",
    "support",
    "mobile",
    "mx1",
    "static",
    "api",
    "cdn",
    "media",
    "email",
    "portal",
    "beta",
    "stage",
    "staging",
    "demo",
    "intranet",
    "git",
    "shop",
    "app",
    "apps",
  ];

  const found: string[] = [];

  for (const prefix of commonPrefixes) {
    const subdomain = `${prefix}.${domain}`;
    const records = await getARecords(subdomain);

    if (records.length > 0) {
      found.push(subdomain);
    }
  }

  return found;
}

/**
 * Attempt zone transfer (usually fails but worth trying)
 */
export async function attemptZoneTransfer(domain: string): Promise<{
  success: boolean;
  records?: string[];
  error?: string;
}> {
  try {
    // Get name servers first
    const nameServers = await getNSRecords(domain);

    if (nameServers.length === 0) {
      return {
        success: false,
        error: "No name servers found",
      };
    }

    // Try zone transfer on first NS
    const ns = nameServers[0];
    const result = await $`dig @${ns} ${domain} AXFR`.text();

    // Check if transfer succeeded
    if (result.includes("Transfer failed") || result.includes("refused")) {
      return {
        success: false,
        error: "Zone transfer refused (expected)",
      };
    }

    // Parse records
    const records = result
      .split("\n")
      .filter((line) => line.includes(domain) && !line.startsWith(";"));

    return {
      success: true,
      records,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Validate forward-reverse DNS match
 */
export async function validateForwardReverse(
  domain: string
): Promise<{
  matched: boolean;
  forwardIPs: string[];
  reverseDomains: Map<string, string | null>;
}> {
  const forwardIPs = await getARecords(domain);
  const reverseDomains = new Map<string, string | null>();

  for (const ip of forwardIPs) {
    const reverse = await reverseDNS(ip);
    reverseDomains.set(ip, reverse);
  }

  // Check if any reverse matches the original domain
  const matched = Array.from(reverseDomains.values()).some(
    (reverse) => reverse === domain
  );

  return {
    matched,
    forwardIPs,
    reverseDomains,
  };
}

/**
 * CLI usage
 */
if (import.meta.main) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("Usage:");
    console.log("  dns-utils.ts <domain>              - Get all records");
    console.log("  dns-utils.ts <domain> email        - Email security analysis");
    console.log("  dns-utils.ts <domain> subdomains   - Enumerate subdomains");
    console.log("  dns-utils.ts <domain> reverse <ip> - Reverse DNS");
    process.exit(1);
  }

  const domain = args[0];
  const command = args[1];

  if (!command) {
    const records = await getAllRecords(domain);
    console.log(JSON.stringify(records, null, 2));
  } else if (command === "email") {
    const emailSec = await analyzeEmailSecurity(domain);
    console.log(JSON.stringify(emailSec, null, 2));
  } else if (command === "subdomains") {
    console.log("Searching certificate transparency...");
    const certSubs = await enumerateSubdomainsViaCert(domain);
    console.log(`Found ${certSubs.length} subdomains via cert transparency:`);
    certSubs.forEach((sub) => console.log(`  ${sub}`));

    console.log("\nChecking common subdomains...");
    const commonSubs = await enumerateCommonSubdomains(domain);
    console.log(`Found ${commonSubs.length} common subdomains:`);
    commonSubs.forEach((sub) => console.log(`  ${sub}`));
  } else if (command === "reverse" && args[2]) {
    const hostname = await reverseDNS(args[2]);
    console.log(hostname || "No PTR record found");
  }
}
