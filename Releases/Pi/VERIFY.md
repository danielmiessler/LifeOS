# VERIFY — PAI on Pi v5.0.0 (Pi-mono)

> Use this guide to verify that all 27 skill packs installed correctly and work as expected.
> Each pack has a table of checks. Run the commands or procedures and confirm the expected result.

**Prerequisite:** Pi must be installed (`npm install -g @mariozechner/pi-coding-agent`) and the scaffold copied to `~/.config/PAI-pi/` as described in [INSTALL.md](INSTALL.md).

---

## Table of Contents

| # | Pack | Description |
|---|------|-------------|
| 1 | [algorithm](#1-algorithm) | 7-phase structured problem solving |
| 2 | [agents](#2-agents) | Agent composition and team coordination |
| 3 | [api-scraping](#3-api-scraping) | Web scraping and API integration |
| 4 | [architecture](#4-architecture) | System architecture analysis |
| 5 | [automation](#5-automation) | Recurring job patterns |
| 6 | [content-analysis](#6-content-analysis) | Content extraction and analysis |
| 7 | [creative-generation](#7-creative-generation) | Content creation (writing, art, music) |
| 8 | [data-analysis](#8-data-analysis) | Data processing and statistics |
| 9 | [debugging](#9-debugging) | Root cause analysis |
| 10 | [documentation](#10-documentation) | README, API docs, changelogs |
| 11 | [interview](#11-interview) | Conversational onboarding |
| 12 | [investigation](#12-investigation) | OSINT and entity research |
| 13 | [isa](#13-isa) | Ideal State Artifact generation |
| 14 | [knowledge](#14-knowledge) | Typed knowledge graph management |
| 15 | [learning](#15-learning) | Cross-session learning compounding |
| 16 | [media](#16-media) | Diagrams, images, infographics |
| 17 | [observability](#17-observability) | Monitoring and cost tracking |
| 18 | [privacy-security](#18-privacy-security) | PII detection and secret scanning |
| 19 | [prompting](#19-prompting) | Meta-prompting and optimization |
| 20 | [research](#20-research) | Multi-mode research methodology |
| 21 | [scraping](#21-scraping) | Progressive web scraping |
| 22 | [security](#22-security) | Security assessment frameworks |
| 23 | [synthesis](#23-synthesis) | Research synthesis and reporting |
| 24 | [telos](#24-telos) | Life OS — goals, projects, wisdom |
| 25 | [thinking](#25-thinking) | Thinking frameworks (first principles, council, etc.) |
| 26 | [upgrade](#26-upgrade) | Self-assessment and migration planning |
| 27 | [voice](#27-voice) | TTS integration and notifications |

---

## 1. algorithm

| Check | Command/Procedure | Expected Result |
|-------|-------------------|-----------------|
| SKILL.md exists | `ls ~/.config/PAI-pi/skills/algorithm/SKILL.md` | File exists and is readable |
| Frontmatter valid | `head -5 ~/.config/PAI-pi/skills/algorithm/SKILL.md` | YAML frontmatter: name, description, version |
| Name field correct | `grep "^name:" ~/.config/PAI-pi/skills/algorithm/SKILL.md` | `name: algorithm` |
| Description loads | `grep "description:" ~/.config/PAI-pi/skills/algorithm/SKILL.md \| head -1` | Mentions "7-phase" and "structured problem solving" |
| Section content | `grep "## 7 Phases" ~/.config/PAI-pi/skills/algorithm/SKILL.md` | Section header present |
| Effort tiers present | `grep "Effort Tiers" ~/.config/PAI-pi/skills/algorithm/SKILL.md` | Section exists |

## 2. agents

| Check | Command/Procedure | Expected Result |
|-------|-------------------|-----------------|
| SKILL.md exists | `ls ~/.config/PAI-pi/skills/agents/SKILL.md` | File exists |
| Frontmatter valid | `head -5 ~/.config/PAI-pi/skills/agents/SKILL.md` | YAML frontmatter with name, description |
| Name correct | `grep "^name:" ~/.config/PAI-pi/skills/agents/SKILL.md` | `name: agents` |
| Base traits listed | `grep "Base Trait" ~/.config/PAI-pi/skills/agents/SKILL.md` | Section mentions base traits (Engineer, Architect, etc.) |
| Team coordination described | `grep "Team Coordination" ~/.config/PAI-pi/skills/agents/SKILL.md` | Section header present |

## 3. api-scraping

| Check | Command/Procedure | Expected Result |
|-------|-------------------|-----------------|
| SKILL.md exists | `ls ~/.config/PAI-pi/skills/api-scraping/SKILL.md` | File exists |
| Name correct | `grep "^name:" ~/.config/PAI-pi/skills/api-scraping/SKILL.md` | `name: api-scraping` |
| REST API patterns | `grep "REST API" ~/.config/PAI-pi/skills/api-scraping/SKILL.md` | Section present with auth, pagination, rate limiting |
| Data formats table | `grep "Format" ~/.config/PAI-pi/skills/api-scraping/SKILL.md` | Table with JSON, HTML, XML, CSV, YAML |
| Workflow steps | `grep "1. \\*\\*Discover" ~/.config/PAI-pi/skills/api-scraping/SKILL.md` | Workflow numbered 1-6 |

## 4. architecture

| Check | Command/Procedure | Expected Result |
|-------|-------------------|-----------------|
| SKILL.md exists | `ls ~/.config/PAI-pi/skills/architecture/SKILL.md` | File exists |
| Name correct | `grep "^name:" ~/.config/PAI-pi/skills/architecture/SKILL.md` | `name: architecture` |
| Analysis dimensions | `grep "Dimensions" ~/.config/PAI-pi/skills/architecture/SKILL.md` | Lists 6 dimensions including Components, Dependencies, Data Flow |
| ADR format | `grep "ADR Format" ~/.config/PAI-pi/skills/architecture/SKILL.md` | ADR template with Context, Decision, Consequences |
| Circular dep warning | `grep "circular" ~/.config/PAI-pi/skills/architecture/SKILL.md` | Flags circular dependencies as design smells |

## 5. automation

| Check | Command/Procedure | Expected Result |
|-------|-------------------|-----------------|
| SKILL.md exists | `ls ~/.config/PAI-pi/skills/automation/SKILL.md` | File exists |
| Name correct | `grep "^name:" ~/.config/PAI-pi/skills/automation/SKILL.md` | `name: automation` |
| Job patterns table | `grep "Pattern" ~/.config/PAI-pi/skills/automation/SKILL.md` | Table with Cron, Poll, Event, Chain, Idempotent |
| Scheduling rules | `grep "Cron expression" ~/.config/PAI-pi/skills/automation/SKILL.md` | Cron expression format documented |
| Design principles | `grep "Idempotency first" ~/.config/PAI-pi/skills/automation/SKILL.md` | Idempotency principle present |

## 6. content-analysis

| Check | Command/Procedure | Expected Result |
|-------|-------------------|-----------------|
| SKILL.md exists | `ls ~/.config/PAI-pi/skills/content-analysis/SKILL.md` | File exists |
| Name correct | `grep "^name:" ~/.config/PAI-pi/skills/content-analysis/SKILL.md` | `name: content-analysis` |
| Extraction framework | `grep "Key Ideas" ~/.config/PAI-pi/skills/content-analysis/SKILL.md` | Lists 8 extraction sections (Summary through Action Items) |
| Output format | `grep "## Content Analysis" ~/.config/PAI-pi/skills/content-analysis/SKILL.md` | Output template present |

## 7. creative-generation

| Check | Command/Procedure | Expected Result |
|-------|-------------------|-----------------|
| SKILL.md exists | `ls ~/.config/PAI-pi/skills/creative-generation/SKILL.md` | File exists |
| Name correct | `grep "^name:" ~/.config/PAI-pi/skills/creative-generation/SKILL.md` | `name: creative-generation` |
| Writing domain | `grep "### Writing" ~/.config/PAI-pi/skills/creative-generation/SKILL.md` | Writing section with Structure, Voice, Drafting |
| Visual art section | `grep "Visual Art" ~/.config/PAI-pi/skills/creative-generation/SKILL.md` | Visual art and design section present |
| Iterative refinement loop | `grep "Iterative Refinement" ~/.config/PAI-pi/skills/creative-generation/SKILL.md` | 5-step loop: Generate → Review → Identify → Revise → Repeat |
| Quality checks | `grep "Quality Checks" ~/.config/PAI-pi/skills/creative-generation/SKILL.md` | 5 quality criteria listed |

## 8. data-analysis

| Check | Command/Procedure | Expected Result |
|-------|-------------------|-----------------|
| SKILL.md exists | `ls ~/.config/PAI-pi/skills/data-analysis/SKILL.md` | File exists |
| Name correct | `grep "^name:" ~/.config/PAI-pi/skills/data-analysis/SKILL.md` | `name: data-analysis` |
| Pipeline steps | `grep "1. \\*\\*Ingest" ~/.config/PAI-pi/skills/data-analysis/SKILL.md` | 6-step pipeline: Ingest through Report |
| Analysis methods | `grep "Descriptive" ~/.config/PAI-pi/skills/data-analysis/SKILL.md` | Table with Descriptive, Diagnostic, Predictive, Prescriptive |
| Common operations | `grep "Summary" ~/.config/PAI-pi/skills/data-analysis/SKILL.md` | Mean, median, std, min, max listed |
| Visualization guidance | `grep "Chart Type" ~/.config/PAI-pi/skills/data-analysis/SKILL.md` | Data-to-chart mapping table |

## 9. debugging

| Check | Command/Procedure | Expected Result |
|-------|-------------------|-----------------|
| SKILL.md exists | `ls ~/.config/PAI-pi/skills/debugging/SKILL.md` | File exists |
| Name correct | `grep "^name:" ~/.config/PAI-pi/skills/debugging/SKILL.md` | `name: debugging` |
| Structured process | `grep "1. \\*\\*Reproduce" ~/.config/PAI-pi/skills/debugging/SKILL.md` | 6-step process: Reproduce through Prevent |
| Isolation techniques | `grep "Binary search" ~/.config/PAI-pi/skills/debugging/SKILL.md` | Table with Binary search, Divide and conquer, etc. |
| RCA patterns | `grep "Off-by-one" ~/.config/PAI-pi/skills/debugging/SKILL.md` | Common bug patterns listed |
| Verification steps | `grep "After applying a fix" ~/.config/PAI-pi/skills/debugging/SKILL.md` | 4 verification checks for any fix |

## 10. documentation

| Check | Command/Procedure | Expected Result |
|-------|-------------------|-----------------|
| SKILL.md exists | `ls ~/.config/PAI-pi/skills/documentation/SKILL.md` | File exists |
| Name correct | `grep "^name:" ~/.config/PAI-pi/skills/documentation/SKILL.md` | `name: documentation` |
| README structure | `grep "Quick Start" ~/.config/PAI-pi/skills/documentation/SKILL.md` | 8-section README template present |
| Docstring standards | `grep "Function/Method" ~/.config/PAI-pi/skills/documentation/SKILL.md` | Function and Class docstring templates |
| Changelog format | `grep "## \\[1.1.0\\]" ~/.config/PAI-pi/skills/documentation/SKILL.md` | Keep a Changelog format example |
| Principles | `grep "Audience-aware" ~/.config/PAI-pi/skills/documentation/SKILL.md` | 4 documentation principles listed |

## 11. interview

| Check | Command/Procedure | Expected Result |
|-------|-------------------|-----------------|
| SKILL.md exists | `ls ~/.config/PAI-pi/skills/interview/SKILL.md` | File exists |
| Name correct | `grep "^name:" ~/.config/PAI-pi/skills/interview/SKILL.md` | `name: interview` |
| Sessions defined | `grep "Session 1" ~/.config/PAI-pi/skills/interview/SKILL.md` | 4 sessions: Identity, Goals, Preferences, Capabilities |
| User profile output | `grep "User Profile Update" ~/.config/PAI-pi/skills/interview/SKILL.md` | Output template present |

## 12. investigation

| Check | Command/Procedure | Expected Result |
|-------|-------------------|-----------------|
| SKILL.md exists | `ls ~/.config/PAI-pi/skills/investigation/SKILL.md` | File exists |
| Name correct | `grep "^name:" ~/.config/PAI-pi/skills/investigation/SKILL.md` | `name: investigation` |
| Capabilities | `grep "People search" ~/.config/PAI-pi/skills/investigation/SKILL.md` | Lists people search, company intel, domain lookup, etc. |
| Methods | `grep "Surface scan" ~/.config/PAI-pi/skills/investigation/SKILL.md` | 4 methods: Surface scan, Deep dive, Pattern analysis, Timeline |

## 13. isa

| Check | Command/Procedure | Expected Result |
|-------|-------------------|-----------------|
| SKILL.md exists | `ls ~/.config/PAI-pi/skills/isa/SKILL.md` | File exists |
| Name correct | `grep "^name:" ~/.config/PAI-pi/skills/isa/SKILL.md` | `name: isa` |
| 12-section template | `grep "Executive Summary" ~/.config/PAI-pi/skills/isa/SKILL.md` | All 12 sections listed (Executive Summary through Success Criteria) |
| ISC rules | `grep "\\*\\*Specific\\*\\*" ~/.config/PAI-pi/skills/isa/SKILL.md` | 4 ISC rules: Specific, Coherent, Minimal, Temporal |
| Scaffolding guidance | `grep "Start with section 2" ~/.config/PAI-pi/skills/isa/SKILL.md` | Scaffolding guidance present |

## 14. knowledge

| Check | Command/Procedure | Expected Result |
|-------|-------------------|-----------------|
| SKILL.md exists | `ls ~/.config/PAI-pi/skills/knowledge/SKILL.md` | File exists |
| Name correct | `grep "^name:" ~/.config/PAI-pi/skills/knowledge/SKILL.md` | `name: knowledge` |
| Entity types table | `grep "\\*\\*People\\*\\*" ~/.config/PAI-pi/skills/knowledge/SKILL.md` | 6 entity types: People, Companies, Ideas, Projects, Resources, Events |
| Wikilinks syntax | `grep "\\\\[\\\\[Type:Name\\\\]\\\\]" ~/.config/PAI-pi/skills/knowledge/SKILL.md` | Wikilink format documented: `[[Type:Name]]` |
| Harvest workflow | `grep "1. \\*\\*Identify" ~/.config/PAI-pi/skills/knowledge/SKILL.md` | 6-step harvest workflow |

## 15. learning

| Check | Command/Procedure | Expected Result |
|-------|-------------------|-----------------|
| SKILL.md exists | `ls ~/.config/PAI-pi/skills/learning/SKILL.md` | File exists |
| Name correct | `grep "^name:" ~/.config/PAI-pi/skills/learning/SKILL.md` | `name: learning` |
| Learning cycle | `grep "1. \\*\\*Experience" ~/.config/PAI-pi/skills/learning/SKILL.md` | 6-step cycle: Experience → Extract → Connect → Generalize → Apply → Review |
| Capture formats | `grep "Insight card" ~/.config/PAI-pi/skills/learning/SKILL.md` | Table with 5 formats: Insight card, Lesson learned, Pattern, Mental model, Question |
| Compounding rules | `grep "New insights must link" ~/.config/PAI-pi/skills/learning/SKILL.md` | 5 compounding rules present |
| Spaced repetition | `grep "Day 1" ~/.config/PAI-pi/skills/learning/SKILL.md` | Spaced repetition schedule: Day 1, 3, 7, 30, 90 |
| Memory directories | `ls -d ~/.config/PAI-pi/memory/learning ~/.config/PAI-pi/memory/state ~/.config/PAI-pi/memory/work` | Three memory directories exist |

## 16. media

| Check | Command/Procedure | Expected Result |
|-------|-------------------|-----------------|
| SKILL.md exists | `ls ~/.config/PAI-pi/skills/media/SKILL.md` | File exists |
| Name correct | `grep "^name:" ~/.config/PAI-pi/skills/media/SKILL.md` | `name: media` |
| Capabilities | `grep "### Diagrams" ~/.config/PAI-pi/skills/media/SKILL.md` | Sections for Diagrams & Charts, AI Image Generation, Infographics |
| Mermaid mentioned | `grep "Mermaid" ~/.config/PAI-pi/skills/media/SKILL.md` | Mermaid flowcharts listed as preferred diagram format |

## 17. observability

| Check | Command/Procedure | Expected Result |
|-------|-------------------|-----------------|
| SKILL.md exists | `ls ~/.config/PAI-pi/skills/observability/SKILL.md` | File exists |
| Name correct | `grep "^name:" ~/.config/PAI-pi/skills/observability/SKILL.md` | `name: observability` |
| Three pillars | `grep "1. \\*\\*Logs" ~/.config/PAI-pi/skills/observability/SKILL.md` | 3 pillars: Logs, Metrics, Traces |
| RED/USE metrics | `grep "RED" ~/.config/PAI-pi/skills/observability/SKILL.md` | RED (Rate, Errors, Duration) and USE metrics documented |
| Alerting rules | `grep "Threshold" ~/.config/PAI-pi/skills/observability/SKILL.md` | 4 alert types: Threshold, Anomaly, Rate, Dead man |
| Cost tracking | `grep "Tag all resources" ~/.config/PAI-pi/skills/observability/SKILL.md` | Cost tracking methodology present |

## 18. privacy-security

| Check | Command/Procedure | Expected Result |
|-------|-------------------|-----------------|
| SKILL.md exists | `ls ~/.config/PAI-pi/skills/privacy-security/SKILL.md` | File exists |
| Name correct | `grep "^name:" ~/.config/PAI-pi/skills/privacy-security/SKILL.md` | `name: privacy-security` |
| PII detection table | `grep "Email" ~/.config/PAI-pi/skills/privacy-security/SKILL.md` | PII types table: Email, SSN, Phone, Address, IP, Credit Card |
| Secret scanning list | `grep "API keys" ~/.config/PAI-pi/skills/privacy-security/SKILL.md` | Lists API keys, tokens, passwords, private keys, connection strings |
| Containment patterns | `grep "Sandbox" ~/.config/PAI-pi/skills/privacy-security/SKILL.md` | 5 containment patterns: Sandbox, Redact, Quarantine, Rotate, Audit |
| Principles | `grep "Least privilege" ~/.config/PAI-pi/skills/privacy-security/SKILL.md` | 4 security principles listed |

## 19. prompting

| Check | Command/Procedure | Expected Result |
|-------|-------------------|-----------------|
| SKILL.md exists | `ls ~/.config/PAI-pi/skills/prompting/SKILL.md` | File exists |
| Name correct | `grep "^name:" ~/.config/PAI-pi/skills/prompting/SKILL.md` | `name: prompting` |
| Prompt structure | `grep "## Context" ~/.config/PAI-pi/skills/prompting/SKILL.md` | 5-section prompt template: Context, Task, Constraints, Output, Examples |
| Techniques table | `grep "Chain-of-Thought" ~/.config/PAI-pi/skills/prompting/SKILL.md` | Table with CoT, Persona, Constraint framing, Output formatting, Few-shot, etc. |
| Optimization loop | `grep "1. \\*\\*Write" ~/.config/PAI-pi/skills/prompting/SKILL.md` | 6-step optimization loop: Write through Repeat |

## 20. research

| Check | Command/Procedure | Expected Result |
|-------|-------------------|-----------------|
| SKILL.md exists | `ls ~/.config/PAI-pi/skills/research/SKILL.md` | File exists |
| Name correct | `grep "^name:" ~/.config/PAI-pi/skills/research/SKILL.md` | `name: research` |
| Modes table | `grep "Quick" ~/.config/PAI-pi/skills/research/SKILL.md` | 4 modes: Quick, Standard, Extensive, Deep with source counts and times |
| Workflow steps | `grep "1. \\*\\*Decompose" ~/.config/PAI-pi/skills/research/SKILL.md` | 5-step workflow: Decompose, Search, Extract, Synthesize, Verify |
| Output format | `grep "## Research:" ~/.config/PAI-pi/skills/research/SKILL.md` | Research report template present |
| Rules for research | `grep "Always cite sources" ~/.config/PAI-pi/skills/research/SKILL.md` | 5 research rules (cite, flag conflicts, distinguish facts, etc.) |

## 21. scraping

| Check | Command/Procedure | Expected Result |
|-------|-------------------|-----------------|
| SKILL.md exists | `ls ~/.config/PAI-pi/skills/scraping/SKILL.md` | File exists |
| Name correct | `grep "^name:" ~/.config/PAI-pi/skills/scraping/SKILL.md` | `name: scraping` |
| Progressive escalation | `grep "Direct fetch" ~/.config/PAI-pi/skills/scraping/SKILL.md` | 4 escalation levels: Direct fetch, Browser rendering, Proxy rotation, Specialized APIs |
| Rules | `grep "robots.txt" ~/.config/PAI-pi/skills/scraping/SKILL.md` | robots.txt respect rule present |

## 22. security

| Check | Command/Procedure | Expected Result |
|-------|-------------------|-----------------|
| SKILL.md exists | `ls ~/.config/PAI-pi/skills/security/SKILL.md` | File exists |
| Name correct | `grep "^name:" ~/.config/PAI-pi/skills/security/SKILL.md` | `name: security` |
| Reconnaissance | `grep "Subdomain enumeration" ~/.config/PAI-pi/skills/security/SKILL.md` | Reconnaissance capabilities listed |
| OWASP coverage | `grep "Authentication testing" ~/.config/PAI-pi/skills/security/SKILL.md` | OWASP web assessment categories listed |
| Threat modeling | `grep "STRIDE" ~/.config/PAI-pi/skills/security/SKILL.md` | STRIDE framework mentioned |
| CLI tools | `grep "nmap" ~/.config/PAI-pi/skills/security/SKILL.md` | Tools: nmap, ffuf, dig, whois, curl, jq |

## 23. synthesis

| Check | Command/Procedure | Expected Result |
|-------|-------------------|-----------------|
| SKILL.md exists | `ls ~/.config/PAI-pi/skills/synthesis/SKILL.md` | File exists |
| Name correct | `grep "^name:" ~/.config/PAI-pi/skills/synthesis/SKILL.md` | `name: synthesis` |
| Process steps | `grep "1. \\*\\*Collect" ~/.config/PAI-pi/skills/synthesis/SKILL.md` | 7-step process: Collect through Cite |
| Cross-source verification | `grep "Sources agree" ~/.config/PAI-pi/skills/synthesis/SKILL.md` | Table for source agreement/conflict resolution |
| Report structure | `grep "Executive Summary" ~/.config/PAI-pi/skills/synthesis/SKILL.md` | 8-section report structure |
| Argument mapping | `grep "Claim" ~/.config/PAI-pi/skills/synthesis/SKILL.md` | Claim → Evidence → Warrant framework |

## 24. telos

| Check | Command/Procedure | Expected Result |
|-------|-------------------|-----------------|
| SKILL.md exists | `ls ~/.config/PAI-pi/skills/telos/SKILL.md` | File exists |
| Name correct | `grep "^name:" ~/.config/PAI-pi/skills/telos/SKILL.md` | `name: telos` |
| Framework sections | `grep "Mission" ~/.config/PAI-pi/skills/telos/SKILL.md` | Mission, Goals, Projects, Dependencies, Beliefs, Wisdom, Books, Movies |
| Dashboard | `grep "Dashboard" ~/.config/PAI-pi/skills/telos/SKILL.md` | Dashboard generation described with 4 components |
| Reports | `grep "Executive summary" ~/.config/PAI-pi/skills/telos/SKILL.md` | Report structure with executive summary, findings, recommendations |

## 25. thinking

| Check | Command/Procedure | Expected Result |
|-------|-------------------|-----------------|
| SKILL.md exists | `ls ~/.config/PAI-pi/skills/thinking/SKILL.md` | File exists |
| Name correct | `grep "^name:" ~/.config/PAI-pi/skills/thinking/SKILL.md` | `name: thinking` |
| Frameworks | `grep "First Principles" ~/.config/PAI-pi/skills/thinking/SKILL.md` | First Principles described |
| Council debate | `grep "Council" ~/.config/PAI-pi/skills/thinking/SKILL.md` | 3-round multi-perspective debate framework present |
| Red team | `grep "Red Team" ~/.config/PAI-pi/skills/thinking/SKILL.md` | 4-step adversarial analysis: Attack vectors, Severity, Mitigations |
| Iterative depth | `grep "Iterative Depth" ~/.config/PAI-pi/skills/thinking/SKILL.md` | Multi-angle depth exploration framework |
| Science method | `grep "Science Method" ~/.config/PAI-pi/skills/thinking/SKILL.md` | 6-step scientific method |
| World/Threat model | `grep "World/Threat Model" ~/.config/PAI-pi/skills/thinking/SKILL.md` | Threat/opportunity horizon analysis framework |

## 26. upgrade

| Check | Command/Procedure | Expected Result |
|-------|-------------------|-----------------|
| SKILL.md exists | `ls ~/.config/PAI-pi/skills/upgrade/SKILL.md` | File exists |
| Name correct | `grep "^name:" ~/.config/PAI-pi/skills/upgrade/SKILL.md` | `name: upgrade` |
| Self-assessment | `grep "Inventory current state" ~/.config/PAI-pi/skills/upgrade/SKILL.md` | 5-step self-assessment process |
| Upgrade process | `grep "Read release notes" ~/.config/PAI-pi/skills/upgrade/SKILL.md` | 7-step upgrade process with rollback |
| Migration patterns | `grep "Blue-green" ~/.config/PAI-pi/skills/upgrade/SKILL.md` | 5 migration patterns: Blue-green, Canary, Big bang, Strangler fig, Parallel run |
| Breaking changes | `grep "Identify all consumers" ~/.config/PAI-pi/skills/upgrade/SKILL.md` | Breaking change handling process |

## 27. voice

| Check | Command/Procedure | Expected Result |
|-------|-------------------|-----------------|
| SKILL.md exists | `ls ~/.config/PAI-pi/skills/voice/SKILL.md` | File exists |
| Name correct | `grep "^name:" ~/.config/PAI-pi/skills/voice/SKILL.md` | `name: voice` |
| TTS integration table | `grep "Engine" ~/.config/PAI-pi/skills/voice/SKILL.md` | TTS options table: Engine, Voice, Format, Markup |
| SSML markup example | `grep "<speak>" ~/.config/PAI-pi/skills/voice/SKILL.md` | SSML example with voice, prosody, break, emphasis |
| Notification priorities | `grep "Silent" ~/.config/PAI-pi/skills/voice/SKILL.md` | 5 priority levels: Silent through Emergency |
| Voice pipeline | `grep "1. \\*\\*Input" ~/.config/PAI-pi/skills/voice/SKILL.md` | 5-step pipeline: Input, Prepare, Synthesize, Output, Fallback |
| Accessibility | `grep "text fallback" ~/.config/PAI-pi/skills/voice/SKILL.md` | Accessibility rules (text fallback, preferred voice, do-not-disturb) |

---

## Core Infrastructure Verification

These checks verify the Pi-mono scaffold infrastructure itself (not a specific pack).

### Pi Runtime

| Check | Command/Procedure | Expected Result |
|-------|-------------------|-----------------|
| Pi installed | `pi --version` | Version string printed (e.g., `1.x.x`) |
| Config directory | `ls ~/.config/PAI-pi/` | Directory exists with config/, extensions/, skills/, memory/ |
| Settings file | `cat ~/.config/PAI-pi/config/settings.json` | Valid JSON with algorithmVersion, effortTier, etc. |
| SYSTEM.md exists | `head -3 ~/.config/PAI-pi/config/SYSTEM.md` | Starts with `# PAI on Pi — Personal AI Infrastructure v5.0.0` |
| AGENTS.md exists | `ls ~/.config/PAI-pi/config/AGENTS.md` | File exists |
| models.json valid | `python3 -c "import json; json.load(open('$HOME/.config/PAI-pi/config/models.json'))"` | No JSON parse error |

### PAI Core Extension

| Check | Command/Procedure | Expected Result |
|-------|-------------------|-----------------|
| Extension file | `ls ~/.config/PAI-pi/extensions/pai-core/index.ts` | File exists |
| Exports default function | `grep "export default function" ~/.config/PAI-pi/extensions/pai-core/index.ts` | Has `export default function (pi: ExtensionAPI)` |
| Voice tool registered | `grep "voice_notify" ~/.config/PAI-pi/extensions/pai-core/index.ts` | Voice notification tool registered |
| ISA scaffold tool | `grep "isa_scaffold" ~/.config/PAI-pi/extensions/pai-core/index.ts` | ISA scaffold tool registered |
| ISA reconcile tool | `grep "isa_reconcile" ~/.config/PAI-pi/extensions/pai-core/index.ts` | ISA reconcile tool registered |
| ISA check tool | `grep "isa_check_completeness" ~/.config/PAI-pi/extensions/pai-core/index.ts` | ISA completeness check tool registered |
| Security blocklist | `grep "dangerous" ~/.config/PAI-pi/extensions/pai-core/index.ts` | Dangerous command patterns defined |

### Memory Structure

| Check | Command/Procedure | Expected Result |
|-------|-------------------|-----------------|
| Memory root | `ls -d ~/.config/PAI-pi/memory` | Directory exists |
| Learning dir | `ls -d ~/.config/PAI-pi/memory/learning` | Directory exists (may be empty) |
| State dir | `ls -d ~/.config/PAI-pi/memory/state` | Directory exists (may be empty) |
| Work dir | `ls -d ~/.config/PAI-pi/memory/work` | Directory exists (may be empty) |
| Session log | `ls ~/.config/PAI-pi/memory/learning/session-log.jsonl 2>/dev/null; echo "exit: $?"` | File may not exist until first session ends (that's OK) |

### Runtime Integration Test

| Check | Command/Procedure | Expected Result |
|-------|-------------------|-----------------|
| Pi launches with config | `timeout 10 pi 2>&1 || true` | Pi starts, loads config, shows ready status (no crashes within 10s) |
| PAI algorithm available | `echo "/status" \| timeout 5 pi 2>&1 \| grep -i "PAI\|algorithm\|ready" \| head -3` | Status output references PAI or algorithm mode |
| ISA scaffold via extension | Launch Pi, ask it to scaffold an ISA for a test task | Extension creates ISA.md in work directory |

---

> **Note:** All file checks assume the scaffold has been deployed to `~/.config/PAI-pi/`
> (usually `/home/<user>/.config/PAI-pi/`). Adjust the path if `$PAI_PI_DIR` is customized.
