---
name: create-cli
description: "Generate production-ready TypeScript CLIs with 3-tier template system (simple argv, yargs, oclif), type safety, error handling, and documentation. USE WHEN create CLI, build CLI, command-line tool, wrap API, add command, upgrade tier, TypeScript CLI."
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/CreateCLI/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# CreateCLI

Generate production-ready TypeScript CLIs with type safety, error handling, and comprehensive documentation.

## Workflow Routing

- Create new CLI from scratch → `Workflows/CreateCli.md`
- Add command to existing CLI → `Workflows/AddCommand.md`
- Upgrade CLI to higher tier → `Workflows/UpgradeTier.md`

---

## Three-Tier Template System

**Tier 1: llcli-Style (DEFAULT — 80% of use cases)**
- Manual `process.argv` parsing, zero framework dependencies
- Bun + TypeScript, ~300-400 lines
- Use for: 2-10 commands, simple arguments, JSON output, no subcommands

**Tier 2: Commander.js (15% of use cases)**
- Framework-based parsing, subcommands + nested options, auto-generated help
- Use for: 10+ commands needing grouping, complex nested options, plugin architecture

**Tier 3: oclif (5% — reference only)**
- Enterprise-grade plugin systems (Heroku/Salesforce CLI scale)

**Validation checkpoint:** Default to Tier 1. Only escalate when request explicitly needs subcommand grouping or 10+ commands.

---

## Every Generated CLI Includes

1. **Implementation** — TypeScript source, all commands functional, error handling with proper exit codes
2. **Documentation** — README.md, QUICKSTART.md, inline `--help` text
3. **Dev Setup** — package.json (Bun), tsconfig.json (strict mode), .env.example
4. **Quality** — Type-safe, deterministic JSON output, composable (pipes to jq/grep), exit code compliance

## PAI Stack Alignment

- **Runtime:** Bun (NOT Node.js)
- **Language:** TypeScript (NOT JavaScript/Python)
- **Package Manager:** Bun (NOT npm/yarn/pnpm)
- **Output:** Deterministic JSON (composable)

## Repository Placement

- `~/.claude/Bin/[cli-name]/` — Personal CLIs
- `~/Projects/[project-name]/` — Project-specific CLIs
- `${PROJECTS_DIR}/PAI/Examples/clis/` — Example CLIs (PUBLIC repo)

**SAFETY:** Always verify repository location before git operations.

---

## Examples

**API Client CLI (Tier 1):**
```
User: "Create a CLI for the GitHub API — list repos, create issues, search code"
--> Generated at ~/.claude/Bin/ghcli/
--> ghcli.ts (~350 lines), package.json, tsconfig.json, .env.example, README.md, QUICKSTART.md
```
```bash
ghcli repos --user exampleuser
ghcli issues create --repo pai --title "Bug fix"
ghcli search "typescript CLI"
```

**Data Pipeline (Tier 2):**
```
User: "Create a CLI for data transformation with multiple formats, validation, and analysis"
--> Commander.js with subcommands
```
```bash
data-cli convert json csv input.json
data-cli validate schema data.json
data-cli analyze stats data.csv
```

---

## Extended Reference

- `Workflows/CreateCli.md` — Decision tree, 10-step generation process
- `Workflows/AddCommand.md` — Add commands to existing CLIs
- `Workflows/UpgradeTier.md` — Migrate simple → complex
- `FrameworkComparison.md` — Manual vs Commander vs oclif
- `Patterns.md` — Common CLI patterns (from llcli analysis)
- `TypescriptPatterns.md` — Type safety patterns

---

## Quality Gates

**Validation checkpoint:** Every generated CLI must pass:
- [ ] TypeScript compiles with zero errors (strict mode)
- [ ] All commands functional with proper exit codes (0 success, 1 error)
- [ ] README + QUICKSTART + `--help` text present
- [ ] Deterministic JSON output, composable with pipes
- [ ] Follows PAI stack (Bun, TypeScript)
