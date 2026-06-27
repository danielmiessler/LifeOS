# Algorithm Capabilities Reference

Loaded by OBSERVE on demand during capability selection.

## Thinking & Analysis Capabilities

Use these to enrich understanding BEFORE or DURING ISC writing. Select in the pre-ISC capability scan.

**Typical Cost column** (renamed from "Tier Fit" in Algorithm v5.0.0): the lowest effort tier at which this capability typically fits the budget. Pure information — not a restriction. The model decides per-task whether the capability is worth its cost given the tier time budget. At E1/E2, capabilities marked E3+ usually blow the budget; at E5 anything fits.

| Capability | Phases | Trigger Signal | Invoke | Typical Cost |
|------------|--------|----------------|--------|----------|
| IterativeDepth | OBSERVE | **Default at Extended+** when time budget allows deeper understanding; any important task where exploring the full problem space before ISC improves outcome; understanding what's actually being asked vs what was literally said; exploring different approach angles before committing; ambiguous scope, multi-faceted problems, hidden assumptions | `Skill("IterativeDepth")` | E2+ |
| ApertureOscillation | OBSERVE, THINK | Building something specific within a larger system; architecture decisions where scope framing changes the answer; feature design where tactical and strategic views may diverge; system coherence checks; scope negotiation. Complementary to IterativeDepth — ID rotates lenses, AO oscillates scope. Use AO when two distinct zoom levels (tactical target + strategic context) exist. | `Skill("ApertureOscillation")` | E3+ |
| FeedbackMemoryConsult | PLAN | **First step of PLAN at Extended+.** Before committing to approach, grep `~/.claude/projects/${HARNESS_USER_DIR}/memory/feedback_*.md` by task keywords. Prevents repeating mistakes already documented. Turns the memory system from write-only diary into active guardrail. | `Bash('rg -l "KEYWORDS" ~/.claude/projects/${HARNESS_USER_DIR}/memory/feedback_*.md')` | E2+ |
| Advisor | VERIFY | **At commitment boundaries on multi-step ISAs.** Before approach commitment, when stuck, once after durable deliverable before declaring done. Skip for short reactive tasks. If empirical results contradict advisor, re-call surfacing the conflict — do NOT silently switch. | `bun ${PAI_DIR}/TOOLS/Inference.ts --mode advisor <task> <state> <question>` | E3+ |
| ReReadCheck | VERIFY→LEARN boundary | **Final gate before emitting response (v3.29 RR1).** Re-read user's last message verbatim; enumerate every explicit ask against what shipped; block `phase: complete` on any `✗`. Targets the 82% "missed ask" complaint cluster. MANDATORY at every tier — at E1 single-part it's a one-line block. No fast-path exemption. | *(inline doctrine step — no external tool)* | E1+ |
| FirstPrinciples | THINK | Architecture decisions, inherited assumptions, stuck on approach | `Skill("FirstPrinciples")` | E2+ |
| SystemsThinking | OBSERVE, THINK | Recurring problems, structural causes, feedback loops, unintended consequences, "why does this keep happening?" Iceberg model, causal loop diagrams, Senge archetypes, Meadows' 12 leverage points | `Skill("SystemsThinking")` | E3+ |
| RootCauseAnalysis | THINK, VERIFY | Incident postmortems, defect investigation, "why did this happen?" 5 Whys, Fishbone, Fault Tree, Kepner-Tregoe IS/IS-NOT, blameless postmortems. Produces contributing factors (plural), not single root. | `Skill("RootCauseAnalysis")` | E3+ |
| Council | THINK, PLAN | Multi-perspective decision, trade-offs, controversial direction | `Skill("Council")` | E4+ |
| RedTeam | THINK, VERIFY | Strategy validation, stress-test plan, attack assumptions | `Skill("RedTeam")` | E4+ |
| Science | THINK→EXECUTE | Debugging hypothesis, systematic investigation, optimization | `Skill("Science")` | E3+ |
| BeCreative | OBSERVE, BUILD | Novel approaches needed, brainstorming, divergent thinking | `Skill("BeCreative")` | E2+ |
| Ideate | BUILD, EXECUTE | Multi-cycle idea generation, evolutionary ideation | `Skill("Ideate")` | E4+ |
| BitterPillEngineering | VERIFY | Audit for over-engineering, dead weight, fragile scaffolding | `Skill("BitterPillEngineering")` | E3+ |
| Evals | VERIFY | Objective measurement, prompt comparison, quality scoring | `Skill("Evals")` | E4+ |
| WorldThreatModel | THINK | Long-term strategy stress-test, future-proofing | `Skill("WorldThreatModel")` | E5 |
| Fabric patterns | any | Targeted transform via a specific Fabric pattern (extract_wisdom, summarize, etc.) | `Skill("Fabric")` | E1+ |
| ContextSearch | OBSERVE | Prior PAI work, session recovery, cold-start | `Skill("ContextSearch")` | E1+ |
| **ISA Skill** | **OBSERVE, PLAN, EXECUTE, VERIFY, LEARN** | **MANDATORY at E2+ for ISA scaffolding (`Skill("ISA", "scaffold from prompt at tier T")`), tier completeness checks (`Skill("ISA", "check completeness")`), ephemeral feature extraction at PLAN, canonical Decisions/Changelog/Verification entries via Append at any phase, and Reconcile after ephemeral feature work at LEARN. E1 may inline-write the minimal Goal+Criteria ISA to preserve <90s budget. The skill owns the canonical twelve-section template and refuses to write partial Deutsch C/R/L Changelog entries.** | `Skill("ISA", "<verb> <args>")` | E1+ |

