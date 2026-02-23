# recon - Infrastructure & Network Reconnaissance

Comprehensive reconnaissance skill for domains, IP addresses, netblocks, and ASNs. Integrates with OSINT for complete target intelligence.

## Quick Start

### Passive Domain Recon (No Authorization Required)
```
User: "Do passive recon on example.com"

{DAIDENTITY.NAME}: Activating recon with passive-recon workflow
     - WHOIS lookup
     - DNS enumeration
     - Certificate transparency
     - Subdomain discovery (47 found)
     - IP mapping (3 unique IPs)

Report: ~/.claude/MEMORY/WORK/{current_work}/scratch/recon-example-com/
```

### IP Address Investigation
```
User: "Investigate IP 1.2.3.4"

{DAIDENTITY.NAME}: Activating recon with ip-recon workflow
     - IPInfo lookup (Cloudflare, San Francisco, AS13335)
     - Reverse DNS (www.example.com)
     - WHOIS netblock (1.2.3.0/24, Cloudflare Inc)
     - Certificate search (3 certificates found)

Report: Complete IP intelligence report generated
```

### Integration with OSINT
```
User: "Do OSINT on Acme Corp and map their infrastructure"

{DAIDENTITY.NAME}: Activating OSINT...
     Found: acme.com, acmecorp.com, acme.io

     Calling recon for technical infrastructure...
     - Domain recon on acme.com (35 subdomains)
     - Domain recon on acmecorp.com (12 subdomains)
     - Domain recon on acme.io (8 subdomains)
     - IP mapping (8 unique IPs across 3 ASNs)

Report: Complete OSINT + Infrastructure map
```

## Workflows

### 1. passive-recon.md
Safe, non-intrusive reconnaissance using public sources.

**Techniques:**
- WHOIS lookups
- DNS enumeration
- Certificate transparency
- IPInfo API
- Reverse DNS

**Input:** Domain, IP, or netblock
**Authorization:** Not required

### 2. ip-recon.md
Detailed IP address investigation.

**Techniques:**
- IPInfo comprehensive lookup
- Reverse DNS validation
- WHOIS netblock information
- Certificate search
- Port scanning (with auth)
- Service detection (with auth)

**Input:** Single IP (IPv4 or IPv6)
**Authorization:** Required for active scanning

### 3. domain-recon.md
Comprehensive domain mapping.

**Techniques:**
- WHOIS domain registration
- Full DNS enumeration
- Subdomain discovery (cert transparency)
- Email security (SPF/DMARC/DKIM)
- IP address mapping
- Certificate analysis
- Technology detection (with auth)

**Input:** Domain name
**Authorization:** Required for active probing

### 4. netblock-recon.md
Network range reconnaissance.

**Techniques:**
- CIDR parsing and validation
- WHOIS netblock ownership
- ASN mapping
- Sample IP investigation
- Live host discovery (with auth)
- Port scanning (with auth)

**Input:** CIDR notation (e.g., 192.168.1.0/24)
**Authorization:** REQUIRED for active scanning

## Data References

### LOTLBinaries.md
Living Off The Land binary reference for threat hunting and detection.

**Contents:**
- `finger.exe` - C2 communication via legacy protocol
- `certutil.exe` - Download and decode payloads
- `mshta.exe` - Execute inline scripts
- `rundll32.exe` - Proxy DLL execution
- `regsvr32.exe` - Scriptlet execution (Squiblydoo)
- `bitsadmin.exe` - Background file downloads
- Browser extension evasion patterns (Chrome Alarms delay)

**Usage:** Reference during threat hunting, incident response, or extension analysis.

---

## Tools

### ipinfo-client.ts
IPInfo API wrapper with caching and rate limiting.

```typescript
const client = new IPInfoClient();
const info = await client.lookup("1.2.3.4");
console.log(info.organization, info.location);
```

**Features:**
- Single and batch lookups
- Location extraction
- ASN information
- Proxy/VPN detection
- Abuse contact retrieval

### cidr-utils.ts
CIDR parsing and IP range manipulation.

```typescript
const cidr = parseCIDR("192.168.1.0/24");
console.log(cidr.totalIPs); // 256

const samples = generateIPsFromCIDR("10.0.0.0/16", 10);
```

**Features:**
- CIDR validation and parsing
- IP to integer conversion
- Range calculations
- Sample IP generation
- Common netblock detection

### dns-utils.ts
DNS enumeration and analysis.

```typescript
const records = await getAllRecords("example.com");
const emailSec = await analyzeEmailSecurity("example.com");
const subs = await enumerateSubdomainsViaCert("example.com");
```

