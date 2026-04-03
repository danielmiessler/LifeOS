# Passive Reconnaissance Workflow

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the PassiveRecon workflow in the Recon skill to gather passive intelligence"}' \
  > /dev/null 2>&1 &
```

Running the **PassiveRecon** workflow in the **Recon** skill to gather passive intelligence...

**Safe, non-intrusive intelligence gathering using only public sources**

## Purpose

Perform reconnaissance on targets (domains, IPs, netblocks) using exclusively passive techniques that:
- Do NOT send packets directly to the target
- Do NOT trigger IDS/IPS systems
- Do NOT require authorization
- Use only public databases and third-party services

## When to Use

- Initial reconnaissance before active testing
- Gathering intelligence without target interaction
- Legal constraints prevent active scanning
- Stealth is required
- Quick information gathering
- Called by OSINT for infrastructure mapping

## Input Types

**Accepts:**
- Domain names (example.com, subdomain.example.com)
- IP addresses (1.2.3.4)
- CIDR ranges (192.168.1.0/24)
- ASN numbers (AS15169)
- Multiple targets (batch processing)

## Passive Techniques

### 1. WHOIS Lookups

**Domain WHOIS:**
```bash
whois example.com
```

**Extracts:**
- Registrar information
- Registration date
- Expiration date
- Name servers
- Registrant contact (if not privacy-protected)
- Domain status

**IP/Netblock WHOIS:**
```bash
whois 1.2.3.4
```

**Extracts:**
- Netblock owner organization
- CIDR range
- Allocation date
- Abuse contact email
- Geographic region
- RIR (Regional Internet Registry)

### 2. DNS Enumeration

**Record Types to Query:**
```bash
# A records (IPv4)
dig example.com A

# AAAA records (IPv6)
dig example.com AAAA

# MX records (mail servers)
dig example.com MX

# NS records (name servers)
dig example.com NS

# TXT records (SPF, DMARC, verification)
dig example.com TXT

# CNAME records (aliases)
dig www.example.com CNAME

# SOA records (zone authority)
dig example.com SOA

# Any records (attempt to get all)
dig example.com ANY
```

**Email Security Analysis:**
```bash
# SPF record
dig example.com TXT | grep "v=spf1"

# DMARC policy
dig _dmarc.example.com TXT

# DKIM selectors (common selectors)
dig default._domainkey.example.com TXT
dig google._domainkey.example.com TXT
dig k1._domainkey.example.com TXT
```

**Reverse DNS:**
```bash
dig -x 1.2.3.4
```

### 3. Certificate Transparency

**crt.sh Search:**
```bash
# Search for certificates
curl -s "https://crt.sh/?q=%.example.com&output=json" | jq

# Extract unique subdomains
curl -s "https://crt.sh/?q=%.example.com&output=json" | \
  jq -r '.[].name_value' | \
  sed 's/\*\.//g' | \
  sort -u
```

**Extracts:**
- All subdomains ever certified
- Certificate issuers
- Certificate validity periods
- Historical subdomain data
- Wildcard certificate presence

### 4. IPInfo API Lookup

**IP Information:**
```typescript
// Using IPInfo API
const response = await fetch(`https://ipinfo.io/1.2.3.4/json?token=${IPINFO_API_KEY}`);
const data = await response.json();
```

**Extracts:**
- IP address
- Hostname (reverse DNS)
- City, Region, Country
- Geographic coordinates (lat/long)
- Postal code
- Timezone
- ASN number
- Organization name
- ISP/hosting provider
- Abuse contact email
- Privacy detection (VPN, proxy, Tor, hosting)

**Batch Lookup:**
```bash
# For multiple IPs (IPInfo supports batch)
curl -X POST https://ipinfo.io/batch?token=$IPINFO_API_KEY \
  -H "Content-Type: application/json" \
  -d '["1.2.3.4", "5.6.7.8", "9.10.11.12"]'
```

### 5. ASN Information

**BGP Information:**
```bash
# WHOIS for ASN
whois -h whois.radb.net AS15169

