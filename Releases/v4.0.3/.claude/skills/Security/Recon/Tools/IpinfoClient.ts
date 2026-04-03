#!/usr/bin/env bun

/**
 * IPInfo API Client
 *
 * Wrapper for ipinfo.io API with error handling, rate limiting, and caching.
 * Requires IPINFO_API_KEY environment variable.
 *
 * Usage:
 *   const client = new IPInfoClient();
 *   const info = await client.lookup("1.2.3.4");
 *   console.log(info.organization, info.location);
 */

export interface IPInfoResponse {
  ip: string;
  hostname?: string;
  city?: string;
  region?: string;
  country?: string;
  loc?: string; // "latitude,longitude"
  postal?: string;
  timezone?: string;
  asn?: {
    asn: string; // "AS15169"
    name: string; // "Google LLC"
    domain: string; // "google.com"
    route: string; // "8.8.8.0/24"
    type: string; // "business" | "hosting" | "isp" | "education"
  };
  company?: {
    name: string;
    domain: string;
    type: string;
  };
  privacy?: {
    vpn: boolean;
    proxy: boolean;
    tor: boolean;
    relay: boolean;
    hosting: boolean;
  };
  abuse?: {
    address: string;
    country: string;
    email: string;
    name: string;
    network: string;
    phone: string;
  };
}

export interface IPInfoBatchResponse {
  [ip: string]: IPInfoResponse;
}

export class IPInfoClient {
  private apiKey: string;
  private baseUrl = "https://ipinfo.io";
  private cache: Map<string, IPInfoResponse> = new Map();
  private lastRequestTime = 0;
  private minRequestInterval = 100; // ms between requests (10 req/sec)

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.IPINFO_API_KEY || "";

    if (!this.apiKey) {
      throw new Error(
        "IPInfo API key not found. Set IPINFO_API_KEY environment variable."
      );
    }
  }

  /**
   * Lookup single IP address
   */
  async lookup(ip: string): Promise<IPInfoResponse> {
    // Check cache
    if (this.cache.has(ip)) {
      return this.cache.get(ip)!;
    }

    // Rate limiting
    await this.rateLimit();

    const url = `${this.baseUrl}/${ip}/json?token=${this.apiKey}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("IPInfo API rate limit exceeded");
        }
        if (response.status === 401) {
          throw new Error("Invalid IPInfo API key");
        }
        throw new Error(`IPInfo API error: ${response.status}`);
      }

      const data = (await response.json()) as IPInfoResponse;

      // Cache result
      this.cache.set(ip, data);

      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`IPInfo lookup failed for ${ip}: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Batch lookup multiple IPs (more efficient)
   */
  async batchLookup(ips: string[]): Promise<IPInfoBatchResponse> {
    if (ips.length === 0) {
      return {};
    }

    // Check which IPs are already cached
    const uncachedIPs = ips.filter((ip) => !this.cache.has(ip));

    if (uncachedIPs.length === 0) {
      // All cached
      const result: IPInfoBatchResponse = {};
      for (const ip of ips) {
        result[ip] = this.cache.get(ip)!;
      }
      return result;
    }

    // Rate limiting
    await this.rateLimit();

    const url = `${this.baseUrl}/batch?token=${this.apiKey}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(uncachedIPs),
      });

      if (!response.ok) {
        throw new Error(`IPInfo batch API error: ${response.status}`);
      }

      const data = (await response.json()) as IPInfoBatchResponse;

      // Cache all results
      for (const [ip, info] of Object.entries(data)) {
        this.cache.set(ip, info);
      }

      // Return full result including cached IPs
      const result: IPInfoBatchResponse = {};
      for (const ip of ips) {
        const cached = this.cache.get(ip);
        if (cached) {
          result[ip] = cached;
        }
      }

      return result;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`IPInfo batch lookup failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get geolocation info
   */
  async getLocation(ip: string): Promise<{
    city: string;
    region: string;
    country: string;
    latitude: number;
    longitude: number;
  } | null> {
    const info = await this.lookup(ip);

    if (!info.city || !info.region || !info.country || !info.loc) {
      return null;
    }

    const [lat, lon] = info.loc.split(",").map(Number);

    return {
      city: info.city,
      region: info.region,
      country: info.country,
      latitude: lat,
      longitude: lon,
    };
  }

  /**
   * Get ASN info
   */
  async getASN(ip: string): Promise<{
    asn: string;
    name: string;
    route: string;
    type: string;
  } | null> {
    const info = await this.lookup(ip);

    if (!info.asn) {
      return null;
    }

    return {
      asn: info.asn.asn,
      name: info.asn.name,
      route: info.asn.route,
      type: info.asn.type,
    };
  }

  /**
   * Get organization info
   */
  async getOrganization(ip: string): Promise<{
    name: string;
    domain: string;
    type: string;
  } | null> {
    const info = await this.lookup(ip);

    if (!info.company) {
      return null;
    }

    return {
      name: info.company.name,
      domain: info.company.domain,
      type: info.company.type,
    };
  }

  /**
   * Check if IP is VPN/Proxy/Tor
   */
  async isProxy(ip: string): Promise<{
    isProxy: boolean;
    vpn: boolean;
    proxy: boolean;
    tor: boolean;
    relay: boolean;
    hosting: boolean;
  }> {
    const info = await this.lookup(ip);

    if (!info.privacy) {
      return {
        isProxy: false,
        vpn: false,
        proxy: false,
        tor: false,
        relay: false,
        hosting: false,
      };
    }

    return {
      isProxy:
        info.privacy.vpn ||
        info.privacy.proxy ||
        info.privacy.tor ||
        info.privacy.relay,
      vpn: info.privacy.vpn,
      proxy: info.privacy.proxy,
      tor: info.privacy.tor,
      relay: info.privacy.relay,
      hosting: info.privacy.hosting,
    };
  }

  /**
   * Get abuse contact
   */
  async getAbuseContact(ip: string): Promise<{
    email: string;
    phone: string;
    name: string;
    network: string;
  } | null> {
    const info = await this.lookup(ip);

    if (!info.abuse) {
      return null;
    }

    return {
      email: info.abuse.email,
      phone: info.abuse.phone,
      name: info.abuse.name,
      network: info.abuse.network,
    };
  }

  /**
   * Rate limiting helper
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (elapsed < this.minRequestInterval) {
      const delay = this.minRequestInterval - elapsed;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }
}

/**
 * CLI usage
 */
if (import.meta.main) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("Usage: ipinfo-client.ts <ip> [ip2 ip3 ...]");
    console.log("       IPINFO_API_KEY=xxx ipinfo-client.ts 1.2.3.4");
    process.exit(1);
  }

  const client = new IPInfoClient();

  if (args.length === 1) {
    // Single lookup
    const info = await client.lookup(args[0]);
    console.log(JSON.stringify(info, null, 2));
  } else {
    // Batch lookup
    const results = await client.batchLookup(args);
    console.log(JSON.stringify(results, null, 2));
  }
}
