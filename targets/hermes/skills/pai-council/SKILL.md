---
name: pai-council
description: Multi-agent collaborative debate with 4 parallel personas, 3 rounds of round-by-round context passing, and synthesis
version: 5.0.0
author: PAI v5.0 → Hermes Port
metadata:
  hermes_tags: [pai, council, debate, multi-agent, synthesis]
  related_skills: [pai-research, pai-isa, pai-loop]
  requires: [delegate_task, read_file, write_file]
---

<!-- Voice notification — fire-and-forget on invocation -->
```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the pai-council skill"}' \
  > /dev/null 2>&1 &
```


# pai-council — Multi-Agent Collaborative Debate

## Overview

pai-council runs a structured multi-agent debate among 4 parallel agents,
each with a distinct persona. The debate spans 3 rounds with round-by-round
context passing, culminating in a synthesis step that produces a final
resolution document.

Personas:
1. **Strategist** — big-picture thinker, systems-level, long-term implications
2. **Skeptic** — devil's advocate, risk-focused, finds flaws and edge cases
3. **Builder** — pragmatic, implementation-focused, cost-aware, timeline-aware
4. **Explorer** — creative, blue-sky, novel approaches, cross-domain analogies

## When to Use

- Complex decisions requiring multiple perspectives
- Architecture reviews and design critiques
- Strategic planning with competing priorities
- Any time a single-perspective answer is insufficient

## Workflow Routing

| Trigger | Description |
|---|---|
| `pai-council debate "topic"` | Full debate: 4 personas × 3 rounds + synthesis |
| `pai-council round "topic" --round 1` | Single round (for resuming interrupted debates) |
| `pai-council synthesize "transcript"` | Synthesis only from existing transcript |

## Procedure

### Step 1: Validate and prepare

1. Parse topic and optional constraints from arguments.
2. Load or create a debate session file at `~/.pai/council/sessions/{slug}.json`.
3. If resuming, load existing transcript from session file.

### Step 2: Spawn 4 parallel agents (Round 1)

Use `delegate_task` in parallel for all 4 personas:

```json
[{
  "type": "delegate_task",
  "agent": "pai-council-strategist",
  "task": "You are the Strategist persona. Approach this topic with big-picture systems thinking. Consider long-term implications, second-order effects, and strategic alignment.\n\nTopic: {topic}",
  "context": {"round": 1, "persona": "strategist", "topic": topic}
},
{
  "type": "delegate_task",
  "agent": "pai-council-skeptic",
  "task": "You are the Skeptic persona. Your job is to find flaws, risks, and edge cases. Be constructively critical — raise real concerns, not nitpicks.\n\nTopic: {topic}",
  "context": {"round": 1, "persona": "skeptic", "topic": topic}
},
{
  "type": "delegate_task",
  "agent": "pai-council-builder",
  "task": "You are the Builder persona. Focus on practical implementation: cost, timeline, dependencies, feasibility. What would it take to build this?\n\nTopic: {topic}",
  "context": {"round": 1, "persona": "builder", "topic": topic}
},
{
  "type": "delegate_task",
  "agent": "pai-council-explorer",
  "task": "You are the Explorer persona. Think creatively — novel approaches, cross-domain analogies, blue-sky possibilities. What's the most innovative angle?\n\nTopic: {topic}",
  "context": {"round": 1, "persona": "explorer", "topic": topic}
}]
```

### Step 3: Context bundle for Round 2

Concatenate all 4 Round 1 outputs into a single `round1_transcript`.
Save to session file.

### Step 4: Spawn 4 parallel agents (Round 2)

Each persona now sees the other personas' Round 1 positions and responds:

```json
[{
  "type": "delegate_task",
  "agent": "pai-council-strategist",
  "task": "Round 2: Respond to the other personas' Round 1 positions. Update or defend your stance. Point out where you agree, disagree, or where new synthesis emerges.\n\nYour Round 1: {r1_strategist}\nSkeptic said: {r1_skeptic}\nBuilder said: {r1_builder}\nExplorer said: {r1_explorer}\n\nTopic: {topic}",
  "context": {"round": 2, "persona": "strategist", "transcript": round1_transcript}
},
...  // Same pattern for skeptic, builder, explorer
]
```

### Step 5: Context bundle for Round 3

Concatenate all 4 Round 2 outputs. Each persona now sees the full
evolution of the debate across both previous rounds.

### Step 6: Spawn 4 parallel agents (Round 3)

```json
[{
  "type": "delegate_task",
  "agent": "pai-council-strategist",
  "task": "Round 3 — Final Position: After hearing all perspectives across Rounds 1 and 2, state your final refined position. What has changed? What new synthesis has emerged?\n\nFull debate transcript:\n{full_transcript_r1_r2}",
  "context": {"round": 3, "persona": "strategist", "transcript": full_transcript_r1_r2}
},
... // Same pattern for all 4 personas
]
```

### Step 7: Synthesis

Collect all 4 Round 3 outputs. Use a final `delegate_task` to synthesize:

```json
{
  "type": "delegate_task",
  "agent": "pai-council-synthesizer",
  "task": "You are the Synthesis agent. From the 3-round debate transcript below, produce a final resolution:\n1. Areas of Agreement — where all personas converged\n2. Points of Tension — where disagreement remains, with reasoning from both sides\n3. Synthesis — a nuanced position that incorporates the strongest arguments from each persona\n4. Action Items — concrete next steps with owners (by persona)\n\nFull 3-round transcript:\n{full_transcript}"
}
```

### Step 8: Save results

1. Write synthesis to `~/.pai/council/results/{slug}.synthesis.md`.
2. Write full transcript to `~/.pai/council/transcripts/{slug}.json`.
3. Remove session file (debate complete).

## Voice Notification

```bash
curl -s -X POST https://api.nousresearch.com/hermes/voice \
  -H "Content-Type: application/json" \
  -d '{"type":"pai-council","message":"Council debate complete for topic '"'"'auth architecture'"'"'","path":"~/.pai/council/results/auth-architecture.synthesis.md","status":"ok"}'
```

## Execution Log Pattern

```
[2026-05-30 11:00:01] pai-council debate "auth architecture for next gen"
[2026-05-30 11:00:02] → spawning 4 personas for Round 1
[2026-05-30 11:00:10] ← all 4 Round 1 responses received
[2026-05-30 11:00:11] → spawning 4 personas for Round 2 (with cross-context)
[2026-05-30 11:00:19] ← all 4 Round 2 responses received
[2026-05-30 11:00:20] → spawning 4 personas for Round 3 (final positions)
[2026-05-30 11:00:28] ← all 4 Round 3 responses received
[2026-05-30 11:00:29] → synthesizing final resolution
[2026-05-30 11:00:35] ✓ council debate complete — resolution at ~/.pai/council/results/auth-architecture.synthesis.md
```

## Gotchas

- **Debate drift**: Personas may drift from their assigned perspective over
  3 rounds. Each round's prompt should re-anchor the persona's core stance.
- **Token budget**: 4 agents × 3 rounds × potentially lengthy responses = large
  token usage. Consider capping response length in the delegate_task prompt.
- **Synthesis bias**: The synthesis agent may overweight certain personas.
  Request explicit attribution ("Strategist argued X") in synthesis output.
- **Session persistence**: If interrupted mid-debate, the session file at
  `~/.pai/council/sessions/{slug}.json` preserves all completed rounds.
  Use `pai-council round "topic" --round N` to resume from any round.
- **Cold start**: If no session file exists, Round 1 personas have no context
  beyond the topic. This is intentional — first impressions are valuable.
