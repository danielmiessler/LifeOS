---
name: Delegation
version: 1.0.23
description: "Parallelizes work across six patterns — built-in agents, worktree-isolated agents, background agents, custom inline-brief agents, multi-turn agent teams, and parallel task dispatch — choosing teams when agents must share state, subagents when independent. USE WHEN parallel execution, agent team, swarm, spawn agents, fan out, divide and conquer, multi-agent, coordinate agents, custom agents."
effort: medium
---

# Delegation — Agent Orchestration & Parallelization

## What It Does

Parallelizes work across six patterns: built-in agents, worktree-isolated agents, background agents, custom agents via inline briefs, agent teams via TeamCreate, and parallel task dispatch. It also splits delegation into two weights — lightweight one-shot workers (capped turns) versus full agents that iterate with tools. The Algorithm auto-invokes it once work hits three or more independent workstreams.

## The Problem

Doing independent work serially wastes time, but throwing every task at a heavyweight agent wastes more — spawning a full agent for a one-shot classification burns 10-30 seconds of startup for nothing. Worse, people conflate two different systems: fire-and-forget custom agents with no shared state, and persistent agent teams that message each other and share a task list. Pick the wrong one and you either over-coordinate simple work or under-coordinate complex work. This skill routes each job to the right pattern and the right weight.

## How It Works

**Auto-invoked by the Algorithm when work can be parallelized or requires agent specialization.**

## 🚨 CRITICAL ROUTING — Two COMPLETELY Different Systems

| the user Says | System | Tool | What Happens |
|-------------|--------|------|-------------|
| "**custom agents**", "**specialized agents**", "spin up agents", "launch agents" | **Inline briefs** | `Task(subagent_type="general-purpose", prompt=<inline brief: name + role + stance>)` | Distinct personas written per topic |
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
- **Unattended autonomous work where auditability matters more than speed** — the Observer-team pattern (read-only agents watching the tool-activity audit log, voting continue/halt/escalate) is a fit here, but it is not currently implemented; it was retired with the Agents skill and would need to be rebuilt as its own component before use.

## Delegation Patterns

### 1. Built-In Agents

**⚠️ Built-in agents are for internal workflow routing ONLY.** When the user asks for custom, specialized, or uniquely-voiced agents, write an inline brief per agent (section 4 below) and launch `general-purpose`.

Use `Task(subagent_type="AgentType")` with these specialized agents:

| Agent Type | Specialization | When to Use |
|-----------|---------------|-------------|
| `general-purpose` (+ role brief) | Code, architecture, design work | Add a senior-engineer/TDD or system-design brief in the prompt — the `Engineer`/`Architect` types were retired |
| `Algorithm` | ISC optimization, criteria work | ISC-specialized verification |
| `Explore` | Fast codebase search | Quick file/pattern discovery |
| `Plan` | Implementation strategy | Design before execution |

**Always include:** Full context, effort budget, expected output format.

### 2. Worktree-Isolated Agents

Run agents in their own git worktree with `isolation: "worktree"` for file-safe parallelism:

```
Task(subagent_type="general-purpose", isolation: "worktree", prompt="Senior engineer, TDD. ...")
```

- Each agent gets its own working tree — no file conflicts with other agents
- Worktree auto-created on spawn, auto-cleaned when agent finishes (unless changes made)
- Use when multiple agents edit the same files or for competing approaches
- Can combine with `run_in_background: true` for non-blocking isolated work
- **Built-in agents with `isolation: worktree` in frontmatter** auto-isolate on every spawn

### 3. Background Agents

Run agents with `run_in_background: true` for non-blocking parallel work:

```
Task(subagent_type="general-purpose", run_in_background: true, prompt="Senior engineer, TDD. ...")
```

- Use when results aren't needed immediately
- Check output with `Read` tool on the output_file path
- Ideal for: research, long builds, parallel investigations

### 3b. Foreground Agents (the default — contrast to pattern 3, not a seventh pattern)

Standard `Task()` calls that block until complete:

- Use when you need the result before proceeding
- Use for sequential dependencies
- Default mode — most common

### 4. Custom Agents (inline briefs)

**Trigger:** "custom agents", "spin up agents", "launch agents", "specialized agents"
**Action:** Write a distinct brief for each agent — a name, a role/expertise, and a stance — then launch each with `Task(subagent_type="general-purpose")`. No composition tool; the orchestrator writes the persona.

```typescript
Task(
  subagent_type="general-purpose",
  prompt=<agent brief: "You are a skeptical security reviewer focused on auth bypass..."> + <task + context>
)
```

- Give each agent a DIFFERENT brief so their perspectives actually diverge
- A capable model writes a sharper topic-specific persona than any trait lookup
- Ideal for: domain experts, adversarial reviewers, creative brainstormers, parallel analysis

### 5. Agent Teams (via TeamCreate)

**Trigger:** "create an agent team", "agent team", "swarm", "team of agents"
**Action:** Use `TeamCreate` tool → `TaskCreate` → spawn teammates via `Task(team_name=...)` → coordinate via `SendMessage`

```
1. TeamCreate(team_name="my-project")           # Creates team + task list
2. TaskCreate(subject="Implement auth module")   # Create team tasks
3. Task(subagent_type="general-purpose", team_name="my-project", name="auth-engineer")  # Spawn teammate (senior-engineer/TDD brief in prompt)
4. TaskUpdate(taskId="1", owner="auth-engineer") # Assign task
5. SendMessage(type="message", recipient="auth-engineer", content="...")  # Coordinate
```

