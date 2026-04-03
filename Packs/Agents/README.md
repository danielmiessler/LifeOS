---
name: Agents
pack-id: danielmiessler-agents-v1.0.0
version: 1.0.0
author: danielmiessler
description: Custom agent composition from traits, voices, and personalities -- dynamic specialists with unique identities for parallel work
type: skill
purpose-type: [agents, composition, orchestration, parallel-work]
platform: claude-code
dependencies: []
keywords: [agents, custom-agents, composition, traits, voice, personality, parallel, orchestration, subagent, dynamic-agents, named-agents]
---

# Agents

> Custom agent composition from traits, voices, and personalities -- spin up dynamic specialists with unique identities for any task.

---

## The Problem

When you need multiple AI perspectives on a problem, the default options are limited. You either get generic "Architect/Engineer/Designer" role labels with no real personality, or you manually write long prompts describing each agent you want. The results are bland, interchangeable, and forgettable. There is no system for:

- **Composing agents from reusable traits** -- mixing expertise, personality, and approach into unique combinations
- **Giving agents real voices** -- distinct speech patterns, prosody settings, and identifiable personalities
- **Scaling agent creation** -- spinning up 3 or 10 or 20 agents without hand-crafting each one
- **Persisting agents you like** -- saving a great agent composition for reuse across sessions

The fundamental issue: generic agent types produce generic output. Unique perspectives require unique agents.

---

## The Solution

The Agents skill is a complete agent composition and management system. It dynamically composes agents from a trait library (expertise + personality + approach), assigns each a unique voice with full prosody control, and launches them in parallel.

**Core capabilities:**

1. **Trait-based composition** -- Combine expertise areas (security, research, technical), personalities (skeptical, analytical, enthusiastic), and approaches (thorough, rapid, systematic) into unique agents
2. **Voice assignment** -- Each agent gets a distinct voice with ElevenLabs prosody settings (stability, style, speed)
3. **Named agents** -- Define persistent agent identities with backstories and custom voices
4. **Parallel orchestration** -- Launch multiple agents simultaneously for diverse perspectives on the same problem
5. **Save and reload** -- Persist great agent compositions for reuse across sessions

**Works standalone or enhanced by PAI's voice infrastructure.**

---

## Installation

This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using `INSTALL.md`.

