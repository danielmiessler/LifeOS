# Company Investment Due Diligence Workflow

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the CompanyDueDiligence workflow in the OSINT skill to vet investments"}' \
  > /dev/null 2>&1 &
```

Running the **CompanyDueDiligence** workflow in the **OSINT** skill to vet investments...

**Purpose:** Comprehensive 5-phase investment vetting combining domain-first OSINT, technical reconnaissance, multi-source research, and investment risk assessment.

**Authorization Required:** Only for authorized investment vetting and business intelligence.

---

## Source Reference (from SOURCES.JSON)

Combined company + threat intel sources for investment vetting:

| Investigation Area | Sources |
|-------------------|---------|
| **Business Registration** | OpenCorporates, SEC EDGAR, Companies House, SAM.gov |
| **Financial Intel** | Crunchbase, PitchBook, D&B, AlphaSense |
| **Employee Intel** | LinkedIn, ZoomInfo, Apollo, RocketReach, Hunter.io |
| **Legal/Court** | PACER, CourtListener, UniCourt |
| **Patent/IP** | USPTO, Google Patents, Espacenet, Lens.org |
| **Tech Profiling** | BuiltWith, Wappalyzer, Netcraft |
| **Competitive** | SimilarWeb, SEMrush |
| **News/Media** | GDELT, MediaCloud, Google News |
| **Sanctions** | OFAC, EU Sanctions, OpenSanctions |
| **Corporate Ownership** | OpenOwnership, GLEIF LEI |
| **Domain/DNS** | SecurityTrails, DomainTools, crt.sh, DNSDumpster, ViewDNS |
| **IP/Infrastructure** | Shodan, Censys, AbuseIPDB, GreyNoise |
| **Threat Intel** | VirusTotal, URLScan.io, Pulsedive |
| **Dark Web/Leak** | HIBP, Intelligence X, DeHashed |
| **Startup/VC** | Dealroom, Tracxn, Owler, Wellfound |
| **Government Contracts** | USAspending, GovTribe |

---

## Critical Design: DOMAIN-FIRST PROTOCOL

**Domain discovery is MANDATORY STEP ONE and BLOCKS all subsequent phases.**

This prevents intelligence gaps like missing investor-facing portals on alternative TLDs (.partners, .capital, .fund).

---

## 5-Phase Overview

```
Phase 1: Domain Discovery (BLOCKING)
    [Quality Gate: 95%+ confidence all domains found]
Phase 2: Technical Reconnaissance
    [Quality Gate: All domains/IPs/ASNs enumerated]
Phase 3: Comprehensive Research (32+ agents)
    [Quality Gate: Min 3 sources per claim]
Phase 4: Investment Vetting
    [Quality Gate: All red flags investigated]
