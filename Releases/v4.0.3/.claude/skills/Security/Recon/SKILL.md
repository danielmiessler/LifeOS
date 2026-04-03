---
name: Recon
description: Network reconnaissance — subdomain enumeration, port scanning, DNS/WHOIS/ASN lookups, endpoint discovery from JS, mass scanning, path discovery, CIDR/netblock analysis. Passive and active modes with corporate structure mapping and bounty program tracking. USE WHEN recon, reconnaissance, bug bounty, bounty programs, attack surface, subdomains, subdomain enumeration, port scan, mass scan, DNS, WHOIS, ASN, CIDR, netblock, IP recon, domain recon, passive recon, corporate structure, endpoint discovery, path discovery, scan results, analyze scan, update tools.
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/Recon/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# recon

**Infrastructure and Network Reconnaissance**


## 🚨 MANDATORY: Voice Notification (REQUIRED BEFORE ANY ACTION)

**You MUST send this notification BEFORE doing anything else when this skill is invoked.**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:8888/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the WORKFLOWNAME workflow in the Recon skill to ACTION"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running the **WorkflowName** workflow in the **Recon** skill to ACTION...
   ```

**This is not optional. Execute this curl command immediately upon skill invocation.**

## Purpose

Technical reconnaissance of network infrastructure including domains, IP addresses, netblocks, and ASNs. Combines passive intelligence gathering with authorized active scanning to map attack surfaces and identify assets.


## When to Use This Skill

**Core Triggers - Use this skill when user says:**

### Direct Recon Requests
- "do recon on [target]" or "run recon"
- "perform reconnaissance on [target]" or "conduct recon"
- "do infrastructure recon" or "network reconnaissance"
- "basic recon", "quick recon", "simple recon"
- "comprehensive recon", "deep recon", "full reconnaissance"
- "recon [target]" (just recon + target)
- "passive recon", "active recon"

### Infrastructure & Network Mapping
- "map infrastructure for [domain]" or "map network"
- "enumerate [domain] infrastructure" or "discover assets"
- "find subdomains of [domain]" or "enumerate subdomains"
- "scan [target]" or "port scan [IP/netblock]"
- "what services are running on [IP]"
- "investigate [IP address/domain/netblock]"

### IP & Domain Investigation
- "recon this IP" or "investigate this IP address"
- "look up [IP]" or "IP lookup [address]"
- "what is [IP]" or "who owns [IP]"
- "domain recon" or "domain investigation"
- "DNS recon", "DNS enumeration"
- "WHOIS [domain/IP]"

### ASN & Netblock Research
- "investigate [ASN]" or "research ASN"
- "scan [CIDR range/netblock]"
- "find IPs in [netblock]"
- "enumerate netblock" or "netblock scanning"

### Passive vs Active Recon
- "passive recon on [target]" (no authorization required)
- "active scan [target]" (requires explicit authorization)
- "safe reconnaissance" (passive only)
- "authorized scan" (active techniques)

### Use Case Indicators
- Investigating IP addresses for ownership, location, and services
- Mapping domain infrastructure and DNS configuration
- Scanning netblocks or CIDR ranges for live hosts
- Researching ASN ownership and IP allocations
- Attack surface enumeration and network mapping
- Called by OSINT for infrastructure mapping of entities

## Relationship with Other Security Skills

**OSINT → recon (Common Pattern):**
- OSINT identifies entities, companies, people (social/public records focus)
- Recon maps their technical infrastructure (network/system focus)
- Example flow: OSINT finds company → Recon maps their domains/IPs/infrastructure

**recon → webassessment:**
- Recon identifies web applications and services
- Web assessment tests those applications for vulnerabilities
- Example: Recon finds subdomain api.target.com → Web assessment fuzzes/tests it

**Workflow Integration:**
```typescript
// OSINT skill discovers company infrastructure
const domains = await osintFindCompanyDomains("Acme Corp");

