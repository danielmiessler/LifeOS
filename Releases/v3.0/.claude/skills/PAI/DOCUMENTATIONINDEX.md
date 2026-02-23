---
name: DocumentationIndex
description: Complete CORE documentation index with detailed descriptions. Reference material extracted from SKILL.md for on-demand loading.
created: 2025-12-17
extracted_from: SKILL.md lines 339-401
---

# CORE Documentation Index

**Quick reference in SKILL.md** → For full details, see this file

---

## 📚 Documentation Index & Route Triggers

**All documentation files are in `~/.claude/skills/PAI/` with SYSTEM/ and USER/ subdirectories. Read these files when you need deeper context.**

**Core Architecture & Philosophy:**
- `SYSTEM/PAISYSTEMARCHITECTURE.md` - System architecture and philosophy, foundational principles (CLI-First, Deterministic Code, Prompts Wrap Code) | ⭐ PRIMARY REFERENCE | Triggers: "system architecture", "how does the system work", "system principles"
- `SYSTEM/FEEDSYSTEM.md` - Feed System: intelligence aggregation, multi-dimensional rating, rule-based routing, Arbol integration | ⭐ CRITICAL | Triggers: "feed system", "intelligence routing", "content monitoring", "feed architecture", "rating system", "routing rules"
- `SYSTEM/ACTIONS.md` - Actions: atomic units of work (LLM, shell, custom) deployed as Cloudflare Workers | Triggers: "actions", "arbol actions", "action workers"
- `SYSTEM/PIPELINES.md` - Pipelines: action chaining with verification gates | Triggers: "pipelines", "action chaining", "verification gates"
- `SYSTEM/FLOWS.md` - Flows: scheduled source → pipeline → destination orchestration via Cloudflare Cron | Triggers: "flows", "cron triggers", "scheduled pipelines", "arbol flows"
- `SYSTEM/ARBOLSYSTEM.md` - Arbol: unified overview of the Cloudflare Workers execution platform (Actions, Pipelines, Flows) | Triggers: "arbol", "arbol system", "cloud execution", "worker architecture"
- `SYSTEM/DEPLOYMENT.md` - End-to-end Cloudflare Workers deployment guide (Wrangler, secrets, service bindings, cron triggers) | Triggers: "deploy", "cloudflare deploy", "wrangler", "deploy action", "deploy worker"
- `SYSTEM/CLI.md` - PAI command-line tools: Algorithm CLI (loop/interactive mode) and Arbol CLI (actions/pipelines) | Triggers: "algorithm CLI", "pai CLI", "command line", "run algorithm", "run action"
- `SYSTEM/SYSTEM_USER_EXTENDABILITY.md` - Two-tier SYSTEM/USER architecture for extensibility | Triggers: "two tier", "system vs user", "how to extend", "customization pattern"
- `SYSTEM/CLIFIRSTARCHITECTURE.md` - CLI-First pattern details
- `SYSTEM/BROWSERAUTOMATION.md` - Browser automation and visual verification | Triggers: "browser automation", "playwright", "screenshot verification"
- `SYSTEM/SKILLSYSTEM.md` - Custom skill system with triggers and workflow routing | ⭐ CRITICAL | Triggers: "how to structure a skill", "skill routing", "create new skill"

**Skill Execution:**

When a skill is invoked, follow the SKILL.md instructions step-by-step: execute voice notifications, use the routing table to find the workflow, and follow the workflow instructions in order.

**🚨 MANDATORY USE WHEN FORMAT (Always Active):**

Every skill description MUST use this format:
```
description: [What it does]. USE WHEN [intent triggers using OR]. [Capabilities].
```

**Example:**
```
description: Complete blog workflow. USE WHEN user mentions their blog, website, or site, OR wants to write, edit, or publish content. Handles writing, editing, deployment.
```

**Rules:**
- `USE WHEN` keyword is MANDATORY (Claude Code parses this)
- Use intent-based triggers: `user mentions`, `user wants to`, `OR`
- Do NOT list exact phrases like `'write a blog post'`
- Max 1024 characters

See `SYSTEM/SKILLSYSTEM.md` for complete documentation.

**Development & Testing:**
- `USER/TECHSTACKPREFERENCES.md` - Core technology stack (TypeScript, bun, Cloudflare) | Triggers: "what stack do I use", "TypeScript or Python", "bun or npm"
- Testing standards → Development Skill

**Agent System:**
- **Agents Skill** (`~/.claude/skills/Agents/`) - Complete agent composition system | See Agents skill for custom agent creation, traits, and voice mappings
- Delegation patterns are documented inline in the "Delegation & Parallelization" section below

**Response & Communication:**
- `USER/RESPONSEFORMAT.md` - Mandatory response format | Triggers: "output format", "response format"
- `SYSTEM/THEFABRICSYSTEM.md` - Fabric patterns | Triggers: "fabric patterns", "prompt engineering"
- Voice notifications → VoiceServer (system alerts, agent feedback)

**Configuration & Systems:**
- `SYSTEM/THEHOOKSYSTEM.md` - Hook configuration | Triggers: "hooks configuration", "create custom hooks"
- `SYSTEM/MEMORYSYSTEM.md` - Memory documentation | Triggers: "memory system", "capture system", "work tracking", "session history"
- `SYSTEM/TERMINALTABS.md` - Terminal tab state system (colors + suffixes for working/completed/awaiting/error states) | Triggers: "tab colors", "tab state", "kitty tabs"

**Reference Data:**
- `USER/ASSETMANAGEMENT.md` - Digital assets registry for instant recognition & vulnerability management | ⭐ CRITICAL | Triggers: "my site", "vulnerability", "what uses React", "upgrade path", "tech stack"
- `USER/CONTACTS.md` - Complete contact directory | Triggers: "who is Angela", "Bunny's email", "show contacts" | Top 7 quick ref below
- `USER/DEFINITIONS.md` - Canonical definitions | Triggers: "definition of AGI", "how do we define X"
- `SYSTEM/PAISECURITYSYSTEM/` - Security architecture, patterns, and defense protocols | Triggers: "security system", "security patterns", "prompt injection"
- `skills/PAI/USER/PAISECURITYSYSTEM/` - Personal security policies (customize with your own patterns) | See security section below for critical always-active rules

**Workflows:**
- `Workflows/` - Operational procedures (git, delegation, MCP, blog deployment, etc.)

---

**See Also:**
- SKILL.md > Documentation Index - Condensed table version