# Or use online tools via API
curl "https://api.bgpview.io/asn/15169"
```

**Extracts:**
- ASN number
- Organization name
- All CIDR prefixes owned
- Peer relationships
- Upstream/downstream ASNs
- Country of registration

### 6. Historical Data

**Archive.org Wayback Machine:**
```bash
# Check if domain archived
curl "https://archive.org/wayback/available?url=example.com"
```

**DNS History (manual check):**
- SecurityTrails (requires API key - future)
- VirusTotal (requires API key - future)

## Workflow Steps

### For Domain Targets

**Step 1: WHOIS Domain Info**
```bash
whois example.com > /tmp/whois_domain.txt
```
- Extract registration info
- Note name servers
- Check expiration date

**Step 2: DNS Enumeration**
```bash
# Core records
dig example.com A AAAA MX NS TXT SOA

# Email security
dig example.com TXT | grep spf
dig _dmarc.example.com TXT

# Reverse lookups on discovered IPs
for ip in $(dig +short example.com A); do
  dig -x $ip
done
```

**Step 3: Certificate Transparency**
```bash
curl -s "https://crt.sh/?q=%.example.com&output=json" | \
  jq -r '.[].name_value' | \
  sed 's/\*\.//g' | \
  sort -u > /tmp/subdomains.txt
```

**Step 4: IP Information for Each IP**
```typescript
const ips = await getDomainIPs("example.com");
for (const ip of ips) {
  const info = await ipinfoLookup(ip);
  // Store ASN, org, location
}
```

**Step 5: Compile Report**
- Domain registration details
- All DNS records
- All discovered subdomains
- All IP addresses with their metadata
- ASN and organization mapping
- Email security posture
- Historical observations

### For IP Address Targets

**Step 1: IPInfo Lookup**
```bash
curl "https://ipinfo.io/1.2.3.4/json?token=$IPINFO_API_KEY"
```

**Step 2: Reverse DNS**
```bash
dig -x 1.2.3.4
```

**Step 3: WHOIS Netblock**
```bash
whois 1.2.3.4
```
- Note CIDR range
- Note organization
- Note abuse contact

**Step 4: Certificate Search**
```bash
# Search for certificates for this IP
curl -s "https://crt.sh/?q=1.2.3.4&output=json"
```

**Step 5: Compile Report**
- IP metadata (location, org, ASN)
- Reverse DNS
- Netblock information
- Certificates (if any)
- Related IPs in same netblock

### For CIDR/Netblock Targets

**Step 1: Parse CIDR**
```typescript
const { network, cidr, firstIP, lastIP, totalIPs } = parseCIDR("192.168.1.0/24");
```

**Step 2: WHOIS Netblock**
```bash
whois -h whois.arin.net "n 192.168.1.0/24"
```

**Step 3: Sample IP Lookup**
```typescript
// For large ranges, sample a few IPs
const sampleIPs = [firstIP, middleIP, lastIP];
for (const ip of sampleIPs) {
  await ipinfoLookup(ip);
}
```

**Step 4: Reverse DNS on Sample**
```bash
# Sample reverse DNS
dig -x 192.168.1.1
dig -x 192.168.1.128
dig -x 192.168.1.254
```

**Step 5: Compile Report**
- CIDR range details
- Owner organization
- Sample IP information
- ASN mapping
- Recommendations for active scanning (if authorized)

### For ASN Targets

**Step 1: ASN WHOIS**
```bash
whois -h whois.radb.net AS15169
```

**Step 2: BGP Prefixes**
```bash
curl "https://api.bgpview.io/asn/15169/prefixes"
```

**Step 3: Organization Info**
```bash
curl "https://api.bgpview.io/asn/15169"
```

**Step 4: Sample IP from Each Prefix**
```typescript
for (const prefix of prefixes) {
  const sampleIP = getFirstIP(prefix);
  await ipinfoLookup(sampleIP);
}
```

**Step 5: Compile Report**
- ASN details
- All CIDR prefixes
- Organization information
- Geographic distribution
- Peer relationships

## Output Report Template

```markdown
# Passive Reconnaissance Report