**What is PAI?** See the [PAI Project Overview](https://github.com/danielmiessler/Personal_AI_Infrastructure#what-is-pai).

---

## What's Included

| Component | Path | Purpose |
|-----------|------|---------|
| Skill definition | `src/SKILL.md` | Main skill routing, configuration, and documentation |
| Trait library | `src/Data/Traits.yaml` | Base traits -- expertise, personalities, approaches, voice mappings |
| Composition engine | `src/Tools/ComposeAgent.ts` | Dynamic agent composition tool with save/load/delete |
| Agent context loader | `src/Tools/LoadAgentContext.ts` | Load saved agent profiles into context |
| Spawn with profile | `src/Tools/SpawnAgentWithProfile.ts` | Launch an agent using a saved profile |
| Tool dependencies | `src/Tools/package.json` | Node/Bun package configuration |
| Tool lockfile | `src/Tools/bun.lock` | Dependency lockfile |
| Dynamic agent template | `src/Templates/DynamicAgent.hbs` | Handlebars template for agent prompt generation |
| Custom agent template | `src/Templates/CUSTOMAGENTTEMPLATE.md` | Template for defining custom agent identities |
| Create custom agent | `src/Workflows/CreateCustomAgent.md` | Workflow for composing and launching custom agents |
| List traits | `src/Workflows/ListTraits.md` | Workflow for displaying available traits and voices |
| Spawn parallel agents | `src/Workflows/SpawnParallelAgents.md` | Workflow for launching multiple agents in parallel |
| Agent personalities | `src/AgentPersonalities.md` | Detailed personality definitions and voice mappings |
| Agent profile system | `src/AgentProfileSystem.md` | Architecture for persistent agent profiles |
| Architect context | `src/ArchitectContext.md` | Context definition for Architect agent type |
| Artist context | `src/ArtistContext.md` | Context definition for Artist agent type |
| Claude researcher | `src/ClaudeResearcherContext.md` | Context for Claude-based research agents |
| Codex researcher | `src/CodexResearcherContext.md` | Context for Codex-based research agents |
| Designer context | `src/DesignerContext.md` | Context definition for Designer agent type |
| Engineer context | `src/EngineerContext.md` | Context definition for Engineer agent type |
| Gemini researcher | `src/GeminiResearcherContext.md` | Context for Gemini-based research agents |
| Grok researcher | `src/GrokResearcherContext.md` | Context for Grok-based research agents |
| Perplexity researcher | `src/PerplexityResearcherContext.md` | Context for Perplexity-based research agents |
| QA tester context | `src/QATesterContext.md` | Context definition for QA tester agent type |
| Redesign summary | `src/REDESIGN-SUMMARY.md` | Architecture redesign notes |
| Scratchpad | `src/Scratchpad/` | Working notes and analysis files |

**Summary:**
- **Directories:** 5 (Data, Tools, Templates, Workflows, Scratchpad)
- **Files:** 22
- **Hooks registered:** 0
- **Dependencies:** Bun runtime (for TypeScript tools)

---

## What Makes This Different

This sounds similar to just telling the AI "pretend you're a security expert" which also creates a specialized perspective. What makes this approach different?

The Agents skill composes agents from a structured trait library rather than ad-hoc prompting. Each agent gets a unique combination of expertise, personality, and approach -- not just a role label. A "security expert with skeptical personality and thorough approach" behaves fundamentally differently from a "security expert with enthusiastic personality and rapid approach." The composition engine ensures every agent is genuinely distinct, with matched voice settings that reinforce its personality. Named agents persist across sessions so you build a relationship with agents you rely on.

- Trait-based composition produces genuinely unique agents, not role labels
- Voice prosody settings make agents sound different, not just think different
- Save/load lets you reuse great agents across sessions
- Parallel orchestration launches multiple distinct agents simultaneously
- User customization layer lets you add your own traits, voices, and named agents without touching base files

---

## Invocation Scenarios

| Trigger | What Happens |
|---------|--------------|
| "Spin up 3 custom security agents" | CreateCustomAgent workflow runs ComposeAgent 3 times with different trait combinations, launches in parallel |
| "What agent personalities can you create?" | ListTraits workflow displays merged base + user traits and available voices |
| "Launch agents to review this code" | SpawnParallel workflow creates multiple agents with varied perspectives |
| "Create a custom agent for architecture review" | CreateCustomAgent composes a specialist from relevant traits |
| "List available traits" | Shows expertise areas, personalities, approaches, and voice mappings |

The skill auto-routes based on whether you want custom identities (ComposeAgent), parallel grunt work (SpawnParallel), or trait exploration (ListTraits).

---

## Example Usage

### Creating Custom Agents

```
User: "Spin up 3 custom agents to review our security posture"

AI composes:
  Agent 1: "Threat Analyst" -- security expertise + skeptical personality + thorough approach
    Voice: low stability (0.60), measured speed (0.95)
  Agent 2: "Red Team Lead" -- security expertise + bold personality + rapid approach
    Voice: medium stability (0.45), confident speed (1.05)
  Agent 3: "Compliance Auditor" -- security expertise + analytical personality + systematic approach
    Voice: high stability (0.65), clear speed (0.95)

All three launch in parallel with unique prompts and voice settings.
Each returns findings from their distinct perspective.
```

### Listing Available Traits

```
User: "What agent traits are available?"

AI responds with:
  Expertise: security, technical, research (plus any user-defined)
  Personalities: skeptical, analytical, enthusiastic (plus any user-defined)
  Approaches: thorough, rapid, systematic (plus any user-defined)
  Voices: listed with prosody settings and personality guidelines
```

### Saving and Reloading

```
User: "Save that security analyst agent for later"

AI runs: ComposeAgent.ts --task "Security analysis" --save
Agent saved as "security-expert-skeptical-thorough"

Later:
User: "Load my security analyst"
AI runs: ComposeAgent.ts --load "security-expert-skeptical-thorough"
```

---

## Configuration

### Base Configuration

The base trait library lives at `Data/Traits.yaml` inside the skill directory. It ships with core expertise areas, personalities, approaches, and example voice mappings. This file updates with PAI releases.

### User Customization

User customizations are stored separately and never overwritten by updates:

```
~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/Agents/
  Traits.yaml       -- Your custom traits, voices, prosody settings
  NamedAgents.md    -- Your named agent backstories
  VoiceConfig.json  -- Voice server configuration
```

The composition engine merges base + user configurations at runtime. User entries override base entries with the same key.

---

## Customization

### Recommended Customization

Add your own voices and prosody settings in the user customization directory. This makes agents sound distinct through your ElevenLabs voice library.

### Optional Customization

| Customization | File | Impact |
|--------------|------|--------|
| Add expertise areas | `USER/.../Agents/Traits.yaml` | New specialization options for agent composition |
| Add personalities | `USER/.../Agents/Traits.yaml` | New personality types with prompt fragments |
| Add named agents | `USER/.../Agents/NamedAgents.md` | Persistent agent identities with backstories |
| Configure voices | `USER/.../Agents/Traits.yaml` | Voice mappings with prosody parameters |
| Adjust prosody | `USER/.../Agents/Traits.yaml` | Fine-tune stability, style, speed per voice |

---

## Credits

- **Original concept:** Daniel Miessler -- developed as part of the [PAI](https://github.com/danielmiessler/Personal_AI_Infrastructure) system
- **Inspired by:** The need for genuinely distinct AI perspectives, not interchangeable role labels

---

## Related Work

- **PAI Delegation Skill** -- For persistent coordinated agent teams with shared state (TeamCreate)
- **PAI Research Skill** -- Parallel researcher deployment used by Investigation workflows

---

## Works Well With

- **PAI Voice Infrastructure** -- ElevenLabs voice server for audible agent personalities
- **Investigation Pack** -- OSINT workflows that deploy parallel research agents
- **ContentAnalysis Pack** -- Content extraction that benefits from multi-perspective analysis

---

## Changelog

### 1.0.0 - 2026-03-15
- Initial release
- Trait-based agent composition with ComposeAgent engine
- Three workflows: CreateCustomAgent, ListTraits, SpawnParallelAgents
- Voice prosody support with ElevenLabs integration
- Named agent persistence with save/load/delete
- Base + user merge configuration pattern
- 8 researcher and role context definitions
- Handlebars template system for dynamic agent prompts
