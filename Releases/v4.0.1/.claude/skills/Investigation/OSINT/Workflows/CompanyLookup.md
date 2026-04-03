# Company OSINT Lookup Workflow

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the CompanyLookup workflow in the OSINT skill to research companies"}' \
  > /dev/null 2>&1 &
```

Running the **CompanyLookup** workflow in the **OSINT** skill to research companies...

**Purpose:** Comprehensive business intelligence gathering for authorized research, due diligence, or security assessments.

**Authorization Required:** Explicit authorization, defined scope, legal compliance confirmed.

---

## Phase 1: Authorization & Scope

**VERIFY BEFORE STARTING:**
- [ ] Explicit authorization from client
- [ ] Clear scope (target company, information types, purpose)
- [ ] Legal compliance confirmed
- [ ] Documented in engagement paperwork

**STOP if any checkbox is unchecked.**

---

## Source Reference (from SOURCES.JSON)

Use these specific sources per investigation phase:

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
| **Government Contracts** | USAspending, GovTribe |
| **Sanctions** | OFAC, EU Sanctions, OpenSanctions |
| **Corporate Ownership** | OpenOwnership, GLEIF LEI |
| **Startup/VC** | Dealroom, Tracxn, Owler, Wellfound |

---

## Phase 2: Entity Identification

**Collect initial identifiers:**
- Legal company name(s) and DBAs
- Known domains
- Known personnel (founders, executives)
- Geographic location
- Industry/sector
- Corporate structure

---

## Phase 3: Business Registration Research

**Corporate filings:**
- Secretary of State registrations (all relevant states)
- Federal registrations (SEC if applicable)
- Foreign qualifications
- DBA/fictitious name registrations

**Regulatory registrations:**
- Industry-specific licenses
- Professional certifications
- Securities registrations

---

## Phase 4: Domain & Digital Assets

**Domain enumeration (7 techniques):**
1. Certificate Transparency logs (crt.sh)
2. DNS enumeration (subfinder, amass)
3. Search engine discovery
4. Social media bio links
5. Business registration website fields
6. WHOIS reverse lookups
7. Related TLD checking

**See `CompanyDueDiligence.md` for detailed domain-first protocol.**

---

## Phase 5: Technical Infrastructure

**For each discovered domain:**
- DNS records (A, MX, TXT, NS)
- IP resolution and geolocation
- Hosting provider identification
- SSL/TLS certificate analysis
- Technology stack (BuiltWith, Wappalyzer)
- Security posture (SPF, DKIM, DMARC)

---

## Phase 6: Deploy Researcher Fleet

**Launch 10 researchers in parallel with source-specific prompts:**

```typescript
// Business Registration — OpenCorporates, SEC EDGAR, Companies House, SAM.gov
Task({ subagent_type: "PerplexityResearcher", prompt: "Search OpenCorporates, SEC EDGAR, and Companies House for business registrations of [company]. Check SAM.gov for government contractor status. Verify legal entity name, jurisdiction, status, and filing history." })

// Leadership & Key Personnel — LinkedIn, ZoomInfo, Apollo, RocketReach
Task({ subagent_type: "ClaudeResearcher", prompt: "Research founders and executives of [company] via LinkedIn, ZoomInfo, Apollo, and RocketReach. Map career histories, board memberships, and professional credentials." })

// Financial Intelligence — Crunchbase, PitchBook, D&B, AlphaSense
Task({ subagent_type: "ClaudeResearcher", prompt: "Research funding history and financial health of [company] via Crunchbase, PitchBook, Dun & Bradstreet, and AlphaSense. Map funding rounds, investors, revenue signals, and credit ratings." })

// Legal & Regulatory — PACER, CourtListener, UniCourt
Task({ subagent_type: "GrokResearcher", prompt: "Search PACER (federal), CourtListener, and UniCourt for legal proceedings involving [company]. Check for regulatory enforcement actions, lawsuits, and compliance issues." })

// Patent & Intellectual Property — USPTO, Google Patents, Espacenet, Lens.org
Task({ subagent_type: "ClaudeResearcher", prompt: "Search USPTO, Google Patents, Espacenet, and Lens.org for patents and IP filings by [company]. Assess innovation portfolio and technology moat." })

// Tech Profiling & Infrastructure — BuiltWith, Wappalyzer, Netcraft
Task({ subagent_type: "GeminiResearcher", prompt: "Profile technology stack of [company] using BuiltWith, Wappalyzer, and Netcraft. Identify frameworks, analytics, CDNs, hosting, and third-party integrations." })

// Media & News Coverage — GDELT, MediaCloud, Google News
Task({ subagent_type: "PerplexityResearcher", prompt: "Analyze media coverage of [company] via GDELT, MediaCloud, and Google News. Distinguish earned media from paid/promotional content. Track sentiment over time." })

// Competitive Intelligence — SimilarWeb, SEMrush, Owler
Task({ subagent_type: "GeminiResearcher", prompt: "Map competitive landscape for [company] using SimilarWeb (traffic), SEMrush (SEO/ads), and Owler (competitor tracking). Identify market position and key competitors." })

// Sanctions & Compliance — OFAC, EU Sanctions, OpenSanctions
Task({ subagent_type: "GrokResearcher", prompt: "Check [company] against OFAC SDN list, EU Consolidated Sanctions, and OpenSanctions database. Verify no sanctions, export controls, or debarment listings." })

// Corporate Ownership & VC — OpenOwnership, GLEIF LEI, Dealroom, Tracxn, Wellfound
Task({ subagent_type: "PerplexityResearcher", prompt: "Map corporate ownership structure of [company] via OpenOwnership, GLEIF LEI database. Check startup/VC data on Dealroom, Tracxn, and Wellfound for investment history and cap table insights." })
```

---

## Phase 7: Intelligence Synthesis

**Consolidate findings:**
- Business legitimacy indicators
- Leadership credibility assessment
- Financial health signals
- Regulatory compliance status
- Reputation analysis
- Red flags identified

**Report structure:**
- Executive summary
- Company profile
- Leadership analysis
- Financial assessment
- Regulatory status
- Risk assessment
- Sources consulted

---

## Quality Gates

**Before finalizing report:**
- [ ] All domains discovered and analyzed
- [ ] Business registrations verified
- [ ] Leadership backgrounds researched
- [ ] Multi-source verification (3+ sources per claim)
- [ ] Red flags investigated

---

**Related Workflows:**
- `CompanyDueDiligence.md` - Investment-grade 5-phase due diligence
- **Reference:** See `SOURCES.JSON` for the full source catalog. Legacy tool details in `CompanyTools.md`.
