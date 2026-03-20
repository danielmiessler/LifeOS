---
name: investigation
description: "OSINT and people-finding — structured investigations, company intel, due diligence, and ethical people search across public records and social media. USE WHEN OSINT, due diligence, company intel, background check, find person, locate, people search, reconnect, public records, reverse lookup, social media search, domain lookup, entity lookup, threat intel."
---

# Investigation

Routes OSINT and investigation requests to the appropriate sub-skill.

## Workflow Routing

| Request Pattern | Route To |
|---|---|
| OSINT, due diligence, company intel, background check, entity intel, threat intel | `OSINT/SKILL.md` |
| Find person, locate, people search, reconnect, public records, reverse lookup | `PrivateInvestigator/SKILL.md` |

## Examples

```
User: "do OSINT on Acme Corp"
--> Route to OSINT/SKILL.md

User: "run a background check on this company"
--> Route to OSINT/SKILL.md

User: "help me find an old colleague named John Smith"
--> Route to PrivateInvestigator/SKILL.md

User: "reverse lookup this phone number"
--> Route to PrivateInvestigator/SKILL.md
```