// Calls recon skill to map technical details
const infraMap = await reconDomain(domains[0]);

// Recon identifies web apps
const webApps = infraMap.subdomains.filter(s => s.hasHTTP);

// Calls web assessment for testing
await webAssessment(webApps);
```

## Core Capabilities

### Passive Reconnaissance (No Authorization Required)
- WHOIS lookups (domain and IP)
- DNS enumeration (A, AAAA, MX, NS, TXT, CNAME, SOA, etc.)
- Certificate transparency searches (subdomains, certificate history)
- IPInfo API (geolocation, ASN, organization, abuse contacts)
- Reverse DNS lookups
- BGP/ASN information gathering
- Historical DNS data
- Public database searches

### Active Reconnaissance (Requires Explicit Authorization)
- Port scanning (naabu MCP)
- Service detection and banner grabbing (httpx MCP)
- Technology fingerprinting
- Live host discovery
- HTTP/HTTPS probing
- SSL/TLS analysis

**CRITICAL AUTHORIZATION REQUIREMENTS:**

Active reconnaissance MUST have:
1. **Explicit user confirmation** for each active scan
2. **Documented authorization** (pentest engagement, bug bounty program, owned assets)
3. **Scope validation** (ensure target is in-scope)
4. **Rate limiting** (respectful scanning, no DoS)
5. **Session logging** (record all active recon for audit trail)

**Default behavior is PASSIVE ONLY.** Always confirm before active techniques.

## Available Workflows

### 1. `PassiveRecon.md` - Safe Reconnaissance
Non-intrusive intelligence gathering using public sources:
- WHOIS data
- DNS records
- Certificate transparency
- IPInfo lookups
- Reverse DNS
- No active scanning

**Input:** Domain, IP, or netblock
**Output:** Passive intelligence report
**Authorization:** None required

### 2. `IpRecon.md` - IP Address Investigation
Comprehensive IP address reconnaissance:
- IPInfo lookup (location, ASN, org, abuse contact)
- Reverse DNS
- WHOIS netblock info
- Certificate search (if IP has certs)
- Optional: Port scan (with authorization)
- Optional: Service detection (with authorization)

**Input:** Single IP address
**Output:** IP reconnaissance report
**Authorization:** Required for active scanning

### 3. `DomainRecon.md` - Domain Investigation
Full domain mapping and enumeration:
- WHOIS domain registration
- DNS records (all types)
- Subdomain enumeration (certificate transparency)
- Mail server configuration (MX, SPF, DMARC, DKIM)
- IP addresses behind domain
- Certificate analysis
- Technology stack detection
- Historical data

**Input:** Domain name
**Output:** Domain reconnaissance report
**Authorization:** Required for active subdomain probing

### 4. `NetblockRecon.md` - CIDR Range Scanning
Network range reconnaissance:
- CIDR parsing and validation
- Range size calculation
- WHOIS netblock ownership
- Optional: Live host discovery (with authorization)
- Optional: Port scan range (with authorization)
- ASN/organization mapping
- Interesting host identification

**Input:** CIDR notation (e.g., 192.168.1.0/24)
**Output:** Netblock scan report
**Authorization:** Required for active scanning

### 5. ASN Investigation
ASN and BGP reconnaissance (performed inline using WHOIS, IPInfo, and public BGP data):
- ASN to CIDR range mapping
- Organization information
- All IP ranges owned by ASN
- BGP peer relationships
- Geographic distribution
- Hosting/ISP identification

**Input:** ASN number (e.g., AS15169)
**Output:** ASN mapping report
**Authorization:** None required (passive data)

## Tool Integration

### Primary Tools

**IPInfo API** (ipinfo.io)
- API Key: `process.env.IPINFO_API_KEY`
- Capabilities: Geolocation, ASN, organization, abuse contacts, privacy detection
- Rate limits: Check API plan
- Client: `Tools/IpinfoClient.ts`

**System Tools** (always available)
- `whois` - Domain and IP WHOIS lookups
- `dig` - DNS queries
- `nslookup` - DNS resolution
- `curl` - HTTP requests, API calls

**MCP Tools** (security profile required)
- `httpx` - HTTP probing and technology detection
- `naabu` - Port scanning
- Note: Requires security MCP profile (`~/.claude/MCPs/swap-mcp security`)

### Future Tool Integration

**Shodan** (when API key added)
- Search for exposed services
- Historical scan data
- Vulnerability information

**Censys** (when API key added)
- Certificate searches
- Host discovery
- Internet-wide scanning data

**SecurityTrails** (when API key added)
- Historical DNS records
- WHOIS history
- Subdomain discovery

**VirusTotal** (when API key added)
- Domain/IP reputation
- Passive DNS
- Malware associations

## TypeScript Utilities

Located in `Tools/` directory:

**IpinfoClient.ts**
- IPInfo API wrapper with error handling
- Batch lookup support
- Rate limiting
- Response parsing

**DnsUtils.ts**
- DNS enumeration helpers
- Record type queries
- Zone transfer attempts
- Subdomain brute forcing

**WhoisParser.ts**
- WHOIS data parsing
- Structured output from raw WHOIS
- Registration date extraction
- Contact information parsing

**CidrUtils.ts**
- CIDR notation parsing
- IP range calculation
- Range validation
- IP address generation from CIDR

## Output Formats

### IP Reconnaissance Report
```markdown
# IP Reconnaissance: 1.2.3.4

