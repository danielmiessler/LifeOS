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
- Entity registration verification
- Regulatory compliance checks
- Leadership background research
- Financial intelligence gathering

**Reputation & Market (8 agents):**
- Media coverage analysis (earned vs. paid)
- Customer testimonial assessment
- Competitive landscape mapping
- Market opportunity validation

**Verification (8 agents):**
- Claim verification (revenue, customers, partnerships)
- Credential verification (education, certifications)
- Cross-source confirmation

**Specialized (8 agents):**
- Industry recognition research
- Employee sentiment analysis
- Historical context
- IP and technology assessment

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
~/.claude/MEMORY/WORK/$(jq -r '.work_dir' ~/.claude/MEMORY/STATE/current-work.json)/scratch/YYYY-MM-DD-HHMMSS_due-diligence-[company]/
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

**Reference:** See `CompanyTools.md` for detailed tool specifications.
