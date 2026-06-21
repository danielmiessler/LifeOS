---
name: CreateCLI
description: "Generate production-ready TypeScript CLIs using a 3-tier template system: Tier 1 llcli-style manual arg parsing (zero deps, Bun + TypeScript, ~300-400 lines — 80% of cases), Tier 2 Commander.js (subcommands, nested options, auto-help — 15%), Tier 3 oclif reference only (enterprise scale — 5%). Every generated CLI includes full implementation, README + QUICKSTART docs, package.json with Bun, tsconfig strict mode, type-safe throughout, JSON output, exit code compliance. Workflows: CreateCli (from scratch), AddCommand (extend existing), UpgradeTier (migrate Tier 1 → 2). Outputs go to ~/.claude/Bin/ or ~/Projects/. Tier 1 (llcli pattern — 327 lines, zero deps) suits API clients, data transformers, simple automation — 2-10 commands, JSON output. Tier 2 (Commander.js) for 10+ commands, nested options, or plugin architecture. Tier 3 (oclif) is documentation-only reference for Heroku/Salesforce scale. Output tree: {name}.ts + package.json + tsconfig.json (strict) + .env.example + README.md + QUICKSTART.md. Quality gates: zero TypeScript errors, exit codes 0/1, --help comprehensive, JSON output pipes to jq/grep. USE WHEN create CLI, build CLI, command-line tool, wrap API, add command, upgrade tier, TypeScript CLI, generate CLI, CLI for API, command-line wrapper. NOT FOR PAI skill scaffolding (use CreateSkill). NOT FOR Python or npm-based tooling."
effort: medium
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/CreateCLI/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# CreateCLI

**Automated CLI Generation System**

Generate production-ready TypeScript CLIs with comprehensive documentation, type safety, error handling, and CLI-First Architecture principles.

---

## Workflow Routing

Route to the appropriate workflow based on the request.

**When executing a workflow, output this notification directly:**

```
Running the **WorkflowName** workflow in the **CreateCLI** skill to ACTION...
```

  - Create a new CLI tool from scratch → `Workflows/CreateCli.md`
  - Add a new command to existing CLI → `Workflows/AddCommand.md`
  - Upgrade CLI to higher tier → `Workflows/UpgradeTier.md`

---

## 🚀 WHEN TO ACTIVATE THIS SKILL

Activate when you see these patterns:

### Direct Requests
- "Create a CLI for [API/service/tool]"
- "Build a command-line interface for X"
- "Make a CLI that does Y"
- "Generate a TypeScript CLI"
- "I need a CLI tool for Z"

### Context Clues
- User describes repetitive API calls → Suggest CLI
- User mentions "I keep typing this command" → Suggest CLI wrapper
- User has bash script doing complex work → Suggest TypeScript CLI replacement
- User working with API that lacks official CLI → Suggest creating one

### Examples
- ✅ "Create a CLI for the GitHub API"
- ✅ "Build a command-line tool to process CSV files"
- ✅ "Make a CLI for my database migrations"
- ✅ "Generate a CLI that wraps this API"
- ✅ "I need a tool like llcli but for Notion API"

---

## 💡 CORE CAPABILITIES

### Three-Tier Template System

**Tier 1: llcli-Style (DEFAULT - 80% of use cases)**
- Manual argument parsing (process.argv)
- Zero framework dependencies
- Bun + TypeScript
- Type-safe interfaces
- ~300-400 lines total
- **Perfect for:** API clients, data transformers, simple automation

**When to use Tier 1:**
- ✅ 2-10 commands
- ✅ Simple arguments (flags, values)
- ✅ JSON output
- ✅ No subcommands
- ✅ Fast development

**Tier 2: Commander.js (ESCALATION - 15% of use cases)**
- Framework-based parsing
- Subcommands + nested options
- Auto-generated help
- Plugin-ready
- **Perfect for:** Complex multi-command tools

**When to use Tier 2:**
- ❌ 10+ commands needing grouping
- ❌ Complex nested options
- ❌ Plugin architecture
- ❌ Multiple output formats

**Tier 3: oclif (REFERENCE ONLY - 5% of use cases)**
- Documentation only (no templates)
- Enterprise-grade plugin systems
- **Perfect for:** Heroku CLI, Salesforce CLI scale (rare)

### What Every Generated CLI Includes

**1. Complete Implementation**
- TypeScript source with full type safety
- All commands functional and tested
- Error handling with proper exit codes
- Configuration management

**2. Comprehensive Documentation**
- README.md with philosophy, usage, examples
- QUICKSTART.md for common patterns
- Inline help text (--help)
- API response documentation

**3. Development Setup**
- package.json (Bun configuration)
- tsconfig.json (strict mode)
- .env.example (configuration template)
- File permissions configured

**4. Quality Standards**
- Type-safe throughout
- Deterministic output (JSON)
- Composable (pipes to jq, grep)
- Error messages with context
- Exit code compliance

---

## 🏗️ INTEGRATION WITH PAI

### Technology Stack Alignment

Generated CLIs follow PAI standards:
- ✅ **Runtime:** Bun (NOT Node.js)
- ✅ **Language:** TypeScript (NOT JavaScript or Python)
- ✅ **Package Manager:** Bun (NOT npm/yarn/pnpm)
- ✅ **Testing:** Vitest (when tests added)
- ✅ **Output:** Deterministic JSON (composable)
- ✅ **Documentation:** README + QUICKSTART (llcli pattern)

### Repository Placement

Generated CLIs go to:
- `~/.claude/Bin/[cli-name]/` - Personal CLIs (like llcli)
- `~/Projects/[project-name]/` - Project-specific CLIs
- `${PROJECTS_DIR}/PAI/Examples/clis/` - Example CLIs (PUBLIC repo)

