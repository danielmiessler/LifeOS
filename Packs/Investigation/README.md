---
name: Investigation
pack-id: danielmiessler-investigation-v1.0.0
version: 1.0.0
author: danielmiessler
description: OSINT and people-finding -- structured investigations, company intel, due diligence, and ethical people search across public records and social media
type: skill
purpose-type: [osint, investigation, due-diligence, people-search, intelligence]
platform: claude-code
dependencies: []
keywords: [osint, investigation, due-diligence, company-intel, people-search, background-check, public-records, social-media, reverse-lookup, threat-intel, domain-recon]
---

# Investigation

> OSINT and people-finding -- structured investigations across public records, social media, and open sources with ethical authorization at every step.

---

## The Problem

Open source intelligence gathering is powerful but chaotic. People run ad-hoc Google searches, check a few social media platforms, and call it an investigation. The results are inconsistent, incomplete, and undocumented. When you need to research a person, vet a company, or investigate a domain, there is no systematic approach that ensures:

- **Comprehensive coverage** -- checking all relevant public sources, not just the ones you remember
- **Parallel execution** -- launching multiple research threads simultaneously instead of sequentially
- **Ethical boundaries** -- clear guardrails on what is and is not acceptable
- **Structured methodology** -- repeatable investigation patterns that produce consistent results
- **Source documentation** -- knowing where each finding came from and how reliable it is

The fundamental issue: good OSINT requires both breadth (many sources) and depth (thorough analysis), which is difficult to achieve without a structured system.

---

## The Solution

The Investigation skill provides two complete sub-skills for structured intelligence gathering:

**OSINT Sub-Skill** -- Structured investigations across 279 cataloged sources in 8 categories:
1. People lookup with cross-referenced public records
2. Company intelligence and competitive analysis
3. Investment due diligence with red flag detection
4. Entity and threat intelligence
5. Domain and subdomain reconnaissance
6. Organization, NGO, and government research
7. OSINT source discovery for new investigation domains

**PrivateInvestigator Sub-Skill** -- Ethical people-finding using parallel research agents:
1. Full person investigations with 15 parallel agents (45 search threads)
2. Cross-platform social media investigation
3. Public records search across government and official sources
4. Reverse lookups for phone, email, image, and username
5. Identity verification with confidence scoring

**Both sub-skills enforce an ethical authorization framework** -- explicit authorization, clear scope, legal compliance, and documentation are required before any investigation begins.

---

## Installation

This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using `INSTALL.md`.

