# Entity OSINT Lookup Workflow

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the EntityLookup workflow in the OSINT skill to investigate entities"}' \
  > /dev/null 2>&1 &
```

Running the **EntityLookup** workflow in the **OSINT** skill to investigate entities...

**Purpose:** Technical intelligence gathering on domains, IPs, infrastructure, and threat entities.

**Authorization Required:** Explicit authorization, defined scope, legal compliance confirmed.

**Note:** "Entity" refers to domains, IPs, infrastructure, threat actors - NOT individuals.

---

## Phase 1: Entity Classification

**Entity Types:**
1. **Domains** - company.com, subdomain.company.com
2. **IP Addresses** - Single IPs or CIDR ranges
3. **ASN** - Autonomous System Numbers
4. **URLs** - Specific web addresses
5. **File Hashes** - MD5, SHA1, SHA256
6. **Threat Actors** - Known malicious groups
7. **Infrastructure** - C2 servers, botnets

**Extract base information:**
- Primary identifier
- Associated identifiers
- Initial reputation/context

---

## Source Reference (from SOURCES.JSON)

Use these specific sources per investigation phase:

| Investigation Area | Sources |
|-------------------|---------|
| **Domain/DNS** | SecurityTrails, DomainTools, crt.sh, DNSDumpster, ViewDNS, Robtex, CertStream |
| **IP Reputation** | Shodan, Censys, AbuseIPDB, GreyNoise, BinaryEdge, ZoomEye, Criminal IP, IPinfo |
| **Malware Analysis** | VirusTotal, Hybrid Analysis, ANY.RUN, MalwareBazaar, URLhaus, URLScan.io |
| **Vulnerability** | NVD, CVE, Exploit-DB, CISA KEV |
| **Threat Intel** | Pulsedive, IBM X-Force, Cisco Talos, AlienVault OTX, ThreatFox |
| **Dark Web/Leak** | Ahmia, HIBP, Intelligence X, DeHashed |
| **Frameworks** | MITRE ATT&CK, D3FEND, ATLAS |
| **Botnet/C2** | Feodo Tracker, SSL Blacklist |
| **Government** | CISA, UK NCSC, ENISA |

---

## Phase 2: Domain & URL Intelligence

**Domain Analysis:**
- WHOIS lookup (registrant, dates, name servers)
- DNS records (A, AAAA, MX, NS, TXT, CNAME)
- Subdomain enumeration (crt.sh, subfinder, amass)
- Historical DNS (SecurityTrails, Wayback)

**URL Analysis:**
- URLScan.io (screenshot, technologies, redirects)
- VirusTotal (reputation, scan results)
- Web technologies (Wappalyzer, BuiltWith)

---

## Phase 3: IP Intelligence

**Geolocation & Attribution:**
- IPinfo (location, ASN, organization)
- Hurricane Electric BGP Toolkit (routing, peers)
- RIPE Stat (network statistics)

**Reputation:**
- AbuseIPDB (abuse reports, confidence score)
- AlienVault OTX (threat intelligence)
- Blacklist checking (MXToolbox)

**Service Discovery:**
- Shodan (ports, services, vulnerabilities)
- Censys (certificates, protocols)

---

## Phase 4: Threat Intelligence (Researcher Agents)

**Deploy 8 researchers in parallel with source-specific prompts:**

```typescript
// Malware Analysis — VirusTotal, Hybrid Analysis, ANY.RUN, MalwareBazaar, URLhaus, URLScan.io
Task({ subagent_type: "PerplexityResearcher", prompt: "Search VirusTotal, Hybrid Analysis, ANY.RUN, MalwareBazaar, URLhaus, and URLScan.io for malware associated with [entity]. Report detection ratios, malware families, and behavioral indicators." })

// IP/Domain Reputation — Shodan, Censys, AbuseIPDB, GreyNoise, BinaryEdge, Criminal IP
Task({ subagent_type: "PerplexityResearcher", prompt: "Check reputation of [entity] via AbuseIPDB (abuse reports), GreyNoise (scanner classification), Shodan (exposed services), Censys (certificates), BinaryEdge, and Criminal IP. Report confidence scores and historical flags." })

// Threat Actor Profiling — MITRE ATT&CK, Pulsedive, IBM X-Force, AlienVault OTX
Task({ subagent_type: "ClaudeResearcher", prompt: "Profile threat actors associated with [entity] using MITRE ATT&CK framework, Pulsedive, IBM X-Force Exchange, and AlienVault OTX. Map TTPs, related IOCs, and campaign timelines." })

// Vulnerability & Exploit Intel — NVD, CVE, Exploit-DB, CISA KEV
Task({ subagent_type: "ClaudeResearcher", prompt: "Search NVD, CVE databases, Exploit-DB, and CISA Known Exploited Vulnerabilities catalog for vulnerabilities related to [entity]. Assess exploitability and active exploitation status." })

