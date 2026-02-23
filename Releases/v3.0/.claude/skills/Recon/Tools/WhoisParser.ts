#!/usr/bin/env bun

/**
 * WHOIS Parser
 *
 * Execute and parse WHOIS lookups for domains and IP addresses.
 *
 * Usage:
 *   const domainInfo = await whoisDomain("example.com");
 *   const ipInfo = await whoisIP("1.2.3.4");
 */

import { $ } from "bun";

export interface DomainWhoisInfo {
  domain: string;
  registrar?: string;
  registrarURL?: string;
  creationDate?: Date;
  expirationDate?: Date;
  updatedDate?: Date;
  status?: string[];
  nameServers?: string[];
  registrant?: {
    organization?: string;
    email?: string;
    country?: string;
  };
  admin?: {
    organization?: string;
    email?: string;
  };
  tech?: {
    organization?: string;
    email?: string;
  };
  dnssec?: boolean;
  raw: string;
}

export interface IPWhoisInfo {
  ip: string;
  netRange?: string;
  cidr?: string;
  netName?: string;
  organization?: string;
  country?: string;
  registrationDate?: Date;
  updatedDate?: Date;
  abuseEmail?: string;
  abusePhone?: string;
  techEmail?: string;
  rir?: string; // Regional Internet Registry
  raw: string;
}

/**
 * Execute WHOIS query
 */