## Summary
- IP: 1.2.3.4
- Organization: Example Corp
- ASN: AS12345
- Location: San Francisco, CA, US
- ISP: Example Hosting

## DNS
- Reverse DNS: server.example.com
- Additional PTR: ...

## Network Information
- CIDR: 1.2.3.0/24
- Netblock Owner: Example Corp
- Abuse Contact: abuse@example.com

## Services (Passive)
- Certificates: 3 certificates found
- Historical DNS: ...

## Services (Active - Authorized)
- Open Ports: 22, 80, 443
- Services: SSH (OpenSSH 8.2), HTTP (nginx 1.20.1), HTTPS
- Technologies: nginx, OpenSSH

## Recommendations
- Further investigation areas
- Related assets
- Security observations
```

### Domain Reconnaissance Report
```markdown
# Domain Reconnaissance: example.com

## Summary
- Domain: example.com
- Registrar: Example Registrar
- Registration: 2010-01-15
- Expiry: 2026-01-15

## DNS Records
### A Records
- 1.2.3.4
- 5.6.7.8

### MX Records
- 10 mail.example.com

## Subdomains
- www.example.com (1.2.3.4)
- api.example.com (1.2.3.5)
- admin.example.com (1.2.3.6)

## Email Security
- SPF: Configured
- DMARC: Configured
- DKIM: Configured

## Technologies
- Web Server: nginx
- Framework: React
- CDN: Cloudflare

## Recommendations
- Interesting subdomains: admin.example.com, api.example.com
- Attack surface: 15 web applications identified
```

Reports saved to:
- **Work directory** (`~/.claude/MEMORY/WORK/{current_work}/`) - For iterative artifacts during investigation
- **MEMORY/RESEARCH/** (`~/.claude/MEMORY/RESEARCH/YYYY-MM/`) - For pentest engagements and formal assessments

## MCP Profile Requirements

**For passive recon:** No special MCP profile needed

**For active recon:** Requires security MCP profile
```bash
# Switch to security profile
~/.claude/MCPs/swap-mcp security

