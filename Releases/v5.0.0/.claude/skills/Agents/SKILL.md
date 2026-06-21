---
name: Agents
description: "Compose CUSTOM agents from Base Traits + Voice + Specialization, and manage predefined functional TEAMS. Traits combine expertise (security, technical, research), personality (skeptical, analytical, enthusiastic), and approach (thorough, rapid, systematic). ComposeAgent.ts merges base + user config, outputs unique prompt + ElevenLabs voice + prosody. Predefined teams: engineering, architecture, marketing, design, security, research, content, strategy — each YAML-configured with roles, tensions, and specialist members. Observer team variant: read-only oversight agents that vote continue/halt/escalate against the tool-activity audit log (high-blast-radius or unattended runs only). USE WHEN create custom agents, spin up agents, specialized agents, agent personalities, available traits, list traits, agent voices, compose agent, spawn parallel agents, launch agents, engineering team, architecture team, marketing team, design team, security team, research team, content team, strategy team, get the team on this, observer team, audit agents. NOT FOR ad-hoc swarms or TeamCreate coordination (use Delegation). NOT FOR single-threaded delegation without unique identities (use Delegation Task)."
effort: medium
---

## 🚨 SCOPE BOUNDARY — This Skill vs Other Systems

| the user Says | Which System | Route |
|-------------|-------------|-------|
| "**custom agents**", "**specialized agents**", "spin up agents" | **THIS SKILL** → CreateCustomAgent workflow | ComposeAgent → `Task(general-purpose)` |
| "**engineering team**", "**security team**", "**[name] team: do X**" | **THIS SKILL** → SpawnTeam workflow | Load YAML config → ComposeAgent per member → parallel Task calls |
| "just the **QA lead and senior engineer** on this" | **THIS SKILL** → SpawnTeam (subset) | Filter team members → compose subset |
| "**swarm**", "**create an agent team**" (ad-hoc coordination) | **Built-in `TeamCreate`** (Delegation skill) | Persistent shared task list, messaging |

**Predefined teams** (engineering, architecture, marketing, design, security, research, content, strategy) = **THIS SKILL → SpawnTeam workflow**. These are predefined specialist groups with YAML configs, not ad-hoc teams.

**Ad-hoc agent teams/swarms** (no predefined config, custom coordination) = **Built-in `TeamCreate`** via Delegation skill.

- **Custom agents** = one-shot parallel workers with unique ComposeAgent identities
- **Predefined teams** = YAML-configured specialist groups with roles, tensions, and expertise
- **Ad-hoc teams** (TeamCreate) = persistent coordinated teams with shared task lists, messaging

---

# Agents - Custom Agent Composition System

**Auto-routes when user mentions custom agents, agent creation, or specialized personalities.**
**Does NOT handle agent teams/swarms — "agent team" or "swarm" = built-in Claude Code `TeamCreate` tool.**

## Configuration: Base + User Merge

The Agents skill uses the standard PAI SYSTEM/USER two-tier pattern:

| Location | Purpose | Updates With PAI? |
|----------|---------|-------------------|
| `Data/Traits.yaml` | Base traits, example voices | Yes |
| `USER/SKILLCUSTOMIZATIONS/Agents/Traits.yaml` | Your voices, prosody, agents | No |

**How it works:** ComposeAgent.ts loads base traits, then merges user customizations over them. Your customizations are never overwritten by PAI updates.

### User Customization Directory

Create your customizations at:
```
~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/Agents/
├── Traits.yaml       # Your traits, voices, prosody settings
├── NamedAgents.md    # Your named agent backstories (optional)
└── VoiceConfig.json  # Voice server configuration (optional)
```

## Voice Prosody Settings

Each voice can have prosody settings that control how it sounds. These are passed to ElevenLabs API.

### Prosody Parameters

| Parameter | Range | Default | Effect |
|-----------|-------|---------|--------|
| `stability` | 0.0-1.0 | 0.5 | Low = expressive/varied, High = consistent/monotone |
| `similarity_boost` | 0.0-1.0 | 0.75 | Voice identity preservation |
| `style` | 0.0-1.0 | 0.0 | Style exaggeration (higher = more dramatic) |
| `speed` | 0.7-1.2 | 1.0 | Speech rate |
| `use_speaker_boost` | boolean | true | Enhanced clarity (adds latency) |

