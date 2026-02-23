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

**Launch 6 researchers in parallel for comprehensive coverage:**

```typescript
// Professional Background (Perplexity)
Task({ subagent_type: "PerplexityResearcher", prompt: "Research [name] professional background, career history, and credentials" })

// Public Records (Claude)
Task({ subagent_type: "ClaudeResearcher", prompt: "Search public records for [name] including court records, business filings, property" })

// Digital Footprint (Gemini)
Task({ subagent_type: "GeminiResearcher", prompt: "Map digital footprint for [name] - domains, social media, online presence" })

// Credential Verification (Grok)
Task({ subagent_type: "GrokResearcher", prompt: "Verify credentials and claims for [name] - education, certifications, experience" })
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

**Reference:** See `PeopleTools.md` for tool details.
