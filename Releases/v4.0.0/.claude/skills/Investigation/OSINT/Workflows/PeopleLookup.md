# People OSINT Lookup Workflow

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the PeopleLookup workflow in the OSINT skill to research individuals"}' \
  > /dev/null 2>&1 &
```

Running the **PeopleLookup** workflow in the **OSINT** skill to research individuals...

**Purpose:** Ethical open-source intelligence gathering on individuals for authorized professional contexts.

**Authorization Required:** Explicit authorization, defined scope, legal compliance confirmed.

---

## Phase 1: Authorization & Scope

**VERIFY BEFORE STARTING:**
- [ ] Explicit authorization from client or authorized party
- [ ] Clear scope definition (target person, information types, purpose)
- [ ] Legal compliance confirmed (FCRA, GDPR, CCPA, anti-stalking laws)
- [ ] Documented authorization in engagement paperwork

**STOP if any checkbox is unchecked.**

---

## Source Reference (from SOURCES.JSON)

Use these specific sources per investigation phase:

| Investigation Area | Sources |
|-------------------|---------|
| **Identity Resolution** | Pipl, Spokeo, BeenVerified, TruePeopleSearch, WhitePages, FastPeopleSearch, Radaris, OSINT Industries, That's Them |
| **Username Enumeration** | Sherlock, Maigret, WhatsMyName, Namechk, KnowEm, Blackbird |
| **Email Investigation** | Hunter.io, EmailRep, Epieos, GHunt, Holehe, h8mail, HIBP |
| **Phone Lookup** | PhoneInfoga, Truecaller, NumVerify |
| **Image/Face Search** | PimEyes, TinEye, Yandex Images, FaceCheck.ID |
| **Social Media** | Social Searcher, Osintgram, Snapchat Map |
| **Academic** | Google Scholar, ResearchGate, ORCID |
| **Public Records** | PACER, CourtListener, state voter registration |
| **Genealogy** | FamilySearch, Find A Grave, Ancestry |

---

## Phase 2: Identifier Collection

**Start with known identifiers:**
- Full legal name (and variations)
- Known aliases or nicknames
- Email addresses
- Phone numbers
- Physical addresses
- Social media handles
- Employer/organization

---

## Phase 3: Professional Intelligence

**LinkedIn and professional networks:**
- Current employer and title
- Employment history
- Education background
- Skills and endorsements
- Connections and recommendations
- Published articles/posts

**Company affiliations:**
- Corporate officer searches (OpenCorporates)
- Business registrations (Secretary of State)
- Patent searches (USPTO)
- Professional licenses

---

## Phase 4: Public Records (with authorization)

**Legal and regulatory:**
- Court records (PACER for federal, state court databases)
- Property records (county assessor)
- Business filings (Secretary of State)
- Professional licenses (state licensing boards)
- Voter registration (where public)

**Note:** Only access records appropriate for your authorization scope.

---

## Phase 5: Digital Footprint

**Domain and email:**
- Domain registrations (reverse whois)
- Email address variations
- PGP keys (key servers)
- Gravatar and similar services

**Social media:**
- Facebook, Twitter/X, Instagram, TikTok
- Reddit history (where public)
- Forum participation
- Blog authorship
- Published content

---

## Phase 6: Deploy Researcher Fleet

**Launch 8 researchers in parallel for comprehensive source-backed coverage:**

```typescript
// Identity Resolution — Pipl, Spokeo, BeenVerified, TruePeopleSearch, WhitePages, FastPeopleSearch, Radaris
Task({ subagent_type: "PerplexityResearcher", prompt: "Search Pipl, Spokeo, BeenVerified, TruePeopleSearch, WhitePages, FastPeopleSearch, and Radaris for identity records on [name]. Cross-reference addresses, phone numbers, and known associates." })

// Professional Background — LinkedIn, OpenCorporates, USPTO
Task({ subagent_type: "ClaudeResearcher", prompt: "Research [name] professional background via LinkedIn, OpenCorporates (corporate officer filings), and USPTO (patent searches). Map career history, business affiliations, and credentials." })

// Username & Email Enumeration — Sherlock, Maigret, WhatsMyName, Hunter.io, Epieos, Holehe, HIBP
Task({ subagent_type: "GeminiResearcher", prompt: "Enumerate usernames for [name] across Sherlock, Maigret, and WhatsMyName. Check email addresses via Hunter.io, Epieos, Holehe, and HIBP for breach exposure." })

// Social Media Deep Dive — Social Searcher, Osintgram, platform-specific searches
Task({ subagent_type: "PerplexityResearcher", prompt: "Map social media presence for [name] using Social Searcher. Check Facebook, Twitter/X, Instagram, TikTok, Reddit, and forums. Extract posts, connections, and activity patterns." })

// Public Records & Legal — PACER, CourtListener, state voter registration
Task({ subagent_type: "ClaudeResearcher", prompt: "Search PACER (federal courts) and CourtListener for legal records involving [name]. Check state voter registration records and property records via county assessor databases." })

// Image & Face Search — PimEyes, TinEye, Yandex Images, FaceCheck.ID
Task({ subagent_type: "GeminiResearcher", prompt: "Conduct reverse image searches for [name] using PimEyes, TinEye, Yandex Images, and FaceCheck.ID. Identify photo matches across platforms and verify identity consistency." })

// Academic & Publications — Google Scholar, ResearchGate, ORCID
Task({ subagent_type: "GrokResearcher", prompt: "Search Google Scholar, ResearchGate, and ORCID for academic publications by [name]. Verify claimed education credentials and research output." })

// Credential Verification & Cross-Reference
Task({ subagent_type: "GrokResearcher", prompt: "Verify all credentials and claims for [name] — education (university registries), certifications (issuing bodies), employment (company records). Flag any inconsistencies across sources." })
```

---

## Phase 7: Verification & Documentation

**Cross-reference findings:**
- Multiple sources for each claim
- Confidence levels assigned
- Contradictions investigated

**Report structure:**
- Executive summary
- Subject profile
- Verified information
- Unverified claims
- Sources consulted
- Methodology used

---

## Ethical Guardrails

**NEVER:**
- Pretexting or impersonation
- Accessing private accounts
- Purchasing data from illegal sources
- Social engineering contacts
- Violating privacy laws

**ALWAYS:**
- Document authorization
- Respect scope limits
- Archive with metadata
- Use ethical sources only

---

**Reference:** See `SOURCES.JSON` for the full source catalog. Legacy tool details in `PeopleTools.md`.