## Code Quality Capabilities

Use after code changes or before PR creation.

| Capability | When | Invoke |
|------------|------|--------|
| **Forge (code producer)** | **MANDATORY at E3/E4/E5 for any coding task (implement, refactor, debug, build). Also invoke whenever {{PRINCIPAL_NAME}} names "Forge" at any tier. OpenAI-family coder — GPT-5.4 via `codex exec` at `model_reasoning_effort=high`. Specialization: quality + completeness. Distinct from Engineer (Claude-family) and Cato (auditor, read-only). DO NOT invoke at E1/E2 — cost/latency prohibitive.** | `Agent(subagent_type="Forge", prompt="...")` |
| **Anvil (Kimi K2.6 code producer)** | **Sibling to Forge, Moonshot-family.** Runs `kimi-k2.6` (reasoning model, Moonshot enforces temperature=1) via `PAI/TOOLS/AnvilProgress.ts` with Moonshot's 256K context. Pick Anvil over Forge when the task benefits from whole-project context breadth — cross-file refactors, architecture-fitting changes, long-range reasoning. Always invoke when {{PRINCIPAL_NAME}} names "Anvil" (name-match overrides tier gate). At E3/E4/E5, Forge remains the default producer; Anvil is chosen instead of or in parallel with Forge. Skip at E1/E2 unless {{PRINCIPAL_NAME}} named him. | `Agent(subagent_type="Anvil", prompt="...")` |
| /simplify | After code changes | `Skill("simplify")` |
| /batch | 3+ files with similar changes | `Skill("batch", "instruction")` |
| /code-review | After code changes, before PR | `Skill("code-review")` |
| /pr-review-toolkit:review-pr | Targeted PR aspect review | `Skill("pr-review-toolkit:review-pr")` |
| /codex:review | Complex code review needing second-model perspective | `Skill("codex:review")` |
| /codex:adversarial-review | Challenge design decisions, question approach and tradeoffs | `Skill("codex:adversarial-review")` |

### Forge auto-include binding (E3-E5 coding tasks)

**Trigger:** ISA `effort` is `advanced`, `deep`, or `comprehensive` AND the task involves writing or modifying code (implementation, refactor, debug, build, migration, fix, feature).

**Behavior:** At PLAN phase, add Forge to `🏹 CAPABILITIES SELECTED` with target phase EXECUTE. At EXECUTE, spawn Forge via `Agent(subagent_type="Forge", ...)`. Forge's report becomes part of the VERIFY bundle.

**Explicit-name override:** If {{PRINCIPAL_NAME}} mentions "Forge" in the request, invoke regardless of tier (even E1/E2). Name-match always wins over tier gate.

**Parallel with Engineer:** At E4/E5 where duplicate perspectives earn their cost, Forge and Engineer may both be spawned on the same task for cross-vendor code production. Each works in its own worktree; {{DA_NAME}} merges or picks the stronger diff in VERIFY.

**What this gate prevents:** E3+ coding work silently routed through Claude-family only, repeating the same-family blind spot pattern that Cato addresses on the review side.

### Anvil invocation binding (E3-E5 long-context coding tasks)

**Trigger:** ISA `effort` is `advanced`, `deep`, or `comprehensive` AND the task involves whole-project or cross-file reasoning where context breadth materially affects correctness (architecture-fitting refactors, system-wide migrations, multi-module redesigns).

**Behavior:** At PLAN phase, add Anvil to `🏹 CAPABILITIES SELECTED` with target phase EXECUTE. At EXECUTE, spawn Anvil via `Agent(subagent_type="Anvil", ...)`. Anvil's report becomes part of the VERIFY bundle.

**Picking Forge vs Anvil (both Moonshot-family and OpenAI-family are non-Anthropic, which satisfies the cross-vendor goal):**

- **Forge (GPT-5.4, codex exec):** localized completion speed, quality/completeness focus. Default producer at E3/E4/E5. Pick when the change is bounded to a small surface and the verification bar is "every branch is real."
- **Anvil (Kimi K2.6, Moonshot API):** long-context breadth, project-shape focus. Pick when the correctness depends on the surrounding architecture more than the local code — "does this fit" is the dominant question.
- **Parallel both:** at E4/E5 on the hardest work, {{DA_NAME}} may spawn Forge AND Anvil on the same task in isolated worktrees, then pick the stronger diff in VERIFY. Cross-vendor cross-coder diversity compounds.

