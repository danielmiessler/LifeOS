---
name: Agents
description: Compose CUSTOM agents from Base Traits + Voice + Specialization for specialized perspectives. USE WHEN create custom agents, spin up agents, specialized agents, agent personalities, available traits, list traits, agent voices, compose agent, load agent context, agent profile, spawn parallel agents, launch agents. NOT for agent teams/swarms (use Delegation skill → TeamCreate).
---

## 🚨 SCOPE BOUNDARY — This Skill vs Agent Teams

| {PRINCIPAL.NAME} Says | Which System | NOT This Skill? |
|-------------|-------------|-----------------|
| "**custom agents**", "spin up agents", "launch agents" | **THIS SKILL** (Agents) → ComposeAgent → `Task(subagent_type="general-purpose")` | |
| "**create an agent team**", "**agent team**", "**swarm**" | **Delegation skill** → `TeamCreate` tool | **YES — NOT this skill** |

**If {PRINCIPAL.NAME} says "agent team" or "swarm", do NOT use this skill. Use the Delegation skill which routes to `TeamCreate`.**

- **This skill** = one-shot parallel workers with unique identities, NO shared state, fire-and-forget
- **Agent teams** (Delegation → TeamCreate) = persistent coordinated teams with shared task lists, messaging, multi-turn collaboration

---

## 🚨 MANDATORY: Voice Notification (REQUIRED BEFORE ANY ACTION)

**You MUST send this notification BEFORE doing anything else when this skill is invoked.**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:8888/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the WORKFLOWNAME workflow in the Agents skill to ACTION"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running the **WorkflowName** workflow in the **Agents** skill to ACTION...
   ```

**This is not optional. Execute this curl command immediately upon skill invocation.**

# Agents - Custom Agent Composition System

**Auto-routes when user mentions custom agents, agent creation, or specialized personalities.**
**Does NOT handle agent teams/swarms — that's Delegation skill → TeamCreate.**

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
    {PRINCIPAL.NAME}:
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
- **CREATECUSTOMAGENT** - Create specialized custom agents → `Workflows/CreateCustomAgent.md`
- **LISTTRAITS** - Show available agent traits → `Workflows/ListTraits.md`
- **SPAWNPARALLEL** - Launch parallel agents → `Workflows/SpawnParallelAgents.md`

## Route Triggers

**CRITICAL: The word "custom" is the KEY trigger for unique agent identities:**

| User Says | What to Use | Why |
|-----------|-------------|-----|
| "**custom agents**", "create **custom** agents" | ComposeAgent + `general-purpose` | Unique personalities, voices, colors |
| "agents", "launch agents", "bunch of agents" | SpawnParallel workflow | Same identity, parallel grunt work |
| "use [named agent]" | Named agent | Pre-defined personality from USER config |

**NEVER use static agent types (Architect, Engineer, etc.) for custom agents — always use `general-purpose` with ComposeAgent prompts.**

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
bun run ~/.claude/skills/Agents/Tools/ComposeAgent.ts --task "Review security"
bun run ~/.claude/skills/Agents/Tools/ComposeAgent.ts --traits "security,skeptical,thorough"

# Persistent custom agents
bun run ~/.claude/skills/Agents/Tools/ComposeAgent.ts --task "Security review" --save
bun run ~/.claude/skills/Agents/Tools/ComposeAgent.ts --list-saved
bun run ~/.claude/skills/Agents/Tools/ComposeAgent.ts --load "security-expert-skeptical-thorough"
bun run ~/.claude/skills/Agents/Tools/ComposeAgent.ts --delete "security-expert-skeptical-thorough"

# Other options
bun run ~/.claude/skills/Agents/Tools/ComposeAgent.ts --list
bun run ~/.claude/skills/Agents/Tools/ComposeAgent.ts --output json
```

**JSON output includes:**
```json
{
  "name": "Security Expert Skeptical Thorough",
  "voice": "{PRINCIPAL.NAME}",
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
