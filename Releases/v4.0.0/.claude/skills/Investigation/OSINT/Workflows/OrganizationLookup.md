# Organization OSINT Lookup Workflow

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the OrganizationLookup workflow in the OSINT skill to research organizations"}' \
  > /dev/null 2>&1 &
```

Running the **OrganizationLookup** workflow in the **OSINT** skill to research organizations...

**Purpose:** Investigation of non-commercial entities — NGOs, government agencies, associations, academic institutions, nonprofits, foundations, and international organizations. Different from CompanyLookup because these entities have different registries, funding models, transparency requirements, and accountability structures.

**Authorization Required:** Explicit authorization, defined scope, legal compliance confirmed.

---

## Phase 1: Authorization & Scope

**VERIFY BEFORE STARTING:**
- [ ] Explicit authorization from client or authorized party
- [ ] Clear scope definition (target organization, information types, purpose)
- [ ] Legal compliance confirmed
- [ ] Documented authorization in engagement paperwork

**STOP if any checkbox is unchecked.**

---

## Source Reference (from SOURCES.JSON)

| Investigation Area | Sources |
|-------------------|---------|
| **Nonprofit Registration** | IRS (990 filings), GuideStar/Candid, Charity Navigator, state charity registrations |
| **Government Entity** | USAspending, GovTribe, SAM.gov, FOIA portals, agency websites |
| **International Org** | UN databases, OECD, World Bank Open Data, OpenSanctions |
| **Academic Institution** | NCES (National Center for Education Statistics), accreditation databases, Google Scholar |
| **Corporate Registration** | OpenCorporates, state Secretary of State filings |
| **Leadership/Personnel** | LinkedIn, ZoomInfo, board listings, public appointment records |
| **Financial Transparency** | IRS 990 (ProPublica Nonprofit Explorer), annual reports, grant databases (Foundation Directory) |
| **Legal/Regulatory** | PACER, CourtListener, OFAC, OIG exclusion lists |
| **News/Media** | GDELT, MediaCloud, Google News |
| **Digital Presence** | BuiltWith, Wappalyzer, Netcraft, SecurityTrails |
| **Sanctions/Compliance** | OFAC, EU Sanctions, OpenSanctions, OIG |
| **Domain/Infrastructure** | SecurityTrails, DomainTools, crt.sh, Shodan |

---

## Phase 2: Organization Identification

**Collect initial identifiers:**
- Official legal name and common name
- Organization type (nonprofit, government, NGO, academic, foundation, association, international)
- Jurisdiction (US state, country, international)
- EIN/tax ID (for US nonprofits)
- Mission statement
- Year established
- Known leadership (executive director, board chair, agency head)
- Known domains and social media

**Classify the organization:**

| Type | Primary Registries | Key Financial Sources |
|------|-------------------|----------------------|
| US Nonprofit (501c3/4) | IRS, state AG, Secretary of State | IRS 990 (ProPublica), annual reports |
| Government Agency | SAM.gov, agency org charts | USAspending, budget documents |
| Academic Institution | NCES, accreditation bodies | IRS 990 (if private), endowment reports |
| International NGO | UN ECOSOC, country registrations | Annual reports, donor disclosures |
| Foundation | IRS (private foundation 990-PF) | 990-PF grant listings |
| Trade Association | IRS (501c6), state registrations | IRS 990, membership disclosures |

---

## Phase 3: Registration & Legal Status

**Nonprofit-specific (US):**
- IRS tax-exempt status verification (IRS Select Check)
- IRS 990 filings via ProPublica Nonprofit Explorer
- State charity registration (state AG database)
- Secretary of State corporate filing
- GuideStar/Candid profile
- Charity Navigator rating

**Government-specific:**
- Agency org chart and leadership
- Statutory authority (enabling legislation)
- SAM.gov entity registration
- Inspector General reports
- FOIA request history (MuckRock)

**Academic-specific:**
- Accreditation status (regional/national accreditor databases)
- NCES data (enrollment, graduation rates, finances)
- Research funding (NSF Award Search, NIH Reporter)

**International-specific:**
- UN ECOSOC consultative status
- Country-of-origin registration
- International charity registry listings
- OpenSanctions check

---

## Phase 4: Leadership & Key Personnel

**Board of Directors/Trustees:**
- Board member names and affiliations
- Board composition (independence, diversity, expertise)
- Potential conflicts of interest
- Cross-board memberships with other organizations

**Executive Leadership:**
- Executive Director/CEO background (LinkedIn, professional history)
- Compensation (from IRS 990 Part VII)
- Tenure and turnover patterns
- Prior roles and organizations

**Key Staff:**
- Program directors and senior leadership
- Published expertise (Google Scholar, ResearchGate)
- Media appearances and public statements

---

## Phase 5: Funding & Financial Transparency

**Revenue Sources (from IRS 990):**
- Program service revenue
- Government grants and contracts
- Private donations and fundraising
- Investment income
- Fee-for-service

**Expense Analysis (from IRS 990):**
- Program expenses vs. administrative vs. fundraising
- Program efficiency ratio
- Executive compensation relative to budget
- Related-party transactions

**Grant Tracking:**
- Foundation Directory Online (grants received)
- USAspending (government grants/contracts)
- State grant databases
- Published donor lists (annual reports)

**Financial Health Indicators:**
- Revenue trend (growing, stable, declining)
- Reserves/net assets ratio
- Diversification of funding sources
- Audit findings (if available)

---

## Phase 6: Digital Presence & Reputation

**Domain & Infrastructure:**
- Primary website analysis (BuiltWith, Wappalyzer)
- Domain age and registration (DomainTools)
- Subdomain discovery (crt.sh, SecurityTrails)
- Email infrastructure (MX, SPF, DMARC)

**Social Media:**
- Official accounts (Twitter/X, LinkedIn, Facebook, Instagram, YouTube)
- Follower quality and engagement
- Content consistency with mission
- Staff social media presence

**News & Media Coverage:**
- GDELT event monitoring
- MediaCloud coverage analysis
- Google News timeline
- Op-eds and public statements by leadership

**Reputation:**
- GuideStar/Candid seal of transparency
- Charity Navigator rating
- BBB Wise Giving Alliance
- Watchdog organization assessments
- Controversy or criticism history

---

## Phase 7: Deploy Researcher Fleet

**Launch 8 researchers in parallel with source-specific prompts:**

```typescript
// Registration & Legal Status — IRS, ProPublica, GuideStar, state registries
Task({ subagent_type: "PerplexityResearcher", prompt: "Verify registration and legal status of [organization]. Search IRS Select Check for tax-exempt status, ProPublica Nonprofit Explorer for 990 filings, GuideStar/Candid for transparency profile, and state charity registration databases. Report EIN, ruling year, deductibility status, and any revocations." })

