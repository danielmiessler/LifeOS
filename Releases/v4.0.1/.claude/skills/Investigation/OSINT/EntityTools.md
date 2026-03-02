# Entity OSINT Tools Reference

## Domain & DNS Tools

### WHOIS Services

**DomainTools** (domaintools.com)
- **Purpose:** Advanced domain intelligence
- **Data Available:** WHOIS history, DNS, IP history, risk scoring
- **Cost:** $99/month+
- **Features:** Reverse WHOIS, monitoring, API

**ViewDNS** (viewdns.info)
- **Purpose:** DNS toolkit
- **Data Available:** DNS records, IP history, reverse lookup
- **Cost:** Free (limited), API ($10-50/month)

### DNS Reconnaissance

**DNSDumpster** (dnsdumpster.com)
- **Purpose:** DNS recon
- **Cost:** Free, no auth required
- **Features:** Visual network map, HTTP/HTTPS detection

**SecurityTrails** (securitytrails.com)
- **Purpose:** DNS intelligence
- **Cost:** Free (50/month), Explorer ($49/month)
- **Coverage:** 4.5B DNS records

**Amass** (github.com/OWASP/Amass)
- **Purpose:** Advanced subdomain enumeration
- **Cost:** Free, open-source (OWASP)
- **Features:** Active/passive recon, 55+ sources

### Certificate Intelligence

**crt.sh** (crt.sh)
- **Purpose:** Certificate transparency search
- **Cost:** Free
- **Search:** `%.example.com`

**Censys** (censys.io)
- **Purpose:** Certificate inventory
- **Cost:** Free (250/month), Teams ($99/month)

## IP & Network Tools

### Geolocation & Attribution

**IPinfo** (ipinfo.io)
- **Purpose:** IP data and insights
- **Cost:** Free (50k/month), Basic ($49/month)
- **CLI:** `npm install -g node-ipinfo`

**MaxMind GeoIP2** (maxmind.com)
- **Purpose:** Geolocation database
- **Cost:** Free (GeoLite2), Paid ($30-700/month)

### ASN & BGP

**Hurricane Electric BGP** (bgp.he.net)
- **Purpose:** BGP routing intelligence
- **Cost:** Free
- **Features:** ASN lookup, prefix info, peering

**RIPE Stat** (stat.ripe.net)
- **Purpose:** Internet measurement
- **Cost:** Free
- **API:** RESTful with widgets

### Internet Scanning

**Shodan** (shodan.io)
- **Purpose:** Device search engine
- **Cost:** Free (limited), Membership ($59/month)
- **Search:** ip:, net:, org:, ssl:, port:, vuln:
- **CLI:** Available

**Censys** (censys.io)
- **Purpose:** Internet-wide scanning
- **Cost:** Free (250/month), Teams ($99/month)

**BinaryEdge** (binaryedge.io)
- **Purpose:** Cybersecurity data
- **Cost:** Free (250/month), Pro ($10/month)

### IP Reputation

**AbuseIPDB** (abuseipdb.com)
- **Purpose:** IP abuse database
- **Cost:** Free (1,000 checks/day), API (tiered)
- **Score:** 0-100% confidence

**GreyNoise** (greynoise.io)
- **Purpose:** Scanner classification
- **Cost:** Community (free), Enterprise ($500+/month)

## Threat Intelligence

### Malware Analysis

**VirusTotal** (virustotal.com)
- **Purpose:** Multi-scanner analysis
- **Cost:** Free (limited), Premium ($180/month)
- **Capabilities:** Files (650MB), URLs, IPs, hashes
- **API:** 4 requests/min (free)

**Hybrid Analysis** (hybrid-analysis.com)
- **Purpose:** Automated malware sandbox
- **Cost:** Free (public), Enterprise (private)
- **Sandbox:** CrowdStrike Falcon

**Malware Bazaar** (bazaar.abuse.ch)
- **Purpose:** Malware sample sharing
- **Cost:** Free
- **Database:** 3M+ samples

### Threat Platforms

**AlienVault OTX** (otx.alienvault.com)
- **Purpose:** Threat intelligence community
- **Cost:** Free
- **Features:** Pulses, IoCs, adversary profiles

