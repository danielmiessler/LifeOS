---
name: CopilotCLI
pack-id: pai-copilotcli-v1.0.0
version: 1.0.0
author: danielmiessler
description: PAI's core skills ported to GitHub Copilot CLI environment — Thinking (7 modes), Research (4 modes), Investigation (OSINT+PI), and Agents (trait composition)
type: skill
purpose-type: [thinking, analysis, research, investigation, code-assistance]
platform: copilot-cli
dependencies: ["github-copilot-cli"]
keywords: [thinking, research, investigation, osint, pi, agents, copilot-cli, mcp, task-agents]
---

# CopilotCLI — PAI Skills for GitHub Copilot CLI

> PAI's proven skill system ported to GitHub Copilot CLI. Seven thinking modes, four research modes, OSINT+PI investigation, and trait-based agents — now accessible via the CLI and MCP infrastructure.

---

## The Problem

GitHub Copilot CLI provides powerful command-line code assistance, but lacks the structured thinking, research, and investigation capabilities that PAI's Claude Code packs provide. When working in the terminal, you lose access to:

- **Structured thinking modes** -- no first principles decomposition, adversarial validation, or scientific diagnosis
- **Multi-mode research** -- no systematic literature search, market analysis, threat intelligence, or competitive research
- **Investigation frameworks** -- no OSINT/PI workflows for gathering and analyzing information
- **Agent traits composition** -- no way to combine expertise specializations into unified agents

The fundamental issue: terminal-based work shouldn't mean losing access to sophisticated analytical thinking frameworks.

---

## The Solution

CopilotCLI ports PAI's core skills to the GitHub Copilot CLI environment using MCP (Model Context Protocol) infrastructure and background task agents:

**Thinking** (7 modes) -- First principles decomposition, iterative depth analysis, creative brainstorming, multi-agent council debates, adversarial red teaming, world threat modeling, and scientific hypothesis testing.

**Research** (4 modes) -- Literature search, market analysis, threat intelligence, and competitive research with systematic methodology.

**Investigation** -- OSINT (Open Source Intelligence) and PI (Private Investigation) workflows for structured information gathering and analysis.

**Agents** -- Trait composition system that combines expertise specializations (Security, Infrastructure, DevOps, Full-Stack, etc.) into unified agents for targeted analysis.

The core difference from Claude Code: instead of native skills, CopilotCLI uses `task(mode="background")` agents with MCP tools, storing configurations in `~/.copilot/pai/` instead of `~/.claude/skills/`.

---

## Installation

This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using `INSTALL.md`.