**Target:** example.com
**Date:** 2025-11-11
**Type:** Passive Only
**Authorization:** Not Required

## Summary
- Target Type: Domain
- IPs Discovered: 3
- Subdomains Found: 47
- ASN: AS12345
- Organization: Example Corp

## Domain Registration (WHOIS)
- **Registrar:** Example Registrar
- **Registration Date:** 2010-01-15
- **Expiration Date:** 2026-01-15
- **Status:** clientTransferProhibited
- **Name Servers:** ns1.example.com, ns2.example.com

## DNS Records

### A Records
- 1.2.3.4
- 5.6.7.8

### AAAA Records
- 2001:db8::1

### MX Records
- 10 mail.example.com (1.2.3.10)
- 20 mail2.example.com (5.6.7.20)

### NS Records
- ns1.example.com (1.2.3.5)
- ns2.example.com (5.6.7.9)

### TXT Records
- v=spf1 include:_spf.example.com ~all
- google-site-verification=abcd1234

## Email Security

### SPF (Sender Policy Framework)
- **Record:** v=spf1 include:_spf.example.com ~all
- **Assessment:** ✅ Configured (softfail)

### DMARC
- **Record:** v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com
- **Policy:** Quarantine
- **Assessment:** ✅ Configured

### DKIM
- **Selectors Found:** default, google, k1
- **Assessment:** ✅ Configured

## Subdomains (Certificate Transparency)

**47 unique subdomains discovered:**
- www.example.com
- api.example.com
- admin.example.com
- staging.example.com
- dev.example.com
- mail.example.com
- [... 41 more ...]

**Interesting Subdomains:**
- admin.example.com (administrative interface)
- api.example.com (API endpoint)
- staging.example.com (non-production environment)
- dev.example.com (development environment)
- vpn.example.com (VPN access)
- internal.example.com (internal systems)

## IP Address Analysis

### 1.2.3.4
- **Reverse DNS:** www.example.com
- **Organization:** Example Hosting
- **ASN:** AS12345
- **Location:** San Francisco, CA, US
- **ISP:** Example Cloud Services
- **Abuse Contact:** abuse@examplehosting.com
- **Type:** Hosting

### 5.6.7.8
- **Reverse DNS:** mail.example.com
- **Organization:** Example Corp
- **ASN:** AS54321
- **Location:** New York, NY, US
- **Type:** Business

## Network Information

### Primary Netblock: 1.2.3.0/24
- **Owner:** Example Hosting
- **ASN:** AS12345
- **Allocation Date:** 2015-03-20
- **CIDR:** 1.2.3.0/24
- **Abuse:** abuse@examplehosting.com

### Secondary Netblock: 5.6.7.0/24
- **Owner:** Example Corp
- **ASN:** AS54321
- **Allocation Date:** 2008-11-15
- **CIDR:** 5.6.7.0/24

## ASN Details

### AS12345 - Example Hosting
- **Organization:** Example Hosting Inc.
- **Country:** US
- **Prefixes:** 15 IPv4, 3 IPv6
- **Type:** Hosting/Data Center

### AS54321 - Example Corp
- **Organization:** Example Corporation
- **Country:** US
- **Prefixes:** 3 IPv4, 1 IPv6
- **Type:** Business/Enterprise

## Certificates

**Total Certificates Found:** 12

**Current Certificate:**
- **Issuer:** Let's Encrypt
- **Valid From:** 2025-10-15
- **Valid To:** 2026-01-15
- **SANs:** example.com, www.example.com, [+45 more]

**Historical Certificates:**
- Previous issuer: DigiCert (2020-2025)
- Wildcard certificate used (*.example.com)

## Findings Summary

### Infrastructure
- **Cloud Provider:** Example Hosting (primary)
- **In-house Infrastructure:** Example Corp netblock (secondary)
- **Email:** Separate hosting (5.6.7.0/24)
- **CDN:** Not detected in DNS (may be in front)

### Attack Surface
- **47 subdomains** identified (potential entry points)
- **3 IP addresses** exposed
- **Administrative interfaces** found (admin.example.com)
- **Non-production environments** exposed (staging, dev)

