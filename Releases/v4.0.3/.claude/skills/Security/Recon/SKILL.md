---
name: recon
description: "Network reconnaissance — subdomain enumeration, port scanning, DNS/WHOIS/ASN lookups, endpoint discovery, mass scanning, path discovery, CIDR/netblock analysis. Passive and active modes with corporate structure mapping. USE WHEN recon, reconnaissance, bug bounty, attack surface, subdomains, port scan, DNS, WHOIS, ASN, CIDR, netblock, IP recon, domain recon, passive recon, endpoint discovery, scan results."
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/Recon/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# Recon

**Infrastructure and Network Reconnaissance** — combines passive intelligence gathering with authorized active scanning to map attack surfaces and identify assets.

## Workflow Selection

Auto-detect based on input format:
- IP address (x.x.x.x) → `IpRecon.md`
- Domain name → `DomainRecon.md`
- CIDR notation (x.x.x.x/y) → `NetblockRecon.md`
- ASN (AS####) → ASN investigation (inline via WHOIS/IPInfo/BGP)
- "passive only" specified → `PassiveRecon.md`

User can override: `"Use passive-recon workflow on 1.2.3.4"`

---

## Relationship with Other Security Skills

- **OSINT → Recon**: OSINT identifies entities/companies → Recon maps their technical infrastructure
- **Recon → WebAssessment**: Recon finds web apps → WebAssessment tests for vulnerabilities

---

## Passive Reconnaissance (No Authorization Required)

- WHOIS lookups (domain and IP)
- DNS enumeration (A, AAAA, MX, NS, TXT, CNAME, SOA)
- Certificate transparency searches (subdomains, cert history)
- IPInfo API (geolocation, ASN, organization, abuse contacts)
- Reverse DNS lookups
- BGP/ASN information gathering
- Historical DNS data

## Active Reconnaissance (Requires Explicit Authorization)

- Port scanning (naabu MCP)
- Service detection and banner grabbing (httpx MCP)
- Technology fingerprinting
- Live host discovery, HTTP/HTTPS probing, SSL/TLS analysis

**CRITICAL:** Active recon requires:
1. Explicit user confirmation per scan
2. Documented authorization (pentest, bug bounty, owned assets)
3. Scope validation — target must be in-scope
4. Rate limiting — no aggressive/DoS scanning

**Default is PASSIVE ONLY.** Always confirm before active techniques.

**Validation checkpoint:** Before any active scan, verify authorization type is documented (pentest SOW, bug bounty program, or owned infrastructure).

---

## Tool Integration

| Tool | Purpose |
|------|---------|
| `Tools/IpinfoClient.ts` | IPInfo API wrapper (geolocation, ASN, org, abuse) |
| `Tools/DnsUtils.ts` | DNS enumeration helpers |
| `Tools/WhoisParser.ts` | WHOIS data parsing |
| `Tools/CidrUtils.ts` | CIDR notation parsing, IP range calculation |
| `whois`, `dig`, `nslookup`, `curl` | System tools (always available) |
| `httpx` MCP | HTTP probing (requires security profile) |
| `naabu` MCP | Port scanning (requires security profile) |

```bash
# Switch to security MCP profile for active recon
~/.claude/MCPs/swap-mcp security
# Restart Claude Code to apply
```

---

## Output

Reports saved to:
- `~/.claude/MEMORY/WORK/{current_work}/` — iterative investigation artifacts
- `~/.claude/MEMORY/RESEARCH/YYYY-MM/` — formal pentest assessments

**Validation checkpoint:** Every report must include Summary, DNS, Network Information sections. Active reports must also document authorization and all scanned ports/services.

---

## Examples

**Passive domain recon:**
```
User: "Do passive recon on example.com"
--> WHOIS, DNS enumeration, cert transparency, IPInfo
--> Report: ~/.claude/MEMORY/WORK/{current_work}/recon-example-com/
```

**IP investigation with active scan:**
```
User: "Investigate IP 1.2.3.4 - I own this server"
--> Authorization: owned asset confirmed
--> IPInfo + reverse DNS + WHOIS + port scan + service detection
--> Result: open ports (22, 80, 443), services (SSH, nginx, HTTPS)
```

**OSINT integration:**
```
User: "Do OSINT on Acme Corp and map their infrastructure"
--> OSINT finds domains: acme.com, acmecorp.com, acme.io
--> Recon maps each domain: 15 domains, 47 subdomains, 3 netblocks
```

---

## Ethical Requirements

1. **Authorization first** — never active scan without permission
2. **Scope validation** — ensure targets are in-scope
3. **Rate limiting** — respectful scanning, no DoS
4. **Documentation** — log all activities with timestamps
5. **No exploitation** — reconnaissance only
6. **Never scan:** systems without permission, out-of-scope targets, critical infrastructure, government systems (without specific authorization)
