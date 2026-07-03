---
last_updated: 2026-07-02
last_updated_by: kai
last_reviewed: 2026-07-02
last_reviewed_by: kai
convention: pai-freshness-v1
---

# LifeOS Core Components

LifeOS is a Life Operating System: it moves you from where you are now to where you want to be. Every task — shipping code, writing an essay, making a decision — is the same move, from **current state to ideal state**, pursued through verifiable iteration.

That one loop is built from a set of components. They fall into two tiers. The **unique features** are the parts that make LifeOS what it is — you won't find this combination anywhere else. The **supporting components** are the subsystems that make the unique ones work.

This doc is the canonical map. Each component links to its full reference.

---

## The Unique Features

The eight things that make LifeOS LifeOS.

### 1. Current State → Ideal State

The whole philosophy in one line: name where you are, name where you want to be, then close the gap with steps you can check. Ideal state is written down as testable criteria, so "done" can't drift — you either meet the criteria or you don't. Everything else in the system serves this move.

→ `LifeOs/LifeOsThesis.md`

### 2. The Algorithm

The centerpiece. A seven-phase engine — Observe, Think, Plan, Build, Execute, Verify, Learn — that takes a vague request, turns it into a hard-to-vary spec, and climbs toward it with verified iteration. It scales its own effort to the work: a fast lane for simple asks, full depth for hard ones. This is where current-state-to-ideal-state actually happens.

→ `Algorithm/AlgorithmSystem.md`

### 3. The Skill System

Self-activating, composable units of domain expertise. A skill is deterministic code wrapped in a natural-language trigger, so the right capability fires the moment you describe the task — no menu, no command to remember. There are over a hundred of them, and they compose.

→ `Skills/SkillSystem.md`

### 4. The Hook System

Deterministic lifecycle interception. Hooks run at fixed points across a session — before a tool call, after output, at session start and stop — and enforce the rules a model can't be trusted to remember every time. This is how the system stays honest: the guardrails are code, not good intentions.

→ `Hooks/HookSystem.md`

### 5. The Router System

Every prompt gets classified and routed. The router decides how much effort a request deserves and which model should handle it, so a quick lookup stays cheap and fast while a hard design problem gets the full engine and the strongest model. You never pick a mode — it picks for you.

→ `Router/RouterSystem.md`

### 6. Pulse

The Life Dashboard — the live surface onto the whole system. Pulse shows your current-to-ideal progress, what the system is working on right now, your memory and freshness state, and the health of every subsystem. It's how you *see* LifeOS run.

→ `Pulse/PulseSystem.md`

### 7. Custom Spinner Verbs

The small touch that makes the system feel alive. While LifeOS works, the statusline shows a custom animated working-verb — your own vocabulary, colors, and animation — alongside rotating tips about the system. A distinctive, personal detail most tools never bother with.

→ `Spinner/SpinnerSystem.md`

### 8. Custom Tooltips

Context where you need it. The dashboard's tooltips and freshness indicators explain what each number, chart, and badge means the moment you hover — so the surface teaches itself instead of sending you to a manual.

→ `Pulse/Tooltips.md`

---

## Supporting Components

The subsystems the unique features are built on.

### Memory

Memory that compounds across sessions. What the system learns about you and your work moves from active work into durable knowledge, so every session starts smarter than the last.

→ `Memory/MemorySystem.md`

### Agents

Parallel delegation. Hard work fans out to specialized agents — researchers, builders, adversarial reviewers — that run concurrently and report back, so the system thinks in parallel instead of one step at a time.

→ `Agents/AgentSystem.md`

### Voice

Spoken notifications. The system talks to you — phase transitions, completions, alerts — in a voice you choose, so you can stay in flow without watching the terminal.

→ `Notifications/NotificationSystem.md`

### Learning

Every run reflects on itself. What worked, what didn't, and what a smarter version would have done gets captured and fed back into how the system behaves next time.

→ `Memory/MemorySystem.md`

### Security

Privacy and safety are enforced, not assumed. Deterministic gates keep private data private, treat outside content as read-only, and block anything unsafe before it runs.

→ `Security/README.md`

---

## How they fit together

Current-state-to-ideal-state is the **why**. The Algorithm is the **engine** that runs it. Skills, hooks, and the router are the **machinery** that make each run capable, safe, and correctly-scoped. Pulse, spinner verbs, and tooltips are how you **see and feel** it. Memory, agents, voice, learning, and security are the **foundation** underneath. Together they're the whole of what makes LifeOS work.