# Restart Claude Code to apply
# Then run active reconnaissance
```

Security profile includes:
- httpx (HTTP probing)
- naabu (port scanning)
- Other security tools

## Ethical and Legal Considerations

**CRITICAL RULES:**
1. **Authorization First** - Never perform active scanning without explicit authorization
2. **Scope Validation** - Ensure targets are in-scope for testing
3. **Rate Limiting** - Respectful scanning, no DoS or aggressive techniques
4. **Documentation** - Log all recon activities with timestamps and authorization
5. **Responsible Disclosure** - If vulnerabilities found, follow responsible disclosure
6. **No Destructive Testing** - Reconnaissance only, no exploitation

**Authorization Types:**
- Pentest engagement (written SOW/contract)
- Bug bounty program (in-scope targets only)
- Owned assets (your own infrastructure)
- Research lab/CTF environments

**Never scan:**
- Systems without permission
- Out-of-scope targets
- Critical infrastructure
- Government systems (without specific authorization)

**When in doubt:** Ask for explicit confirmation and documented authorization.

## Usage Examples

### Example 1: Passive Domain Recon
```
User: "Do passive recon on example.com"

Assistant: Activating recon skill with passive-recon workflow.
     Target: example.com
     Mode: Passive only (no active scanning)

     [Performs WHOIS, DNS, cert transparency, IPInfo]
     [Generates report in scratchpad]

     Report: ~/.claude/MEMORY/WORK/{current_work}/recon-example-com/
```

### Example 2: IP Investigation with Active Scan
```
User: "Investigate IP 1.2.3.4 - I own this server"

Assistant: Activating recon skill with ip-recon workflow.
     Target: 1.2.3.4

     Authorization check: You confirmed this is an owned asset.
     Proceeding with passive + active reconnaissance.

     [Performs IPInfo, reverse DNS, WHOIS, port scan, service detection]
     [Generates comprehensive report]

     Report: Open ports found (22, 80, 443)
             Services: SSH, HTTP, HTTPS
             Technologies: nginx 1.20.1, OpenSSH 8.2
```

### Example 3: Integration with OSINT
```
User: "Do OSINT on Acme Corp and map their infrastructure"

Assistant: Activating OSINT skill...
     Found domains: acme.com, acmecorp.com, acme.io

     Now calling recon for infrastructure mapping...

     [Recon skill maps each domain]
     [Discovers subdomains, IPs, netblocks]
     [Creates comprehensive infrastructure map]

     Report: Complete OSINT + Infrastructure report
             15 domains, 47 subdomains, 3 netblocks identified
```

## Workflow Selection Logic

**Automatic workflow selection based on input:**
- Input matches IP pattern (x.x.x.x) → `IpRecon.md`
- Input matches domain pattern → `DomainRecon.md`
- Input matches CIDR pattern (x.x.x.x/y) → `NetblockRecon.md`
- Input matches ASN pattern (AS####) → ASN investigation (inline using WHOIS/IPInfo/BGP data)
- User specifies "passive only" → `PassiveRecon.md`

**User can override:**
```
"Use passive-recon workflow on 1.2.3.4"
"Run domain-recon on example.com with active scanning"
```

## Success Criteria

**Passive Recon Success:**
- WHOIS data retrieved
- DNS records enumerated
- Certificate transparency searched
- IPInfo data gathered
- Structured report generated

**Active Recon Success:**
- Authorization confirmed and documented
- Passive recon completed first
- Port scan results (open/closed/filtered)
- Service detection performed
- Banner information gathered
- Technologies identified
- No errors or failures
- Respectful scan timing (no DoS)

## Related Documentation

**Security Skills:**
- `~/.claude/skills/Investigation/` - Entity and people reconnaissance (OSINT)
- `~/.claude/skills/Security/WebAssessment/` - Web application testing

**Tool Documentation:**
- IPInfo API: https://ipinfo.io/developers
- Certificate Transparency: https://crt.sh
- WHOIS protocol: RFC 3912

**Best Practices:**
- OWASP Testing Guide: https://owasp.org/www-project-web-security-testing-guide/
- NIST SP 800-115: Technical Guide to Information Security Testing

---

**Remember:** Start passive, confirm authorization before going active, document everything, and be respectful of target systems.
