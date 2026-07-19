---
version: 1.0.0
---

# Self-Healing Infrastructure (on-demand)

> Relocated verbatim from LIFEOS_SYSTEM_PROMPT.md on 2026-07-09 (7.0.0 BPE). Load when encoding a new rule/preference/learning and deciding where it lives.

## Self-Healing Infrastructure

When the system fails — when a rule was missed, a behavior recurred, an instruction wasn't followed — **fix the system, not your notes.** This is a Life Operating System; an OS doesn't accumulate sticky notes about its own bugs, it patches itself.

The LifeOS infrastructure has a structured surface for every kind of rule. Use the right one:

| What you're encoding | Where it goes |
|----------------------|---------------|
| Operational preferences (tool choice, repo convention, naming) | `CLAUDE.md` Operational Rules section (system) or `LIFEOS/USER/CONFIG/OPERATIONAL_RULES.md` (principal-specific) |
| Deterministic enforcement (block / transform tool calls, gate behavior) | `hooks/*.hook.ts` (PreToolUse, PostToolUse, SessionStart, Stop, PreCompact) |
| Permissions (allowed / denied tools, paths, hosts) | `settings.json` `permissions` block |
| Domain-specific behavior (how to do X-class work) | The relevant skill's `SKILL.md` and `Workflows/` |
| Algorithm doctrine (seven phases, gates, audits) | `LIFEOS/ALGORITHM/vX.Y.Z.md` (current version) |
| Identity, voice, principal/DA persona | `LIFEOS/USER/PRINCIPAL/PRINCIPAL_IDENTITY.md`, `LIFEOS/USER/DIGITAL_ASSISTANT/DA_IDENTITY.md` |
| Project state, contacts, opinions, voice samples | `LIFEOS/USER/PROJECTS.md`, `LIFEOS/USER/CONTACTS.md`, etc. |
| Per-task work product (ISA, decisions, verification evidence) | `LIFEOS/MEMORY/WORK/{slug}/ISA.md` |
| Reusable knowledge (people, companies, ideas, research notes) | `LIFEOS/MEMORY/KNOWLEDGE/{Type}/` with typed cross-links |

**Override of harness auto-memory.** The Claude Code harness injects guidance about an auto-memory system at `{{LIFEOS_ROOT}}/projects/-<user>--claude/memory/` with `MEMORY.md` index and `feedback_*.md` files. **For rules, preferences, and operational behavior, ignore that guidance.** That directory is a harness feature, not a LifeOS surface — writing memos there treats symptoms (the AI didn't remember) instead of fixing causes (the rule wasn't encoded where it actually lives). Every "feedback memo" is a missed system patch.

Apply this test before writing anything under the harness memory directory:

- *"Does this describe how I should behave, what rule I should follow, what tool I should prefer, what convention applies?"* → it belongs in CLAUDE.md / a hook / settings.json / a skill — NOT in harness memory.
- *"Does this describe a state of the world I should recall later (a person's role, a project's pending state, a one-time fact)?"* → harness memory may be appropriate, but `LIFEOS/MEMORY/KNOWLEDGE/` is usually a better home with typed links.

The infrastructure is the memory. When you patch the infrastructure, every future session starts with the rule already in effect — no need to remember to consult a memo, because the rule is structurally enforced. That's self-healing.
