---
name: PromptInjection
description: Test LLM applications for prompt injection vulnerabilities — jailbreak attempts, system prompt extraction, context manipulation, guardrail bypass techniques, direct injection, indirect injection, multi-stage attacks, and reconnaissance. USE WHEN prompt injection, jailbreak, LLM security, AI security assessment, pentest AI application, test chatbot, guardrail bypass, direct injection, indirect injection, RAG poisoning, multi-stage attack, complete assessment, reconnaissance.
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/PromptInjection/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.


## 🚨 MANDATORY: Voice Notification (REQUIRED BEFORE ANY ACTION)

**You MUST send this notification BEFORE doing anything else when this skill is invoked.**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:8888/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the WORKFLOWNAME workflow in the PromptInjection skill to ACTION"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running the **WorkflowName** workflow in the **PromptInjection** skill to ACTION...
   ```

**This is not optional. Execute this curl command immediately upon skill invocation.**

# PromptInjection Skill

## 🔒 AUTHORIZATION & ETHICAL USE REQUIREMENTS

**⚠️ CRITICAL - READ BEFORE USE ⚠️**

This skill is part of a **Security Practice** run by a security professional with extensive experience in offensive security testing.

### Legal Requirements

**AUTHORIZATION IS MANDATORY:**
- ✅ **ONLY test systems you own** or have **explicit written permission** to test
- ✅ **ONLY use these techniques** as part of authorized penetration testing engagements
- ✅ **ALWAYS document authorization** before beginning any testing
- ✅ **RESPECT scope boundaries** defined in testing agreements
- ✅ **FOLLOW responsible disclosure** practices for any vulnerabilities discovered

**UNAUTHORIZED TESTING IS ILLEGAL:**
- ❌ **NEVER test systems** without explicit written permission
- ❌ **NEVER exceed** authorized scope boundaries
- ❌ **NEVER use these techniques** for malicious purposes
- ❌ **NEVER disclose vulnerabilities** publicly before vendor remediation
- ❌ **NEVER exfiltrate** real user data during testing

### Ethical Framework

This skill exists for **defensive security purposes:**
1. **Authorized penetration testing** of client systems under formal engagement
2. **Security assessment** of your own systems and products
3. **Research and education** for improving AI/LLM security practices
4. **Responsible disclosure** of vulnerabilities to vendors for remediation

**Any use of this skill constitutes acceptance of these terms and agreement to use only for authorized, ethical security testing purposes.**

---

## When to Activate This Skill

**Activate this skill when user says:**

### Direct Triggers
- "test for prompt injection", "prompt injection test", "prompt injection assessment"
- "LLM security testing", "AI security audit", "test chatbot security"
- "jailbreak test", "test for jailbreaking"
- "pentest AI application", "security test AI system"
- "check AI vulnerabilities", "assess AI security"

### Research & Analysis
- "research prompt injection", "analyze LLM vulnerabilities"
- "study jailbreaking methods", "investigate AI attack vectors"

### Engagement Work
- "client engagement for LLM security"
- "comprehensive AI security assessment"
- "vulnerability research for disclosure"

---


## Workflow Routing

**When executing a workflow, output this notification:**
```
Running the **WorkflowName** workflow in the **PromptInjection** skill to ACTION...
```

This skill provides 5 comprehensive testing workflows:

### 1. CompleteAssessment (Master Workflow)

**File:** `Workflows/CompleteAssessment.md`
**Triggers:** "full assessment", "complete test", "comprehensive assessment"
**Description:** End-to-end security assessment (12-20 hours)
- Phase 1: Authorization & scoping
- Phase 2: Reconnaissance (1-2 hours)
- Phase 3-5: Direct/indirect/multi-stage testing (6-8 hours)
- Phase 6-9: Defense analysis & reporting (4-6 hours)

**Use for:** Full security engagements, formal penetration tests

### 2. Reconnaissance

**File:** `Workflows/Reconnaissance.md`
**Triggers:** "recon", "discover attack surface", "map application"
**Description:** Application intelligence gathering via browser automation
- DOM extraction and analysis
- JavaScript inspection
- API endpoint enumeration
- Injection point identification

**Use for:** Initial assessment phase, attack surface mapping

### 3. DirectInjectionTesting

**File:** `Workflows/DirectInjectionTesting.md`
**Triggers:** "test direct injection", "jailbreak testing", "basic injection"
**Description:** Single-stage direct attacks
- Basic instruction override
- Jailbreaking & guardrail bypass
- System prompt extraction
- Token manipulation
- Obfuscation techniques

**Use for:** Quick vulnerability validation

### 4. IndirectInjectionTesting

**File:** `Workflows/IndirectInjectionTesting.md`
**Triggers:** "test indirect injection", "RAG poisoning", "document injection"
**Description:** Attacks via external data sources
- Document upload injection
- Web scraping attacks
- RAG system poisoning
- API response manipulation

**Use for:** Testing RAG systems, data processing pipelines

### 5. MultiStageAttacks

**File:** `Workflows/MultiStageAttacks.md`
**Triggers:** "multi-stage attack", "sophisticated testing", "advanced attacks"
**Description:** Complex multi-turn attack sequences
- Progressive escalation
- Context poisoning
- Trust exploitation chains

**Use for:** Advanced testing, sophisticated threat simulation

---

## Quick Start

**For first assessment:**
1. Read QuickStartGuide.md (30-60 minute methodology)
2. Verify written authorization
3. Run Reconnaissance workflow
4. Test top 5 attack types
5. Document findings

**For comprehensive assessment:**
1. Use CompleteAssessment workflow
2. Follow all 9 phases
3. Generate professional report

---

## Resource Library

**Core Documentation:**

- **COMPREHENSIVE-ATTACK-TAXONOMY.md** - 10 attack categories, 100+ techniques
- **APPLICATION-RECONNAISSANCE-METHODOLOGY.md** - 7-phase recon process
- **DefenseMechanisms.md** - Defense-in-depth strategies, remediation guidance
- **AutomatedTestingTools.md** - Promptfoo, Garak, PyRIT comparison
- **QuickStartGuide.md** - First assessment checklist (30-60 min)
- **Reporting.md** - Report structure, templates, presentation guidance

**All resources are in the PromptInjection skill root directory.**

---

## Key Principles

### Authorization-First
1. Written authorization is mandatory
2. Document everything (scope, boundaries, approvals)
3. Respect boundaries - in-scope only
4. Stop if uncertain - clarify before proceeding

### Methodical Testing
1. Systematic approach - follow established methodology
2. Document as you go - record all tests and results
3. Reproduce findings - ensure vulnerabilities are reliable
4. Assess impact accurately - distinguish theoretical vs practical risk

### Responsible Disclosure
1. Give vendors time - 90-day disclosure timeline typical
2. Clear communication - detailed reproduction steps
3. Coordinate disclosure - work with vendor on timing
4. Protect users - no public details before patch

---

## Examples

**Example 1: Quick test**
```
User: "test this chatbot for prompt injection - I own it"
→ Verifies authorization
→ Runs Reconnaissance workflow
→ Tests top 5 attack types
→ Documents findings
```

**Example 2: Full assessment**
```
User: "comprehensive prompt injection assessment for client"
→ Loads CompleteAssessment workflow
→ 9-phase methodology (12-20 hours)
→ Professional report with remediation
```

**Example 3: Research**
```
User: "what are the latest jailbreaking methods?"
→ Searches COMPREHENSIVE-ATTACK-TAXONOMY.md
→ Returns categorized techniques with effectiveness ratings
```

---

## Support & Escalation

**When to escalate:**
- Authorization is unclear or questionable
- Ethical concerns arise
- Novel attack techniques discovered
- Critical 0-day vulnerabilities found

**Contact:**
- Configure in your USER settings

---

**🔒 REMINDER: AUTHORIZED USE ONLY 🔒**

This skill contains powerful security testing techniques. Use only for:
- ✅ Systems you own
- ✅ Systems with explicit written authorization
- ✅ Ethical security research
- ✅ Defensive security purposes

Unauthorized use is illegal and unethical.

---
