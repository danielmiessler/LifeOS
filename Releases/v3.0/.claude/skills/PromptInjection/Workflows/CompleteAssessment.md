# Complete Assessment - End-to-End Security Testing

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the CompleteAssessment workflow in the PromptInjection skill to test security"}' \
  > /dev/null 2>&1 &
```

Running the **CompleteAssessment** workflow in the **PromptInjection** skill to test security...

**Master workflow:** Comprehensive prompt injection security assessment

## Purpose

Execute a full end-to-end prompt injection security assessment incorporating all testing methodologies, from initial reconnaissance through final reporting.

## Prerequisites

- Written authorization MANDATORY (verify before starting)
- Scope clearly defined and documented
- Testing environment configured
- Browser automation functional
- Client communication channel established

## Assessment Phases

### Phase 1: Authorization & Scoping (30 minutes)

**Critical authorization checks:**

1. **Verify written authorization exists**
   - Signed penetration testing agreement
   - Statement of work (SOW) with explicit scope
   - Authorized contact person identified

2. **Document scope boundaries**
   - In-scope URLs/domains
   - In-scope features/functionality
   - Out-of-scope areas (explicitly noted)
   - Testing constraints (time windows, rate limits)
   - Sensitive data handling rules

3. **Establish communication**
   - Primary contact for findings
   - Escalation contact for critical issues
   - Reporting schedule
   - Emergency procedures

**Create authorization documentation file:**
```markdown
# Authorization - [Client Name] Prompt Injection Assessment

## Authorization Details
- Client: [Name]
- Date: [YYYY-MM-DD]
- Authorized by: [Name, Title]
- SOW Reference: [Document ID]

## Scope
**In-Scope:**
- https://app.client.com/*
- AI chat feature
- Document upload functionality
- API endpoints: /api/chat, /api/upload

**Out-of-Scope:**
- Payment processing
- Third-party integrations
- Production user data

## Contacts
- Primary: [Name] <email>
- Technical: [Name] <email>
- Emergency: [Phone]

## Testing Window
- Dates: [YYYY-MM-DD to YYYY-MM-DD]
- Hours: [Time range if restricted]
- Rate limits: [If applicable]
```

### Phase 2: Reconnaissance (1-2 hours)

**Use Reconnaissance workflow:**
`~/.claude/skills/PromptInjection/Workflows/Reconnaissance.md`

**Deliverables:**
- Complete attack surface map
- API endpoint documentation
- Injection point inventory
- AI/LLM component identification
- High-value target prioritization

**Save to:**
```
~/.claude/History/research/YYYY-MM-DD_[client]-recon/
├── attack-surface-map.md
├── api-endpoints.md
├── injection-points.md
└── screenshots/
```

### Phase 3: Direct Injection Testing (2-3 hours)

**Use DirectInjectionTesting workflow:**
`~/.claude/skills/PromptInjection/Workflows/DirectInjectionTesting.md`

**Test all categories:**
1. Basic instruction override
2. Jailbreaking & guardrail bypass
3. System prompt extraction
4. Goal hijacking
5. Token manipulation
6. Obfuscation techniques

**Document findings in:**
```
~/.claude/History/research/YYYY-MM-DD_[client]-direct-injection/
├── findings.md
├── successful-payloads.md
├── poc-screenshots/
└── impact-analysis.md
```

### Phase 4: Indirect Injection Testing (2-3 hours)

**Use IndirectInjectionTesting workflow:**
`~/.claude/skills/PromptInjection/Workflows/IndirectInjectionTesting.md`

**Test all vectors:**
1. Document upload injection
2. Web scraping/URL processing
3. RAG system poisoning (if applicable)
4. API response poisoning
5. Email content injection (if applicable)
6. Social media injection (if applicable)

**Document findings in:**
```
~/.claude/History/research/YYYY-MM-DD_[client]-indirect-injection/
├── findings.md
├── poisoned-documents/
├── test-web-pages/
└── rag-poisoning-results.md
```

### Phase 5: Multi-Stage Attack Testing (1-2 hours)

**Use MultiStageAttacks workflow:**
`~/.claude/skills/PromptInjection/Workflows/MultiStageAttacks.md`

**Test patterns:**
1. Progressive escalation
2. Context poisoning + memory implantation
3. Trust building → compliance → exploitation
4. Layered evasion
5. Technique chaining

**Document full conversations:**
```
~/.claude/History/research/YYYY-MM-DD_[client]-multistage/
├── attack-chain-1-transcript.md
├── attack-chain-2-transcript.md
├── successful-patterns.md
└── defense-thresholds.md
```

### Phase 6: Defense Analysis (1 hour)

**Evaluate implemented defenses:**

1. **Input sanitization**
   - What filtering is applied?
   - Where does it fail?
   - What bypasses work?

2. **Output filtering**
   - Are responses filtered?
   - What leaks through?
   - Detection accuracy?

3. **Architectural defenses**
   - Privilege isolation?
   - Sandboxing?
   - Instruction/data separation?

4. **Detection systems**
   - Are attacks detected?
   - Alert thresholds?
   - False positive rate?

**Document in:**
```
~/.claude/History/research/YYYY-MM-DD_[client]-defenses/
├── defense-evaluation.md
├── effective-controls.md
└── defense-gaps.md
```

### Phase 7: Proof-of-Concept Development (1-2 hours)

**For top 5 findings, create:**

1. **Minimal reproduction steps**
2. **Video/screenshot evidence**
3. **Impact demonstration**
4. **Exploitation scenario**

**PoC format:**
```markdown
## [Vulnerability Title]

