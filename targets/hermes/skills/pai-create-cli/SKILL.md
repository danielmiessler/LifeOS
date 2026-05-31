---
name: pai-create-cli
description: "TypeScript CLI generator. Three tiers: zero-dependency (llcli), Commander.js, and oclif. Supports AddCommand and UpgradeTier workflows for progressive scaffolding."
version: 5.0.0
author: PAI v5.0 → Hermes Port
license: MIT
metadata:
  hermes:
    tags: [pai]
    related_skills: []
use_when: "You need to scaffold a TypeScript CLI tool from scratch — choose between zero-dependency, Commander.js, or oclif framework, then add commands or upgrade tiers interactively."
not_for: "Python CLI generation; JavaScript (non-TypeScript) CLI tools; existing CLI projects that need major restructuring."
tags: [cli, typescript, scaffolding, commander, oclif, llcli]
---

<!-- Voice notification — fire-and-forget on invocation -->
```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the pai-create-cli skill"}' \
  > /dev/null 2>&1 &
```


# pai-create-cli: TypeScript CLI Generation

## Workflow Routing

| Trigger | Route |
|---------|-------|
| User wants a new CLI tool | Select tier → scaffold project → add commands |
| User wants to add a command to existing CLI | Detect tier → generate command boilerplate → register |
| User wants to upgrade tier | Extract existing CLI → scaffold new tier → migrate commands |
| User wants zero-deps CLI | Tier 1: llcli → minimal single-file CLI |
| User wants Commander.js CLI | Tier 2: Commander.js → structured multi-command CLI |
| User wants oclif CLI | Tier 3: oclif → production-grade plugin-based CLI |

## CLI Tiers

### Tier 1: Zero-Dependency (llcli)
```
Characteristics:
- Single TypeScript file
- Zero npm dependencies
- Minimal argument parsing (positional + flags)
- Output: stdout with colors via ANSI escape codes
- Perfect for: tiny tools, internal scripts, one-off utilities

Scaffold:
1. Create: cli.ts (single file)
2. Parse process.argv manually:
   a. First non-flag arg = command
   b. --flag value or -f value
   c. --flag (boolean)
3. Implement help text manually
4. Implement 1-3 commands
5. Add hashbang: #!/usr/bin/env node
6. Register in package.json: "bin": {"tool-name": "cli.ts"}
```

### Tier 2: Commander.js
```
Characteristics:
- Uses commander package for argument parsing
- Structured multi-file: bin/, commands/, lib/
- Auto-generated --help
- Subcommand support with nested help
- Perfect for: team tools, multi-command CLIs

Scaffold:
1. mkdir -p src/commands src/lib
2. Install: commander, typescript, @types/node
3. Create src/index.ts (main entry):
   - program = new Command()
   - program.name().description().version()
   - register commands
4. Create src/commands/*.ts (one per command):
   - export function register(program)
   - command.name().description().action(handler)
5. Create src/lib/*.ts (shared utilities)
6. Create tsconfig.json + build scripts
7. Register bin in package.json
```

### Tier 3: oclif
```
Characteristics:
- Full oclif framework
- Plugin architecture
- Auto-generated docs, man pages, tab completion
- Hooks, topics, multi-command with flags parsing
- Perfect for: production CLIs, developer tools, published packages

Scaffold:
1. npx oclif generate <name> (or manual scaffold)
2. Structure:
   - src/commands/ (one file per command)
   - src/hooks/ (lifecycle hooks)
   - src/index.ts (plugin entry)
3. Each command: extends Command
   - static description, flags, args
   - async run() method
4. Generate README from help
5. Publish to npm
```

## Step-by-Step Procedures

### 1. Scaffold New CLI (Tier Selection)
```
1. Ask user: what's the CLI name, purpose, and desired tier?
2. Create project directory: mkdir -p <name>
3. Initialize: write package.json, tsconfig.json
4. Based on tier:
   a. Tier 1: Create single cli.ts with help + 1 example command
   b. Tier 2: Create src/index.ts, example command, Commander setup
   c. Tier 3: Create oclif scaffold with help command
5. Install dependencies based on tier
6. Add build script, bin entry
7. Verify: build + run --help
```

### 2. AddCommand Workflow
```
1. Detect existing CLI tier:
   a. Check package.json for commander/oclif dependencies
   b. Check for src/commands/ directory structure
   c. Default: Tier 1 if minimal
2. User provides: command name, description, arguments, flags, behavior
3. Generate command boilerplate:
   a. Tier 1: Add to switch/case in cli.ts
   b. Tier 2: Create src/commands/<name>.ts + register in index.ts
   c. Tier 3: Create src/commands/<name>/index.ts
4. Implement handler stub with argument/flag parsing
5. Register command:
   a. Tier 2: program.addCommand(cmd)
   b. Tier 3: auto-discovered by file path
6. Verify: build + run <command> --help
```

### 3. UpgradeTier Workflow
```
1. Detect current tier from project structure
2. If Tier 1 → Tier 2:
   a. Extract all commands from cli.ts
   b. Create src/index.ts with Commander setup
   c. Create src/commands/*.ts for each command
   d. Update package.json deps
   e. Update tsconfig for outDir
   f. Remove cli.ts
3. If Tier 2 → Tier 3:
   a. Extract command implementations
   b. Create oclif project structure
   c. Create src/commands/*.ts (oclif format)
   d. Rewrite index.ts as oclif plugin
   e. Update package.json
4. Verify all original commands still work
5. Report upgrade summary
```

### 4. Multi-Command Patterns
```
For all tiers, support these command patterns:
1. Simple: cli <command> [args]
2. Nested: cli <topic> <command> [args]
3. Flags: --verbose, --output=file, --config path
4. Interactive: prompt for missing required args
5. Pipe: support stdin/stdout chaining
```

## Gotchas

- Tier 1 (llcli) has no argument validation beyond manual parsing
- Tier 3 (oclif) requires Node.js >= 18
- Package.json "bin" must point to compiled JS, not TS directly
- Commander.js v11 changed some APIs from v9 — verify compatibility
- oclif generates a lot of boilerplate; consider if Tier 2 is sufficient
- AddCommand on unknown tier structure may produce broken code
- UpgradeTier is one-directional (no downgrade support)
- Always verify build succeeds before reporting completion
- Tab completion (oclif) needs shell integration step

## Execution Log Pattern

```
[PAI-CREATE-CLI] Name: "mycli" | Tier: Commander.js (2)
[SCAFFOLD] Project directory: ./mycli
[INIT] package.json, tsconfig.json, src/index.ts
[CMD] Adding "search" command with args: [query], flags: [--limit]
[GENERATE] src/commands/search.ts → handler stub
[REGISTER] program.addCommand(searchCmd) in index.ts
[BUILD] tsc → ./dist/index.js
[VERIFY] node dist/index.js search --help → OK
[COMPLETE] CLI scaffolded with 1 command in 6.3s
```
