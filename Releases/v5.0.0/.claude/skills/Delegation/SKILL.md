---
name: Delegation
description: "Parallelize work via six patterns: built-in agents (Engineer/Architect/Algorithm/Explore/Plan via Task), worktree-isolated agents (conflict-free parallel file edits), background agents (run_in_background: true, non-blocking), custom agents (ComposeAgent via Agents skill → Task general-purpose), agent teams (TeamCreate + TaskCreate + SendMessage for multi-turn peer coordination), and parallel task dispatch (N identical operations). Two-tier delegation: lightweight (haiku, max_turns=3, one-shot extraction/classification) vs full (multi-step, tool use, iteration). Decision rule — agents need to talk to each other or share state → Teams; independent one-shot work → Subagents. Auto-invoked by Algorithm when 3+ independent workstreams exist at Extended+ effort. USE WHEN 3+ workstreams, parallel execution, agent specialization, agent team, swarm, spawn agents, create team, fan out, divide and conquer, multi-agent, coordinate agents. NOT FOR single-agent custom personality composition (use Agents skill)."
effort: medium
---

# Delegation — Agent Orchestration & Parallelization

**Auto-invoked by the Algorithm when work can be parallelized or requires agent specialization.**

## 🚨 CRITICAL ROUTING — Two COMPLETELY Different Systems

| the user Says | System | Tool | What Happens |
|-------------|--------|------|-------------|
| "**custom agents**", "**specialized agents**", "spin up agents", "launch agents" | **Agents Skill** (ComposeAgent) | `Task(subagent_type="general-purpose", prompt=<ComposeAgent output>)` | Unique personalities, colors via trait composition |
| "**create an agent team**", "**agent team**", "**swarm**" | **Claude Code Teams** | `TeamCreate` → `TaskCreate` → `SendMessage` | Persistent team with shared task list, message coordination, multi-turn collaboration |

**These are NOT the same thing:**
- **Custom agents** = one-shot parallel workers with unique identities, launched via `Task()`, no shared state
- **Agent teams** = persistent coordinated teams with shared task lists, messaging, and multi-turn collaboration via `TeamCreate`

## When the Algorithm Should Use This Skill

- **3+ independent workstreams** exist at Extended+ effort level
- **Multiple identical non-serial tasks** need parallel execution
- **Specialized expertise** needed (architecture design, implementation, ISC optimization)
- **Large codebase changes** spanning 5+ files benefit from parallel workers
- **Research + execution** can proceed simultaneously
- **"Create an agent team"** — use TeamCreate for persistent coordinated teams
- **Unattended autonomous work where auditability matters more than speed** — spawn an Observer team (Agents skill → SPAWNOBSERVERS) alongside the primary agent, reading the tool-activity audit log, voting continue/halt/escalate. ONLY use when BOTH (a) time is not a constraint and (b) auditability is the primary requirement. Never for interactive or time-sensitive work. See Agents/SKILL.md "Observer Team Archetype" for shape and guardrails.

## Delegation Patterns

### 1. Built-In Agents

**⚠️ Built-in agents are for internal workflow routing ONLY.** When the user asks for custom, specialized, or uniquely-identified agents, use the Agents skill (section 4 below) instead.

Use `Task(subagent_type="AgentType")` with these specialized agents:

| Agent Type | Specialization | When to Use |
|-----------|---------------|-------------|
| `Engineer` | TDD implementation, code changes | Code-heavy tasks requiring tests |
| `Architect` | System design, structure decisions | Architecture planning, design specs |
| `Algorithm` | ISC optimization, criteria work | ISC-specialized verification |
| `Explore` | Fast codebase search | Quick file/pattern discovery |
| `Plan` | Implementation strategy | Design before execution |

**Always include:** Full context, effort budget, expected output format.

### 2. Worktree-Isolated Agents

Run agents in their own git worktree with `isolation: "worktree"` for file-safe parallelism:

```
Task(subagent_type="Engineer", isolation: "worktree", prompt="...")
```

- Each agent gets its own working tree — no file conflicts with other agents
- Worktree auto-created on spawn, auto-cleaned when agent finishes (unless changes made)
- Use when multiple agents edit the same files or for competing approaches
- Can combine with `run_in_background: true` for non-blocking isolated work
- **Built-in agents with `isolation: worktree` in frontmatter** (Engineer, Architect) auto-isolate on every spawn