**MITRE ATT&CK** (attack.mitre.org)
- **Purpose:** Adversary TTPs knowledge base
- **Cost:** Free
- **Coverage:** 14 tactics, 193 techniques, 127 groups

**ThreatFox** (threatfox.abuse.ch)
- **Purpose:** IoC sharing
- **Cost:** Free
- **Export:** JSON, CSV, MISP

### URL Analysis

**URLScan.io** (urlscan.io)
- **Purpose:** Website scanner
- **Cost:** Free (public), Pro ($150/year private)
- **Features:** Screenshot, DOM, technologies

**URLhaus** (urlhaus.abuse.ch)
- **Purpose:** Malware URL database
- **Cost:** Free

## Historical & Archive

**Wayback Machine** (archive.org)
- **Purpose:** Historical snapshots
- **Coverage:** 735B+ pages
- **API:** Wayback API, CDX API

## Automation Frameworks

**Maltego** (maltego.com)
- **Purpose:** Visual link analysis
- **Cost:** Community (free), Classic ($999/year)
- **Use Case:** Relationship mapping

**SpiderFoot** (spiderfoot.net)
- **Purpose:** Automated OSINT
- **Cost:** Free (open-source), HX (commercial)
- **Modules:** 200+

**Recon-ng** (github.com/lanmaster53/recon-ng)
- **Purpose:** Recon framework
- **Cost:** Free, open-source
- **Modules:** 90+

---

## Tool Selection Guide

### For Domain Intelligence:
- Quick: whois.com, DNSDumpster
- Comprehensive: DomainTools, SecurityTrails
- Subdomains: crt.sh, Amass

### For IP Intelligence:
- Geolocation: IPinfo, MaxMind
- ASN/BGP: Hurricane Electric, RIPE Stat
- Reputation: AbuseIPDB, AlienVault OTX
- Scanning: Shodan, Censys

### For Threat Intelligence:
- Files: VirusTotal, Hybrid Analysis, Malware Bazaar
- URLs: URLScan.io, URLhaus
- IoCs: ThreatFox, AlienVault OTX

### For Automation:
- Visual: Maltego
- Full: SpiderFoot
- Modular: Recon-ng

---

**Remember:** Use multiple tools, cross-verify findings. Respect rate limits and ToS. Only use on authorized targets.

---

## Attack Targeting Patterns

### Corporate vs Consumer Discrimination

**Context:** Attackers fingerprint targets to determine value and serve appropriate payloads.

**Indicators That Identify Corporate Targets:**
| Indicator | Method | Weight |
|-----------|--------|--------|
| Domain-joined machine | AD enumeration | HIGH |
| Corporate email domain | Browser session | HIGH |
| VPN/proxy detected | Network config | MEDIUM |
| Enterprise software | Process list | MEDIUM |
| Managed browser policies | Registry/config | HIGH |

**Why This Matters for OSINT:**
- When investigating threat actors, look for targeting logic in malware
- Domain-joined detection = corporate espionage motivation
- Consumer-only targeting = different threat model (crypto, banking)
- Mixed targeting = commodity malware with tiered access sales

**Enumeration Commands Attackers Use:**
```powershell
# Domain membership check
(Get-WmiObject -Class Win32_ComputerSystem).PartOfDomain

# Full AD domain info
[System.DirectoryServices.ActiveDirectory.Domain]::GetCurrentDomain()

# Check for enterprise software
Get-WmiObject -Class Win32_Product | Where-Object {$_.Name -like "*endpoint*"}
```

**Analysis Questions:**
1. Does the malware check domain status before executing?
2. Are there different payload paths for corp vs consumer?
3. Does the C2 infrastructure have tiered pricing/access?

### Browser Extension Attack Patterns

**"Crash Fix" Attack Chain:**
1. Typosquatted extension mimics legitimate (uBlock Origin, etc.)
2. Uses Chrome Alarms API for 60+ minute delay (evasion)
3. Triggers fake browser crash
4. Social engineers clipboard payload execution
5. Uses LOTL binaries (finger.exe) for C2

**OSINT Value:**
- Track extension publisher accounts across stores
- Map C2 infrastructure
- Identify similar extensions using same techniques
- Correlate with threat actor TTPs

**Reference:** See `~/.claude/skills/Parser/Workflows/ExtractBrowserExtension.md` for analysis workflow.