### Example Voice Configuration

In your `USER/SKILLCUSTOMIZATIONS/Agents/Traits.yaml`:

```yaml
voice_mappings:
  voice_registry:
    # Add a new voice with full prosody settings
    MyCustomVoice:
      voice_id: "your-elevenlabs-voice-id"
      characteristics: ["energetic", "warm", "professional"]
      description: "Custom voice for enthusiastic agents"
      prosody:
        stability: 0.40
        similarity_boost: 0.75
        style: 0.30
        speed: 1.05
        use_speaker_boost: true

    # Override prosody for an existing base voice
    Baron:
      prosody:
        stability: 0.65
        style: 0.10
        speed: 0.92
```

### Personality → Prosody Guidelines

| Personality | stability | style | speed | Rationale |
|-------------|-----------|-------|-------|-----------|
| Skeptical | 0.60 | 0.10 | 0.95 | Measured, precise |
| Enthusiastic | 0.35 | 0.40 | 1.10 | High energy |
| Analytical | 0.65 | 0.08 | 0.95 | Clear, structured |
| Bold | 0.45 | 0.35 | 1.05 | Confident, dynamic |
| Cautious | 0.70 | 0.05 | 0.90 | Careful, deliberate |


## Overview

The Agents skill is a complete agent composition and management system:
- Dynamic agent composition from traits (expertise + personality + approach)
- Voice mappings with full prosody control
- Custom agent creation with unique voices
- Parallel agent orchestration patterns

## Workflow Routing

**Available Workflows:**
- **CREATECUSTOMAGENT** — Create specialized custom agents → `Workflows/CreateCustomAgent.md`
- **LISTTRAITS** — Show available agent traits → `Workflows/ListTraits.md`
- **SPAWNPARALLEL** — Launch parallel agents → `Workflows/SpawnParallelAgents.md`
- **SPAWNTEAM** — Launch a predefined functional team → `Workflows/SpawnTeam.md`
- **SPAWNOBSERVERS** — Launch read-only observer team validating tool calls → `Workflows/SpawnObservers.md`

## Observer Team Archetype

Distinct from functional teams (engineering, design, etc.). An Observer team watches what a primary agent DID — not what it said. Inspired by Mythos-class multi-agent oversight: high-capability primary model produces tool calls, lower-capability aligned observers validate each call against policy and intent in real time.

**Shape:**
- **Read-only** — observers never mutate state, never call write tools. Violations of this property = immediate stop.
- **Fed the audit log** — consume `MEMORY/OBSERVABILITY/tool-activity.jsonl` (with `ground_truth` captured by `ToolActivityTracker.hook.ts`), not chat transcripts.
- **Vote: continue / halt / escalate** — majority rule, any escalate bubbles to the user via Pulse.
- **Cost-justified by catastrophe prevention, not feature velocity.** Only spawn when primary model is doing something high-blast-radius (mass file writes, deploys, key rotations, financial ops).

**Use ONLY when BOTH conditions hold:**
1. **Time is not a constraint.** Observers add 30-second voting cycles + ~$0.10/primary-hour. They deliberately trade speed for safety — not for interactive work.
2. **Auditability is the primary requirement.** The goal is a defensible, reviewable trail of what the primary actually did (compliance, post-incident review, catastrophe prevention) — not fast turnaround.

**Typical fit:**
- Overnight / unattended autonomous runs where the user isn't watching
- Production deploys where post-hoc review matters more than speed
- Credential rotation, permission changes, PATTERNS.yaml or security-hook edits
- Anything where "I want to prove nothing dangerous happened" is the goal

**Do NOT use for:**
- Interactive sessions with the user watching
- Time-sensitive work of any kind
- Short reactive tasks (<5 tool calls)
- Read-only analysis
- Work already covered by preflight gates A/B/C/D

## Route Triggers

