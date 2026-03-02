---
name: DelegationReference
description: Comprehensive delegation and agent parallelization patterns. Reference material extracted from SKILL.md for on-demand loading.
created: 2025-12-17
extracted_from: SKILL.md lines 535-627
---

# Delegation & Parallelization Reference

**Quick reference in SKILL.md** → For full details, see this file

---

## 🤝 Delegation & Parallelization (Always Active)

**WHENEVER A TASK CAN BE PARALLELIZED, USE MULTIPLE AGENTS!**

### Model Selection for Agents (CRITICAL FOR SPEED)

**The Task tool has a `model` parameter - USE IT.**

Agents default to inheriting the parent model (often Opus). This is SLOW for simple tasks. Each inference with 30K+ context takes 5-15 seconds on Opus. A simple 10-tool-call task = 1-2+ minutes of pure thinking time.

**Model Selection Matrix:**

| Task Type | Model | Why |
|-----------|-------|-----|
| Deep reasoning, complex architecture, strategic decisions | `opus` | Maximum intelligence needed |
| Standard implementation, moderate complexity, most coding | `sonnet` | Good balance of speed + capability |
| Simple lookups, file reads, quick checks, parallel grunt work | `haiku` | 10-20x faster, sufficient intelligence |

**Examples:**

```typescript
// WRONG - defaults to Opus, takes minutes
Task({ prompt: "Check if blue bar exists on website", subagent_type: "general-purpose" })

// RIGHT - Haiku for simple visual check
Task({ prompt: "Check if blue bar exists on website", subagent_type: "general-purpose", model: "haiku" })

// RIGHT - Sonnet for standard coding task
Task({ prompt: "Implement the login form validation", subagent_type: "Engineer", model: "sonnet" })

// RIGHT - Opus for complex architectural planning
Task({ prompt: "Design the distributed caching strategy", subagent_type: "Architect", model: "opus" })
```

**Rule of Thumb:**
- If it's grunt work or verification → `haiku`
- If it's implementation or research → `sonnet`
- If it requires deep strategic thinking → `opus` (or let it default)

**Parallel tasks especially benefit from haiku** - launching 5 haiku agents is faster AND cheaper than 1 Opus agent doing sequential work.

### Agent Types

**Default for parallel work: Custom agents via Agents skill (ComposeAgent).**

Use the Agents skill to compose task-specific agents with unique traits, voices, and expertise:
- Use a SINGLE message with MULTIPLE Task tool calls
- Each agent gets FULL CONTEXT and DETAILED INSTRUCTIONS via ComposeAgent prompt
- Launch as many as needed (no artificial limit)
- **ALWAYS launch a spotcheck agent after parallel work completes**

**Agent routing by task type:**
- **Research tasks** → Use the Research skill (has dedicated researcher agents)
- **Code implementation** → Use Engineer agents (`subagent_type: "Engineer"`)
- **Architecture/design** → Use Architect agents (`subagent_type: "Architect"`)
- **Everything else** → Use Agents skill → ComposeAgent → `subagent_type: "general-purpose"`

### 🚨 AGENT ROUTING (Always Active)

**Two COMPLETELY Different Systems — custom agents vs agent teams:**

| User Says | System | Tool | What Happens |
|-------------|--------|------|-------------|
| "**custom agents**", "spin up agents", "launch agents" | **Agents Skill** (ComposeAgent) | `Task(subagent_type="general-purpose", prompt=<ComposeAgent output>)` | Unique personalities, voices, colors via trait composition |
| "**create an agent team**", "**agent team**", "**swarm**" | **Claude Code Teams** | `TeamCreate` → `TaskCreate` → `SendMessage` | Persistent team with shared task list, message coordination, multi-turn collaboration |

**These are NOT the same thing:**
- **Custom agents** = one-shot parallel workers with unique identities, launched via `Task()`, no shared state
- **Agent teams** = persistent coordinated teams with shared task lists, messaging, and multi-turn collaboration via `TeamCreate`

**Additional routing by task type:**

| User Says | What to Use | Why |
|-------------|-------------|-----|
| "**custom agents**", "spin up **custom** agents" | **ComposeAgent** → `general-purpose` | Unique prompts, unique voices |
| "spin up agents", "bunch of agents", "launch agents" | **ComposeAgent** → `general-purpose` | Task-specific agents with proper expertise |
| "research X", "investigate Y" | **Research skill** | Dedicated researcher agents |
| Code implementation tasks | **Engineer** agent | Specialized for TDD/code |
| Architecture/design tasks | **Architect** agent | Specialized for system design |

**For ALL parallel work:**
1. Invoke the Agents skill → ComposeAgent for EACH agent with appropriate traits
2. Use DIFFERENT trait combinations to get unique voices and expertise
3. Launch with the full ComposeAgent-generated prompt as `subagent_type: "general-purpose"`
4. Each agent gets a personality-matched ElevenLabs voice

**For research specifically:** Use the Research skill, which has dedicated researcher agents (ClaudeResearcher, GeminiResearcher, etc.)

**Reference:** Agents skill (`~/.claude/skills/Agents/SKILL.md`)

**Full Context Requirements:**
When delegating, ALWAYS include:
1. WHY this task matters (business context)
2. WHAT the current state is (existing implementation)
3. EXACTLY what to do (precise actions, file paths, patterns)
4. SUCCESS CRITERIA (what output should look like)
5. TIMING SCOPE (fast|standard|deep) — controls agent output verbosity

### Timing Scope in Agent Prompts

Every agent prompt MUST include a `## Scope` section that matches the validated timing tier from the Algorithm's THINK phase. This prevents agents from over-producing on simple tasks or under-delivering on complex ones.

**Timing + Model Selection:**

| Timing | Model | Agent Output | Example |
|--------|-------|-------------|---------|
| **fast** | `haiku` | <500 words, direct answer | "Check if server is running" |
| **standard** | `sonnet` | <1500 words, focused work | "Implement login validation" |
| **deep** | `opus` | No limit, thorough analysis | "Comprehensive security audit" |

**Examples:**

```typescript
// FAST — simple check, haiku model, minimal output
Task({
  prompt: `Check if the auth middleware exports are correct.
## Scope
Timing: FAST — direct answer only.
- Under 500 words
- Answer the question, report the result, done`,
  subagent_type: "Explore",
  model: "haiku"
})

// STANDARD — typical implementation work
Task({
  prompt: `Implement input validation for the login form.
## Scope
Timing: STANDARD — focused implementation.
- Under 1500 words
- Stay on task, deliver the work, verify it works`,
  subagent_type: "Engineer",
  model: "sonnet"
})

// DEEP — comprehensive analysis
Task({
  prompt: `Perform a thorough security review of all auth flows.
## Scope
Timing: DEEP — comprehensive analysis.
- No word limit
- Explore alternatives, consider edge cases
- Thorough verification and documentation`,
  subagent_type: "Pentester",
  model: "opus"
})
```

---

**See Also:**
- SKILL.md > Delegation (Quick Reference) - Condensed trigger table
- Workflows/Delegation.md - Operational delegation procedures
- Workflows/BackgroundDelegation.md - Background agent patterns
- skills/Agents/SKILL.md - Custom agent creation system