**Explicit-name override:** If {{PRINCIPAL_NAME}} mentions "Anvil" in the request, invoke regardless of tier (even E1/E2). Name-match always wins.

## Delegation & Infrastructure Capabilities

Use for parallel workstreams and non-blocking execution.

| Capability | When | Invoke |
|------------|------|--------|
| Agent Teams | **DEFAULT for parallel work.** 2+ agents on related work, task dependencies, coordination needed. Teammates persist, self-claim tasks, message peers. | `TeamCreate` + `Agent` with `team_name` |
| Custom Agents | **ONLY when {{PRINCIPAL_NAME}} says "custom agents".** Unique personalities, voices, trait composition. One-shot parallel work. | `Skill("Agents")` → ComposeAgent → `Agent` |
| Managed Agents | **Unattended/overnight work.** Hours-long tasks, survive disconnects, sandboxed cloud execution, CI triggers. $0.08/session-hour + tokens. | `Skill("claude-api")` to build workflows |
| Delegation | 3+ independent workstreams (routes to above) | `Skill("Delegation")` |
| Worktree Isolation | Parallel write-agents on overlapping files | `Agent` with `isolation: "worktree"` |
| Background Agents | Non-blocking research or verification | `Agent` with `run_in_background: true` |
| Observer Team | **ONLY when time is not a constraint AND auditability is the primary requirement.** 3-agent read-only swarm watches `tool-activity.jsonl` (ground-truth audit log), votes continue/halt/escalate every 30s. Deliberate speed-for-safety trade — not for interactive work. Fit: overnight autonomous runs, production deploys needing post-hoc review, credential rotation, security-hook edits. | `Skill("Agents")` → `SPAWNOBSERVERS` workflow |
| Monitor | Event-driven waiting: logs, deploys, CI, file changes | `Monitor` tool — each stdout line wakes the agent |
| Mass Parallelism | Large migrations, bulk refactors across many files | `/batch` — interviews, then fans out to N worktree agents |
| Session Branching | Exploratory tangents, try alternative approaches | `/branch` — forks conversation, preserves original |
| /codex:rescue | Delegate bug investigation or fix to Codex (runs as background task) | `Skill("codex:rescue")` |

## Research & Intelligence Capabilities

Use when external information is needed.

| Capability | When | Invoke |
|------------|------|--------|
| Research | External context, multi-source investigation | `Skill("Research")` |
| ContextSearch | Prior PAI work, session recovery | `Skill("ContextSearch")` |
| Claude Code Guide | Claude Code internals, hooks, settings | `Agent(subagent_type="claude-code-guide")` |

## Agent Routing (Preference Order)

| Priority | User says | System | Invoke |
|----------|-----------|--------|--------|
| **1. DEFAULT** | "parallel work", "agents", "team", "swarm", or Algorithm selects delegation | **Agent Teams** — persistent teammates, shared task list, peer messaging | `TeamCreate` + `Agent` with `team_name` |
| **2. EXPLICIT** | "custom agents", "spin up custom agents" | **Custom Agents** — unique personalities, voices, trait composition | `Skill("Agents")` → ComposeAgent |
| **3. UNATTENDED** | "run overnight", "long-running", "CI", or task exceeds session lifetime | **Managed Agents** — durable cloud sessions, sandboxed, vault credentials | `Skill("claude-api")` to build |
| **4. INTERNAL** | (Algorithm internal routing, user names a type) | **Built-in types** (Designer, Architect, Engineer, Explore, etc.) | `Agent(subagent_type="...")` |

## Binding Commitment

Selecting a capability = binding commitment to invoke it via tool. If you realize mid-execution it's unneeded, remove it from the list with a reason.

## Proactive Skill Scan

The tables above cover the most commonly applicable capabilities. For domain-specific tasks, also check the system prompt skill list for specialized skills (e.g., a blogging skill for blog work, a security-assessment skill for pentest work, Art for visual content). Match skill triggers to the current task domain.

## Codex Operations

Codex commands run GPT-5.3-Codex as a second model for review or delegation. Management commands:
- `/codex:status` — check progress of background Codex tasks
- `/codex:result` — retrieve completed Codex output
- `/codex:cancel` — terminate active Codex tasks

## Agent Composition Guidelines

When spawning agents: provide raw source material not summaries, parallelize independent threads, use background agents for non-blocking work, don't duplicate work agents are already doing.

## Output Format

```
🏹 CAPABILITIES SELECTED:
 🏹 [Each capability, target phase, 8-word reason, use as many appropriate Capabilities as possible given the amount of time you have]
🏹 [12-24 words on selection rationale]
```