**What is PAI?** See the [PAI Project Overview](https://github.com/danielmiessler/Personal_AI_Infrastructure#what-is-pai).

---

## What's Included

| Component | Path | Purpose |
|-----------|------|---------|
| Thinking skill router | `src/Thinking/SKILL.md` | Routes requests to 7 thinking modes |
| Thinking modes | `src/Thinking/Modes/` | FirstPrinciples, IterativeDepth, BeCreative, Council, RedTeam, WorldThreatModel, Science |
| Research skill router | `src/Research/SKILL.md` | Routes requests to 4 research modes |
| Research modes | `src/Research/Modes/` | LiteratureSearch, MarketAnalysis, ThreatIntelligence, CompetitiveResearch |
| Investigation skill | `src/Investigation/SKILL.md` | OSINT and PI workflows |
| Investigation workflows | `src/Investigation/Workflows/` | Information gathering, source validation, analysis synthesis |
| Agents skill | `src/Agents/SKILL.md` | Trait composition and agent instantiation |
| Agent traits | `src/Agents/Traits/` | Expertise specializations: Security, Infrastructure, DevOps, FullStack, Backend, Frontend, DataScience, etc. |
| MCP configuration | `mcp/` | Tool definitions for task agents |
| CLI integration | `cli/` | Command wrappers and shell integration |

**Summary:**
- **Thinking modes:** 7 (same as Claude Code Thinking pack)
- **Research modes:** 4 (same as Claude Code Research pack)
- **Investigation workflows:** OSINT + PI
- **Agent traits:** 8+ specializations
- **Dependencies:** GitHub Copilot CLI, Node.js 18+ (optional, for pitcrew MCP server)

---

## Platform Mapping: Claude Code → Copilot CLI

| Claude Code Concept | Copilot CLI Equivalent | Notes |
|---------------------|----------------------|-------|
| Native Skills | MCP-based task agents | Use `task(mode="background", agent_type="general-purpose")` |
| ~\.claude\skills\ | ~/.copilot/pai/ | Configuration and custom agent definitions |
| Task() workflows | task() with shellId | Background agents with full CLI tool access |
| Claude Code file access | Workspace file access | Uses cwd and view/edit tools |
| Session state | Session SQL database | sql tool with session database for state tracking |
| Prompt engineering | MCP tool definitions | Tool schemas define agent capabilities |

---

## Key Differences from Claude Code

### 1. Agent Invocation
**Claude Code:**
```
Use the Thinking skill to decompose this problem
```

**Copilot CLI:**
```powershell
# Via CLI
copilot think --mode first-principles "decompose this problem"

# Via API (background agent)
task(mode="background", agent_type="general-purpose", name="think", prompt="decompose this...")
```

### 2. Tool Access
**Claude Code:** Native skills have built-in Claude tools (file access, web search, knowledge bases)

**Copilot CLI:** MCP tools (grep, view, powershell, web_fetch, bluebird tools for Azure DevOps, etc.)

### 3. Configuration Location
**Claude Code:** `~/.claude/skills/`

**Copilot CLI:** `~/.copilot/pai/`

### 4. Persistent State
**Claude Code:** Skill-managed state files

**Copilot CLI:** SQL session database via `sql()` tool

---

## Prerequisites

- **GitHub Copilot CLI** -- installed and authenticated
- **Node.js 18+** -- optional, required only for pitcrew MCP server (advanced usage)
- **Git** -- for version control integration
- **~/.copilot/pai/** -- directory will be created during installation

---

## Example Workflows

### Terminal-Based Thinking

```
User: copilot think --mode first-principles "Redesign our auth system"

Response:
Launching background agent: FirstPrinciples thinking mode...

[Identifies claimed truths about auth architecture]
[Traces each to fundamental axioms]
[Separates verified truths from inherited assumptions]
[Lists reconstruction opportunities]

Key finding: "All users need same auth flow" is an inherited assumption.
Reality: Different user roles have fundamentally different trust requirements.
Reconstruction: Design separate auth paths for admin, service, and user tiers.
```

### Code Investigation with OSINT

```
User: copilot investigate --mode osint "Research security implications of dependency X"

Response:
Launching Investigation agent...

[Gathers dependency metadata from npm registry]
[Analyzes GitHub repository history and issues]
[Searches threat intelligence databases]
[Checks known CVE records]
[Examines maintainer reputation and activity]

Finding: 2 unpatched CVEs, maintenance stalled for 8 months
Risk level: HIGH
Recommendation: Migrate to maintained alternative
```

### Agent Trait Composition

```
User: copilot agent --traits Security,Infrastructure "Analyze this infrastructure config for security gaps"

Response:
Instantiating composite agent: Security + Infrastructure specialization...

[Security trait: threat modeling, attack surface analysis]
[Infrastructure trait: architecture review, deployment patterns]
[Combined analysis with cross-trait validation]

Results:
- Security: 3 IAM policy vulnerabilities
- Infrastructure: 2 redundancy gaps
- Cross-trait: Auth tokens visible in deployment logs (CRITICAL)
```

---

## Configuration

### Basic Configuration
No configuration required. All skills work immediately after installation.

### Optional: MCP Tool Registration
Register additional MCP tools in `~/.copilot/mcp-config.json`:
```json
{
  "servers": {
    "pai-pitcrew": {
      "command": "node",
      "args": ["~/.copilot/pai/mcp/pitcrew-server.js"]
    }
  }
}
```

### Optional: Custom Agent Traits
Add custom traits in `~/.copilot/pai/traits/`:
```yaml
# ~/.copilot/pai/traits/CustomTrait.md
name: CustomTrait
description: Your expertise description
keywords: [keyword1, keyword2]
capabilities:
  - specific capability 1
  - specific capability 2
```

---

## What Makes This Different

Unlike generic CLI assistance, CopilotCLI brings structured analytical thinking to the terminal:

- **Seven complete thinking methodologies**, not just "think step by step"
- **Four research modes with distinct workflows** (not generic web search)
- **OSINT/PI investigation workflows** for systematic intelligence gathering
- **Trait-based agent composition** (not single-mode agents)
- **Background task execution** with visible transcripts and full CLI tool access
- **Session state management** via SQL (not ephemeral context)
- **MCP infrastructure** for extensible tool integration

---

## Invocation Scenarios

| Request | Thinking Mode | Research Mode | Investigation | Agents |
|---------|---------------|---------------|---------------|--------|
| "Decompose this from first principles" | FirstPrinciples ✓ | — | — | — |
| "Search literature on X" | — | LiteratureSearch ✓ | — | — |
| "Analyze market trends" | — | MarketAnalysis ✓ | — | — |
| "Investigate a security threat" | — | — | OSINT ✓ | Security ✓ |
| "Build an agent with Security + DevOps traits" | — | — | — | Traits ✓ |
| "Red team this architecture" | RedTeam ✓ | — | — | Security ✓ |
| "Research competitive landscape" | — | CompetitiveResearch ✓ | — | — |

---

## Customization

### Recommended
No customization needed -- all modes work with sensible defaults.

### Optional

| Customization | Location | Impact |
|--------------|----------|--------|
| Thinking modes | `src/Thinking/Modes/*.md` | Adjust mode behavior and workflows |
| Research sources | `src/Research/Sources.md` | Add custom research data sources |
| Investigation templates | `src/Investigation/Templates/` | Modify OSINT/PI workflows |
| Agent traits | `~/.copilot/pai/traits/` | Add custom expertise specializations |
| MCP tools | `mcp/*.schema.json` | Extend tool definitions |

---

## Credits

- **Original concept:** Daniel Miessler -- PAI system and Claude Code packs
- **Copilot CLI port:** Enables terminal-based access to PAI's proven analytical frameworks
- **Inspired by:** The recognition that sophisticated thinking should be accessible everywhere

---

## Related Work

- **PAI Thinking Pack** (Claude Code) -- Original seven thinking modes
- **PAI Research Pack** (Claude Code) -- Original four research modes
- **PAI Agents Pack** (Claude Code) -- Trait composition system
- **GitHub Copilot CLI** -- The platform enabling this capability

---

## Works Well With

- **Blue Bird tools** -- Azure DevOps integration for code history, work items, wiki searches
- **Kusto tools** -- Data exploration and diagnostics
- **Domain-specific packs** -- Security, Infrastructure, or DevOps packs for specialized analysis

---

## Changelog

### 1.0.0 - 2026-03-20
- Initial release: PAI skills ported to Copilot CLI
- Seven thinking modes: FirstPrinciples, IterativeDepth, BeCreative, Council, RedTeam, WorldThreatModel, Science
- Four research modes: LiteratureSearch, MarketAnalysis, ThreatIntelligence, CompetitiveResearch
- Investigation skills: OSINT and PI workflows
- Agents: Trait composition system with 8+ specializations
- MCP infrastructure for extensible tool integration
- Session state management via SQL database
- Background task execution with full CLI tool access
