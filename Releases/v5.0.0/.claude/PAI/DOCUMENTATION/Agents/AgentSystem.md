# PAI Agent System

**Authoritative reference for agent routing in PAI. Three distinct systems exist—never confuse them.**

---

## 🚨 THREE AGENT SYSTEMS — CRITICAL DISTINCTION

PAI has three agent systems that serve different purposes. Confusing them causes routing failures.

| System | What It Is | When to Use | Distinct Persona? |
|--------|-----------|-------------|-------------------|
| **Task Tool Subagent Types** | Pre-built agents in Claude Code (Architect, Designer, Engineer, Explore, etc.) | Internal workflow use ONLY | No |
| **Named Agents** | Persistent identities with backstories (your own personas) | Recurring work, relationships | Yes |
| **Custom Agents** | Dynamic agents composed via ComposeAgent from traits | When user says "custom agents" | Yes (trait-mapped) |

---

## 🚫 FORBIDDEN PATTERNS

**When user says "custom agents":**

```typescript
// ❌ WRONG - These are Task tool subagent_types, NOT custom agents
Task({ subagent_type: "Architect", prompt: "..." })
Task({ subagent_type: "Designer", prompt: "..." })
Task({ subagent_type: "Engineer", prompt: "..." })

// ✅ RIGHT - Invoke the Agents skill for custom agents
Skill("Agents")  // → CreateCustomAgent workflow
// OR follow the workflow directly:
// 1. Run ComposeAgent with different trait combinations
// 2. Launch agents with the generated prompts
// 3. Each gets a unique personality

// ❌ WRONG - User says "specialized agents to brainstorm"
Task({ subagent_type: "Designer", prompt: "Brainstorm UI ideas..." })
Task({ subagent_type: "Architect", prompt: "Brainstorm layout ideas..." })
Task({ subagent_type: "Engineer", prompt: "Brainstorm state ideas..." })

// ✅ RIGHT - Use Agents skill for ANY user-requested specialized agents
Skill("Agents")  // → CreateCustomAgent workflow with unique traits per agent
// Each agent gets: unique name and unique personality via ComposeAgent
```

---

## Routing Rules

### The Word "Custom" Is the Trigger

| User Says | Action | Implementation |
|-----------|--------|----------------|
| "**custom agents**", "spin up **custom** agents" | Invoke Agents skill | `Skill("Agents")` → CreateCustomAgent workflow |
| "agents", "**specialized agents**", "launch agents", "parallel agents" | Custom agents via Agents skill | `Skill("Agents")` → ComposeAgent → `Task({ subagent_type: "general-purpose" })` |
| "research X", "investigate Y" | Research skill | `Skill("Research")` → appropriate researcher agents |
| "use Remy", "get Ava to" | Named agent | Use appropriate researcher subagent_type |
| (Code implementation, standard) | Engineer | `Task({ subagent_type: "Engineer" })` |
| (Production-grade code, E3+, "no shortcuts" directive, OR named "Forge") | Forge (cross-vendor, OpenAI-family GPT-5.4 via `codex exec`) | `Agent({ subagent_type: "Forge" })` |
| (Whole-project long-context coding, OR named "Anvil") | Anvil (cross-vendor, Kimi K2.6 via Moonshot API) | `Agent({ subagent_type: "Anvil" })` |
| (Cross-vendor audit, MANDATORY at E4/E5 in VERIFY) | Cato (read-only auditor, OpenAI-family GPT-5.x) | `Agent({ subagent_type: "Cato" })` |
| (Architecture/design) | Architect | `Task({ subagent_type: "Architect" })` |
| (Claude Code hooks, settings, commands, MCP, agents, API) | Claude Code Guide | `Task({ subagent_type: "claude-code-guide" })` — verify latest features before implementing |

### Custom Agent Creation Flow

When user requests custom agents:

1. **Invoke Agents skill** via `Skill("Agents")` or follow CreateCustomAgent workflow
2. **Run ComposeAgent** for EACH agent with DIFFERENT trait combinations
3. **Extract prompt** from ComposeAgent output
4. **Launch agents** with Task tool using the composed prompts

