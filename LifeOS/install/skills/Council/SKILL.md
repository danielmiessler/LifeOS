---
name: Council
version: 1.1.18
description: "Multi-agent collaborative debate producing visible round-by-round transcripts with real intellectual friction — members are topic-briefed custom agents, run as a 3-round DEBATE or a 1-round QUICK check, to find the best path. USE WHEN council, debate, multiple perspectives, weigh options, deliberate, get different views, what would experts say, pros and cons. NOT FOR pure adversarial attack (use RedTeam)."
effort: high
context: fork
---

## Customization

**Before executing, check for user customizations at:**
`{{LIFEOS_DIR}}/USER/CUSTOMIZATIONS/SKILLS/Council/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.


## MANDATORY: Voice Notification (REQUIRED BEFORE ANY ACTION)

**You MUST send this notification BEFORE doing anything else when this skill is invoked.**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:31337/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the WORKFLOWNAME workflow in the Council skill to ACTION"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running the **WorkflowName** workflow in the **Council** skill to ACTION...
   ```

**This is not optional. Execute this curl command immediately upon skill invocation.**

# Council Skill

## What It Does

Runs a multi-agent debate. Custom-composed agents discuss a topic over rounds, respond to each other's actual points, and surface insights through real intellectual friction. You get a visible round-by-round transcript plus a synthesis. DEBATE runs three rounds; QUICK runs one for a fast perspective check.

## The Problem

When you ask one model for an opinion, you get one frame and one set of blind spots. Asking for "pros and cons" gives you a flat list with no one actually pushing back. Real deliberation needs distinct experts who disagree on the merits and argue it out, so the weak parts of an idea get exposed before you commit. Generic built-in agents all sound the same and produce bland agreement; this skill composes topic-specific agents that create genuine friction.

## How It Works

Custom-composed agents discuss topics in rounds, respond to each other's points, and surface insights through intellectual friction.

## Members Are Custom Briefs

Write each council member inline as a short brief — a name, a role, a stance, and what they'll push on — then launch it with `subagent_type: "general-purpose"`. A bare built-in type with no persona is topic-ignorant and produces bland agreement. The friction comes from four *different* briefs, each with real domain expertise and a distinct analytical angle.

See `CouncilMembers.md` for the slot guidance and an example brief.

**Key Differentiator from RedTeam:** Council is collaborative-adversarial (debate to find best path), while RedTeam is purely adversarial (attack the idea). Council produces visible conversation transcripts; RedTeam produces steelman + counter-argument.


## Workflow Routing

Route to the appropriate workflow based on the request.

| Trigger | Workflow |
|---------|----------|
| Full structured debate (3 rounds, visible transcript) | `Workflows/Debate.md` |
| Quick consensus check (1 round, fast) | `Workflows/Quick.md` |

Pure adversarial analysis is not a Council workflow — redirect to the RedTeam skill.

## Quick Reference

| Workflow | Purpose | Rounds | Output |
|----------|---------|--------|--------|
| **DEBATE** | Full structured discussion | 3 | Complete transcript + synthesis |
| **QUICK** | Fast perspective check | 1 | Initial positions only |

## Context Files

| File | Content |
|------|---------|
| `CouncilMembers.md` | How to write council member briefs inline |
| `RoundStructure.md` | Three-round debate structure and timing |
| `OutputFormat.md` | Transcript format templates |

## Core Philosophy

**Origin:** Best decisions emerge from diverse perspectives challenging each other. Not just collecting opinions - genuine intellectual friction where domain-specific experts respond to each other's actual points.

**Agents:** Every council member is a custom brief you write for the topic, launched with `general-purpose`. This gives each member a distinct role, stance, and domain expertise. Generic agents produce generic debate; topic-specific briefs produce sharp, informed debate.

**Speed:** Parallel execution within rounds, sequential between rounds. A 3-round debate of 4 agents = 12 agent calls but only 3 sequential waits. Complete in 40-90 seconds.

## Examples

```
"Council: Should we use WebSockets or SSE?"
-> Write 4 member briefs (real-time architect, frontend-DX, ops skeptic, researcher)
-> DEBATE workflow -> 3-round transcript

"Quick council check: Is this API design reasonable?"
-> Write 4 member briefs with API-relevant roles
-> QUICK workflow -> Fast perspectives

"Council: Is AI overhyped?"
-> Write briefs: AI builder, security skeptic, pragmatic engineer, evidence analyst
-> DEBATE workflow -> 3-round transcript
```

## Integration

**Works well with:**
- **RedTeam** - Pure adversarial attack after collaborative discussion
- **Research** - Gather context before convening the council

## Best Practices

1. Use QUICK for sanity checks, DEBATE for important decisions
2. Write each member's brief around the specific topic, not a generic role
3. Give each member a distinct stance — four identical agents produce no friction

---

**Last Updated:** 2026-03-18

## Gotchas

- **Council members are inline briefs launched with `general-purpose` — there is no composition tool.** Write four different topic-specific briefs; don't launch bare built-in types with no persona.
- **Debates need genuine disagreement to be valuable.** If all agents agree, the topic may not warrant Council.
- **More agents ≠ better debate.** 4-6 well-briefed agents outperform 12 generic ones.

## Execution Log

After completing any workflow, append a single JSONL entry:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"Council","workflow":"WORKFLOW_USED","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> "${LIFEOS_DIR}/MEMORY/SKILLS/execution.jsonl"
```

Replace `WORKFLOW_USED` with the workflow executed, `8_WORD_SUMMARY` with a brief input description, and `SECONDS` with approximate wall-clock time. Log `status: "error"` if the workflow failed.
