---
name: Security
pack-id: danielmiessler-security-v1.0.0
version: 1.0.0
author: danielmiessler
description: Security assessment and intelligence — network reconnaissance, web app security testing, prompt injection testing, security news monitoring, and annual report analysis
type: skill
purpose-type: [security, reconnaissance, assessment, intelligence]
platform: claude-code
dependencies: []
keywords: [recon, pentest, prompt-injection, security-news, annual-reports, web-assessment, threat-model, OWASP, subdomain, port-scan, LLM-security]
---

# Security

> Unified security assessment and intelligence -- from network recon to web app testing to LLM prompt injection, with security news and annual report analysis built in.

---

## The Problem

Security work involves many distinct disciplines -- reconnaissance, web application testing, AI/LLM security, threat intelligence monitoring, and annual report analysis. Each discipline has its own tools, methodologies, and data sources. Practitioners end up:

- **Context-switching constantly** -- jumping between recon tools, web testing frameworks, and news feeds with no unified workflow
- **Reinventing methodology** -- writing the same enumeration steps, testing checklists, and analysis templates from scratch each engagement
- **Missing connections** -- not linking a recon finding to a web vulnerability to a known threat from a vendor report
- **Falling behind** -- security news and annual reports pile up unread because there is no structured way to consume them

The fundamental issue: security is a broad discipline, but tooling treats each sub-domain as isolated. There is no single skill that routes to the right methodology based on what you are doing.

---

## The Solution

The Security skill provides a unified router across five security sub-domains, each with its own workflows, tools, and data:

1. **Recon** -- Network reconnaissance with subdomain enumeration, port scanning, DNS/WHOIS/ASN lookups, CIDR/netblock analysis, endpoint discovery, mass scanning, passive recon, corporate structure mapping, and bounty program tracking
2. **WebAssessment** -- Full web application security testing with threat modeling, OWASP methodology, ffuf fuzzing, Playwright browser automation, bug bounty tooling, OSINT, and AI-assisted vulnerability analysis
3. **PromptInjection** -- LLM security testing with direct injection, indirect injection, multi-stage attacks, system prompt extraction, guardrail bypass techniques, and comprehensive assessment workflows
4. **SECUpdates** -- Security news aggregation from tldrsec, Krebs on Security, Schneier on Security, and other sources, ranked and categorized
5. **AnnualReports** -- Fetch, analyze, and synthesize annual security reports from major vendors to extract trends and compare threat landscapes year-over-year

The top-level SKILL.md routes requests to the correct sub-domain based on keyword matching. Each sub-domain has its own SKILL.md, workflows, tools, and supporting data.

---

## Installation

This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using `INSTALL.md`.