Phase 5: Synthesis & Recommendation
```

---

## Phase 1: Domain Discovery (BLOCKING)

**Execute 7 parallel enumeration techniques:**

1. **Certificate Transparency:** crt.sh, certspotter
2. **DNS Enumeration:** subfinder, amass, assetfinder
3. **Search Engine Discovery:** Delegate to Research Skill
4. **Social Media Links:** Extract from all profiles
5. **Business Registrations:** Website fields in filings
6. **WHOIS Reverse Lookup:** Registrant email/name correlation
7. **Related TLD Discovery:** Check .com, .net, .partners, .capital, .fund

**Quality Gate Validation:**
- [ ] All 7 techniques executed
- [ ] Investor-facing website found (or high confidence none exists)
- [ ] Team/about pages discovered
- [ ] 95%+ confidence in domain coverage

**DO NOT PROCEED until quality gate passes.**

---

## Phase 2: Technical Reconnaissance

**Deploy pentester fleet (one per domain):**

For each discovered domain:
- DNS records (A, AAAA, MX, TXT, NS, SOA, CNAME)
- SSL/TLS certificate analysis
- IP resolution and ASN identification
- Web technology fingerprinting
- Security posture assessment

**Additional IP-level recon:**
- Geolocation and hosting provider
- Reverse DNS lookups
- Network block identification

---

## Phase 3: Comprehensive Research (32+ Agents)

**Deploy researcher fleet in parallel with 10-minute timeout:**

**Business Legitimacy (8 agents):**
- Entity registration verification — OpenCorporates, SEC EDGAR, Companies House, SAM.gov
- Regulatory compliance checks — OFAC, EU Sanctions, OpenSanctions
- Leadership background research — LinkedIn, ZoomInfo, Apollo, RocketReach
- Financial intelligence gathering — Crunchbase, PitchBook, D&B, AlphaSense

```typescript
Task({ subagent_type: "PerplexityResearcher", prompt: "Search OpenCorporates, SEC EDGAR, Companies House, and SAM.gov for business registrations of [company]. Verify entity status, jurisdiction, officers, and filing history." })
Task({ subagent_type: "GrokResearcher", prompt: "Check [company] against OFAC SDN list, EU Consolidated Sanctions, OpenSanctions, and debarment lists. Report any regulatory enforcement actions or compliance violations." })
Task({ subagent_type: "ClaudeResearcher", prompt: "Research leadership of [company] via LinkedIn, ZoomInfo, Apollo, and RocketReach. Map career histories, board seats, credentials, and potential conflicts of interest." })
Task({ subagent_type: "ClaudeResearcher", prompt: "Research financial health of [company] via Crunchbase (funding rounds), PitchBook (valuations), D&B (credit ratings), and AlphaSense (earnings/filings). Map revenue signals and financial trajectory." })
Task({ subagent_type: "PerplexityResearcher", prompt: "Search PACER, CourtListener, and UniCourt for legal proceedings involving [company]. Check for lawsuits, regulatory actions, bankruptcy filings, and IP disputes." })
Task({ subagent_type: "ClaudeResearcher", prompt: "Search USPTO, Google Patents, Espacenet, and Lens.org for IP portfolio of [company]. Assess patent breadth, citation count, and technology defensibility." })
Task({ subagent_type: "GrokResearcher", prompt: "Map corporate ownership structure of [company] via OpenOwnership, GLEIF LEI. Identify beneficial owners, subsidiary relationships, and holding company chains." })
Task({ subagent_type: "PerplexityResearcher", prompt: "Check [company] government contracting history via USAspending and GovTribe. Report contract values, agencies, and performance ratings." })
```

**Reputation & Market (8 agents):**
- Media coverage analysis (earned vs. paid) — GDELT, MediaCloud, Google News
- Customer testimonial assessment — G2, Trustpilot, BBB
- Competitive landscape mapping — SimilarWeb, SEMrush, Owler
- Market opportunity validation — Dealroom, Tracxn, Wellfound

```typescript
Task({ subagent_type: "PerplexityResearcher", prompt: "Analyze media coverage of [company] via GDELT, MediaCloud, and Google News. Distinguish earned media from paid/promotional. Track sentiment trajectory and coverage volume." })
Task({ subagent_type: "GeminiResearcher", prompt: "Assess customer sentiment for [company] via G2, Trustpilot, BBB, and app store reviews. Identify recurring complaints and satisfaction patterns." })
Task({ subagent_type: "GeminiResearcher", prompt: "Map competitive landscape for [company] using SimilarWeb (traffic/engagement), SEMrush (search visibility), and Owler (competitor tracking). Identify market position and competitive threats." })
Task({ subagent_type: "PerplexityResearcher", prompt: "Research market opportunity for [company] via Dealroom, Tracxn, and Wellfound. Assess TAM, funding trends in sector, and comparable exits/valuations." })
Task({ subagent_type: "ClaudeResearcher", prompt: "Search for industry recognition and awards for [company]. Check conference appearances, analyst mentions, and thought leadership indicators." })
Task({ subagent_type: "GeminiResearcher", prompt: "Analyze employee sentiment for [company] via Glassdoor, Blind, LinkedIn posts. Assess hiring velocity, attrition signals, and cultural health." })
Task({ subagent_type: "GrokResearcher", prompt: "Research historical context for [company] — previous pivots, name changes, founder track records, and predecessor entities. Check Wayback Machine for website evolution." })
Task({ subagent_type: "ClaudeResearcher", prompt: "Profile technology stack and infrastructure of [company] via BuiltWith, Wappalyzer, and Netcraft. Assess technical maturity, cloud adoption, and security posture." })
```

**Verification (8 agents):**
- Claim verification (revenue, customers, partnerships)
- Credential verification (education, certifications)
- Cross-source confirmation across all findings

```typescript
Task({ subagent_type: "GrokResearcher", prompt: "Verify revenue claims for [company] by cross-referencing SEC filings, Crunchbase data, press releases, and employee count estimates from LinkedIn/ZoomInfo. Flag discrepancies." })
Task({ subagent_type: "GrokResearcher", prompt: "Verify customer claims for [company] — search for case studies, logos used on website, and independent customer references. Check if named customers confirm the relationship." })
Task({ subagent_type: "ClaudeResearcher", prompt: "Verify partnership claims for [company] — check partner directories, joint press releases, and integration marketplaces. Distinguish 'customer' from 'partner' from 'integration'." })
Task({ subagent_type: "GrokResearcher", prompt: "Verify education and credential claims for [company] leadership — check university alumni directories, certification databases, and professional license registries." })
Task({ subagent_type: "PerplexityResearcher", prompt: "Cross-reference all [company] claims against independent sources. Check for inconsistencies between website, LinkedIn, Crunchbase, and SEC filings." })
Task({ subagent_type: "GeminiResearcher", prompt: "Search HIBP, Intelligence X, and DeHashed for [company] domain exposure. Check for data breaches, credential leaks, and dark web mentions." })
Task({ subagent_type: "PerplexityResearcher", prompt: "Check [company] domains against VirusTotal, URLScan.io, and AbuseIPDB. Assess for malware hosting, phishing indicators, or abuse reports." })
Task({ subagent_type: "GeminiResearcher", prompt: "Map all domains and subdomains of [company] via SecurityTrails, crt.sh, and DNSDumpster. Identify shadow IT, forgotten assets, and infrastructure scope." })
```

**Specialized (8 agents):**
- Industry deep-dive and IP assessment
- Threat intelligence overlay

```typescript
Task({ subagent_type: "ClaudeResearcher", prompt: "Deep dive into [company]'s industry vertical — market size, growth rate, regulatory environment, and key trends that affect their business model." })
Task({ subagent_type: "GeminiResearcher", prompt: "Assess technology infrastructure of [company] via Shodan (exposed services), Censys (certificates), and GreyNoise (scanner activity). Report security posture findings." })
Task({ subagent_type: "PerplexityResearcher", prompt: "Research [company]'s open source contributions, GitHub presence, and developer community engagement. Assess technical talent signals." })
Task({ subagent_type: "GrokResearcher", prompt: "Analyze [company] social media presence — Twitter/X, LinkedIn company page, YouTube. Assess follower quality, engagement rates, and content strategy." })
Task({ subagent_type: "ClaudeResearcher", prompt: "Research [company]'s ESG profile — environmental commitments, social impact programs, governance structure. Check for greenwashing or DEI-washing indicators." })
Task({ subagent_type: "GeminiResearcher", prompt: "Check [company] against Pulsedive, Cisco Talos, and AlienVault OTX for any threat intelligence associations. Report if company infrastructure appears in IOC feeds." })
Task({ subagent_type: "PerplexityResearcher", prompt: "Research [company]'s hiring patterns via LinkedIn Jobs, Indeed, and Glassdoor. Map open roles to infer strategic direction, burn rate, and growth areas." })
Task({ subagent_type: "GrokResearcher", prompt: "Final verification sweep for [company] — search for any red flags across all sources not yet covered. Check BBB complaints, FTC enforcement database, and state AG actions." })
```

---

## Phase 4: Investment Vetting

**Legitimacy Assessment Framework:**

**Strong Indicators:**
- Active business registrations
- SEC filings (if applicable)
- Named credentialed board members
- Audited financials available
- Industry association memberships

**Warning Signs:**
- Limited online presence for established company
- No customer testimonials despite years of operation
- Heavy promotional vs. earned media

**Red Flags:**
- Business entity dissolved or inactive
- Regulatory enforcement actions
- Misrepresentation of credentials

**Risk Scoring (0-100):**
- Business Risk (0-10)
- Regulatory Risk (0-10)
- Team Risk (0-10)
- Transparency Risk (0-10)
- Market Risk (0-10)

**Score Interpretation:**
- 0-20: LOW RISK - Proceed
- 21-40: MODERATE - Proceed with conditions
- 41-60: HIGH - Decline
- 61-100: CRITICAL - Avoid

---

## Phase 5: Synthesis & Recommendation

**Executive Summary Format:**

```markdown
**Target:** [company name]
**Risk Assessment:** [LOW/MODERATE/HIGH/CRITICAL]
**Recommendation:** [PROCEED/PROCEED WITH CONDITIONS/DECLINE/AVOID]

### Key Findings (Top 5)
1. [Finding]
2. [Finding]
...

### Critical Red Flags
- [If any]

### Investment Strengths
1. [Strength]
...

### Recommendation
[2-3 paragraph recommendation with action items]
```

---

## File Organization

```
~/.claude/MEMORY/WORK/$(jq -r '.work_dir' ~/.claude/MEMORY/STATE/current-work.json)/YYYY-MM-DD-HHMMSS_due-diligence-[company]/
  phase1-domains.md
  phase2-technical.md
  phase3-research.md
  phase4-vetting.md
  phase5-report.md

~/.claude/History/research/YYYY-MM/[company]-due-diligence/
  comprehensive-report.md
  risk-assessment.md
  metadata.json
```

---

## Ethical Compliance

- Open source intelligence only
- No unauthorized access
- No social engineering
- Respect privacy and ToS
- Legal compliance required
- Authorization documented

---

**Reference:** See `SOURCES.JSON` for the full source catalog. Legacy tool details in `CompanyTools.md`.
