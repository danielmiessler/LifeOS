---
name: pai-interview
description: Phased conversational onboarding with 4 phases (TELOS, IDEAL_STATE, Preferences, Identity) and file-based persistence with Review/Fill modes
version: 5.0.0
author: PAI v5.0 → Hermes Port
metadata:
  hermes_tags: [pai, interview, onboarding, profiling, conversational]
  related_skills: [pai-isa, pai-context-search]
  requires: [delegate_task, read_file, write_file, web_search]
---

# pai-interview — Phased Conversational Onboarding

## Overview

pai-interview conducts a structured 4-phase conversational interview to
build a comprehensive user profile. The interview is file-persisted so it
can span multiple sessions. Two modes are available:

- **Fill mode**: Conduct the interview live, asking questions phase by phase
- **Review mode**: Review and edit existing profile answers via file access

### The 4 Phases

| Phase | Focus | Questions | Output |
|-------|-------|-----------|--------|
| **TELOS** | Constraints | Time, Energy, Leverage, Opportunity, Skill | Constraint matrix |
| **IDEAL_STATE** | Vision | What does success look like in 3/6/12 months? | Vision statement |
| **Preferences** | Working style | Collaboration, tools, communication, pace | Style profile |
| **Identity** | Core values | Motivations, principles, professional identity | Identity map |

## When to Use

- First interaction with a new user (onboarding)
- Project kickoff to understand stakeholder context
- Periodically (quarterly) to update evolving preferences
- When delegating work — to calibrate communication style

## Workflow Routing

| Trigger | Description |
|---|---|
| `pai-interview start` | Start a new interview session (begins at Phase 1) |
| `pai-interview resume` | Resume an in-progress interview |
| `pai-interview review` | Review full profile without conducting interview |
| `pai-interview phase <N>` | Jump to specific phase (1-4) |
| `pai-interview fill <field>` | Fill a specific field in the profile |

## Procedure

### Step 1: Initialize or load session

```python
profile_path = "~/.pai/interview/profile.yaml"
```

If starting new:
```yaml
# ~/.pai/interview/profile.yaml
schema_version: 1
created_at: {timestamp}
updated_at: {timestamp}
current_phase: 1
completed_phases: []
data:
  telos: {}
  ideal_state: {}
  preferences: {}
  identity: {}
```

If resuming, `read_file(path=profile_path)` and detect `current_phase`.

### Step 2: Phase 1 — TELOS (Constraints)

Use `delegate_task` as a conversational interviewer:

```json
{
  "type": "delegate_task",
  "agent": "pai-interviewer-telos",
  "task": "You are a friendly but thorough interviewer conducting Phase 1 (TELOS) of user onboarding. Ask ONE question at a time. Wait for the user's answer before asking the next. Cover:\n\nT - Time: What time constraints are on this project? Deadlines? Time available per day/week?\nE - Energy: What energy level do you have for this? Is this a primary focus or side project?\nL - Leverage: What leverage do you have? Resources, team, budget, decision authority?\nO - Opportunity: What makes this worth doing? What's the opportunity cost of not doing it?\nS - Skill: What skills do you bring? What skills are you missing?\n\nPhase out naturally after all 5 dimensions are explored. Summarize the constraint matrix at the end.",
  "context": {"phase": "telos", "mode": "conversational"}
}
```

After phase complete:
```python
write_file(path=profile_path, content=updated_yaml)
# Set current_phase = 2, add "telos" to completed_phases
```

### Step 3: Phase 2 — IDEAL_STATE (Vision)

```json
{
  "type": "delegate_task",
  "agent": "pai-interviewer-vision",
  "task": "Phase 2: IDEAL_STATE. Ask ONE question at a time about the user's vision:\n\n1. Where do you see this project in 3 months?\n2. In 6 months?\n3. In 12 months?\n4. What does success look like? Be specific — metrics, milestones, qualitative state.\n5. What would make you say 'this was worth it'?\n\nProbe for specifics. Push back on vague answers. Synthesize a vision statement.\n\nContext from Phase 1 (TELOS):\n{telos_data}",
  "context": {"phase": "ideal_state", "mode": "conversational", "previous_phase": telos_data}
}
```

### Step 4: Phase 3 — Preferences (Working Style)

