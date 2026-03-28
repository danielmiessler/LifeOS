---
name: Investigation
description: OSINT and people-finding — structured investigations, company intel, due diligence, and ethical people search across public records and social media. USE WHEN OSINT, due diligence, company intel, background check, find person, locate, people search, reconnect, public records, reverse lookup, social media search, verify identity, domain lookup, entity lookup, organization lookup, company lookup, threat intel.
---

# Investigation

Unified skill for OSINT and people-finding investigations using Copilot CLI tools.

---

## Workflow Routing

| Request Pattern | Sub-skill |
|---|---|
| OSINT, due diligence, company intel, background check, entity intel, threat intel | [OSINT](#osint-skill) |
| Find person, locate, people search, reconnect, public records, reverse lookup | [PrivateInvestigator](#privateinvestigator-skill) |

---

## Tool Availability

| Capability | Tool Required | Notes |
|---|---|---|
| Web page fetching | `web_fetch` | Built-in — no setup needed |
| Google dorking / search results | `web_fetch` on search URLs | Works directly |
| People search aggregators | `web_fetch` | TruePeopleSearch, FastPeopleSearch, Spokeo (free tier) |
| Social media scraping | `web_fetch` | Public profiles only |
| DNS / WHOIS / cert transparency | `web_fetch` | crt.sh, ViewDNS, etc. |
| Deep web data enrichment | **Bright Data API key required** | Set `BRIGHT_DATA_API_KEY` env var |
| Paid people-search APIs | **Per-service API key required** | BeenVerified, Spokeo Pro, etc. |
| Reverse image search | `web_fetch` on TinEye/PimEyes | PimEyes advanced requires account |
| Shodan / Censys scanning | **Shodan/Censys API key required** | Set `SHODAN_API_KEY` / `CENSYS_API_KEY` |

---

---

# OSINT Skill

Open Source Intelligence gathering for authorized investigations.

## Authorization (REQUIRED)

**Before ANY investigation, verify all of the following with the user:**
- [ ] Explicit authorization from client/requester
- [ ] Clear scope definition
- [ ] Legal compliance confirmed
- [ ] Documentation in place

**STOP if any item is unconfirmed.** Do not proceed without authorization.

---

## Trigger Patterns → Workflow

**People OSINT:**
- "do OSINT on [person]", "research [person]", "background check on [person]"
- "who is [person]", "find info about [person]", "investigate this person"
→ Run [People Lookup workflow](#people-lookup-workflow)

**Company OSINT:**
- "do OSINT on [company]", "research [company]", "company intelligence"
- "what can you find about [company]", "investigate [company]"
→ Run [Company Lookup workflow](#company-lookup-workflow)

**Investment Due Diligence:**
- "due diligence on [company]", "vet [company]", "is [company] legitimate"
- "assess [company]", "should we work with [company]"
→ Run [Company Due Diligence workflow](#company-due-diligence-workflow)

**Entity/Threat Intel:**
- "investigate [entity]", "threat intelligence on [entity]", "is this malicious"
- "research this threat actor", "analyze [entity]", "check this IP"
→ Run [Entity Lookup workflow](#entity-lookup-workflow)

**Domain Investigation:**
- "investigate domain", "check domain", "subdomain enumeration"
- "domain recon on [domain]", "what subdomains does [domain] have"
- "DNS investigation", "certificate transparency for [domain]"
→ Run [Domain Lookup workflow](#domain-lookup-workflow)

**Organization/NGO/Government:**
- "research organization", "investigate NGO", "research agency"
- "who is [organization]", "investigate [nonprofit]", "research [government agency]"
→ Run [Organization Lookup workflow](#organization-lookup-workflow)

---

## Agent Fleet Pattern

For OSINT investigations, launch parallel `explore` agents via the `task` tool to maximize coverage.

| Investigation Scope | Agent Count | Mode |
|---|---|---|
| Quick lookup | 4–6 agents | `mode="background"` all in one turn |
| Standard investigation | 8–16 agents | `mode="background"` batched |
| Comprehensive due diligence | 24–32 agents | `mode="background"` batched |

**Launch pattern — always start all agents in a single turn:**
```
task(agent_type="explore", mode="background", name="linkedin-recon", prompt="...")
task(agent_type="explore", mode="background", name="domain-recon", prompt="...")
task(agent_type="explore", mode="background", name="news-search", prompt="...")
# ... all remaining agents launched simultaneously
```

After launching, use `read_agent(agent_id=..., wait=true)` to collect results, then synthesize.

---

## People Lookup Workflow

**Goal:** Build a comprehensive profile on an individual from public sources.

### Phase 1 — Foundation (parallel)
Launch agents for:
1. LinkedIn profile search: `web_fetch("https://www.google.com/search?q=site:linkedin.com+\"[NAME]\"")`
2. Google baseline: `web_fetch("https://www.google.com/search?q=\"[FULL NAME]\"+[LOCATION/EMPLOYER]")`
3. News mentions: `web_fetch("https://www.google.com/search?q=\"[NAME]\"+news")`
4. Social media: search Twitter/X, Facebook, Instagram via Google x-ray (`site:twitter.com`, `site:facebook.com`)

### Phase 2 — Public Records (parallel)
- **Voter registration:** State-specific portals
- **Property records:** County assessor search
- **Court records:** `web_fetch("https://www.courtlistener.com/?q=[NAME]")`, state court portals
- **Business filings:** `web_fetch("https://opencorporates.com/search?q=[NAME]")`
- **Professional licenses:** State licensing board portals

### Phase 3 — Correlation
Cross-reference findings across sources. Build timeline. Score confidence.

### Output Format
```
## Subject Profile: [NAME]

**Confidence:** HIGH / MEDIUM / LOW / POSSIBLE

### Identity
- Full name, DOB (if found), location history

### Professional
- Employment, LinkedIn, professional licenses

### Social Media
- Accounts discovered, handles, activity level

### Public Records
- Property, court, business, voter (if applicable)

### Key Findings
- Notable facts, inconsistencies, red flags

### Source Log
- URL | Data extracted | Date accessed
```

---

## Company Lookup Workflow

**Goal:** Comprehensive company profile from public sources.

### Sources to query (parallel agents)
1. **Official:** `web_fetch("https://[company].com")`, About page, Leadership page
2. **SEC filings:** `web_fetch("https://www.sec.gov/cgi-bin/browse-edgar?company=[NAME]&action=getcompany")`
3. **Business registrations:** `web_fetch("https://opencorporates.com/search?q=[COMPANY]")`
4. **News/press:** Google News search, `web_fetch("https://news.google.com/search?q=[COMPANY]")`
5. **LinkedIn company page:** x-ray search via Google
6. **Glassdoor/Indeed:** Employee reviews, size, culture signals
7. **Tech stack:** `web_fetch("https://builtwith.com/[domain]")`, `web_fetch("https://www.wappalyzer.com/lookup/[domain]/")`
8. **Domain info:** (see Domain Lookup workflow)
9. **Crunchbase:** `web_fetch("https://www.crunchbase.com/organization/[slug]")`
10. **OSINT sources:** FullContact, ZoomInfo public pages

### Output Format
```
## Company Profile: [NAME]

### Overview
- Founded, HQ, size, industry, structure (public/private)

### Leadership
- C-suite, board members with backgrounds

### Financial
- Revenue (if public), funding rounds, investors

### Operations
- Locations, subsidiaries, key clients (if known)

### Digital Footprint
- Domain, tech stack, social media presence

### Risk Indicators
- Legal actions, regulatory issues, news controversies

### Source Log
```

---

## Company Due Diligence Workflow

**Goal:** Assess legitimacy and risk for investment/partnership decisions.

### Full coverage — 24-32 parallel agents across:
1. All Company Lookup sources (above)
2. **Litigation:** PACER search, state court portals, CourtListener
3. **Regulatory:** SEC EDGAR enforcement, FINRA BrokerCheck, FTC/DOJ press releases
4. **Domain age/reputation:** `web_fetch("https://web.archive.org/web/*/[domain]")`
5. **Social proof:** BBB rating, Trustpilot, G2
6. **Leadership background:** Run People Lookup on each C-suite member
7. **Adverse media:** Google "[COMPANY] fraud", "[COMPANY] lawsuit", "[COMPANY] scam"
8. **Competitors/market position:** Industry directories, Crunchbase comparisons

### Due Diligence Scorecard
Rate each dimension: ✅ Positive | ⚠️ Caution | ❌ Red Flag | ❓ Unknown

```
| Dimension | Status | Notes |
|---|---|---|
| Legal standing | | |
| Leadership credibility | | |
| Financial transparency | | |
| Digital authenticity | | |
| Regulatory compliance | | |
| Adverse media | | |
| Customer/partner reputation | | |
```

---

## Entity Lookup Workflow

**Goal:** Threat intelligence on IPs, domains, email addresses, hashes, threat actors.

### IP/Domain Threat Intel (parallel)
- `web_fetch("https://www.virustotal.com/gui/ip-address/[IP]")`
- `web_fetch("https://www.abuseipdb.com/check/[IP]")`
- `web_fetch("https://www.shodan.io/host/[IP]")` *(requires Shodan API key for full data)*
- `web_fetch("https://urlscan.io/search/#[IP or domain]")`
- `web_fetch("https://otx.alienvault.com/api/v1/indicators/IPv4/[IP]/general")` *(OTX API)*
- Reverse DNS, ASN lookup: `web_fetch("https://bgp.he.net/[IP]")`

### Email Threat Intel
- `web_fetch("https://haveibeenpwned.com/api/v3/breachedaccount/[EMAIL]")` *(HIBP API key needed for full access)*
- `web_fetch("https://emailrep.io/[EMAIL]")` *(EmailRep API)*
- Epieos for social media account correlation (public lookup)

### File Hash Analysis
- `web_fetch("https://www.virustotal.com/api/v3/files/[HASH]")` *(VT API key for API; web UI accessible via web_fetch)*
- MalwareBazaar: `web_fetch("https://bazaar.abuse.ch/browse.php?search=sha256_hash:[HASH]")`

### Threat Actor Research
- Google: `"[actor name]" threat actor site:mitre.org OR site:mandiant.com OR site:crowdstrike.com`
- MITRE ATT&CK: `web_fetch("https://attack.mitre.org/groups/")`

---

## Domain Lookup Workflow

**Goal:** Full domain/subdomain reconnaissance using passive public sources.

### DNS & Registration (parallel)
- WHOIS: `web_fetch("https://www.whois.com/whois/[DOMAIN]")`
- DNS records: `web_fetch("https://viewdns.info/dnsrecord/?domain=[DOMAIN]")`
- DNS history: `web_fetch("https://viewdns.info/dnshistory/?domain=[DOMAIN]")`
- Reverse IP: `web_fetch("https://viewdns.info/reverseip/?host=[DOMAIN]")`

### Subdomain Enumeration (passive only)
- Certificate transparency: `web_fetch("https://crt.sh/?q=%25.[DOMAIN]&output=json")`
- `web_fetch("https://subdomainfinder.c99.nl/index.php?domain=[DOMAIN]")`
- Google: `site:[DOMAIN] -www` via `web_fetch("https://www.google.com/search?q=site:[DOMAIN]+-www")`

### Content & Tech
- `web_fetch("https://web.archive.org/web/*/[DOMAIN]/*")` — historical snapshots
- `web_fetch("https://builtwith.com/[DOMAIN]")` — technology stack
- `web_fetch("https://www.wappalyzer.com/lookup/[DOMAIN]/")` — tech profiling

### Reputation & Threat
- VirusTotal domain report: `web_fetch("https://www.virustotal.com/gui/domain/[DOMAIN]")`
- URLScan: `web_fetch("https://urlscan.io/search/#domain:[DOMAIN]")`

---

## Organization Lookup Workflow

**Goal:** Research NGOs, nonprofits, government agencies, associations.

### Sources (parallel)
1. **Nonprofits (US):** `web_fetch("https://www.guidestar.org/profile/[EIN-or-name]")` · ProPublica Nonprofit Explorer: `web_fetch("https://projects.propublica.org/nonprofits/search?q=[NAME]")`
2. **990 filings:** ProPublica, IRS Tax Exempt org search
3. **Government agencies:** Official .gov sites, USASpending.gov for contracts
4. **International:** `web_fetch("https://opencorporates.com/search?q=[NAME]")` · charity commission portals by country
5. **Leadership:** Annual reports (usually PDFs on official site), LinkedIn
6. **News:** Google News search for organization name + "scandal", "investigation", "controversy"

---

## Ethical Guardrails

### ALLOWED ✅
- Public websites, social media (public posts), search engines
- Public records (property, court, voter, business filings)
- Archived/cached content
- OSINT aggregators using public data

### PROHIBITED ❌
- Private data, data behind login walls without authorization
- Unauthorized system access
- Social engineering / pretexting
- Purchasing breached/leaked data
- Anything violating Terms of Service
- Stalking, harassment, intimidation

---

---

# PrivateInvestigator Skill

Ethical people-finding using parallel research across public records, social media, and reverse lookups. **Public data only. No pretexting.**

---

## When to Activate

| Trigger | Workflow |
|---|---|
| "find [person]", "locate [person]", "looking for lost contact" | [FindPerson](#findperson-workflow) |
| "social media search" | [SocialMediaSearch](#socialmediasearch-workflow) |
| "public records search" | [PublicRecordsSearch](#publicrecordssearch-workflow) |
| "reverse phone/email/image lookup" | [ReverseLookup](#reverselookup-workflow) |
| "verify identity", "confirm this is the right person" | [VerifyIdentity](#verifyidentity-workflow) |

---

## Research Strategy

**Every investigation uses parallel `explore` agents launched simultaneously in one turn.**

Recommended fleet: **15 agents** covering:
- 3 agents: People search aggregators + professional records
- 3 agents: Social media deep search (LinkedIn, Facebook, Twitter/X, Instagram)
- 3 agents: Public records (court, property, voter, business)
- 3 agents: Google dorking (multiple operator combinations)
- 3 agents: Reverse lookups on any identifiers found

Each agent runs 3 targeted searches = **45 search threads** per investigation.

**Launch all agents in a SINGLE turn:**
```
task(agent_type="explore", mode="background", name="people-search", prompt="Search TruePeopleSearch and FastPeopleSearch for [NAME] in [LOCATION]...")
task(agent_type="explore", mode="background", name="linkedin-search", prompt="Google x-ray search LinkedIn for [NAME]...")
# ... all 15 agents at once
```

---

## Information Hierarchy

**Tier 1 — Foundation Data (collect first)**
- Full name and variations (maiden name, nicknames)
- Approximate age or date of birth
- Last known location
- Context (school, workplace, relationship to requester)

**Tier 2 — Primary Research (parallel agents)**
- People search aggregators
- Social media presence scan
- Google dorking

**Tier 3 — Deep Investigation (parallel agents)**
- Public records (property, court, voter, business)
- Reverse lookups on discovered phone/email/username
- Cross-platform correlation

**Tier 4 — Verification**
- Multi-source confirmation
- Timeline consistency check
- Photo verification (reverse image search)
- Confidence scoring

---

## FindPerson Workflow

**Sources to query simultaneously:**

### People Search Aggregators
- `web_fetch("https://www.truepeoplesearch.com/results?name=[NAME]&citystatezip=[LOCATION]")`
- `web_fetch("https://www.fastpeoplesearch.com/name/[NAME]_[CITY]-[STATE]")`
- `web_fetch("https://www.spokeo.com/search?q=[NAME]")`
- Google: `"[FULL NAME]" "[CITY]" site:truepeoplesearch.com OR site:fastpeoplesearch.com`

### Social Media (Google x-ray)
```
site:linkedin.com "[NAME]" "[CITY OR EMPLOYER]"
site:facebook.com "[NAME]" "lives in" "[CITY]"
site:twitter.com "[NAME]" "[CONTEXT]"
site:instagram.com "[NAME]"
```

### Google Dorking Patterns
```
"[NAME]" "[CITY]" "[EMPLOYER OR SCHOOL]"
"[NAME]" "[APPROXIMATE YEAR]" "[CONTEXT]"
filetype:pdf "[NAME]" resume OR CV
"[NAME]" "[MAIDEN NAME IF KNOWN]"
```

### Public Records
- Property: County assessor website for last known location state
- Court: `web_fetch("https://www.courtlistener.com/?q=[NAME]&type=p")`
- Business: `web_fetch("https://opencorporates.com/search?q=[NAME]&search[officers]=true")`
- Voter: State-specific portals (varies by state)

---

## SocialMediaSearch Workflow

**Cross-platform sweep:**

1. **LinkedIn:** `web_fetch("https://www.google.com/search?q=site:linkedin.com+\"[NAME]\"+\"[TITLE OR LOCATION]\"")`
2. **Facebook:** `web_fetch("https://www.google.com/search?q=site:facebook.com+\"[NAME]\"+\"[CITY]\"")`
3. **Twitter/X:** `web_fetch("https://www.google.com/search?q=site:twitter.com+\"[NAME]\"")`  · also try `web_fetch("https://nitter.poast.org/search?q=[NAME]")`
4. **Instagram:** Google x-ray: `site:instagram.com "[NAME]"`
5. **TikTok:** `web_fetch("https://www.tiktok.com/search/user?q=[NAME]")`
6. **YouTube:** `web_fetch("https://www.youtube.com/results?search_query=[NAME]")`
7. **GitHub (technical profiles):** `web_fetch("https://github.com/search?q=[NAME]&type=users")`

**Username enumeration** (once a handle is found):
- WhatsMyName: `web_fetch("https://whatsmyname.app/")` — check manually with discovered username
- Namechk: `web_fetch("https://namechk.com/[USERNAME]")`

---

## PublicRecordsSearch Workflow

| Record Type | Source |
|---|---|
| Federal court records | `web_fetch("https://www.courtlistener.com/?q=[NAME]")` |
| State court records | State-specific portals (Google: `[STATE] court records search "[NAME]"`) |
| Property / real estate | County assessor/recorder (Google: `[COUNTY] county assessor property search`) |
| Voter registration | State-specific (varies — many states have online lookups) |
| Business filings / registered agent | `web_fetch("https://opencorporates.com/search?q=[NAME]&search[officers]=true")` |
| Professional licenses | `web_fetch("https://www.google.com/search?q=[STATE]+professional+license+lookup+\"[NAME]\"")` |
| Sex offender registry | `web_fetch("https://www.nsopw.gov/en/Search/Verify?FullName=[NAME]")` |
| Death records | `web_fetch("https://www.ssdi.info/")` |
| Obituaries | `web_fetch("https://www.google.com/search?q=\"[NAME]\"+obituary+\"[CITY OR STATE]\"")` |

---

## ReverseLookup Workflow

### Phone Lookup
- `web_fetch("https://www.truecaller.com/search/us/[PHONE]")` *(account required for full data)*
- `web_fetch("https://www.numlookup.com/[PHONE]")`
- `web_fetch("https://www.google.com/search?q=\"[PHONE]\"")`  — Google the number directly
- Carrier lookup: `web_fetch("https://www.carrierlookup.com/")`

### Email Lookup
- `web_fetch("https://epieos.com/?q=[EMAIL]&t=email")` — social media accounts linked to email
- Hunter.io domain search (requires API key): `web_fetch("https://api.hunter.io/v2/email-finder?...&api_key=[KEY]")`
- Google: `"[EMAIL]"` — direct search often surfaces profiles and forum posts

### Image Reverse Search
- `web_fetch("https://www.tineye.com/")` — upload or URL
- Google Images: `https://lens.google.com/uploadbyurl?url=[IMAGE_URL]`
- Yandex Images (often superior for faces): `https://yandex.com/images/search?url=[IMAGE_URL]&rpt=imageview`
- **PimEyes** (face search): `https://pimeyes.com/` *(advanced features require account)*

### Username Lookup
- `web_fetch("https://whatsmyname.app/")` — paste username, check results
- `web_fetch("https://namechk.com/[USERNAME]")`
- Google: `"[USERNAME]"` across platforms

---

## VerifyIdentity Workflow

**Goal:** Confirm that discovered subject matches the intended target.

### Verification Checklist
- [ ] Full name matches (including any maiden/alternate names)
- [ ] Age/DOB consistent across sources
- [ ] Location history plausible
- [ ] Photo matches (if available) — use reverse image search
- [ ] Known associates/family members consistent with context
- [ ] Employment/education history consistent
- [ ] Timeline is internally consistent (no impossible overlaps)

### Confidence Scoring

| Level | Criteria | Action |
|---|---|---|
| **HIGH** | 3+ unique identifiers match across independent sources | Safe to act on |
| **MEDIUM** | 2 identifiers match, timeline consistent | Verify before contact |
| **LOW** | Single source or name-only match | Needs more investigation |
| **POSSIBLE** | Partial match only | Do not act without more data |

### Dealing with Common Names
1. **Add specificity** — location, age range, employer, school
2. **Cross-reference DOB + address patterns** across sources
3. **Verify through family connections** — known relatives as anchors
4. **Timeline analysis** — does the life history make logical sense?
5. **Require 3+ matching data points** before HIGH confidence

---

## Legal & Ethical Boundaries

### GREEN ZONE ✅
- Search public records (property, court, voter, business)
- Access publicly posted social media content
- Use people search aggregator sites
- Perform reverse lookups on public data
- Google dorking with public search operators

### RED ZONE ❌
- Access data behind login walls without authorization
- Bypass authentication or security measures
- Use pretexting or impersonation
- Access private databases (credit, financial, medical)
- Stalk, harass, or intimidate subjects
- Use PI-only databases without a license

### When to STOP Immediately
- If the purpose shifts to harassment or stalking
- If the subject has clearly opted out of contact
- If investigation requires illegal methods
- If you suspect the requester has malicious intent

---

## Example Investigations

**Finding an old college friend:**
```
Input: "Help me find my college roommate from 2005, John Smith, last known in Austin TX"
→ Tier 1: Launch 15 parallel agents
→ Tier 2: People search aggregators + LinkedIn alumni + Google dorking
→ Tier 3: Property records in Austin area + court records check
→ Tier 4: Cross-reference findings, timeline check, confidence score
→ Output: Profile with HIGH confidence, source log
```

**Reverse phone lookup:**
```
Input: "Who called me from 512-555-1234?"
→ NumLookup + CallerID Google search + TruePeopleSearch
→ Cross-reference discovered name with people search aggregators
→ Output: Name, location, carrier, confidence level
```

**Social media investigation:**
```
Input: "Find Jane Doe's social media — she's a marketing professional in Denver"
→ LinkedIn Boolean + Google x-ray on Facebook/Instagram/Twitter
→ Username enumeration once handle discovered
→ Output: All accounts found with MEDIUM/HIGH confidence
```

---

*Ported from PAI PrivateInvestigator v3.0 + OSINT v3.0 (SOURCES.JSON Integration) — February 2026*
*Adapted for GitHub Copilot CLI: Task tool replaced with `task(agent_type="explore", mode="background")`, voice notifications removed, `{PRINCIPAL.NAME}` → "the user", Claude Code-specific APIs removed.*
