---
name: pai-private-investigator
description: "Ethical OSINT investigation framework. Spawns 15 parallel research agents with 45 concurrent threads for public records, social media, reverse lookups, domain intelligence, and data correlation."
version: 5.0.0
author: PAI v5 Hermes Port
use_when: "You need to conduct ethical open-source intelligence gathering — researching a person, company, domain, or topic across multiple public data sources simultaneously with parallel agents."
not_for: "Illegal surveillance; doxxing; accessing private/protected data without authorization; any use that violates platform ToS for automated scraping."
tags: [osint, investigation, research, public-records, parallel, social-media]
---

# pai-private-investigator: Ethical OSINT

## Workflow Routing

| Trigger | Route |
|---------|-------|
| User provides a person's name | 15 parallel agents → compile dossier → report |
| User provides a domain/URL | Domain intelligence agents → WHOIS/DNS/history → report |
| User provides an email | Email reverse lookup agents → linked accounts → report |
| User provides a username | Social media cross-platform search → profile aggregation |
| User provides a phone number | Number lookup → carrier/location/links → report |
| User provides a company name | Business search → registration/people/domain → report |

## Agent Architecture (15 Parallel Research Agents)

### Agent Pool

| # | Agent Name | Threads | Data Sources |
|---|-----------|---------|--------------|
| 1 | Social Hunter | 4 | Twitter/X, Reddit, LinkedIn, Facebook (public) |
| 2 | Web Explorer | 4 | Google, Bing, DuckDuckGo, Yandex |
| 3 | News Miner | 4 | Google News, NewsAPI, Reuters, AP |
| 4 | Code Searcher | 3 | GitHub, GitLab, SourceForge, Bitbucket |
| 5 | Domain Intel | 3 | WHOIS, DNS records, SSL certs, Wayback Machine |
| 6 | Email Recon | 3 | HaveIBeenPwned (public), email format search |
| 7 | Username Tracker | 3 | CheckUsernames, KnowEm, social platforms |
| 8 | Public Records | 3 | USA.gov, court records (public), business registries |
| 9 | Academic Searcher | 3 | Google Scholar, arXiv, Semantic Scholar |
| 10 | Image Finder | 3 | Google Images, Bing Images, reverse image search |
| 11 | Geolocator | 3 | OpenStreetMap, geocoding APIs, place databases |
| 12 | Company Researcher | 3 | OpenCorporates, Dunn & Bradstreet, SEC EDGAR |
| 13 | Dark Patterns Detector | 3 | Terms of service, privacy policies, trust reports |
| 14 | Content Archiver | 3 | Archive.org, cached pages, screenshot captures |
| 15 | Correlation Engine | 4 | Cross-references all agent outputs, finds connections |

Total: 45 concurrent threads across 15 agents

## Step-by-Step Procedures

### 1. Define Investigation Target
```
1. Accept target type from user:
   a. Person: full name, known aliases, location hints
   b. Domain: URL, IP address
   c. Email: full email address
   d. Username: single username
   e. Phone: full number with country code
   f. Company: legal name, DBA, registration number
2. Build target profile with all known identifiers
3. Determine scope: surface, deep, or comprehensive
```

### 2. Deploy Parallel Agents
```
1. Identify which agents are relevant for target type:
   - Person → All agents except Company Researcher, Geolocator (if no location)
   - Domain → Domain Intel, Web Explorer, Code Searcher, Content Archiver
   - Email → Email Recon, Social Hunter, Web Explorer
   - Username → Username Tracker, Social Hunter, Code Searcher
   - Phone → Email Recon, Geolocator, Social Hunter
   - Company → Company Researcher, Web Explorer, Domain Intel, News Miner
2. Deploy each relevant agent:
   a. Each agent spawns its thread pool (3-4 threads)
   b. Threads execute web_search() with targeted queries
   c. Each thread returns structured findings
   d. Threads complete independently (non-blocking between agents)
3. Collect results as they arrive (streaming)
```

### 3. Correlation & Synthesis
```
1. Correlation Engine (#15) processes all agent outputs:
   a. Entity extraction: names, emails, usernames, domains, addresses
   b. Cross-reference: "email X appears with username Y on domain Z"
   c. Relationship mapping: "Person A connected to Company B via LinkedIn"
   d. Timeline construction: chronological activity across sources
2. Grade confidence for each finding:
   - Verified: multiple independent sources confirm
   - Likely: single credible source
   - Speculative: inference from partial data
3. Build entity-relationship graph
```

### 4. Report Generation
```
1. Executive summary: key findings, confidence levels
2. Entity dossier (per identified entity):
   - Known identifiers
   - Associated accounts/domains
   - Public history timeline
   - Relationships to other entities
3. Source appendix: all URLs and sources consulted
4. Confidence ratings for major claims
5. Ethical compliance note: all sources are public, no ToS violations
6. Recommended follow-up investigation areas
```

### 5. Ethical Guardrails
```
1. Before each investigation, verify:
   a. Target is public figure/entity OR user has legitimate interest
   b. All sources are publicly accessible (no logins, no scraping violations)
   c. No data will be used for harassment, stalking, or discrimination
2. During investigation:
   a. Respect robots.txt where applicable
   b. Rate limit requests to avoid overwhelming sources
   c. Do not attempt to access non-public/protected data
3. In report:
   a. Flag any sensitive findings requiring expert legal review
   b. Include disclaimer about information accuracy
   c. Recommend deletion of report if not legally needed
```

## Gotchas

- Not all 15 agents will produce results for every target; this is expected
- OSINT is probabilistic — always verify critical findings through multiple sources
- Rate limiting is aggressive on some platforms; agents handle retries
- Social media searches require public profiles; private profiles are out of scope
- Reverse image search may return no results for unique/private images
- Some public records databases are incomplete or out of date
- Correlation Engine may produce false positives; human review needed
- WHOIS data may be hidden behind privacy services
- Wayback Machine may not have all snapshots
- Always include ethical compliance statement in every report

## Execution Log Pattern

```
[PAI-INVESTIGATOR] Target: "Jane Doe" (Person)
[AGENTS] Deploying 12 relevant agents (36 threads)
[SOCIAL] Twitter found: @janedoe (1200 followers, public)
[WEB] Blog found: janedoe.dev (3 articles, last updated 2025)
[CODE] GitHub: github.com/janedoe (42 repos, last commit 2mo ago)
[EMAIL] Email found: jane@example.com (from GitHub commits)
[CORRELATION] Linking @janedoe ← → jane@example.com ← → janedoe.dev
[DOSSIER] Compiled: 4 identifiers, 3 accounts, 2 domains, 5 relationships
[ETHICS] All sources public. Rate limits respected. Compliance: OK
[COMPLETE] Investigation completed in 14.7s (12/12 agents reported)
```