// Financial Analysis — IRS 990, annual reports, USAspending
Task({ subagent_type: "ClaudeResearcher", prompt: "Analyze financial health of [organization] using IRS 990 filings (via ProPublica), annual reports, and USAspending (government grants). Calculate program efficiency ratio, revenue trends, compensation analysis, and funding source diversification." })

// Leadership Background — LinkedIn, ZoomInfo, public records
Task({ subagent_type: "ClaudeResearcher", prompt: "Research leadership and board of [organization] via LinkedIn, ZoomInfo, and public appointment records. Map executive backgrounds, board member affiliations, compensation (from 990 Part VII), and potential conflicts of interest." })

// Grant & Funding Sources — Foundation Directory, USAspending, donor disclosures
Task({ subagent_type: "PerplexityResearcher", prompt: "Map funding sources for [organization] via Foundation Directory (grants received), USAspending (government contracts), and published donor lists. Identify top funders, grant amounts, and any concerning funding patterns." })

// News & Reputation — GDELT, MediaCloud, Google News, Charity Navigator
Task({ subagent_type: "GeminiResearcher", prompt: "Analyze media coverage and reputation of [organization] via GDELT, MediaCloud, and Google News. Check Charity Navigator rating, BBB Wise Giving Alliance, and GuideStar seal status. Identify any controversies, criticism, or investigative reporting." })

// Legal & Compliance — PACER, CourtListener, OFAC, OIG
Task({ subagent_type: "GrokResearcher", prompt: "Search PACER and CourtListener for legal proceedings involving [organization]. Check OFAC sanctions list, OIG exclusion list, and state AG enforcement actions. Report any regulatory issues or compliance violations." })

// Digital Presence & Infrastructure — BuiltWith, SecurityTrails, crt.sh, Shodan
Task({ subagent_type: "GeminiResearcher", prompt: "Profile digital infrastructure of [organization] — website technology via BuiltWith, domain/DNS via SecurityTrails, subdomains via crt.sh, and exposed services via Shodan. Assess security posture and digital maturity." })

// Mission Impact & Program Assessment
Task({ subagent_type: "GrokResearcher", prompt: "Assess program impact and mission effectiveness of [organization]. Search for independent evaluations, program outcomes data, academic citations, and beneficiary testimonials. Compare stated mission against actual activities and spending." })
```

---

## Phase 8: Synthesis

**Legitimacy Assessment:**
- Registration status (active, in good standing)
- Tax-exempt verification
- Financial transparency (990 filed, audited financials available)
- Leadership credibility
- Program activity consistent with mission

**Funding Transparency:**
- Major funders identified
- Government grants documented
- Revenue vs. expenses trend
- Program efficiency (>75% to programs = good)
- Related-party transactions flagged

**Impact Evaluation:**
- Measurable program outcomes
- Independent evaluations or audits
- Beneficiary reach
- Community reputation

**Risk Indicators:**

| Risk Level | Indicators |
|-----------|------------|
| **Low** | Active registration, transparent 990s, strong ratings, diverse funding, established leadership |
| **Moderate** | Limited transparency, new organization, concentrated funding, high admin costs |
| **High** | Revoked status, regulatory actions, opaque finances, leadership turnover, mission creep |
| **Critical** | Sanctions match, fraud indicators, shell organization patterns, fictitious programs |

**Report Structure:**
1. Organization Profile (type, mission, jurisdiction)
2. Registration & Legal Status
3. Leadership Analysis
4. Financial Overview (5-year trend)
5. Funding Sources & Transparency
6. Program Impact Assessment
7. Digital Presence & Security
8. Reputation & Media Analysis
9. Risk Assessment
10. Recommendations

---

## Checklist

- [ ] Authorization verified
- [ ] Organization type classified
- [ ] Registration status verified
- [ ] IRS 990 / financial data analyzed
- [ ] Leadership backgrounds researched
- [ ] Funding sources mapped
- [ ] Digital presence profiled
- [ ] News/media coverage analyzed
- [ ] Sanctions/compliance checked
- [ ] Risk score assigned
- [ ] Report drafted

---

**Reference:** See `SOURCES.JSON` for the full source catalog.
