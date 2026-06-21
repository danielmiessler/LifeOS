# CreateCustomAgent Workflow

**Creates custom agents with unique personalities and colors using ComposeAgent.**

## When to Use

{PRINCIPAL.NAME} says:
- "Create custom agents to do X"
- "Spin up custom agents for Y"
- "I need specialized agents with Z expertise"
- "Generate N custom agents to analyze..."

**KEY TRIGGER: The word "custom" means truly unique agents - NOT static types (Architect, Engineer, etc.) — always use `general-purpose` with ComposeAgent prompts.**

## The Workflow

### Step 1: Determine Agent Count & Requirements

Extract from {PRINCIPAL.NAME}'s request:
- How many agents? (Default: 1 if not specified)
- What's the task?
- Are specific traits mentioned? (security, legal, skeptical, thorough, etc.)

### Step 2: For EACH Agent, Run ComposeAgent with DIFFERENT Traits

**CRITICAL: Each agent MUST have different trait combinations to get unique personalities and colors.**

```bash
# Example for 3 custom research agents:

# Agent 1 - Enthusiastic Explorer
bun run ~/.claude/skills/Agents/Tools/ComposeAgent.ts \
  --traits "research,enthusiastic,exploratory" \
  --task "Research quantum computing applications" \
  --output json

# Agent 2 - Skeptical Analyst
bun run ~/.claude/skills/Agents/Tools/ComposeAgent.ts \
  --traits "research,skeptical,systematic" \
  --task "Research quantum computing applications" \
  --output json

# Agent 3 - Thorough Synthesizer
bun run ~/.claude/skills/Agents/Tools/ComposeAgent.ts \
  --traits "research,analytical,synthesizing" \
  --task "Research quantum computing applications" \
  --output json
```

### Step 3: Extract Prompt and Color from Each

ComposeAgent returns JSON with:
```json
{
  "name": "Research Enthusiastic Explorer",
  "color": "#FF6B35",
  "traits": ["research", "enthusiastic", "exploratory"],
  "prompt": "# Dynamic Agent: Research Enthusiastic Explorer\n\nYou are a specialized agent..."
}
```

**Each agent gets a unique color** - use this in the description for visual distinction in the terminal.

### Step 4: Launch Agents with Task Tool

**Use a SINGLE message with MULTIPLE Task calls for parallel execution.**

**CRITICAL: Use `subagent_type: "general-purpose"` - NEVER use static types like "Architect" or "Engineer" for custom agents.**

```typescript
// Send all in ONE message:
Task({
  description: "Research agent 1 - enthusiastic",
  prompt: <agent1_full_prompt>,
  subagent_type: "general-purpose",
  model: "sonnet"  // or "haiku" for speed
})
Task({
  description: "Research agent 2 - skeptical",
  prompt: <agent2_full_prompt>,
  subagent_type: "general-purpose",
  model: "sonnet"
})
Task({
  description: "Research agent 3 - analytical",
  prompt: <agent3_full_prompt>,
  subagent_type: "general-purpose",
  model: "sonnet"
})
```

### Step 5: Spotcheck (Optional but Recommended)

After all agents complete, launch one more to verify consistency:

```typescript
Task({
  description: "Spotcheck custom agent results",
  prompt: "Review these results for consistency and completeness: [results]",
  subagent_type: "general-purpose",
  model: "haiku"
})
```

## Trait Variation Strategies

When creating multiple custom agents, vary traits to ensure distinct personalities:

**For Research Tasks:**
- Agent 1: research + enthusiastic + exploratory
- Agent 2: research + skeptical + thorough
- Agent 3: research + analytical + systematic
- Agent 4: research + creative + bold
- Agent 5: research + empathetic + synthesizing

**For Security Analysis:**
- Agent 1: security + adversarial + bold
- Agent 2: security + skeptical + meticulous
- Agent 3: security + cautious + systematic

**For Business Strategy:**
- Agent 1: business + bold + rapid
- Agent 2: business + analytical + comparative
- Agent 3: business + pragmatic + consultative