// C2 & Botnet Detection — Feodo Tracker, SSL Blacklist, Cisco Talos, ThreatFox
Task({ subagent_type: "GeminiResearcher", prompt: "Check [entity] against Feodo Tracker (C2 servers), SSL Blacklist, Cisco Talos intelligence, and ThreatFox for C2 indicators, botnet participation, and known malicious infrastructure." })

// Infrastructure Relationship Mapping — SecurityTrails, DomainTools, Robtex, ViewDNS
Task({ subagent_type: "GeminiResearcher", prompt: "Map infrastructure relationships for [entity] using SecurityTrails (historical DNS), DomainTools (WHOIS), Robtex (network graphs), and ViewDNS (reverse lookups). Identify co-hosted domains and shared infrastructure." })

// Dark Web & Leak Exposure — Ahmia, HIBP, Intelligence X, DeHashed
Task({ subagent_type: "GrokResearcher", prompt: "Search Ahmia (Tor), HIBP, Intelligence X, and DeHashed for [entity] exposure on dark web, paste sites, and breach databases. Report leak dates, data types exposed, and underground forum mentions." })

// Attribution Verification & Confidence Assessment
Task({ subagent_type: "GrokResearcher", prompt: "Verify IOC claims for [entity] — classify as active vs. historical vs. false positive. Cross-reference CISA advisories, UK NCSC alerts, and ENISA publications. Assess attribution confidence with evidence weighting." })
```

---

## Phase 5: Network Infrastructure

**Network Mapping:**
- ASN and network blocks
- Hosting providers
- BGP routing information
- Traceroute analysis

**Cloud Detection:**
- AWS, Azure, GCP IP range checks
- Cloud storage enumeration (with authorization)
- CDN identification

---

## Phase 6: Email Infrastructure

**MX Analysis:**
- Mail server identification
- Email provider detection
- Security records (SPF, DMARC, DKIM)
- Blacklist status

---

## Phase 7: Dark Web Intelligence (Researcher Agents)

**Deploy 6 researchers in parallel with source-specific prompts:**

```typescript
// Paste Sites & Breach Data — HIBP, Intelligence X, DeHashed
Task({ subagent_type: "PerplexityResearcher", prompt: "Search HIBP, Intelligence X, and DeHashed for [entity] in paste sites and breach databases. Report breach dates, compromised data types, and exposure scope." })
Task({ subagent_type: "PerplexityResearcher", prompt: "Check Intelligence X historical search for [entity] — archived pastes, leaked documents, and cached content from removed pages." })

// Ransomware & Underground Forums — Ahmia, dedicated leak site monitoring
Task({ subagent_type: "ClaudeResearcher", prompt: "Check ransomware leak sites and Ahmia (Tor search) for [entity]. Search for data dumps, extortion notices, and victim listings." })
Task({ subagent_type: "ClaudeResearcher", prompt: "Search underground forum mentions of [entity] — access broker listings, vulnerability discussions, and credential sales." })

// Messaging Platforms & Verification
Task({ subagent_type: "GeminiResearcher", prompt: "Search Telegram channels and Discord servers for mentions of [entity]. Check known threat actor communication channels and data trading groups." })
Task({ subagent_type: "GrokResearcher", prompt: "Verify dark web exposure claims for [entity]. Cross-reference with Intelligence X and HIBP. Classify findings as confirmed, unverified, or likely false positive." })
```

---

## Phase 8: Correlation & Pivot Analysis

**Relationship Discovery:**
- Domains sharing same IP
- Domains sharing same registrant
- Certificate relationships
- ASN correlations

**Pivot Points:**
- WHOIS email -> Other domains
- IP address -> Other hosted domains
- Name servers -> All hosted domains
- Certificate details -> Similar certs

**Timeline Construction:**
- Registration dates
- First seen in threat intel
- Infrastructure changes
- Ownership changes

---

## Phase 9: Analysis & Reporting

**Threat Classification:**
- Legitimate / Suspicious / Malicious / Compromised / Sinkholed

**Confidence Levels:**
- High: Multiple independent confirmations
- Medium: Some supporting evidence
- Low: Speculative or single source

**Report Structure:**
1. Entity Profile
2. Technical Infrastructure
3. Reputation & Intelligence
4. Relationships & Connections
5. Threat Assessment
6. Timeline
7. Risk Assessment
8. Recommendations
9. IoCs (domains, IPs, hashes)

---

## Checklist

- [ ] Authorization verified
- [ ] Entity classified
- [ ] WHOIS/DNS completed
- [ ] IP intelligence gathered
- [ ] Threat intel consulted
- [ ] VirusTotal searched
- [ ] Historical data reviewed
- [ ] Relationships mapped
- [ ] Risk score assigned
- [ ] Report drafted

---

**Reference:** See `SOURCES.JSON` for the full source catalog. Legacy tool details in `EntityTools.md`.