```bash
# Example: 3 custom research agents
bun run ~/.claude/skills/Agents/Tools/ComposeAgent.ts --traits "research,enthusiastic,exploratory"
bun run ~/.claude/skills/Agents/Tools/ComposeAgent.ts --traits "research,skeptical,systematic"
bun run ~/.claude/skills/Agents/Tools/ComposeAgent.ts --traits "research,analytical,synthesizing"
```

---

## ⚠️ Task Tool Subagent Types — INTERNAL WORKFLOW USE ONLY

**These are NOT for user-requested custom/specialized agents.** When the user asks for specialized agents, custom agents, or agents with unique perspectives, ALWAYS use the Agents skill (ComposeAgent) instead. See Routing Rules above.

These are pre-built agents in the Claude Code Task tool. They are for **internal workflow use**, not for user-requested "custom agents."

| Subagent Type | Purpose | When Used |
|---------------|---------|-----------|
| `Architect` | System design | Development skill workflows |
| `Designer` | UX/UI design | Development skill workflows |
| `Engineer` | Code implementation | Development skill workflows |
| `general-purpose` | Custom agents via ComposeAgent | Parallel work with task-specific prompts |
| `Explore` | Codebase exploration | Finding files, understanding structure |
| `Plan` | Implementation planning | Plan mode |
| `Forge` | Cross-vendor coder (OpenAI-family GPT-5.4 via `codex exec`) | Production-grade code at E3+ or "no shortcuts" directive |
| `Anvil` | Cross-vendor coder (Kimi K2.6 via Moonshot direct API, 256K context) | Whole-project long-context reasoning where the entire repo matters |
| `Cato` | Cross-vendor auditor (read-only, OpenAI-family GPT-5.x via `codex exec --sandbox read-only`) | MANDATORY at E4/E5 in VERIFY — surfaces same-family blind spots |
| ~~`BrowserAgent`~~ | **DEPRECATED** | Replaced by **Interceptor** skill (real Chrome, no CDP fingerprint) |
| ~~`UIReviewer`~~ | **DEPRECATED** | Replaced by **Interceptor** skill |
| ~~`QATester`~~ | **DEPRECATED** | Replaced by **Interceptor** skill — Gate 4 browser-based QA validation |
| `Silas` | Security testing (offensive-security specialist persona) | Spawned by security assessment skills (one per attack surface) |
| `claude-code-guide` | Claude Code knowledge (hooks, settings, slash commands, MCP, agent types, keybindings, IDE, Agent SDK, Claude API) | Any task involving Claude Code internals — freshness check before implementing |
| `ClaudeResearcher` | Claude-based research | Research skill workflows |
| `GeminiResearcher` | Gemini-based research | Research skill workflows |
| `GrokResearcher` | Grok-based research | Research skill workflows |

**These do NOT have distinct personas or ComposeAgent composition.**

---

## Named Agents (Persistent Identities)

Named agents have rich backstories and personality traits. They provide relationship continuity across sessions. **Compose your own named-agent roster** — the examples below are illustrative; every PAI user defines their own personas.

| Agent (example) | Role | Use For |
|-----------------|------|---------|
| Architect | Architecture lead | Long-term architecture decisions |
| Engineer | Senior engineer | Strategic technical leadership |
| Security Specialist | Offensive security | Red-team review, vulnerability hunting |
| Primary Researcher | Strategic research lead | Deep research + synthesis |
| Secondary Researcher | Multi-perspective research | Comparative analysis |

**Full backstories:** Individual `agents/*.md` files (persona frontmatter + body) — define your own.

---

## Custom Agents (Dynamic Composition)

Custom agents are composed on-the-fly from traits using ComposeAgent. Each unique trait combination produces a distinct personality.

### Trait Categories

**Expertise** (domain knowledge):
`security`, `legal`, `finance`, `medical`, `technical`, `research`, `creative`, `business`, `data`, `communications`