## Timing & Model Selection

**Timing flows from the Algorithm.** The main agent validates a timing tier (fast|standard|deep) and passes it to ComposeAgent via `--timing`:

```bash
# Pass timing to ComposeAgent for automatic scope in agent prompt:
bun run ComposeAgent.ts --traits "research,enthusiastic" --task "Quick status check" --timing fast --output json
bun run ComposeAgent.ts --traits "security,thorough" --task "Full security audit" --timing deep --output json
```

If `--timing` is omitted, agents get no scope section (backward compatible).

| Timing | Model | Agent Output |
|--------|-------|-------------|
| `fast` | `haiku` | Under 500 words, direct answer |
| `standard` | `sonnet` | Focused work, under 1500 words |
| `deep` | `opus` | Comprehensive analysis, no limit |

**Parallel custom agents benefit from `sonnet` or `haiku` for speed.**

## Example Execution

**{PRINCIPAL.NAME}:** "Create 5 custom science agents to analyze this climate data"

**{DA_IDENTITY.NAME}'s Internal Execution:**
```bash
# Agent 1 - Climate Science Enthusiast
bun run ComposeAgent.ts --traits "research,enthusiastic,thorough" --task "Analyze climate data patterns" --output json

# Agent 2 - Skeptical Data Analyst
bun run ComposeAgent.ts --traits "data,skeptical,systematic" --task "Analyze climate data patterns" --output json

# Agent 3 - Creative Pattern Finder
bun run ComposeAgent.ts --traits "data,creative,exploratory" --task "Analyze climate data patterns" --output json

# Agent 4 - Meticulous Validator
bun run ComposeAgent.ts --traits "research,meticulous,comparative" --task "Analyze climate data patterns" --output json

# Agent 5 - Synthesizing Strategist
bun run ComposeAgent.ts --traits "research,analytical,synthesizing" --task "Analyze climate data patterns" --output json

# Launch all 5 in parallel (single message, 5 Task calls)
# Each agent has a unique personality
```

**Result:** 5 distinct agents with different analytical approaches and unique personalities analyzing the data from different perspectives.

## Common Mistakes to Avoid

**❌ WRONG: Using same traits for all agents**
```bash
# All agents get the same personality!
bun run ComposeAgent.ts --traits "research,analytical" # Agent 1
bun run ComposeAgent.ts --traits "research,analytical" # Agent 2 (same personality!)
bun run ComposeAgent.ts --traits "research,analytical" # Agent 3 (same personality!)
```

**✅ RIGHT: Varying traits for unique personalities**
```bash
# Each agent gets a different personality
bun run ComposeAgent.ts --traits "research,enthusiastic,exploratory"
bun run ComposeAgent.ts --traits "research,skeptical,systematic"
bun run ComposeAgent.ts --traits "research,creative,synthesizing"
```

**❌ WRONG: Launching agents sequentially**
```typescript
// Slow - waits for each to finish
await Task({ ... }); // Agent 1
await Task({ ... }); // Agent 2 (waits for 1)
await Task({ ... }); // Agent 3 (waits for 2)
```

**✅ RIGHT: Launching agents in parallel**
```typescript
// Fast - all run simultaneously (single message, multiple calls)
Task({ ... })  // Agent 1
Task({ ... })  // Agent 2
Task({ ... })  // Agent 3
```

## Color Assignment Logic

ComposeAgent deterministically derives a unique color from the sorted trait combination — the same trait set always maps to the same color, and different trait sets map to visually distinct colors for terminal distinction.

## Related Workflows

- **ListTraits** - Show available traits for composition
- **SpawnParallelAgents** - Launch parallel agents for grunt work (same identity, no custom personality)

## References

- Trait definitions: `~/.claude/skills/Agents/Data/Traits.yaml`
- Agent template: `~/.claude/skills/Agents/Templates/DynamicAgent.hbs`
- ComposeAgent tool: `~/.claude/skills/Agents/Tools/ComposeAgent.ts`
- Agent personalities: `~/.claude/skills/Agents/AgentPersonalities.md`