**What is PAI?** See the [PAI Project Overview](https://github.com/danielmiessler/Personal_AI_Infrastructure#what-is-pai).

---

## What's Included

| Component | Path | Purpose |
|-----------|------|---------|
| Skill definition | `src/SKILL.md` | Top-level routing between OSINT and PrivateInvestigator |
| OSINT sub-skill | `src/OSINT/SKILL.md` | OSINT skill definition, workflow routing, source index |
| OSINT sources (JSON) | `src/OSINT/SOURCES.JSON` | Master catalog of 279 OSINT sources across 8 categories |
| OSINT sources (readable) | `src/OSINT/SOURCES.md` | Human-readable source reference with descriptions |
| Ethical framework | `src/OSINT/EthicalFramework.md` | Authorization, legal, and ethical boundaries |
| Methodology | `src/OSINT/Methodology.md` | Collection methods, verification, reporting standards |
| People tools | `src/OSINT/PeopleTools.md` | People search and social media tool reference |
| Company tools | `src/OSINT/CompanyTools.md` | Business database and tech profiling reference |
| Entity tools | `src/OSINT/EntityTools.md` | Threat intel, scanning, and malware analysis reference |
| People lookup workflow | `src/OSINT/Workflows/PeopleLookup.md` | People OSINT investigation workflow |
| Company lookup workflow | `src/OSINT/Workflows/CompanyLookup.md` | Company intelligence workflow |
| Due diligence workflow | `src/OSINT/Workflows/CompanyDueDiligence.md` | Investment due diligence workflow |
| Entity lookup workflow | `src/OSINT/Workflows/EntityLookup.md` | Entity and threat intel workflow |
| Domain lookup workflow | `src/OSINT/Workflows/DomainLookup.md` | Domain reconnaissance workflow |
| Organization lookup | `src/OSINT/Workflows/OrganizationLookup.md` | Organization, NGO, and government research workflow |
| Source discovery | `src/OSINT/Workflows/DiscoverOSINTSources.md` | Workflow for finding new OSINT sources |
| PI sub-skill | `src/PrivateInvestigator/SKILL.md` | People-finding skill definition and methodology |
| Find person workflow | `src/PrivateInvestigator/Workflows/FindPerson.md` | Full person investigation with parallel agents |
| Social media search | `src/PrivateInvestigator/Workflows/SocialMediaSearch.md` | Cross-platform social media investigation |
| Public records search | `src/PrivateInvestigator/Workflows/PublicRecordsSearch.md` | Government and official records search |
| Reverse lookup workflow | `src/PrivateInvestigator/Workflows/ReverseLookup.md` | Phone, email, image, and username reverse lookups |
| Identity verification | `src/PrivateInvestigator/Workflows/VerifyIdentity.md` | Multi-source identity confirmation |

**Summary:**
- **Directories:** 4 (OSINT, OSINT/Workflows, PrivateInvestigator, PrivateInvestigator/Workflows)
- **Files:** 22
- **Hooks registered:** 0
- **Dependencies:** None (enhanced by PAI Research skill for parallel agent deployment)

---

## What Makes This Different

This sounds similar to just Googling someone or a company, which also uses public sources. What makes this approach different?

The Investigation skill deploys structured workflows across 279 cataloged OSINT sources, not ad-hoc searches. A people investigation launches 15 parallel research agents executing 45 simultaneous search threads across people aggregators, social media, public records, and reverse lookup services. Each finding is cross-referenced and scored for confidence. The ethical framework requires explicit authorization before any investigation begins, with clear boundaries between what is and is not acceptable. Results are documented with source attribution, not just a pile of links.

- 279 cataloged OSINT sources across 8 categories, not whatever you remember to check
- Parallel agent deployment for simultaneous multi-source research
- Confidence scoring with multi-source verification
- Ethical authorization framework enforced at every step
- Structured workflows for 7 distinct investigation types
- Source documentation for every finding

---

## Invocation Scenarios

| Trigger | What Happens |
|---------|--------------|
| "do OSINT on [person]" | OSINT PeopleLookup workflow with parallel research agents |
| "company intel on [company]" | OSINT CompanyLookup workflow across business databases |
| "due diligence on [company]" | OSINT CompanyDueDiligence workflow with red flag analysis |
| "investigate this domain" | OSINT DomainLookup workflow with subdomain enumeration |
| "find [person], old college friend" | PrivateInvestigator FindPerson workflow with 15 parallel agents |
| "reverse phone lookup [number]" | PrivateInvestigator ReverseLookup workflow |
| "social media search for [person]" | PrivateInvestigator SocialMediaSearch with cross-platform correlation |
| "verify this is the right [person]" | PrivateInvestigator VerifyIdentity with confidence scoring |
| "research [organization/NGO]" | OSINT OrganizationLookup workflow |
| "threat intel on [entity]" | OSINT EntityLookup workflow |

The top-level SKILL.md routes between OSINT and PrivateInvestigator based on the request pattern.

---

## Example Usage

### Company Due Diligence

```
User: "due diligence on Acme Corp before we sign the contract"

AI verifies authorization, then:
  - Launches parallel research agents across business databases
  - Checks corporate filings, SEC records, news coverage
  - Analyzes leadership team backgrounds
  - Searches for lawsuits, regulatory actions, complaints
  - Cross-references financial health indicators
  - Produces structured report with risk assessment and red flags
  - Each finding includes source attribution and confidence level
```

### Finding a Lost Contact

```
User: "Help me find my college roommate John Smith from Austin, graduated 2005"

AI verifies ethical purpose, then:
  - Launches 15 parallel research agents (45 search threads)
  - People search aggregators: TruePeopleSearch, FastPeopleSearch, Spokeo
  - LinkedIn alumni search for university + graduation year
  - Google dorking: site:linkedin.com "John Smith" "Austin" "2005"
  - Property records in Austin area
  - Cross-references all findings for identity verification
  - Reports with confidence score: HIGH (3+ identifiers match)
```

### Domain Reconnaissance

```
User: "investigate the domain suspicious-site.com"

AI verifies authorization scope, then:
  - WHOIS lookup for registration details
  - DNS enumeration for subdomains
  - Certificate transparency logs
  - Web technology profiling
  - Historical snapshots from Wayback Machine
  - Reputation scoring across threat databases
  - Produces structured domain intelligence report
```

---

## Configuration

### Base Configuration

No configuration required. The skill works out of the box with its built-in source catalog and methodology.

### Source Catalog

The OSINT source catalog lives at `OSINT/SOURCES.JSON` inside the skill directory. It contains 279 sources organized into 8 categories:
- People search and social media
- Business and corporate intelligence
- Domain and infrastructure
- Threat intelligence
- Government and public records
- Academic and research
- Media and news
- Specialized databases

### User Customization

User customizations are stored separately and never overwritten by updates:

```
~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/OSINT/
~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/PrivateInvestigator/
```

---

## Customization

### Recommended Customization

No customization needed -- the skill works with comprehensive defaults.

### Optional Customization

| Customization | Location | Impact |
|--------------|----------|--------|
| OSINT preferences | `USER/SKILLCUSTOMIZATIONS/OSINT/PREFERENCES.md` | Default investigation depth, preferred sources |
| PI preferences | `USER/SKILLCUSTOMIZATIONS/PrivateInvestigator/PREFERENCES.md` | Default search patterns, agent count |
| Additional sources | `USER/SKILLCUSTOMIZATIONS/OSINT/SOURCES.json` | User-specific OSINT sources merged with base catalog |
| Ethical overrides | `USER/SKILLCUSTOMIZATIONS/OSINT/PREFERENCES.md` | Additional ethical constraints for your use case |

---

## Credits

- **Original concept:** Daniel Miessler -- developed as part of the [PAI](https://github.com/danielmiessler/Personal_AI_Infrastructure) system
- **Inspired by:** The need for structured, ethical OSINT methodology accessible to non-specialists

---

## Related Work

- **PAI Research Skill** -- Parallel researcher agent deployment used by Investigation workflows
- **PAI Agents Skill** -- Custom agent composition that powers the parallel investigation agents

---

## Works Well With

- **Agents Pack** -- Provides the agent composition engine used for parallel research deployment
- **ContentAnalysis Pack** -- Extract wisdom from investigation findings and reports
- **PAI Voice Infrastructure** -- Audio narration of investigation progress and findings

---

## Changelog

### 1.0.0 - 2026-03-15
- Initial release
- Two sub-skills: OSINT and PrivateInvestigator
- 279 cataloged OSINT sources across 8 categories
- Seven OSINT workflows: People, Company, Due Diligence, Entity, Domain, Organization, Source Discovery
- Five PrivateInvestigator workflows: FindPerson, SocialMediaSearch, PublicRecordsSearch, ReverseLookup, VerifyIdentity
- Ethical authorization framework enforced at every step
- Parallel agent deployment with 15 agents and 45 search threads
- Confidence scoring with multi-source verification
