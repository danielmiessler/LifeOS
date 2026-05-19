# CyberSleuth Recon Workflow

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the CyberSleutRecon workflow in the Recon skill to investigate infrastructure"}' \
  > /dev/null 2>&1 &
```

Running the **CyberSleutRecon** workflow in the **Recon** skill to investigate infrastructure...

**Requires:** CyberSleuth MCP server active (`cybersleuth` in mcpServers). See `SKILL.md` for installation.

**Purpose:** MCP-native domain and IP reconnaissance using CyberSleuth tools — richer and faster than shell-based recon. Covers registration, DNS, subdomains, technology stack, reputation, and threat intelligence in a single pass.

---

## Phase 1: Authorization & Scope

- [ ] Explicit authorization confirmed (or passive-only on public data)
- [ ] Target domain(s) or IP(s) defined
- [ ] CyberSleuth MCP tools available in session

**STOP if CyberSleuth is not active** — fall back to `DomainRecon.md` or `IpRecon.md`.

---

## Phase 2: Registration & WHOIS

**Tool:** `whois_lookup(domain)`

Extract:
- Registrar, registration date, expiration date
- Registrant (or privacy proxy detection)
- Name servers
- DNSSEC status
- ⚠️ If `expiration_date < 30 days` → flag HIGH immediately (domain squatting risk)

---

## Phase 3: DNS Enumeration

**Tool:** `dns_records(domain)` — returns all record types in one call (A, AAAA, MX, NS, TXT, SOA, CNAME, CAA)

Analyze:
- A/AAAA → resolved IPs for infrastructure mapping
- MX → mail provider identification
- TXT → decode every SPF `include:` and verification token (full SaaS stack inventory)
- NS → hosting provider or self-managed DNS
- CAA → certificate authority restriction

---

## Phase 4: Certificate Transparency

**Tool:** `certificate_info(domain, wildcard=True)`

Extract:
- All subdomains ever issued certificates
- Certificate issuers (Let's Encrypt vs. commercial CA)
- First certificate date (domain age signal)
- SAN entries (reveals related domains)
- ⚠️ Naming conventions in subdomains decode architecture:
  - Environment suffixes (`appname-prod`, `appname-test`) → prod/test split
  - Service-role prefixes (`clearingservice.*`, `bankid-idp.*`, `partner-portal.*`) → backend systems
  - Auth prefixes (`sso.*`, `auth.*`, `oauth.*`) → identity provider dependencies

---

## Phase 5: AS & Hosting Intelligence

**Tool:** `as_intelligence(domain_or_ip)` — run for each unique IP from Phase 3

Extract:
- ASN, AS org, country
- Hosting/cloud provider flag (if not hosting, AS org = the real organization)
- Group IPs by ASN to map infrastructure segments

**Tool:** `reverse_dns(ip)` — for each IP

---

## Phase 6: Reputation & Threat Intel

Run in parallel for each target domain and key IPs:

**Tool:** `vt_domain_report(domain)`
- Malicious/suspicious detection counts
- Categories and reputation score

**Tool:** `vt_ip_report(ip)` — for each unique IP

**Tool:** `urlscan_history(domain, limit=5)`
- Historical screenshots and technology snapshots
- Maliciousness verdicts

---

## Phase 7: Infrastructure Discovery

**Tool:** `shodan_search(query, limit=10)`

Run multiple queries:
```
org:"[organization name]"          → all exposed services
hostname:[domain]                  → services on discovered hosts
ssl.cert.subject.cn:[domain]       → services by certificate
http.favicon.hash:[hash]           → clones/mirrors (use favicon_hash first)
```

**Tool:** `favicon_hash(url)` — generate hash for Shodan `http.favicon.hash:` query

For each Shodan result note: open ports, server versions, SNMP engine uptime (if present → patch inference: `uptime_days / 365 ≈ years since last reboot`).

---

## Phase 8: Technology Stack

**Tool:** `builtwith_lookup(domain)`
- Technology groups and categories with last-seen dates
- Correlate with TXT verification records from Phase 3 (cross-validates SaaS stack)

---

## Phase 9: M365 / Azure AD Discovery

Fetch manually (no MCP tool — use WebFetch):
```
https://login.microsoftonline.com/getuserrealm.srf?login=test@[domain]&xml=1
https://login.microsoftonline.com/[domain]/.well-known/openid-configuration
```

Determine: Managed / Federated / Unknown namespace; extract tenant ID if enrolled.

---

## Phase 10: Synthesis

**Infrastructure map:**
- Domain → subdomains → IPs → ASNs → hosting providers
- Technology stack per layer (web, mail, CDN, identity)
- Certificate relationships and first-seen dates

**Security posture:**
- DNSSEC signed/unsigned (critical if hosting BankID, OAuth IDP, or SSO)
- Email security: SPF hardfail vs. softfail; DMARC policy; DKIM selectors
- Domain expiry urgency
- Shodan SNMP uptime findings
- VirusTotal reputation flags

**Report structure:**
1. Executive Summary + Risk Advisory (HIGH/MEDIUM/LOW findings)
2. Registration & WHOIS
3. DNS Infrastructure
4. Subdomain Map (with purpose classification)
5. AS & Hosting Map
6. Technology Stack (BuiltWith + TXT cross-reference)
7. Reputation & Threat Intel (VirusTotal + URLScan)
8. M365 / Identity Infrastructure
9. Shodan Exposure
10. Recommendations

---

## Checklist

- [ ] WHOIS retrieved; expiry checked
- [ ] All DNS records collected; SPF decoded
- [ ] Certificate transparency enumerated; subdomain naming analyzed
- [ ] AS/hosting mapped for all unique IPs
- [ ] VirusTotal checked (domain + key IPs)
- [ ] URLScan history reviewed
- [ ] Shodan queried (org + hostname + favicon)
- [ ] BuiltWith stack retrieved
- [ ] M365 tenant status determined
- [ ] Report drafted with severity-classified findings

---

**Reference:** [CyberSleuth GitHub](https://github.com/Mar8x/cybersleuth) · See `cybersleuth://instructions` MCP resource for full methodology.
