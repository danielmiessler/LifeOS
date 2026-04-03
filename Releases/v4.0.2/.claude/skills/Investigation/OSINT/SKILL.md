---
name: OSINT
description: Structured OSINT investigations — people lookup, company intel, investment due diligence, entity/threat intel, domain recon, organization research using public sources with ethical authorization framework. USE WHEN OSINT, due diligence, background check, research person, company intel, investigate, company lookup, domain lookup, entity lookup, organization lookup, threat intel, discover OSINT sources.
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/OSINT/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.


## 🚨 MANDATORY: Voice Notification (REQUIRED BEFORE ANY ACTION)

**You MUST send this notification BEFORE doing anything else when this skill is invoked.**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:8888/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the WORKFLOWNAME workflow in the OSINT skill to ACTION"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running the **WorkflowName** workflow in the **OSINT** skill to ACTION...
   ```

**This is not optional. Execute this curl command immediately upon skill invocation.**

# OSINT Skill

Open Source Intelligence gathering for authorized investigations.

---


## Workflow Routing

| Investigation Type | Workflow | Context |
|-------------------|----------|---------|
| People lookup | `Workflows/PeopleLookup.md` | `SOURCES.JSON` |
| Company lookup | `Workflows/CompanyLookup.md` | `SOURCES.JSON` |
| Investment due diligence | `Workflows/CompanyDueDiligence.md` | `SOURCES.JSON` |
| Entity/threat intel | `Workflows/EntityLookup.md` | `SOURCES.JSON` |
| Domain/subdomain investigation | `Workflows/DomainLookup.md` | `SOURCES.JSON` |
| Organization/NGO/gov research | `Workflows/OrganizationLookup.md` | `SOURCES.JSON` |
| Discover new OSINT sources | `Workflows/DiscoverOSINTSources.md` | `SOURCES.JSON` |

---

## Trigger Patterns

**People OSINT:**
- "do OSINT on [person]", "research [person]", "background check on [person]"
- "who is [person]", "find info about [person]", "investigate this person"
-> Route to `Workflows/PeopleLookup.md`

**Company OSINT:**
- "do OSINT on [company]", "research [company]", "company intelligence"
- "what can you find about [company]", "investigate [company]"
-> Route to `Workflows/CompanyLookup.md`

**Investment Due Diligence:**
- "due diligence on [company]", "vet [company]", "is [company] legitimate"
- "assess [company]", "should we work with [company]"
-> Route to `Workflows/CompanyDueDiligence.md`

**Entity/Threat Intel:**
- "investigate [entity]", "threat intelligence on [entity]", "is this malicious"
- "research this threat actor", "analyze [entity]", "check this IP"
-> Route to `Workflows/EntityLookup.md`

**Domain/Subdomain Investigation:**
- "investigate domain", "check domain", "subdomain enumeration"
- "domain recon on [domain]", "what subdomains does [domain] have"
- "DNS investigation", "certificate transparency for [domain]"
-> Route to `Workflows/DomainLookup.md`

**Organization/NGO/Government:**
- "research organization", "investigate NGO", "research agency"
- "who is [organization]", "investigate [nonprofit]", "research [government agency]"
- "what do we know about [association]", "background on [institution]"
-> Route to `Workflows/OrganizationLookup.md`

---

## Authorization (REQUIRED)

**Before ANY investigation, verify:**
- [ ] Explicit authorization from client
- [ ] Clear scope definition
- [ ] Legal compliance confirmed
- [ ] Documentation in place

**STOP if any checkbox is unchecked.** See `EthicalFramework.md` for details.

---

## Resource Index

| File | Purpose |
|------|---------|
| `SOURCES.JSON` | Master catalog of 279 OSINT sources across 8 categories |
| `SOURCES.md` | Human-readable source reference with descriptions and access info |
| `EthicalFramework.md` | Authorization, legal, ethical boundaries |
| `Methodology.md` | Collection methods, verification, reporting |
| `PeopleTools.md` | People search, social media, public records (legacy — use SOURCES.JSON) |
| `CompanyTools.md` | Business databases, DNS, tech profiling (legacy — use SOURCES.JSON) |
| `EntityTools.md` | Threat intel, scanning, malware analysis (legacy — use SOURCES.JSON) |

---

## Integration

**Automatic skill invocations:**
- **Research Skill** - Parallel researcher agent deployment (REQUIRED)
- **Recon Skill** - Technical infrastructure reconnaissance

**Agent fleet patterns:**
- Quick lookup: 4-6 agents
- Standard investigation: 8-16 agents
- Comprehensive due diligence: 24-32 agents

**Researcher types:**
| Researcher | Best For |
|------------|----------|
| PerplexityResearcher | Current web data, social media, company updates |
| ClaudeResearcher | Academic depth, professional backgrounds |
| GeminiResearcher | Multi-perspective, cross-domain connections |
| GrokResearcher | Contrarian analysis, fact-checking |

---

## File Organization

**Active investigations:**
```
~/.claude/MEMORY/WORK/$(jq -r '.work_dir' ~/.claude/MEMORY/STATE/current-work.json)/YYYY-MM-DD-HHMMSS_osint-[target]/
```

**Archived reports:**
```
~/.claude/History/research/YYYY-MM/[target]-osint/
```

---

## Ethical Guardrails

**ALLOWED:** Public sources only - websites, social media, public records, search engines, archived content

**PROHIBITED:** Private data, unauthorized access, social engineering, purchasing breached data, ToS violations

See `EthicalFramework.md` for complete requirements.

---

**Version:** 3.0 (SOURCES.JSON Integration)
**Last Updated:** February 2026