**SAFETY:** Always verify repository location before git operations

### CLI-First Architecture Principles

Every generated CLI follows:
1. **Deterministic** - Same input → Same output
2. **Clean** - Single responsibility
3. **Composable** - JSON output pipes to other tools
4. **Documented** - Comprehensive help and examples
5. **Testable** - Predictable behavior

---

## 📚 EXTENDED CONTEXT

**For detailed information, read these files:**

### Workflow Documentation
- `Workflows/CreateCli.md` - Main CLI generation workflow (decision tree, 10-step process)
- `Workflows/AddCommand.md` - Add commands to existing CLIs
- `Workflows/UpgradeTier.md` - Migrate simple → complex

### Reference Documentation
- `FrameworkComparison.md` - Manual vs Commander vs oclif (with research)
- `Patterns.md` - Common CLI patterns (from llcli analysis)
- `TypescriptPatterns.md` - Type safety patterns (from tsx, vite, bun research)

---

## 📖 EXAMPLES

### Example 1: API Client CLI (Tier 1)

**User Request:**
"Create a CLI for the GitHub API that can list repos, create issues, and search code"

**Generated Structure:**
```
~/.claude/Bin/ghcli/
├── ghcli.ts              # 350 lines, complete implementation
├── package.json          # Bun + TypeScript
├── tsconfig.json         # Strict mode
├── .env.example          # GITHUB_TOKEN=your_token
├── README.md             # Full documentation
└── QUICKSTART.md         # Common use cases
```

**Usage:**
```bash
ghcli repos --user exampleuser
ghcli issues create --repo pai --title "Bug fix"
ghcli search "typescript CLI"
ghcli --help
```

---

### Example 2: File Processor (Tier 1)

**User Request:**
"Build a CLI to convert markdown files to HTML with frontmatter extraction"

**Generated Structure:**
```
~/.claude/Bin/md2html/
├── md2html.ts
├── package.json
├── README.md
└── QUICKSTART.md
```

**Usage:**
```bash
md2html convert input.md output.html
md2html batch *.md output/
md2html extract-frontmatter post.md
```

---

### Example 3: Data Pipeline (Tier 2)

**User Request:**
"Create a CLI for data transformation with multiple formats, validation, and analysis commands"

**Generated Structure:**
```
~/.claude/Bin/data-cli/
├── data-cli.ts           # Commander.js with subcommands
├── package.json
├── README.md
└── QUICKSTART.md
```

**Usage:**
```bash
data-cli convert json csv input.json
data-cli validate schema data.json
data-cli analyze stats data.csv
data-cli transform filter --column=status --value=active
```

---

## ✅ QUALITY STANDARDS

Every generated CLI must pass these gates:

### 1. Compilation
- ✅ TypeScript compiles with zero errors
- ✅ Strict mode enabled
- ✅ No `any` types except justified

### 2. Functionality
- ✅ All commands work as specified
- ✅ Error handling comprehensive
- ✅ Exit codes correct (0 success, 1 error)

### 3. Documentation
- ✅ README explains philosophy and usage
- ✅ QUICKSTART has common examples
- ✅ --help text comprehensive
- ✅ All flags/options documented

### 4. Code Quality
- ✅ Type-safe throughout
- ✅ Clean function separation
- ✅ Error messages actionable
- ✅ Configuration externalized

### 5. Integration
- ✅ Follows PAI tech stack (Bun, TypeScript)
- ✅ CLI-First Architecture principles
- ✅ Deterministic output (JSON)
- ✅ Composable with other tools

---

## 🎯 PHILOSOPHY

### Why This Skill Exists

Developers repeatedly create CLIs for APIs and tools. Each time:
1. Starts with bash script
2. Realizes it needs error handling
3. Realizes it needs help text
4. Realizes it needs type safety
5. Rewrites in TypeScript
6. Adds documentation
7. Now has production CLI

**This skill automates steps 1-7.**

### The llcli Pattern

The `llcli` CLI (Limitless.ai API) proves this pattern works:
- 327 lines of TypeScript
- Zero dependencies (no framework)
- Complete error handling
- Comprehensive documentation
- Production-ready immediately

**This skill replicates that success.**

### Design Principles

1. **Start Simple** - Default to Tier 1 (llcli-style)
2. **Escalate When Needed** - Tier 2 only when justified
3. **Complete, Not Scaffold** - Every CLI is production-ready
4. **Documentation First** - README explains "why" not just "how"
5. **Type Safety** - TypeScript strict mode always

---

## 🔗 RELATED SKILLS

- **development** - For complex feature development (not CLI-specific)
- **mcp** - For web scraping CLIs (Bright Data, Apify wrappers)
- **lifelog** - Example of skill using llcli

---

**This skill turns "I need a CLI for X" into production-ready tools in minutes, following proven patterns from llcli and CLI-First Architecture.**

## Gotchas

- **Always use bun, never npm/npx.** Zero exceptions per system prompt.
- **TypeScript only.** Never generate Python CLIs unless the user explicitly approves.
- **3-tier system:** Start with the simplest tier that fits. Don't over-engineer a Tier 3 CLI when Tier 1 suffices.

## Execution Log

After completing any workflow, append a single JSONL entry:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"CreateCLI","workflow":"WORKFLOW_USED","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> ~/.claude/PAI/MEMORY/SKILLS/execution.jsonl
```

Replace `WORKFLOW_USED` with the workflow executed, `8_WORD_SUMMARY` with a brief input description, and `SECONDS` with approximate wall-clock time. Log `status: "error"` if the workflow failed.