### Security Posture
- ✅ Email security configured (SPF, DMARC, DKIM)
- ✅ Modern TLS certificates (Let's Encrypt)
- ⚠️ Administrative subdomains publicly discoverable
- ⚠️ Development/staging environments exposed

## Recommendations

### Immediate Attention
1. **Review admin.example.com exposure** - Administrative interface in cert transparency
2. **Assess dev/staging exposure** - Non-production environments publicly listed
3. **Audit subdomain necessity** - 47 subdomains may indicate sprawl

### Further Investigation (with authorization)
1. Active scan admin/api/internal subdomains for vulnerabilities
2. Port scan discovered IPs to identify services
3. Web application assessment on all HTTP/HTTPS services
4. Review access controls on non-production environments

### Passive Intel Continuation
1. Monitor certificate transparency for new subdomains
2. Track WHOIS changes for domain expiration
3. Watch for DNS record changes
4. Monitor for new IP allocations in identified netblocks

---

**Report Generated:** 2025-11-11 04:15:00 PST
**Methodology:** Passive reconnaissance only (no target interaction)
**Tools Used:** WHOIS, dig, crt.sh, IPInfo API
**Authorization:** Not required for passive techniques
```

## Integration Points

### Called by OSINT

```typescript
// OSINT discovers company
const company = await osintInvestigate("Acme Corp");

// Calls passive recon on discovered domains
for (const domain of company.domains) {
  const reconReport = await passiveRecon(domain);
  company.infrastructure.push(reconReport);
}
```

### Calls webassessment

```typescript
// After passive recon discovers subdomains
const interestingSubdomains = report.subdomains.filter(s =>
  s.includes('admin') ||
  s.includes('api') ||
  s.includes('internal')
);

// Can pass to web assessment (with authorization)
if (authorized) {
  await webAssessment(interestingSubdomains);
}
```

## Best Practices

**Data Collection:**
1. Start broad (WHOIS, DNS)
2. Discover assets (cert transparency, IPInfo)
3. Map relationships (ASN, netblocks, reverse DNS)
4. Compile comprehensive view

**Stealth Considerations:**
- Even passive recon can be logged (WHOIS queries, DNS lookups)
- Use VPN if stealth required
- Space out queries to avoid pattern detection
- Some passive sources rate-limit (respect limits)

**Documentation:**
- Save all raw output (WHOIS, dig, curl responses)
- Timestamp all findings
- Note data sources
- Preserve for future comparison

**Legal:**
- Passive recon is generally legal (public data)
- Still respect ToS of data sources
- Don't abuse APIs or scrape aggressively
- Be aware some jurisdictions may have restrictions

## Troubleshooting

**WHOIS not returning data:**
- Try different WHOIS servers
- Some registrars privacy-protect aggressively
- Use RDAP (successor to WHOIS) for some TLDs

**DNS queries timing out:**
- Check DNS resolver configuration
- Try different DNS servers (8.8.8.8, 1.1.1.1)
- Target may have aggressive rate limiting

**Certificate transparency no results:**
- Domain may be very new
- May not have TLS certificate
- Try alternate CT log search tools

**IPInfo rate limits:**
- Check API plan limits
- Implement request throttling
- Use batch API for multiple IPs

## Success Criteria

**Minimum viable recon:**
- ✅ WHOIS data retrieved
- ✅ Core DNS records enumerated (A, MX, NS)
- ✅ At least one IP address identified
- ✅ ASN determined
- ✅ Report generated

**Comprehensive recon:**
- ✅ All DNS record types queried
- ✅ Certificate transparency searched
- ✅ All subdomains enumerated
- ✅ All IPs analyzed with IPInfo
- ✅ Email security assessed
- ✅ Netblock ownership mapped
- ✅ ASN relationships documented
- ✅ Recommendations generated
- ✅ Report saved to scratchpad or history

---

**Remember:** Passive recon is about gathering intelligence without touching the target. If you need to send packets to the target, that's active recon and requires authorization.