**Severity:** [Critical/High/Medium/Low]

**Vulnerability Type:** [Injection type]

**Location:** [URL/endpoint]

**Description:**
[Clear explanation of vulnerability]

**Reproduction Steps:**
1. [Step 1]
2. [Step 2]
...

**Proof of Concept:**
[Payload or attack sequence]

**Evidence:**
[Screenshots/logs/video]

**Impact:**
- [What can attacker do?]
- [What data is at risk?]
- [What systems are affected?]

**Remediation:**
[Specific fix recommendation]

**References:**
- OWASP LLM01: Prompt Injection
- [Relevant CVEs or advisories]
```

### Phase 8: Reporting (2-3 hours)

**Use Reporting workflow for structure:**
`~/.claude/skills/PromptInjection/Reporting.md`

**Report sections:**

1. **Executive Summary** (1 page)
   - Assessment overview
   - Key findings (3-5 critical items)
   - Risk summary
   - High-level recommendations

2. **Assessment Methodology** (1-2 pages)
   - Scope and authorization
   - Testing approach
   - Tools and techniques used
   - Timeline

3. **Detailed Findings** (bulk of report)
   - Vulnerabilities by severity
   - Full technical details
   - Reproduction steps
   - Evidence (screenshots, logs)
   - Impact analysis

4. **Remediation Recommendations** (2-3 pages)
   - Prioritized fixes
   - Defense-in-depth strategies
   - Short-term vs long-term recommendations
   - Implementation guidance

5. **Appendix**
   - Attack taxonomy reference
   - Complete payload list
   - Tool documentation
   - Compliance mapping (OWASP, NIST)

**Deliverables:**
```
~/.claude/History/research/YYYY-MM-DD_[client]-final-report/
├── executive-summary.md
├── full-technical-report.md
├── findings-by-severity.md
├── remediation-roadmap.md
├── evidence/
│   ├── screenshots/
│   ├── videos/
│   └── logs/
└── appendix/
```

### Phase 9: Client Presentation (1 hour)

**Prepare presentation:**

1. **Findings overview** (10-15 slides)
   - Key vulnerabilities
   - Demo/proof-of-concept
   - Risk assessment
   - Remediation priorities

2. **Q&A preparation**
   - Anticipate technical questions
   - Prepare additional evidence
   - Have references ready

3. **Remediation discussion**
   - Implementation timelines
   - Resource requirements
   - Retest planning

## Total Time Estimate

**Comprehensive assessment:** 12-20 hours

**Time breakdown:**
- Authorization & scoping: 0.5 hours
- Reconnaissance: 1-2 hours
- Direct injection: 2-3 hours
- Indirect injection: 2-3 hours
- Multi-stage attacks: 1-2 hours
- Defense analysis: 1 hour
- Proof-of-concept: 1-2 hours
- Reporting: 2-3 hours
- Client presentation: 1 hour

## Quality Checklist

**Before finalizing assessment:**

- [ ] All scope areas tested
- [ ] All 10 attack categories attempted
- [ ] Successful attacks have PoCs
- [ ] All findings severity-rated
- [ ] Defense analysis completed
- [ ] Remediation recommendations provided
- [ ] Client-ready report generated
- [ ] Evidence organized and archived
- [ ] Presentation prepared
- [ ] Follow-up retest planned

## Post-Assessment

**After delivery:**

1. **Archive all materials**
   - Full testing data
   - Client communications
   - Authorization documents
   - Delivered reports

2. **Lessons learned**
   - What techniques worked best?
   - What defenses were effective?
   - How to improve methodology?

3. **Follow-up support**
   - Answer client questions
   - Clarify findings
   - Review remediation plans
   - Schedule retest

## Integration with Resources

**Required reading:**
- Attack taxonomy: `COMPREHENSIVE-ATTACK-TAXONOMY.md`
- Testing tools: `AUTOMATED-TESTING-TOOLS.md`
- Defense guide: `DEFENSE-MECHANISMS.md`
- Quick start: `QuickStartGuide.md`

## Success Criteria

Assessment is complete when:
- [ ] Written authorization verified
- [ ] Full attack surface tested
- [ ] All findings documented with PoCs
- [ ] Impact analysis completed
- [ ] Remediation recommendations delivered
- [ ] Professional report provided
- [ ] Client presentation completed
- [ ] Retest scheduled (if needed)

**This workflow represents the gold standard for comprehensive prompt injection security assessments.**