**Features:**
- All DNS record types
- Email security analysis
- Subdomain enumeration
- Zone transfer attempts
- Forward-reverse validation

### whois-parser.ts
WHOIS execution and parsing.

```typescript
const domainInfo = await whoisDomain("example.com");
const days = daysUntilExpiration(domainInfo);

const ipInfo = await whoisIP("1.2.3.4");
console.log(ipInfo.organization, ipInfo.cidr);
```

**Features:**
- Domain WHOIS parsing
- IP/netblock WHOIS
- Date extraction
- Contact information
- Privacy detection

## Authorization Framework

### Passive Techniques (No Auth Required)
- ✅ WHOIS lookups
- ✅ DNS queries
- ✅ Certificate transparency
- ✅ IPInfo API
- ✅ Public database searches

### Active Techniques (Auth Required)
- ⚠️ Port scanning
- ⚠️ Service detection
- ⚠️ Banner grabbing
- ⚠️ Subdomain brute forcing
- ⚠️ Network scanning

### Authorization Types
1. **Pentest Engagement** - Written SOW/contract
2. **Bug Bounty Program** - In-scope targets only
3. **Owned Assets** - Your own infrastructure
4. **Research/CTF** - Lab environments

**CRITICAL:** Never perform active scanning without explicit authorization.

## Integration Points

### Called by OSINT
```typescript
// OSINT discovers company
const company = await osintInvestigate("Acme Corp");

// Calls recon on discovered infrastructure
for (const domain of company.domains) {
  const infraMap = await domainRecon(domain);
  company.infrastructure.push(infraMap);
}
```

### Calls webassessment
```typescript
// After recon discovers web applications
const webApps = domainReport.liveWebApps;

if (authorized) {
  for (const app of webApps) {
    await webAssessment(app.url);
  }
}
```

### Calls ip-recon for discovered IPs
```typescript
// Domain recon finds IPs
const ips = await getDomainIPs("example.com");

// Investigate each IP
for (const ip of ips) {
  const ipInfo = await ipRecon(ip, { passive: true });
  domainReport.infrastructure.push(ipInfo);
}
```

## MCP Profile Requirements

### For Passive Recon
- No special MCP profile required
- Uses system tools (whois, dig)
- IPInfo API (environment variable)

### For Active Recon
Requires **security MCP profile**:
```bash
~/.claude/MCPs/swap-mcp security
# Restart Claude Code
```

**Security profile includes:**
- httpx (HTTP probing)
- naabu (port scanning)
- Other security tools

## Output Formats

### Report Locations
- **Iterative Work:** `~/.claude/MEMORY/WORK/{current_work}/scratch/` (tied to work item for learning)
- **Formal Assessments:** `~/.claude/MEMORY/RESEARCH/YYYY-MM/`

### Report Structure
- Executive summary
- Technical details
- Infrastructure mapping
- Security observations
- Recommendations
- Raw data

## Example Commands

```bash
# Test IPInfo client
IPINFO_API_KEY=xxx ./Tools/ipinfo-client.ts 1.2.3.4

# Parse CIDR
./Tools/cidr-utils.ts 192.168.1.0/24

# DNS enumeration
./Tools/dns-utils.ts example.com

# WHOIS lookup
./Tools/whois-parser.ts example.com
```

## Best Practices

1. **Start Passive:** Always begin with passive recon
2. **Get Authorization:** Never perform active scanning without permission
3. **Rate Limit:** Be respectful of target systems
4. **Document Everything:** Log all activities with timestamps
5. **Verify Scope:** Ensure targets are in-scope
6. **Coordinate:** Communicate with target for active scans

## Legal & Ethical

**NEVER scan:**
- Systems without permission
- Out-of-scope targets
- Critical infrastructure
- Government systems (without specific authorization)

**ALWAYS:**
- Get written authorization
- Respect rate limits
- Document activities
- Follow responsible disclosure

## Related Skills

- **OSINT** - People and entity reconnaissance
- **webassessment** - Web application testing
- **research** - General research and intelligence gathering

## CLI Examples

```bash
# Passive domain recon
echo "Do passive recon on example.com" | claude

# IP investigation
echo "Investigate IP 1.2.3.4 - I own this server" | claude

# Netblock scan (with authorization)
echo "Scan netblock 192.168.1.0/24 - pentest engagement SOW-123" | claude

# Integration with OSINT
echo "OSINT Acme Corp and map infrastructure" | claude
```

---

**Created:** 2025-11-11
**Author:** {DAIDENTITY.NAME} (with deep thinking deep reasoning)
**Status:** Production Ready