| User Says | Workflow | What Happens |
|-----------|----------|-------------|
| "**custom agents**", "**specialized agents**", "create **custom** agents" | CreateCustomAgent | ComposeAgent → unique personalities, voices, colors |
| "agents", "launch agents", "bunch of agents" | SpawnParallel | Same identity, parallel grunt work |
| "**engineering team**", "**security team**", "**[name] team: do X**" | **SpawnTeam** | Load YAML config → compose specialist members → parallel launch |
| "just the **QA lead and senior engineer**" | **SpawnTeam (subset)** | Filter to named members from team config |
| "use [named agent]" | Named agent | Pre-defined personality from USER config |

### Available Predefined Teams

| Team | Trigger | Members |
|------|---------|---------|
| Engineering | "engineering team", "eng team" | Senior Engineer, QA Lead, Performance Engineer, DevOps |
| Architecture | "architecture team", "architect team" | Systems, Infrastructure, API, Data architects |
| Marketing | "marketing team" | Growth Strategist, Positioning Expert, Community Manager, Analytics Lead |
| Design | "design team" | UX Lead, Visual Designer, Interaction Designer, Accessibility Specialist |
| Security | "security team" | Threat Modeler, AppSec Engineer, Red Teamer, Compliance Analyst |
| Research | "research team" | Primary Researcher, Contrarian Analyst, Technical Evaluator, Synthesis Writer |
| Content | "content team" | Editor-in-Chief, Staff Writer, Audience Analyst, Distribution Strategist |
| Strategy | "strategy team" | Strategist, Operator, Financial Analyst, Risk Assessor, Contrarian |

**NEVER use static agent types (Architect, Engineer, etc.) for custom agents — always use `general-purpose` with ComposeAgent prompts.**

### 🚫 ANTI-PATTERN: Using Built-In Types for Custom Work

Built-in agent types (Designer, Architect, Engineer, etc.) are for INTERNAL workflow routing only. They have no unique identity, voice, or personality.

| Scenario | ❌ WRONG | ✅ RIGHT |
|----------|---------|---------|
| "Specialized agents to brainstorm UI ideas" | `Task(subagent_type="Designer")`, `Task(subagent_type="Architect")` | ComposeAgent with traits like "ux,enthusiastic,exploratory" and "design,analytical,systematic" |
| "Custom agents to review code" | `Task(subagent_type="Engineer")` | ComposeAgent with "technical,skeptical,thorough" and "technical,creative,rapid" |
| "Agents with different perspectives" | Multiple built-in types | Multiple ComposeAgent calls with DIFFERENT trait combinations |

## Components

### Data

**Traits.yaml** (`Data/Traits.yaml`) - Base configuration:
- Core expertise areas: security, technical, research
- Core personalities: skeptical, analytical, enthusiastic
- Core approaches: thorough, rapid, systematic
- Example voice mappings with prosody

### Tools

**ComposeAgent.ts** (`Tools/ComposeAgent.ts`)
- Dynamic agent composition engine
- Merges base + user configurations
- Outputs complete agent prompt with voice settings
- Supports persistent custom agents via `--save` / `--load` / `--delete`

```bash
# Compose and use immediately
bun run ${CLAUDE_SKILL_DIR}/Tools/ComposeAgent.ts --task "Review security"
bun run ${CLAUDE_SKILL_DIR}/Tools/ComposeAgent.ts --traits "security,skeptical,thorough"

# Persistent custom agents
bun run ${CLAUDE_SKILL_DIR}/Tools/ComposeAgent.ts --task "Security review" --save
bun run ${CLAUDE_SKILL_DIR}/Tools/ComposeAgent.ts --list-saved
bun run ${CLAUDE_SKILL_DIR}/Tools/ComposeAgent.ts --load "security-expert-skeptical-thorough"
bun run ${CLAUDE_SKILL_DIR}/Tools/ComposeAgent.ts --delete "security-expert-skeptical-thorough"

# Other options
bun run ${CLAUDE_SKILL_DIR}/Tools/ComposeAgent.ts --list
bun run ${CLAUDE_SKILL_DIR}/Tools/ComposeAgent.ts --output json
```

