# Create Threat Model Workflow

Generates prioritized attack scenarios and test plans from application understanding.

## Trigger Phrases

- "create threat model"
- "threat model this app"
- "what are the attack scenarios"
- "how would I attack this"
- "generate attack plan"
- "prioritize testing"

## Purpose

After understanding an application, generate a structured threat model that:
1. Identifies applicable threats based on attack surface
2. Maps threats to OWASP and CWE classifications
3. Creates realistic attack paths
4. Produces a prioritized test plan

## Prerequisites

Run **UnderstandApplication** workflow first, or have equivalent context about:
- Technology stack
- User roles and access levels
- User flows and sensitive data
- Attack surface (inputs, APIs, file uploads, etc.)

## Output Structure

Produce a markdown document with these sections:

```markdown
# Threat Model: [Target]

## Executive Summary

| Metric | Count |
|--------|-------|
| Total Threats | [N] |
| Critical | [N] |
| High | [N] |
| Medium | [N] |
| Low | [N] |

**Top Categories:** [List top 3-5 threat categories]

## Attack Paths

### [Attack Path Name]
**Description:** [What attacker achieves]
**Required Access:** [None/Authenticated/Privileged]
**Target Asset:** [What's being attacked]

**Steps:**
1. [First step]
2. [Second step]
...

**Related Threats:** [List threat IDs]

## Prioritized Test Plan

| Priority | Threat | Tests | Tools | Effort |
|----------|--------|-------|-------|--------|
| 1 | [Name] | [Brief test description] | [Tool suggestions] | [quick/medium/extensive] |
| 2 | ... | ... | ... | ... |

## Threat Details

### T1: [Threat Name]
**Category:** [Authentication/Access Control/Injection/etc.]
**OWASP:** [A01-A10 category]
**CWE:** [CWE-XXX]
**Impact:** [low/medium/high/critical]
**Likelihood:** [low/medium/high]
**Risk Score:** [Impact × Likelihood]

[Description of the threat]

**Attack Vector:** [How it's exploited]
**Target Component:** [What part of app]

**Prerequisites:**
- [What's needed to attempt this]

**Test Cases:**
- [Specific test to perform]
- [Another test]

**Mitigations:**
- [How to fix/prevent]
```

## Threat Categories

Apply threats based on attack surface characteristics:

### Authentication (apply when auth exists)
| Threat | OWASP | CWE | Impact | Likelihood |
|--------|-------|-----|--------|------------|
| Credential Stuffing | A07 | CWE-307 | High | High |
| Session Hijacking | A07 | CWE-384 | High | Medium |
| JWT Token Manipulation | A07 | CWE-287 | Critical | Medium |
| Password Reset Flaws | A07 | CWE-640 | High | Medium |

### Access Control (apply when multiple roles exist)
| Threat | OWASP | CWE | Impact | Likelihood |
|--------|-------|-----|--------|------------|
| Horizontal Privilege Escalation | A01 | CWE-639 | High | High |
| Vertical Privilege Escalation | A01 | CWE-269 | Critical | Medium |
| Forced Browsing | A01 | CWE-425 | Medium | Medium |

### Injection (apply to all web apps)
| Threat | OWASP | CWE | Impact | Likelihood |
|--------|-------|-----|--------|------------|
| SQL Injection | A03 | CWE-89 | Critical | Medium |
| Cross-Site Scripting (XSS) | A03 | CWE-79 | Medium | High |
| Command Injection | A03 | CWE-78 | Critical | Low |
| Server-Side Request Forgery | A10 | CWE-918 | High | Medium |

### Data Exposure (apply when sensitive data exists)
| Threat | OWASP | CWE | Impact | Likelihood |
|--------|-------|-----|--------|------------|
| Sensitive Data in Transit | A02 | CWE-319 | High | Medium |
| Information Disclosure | A05 | CWE-200 | Medium | High |

### File Upload (apply when upload exists)
| Threat | OWASP | CWE | Impact | Likelihood |
|--------|-------|-----|--------|------------|
| Unrestricted File Upload | A04 | CWE-434 | Critical | Medium |
| Path Traversal via Upload | A01 | CWE-22 | High | Medium |

### API Security (apply when APIs exist)
| Threat | OWASP | CWE | Impact | Likelihood |
|--------|-------|-----|--------|------------|
| Broken Object Level Authorization | A01 | CWE-639 | High | High |
| Excessive Data Exposure | A01 | CWE-213 | Medium | High |
| Mass Assignment | A08 | CWE-915 | High | Medium |

### WebSocket (apply when websockets exist)
| Threat | OWASP | CWE | Impact | Likelihood |
|--------|-------|-----|--------|------------|
| WebSocket Hijacking | A07 | CWE-346 | High | Medium |
| WebSocket Injection | A03 | CWE-79 | Medium | Medium |

### Business Logic (apply to all web apps)
| Threat | OWASP | CWE | Impact | Likelihood |
|--------|-------|-----|--------|------------|
| Business Logic Bypass | A04 | CWE-840 | High | Medium |
| Race Condition Exploitation | A04 | CWE-362 | High | Low |

### Payment Security (apply when payment flows exist)
| Threat | OWASP | CWE | Impact | Likelihood |
|--------|-------|-----|--------|------------|
| Payment Manipulation | A04 | CWE-472 | Critical | Medium |

## Attack Paths to Consider

Based on threats, generate realistic attack paths:

1. **Account Takeover** - Credential stuffing → session hijacking → account access
2. **Data Exfiltration** - IDOR → API data exposure → sensitive data theft
3. **Privilege Escalation** - Low priv access → role manipulation → admin access
4. **Payment Fraud** - Price manipulation → race conditions → financial theft

## Tool Suggestions by Category

| Category | Tools |
|----------|-------|
| Authentication | Burp Suite, ffuf, Hydra |
| Access Control | Burp Autorize, manual testing |
| Injection | sqlmap, Burp Suite, XSS Hunter |
| Data Exposure | testssl.sh, curl, Burp |
| File Upload | Burp Suite, custom scripts |
| API Security | Postman, Burp, API fuzzer |
| WebSocket | Burp Suite, websocat |
| Business Logic | Manual testing, Burp Repeater |

## Risk Scoring

Calculate risk score: `Impact × Likelihood`

| Impact | Score |
|--------|-------|
| Low | 1 |
| Medium | 2 |
| High | 3 |
| Critical | 4 |

| Likelihood | Score |
|------------|-------|
| Low | 1 |
| Medium | 2 |
| High | 3 |

Risk Score ranges: 1-3 (Low), 4-6 (Medium), 7-9 (High), 10-12 (Critical)

## Workflow Execution

1. **Review application understanding** - Load UnderstandApplication output
2. **Identify applicable categories** - Match attack surface to threat categories
3. **Select relevant threats** - Include threats that apply to this app
4. **Calculate risk scores** - Score each threat
5. **Generate attack paths** - Create realistic multi-step scenarios
6. **Prioritize test plan** - Order by risk score, effort, quick wins
7. **Produce output** - Generate structured markdown document

## Output Location

Save threat model to:
`../Data/{client}/threat-model.md`

Or return inline for immediate use in testing.

## Integration with PromptInjection Skill

If application uses LLMs/AI:
- Add prompt injection threats
- Reference PromptInjection skill for specialized testing
- Include indirect injection scenarios
