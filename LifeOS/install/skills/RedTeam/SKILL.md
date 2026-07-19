---
name: RedTeam
version: 1.1.16
description: "Adversarial analysis deploying parallel expert agents to stress-test ideas, strategies, and plans — decomposes into atomic claims, attacks them, then steelmans and counter-argues, producing severity-ranked findings with remediation. USE WHEN red team, attack idea, counterarguments, critique, stress test, devil's advocate, find weaknesses, break this, poke holes, strongest objection. NOT FOR collaborative debate to find best path (use Council)."
effort: high
---

## Customization

**Before executing, check for user customizations at:**
`$LIFEOS_DIR/USER/CUSTOMIZATIONS/SKILLS/RedTeam/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.


## 🚨 MANDATORY: Voice Notification (REQUIRED BEFORE ANY ACTION)

**You MUST send this notification BEFORE doing anything else when this skill is invoked.**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:31337/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the WORKFLOWNAME workflow in the RedTeam skill to ACTION"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running the **WorkflowName** workflow in the **RedTeam** skill to ACTION...
   ```

**This is not optional. Execute this curl command immediately upon skill invocation.**

# RedTeam Skill

## What It Does

Attacks ideas, strategies, and plans to find their weak points before reality does. It breaks an argument into atomic claims, deploys many parallel expert agents (engineers, architects, pentesters, interns) to stress-test each one, then synthesizes the findings into a steelman of the argument plus the strongest counter-argument against it.

## The Problem

People fall in love with their own plans. Once you've committed to an idea, your brain hunts for reasons it works and skips past the reasons it doesn't — and the people around you are often too polite or too aligned to push hard. So flawed strategies sail through unchallenged until they fail in production, in the market, or in the meeting where someone finally asks the hard question. This skill is the hard question, run many ways at once: it attacks the argument deliberately and at volume so the weak points surface while they're still cheap to fix.

## How It Works

Military-grade adversarial analysis using parallel agent deployment. It breaks arguments into atomic components, attacks from many expert perspectives (engineers, architects, pentesters, interns), synthesizes findings, and produces sharp counter-arguments alongside the steelman version of the case. Targets arguments, not network vulnerabilities.

## Workflow Routing

Route to the appropriate workflow based on the request.

**When executing a workflow, output this notification directly:**

```
Running the **WorkflowName** workflow in the **RedTeam** skill to ACTION...
```

| Workflow | Trigger | File |
|----------|---------|------|
| ParallelAnalysis | Red team analysis (stress-test existing content) | `Workflows/ParallelAnalysis.md` |
| AdversarialValidation | Adversarial validation (produce new content via competition) | `Workflows/AdversarialValidation.md` |

---

## Quick Reference

| Workflow | Purpose | Output |
|----------|---------|--------|
| **ParallelAnalysis** | Stress-test existing content | Steelman + Counter-argument (8-points each) |
| **AdversarialValidation** | Produce new content via competition | Synthesized solution from competing proposals |

**The deliverable (ParallelAnalysis):** the strongest steelman of the argument and the strongest surviving counter-argument against it, each an 8-point story explanation (12-16 words per point), attacking real weaknesses not strawmen, ranked by severity.

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
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"RedTeam","workflow":"WORKFLOW_USED","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> $LIFEOS_DIR/MEMORY/SKILLS/execution.jsonl
```

Replace `WORKFLOW_USED` with the workflow executed, `8_WORD_SUMMARY` with a brief input description, and `SECONDS` with approximate wall-clock time. Log `status: "error"` if the workflow failed.
