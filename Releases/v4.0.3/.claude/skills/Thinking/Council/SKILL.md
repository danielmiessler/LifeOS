---
name: council
description: "Multi-agent debate with visible transcripts where agents respond to each other — collaborative-adversarial discussion to find best path. USE WHEN council, debate, perspectives, weigh options, deliberate, multiple viewpoints."
---

## Customization

Check for user customizations at `~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/Council/` — load and apply if present, otherwise use defaults.

## Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the WORKFLOWNAME workflow in the Council skill to ACTION"}' \
  > /dev/null 2>&1 &
```

Output: `Running the **WorkflowName** workflow in the **Council** skill to ACTION...`

# Council Skill

Multi-agent debate: specialized agents discuss in rounds, respond to each other, surface insights through intellectual friction. **Unlike RedTeam** (purely adversarial), Council is collaborative-adversarial with visible conversation transcripts.

## Workflow Routing

| Trigger | Workflow | Rounds | Output |
|---------|----------|--------|--------|
| Full structured debate | `Workflows/Debate.md` | 3 | Complete transcript + synthesis |
| Quick consensus check | `Workflows/Quick.md` | 1 | Initial positions only |
| Pure adversarial analysis | RedTeam skill | — | Steelman + counter-argument |

**Validation checkpoint:** After each round, verify agents responded to each other's specific points before proceeding to the next round.

## Context Files

| File | Content |
|------|---------|
| `CouncilMembers.md` | Agent roles, perspectives, voice mapping |
| `RoundStructure.md` | Three-round debate structure and timing |
| `OutputFormat.md` | Transcript format templates |

## Speed

Parallel execution within rounds, sequential between rounds. 3-round debate of 4 agents = 12 agent calls, 3 sequential waits. Completes in 30-90 seconds.

## Examples

```
"Council: Should we use WebSockets or SSE?"
→ DEBATE workflow → 3-round transcript with synthesis

"Quick council check: Is this API design reasonable?"
→ QUICK workflow → Fast perspectives from all agents

"Council with security: Evaluate this auth approach"
→ DEBATE with Security agent added to panel
```

## Integration

- **RedTeam** — Pure adversarial attack after collaborative discussion
- **Development** — Before major architectural decisions
- **Research** — Gather context before convening the council

## Best Practices

1. Use QUICK for sanity checks, DEBATE for important decisions
2. Add domain-specific experts as needed
3. Insights are in the agent responses to each other, not just initial positions
4. Trust multi-agent convergence when it occurs
