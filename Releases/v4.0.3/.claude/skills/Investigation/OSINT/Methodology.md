# OSINT Methodology

## Core Principles

### 1. Intelligence Cycle

```
Planning -> Collection -> Processing -> Analysis -> Dissemination
    ^                                                    |
    +----------------------------------------------------+
```

**Planning:** Define objectives, scope, requirements
**Collection:** Gather raw data from sources
**Processing:** Organize and format collected data
**Analysis:** Extract meaning, identify patterns
**Dissemination:** Report findings to stakeholders

### 2. Source Hierarchy

**Tier 1 - Primary Sources:**
- Official registries (SEC, SoS, USPTO)
- Court records (PACER, state courts)
- Government databases
- Company official filings

**Tier 2 - Verified Secondary:**
- Established news outlets
- Academic publications
- Industry reports
- Professional databases (Crunchbase, LinkedIn)

**Tier 3 - Community/Social:**
- Social media profiles
- Forum discussions
- Review sites
- Crowdsourced data

**Tier 4 - Technical:**
- DNS records
- WHOIS data
- Certificate transparency
- Shodan/Censys

### 3. Multi-Source Verification

**Minimum verification thresholds:**
- Critical claims: 3+ independent sources
- Important claims: 2+ independent sources
- Supporting claims: 1+ verifiable source

**Independence criteria:**
- Different organizations
- Different collection methods
- Different time periods if applicable

---

## Collection Methodology

### Parallel Research Pattern

**Deploy multiple researcher agents simultaneously:**

```typescript
// Example: Company research fleet
Task({ subagent_type: "PerplexityResearcher", prompt: "Entity verification" })
Task({ subagent_type: "ClaudeResearcher", prompt: "Leadership backgrounds" })
Task({ subagent_type: "GeminiResearcher", prompt: "Competitive analysis" })
Task({ subagent_type: "GrokResearcher", prompt: "Risk assessment" })
```

**Benefits:**
- Faster collection
- Diverse perspectives
- Redundant coverage
- Cross-verification built-in

### Technical vs. Research Split

**Technical tools for:**
- DNS enumeration
- IP geolocation
- Certificate analysis
- Port scanning (authorized)
- WHOIS lookups

**Researcher agents for:**
- Business intelligence
- Reputation research
- Threat intelligence
- Historical analysis
- Verification

---

## Analysis Framework

### Confidence Levels

**HIGH (80-100%):**
- Multiple independent confirmations
- Official source verification
- Direct observation/access
- No contradicting evidence

**MEDIUM (50-79%):**
- Some supporting evidence
- Limited independent confirmation
- Credible but single source
- Minor contradictions explained

**LOW (20-49%):**
- Single unverified source
- Circumstantial evidence
- Significant gaps
- Some contradictions

**SPECULATIVE (<20%):**
- Inference only
- No direct evidence
- Conflicting information
- Pattern matching without confirmation

### Red Flag Classification

**CRITICAL (Investigation blocker):**
- Fraud indicators
- Regulatory violations
- Misrepresentation of material facts
- Criminal activity

**HIGH (Significant concern):**
- Missing registrations
- Unverifiable claims
- Transparency failures
- Past regulatory issues

**MEDIUM (Worth noting):**
- Minor discrepancies
- Limited online presence
- Industry concerns
- Competitive weaknesses

**LOW (Monitor only):**
- Minor gaps
- Normal business risks
- Industry-standard issues

---

## Domain-First Protocol

**For Company OSINT - Domain Discovery is BLOCKING:**

1. Execute ALL 7 enumeration techniques:
   - Certificate Transparency
   - DNS enumeration
   - Search engine discovery
   - Social media link extraction
   - Business registration website fields
   - WHOIS reverse lookups
   - Related TLD checking

2. Quality Gate: 95%+ confidence before proceeding

3. Categorize discovered domains:
   - Primary website
   - Investor portals
   - Marketing/campaign sites
   - Product portals
   - Email domains
   - Development/staging

4. Document gaps and confidence level

**Why this matters:**
Prevents intelligence gaps like missing investor-facing portals on alternative TLDs (.partners, .capital, .fund).

---

## Quality Gates

### Phase Transition Requirements

**Before moving to next phase:**
- [ ] All required techniques executed
- [ ] Confidence threshold met
- [ ] Gaps documented
- [ ] Red flags noted
- [ ] Verification complete

**If quality gate fails:**
1. Document gaps
2. Run additional collection
3. Re-assess confidence
4. Proceed only when threshold met
5. OR document limitations and proceed with caveats

---

## Reporting Standards

### Required Elements

1. **Executive Summary**
   - Key findings
   - Risk assessment
   - Recommendation

2. **Methodology**
   - Sources consulted
   - Tools used
   - Collection timeline
   - Limitations

3. **Findings by Category**
   - Business/entity information
   - Technical infrastructure
   - Reputation/media
   - Risk factors

4. **Confidence Assessment**
   - Per-finding confidence
   - Overall confidence
   - Information gaps

5. **Recommendations**
   - Next steps
   - Follow-up investigation
   - Mitigation actions

### Report Quality Checklist

- [ ] All claims sourced
- [ ] Confidence levels assigned
- [ ] Contradictions addressed
- [ ] Gaps acknowledged
- [ ] Methodology transparent
- [ ] Recommendations actionable

---

## File Organization

### Active Investigation

```
~/.claude/MEMORY/WORK/$(jq -r '.work_dir' ~/.claude/MEMORY/STATE/current-work.json)/YYYY-MM-DD-HHMMSS_osint-[target]/
  phase1-collection.md
  phase2-analysis.md
  phase3-report.md
  sources.md
  raw-data/
```

### Archived Reports

```
~/.claude/History/research/YYYY-MM/[target]-osint/
  README.md
  comprehensive-report.md
  executive-summary.md
  metadata.json
```

---

## Integration Points

### Skill Invocations

**OSINT automatically invokes:**
- **Research Skill** - For extensive multi-agent research
- **Recon Skill** - For technical reconnaissance (if available)

### Agent Fleet Sizes

- **Quick lookup:** 4-6 agents
- **Standard investigation:** 8-16 agents
- **Comprehensive due diligence:** 24-32 agents

### Timeout Management

- **Standard research:** 5 minutes
- **Extensive research:** 10 minutes
- **Proceed with whatever has returned**

---

**Version:** 1.0
**Last Updated:** December 2024