**Personality** (behavior style):
`skeptical`, `enthusiastic`, `cautious`, `bold`, `analytical`, `creative`, `empathetic`, `contrarian`, `pragmatic`, `meticulous`

**Approach** (work style):
`thorough`, `rapid`, `systematic`, `exploratory`, `comparative`, `synthesizing`, `adversarial`, `consultative`

**Full trait definitions:** `skills/Agents/Data/Traits.yaml`

---

## Model Selection

Always specify the appropriate model for agent work:

| Task Type | Model | Speed |
|-----------|-------|-------|
| Simple checks, grunt work | `haiku` | 10-20x faster |
| Standard analysis, implementation | `sonnet` | Balanced |
| Deep reasoning, architecture | `opus` | Maximum intelligence |

```typescript
// Parallel custom agents benefit from haiku/sonnet for speed
Task({ prompt: agentPrompt, subagent_type: "general-purpose", model: "sonnet" })
```

---

## Spotcheck Pattern

**Always launch a spotcheck agent after parallel work:**

```typescript
Task({
  prompt: "Verify consistency across all agent outputs: [results]",
  subagent_type: "general-purpose",
  model: "haiku"
})
```

---

## Knowledge Archive Access

Agents can query the **Knowledge Archive** (`~/.claude/PAI/MEMORY/KNOWLEDGE/`) for accumulated knowledge organized by 4 entity types: People (human beings), Companies (organizations), Ideas (insights/theses/analyses), Research (longer-form research notes). Topic is a tag, not a domain. Managed by Algorithm LEARN phase (direct writes), `PAI/TOOLS/KnowledgeHarvester.ts` (validation/maintenance), and the `/knowledge` skill. Particularly useful for research agents and custom agents composed with specialized traits.

---

## Managed Agents (Cloud API)

Anthropic's hosted agent service for long-horizon, unattended work. **Separate from Claude Code** — runs on Anthropic's cloud infrastructure with durable sessions and sandboxed execution.

**Status:** Beta. All API accounts have access. Beta header: `anthropic-beta: managed-agents-2026-04-01` (SDK handles automatically).
**Pricing:** Standard token costs + $0.08/active session-hour (pro-rated).
**Docs:** https://www.anthropic.com/engineering/managed-agents

### Architecture

Three decoupled components:
- **Brain** (Claude + harness) — stateless inference, restarts without data loss
- **Hands** (execution environments) — sandboxed containers, provisioned on-demand
- **Session** (durable event log) — append-only, survives crashes, resumes via `wake(sessionId)`

### API Surface

| Endpoint | Purpose |
|----------|---------|
| `POST /v1/agents` | Create reusable agent blueprint (model, system, tools) |
| `POST /v1/environments` | Create container config (packages, networking, secrets) |
| `POST /v1/sessions` | Start a running instance from agent + environment |
| `POST /v1/sessions/{id}/events` | Send messages/tool results |
| `GET /v1/sessions/{id}/stream` | SSE event stream |

### When to Use

- Task runs for **hours unattended** (overnight security scans, content processing)
- Needs to **survive disconnects** (durable event log, not session-scoped)
- Requires **sandboxed execution** (untrusted code, credential isolation via vaults)
- Triggered by **CI/external event** (webhook-initiated, not interactive)

### When NOT to Use