### 3. Background Agents

Run agents with `run_in_background: true` for non-blocking parallel work:

```
Task(subagent_type="Engineer", run_in_background: true, prompt="...")
```

- Use when results aren't needed immediately
- Check output with `Read` tool on the output_file path
- Ideal for: research, long builds, parallel investigations

### 3. Foreground Agents

Standard `Task()` calls that block until complete:

- Use when you need the result before proceeding
- Use for sequential dependencies
- Default mode — most common

### 4. Custom Agents (via Agents Skill)

**Trigger:** "custom agents", "spin up agents", "launch agents", "specialized agents"
**Action:** Invoke the **Agents skill** → run `ComposeAgent.ts` → launch with `Task(subagent_type="general-purpose")`

```bash
# Step 1: Compose agent identity
bun run ~/.claude/skills/Agents/Tools/ComposeAgent.ts --traits "security,skeptical,thorough" --task "Review auth" --output json

# Step 2: Launch with composed prompt
Task(subagent_type="general-purpose", prompt=<ComposeAgent JSON .prompt field>)
```

- Each agent gets unique personality and color via ComposeAgent
- Use DIFFERENT trait combinations for each agent to get unique identities
- Never use built-in agent types (Engineer, Architect) for custom work
- Ideal for: domain experts, adversarial reviewers, creative brainstormers, parallel analysis

### 5. Agent Teams (via TeamCreate)

**Trigger:** "create an agent team", "agent team", "swarm", "team of agents"
**Action:** Use `TeamCreate` tool → `TaskCreate` → spawn teammates via `Task(team_name=...)` → coordinate via `SendMessage`

```
1. TeamCreate(team_name="my-project")           # Creates team + task list
2. TaskCreate(subject="Implement auth module")   # Create team tasks
3. Task(subagent_type="Engineer", team_name="my-project", name="auth-engineer")  # Spawn teammate
4. TaskUpdate(taskId="1", owner="auth-engineer") # Assign task
5. SendMessage(type="message", recipient="auth-engineer", content="...")  # Coordinate
```

**This is a COMPLETELY DIFFERENT system from custom agents:**
- **Custom agents** (Agents skill) = fire-and-forget parallel workers, no shared state
- **Agent teams** (TeamCreate) = persistent coordinated teams with shared task lists, messaging, multi-turn

**Team Guidelines:**
- Use for 3+ independently workable criteria at Extended+
- Large complex coding tasks benefit most
- Each teammate works independently on assigned tasks via shared task list
- Parent coordinates via `SendMessage`, reconciles results
- Teammates go idle between turns — send messages to wake them

### When to Use Teams vs Subagents (Decision Matrix)

| Factor | Subagents (Task) | Agent Teams (TeamCreate) |
|--------|------------------|--------------------------|
| **Communication** | Fire-and-forget, no peer messaging | Persistent messaging between teammates |
| **Context** | Fresh context each spawn, limited window | Full context window per teammate, preserved across turns |
| **Coordination** | Parent collects results, no shared state | Shared task list, direct peer DMs, idle/wake cycle |
| **Duration** | Single-turn execution | Multi-turn, iterative work with course corrections |
| **Overhead** | Low — spawn and forget | Higher — team setup, task creation, message routing |
| **Best for** | Parallel research, one-shot analysis, simple delegation | Complex multi-file changes, iterative debugging, cross-layer coordination |

**Decision rule:** If agents need to talk to each other or iterate on shared work → Teams. If each agent does independent one-shot work → Subagents.

**Concrete examples:**
- "Research 4 topics in parallel" → **Subagents** (independent, no coordination needed)
- "Build a feature spanning API + UI + tests with shared state" → **Teams** (cross-layer, needs coordination)
- "Run 10 file updates with same pattern" → **Subagents** (parallel, identical, independent)
- "Debug a complex issue with competing hypotheses" → **Teams** (need to share findings, adjust approach)

### 6. Parallel Task Dispatch

For N identical operations (e.g., updating 10 files with the same pattern):

1. Create N `Task()` calls in a single message (parallel launch)
2. Each agent gets one unit of work
3. Results collected when all complete