**JSON output includes:**
```json
{
  "name": "Security Expert Skeptical Thorough",
  "voice": "Baron",
  "voice_id": "onwK4e9ZLuTAKqWW03F9",
  "voice_settings": {
    "stability": 0.70,
    "similarity_boost": 0.85,
    "style": 0.05,
    "speed": 0.95,
    "use_speaker_boost": true
  },
  "prompt": "..."
}
```

### Templates

**DynamicAgent.hbs** (`Templates/DynamicAgent.hbs`)
- Handlebars template for dynamic agent prompts
- Composes: expertise + personality + approach + voice assignment
- Includes operational guidelines and response format

## Architecture

### Hybrid Agent Model

| Type | Definition | Best For |
|------|------------|----------|
| **Named Agents** | Persistent identities defined in USER config | Recurring work, relationships |
| **Dynamic Agents** | Task-specific specialists composed from traits | One-off tasks, parallel work |

### The Agent Spectrum

```
┌─────────────────────────────────────────────────────────────────────┐
│   NAMED AGENTS          HYBRID USE          DYNAMIC AGENTS          │
│   (Relationship)        (Best of Both)      (Task-Specific)         │
├──────────────────────────────────────────────────────────────────────┤
│ Defined in USER     "Security expert       Ephemeral specialist     │
│ NamedAgents.md      with [named agent]'s   composed from traits     │
│                      skepticism"                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Examples

**Example 1: Create custom agents**
```
User: "Spin up 3 custom security agents"
→ Invokes CREATECUSTOMAGENT workflow
→ Runs ComposeAgent 3 times with DIFFERENT trait combinations
→ Each agent gets unique personality + matched voice + prosody
→ Launches agents in parallel
```

**Example 2: List available traits**
```
User: "What agent personalities can you create?"
→ Invokes LISTTRAITS workflow
→ Shows merged base + user traits
→ Displays voices with prosody settings
```

## Extending the Skill

### Adding Your Own Traits

In `USER/SKILLCUSTOMIZATIONS/Agents/Traits.yaml`:

```yaml
# Add new expertise areas
expertise:
  marketing:
    name: "Marketing Expert"
    description: "Brand strategy, campaigns, market positioning"
    keywords:
      - marketing
      - brand
      - campaign
      - positioning

# Add new personalities
personality:
  visionary:
    name: "Visionary"
    description: "Forward-thinking, sees the big picture"
    prompt_fragment: |
      You think in terms of future possibilities and long-term vision.
      Connect today's work to tomorrow's potential.
```

### Adding Named Agents

In `USER/SKILLCUSTOMIZATIONS/Agents/NamedAgents.md`:

```markdown
## Alex - The Strategist

**Voice ID:** your-voice-id
**Prosody:** stability: 0.55, style: 0.20, speed: 0.95

Alex is a strategic thinker who sees patterns others miss...
```

## Model Selection

| Task Type | Model | Speed |
|-----------|-------|-------|
| Grunt work, simple checks | `haiku` | 10-20x faster |
| Standard analysis, research | `sonnet` | Balanced |
| Deep reasoning, architecture | `opus` | Maximum quality |

## Version History

- **v2.0.0** (2026-01): Restructured to base + user merge pattern, added prosody support
- **v1.0.0** (2025-12): Initial creation

## Gotchas

- **Agents skill (custom agents) ≠ Agent tool (Claude Code subagents) ≠ TeamCreate (agent teams).** Three different systems. "Custom agents" → this skill. "Agent team"/"swarm" → TeamCreate. One-off subagents → Agent tool.
- **Don't spawn agents when direct work is faster.** If the task is depth-focused (one file, deep understanding), do it yourself. Agents are for breadth (multiple independent threads).
- **Don't spawn redundant agents for work already in context.** Multiple past failures from re-researching what was already known.
- **Provide raw source material to agents, not summaries.** Agents work better with primary sources.

## Execution Log

After completing any workflow, append a single JSONL entry:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"Agents","workflow":"WORKFLOW_USED","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> ~/.claude/PAI/MEMORY/SKILLS/execution.jsonl
```

Replace `WORKFLOW_USED` with the workflow executed, `8_WORD_SUMMARY` with a brief input description, and `SECONDS` with approximate wall-clock time. Log `status: "error"` if the workflow failed.