- Interactive work (use Agent Teams or Custom Agents)
- Tasks under 30 minutes (coordination overhead exceeds benefit)
- Tasks needing PAI context (managed agents don't load CLAUDE.md or PAI skills)

### Example (TypeScript)

```typescript
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic();

const agent = await client.beta.agents.create({
  name: "Security Scanner",
  model: "claude-sonnet-4-6",
  system: "You are a security auditor...",
  tools: [{ type: "agent_toolset_20260401" }],
});

const env = await client.beta.environments.create({
  name: "scanner-env",
  config: { type: "cloud", networking: { type: "unrestricted" } },
});

const session = await client.beta.sessions.create({
  agent: agent.id,
  environment_id: env.id,
});

// Stream results
const stream = await client.beta.sessions.events.stream(session.id);
await client.beta.sessions.events.send(session.id, {
  events: [{ type: "user.message", content: [{ type: "text", text: "Audit the auth module" }] }],
});
```

---

## Agent System Preference Order

When the Algorithm needs to delegate work, use this priority:

| Priority | System | Trigger | Key Trait |
|----------|--------|---------|-----------|
| **1. DEFAULT** | Agent Teams | Any parallel work, task dependencies, coordination needed | Persistent, peer messaging, shared task list |
| **2. EXPLICIT** | Custom Agents | {{PRINCIPAL_NAME}} says "custom agents" | Unique personalities, one-shot |
| **3. UNATTENDED** | Managed Agents | Overnight, CI, survives disconnects | Durable, sandboxed, cloud |
| **4. INTERNAL** | Built-in types | Algorithm routing, specific subagent type needed | Designer, Architect, Engineer, etc. |

---

## Agent Watchdog (Background Agent Monitoring)

Background agents can hang or go silent with no visibility. The Pulse agent-guard hook automatically injects a Monitor watchdog reminder when `run_in_background: true` agents are spawned. The watchdog (`Tools/AgentWatchdog.ts`) monitors `tool-activity.jsonl` for silence — if no tool calls for 90 seconds while agents are active, it alerts via the Monitor tool's stdout notification mechanism. One persistent watchdog covers all background agents per session.

---

## Observer Team Archetype (Read-Only Oversight)

Distinct from functional teams (engineering, design, security, etc.). An Observer team watches what a primary agent DID — not what it said. Mythos-class autonomous agents can represent concealment and strategic manipulation in their activations, so chain-of-thought oversight is insufficient; audit-log oversight becomes load-bearing.

**Shape:**
- **Read-only** — observers never call write tools. Violations = immediate self-halt.
- **Fed the audit log** — consume `MEMORY/OBSERVABILITY/tool-activity.jsonl` (with `ground_truth` captured by `ToolActivityTracker.hook.ts`), not chat transcripts.
- **Vote** — continue / halt / escalate. Majority rule; any escalate bubbles to {{PRINCIPAL_NAME}} via Pulse.
- **Cost-justified by catastrophe prevention**, not feature velocity.

**Use ONLY when BOTH conditions hold:**
1. **Time is not a constraint** — observers add 30-second voting cycles and ~$0.10/primary-hour in Sonnet cost. They trade speed for safety.
2. **Auditability is the primary requirement** — when the goal is a defensible, verifiable trail of what the primary agent did (for compliance, post-incident review, or catastrophe prevention), not fast turnaround.

**Typical fit:** overnight / unattended autonomous runs, production deploys where post-hoc review matters, credential rotation, PATTERNS.yaml or security-hook edits, any work where "I want to be able to prove nothing dangerous happened" is the goal.

**Do NOT use for:** any time-sensitive work, interactive sessions where {{PRINCIPAL_NAME}} is watching, short reactive tasks (<5 tool calls), read-only analysis, or anything where preflight gates A/B/C/D already give sufficient guarantees.

**Invocation:** `Skill("Agents")` → `SPAWNOBSERVERS` workflow (`skills/Agents/Workflows/SpawnObservers.md`). Three observer instances spawn with specializations: policy-compliance, intent-drift, blast-radius.

---

## References

- **Master Architecture:** `~/.claude/PAI/DOCUMENTATION/PAISystemArchitecture.md` — authoritative system-of-systems reference
- **Agents Skill:** `skills/Agents/SKILL.md` — Custom agent creation, workflows
- **ComposeAgent:** `skills/Agents/Tools/ComposeAgent.ts` — Dynamic composition tool
- **Traits:** `skills/Agents/Data/Traits.yaml` — Trait definitions
- **Agent Personalities:** Individual `agents/*.md` files — Named agent backstories
- **Managed Agents:** https://www.anthropic.com/engineering/managed-agents — Anthropic cloud agent API

---

*Last updated: 2026-04-29*
