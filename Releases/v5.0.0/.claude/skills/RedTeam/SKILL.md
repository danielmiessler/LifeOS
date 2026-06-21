---
name: RedTeam
description: "Military-grade adversarial analysis that deploys 32 parallel expert agents (engineers, architects, pentesters, interns) to stress-test ideas, strategies, and plans — not systems or infrastructure. Two workflows: ParallelAnalysis (5-phase: decompose into 24 atomic claims → 32-agent parallel attack → synthesis → steelman → counter-argument, each 8 points) and AdversarialValidation (competing proposals synthesized into best solution). Context files: Philosophy.md (core principles, success criteria, agent types), Integration.md (how to combine with FirstPrinciples, Council, and other skills; output format). Targets arguments, not network vulnerabilities. Findings ranked by severity; goal is to strengthen, not destroy — weaknesses delivered with remediation paths. Collaborates with FirstPrinciples (decompose assumptions before attacking) and Council (Council debates to find paths; RedTeam attacks whatever survives). Also invoked internally by Ideate (TEST phase) and WorldThreatModel (horizon stress-testing). NOT FOR AI instruction set auditing (use BitterPillEngineering). NOT FOR network/system vulnerability testing (use a security assessment skill). USE WHEN red team, attack idea, counterarguments, critique, stress test, devil's advocate, find weaknesses, break this, poke holes, what could go wrong, strongest objection, adversarial validation, battle of bots."
effort: high
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/RedTeam/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# RedTeam Skill

Military-grade adversarial analysis using parallel agent deployment. Breaks arguments into atomic components, attacks from 32 expert perspectives (engineers, architects, pentesters, interns), synthesizes findings, and produces devastating counter-arguments with steelman representations.

## Workflow Routing

Route to the appropriate workflow based on the request.

**When executing a workflow, output this notification directly:**

```
Running the **WorkflowName** workflow in the **RedTeam** skill to ACTION...
```

| Trigger | Workflow |
|---------|----------|
| Red team analysis (stress-test existing content) | `Workflows/ParallelAnalysis.md` |
| Adversarial validation (produce new content via competition) | `Workflows/AdversarialValidation.md` |

---

## Quick Reference

| Workflow | Purpose | Output |
|----------|---------|--------|
| **ParallelAnalysis** | Stress-test existing content | Steelman + Counter-argument (8-points each) |
| **AdversarialValidation** | Produce new content via competition | Synthesized solution from competing proposals |

**The Five-Phase Protocol (ParallelAnalysis):**
1. **Decomposition** - Break into 24 atomic claims
2. **Parallel Analysis** - 32 agents examine strengths AND weaknesses
3. **Synthesis** - Identify convergent insights
4. **Steelman** - Strongest version of the argument
5. **Counter-Argument** - Strongest rebuttal

---

## Context Files

- `Philosophy.md` - Core philosophy, success criteria, agent types
- `Integration.md` - Skill integration, FirstPrinciples usage, output format

---

## Examples

**Attack an architecture proposal:**
```
User: "red team this microservices migration plan"
--> Workflows/ParallelAnalysis.md
--> Returns steelman + devastating counter-argument (8 points each)
```

**Devil's advocate on a business decision:**
```
User: "poke holes in my plan to raise prices 20%"
--> Workflows/ParallelAnalysis.md
--> Surfaces the ONE core issue that could collapse the plan
```

**Adversarial validation for content:**
```
User: "battle of bots - which approach is better for this feature?"
--> Workflows/AdversarialValidation.md
--> Synthesizes best solution from competing ideas
```

---

**Last Updated:** 2025-12-20

## Gotchas

- **RedTeam is for attacking IDEAS, not systems.** This skill finds flaws in arguments, strategies, and plans — not network vulnerabilities.
- **32 adversarial agents generate volume — not all findings are equal.** Rank by severity, discard noise.
- **The goal is to strengthen, not destroy.** Present weaknesses constructively with remediation paths.

## Execution Log

After completing any workflow, append a single JSONL entry:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"RedTeam","workflow":"WORKFLOW_USED","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> ~/.claude/PAI/MEMORY/SKILLS/execution.jsonl
```

Replace `WORKFLOW_USED` with the workflow executed, `8_WORD_SUMMARY` with a brief input description, and `SECONDS` with approximate wall-clock time. Log `status: "error"` if the workflow failed.