## Effort-Level Scaling

| Effort | Delegation Strategy |
|--------|-------------------|
| Instant/Fast | No delegation — direct tools only |
| Standard | 1-2 foreground agents max for discrete subtasks |
| Extended | 2-4 agents, background agents for research |
| Advanced | 4-8 agents, agent teams for 3+ workstreams |
| Deep | Full team orchestration, parallel workers |
| Comprehensive | Unbounded — teams + parallel + background |

## Two-Tier Delegation (Lightweight vs Full)

Not all delegation needs a full agent. Match delegation weight to task complexity:

### Lightweight Delegation
**For:** One-shot extraction, classification, summarization, simple Q&A against provided content.

```
Task(subagent_type="general-purpose", model="haiku", max_turns=3, prompt="...")
```

- Use `model="haiku"` for cost/speed efficiency
- Set `max_turns=3` — if it can't finish in 3 turns, it needs full delegation
- Provide all input inline in the prompt (no tool use expected)
- Examples: "Classify this text as X/Y/Z", "Extract the 5 key points from this", "Summarize this in 2 sentences"

### Full Delegation
**For:** Multi-step reasoning, tasks requiring tool use (file reads, searches, web), tasks that need their own iteration loop.

```
Task(subagent_type="general-purpose", prompt="...")  # or specialized agent type
```

- Default model (sonnet/opus inherited from parent)
- No max_turns restriction — agent iterates until done
- Agent uses tools autonomously (Read, Grep, Bash, etc.)
- Examples: "Research X and produce a report", "Refactor these 5 files", "Debug why test Y fails"

### Decision Rule
**Ask:** "Can this be answered in one LLM call with no tool use?" → Lightweight. Otherwise → Full.

| Signal | Tier |
|--------|------|
| Input fits in prompt, output is extraction/classification | Lightweight |
| Needs to read files, search, or browse | Full |
| Needs iteration or self-correction | Full |
| Simple transform of provided content | Lightweight |
| Requires domain expertise + research | Full |

**Why this matters:** Spawning a full agent for a one-shot extraction wastes ~10-30s of startup overhead and unnecessary context. Lightweight delegation returns in 2-5s. Over an Extended+ Algorithm run with 10+ delegations, this saves minutes. Inspired by RLM's `llm_query()` vs `rlm_query()` two-tier pattern (Zhang/Kraska/Khattab 2025).

## Anti-Patterns (Don't Do These)

- Don't delegate what Grep/Glob/Read can do in <2 seconds
- Don't spawn agents for single-file changes
- Don't create teams for fewer than 3 independent workstreams
- Don't send agents work without full context — they start fresh
- Don't use built-in agent names for custom agents
- Don't use built-in agent types (Designer, Architect, Engineer) when user asks for specialized or custom agents — always use ComposeAgent via the Agents skill
- Don't use full delegation for one-shot extraction/classification — use lightweight tier

## Gotchas

- **Delegation uses Claude Code's built-in TeamCreate** — NOT the Agents skill's ComposeAgent. These are different systems.
- **3+ independent workstreams warrant delegation.** For 1-2 tasks, direct work is faster than team coordination overhead.
- **Agent teams share a task list.** Use TaskCreate/TaskUpdate for coordination, not ad-hoc messages.
- **Teams overkill for single-file tasks.** (Mar 2026 reflection: "one agent that can both read code and write JSX is better than three specialists who can't coordinate")

## Examples

**Example 1: Parallel implementation**
```
User: "build the frontend and backend in parallel"
→ Creates team via TeamCreate
→ Spawns frontend and backend agents
→ Shared task list for coordination
→ Agents work independently, merge results
```

**Example 2: Research swarm**
```
User: "launch an agent team to research these 5 topics"
→ Creates team with 5 research agents
→ Each agent handles one topic independently
→ Results synthesized by team lead
```

## Execution Log

After completing any workflow, append a single JSONL entry:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"Delegation","workflow":"WORKFLOW_USED","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> ~/.claude/PAI/MEMORY/SKILLS/execution.jsonl
```

Replace `WORKFLOW_USED` with the workflow executed, `8_WORD_SUMMARY` with a brief input description, and `SECONDS` with approximate wall-clock time. Log `status: "error"` if the workflow failed.