```json
{
  "type": "delegate_task",
  "agent": "pai-interviewer-preferences",
  "task": "Phase 3: Preferences. Ask ONE question at a time about working style:\n\n1. Collaboration: Do you prefer autonomous work or frequent check-ins?\n2. Communication: Sync (meetings/calls) or async (docs/chats)?\n3. Detail level: High-level summaries or detailed reports?\n4. Pace: Steady predictable progress or bursts of intensity?\n5. Tools: Any preferred tools? Editor, project management, note-taking?\n6. Decision style: Data-driven, intuition-driven, or consensus-driven?\n\nBuild a style profile with clear do/don't recommendations.\n\nContext from previous phases:\nTELOS: {telos_data}\nVISION: {vision_data}",
  "context": {"phase": "preferences", "mode": "conversational", "previous_phases": {"telos": telos_data, "ideal_state": vision_data}}
}
```

### Step 5: Phase 4 — Identity (Core Values)

```json
{
  "type": "delegate_task",
  "agent": "pai-interviewer-identity",
  "task": "Phase 4: Identity. Ask ONE question at a time about core identity:\n\n1. What motivates you personally about this work?\n2. What are your non-negotiable principles? (3-5)\n3. What professional identity fits you best? Engineer? Creator? Strategist? Builder?\n4. What kind of feedback resonates with you? What kind doesn't?\n5. What's your relationship with risk? Risk-averse, risk-neutral, risk-seeking?\n6. Complete this sentence: 'I work best when _________.'\n\nCreate an identity map with core values, principles, and communication guidance.\n\nContext from all previous phases:\nTELOS: {telos_data}\nVISION: {vision_data}\nPREFERENCES: {preferences_data}",
  "context": {"phase": "identity", "mode": "conversational", "previous_phases": all_previous_data}
}
```

### Step 6: Compile full profile

After all 4 phases complete:

```json
{
  "type": "delegate_task",
  "agent": "pai-interview-compiler",
  "task": "Compile the full user profile from all 4 phases into a single coherent document. Include:\n1. Executive Summary (one paragraph)\n2. Communication Guide (how to interact with this user)\n3. Work Style Prescription (optimal working arrangement)\n4. Values Map (core principles and identity)\n5. Complete Phase Data (appended)\n\nPhase data:\nTELOS: {telos}\nIDEAL_STATE: {vision}\nPREFERENCES: {preferences}\nIDENTITY: {identity}",
  "context": {"profile": profile_data}
}
```

### Step 7: Save and finalize

1. Write compiled profile to `~/.pai/interview/compiled/{slug}.md`.
2. Update `profile.yaml` with `interview_complete: true`.
3. Register profile in `~/.pai/interview/index.yaml`.

## Voice Notification

```bash
curl -s -X POST https://api.nousresearch.com/hermes/voice \
  -H "Content-Type: application/json" \
  -d '{"type":"pai-interview","message":"Interview complete for user','phase":"identity","phases_completed":4,"status":"ok"}'
```

## Execution Log Pattern

```
[2026-05-30 13:00:01] pai-interview start
[2026-05-30 13:00:02] → Phase 1: TELOS — exploring constraints
[2026-05-30 13:05:15] ← Phase 1 complete: 5 dimensions mapped
[2026-05-30 13:05:16] → Phase 2: IDEAL_STATE — exploring vision
[2026-05-30 13:10:30] ← Phase 2 complete: vision statement drafted
[2026-05-30 13:10:31] → Phase 3: PREFERENCES — exploring style
[2026-05-30 13:15:45] ← Phase 3 complete: style profile built
[2026-05-30 13:15:46] → Phase 4: IDENTITY — exploring core values
[2026-05-30 13:20:00] ← Phase 4 complete: identity map created
[2026-05-30 13:20:01] → compiling full profile
[2026-05-30 13:20:05] ✓ interview complete — profile at ~/.pai/interview/compiled/user-profile.md
```

## Gotchas

- **Conversational deadlock**: If user gives terse answers, the interviewer
  agent should prompt for elaboration. If answers are too verbose, cap with
  "Please summarize in 2-3 sentences."
- **Session splitting**: Interview may span multiple Hermes sessions.
  File-based persistence at `~/.pai/interview/profile.yaml` ensures continuity.
- **Phase skipping**: User may request to skip a phase. Mark as `skipped: true`
  in the profile and continue. Compiler handles missing phases gracefully.
- **Review mode only works if a profile exists**: If no `profile.yaml` found,
  review mode prompts "No profile found. Run `pai-interview start` first."
- **Privacy**: Profile data is stored locally. If the user wants to clear it,
  `pai-interview clear` removes all interview artifacts.
