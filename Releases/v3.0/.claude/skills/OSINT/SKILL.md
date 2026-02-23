---
name: OSINT
description: Open source intelligence gathering. USE WHEN OSINT, due diligence, background check, research person, company intel, investigate. SkillSearch('osint') for docs.
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/skills/PAI/USER/SKILLCUSTOMIZATIONS/OSINT/`

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
| People lookup | `Workflows/PeopleLookup.md` | `PeopleTools.md` |
| Company lookup | `Workflows/CompanyLookup.md` | `CompanyTools.md` |
| Investment due diligence | `Workflows/CompanyDueDiligence.md` | `CompanyTools.md` |
| Entity/threat intel | `Workflows/EntityLookup.md` | `EntityTools.md` |

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
- "investigate [domain]", "threat intelligence on [entity]", "is this domain malicious"
- "research this threat actor", "check [domain]", "analyze [entity]"
-> Route to `Workflows/EntityLookup.md`

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
| `EthicalFramework.md` | Authorization, legal, ethical boundaries |
| `Methodology.md` | Collection methods, verification, reporting |
| `PeopleTools.md` | People search, social media, public records |
| `CompanyTools.md` | Business databases, DNS, tech profiling |
| `EntityTools.md` | Threat intel, scanning, malware analysis, attack targeting patterns |

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
~/.claude/MEMORY/WORK/$(jq -r '.work_dir' ~/.claude/MEMORY/STATE/current-work.json)/scratch/YYYY-MM-DD-HHMMSS_osint-[target]/
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

**Version:** 2.0 (Canonical Structure)
**Last Updated:** December 2024