**What is PAI?** See the [PAI Project Overview](https://github.com/danielmiessler/Personal_AI_Infrastructure#what-is-pai).

---

## What's Included

| Component | Path | Purpose |
|-----------|------|---------|
| Skill router | `src/SKILL.md` | Top-level routing to sub-domains based on request pattern |
| Recon skill | `src/Recon/SKILL.md` | Network reconnaissance workflows and tool coordination |
| Recon tools | `src/Recon/Tools/` | 11 TypeScript tools: subdomain enum, port scan, DNS, WHOIS, CIDR, mass scan, endpoint discovery, path discovery, corporate structure, bounty programs, IPinfo client |
| Recon workflows | `src/Recon/Workflows/` | 7 workflows: domain recon, IP recon, netblock recon, passive recon, bounty programs, scan analysis, tool updates |
| Recon data | `src/Recon/Data/` | Bounty program database and LOTL binaries reference |
| WebAssessment skill | `src/WebAssessment/SKILL.md` | Web app security testing coordination |
| WebAssessment workflows | `src/WebAssessment/Workflows/` | Workflows for pentesting, ffuf fuzzing, OSINT, bug bounty, webapp testing, threat modeling, vulnerability analysis |
| WebAssessment tools | `src/WebAssessment/BugBountyTool/` | Bug bounty automation tool (TypeScript + shell) |
| WebAssessment resources | `src/WebAssessment/FfufResources/` | Request templates and wordlists for ffuf |
| WebAssessment OSINT | `src/WebAssessment/OsintTools/` | OSINT API tools, automation frameworks, network tools |
| WebAssessment scripts | `src/WebAssessment/WebappScripts/` | Playwright automation helpers |
| WebAssessment examples | `src/WebAssessment/WebappExamples/` | Example scripts for browser automation and static analysis |
| PromptInjection skill | `src/PromptInjection/SKILL.md` | LLM prompt injection testing coordination |
| PromptInjection workflows | `src/PromptInjection/Workflows/` | 5 workflows: complete assessment, direct injection, indirect injection, multi-stage attacks, reconnaissance |
| PromptInjection references | `src/PromptInjection/` | Attack taxonomy, defense mechanisms, app recon methodology, quick start guide, automated testing tools |
| SECUpdates skill | `src/SECUpdates/SKILL.md` | Security news aggregation and ranking |
| SECUpdates workflows | `src/SECUpdates/Workflows/` | Update workflow for fetching and ranking news |
| SECUpdates data | `src/SECUpdates/sources.json` | Configured news sources |
| SECUpdates state | `src/SECUpdates/State/` | Last-check timestamp tracking |
| AnnualReports skill | `src/AnnualReports/SKILL.md` | Annual report analysis coordination |
| AnnualReports tools | `src/AnnualReports/Tools/` | 3 TypeScript tools: fetch report, list sources, update sources |

**Summary:**
- **Sub-domains:** 5 (Recon, WebAssessment, PromptInjection, SECUpdates, AnnualReports)
- **Workflows:** 20+
- **Tools:** 15+ TypeScript/Python tools
- **Dependencies:** None (works standalone, enhanced by PAI infrastructure)

---

## What Makes This Different

This sounds similar to running individual security tools like nmap, ffuf, or Burp Suite. What makes this approach different?

The Security skill is not a replacement for those tools -- it is an orchestration layer that knows when to use each one and how to connect findings across disciplines. When you say "do recon on example.com," the skill routes to the Recon sub-domain which coordinates subdomain enumeration, DNS lookups, port scanning, and endpoint discovery into a single coherent workflow. When you say "test this chatbot for prompt injection," it routes to a structured assessment methodology with attack taxonomies, defense analysis, and reporting.

- Unified routing across five security disciplines from a single skill
- Each sub-domain has its own methodology, not just tool wrappers
- Findings from recon feed naturally into web assessment workflows
- Security news and annual reports provide current threat context
- AI-assisted analysis (Gemini integration) for vulnerability and scan result interpretation

---

## Invocation Scenarios

| Trigger | What Happens |
|---------|--------------|
| "do recon on example.com" | Routes to Recon -- runs domain recon workflow with subdomain enum, DNS, WHOIS, port scanning |
| "passive recon on 10.0.0.0/24" | Routes to Recon -- runs passive recon workflow for the CIDR range |
| "pentest this web app" | Routes to WebAssessment -- runs full pentest methodology with threat modeling and OWASP testing |
| "fuzz the API endpoints" | Routes to WebAssessment -- runs ffuf workflow with appropriate wordlists and request templates |
| "test this chatbot for prompt injection" | Routes to PromptInjection -- runs complete assessment with direct, indirect, and multi-stage attacks |
| "what's new in security?" | Routes to SECUpdates -- fetches and ranks recent security news from configured sources |
| "analyze the CrowdStrike annual report" | Routes to AnnualReports -- fetches report, extracts trends, produces threat intelligence summary |
| "create a threat model for this application" | Routes to WebAssessment -- runs threat model creation workflow |
| "check for bounty programs on example.com" | Routes to Recon -- queries bounty program database for the target |

---

## Example Usage

### Network Reconnaissance

```
User: do recon on example.com

AI responds:
Running the DomainRecon workflow in the Recon skill to enumerate example.com...

[Subdomain enumeration]
[DNS record lookups]
[WHOIS/ASN data]
[Port scan results]
[Endpoint discovery from JS files]
[Corporate structure mapping]

Summary: Found 47 subdomains, 12 open services, 3 ASNs...
```

### Prompt Injection Testing

```
User: test this chatbot at https://chat.example.com for prompt injection

AI responds:
Running the CompleteAssessment workflow in the PromptInjection skill...

[Application reconnaissance]
[Direct injection attempts]
[Indirect injection via context manipulation]
[Multi-stage attack chains]
[Defense mechanism analysis]

Report: 3 critical findings, 2 moderate, system prompt partially extractable...
```

### Security News

```
User: security updates

AI responds:
Running the Update workflow in the SECUpdates skill to check security news...

[Fetches from tldrsec, Krebs, Schneier, and other sources]
[Ranks by severity and relevance]
[Categorizes: vulnerabilities, breaches, research]

Top stories this week:
1. Critical RCE in widespread library (CVSS 9.8)
2. Major breach at financial institution
3. New research on LLM jailbreak techniques
```

---

## Configuration

No configuration required for basic functionality.

Optional configuration points:

| Configuration | Location | Purpose |
|--------------|----------|---------|
| News sources | `SECUpdates/sources.json` | Add or remove security news feeds |
| Bounty programs | `Recon/Data/BountyPrograms.json` | Update bounty program database |
| OSINT API keys | `WebAssessment/OsintTools/api-config-template.env` | Configure API keys for OSINT tools |
| Skill customizations | `~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/Security/` | Per-user preferences and overrides |

---

## Customization

### Recommended Customization

No customization needed -- the skill works as-is with sensible defaults across all five sub-domains.

### Optional Customization

| Customization | Location | Impact |
|--------------|----------|--------|
| Add news sources | `SECUpdates/sources.json` | Expands security news coverage |
| Update bounty database | `Recon/Data/BountyPrograms.json` | Keeps bounty program data current |
| Configure OSINT APIs | `WebAssessment/OsintTools/api-config-template.env` | Enables API-based OSINT tools (Shodan, Censys, etc.) |
| Add custom wordlists | `WebAssessment/FfufResources/WORDLISTS.md` | Extends ffuf fuzzing coverage |
| Add attack patterns | `PromptInjection/COMPREHENSIVE-ATTACK-TAXONOMY.md` | Extends prompt injection test coverage |

---

## Credits

- **Original concept:** Daniel Miessler -- developed as part of the [PAI](https://github.com/danielmiessler/Personal_AI_Infrastructure) system
- **Inspired by:** The need for unified security workflow orchestration across reconnaissance, web testing, AI security, and threat intelligence

---

## Related Work

- **PAI Algorithm** -- The structured workflow system that can coordinate multi-phase security engagements
- **PAI Thinking Skill** -- Analytical thinking modes (threat modeling, red teaming) that complement security assessment

---

## Works Well With

- **Thinking Pack** -- Red Team and World Threat Model modes provide adversarial analysis for security findings
- **Telos Pack** -- Project TELOS analysis can map security posture across organizational context

---

## Changelog

### 1.0.0 - 2026-03-15
- Initial release
- Five sub-domains: Recon, WebAssessment, PromptInjection, SECUpdates, AnnualReports
- Unified routing from top-level SKILL.md
- 20+ workflows across all sub-domains
- 15+ TypeScript/Python tools for reconnaissance, fuzzing, OSINT, and report analysis
- Bounty program tracking and corporate structure mapping
- AI-assisted vulnerability and scan result analysis
