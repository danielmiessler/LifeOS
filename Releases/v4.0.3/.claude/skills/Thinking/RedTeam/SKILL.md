---
name: red-team
description: 32 adversarial agents to destroy weak arguments and find fatal flaws — parallel analysis and adversarial validation. USE WHEN red team, attack idea, counterarguments, critique, stress test, poke holes, devil's advocate, find weaknesses, break this, parallel analysis, adversarial validation.
---

## Customization

Check for user customizations at `~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/RedTeam/` — if present, load and apply overrides before proceeding.

## Notification

```bash
curl -s -X POST http://localhost:8888/notify -H "Content-Type: application/json" -d '{"message": "Running the WORKFLOWNAME workflow in the RedTeam skill to ACTION"}' > /dev/null 2>&1 &
```

# RedTeam Skill

Adversarial analysis using 32 parallel expert agents. Breaks arguments into atomic components, attacks from multiple perspectives, and produces steelman representations with devastating counter-arguments.

## Workflow Routing

| Trigger | Workflow | Output |
|---------|----------|--------|
| Red team analysis (stress-test existing content) | `Workflows/ParallelAnalysis.md` | Steelman + Counter-argument (8-points each) |
| Adversarial validation (produce new content via competition) | `Workflows/AdversarialValidation.md` | Synthesized solution from competing proposals |

## Five-Phase Protocol (ParallelAnalysis)

1. **Decomposition** — Break into 24 atomic claims
2. **Parallel Analysis** — 32 agents examine strengths AND weaknesses
3. **Synthesis** — Identify convergent insights
4. **Steelman** — Strongest version of the argument
5. **Counter-Argument** — Strongest rebuttal

## Context Files

- `Philosophy.md` — Core philosophy, success criteria, agent types
- `Integration.md` — Skill integration, FirstPrinciples usage, output format

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

