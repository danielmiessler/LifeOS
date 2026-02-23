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

**Deploy 8 researchers in parallel:**

```typescript
// Malware Intelligence (Perplexity x2)
Task({ subagent_type: "PerplexityResearcher", prompt: "Research malware associated with [entity] via VirusTotal, Hybrid Analysis, Malware Bazaar" })
Task({ subagent_type: "PerplexityResearcher", prompt: "Check reputation of [entity] via AbuseIPDB, AlienVault OTX, Cisco Talos" })

// Threat Actor Profiling (Claude x2)
Task({ subagent_type: "ClaudeResearcher", prompt: "Profile threat actors associated with [entity] using MITRE ATT&CK, Malpedia" })
Task({ subagent_type: "ClaudeResearcher", prompt: "Research historical campaigns involving [entity]" })

// C2 Detection (Gemini x2)
Task({ subagent_type: "GeminiResearcher", prompt: "Detect C2 indicators for [entity] - Cobalt Strike, Metasploit patterns" })
Task({ subagent_type: "GeminiResearcher", prompt: "Map infrastructure relationships for [entity]" })

// Verification (Grok x2)
Task({ subagent_type: "GrokResearcher", prompt: "Verify IOC claims for [entity] - active vs. historical vs. false positive" })
Task({ subagent_type: "GrokResearcher", prompt: "Assess attribution confidence for [entity]" })
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

**Deploy 6 researchers in parallel:**

```typescript
// Paste Sites (Perplexity x2)
Task({ subagent_type: "PerplexityResearcher", prompt: "Search paste sites for [entity]" })
Task({ subagent_type: "PerplexityResearcher", prompt: "Check breach databases for [entity]" })

// Dark Web (Claude x2)
Task({ subagent_type: "ClaudeResearcher", prompt: "Check ransomware leak sites for [entity]" })
Task({ subagent_type: "ClaudeResearcher", prompt: "Search underground forum mentions for [entity]" })

// Verification (Gemini + Grok)
Task({ subagent_type: "GeminiResearcher", prompt: "Search Telegram/Discord for [entity]" })
Task({ subagent_type: "GrokResearcher", prompt: "Verify dark web exposure for [entity]" })
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

**Reference:** See `EntityTools.md` for detailed tool specifications.