async function executeWhois(query: string): Promise<string> {
  try {
    const result = await $`whois ${query}`.text();
    return result;
  } catch (error) {
    throw new Error(
      `WHOIS query failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Parse domain WHOIS data
 */
export async function whoisDomain(domain: string): Promise<DomainWhoisInfo> {
  const raw = await executeWhois(domain);

  const info: DomainWhoisInfo = {
    domain,
    raw,
  };

  // Parse registrar
  const registrarMatch = raw.match(/Registrar:\s*(.+)/i);
  if (registrarMatch) {
    info.registrar = registrarMatch[1].trim();
  }

  // Parse registrar URL
  const urlMatch = raw.match(/Registrar URL:\s*(.+)/i);
  if (urlMatch) {
    info.registrarURL = urlMatch[1].trim();
  }

  // Parse dates
  const creationMatch = raw.match(
    /Creation Date:\s*(.+)|Registered on:\s*(.+)/i
  );
  if (creationMatch) {
    const dateStr = creationMatch[1] || creationMatch[2];
    info.creationDate = parseWhoisDate(dateStr.trim());
  }

  const expirationMatch = raw.match(
    /Expir(?:ation|y) Date:\s*(.+)|Expiry date:\s*(.+)/i
  );
  if (expirationMatch) {
    const dateStr = expirationMatch[1] || expirationMatch[2];
    info.expirationDate = parseWhoisDate(dateStr.trim());
  }

  const updatedMatch = raw.match(
    /Updated Date:\s*(.+)|Last updated:\s*(.+)/i
  );
  if (updatedMatch) {
    const dateStr = updatedMatch[1] || updatedMatch[2];
    info.updatedDate = parseWhoisDate(dateStr.trim());
  }

  // Parse status
  const statusMatches = raw.matchAll(/Domain Status:\s*(.+)/gi);
  info.status = [];
  for (const match of statusMatches) {
    const status = match[1].trim().split(" ")[0]; // Take first word
    info.status.push(status);
  }

  // Parse name servers
  const nsMatches = raw.matchAll(/Name Server:\s*(.+)/gi);
  info.nameServers = [];
  for (const match of nsMatches) {
    info.nameServers.push(match[1].trim().toLowerCase());
  }

  // Parse registrant
  const registrantOrgMatch = raw.match(/Registrant Organization:\s*(.+)/i);
  const registrantEmailMatch = raw.match(/Registrant Email:\s*(.+)/i);
  const registrantCountryMatch = raw.match(/Registrant Country:\s*(.+)/i);

  if (registrantOrgMatch || registrantEmailMatch || registrantCountryMatch) {
    info.registrant = {
      organization: registrantOrgMatch?.[1].trim(),
      email: registrantEmailMatch?.[1].trim(),
      country: registrantCountryMatch?.[1].trim(),
    };
  }

  // Parse admin contact
  const adminOrgMatch = raw.match(/Admin Organization:\s*(.+)/i);
  const adminEmailMatch = raw.match(/Admin Email:\s*(.+)/i);

  if (adminOrgMatch || adminEmailMatch) {
    info.admin = {
      organization: adminOrgMatch?.[1].trim(),
      email: adminEmailMatch?.[1].trim(),
    };
  }

  // Parse tech contact
  const techOrgMatch = raw.match(/Tech Organization:\s*(.+)/i);
  const techEmailMatch = raw.match(/Tech Email:\s*(.+)/i);

  if (techOrgMatch || techEmailMatch) {
    info.tech = {
      organization: techOrgMatch?.[1].trim(),
      email: techEmailMatch?.[1].trim(),
    };
  }

  // Parse DNSSEC
  const dnssecMatch = raw.match(/DNSSEC:\s*(.+)/i);
  if (dnssecMatch) {
    info.dnssec = dnssecMatch[1].trim().toLowerCase() !== "unsigned";
  }

  return info;
}

/**
 * Parse IP/netblock WHOIS data
 */
export async function whoisIP(ip: string): Promise<IPWhoisInfo> {
  const raw = await executeWhois(ip);

  const info: IPWhoisInfo = {
    ip,
    raw,
  };

  // Detect RIR (Regional Internet Registry)
  if (raw.includes("whois.arin.net")) {
    info.rir = "ARIN";
  } else if (raw.includes("whois.ripe.net")) {
    info.rir = "RIPE";
  } else if (raw.includes("whois.apnic.net")) {
    info.rir = "APNIC";
  } else if (raw.includes("whois.lacnic.net")) {
    info.rir = "LACNIC";
  } else if (raw.includes("whois.afrinic.net")) {
    info.rir = "AFRINIC";
  }

  // Parse NetRange
  const netRangeMatch = raw.match(/NetRange:\s*(.+)/i);
  if (netRangeMatch) {
    info.netRange = netRangeMatch[1].trim();
  }

  // Parse CIDR
  const cidrMatch = raw.match(/CIDR:\s*(.+)/i);
  if (cidrMatch) {
    info.cidr = cidrMatch[1].trim();
  }

  // Parse NetName
  const netNameMatch = raw.match(/NetName:\s*(.+)/i);
  if (netNameMatch) {
    info.netName = netNameMatch[1].trim();
  }

  // Parse Organization
  const orgMatch =
    raw.match(/Organization:\s*(.+)/i) ||
    raw.match(/OrgName:\s*(.+)/i) ||
    raw.match(/org-name:\s*(.+)/i);
  if (orgMatch) {
    info.organization = orgMatch[1].trim();
  }

  // Parse Country
  const countryMatch = raw.match(/Country:\s*(.+)/i);
  if (countryMatch) {
    info.country = countryMatch[1].trim();
  }

  // Parse Registration Date
  const regDateMatch = raw.match(/RegDate:\s*(.+)|created:\s*(.+)/i);
  if (regDateMatch) {
    const dateStr = regDateMatch[1] || regDateMatch[2];
    info.registrationDate = parseWhoisDate(dateStr.trim());
  }

  // Parse Updated Date
  const updatedMatch = raw.match(/Updated:\s*(.+)|last-modified:\s*(.+)/i);
  if (updatedMatch) {
    const dateStr = updatedMatch[1] || updatedMatch[2];
    info.updatedDate = parseWhoisDate(dateStr.trim());
  }

  // Parse Abuse Contact
  const abuseEmailMatch = raw.match(/OrgAbuseEmail:\s*(.+)|abuse-c:\s*(.+)/i);
  if (abuseEmailMatch) {
    info.abuseEmail = abuseEmailMatch[1]?.trim();
  }

  const abusePhoneMatch = raw.match(/OrgAbusePhone:\s*(.+)/i);
  if (abusePhoneMatch) {
    info.abusePhone = abusePhoneMatch[1].trim();
  }

  // Parse Tech Contact
  const techEmailMatch = raw.match(/OrgTechEmail:\s*(.+)/i);
  if (techEmailMatch) {
    info.techEmail = techEmailMatch[1].trim();
  }

  return info;
}

/**
 * Parse WHOIS date format (handles multiple formats)
 */
function parseWhoisDate(dateStr: string): Date | undefined {
  if (!dateStr) {
    return undefined;
  }

  // Try standard date parsing
  const date = new Date(dateStr);

  if (!isNaN(date.getTime())) {
    return date;
  }

  // Try common WHOIS formats
  const formats = [
    // ISO 8601
    /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/,
    // YYYY-MM-DD
    /(\d{4})-(\d{2})-(\d{2})/,
    // DD-MMM-YYYY
    /(\d{2})-([A-Za-z]{3})-(\d{4})/,
  ];

  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      return new Date(dateStr);
    }
  }

  return undefined;
}

/**
 * Calculate days until domain expiration
 */
export function daysUntilExpiration(whoisInfo: DomainWhoisInfo): number | null {
  if (!whoisInfo.expirationDate) {
    return null;
  }

  const now = new Date();
  const expiry = whoisInfo.expirationDate;
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Check if domain is about to expire (< 30 days)
 */
export function isDomainExpiringSoon(
  whoisInfo: DomainWhoisInfo,
  daysThreshold: number = 30
): boolean {
  const days = daysUntilExpiration(whoisInfo);
  return days !== null && days < daysThreshold && days > 0;
}

/**
 * Extract all email addresses from WHOIS data
 */
export function extractEmails(
  whoisInfo: DomainWhoisInfo | IPWhoisInfo
): string[] {
  const emails: Set<string> = new Set();

  // Extract from structured data
  if ("registrant" in whoisInfo && whoisInfo.registrant?.email) {
    emails.add(whoisInfo.registrant.email);
  }

  if ("admin" in whoisInfo && whoisInfo.admin?.email) {
    emails.add(whoisInfo.admin.email);
  }

  if ("tech" in whoisInfo && whoisInfo.tech?.email) {
    emails.add(whoisInfo.tech.email);
  }

  if ("abuseEmail" in whoisInfo && whoisInfo.abuseEmail) {
    emails.add(whoisInfo.abuseEmail);
  }

  if ("techEmail" in whoisInfo && whoisInfo.techEmail) {
    emails.add(whoisInfo.techEmail);
  }

  // Extract from raw text using regex
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const matches = whoisInfo.raw.matchAll(emailRegex);

  for (const match of matches) {
    emails.add(match[0].toLowerCase());
  }

  // Filter out privacy/placeholder emails
  const filtered = Array.from(emails).filter(
    (email) =>
      !email.includes("privacy") &&
      !email.includes("redacted") &&
      !email.includes("please-contact-")
  );

  return filtered;
}

/**
 * Check if domain uses privacy protection
 */
export function hasPrivacyProtection(whoisInfo: DomainWhoisInfo): boolean {
  const raw = whoisInfo.raw.toLowerCase();

  const privacyKeywords = [
    "privacy",
    "redacted",
    "not disclosed",
    "data protected",
    "whoisguard",
    "protected",
  ];

  return privacyKeywords.some((keyword) => raw.includes(keyword));
}

/**
 * CLI usage
 */
if (import.meta.main) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("Usage:");
    console.log("  whois-parser.ts <domain>  - Domain WHOIS");
    console.log("  whois-parser.ts <ip>      - IP WHOIS");
    process.exit(1);
  }

  const query = args[0];

  // Detect if IP or domain
  const isIP = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(query);

  if (isIP) {
    const info = await whoisIP(query);
    console.log(JSON.stringify(info, null, 2));
  } else {
    const info = await whoisDomain(query);

    // Display formatted output
    console.log("\n=== Domain WHOIS Information ===\n");
    console.log(`Domain: ${info.domain}`);
    console.log(`Registrar: ${info.registrar || "Unknown"}`);
    console.log(
      `Creation Date: ${info.creationDate?.toISOString() || "Unknown"}`
    );
    console.log(
      `Expiration Date: ${info.expirationDate?.toISOString() || "Unknown"}`
    );

    const daysLeft = daysUntilExpiration(info);
    if (daysLeft !== null) {
      console.log(
        `Days Until Expiration: ${daysLeft} ${daysLeft < 30 ? "⚠️  EXPIRING SOON" : ""}`
      );
    }

    console.log(`Status: ${info.status?.join(", ") || "Unknown"}`);
    console.log(`Name Servers: ${info.nameServers?.join(", ") || "Unknown"}`);
    console.log(`DNSSEC: ${info.dnssec ? "Enabled" : "Disabled"}`);

    if (hasPrivacyProtection(info)) {
      console.log(`Privacy Protection: ✅ Enabled`);
    }

    const emails = extractEmails(info);
    if (emails.length > 0) {
      console.log(`\nContact Emails:`);
      emails.forEach((email) => console.log(`  - ${email}`));
    }
  }
}