**This is a COMPLETELY DIFFERENT system from custom agents:**
- **Custom agents** (inline briefs) = fire-and-forget parallel workers, no shared state
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
Task(subagent_type="general-purpose", max_turns=3, prompt="...")
```

- Model is a per-dispatch judgment call (`model` param; unspecified inherits the session model)
- Set `max_turns=3` — if it can't finish in 3 turns, it needs full delegation
- Provide all input inline in the prompt (no tool use expected)
- Examples: "Classify this text as X/Y/Z", "Extract the 5 key points from this", "Summarize this in 2 sentences"

### Full Delegation
**For:** Multi-step reasoning, tasks requiring tool use (file reads, searches, web), tasks that need their own iteration loop.

```
Task(subagent_type="general-purpose", prompt="...")  # or specialized agent type
```

- Unspecified model inherits the session model (harness behavior)
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

## Right-Sizing Pre-Gate (PLAN, all tiers)

The tier delegation floors set a *minimum* fan-out. This gate sets the *ceiling* and the proof you owe. Run it before any fan-out. It exists because over-delegation is one of the most expensive recurring wastes in the reflection log: teams spawned for single-file rewrites, a writing agent that reported "completed" with zero disk writes (110k tokens spent for nothing), 300-agent waves with no headroom left to verify them. The outside proof is Cloudflare's risk-tiered dispatch — scale the agent count to the size of the job. Don't send the dream team to review a typo fix.

- **(a) Zero-agent check.** Is the answer already in working memory, or reachable by `Glob`+`Grep`+`Read` in under 30s, or isolated to a single file? Then **0 agents** — do it inline. A subagent isn't free; its setup, context load, and result handling cost more than a direct read.
- **(b) Disk-effect probe on every writing agent.** An agent that says it wrote or edited files isn't trusted until you confirm it: the file exists AND the diff is non-empty (`Read` / `git diff` / `Grep` the claimed change). A "completed" report is a claim, not evidence. Rule 1 Live-Probe binds delegates exactly as it binds the primary.
- **(c) Budget reservation above ~8 agents.** A fan-out past ~8 concurrent agents must reserve explicit verification budget — you can't spend it all generating and none confirming — and name a non-agent fallback branch in `## Decisions` for when the wave comes back unusable. This bounds the 5-level nesting capability: nesting multiplies agent count, so the ceiling is on the whole tree, not just the top layer.

**Output at the Delegation Gate:** `📐 RIGHT-SIZE: [0-agent inline | N agents, disk-probed | N>8, verify-budget reserved + fallback named]`.

## Agent Briefs Are Ideal-State Prompts

**Every inline brief and Workflow subagent prompt articulates the ideal state, not the procedure.** State WHAT a done result looks like (as testable outcomes), the CONSTRAINTS, and the TOOLS available — then trust the agent to find HOW. A brief that choreographs the agent's reasoning ("first search, then extract, then verify, then synthesize") is BPE-violating scaffolding: it caps a capable agent and rots as models improve. This is the highest-volume prompting surface in the system (subagent briefs are written constantly at runtime), so the discipline matters most here. Keep the four keep-classes — safety-gate, verified-gotcha, tool-contract, output-format-contract — and delete the choreography. Prefer stating the coverage OUTCOME over a hardcoded fan-out count ("trust a match only when 3+ independent sources align", not "spawn exactly 15 agents"). Full standard: `skills/Prompting/Standards.md` § Ideal-State Prompting.

## Anti-Patterns (Don't Do These)

- Don't delegate what Grep/Glob/Read can do in <2 seconds
- Don't spawn agents for single-file changes
- Don't create teams for fewer than 3 independent workstreams
- Don't send agents work without full context — they start fresh
- Don't use built-in agent names for custom agents
- Don't use bare built-in agent types when user asks for specialized or custom agents — write a distinct inline brief per agent and launch `general-purpose`
- Don't use full delegation for one-shot extraction/classification — use lightweight tier

## Gotchas

- **Delegation uses Claude Code's built-in TeamCreate** for coordinated teams — distinct from one-shot custom agents (inline briefs on `general-purpose`). These are different patterns.
- **3+ independent workstreams warrant delegation.** For 1-2 tasks, direct work is faster than team coordination overhead.
- **Agent teams share a task list.** Use TaskCreate/TaskUpdate for coordination, not ad-hoc messages.
- **Teams overkill for single-file tasks.** (Mar 2026 reflection: "one agent that can both read code and write JSX is better than three specialists who can't coordinate")
- **Forked subagents inherit the full main-thread conversation + share its prompt cache** (Anthropic CC v2.1.133+, enabled via `CLAUDE_CODE_FORK_SUBAGENT=1` env or agent frontmatter `context: fork`). Use forked subagents for **nuance-dependent work**: design variations, follow-on research, anything that depends on context the main thread already established. **DO NOT FORK for code review** — a forked reviewer defends its own code (R Amjad: "biased toward defending own code"). For convergence questions, run one fork + one non-fork in parallel and look at where they disagree.

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
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"Delegation","workflow":"WORKFLOW_USED","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> "${LIFEOS_DIR}/MEMORY/SKILLS/execution.jsonl"
```

Replace `WORKFLOW_USED` with the workflow executed, `8_WORD_SUMMARY` with a brief input description, and `SECONDS` with approximate wall-clock time. Log `status: "error"` if the workflow failed.
