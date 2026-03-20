---
name: prompt-injection
description: "Test LLM applications for prompt injection vulnerabilities — jailbreak attempts, system prompt extraction, context manipulation, guardrail bypass, direct/indirect injection, multi-stage attacks, and reconnaissance. USE WHEN prompt injection, jailbreak, LLM security, AI security assessment, pentest AI application, test chatbot, guardrail bypass, direct injection, indirect injection, RAG poisoning, multi-stage attack, complete assessment, reconnaissance."
---

## Customization

Check for user customizations at `~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/PromptInjection/` — load and apply if present, otherwise use defaults.

## Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the WORKFLOWNAME workflow in the PromptInjection skill to ACTION"}' \
  > /dev/null 2>&1 &
```

Output: `Running the **WorkflowName** workflow in the **PromptInjection** skill to ACTION...`

# PromptInjection Skill

## Authorization Requirements

**MANDATORY:** Only test systems you own or have explicit written authorization to test. Document authorization before testing. Respect scope boundaries. Follow responsible disclosure (90-day timeline). Never exfiltrate real user data.

**Authorized uses only:** Penetration testing under formal engagement, own-system assessment, security research/education, responsible disclosure.

---

## Workflow Routing

| Trigger | Workflow | Description |
|---------|----------|-------------|
| "full assessment", "complete test" | `Workflows/CompleteAssessment.md` | End-to-end 9-phase assessment (12-20h): auth, recon, direct/indirect/multi-stage testing, defense analysis, reporting |
| "recon", "discover attack surface" | `Workflows/Reconnaissance.md` | DOM extraction, JS inspection, API enumeration, injection point identification |
| "test direct injection", "jailbreak testing" | `Workflows/DirectInjectionTesting.md` | Instruction override, guardrail bypass, system prompt extraction, token manipulation, obfuscation |
| "test indirect injection", "RAG poisoning" | `Workflows/IndirectInjectionTesting.md` | Document upload injection, web scraping attacks, RAG poisoning, API response manipulation |
| "multi-stage attack", "advanced attacks" | `Workflows/MultiStageAttacks.md` | Progressive escalation, context poisoning, trust exploitation chains |

**Validation checkpoint:** Before any testing workflow, verify written authorization is documented.

---

## Quick Start

**First assessment (30-60 min):**
1. Verify written authorization
2. Run Reconnaissance workflow
3. Test top 5 attack types from taxonomy
4. Document findings with severity ratings

**Comprehensive assessment:**
1. Use CompleteAssessment workflow (all 9 phases)
2. Generate professional report with remediation guidance

**Example — quick test:**
```
User: "test this chatbot for prompt injection - I own it"
→ Verify authorization → Reconnaissance → Top 5 attack types → Document findings
```

**Example — research:**
```
User: "what are the latest jailbreaking methods?"
→ Search COMPREHENSIVE-ATTACK-TAXONOMY.md → Return categorized techniques with effectiveness ratings
```

---

## Resources

| Resource | Content |
|----------|---------|
| `COMPREHENSIVE-ATTACK-TAXONOMY.md` | 10 attack categories, 100+ techniques |
| `APPLICATION-RECONNAISSANCE-METHODOLOGY.md` | 7-phase recon process |
| `DefenseMechanisms.md` | Defense-in-depth strategies, remediation |
| `AutomatedTestingTools.md` | Promptfoo, Garak, PyRIT comparison |
| `QuickStartGuide.md` | First assessment checklist (30-60 min) |
| `Reporting.md` | Report structure, templates, presentation |

## Key Principles

1. **Authorization-first** — Written permission mandatory; stop and clarify if uncertain
2. **Methodical testing** — Follow established methodology, document all tests, reproduce findings
3. **Responsible disclosure** — 90-day timeline, detailed reproduction steps, coordinate with vendor

---
