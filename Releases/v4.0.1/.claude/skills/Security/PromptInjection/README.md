# PromptInjection Skill

## Overview

Comprehensive prompt injection security testing framework for authorized penetration testing of AI/LLM systems.

**Purpose:** Authorized security testing only

---

## 🔒 Authorization Required

**⚠️ CRITICAL: This skill is for AUTHORIZED testing only ⚠️**

- ✅ Systems you own
- ✅ Systems with explicit written permission
- ✅ Professional security engagements
- ✅ Ethical security research

❌ **NEVER use without authorization** - Unauthorized testing is illegal

---

## Quick Start

### 1. Verify Authorization
```bash
# Document authorization first
cat > AUTHORIZATION.md << EOF
Target: [URL]
Client: [Name]
Authorized By: [Name, Title]
Date: [Date]
Scope: [Boundaries]
EOF
```

### 2. Activate Skill
```
"Test [target] for prompt injection vulnerabilities"
```

### 3. Follow Methodology
- Phase 1: Reconnaissance (browser automation)
- Phase 2: Attack surface mapping
- Phase 3: Vulnerability testing
- Phase 4: Impact assessment
- Phase 5: Reporting

---

## Directory Structure

```
promptinjection/
├── SKILL.md                    # Main skill definition
├── README.md                   # This file
├── resources/                  # Core documentation
│   ├── COMPREHENSIVE-ATTACK-TAXONOMY.md
│   ├── APPLICATION-RECONNAISSANCE-METHODOLOGY.md
│   └── attack-payloads/       # Attack payload library
├── Workflows/                  # Testing workflows
│   ├── complete-assessment.md
│   ├── reconnaissance.md
│   ├── direct-injection-testing.md
│   ├── indirect-injection-testing.md
│   └── multi-stage-attacks.md
└── tools/                      # Custom testing tools
```

---

## Core Capabilities

### Attack Taxonomy (10 Categories)

1. **Direct Prompt Injection** - Instruction manipulation, jailbreaking
2. **Indirect Prompt Injection** - Web scraping, document injection, RAG poisoning
3. **Jailbreaking & Guardrail Bypass** - Refusal suppression, role-playing
4. **System Prompt Extraction** - Leaking techniques, memory poisoning
5. **Multi-Stage Attack Chains** - Progressive escalation, context manipulation
6. **RAG System Poisoning** - Document poisoning, vector database attacks
7. **Goal Hijacking** - Objective manipulation, agent compromise
8. **Token-Level Manipulation** - Special tokens, Unicode attacks, BPE exploitation
9. **Cross-Context Data Leakage** - Memory injection, multi-tenant isolation bypass
10. **Obfuscation & Evasion** - Encoding, invisible characters, hybrid techniques

### Reconnaissance Methodology (7 Phases)

1. Initial Application Discovery
2. DOM Extraction & Analysis
3. JavaScript Code Analysis
4. Network Traffic Capture
5. API Endpoint Enumeration
6. Parameter Discovery
7. AI/LLM Component Identification

### Testing Tools Integration

- **Promptfoo** - Automated context-aware attacks
- **Garak** - Research-backed scanner
- **PyRIT** - Microsoft enterprise framework
- **Browser Automation** - Custom reconnaissance
- **Custom Payloads** - Specialized attack strings

---

## Usage Examples

### Quick Assessment (30-60 min)
```bash
# 1. Navigate to target
browser navigate https://target-app.com

# 2. Quick recon
browser extract "find all AI inputs and components"
browser network-logs /api/

# 3. Test top 5 attacks
# Basic injection, system extraction, jailbreak, obfuscation, multi-turn

# 4. Document findings
```

### Comprehensive Assessment (4-8 hours)
```bash
# 1. Full authorization documentation
# 2. Complete 7-phase reconnaissance
# 3. Systematic testing (all 10 categories)
# 4. Proof-of-concept development
# 5. Impact analysis
# 6. Comprehensive reporting
```

### RAG-Specific Assessment
```bash
# 1. Identify RAG implementation
# 2. Document poisoning tests (90% success with 5 docs)
# 3. Retrieval manipulation
# 4. Context injection via uploads
# 5. Vector database security
# 6. Cross-user contamination
```

---

## Key Research Findings

### Attack Success Rates (Documented)

- **RAG Poisoning:** 90% with just 5 poisoned documents
- **System Prompt Extraction:** 94%+ success (PLeak algorithm)
- **Multi-Stage Attacks:** 10x more effective than single-turn
- **Token Manipulation:** 50-96% success rates
- **Goal Hijacking:** 80%+ success rate
- **Inter-Agent Exploitation:** 82.4% vulnerability rate

### Critical Vulnerabilities

- **Memory Injection (GPT-4o/GPT-5):** Persistent surveillance capability
- **Context Window Poisoning:** 90%+ success across major models
- **Zero-Click Exploits:** No user interaction required
- **AI-Powered Exploitation:** <10 minute CVE exploitation

### Defense Reality

- Most defenses: 90%+ attack bypass rates
- No single defense sufficient
- Defense-in-depth mandatory
- Architectural changes required

---

## Research Foundation

### 13 Parallel Research Reports (2025-11-07)

1. Prompt Injection Taxonomies (OWASP, HiddenLayer, SoK)
2. System Prompt Extraction & Leaking
3. Multi-Stage Attack Chains
4. AI Jailbreaking & Guardrail Bypass
5. RAG System Vulnerabilities
6. Goal Hijacking & Objective Manipulation
7. Encoding & Obfuscation Techniques
8. Automated Testing Tools & Frameworks
9. Cross-Context Data Leakage
10. Defense Mechanisms & Mitigations
11. Real-World Vulnerabilities & Case Studies
12. Token-Level Manipulation Attacks
13. Indirect Prompt Injection Attacks

**All research saved to:**
`~/.claude/History/research/2025-11-07_*prompt-injection*.md`

### Source Materials

- **L1B3RT4S Repository** (elder-plinius) - Attack techniques
- **Arcanum AI Security Hub** - Security resources
- **OWASP LLM Top 10 (2025)** - Industry standards
- **NIST AI RMF** - Government framework
- **Academic Papers** - 2024-2025 research
- **CVE Databases** - Real vulnerabilities
- **Industry Research** - Microsoft, NVIDIA, Google, Meta

---

## Workflow Routing

### Complete Assessment
**Trigger:** "full assessment", "comprehensive test"
**Use:** End-to-end security engagement

### Reconnaissance
**Trigger:** "recon", "discover attack surface"
**Use:** Intelligence gathering phase

### Direct Injection
**Trigger:** "test direct injection", "jailbreak testing"
**Use:** Single-stage attacks

### Indirect Injection
**Trigger:** "test indirect injection", "RAG poisoning"
**Use:** Data processing attacks

### Multi-Stage Attacks
**Trigger:** "multi-stage", "sophisticated testing"
**Use:** Advanced attack simulation

---

## Reporting & Documentation

### Assessment Report Sections

1. **Executive Summary** - Key findings, risk ratings
2. **Technical Details** - Vulnerabilities, reproduction steps
3. **Proof-of-Concepts** - Screenshots, code, demonstrations
4. **Impact Analysis** - Business and technical impact
5. **Remediation** - Prioritized recommendations
6. **Appendix** - Methodology, tools, references

### Deliverables

- Comprehensive assessment report
- Proof-of-concept demonstrations
- Remediation roadmap
- Defense implementation guide
- Executive presentation (optional)

---

## Professional Standards

### Regulatory Compliance

- **OWASP LLM Top 10** - Aligned methodology
- **NIST AI RMF** - Risk management framework
- **EU AI Act (2026)** - Adversarial testing requirements
- **PTES** - Penetration Testing Execution Standard

### Responsible Disclosure

- 90-day disclosure timeline (typical)
- Coordinated with vendor
- User protection prioritized
- No public details before patch

### Continuous Improvement

- Monthly research updates
- Quarterly methodology review
- Annual comprehensive assessment
- Community contribution (ethical)

---

## Integration with PAI

### Required Skills

- **Chrome MCP** - Reconnaissance and testing
- **research** - Latest vulnerability intelligence
- **development** - Custom tool creation

### Optional Skills

- **system** - Infrastructure setup
- **writing** - Report generation
- **media** - Diagram creation

---

## Support

### Escalation Criteria

**Escalate when:**
- Authorization unclear
- Ethical concerns arise
- Novel vulnerabilities discovered
- Critical 0-days found

---

## License & Usage

**For authorized security testing only.**

This skill and all associated materials are for:
- ✅ Authorized security testing
- ✅ Defensive security research
- ✅ Educational purposes (with proper authorization)
- ✅ Professional security engagements

**Prohibited uses:**
- ❌ Unauthorized testing
- ❌ Malicious purposes
- ❌ Illegal activities
- ❌ Unethical exploitation

---

## Version

**Version:** 1.0.0
**Created:** 2025-11-07
**Last Updated:** 2025-11-07

**Changelog:**
- v1.0.0 (2025-11-07): Initial release with complete taxonomy, methodology, and workflows

---

## Getting Started

1. **Read SKILL.md** - Understand full capabilities
2. **Review attack taxonomy** - Learn the 10 attack categories
3. **Study reconnaissance methodology** - Master the 7-phase process
4. **Obtain authorization** - MANDATORY before any testing
5. **Run first assessment** - Follow guided workflow
6. **Document findings** - Professional reporting
7. **Provide remediation** - Help clients fix issues

---

**🔒 AUTHORIZATION REQUIRED - ETHICAL USE ONLY 🔒**

This is professional security testing infrastructure for authorized use only.

Professional security testing infrastructure.

---

END OF README
